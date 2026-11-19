"""Gherkin-derived read-only request admission: actual source paths cannot self-approve."""
from copy import deepcopy
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import Refusal, canonical, sha256
from scripts.request_to_skill import evaluate_request, SCHEMA

ROUTE = "security/supply-chain"
HOST = "ChatGPT"
TASK = "Review dependency supply chain evidence and report actionable security findings"
METHOD = "local-skills/mcp-vetting"
EXTERNAL = "anthropic-skills/frontend-design"


def record(record_id=METHOD, *, status="verified", source_class="first-party"):
    return {
        "governed_id": record_id,
        "review_status": status,
        "source_class": source_class,
        "disposition": ("BLOCKED_STATIC_REVIEW" if status == "rejected"
                        else "BLOCKED_RIGHTS_AND_HOST_UNASSESSED"),
        "package_bytes": {"status": "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
                          "file_list_sha256": "2" * 64,
                          "reference_dependency_closure_proven": False},
        "eligible": False,
    }


def comparator(graph, route, host, *, include_lexical, limit, external_selection):
    assert include_lexical is False and limit == 25
    assert route == ROUTE and host == HOST
    sources = graph.sources
    if external_selection:
        assert external_selection["record_id"].removeprefix("governed:") in {
            x["governed_id"] for x in sources}
    return {
        "schema": "qortara/candidate-comparison/1",
        "state": "READ_ONLY_COMPARISON_NO_ADMISSION",
        "route": route,
        "outcome_definition_status": graph.outcome_by_path[route]["outcome_definition_status"],
        "defined_essential_outcomes": len(graph.outcome_by_path[route]["essential_outcomes"]),
        "essential_outcome_qualification_count":
            graph.outcome_by_path[route]["qualified_essential_outcome_count"],
        "evidence_linked_review_count": len(sources),
        "evidence_linked_reviews": sources,
        "name_only_unassessed_leads": [{
            "governed_id_or_unresolved_hint": "unknown/future",
            "eligible": False, "evidence_link_assessed": False}],
        "composition_eligible": False,
        "prism_invoked": False,
        "full_package_rights_and_host_qualification_established": False,
        "chosen_method": None,
        "eligible_candidate_count": 0,
    }


def preflight(graph, route, host, selected, *, external_selection,
              comparison_receipt=None):
    assert route == ROUTE and host == HOST
    assert selected.removeprefix("governed:") in {x["governed_id"] for x in graph.sources}
    return {
        "schema": "qortara/method-to-prism-preflight/1",
        "state": "UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION",
        "composition_eligible": False,
        "prism_invoked": False,
        "operator_accepted_rights": False,
        "host_authority_verified": False,
        "independently_authenticated_method_assertion": False,
        "selected_method_for_composition": None,
        "facts_verified": {"evidence": False, "rights": False,
                           "authority": False, "coverage": False},
        "binding": {"governed_id": selected.removeprefix("governed:"),
                    "requested_route": route},
        "binding_sha256": "e" * 64,
        "source_package_bytes_verified": True,
        "negative_test_vector_hex": "00000000",
        "typed_generation_refusal": {
            "codes": (["STATIC_REVIEW_REJECTED"] if
                      any(x["governed_id"] == selected.removeprefix("governed:") and
                          x["review_status"] == "rejected" for x in graph.sources)
                      else []) +
                     ["EVIDENCE_UNQUALIFIED", "RIGHTS_UNRESOLVED",
                      "AUTHORITY_EXCEEDED", "OUTCOME_UNCOVERED"]},
    }


class RequestAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.graph = SimpleNamespace(
            paths={ROUTE: {}},
            outcome_by_path={ROUTE: {
                "path": ROUTE,
                "outcome_definition_status": "needs-workflow-decomposition",
                "essential_outcomes": [],
                "qualified_essential_outcome_count": None}},
            corpus=SimpleNamespace(taxonomy_paths={
                "outcomes": "registry/capability-outcome-register.json"},
                manifest={"source": {
                "repository": "https://github.com/Knapp-Kevin/skillz",
                "commit": "31a8c518dd97b7828adcc728202fa41388a306d7",
                "git_tree_sha1": "e6d5dfeb42bcd7777ddff52605922fead62135ff"}}),
            sources=[record()]
        )

    def evaluate(self, **changes):
        options={"graph": self.graph, "request": TASK, "host": HOST,
                 "route": ROUTE, "comparator": comparator, "preflight": preflight}
        options.update(changes)
        return evaluate_request(**options)

    def test_gherkin_unapproved_source_returns_real_rights_refusal(self):
        out=self.evaluate()
        self.assertEqual(out["schema"], SCHEMA)
        self.assertEqual(out["state"], "REFUSED_PRE_ADMISSION")
        self.assertEqual(out["refusal"]["code"], "RIGHTS_UNRESOLVED")
        self.assertEqual(out["request_sha256"], sha256(TASK.encode()))
        self.assertEqual(out["selected_source_binding_sha256"], "e"*64)
        self.assertEqual(out["inspected_governed_record_not_selected_for_composition"],
                         "governed:"+METHOD)
        self.assertTrue(out["exact_source_package_bytes_verified"])
        self.assertEqual(out["pinned_source"]["commit"],
                         "31a8c518dd97b7828adcc728202fa41388a306d7")
        for k in ("composer_invoked", "prism_invoked", "production_eligible",
                  "output_package_created", "host_validated",
                  "method_rights_established", "end_to_end_inference_tokens_measured"):
            self.assertIs(out[k], False)
        self.assertEqual(out["inference_calls_observed_in_this_python_entrypoint"], 0)

    def test_gherkin_no_evidence_link_is_mapping_gap_not_missing_corpus(self):
        self.graph.sources=[]
        out=self.evaluate(preflight=lambda *a, **kw: self.fail("must not preflight"))
        self.assertEqual(out["refusal"]["code"], "MAPPING_GAP")
        self.assertEqual(out["evidence_linked_review_count"], 0)
        self.assertIsNone(out["inspected_governed_record_not_selected_for_composition"])
        self.assertEqual(out["name_only_unassessed_leads"][0]["evidence_link_assessed"],False)

    def test_multiple_reviews_require_explicit_inspection_not_automatic_best(self):
        self.graph.sources.append(record(EXTERNAL,source_class="third-party"))
        out=self.evaluate(preflight=lambda *a, **kw: self.fail("must not select"))
        self.assertEqual(out["refusal"]["code"], "METHOD_SELECTION_REQUIRED")
        self.assertEqual(len(out["candidates"]), 2)
        chosen=self.evaluate(governed_method="governed:"+EXTERNAL)
        self.assertEqual(chosen["refusal"]["code"], "RIGHTS_UNRESOLVED")
        self.assertEqual(chosen["selected_source_binding_sha256"],"e"*64)
        self.assertFalse(chosen["production_eligible"])

    def test_rejected_source_never_masquerades_as_license(self):
        self.graph.sources=[record(status="rejected")]
        out=self.evaluate()
        self.assertEqual(out["refusal"]["code"],"STATIC_REVIEW_REJECTED")
        self.assertIn("RIGHTS_UNRESOLVED",out["refusal"]["codes"])

    def test_unknown_route_and_omitted_route_refuse_before_comparison(self):
        for r,code in ((None,"ROUTE_REQUIRED"),("imaginary/workflow","UNKNOWN_ROUTE")):
            with self.subTest(route=r),self.assertRaises(Refusal) as err:
                self.evaluate(route=r,
                    comparator=lambda *a,**kw:self.fail("should not compare"))
            self.assertEqual(err.exception.code,code)

    def test_user_prompt_cannot_be_used_as_an_asserted_method_or_authority(self):
        for req,code in [
            ("generate skills","REQUEST_TOO_SHORT"),
            ("x"*1201,"REQUEST_INVALID"),
            ("A task to do something with a \x00 zero byte","REQUEST_INVALID"),
            ("Please compose this right\u0065\u0301 now even without evidence",
             "REQUEST_INVALID"),
        ]:
            with self.subTest(request=req),self.assertRaises(Refusal) as err:
                self.evaluate(request=req)
            self.assertEqual(err.exception.code,code)

    def test_tampered_snapshot_commit_refused(self):
        self.graph.corpus.manifest["source"]["commit"]="f"*40
        with self.assertRaises(Refusal) as err:self.evaluate()
        self.assertEqual(err.exception.code,"SOURCE_PIN")

    def test_selected_method_must_be_recognized_evidence_link(self):
        for candidate in ("governed:unmapped/other","unreviewed/test","governed:"):
            with self.subTest(candidate=candidate),self.assertRaises(Refusal) as err:
                self.evaluate(governed_method=candidate)
            self.assertEqual(err.exception.code,"METHOD_SELECTION")

    def test_external_package_custody_must_match_same_governed_record(self):
        self.graph.sources.append(record(EXTERNAL,source_class="third-party"))
        sel={"record_id":"governed:"+EXTERNAL,"checkout":"/examined-source",
             "repo_tree":"1"*40}
        out=self.evaluate(governed_method="governed:"+EXTERNAL,
                          external_selection=sel)
        self.assertFalse(out["method_rights_established"])
        with self.assertRaises(Refusal) as err:
            self.evaluate(governed_method="governed:"+METHOD,
                          external_selection=sel)
        self.assertEqual(err.exception.code,"EXTERNAL_SELECTION")

    def test_comparison_cannot_claim_eligible_method(self):
        def forged(*args,**kwargs):
            x=comparator(*args,**kwargs)
            x["chosen_method"]={"id":METHOD}
            x["eligible_candidate_count"]=1
            x["composition_eligible"]=True
            return x
        with self.assertRaises(Refusal) as err:self.evaluate(comparator=forged)
        self.assertEqual(err.exception.code,"UNTRUSTED_PROMOTION")

    def test_forged_preflight_rights_cannot_reach_prism(self):
        def forged(*args,**kwargs):
            x=preflight(*args,**kwargs)
            x["operator_accepted_rights"]=True
            x["facts_verified"]["rights"]=True
            x["selected_method_for_composition"]=METHOD
            return x
        with self.assertRaises(Refusal) as err:self.evaluate(preflight=forged)
        self.assertEqual(err.exception.code,"UNTRUSTED_PROMOTION")

    def test_signed_rights_claim_missing_from_denial_is_not_accepted(self):
        def forged(*args,**kwargs):
            x=preflight(*args,**kwargs)
            x["typed_generation_refusal"]["codes"]=["EVIDENCE_UNQUALIFIED"]
            return x
        with self.assertRaises(Refusal) as err:self.evaluate(preflight=forged)
        self.assertEqual(err.exception.code,"UNTRUSTED_PROMOTION")

    def test_repeatability_includes_complete_source_comparison_receipt(self):
        a=self.evaluate()
        b=self.evaluate()
        self.assertEqual(canonical(a),canonical(b))
        self.assertEqual(a["candidates"][0]["governed_id"],METHOD)
        self.assertEqual(a["name_only_unassessed_leads"][0]
                         ["governed_id_or_unresolved_hint"],"unknown/future")
        self.assertNotIn(TASK,str(a),"request body must not leak into evidence")

    def test_inspected_binding_must_match_selected_governed_record(self):
        def swapped(*args,**kwargs):
            x=preflight(*args,**kwargs)
            x["binding"]["governed_id"]="wrong/other"
            return x
        with self.assertRaises(Refusal) as err:self.evaluate(preflight=swapped)
        self.assertEqual(err.exception.code,"UNTRUSTED_PROMOTION")


    def test_gherkin_empty_source_outcomes_are_explicitly_blocked(self):
        out = self.evaluate()
        coverage = out["source_outcome_coverage"]
        self.assertEqual(coverage["gap_code"], "OUTCOME_DEFINITION_MISSING")
        self.assertEqual(coverage["defined_essential_outcome_count"], 0)
        self.assertEqual(coverage["defined_essential_outcomes"], [])
        self.assertEqual(
            coverage["source_outcome_row"],
            "registry/capability-outcome-register.json")
        self.assertEqual(
            coverage["source_outcome_row_sha256"],
            sha256(canonical(self.graph.outcome_by_path[ROUTE])))
        self.assertIn("OUTCOME_DEFINITION_MISSING", out["refusal"]["codes"])
        self.assertEqual(out["refusal"]["code"], "RIGHTS_UNRESOLVED")
        self.assertFalse(coverage["composition_eligible"])

    def test_gherkin_described_outcomes_still_need_independent_qualification(self):
        self.graph.outcome_by_path[ROUTE]["essential_outcomes"] = [
            {"expected_output": "complete dependency inventory"}]
        self.graph.outcome_by_path[ROUTE]["qualified_essential_outcome_count"] = 1
        out = self.evaluate()
        self.assertEqual(
            out["source_outcome_coverage"]["gap_code"],
            "OUTCOME_QUALIFICATION_UNVERIFIED")
        self.assertEqual(
            out["source_outcome_coverage"][
                "source_claimed_qualified_count_not_independent_proof"], 1)
        self.assertIn(
            "OUTCOME_QUALIFICATION_UNVERIFIED", out["refusal"]["codes"])
        self.assertFalse(out["composer_invoked"])

    def test_gherkin_comparison_cannot_forge_source_outcome_coverage(self):
        def forged(*args, **kwargs):
            x = comparator(*args, **kwargs)
            x["defined_essential_outcomes"] = 9
            return x
        with self.assertRaises(Refusal) as exc:
            self.evaluate(comparator=forged)
        self.assertEqual(exc.exception.code, "OUTCOME_COMPARISON_DRIFT")

    def test_gherkin_missing_stale_or_malformed_outcome_row_refuses(self):
        row = self.graph.outcome_by_path[ROUTE]
        for mutated in (None, {"path": "wrong/route", "essential_outcomes": []},
                        {"path": ROUTE, "essential_outcomes": "not a list"},
                        {"path": ROUTE, "essential_outcomes": [],
                         "qualified_essential_outcome_count": 1}):
            with self.subTest(mutated=mutated):
                self.graph.outcome_by_path[ROUTE] = mutated
                with self.assertRaises(Refusal) as exc:
                    self.evaluate()
                self.assertEqual(exc.exception.code, "OUTCOME_SOURCE_DRIFT")
        self.graph.outcome_by_path[ROUTE] = row

    def test_gherkin_route_without_source_outcome_row_refuses(self):
        self.graph.outcome_by_path.clear()
        with self.assertRaises(Refusal) as exc:
            self.evaluate()
        self.assertEqual(exc.exception.code, "OUTCOME_SOURCE_MISSING")


if __name__ == "__main__":
    unittest.main()
