#!/usr/bin/env python3
"""Verify every source byte and gitlink against a pinned skillz Git tree.

Read-only. This NEVER asserts source rights or composition eligibility.
"""
import argparse
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys

from scripts.catalog_handoff import (
    COMMIT, TREE, MANIFEST_BLOB, Refusal, require, read_exact, sha256, git_blob,
    parse_json, inspect,
)

MAX_TREE_BYTES = 2_000_000


def git(root, *args):
    try:
        result = subprocess.run(
            ['git', '-C', str(root), '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', *args],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise Refusal('SOURCE_GIT', 'pinned source Git metadata unavailable')
    require(result.returncode == 0, 'SOURCE_GIT', 'pinned source Git read failed')
    require(len(result.stdout) <= MAX_TREE_BYTES, 'SOURCE_GIT', 'Git output exceeded bound')
    return result.stdout


def git_tree_index(root):
    raw = git(root, 'ls-tree', '-r', '--full-tree', '-z', 'HEAD')
    out = {}
    try:
        for item in raw.split(b'\0'):
            if not item:
                continue
            header, name = item.split(b'\t', 1)
            mode, kind, sha = header.decode('ascii').split(' ')
            path = name.decode('utf-8', errors='strict')
            require(path not in out, 'SOURCE_TREE', 'duplicate Git path')
            out[path] = {'mode': mode, 'kind': kind, 'sha': sha}
    except (UnicodeError, ValueError):
        raise Refusal('SOURCE_TREE', 'invalid Git tree serialization')
    return out


def safe_relative(path):
    require(isinstance(path, str) and 0 < len(path) <= 500 and '\\' not in path and '\0' not in path,
            'SOURCE_PATH', 'invalid source path')
    p = PurePosixPath(path)
    require(not p.is_absolute() and str(p) == path and all(part not in ('', '.', '..') for part in p.parts),
            'SOURCE_PATH', 'unsafe source path')
    return p


def read_source(root, path, expected_bytes):
    p = safe_relative(path)
    current = root
    for part in p.parts[:-1]:
        current = current / part
        try:
            mode = current.lstat().st_mode
        except OSError:
            raise Refusal('SOURCE_MISSING', 'missing parent of ' + path)
        require(stat.S_ISDIR(mode), 'SOURCE_SYMLINK', 'non-directory/symlinked parent: ' + path)
    leaf = current / p.parts[-1]
    try:
        mode = leaf.lstat().st_mode
    except OSError:
        raise Refusal('SOURCE_MISSING', 'source file missing: ' + path)
    require(stat.S_ISREG(mode), 'SOURCE_SYMLINK', 'non-regular source file: ' + path)
    require(type(expected_bytes) is int and 0 < expected_bytes <= 16_000_000,
            'SOURCE_DECLARATION', 'invalid source byte count: ' + path)
    data = read_exact(leaf)
    require(len(data) == expected_bytes, 'SOURCE_BYTES', 'source file byte count mismatch: ' + path)
    return data


def verify_source_tree(root, manifest, *, expected_commit=COMMIT, expected_tree=TREE):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), 'SOURCE_DIRECTORY', 'source checkout must be a real directory')
    root = root.resolve()
    top = git(root, 'rev-parse', '--show-toplevel').decode('utf-8').strip()
    require(Path(top).resolve() == root, 'SOURCE_CHECKOUT', 'must supply the root of the pinned checkout')
    commit_id = git(root, 'rev-parse', 'HEAD').decode('ascii').strip()
    tree_id = git(root, 'rev-parse', 'HEAD^{tree}').decode('ascii').strip()
    require(commit_id == expected_commit and tree_id == expected_tree,
            'SOURCE_PIN', 'source Git commit or tree differs from pinned input')
    require(isinstance(manifest, dict), 'MANIFEST_SCHEMA', 'manifest not an object')
    source = manifest.get('source')
    require(isinstance(source, dict) and source.get('commit') == expected_commit and
            source.get('git_tree_sha1') == expected_tree, 'SOURCE_PIN', 'manifest source does not match checkout')
    tree = git_tree_index(root)
    files, links = manifest.get('source_files'), manifest.get('submodule_pins')
    require(isinstance(files, list) and isinstance(links, list), 'SOURCE_DECLARATION', 'source index missing')
    by_file = {}
    for entry in files:
        require(isinstance(entry, dict), 'SOURCE_DECLARATION', 'malformed source declaration')
        path = entry.get('path')
        safe_relative(path)
        require(path not in by_file, 'SOURCE_DECLARATION', 'duplicate source declaration')
        by_file[path] = entry
    by_link = {}
    for entry in links:
        require(isinstance(entry, dict), 'SOURCE_DECLARATION', 'malformed submodule declaration')
        path = entry.get('path')
        safe_relative(path)
        require(path not in by_link, 'SOURCE_DECLARATION', 'duplicate submodule declaration')
        by_link[path] = entry
    require(set(by_file) == {name for name, item in tree.items() if item['kind'] == 'blob'},
            'SOURCE_INVENTORY', 'tracked blob inventory differs from manifest')
    require(set(by_link) == {name for name, item in tree.items() if item['kind'] == 'commit'},
            'SOURCE_INVENTORY', 'tracked gitlink inventory differs from manifest')
    total = 0
    for path, entry in sorted(by_file.items()):
        item = tree[path]
        require(item['mode'] in ('100644', '100755'), 'SOURCE_TREE', 'unexpected tracked file mode: ' + path)
        require(isinstance(entry.get('git_blob_sha1'), str) and item['sha'] == entry['git_blob_sha1'],
                'SOURCE_BLOB', 'Git tree blob differs: ' + path)
        data = read_source(root, path, entry.get('bytes'))
        require(git_blob(data) == item['sha'], 'SOURCE_BLOB', 'actual bytes differ from Git blob: ' + path)
        require(isinstance(entry.get('sha256'), str) and sha256(data) == entry['sha256'],
                'SOURCE_SHA256', 'actual bytes differ from declared SHA-256: ' + path)
        total += len(data)
    for path, entry in sorted(by_link.items()):
        item = tree[path]
        require(item['mode'] == '160000' and isinstance(entry.get('pinned_commit'), str) and
                entry['pinned_commit'] == item['sha'],
                'SUBMODULE_PIN', 'submodule gitlink differs: ' + path)
    return {'schema': 'qortara/catalog-source-integrity/1', 'source_commit': commit_id,
            'source_tree': tree_id, 'tracked_file_count': len(by_file), 'source_bytes_verified': total,
            'file_sha256_verified': len(by_file), 'gitlinks_verified': len(by_link),
            'source_commit_tree_authentication': 'GIT_OBJECT_PIN_MATCH',
            'independent_publisher_authentication': False, 'source_rights_assessed': False,
            'composition_eligible': False, 'production_qualified': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--handoff', required=True, type=Path)
    parser.add_argument('--source-checkout', required=True, type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args(argv)
    try:
        base = inspect(args.handoff)
        raw = read_exact(args.handoff / 'manifest.json', 4_000_000)
        require(git_blob(raw) == MANIFEST_BLOB, 'MANIFEST_PIN', 'export manifest changed')
        snapshot = verify_source_tree(args.source_checkout, parse_json(raw))
        report = json.dumps({'schema': 'qortara/catalog-combined-inspection/1',
                             'handoff': base, 'source_snapshot': snapshot}, sort_keys=True, indent=2) + '\n'
        if args.report:
            with args.report.open('x', encoding='utf-8') as out:
                out.write(report)
        print(report, end='')
        return 0
    except Refusal as exc:
        print(json.dumps({'state': 'REFUSED', 'code': exc.code,
                          'message': str(exc), 'composition_eligible': False}), file=sys.stderr)
        return 2
    except FileExistsError:
        print('{"state":"REFUSED","code":"REPORT_EXISTS","composition_eligible":false}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
