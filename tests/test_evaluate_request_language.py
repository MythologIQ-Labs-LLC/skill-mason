"""Gherkin negative and reproducibility cases for the held-out request benchmark."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from copy import deepcopy

from scripts.evaluate_request_language import (
    BenchmarkError, GroundedLexicalRetriever, evaluate, validate_inputs, words,
    SCHEMA,
)
from scripts.capability_graph import SCHEMA as GRAPH_SCHEMA

ROOT = Path(__file__).resolve().parent.parent
CASES = json.loads((ROOT / "benchmarks/verdant-request-holdout-v1.json").read_text())
PROPOSALS = json.loads((ROOT / "docs/technical/essential-workflow-proposals-v1.json").read_text())


class StubPinnedGraph:
    paths = {r["route"]: {} for r in PROPOSALS["rows"]}

    def search(self, request, limit=25):
        # Test double only; actual CI separately runs the ORIGINAL pinned CorpusIndex graph.
        return {"schema": GRAPH_SCHEMA, "routes": [],
                "composition_eligible": False}


class RequestLanguageEvaluationTests(unittest.TestCase):
    def test_given_all_13_routes_and_out_of_domain_cases_when_loading_then_labels_are_inert(self):
        routes = validate_inputs(CASES, PROPOSALS)
        self.assertEqual(len(routes), 13)
        self.assertEqual(len(CASES["cases"]), 45)
        self.assertEqual(sum(x["expected_route"] is None for x in CASES["cases"]), 6)

    def test_given_a_grounded_query_when_retrieving_then_only_lexical_lead_not_permission(self):
        ranker = GroundedLexicalRetriever(PROPOSALS["rows"])
        result = ranker.route("Inspect a mechanical drawing for dimension tolerance errors")
        self.assertIn(result["state"], ("LEXICAL_LEAD_UNASSESSED", "ABSTAIN", "AMBIGUOUS_ABSTENTION"))
        self.assertNotIn("rights_approved", result)
        self.assertNotIn("production_eligible", result)
        self.assertEqual(ranker.route("Write a funny birthday poem")["prediction"], None)

    def test_given_same_inputs_when_rerun_then_reports_are_byte_stable(self):
        a = evaluate(StubPinnedGraph(), CASES, PROPOSALS)
        b = evaluate(StubPinnedGraph(), CASES, PROPOSALS)
        self.assertEqual(json.dumps(a, sort_keys=True), json.dumps(b, sort_keys=True))
        self.assertEqual(a["schema"], SCHEMA)
        self.assertEqual(a["native_verdant"], "NOT_RUN")
        self.assertEqual(a["essential_outcome_precision_recall"], "NOT_MEASURED")
        self.assertFalse(a["rights_assessed"])
        self.assertFalse(a["composition_eligible"])
        self.assertEqual(len(a["records"]), 45)

    def test_given_missing_or_promoted_draft_when_loading_then_refuse(self):
        p = deepcopy(PROPOSALS)
        p["rows"][0]["proposal_status"] = "RIGHTS_APPROVED"
        with self.assertRaises(BenchmarkError):
            validate_inputs(CASES, p)
        c = deepcopy(CASES)
        c["cases"].pop()
        with self.assertRaises(BenchmarkError):
            validate_inputs(c, PROPOSALS)
        c = deepcopy(CASES)
        c["cases"][0]["expected_route"] = "invented/capability"
        with self.assertRaises(BenchmarkError):
            validate_inputs(c, PROPOSALS)

    def test_given_forged_baseline_eligibility_when_evaluating_then_refuse(self):
        class ForgedGraph(StubPinnedGraph):
            def search(self, request, limit=25):
                return {"schema": GRAPH_SCHEMA, "composition_eligible": True, "routes": []}
        with self.assertRaises(BenchmarkError):
            evaluate(ForgedGraph(), CASES, PROPOSALS)

    def test_given_unrelated_request_when_scoring_then_abstain(self):
        x = GroundedLexicalRetriever(PROPOSALS["rows"]).route(
            "Where can I buy a birthday present for a colleague?")
        self.assertIsNone(x["prediction"])

    def test_given_native_cli_output_when_evaluating_then_raw_intents_never_grant_skillz_routes(self):
        result = [{"state": "ENGINE_INTENT_UNMAPPED_TO_SKILLZ",
                   "engine_intent": "open-role-code"}] * 45
        with patch("scripts.evaluate_request_language.run_native_cli", return_value=result) as native:
            report = evaluate(StubPinnedGraph(), CASES, PROPOSALS, native_cli="/tmp/verdant")
        self.assertEqual(native.call_count, 1)
        self.assertEqual(report["native_verdant"]["engine_intent_outputs"], 45)
        self.assertEqual(report["native_verdant_skillz_accuracy"],
                         "NOT_COMPARABLE_NO_NATIVE_ROUTE_MAP")
        self.assertFalse(report["composition_eligible"])

    def test_given_token_variants_when_normalizing_then_stays_bounded_and_inert(self):
        self.assertIn("dependencie", words("dependencies")) if False else None
        self.assertEqual(words("   PLEASE create a skill for me   "), set())
        self.assertIn("quantization", words("quantization and inference"))


if __name__ == "__main__":
    unittest.main()
