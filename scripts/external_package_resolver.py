#!/usr/bin/env python3
"""C3 read-only full-package verification for a selected pinned external Git source.

The verified skillz handoff is source-navigation evidence, not a downloaded
package, publisher signature, license decision or permission for agent actions.
No skill content is executed; the inspector only hashes files and lists leads.
"""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from urllib.parse import urlsplit

from scripts.catalog_handoff import COMMIT, Refusal, git_blob, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.package_resolver import _markdown_leads
from scripts.verify_catalog_source import git, read_source, safe_relative

SCHEMA = "qortara/external-package-inspection/1"
OID = re.compile(r"^[0-9a-f]{40}$")
MAX_FILES = 2000
MAX_FILE_SIZE = 16_000_000
MAX_TOTAL_BYTES = 64_000_000


def _oid(value, label):
    require(isinstance(value, str) and bool(OID.fullmatch(value)),
            "EXTERNAL_PIN", "invalid " + label)
    return value


def _github_repo(value):
    require(isinstance(value, str) and len(value) <= 256,
            "EXTERNAL_REPOSITORY", "repository URI missing")
    url = urlsplit(value)
    require(url.scheme == "https" and url.netloc == "github.com" and
            not url.username and not url.password and not url.query and not url.fragment,
            "EXTERNAL_REPOSITORY", "only a canonical HTTPS GitHub origin is supported")
    parts = url.path.strip("/").split("/")
    require(len(parts) == 2 and all(parts) and
            all(re.fullmatch(r"[A-Za-z0-9_.-]+", p) for p in parts),
            "EXTERNAL_REPOSITORY", "repository URI must have exactly owner/repository")
    if parts[1].endswith(".git"):
        parts[1] = parts[1][:-4]
    require(bool(parts[1]) and parts[1] not in (".", ".."),
            "EXTERNAL_REPOSITORY", "invalid GitHub repository path")
    return "https://github.com/" + "/".join(parts)


def _checkout_identity(root, expected_repo, expected_commit, expected_tree):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(),
            "EXTERNAL_CHECKOUT", "third-party checkout must be a real directory")
    top = git(root, "rev-parse", "--show-toplevel").decode("utf-8").strip()
    require(Path(top).resolve() == root.resolve(),
            "EXTERNAL_CHECKOUT", "supply exact separate third-party repository root")
    got_commit = git(root, "rev-parse", "HEAD").decode("ascii").strip()
    got_tree = git(root, "rev-parse", "HEAD^{tree}").decode("ascii").strip()
    require(got_commit == expected_commit and got_tree == expected_tree,
            "EXTERNAL_SOURCE_PIN", "external checkout HEAD or tree does not match declared pins")
    # Git config is an informative consistency check, not independent proof
    # of who published the objects. The CI job separately pins an upstream repo.
    remote = git(root, "config", "--local", "--get", "remote.origin.url").decode("utf-8").strip()
    require(_github_repo(remote) == expected_repo,
            "EXTERNAL_SOURCE_ORIGIN", "local remote URL disagrees with governed source")
    return got_commit, got_tree


def _tracked_entries(root, dirname, recorded_tree):
    observed_tree = git(root, "rev-parse", "HEAD:" + dirname).decode("ascii").strip()
    require(_oid(observed_tree, "package subtree") == recorded_tree,
            "EXTERNAL_TREE_DRIFT", "governed package Git tree differs at exact repository pin")
    require(git(root, "cat-file", "-t", observed_tree) == b"tree\n",
            "EXTERNAL_TREE", "package root is not a Git tree")
    raw = git(root, "ls-tree", "-r", "-z", "HEAD:" + dirname)
    entries = {}
    for item in raw.split(b"\0"):
        if not item:
            continue
        try:
            metadata, name = item.split(b"\t", 1)
            mode, kind, oid = metadata.decode("ascii").split(" ")
            rel = name.decode("utf-8", "strict")
        except (ValueError, UnicodeError):
            raise Refusal("EXTERNAL_TREE", "invalid Git tree serialization")
        safe_relative(rel)
        require(rel not in entries, "EXTERNAL_TREE", "duplicate package path in Git tree")
        require(mode in ("100644", "100755") and kind == "blob",
                "EXTERNAL_GITLINK_OR_SYMLINK",
                "unmaterialized submodule, symlink or unsupported tracked object: " + rel)
        _oid(oid, "tracked blob")
        entries[rel] = oid
        require(len(entries) <= MAX_FILES, "EXTERNAL_LIMIT", "package contains too many files")
    require(bool(entries) and "SKILL.md" in entries,
            "EXTERNAL_ENTRYPOINT", "selected package must contain a tracked SKILL.md")
    return entries, observed_tree


