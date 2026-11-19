"""Non-admitting real-corpus route probe: structural and adversarial contracts."""
import unittest
from types import SimpleNamespace

from scripts.catalog_handoff import Refusal
from scripts.live_capability_probe import evaluate

ROUTE = "software-engineering/frontend"


def proposal():
    return {"objective": "Build an accessible responsive UI component",
            "proposal_status": "DRAFT_NOT_GOVERNED",
            "acceptance_criteria": ["keyboard works", "layout works"],
            "rights_qualified": False,
            "behavior_tested": False,
            "method_source_attested": False}


def comparison(graph, route, host, *, include_lexical, limit):
    assert route == ROUTE and host == "ChatGPT"
    assert include_lexical is False and limit == 5
    return {
        "route": route, "chosen_method": None, "eligible_candidate_count": 0,
        "composition_eligible": False, "prism_invoked": False,
        "full_package_rights_and_host_qualification_established": False,
        "evidence_linked_reviews": [{
            "governed_id": "test/real-pinned-review",
            "source_class": "first-party",
            "eligible": False
        }],
        "evidence_linked_review_count": 1,
        "evidence_linked_review_dispositions": {
            "BLOCKED_RIGHTS_AND_HOST_UNASSESSED": 1},
        "name_only_lead_count": 2
    }


def preflight(graph, route, host, gid):
    assert route == ROUTE and host == "ChatGPT"
    assert gid == "governed:test/real-pinned-review"
    return {
        "binding": {
            "governed_id": "test/real-pinned-review",
            "requested_route": ROUTE
        }, "negative_test_vector_hex": "00000000",
        "source_package_bytes_verified": True,
        "typed_generation_refusal": {
            "state": "REFUSED_PRE_ADMISSION",
            "original_source_bytes_proven": True,
            "codes": ["RIGHTS_UNRESOLVED", "OUTCOME_UNCOVERED"]
        }, "prism_invoked": False, "composition_eligible": False,
        "operator_accepted_rights": False,
        "facts_verified": {
            "evidence": False, "rights": False,
            "authority": False, "coverage": False
        }, "binding_sha256": "a" * 64
    }


class LiveCapabilityProbeTests(unittest.TestCase):
    def setUp(self):
        self.graph = SimpleNamespace(paths={ROUTE: {}})
        self.proposals = {ROUTE: proposal()}

    def run_probe(self, **kwargs):
        return evaluate(self.graph, self.proposals,
                        comparator=comparison, preflight=preflight, **kwargs)

    def test_exact_source_byte_receipt_is_never_method_admission(self):
        r = self.run_probe()
        self.assertEqual(r["tested_distinct_routes"], 1)
        self.assertEqual(r["sampled_original_source_bytes_verified_count"], 1)
        self.assertEqual(r["qualified_skills"], 0)
        self.assertEqual(r["actual_prism_guest_invocations"], 0)
        self.assertFalse(r["rights_accepted"])
        self.assertFalse(r["composition_eligible"])
        self.assertEqual(r["scenarios"][0]["state"], "REFUSED_PRE_ADMISSION")
        self.assertEqual(r["scenarios"][0]["sampled_source_binding_sha256"], "a" * 64)
        self.assertEqual(r["refusal_code_occurrences_not_unique_skills"],
                         {"OUTCOME_UNCOVERED": 1, "RIGHTS_UNRESOLVED": 1})

    def test_no_evidence_links_are_gaps_not_eligible_or_absent_sources(self):
        def none(*args, **kwargs):
            r = comparison(*args, **kwargs)
            r["evidence_linked_reviews"] = []
            r["evidence_linked_review_count"] = 0
            r["evidence_linked_review_dispositions"] = {}
            return r
        r = evaluate(self.graph, self.proposals,
                     comparator=none,
                     preflight=lambda *a, **kw: self.fail("no method must be preflighted"))
        self.assertEqual(r["routes_with_no_evidence_linked_reviews"], 1)
        self.assertEqual(r["scenarios"][0]["refusal_codes"][0],
                         "NO_EVIDENCE_LINKED_REVIEW")
        self.assertFalse(r["scenarios"][0]["sampled_source_bytes_verified"])

    def test_untrusted_comparison_cannot_self_promote(self):
        def elevated(*args, **kwargs):
            r = comparison(*args, **kwargs)
            r["eligible_candidate_count"] = 1
            r["chosen_method"] = {"id": "forged"}
            return r
        with self.assertRaises(Refusal) as failure:
            evaluate(self.graph, self.proposals,
                     comparator=elevated, preflight=preflight)
        self.assertEqual(failure.exception.code, "PROBE_PROMOTION")

    def test_false_or_unpinned_guest_assertion_refuses(self):
        def forged(*args, **kwargs):
            r = preflight(*args, **kwargs)
            r["facts_verified"]["rights"] = True
            return r
        with self.assertRaises(Refusal) as failure:
            self.run_probe(preflight=forged)
        self.assertEqual(failure.exception.code, "PROBE_PROMOTION")

    def test_duplicate_unknown_and_rights_promoted_proposals_refuse(self):
        for routes in ([ROUTE, ROUTE], ["unknown/unmapped"], []):
            with self.subTest(routes=routes), self.assertRaises(Refusal) as f:
                self.run_probe(requested_routes=routes)
            self.assertEqual(f.exception.code, "PROBE_ROUTE")
        self.proposals[ROUTE]["rights_qualified"] = True
        with self.assertRaises(Refusal) as f:
            self.run_probe()
        self.assertEqual(f.exception.code, "PROBE_AUTHORITY")


if __name__ == "__main__":
    unittest.main()
