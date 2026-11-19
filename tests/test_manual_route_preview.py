"""Read-only manual choice Gherkin acceptance and adversarial negative tests."""
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.manual_route_preview import SCHEMA, preview
from scripts.catalog_handoff import COMMIT,TREE,Refusal

ROOT=Path(__file__).resolve().parents[1]
PROPOSALS=json.loads((ROOT/"docs/technical/essential-workflow-proposals-v1.json").read_text())

class StubGraph:
    paths={x["route"]:{} for x in PROPOSALS["rows"]}
    corpus=SimpleNamespace(manifest={"source":{"commit":COMMIT,"git_tree_sha1":TREE}})

class ManualPreviewTests(unittest.TestCase):
    def test_given_normal_task_when_previewing_then_only_unapproved_leads_are_returned(self):
        x=preview(StubGraph(),PROPOSALS,
            "Analyze the release dependency signatures and artifact provenance")
        self.assertEqual(x["schema"],SCHEMA)
        self.assertEqual(x["state"],"LEADS_REQUIRE_USER_CHOICE")
        self.assertTrue(x["unapproved_route_leads"])
        self.assertTrue(all(z["route"] in StubGraph.paths for z in x["unapproved_route_leads"]))
        self.assertTrue(x["user_must_explicitly_select_route"])
        self.assertIsNone(x["selected_route"])
        for k in ("source_rights_established","host_authority_established","prism_invoked",
                  "composer_invoked","output_package_created","production_eligible"):
            self.assertIs(x[k],False)

    def test_given_negated_request_when_lexical_false_positive_then_it_is_only_a_lead(self):
        x=preview(StubGraph(),PROPOSALS,
            "Do not review medical evidence, translate my invitation instead")
        self.assertIs(x["semantic_negation_handling_verified"],False)
        self.assertIsNone(x["selected_route"])
        self.assertIs(x["composition_eligible"],False)
        self.assertTrue(x["user_must_explicitly_select_route"])

    def test_given_no_matching_content_when_previewing_then_abstain_not_invent(self):
        x=preview(StubGraph(),PROPOSALS,
            "Please explain how to plant yellow tulips in a garden")
        self.assertEqual(x["state"],"ABSTAIN_NO_AUTOMATIC_ROUTE")
        self.assertEqual(x["unapproved_route_leads"],[])
        self.assertIsNone(x["selected_route"])

    def test_given_forged_published_route_or_source_pin_when_previewing_then_refuse(self):
        corrupted=json.loads(json.dumps(PROPOSALS))
        corrupted["rows"][0]["proposal_status"]="APPROVED"
        with self.assertRaises(Refusal):
            preview(StubGraph(),corrupted,"Review dependency signatures for a release")
        original=StubGraph()
        original.corpus=SimpleNamespace(manifest={"source":{"commit":"0"*40,"git_tree_sha1":TREE}})
        with self.assertRaises(Refusal):
            preview(original,PROPOSALS,"Review dependency signatures for a release")

    def test_given_bad_user_input_or_limit_when_previewing_then_refuse(self):
        for query in ("foo","Review\x00 other material with secrets"):
            with self.subTest(query=query):
                with self.assertRaises(Refusal):
                    preview(StubGraph(),PROPOSALS,query,limit=3)
        with self.assertRaises(Refusal):
            preview(StubGraph(),PROPOSALS,
                "Inspect package provenance before deciding whether to release",limit=4)


if __name__=="__main__":unittest.main()
