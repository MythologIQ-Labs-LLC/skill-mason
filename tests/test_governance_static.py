"""Planted positive and negative controls for the supplemental static layout checker."""
import tempfile
import unittest
from pathlib import Path
from scripts.check_governance_static import assess


def fixture(root: Path) -> None:
    (root / "docs" / "architecture").mkdir(parents=True)
    (root / ".qortara").mkdir()
    (root / "ARCHITECTURE_INDEX.md").write_text("[register](docs/README.md)\n", encoding="utf-8")
    (root / "docs" / "README.md").write_text("[owned](architecture/entry.md)\n", encoding="utf-8")
    (root / "docs" / "architecture" / "entry.md").write_text("# Contract\n", encoding="utf-8")
    (root / "GOVERNANCE.md").write_text("# Governance\nowner approval exception\n", encoding="utf-8")
    (root / "SECURITY.md").write_text(
        "# Security\nprivate vulnerability reporting to a verified internal channel; "
        "handling owner and supported versions\n", encoding="utf-8"
    )
    (root / ".qortara" / ".gitignore").write_text(
        "keys/\nsession\n*.lock\n*.tmp\nhooks.jsonl\n", encoding="utf-8"
    )
    (root / ".qortara" / "shadow.jsonl").write_bytes(b"")


class GovernanceStaticTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        fixture(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_known_good_layout(self):
        self.assertEqual(assess(self.root), ([], []))

    def test_mandatory_policy_missing(self):
        (self.root / "GOVERNANCE.md").unlink()
        problems, _ = assess(self.root)
        self.assertTrue(any("GOVERNANCE.md" in x for x in problems))

    def test_owner_unregistered(self):
        (self.root / "docs" / "architecture" / "new.md").write_text("proposed")
        problems, _ = assess(self.root)
        self.assertTrue(any("new.md" in x for x in problems))

    def test_duplicate_registration(self):
        with (self.root / "docs" / "README.md").open("a") as f:
            f.write("[duplicate](architecture/entry.md)\n")
        problems, _ = assess(self.root)
        self.assertTrue(any("exactly once: entry.md" in x for x in problems))

    def test_broken_local_link(self):
        with (self.root / "docs" / "README.md").open("a") as f:
            f.write("[missing](missing.md)\n")
        problems, _ = assess(self.root)
        self.assertTrue(any("broken local link" in x for x in problems))

    def test_placeholder_reporting_policy_holds(self):
        with (self.root / "SECURITY.md").open("a") as f:
            f.write("\nNOT_ESTABLISHED\n")
        errors, holds = assess(self.root)
        self.assertFalse(errors)
        self.assertTrue(any("unqualified" in x for x in holds))

    def test_shadow_malformed(self):
        (self.root / ".qortara" / "shadow.jsonl").write_text("not-json\n")
        errors, _ = assess(self.root)
        self.assertTrue(any("shadow log parsing failure" in x for x in errors))

    def test_ignored_keys(self):
        (self.root / ".qortara" / ".gitignore").write_text("session\n*.lock\n*.tmp\nhooks.jsonl\n")
        errors, _ = assess(self.root)
        self.assertTrue(any("keys/" in x for x in errors))

    def test_symlink_rejected(self):
        (self.root / "GOVERNANCE.md").unlink()
        (self.root / "GOVERNANCE.md").symlink_to(self.root / "SECURITY.md")
        errors, _ = assess(self.root)
        self.assertTrue(any("GOVERNANCE.md" in x for x in errors))


if __name__ == "__main__":
    unittest.main()
