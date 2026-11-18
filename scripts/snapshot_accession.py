#!/usr/bin/env python3
"""Read-only accession preflight between an accepted pin and a NEW proposed pin.

No silent 'follow main', rights grant, review promotion, host authorization or
catalog admission. Both source trees and full exported snapshots are byte checked.
A comparison receipt is NOT an owner-accepted next corpus revision.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys

from scripts.catalog_handoff import (
    COMMIT, ORIGIN, Refusal, canonical, git_blob, parse_json, read_exact,
    require, sha256,
)
from scripts.catalog_index import CorpusIndex
from scripts.verify_catalog_source import read_source, safe_relative, verify_source_tree

SCHEMA = "qortara/snapshot-accession-preflight/1"
SOURCE_SCHEMA = "skill-mason-catalog-manifest-v1"
DISCOVERY_SCHEMA = "skill-mason-discovery-manifests-v1"
RECORD_SCHEMA = "skill-mason-catalog-record-v1"
OID = re.compile(r"^[0-9a-f]{40}$")
HEX256 = re.compile(r"^[0-9a-f]{64}$")
MAX_SAMPLE = 30
MAX_GOVERNED = 250_000
MAX_OBSERVATIONS = 1_000_000
MAX_SOURCE_FILES = 20_000
MAX_SHARDS = 2000
SHA256_FIELDS = ("sha256",)


def _oid(value, label):
    require(isinstance(value, str) and bool(OID.fullmatch(value)),
            "SNAPSHOT_PIN", "expected exact lower-case SHA-1 pin: " + label)
    return value


def _paths(rows, label):
    require(isinstance(rows, list), "SNAPSHOT_SCHEMA", label + " must be a list")
    out = []
    for value in rows:
        safe_relative(value)
        out.append(value)
    require(len(out) == len(set(out)), "SNAPSHOT_DUPLICATE", label + " repeats path")
    return out


def _source_claims(manifest, expected_commit, expected_tree):
    require(isinstance(manifest, dict) and
            manifest.get("schema_version") == SOURCE_SCHEMA,
            "SNAPSHOT_SCHEMA", "unsupported handoff manifest")
    source = manifest.get("source")
    require(isinstance(source, dict) and
            source.get("repository") == ORIGIN and
            source.get("commit") == expected_commit and
            source.get("git_tree_sha1") == expected_tree,
            "SNAPSHOT_PIN", "published source claims disagree with review pins")
    readiness = manifest.get("readiness")
    require(isinstance(readiness, dict) and
            readiness.get("composition_eligibility") ==
            "requires-independent-target-specific-assessment",
            "SNAPSHOT_AUTHORITY", "manifest falsely asserts composition authorization")
    entries = manifest.get("source_files")
    links = manifest.get("submodule_pins")
    require(isinstance(entries, list) and len(entries) <= MAX_SOURCE_FILES and
            isinstance(links, list) and len(links) <= MAX_SOURCE_FILES,
            "SNAPSHOT_SCHEMA", "source inventory missing or oversized")
    require(isinstance(manifest.get("counts"), dict),
            "SNAPSHOT_SCHEMA", "population counts missing")
    counts = manifest["counts"]
    for name in ("governed_records", "first_party", "third_party", "mapped",
                 "unmapped", "g1_g3_observations", "four_source_paths",
                 "source_files", "submodule_pins", "discovery_artifacts"):
        require(type(counts.get(name)) is int and 0 <= counts[name] <= MAX_OBSERVATIONS,
                "SNAPSHOT_COUNT", "missing or oversized count: " + name)
    require(counts["governed_records"] <= MAX_GOVERNED and
            counts["first_party"] + counts["third_party"] == counts["governed_records"] and
            counts["mapped"] + counts["unmapped"] == counts["governed_records"] and
            counts["source_files"] == len(entries) and
            counts["submodule_pins"] == len(links),
            "SNAPSHOT_COUNT", "governed/source inventory denominators inconsistent")
    require(isinstance(counts.get("semantic_states"), dict) and
            all(isinstance(k, str) and type(v) is int and v >= 0
                for k, v in counts["semantic_states"].items()) and
            sum(counts["semantic_states"].values()) == counts["governed_records"],
            "SNAPSHOT_COUNT", "review state populations inconsistent")
    return counts


def _artifact_bytes(handoff, manifest):
    declarations = manifest.get("artifacts")
    require(isinstance(declarations, list) and len(declarations) == 2,
            "SNAPSHOT_SCHEMA", "expected two exact export artifacts")
    results = {}
    for entry in declarations:
        require(isinstance(entry, dict), "SNAPSHOT_SCHEMA", "malformed artifact")
        name = entry.get("path")
        require(name in ("governed.ndjson", "discovery-manifests.json") and
                name not in results, "SNAPSHOT_SCHEMA", "unexpected or duplicated export")
        size, digest = entry.get("bytes"), entry.get("sha256")
        require(type(size) is int and 0 < size <= 16_000_000 and
                isinstance(digest, str) and HEX256.fullmatch(digest),
                "SNAPSHOT_SCHEMA", "invalid artifact size/digest")
        raw = read_exact(Path(handoff) / name)
        require(len(raw) == size and sha256(raw) == digest,
                "SNAPSHOT_BYTES", "export bytes disagree with manifest: " + name)
        results[name] = raw
    require(set(results) == {"governed.ndjson", "discovery-manifests.json"},
            "SNAPSHOT_SCHEMA", "artifact family omitted")
    return results


def _governed(raw, counts):
    require(raw.endswith(b"\n") and b"\r" not in raw,
            "SNAPSHOT_RECORD", "governed NDJSON needs LF")
    rows = {}
    statuses = Counter()
    kinds = Counter()
    mapping = Counter()
    for n, line in enumerate(raw.splitlines(), 1):
        require(0 < len(line) <= 200_000,
                "SNAPSHOT_RECORD", "invalid governed line length")
        row = parse_json(line)
        require(isinstance(row, dict) and
                row.get("schema_version") == RECORD_SCHEMA and
                canonical(row) == line + b"\n",
                "SNAPSHOT_RECORD", "unsupported/noncanonical governed record")
        rid = row.get("record_id")
        require(isinstance(rid, str) and rid and rid not in rows,
                "SNAPSHOT_DUPLICATE", "missing/repeated governed ID")
        kind = row.get("source_class")
        require(kind in ("first-party", "third-party"),
                "SNAPSHOT_RECORD", "unsupported source class")
        review = row.get("review")
        mapping_claim = row.get("capability_mapping")
        rights = row.get("rights")
        composition = row.get("composition")
        require(all(isinstance(x, dict) for x in
                    (review, mapping_claim, rights, composition)),
                "SNAPSHOT_RECORD", "governance fields absent")
        status = review.get("semantic_status")
        require(isinstance(status, str) and bool(status),
                "SNAPSHOT_RECORD", "review status missing")
        state = mapping_claim.get("state")
        require(state in ("evidence-linked", "unmapped") and
                isinstance(mapping_claim.get("evidence_linked_paths"), list) and
                isinstance(mapping_claim.get("name_only_hints"), list) and
                (state != "unmapped" or not mapping_claim["evidence_linked_paths"]),
                "SNAPSHOT_RECORD", "mapping contradictory or missing")
        require(composition.get("eligibility") == "not-assessed" and
                composition.get("composable_method_contract") is None and
                composition.get("export_is_not_admission_or_permission") is True and
                rights.get("package_redistribution_clearance") ==
                "not-established-by-export",
                "SNAPSHOT_AUTHORITY", "record asserts unearned rights/eligibility")
        rows[rid] = row
        statuses[status] += 1
        kinds[kind] += 1
        mapping[state] += 1
        require(len(rows) <= MAX_GOVERNED,
                "SNAPSHOT_COUNT", "governed population exceeds bound")
    require(len(rows) == counts["governed_records"] and
            kinds["first-party"] == counts["first_party"] and
            kinds["third-party"] == counts["third_party"] and
            mapping["evidence-linked"] == counts["mapped"] and
            mapping["unmapped"] == counts["unmapped"] and
            dict(statuses) == counts["semantic_states"],
            "SNAPSHOT_COUNT", "declared governed population differs from actual")
    return rows


def _observations(discovery, manifest, source_checkout, counts):
    require(isinstance(discovery, dict) and
            discovery.get("schema_version") == DISCOVERY_SCHEMA,
            "SNAPSHOT_SCHEMA", "discovery manifests unsupported")
    index = {}
    for row in manifest["source_files"]:
        require(isinstance(row, dict) and isinstance(row.get("path"), str),
                "SNAPSHOT_SCHEMA", "invalid source-file entry")
        path = row["path"]
        safe_relative(path)
        require(path not in index, "SNAPSHOT_DUPLICATE", "duplicate source file")
        index[path] = row
    def read_declared(path):
        safe_relative(path)
        require(path in index, "SNAPSHOT_REFERENCE", "undeclared source file: " + path)
        entry = index[path]
        raw = read_source(Path(source_checkout), path, entry["bytes"])
        require(sha256(raw) == entry["sha256"],
                "SNAPSHOT_BYTES", "source shard diverged from manifest")
        return parse_json(raw)

    discover = _paths(discovery.get("all_discovery_artifacts"), "discovery artifacts")
    evidence = _paths(discovery.get("all_evidence_artifacts"), "evidence artifacts")
    require(len(discover) == counts["discovery_artifacts"],
            "SNAPSHOT_COUNT", "discovery references incomplete")
    require(all(path in index for path in discover + evidence),
            "SNAPSHOT_REFERENCE", "untracked discovery/evidence pointer")
    taxonomy = manifest.get("taxonomy")
    require(isinstance(taxonomy, dict) and
            set(taxonomy) == {"recognized", "prior_proposals",
                             "new_proposals", "outcomes"},
            "SNAPSHOT_SCHEMA", "canonical taxonomy sources incomplete")
    require(all(isinstance(p, str) and p in index
                for p in taxonomy.values()),
            "SNAPSHOT_REFERENCE", "undeclared taxonomy source")
    entrypoints = discovery.get("repository_entrypoints")
    require(isinstance(entrypoints, dict),
            "SNAPSHOT_SCHEMA", "first party source directory missing")
    first = _paths(entrypoints.get("first_party"), "first-party entrypoints")
    engine = _paths(entrypoints.get("engine_maintenance_only"),
                    "maintenance-only entrypoints")
    require(len(first) == counts["first_party"] and
            all(p in index for p in first + engine),
            "SNAPSHOT_COUNT", "first party package entrypoint population differs")

    observations = {}
    def part_list(parts, family, source_id=None):
        require(isinstance(parts, list) and 0 < len(parts) <= MAX_SHARDS,
                "SNAPSHOT_SHARD", "shards missing or oversized")
        seen = set()
        tally = 0
        for part in parts:
            require(isinstance(part, dict), "SNAPSHOT_SHARD", "malformed shard metadata")
            path, pointer, n = (part.get("path"), part.get("records_pointer"),
                                part.get("record_count"))
            require(isinstance(path, str) and path not in seen and
                    pointer in ("/records", "/entries") and
                    type(n) is int and 0 <= n <= MAX_OBSERVATIONS,
                    "SNAPSHOT_SHARD", "malformed/duplicated shard")
            seen.add(path)
            data = read_declared(path)
            rows = data.get(pointer[1:]) if isinstance(data, dict) else None
            require(isinstance(rows, list) and len(rows) == n,
                    "SNAPSHOT_COUNT", "inconsistent shard row count")
            if source_id is not None:
                require(data.get("source_id") == source_id,
                        "SNAPSHOT_SHARD", "source family changed")
            for i, row in enumerate(rows):
                require(isinstance(row, (dict, list)),
                        "SNAPSHOT_SHARD", "source observation malformed")
                key = family + ":" + path + "#" + pointer + "/" + str(i)
                require(key not in observations,
                        "SNAPSHOT_DUPLICATE", "duplicate source observation")
                observations[key] = sha256(canonical(row))
            tally += n
            require(len(observations) <= MAX_OBSERVATIONS,
                    "SNAPSHOT_COUNT", "observation rows exceeded maximum")
        return tally
    g1 = part_list(discovery.get("g1_g3_shards"), "g1-g3")
    require(g1 == counts["g1_g3_observations"],
            "SNAPSHOT_COUNT", "G1-G3 denominator differs")
    frontiers = discovery.get("four_source_frontier")
    require(isinstance(frontiers, list) and len(frontiers) <= MAX_SHARDS,
            "SNAPSHOT_SHARD", "four-source frontier missing/oversized")
    seen_sources = set()
    four = 0
    for frontier in frontiers:
        require(isinstance(frontier, dict), "SNAPSHOT_SHARD", "frontier malformed")
        sid = frontier.get("source_id")
        require(isinstance(sid, str) and sid and sid not in seen_sources,
                "SNAPSHOT_SHARD", "frontier source duplicate")
        seen_sources.add(sid)
        path = frontier.get("manifest")
        require(isinstance(path, str), "SNAPSHOT_SHARD", "frontier manifest missing")
        read_declared(path)
        n = part_list(frontier.get("parts"), "four-source", source_id=sid)
        require(n == frontier.get("record_count"),
                "SNAPSHOT_COUNT", "four-source frontier count mismatch")
        four += n
    require(four == counts["four_source_paths"],
            "SNAPSHOT_COUNT", "four-source observation denominator differs")
    return {"observations": observations, "discovery": discover,
            "evidence": evidence, "taxonomy": taxonomy, "first_party": first,
            "engine": engine}


def inspect_candidate(handoff, source_checkout, *, expected_manifest_blob,
                      expected_source_commit, expected_source_tree,
                      source_verifier=verify_source_tree):
    """Verify entire proposed export and its source checkout; no new trust grant."""
    expected_manifest_blob = _oid(expected_manifest_blob, "candidate manifest")
    expected_source_commit = _oid(expected_source_commit, "candidate source commit")
    expected_source_tree = _oid(expected_source_tree, "candidate source tree")
    handoff = Path(handoff)
    require(handoff.is_dir() and not handoff.is_symlink(),
            "SNAPSHOT_DIRECTORY", "candidate handoff must be real directory")
    manifest_bytes = read_exact(handoff / "manifest.json", 4_000_000)
    require(git_blob(manifest_bytes) == expected_manifest_blob,
            "SNAPSHOT_PIN", "manifest does not match explicitly supplied candidate pin")
    manifest = parse_json(manifest_bytes)
    counts = _source_claims(manifest, expected_source_commit, expected_source_tree)
    source_receipt = source_verifier(
        source_checkout, manifest,
        expected_commit=expected_source_commit, expected_tree=expected_source_tree)
    require(source_receipt.get("source_commit") == expected_source_commit and
            source_receipt.get("source_tree") == expected_source_tree and
            source_receipt.get("file_sha256_verified") == counts["source_files"] and
            source_receipt.get("gitlinks_verified") == counts["submodule_pins"] and
            source_receipt.get("independent_publisher_authentication") is False and
            source_receipt.get("source_rights_assessed") is False and
            source_receipt.get("composition_eligible") is False,
            "SNAPSHOT_SOURCE", "complete source byte verifier did not establish contract")
    exports = _artifact_bytes(handoff, manifest)
    rows = _governed(exports["governed.ndjson"], counts)
    surfaces = _observations(
        parse_json(exports["discovery-manifests.json"]),
        manifest, source_checkout, counts)
    return {"manifest": manifest, "manifest_blob": expected_manifest_blob,
            "source_receipt": source_receipt, "records": rows, **surfaces,
            "candidate_pin_is_caller_supplied_not_authenticated_publisher": True,
            "composition_eligible": False}


def _delta(before, after, *, sample=MAX_SAMPLE):
    old, new = set(before), set(after)
    overlap = old & new
    added = sorted(new - old)
    removed = sorted(old - new)
    changed = sorted(x for x in overlap if before[x] != after[x])
    require(len(added) + len(removed) + len(overlap) == len(old | new),
            "SNAPSHOT_DELTA", "population reconciliation inconsistent")
    def receipts(values):
        return {"count": len(values), "sample": values[:sample],
                "sample_truncated": len(values) > sample,
                "identities_sha256": sha256(canonical(values))}
    return {"before": len(before), "after": len(after),
            "unchanged": len(overlap) - len(changed),
            "added": receipts(added), "removed": receipts(removed),
            "changed": receipts(changed)}


def compare_snapshots(old, candidate):
    """Compare all review IDs, source and raw discovery paths. Never auto-accept."""
    old_records = {i["raw"]["record_id"]: i["raw"]
                   for i in old.records if i["family"] == "governed"}
    new_records = candidate["records"]
    old_observations = {
        i["family"] + ":" + i["source_file"] + "#" + i["pointer"]:
        sha256(canonical(i["raw"])) for i in old.records
        if i["family"] in ("g1-g3", "four-source")}
    old_files = {item["path"]: item["sha256"]
                 for item in old.manifest["source_files"]}
    new_files = {item["path"]: item["sha256"]
                 for item in candidate["manifest"]["source_files"]}
    reviewed_old = {k: sha256(canonical(v)) for k, v in old_records.items()}
    reviewed_new = {k: sha256(canonical(v)) for k, v in new_records.items()}
    review_delta = _delta(reviewed_old, reviewed_new)
    observation_delta = _delta(old_observations, candidate["observations"])
    file_delta = _delta(old_files, new_files)
    ref_deltas = {
        "discovery": _delta(
            {p: p for p in old.discovery_paths},
            {p: p for p in candidate["discovery"]}),
        "evidence": _delta(
            {p: p for p in old.evidence_paths},
            {p: p for p in candidate["evidence"]}),
        "first_party_entrypoints": _delta(
            {p: p for p in old.first_party_paths},
            {p: p for p in candidate["first_party"]}),
        "engine_entrypoints": _delta(
            {p: p for p in old.engine_paths},
            {p: p for p in candidate["engine"]})}
    old_tax, new_tax = old.taxonomy_paths, candidate["taxonomy"]
    taxonomy_changes = sorted(
        k for k in old_tax if old_tax[k] != new_tax[k] or
        old_files.get(old_tax[k]) != new_files.get(new_tax[k]))
    transitions = Counter()
    changed_fields = Counter()
    changed_review_ids = []
    for rid in sorted(set(old_records) & set(new_records)):
        old_record, next_record = old_records[rid], new_records[rid]
        a = old_record["review"]["semantic_status"]
        b = next_record["review"]["semantic_status"]
        if a != b:
            transitions[(a, b)] += 1
        if old_record != next_record:
            changed_review_ids.append(rid)
            for field in sorted(set(old_record) | set(next_record)):
                if old_record.get(field) != next_record.get(field):
                    changed_fields[field] += 1
    require(len(changed_review_ids) == review_delta["changed"]["count"],
            "SNAPSHOT_DELTA", "governed change counters disagree")
    changes = (sum(review_delta[k]["count"] for k in ("added", "removed", "changed")) +
               sum(observation_delta[k]["count"] for k in ("added", "removed", "changed")) +
               sum(file_delta[k]["count"] for k in ("added", "removed", "changed")) +
               len(taxonomy_changes))
    version_changed = (
        old.manifest["source"]["commit"] != candidate["manifest"]["source"]["commit"] or
        old.manifest["source"]["git_tree_sha1"] != candidate["manifest"]["source"]["git_tree_sha1"] or
        candidate["manifest_blob"] != old.inspection.get("manifest_git_blob_sha1"))
    return {
        "schema": SCHEMA, "state": "PINNED_SNAPSHOT_DIFF_ONLY",
        "previous": {"source_commit": old.manifest["source"]["commit"],
                     "source_tree": old.manifest["source"]["git_tree_sha1"]},
        "proposed": {"source_commit": candidate["manifest"]["source"]["commit"],
                     "source_tree": candidate["manifest"]["source"]["git_tree_sha1"],
                     "manifest_blob": candidate["manifest_blob"]},
        "governed": review_delta, "observed_source_rows": observation_delta,
        "tracked_source_files": file_delta,
        "reference_pointers": ref_deltas,
        "review_status_transitions": [
            {"from": frm, "to": to, "count": n}
            for (frm, to), n in sorted(transitions.items())],
        "governed_changed_field_counts": dict(sorted(changed_fields.items())),
        "taxonomy_artifacts_changed": taxonomy_changes,
        "exact_revisions_differ": version_changed,
        "data_delta_nonempty": changes > 0,
        "changes_or_pointer_removals_require_explicit_owner_review": True,
        "all_reviewed_ids_and_observation_slots_reconciled": True,
        "candidate_git_objects_match_caller_supplied_pins": True,
        "candidate_publisher_independently_authenticated": False,
        "independent_source_pin_acceptance": False,
        "candidate_rights_or_host_authority_established": False,
        "review_state_upgrades_automatically_approved": False,
        "candidate_snapshot_auto_imported": False,
        "snapshot_accession_authorized": False,
        "composition_eligible": False,
        "next_required_gate":
            "Independent accepted publisher/pin, governed delta review, native Qortara, owner GO; "
            "then separately record accepted snapshot constant updates and regressions."}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--old-handoff", type=Path, required=True)
    p.add_argument("--old-source-checkout", type=Path, required=True)
    p.add_argument("--candidate-handoff", type=Path, required=True)
    p.add_argument("--candidate-source-checkout", type=Path, required=True)
    p.add_argument("--candidate-manifest-blob", required=True)
    p.add_argument("--candidate-source-commit", required=True)
    p.add_argument("--candidate-source-tree", required=True)
    p.add_argument("--report", type=Path)
    a = p.parse_args(argv)
    try:
        old = CorpusIndex(a.old_handoff, a.old_source_checkout)
        candidate = inspect_candidate(
            a.candidate_handoff, a.candidate_source_checkout,
            expected_manifest_blob=a.candidate_manifest_blob,
            expected_source_commit=a.candidate_source_commit,
            expected_source_tree=a.candidate_source_tree)
        output = compare_snapshots(old, candidate)
        contents = json.dumps(output, sort_keys=True, ensure_ascii=False, indent=2) + "\n"
        if a.report is not None:
            with a.report.open("x", encoding="utf-8") as f:
                f.write(contents)
        print(contents, end="")
        return 0
    except (Refusal, FileExistsError) as exc:
        code = exc.code if isinstance(exc, Refusal) else "REPORT_EXISTS"
        print(json.dumps({"state": "REFUSED", "code": code,
                          "message": str(exc), "snapshot_accession_authorized": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
