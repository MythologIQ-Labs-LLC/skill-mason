"""Adversarial source-to-task review tests: source quotes do not grant method rights."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import COMMIT, TREE, Refusal, canonical, git_blob, sha256
from scripts.source_task_fit_review import assess_task_fit, SCHEMA, ROLES

ROUTE="security/supply-chain"
ID="local-skills/mcp-vetting"
ROOT="skills/mcp-vetting/"
RAW=("The specified original task is a bounded review.\n"
     "Original method inventories tools and assesses data flow.\n"
     "The report requires evidence quality and a narrow recommendation.\n"
     "Original safety prohibits connecting the server during static review.\n").encode()


class TaskFitSourceReviewTests(unittest.TestCase):
    def setUp(self):
        self.review=json.loads((Path(__file__).resolve().parents[1] /
             "docs/evidence/source-task-fit-mcp-vetting-v1.json").read_text())
        self.review["source_git_blob_sha1"]=git_blob(RAW)
        for i,cite in enumerate(self.review["source_evidence"],1):
            cite["first_line"]=i
            cite["last_line"]=i
        self.corpus=SimpleNamespace(
            manifest={"source":{"commit":COMMIT,"git_tree_sha1":TREE}},
            first_party_paths=[ROOT+"SKILL.md"],
            by_id={"governed:"+ID:{
                "family":"governed","source_class":"first-party",
                "review_status":"verified","raw":{"record_id":ID}}},
            _raw_source=lambda path: RAW if path==ROOT+"SKILL.md" else None)
        self.graph=SimpleNamespace(corpus=self.corpus,
              paths={ROUTE:{"matched":[ID]}},
              outcome_by_path={ROUTE:{"path":ROUTE,"essential_outcomes":[]}})
        self.package={
            "state":"PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
            "record_id":ID,"original_snapshot_commit":COMMIT,
            "source_root":ROOT,"package_file_count":1,
            "package_file_list_sha256":"1"*64,
            "files":[{"path":"SKILL.md","bytes":len(RAW),
                       "sha256":sha256(RAW),"git_blob_sha1":git_blob(RAW)}],
            "rights_assessed":False,"composition_eligible":False,
            "method_contract_qualified":False}

    def evaluate(self,**options):
        args=dict(graph=self.graph,review=self.review,
                  inspector=lambda *a:self.package)
        args.update(options)
        return assess_task_fit(**args)

    def refuse(self,code,**options):
        with self.assertRaises(Refusal) as err:
            self.evaluate(**options)
        self.assertEqual(err.exception.code,code)

    def test_source_passages_bind_a_narrow_future_task_contract_not_eligibility(self):
        r=self.evaluate()
        self.assertEqual(r["schema"],SCHEMA)
        self.assertEqual(r["state"],"BOUNDED_ORIGINAL_SOURCE_TASK_REFERENCE_NOT_ADMITTED")
        self.assertEqual(r["source_snapshot_commit"],COMMIT)
        self.assertEqual(r["entrypoint_git_blob_sha1"],git_blob(RAW))
        self.assertEqual(r["original_complete_package_file_list_sha256"],"1"*64)
        self.assertEqual({x["role"] for x in r["source_evidence"]},ROLES)
        self.assertEqual(r["source_evidence"][0]["first_line"],1)
        self.assertEqual(r["source_evidence"][0]["source_file_sha256"],sha256(RAW))
        self.assertEqual(r["source_evidence"][0]["source_url"],
                         "https://github.com/Knapp-Kevin/skillz/blob/"+COMMIT+
                         "/skills/mcp-vetting/SKILL.md#L1-L1")
        self.assertEqual(r["acceptance_scenarios_planned_not_executed"],5)
        self.assertEqual(r["actual_consumer_host_task_runs"],0)
        self.assertIsNone(r["operator_source_acceptance_signed"] if False else None)
        for key in ("rights_qualified","host_validated","outcome_coverage_qualified",
                    "operator_source_acceptance_signed","prism_invoked",
                    "composition_eligible","production_eligible"):
            self.assertIs(r[key],False)
        self.assertTrue(r["source_quotes_prove_bytes_not_reviewers_semantic_conclusion"])
        self.assertEqual(canonical(r),canonical(self.evaluate()))

    def test_input_rights_or_host_promotion_refused(self):
        for field in ("rights_qualified","host_validated","outcome_coverage_qualified",
                      "composition_eligible"):
            with self.subTest(field=field):
                p=deepcopy(self.review);p[field]=True
                self.refuse("TASK_REVIEW_AUTHORITY",review=p)
        p=deepcopy(self.review);p["authority"]="operator-accepted"
        self.refuse("TASK_REVIEW_AUTHORITY",review=p)
        p=deepcopy(self.review);p["extra_positive_claim"]=True
        self.refuse("TASK_REVIEW_SCHEMA",review=p)

    def test_signed_status_or_source_package_cannot_be_self_asserted(self):
        for field in ("rights_assessed","method_contract_qualified","composition_eligible"):
            with self.subTest(field=field):
                package=deepcopy(self.package);package[field]=True
                self.refuse("TASK_PACKAGE",inspector=lambda *a:package)
        self.corpus.by_id["governed:"+ID]["review_status"]="rejected"
        self.refuse("TASK_REVIEW_STATUS")

    def test_original_source_byte_and_entrypoint_drift_refused(self):
        altered=deepcopy(self.review);altered["source_git_blob_sha1"]="0"*40
        self.refuse("TASK_ENTRYPOINT",review=altered)
        bad=deepcopy(self.package);bad["files"][0]["sha256"]="f"*64
        self.refuse("TASK_SOURCE_BYTES",inspector=lambda *a:bad)
        changed=b"fake source replaces real citation\n"
        self.corpus._raw_source=lambda path:changed
        self.refuse("TASK_SOURCE_BYTES")

    def test_out_of_range_or_missing_role_original_quote_refused(self):
        for begin,end in ((0,1),(1,15),(3,2),(20,21)):
            with self.subTest(begin=begin,end=end):
                review=deepcopy(self.review)
                review["source_evidence"][0]["first_line"]=begin
                review["source_evidence"][0]["last_line"]=end
                self.refuse("TASK_EVIDENCE",review=review)
        review=deepcopy(self.review)
        review["source_evidence"].pop()
        self.refuse("TASK_EVIDENCE",review=review)
        review=deepcopy(self.review)
        review["source_evidence"][1]["citation_role"]="TRIGGER_AND_LIMIT"
        self.refuse("TASK_EVIDENCE",review=review)
        review=deepcopy(self.review)
        review["source_evidence"][1]["relative_path"]="../other/SKILL.md"
        self.refuse("TASK_EVIDENCE",review=review)

    def test_original_snapshot_and_crosswalk_match(self):
        r=deepcopy(self.review);r["source_tree"]="f"*40
        self.refuse("TASK_SOURCE_PIN",review=r)
        self.corpus.manifest["source"]["commit"]="f"*40
        self.refuse("TASK_SOURCE_PIN")
        self.corpus.manifest["source"]["commit"]=COMMIT
        self.graph.paths[ROUTE]["matched"]=[]
        self.refuse("TASK_CROSSWALK")

    def test_task_spec_requires_measurable_positive_and_negative_scenarios(self):
        review=deepcopy(self.review)
        for scenario in review["narrow_task_spec"]["acceptance_scenarios"]:
            scenario["expected_disposition"]="TEST_MEASURED_TASK"
        self.refuse("TASK_SCENARIOS",review=review)
        review=deepcopy(self.review)
        review["narrow_task_spec"]["acceptance_scenarios"][1]["id"]=review[
            "narrow_task_spec"]["acceptance_scenarios"][0]["id"]
        self.refuse("TASK_SCENARIOS",review=review)
        review=deepcopy(self.review);review["broader_claims_not_supported"]=[]
        self.refuse("TASK_REVIEW_SCHEMA",review=review)
        review=deepcopy(self.review)
        review["narrow_task_spec"]["explicit_exclusions"]=[]
        self.refuse("TASK_REVIEW_SCHEMA",review=review)


if __name__=="__main__":
    unittest.main()
