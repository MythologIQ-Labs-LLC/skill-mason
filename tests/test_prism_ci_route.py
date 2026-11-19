"""Gherkin regression tests for fail-closed, evidence-aware native CI routing."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from scripts.prism_ci_route import (
    FULL, REUSE, is_safe, list_changed_paths, route, verify_observed_baseline,
)

OBSERVATION = Path(__file__).resolve().parents[1] / ".github/prism-ci/previous-p0-observation.json"


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args],
                                   text=True, stderr=subprocess.DEVNULL).strip()


class RouterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.name", "Native routing test")
        git(self.repo, "config", "user.email", "ci@example.invalid")
        self.write("README.md", "original\n")
        self.write("prism-overlay/template.patch", "locked overlay\n")
        self.write("scripts/prism_nested_ratchet.sh", "locked ratchet\n")
        self.write(".github/workflows/prism-native-gate.yml",
                   "name: Prism native gate (isolated runner)\n"
                   "env:\n"
                   "  TEMPLATE_PIN: b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b\n"
                   "  SDK_IMAGE: ghcr.io/afflom/prismpm-sdk-patched@sha256:"
                   "3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3\n"
                   "  PRISM_CODE_INTEGRITY: "
                   "sha512-PcXiUzhYJwY4ZM9wKpzazq5m/KVCWooj8dFF+7l57KcUQpNdiVDbETyYFo4A9O6OoY9tVghg5YawkIlgYYUjNA==\n")
        self.write("bin/qortara-skills.mjs", "locked holo consumer\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "baseline")
        self.baseline = git(self.repo, "rev-parse", "HEAD")
        self.manifest = json.loads(OBSERVATION.read_text())
        self.manifest["baseline_commit"] = self.baseline
        self.manifest["required_artifacts"] = [
            name.removesuffix("70ee027a1bfbcf05c98e80833c93b779c8e5fe8b")
            + self.baseline for name in self.manifest["required_artifacts"]
        ]

    def write(self, path, text):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self, path, text):
        self.write(path, text)
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "next change")
        return git(self.repo, "rev-parse", "HEAD")

    def api(self, endpoint):
        run_id = self.manifest["workflow_run_id"]
        if endpoint == f"/actions/runs/{run_id}":
            return {"head_sha": self.baseline, "status": "completed",
                    "conclusion": "success",
                    "name": self.manifest["workflow_name"],
                    "path": ".github/workflows/prism-native-gate.yml",
                    "repository": {"full_name": self.manifest["repository"]},
                    "head_repository": {"full_name": self.manifest["repository"]}}
        if endpoint == f"/actions/runs/{run_id}/jobs?per_page=100":
            names = self.manifest["required_jobs"]
            return {"total_count": len(names), "jobs": [
                {"name": name, "status": "completed", "conclusion": "success"}
                for name in names]}
        if endpoint == f"/actions/runs/{run_id}/artifacts?per_page=100":
            names = self.manifest["required_artifacts"]
            return {"total_count": len(names), "artifacts": [
                {"name": name, "expired": False, "size_in_bytes": 5}
                for name in names]}
        raise RuntimeError("unexpected evidence URL")

    def test_gherkin_unchanged_full_native_inputs_reuse_observation_only(self):
        candidate = self.commit("README.md", "updated user docs\n")
        out = route(self.repo, candidate, self.manifest, self.api)
        self.assertEqual(out["mode"], REUSE)
        self.assertEqual(out["changed_paths"], ["README.md"])
        self.assertTrue(out["github_baseline_evidence_verified"])
        self.assertIs(out["is_native_gate_pass"], False)
        self.assertIs(out["production_eligible"], False)
        self.assertIs(out["sdk_trust_root_accepted"], False)
        self.assertEqual(out["previous_assurance"], "P0 unverified")

    def test_gherkin_non_native_work_is_not_forced_through_40_minute_sdk(self):
        self.commit("src/backend/compose.mjs", "new deterministic composer\n")
        candidate = self.commit(".github/workflows/request-to-skill.yml",
                                "source-only source-gate workflow\n")
        self.assertEqual(route(self.repo, candidate, self.manifest, self.api)["mode"],
                         REUSE)

    def test_gherkin_prism_and_execution_dependencies_always_require_full(self):
        cases = [
            ("prism-overlay/files/eligibility/src/Eligibility.lex.tex", "changed model"),
            ("scripts/prism_nested_ratchet.sh", "removed check"),
            ("scripts/prism_reference_gate.sh", "network changed"),
            ("scripts/prism_egress_proxy.py", "broad proxy"),
            (".github/workflows/prism-native-gate.yml", "weakened"),
            ("bin/qortara-skills.mjs", "different holo consumer"),
            ("scripts/sm01_probe.mjs", "new fixture logic"),
            ("package.json", "changed dependency"),
            (".github/prism-ci/previous-p0-observation.json", "changed receipt"),
            ("scripts/prism_ci_route.py", "self-modified router"),
            ("some-unknown-plugin.py", "new source"),
            ("AGENTS.md", "different owner rules"),
            (".gitmodules", "new source dependency"),
        ]
        for path, text in cases:
            with self.subTest(path=path):
                # Every candidate below descends directly from the same
                # unchanged baseline; no test can leak earlier changes.
                git(self.repo, "reset", "--hard", self.baseline)
                git(self.repo, "clean", "-fd")
                candidate = self.commit(path, text)
                out = route(self.repo, candidate, self.manifest, self.api)
                self.assertEqual(out["mode"], FULL)
                self.assertEqual(out["reason"], "TRUSTED_OR_UNKNOWN_INPUT_CHANGED")
                self.assertIn(path, out["native_input_changes"])

    def test_gherkin_installed_prism_refuses_pre_install_observation(self):
        self.commit("README.md", "safe docs only\n")
        candidate = self.commit("prism/xtask/src/audit.rs", "source installed")
        out = route(self.repo, candidate, self.manifest, self.api)
        self.assertEqual(out["mode"], FULL)
        self.assertEqual(out["reason"], "INSTALLED_PRISM_REQUIRES_NEW_FULL_BASELINE")

    def test_gherkin_absent_or_unverified_github_evidence_requires_full(self):
        candidate = self.commit("docs/README.md", "source docs\n")
        self.assertEqual(route(self.repo, candidate, self.manifest)["mode"], FULL)
        def malformed(_): raise RuntimeError("offline no GitHub evidence")
        self.assertEqual(route(self.repo, candidate, self.manifest, malformed)["mode"], FULL)

    def test_gherkin_bad_native_job_or_expired_artifact_requires_full(self):
        candidate = self.commit("README.md", "safe docs\n")
        def failed_nested(endpoint):
            response = self.api(endpoint)
            if endpoint.endswith("/jobs?per_page=100"):
                response["jobs"][2]["conclusion"] = "failure"
            return response
        self.assertEqual(route(self.repo, candidate, self.manifest, failed_nested)["mode"], FULL)
        def expired(endpoint):
            response = self.api(endpoint)
            if endpoint.endswith("/artifacts?per_page=100"):
                response["artifacts"][0]["expired"] = True
            return response
        self.assertEqual(route(self.repo, candidate, self.manifest, expired)["mode"], FULL)

    def test_gherkin_mutated_baseline_identity_or_claimed_p2_requires_full(self):
        candidate = self.commit("README.md", "safe docs\n")
        for value in (
            {"assurance_grade": "P2 verified"},
            {"production_eligible": True},
            {"sdk_trust_root_accepted": True},
            {"template_commit": "x" * 40},
            {"template_commit": "a" * 40},  # syntactically valid, but wrong source
            {"sdk_image": "ghcr.io/untrusted/payload:latest"},
            {"sdk_image": "ghcr.io/afflom/prismpm-sdk-patched@sha256:" + "f" * 64},
            {"required_artifacts": ["faked"]},
        ):
            with self.subTest(change=value):
                obs = {**self.manifest, **value}
                self.assertEqual(route(self.repo, candidate, obs, self.api)["mode"], FULL)

    def test_gherkin_full_gate_for_owner_request_forks_and_history_divergence(self):
        candidate = self.commit("README.md", "changed\n")
        self.assertEqual(route(self.repo, candidate, self.manifest, self.api,
                               force_full=True)["mode"], FULL)
        self.assertEqual(route(self.repo, candidate, self.manifest, self.api,
                               same_repository=False)["mode"], FULL)
        # The root test baseline cannot be reached from an unrelated history.
        git(self.repo, "checkout", "--orphan", "unrelated")
        git(self.repo, "rm", "-rfq", ".")
        self.write("README.md", "totally unrelated\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "orphan")
        orphan = git(self.repo, "rev-parse", "HEAD")
        self.assertEqual(route(self.repo, orphan, self.manifest, self.api)["mode"], FULL)

    def test_gherkin_ambiguous_change_names_never_qualify_reuse(self):
        self.assertFalse(is_safe("prism-overlay/template.patch"))
        self.assertFalse(is_safe("docs/../../prism-overlay/template.patch"))
        self.assertFalse(is_safe("docs\\prism-overlay\\template.patch"))
        self.assertFalse(is_safe(".github/workflows/prism-native-gate.yml"))
        self.assertTrue(is_safe("docs/technical/guide.md"))
        self.assertTrue(is_safe("src/backend/compose.mjs"))

    def test_gherkin_git_rename_records_both_paths(self):
        (self.repo / "docs").mkdir(exist_ok=True)
        git(self.repo, "mv", "scripts/prism_nested_ratchet.sh", "docs/ratchet.txt")
        git(self.repo, "commit", "-qm", "rename ratchet into docs")
        candidate = git(self.repo, "rev-parse", "HEAD")
        paths = list_changed_paths(self.repo, self.baseline, candidate)
        self.assertIn("scripts/prism_nested_ratchet.sh", paths)
        self.assertIn("docs/ratchet.txt", paths)
        self.assertEqual(route(self.repo, candidate, self.manifest, self.api)["mode"], FULL)

    def test_gherkin_missing_baseline_job_or_truncation_is_not_accepted(self):
        def missing(endpoint):
            result = self.api(endpoint)
            if endpoint.endswith("/jobs?per_page=100"):
                result["jobs"].pop()
                result["total_count"] -= 1
            return result
        with self.assertRaises(RuntimeError):
            verify_observed_baseline(self.manifest, missing)
        def truncated(endpoint):
            result = self.api(endpoint)
            if endpoint.endswith("/jobs?per_page=100"):
                result["total_count"] = 200
            return result
        with self.assertRaises(RuntimeError):
            verify_observed_baseline(self.manifest, truncated)



class NativeSchedulingContractTests(unittest.TestCase):
    """Gherkin config regression: defer expensive draft SDK, not qualification."""

    @classmethod
    def setUpClass(cls):
        cls.workflow = (Path(__file__).resolve().parents[1] /
                        ".github/workflows/prism-native-gate.yml").read_text()
        cls.sdk = cls.workflow.split("  sdk:\n", 1)[1].split("  real-output:\n", 1)[0]
        cls.final = cls.workflow.split("  native-qualification:\n", 1)[1]

    def test_gherkin_draft_sync_does_not_schedule_three_sdk_runners(self):
        self.assertIn("types: [opened, synchronize, reopened, ready_for_review, labeled]",
                      self.workflow)
        self.assertIn("github.event.pull_request.draft == false", self.sdk)
        self.assertIn("github.event.action == 'labeled'", self.sdk)
        self.assertIn("github.event.label.name == 'run-prism-native'", self.sdk)

    def test_gherkin_fork_cannot_start_sdk_even_when_labeled(self):
        self.assertIn(
            "github.event.pull_request.head.repo.full_name == github.repository",
            self.sdk)
        self.assertIn("permissions: {}", self.workflow)

    def test_gherkin_ready_review_and_owner_label_preserve_full_native(self):
        self.assertIn("github.event_name == 'workflow_dispatch'", self.sdk)
        self.assertIn("github.event.pull_request.draft == false", self.sdk)
        self.assertIn("github.event.label.name == 'run-prism-native'", self.sdk)
        for phase in ("reference", "author", "nested"):
            self.assertIn(phase, self.sdk)
        self.assertIn("just vv", self.workflow)

    def test_gherkin_deferred_or_failed_sdk_cannot_be_reported_as_pass(self):
        self.assertIn("if: >-", self.final)
        self.assertIn("always() &&", self.final)
        self.assertIn("needs: [sdk, real-output, publish-evidence]", self.final)
        for result in ("SDK_RESULT", "REAL_OUTPUT_RESULT", "EVIDENCE_RESULT"):
            self.assertIn('test "
        self.assertNotIn("REUSE_PREVIOUS_P0_OBSERVATION", self.final)



if __name__ == "__main__":
    unittest.main()
 + result + '" = success', self.final)
        self.assertNotIn("REUSE_PREVIOUS_P0_OBSERVATION", self.final)



if __name__ == "__main__":
    unittest.main()
