"""Conservative source rights/asset/link inventory, no authority or execution."""
import unittest

from scripts.catalog_handoff import Refusal, git_blob, sha256
from scripts.package_reference_inventory import build_reference_inventory


def checked(files):
    raw = {k: v if isinstance(v, bytes) else v.encode("utf-8")
           for k, v in files.items()}
    receipts = [{"relative_path": k, "sha256": sha256(raw[k]),
                 "git_blob_sha1": git_blob(raw[k]), "bytes": len(raw[k])}
                for k in sorted(raw)]
    return raw, receipts


class ReferenceInventoryTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "SKILL.md": (
                "---\nname: demo\nlicense: Complete terms in LICENSE.txt\n---\n"
                "# Demo\n[read](references/guide.md)\n[art](assets/pic.png)\n"),
            "LICENSE.txt": "Fixture-only license text, no legal permissions.\n",
            "references/guide.md": (
                "[asset](../assets/pic.png?download=1#section)\n"
                "[remote](https://example.invalid/reference)\n"),
            "assets/pic.png": b"\x89PNGtest",
            "scripts/run.sh": "#!/bin/sh\nexit 0\n",
        }

    def scan(self, files=None):
        a, b = checked(self.payload if files is None else files)
        return build_reference_inventory(a, b)

    def test_all_assets_are_individually_unassessed_even_with_local_license(self):
        result = self.scan()
        self.assertEqual(result["state"], "VERIFIED_SOURCE_BYTES_REFERENCE_LEADS_ONLY")
        self.assertEqual(result["file_count"], 5)
        self.assertEqual(result["frontmatter_license_pointer"]["matched"], ["LICENSE.txt"])
        self.assertEqual(result["frontmatter_license_pointer"]["unresolved"], [])
        self.assertEqual(result["markdown_files_scanned"], 2)
        self.assertEqual(result["inline_markdown_reference_count"], 4)
        self.assertEqual(result["local_matched_reference_leads"],
                         ["assets/pic.png", "references/guide.md"])
        self.assertEqual(result["remote_or_scheme_reference_leads"],
                         ["https://example.invalid/reference"])
        self.assertTrue(any(x["role"] == "CODE_OR_EXECUTABLE_NOT_AUTHORIZED"
                            for x in result["files_requiring_individual_rights_review"]))
        self.assertEqual(len(result["license_and_notice_files_observed_not_cleared"]), 1)
        self.assertTrue(all(x["license_and_asset_rights"] == "UNASSESSED"
                            for x in result["files_requiring_individual_rights_review"]))
        self.assertFalse(result["each_asset_rights_cleared"])
        self.assertFalse(result["dependency_closure_proven"])
        self.assertFalse(result["composition_eligible"])

    def test_nested_relative_links_resolve_within_package(self):
        files = dict(self.payload)
        files["references/guide.md"] = "[legal](../LICENSE.txt)\n"
        x = self.scan(files)
        self.assertIn("LICENSE.txt", x["local_matched_reference_leads"])
        self.assertNotIn("../LICENSE.txt", x["outside_package_reference_leads"])

    def test_missing_nested_reference_is_reported_not_silently_qualified(self):
        files = dict(self.payload)
        files["references/guide.md"] += "\n[missing](../assets/untracked.png)\n"
        x = self.scan(files)
        self.assertIn("assets/untracked.png", x["local_missing_reference_leads"])
        self.assertFalse(x["all_instructional_references_closed"])

    def test_escape_outside_package_keeps_unqualified_lead(self):
        files = dict(self.payload)
        files["references/guide.md"] += "\n[escape](../../secrets.txt)\n"
        x = self.scan(files)
        self.assertIn("../../secrets.txt", x["outside_package_reference_leads"])
        self.assertFalse(x["composition_eligible"])

    def test_percent_encoded_escape_detected(self):
        files = dict(self.payload)
        files["SKILL.md"] += "\n[escape](%2e%2e/secrets.txt)\n"
        x = self.scan(files)
        self.assertIn("../secrets.txt", x["outside_package_reference_leads"])

    def test_windows_style_paths_never_become_safe_local_references(self):
        files = dict(self.payload)
        files["SKILL.md"] += "\n[escape](..\\secrets.txt)\n"
        x = self.scan(files)
        self.assertIn("..\\secrets.txt", x["outside_package_reference_leads"])

    def test_absolute_and_scheme_links_are_not_local_files(self):
        files = dict(self.payload)
        files["SKILL.md"] += "\n[abs](/etc/passwd)\n[schemed](file:///dev/null)\n"
        x = self.scan(files)
        self.assertIn("/etc/passwd", x["outside_package_reference_leads"])
        self.assertIn("file:///dev/null", x["remote_or_scheme_reference_leads"])

    def test_frontmatter_license_notice_missing_is_explicit(self):
        files = dict(self.payload)
        del files["LICENSE.txt"]
        x = self.scan(files)
        self.assertEqual(x["frontmatter_license_pointer"]["unresolved"], ["LICENSE.txt"])
        self.assertEqual(x["license_and_notice_files_observed_not_cleared"], [])
        self.assertFalse(x["source_license_and_notice_obligations_assessed"])

    def test_parent_repository_license_pointer_is_not_package_license(self):
        files = dict(self.payload)
        files["SKILL.md"] = "---\nname: demo\nlicense: Complete terms in ../LICENSE.txt\n---\n"
        x = self.scan(files)
        self.assertEqual(x["frontmatter_license_pointer"]["matched"], [])
        self.assertEqual(x["frontmatter_license_pointer"]["unresolved"], ["../LICENSE.txt"])
        self.assertFalse(x["source_license_and_notice_obligations_assessed"])

    def test_remote_license_url_cannot_impersonate_local_license(self):
        files = dict(self.payload)
        files["SKILL.md"] = "---\nname: demo\nlicense: https://example.invalid/LICENSE.txt\n---\n"
        x = self.scan(files)
        self.assertEqual(x["frontmatter_license_pointer"]["matched"], [])
        self.assertEqual(x["frontmatter_license_pointer"]["unresolved"],
                         ["https://example.invalid/LICENSE.txt"])
        self.assertFalse(x["each_asset_rights_cleared"])

    def test_plain_spdx_string_is_not_perceived_as_file_or_permission(self):
        files = dict(self.payload)
        files["SKILL.md"] = "---\nname: demo\nlicense: Apache-2.0\n---\n# Demo\n"
        x = self.scan(files)
        self.assertTrue(x["frontmatter_license_pointer"]["raw_field_present"])
        self.assertEqual(x["frontmatter_license_pointer"]["matched"], [])
        self.assertFalse(x["each_asset_rights_cleared"])

    def test_duplicate_license_headers_refuse_ambiguous_provenance(self):
        files = dict(self.payload)
        files["SKILL.md"] = "---\nlicense: LICENSE.txt\nlicense: COPYING.md\n---\n# Demo\n"
        with self.assertRaises(Refusal) as ex:
            self.scan(files)
        self.assertEqual(ex.exception.code, "PACKAGE_LICENSE")

    def test_source_digest_forgery_refused(self):
        raw, receipts = checked(self.payload)
        receipts[0]["sha256"] = "0"*64
        with self.assertRaises(Refusal) as ex:
            build_reference_inventory(raw, receipts)
        self.assertEqual(ex.exception.code, "PACKAGE_INVENTORY")

    def test_forged_original_git_blob_identity_refused(self):
        raw, receipts = checked(self.payload)
        receipts[0]["git_blob_sha1"] = "0"*40
        with self.assertRaises(Refusal) as ex:
            build_reference_inventory(raw, receipts)
        self.assertEqual(ex.exception.code, "PACKAGE_INVENTORY")

    def test_extra_unlisted_file_refused(self):
        raw, receipts = checked(self.payload)
        raw["evil/added.sh"] = b"exit 0"
        with self.assertRaises(Refusal) as ex:
            build_reference_inventory(raw, receipts)
        self.assertEqual(ex.exception.code, "PACKAGE_INVENTORY")

    def test_invalid_utf8_markdown_refused(self):
        files = dict(self.payload)
        files["references/guide.md"] = b"\xff"
        with self.assertRaises(Refusal) as ex:
            self.scan(files)
        self.assertEqual(ex.exception.code, "PACKAGE_REFERENCES")

    def test_static_link_scan_never_claims_dynamic_dependencies_closed(self):
        files = dict(self.payload)
        files["SKILL.md"] = "# Original\nUse scripts/run.sh dynamically.\n"
        files["references/guide.md"] = "# No inline links\n"
        x = self.scan(files)
        self.assertEqual(x["inline_markdown_reference_count"], 0)
        self.assertTrue(x["other_reference_syntaxes_and_dynamic_dependencies_not_assessed"])
        self.assertFalse(x["dependency_closure_proven"])

    def test_asset_permission_is_not_derived_from_license_file_presence(self):
        x = self.scan()
        for row in x["files_requiring_individual_rights_review"]:
            self.assertEqual(row["license_and_asset_rights"], "UNASSESSED")
            self.assertEqual(row["host_use_permission"], "NOT_ESTABLISHED")

    def test_missing_skill_entrypoint_refused(self):
        files = dict(self.payload)
        del files["SKILL.md"]
        with self.assertRaises(Refusal) as ex:
            self.scan(files)
        self.assertEqual(ex.exception.code, "PACKAGE_INVENTORY")

    def test_unsafe_file_name_refused(self):
        raw = {"SKILL.md": b"# Skill\n", "../steal.md": b"text"}
        _, receipts = checked(raw)
        with self.assertRaises(Refusal) as ex:
            build_reference_inventory(raw, receipts)
        self.assertEqual(ex.exception.code, "PACKAGE_INVENTORY")


if __name__ == "__main__":
    unittest.main()
