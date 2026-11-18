"""Adversarial C3 first-party package inspection. No real skill is executed."""
import copy
from pathlib import Path
import tempfile
import unittest

from scripts.catalog_handoff import COMMIT, Refusal, canonical, git_blob, sha256
from scripts.package_resolver import inspect_package, scan_first_party
from test_catalog_index import Fixture


class PackageInspectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.tmp.name))
        self.entrypoint = "skills/original/SKILL.md"
        self.extra = "skills/original/references/guide.md"
        self.fx.paths[self.entrypoint] = b"# Sample\n[guide](references/guide.md)\n"
        self.fx.paths[self.extra] = b"guide\n"
        self.fx.first_party = [self.entrypoint]
        self.fx.discovery["repository_entrypoints"]["first_party"] = list(self.fx.first_party)
        local_files = [
            {"path": "SKILL.md", "sha256": sha256(self.fx.paths[self.entrypoint])},
            {"path": "references/guide.md", "sha256": sha256(self.fx.paths[self.extra])}]
        identity = {
            "local_package": {
                "algorithm": "sha256-of-canonical-file-list-v1",
                "sha256": sha256(canonical(local_files)), "files": local_files},
            "entrypoint_git_blob_sha1": git_blob(self.fx.paths[self.entrypoint]),
            "package_git_tree_sha1": "f" * 40}
        record = self.fx.records[0]
        record["identity"] = identity
        record["origin"] = {"first_party_snapshot_pin": COMMIT}
        record["freshness"] = {"local_entrypoint_review_match": "match"}
        record["operation"] = {"recorded_authority": "unknown"}
        record["rights"]["recorded_license"] = "MIT claimed, not permission"
        self.fx.persist()

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def tree(_checkout, folder):
        if folder != "skills/original":
            raise AssertionError("wrong source root: " + folder)
        return "f" * 40

    def inspect(self):
        return inspect_package(self.fx.index(), "governed:local-skills/alpha",
                               tree_oid=self.tree)

    def expect(self, code):
        with self.assertRaises(Refusal) as err:
            self.inspect()
        self.assertEqual(err.exception.code, code)

    def reseal(self):
        self.fx.persist()

    def test_complete_nested_file_receipt_and_unqualified_rights(self):
        report = self.inspect()
        self.assertEqual(report["source_root"], "skills/original/")
        self.assertEqual(report["package_file_count"], 2)
        self.assertEqual(report["package_file_list_sha256"],
                         self.fx.records[0]["identity"]["local_package"]["sha256"])
        self.assertEqual([x["path"] for x in report["files"]],
                         ["SKILL.md", "references/guide.md"])
        self.assertEqual(report["reference_leads"]["unresolved_within_package"], [])
        self.assertEqual(report["reference_leads"]["outside_package_leads"], [])
        self.assertFalse(report["composition_eligible"])
        self.assertFalse(report["redistribution_rights_cleared"])
        self.assertFalse(report["permission_and_network_authority_approved"])
        self.assertFalse(report["reference_leads"]["dependency_closure_proven"])

    def test_scan_all_local_reviews_preserves_outcomes(self):
        result = scan_first_party(self.fx.index(), tree_oid=self.tree)
        self.assertEqual(result["first_party_reviewed"], 1)
        self.assertEqual(result["results_by_status"],
                         {"PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED": 1})
        self.assertFalse(result["composition_eligible"])

    def test_external_package_not_automatically_materialized(self):
        with self.assertRaises(Refusal) as err:
            inspect_package(self.fx.index(), "governed:external/beta",
                            tree_oid=self.tree)
        self.assertEqual(err.exception.code, "THIRD_PARTY_PACKAGE_UNAVAILABLE")

    def test_observation_cannot_impersonate_governed_id(self):
        with self.assertRaises(Refusal) as err:
            inspect_package(self.fx.index(), "observation:foo", tree_oid=self.tree)
        self.assertEqual(err.exception.code, "PACKAGE_ID")

    def test_missing_asset_even_if_declared_refuses(self):
        del self.fx.paths[self.extra]
        self.reseal()
        self.expect("PACKAGE_ROOT")

    def test_asset_byte_tamper_detected(self):
        source = self.fx.source / self.extra
        source.write_bytes(b"guIde\n")
        self.expect("SOURCE_SHA256")

    def test_stale_review_entrypoint_refuses(self):
        self.fx.records[0]["freshness"]["local_entrypoint_review_match"] = "mismatch-or-unresolved"
        self.reseal()
        self.expect("PACKAGE_REVIEW_DRIFT")

    def test_stale_package_tree_refuses(self):
        self.fx.records[0]["identity"]["package_git_tree_sha1"] = "0" * 40
        self.reseal()
        self.expect("PACKAGE_TREE_DRIFT")

    def test_canonical_package_digest_tamper_detected(self):
        self.fx.records[0]["identity"]["local_package"]["sha256"] = "0" * 64
        self.reseal()
        self.expect("PACKAGE_DIGEST")

    def test_nested_file_traversal_rejected(self):
        local = self.fx.records[0]["identity"]["local_package"]
        local["files"][1]["path"] = "../outside.md"
        local["sha256"] = sha256(canonical(local["files"]))
        self.reseal()
        self.expect("SOURCE_PATH")

    def test_duplicate_file_declarations_rejected(self):
        local = self.fx.records[0]["identity"]["local_package"]
        local["files"].append(copy.deepcopy(local["files"][-1]))
        local["sha256"] = sha256(canonical(local["files"]))
        self.reseal()
        self.expect("PACKAGE_FILES")

    def test_unexpected_extra_file_causes_root_mismatch(self):
        self.fx.paths["skills/original/scripts/new.sh"] = b"do not execute\n"
        self.reseal()
        self.expect("PACKAGE_ROOT")

    def test_review_rights_claim_promotion_not_permitted(self):
        self.fx.records[0]["rights"]["package_redistribution_clearance"] = "approved"
        self.reseal()
        # The outer pinned handoff validator should catch forged rights *before*
        # the selected-package resolver ever sees the record.
        self.expect("RIGHTS_CLAIM")

    def test_missing_local_package_refuses(self):
        del self.fx.records[0]["identity"]["local_package"]
        self.reseal()
        self.expect("PACKAGE_DECLARATION")

    def test_references_exposed_as_gaps_not_claimed_resolved(self):
        self.fx.paths[self.entrypoint] = (
            b"# Sample\n[guide](references/guide.md)\n"
            b"[missing](references/other.md)\n"
            b"[outside](../other/SKILL.md)\n"
            b"[remote](https://example.org/not-attested)\n")
        identity = self.fx.records[0]["identity"]
        identity["entrypoint_git_blob_sha1"] = git_blob(self.fx.paths[self.entrypoint])
        files = identity["local_package"]["files"]
        files[0]["sha256"] = sha256(self.fx.paths[self.entrypoint])
        identity["local_package"]["sha256"] = sha256(canonical(files))
        self.reseal()
        result = self.inspect()
        gaps = result["reference_leads"]
        self.assertEqual(gaps["unresolved_within_package"], ["references/other.md"])
        self.assertEqual(gaps["outside_package_leads"], ["../other/SKILL.md"])
        self.assertEqual(gaps["unassessed_remote_or_scheme_leads"],
                         ["https://example.org/not-attested"])
        self.assertFalse(gaps["dependency_closure_proven"])

    def test_invalid_utf8_entrypoint_refuses(self):
        self.fx.paths[self.entrypoint] = b"\xff"
        identity = self.fx.records[0]["identity"]
        identity["entrypoint_git_blob_sha1"] = git_blob(b"\xff")
        identity["local_package"]["files"][0]["sha256"] = sha256(b"\xff")
        identity["local_package"]["sha256"] = sha256(canonical(identity["local_package"]["files"]))
        self.reseal()
        self.expect("PACKAGE_ENTRYPOINT")

    def test_symlink_parent_refuses_nested_asset_read(self):
        import shutil
        original_parent = self.fx.source / "skills/original/references"
        shutil.rmtree(original_parent)
        outside = Path(self.tmp.name) / "outside"
        outside.mkdir()
        (outside / "guide.md").write_bytes(self.fx.paths[self.extra])
        original_parent.symlink_to(outside, target_is_directory=True)
        self.expect("SOURCE_SYMLINK")


if __name__ == "__main__":
    unittest.main()