def _directory_inventory(root, dirname):
    """Capture all actual files, including ignored/untracked, without following links."""
    parent = Path(root)
    for part in PurePosixPath(dirname).parts:
        parent = parent / part
        try:
            mode = parent.lstat().st_mode
        except OSError:
            raise Refusal("EXTERNAL_MISSING", "missing package source directory")
        require(stat.S_ISDIR(mode), "EXTERNAL_SYMLINK", "unsafe package directory")
    collected = set()
    stack = [(parent, "")]
    while stack:
        current, prefix = stack.pop()
        try:
            entries = list(os.scandir(current))
        except OSError:
            raise Refusal("EXTERNAL_READ", "unable to inspect package directory")
        for entry in entries:
            rel = prefix + entry.name
            safe_relative(rel)
            try:
                mode = entry.stat(follow_symlinks=False).st_mode
            except OSError:
                raise Refusal("EXTERNAL_READ", "package filesystem changed during inventory")
            if stat.S_ISDIR(mode):
                stack.append((Path(entry.path), rel + "/"))
            elif stat.S_ISREG(mode):
                collected.add(rel)
                require(len(collected) <= MAX_FILES, "EXTERNAL_LIMIT",
                        "package has too many actual files")
            else:
                raise Refusal("EXTERNAL_SYMLINK",
                              "symlink or special filesystem entry in external package: " + rel)
    return collected


