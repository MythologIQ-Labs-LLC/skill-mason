"""Gherkin regression: source-lexical route search cannot rank JSON keys as capability evidence.

A fake graph isolates search semantics from the pinned corpus. The live 247-route
source audit runs in the existing corpus-index workflow.
"""
from types import SimpleNamespace
import unittest

from scripts.capability_graph import CapabilityGraph, SCHEMA, _tokens
from scripts.catalog_handoff import Refusal


class SourceGroundedSearchTests(unittest.TestCase):
    def setUp(self):
        # Pure, realistic route nodes. Zero evidence-linked or admitted methods.
        self.graph = CapabilityGraph.__new__(CapabilityGraph)
        self.graph.paths = {
            "engineering/path-analysis": {
                "domain": {"id": "engineering", "name": "Engineering"},
                "subdomain": {"id": "path-analysis", "name": "Path Analysis"},
                "matched": [], "hints": [],
            },
            "operations/job-monitoring": {
                "domain": {"id": "operations", "name": "Operations"},
                "subdomain": {"id": "job-monitoring", "name": "Job Monitoring"},
                "matched": [], "hints": [],
            },
            "research/fact-check": {
                "domain": {"id": "research", "name": "Research"},
                "subdomain": {"id": "fact-check", "name": "Fact Check"},
                "matched": [], "hints": [],
            },
        }
        self.graph.outcome_by_path = {
            "engineering/path-analysis": {
                "essential_outcomes": ["Validate exact filesystem routes"],
                "existing_capability_statements": [
                    {"description": "Inspect source-linked artifacts"}],
            },
            "operations/job-monitoring": {
                "essential_outcomes": ["Verify executed automation receipts"],
                "existing_capability_statements": ["Monitor scheduled tasks safely"],
            },
            "research/fact-check": {
                "essential_outcomes": ["Cite primary historical records"],
                "existing_capability_statements": ["Check original dated studies"],
            },
        }
        self.graph.corpus = SimpleNamespace(
            by_id={},taxonomy_paths={"outcomes": "pinned-outcomes.json"})

    def result(self, query, limit=25):
        value = self.graph.search(query, limit=limit)
        self.assertEqual(value["schema"], SCHEMA)
        self.assertEqual(value["search_type"],
                         "recognized_capability_lexical_routing_not_method_admission")
        self.assertFalse(value["composition_eligible"])
        self.assertTrue(value["unmapped_or_unreviewed_methods_not_proven_absent"])
        self.assertTrue(all(not x["composition_eligible"] for x in value["routes"]))
        return value

    def test_given_json_field_names_when_searching_then_no_phantom_route_results(self):
        for query in ("essential_outcomes", "domain_name", "subdomain_name",
                      "existing_capability_statements", "statements"):
            with self.subTest(query=query):
                self.assertEqual(self.result(query)["routes"], [])

    def test_given_an_actual_route_token_when_searching_then_only_real_values_count(self):
        self.assertEqual(
            [x["path"] for x in self.result("path")["routes"]],
            ["engineering/path-analysis"])
        self.assertEqual(
            [x["path"] for x in self.result("job monitoring")["routes"]],
            ["operations/job-monitoring"])
        self.assertEqual(
            [x["path"] for x in self.result("primary records")["routes"]],
            ["research/fact-check"])

    def test_given_partial_word_when_searching_then_no_false_substring_hits(self):
        for query in ("pathw", "nitor", "monitoringgg", "exec", "historic", "source_link"):
            with self.subTest(query=query):
                self.assertEqual(self.result(query)["routes"], [])
        # Word boundaries in punctuation-separated canonical route IDs work.
        self.assertEqual(self.result("fact check")["total_matches"], 1)
        self.assertEqual(self.result("path analysis")["total_matches"], 1)

    def test_given_unicode_case_and_punctuation_then_tokenizer_is_deterministic(self):
        self.assertEqual(_tokens("JOB-MONITORING / job_monitoring"),
                         frozenset({"job", "monitoring"}))
        self.assertEqual(_tokens("Café cafe\u0301"), frozenset({"café"}))
        variants = ("JOB-MONITORING", "job monitoring", "  job   monitoring  ")
        matches = [
            [row["path"] for row in self.result(query)["routes"]]
            for query in variants]
        self.assertEqual(matches, [["operations/job-monitoring"]] * 3)

    def test_given_a_multiword_query_then_terms_may_come_from_distinct_actual_fields(self):
        self.assertEqual(
            [x["path"] for x in self.result("engineering artifacts")["routes"]],
            ["engineering/path-analysis"])
        self.assertEqual(self.result("engineering private")["routes"], [])

    def test_given_limit_then_result_order_truncation_and_count_stay_exact(self):
        all_routes = self.result("original")
        # Only research has this actual word in this fixture.
        self.assertEqual(all_routes["total_matches"], 1)
        broad = self.result("check", limit=1)
        self.assertEqual(broad["total_matches"], 1)
        self.assertFalse(broad["truncated"])
        # "source" belongs to one route; the three route IDs all contain
        # distinct tokens. Replicate an actual shared term in source values.
        for row in self.graph.outcome_by_path.values():
            row["essential_outcomes"].append("Respect user authority")
        many = self.result("authority", limit=2)
        self.assertEqual(many["total_matches"], 3)
        self.assertTrue(many["truncated"])
        self.assertEqual([x["path"] for x in many["routes"]],
                         sorted(self.graph.paths)[:2])

    def test_given_no_searchable_tokens_then_fail_closed_not_everything_matches(self):
        for query in ("_--_", "  - /  ", "\u200b"):
            with self.subTest(query=query), self.assertRaises(Refusal) as ctx:
                self.graph.search(query)
            self.assertEqual(ctx.exception.code, "QUERY_REQUIRED")

    def test_given_normal_query_then_existing_api_refusal_contract_is_unchanged(self):
        x = self.result("monitoring")
        self.assertEqual(len(x["routes"]), 1)
        self.assertEqual(x["routes"][0]["evidence_linked_reviews"], [])
        self.assertEqual(x["routes"][0]["qualified_essential_outcome_count"], None)
        self.assertEqual(x["routes"][0]["source_commit"].__class__, str)
        self.assertFalse(x["routes"][0]["composition_eligible"])

    def test_given_invalid_limit_then_do_not_change_comparison_or_approval(self):
        for limit in (0, 201, True, 1.4):
            with self.subTest(limit=limit), self.assertRaises(Refusal) as ctx:
                self.graph.search("monitoring", limit=limit)
            self.assertEqual(ctx.exception.code, "QUERY_LIMIT")


if __name__ == "__main__":
    unittest.main()
