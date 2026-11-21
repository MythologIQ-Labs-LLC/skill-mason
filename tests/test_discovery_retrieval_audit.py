"""Gherkin controls for the 247-route adversarial evidence protocol.

Synthetic labels test evaluator mechanics, NOT real task relevance.
"""
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import COMMIT, TREE, Refusal
from scripts.discovery_retrieval_audit import RouteNameProbe, evaluate, SCHEMA
from scripts.evaluate_request_language import BenchmarkError


ROUTE_NAMES = (
    "cobalt", "tungsten", "quartz", "lattice", "ember", "prism", "copper",
    "zircon", "meridian", "orbital", "conifer", "radian", "mosaic")


class StubGraph:
    def __init__(self):
        routes = ["governed/" + item for item in ROUTE_NAMES] + [
            "other/entry-%03d" % i for i in range(234)]
        assert len(routes) == 247
        self.paths = {
            name: {"domain": {"name": "Governed" if name.startswith("governed/") else "Other"},
                   "subdomain": {"name": name.split("/")[1]}}
            for name in routes}
        self.outcome_by_path = {
            name: {"essential_outcomes": ["sample"] if i == 0 else []}
            for i, name in enumerate(routes)}
        self.corpus = SimpleNamespace(manifest={"source": {
            "commit": COMMIT, "git_tree_sha1": TREE}})
        self.forged_authority = False

    def search(self, query, limit=25):
        matches = [query] if query in self.paths else []
        return {"routes": [{"path": p} for p in matches[:limit]],
                "truncated": len(matches) > limit,
                "composition_eligible": self.forged_authority}


def synthetic_inputs():
    rows = [{"route": "governed/" + name, "proposal_status": "DRAFT_NOT_GOVERNED"}
            for name in ROUTE_NAMES]
    proposals = {"schema_version": "qortara/essential-workflow-proposals/1",
                 "authority": "proposals-only-not-imported-into-skillz-or-capability-graph",
                 "rows": rows}
    cases = []
    for i in range(26):
        cases.append({"id": "IN-%02d" % i, "kind": "in_scope",
                      "prompt": "Investigate the %s capability for original evidence" % ROUTE_NAMES[i % 13],
                      "expected_route": rows[i % 13]["route"]})
    for i in range(12):
        cases.append({"id": "OUT-%02d" % i, "kind": "outside_13",
                      "prompt": "Please prepare a thoughtful birthday greeting for my friend",
                      "expected_route": None})
    for i in range(8):
        cases.append({"id": "ADV-%02d" % i, "kind": "ambiguous_or_negated",
                      "prompt": "Do not investigate cobalt capability; draft a birthday greeting instead",
                      "expected_route": None})
    return ({"schema": "qortara/untuned-retrieval-holdout/1",
             "status": "AUTHOR_LABELED_SECOND_SET_NOT_INDEPENDENT_HUMAN_ADJUDICATION",
             "total": 46, "cases": cases}, proposals)


class DiscoveryRetrievalAuditTests(unittest.TestCase):
    def test_given_all_routes_when_auditing_then_denominators_are_not_invented(self):
        graph = StubGraph()
        cases, proposals = synthetic_inputs()
        result = evaluate(graph, cases, proposals)
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["recognized_routes"], 247)
        self.assertEqual(result["routes_missing_essential_outcomes"], 246)
        self.assertEqual(result["route_identity_echo_NOT_semantic_accuracy"]["found_somewhere"], 247)
        self.assertEqual(result["benchmarks"]["total"], 46)
        self.assertEqual(len(result["records"]), 46)
        self.assertEqual(result["methods"]["source_exact_all_query_tokens"]["positive_abstentions"], 26)
        self.assertFalse(result["benchmark_labels_independently_adjudicated"])
        self.assertTrue(result["outside_13_not_counted_as_247_false_positives"])
        self.assertEqual(result["decision"], "NO_GO_AUTOMATIC_ROUTE_SELECTION")
        for field in ("rights_assessed", "host_validated", "composition_eligible", "production_eligible"):
            self.assertFalse(result[field])

    def test_given_a_negated_request_when_name_probe_runs_then_never_claim_semantics(self):
        probe = RouteNameProbe(StubGraph())
        ranked = probe.rank("Do not investigate cobalt capability; write birthday greeting")
        self.assertEqual(ranked[0]["path"], "governed/cobalt")
        self.assertIn("matched_source_name_tokens", ranked[0])
        self.assertNotIn("confidence", ranked[0])
        self.assertNotIn("eligible", ranked[0])

    def test_given_forged_origin_or_authority_when_evaluating_then_refuse(self):
        graph = StubGraph()
        cases, proposals = synthetic_inputs()
        graph.corpus.manifest["source"]["commit"] = "forged"
        with self.assertRaises(Refusal) as err:
            evaluate(graph, cases, proposals)
        self.assertEqual(err.exception.code, "SOURCE_PIN")
        graph = StubGraph()
        graph.forged_authority = True
        with self.assertRaises(Refusal) as err:
            evaluate(graph, cases, proposals)
        self.assertEqual(err.exception.code, "AUDIT_AUTHORITY")

    def test_given_missing_route_or_mutated_label_when_auditing_then_refuse(self):
        cases, proposals = synthetic_inputs()
        graph = StubGraph()
        del graph.paths["governed/cobalt"]
        with self.assertRaises(Refusal) as err:
            evaluate(graph, cases, proposals)
        self.assertEqual(err.exception.code, "AUDIT_SCOPE")
        graph = StubGraph()
        cases["cases"][0]["expected_route"] = "other/unreviewed"
        with self.assertRaises(BenchmarkError):
            evaluate(graph, cases, proposals)


if __name__ == "__main__":
    unittest.main()
