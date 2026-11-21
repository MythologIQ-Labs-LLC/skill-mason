"""Synthetic fail-closed corpus indexing tests. No external source or rights approval."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import (
    COMMIT, TREE, ORIGIN, Refusal, canonical, git_blob, inspect, sha256,
)
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph


def review(record_id, source_class, status, mapping):
    return {
        "schema_version": "skill-mason-catalog-record-v1",
        "record_id": record_id, "source_class": source_class,
        "review": {"semantic_status": status},
        "capability_mapping": {
            "state": mapping,
            "evidence_linked_paths": ["software-engineering/testing"]
            if mapping == "evidence-linked" else [],
            "name_only_hints": ["test"]},
        "rights": {"package_redistribution_clearance": "not-established-by-export"},
        "composition": {
            "eligibility": "not-assessed",
            "composable_method_contract": None,
            "export_is_not_admission_or_permission": True},
        "original_evidence": {"sentinel": "preserve even when rejected"}}


class Fixture:
    def __init__(self, home):
        self.handoff = home / "handoff"
        self.source = home / "source"
        self.handoff.mkdir()
        self.source.mkdir()
        self.records = [
            review("local-skills/alpha", "first-party", "verified", "evidence-linked"),
            review("external/beta", "third-party", "rejected", "unmapped")]
        self.paths = {}
        self.discovery_paths = ["registry/discovery/pointer-%03d.json" % i for i in range(170)]
        self.evidence_paths = ["registry/evidence/pointer-%04d.json" % i for i in range(2322)]
        self.g1_paths = ["registry/discovery/g%d.json" % i for i in range(14)]
        self.frontier_paths = ["registry/discovery/f%d.json" % i for i in range(4)]
        self.taxonomy = {
            "recognized": "registry/capability-directory.json",
            "prior_proposals": "registry/discovery/old-proposals.json",
            "new_proposals": "registry/proposed-extensions.json",
            "outcomes": "registry/capability-outcome-register.json"}
        self.first_party = ["skills/original/SKILL.md"]
        self.engine = ["engine/skills/internal/SKILL.md"]
        self.discovery = {
            "schema_version": "skill-mason-discovery-manifests-v1",
            "all_discovery_artifacts": self.discovery_paths,
            "all_evidence_artifacts": self.evidence_paths,
            "repository_entrypoints": {
                "first_party": self.first_party,
                "engine_maintenance_only": self.engine},
            "g1_g3_shards": [
                {"path": p, "record_count": 1, "records_pointer": "/records"}
                for p in self.g1_paths],
            "four_source_frontier": [
                {"source_id": "source-%d" % i, "manifest": p,
                 "record_count": 1,
                 "parts": [{"path": p, "record_count": 1, "records_pointer": "/entries"}]}
                for i, p in enumerate(self.frontier_paths)]}
        for path in (self.discovery_paths + self.evidence_paths +
                     list(self.taxonomy.values()) + self.first_party + self.engine):
            self.paths[path] = b"x"
        for i, path in enumerate(self.g1_paths):
            self.paths[path] = canonical({"records": [
                {"repository": "example/team", "pinned_revision": "a" * 40,
                 "path": "skills/lexical-example-%d/SKILL.md" % i,
                 "package_tree": "%040x" % i, "heuristic_domain": "unclassified"}]})
        for i, path in enumerate(self.frontier_paths):
            self.paths[path] = canonical({
                "source_id": "source-%d" % i,
                "entry_encoding": "[path, skill blob SHA, tree SHA, size, structural shape]",
                "entries": [["skills/four-family-%d/SKILL.md" % i,
                             "b" * 40, "c" * 40, 500, "direct-shape"]]})
        self.persist()

    def persist(self):
        for path, blob in self.paths.items():
            p = self.source / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(blob)
        self.manifest = {
            "schema_version": "skill-mason-catalog-manifest-v1",
            "source": {"repository": ORIGIN, "commit": COMMIT, "git_tree_sha1": TREE},
            "readiness": {
                "composition_eligibility": "requires-independent-target-specific-assessment"},
            "taxonomy": self.taxonomy,
            "artifacts": [],
            "source_files": [
                {"path": path, "bytes": len(blob), "sha256": sha256(blob),
                 "git_blob_sha1": git_blob(blob)}
                for path, blob in sorted(self.paths.items())],
            "submodule_pins": [],
            "counts": {
                "first_party": 1, "third_party": 1, "governed_records": 2,
                "mapped": 1, "unmapped": 1,
                "semantic_states": {"verified": 1, "rejected": 1},
                "source_files": len(self.paths), "submodule_pins": 0,
                "discovery_artifacts": 170,
                "g1_g3_observations": 14, "four_source_paths": 4}}
        data = {
            "governed.ndjson": b"".join(canonical(r) for r in self.records),
            "discovery-manifests.json": canonical(self.discovery)}
        for name, blob in sorted(data.items()):
            (self.handoff / name).write_bytes(blob)
            self.manifest["artifacts"].append({
                "path": name, "bytes": len(blob), "sha256": sha256(blob)})
        raw = canonical(self.manifest)
        (self.handoff / "manifest.json").write_bytes(raw)
        self.pin = git_blob(raw)

    def index(self):
        def inspector(handoff):
            return inspect(handoff, manifest_pin=self.pin)

        def verifier(_source, manifest):
            return {
                "source_commit": COMMIT, "source_tree": TREE,
                "file_sha256_verified": manifest["counts"]["source_files"],
                "gitlinks_verified": 0,
                "source_rights_assessed": False, "composition_eligible": False}
        return CorpusIndex(self.handoff, self.source, inspector=inspector,
                           source_verifier=verifier)


class CorpusIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.temp.name))

    def tearDown(self):
        self.temp.cleanup()

    def refuses(self, code):
        with self.assertRaises(Refusal) as ex:
            self.fx.index()
        self.assertEqual(ex.exception.code, code)

    def test_lossless_review_and_all_observation_families(self):
        index = self.fx.index()
        report = index.summary()
        self.assertEqual(report["total_index_rows_not_unique_skills"], 20)
        self.assertEqual((report["governed"], report["g1_g3_path_observations"],
                          report["four_source_path_observations"]), (2, 14, 4))
        self.assertEqual((report["discovery_artifact_pointers"],
                          report["evidence_artifact_pointers"]), (170, 2322))
        self.assertEqual(report["governed_unmapped"], 1)
        self.assertEqual(report["first_party_entrypoints"], 1)
        self.assertEqual(report["engine_maintenance_entrypoints_separate"], 1)
        self.assertFalse(report["composition_eligible"])
        self.assertFalse(report["rights_assessed"])
        self.assertFalse(report["behaviorally_validated"])

    def test_rejected_and_unmapped_record_retains_original_data(self):
        index = self.fx.index()
        result = index.search("preserve", family="governed", limit=1)
        self.assertEqual(result["total_matches"], 2)
        self.assertTrue(result["truncated"])
        item = index.record("governed:external/beta")
        self.assertEqual(item["review_status"], "rejected")
        self.assertEqual(item["mapping_state"], "unmapped")
        self.assertEqual(item["raw"]["original_evidence"]["sentinel"],
                         "preserve even when rejected")
        self.assertEqual(item["composition_eligibility"], "not-assessed")

    def test_raw_metadata_key_traps_do_not_fabricate_governed_leads(self):
        index = self.fx.index()
        for query in ("record_id", "original_evidence", "semantic_status",
                      "evidence_linked_paths", "name_only_hints"):
            with self.subTest(query=query):
                self.assertEqual(index.search(query, family="governed")["total_matches"], 0)
        self.assertEqual(index.search("preserve", family="governed")["total_matches"], 2)
        self.assertEqual(index.search("external beta", family="governed")["total_matches"], 1)

    def test_raw_values_require_complete_words_not_substrings(self):
        index = self.fx.index()
        for query in ("reje", "preser", "beta123", "__ / --"):
            if query == "__ / --":
                with self.assertRaises(Refusal) as error:
                    index.search(query)
                self.assertEqual(error.exception.code, "QUERY_REQUIRED")
            else:
                self.assertEqual(index.search(query)["total_matches"], 0)
        self.assertEqual(index.search("LEXICAL_EXAMPLE", family="g1-g3")["total_matches"], 14)
        self.assertFalse(index.search("lexical-example", family="g1-g3")["composition_eligible"])

    def test_retrieval_covers_shards_without_promoting_lexical_leads(self):
        index = self.fx.index()
        leads = index.search("lexical-example", family="g1-g3")
        self.assertEqual(leads["total_matches"], 14)
        self.assertFalse(leads["outcome_coverage_assessed"])
        four = index.search("four-family", family="four-source")
        self.assertEqual(four["total_matches"], 4)
        self.assertEqual(four["results"][0]["source_id"], "source-0")
        item = index.record(four["results"][0]["id"])
        self.assertEqual(len(item["raw"]), 5)
        self.assertTrue(item["pointer"].startswith("/entries/"))

    def test_referenced_artifact_is_pinned_and_not_a_rights_grant(self):
        index = self.fx.index()
        got = index.artifact(self.fx.taxonomy["recognized"])
        self.assertEqual(got["sha256"], sha256(b"x"))
        self.assertTrue(got["reference_only"])
        with self.assertRaises(Refusal) as ex:
            index.artifact("../outside")
        self.assertEqual(ex.exception.code, "UNKNOWN_ARTIFACT")

    def test_fail_closed_missing_declared_pointer(self):
        self.fx.discovery["all_discovery_artifacts"][0] = "not/in/source.json"
        self.fx.persist()
        self.refuses("MISSING_REFERENCE")

    def test_fail_closed_shadowed_shard_content(self):
        path = self.fx.g1_paths[0]
        original = (self.fx.source / path).read_bytes()
        (self.fx.source / path).write_bytes(original.replace(b"lexical-example", b"lexical-examplf"))
        self.refuses("SOURCE_SHA256")

    def test_fail_closed_truncated_shard_with_recomputed_digest(self):
        path = self.fx.g1_paths[0]
        self.fx.paths[path] = canonical({"records": []})
        self.fx.persist()
        self.refuses("COUNT_MISMATCH")

    def test_fail_closed_no_silent_frontier_omission(self):
        self.fx.discovery["four_source_frontier"].pop()
        self.fx.persist()
        self.refuses("SHARD_SCHEMA")

    def test_fail_closed_corrupt_handoff_record(self):
        path = self.fx.handoff / "governed.ndjson"
        path.write_bytes(path.read_bytes().replace(b"rejected", b"verified"))
        self.refuses("ARTIFACT_INTEGRITY")

    def test_every_manifest_pointer_family_is_searchable_without_admission(self):
        index = self.fx.index()
        evidence = index.search_references("pointer", kind="evidence", limit=2)
        self.assertEqual(evidence["total_matches"], 2322)
        self.assertEqual(len(evidence["results"]), 2)
        self.assertTrue(evidence["truncated"])
        self.assertFalse(evidence["method_eligibility_assessed"])
        self.assertTrue(all(row["role_only_not_an_admitted_skill"]
                            for row in evidence["results"]))
        discovery = index.search_references("pointer", kind="discovery", limit=1)
        self.assertEqual(discovery["total_matches"], 170)
        first_party = index.search_references("original", kind="first-party")
        self.assertEqual(first_party["total_matches"], 1)
        taxonomy = index.search_references("capability", kind="taxonomy")
        self.assertGreaterEqual(taxonomy["total_matches"], 2)
        self.assertEqual(index.search_references("no-such-path")["total_matches"], 0)

    def test_required_lexical_query_and_bounds(self):
        index = self.fx.index()
        for query, limit, code in [("", 25, "QUERY_REQUIRED"),
                                   ("test", 201, "QUERY_LIMIT")]:
            with self.assertRaises(Refusal) as ex:
                index.search(query, limit=limit)
            self.assertEqual(ex.exception.code, code)

    def test_source_verifier_cannot_claim_rights(self):
        def wrong_verifier(source, manifest):
            return {"source_commit": COMMIT, "source_tree": TREE,
                    "file_sha256_verified": len(manifest["source_files"]),
                    "gitlinks_verified": 0, "source_rights_assessed": True,
                    "composition_eligible": True}
        with self.assertRaises(Refusal) as ex:
            CorpusIndex(self.fx.handoff, self.fx.source,
                        inspector=lambda p: inspect(p, manifest_pin=self.fx.pin),
                        source_verifier=wrong_verifier)
        self.assertEqual(ex.exception.code, "SOURCE_INTEGRITY")


class CapabilityGraphTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.temp.name))
        self.domains = []
        self.outcomes = []
        for i in range(33):
            domain_id = "software-engineering" if i == 0 else "domain-%d" % i
            subdomains = []
            for j in range(8 if i < 16 else 7):
                sub_id = "testing" if i == 0 and j == 0 else "sub-%d" % j
                route = domain_id + "/" + sub_id
                subdomains.append({
                    "id": sub_id, "name": "Test route %d %d" % (i, j),
                    "matched_skill_ids": ["local-skills/alpha"] if i == 0 and j == 0 else [],
                    "name_only_review_candidate_ids": ["external/beta"] if i == 0 and j == 0 else []})
                self.outcomes.append({
                    "path": route, "outcome_definition_status": "needs-workflow-decomposition",
                    "essential_outcomes": [], "existing_capability_statements": [],
                    "qualified_essential_outcome_count": None,
                    "qualification_status": "not-established-from-navigation-links"})
            self.domains.append({"id": domain_id, "name": "Domain %d" % i, "subdomains": subdomains})
        self.write_sources()

    def tearDown(self):
        self.temp.cleanup()

    def write_sources(self):
        self.fx.paths[self.fx.taxonomy["recognized"]] = canonical({"domains": self.domains})
        self.fx.paths[self.fx.taxonomy["outcomes"]] = canonical({"rows": self.outcomes})
        self.fx.paths[self.fx.taxonomy["prior_proposals"]] = canonical({"domains": [
            {"id": "provisional-only"}]})
        self.fx.paths[self.fx.taxonomy["new_proposals"]] = canonical({"domains": [
            {"id": "proposed-only", "status": "proposed-needs-qualification"}]})
        self.fx.persist()

    def graph(self):
        return CapabilityGraph(self.fx.index())

    def test_complete_recognized_graph_and_unknown_outcome_denominator(self):
        g = self.graph()
        s = g.summary()
        self.assertEqual((s["recognized_domains"], s["recognized_subdomains"]), (33, 247))
        self.assertEqual(s["evidence_mapped_governed_identities"], 1)
        self.assertEqual(s["outcome_definitions_missing"], 247)
        self.assertEqual(s["unqualified_or_unknown_outcome_routes"], 247)
        self.assertEqual(s["discovery_path_observations_without_governed_crosswalk"], 18)
        self.assertFalse(s["composition_eligible"])
        self.assertTrue(s["unmapped_does_not_mean_absent"])

    def test_matched_and_name_only_are_not_permissions_or_verified_outcomes(self):
        g = self.graph()
        row = g.show("software-engineering/testing")
        self.assertEqual(len(row["evidence_linked_reviews"]), 1)
        self.assertEqual(row["evidence_linked_reviews"][0]["record_id"], "local-skills/alpha")
        self.assertEqual(row["evidence_linked_reviews"][0]["review_status"], "verified")
        self.assertEqual(row["evidence_linked_reviews"][0]["rights_clearance"], "not-established")
        self.assertEqual(row["name_only_review_leads_not_qualified"], ["external/beta"])
        self.assertTrue(row["explicit_gaps"]["needs_workflow_decomposition"])
        self.assertIsNone(row["qualified_essential_outcome_count"])
        self.assertFalse(row["composition_eligible"])

    def test_defined_but_not_qualified_outcome_remains_a_gap(self):
        self.outcomes[0]["essential_outcomes"] = [{"expected_output": "audit receipt"}]
        self.outcomes[0]["outcome_definition_status"] = "defined-not-qualified"
        self.write_sources()
        row = self.graph().show("software-engineering/testing")
        self.assertFalse(row["explicit_gaps"]["needs_workflow_decomposition"])
        self.assertIsNone(row["qualified_essential_outcome_count"])
        self.assertFalse(row["composition_eligible"])

    def test_recognized_search_and_proposals_remain_separate(self):
        g = self.graph()
        results = g.search("software-engineering/testing")
        self.assertEqual(results["total_matches"], 1)
        self.assertTrue(results["unmapped_or_unreviewed_methods_not_proven_absent"])
        with self.assertRaises(Refusal) as exc:
            g.show("proposed-only/unknown")
        self.assertEqual(exc.exception.code, "UNRECOGNIZED_CAPABILITY")
        self.assertIn("new_proposals", g.summary()["proposals_are_separate"])

    def test_mapped_record_crosswalk_drift_refuses(self):
        self.fx.records[0]["capability_mapping"]["evidence_linked_paths"] = ["software-engineering/other"]
        self.write_sources()
        with self.assertRaises(Refusal) as exc:
            self.graph()
        self.assertEqual(exc.exception.code, "CROSSWALK_DRIFT")

    def test_missing_outcome_refuses_instead_of_implicitly_qualifying(self):
        self.outcomes.pop()
        self.write_sources()
        with self.assertRaises(Refusal) as exc:
            self.graph()
        self.assertEqual(exc.exception.code, "CAPABILITY_COUNT")



if __name__ == "__main__":
    unittest.main()
