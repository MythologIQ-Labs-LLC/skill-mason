"""Ordinary create can expose original source tasks without granting method rights."""
from copy import deepcopy
import unittest

from scripts.catalog_handoff import Refusal
from scripts.request_to_skill import evaluate_request, _SOURCE_TASK_REVIEWS
from test_request_to_skill import RequestAdmissionTests, METHOD, ROUTE, comparator, preflight

COMMIT = "31a8c518dd97b7828adcc728202fa41388a306d7"
TREE = "e6d5dfeb42bcd7777ddff52605922fead62135ff"


def reference(rid=METHOD, route=ROUTE):
    citations = [
        {"role": role, "source_url": "https://example.test/citation",
         "source_file_sha256": "2" * 64,
         "exact_excerpt_sha256": "3" * 64,
         "original_lines_for_review": "Verified original source evidence"}
        for role in ("TRIGGER_AND_LIMIT", "METHOD_STEPS", "EVIDENCE_AND_REPORT",
                     "SAFETY_BOUNDARY")
    ]
    return {
        "schema": "qortara/source-task-fit-reference-review/1",
        "state": "BOUNDED_ORIGINAL_SOURCE_TASK_REFERENCE_NOT_ADMITTED",
        "governed_review_id": "governed:" + rid,
        "source_snapshot_commit": COMMIT,
        "source_snapshot_tree": TREE,
        "route": None,
        "source_only_review_no_route_claim": True,
        "original_evidence_linked_routes_not_task_qualified": [route],
        "original_complete_package_file_list_sha256": "2" * 64,
        "original_static_review_status": "verified",
        "source_entrypoint": "skills/fixture/SKILL.md",
        "entrypoint_git_blob_sha1": "a" * 40,
        "review_input_sha256": "f" * 64,
        "source_evidence": citations,
        "reviewer_proposed_task_spec_not_an_admitted_method": {
            "objective": "Bounded read-only case review, not a trusted composition",
            "acceptance_scenarios": [{"id": str(x)} for x in range(5)]},
        "broader_claims_not_supported": ["No automatic execution"],
        "acceptance_scenarios_planned_not_executed": 5,
        "actual_consumer_host_task_runs": 0,
        "source_quotes_prove_bytes_not_reviewers_semantic_conclusion": True,
        "rights_qualified": False, "host_validated": False,
        "outcome_coverage_qualified": False,
        "operator_source_acceptance_signed": False,
        "prism_invoked": False, "composition_eligible": False,
        "production_eligible": False,
    }


class OrdinaryCreateSourceTaskTests(unittest.TestCase):
    def setUp(self):
        f = RequestAdmissionTests(
            "test_gherkin_unapproved_source_returns_real_rights_refusal")
        f.setUp()
        self.f = f

    def evaluate(self, task_fit_evaluator=None):
        return self.f.evaluate(task_fit_evaluator=task_fit_evaluator)

    def test_only_three_pinned_originals_are_integrated(self):
        self.assertEqual(set(_SOURCE_TASK_REVIEWS), {
            "local-skills/repo-doctor",
            "local-skills/agent-postmortem",
            "local-skills/permissions-review",
        })
        self.assertIsNone(self.evaluate()["reviewed_original_task_reference"])

    def test_verified_task_reference_is_visible_with_nonadmission(self):
        report = self.evaluate(task_fit_evaluator=lambda *a: reference())
        ref = report["reviewed_original_task_reference"]
        self.assertEqual(ref["state"], "SOURCE_VERIFIED_TASK_REFERENCE_NOT_ADMITTED")
        self.assertEqual(ref["complete_package_file_list_sha256"], "2" * 64)
        self.assertEqual(len(ref["source_citations"]), 4)
        self.assertEqual(len(ref["narrow_task_spec_not_an_admitted_method"]["acceptance_scenarios"]), 5)
        self.assertFalse(ref["task_semantically_matched_to_user_request"])
        self.assertFalse(ref["source_rights_qualified"])
        self.assertFalse(ref["host_validated"])
        self.assertIn("ORIGINAL_TASK_FIT_UNQUALIFIED", report["refusal"]["codes"])
        self.assertEqual(report["refusal"]["code"], "RIGHTS_UNRESOLVED")
        for k in ("production_eligible", "prism_invoked", "composer_invoked",
                  "output_package_created"):
            self.assertFalse(report[k])

    def test_inconsistent_identity_snapshot_review_or_route_refuses(self):
        variants = [
            ("governed_review_id", "governed:other/source"),
            ("source_snapshot_commit", "f" * 40),
            ("source_snapshot_tree", "f" * 40),
            ("route", ROUTE),
            ("source_only_review_no_route_claim", False),
            ("original_evidence_linked_routes_not_task_qualified", ["other/path"]),
            ("original_complete_package_file_list_sha256", "c" * 64),
            ("original_static_review_status", "rejected"),
        ]
        for key, value in variants:
            with self.subTest(key=key):
                doc = reference()
                doc[key] = value
                with self.assertRaises(Refusal) as exc:
                    self.evaluate(task_fit_evaluator=lambda *a: doc)
                self.assertEqual(exc.exception.code, "TASK_REFERENCE_INTEGRITY")

    def test_forged_positive_rights_signer_or_host_claim_refuses(self):
        for key in ("rights_qualified", "host_validated",
                    "outcome_coverage_qualified", "operator_source_acceptance_signed",
                    "prism_invoked", "composition_eligible", "production_eligible"):
            with self.subTest(key=key):
                doc = reference()
                doc[key] = True
                with self.assertRaises(Refusal) as exc:
                    self.evaluate(task_fit_evaluator=lambda *a: doc)
                self.assertEqual(exc.exception.code, "TASK_REFERENCE_INTEGRITY")

    def test_missing_evidence_role_and_scenario_count_refuse(self):
        invalid = [lambda d: d["source_evidence"].pop(),
                   lambda d: d.__setitem__("acceptance_scenarios_planned_not_executed", 0),
                   lambda d: d["source_evidence"][0].__setitem__("original_lines_for_review", ""),
                   lambda d: d.__setitem__("actual_consumer_host_task_runs", 2)]
        for mutate in invalid:
            doc = reference()
            mutate(doc)
            with self.assertRaises(Refusal) as exc:
                self.evaluate(task_fit_evaluator=lambda *a: doc)
            self.assertEqual(exc.exception.code, "TASK_REFERENCE_INTEGRITY")

    def test_a_none_response_is_explicitly_unassessed(self):
        report = self.evaluate(task_fit_evaluator=lambda *a: None)
        self.assertIsNone(report["reviewed_original_task_reference"])
        self.assertNotIn("ORIGINAL_TASK_FIT_UNQUALIFIED", report["refusal"]["codes"])


if __name__ == "__main__":
    unittest.main()
