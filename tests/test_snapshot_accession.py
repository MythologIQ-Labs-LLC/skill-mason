"""Adversarial full-source accession preview; never grants migration authority."""
import copy
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import COMMIT, TREE, Refusal, canonical, git_blob, sha256
from scripts.snapshot_accession import (
    inspect_candidate, compare_snapshots, _delta,
)
from test_catalog_index import Fixture


class SnapshotAccessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.tmp.name))
        self.old = self.fx.index()

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def source_check(_source, manifest, *, expected_commit, expected_tree):
        if expected_commit != COMMIT or expected_tree != TREE:
            raise Refusal("SOURCE_PIN", "test source is only verified at original pin")
        return {
            "source_commit": expected_commit, "source_tree": expected_tree,
            "file_sha256_verified": manifest["counts"]["source_files"],
            "gitlinks_verified": manifest["counts"]["submodule_pins"],
            "independent_publisher_authentication": False,
            "source_rights_assessed": False, "composition_eligible": False,
        }

    def candidate(self, **kwargs):
        return inspect_candidate(
            self.fx.handoff, self.fx.source,
            expected_manifest_blob=kwargs.get("manifest_blob", self.fx.pin),
            expected_source_commit=kwargs.get("source_commit", COMMIT),
            expected_source_tree=kwargs.get("source_tree", TREE),
            source_verifier=kwargs.get("source_verifier", self.source_check))

    def refuse(self, code):
        with self.assertRaises(Refusal) as err:
            self.candidate()
        self.assertEqual(err.exception.code, code)

    def persist(self):
        self.fx.persist()

    def test_identical_complete_snapshots_have_exact_zero_deltas(self):
        report = compare_snapshots(self.old, self.candidate())
        self.assertEqual(report["state"], "PINNED_SNAPSHOT_DIFF_ONLY")
        self.assertFalse(report["exact_revisions_differ"])
        self.assertFalse(report["data_delta_nonempty"])
        self.assertEqual(report["governed"]["before"], 2)
        self.assertEqual(report["governed"]["after"], 2)
        self.assertEqual(report["observed_source_rows"]["before"], 18)
        self.assertEqual(report["observed_source_rows"]["after"], 18)
        self.assertEqual(report["tracked_source_files"]["before"], len(self.fx.paths))
        for family in ("governed", "observed_source_rows", "tracked_source_files"):
            for part in ("added", "removed", "changed"):
                self.assertEqual(report[family][part]["count"], 0)
        self.assertFalse(report["candidate_snapshot_auto_imported"])
        self.assertFalse(report["snapshot_accession_authorized"])
        self.assertFalse(report["composition_eligible"])
        self.assertFalse(report["candidate_publisher_independently_authenticated"])

    def test_full_governed_status_transition_and_field_diff_visible(self):
        cand = self.candidate()
        cand["records"] = copy.deepcopy(cand["records"])
        cand["records"]["external/beta"]["review"]["semantic_status"] = "verified"
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["governed"]["changed"]["count"], 1)
        self.assertEqual(report["governed_changed_field_counts"]["review"], 1)
        self.assertEqual(report["review_status_transitions"], [
            {"from": "rejected", "to": "verified", "count": 1}])
        self.assertFalse(report["review_state_upgrades_automatically_approved"])
        self.assertTrue(report["data_delta_nonempty"])

    def test_removed_review_is_not_hidden_by_empty_count(self):
        cand = self.candidate()
        cand["records"] = copy.deepcopy(cand["records"])
        del cand["records"]["external/beta"]
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["governed"]["removed"]["count"], 1)
        self.assertEqual(report["governed"]["removed"]["sample"], ["external/beta"])
        self.assertTrue(report["changes_or_pointer_removals_require_explicit_owner_review"])

    def test_added_review_not_counted_as_observed_source_only(self):
        cand = self.candidate()
        cand["records"] = copy.deepcopy(cand["records"])
        new = copy.deepcopy(cand["records"]["external/beta"])
        new["record_id"] = "external/new"
        cand["records"]["external/new"] = new
        result = compare_snapshots(self.old, cand)
        self.assertEqual(result["governed"]["added"]["count"], 1)
        self.assertEqual(result["observed_source_rows"]["added"]["count"], 0)
        self.assertFalse(result["snapshot_accession_authorized"])

    def test_source_path_changed_is_a_review_identity_change(self):
        cand = self.candidate()
        cand["records"] = copy.deepcopy(cand["records"])
        cand["records"]["external/beta"]["origin"] = {
            "repository": "https://github.com/example/source",
            "recorded_pin": "c" * 40, "path": "skills/x/SKILL.md"}
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["governed"]["changed"]["count"], 1)
        self.assertEqual(report["governed_changed_field_counts"]["origin"], 1)

    def test_discovery_observation_fingerprint_change_visible(self):
        cand = self.candidate()
        cand["observations"] = dict(cand["observations"])
        key = sorted(cand["observations"])[0]
        cand["observations"][key] = sha256(b"replacement")
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["observed_source_rows"]["changed"]["count"], 1)
        self.assertEqual(report["observed_source_rows"]["changed"]["sample"], [key])

    def test_deleted_discovery_observation_visible(self):
        cand = self.candidate()
        cand["observations"] = dict(cand["observations"])
        key = sorted(cand["observations"])[0]
        del cand["observations"][key]
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["observed_source_rows"]["removed"]["count"], 1)

    def test_source_file_diff_and_evidence_reference_loss_separate(self):
        cand = self.candidate()
        cand["manifest"] = copy.deepcopy(cand["manifest"])
        cand["manifest"]["source_files"][0]["sha256"] = sha256(b"change")
        cand["evidence"] = cand["evidence"][1:]
        report = compare_snapshots(self.old, cand)
        self.assertEqual(report["tracked_source_files"]["changed"]["count"], 1)
        self.assertEqual(report["reference_pointers"]["evidence"]["removed"]["count"], 1)
        self.assertTrue(report["data_delta_nonempty"])

    def test_manifest_pin_tamper_veto(self):
        with self.assertRaises(Refusal) as ex:
            self.candidate(manifest_blob="f" * 40)
        self.assertEqual(ex.exception.code, "SNAPSHOT_PIN")

    def test_source_commit_pin_tamper_veto(self):
        with self.assertRaises(Refusal) as ex:
            self.candidate(source_commit="f" * 40)
        self.assertEqual(ex.exception.code, "SNAPSHOT_PIN")

    def test_export_artifact_tamper_detected(self):
        (self.fx.handoff / "governed.ndjson").write_bytes(b"{}\n")
        self.refuse("SNAPSHOT_BYTES")

    def test_unevaluated_rights_grant_veto(self):
        self.fx.records[0]["rights"]["package_redistribution_clearance"] = "approved"
        self.persist()
        self.refuse("SNAPSHOT_AUTHORITY")

    def test_unsupported_composition_claim_veto(self):
        self.fx.records[0]["composition"]["eligibility"] = "yes"
        self.persist()
        self.refuse("SNAPSHOT_AUTHORITY")

    def test_stale_declared_semantic_population_veto(self):
        self.fx.records[0]["review"]["semantic_status"] = "rejected"
        self.persist()
        self.refuse("SNAPSHOT_COUNT")

    def test_duplicate_governed_identity_veto(self):
        self.fx.records[1]["record_id"] = self.fx.records[0]["record_id"]
        self.persist()
        self.refuse("SNAPSHOT_DUPLICATE")

    def test_source_shard_row_count_mismatch_veto(self):
        path = self.fx.g1_paths[0]
        self.fx.paths[path] = canonical({"records": []})
        self.persist()
        self.refuse("SNAPSHOT_COUNT")

    def test_source_pointer_not_in_verified_inventory_veto(self):
        self.fx.discovery["all_evidence_artifacts"].append(
            "registry/evidence/nonexistent.json")
        self.persist()
        self.refuse("SNAPSHOT_REFERENCE")

    def test_duplicate_source_reference_veto(self):
        self.fx.discovery["all_discovery_artifacts"].append(
            self.fx.discovery["all_discovery_artifacts"][0])
        self.persist()
        self.refuse("SNAPSHOT_DUPLICATE")

    def test_forged_source_verifier_authority_refused(self):
        def bad(_source, manifest, *, expected_commit, expected_tree):
            v = self.source_check(
                _source, manifest, expected_commit=expected_commit,
                expected_tree=expected_tree)
            v["source_rights_assessed"] = True
            return v
        with self.assertRaises(Refusal) as ex:
            self.candidate(source_verifier=bad)
        self.assertEqual(ex.exception.code, "SNAPSHOT_SOURCE")

    def test_delta_samples_are_capped_without_hiding_full_counts(self):
        before = {"src-%03d" % i: "old" for i in range(70)}
        after = {"src-%03d" % i: "changed" for i in range(70)}
        r = _delta(before, after, sample=4)
        self.assertEqual(r["changed"]["count"], 70)
        self.assertEqual(len(r["changed"]["sample"]), 4)
        self.assertTrue(r["changed"]["sample_truncated"])
        self.assertRegex(r["changed"]["identities_sha256"], r"^[0-9a-f]{64}$")

    def test_only_real_original_source_bytes_can_pass_shard_hashes(self):
        path = self.fx.g1_paths[0]
        (self.fx.source / path).write_bytes(b'{"records":[]}\n')
        # The source reader catches changed file size before a SHA-256 can
        # be compared. Preserve the earliest refusal instead of normalizing it.
        self.refuse("SOURCE_BYTES")

    def test_unknown_new_manifest_source_class_veto(self):
        self.fx.records[1]["source_class"] = "automatically-approved"
        self.persist()
        self.refuse("SNAPSHOT_RECORD")

    def test_forged_tracked_source_digest_is_refused(self):
        # A candidate manifest pin is self declared but even matching manifest
        # checksums cannot override a full source-byte verifier refusal.
        def refuse_source(*_a, **_k):
            raise Refusal("SOURCE_SHA256", "tracked source checksum mismatch")
        with self.assertRaises(Refusal) as ex:
            self.candidate(source_verifier=refuse_source)
        self.assertEqual(ex.exception.code, "SOURCE_SHA256")


if __name__ == "__main__":
    unittest.main()