def inspect_external(index, record_id, checkout, *, expected_repo_tree):
    """Inspect an existing exact-pinned external clone. Never fetch or execute it."""
    require(isinstance(record_id, str) and record_id.startswith("governed:"),
            "EXTERNAL_ID", "select an exact governed source record")
    item = index.by_id.get(record_id)
    require(item is not None and item["family"] == "governed",
            "EXTERNAL_ID", "unknown or non-governed review ID")
    record = item["raw"]
    require(record.get("source_class") == "third-party",
            "EXTERNAL_SOURCE_CLASS", "this resolver requires an external third-party review")
    origin, identity = record.get("origin"), record.get("identity")
    require(isinstance(origin, dict) and isinstance(identity, dict),
            "EXTERNAL_DECLARATION", "governed review lacks external origin/identity")
    repository = _github_repo(origin.get("repository"))
    commit = _oid(origin.get("recorded_pin"), "source revision")
    entrypoint = origin.get("path")
    safe_relative(entrypoint)
    require(entrypoint.endswith("/SKILL.md") and
            len(PurePosixPath(entrypoint).parts) >= 3,
            "EXTERNAL_ENTRYPOINT", "review must identify exact nested skill entrypoint")
    dirname = entrypoint[:-len("/SKILL.md")]
    # Historical producer bug: a "git-tree-and-blob-sha1" companion may put
    # the independently recorded entrypoint blob in recorded_fingerprint but
    # omit the dedicated entrypoint_git_blob_sha1 field. Recover that narrow
    # case explicitly, then require exact Git-object agreement. Never invent a
    # blob for unknown fingerprint algorithms or silently call this complete.
    declared_entry = identity.get("entrypoint_git_blob_sha1")
    if declared_entry is None:
        require(identity.get("recorded_fingerprint_algorithm") ==
                "git-tree-and-blob-sha1",
                "EXTERNAL_IDENTITY_INCOMPLETE",
                "missing explicit entrypoint; no supported recorded-fingerprint fallback")
        entry_sha = _oid(identity.get("recorded_fingerprint"),
                         "recorded combined-fingerprint SKILL.md Git blob")
        entry_identity_source = "recorded_fingerprint_git_tree_and_blob_sha1_fallback"
    else:
        entry_sha = _oid(declared_entry, "recorded SKILL.md Git blob")
        entry_identity_source = "explicit_entrypoint_git_blob_sha1"
    subtree = _oid(identity.get("package_git_tree_sha1"),
                   "recorded complete package tree")
    root_tree = _oid(expected_repo_tree, "independently expected repository tree")
    _checkout_identity(checkout, repository, commit, root_tree)
    entries, actual_tree = _tracked_entries(checkout, dirname, subtree)
    require(entries["SKILL.md"] == entry_sha,
            "EXTERNAL_ENTRYPOINT_DRIFT", "governed SKILL.md blob disagrees with pinned Git")
    observed_actual = _directory_inventory(checkout, dirname)
    require(observed_actual == set(entries),
            "EXTERNAL_WORKTREE_DRIFT", "actual package has untracked, missing or ignored files")
    files = []
    total = 0
    for rel, oid in sorted(entries.items()):
        path = dirname + "/" + rel
        src = Path(checkout) / path
        try:
            n = src.lstat().st_size
        except OSError:
            raise Refusal("EXTERNAL_MISSING", "source file disappeared during inspection")
        require(0 <= n <= MAX_FILE_SIZE, "EXTERNAL_LIMIT",
                "source file exceeds per-file byte ceiling")
        # read_source verifies regular non-symlink leaf/parents; it does
        # not support empty files, so permit them only after lstat checks.
        if n:
            raw = read_source(checkout, path, n)
        else:
            require(stat.S_ISREG(src.lstat().st_mode),
                    "EXTERNAL_SYMLINK", "empty leaf is not a regular file")
            raw = src.read_bytes()
            require(not raw, "EXTERNAL_BYTES", "empty file changed during inspection")
        require(git_blob(raw) == oid, "EXTERNAL_BYTES",
                "actual external package bytes differ from pinned Git object: " + rel)
        total += len(raw)
        require(total <= MAX_TOTAL_BYTES, "EXTERNAL_LIMIT",
                "external package exceeds cumulative byte ceiling")
        files.append({"relative_path": rel, "sha256": sha256(raw),
                      "git_blob_sha1": oid, "bytes": len(raw)})
    skill_bytes = (Path(checkout) / dirname / "SKILL.md").read_bytes()
    try:
        leads = _markdown_leads(skill_bytes, set(entries))
    except UnicodeError:
        raise Refusal("EXTERNAL_ENTRYPOINT", "SKILL.md must be UTF-8")
    rights = record.get("rights")
    require(isinstance(rights, dict) and
            rights.get("package_redistribution_clearance") ==
            "not-established-by-export",
            "EXTERNAL_RIGHTS", "source export cannot grant redistribution authority")
    return {
        "schema": SCHEMA, "state": "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED",
        "governed_id": record["record_id"],
        "governed_review_status": record["review"]["semantic_status"],
        "source_record_snapshot": COMMIT,
        "repository_claim": repository, "repository_commit": commit,
        "repository_git_tree_sha1": root_tree,
        "package_path": dirname, "package_git_tree_sha1": actual_tree,
        "entrypoint_git_blob_sha1": entry_sha,
        "entrypoint_identity_source": entry_identity_source,
        "published_handoff_explicit_entrypoint_present": declared_entry is not None,
        "historical_export_identity_gap_requires_upstream_correction":
            declared_entry is None,
        "complete_tracked_package_files_verified": len(files),
        "package_bytes_verified": total, "files": files,
        "reference_leads": leads,
        "recorded_license_claim_not_clearance": rights.get("recorded_license"),
        "license_or_notice_files_present": [x["relative_path"] for x in files
              if x["relative_path"].lower().endswith(
                  ("license", "license.txt", "license.md", "notice", "notice.txt", "notice.md"))],
        "pinned_git_object_consistency_verified": True,
        "publisher_identity_authenticated_independently": False,
        "legal_and_asset_rights_assessed": False,
        "modification_and_redistribution_cleared": False,
        "dependency_closure_proven": False,
        "external_source_freshness_assessed": False,
        "target_host_approved": False,
        "execution_and_network_authority_approved": False,
        "static_source_review_upgraded": False,
        "behaviorally_qualified": False,
        "composition_eligible": False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", type=Path, required=True)
    p.add_argument("--source-checkout", type=Path, required=True)
    p.add_argument("--external-checkout", type=Path, required=True)
    p.add_argument("--expected-repository-tree", required=True)
    p.add_argument("record_id")
    a = p.parse_args(argv)
    try:
        index = CorpusIndex(a.handoff, a.source_checkout)
        report = inspect_external(index, a.record_id, a.external_checkout,
                                  expected_repo_tree=a.expected_repository_tree)
        print(json.dumps(report, sort_keys=True, ensure_ascii=False, indent=2))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
