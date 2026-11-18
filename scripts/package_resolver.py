#!/usr/bin/env python3
"""Read-only selected-package inspection from the pinned, verified skillz source.

This is C3 byte inventory proof for first-party packages, NOT method admission.
Third-party content is not bundled and is refused until separately authenticated.
"""
import argparse
from collections import Counter
import json
import posixpath
from pathlib import PurePosixPath
import re
import sys
from urllib.parse import unquote, urlsplit

from scripts.catalog_handoff import COMMIT, Refusal, canonical, git_blob, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.verify_catalog_source import git, safe_relative

SCHEMA = "qortara/package-inspection/1"
SHA1 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
LINK = re.compile(r"!?\[[^\]\n]{0,300}\]\(([^)\n]{1,500})\)")
MAX_PACKAGE_FILES = 2000
MAX_REFERENCE_LEADS = 2000


def _tree_oid(checkout, dirname):
    """Git-derived tree identity on already verified source commit, no code execution."""
    raw = git(checkout, "rev-parse", "HEAD:" + dirname)
    value = raw.decode("ascii").strip()
    require(bool(SHA1.fullmatch(value)), "PACKAGE_TREE", "invalid Git tree identifier")
    raw_type = git(checkout, "cat-file", "-t", value).decode("ascii").strip()
    require(raw_type == "tree", "PACKAGE_TREE", "package root is not a Git tree")
    return value


def _verify_declaration(files, digest):
    require(isinstance(files, list) and 0 < len(files) <= MAX_PACKAGE_FILES,
            "PACKAGE_FILES", "package file list missing or oversized")
    require(isinstance(digest, str) and bool(SHA256.fullmatch(digest)),
            "PACKAGE_DIGEST", "invalid package declaration SHA-256")
    paths = []
    for entry in files:
        require(isinstance(entry, dict) and set(entry) == {"path", "sha256"},
                "PACKAGE_FILES", "malformed package file declaration")
        relative = entry["path"]
        safe_relative(relative)
        require(isinstance(entry["sha256"], str) and SHA256.fullmatch(entry["sha256"]),
                "PACKAGE_FILES", "invalid declared file SHA-256")
        paths.append(relative)
    require(paths == sorted(set(paths)), "PACKAGE_FILES",
            "files must be strictly sorted and unique")
    require("SKILL.md" in paths, "PACKAGE_ENTRYPOINT", "package entrypoint missing")
    require(sha256(canonical(files)) == digest, "PACKAGE_DIGEST",
            "canonical package-file-list digest differs")
    return paths


def _markdown_leads(raw, file_names):
    """A conservative lead scanner, not a dependency closure or content interpreter."""
    text = raw.decode("utf-8", errors="strict")
    lead_count = 0
    missing, outside, remote = [], [], []
    for token in LINK.findall(text):
        lead_count += 1
        require(lead_count <= MAX_REFERENCE_LEADS, "PACKAGE_REFERENCES",
                "too many Markdown inline link leads")
        target = token.strip().split(" ", 1)[0].strip("<>")
        if not target or target.startswith("#"):
            continue
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or target.startswith("//"):
            remote.append(target[:160])
            continue
        candidate = unquote(parsed.path)
        if not candidate or candidate == ".":
            continue
        # This scan is never used to authorize file access; it only compares
        # candidate references to an independently hashed package inventory.
        normalized = posixpath.normpath(candidate)
        if (normalized.startswith("../") or normalized == ".." or
                normalized.startswith("/") or "\\" in normalized or "\x00" in normalized):
            outside.append(candidate[:160])
        elif normalized not in file_names:
            missing.append(normalized[:160])
    return {"scanner": "inline-Markdown-links-only-not-dependency-closure",
            "inline_markdown_lead_count": lead_count,
            "unresolved_within_package": sorted(set(missing))[:50],
            "outside_package_leads": sorted(set(outside))[:50],
            "unassessed_remote_or_scheme_leads": sorted(set(remote))[:50],
            "all_instructional_references_closed": False,
            "dependency_closure_proven": False}


