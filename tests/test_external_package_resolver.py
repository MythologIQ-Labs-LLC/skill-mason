"""C3 selected external-package byte inspection, with local synthetic Git objects."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from scripts.catalog_handoff import Refusal
from scripts.external_package_resolver import inspect_external
from test_catalog_index import Fixture


def git(root, *args):
    r = subprocess.run(
        ["git", "-C", str(root), "-c", "core.hooksPath=/dev/null", *args],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=15)
    if r.returncode:
        raise AssertionError(r.stderr.decode("utf-8", "replace"))
    return r.stdout.decode("utf-8").strip()


class ExternalPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.fx = Fixture(root)
        self.external = root / "external"
        self.external.mkdir()
        subprocess.run(["git", "init", "-q", str(self.external)], check=True,
                       stdout=subprocess.PIPE, timeout=15)
        git(self.external, "remote", "add", "origin", "https://github.com/example/public-skills")
        package = self.external / "skills/frontend-design"
        package.mkdir(parents=True)
        (package / "SKILL.md").write_text(
            "# Original example\n[document](references/doc.md)\n",
            encoding="utf-8")
        (package / "LICENSE.txt").write_text("Test fixture license marker\n", encoding="utf-8")
        refs = package / "references"
        refs.mkdir()
        (refs / "doc.md").write_text("documentation\n", encoding="utf-8")
        (refs / "empty.txt").write_bytes(b"")
        git(self.external, "add", ".")
        git(self.external, "-c", "user.name=Test Author",
            "-c", "user.email=test@example.invalid", "commit", "-qm", "synthetic source")
        self.commit = git(self.external, "rev-parse", "HEAD")
        self.repo_tree = git(self.external, "rev-parse", "HEAD^{tree}")
        self.package_tree = git(self.external, "rev-parse", "HEAD:skills/frontend-design")
        self.skill_blob = git(self.external, "rev-parse", "HEAD:skills/frontend-design/SKILL.md")
        self.record = self.fx.records[1]
        self.record["origin"] = {
            "repository": "https://github.com/example/public-skills",
            "recorded_pin": self.commit,
            "path": "skills/frontend-design/SKILL.md",
        }
        self.record["identity"] = {
            "entrypoint_git_blob_sha1": self.skill_blob,
            "package_git_tree_sha1": self.package_tree,
        }
        self.fx.persist()

    def tearDown(self):
        self.temp.cleanup()

    def inspect(self, **kwargs):
        return inspect_external(
            self.fx.index(), kwargs.pop("record_id", "governed:external/beta"),
            kwargs.pop("checkout", self.external),
            expected_repo_tree=kwargs.pop("repo_tree", self.repo_tree))

    def refuse(self, code, **kwargs):
        with self.assertRaises(Refusal) as err:
            self.inspect(**kwargs)
        self.assertEqual(err.exception.code, code)

    def persist(self):
        self.fx.persist()

    def test_real_git_full_nested_byte_receipt_zero_mutation_and_no_rights(self):
        row = self.inspect()
        self.assertEqual(row["state"], "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED")
        self.assertEqual(row["repository_commit"], self.commit)
        self.assertEqual(row["package_git_tree_sha1"], self.package_tree)
        self.assertEqual(row["entrypoint_git_blob_sha1"], self.skill_blob)
        self.assertEqual(row["complete_tracked_package_files_verified"], 4)
        self.assertEqual(row["package_path"], "skills/frontend-design")
        self.assertEqual(row["reference_leads"]["unresolved_within_package"], [])
        self.assertIn("LICENSE.txt", row["license_or_notice_files_present"])
        self.assertTrue(any(f["bytes"] == 0 for f in row["files"]))
        self.assertFalse(row["publisher_identity_authenticated_independently"])
        self.assertFalse(row["legal_and_asset_rights_assessed"])
        self.assertFalse(row["modification_and_redistribution_cleared"])
        self.assertFalse(row["dependency_closure_proven"])
        self.assertFalse(row["target_host_approved"])
        self.assertFalse(row["composition_eligible"])

    def test_untracked_asset_refused_even_with_matching_recorded_tree(self):
        (self.external / "skills/frontend-design/another.md").write_text("ignored payload\n")
        self.refuse("EXTERNAL_WORKTREE_DRIFT")

    def test_tracked_byte_tamper_refused(self):
        (self.external / "skills/frontend-design/references/doc.md").write_text("tampered\n")
        self.refuse("EXTERNAL_BYTES")

    def test_symlink_leaf_refused(self):
        link = self.external / "skills/frontend-design/link"
        link.symlink_to(self.external / "skills/frontend-design/LICENSE.txt")
        self.refuse("EXTERNAL_SYMLINK")

    def test_symlinked_parent_refused(self):
        parent = self.external / "skills/frontend-design/references"
        outside = self.external / "elsewhere"
        parent.rename(outside)
        parent.symlink_to(outside, target_is_directory=True)
        self.refuse("EXTERNAL_SYMLINK")

    def test_exact_commit_must_match(self):
        self.record["origin"]["recorded_pin"] = "a" * 40
        self.persist()
        self.refuse("EXTERNAL_SOURCE_PIN")

    def test_exact_repo_tree_must_match(self):
        self.refuse("EXTERNAL_SOURCE_PIN", repo_tree="b" * 40)

    def test_source_review_entrypoint_drift_refused(self):
        self.record["identity"]["entrypoint_git_blob_sha1"] = "0" * 40
        self.persist()
        self.refuse("EXTERNAL_ENTRYPOINT_DRIFT")

    def test_recorded_package_tree_drift_refused(self):
        self.record["identity"]["package_git_tree_sha1"] = "0" * 40
        self.persist()
        self.refuse("EXTERNAL_TREE_DRIFT")

    def test_remote_origin_mismatch_refused(self):
        git(self.external, "remote", "set-url", "origin", "https://github.com/unrelated/repo")
        self.refuse("EXTERNAL_SOURCE_ORIGIN")

    def test_unapproved_source_transport_refused(self):
        self.record["origin"]["repository"] = "ssh://example.invalid/unsafe/skills"
        self.persist()
        self.refuse("EXTERNAL_REPOSITORY")

    def test_source_path_escape_refused(self):
        self.record["origin"]["path"] = "../outside/SKILL.md"
        self.persist()
        self.refuse("SOURCE_PATH")

    def test_same_name_wrong_package_refused(self):
        self.record["origin"]["path"] = "skills/other/SKILL.md"
        self.persist()
        self.refuse("SOURCE_GIT")

    def test_first_party_is_different_resolver(self):
        self.refuse("EXTERNAL_SOURCE_CLASS", record_id="governed:local-skills/alpha")

    def test_observation_id_is_not_governed(self):
        self.refuse("EXTERNAL_ID", record_id="observation:any")

    def test_historical_combined_git_tree_and_blob_fingerprint_is_explicitly_reported(self):
        identity = self.record["identity"]
        identity["recorded_fingerprint_algorithm"] = "git-tree-and-blob-sha1"
        identity["recorded_fingerprint"] = self.skill_blob
        del identity["entrypoint_git_blob_sha1"]
        self.persist()
        receipt = self.inspect()
        self.assertEqual(receipt["entrypoint_git_blob_sha1"], self.skill_blob)
        self.assertEqual(receipt["entrypoint_identity_source"],
                         "recorded_fingerprint_git_tree_and_blob_sha1_fallback")
        self.assertTrue(receipt["historical_export_identity_gap_requires_upstream_correction"])
        self.assertFalse(receipt["published_handoff_explicit_entrypoint_present"])
        self.assertFalse(receipt["composition_eligible"])

    def test_missing_explicit_entrypoint_without_known_combined_algorithm_refuses(self):
        identity = self.record["identity"]
        identity["recorded_fingerprint_algorithm"] = "opaque"
        identity["recorded_fingerprint"] = self.skill_blob
        del identity["entrypoint_git_blob_sha1"]
        self.persist()
        self.refuse("EXTERNAL_IDENTITY_INCOMPLETE")

    def test_historical_fallback_still_refuses_divergent_recorded_blob(self):
        identity = self.record["identity"]
        identity["recorded_fingerprint_algorithm"] = "git-tree-and-blob-sha1"
        identity["recorded_fingerprint"] = "0" * 40
        del identity["entrypoint_git_blob_sha1"]
        self.persist()
        self.refuse("EXTERNAL_ENTRYPOINT_DRIFT")

    def test_historical_fallback_requires_valid_full_blob_id(self):
        identity = self.record["identity"]
        identity["recorded_fingerprint_algorithm"] = "git-tree-and-blob-sha1"
        identity["recorded_fingerprint"] = "invalid-blob"
        del identity["entrypoint_git_blob_sha1"]
        self.persist()
        self.refuse("EXTERNAL_PIN")

    def test_incomplete_record_tree_refused(self):
        del self.record["identity"]["package_git_tree_sha1"]
        self.persist()
        self.refuse("EXTERNAL_PIN")

    def test_checkout_root_must_be_real_repository(self):
        self.refuse("EXTERNAL_CHECKOUT", checkout=self.external / "skills")

    def test_worktree_symlink_root_refused(self):
        new = self.external.parent / "external-link"
        new.symlink_to(self.external, target_is_directory=True)
        self.refuse("EXTERNAL_CHECKOUT", checkout=new)

    def test_no_license_clearance_inferred_from_claim(self):
        self.record["rights"]["recorded_license"] = "MIT"
        self.persist()
        row = self.inspect()
        self.assertEqual(row["recorded_license_claim_not_clearance"], "MIT")
        self.assertFalse(row["modification_and_redistribution_cleared"])


if __name__ == "__main__":
    unittest.main()
