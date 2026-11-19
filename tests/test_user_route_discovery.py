"""Gherkin route-search, exact route, and fail-closed discovery tests."""
from types import SimpleNamespace
import unittest
from scripts.catalog_handoff import COMMIT, TREE, Refusal
from scripts.user_route_discovery import discover, SCHEMA

PATH = "software-engineering/frontend"
ITEM = {
    "schema": "qortara/capability-opportunity-graph/1",
    "source_commit": COMMIT,
    "path": PATH,
    "recognized": True,
    "composition_eligible": False,
    "evidence_linked_reviews": [{
        "record_id": "anthropic-skills/frontend-design",
        "composition_eligibility": "not-assessed",
        "rights_clearance": "not-established"
    }],
    "essential_outcomes": ["Accessible frontend implementation"],
}

class StubGraph:
    paths = {PATH: {}}
    def summary(self):
        return {"schema":"qortara/capability-opportunity-graph/1",
                "source_commit": COMMIT, "recognized_domains": 33,
                "recognized_subdomains": 247,
                "evidence_mapped_governed_identities": 122,
                "unmapped_governed_identities": 921,
                "rights_assessed": False, "host_qualified": False,
                "composition_eligible": False}
    def search(self,query,limit=10):
        return {"schema":"qortara/capability-opportunity-graph/1",
                "search_type":
                    "recognized_capability_lexical_routing_not_method_admission",
                "routes": [dict(ITEM)] if "frontend" in query else [],
                "total_matches": 1 if "frontend" in query else 0,
                "truncated": False, "composition_eligible":False}
    def show(self,path):
        if path != PATH:
            raise Refusal("UNRECOGNIZED_CAPABILITY","route unavailable")
        return dict(ITEM)

class RouteDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.graph=StubGraph()

    def test_gherkin_lexical_search_returns_grounded_route_not_method_approval(self):
        x=discover(self.graph,query="frontend")
        self.assertEqual(x["schema"],SCHEMA)
        self.assertEqual(x["mode"],"SEARCH")
        self.assertEqual(x["routes"][0]["path"], PATH)
        self.assertEqual(x["pinned_source_commit"],COMMIT)
        self.assertEqual(x["pinned_source_tree"],TREE)
        self.assertEqual(x["recognized_route_count"],247)
        self.assertEqual(x["unmapped_governed_identity_count"],921)
        self.assertEqual(x["matched_route_count"],1)
        self.assertIs(x["source_rights_established"],False)
        self.assertIs(x["host_validated"],False)
        self.assertIs(x["production_eligible"],False)
        self.assertIs(x["routes"][0]["composition_eligible"],False)

    def test_gherkin_exact_route_can_be_inspected_before_create(self):
        x=discover(self.graph,path=PATH)
        self.assertEqual(x["mode"],"SHOW")
        self.assertEqual(x["routes"][0]["essential_outcomes"],
                         ["Accessible frontend implementation"])
        self.assertEqual(x["routes"][0]["evidence_linked_reviews"][0]
                         ["rights_clearance"],"not-established")

    def test_gherkin_summary_reports_distinct_unmapped_records(self):
        x=discover(self.graph,summary=True)
        self.assertEqual(x["mode"],"SUMMARY")
        self.assertEqual(x["matched_route_count"],1)
        self.assertEqual(x["routes"],[])
        self.assertTrue(x["unmapped_or_unreviewed_methods_not_proven_absent"])

    def test_gherkin_no_result_is_not_evidence_of_source_absence(self):
        x=discover(self.graph,query="quantum cryptographic gargoyle")
        self.assertEqual(x["routes"],[])
        self.assertEqual(x["matched_route_count"],0)
        self.assertTrue(x["unmapped_or_unreviewed_methods_not_proven_absent"])

    def test_gherkin_route_requires_explicit_mode(self):
        for data in ({}, {"summary":True,"query":"frontend"},
                     {"query":"frontend","path":PATH}):
            with self.subTest(data=data), self.assertRaises(Refusal) as exc:
                discover(self.graph,**data)
            self.assertEqual(exc.exception.code,"ROUTE_MODE")

    def test_gherkin_limit_and_untrusted_query_refuse(self):
        for kw,code in (
            ({"query":"frontend","limit":0},"ROUTE_LIMIT"),
            ({"query":"frontend","limit":26},"ROUTE_LIMIT"),
            ({"query":"x"},"ROUTE_QUERY"),
            ({"query":"frontend\x00 bypass"},"ROUTE_QUERY"),
            ({"query":"frontend\npassthrough"},"ROUTE_QUERY"),
        ):
            with self.subTest(kw=kw),self.assertRaises(Refusal) as exc:
                discover(self.graph,**kw)
            self.assertEqual(exc.exception.code,code)

    def test_gherkin_invalid_exact_route_refuses_without_guessing(self):
        with self.assertRaises(Refusal) as exc:
            discover(self.graph,path="imaginary/skill")
        self.assertEqual(exc.exception.code,"UNRECOGNIZED_CAPABILITY")

    def test_gherkin_forged_review_approval_is_rejected(self):
        original=self.graph.search
        def forged(*args,**kw):
            x=original(*args,**kw)
            x["routes"][0]["evidence_linked_reviews"][0]["rights_clearance"]="approved"
            return x
        self.graph.search=forged
        with self.assertRaises(Refusal) as exc:
            discover(self.graph,query="frontend")
        self.assertEqual(exc.exception.code,"ROUTE_PROMOTION")

    def test_gherkin_forged_graph_eligibility_is_rejected(self):
        original=self.graph.search
        def forged(*args,**kw):
            x=original(*args,**kw)
            x["composition_eligible"]=True
            return x
        self.graph.search=forged
        with self.assertRaises(Refusal) as exc:
            discover(self.graph,query="frontend")
        self.assertEqual(exc.exception.code,"ROUTE_GRAPH")

    def test_gherkin_limit_bounds_returned_results(self):
        original=self.graph.search
        def forged(*args,**kw):
            x=original(*args,**kw)
            x["routes"]=[dict(ITEM)]*3
            return x
        self.graph.search=forged
        with self.assertRaises(Refusal) as exc:
            discover(self.graph,query="frontend",limit=2)
        self.assertEqual(exc.exception.code,"ROUTE_GRAPH")

if __name__=="__main__":
    unittest.main()
