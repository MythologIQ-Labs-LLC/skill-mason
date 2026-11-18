#!/usr/bin/env python3
"""Exact observed-source identity and bounded, offline *untrusted* corpus intake.

This module NEVER admits, composes, executes, redistributes or installs skills.
Publisher authentication, complete package bytes and use rights are separate gates.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import stat
import sys

from scripts.catalog_handoff import Refusal, canonical, parse_json, read_exact, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.verify_catalog_source import safe_relative

SCHEMA = "qortara/corpus-evolution/1"
PROPOSAL = "qortara/source-frontier-proposal/1"
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
MAX_SAMPLE = 100
MAX_PART_SIZE = 16_000_000


def _hex40(value):
    return isinstance(value, str) and SHA1_RE.fullmatch(value) is not None


def _safe_path(value):
    try:
        safe_relative(value)
        return True
    except Refusal:
        return False


def _origin(repository, revision, path, entry_blob, package_tree):
    # Never fix up malformed source claims; preserve provenance and mark a hold.
    checks = {
        "repository_known": isinstance(repository, str) and bool(repository.strip()),
        "source_pin_complete": _hex40(revision),
        "entrypoint_safe": _safe_path(path),
        "entrypoint_blob_sha1_known": _hex40(entry_blob),
        "package_tree_sha1_known": _hex40(package_tree),
    }
    slot = (repository, revision, path) if all(
        checks[k] for k in ("repository_known", "source_pin_complete", "entrypoint_safe")
    ) else None
    # A placement key is not cryptographic proof of a complete package tree.
    placement = (*slot, entry_blob, package_tree) if slot and all(checks.values()) else None
    return {"repository": repository, "pinned_revision": revision,
            "entrypoint_path": path, "entrypoint_git_blob_sha1": entry_blob,
            "observed_package_git_tree_sha1": package_tree,
            "checks": checks, "source_slot": slot, "fully_specified_observation": placement}


def _key(value):
    return hashlib.sha256(canonical(list(value))).hexdigest()


class PlacementLedger:
    """Retains every source occurrence while indexing exact claims separately."""

    def __init__(self, index):
        self.index = index
        self.observed = 0
        self.families = Counter()
        self.unknowns = Counter()
        self.sources = defaultdict(set)
        self.slots = defaultdict(set)
        self.placements = defaultdict(list)
        self.observation_by_slot = defaultdict(list)
        self.tree_leads = defaultdict(list)
        self._frontier_metadata = {}
        self._read(index)

    def _read(self, index):
        for item in index.records:
            if item["family"] not in ("g1-g3", "four-source"):
                continue
            if item["family"] == "g1-g3":
                record = item["raw"]
                require(isinstance(record, dict), "OBSERVATION_SCHEMA",
                        "G1-G3 record is not an object")
                v = _origin(record.get("repository"), record.get("pinned_revision"),
                            record.get("path"), record.get("skill_blob"),
                            record.get("package_tree"))
            else:
                path = item["source_file"]
                if path not in self._frontier_metadata:
                    # This is a separately source-byte-verified file in the trusted checkout.
                    data = parse_json(index._raw_source(path))
                    require(isinstance(data, dict), "OBSERVATION_SCHEMA",
                            "four-source shard is not an object")
                    source = data.get("source_id")
                    require(source == item["source_id"], "SHARD_SOURCE",
                            "frontier source identity changed")
                    self._frontier_metadata[path] = {
                        "repository": data.get("upstream_repository"),
                        "revision": data.get("source_pin") or data.get("pinned_commit")}
                meta = self._frontier_metadata[path]
                record = item["raw"]
                require(isinstance(record, list) and len(record) == 5,
                        "OBSERVATION_SCHEMA", "unsupported five-field frontier row")
                v = _origin(meta["repository"], meta["revision"],
                            record[0], record[1], record[2])
            self.observed += 1
            self.families[item["family"]] += 1
            src = v["repository"]
            if v["checks"]["repository_known"]:
                self.sources[src].add(v["pinned_revision"])
            for field, valid in v["checks"].items():
                if not valid:
                    self.unknowns[field] += 1
            ref = {"identity": item["id"], "family": item["family"],
                   "source_file": item["source_file"], "pointer": item["pointer"],
                   "source_id": item["source_id"]}
            if v["source_slot"]:
                slot = v["source_slot"]
                self.observation_by_slot[slot].append(ref)
                if v["checks"]["package_tree_sha1_known"]:
                    self.slots[slot].add(v["observed_package_git_tree_sha1"])
            if v["fully_specified_observation"]:
                self.placements[v["fully_specified_observation"]].append(ref)
            if v["checks"]["package_tree_sha1_known"]:
                # Only same-hash *leads*; hash claims are not verified full-package content.
                self.tree_leads[v["observed_package_git_tree_sha1"]].append(
                    {"ref": ref, "source_slot": v["source_slot"]})
        expected = index.family_counts["g1-g3"] + index.family_counts["four-source"]
        require(self.observed == expected, "COUNT_MISMATCH",
                "source occurrence accounting dropped observations")

    def summary(self):
        collisions = sum(len(trees) > 1 for trees in self.slots.values())
        repeated = sum(len(refs) - 1 for refs in self.placements.values())
        lead_groups = sum(len(refs) > 1 for refs in self.tree_leads.values())
        return {"schema": SCHEMA, "source_commit": self.index.manifest["source"]["commit"],
                "source_git_tree": self.index.manifest["source"]["git_tree_sha1"],
                "observed_path_rows": self.observed,
                "source_family_rows": dict(sorted(self.families.items())),
                "observed_repository_names": len(self.sources),
                "exact_source_slots_with_known_source_pin": len(self.observation_by_slot),
                "fully_specified_placement_claims": len(self.placements),
                "repeated_fully_specified_observations": repeated,
                "source_slot_conflicts": collisions,
                "same_tree_hash_lead_groups": lead_groups,
                "unknown_fields_by_observation": dict(sorted(self.unknowns.items())),
                "source_observations_preserved": True,
                "mirror_reuse_rights_inferred": False,
                "content_equivalence_verified_from_bytes": False,
                "source_publisher_authenticated": False,
                "complete_package_materialization": False,
                "composition_eligible": False}

    def tree(self, sha, limit=20):
        require(_hex40(sha), "TREE_QUERY", "must supply full lowercase Git tree SHA-1")
        require(type(limit) is int and 0 < limit <= MAX_SAMPLE, "QUERY_LIMIT",
                "limit out of bounds")
        refs = self.tree_leads.get(sha, [])
        return {"schema": SCHEMA, "tree_git_sha1": sha,
                "total_source_observations": len(refs),
                "sample": refs[:limit], "truncated": len(refs) > limit,
                "byte_equivalence_proven": False,
                "reuse_rights_transferred": False, "composition_eligible": False}

    def classify(self, origin):
        slot = origin["source_slot"]
        placement = origin["fully_specified_observation"]
        if slot is None or placement is None:
            return "unresolved-evidence"
        existing = self.observation_by_slot.get(slot, [])
        if not existing:
            return "new-source-placement-lead"
        if placement in self.placements:
            return "duplicate-exact-placement-claim"
        return "changed-or-contradictory-at-same-pin"


def _read_part(root, relative, size):
    require(_safe_path(relative), "PROPOSAL_PATH", "unsafe intake path")
    require(type(size) is int and 0 < size <= MAX_PART_SIZE,
            "PROPOSAL_SIZE", "shard exceeds bounded source size")
    current = Path(root)
    require(current.is_dir() and not current.is_symlink(),
            "PROPOSAL_PATH", "intake root must be real directory")
    for segment in Path(relative).parts[:-1]:
        current = current / segment
        try:
            mode = current.lstat().st_mode
        except OSError:
            raise Refusal("PROPOSAL_MISSING", "missing intake shard directory")
        require(stat.S_ISDIR(mode), "PROPOSAL_PATH", "symlinked/non-directory parent")
    leaf = current / Path(relative).name
    raw = read_exact(leaf, MAX_PART_SIZE)
    require(len(raw) == size, "PROPOSAL_SIZE", "intake shard byte count differs")
    return raw


def preview_intake(ledger, proposal_root):
    """Inspect sharded NDJSON leads. SELF-declared hashes are NOT source authentication."""
    root = Path(proposal_root)
    require(root.is_dir() and not root.is_symlink(),
            "PROPOSAL_PATH", "proposal root must be a non-symlink directory")
    raw = read_exact(root / "proposal.json", 4_000_000)
    manifest = parse_json(raw)
    require(isinstance(manifest, dict) and manifest.get("schema_version") == PROPOSAL,
            "PROPOSAL_SCHEMA", "unsupported proposal format")
    source_id, repository, pin = (manifest.get("source_id"),
                                  manifest.get("repository"),
                                  manifest.get("pinned_revision"))
    require(isinstance(source_id, str) and source_id.strip() and
            isinstance(repository, str) and repository.strip() and _hex40(pin),
            "PROPOSAL_SOURCE", "source ID/repository/full revision required")
    require(manifest.get("rights_state") == "unassessed" and
            manifest.get("review_state") == "unassessed" and
            manifest.get("admission") == "proposal-only",
            "PROPOSAL_AUTHORITY", "proposal may not claim assessment/admission")
    parts = manifest.get("parts")
    require(isinstance(parts, list) and bool(parts),
            "PROPOSAL_PARTS", "at least one pinned shard declaration required")
    seen_paths, observed_slots = set(), set()
    states = Counter()
    unique = set()
    declared_total = 0
    examples = []
    for part in parts:
        require(isinstance(part, dict), "PROPOSAL_PARTS", "malformed shard descriptor")
        relative, digest, size, count = (part.get("path"), part.get("sha256"),
                                         part.get("bytes"), part.get("record_count"))
        require(isinstance(relative, str) and relative not in seen_paths and
                isinstance(digest, str) and SHA256_RE.fullmatch(digest) and
                type(count) is int and count >= 0,
                "PROPOSAL_PARTS", "duplicate or malformed intake shard")
        seen_paths.add(relative)
        blob = _read_part(root, relative, size)
        require(sha256(blob) == digest, "PROPOSAL_DIGEST", "intake shard bytes differ")
        require(blob.endswith(b"\n") and b"\r" not in blob,
                "PROPOSAL_RECORD", "NDJSON shards require LF records")
        actual = 0
        for raw_row in blob.splitlines():
            require(0 < len(raw_row) <= 200_000,
                    "PROPOSAL_RECORD", "oversized or empty NDJSON record")
            record = parse_json(raw_row)
            require(isinstance(record, dict) and canonical(record) == raw_row + b"\n",
                    "PROPOSAL_RECORD", "noncanonical or malformed NDJSON record")
            # No instructions in the record are ever read as commands.
            origin = _origin(repository, pin, record.get("path"),
                             record.get("entrypoint_git_blob_sha1"),
                             record.get("package_git_tree_sha1"))
            state = ledger.classify(origin)
            if origin["source_slot"] in observed_slots:
                state = "repeated-in-proposal"
            else:
                observed_slots.add(origin["source_slot"])
            states[state] += 1
            if len(examples) < 10:
                examples.append({"source_path": relative, "row": actual + 1,
                                 "entrypoint_path": record.get("path"),
                                 "disposition": state})
            actual += 1
        require(actual == count, "PROPOSAL_COUNT",
                "truncated or inflated intake shard record count")
        declared_total += actual
    require(type(manifest.get("record_count")) is int and
            manifest["record_count"] == declared_total, "PROPOSAL_COUNT",
            "intake manifest total differs from shards")
    return {"schema": SCHEMA, "state": "UNTRUSTED_FRONTIER_PREVIEW_NOT_INGESTED",
            "source_id": source_id, "repository": repository,
            "pinned_revision_claim": pin, "proposal_sha256": sha256(raw),
            "observations_declared": declared_total,
            "shards_verified_against_self_declared_hashes": len(parts),
            "classifications": dict(sorted(states.items())),
            "examples": examples,
            "independently_authenticated_source": False,
            "rights_assessed": False, "publisher_verified": False,
            "complete_package_verified": False, "catalog_snapshot_updated": False,
            "needs_governed_skillz_handoff": True,
            "composition_eligible": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True, type=Path)
    parser.add_argument("--source-checkout", required=True, type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("summary")
    tree = sub.add_parser("tree")
    tree.add_argument("sha")
    tree.add_argument("--limit", type=int, default=20)
    proposal = sub.add_parser("preview")
    proposal.add_argument("--root", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        index = CorpusIndex(args.handoff, args.source_checkout)
        ledger = PlacementLedger(index)
        if args.command == "summary":
            result = ledger.summary()
        elif args.command == "tree":
            result = ledger.tree(args.sha, limit=args.limit)
        else:
            result = preview_intake(ledger, args.root)
        print(json.dumps(result, sort_keys=True, indent=2, ensure_ascii=False))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
