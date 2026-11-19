"""Gherkin adverse controls for the source-to-workflow negative scope receipt."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

from scripts.catalog_handoff import COMMIT, TREE, Refusal, git_blob, sha256, canonical
from scripts.source_outcome_scope_review import assess_scope, DISPOSITION, SCHEMA

ROOT = Path(__file__).resolve().parents[1]
NOTE = ROOT / "docs/evidence/source-outcome-scope-mcp-vetting-v1.json"
PATH = "skills/mcp-vetting/SKILL.md"
RID = "local-skills/mcp-vetting"
ROUTE = "security/supply-chain"


class SourceOutcomeScopeTests(unittest.TestCase):
    def setUp(self):
        self.review = json.loads(NOTE.read_text(encoding="utf-8"))
        self.original = ("\n".join(x["exact_source_excerpt"]
                                   for x in self.review["evidence"]) + "\n").encode()
        self.package = {
            "state": "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
            "record_id": RID, "original_snapshot_commit": COMMIT,
            "source_root": "skills/mcp-vetting/",
            "package_file_list_sha256": "a" * 64,
            "files": [{"path": "SKILL.md",
                       "sha256": sha256(self.original),
                       "git_blob_sha1": git_blob(self.original)}],
            "independently_verified_publisher": False,
            "rights_assessed": False,
            "composition_eligible": False,
            "method_contract_qualified": False,
        }
        self.review["source_git_blob_sha1"] = git_blob(self.original)
        self.corpus = SimpleNamespace(
            manifest={"source": {"commit": COMMIT, "git_tree_sha1": TREE}},
            first_party_paths=[PATH],
            by_id={"governed:" + RID: {"family": "governed",
                                      "source_class": "first-party",
                                      "review_status": "verified",
                                      "raw": {"record_id": RID}}},
            _raw_source=lambda path: self.original if path == PATH else None,
        )
        self.graph = SimpleNamespace(corpus=self.corpus,
                                     paths={ROUTE: {"matched": [RID]}})
        self.proposals = {ROUTE: {
            "proposal_status": "DRAFT_NOT_GOVERNED",
            "objective": self.review["proposal_objective"]}}

    def evaluate(self, **changes):
        options = {
            "graph": self.graph, "proposals": self.proposals,
            "review": self.review, "inspector": lambda *args: self.package}
        options.update(changes)
        return assess_scope(**options)

    def veto(self, code, **changes):
        with self.assertRaises(Refusal) as exc:
            self.evaluate(**changes)
        self.assertEqual(exc.exception.code, code)

    def test_gherkin_exact_source_scope_gap_is_explained_not_admitted(self):
        result = self.evaluate()
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["reviewer_observation_disposition_not_independent_qualification"],
                         DISPOSITION)
        self.assertEqual(result["entrypoint_sha256"], sha256(self.original))
        self.assertEqual(result["proposal_sha256"], sha256(canonical(self.proposals[ROUTE])))
        self.assertEqual(result["review_sha256"], sha256(canonical(self.review)))
        self.assertEqual(result["source_scope_observations"][0]["source_char_offset"], 0)
        self.assertEqual(len(result["unestablished_requested_outcomes"]), 3)
        for key in ("rights_qualified", "host_validated", "composition_eligible",
                    "composer_invoked", "prism_invoked", "outcome_coverage_qualified"):
            self.assertIs(result[key], False)
        self.assertTrue(result["rights_and_authorship_not_proven_by_repo_possession"])
        self.assertEqual(canonical(result), canonical(self.evaluate()))

    def test_gherkin_source_bytes_modified_after_package_inspection(self):
        self.original += b"unauthorized update"
        self.veto("SCOPE_SOURCE_BYTES")

    def test_gherkin_original_quoted_evidence_not_present(self):
        self.original = self.original.replace(
            b"Review a proposed MCP server", b"Review every software release")
        self.package["files"][0]["sha256"] = sha256(self.original)
        self.package["files"][0]["git_blob_sha1"] = git_blob(self.original)
        self.review["source_git_blob_sha1"] = git_blob(self.original)
        self.veto("SCOPE_EXCERPT")

    def test_gherkin_repeated_evidence_is_ambiguous(self):
        self.original += self.review["evidence"][0]["exact_source_excerpt"].encode()
        self.package["files"][0]["sha256"] = sha256(self.original)
        self.package["files"][0]["git_blob_sha1"] = git_blob(self.original)
        self.review["source_git_blob_sha1"] = git_blob(self.original)
        self.veto("SCOPE_EXCERPT")

    def test_gherkin_unlinked_method_or_wrong_governed_record_refuses(self):
        self.graph.paths[ROUTE]["matched"] = []
        self.veto("SCOPE_CROSSWALK")
        self.graph.paths[ROUTE]["matched"] = [RID]
        self.corpus.by_id.clear()
        self.veto("SCOPE_REVIEW_ID")

    def test_gherkin_proposal_drift_does_not_upgrade_coverage(self):
        self.proposals[ROUTE]["objective"] = "Different purpose"
        self.veto("SCOPE_PROPOSAL_DRIFT")
        self.proposals[ROUTE]["objective"] = self.review["proposal_objective"]
        self.proposals[ROUTE]["proposal_status"] = "ACCEPTED"
        self.veto("SCOPE_PROPOSAL_DRIFT")

    def test_gherkin_mismatched_original_snapshot_refuses(self):
        self.review["source_commit"] = "f" * 40
        self.veto("SCOPE_SOURCE_PIN")
        self.review["source_commit"] = COMMIT
        self.corpus.manifest["source"]["git_tree_sha1"] = "f" * 40
        self.veto("SCOPE_SOURCE_PIN")

    def test_gherkin_rights_or_positive_claim_cannot_be_smuggled_into_review(self):
        for key, value in (("rights_qualified", True), ("host_validated", True),
                           ("composition_eligible", True),
                           ("disposition", "ELIGIBLE")):
            with self.subTest(key=key):
                altered = deepcopy(self.review)
                altered[key] = value
                self.veto("SCOPE_AUTHORITY", review=altered)

    def test_gherkin_external_source_inspector_cannot_auto_admit(self):
        for key in ("rights_assessed", "composition_eligible",
                    "independently_verified_publisher", "method_contract_qualified"):
            with self.subTest(key=key):
                modified = deepcopy(self.package)
                modified[key] = True
                self.veto("SCOPE_PACKAGE", inspector=lambda *args: modified)

    def test_gherkin_package_method_and_entrypoint_must_match(self):
        self.package["record_id"] = "different/id"
        self.veto("SCOPE_PACKAGE")
        self.package["record_id"] = RID
        self.review["source_entrypoint"] = "skills/other/SKILL.md"
        self.veto("SCOPE_ENTRYPOINT")

    def test_gherkin_entrypoint_git_blob_cannot_be_substituted(self):
        self.review["source_git_blob_sha1"] = "0" * 40
        self.veto("SCOPE_ENTRYPOINT")

    def test_gherkin_review_qualifier_must_remain_negative_only(self):
        self.review["evidence"].append(deepcopy(self.review["evidence"][0]))
        self.veto("SCOPE_EVIDENCE")
        self.review["evidence"].pop()
        self.review["unestablished_outcomes"] = []
        self.veto("SCOPE_GAP")

    def test_gherkin_unknown_extra_review_field_fails_closed(self):
        self.review["positive_approval"] = True
        self.veto("SCOPE_SCHEMA")


if __name__ == "__main__":
    unittest.main()
