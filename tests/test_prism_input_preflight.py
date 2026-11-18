"""C4 -> Prism preflight: source identity binds; unqualified facts remain zero."""
from copy import deepcopy
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import Refusal, canonical, sha256
from scripts.prism_input_preflight import prepare_preflight


class PrismInputPreflightTests(unittest.TestCase):
    def setUp(self):
        self.first = {
            "record_id": "first/example",
            "review": {"semantic_status": "verified"},
            "capability_mapping": {"evidence_linked_paths": ["software-engineering/frontend"]},
            "rights": {"package_redistribution_clearance": "not-established-by-export"},
            "composition": {"eligibility": "not-assessed"},
        }
        self.external = deepcopy(self.first)
        self.external["record_id"] = "external/other"
        self.external["review"]["semantic_status"] = "rejected"
        self.first_item = {"family": "governed", "source_class": "first-party",
                           "review_status": "verified", "raw": self.first}
        self.external_item = {"family": "governed", "source_class": "third-party",
                              "review_status": "rejected", "raw": self.external}
        corpus = SimpleNamespace(
            records=[self.first_item, self.external_item],
            by_id={"governed:first/example": self.first_item,
                   "governed:external/other": self.external_item},
            manifest={"source": {"commit": "a"*40, "git_tree_sha1": "b"*40}},
            family_counts={"g1-g3": 61326, "four-source": 4813})
        self.graph = SimpleNamespace(
            corpus=corpus,
            paths={"software-engineering/frontend": {
                "matched": ["first/example", "external/other"], "hints": [],
                "subdomain": {"id": "frontend"}}},
            outcome_by_path={"software-engineering/frontend": {
                "outcome_definition_status": "needs-workflow-decomposition",
                "essential_outcomes": [],
                "qualified_essential_outcome_count": None}})
        self.packages = {"first/example": {
            "state": "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
            "package_file_count": 3,
            "package_file_list_sha256": "1" * 64}}

    def inspect_first(self, index, rid):
        self.assertIs(index, self.graph.corpus)
        return self.packages[rid[len("governed:"):]]

    def inspect_external(self, index, rid, checkout, *, expected_repo_tree):
        self.assertIs(index, self.graph.corpus)
        self.assertEqual(rid, "governed:external/other")
        self.assertEqual(checkout, "/fixed/source")
        self.assertEqual(expected_repo_tree, "e"*40)
        return {
            "state": "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED",
            "pinned_git_object_consistency_verified": True,
            "composition_eligible": False,
            "complete_tracked_package_files_verified": 2,
            "package_git_tree_sha1": "a"*40,
            "entrypoint_git_blob_sha1": "b"*40,
            "historical_export_identity_gap_requires_upstream_correction": False,
            "complete_package_reference_and_asset_review_queue": {
                "schema": "qortara/package-reference-inventory/1",
                "state": "VERIFIED_SOURCE_BYTES_REFERENCE_LEADS_ONLY",
                "file_count": 2,
                "each_asset_rights_cleared": False,
                "dependency_closure_proven": False,
                "source_license_and_notice_obligations_assessed": False,
                "target_host_approved": False,
                "composition_eligible": False,
                "frontmatter_license_pointer": {"matched": ["LICENSE.txt"]}}
        }

    def preflight(self, rid="governed:first/example", **kwargs):
        return prepare_preflight(
            self.graph, "software-engineering/frontend", "ChatGPT", rid,
            package_inspector=self.inspect_first,
            external_inspector=self.inspect_external, **kwargs)

    def test_verified_source_bytes_are_not_qualified_semantic_evidence(self):
        report = self.preflight()
        self.assertEqual(report["state"],
                         "UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION")
        self.assertTrue(report["source_package_bytes_verified"])
        self.assertEqual(report["negative_test_vector_hex"], "00000000")
        self.assertEqual(report["facts_verified"], {
            "evidence": False, "rights": False,
            "authority": False, "coverage": False})
        self.assertEqual(report["expected_guest_refusals"], [
            "EVIDENCE_UNQUALIFIED", "RIGHTS_UNRESOLVED",
            "AUTHORITY_EXCEEDED", "OUTCOME_UNCOVERED"])
        self.assertFalse(report["prism_invoked"])
        self.assertIsNone(report["prism_guest_decision"])
        self.assertIsNone(report["selected_method_for_composition"])
        self.assertFalse(report["production_eligible"])
        self.assertFalse(report["composition_eligible"])
        refusal = report["typed_generation_refusal"]
        self.assertEqual(refusal["state"], "REFUSED_PRE_ADMISSION")
        self.assertEqual(refusal["stage"], "source-method-qualification")
        self.assertFalse(refusal["not_a_prism_guest_verdict"] is False)
        self.assertTrue(refusal["no_method_composed"])
        self.assertEqual(refusal["codes"], [
            "EVIDENCE_UNQUALIFIED", "RIGHTS_UNRESOLVED",
            "AUTHORITY_EXCEEDED", "OUTCOME_UNCOVERED"])

    def test_source_and_host_bound_into_distinct_receipt_digests(self):
        report = self.preflight()
        self.assertEqual(report["binding"]["snapshot_commit"], "a"*40)
        self.assertEqual(report["binding"]["snapshot_tree"], "b"*40)
        self.assertEqual(report["binding"]["governed_record_sha256"],
                         sha256(canonical(self.first)))
        self.assertEqual(report["binding_sha256"], sha256(canonical(report["binding"])))
        self.assertEqual(report["binding"]["requested_route"], "software-engineering/frontend")
        self.assertEqual(report["binding"]["requested_host_label_not_authority"], "ChatGPT")

    def test_rejected_governed_source_is_never_promoted_by_matching_bytes(self):
        selection = {"record_id": "governed:external/other",
                     "checkout": "/fixed/source", "repo_tree": "e"*40}
        report = self.preflight("governed:external/other", external_selection=selection)
        self.assertTrue(report["source_package_bytes_verified"])
        self.assertEqual(report["binding"]["review_status"], "rejected")
        self.assertEqual(report["additional_blockers"][0]["code"],
                         "STATIC_REVIEW_REJECTED")
        self.assertEqual(report["negative_test_vector_hex"], "00000000")
        self.assertFalse(report["composition_eligible"])

    def test_fake_rights_or_admission_in_source_is_never_honored(self):
        self.first["rights"]["package_redistribution_clearance"] = "approved"
        self.first["composition"]["eligibility"] = "eligible"
        report = self.preflight()
        self.assertFalse(report["operator_accepted_rights"])
        self.assertFalse(report["host_authority_verified"])
        self.assertFalse(report["composition_eligible"])
        self.assertEqual(report["negative_test_vector_hex"], "00000000")

    def test_missing_package_bytes_produce_typed_refusal_not_a_skill(self):
        def refused(*_args):
            raise Refusal("PACKAGE_BYTES", "source missing")
        report = prepare_preflight(
            self.graph, "software-engineering/frontend", "ChatGPT",
            "governed:first/example", package_inspector=refused)
        refusal = report["typed_generation_refusal"]
        self.assertEqual(refusal["state"], "REFUSED_PRE_ADMISSION")
        self.assertFalse(refusal["original_source_bytes_proven"])
        self.assertEqual(refusal["codes"][0], "SOURCE_PACKAGE_BYTES_UNVERIFIED")
        self.assertFalse(refusal["not_a_host_success_or_failure"] is False)
        self.assertTrue(refusal["no_method_composed"])

    def test_external_asset_review_digest_is_bound_without_rights_promotion(self):
        selection = {"record_id": "governed:external/other",
                     "checkout": "/fixed/source", "repo_tree": "e"*40}
        report = self.preflight("governed:external/other", external_selection=selection)
        self.assertRegex(report["binding"]["package_inspection_sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(report["source_package_bytes_verified"])
        self.assertFalse(report["operator_accepted_rights"])
        self.assertFalse(report["composition_eligible"])

    def test_asset_license_review_change_alters_prism_selection_binding(self):
        selection = {"record_id": "governed:external/other",
                     "checkout": "/fixed/source", "repo_tree": "e"*40}
        baseline = self.preflight("governed:external/other",
                                  external_selection=selection)["binding_sha256"]

        def missing_license(*args, **kwargs):
            value = self.inspect_external(*args, **kwargs)
            value["complete_package_reference_and_asset_review_queue"][
                "frontmatter_license_pointer"]["matched"] = []
            return value

        altered = prepare_preflight(
            self.graph, "software-engineering/frontend", "ChatGPT",
            "governed:external/other", external_selection=selection,
            package_inspector=self.inspect_first,
            external_inspector=missing_license)
        self.assertNotEqual(baseline, altered["binding_sha256"])
        self.assertFalse(altered["composition_eligible"])
        self.assertFalse(altered["operator_accepted_rights"])

    def test_source_content_mutation_changes_exact_selection_binding(self):
        old = self.preflight()["binding_sha256"]
        self.first["original_evidence"] = {"untrusted": "new note"}
        new = self.preflight()["binding_sha256"]
        self.assertNotEqual(old, new)

    def test_host_label_is_not_authority(self):
        report = self.preflight()
        self.assertEqual(report["binding"]["requested_host_label_not_authority"], "ChatGPT")
        self.assertFalse(report["host_authority_verified"])

    def test_name_only_or_wrong_route_cannot_be_selected(self):
        with self.assertRaises(Refusal) as e:
            self.preflight("governed:external/unknown")
        self.assertEqual(e.exception.code, "METHOD_SELECTION")

    def test_observation_cannot_impersonate_review(self):
        with self.assertRaises(Refusal) as e:
            self.preflight("observation:external/other")
        self.assertEqual(e.exception.code, "METHOD_SELECTION")

    def test_external_selection_must_equal_selected_method_even_in_direct_api(self):
        selection = {"record_id": "governed:external/other",
                     "checkout": "/fixed/source", "repo_tree": "e"*40}
        with self.assertRaises(Refusal) as e:
            self.preflight("governed:first/example", external_selection=selection)
        self.assertEqual(e.exception.code, "METHOD_SELECTION")

    def test_external_verifier_refusal_propagates(self):
        def blocked(*_args, **_kwargs):
            raise Refusal("EXTERNAL_BYTES", "tampered package")
        selection = {"record_id": "governed:external/other",
                     "checkout": "/fixed/source", "repo_tree": "e"*40}
        with self.assertRaises(Refusal) as e:
            prepare_preflight(
                self.graph, "software-engineering/frontend", "ChatGPT",
                "governed:external/other", external_selection=selection,
                package_inspector=self.inspect_first,
                external_inspector=blocked)
        self.assertEqual(e.exception.code, "EXTERNAL_BYTES")

    def test_missing_first_party_package_does_not_create_positive_facts(self):
        self.packages.clear()
        def refused(*_args):
            raise Refusal("PACKAGE_BYTES", "source lost")
        report = prepare_preflight(
            self.graph, "software-engineering/frontend", "ChatGPT",
            "governed:first/example", package_inspector=refused)
        self.assertFalse(report["source_package_bytes_verified"])
        self.assertEqual(report["negative_test_vector_hex"], "00000000")
        self.assertFalse(report["composition_eligible"])

    def test_missing_source_commit_refuses(self):
        self.graph.corpus.manifest["source"]["commit"] = "invalid"
        with self.assertRaises(Refusal) as e:
            self.preflight()
        self.assertEqual(e.exception.code, "METHOD_SOURCE")

    def test_unknown_host_refuses_before_any_guest_request(self):
        with self.assertRaises(Refusal) as e:
            prepare_preflight(
                self.graph, "software-engineering/frontend", "",
                "governed:first/example", package_inspector=self.inspect_first)
        self.assertEqual(e.exception.code, "HOST_REQUIRED")

    def test_unsigned_denial_does_not_implicitly_become_a_signature(self):
        report = self.preflight()
        self.assertFalse(report["independently_authenticated_method_assertion"])
        self.assertTrue(report["negative_test_vector_only_not_signed_assertion"])
        self.assertTrue(report["signed_claims_required_before_positive_guest_request"])
        self.assertIsNone(report["holo_sha256"])

    def test_original_static_review_retired_is_explicitly_blocked(self):
        self.first["review"]["semantic_status"] = "retired"
        report = self.preflight()
        self.assertEqual(report["additional_blockers"][0]["code"], "SOURCE_RETIRED")
        self.assertFalse(report["composition_eligible"])


if __name__ == "__main__":
    unittest.main()
