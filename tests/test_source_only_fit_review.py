"""Source-only review tests: original method scopes do not assume taxonomy fit."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.catalog_handoff import Refusal, canonical
from scripts.source_task_fit_review import assess_task_fit, ROLES
from test_source_task_fit_review import TaskFitSourceReviewTests, ROUTE, ID

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "repo-doctor": ("local-skills/repo-doctor",
                    "fed90fa0a664611e560bbc3ded630eb9e72253e1"),
    "agent-postmortem": ("local-skills/agent-postmortem",
                         "dde789e87da090b92021b3e55304299244f62ac2"),
    "permissions-review": ("local-skills/permissions-review",
                           "18f46840032829963715ec23894f7826dbbfcb77"),
    "automation-receipts": ("local-skills/automation-receipts",
                            "94fb288d7d6a3ea6982f22bd8bb9ef77b9de7add"),
    "fact-check": ("local-skills/fact-check",
                   "d83c43282d525682f3e13b8296111d7fe7de46f0"),
    "compare": ("local-skills/compare",
                "37b5d493dfa87ff1ce20e7b44d7d095e2eeed700"),
    "session-continuity": ("local-skills/session-continuity",
                           "93b8f0be84bdb39153386c27b46294233c39bb8b"),
    "decision-log": ("local-skills/decision-log",
                     "53b82e2a4838cdba57ee2e4c9158d6d2b4150c6b"),
}


class SourceOnlyFitReviewTests(unittest.TestCase):
    def setUp(self):
        fixture = TaskFitSourceReviewTests(
            "test_source_passages_bind_a_narrow_future_task_contract_not_eligibility")
        fixture.setUp()
        self.fixture = fixture
        self.graph = fixture.graph
        self.review = deepcopy(fixture.review)
        self.review["route"] = None
        self.graph.corpus.by_id["governed:" + ID]["raw"][
            "capability_mapping"] = {"evidence_linked_paths": [ROUTE]}

    def run_review(self):
        return assess_task_fit(self.graph, self.review,
                               inspector=lambda *args: self.fixture.package)

    def refusal(self, code):
        with self.assertRaises(Refusal) as error:
            self.run_review()
        self.assertEqual(error.exception.code, code)

    def test_narrow_source_review_does_not_invent_route_outcome_claim(self):
        result = self.run_review()
        self.assertIsNone(result["route"])
        self.assertTrue(result["source_only_review_no_route_claim"])
        self.assertEqual(result["original_evidence_linked_routes_not_task_qualified"],
                         [ROUTE])
        self.assertIsNone(result["registered_route_outcomes_not_qualified"])
        self.assertEqual(result["governed_review_id"], "governed:" + ID)
        self.assertEqual(len(result["source_evidence"]), 4)
        self.assertIs(result["composition_eligible"], False)
        self.assertIs(result["outcome_coverage_qualified"], False)
        self.assertIs(result["operator_source_acceptance_signed"], False)
        self.assertEqual(canonical(result), canonical(self.run_review()))

    def test_source_only_crosswalk_still_fails_closed_for_unrecognized_path(self):
        self.graph.corpus.by_id["governed:" + ID]["raw"][
            "capability_mapping"]["evidence_linked_paths"] = ["unknown/route"]
        self.refusal("TASK_CROSSWALK")

    def test_source_only_crosswalk_drift_and_duplicate_routes_refuse(self):
        raw = self.graph.corpus.by_id["governed:" + ID]["raw"]
        raw["capability_mapping"]["evidence_linked_paths"] = [ROUTE, ROUTE]
        self.refusal("TASK_CROSSWALK")
        raw["capability_mapping"]["evidence_linked_paths"] = [ROUTE]
        self.graph.paths[ROUTE]["matched"] = []
        self.refusal("TASK_CROSSWALK")

    def test_unknown_governed_method_and_forged_source_status_refuse(self):
        self.review["governed_review_id"] = "local-skills/nonexistent"
        self.refusal("TASK_CROSSWALK")
        self.review["governed_review_id"] = ID
        self.graph.corpus.by_id["governed:" + ID]["review_status"] = "rejected"
        self.refusal("TASK_REVIEW_STATUS")

    def test_route_claim_requires_existing_bidirectional_evidence(self):
        self.review["route"] = "unknown/route"
        self.refusal("TASK_CROSSWALK")
        self.review["route"] = ROUTE
        self.graph.paths[ROUTE]["matched"] = []
        self.refusal("TASK_CROSSWALK")

    def test_three_new_original_method_reviews_keep_identity_and_unexecuted_trials(self):
        ids = set()
        for name, (governed, blob) in EXPECTED.items():
            with self.subTest(name=name):
                doc = json.loads((ROOT / "docs/evidence" /
                                  ("source-task-fit-" + name + "-v1.json")
                                  ).read_text())
                self.assertIsNone(doc["route"])
                self.assertEqual(doc["source_entrypoint"],
                                 "skills/" + name + "/SKILL.md")
                self.assertEqual(doc["governed_review_id"], governed)
                self.assertEqual(doc["source_git_blob_sha1"], blob)
                self.assertEqual(doc["source_commit"],
                                 "31a8c518dd97b7828adcc728202fa41388a306d7")
                self.assertEqual(len(doc["source_evidence"]), 4)
                self.assertEqual({x["citation_role"] for x in doc["source_evidence"]},
                                 ROLES)
                self.assertEqual(len(doc["narrow_task_spec"]["acceptance_scenarios"]), 5)
                dispositions = {x["expected_disposition"] for x in
                                doc["narrow_task_spec"]["acceptance_scenarios"]}
                self.assertEqual(dispositions,
                                 {"TEST_MEASURED_TASK", "WITHHOLD_UNSUPPORTED_CLAIM"})
                for field in ("rights_qualified", "host_validated",
                              "composition_eligible", "outcome_coverage_qualified"):
                    self.assertIs(doc[field], False)
                self.assertNotIn(governed, ids)
                ids.add(governed)


if __name__ == "__main__":
    unittest.main()
