"""Read-only integration: a real external Git receipt may inform but never select a method."""
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import Refusal
from scripts.candidate_comparison import compare


class ExternalComparisonTests(unittest.TestCase):
    def setUp(self):
        self.raw = {
            "record_id": "external/sample",
            "review": {"semantic_status": "verified"},
            "capability_mapping": {"evidence_linked_paths": ["software-engineering/frontend"]},
        }
        self.corpus = SimpleNamespace(
            records=[{"family": "governed", "source_class": "third-party",
                      "review_status": "verified", "raw": self.raw}],
            family_counts={"g1-g3": 61326, "four-source": 4813})
        self.graph = SimpleNamespace(
            corpus=self.corpus,
            paths={"software-engineering/frontend": {
                "matched": ["external/sample"], "hints": [],
                "subdomain": {"id": "frontend"}}},
            outcome_by_path={"software-engineering/frontend": {
                "essential_outcomes": [],
                "qualified_essential_outcome_count": None,
                "outcome_definition_status": "needs-workflow-decomposition"}})
        self.selection = {
            "record_id": "governed:external/sample",
            "checkout": "/does/not/matter/in-test",
            "repo_tree": "f" * 40}

    def fake(self, corpus, record_id, checkout, *, expected_repo_tree):
        self.assertIs(corpus, self.corpus)
        self.assertEqual(record_id, "governed:external/sample")
        self.assertEqual(checkout, self.selection["checkout"])
        self.assertEqual(expected_repo_tree, "f" * 40)
        return {
            "state": "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED",
            "complete_tracked_package_files_verified": 2,
            "package_git_tree_sha1": "b" * 40,
            "entrypoint_git_blob_sha1": "a" * 40,
            "historical_export_identity_gap_requires_upstream_correction": True}

    def compare(self, **kwargs):
        return compare(self.graph, "software-engineering/frontend", "ChatGPT",
                       include_lexical=False, external_inspector=self.fake, **kwargs)

    def test_external_evidence_is_shown_but_method_is_not_admitted(self):
        r = self.compare(external_selection=self.selection)
        p = r["evidence_linked_reviews"][0]["package_bytes"]
        self.assertEqual(p["status"], "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED")
        self.assertEqual(p["package_files"], 2)
        self.assertTrue(p["historical_export_identity_gap_requires_upstream_correction"])
        self.assertTrue(p["rights_and_host_still_unapproved"])
        self.assertEqual(r["externally_inspected_governed_id"], "governed:external/sample")
        self.assertTrue(r["external_inspection_does_not_grant_rights_or_relevance"])
        self.assertFalse(r["evidence_linked_reviews"][0]["eligible"])
        self.assertFalse(r["composition_eligible"])
        self.assertEqual(r["eligible_candidate_count"], 0)
        self.assertIsNone(r["chosen_method"])
        self.assertFalse(r["prism_invoked"])

    def test_external_receipt_requires_explicit_selection(self):
        r = self.compare()
        self.assertEqual(r["evidence_linked_reviews"][0]["package_bytes"]["status"],
                         "NOT_INSPECTED")
        self.assertIsNone(r["externally_inspected_governed_id"])
        self.assertFalse(r["composition_eligible"])

    def test_external_id_must_be_exactly_linked_to_requested_route(self):
        with self.assertRaises(Refusal) as exc:
            self.compare(external_selection={**self.selection,
                                             "record_id": "governed:external/other"})
        self.assertEqual(exc.exception.code, "EXTERNAL_SELECTION")

    def test_external_observation_id_cannot_impersonate_review(self):
        with self.assertRaises(Refusal) as exc:
            self.compare(external_selection={**self.selection,
                                             "record_id": "observation:external/sample"})
        self.assertEqual(exc.exception.code, "EXTERNAL_SELECTION")

    def test_incomplete_selection_is_refused(self):
        with self.assertRaises(Refusal) as exc:
            self.compare(external_selection={"record_id": self.selection["record_id"]})
        self.assertEqual(exc.exception.code, "EXTERNAL_SELECTION")

    def test_failed_external_git_verification_refuses_comparison(self):
        def reject(*_args, **_kwargs):
            raise Refusal("EXTERNAL_BYTES", "source tampered")
        with self.assertRaises(Refusal) as exc:
            compare(self.graph, "software-engineering/frontend", "ChatGPT",
                    include_lexical=False, external_selection=self.selection,
                    external_inspector=reject)
        self.assertEqual(exc.exception.code, "EXTERNAL_BYTES")

    def test_rejected_review_stays_rejected_after_external_hashes(self):
        self.raw["review"]["semantic_status"] = "rejected"
        r = self.compare(external_selection=self.selection)
        self.assertEqual(r["evidence_linked_reviews"][0]["disposition"],
                         "BLOCKED_STATIC_REVIEW")
        self.assertEqual(r["eligible_candidate_count"], 0)

    def test_no_fake_qualification_from_target_host_label(self):
        r = self.compare(external_selection=self.selection)
        self.assertEqual(r["target_host_requested_not_approved"], "ChatGPT")
        self.assertFalse(r["full_package_rights_and_host_qualification_established"])


if __name__ == "__main__":
    unittest.main()
