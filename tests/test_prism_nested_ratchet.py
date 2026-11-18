"""Tests of scripts/prism_nested_ratchet.sh with real git and a miniature stand-in template.

No SDK image and no upstream code runs here. These tests show what the script
compares with what, and that it refuses the ways the comparison could be made
meaningless: the instance moved or removed, or the audit itself changed. They do
not show that the template's `audit-prism` then refuses a planted file inside
the projection: only a run on the isolated runner shows that.
"""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prism_nested_ratchet.sh"
UNIVERSAL = (
    ".devcontainer/devcontainer.json",
    ".github/workflows/bootstrap.yml",
    "AGENTS.md",
    "VERIFICATION.md",
    "prismpm.lock",
    "template-contract.json",
    "template.lock",
)
AUDIT = "pub mod audit {\n    pub mod prism {\n        // stand-in for the pinned ratchet\n    }\n}\n"


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "needs git and bash")
class NestedRatchetProjectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="nested-ratchet-")).resolve()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.env = {
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": str(self.tmp),
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid",
        }
        self.template = self.tmp / "template"
        self.write_instance(self.template)
        self.git(self.template, "init", "-q", "-b", "main")
        self.commit(self.template, "template pin")
        self.repo = self.tmp / "repo"
        (self.repo / "scripts").mkdir(parents=True)
        (self.repo / "AGENTS.md").write_text("root governance, different bytes\n")
        (self.repo / "scripts" / "tool.sh").write_text("#!/bin/sh\n")
        self.git(self.repo, "init", "-q", "-b", "main")
        self.before_install = self.commit(self.repo, "root only")
        self.write_instance(self.repo / "prism")
        (self.repo / "prism" / "eligibility").mkdir()
        (self.repo / "prism" / "eligibility" / "model.lex.tex").write_text("model\n")
        self.install = self.commit(self.repo, "install nested instance")
        self.projection = self.tmp / "projection"

    def write_instance(self, directory: Path):
        for path in UNIVERSAL:
            target = directory / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"universal policy: {path}\n")
        (directory / "xtask" / "src").mkdir(parents=True)
        (directory / "xtask" / "src" / "audit.rs").write_text(AUDIT)
        (directory / "xtask" / "src" / "main.rs").write_text("fn main() {}\n")
        (directory / "xtask" / "Cargo.toml").write_text("[package]\nname = \"xtask\"\n")
        (directory / "crates").mkdir()
        (directory / "crates" / "lib.rs").write_text("pub fn kept() {}\n")

    def git(self, directory: Path, *args: str) -> str:
        return subprocess.run(["git", "-C", str(directory), *args], check=True, capture_output=True, text=True, env=self.env).stdout.strip()

    def commit(self, directory: Path, message: str) -> str:
        self.git(directory, "add", "-A")
        self.git(directory, "commit", "-q", "-m", message)
        return self.git(directory, "rev-parse", "HEAD")

    def run_script(self, commit: str, repo: Path | None = None):
        return subprocess.run(
            ["bash", str(SCRIPT), str(repo or self.repo), commit, str(self.template), str(self.projection)],
            capture_output=True, text=True, env=self.env,
        )

    def assert_refused(self, result, reason: str):
        self.assertEqual(result.returncode, 77, result.stdout + result.stderr)
        self.assertIn("REFUSED before any audit runs", result.stderr)
        self.assertIn(reason, result.stderr)
        self.assertFalse(self.projection.exists(), "no projection may be left behind by a refusal")

    # --- states ---------------------------------------------------------------

    def test_a_commit_before_any_instance_has_nothing_to_audit(self):
        result = self.run_script(self.before_install)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RATCHET_STATE=absent", result.stdout)
        self.assertFalse(self.projection.exists())

    def test_the_installing_commit_projects_to_one_root_commit_of_the_instance(self):
        result = self.run_script(self.install)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RATCHET_STATE=installing", result.stdout)
        self.assertEqual(self.git(self.projection, "rev-list", "--count", "HEAD"), "1")
        self.assertEqual(self.git(self.projection, "rev-parse", "HEAD^{tree}"), self.git(self.repo, "rev-parse", f"{self.install}:prism"))
        self.assertTrue((self.projection / "xtask" / "src" / "audit.rs").is_file(), "the audit sits at the path it looks for")
        self.assertFalse((self.projection / "scripts").exists(), "code outside prism/ is not part of the measure")
        self.assertEqual(self.git(self.projection, "status", "--porcelain"), "")

    def test_a_later_commit_projects_to_parent_and_child_so_the_ratchet_engages(self):
        (self.repo / "prism" / "crates" / "added_later.rs").write_text("pub fn added() {}\n")
        (self.repo / "scripts" / "outside.sh").write_text("#!/bin/sh\necho outside\n")
        child = self.commit(self.repo, "hand-written file after installation")
        result = self.run_script(child)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RATCHET_STATE=engaged", result.stdout)
        self.assertEqual(self.git(self.projection, "rev-list", "--count", "HEAD"), "2")
        # What the template's audit will read: the parent's gate at its root-relative path,
        # and a child tree that differs from the parent by exactly the planted file.
        self.assertIn("pub mod prism {", self.git(self.projection, "show", "HEAD^1:xtask/src/audit.rs"))
        self.assertEqual(self.git(self.projection, "diff", "--name-status", "HEAD^1", "HEAD"), "A\tcrates/added_later.rs")
        self.assertEqual(self.git(self.projection, "rev-parse", "HEAD^1^{tree}"), self.git(self.repo, "rev-parse", f"{self.install}:prism"))
        self.assertEqual(self.git(self.projection, "rev-parse", "--is-shallow-repository"), "false")

    def test_the_projection_stands_alone_without_the_source_repository(self):
        self.assertEqual(self.run_script(self.install).returncode, 0)
        self.assertFalse((self.projection / ".git" / "objects" / "info" / "alternates").exists())
        shutil.rmtree(self.repo)
        self.assertEqual(self.git(self.projection, "fsck", "--no-dangling"), "")

    # --- refusals -------------------------------------------------------------

    def test_refuses_when_the_instance_is_moved_after_installation(self):
        self.git(self.repo, "mv", "prism", "elsewhere")
        (self.repo / "elsewhere" / "crates" / "added_later.rs").write_text("pub fn added() {}\n")
        child = self.commit(self.repo, "move the instance and grow it")
        self.assert_refused(self.run_script(child), "moved or removed")

    def test_refuses_when_the_instance_is_removed_after_installation(self):
        self.git(self.repo, "rm", "-r", "-q", "prism")
        child = self.commit(self.repo, "remove the instance")
        self.assert_refused(self.run_script(child), "moved or removed")

    def test_refuses_when_the_audit_itself_is_altered(self):
        for label, content in (("gate removed", AUDIT.replace("pub mod prism {", "pub mod prism_off {")),
                               ("one byte added", AUDIT + "\n")):
            with self.subTest(change=label):
                self.git(self.repo, "checkout", "-q", "-B", "work", self.install)
                (self.repo / "prism" / "xtask" / "src" / "audit.rs").write_text(content)
                child = self.commit(self.repo, label)
                self.assert_refused(self.run_script(child), "prism/xtask/src/audit.rs differs from the template pin")

    def test_refuses_when_any_other_xtask_file_or_universal_policy_file_changes(self):
        for path in ("xtask/src/main.rs", "xtask/Cargo.toml", "AGENTS.md", "prismpm.lock"):
            with self.subTest(path=path):
                self.git(self.repo, "checkout", "-q", "-B", "work", self.install)
                with (self.repo / "prism" / path).open("a") as handle:
                    handle.write("changed\n")
                child = self.commit(self.repo, f"alter {path}")
                self.assert_refused(self.run_script(child), f"prism/{path} differs from the template pin")

    def test_refuses_a_file_added_beside_the_audit_or_an_audit_file_deleted(self):
        self.git(self.repo, "checkout", "-q", "-B", "work", self.install)
        (self.repo / "prism" / "xtask" / "src" / "shadow.rs").write_text("// not in the pin\n")
        child = self.commit(self.repo, "add a file under xtask")
        self.assert_refused(self.run_script(child), "holds files the template pin does not")
        self.git(self.repo, "checkout", "-q", "-B", "work2", self.install)
        (self.repo / "prism" / "xtask" / "src" / "main.rs").unlink()
        child = self.commit(self.repo, "delete an xtask file")
        self.assert_refused(self.run_script(child), "prism/xtask/src/main.rs differs from the template pin")

    def test_refuses_an_install_whose_audit_is_not_the_pinned_one(self):
        other = self.tmp / "other"
        (other / "prism").mkdir(parents=True)
        self.write_instance(other / "prism")
        (other / "prism" / "xtask" / "src" / "audit.rs").write_text("// no ratchet here\n")
        self.git(other, "init", "-q", "-b", "main")
        commit = self.commit(other, "install with a different audit")
        self.assert_refused(self.run_script(commit, other), "differs from the template pin")

    def test_refuses_to_reuse_a_projection_directory_and_validates_its_inputs(self):
        self.projection.mkdir()
        result = self.run_script(self.install)
        self.assertEqual(result.returncode, 73)
        shutil.rmtree(self.projection)
        self.assertEqual(self.run_script("0" * 40).returncode, 65)
        usage = subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env=self.env)
        self.assertEqual(usage.returncode, 64)

    def test_the_instance_path_is_fixed_and_the_script_runs_no_container(self):
        text = SCRIPT.read_text()
        self.assertIn("INSTANCE=prism\n", text)
        self.assertNotIn("docker", text.split("set -uo pipefail", 1)[1])
        self.assertNotRegex(text, r"\bcargo\b(?!\s+run -q --locked -p xtask -- audit-prism)")


if __name__ == "__main__":
    unittest.main()
