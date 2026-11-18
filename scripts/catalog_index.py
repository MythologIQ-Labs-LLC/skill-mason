#!/usr/bin/env python3
"""Fail-closed, read-only search of one exact skillz corpus snapshot.

This is an *opportunity index*, not a method selector or a reuse/rights grant.
Third-party skill contents are never run, activated or copied by this module.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys

from scripts.catalog_handoff import (
    COMMIT, TREE, MANIFEST_BLOB, Refusal, inspect, parse_json, read_exact,
    require, sha256,
)
from scripts.verify_catalog_source import read_source, safe_relative, verify_source_tree


SCHEMA = "qortara/corpus-opportunity-index/1"
DISCOVERY_SCHEMA = "skill-mason-discovery-manifests-v1"
MAX_RESULTS = 200


def _unique_paths(value, label):
    require(isinstance(value, list), "REFERENCE_SCHEMA", label + " is not a list")
    paths = []
    for item in value:
        require(isinstance(item, str), "REFERENCE_SCHEMA", label + " contains a non-path")
        safe_relative(item)
        paths.append(item)
    require(len(set(paths)) == len(paths), "REFERENCE_DUPLICATE", label + " repeats a path")
    return paths


class CorpusIndex:
    """Snapshot-wide in-memory index. Constructor never alters either checkout."""

    def __init__(self, handoff, source_checkout, *, inspector=inspect, source_verifier=verify_source_tree):
        self.handoff = Path(handoff)
        self.source_checkout = Path(source_checkout)
        self.inspection = inspector(self.handoff)
        self.manifest = parse_json(read_exact(self.handoff / "manifest.json", 4_000_000))
        self.source_verification = source_verifier(self.source_checkout, self.manifest)
        require(self.inspection["artifact_integrity"] == "PASS", "CATALOG_INTEGRITY", "handoff not verified")
        require(self.source_verification["source_commit"] == COMMIT and
                self.source_verification["source_tree"] == TREE and
                self.source_verification["file_sha256_verified"] ==
                self.manifest["counts"]["source_files"] and
                self.source_verification["gitlinks_verified"] ==
                self.manifest["counts"]["submodule_pins"],
                "SOURCE_INTEGRITY", "complete pinned source-tree verification not established")
        require(self.source_verification["source_rights_assessed"] is False and
                self.source_verification["composition_eligible"] is False,
                "SOURCE_INTEGRITY", "source verifier made an unexpected rights/eligibility claim")

        file_entries = self.manifest["source_files"]
        self.source_files = {item["path"]: item for item in file_entries}
        require(len(self.source_files) == len(file_entries), "REFERENCE_DUPLICATE", "source file paths repeat")
        self.discovery = parse_json(read_exact(self.handoff / "discovery-manifests.json"))
        require(isinstance(self.discovery, dict) and
                self.discovery.get("schema_version") == DISCOVERY_SCHEMA,
                "DISCOVERY_SCHEMA", "unsupported discovery manifest")
        self.discovery_paths = _unique_paths(self.discovery.get("all_discovery_artifacts"), "discovery artifacts")
        self.evidence_paths = _unique_paths(self.discovery.get("all_evidence_artifacts"), "evidence artifacts")
        counts = self.manifest["counts"]
        require(len(self.discovery_paths) == counts["discovery_artifacts"],
                "COUNT_MISMATCH", "discovery-artifact denominator disagrees")
        # The source manifest lists original raw evidence files; it does not grant their reuse.
        require(len(self.evidence_paths) == 2322, "COUNT_MISMATCH", "pinned evidence-artifact denominator disagrees")
        self._require_declared(self.discovery_paths + self.evidence_paths)

        self.taxonomy_paths = self.manifest.get("taxonomy")
        require(isinstance(self.taxonomy_paths, dict) and
                set(self.taxonomy_paths) == {"recognized", "prior_proposals", "new_proposals", "outcomes"},
                "TAXONOMY_SCHEMA", "recognized and proposed taxonomies must remain separate")
        self._require_declared(list(self.taxonomy_paths.values()))

        entrypoints = self.discovery.get("repository_entrypoints")
        require(isinstance(entrypoints, dict), "FIRST_PARTY_SCHEMA", "first-party entrypoints missing")
        self.first_party_paths = _unique_paths(entrypoints.get("first_party"), "first-party entrypoints")
        self.engine_paths = _unique_paths(entrypoints.get("engine_maintenance_only"), "engine entrypoints")
        require(len(self.first_party_paths) == counts["first_party"], "COUNT_MISMATCH",
                "first-party package inventory disagrees")
        self._require_declared(self.first_party_paths + self.engine_paths)

        self.records = []
        self.by_id = {}
        self.family_counts = Counter()
        self._load_governed()
        self._load_observations()
        require(len(self.records) == counts["governed_records"] +
                counts["g1_g3_observations"] + counts["four_source_paths"],
                "COUNT_MISMATCH", "indexed opportunity population incomplete")

    def _require_declared(self, paths):
        for path in paths:
            safe_relative(path)
            require(path in self.source_files, "MISSING_REFERENCE",
                    "source file not present in exact pinned manifest: " + path)

    def _raw_source(self, path):
        self._require_declared([path])
        item = self.source_files[path]
        blob = read_source(self.source_checkout, path, item["bytes"])
        require(sha256(blob) == item["sha256"], "SOURCE_SHA256",
                "source changed since its pinned verification: " + path)
        return blob

    def artifact(self, path):
        """Read referenced source bytes, never instructions or execution permissions."""
        allowed = (set(self.discovery_paths) | set(self.evidence_paths) |
                   set(self.taxonomy_paths.values()) |
                   set(self.first_party_paths) | set(self.engine_paths))
        require(path in allowed, "UNKNOWN_ARTIFACT", "not a declared corpus artifact")
        payload = self._raw_source(path)
        return {"schema": SCHEMA, "path": path, "bytes": len(payload),
                "sha256": sha256(payload), "reference_only": True,
                "source_commit": COMMIT, "rights_assessed": False}

    def _add(self, key, family, source_path, pointer, raw, *, source_class=None,
             review_status=None, mapping_state=None, source_id=None):
        require(key not in self.by_id, "DUPLICATE_ID", "duplicate opportunity identity: " + key)
        item = {"id": key, "family": family, "source_file": source_path,
                "pointer": pointer, "source_class": source_class,
                "review_status": review_status, "mapping_state": mapping_state,
                "source_id": source_id, "raw": raw,
                "composition_eligibility": "not-assessed",
                "rights_clearance": "not-established"}
        self.records.append(item)
        self.by_id[key] = item
        self.family_counts[family] += 1

    def _load_governed(self):
        raw = read_exact(self.handoff / "governed.ndjson")
        for i, line in enumerate(raw.splitlines()):
            record = parse_json(line)
            key = "governed:" + record["record_id"]
            self._add(key, "governed", "governed.ndjson", "/lines/" + str(i + 1),
                      record, source_class=record["source_class"],
                      review_status=record["review"]["semantic_status"],
                      mapping_state=record["capability_mapping"]["state"])
        require(self.family_counts["governed"] == self.manifest["counts"]["governed_records"],
                "COUNT_MISMATCH", "governed records dropped")

    def _load_parts(self, declarations, family, *, group_id=None):
        require(isinstance(declarations, list) and bool(declarations),
                "SHARD_SCHEMA", "missing shard list: " + family)
        seen_parts = set()
        count = 0
        for shard in declarations:
            require(isinstance(shard, dict) and
                    isinstance(shard.get("path"), str), "SHARD_SCHEMA", "malformed shard")
            path = shard["path"]
            require(path not in seen_parts, "REFERENCE_DUPLICATE", "repeated shard: " + path)
            seen_parts.add(path)
            pointer = shard.get("records_pointer")
            require(pointer in ("/records", "/entries"), "SHARD_SCHEMA", "unsupported shard pointer: " + path)
            obj = parse_json(self._raw_source(path))
            require(isinstance(obj, dict) and isinstance(obj.get(pointer[1:]), list),
                    "SHARD_SCHEMA", "source shard has no declared array: " + path)
            rows = obj[pointer[1:]]
            require(type(shard.get("record_count")) is int and
                    len(rows) == shard["record_count"], "COUNT_MISMATCH",
                    "source shard was truncated or changed: " + path)
            if group_id is not None:
                require(obj.get("source_id") == group_id, "SHARD_SOURCE",
                        "source-family identity differs: " + path)
            for i, row in enumerate(rows):
                require(isinstance(row, (dict, list)), "SHARD_SCHEMA",
                        "invalid observation at " + path)
                self._add("observation:" + path + "#" + pointer + "/" + str(i),
                          family, path, pointer + "/" + str(i), row,
                          mapping_state="unassessed", source_id=group_id)
            count += len(rows)
        return count

    def _load_observations(self):
        g1 = self.discovery.get("g1_g3_shards")
        require(isinstance(g1, list) and len(g1) == 14,
                "SHARD_SCHEMA", "expected all 14 declared G1-G3 shards")
        observed = self._load_parts(g1, "g1-g3")
        require(observed == self.manifest["counts"]["g1_g3_observations"],
                "COUNT_MISMATCH", "G1-G3 observation denominator differs")

        frontiers = self.discovery.get("four_source_frontier")
        require(isinstance(frontiers, list) and len(frontiers) == 4,
                "SHARD_SCHEMA", "expected all four source frontiers")
        seen_sources = set()
        total = 0
        for item in frontiers:
            require(isinstance(item, dict) and isinstance(item.get("source_id"), str),
                    "SHARD_SCHEMA", "invalid four-source frontier")
            source_id = item["source_id"]
            require(source_id not in seen_sources, "REFERENCE_DUPLICATE", "repeated source ID")
            seen_sources.add(source_id)
            manifest_path = item.get("manifest")
            require(isinstance(manifest_path, str), "SHARD_SCHEMA", "frontier manifest missing")
            self._require_declared([manifest_path])
            # Includes manifest metadata itself even if there is no bulk package materialization.
            self._raw_source(manifest_path)
            parts = item.get("parts")
            n = self._load_parts(parts, "four-source", group_id=source_id)
            require(type(item.get("record_count")) is int and n == item["record_count"],
                    "COUNT_MISMATCH", "four-source frontier is incomplete: " + source_id)
            total += n
        require(total == self.manifest["counts"]["four_source_paths"],
                "COUNT_MISMATCH", "four-source observation denominator differs")

    def summary(self):
        return {"schema": SCHEMA, "state": "INDEXED_READ_ONLY",
                "source": self.manifest["source"], "source_manifest_blob": MANIFEST_BLOB,
                "source_integrity": "PINNED_TREE_AND_SOURCE_BYTES_VERIFIED",
                "governed": self.manifest["counts"]["governed_records"],
                "governed_review_states": self.manifest["counts"]["semantic_states"],
                "governed_mapped": self.manifest["counts"]["mapped"],
                "governed_unmapped": self.manifest["counts"]["unmapped"],
                "first_party_entrypoints": len(self.first_party_paths),
                "engine_maintenance_entrypoints_separate": len(self.engine_paths),
                "g1_g3_path_observations": self.family_counts["g1-g3"],
                "four_source_path_observations": self.family_counts["four-source"],
                "observation_populations_overlap": True,
                "discovery_artifact_pointers": len(self.discovery_paths),
                "evidence_artifact_pointers": len(self.evidence_paths),
                "taxonomy_source_paths": self.taxonomy_paths,
                "total_index_rows_not_unique_skills": len(self.records),
                "unassessed_discovery_is_not_rejection": True,
                "source_publisher_authenticated": False,
                "rights_assessed": False, "full_third_party_packages_resolved": False,
                "prism_qualified": False, "behaviorally_validated": False,
                "composition_eligible": False}

    def record(self, identity):
        require(identity in self.by_id, "UNKNOWN_ID", "no such exact record identity")
        return {"schema": SCHEMA, "snapshot_commit": COMMIT,
                **self.by_id[identity]}

    def search(self, query, *, family="all", limit=25):
        require(isinstance(query, str) and bool(query.strip()), "QUERY_REQUIRED",
                "supply a nonempty lexical query")
        require(family in ("all", "governed", "g1-g3", "four-source"),
                "QUERY_FAMILY", "unsupported family")
        require(type(limit) is int and 0 < limit <= MAX_RESULTS,
                "QUERY_LIMIT", "limit must be between 1 and " + str(MAX_RESULTS))
        tokens = query.casefold().split()
        results = []
        total = 0
        for item in self.records:
            if family != "all" and item["family"] != family:
                continue
            # Lexical retrieval only. This never means the candidate covers an outcome.
            indexed_text = json.dumps(item["raw"], sort_keys=True, ensure_ascii=False).casefold()
            if all(token in indexed_text for token in tokens):
                total += 1
                if len(results) < limit:
                    results.append({k: v for k, v in item.items() if k != "raw"})
        return {"schema": SCHEMA, "query": query, "search_type": "unassessed_lexical_leads",
                "source_commit": COMMIT, "family": family,
                "total_matches": total, "returned": len(results),
                "truncated": total > len(results), "results": results,
                "rights_assessed": False, "method_eligibility_assessed": False,
                "outcome_coverage_assessed": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True, type=Path)
    parser.add_argument("--source-checkout", required=True, type=Path)
    cmd = parser.add_subparsers(dest="command", required=True)
    cmd.add_parser("summary")
    find = cmd.add_parser("search")
    find.add_argument("query")
    find.add_argument("--family", choices=["all", "governed", "g1-g3", "four-source"], default="all")
    find.add_argument("--limit", type=int, default=25)
    item = cmd.add_parser("record")
    item.add_argument("identity")
    artifact = cmd.add_parser("artifact")
    artifact.add_argument("path")
    args = parser.parse_args(argv)
    try:
        index = CorpusIndex(args.handoff, args.source_checkout)
        if args.command == "summary":
            report = index.summary()
        elif args.command == "search":
            report = index.search(args.query, family=args.family, limit=args.limit)
        elif args.command == "record":
            report = index.record(args.identity)
        else:
            report = index.artifact(args.path)
        print(json.dumps(report, sort_keys=True, ensure_ascii=False, indent=2))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
