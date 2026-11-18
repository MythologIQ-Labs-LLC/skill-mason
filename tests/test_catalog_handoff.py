"""Synthetic fixtures validate handoff refusals. They are NOT live skillz acceptance."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts.catalog_handoff import COMMIT, ORIGIN, TREE, Refusal, canonical, git_blob, inspect, sha256


def record(key, kind, mapping, review):
    return {"schema_version": "skill-mason-catalog-record-v1", "record_id": key,
            "source_class": kind, "review": {"semantic_status": review},
            "capability_mapping": {"state": mapping,
                "evidence_linked_paths": ["business/risk"] if mapping == "evidence-linked" else [],
                "name_only_hints": ["risk"]},
            "rights": {"package_redistribution_clearance": "not-established-by-export"},
            "composition": {"eligibility": "not-assessed",
                "composable_method_contract": None, "export_is_not_admission_or_permission": True}}


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.records = [record("local-skills/a", "first-party", "evidence-linked", "verified"),
                        record("third-party/b", "third-party", "unmapped", "rejected")]
        self.make()

    def tearDown(self):
        self.tmp.cleanup()

    def make(self):
        governed = b"".join(canonical(r) for r in self.records)
        discovery = canonical({"observations": []})
        (self.root / "governed.ndjson").write_bytes(governed)
        (self.root / "discovery-manifests.json").write_bytes(discovery)
        self.manifest = {"schema_version": "skill-mason-catalog-manifest-v1",
            "source": {"repository": ORIGIN, "commit": COMMIT, "git_tree_sha1": TREE},
            "readiness": {"composition_eligibility": "requires-independent-target-specific-assessment"},
            "source_files": [], "submodule_pins": [],
            "artifacts": [
                {"path": key, "bytes": len(val), "sha256": sha256(val)}
                for key, val in sorted((("governed.ndjson", governed),
                                        ("discovery-manifests.json", discovery)))],
            "counts": {
                "governed_records": len(self.records),
                "first_party": sum(r["source_class"] == "first-party" for r in self.records),
                "third_party": sum(r["source_class"] == "third-party" for r in self.records),
                "mapped": sum(r["capability_mapping"]["state"] == "evidence-linked" for r in self.records),
                "unmapped": sum(r["capability_mapping"]["state"] == "unmapped" for r in self.records),
                "semantic_states": {s: sum(r["review"]["semantic_status"] == s for r in self.records)
                                    for s in {r["review"]["semantic_status"] for r in self.records}},
                "source_files": 0, "submodule_pins": 0}}
        raw = canonical(self.manifest)
        self.pin = git_blob(raw)
        (self.root / "manifest.json").write_bytes(raw)

    def inspect(self):
        return inspect(self.root, manifest_pin=self.pin)

    def refuses(self, code):
        with self.assertRaises(Refusal) as exc:
            self.inspect()
        self.assertEqual(exc.exception.code, code)

    def test_complete_review_population_and_rights_hold(self):
        a = self.inspect()
        self.assertEqual(a["preserved_record_ids"], 2)
        self.assertEqual(a["counts"]["semantic_states"], {"verified": 1, "rejected": 1})
        self.assertEqual(a["artifact_integrity"], "PASS")
        self.assertFalse(a["composition_eligible"])
        self.assertFalse(a["individual_source_files_verified"])

    def test_tampering_refused(self):
        f = self.root / "governed.ndjson"
        f.write_bytes(f.read_bytes().replace(b"rejected", b"verified"))
        self.refuses("ARTIFACT_INTEGRITY")

    def test_symlinks_and_missing_files_refused(self):
        p = self.root / "governed.ndjson"
        p.unlink()
        self.refuses("MISSING_FILE")
        p.symlink_to(self.root / "manifest.json")
        self.refuses("INVALID_FILE")

    def test_manifest_pin_refused(self):
        self.manifest["source"]["commit"] = "0" * 40
        (self.root / "manifest.json").write_bytes(canonical(self.manifest))
        self.refuses("MANIFEST_PIN")

    def test_source_pin_refused_after_rehash(self):
        self.manifest["source"]["git_tree_sha1"] = "0" * 40
        raw = canonical(self.manifest)
        self.pin = git_blob(raw)
        (self.root / "manifest.json").write_bytes(raw)
        self.refuses("SOURCE_PIN")

    def test_duplicate_record_identity_refused(self):
        self.records[1]["record_id"] = self.records[0]["record_id"]
        self.make()
        self.refuses("DUPLICATE_ID")

    def test_refuses_name_hint_promoted_to_coverage(self):
        self.records[1]["capability_mapping"]["evidence_linked_paths"] = ["business/risk"]
        self.make()
        self.refuses("MAPPING_CONTRADICTION")

    def test_rights_and_eligibility_cannot_upgrade(self):
        self.records[0]["rights"]["package_redistribution_clearance"] = "granted"
        self.make()
        self.refuses("RIGHTS_CLAIM")
        self.records[0]["rights"]["package_redistribution_clearance"] = "not-established-by-export"
        self.records[0]["composition"]["eligibility"] = "verified"
        self.make()
        self.refuses("ELIGIBILITY_CLAIM")

    def test_count_mismatch_refused(self):
        self.manifest["counts"]["governed_records"] = 999
        raw = canonical(self.manifest)
        self.pin = git_blob(raw)
        (self.root / "manifest.json").write_bytes(raw)
        self.refuses("COUNT_MISMATCH")

    def test_noncanonical_row_refused_even_if_digest_rewritten(self):
        p = self.root / "governed.ndjson"
        blob = p.read_bytes().replace(b":", b": ", 1)
        p.write_bytes(blob)
        for a in self.manifest["artifacts"]:
            if a["path"] == "governed.ndjson":
                a["bytes"], a["sha256"] = len(blob), sha256(blob)
        raw = canonical(self.manifest)
        self.pin = git_blob(raw)
        (self.root / "manifest.json").write_bytes(raw)
        self.refuses("RECORD_SERIALIZATION")


if __name__ == "__main__":
    unittest.main()
