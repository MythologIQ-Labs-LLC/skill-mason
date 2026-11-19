"""Gherkin contract controls for frozen, unapproved retrieval replay."""
import json
from copy import deepcopy
from pathlib import Path
import unittest

from scripts.evaluate_request_language import BenchmarkError
from scripts.replay_request_retrieval import SCHEMA, assess, validate
from scripts.capability_graph import SCHEMA as GRAPH_SCHEMA

ROOT=Path(__file__).resolve().parents[1]
CASES=json.loads((ROOT/"benchmarks/request-routing-adversarial-v2.json").read_text())
PROPOSALS=json.loads((ROOT/"docs/technical/essential-workflow-proposals-v1.json").read_text())


class FakePinnedGraph:
    paths={row["route"]:{} for row in PROPOSALS["rows"]}
    def search(self,query,limit=25):
        return {"schema":GRAPH_SCHEMA,"composition_eligible":False,
                "search_type":"recognized_capability_lexical_routing_not_method_admission",
                "routes":[]}


class ReplayTests(unittest.TestCase):
    def test_given_unseen_adversarial_cases_when_loading_then_unchanged_13_route_contract(self):
        self.assertEqual(len(validate(CASES,PROPOSALS)),13)
        self.assertEqual(len(CASES["cases"]),46)
        self.assertEqual(sum(x["kind"]=="in_scope" for x in CASES["cases"]),26)
        self.assertEqual(sum(x["kind"]=="ambiguous_or_negated" for x in CASES["cases"]),8)

    def test_given_unmodified_candidate_when_replaying_then_no_authority_or_inference(self):
        a=assess(FakePinnedGraph(),CASES,PROPOSALS)
        b=assess(FakePinnedGraph(),CASES,PROPOSALS)
        self.assertEqual(a,b)
        self.assertEqual(a["schema"],SCHEMA)
        self.assertFalse(a["source_rights_established"])
        self.assertFalse(a["prism_invoked"])
        self.assertFalse(a["composer_invoked"])
        self.assertFalse(a["production_eligible"])
        self.assertFalse(a["independent_gold_labels"])
        self.assertEqual(a["native_verdant"],"NOT_RUN")
        self.assertEqual(a["outcome_extraction"],"NOT_MEASURED")

    def test_given_unapproved_or_changed_labels_when_running_then_refuse(self):
        q=deepcopy(CASES)
        q["cases"][0]["expected_route"]=None
        with self.assertRaises(BenchmarkError):validate(q,PROPOSALS)
        p=deepcopy(PROPOSALS)
        p["rows"][0]["proposal_status"]="QUALIFIED"
        with self.assertRaises(BenchmarkError):validate(CASES,p)
        q=deepcopy(CASES)
        q["cases"][2]["id"]=q["cases"][1]["id"]
        with self.assertRaises(BenchmarkError):validate(q,PROPOSALS)

    def test_given_forged_catalog_promotion_when_replaying_then_fail_closed(self):
        class Malicious(FakePinnedGraph):
            def search(self,query,limit=25):
                return {"schema":GRAPH_SCHEMA,"composition_eligible":True,
                        "search_type":"recognized_capability_lexical_routing_not_method_admission",
                        "routes":[]}
        with self.assertRaises(BenchmarkError):assess(Malicious(),CASES,PROPOSALS)

    def test_given_hard_negations_when_replaying_then_failed_acceptance_is_not_greenwashed(self):
        report=assess(FakePinnedGraph(),CASES,PROPOSALS)
        metrics=report["grounded_metrics"]
        self.assertEqual(metrics["in_scope_total"],26)
        self.assertEqual(metrics["correct_top1"]+metrics["wrong_nonabstaining"]+
                         metrics["in_scope_abstained"],26)
        allowed=(
            metrics["correct_top1"]>=19 and metrics["wrong_nonabstaining"]<=1 and
            metrics["outside_13_false_positive"]==0 and
            metrics["negated_or_ambiguous_false_positive"]==0
        )
        self.assertEqual(report["decision"]=="CANDIDATE_FIT_FOR_INDEPENDENT_ADJUDICATION",allowed)


if __name__=="__main__":unittest.main()
