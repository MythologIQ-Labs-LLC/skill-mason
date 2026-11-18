"""Adversarial 247-route completeness and non-admission tests for C2 gap filling."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import COMMIT, Refusal, canonical
from scripts.capability_graph import CapabilityGraph
from scripts.capability_gap_backlog import build_ledger, focus, load_proposals
from test_catalog_index import Fixture


class GapLedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.tmp.name))
        self.fx.records[0]["capability_mapping"]["evidence_linked_paths"] = [
            "software-engineering/frontend"]
        self.domains = []
        self.outcomes = []
        for i in range(33):
            domain = ("software-engineering" if i == 0 else
                      "testing" if i == 1 else
                      "security" if i == 2 else "domain-%d" % i)
            subs = []
            for j in range(8 if i < 16 else 7):
                sub = ("frontend" if i == 0 and j == 0 else
                       "accessibility" if i == 1 and j == 0 else
                       "supply-chain" if i == 2 and j == 0 else "sub-%d" % j)
                path = domain + "/" + sub
                subs.append({
                    "id": sub, "name": sub,
                    "matched_skill_ids": (["local-skills/alpha"] if i == 0 and j == 0 else []),
                    "name_only_review_candidate_ids": (["external/beta"]
                                                       if i == 1 and j == 0 else [])})
                self.outcomes.append({
                    "path": path, "outcome_definition_status": "needs-workflow-decomposition",
                    "essential_outcomes": ([] if path != "testing/accessibility"
                                           else [{"expected_output": "test receipt"}]),
                    "existing_capability_statements": [],
                    "qualified_essential_outcome_count": None})
            self.domains.append({"id": domain, "name": domain, "subdomains": subs})
        self.save()
        self.proposal_path = Path(self.tmp.name) / "proposals.json"
        self.proposal = {
            "schema_version": "qortara/essential-workflow-proposals/1",
            "authority": "proposals-only-not-imported-into-skillz-or-capability-graph",
            "source_commit": COMMIT,
            "source_outcome_register": "registry/capability-outcome-register.json",
            "outcome_definition_status": "draft-requires-upstream-source-and-owner-review",
            "qualification_status": "not-tested", "rights_assessed": False,
            "host_validated": False, "composition_eligible": False,
            "rows": [self.new_row("software-engineering/frontend")]}
        self.save_proposal()

    def new_row(self, route):
        return {"route": route, "source_outcome_current_status": "needs-workflow-decomposition",
                "proposal_status": "DRAFT_NOT_GOVERNED",
                "objective": "Defined work outcome for later evidence-based evaluation",
                "inputs": ["trusted source data"],
                "outputs": ["reviewable answer"],
                "acceptance_criteria": ["Output identifies the exact source pin",
                                         "Output contains a verifiable refusal path"],
                "dependencies": ["read-only source checkout"],
                "failure_modes": ["missing source bytes"],
                "refusal_rule": "Refuse without valid source evidence and permissions",
                "source_anchor": {"source_commit": COMMIT,
                                  "outcome_register_path":
                                      "registry/capability-outcome-register.json",
                                  "route": route},
                "method_source_attested": False, "rights_qualified": False,
                "behavior_tested": False}

    def save(self):
        self.fx.paths[self.fx.taxonomy["recognized"]] = canonical(
            {"domains": self.domains})
        self.fx.paths[self.fx.taxonomy["outcomes"]] = canonical({"rows": self.outcomes})
        self.fx.paths[self.fx.taxonomy["prior_proposals"]] = canonical({"domains": []})
        self.fx.paths[self.fx.taxonomy["new_proposals"]] = canonical({"domains": []})
        self.fx.persist()

    def save_proposal(self):
        self.proposal_path.write_bytes(canonical(self.proposal))

    def graph(self):
        return CapabilityGraph(self.fx.index())

    def p(self):
        return load_proposals(self.graph(), self.proposal_path)

    def fail(self, code):
        self.save_proposal()
        with self.assertRaises(Refusal) as exc:
            self.p()
        self.assertEqual(exc.exception.code, code)

    def tearDown(self):
        self.tmp.cleanup()

    def test_exact_full_route_and_domain_cardinality(self):
        r = build_ledger(self.graph(), self.p(), limit=247)
        self.assertEqual(r["recognized_domains"], 33)
        self.assertEqual(r["recognized_subdomains"], 247)
        self.assertEqual(r["work_queue_total"], 247)
        self.assertEqual(len(r["queue_sample"]), 247)
        self.assertEqual(len(set(x["route"] for x in r["queue_sample"])), 247)
        self.assertEqual(r["subdomains_with_evidence_linked_reviews"], 1)
        self.assertEqual(r["subdomains_without_evidence_linked_reviews"], 246)
        self.assertEqual(r["essential_outcome_definitions_missing"], 246)
        self.assertEqual(r["unqualified_or_unknown_outcome_routes"], 247)
        self.assertEqual(r["governed_reviews_unmapped"], 1)
        self.assertEqual(r["draft_workflow_proposals_pending_review"], 1)
        self.assertEqual(r["methods_admitted"], 0)
        self.assertFalse(r["composition_eligible"])

    def test_domain_distribution_prevents_single_domain_queue_capture(self):
        r = build_ledger(self.graph(), self.p(), limit=33)
        self.assertEqual(len(set(x["domain"] for x in r["queue_sample"])), 33)
        self.assertTrue(r["queue_sample_truncated"])
        self.assertEqual(sum(x["recognized_subdomains"] for x in r["domains"]), 247)
        self.assertEqual(sum(x["draft_proposals_review_pending"]
                             for x in r["domains"]), 1)

    def test_review_link_and_name_lead_separate(self):
        r = build_ledger(self.graph(), self.p(), limit=247)
        routes = {x["route"]: x for x in r["queue_sample"]}
        self.assertEqual(routes["software-engineering/frontend"]["gap_category"],
                         "LINKED_SOURCE_NEEDS_WORKFLOW_DEFINITION")
        self.assertEqual(routes["software-engineering/frontend"]["review_ids"],
                         ["local-skills/alpha"])
        self.assertEqual(routes["testing/accessibility"]["name_only_hint_ids"],
                         ["external/beta"])
        self.assertEqual(routes["testing/accessibility"]["gap_category"],
                         "DEFINED_WORKFLOW_NEEDS_SOURCING")
        self.assertFalse(routes["testing/accessibility"]["rights_qualified"])
        self.assertEqual(routes["security/supply-chain"]["gap_category"],
                         "NO_EVIDENCE_LINKS_NEEDS_DISCOVERY")

    def test_draft_is_viewable_but_does_not_replace_pinned_outcomes(self):
        g = self.graph()
        r = focus(g, "software-engineering/frontend", self.p())
        self.assertIsNotNone(r["proposed_workflow"])
        self.assertEqual(r["actual_registered_essential_outcomes"], [])
        self.assertFalse(r["proposal_is_authoritative"])
        self.assertFalse(r["source_methods_qualified"])
        self.assertFalse(r["composition_eligible"])

    def test_missing_draft_returns_true_source_gap(self):
        r = focus(self.graph(), "security/supply-chain", self.p())
        self.assertIsNone(r["proposed_workflow"])
        self.assertEqual(r["route"]["draft_workflow_status"], "NO_DRAFT")

    def test_unqualified_defined_outcome_does_not_become_served(self):
        r = focus(self.graph(), "testing/accessibility", self.p())
        self.assertEqual(len(r["actual_registered_essential_outcomes"]), 1)
        self.assertIsNone(r["route"]["outcome_qualification_count"])
        self.assertFalse(r["composition_eligible"])

    def test_tampered_rights_promotion_veto(self):
        self.proposal["rights_assessed"] = True
        self.fail("PROPOSAL_AUTHORITY")

    def test_wrong_source_commit_veto(self):
        self.proposal["source_commit"] = "b" * 40
        self.fail("PROPOSAL_AUTHORITY")

    def test_unknown_route_veto(self):
        self.proposal["rows"][0]["route"] = "unknown/fabricated"
        self.fail("PROPOSAL_ROUTE")

    def test_duplicate_proposed_route_veto(self):
        self.proposal["rows"].append(copy.deepcopy(self.proposal["rows"][0]))
        self.fail("PROPOSAL_ROUTE")

    def test_missing_correctness_criteria_veto(self):
        self.proposal["rows"][0]["acceptance_criteria"] = ["only one"]
        self.fail("PROPOSAL_SCHEMA")

    def test_blank_failure_handling_veto(self):
        self.proposal["rows"][0]["failure_modes"] = []
        self.fail("PROPOSAL_SCHEMA")

    def test_stale_outcome_claim_veto(self):
        self.proposal["rows"][0]["source_outcome_current_status"] = "qualified"
        self.fail("PROPOSAL_STALE")

    def test_source_outcome_already_defined_veto(self):
        self.proposal["rows"].append(self.new_row("testing/accessibility"))
        self.fail("PROPOSAL_STALE")

    def test_forged_source_anchor_veto(self):
        self.proposal["rows"][0]["source_anchor"]["source_commit"] = "c" * 40
        self.fail("PROPOSAL_SOURCE")

    def test_malformed_limit_veto(self):
        with self.assertRaises(Refusal) as exc:
            build_ledger(self.graph(), self.p(), limit=248)
        self.assertEqual(exc.exception.code, "LIMIT")

    def test_unknown_focus_route_veto(self):
        with self.assertRaises(Refusal) as exc:
            focus(self.graph(), "unrecognized/path", self.p())
        self.assertEqual(exc.exception.code, "UNKNOWN_ROUTE")

    def test_undeclared_discovery_does_not_qualify_capability(self):
        r = build_ledger(self.graph(), {}, limit=247)
        self.assertEqual(r["raw_source_path_observations_not_reviewed"], 18)
        self.assertFalse(r["semantic_candidate_exhaustiveness_proven"])
        self.assertTrue(r["review_quality_not_inferred_from_counts"])
        self.assertFalse(r["source_rights_or_host_authority_assessed"])


if __name__ == "__main__":
    unittest.main()