def inspect_package(index, identity, *, tree_oid=_tree_oid):
    """Return a byte receipt for one exact first-party governed ID, without release."""
    require(isinstance(identity, str) and identity.startswith("governed:"),
            "PACKAGE_ID", "select an exact governed record ID")
    item = index.by_id.get(identity)
    require(item is not None and item["family"] == "governed",
            "PACKAGE_ID", "unknown governed identity")
    record = item["raw"]
    require(record.get("source_class") == "first-party",
            "THIRD_PARTY_PACKAGE_UNAVAILABLE",
            "third-party metadata does not contain authenticated complete package bytes")
    identity_claim = record.get("identity")
    origin = record.get("origin")
    freshness = record.get("freshness")
    require(isinstance(identity_claim, dict) and isinstance(origin, dict)
            and isinstance(freshness, dict), "PACKAGE_DECLARATION",
            "first-party record lacks package identity/provenance")
    require(origin.get("first_party_snapshot_pin") == COMMIT,
            "PACKAGE_SOURCE_PIN", "source commit not bound to first-party record")
    require(freshness.get("local_entrypoint_review_match") == "match",
            "PACKAGE_REVIEW_DRIFT", "source entrypoint no longer matches pinned review")
    local = identity_claim.get("local_package")
    require(isinstance(local, dict) and local.get("algorithm") ==
            "sha256-of-canonical-file-list-v1",
            "PACKAGE_DECLARATION", "full first-party file inventory not declared")
    files = local.get("files")
    paths = _verify_declaration(files, local.get("sha256"))
    expected = {f["path"]: f["sha256"] for f in files}
    entry_blob = identity_claim.get("entrypoint_git_blob_sha1")
    require(isinstance(entry_blob, str) and SHA1.fullmatch(entry_blob),
            "PACKAGE_ENTRYPOINT", "pinned Git entry blob missing")
    matches = []
    # Find the original source root by reconciling the complete file inventory,
    # never by trusting a user-supplied directory or merely matching skill names.
    for entry in index.first_party_paths:
        require(entry.endswith("/SKILL.md"), "PACKAGE_ROOT",
                "unexpected first-party entrypoint declaration")
        root = entry[:-len("SKILL.md")]
        subtree = {path[len(root):]: item for path, item in index.source_files.items()
                   if path.startswith(root)}
        if set(subtree) != set(expected):
            continue
        if any(subtree[rel]["sha256"] != digest for rel, digest in expected.items()):
            continue
        if subtree["SKILL.md"]["git_blob_sha1"] != entry_blob:
            continue
        matches.append((root, subtree))
    require(len(matches) == 1, "PACKAGE_ROOT",
            "unable to resolve exactly one source root for full package declaration")
    root, subtree = matches[0]
    source_files = []
    total_bytes = 0
    for rel in paths:
        source_path = root + rel
        metadata = subtree[rel]
        blob = index._raw_source(source_path)
        require(sha256(blob) == expected[rel], "PACKAGE_SHA256",
                "declared original package file changed: " + rel)
        require(git_blob(blob) == metadata["git_blob_sha1"], "PACKAGE_GIT_BLOB",
                "declared Git blob differs from source bytes: " + rel)
        total_bytes += len(blob)
        source_files.append({"path": rel, "bytes": len(blob), "sha256": expected[rel],
                             "git_blob_sha1": metadata["git_blob_sha1"]})
    observed_tree = tree_oid(index.source_checkout, root.rstrip("/"))
    claimed_tree = identity_claim.get("package_git_tree_sha1")
    tree_disposition = ("not-declared-in-review" if claimed_tree is None else
                        "matches-recorded-tree" if claimed_tree == observed_tree else
                        "recorded-tree-differs-from-pinned-source")
    # A stale recorded tree is an explicit refusal even if file bytes match.
    require(claimed_tree is None or
            (isinstance(claimed_tree, str) and SHA1.fullmatch(claimed_tree)
             and claimed_tree == observed_tree),
            "PACKAGE_TREE_DRIFT", "review's recorded package tree differs from source tree")
    entrypoint = index._raw_source(root + "SKILL.md")
    try:
        links = _markdown_leads(entrypoint, set(expected))
    except UnicodeError:
        raise Refusal("PACKAGE_ENTRYPOINT", "SKILL.md is not UTF-8")
    rights = record.get("rights")
    operation = record.get("operation")
    require(isinstance(rights, dict) and
            rights.get("package_redistribution_clearance") == "not-established-by-export" and
            isinstance(operation, dict), "PACKAGE_RIGHTS",
            "package source metadata made an unexpected approval claim")
    return {"schema": SCHEMA, "state": "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
            "record_id": record["record_id"], "source_class": "first-party",
            "original_snapshot_commit": COMMIT,
            "source_root": root, "package_file_count": len(paths),
            "package_bytes_verified": total_bytes,
            "package_digest_algorithm": local["algorithm"],
            "package_file_list_sha256": local["sha256"],
            "package_git_tree_sha1": observed_tree,
            "recorded_tree_disposition": tree_disposition,
            "files": source_files, "reference_leads": links,
            "recorded_license_is_not_rights_clearance": rights.get("recorded_license"),
            "recorded_authority_is_not_host_approval": operation.get("recorded_authority"),
            "independently_verified_publisher": False,
            "rights_assessed": False, "modification_rights_cleared": False,
            "redistribution_rights_cleared": False,
            "source_freshness_assessed": False,
            "target_host_fit_assessed": False,
            "permission_and_network_authority_approved": False,
            "method_contract_qualified": False,
            "composition_eligible": False}


def scan_first_party(index, *, tree_oid=_tree_oid):
    """Exhaustively attempt all 48 first-party governed records, preserve refusals."""
    results = []
    for item in index.records:
        if item["family"] != "governed" or item["source_class"] != "first-party":
            continue
        key = item["id"]
        try:
            receipt = inspect_package(index, key, tree_oid=tree_oid)
            results.append({"record_id": key, "status": receipt["state"],
                            "file_count": receipt["package_file_count"],
                            "bytes_verified": receipt["package_bytes_verified"],
                            "reference_gaps": len(receipt["reference_leads"]["unresolved_within_package"]) +
                                              len(receipt["reference_leads"]["outside_package_leads"])})
        except Refusal as exc:
            results.append({"record_id": key, "status": "REFUSED", "code": exc.code})
    require(len(results) == index.manifest["counts"]["first_party"],
            "PACKAGE_COUNT", "first-party inventory incomplete")
    summary = dict(sorted(Counter(row["status"] for row in results).items()))
    return {"schema": SCHEMA, "scope": "first-party-review-subset-only",
            "first_party_reviewed": len(results), "results_by_status": summary,
            "results": results, "all_48_checked_without_silent_omission": True,
            "third_party_complete_packages_assessed": False,
            "rights_assessed": False, "host_qualified": False,
            "composition_eligible": False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    commands = p.add_subparsers(dest="command", required=True)
    one = commands.add_parser("inspect")
    one.add_argument("record_id")
    commands.add_parser("first-party-scan")
    opts = p.parse_args(argv)
    try:
        index = CorpusIndex(opts.handoff, opts.source_checkout)
        report = (inspect_package(index, opts.record_id) if opts.command == "inspect"
                  else scan_first_party(index))
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
