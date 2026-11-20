"""Realistic synthetic C3/C4 source-reference dossiers and adversarial denial tests.

No external source is executed or assigned rights. The pinned-source CI job
separately exercises the same command against the actual Skillz checkout.
"""
from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import COMMIT, Refusal, canonical, git_blob, sha256
from scripts.capability_graph import CapabilityGraph
from scripts.corpus_reference_dossier import reference_dossier, first_party_reference_inventory, SCHEMA, SOURCE_URL
from scripts.package_resolver import inspect_package
from test_catalog_index import Fixture

ROUTE = "software-engineering/testing"
METHOD = "governed:local-skills/alpha"
ROOT = "skills/original/"
TEXT = b"# Original method\nReview exact evidence.\nNo execution authority.\n[guide](references/guide.md)\n"
GUIDE = b"# Guide\nOnly source material.\n"


class ReferenceDossierTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.fx = Fixture(Path(self.tmp.name))
        self.fx.paths[ROOT + "SKILL.md"] = TEXT
        self.fx.paths[ROOT + "references/guide.md"] = GUIDE
        files = [
            {"path": "SKILL.md", "sha256": sha256(TEXT)},
            {"path": "references/guide.md", "sha256": sha256(GUIDE)},
        ]
        row = self.fx.records[0]
        row["identity"] = {
            "local_package": {"algorithm": "sha256-of-canonical-file-list-v1",
                              "sha256": sha256(canonical(files)), "files": files},
            "entrypoint_git_blob_sha1": git_blob(TEXT),
            "package_git_tree_sha1": "f" * 40,
        }
        row["origin"] = {"first_party_snapshot_pin": COMMIT}
        row["freshness"] = {"local_entrypoint_review_match": "match"}
        row["operation"] = {"recorded_authority": "unverified"}
        row["rights"]["recorded_license"] = "recorded, not proven"
        self.fx.persist()
        self.set_routes()

    def set_routes(self):
        domains, outcomes = [], []
        for i in range(33):
            domain = "software-engineering" if i == 0 else "domain-" + str(i)
            subs = []
            for j in range(8 if i < 16 else 7):
                sub = "testing" if i == 0 and j == 0 else "sub-" + str(j)
                route = domain + "/" + sub
                subs.append({"id": sub, "name": sub,
                             "matched_skill_ids": ["local-skills/alpha"]
                             if route == ROUTE else [],
                             "name_only_review_candidate_ids": ["external/beta"]
                             if route == ROUTE else []})
                outcomes.append({"path": route, "essential_outcomes": [],
                                 "outcome_definition_status": "needs-workflow-decomposition",
                                 "qualified_essential_outcome_count": None})
            domains.append({"id": domain, "name": domain, "subdomains": subs})
        self.fx.paths[self.fx.taxonomy["recognized"]] = canonical({"domains": domains})
        self.fx.paths[self.fx.taxonomy["outcomes"]] = canonical({"rows": outcomes})
        self.fx.paths[self.fx.taxonomy["prior_proposals"]] = canonical({"domains": []})
        self.fx.paths[self.fx.taxonomy["new_proposals"]] = canonical({"domains": []})
        self.fx.persist()

    @staticmethod
    def tree(_checkout, root):
        assert root == ROOT.rstrip("/")
        return "f" * 40

    def inspect(self, corpus, method):
        return inspect_package(corpus, method, tree_oid=self.tree)

    def dossier(self, **kwargs):
        return reference_dossier(CapabilityGraph(self.fx.index()), ROUTE,
                                 inspector=self.inspect, **kwargs)

    def refuses(self, code, **kwargs):
        with self.assertRaises(Refusal) as exc:
            self.dossier(**kwargs)
        self.assertEqual(exc.exception.code, code)

    def test_exact_original_first_party_package_is_a_reusable_reference_pointer(self):
        result = self.dossier()
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["state"], "SOURCE_REFERENCE_MATERIAL_FOR_HUMAN_QUALIFICATION")
        self.assertEqual(result["linked_governed_review_count"], 1)
        self.assertEqual(result["name_only_review_leads_not_source_evidence"], ["external/beta"])
        row = result["candidates"][0]
        self.assertEqual(row["governed_review_id"], METHOD)
        self.assertEqual(row["recorded_static_review"], "verified")
        self.assertEqual(row["inspection_state"], "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED")
        package = row["original_package"]
        self.assertEqual(package["entrypoint_url"], SOURCE_URL + ROOT + "SKILL.md")
        self.assertEqual(package["entrypoint_git_blob_sha1"], git_blob(TEXT))
        self.assertEqual([f["path"] for f in package["file_paths_and_sha256"]],
                         ["SKILL.md", "references/guide.md"])
        self.assertEqual(package["package_file_count"], 2)
        self.assertEqual(package["inline_reference_leads_not_dependency_closure"]
                         ["unresolved_within_package"], [])
        self.assertFalse(package["full_dependency_closure_proven"])
        self.assertFalse(package["redistribution_rights_proven"])
        self.assertIsNone(result["original_source_citation"])
        self.assertIsNone(result["method_selected_for_composition"])
        for key in ("rights_qualified", "host_validated",
                    "outcome_coverage_qualified", "prism_invoked",
                    "composition_eligible", "production_eligible"):
            self.assertIs(result[key], False)
        self.assertEqual(canonical(result), canonical(self.dossier()))

    def test_quoted_original_line_range_is_byte_and_git_bound(self):
        report = self.dossier(governed_method=METHOD,
                              citation=("SKILL.md", 2, 3))
        quoted = report["original_source_citation"]
        excerpt = "Review exact evidence.\nNo execution authority.\n"
        self.assertEqual(quoted["exact_original_lines_for_human_review"], excerpt)
        self.assertEqual(quoted["exact_source_excerpt_sha256"], sha256(excerpt.encode()))
        self.assertEqual(quoted["source_file_sha256"], sha256(TEXT))
        self.assertEqual(quoted["source_file_git_blob_sha1"], git_blob(TEXT))
        self.assertEqual(quoted["source_url"], SOURCE_URL + ROOT + "SKILL.md#L2-L3")
        self.assertFalse(report["outcome_coverage_qualified"])

    def test_nested_asset_is_citable_only_when_in_verified_complete_package(self):
        result = self.dossier(governed_method=METHOD,
                              citation=("references/guide.md", 1, 2))
        self.assertIn("Only source material.", result["original_source_citation"]
                      ["exact_original_lines_for_human_review"])
        self.refuses("CITATION_RANGE", governed_method=METHOD,
                     citation=("../other/SKILL.md", 1, 1))
        self.refuses("CITATION_RANGE", governed_method=METHOD,
                     citation=("SKILL.md", 0, 1))
        self.refuses("CITATION_RANGE", governed_method=METHOD,
                     citation=("SKILL.md", 3, 2))
        self.refuses("CITATION_RANGE", governed_method=METHOD,
                     citation=("SKILL.md", 3, 100))

    def test_unknown_unlinked_and_name_only_methods_cannot_be_quoted(self):
        self.refuses("METHOD_SELECTION", governed_method="governed:external/beta")
        self.refuses("METHOD_SELECTION", governed_method="governed:unmapped/method")
        self.refuses("METHOD_SELECTION", governed_method="local-skills/alpha")
        self.refuses("CITATION_SELECTION",
                     citation=("SKILL.md", 1, 1))
        with self.assertRaises(Refusal) as exc:
            reference_dossier(CapabilityGraph(self.fx.index()), "nonexistent/route",
                              inspector=self.inspect)
        self.assertEqual(exc.exception.code, "UNKNOWN_ROUTE")

    def test_excerpt_missing_or_changed_original_bytes_refuses(self):
        self.fx.source.joinpath(ROOT + "SKILL.md").write_bytes(
            TEXT.replace(b"exact", b"false"))
        self.refuses("SOURCE_SHA256", governed_method=METHOD,
                     citation=("SKILL.md", 2, 3))

    def test_forged_package_rights_or_source_identity_is_rejected(self):
        original = self.inspect
        for key, value in (("rights_assessed", True),
                           ("composition_eligible", True),
                           ("method_contract_qualified", True),
                           ("original_snapshot_commit", "0" * 40),
                           ("record_id", "other/record")):
            with self.subTest(key=key):
                def bad(corpus, method):
                    package = deepcopy(original(corpus, method))
                    package[key] = value
                    return package
                with self.assertRaises(Refusal) as exc:
                    reference_dossier(CapabilityGraph(self.fx.index()), ROUTE,
                                      governed_method=METHOD, inspector=bad)
                self.assertEqual(exc.exception.code, "PACKAGE_INTEGRITY")

    def test_missing_original_package_does_not_disappear_or_get_qualified(self):
        def missing(_corpus, _method):
            raise Refusal("PACKAGE_ROOT", "missing source")
        result = reference_dossier(CapabilityGraph(self.fx.index()), ROUTE,
                                   inspector=missing)
        self.assertEqual(result["linked_governed_review_count"], 1)
        self.assertEqual(result["candidates"][0]["inspection_state"],
                         "FIRST_PARTY_INSPECTION_REFUSED")
        self.assertEqual(result["candidates"][0]["source_refusal_code"], "PACKAGE_ROOT")
        with self.assertRaises(Refusal) as exc:
            reference_dossier(CapabilityGraph(self.fx.index()), ROUTE,
                              governed_method=METHOD, inspector=missing)
        self.assertEqual(exc.exception.code, "PACKAGE_ROOT")

    def test_review_status_changes_do_not_upgrade_a_source_citation(self):
        graph = CapabilityGraph(self.fx.index())
        graph.corpus.by_id[METHOD]["raw"]["review"]["semantic_status"] = "rejected"
        out = reference_dossier(graph, ROUTE, governed_method=METHOD,
                               citation=("SKILL.md", 1, 2), inspector=self.inspect)
        self.assertEqual(out["candidates"][0]["recorded_static_review"], "rejected")
        self.assertFalse(out["composition_eligible"])
        graph.corpus.manifest["source"]["commit"] = "0" * 40
        with self.assertRaises(Refusal) as exc:
            reference_dossier(graph, ROUTE, inspector=self.inspect)
        self.assertEqual(exc.exception.code, "SOURCE_PIN")


    def test_all_first_party_original_references_are_exposed_for_review(self):
        queue = first_party_reference_inventory(CapabilityGraph(self.fx.index()),
                                                inspector=self.inspect)
        self.assertEqual(queue["schema"], "qortara/first-party-source-reference-inventory/1")
        self.assertEqual(queue["state"], "FULL_PINNED_FIRST_PARTY_SOURCE_REVIEW_QUEUE")
        self.assertEqual(queue["total_original_first_party_review_records"], 1)
        self.assertEqual(queue["route_linked_record_count"], 1)
        self.assertEqual(queue["unmapped_review_record_count"], 0)
        self.assertEqual(queue["source_package_inspection_counts"],
                         {"PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED": 1})
        self.assertTrue(queue["all_pinned_first_party_review_records_retained"])
        row = queue["original_source_reference_records"][0]
        self.assertEqual(row["governed_review_id"], METHOD)
        self.assertEqual(row["evidence_linked_route_paths"], [ROUTE])
        self.assertEqual(row["original_entrypoint_url"], SOURCE_URL + ROOT + "SKILL.md")
        self.assertEqual(row["original_entrypoint_sha256"], sha256(TEXT))
        self.assertEqual(row["package_file_count"], 2)
        self.assertEqual(row["next_qualification_action"], "REVIEW_OUTCOME_FIT_AND_SOURCE_RIGHTS")
        self.assertFalse(queue["production_eligible"])
        self.assertFalse(row["rights_assessed"])
        self.assertEqual(canonical(queue),
                         canonical(first_party_reference_inventory(
                             CapabilityGraph(self.fx.index()), inspector=self.inspect)))

    def test_unmapped_original_review_still_entered_in_method_scope_queue(self):
        graph = CapabilityGraph(self.fx.index())
        graph.paths[ROUTE]["matched"] = []
        graph.corpus.by_id[METHOD]["raw"]["capability_mapping"]["evidence_linked_paths"] = []
        queue = first_party_reference_inventory(graph, inspector=self.inspect)
        self.assertEqual(queue["unmapped_review_record_count"], 1)
        self.assertEqual(queue["route_linked_record_count"], 0)
        row = queue["original_source_reference_records"][0]
        self.assertEqual(row["evidence_linked_route_paths"], [])
        self.assertEqual(row["next_qualification_action"],
                         "REVIEW_ORIGINAL_METHOD_SCOPE_AND_CREATE_EVIDENCE_CROSSWALK")
        self.assertEqual(row["package_inspection"],
                         "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED")
        self.assertFalse(queue["outcome_coverage_qualified"])

    def test_source_integrity_refusal_is_counted_not_silently_discarded(self):
        def missing(_corpus, _method):
            raise Refusal("PACKAGE_TREE_DRIFT", "source tree does not match")
        result = first_party_reference_inventory(CapabilityGraph(self.fx.index()),
                                                 inspector=missing)
        self.assertEqual(result["source_package_inspection_counts"], {"REFUSED": 1})
        row = result["original_source_reference_records"][0]
        self.assertEqual(row["package_refusal_code"], "PACKAGE_TREE_DRIFT")
        self.assertEqual(row["next_qualification_action"], "REPAIR_SOURCE_INTEGRITY_FIRST")
        self.assertIsNone(row["original_entrypoint_url"])
        self.assertFalse(result["composition_eligible"])

    def test_forged_inventory_approval_becomes_explicit_source_refusal(self):
        def overpromote(corpus, method):
            altered = self.inspect(corpus, method)
            altered["rights_assessed"] = True
            return altered
        queue = first_party_reference_inventory(CapabilityGraph(self.fx.index()),
                                                inspector=overpromote)
        row = queue["original_source_reference_records"][0]
        self.assertEqual(row["package_refusal_code"], "PACKAGE_INTEGRITY")
        self.assertEqual(row["next_qualification_action"], "REPAIR_SOURCE_INTEGRITY_FIRST")
        self.assertFalse(queue["rights_qualified"])

    def test_inventory_refuses_fake_denominator_or_crosswalk_drift(self):
        graph = CapabilityGraph(self.fx.index())
        graph.corpus.manifest["counts"]["first_party"] = 2
        with self.assertRaises(Refusal) as exc:
            first_party_reference_inventory(graph, inspector=self.inspect)
        self.assertEqual(exc.exception.code, "REFERENCE_COUNT")
        graph = CapabilityGraph(self.fx.index())
        graph.corpus.by_id[METHOD]["raw"]["capability_mapping"]["evidence_linked_paths"] = [
            "unknown/route"]
        with self.assertRaises(Refusal) as exc:
            first_party_reference_inventory(graph, inspector=self.inspect)
        self.assertEqual(exc.exception.code, "CROSSWALK_DRIFT")


if __name__ == "__main__":
    unittest.main()
