"""C4 comparison receipts: deterministic evidence display without method authorization."""
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import Refusal, canonical
from scripts.capability_graph import CapabilityGraph
from scripts.candidate_comparison import compare
from test_catalog_index import Fixture


def untrusted_package_stub(_index, identity):
    if identity != "governed:local-skills/alpha":
        raise AssertionError("not an exact source-bound first party record")
    return {"state": "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
            "package_file_count": 2, "package_file_list_sha256": "1" * 64}


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.temp.name))
        domains, outcomes = [], []
        for i in range(33):
            root = "software-engineering" if i == 0 else "domain-%d" % i
            subdomains = []
            for j in range(8 if i < 16 else 7):
                sub = "testing" if i == 0 and j == 0 else "sub-%d" % j
                route = root + "/" + sub
                subdomains.append({
                    "id": sub, "name": sub,
                    "matched_skill_ids": ["local-skills/alpha"] if i == 0 and j == 0 else [],
                    "name_only_review_candidate_ids": ["external/beta"] if i == 0 and j == 0 else []})
                outcomes.append({"path": route, "essential_outcomes": [],
                                 "outcome_definition_status": "needs-workflow-decomposition",
                                 "qualified_essential_outcome_count": None,
                                 "qualification_status": "not-established"})
            domains.append({"id": root, "name": root, "subdomains": subdomains})
        self.fx.paths[self.fx.taxonomy["recognized"]] = canonical({"domains": domains})
        self.fx.paths[self.fx.taxonomy["outcomes"]] = canonical({"rows": outcomes})
        self.fx.paths[self.fx.taxonomy["prior_proposals"]] = canonical({"domains": []})
        self.fx.paths[self.fx.taxonomy["new_proposals"]] = canonical({"domains": []})
        self.fx.persist()

    def tearDown(self):
        self.temp.cleanup()

    def graph(self):
        return CapabilityGraph(self.fx.index())

    def compare(self, **kwargs):
        return compare(self.graph(), "software-engineering/testing", "ChatGPT",
                       package_inspector=untrusted_package_stub, **kwargs)

    def test_separates_reviewed_evidence_from_name_leads(self):
        row = self.compare()
        self.assertEqual(row["evidence_linked_review_count"], 1)
        self.assertEqual(row["name_only_lead_count"], 1)
        self.assertEqual(row["evidence_linked_reviews"][0]["governed_id"], "local-skills/alpha")
        self.assertEqual(row["name_only_unassessed_leads"][0]["governed_id_or_unresolved_hint"],
                         "external/beta")
        self.assertEqual(row["name_only_unassessed_leads"][0]["recorded_review_status"], "rejected")
        self.assertFalse(row["name_only_unassessed_leads"][0]["evidence_link_assessed"])

    def test_verified_static_review_is_still_rights_blocked(self):
        row = self.compare()
        self.assertEqual(row["evidence_linked_reviews"][0]["disposition"],
                         "BLOCKED_RIGHTS_AND_HOST_UNASSESSED")
        self.assertEqual(row["eligible_candidate_count"], 0)
        self.assertIsNone(row["chosen_method"])
        self.assertFalse(row["prism_invoked"])
        self.assertFalse(row["composition_eligible"])
        self.assertFalse(row["all_semantically_relevant_sources_exhaustively_qualified"])

    def test_package_byte_evidence_does_not_promote_eligibility(self):
        row = self.compare()
        receipt = row["evidence_linked_reviews"][0]["package_bytes"]
        self.assertEqual(receipt["status"], "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED")
        self.assertFalse(receipt["reference_dependency_closure_proven"])
        self.assertFalse(row["full_package_rights_and_host_qualification_established"])

    def test_rejected_evidence_link_remains_blocked(self):
        self.fx.records[0]["review"]["semantic_status"] = "rejected"
        self.fx.records[1]["review"]["semantic_status"] = "verified"
        self.fx.persist()
        row = self.compare()
        self.assertEqual(row["evidence_linked_reviews"][0]["disposition"], "BLOCKED_STATIC_REVIEW")
        self.assertFalse(row["evidence_linked_reviews"][0]["eligible"])

    def test_retired_evidence_link_remains_blocked(self):
        self.fx.records[0]["review"]["semantic_status"] = "retired"
        self.fx.persist()
        row = self.compare()
        self.assertEqual(row["evidence_linked_reviews"][0]["disposition"], "BLOCKED_RETIRED")

    def test_lexical_path_lead_is_not_method(self):
        source = self.fx.g1_paths[0]
        record = self.fx.paths[source].decode()
        self.fx.paths[source] = record.replace("lexical-example", "testing-lead").encode()
        self.fx.persist()
        row = self.compare(limit=1)
        self.assertEqual(row["lexical_observation_match_count"], 1)
        self.assertEqual(len(row["lexical_observation_leads"]), 1)
        self.assertEqual(row["declared_observation_rows_swept"], 18)
        self.assertEqual(row["lexical_observation_leads"][0]["relevance_class"], "UNASSESSED_LEXICAL_LEAD")
        self.assertFalse(row["receipt_not_a_best_method_rank"] is False)

    def test_bounded_sample_never_silently_hides_counts(self):
        for source in self.fx.g1_paths[:4]:
            data = self.fx.paths[source].decode().replace("lexical-example", "testing-lead")
            self.fx.paths[source] = data.encode()
        self.fx.persist()
        row = self.compare(limit=1)
        self.assertEqual(row["lexical_observation_match_count"], 4)
        self.assertEqual(len(row["lexical_observation_leads"]), 1)
        self.assertTrue(row["lexical_observation_truncated"])

    def test_host_label_is_not_host_authority(self):
        row = self.compare()
        self.assertEqual(row["target_host_requested_not_approved"], "ChatGPT")
        self.assertFalse(row["full_package_rights_and_host_qualification_established"])

    def test_missing_host_refuses(self):
        with self.assertRaises(Refusal) as exc:
            compare(self.graph(), "software-engineering/testing", "")
        self.assertEqual(exc.exception.code, "HOST_REQUIRED")

    def test_unknown_recognized_route_refuses(self):
        with self.assertRaises(Refusal) as exc:
            compare(self.graph(), "proposed-only/development", "ChatGPT")
        self.assertEqual(exc.exception.code, "UNKNOWN_ROUTE")

    def test_unsafe_sample_limit_refuses(self):
        with self.assertRaises(Refusal) as exc:
            self.compare(limit=1001)
        self.assertEqual(exc.exception.code, "LIMIT")

    def test_name_hints_may_not_be_in_governed_review_index(self):
        recognized = self.fx.taxonomy["recognized"]
        import json
        raw = json.loads(self.fx.paths[recognized])
        raw["domains"][0]["subdomains"][0]["name_only_review_candidate_ids"] = ["unregistered/lead"]
        self.fx.paths[recognized] = canonical(raw)
        self.fx.persist()
        row = self.compare()
        self.assertFalse(row["name_only_unassessed_leads"][0]["governed_record_found"])
        self.assertFalse(row["name_only_unassessed_leads"][0]["eligible"])

    def test_no_lexical_mode_discloses_scope(self):
        row = self.compare(include_lexical=False)
        self.assertEqual(row["declared_observation_rows_swept"], 0)
        self.assertIsNone(row["lexical_observation_match_count"])
        self.assertFalse(row["all_semantically_relevant_sources_exhaustively_qualified"])

    def test_no_matched_review_does_not_mean_no_methods_exist(self):
        row = compare(self.graph(), "domain-1/sub-0", "Other Host")
        self.assertEqual(row["evidence_linked_review_count"], 0)
        self.assertTrue(row["unmapped_and_unreviewed_methods_may_be_relevant"])
        self.assertEqual(row["eligible_candidate_count"], 0)


if __name__ == "__main__":
    unittest.main()
