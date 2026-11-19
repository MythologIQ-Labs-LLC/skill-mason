"""Static checks of the isolated-runner workflow and its driver. Nothing is executed.

These tests hold the isolation properties in issue #9 fixed in the source: no
permission and no secret for any job that touches the SDK image or its output,
no Docker socket, no checkout action near the SDK, an internal network with a
three-host allowlist, and the unreduced `just vv`. They say what the files ask
for. Whether a runner delivered it is shown only by a run's own evidence.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "prism-native-gate.yml"
DRIVER = ROOT / "scripts" / "prism_native_gate.sh"
ACCEPTANCE = ROOT / "scripts" / "sm01_real_holo_acceptance.sh"
WRAPPER = ROOT / "scripts" / "prism_reference_gate.sh"
INSTANCE = ROOT / "scripts" / "prism_instance.sh"
ALLOWLIST = {"static.crates.io", "index.crates.io", "github.com"}


def jobs(text: str) -> dict:
    """Split the workflow into its top-level jobs by indentation, without a YAML parser."""
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"(?m)^  ([a-z][a-z0-9-]*):\n", body)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}


class NativeGateWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")
        cls.jobs = jobs(cls.text)
        cls.driver = DRIVER.read_text(encoding="utf-8")

    def test_the_four_jobs_keep_sdk_permissions_minimal_and_publisher_only_write(self):
        self.assertEqual(set(self.jobs), {"sdk", "real-output",
                                          "publish-evidence", "native-qualification"})
        self.assertRegex(self.text, r"(?m)^permissions: \{\}$")
        for name in ("sdk", "real-output"):
            with self.subTest(job=name):
                self.assertNotIn("permissions:", self.jobs[name])
        decision = self.jobs["native-qualification"]
        self.assertIn("    permissions: {}\n", decision)
        self.assertIn("needs: [sdk, real-output, publish-evidence]", decision)
        for field in ("SDK_RESULT", "REAL_OUTPUT_RESULT", "EVIDENCE_RESULT"):
            self.assertIn('test "' + chr(36) + field + '" = success', decision)
        publisher = self.jobs["publish-evidence"]
        self.assertEqual(
            re.findall(r"(?m)^    permissions:\n((?:      .+\n)+)", publisher),
            ["      contents: write\n"])

    def test_no_secret_token_or_oidc_is_referenced_anywhere(self):
        for forbidden in ("secrets.", "github.token", "GITHUB_TOKEN", "id-token", "ACTIONS_RUNTIME_TOKEN", "docker login"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, self.text)

    def test_the_sdk_never_gets_the_docker_socket_or_extra_privilege(self):
        for source in (self.text, self.driver):
            for forbidden in ("docker.sock", "--privileged", "--cap-add", "--pid", "--network host",
                              "disposable-daemon\n", "PRISM_GATE_DOCKER_SOCKET=disposable-daemon",
                              "PRISM_GATE_HOST_NETWORK"):
                with self.subTest(forbidden=forbidden):
                    self.assertNotIn(forbidden, source)
        # The socket variable appears once, with a value the wrapper must refuse.
        self.assertNotIn("PRISM_GATE_DOCKER_SOCKET", self.text)
        self.assertEqual(re.findall(r"PRISM_GATE_DOCKER_SOCKET\S*", self.driver), ["PRISM_GATE_DOCKER_SOCKET=1"])
        self.assertRegex(self.driver, r"(?m)^refusal refuse-socket-without-exact-opt-in .* PRISM_GATE_DOCKER_SOCKET=1 -- ")

    def test_every_issue_9_refusal_is_exercised_on_the_runner_before_any_gate_container(self):
        labels = re.findall(r"(?m)^\s*refusal (refuse-[a-z-]+) ", self.driver)
        for needed in ("credential-variable", "credential-store", "symlinked-checkout", "dirty-tree",
                       "unexpected-sdk-digest", "socket-without-exact-opt-in", "host-network-without-opt-in",
                       "shared-network", "missing-network", "network-not-internal", "existing-workdir",
                       "workdir-inside-source"):
            with self.subTest(refusal=needed):
                self.assertIn(f"refuse-{needed}", labels)
        self.assertLess(self.driver.index("refusal refuse-credential-variable"), self.driver.index("must_pass egress-control"))
        self.assertIn('[[ $rc -ne 77 ]]', self.driver)
        self.assertIn('result="FAIL(a container was started)"', self.driver)

    def test_jobs_that_touch_the_sdk_or_the_holo_use_no_checkout_action(self):
        for name in ("sdk", "real-output"):
            with self.subTest(job=name):
                self.assertNotIn("actions/checkout", self.jobs[name])
                self.assertIn('remote add origin "https://github.com/$', self.jobs[name])
        self.assertIn("actions/checkout@", self.jobs["publish-evidence"])

    def test_the_publisher_never_runs_the_sdk_image_the_runtime_or_the_holo(self):
        publisher = self.jobs["publish-evidence"]
        for forbidden in ("docker ", "SDK_IMAGE", "prism_native_gate", "npm ", "node ", "prism-code", "sm01_"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, publisher)
        self.assertIn("needs: [sdk, real-output]", publisher)
        self.assertIn("find \"$dest\" -type l -delete", publisher)

    def test_every_action_is_pinned_to_a_full_commit(self):
        uses = re.findall(r"uses: (\S+)", self.text)
        self.assertGreaterEqual(len(uses), 5)
        for reference in uses:
            with self.subTest(action=reference):
                self.assertRegex(reference, r"^actions/[a-z-]+@[0-9a-f]{40}$")

    def test_fork_pull_requests_cannot_start_the_sdk_or_the_publisher(self):
        guard = "github.event.pull_request.head.repo.full_name == github.repository"
        self.assertIn(guard, self.jobs["sdk"])
        self.assertIn(guard, self.jobs["publish-evidence"])
        self.assertNotIn("pull_request_target", self.text)

    def test_the_network_is_internal_with_exactly_the_recorded_allowlist(self):
        sdk = self.jobs["sdk"]
        self.assertIn("docker network create --internal ", sdk)
        self.assertEqual(set(re.findall(r"--allow (\S+)", sdk)), ALLOWLIST)
        self.assertIn("iptables -I INPUT 1 -i prismgate0 -j DROP", sdk)
        self.assertIn("PRISM_GATE_EGRESS_NETWORK=prism-gate-egress", sdk)
        networks = set(re.findall(r'(?m)^\s*(?:must_pass|sdk) \S+ "\$\w+" (\w+) ', self.driver))
        self.assertEqual(networks, {"none", "allowlist"})

    def test_the_gate_user_runs_in_a_scrubbed_environment_with_an_empty_home(self):
        sdk = self.jobs["sdk"]
        self.assertGreaterEqual(sdk.count('sudo -u "$GATE_USER" env -i PATH="$CLEAN_PATH" HOME="$BASE/home"'), 2)
        self.assertIn('sudo install -d -m 0700 -o 1000 -g 1000 "$BASE/home"', sdk)
        self.assertIn("exit 77", sdk)

    def test_pins_agree_with_the_wrapper_and_the_instance_script(self):
        image = re.search(r"(?m)^  SDK_IMAGE: (\S+)$", self.text).group(1)
        pin = re.search(r"(?m)^  TEMPLATE_PIN: ([0-9a-f]{40})$", self.text).group(1)
        self.assertIn(f"DEFAULT_IMAGE='{image}'", WRAPPER.read_text())
        self.assertIn(f"PIN={pin}", INSTANCE.read_text())
        self.assertRegex(image, r"@sha256:[0-9a-f]{64}$")
        self.assertIn('docker pull --quiet "$SDK_IMAGE"', self.jobs["sdk"])

    def test_the_driver_runs_the_unreduced_gate_and_judges_controls_by_their_diagnostic(self):
        self.assertIn("'vv: the acceptance gate passed' just vv", self.driver)
        self.assertEqual(len(re.findall(r"(?m)^\s*(?:if )?must_pass \S+ \S+ \S+ \S+ '[^']*' just vv", self.driver)), 2)
        self.assertNotRegex(self.driver, r"just vv\S*\s+--|just --\S+ vv|SKIP|--no-verify")
        controls = re.findall(r"(?m)^control (nc-[a-z-]+) '([^']+)'", self.driver)
        self.assertGreaterEqual(len(controls), 12)
        self.assertEqual(len({name for name, _ in controls}), len(controls))
        for name, diagnostic in controls:
            with self.subTest(control=name):
                self.assertGreaterEqual(len(diagnostic), 6)
        for fact in ("evidence", "rights", "authority", "coverage"):
            with self.subTest(fact=fact):
                self.assertIn(f"nc-{fact}-check-dropped", dict(controls))
        self.assertIn('result="FAIL(accepted)"', self.driver)
        self.assertIn('result="FAIL(wrong diagnostic)"', self.driver)

    def test_the_ratchet_is_a_control_only_where_it_can_engage(self):
        # audit-prism reads its ceiling at a root-relative path, so it is judged in a
        # root-level instance and only observed in the nested one.
        self.assertIn('sdk nc-ratchet-root-layout "$rootrepo" allowlist "$seed" just model', self.driver)
        self.assertIn('record nc-ratchet-root-layout allowlist "refusal: new non-Prism file"', self.driver)
        self.assertNotRegex(self.driver, r"(?m)^control \S*ratchet")
        observed = re.findall(r"(?m)^observe (obs-[a-z-]+) ", self.driver)
        self.assertEqual(observed, ["obs-nested-test-added-after-install", "obs-root-file-added-after-install"])
        body = self.driver.split("observe() {", 1)[1].split("\n}\n", 1)[0]
        self.assertIn("OBSERVED", body)
        self.assertNotIn("PASS", body)
        self.assertNotIn("failures", body)

    def test_the_nested_ratchet_is_enforced_through_the_templates_own_audit(self):
        ratchet = (ROOT / "scripts" / "prism_nested_ratchet.sh").read_text()
        self.assertIn("audit_cmd=(cargo run -q --locked -p xtask -- audit-prism)", self.driver)
        self.assertIn('sdk "$label" "$projection" allowlist "$seed" "${audit_cmd[@]}"', self.driver)
        cases = {label: (baseline, want) for label, baseline, want in
                 re.findall(r'(?m)^ratchet ([a-z-]+) "\$(\w+)" (pass|refuse|observe) ', self.driver)}
        self.assertEqual(cases, {
            "ratchet-installing-commit": ("root_commit", "pass"),
            "ratchet-engaged-uncounted-change": ("install", "pass"),
            "nc-nested-ratchet-new-file": ("install", "refuse"),
            "nc-nested-ratchet-growth": ("install", "refuse"),
            "obs-first-parent-comparison-misses-the-launder": ("launder_a", "observe"),
            "nc-nested-ratchet-two-commit-launder": ("install", "refuse"),
            "obs-first-parent-comparison-resets-the-ceiling": ("reset_a", "observe"),
            "nc-nested-ratchet-move-then-restore": ("install", "refuse"),
            "nc-nested-ratchet-ignores-justfile": ("install", "refuse"),
            "nc-nested-ratchet-ignores-tampered-root-gate": ("install", "refuse"),
        })
        self.assertEqual(
            re.findall(r'(?m)^ratchet_refusal ([a-z-]+) "\$(\w+)" ', self.driver),
            [("refuse-ratchet-instance-moved", "install"), ("refuse-ratchet-audit-altered", "install"),
             ("refuse-ratchet-audit-dependency-altered", "install"), ("refuse-ratchet-build-script-added", "install"),
             ("refuse-ratchet-baseline-not-ancestor", "launder_a")])
        # The defects are planted under prism/, the accepted nested location, not in a root-level copy.
        for planted in ('"$repo/prism/crates/conformance/tests/added_later.rs"',
                        '"$repo/prism/crates/conformance/tests/eligibility.rs"'):
            self.assertIn(planted, self.driver)
        # Every judged case names its baseline, and the companion that runs is the trusted checkout's.
        self.assertNotIn('"$repo/scripts/prism_nested_ratchet.sh" "$repo"', self.driver)
        self.assertEqual(self.driver.count('"$sm/scripts/prism_nested_ratchet.sh" "$repo" "$baseline" "$(git -C "$repo" rev-parse HEAD)"'), 2)
        # The companion measures with upstream's code: it holds no counting rules of its own.
        code = [line for line in ratchet.splitlines() if line.strip() and not line.lstrip().startswith("#")]
        for own_rule in ("wc -l", "LANGUAGES", "lines in"):
            self.assertFalse([line for line in code if own_rule in line], own_rule)
        self.assertIn("scripts/prism_nested_ratchet.sh", self.text)

    def test_a_change_under_prism_starts_the_workflow_and_an_installed_instance_is_not_silently_passed(self):
        paths = self.text.split("pull_request:", 1)[1].split("permissions:", 1)[0]
        self.assertIn("- 'prism/**'", paths)
        self.assertIn("- 'scripts/prism_nested_ratchet.sh'", paths)
        # Until the installing change wires the gate for an installed prism/, such a revision must fail, not pass.
        self.assertIn('if [[ -e $repo/prism ]]; then', self.driver)
        self.assertRegex(self.driver, r'already contains prism/[^\n]*\n\s*exit 70')

    def test_tool_owned_files_come_from_the_tools(self):
        self.assertIn("lexlean lock; lexlean fmt; lexlean lock; lexlean fmt --check; lexlean lock --check", self.driver)
        self.assertIn("-----BEGIN LEXLEAN LOCK-----", self.jobs["sdk"])

    def test_real_output_takes_its_digest_from_the_receipt_and_checks_the_runtime_tarball(self):
        real = self.jobs["real-output"]
        self.assertIn('test "$actual" = "$PRISM_CODE_INTEGRITY"', real)
        self.assertIn("--ignore-scripts", real)
        self.assertIn("receipts/eligibility/manifest.json", real)
        acceptance = ACCEPTANCE.read_text()
        self.assertIn('--sha256 "$expected"', acceptance)
        self.assertNotIn("allow-unverified", acceptance)
        self.assertNotIn("allowUnverified", acceptance)
        self.assertNotRegex(acceptance, r"EVIDENCE_UNQUALIFIED|RIGHTS_UNRESOLVED|AUTHORITY_EXCEEDED|OUTCOME_UNCOVERED",
                            "the acceptance script must hold no eligibility logic or expected decisions of its own")

    def test_the_assurance_experiment_runs_offline_on_a_copy_and_asserts_nothing(self):
        block = ACCEPTANCE.read_text().split("# --- assurance:", 1)[1]
        self.assertIn("EXPERIMENT ONLY", block)
        self.assertIn("sudo -n unshare --net", block)
        self.assertIn('cp "$holo" "$copy"', block)
        self.assertNotRegex(block, r"(?m)^\s*check \S", "the experiment must add no row to the results")
        self.assertNotIn("failures=$((failures + 1))", block)
        self.assertNotRegex(block, r"attest[^\n]*\"\$holo\"", "the original holo must never be signed in place")


if __name__ == "__main__":
    unittest.main()
 + field + '" = success', decision)
        publisher = self.jobs["publish-evidence"]
        self.assertEqual(re.findall(r"(?m)^    permissions:\n((?:      .+\n)+)", publisher), ["      contents: write\n"])

    def test_no_secret_token_or_oidc_is_referenced_anywhere(self):
        for forbidden in ("secrets.", "github.token", "GITHUB_TOKEN", "id-token", "ACTIONS_RUNTIME_TOKEN", "docker login"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, self.text)

    def test_the_sdk_never_gets_the_docker_socket_or_extra_privilege(self):
        for source in (self.text, self.driver):
            for forbidden in ("docker.sock", "--privileged", "--cap-add", "--pid", "--network host",
                              "disposable-daemon\n", "PRISM_GATE_DOCKER_SOCKET=disposable-daemon",
                              "PRISM_GATE_HOST_NETWORK"):
                with self.subTest(forbidden=forbidden):
                    self.assertNotIn(forbidden, source)
        # The socket variable appears once, with a value the wrapper must refuse.
        self.assertNotIn("PRISM_GATE_DOCKER_SOCKET", self.text)
        self.assertEqual(re.findall(r"PRISM_GATE_DOCKER_SOCKET\S*", self.driver), ["PRISM_GATE_DOCKER_SOCKET=1"])
        self.assertRegex(self.driver, r"(?m)^refusal refuse-socket-without-exact-opt-in .* PRISM_GATE_DOCKER_SOCKET=1 -- ")

    def test_every_issue_9_refusal_is_exercised_on_the_runner_before_any_gate_container(self):
        labels = re.findall(r"(?m)^\s*refusal (refuse-[a-z-]+) ", self.driver)
        for needed in ("credential-variable", "credential-store", "symlinked-checkout", "dirty-tree",
                       "unexpected-sdk-digest", "socket-without-exact-opt-in", "host-network-without-opt-in",
                       "shared-network", "missing-network", "network-not-internal", "existing-workdir",
                       "workdir-inside-source"):
            with self.subTest(refusal=needed):
                self.assertIn(f"refuse-{needed}", labels)
        self.assertLess(self.driver.index("refusal refuse-credential-variable"), self.driver.index("must_pass egress-control"))
        self.assertIn('[[ $rc -ne 77 ]]', self.driver)
        self.assertIn('result="FAIL(a container was started)"', self.driver)

    def test_jobs_that_touch_the_sdk_or_the_holo_use_no_checkout_action(self):
        for name in ("sdk", "real-output"):
            with self.subTest(job=name):
                self.assertNotIn("actions/checkout", self.jobs[name])
                self.assertIn('remote add origin "https://github.com/$', self.jobs[name])
        self.assertIn("actions/checkout@", self.jobs["publish-evidence"])

    def test_the_publisher_never_runs_the_sdk_image_the_runtime_or_the_holo(self):
        publisher = self.jobs["publish-evidence"]
        for forbidden in ("docker ", "SDK_IMAGE", "prism_native_gate", "npm ", "node ", "prism-code", "sm01_"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, publisher)
        self.assertIn("needs: [sdk, real-output]", publisher)
        self.assertIn("find \"$dest\" -type l -delete", publisher)

    def test_every_action_is_pinned_to_a_full_commit(self):
        uses = re.findall(r"uses: (\S+)", self.text)
        self.assertGreaterEqual(len(uses), 5)
        for reference in uses:
            with self.subTest(action=reference):
                self.assertRegex(reference, r"^actions/[a-z-]+@[0-9a-f]{40}$")

    def test_fork_pull_requests_cannot_start_the_sdk_or_the_publisher(self):
        guard = "github.event.pull_request.head.repo.full_name == github.repository"
        self.assertIn(guard, self.jobs["sdk"])
        self.assertIn(guard, self.jobs["publish-evidence"])
        self.assertNotIn("pull_request_target", self.text)

    def test_the_network_is_internal_with_exactly_the_recorded_allowlist(self):
        sdk = self.jobs["sdk"]
        self.assertIn("docker network create --internal ", sdk)
        self.assertEqual(set(re.findall(r"--allow (\S+)", sdk)), ALLOWLIST)
        self.assertIn("iptables -I INPUT 1 -i prismgate0 -j DROP", sdk)
        self.assertIn("PRISM_GATE_EGRESS_NETWORK=prism-gate-egress", sdk)
        networks = set(re.findall(r'(?m)^\s*(?:must_pass|sdk) \S+ "\$\w+" (\w+) ', self.driver))
        self.assertEqual(networks, {"none", "allowlist"})

    def test_the_gate_user_runs_in_a_scrubbed_environment_with_an_empty_home(self):
        sdk = self.jobs["sdk"]
        self.assertGreaterEqual(sdk.count('sudo -u "$GATE_USER" env -i PATH="$CLEAN_PATH" HOME="$BASE/home"'), 2)
        self.assertIn('sudo install -d -m 0700 -o 1000 -g 1000 "$BASE/home"', sdk)
        self.assertIn("exit 77", sdk)

    def test_pins_agree_with_the_wrapper_and_the_instance_script(self):
        image = re.search(r"(?m)^  SDK_IMAGE: (\S+)$", self.text).group(1)
        pin = re.search(r"(?m)^  TEMPLATE_PIN: ([0-9a-f]{40})$", self.text).group(1)
        self.assertIn(f"DEFAULT_IMAGE='{image}'", WRAPPER.read_text())
        self.assertIn(f"PIN={pin}", INSTANCE.read_text())
        self.assertRegex(image, r"@sha256:[0-9a-f]{64}$")
        self.assertIn('docker pull --quiet "$SDK_IMAGE"', self.jobs["sdk"])

    def test_the_driver_runs_the_unreduced_gate_and_judges_controls_by_their_diagnostic(self):
        self.assertIn("'vv: the acceptance gate passed' just vv", self.driver)
        self.assertEqual(len(re.findall(r"(?m)^\s*(?:if )?must_pass \S+ \S+ \S+ \S+ '[^']*' just vv", self.driver)), 2)
        self.assertNotRegex(self.driver, r"just vv\S*\s+--|just --\S+ vv|SKIP|--no-verify")
        controls = re.findall(r"(?m)^control (nc-[a-z-]+) '([^']+)'", self.driver)
        self.assertGreaterEqual(len(controls), 12)
        self.assertEqual(len({name for name, _ in controls}), len(controls))
        for name, diagnostic in controls:
            with self.subTest(control=name):
                self.assertGreaterEqual(len(diagnostic), 6)
        for fact in ("evidence", "rights", "authority", "coverage"):
            with self.subTest(fact=fact):
                self.assertIn(f"nc-{fact}-check-dropped", dict(controls))
        self.assertIn('result="FAIL(accepted)"', self.driver)
        self.assertIn('result="FAIL(wrong diagnostic)"', self.driver)

    def test_the_ratchet_is_a_control_only_where_it_can_engage(self):
        # audit-prism reads its ceiling at a root-relative path, so it is judged in a
        # root-level instance and only observed in the nested one.
        self.assertIn('sdk nc-ratchet-root-layout "$rootrepo" allowlist "$seed" just model', self.driver)
        self.assertIn('record nc-ratchet-root-layout allowlist "refusal: new non-Prism file"', self.driver)
        self.assertNotRegex(self.driver, r"(?m)^control \S*ratchet")
        observed = re.findall(r"(?m)^observe (obs-[a-z-]+) ", self.driver)
        self.assertEqual(observed, ["obs-nested-test-added-after-install", "obs-root-file-added-after-install"])
        body = self.driver.split("observe() {", 1)[1].split("\n}\n", 1)[0]
        self.assertIn("OBSERVED", body)
        self.assertNotIn("PASS", body)
        self.assertNotIn("failures", body)

    def test_the_nested_ratchet_is_enforced_through_the_templates_own_audit(self):
        ratchet = (ROOT / "scripts" / "prism_nested_ratchet.sh").read_text()
        self.assertIn("audit_cmd=(cargo run -q --locked -p xtask -- audit-prism)", self.driver)
        self.assertIn('sdk "$label" "$projection" allowlist "$seed" "${audit_cmd[@]}"', self.driver)
        cases = {label: (baseline, want) for label, baseline, want in
                 re.findall(r'(?m)^ratchet ([a-z-]+) "\$(\w+)" (pass|refuse|observe) ', self.driver)}
        self.assertEqual(cases, {
            "ratchet-installing-commit": ("root_commit", "pass"),
            "ratchet-engaged-uncounted-change": ("install", "pass"),
            "nc-nested-ratchet-new-file": ("install", "refuse"),
            "nc-nested-ratchet-growth": ("install", "refuse"),
            "obs-first-parent-comparison-misses-the-launder": ("launder_a", "observe"),
            "nc-nested-ratchet-two-commit-launder": ("install", "refuse"),
            "obs-first-parent-comparison-resets-the-ceiling": ("reset_a", "observe"),
            "nc-nested-ratchet-move-then-restore": ("install", "refuse"),
            "nc-nested-ratchet-ignores-justfile": ("install", "refuse"),
            "nc-nested-ratchet-ignores-tampered-root-gate": ("install", "refuse"),
        })
        self.assertEqual(
            re.findall(r'(?m)^ratchet_refusal ([a-z-]+) "\$(\w+)" ', self.driver),
            [("refuse-ratchet-instance-moved", "install"), ("refuse-ratchet-audit-altered", "install"),
             ("refuse-ratchet-audit-dependency-altered", "install"), ("refuse-ratchet-build-script-added", "install"),
             ("refuse-ratchet-baseline-not-ancestor", "launder_a")])
        # The defects are planted under prism/, the accepted nested location, not in a root-level copy.
        for planted in ('"$repo/prism/crates/conformance/tests/added_later.rs"',
                        '"$repo/prism/crates/conformance/tests/eligibility.rs"'):
            self.assertIn(planted, self.driver)
        # Every judged case names its baseline, and the companion that runs is the trusted checkout's.
        self.assertNotIn('"$repo/scripts/prism_nested_ratchet.sh" "$repo"', self.driver)
        self.assertEqual(self.driver.count('"$sm/scripts/prism_nested_ratchet.sh" "$repo" "$baseline" "$(git -C "$repo" rev-parse HEAD)"'), 2)
        # The companion measures with upstream's code: it holds no counting rules of its own.
        code = [line for line in ratchet.splitlines() if line.strip() and not line.lstrip().startswith("#")]
        for own_rule in ("wc -l", "LANGUAGES", "lines in"):
            self.assertFalse([line for line in code if own_rule in line], own_rule)
        self.assertIn("scripts/prism_nested_ratchet.sh", self.text)

    def test_a_change_under_prism_starts_the_workflow_and_an_installed_instance_is_not_silently_passed(self):
        paths = self.text.split("pull_request:", 1)[1].split("permissions:", 1)[0]
        self.assertIn("- 'prism/**'", paths)
        self.assertIn("- 'scripts/prism_nested_ratchet.sh'", paths)
        # Until the installing change wires the gate for an installed prism/, such a revision must fail, not pass.
        self.assertIn('if [[ -e $repo/prism ]]; then', self.driver)
        self.assertRegex(self.driver, r'already contains prism/[^\n]*\n\s*exit 70')

    def test_tool_owned_files_come_from_the_tools(self):
        self.assertIn("lexlean lock; lexlean fmt; lexlean lock; lexlean fmt --check; lexlean lock --check", self.driver)
        self.assertIn("-----BEGIN LEXLEAN LOCK-----", self.jobs["sdk"])

    def test_real_output_takes_its_digest_from_the_receipt_and_checks_the_runtime_tarball(self):
        real = self.jobs["real-output"]
        self.assertIn('test "$actual" = "$PRISM_CODE_INTEGRITY"', real)
        self.assertIn("--ignore-scripts", real)
        self.assertIn("receipts/eligibility/manifest.json", real)
        acceptance = ACCEPTANCE.read_text()
        self.assertIn('--sha256 "$expected"', acceptance)
        self.assertNotIn("allow-unverified", acceptance)
        self.assertNotIn("allowUnverified", acceptance)
        self.assertNotRegex(acceptance, r"EVIDENCE_UNQUALIFIED|RIGHTS_UNRESOLVED|AUTHORITY_EXCEEDED|OUTCOME_UNCOVERED",
                            "the acceptance script must hold no eligibility logic or expected decisions of its own")

    def test_the_assurance_experiment_runs_offline_on_a_copy_and_asserts_nothing(self):
        block = ACCEPTANCE.read_text().split("# --- assurance:", 1)[1]
        self.assertIn("EXPERIMENT ONLY", block)
        self.assertIn("sudo -n unshare --net", block)
        self.assertIn('cp "$holo" "$copy"', block)
        self.assertNotRegex(block, r"(?m)^\s*check \S", "the experiment must add no row to the results")
        self.assertNotIn("failures=$((failures + 1))", block)
        self.assertNotRegex(block, r"attest[^\n]*\"\$holo\"", "the original holo must never be signed in place")


if __name__ == "__main__":
    unittest.main()
