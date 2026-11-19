"""Consistency checks of committed native-gate evidence. No Prism tool is executed.

Every directory under docs/evidence/prism-native-gate-runs/ is a set of files a
workflow run uploaded and a bot committed unedited. These tests show that the
files agree with their own checksums and with each other, and that the authored
record quotes them exactly. They do not re-run anything, and agreement between
files written by one toolchain is not independent verification of that toolchain.
"""
from pathlib import Path
import csv
import hashlib
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "docs" / "evidence" / "prism-native-gate-runs"
RECORD = ROOT / "docs" / "evidence" / "prism-qse-20261118" / "README.md"
IMAGE_DIGEST = "sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3"
TEMPLATE_PIN = "b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b"
OLD_NAME_HOLO = "4092fea915c0c718c668be332c076c75d8593836e2a055e604b4772026ee6962"
ALLOWLIST = {"static.crates.io:443", "index.crates.io:443", "github.com:443"}
APPLICATION = "Qortara Skills Eligibility"
PREFIX = "QortaraSkillsEligibility.Eligibility."


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t", quoting=csv.QUOTE_NONE))


def holo_digests(manifest: Path) -> set[str]:
    found = set()

    def walk(node):
        if isinstance(node, dict):
            if str(node.get("path", "")).endswith(".holo") and "sha256" in node:
                found.add(node["sha256"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(json.loads(manifest.read_text(encoding="utf-8")))
    return found


def run_directories() -> list[Path]:
    return sorted(p for p in RUNS.iterdir() if p.is_dir()) if RUNS.is_dir() else []


@unittest.skipUnless(run_directories(), "no native gate run has been committed")
class NativeGateEvidenceTests(unittest.TestCase):
    def each_run(self):
        for run in run_directories():
            with self.subTest(run=run.name):
                yield run

    def test_every_file_matches_the_checksums_the_runner_side_wrote(self):
        for run in self.each_run():
            listed = {}
            for line in (run / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
                digest, name = line.split("  ", 1)
                listed[name.removeprefix("./")] = digest
            present = {
                p.relative_to(run).as_posix()
                for p in run.rglob("*")
                if p.is_file() and p.name != "SHA256SUMS"
            }
            self.assertEqual(present, set(listed), "files were added or removed after the run")
            for name, digest in listed.items():
                self.assertEqual(sha256(run / name), digest, name)
            self.assertFalse([p for p in run.rglob("*") if p.is_symlink()])

    def test_the_run_states_its_isolation_and_its_exact_inputs(self):
        for run in self.each_run():
            for phase in ("reference", "author", "nested"):
                text = (run / phase / "run.txt").read_text()
                self.assertIn("docker_socket_bound_into_sdk_container=no token_permissions=none secrets=none", text)
                self.assertIn("runner=github-hosted Linux X64", text)
                identities = (run / phase / "out" / "identities.txt").read_text()
                self.assertIn(f"template_commit={TEMPLATE_PIN}", identities)
                self.assertIn(f"@{IMAGE_DIGEST}", identities)
                self.assertRegex(identities, r"(?m)^failures=0$")
                self.assertIn(IMAGE_DIGEST, (run / phase / "sdk-image.txt").read_text())
            subjects = {
                re.search(r"subject_sha=([0-9a-f]{40})", (run / phase / "run.txt").read_text()).group(1)
                for phase in ("reference", "author", "nested")
            }
            self.assertEqual(len(subjects), 1, "the phases ran different revisions")

    def test_every_sdk_log_ran_without_the_socket_on_none_or_the_allowlist(self):
        for run in self.each_run():
            logs = sorted(run.glob("*/logs/*.log"))
            self.assertGreaterEqual(len(logs), 20)
            for log in logs:
                text = log.read_text(encoding="utf-8", errors="replace")
                header = text.splitlines()[1]
                self.assertIn("docker_socket=not-mounted", header, log.name)
                self.assertRegex(header, r" net=(none|allowlist) ", log.name)
                self.assertIn(f"image=ghcr.io/afflom/prismpm-sdk-patched@{IMAGE_DIGEST}", header, log.name)
                self.assertRegex(text, r"(?m)^GATE_EXIT=\d+ image=\S+@sha256:[0-9a-f]{64} ", log.name)

    def test_the_complete_gate_passed_for_the_reference_and_the_nested_instance(self):
        for run in self.each_run():
            for phase, label in (("reference", "ref-vv"), ("nested", "sm01-vv")):
                text = (run / phase / "logs" / f"{label}.log").read_text(encoding="utf-8", errors="replace")
                self.assertIn("vv: the acceptance gate passed", text)
                self.assertRegex(text, r"(?m)^GATE_EXIT=0 .* net=allowlist .*cmd=just vv$")
                self.assertIn("validate: every gate passed", text)
                self.assertIn("template contract passed", text)
                self.assertIn("advisories ok, bans ok, licenses ok, sources ok", text)
            nested = (run / "nested" / "logs" / "sm01-vv.log").read_text(encoding="utf-8", errors="replace")
            self.assertIn("installed here; the parent ran no ratchet, so this commit sets the ceiling", nested)
            self.assertIn("prismpm --project eligibility verify", nested)
            self.assertEqual(len(re.findall(r"(?m)^verified attestation: [0-9a-f]{64}$", nested)), 2)

    def test_every_summary_row_passed_and_every_control_was_a_refusal(self):
        for run in self.each_run():
            table = rows(run / "nested" / "out" / "summary.tsv")
            results = {row["label"]: row for row in table}
            for label in ("pre-canonical", "egress-control", "sm01-vv", "sm01-eligibility-offline", "repeat-identical"):
                self.assertEqual(results[label]["result"], "PASS", label)
            controls = [row for row in table if row["label"].startswith("nc-")]
            self.assertGreaterEqual(len(controls), 13)
            for row in controls:
                self.assertEqual(row["result"], "PASS", row["label"])
                self.assertNotEqual(row["exit"], "0", row["label"])
                log = (run / "nested" / "logs" / f"{row['label']}.log").read_text(encoding="utf-8", errors="replace")
                diagnostic = row["expected"].removeprefix("refusal: ")
                self.assertRegex(log, diagnostic, row["label"])
                self.assertNotRegex(log, r"(?m)^GATE_EXIT=0 ", row["label"])
            for fact in ("evidence", "rights", "authority", "coverage"):
                self.assertIn(f"nc-{fact}-check-dropped", results)
            self.assertFalse([row["label"] for row in table if row["result"] not in ("PASS", "OBSERVED")])
            for phase in ("reference", "author"):
                self.assertTrue(all(row["result"] == "PASS" for row in rows(run / phase / "out" / "summary.tsv")))

    def test_the_nested_ratchet_engaged_and_refused_the_defects_planted_under_prism(self):
        """Every committed run must show the template's own audit refusing defects planted under prism/.

        Runs made after the comparison was anchored to a named baseline carry more cases:
        two-commit laundering, move-then-restore, a gutted root gate, the audit's build
        closure and a non-ancestor baseline. A run is held to the set its own driver planted.
        """
        for run in self.each_run():
            results = {row["label"]: row for row in rows(run / "nested" / "out" / "summary.tsv")}
            logs = run / "nested" / "logs"
            read = lambda name: (logs / name).read_text(encoding="utf-8", errors="replace")
            install = re.search(r"staged_install_commit=([0-9a-f]{40})", (run / "nested" / "out" / "identities.txt").read_text()).group(1)
            anchored = "nc-nested-ratchet-two-commit-launder" in results
            # The installing commit passes and sets the ceiling.
            self.assertEqual((results["ratchet-installing-commit"]["exit"], results["ratchet-installing-commit"]["result"]), ("0", "PASS"))
            self.assertRegex(read("ratchet-installing-commit.log"), r"audit-prism: a root commit; non-Prism implementation is \d+ lines in \d+ files")
            # A later commit is compared with the commit before it: the ratchet is engaged.
            self.assertEqual(results["ratchet-engaged-uncounted-change"]["result"], "PASS")
            self.assertRegex(read("ratchet-engaged-uncounted-change.log"), r"files in the parent\); it only shrinks")
            # The actual nested defects are refused by the template's own audit.
            refused = [("nc-nested-ratchet-new-file", "new non-Prism file"),
                       ("nc-nested-ratchet-growth", "non-Prism implementation grew by"),
                       ("nc-nested-ratchet-ignores-justfile", "new non-Prism file")]
            if anchored:
                refused += [("nc-nested-ratchet-two-commit-launder", "new non-Prism file"),
                            ("nc-nested-ratchet-move-then-restore", "new non-Prism file"),
                            ("nc-nested-ratchet-ignores-tampered-root-gate", "new non-Prism file")]
            for label, words in refused:
                self.assertEqual(results[label]["result"], "PASS", label)
                self.assertNotEqual(results[label]["exit"], "0", label)
                text = read(f"{label}.log")
                self.assertIn(words, text, label)
                self.assertIn("audit-prism: only Prism may be implemented here", text, label)
                self.assertRegex(text, r"cmd=cargo run -q --locked -p xtask -- audit-prism\s*$", label)
                state = (logs / "ratchet" / f"{label}.txt").read_text()
                self.assertIn("RATCHET_STATE=engaged", state, label)
                self.assertIn("instance=prism ", state, label)
                # Each was measured against the installing commit: named as the baseline in
                # anchored runs, and the first parent of a single planted commit before that.
                self.assertIn(f"{'baseline' if anchored else 'parent'}={install} ", state, label)
            # Moving the instance or changing the audit is refused before any audit runs.
            pre_audit = [("refuse-ratchet-instance-moved", "moved or removed"),
                         ("refuse-ratchet-audit-altered", "prism/xtask/src/audit.rs differs from the template pin")]
            if anchored:
                pre_audit += [("refuse-ratchet-audit-dependency-altered", "prism/crates/model/src/lib.rs differs from the template pin"),
                              ("refuse-ratchet-build-script-added", "holds files the template pin does not"),
                              ("refuse-ratchet-baseline-not-ancestor", "is not an ancestor of the candidate")]
            for label, words in pre_audit:
                self.assertEqual((results[label]["exit"], results[label]["result"]), ("77", "PASS"), label)
                self.assertIn(words, (logs / "ratchet" / f"{label}.txt").read_text(), label)
                self.assertFalse((logs / f"{label}.log").exists(), "a refusal must not have reached the SDK")
            # What upstream's own gate does in each layout, recorded beside it.
            self.assertEqual(results["nc-ratchet-root-layout"]["result"], "PASS")
            self.assertEqual(results["obs-nested-test-added-after-install"]["result"], "OBSERVED")
            self.assertIn("installed here; the parent ran no ratchet", read("obs-nested-test-added-after-install.log"))
            if anchored:
                # The same final commits, judged against a first parent, are recorded as what they are.
                launder = (logs / "ratchet" / "nc-nested-ratchet-two-commit-launder.txt").read_text()
                first_parent = (logs / "ratchet" / "obs-first-parent-comparison-misses-the-launder.txt").read_text()
                candidate = re.search(r"candidate=([0-9a-f]{40})", launder).group(1)
                self.assertIn(f"candidate={candidate} ", first_parent, "both judgements are of the same final commit")
                self.assertNotIn(f"baseline={install} ", first_parent)
                self.assertEqual(results["obs-first-parent-comparison-misses-the-launder"]["result"], "OBSERVED")
                self.assertEqual(results["obs-first-parent-comparison-resets-the-ceiling"]["result"], "OBSERVED")
                self.assertIn("RATCHET_STATE=installing", (logs / "ratchet" / "obs-first-parent-comparison-resets-the-ceiling.txt").read_text())

    @unittest.skipUnless(RECORD.is_file(), "the authored record is not written yet")
    def test_the_record_names_which_runs_carry_the_baseline_anchored_ratchet_controls(self):
        record = RECORD.read_text(encoding="utf-8")
        for run in run_directories():
            labels = {row["label"] for row in rows(run / "nested" / "out" / "summary.tsv")}
            anchored = "nc-nested-ratchet-two-commit-launder" in labels
            self.assertIn(run.name, record, "every committed run is accounted for in the record")
            marker = f"`{run.name}`: baseline-anchored ratchet controls {'present' if anchored else 'absent'}"
            self.assertIn(marker, record)
            if f"`{run.name}`: baseline-anchored ratchet controls" in record and "the run this record's tables are copied from" in \
                    next(line for line in record.splitlines() if line.startswith(f"- `{run.name}`:")):
                self.assertTrue(anchored, "the record's tables must come from a run that carries the baseline-anchored controls")
        primary = [line for line in record.splitlines() if "the run this record's tables are copied from" in line]
        self.assertEqual(len(primary), 1, "exactly one committed run is the record's source")

    def test_committed_runs_built_the_same_artifact(self):
        runs = run_directories()
        holos = {sha256(run / "nested" / "out" / "holo" / "eligibility.holo") for run in runs}
        attestations = {sha256(run / "nested" / "out" / "receipts" / "eligibility" / "manifest.json") for run in runs}
        self.assertEqual(len(holos), 1, "runs on separate runners at the same overlay built different holo bytes")
        self.assertEqual(len(attestations), 1)
        if len(runs) > 1 and RECORD.is_file():
            subjects = {re.search(r"subject_sha=([0-9a-f]{40})", (run / "nested" / "run.txt").read_text()).group(1) for run in runs}
            self.assertEqual(len(subjects), len(runs), "each committed run is of a different subject revision")
            self.assertIn(f"{len(runs)} committed runs on separate runner virtual machines", RECORD.read_text(encoding="utf-8"))

    def test_every_wrapper_refusal_fired_on_the_runner_without_starting_a_container(self):
        for run in self.each_run():
            results = {row["label"]: row for row in rows(run / "nested" / "out" / "summary.tsv")}
            refusals = [label for label in results if label.startswith("refuse-") and "ratchet" not in label]
            self.assertGreaterEqual(len(refusals), 12)
            for label in refusals:
                self.assertEqual((results[label]["exit"], results[label]["result"]), ("77", "PASS"), label)
                text = (run / "nested" / "logs" / "refusals" / f"{label}.txt").read_text()
                self.assertIn("REFUSED before starting a container", text, label)
            self.assertEqual(results["refusals-left-the-source-untouched"]["result"], "PASS")
            self.assertNotIn("placeholder", (run / "nested" / "logs" / "refusals" / "refuse-credential-variable.txt").read_text())

    def test_receipts_bind_the_renamed_application_and_the_built_holo(self):
        for run in self.each_run():
            folder = run / "nested" / "out" / "receipts" / "eligibility"
            attestation_id = sha256(folder / "manifest.json")
            gate = (run / "nested" / "logs" / "sm01-vv.log").read_text(encoding="utf-8", errors="replace")
            self.assertIn(f"verified attestation: {attestation_id}", gate)
            offline = (run / "nested" / "logs" / "sm01-eligibility-offline.log").read_text(encoding="utf-8", errors="replace")
            self.assertIn(f"verified attestation: {attestation_id}", offline)
            self.assertRegex(offline, r"(?m)^GATE_EXIT=0 .* net=none ")
            acceptance = json.loads((folder / "application-acceptance.json").read_text())
            self.assertEqual(acceptance["schema"], "prismpm/application-acceptance/1")
            self.assertEqual(acceptance["application"], APPLICATION)
            self.assertEqual(acceptance["status"], "verified")
            self.assertEqual(acceptance["regeneration"], "byte-identical")
            self.assertEqual(acceptance["modeled_vectors"], 12)
            holo = run / "nested" / "out" / "holo" / "eligibility.holo"
            digests = holo_digests(folder / "manifest.json")
            self.assertEqual(digests, {sha256(holo)})
            self.assertNotEqual(sha256(holo), OLD_NAME_HOLO, "the renamed application must be a new artifact")

    def test_axiom_policy_matches_observation_for_every_declaration(self):
        for run in self.each_run():
            attestation = json.loads((run / "nested" / "out" / "receipts" / "eligibility" / "lexlean-attestation.json").read_text())
            self.assertEqual(attestation["status"], "verified")
            ours = [d for d in attestation["declarations"] if d["name"].startswith(PREFIX)]
            self.assertEqual(len(ours), 11)
            for declaration in ours:
                self.assertEqual(declaration["result"], "ok", declaration["name"])
                self.assertEqual(declaration["observed"], declaration["policy"]["axioms"], declaration["name"])
            theorem = next(d for d in ours if d["name"].endswith(".eligible_decides"))
            self.assertEqual(theorem["observed"], ["propext"])
            self.assertFalse([d["name"] for d in attestation["declarations"] if "SkillMason" in d["name"]])

    def test_the_tool_written_lock_is_the_committed_lock(self):
        for run in self.each_run():
            identities = (run / "author" / "out" / "identities.txt").read_text()
            self.assertIn("author_drift_files=0", identities)
            emitted = run / "author" / "out" / "regenerated" / "eligibility" / "lexlean.lock"
            committed = ROOT / "prism-overlay" / "files" / "eligibility" / "lexlean.lock"
            self.assertEqual(emitted.read_bytes(), committed.read_bytes())

    def test_egress_was_only_to_the_allowlist_and_the_control_was_denied(self):
        for run in self.each_run():
            for phase in ("reference", "author", "nested"):
                lines = (run / phase / "egress-proxy.log").read_text().splitlines()
                verdicts = [line.split(" ")[1:3] for line in lines]
                self.assertEqual(verdicts[0][0], "START")
                allowed = {target for verdict, target in verdicts if verdict == "ALLOW"}
                self.assertLessEqual(allowed, ALLOWLIST, phase)
            nested = (run / "nested" / "egress-proxy.log").read_text()
            self.assertIn("DENY example.com:443 not-on-allowlist", nested)
            self.assertIn("ALLOW static.crates.io:443", nested)
            control = (run / "nested" / "logs" / "egress-control.log").read_text()
            self.assertIn("direct egress refused", control)
            # The command's own text is quoted only on the closing GATE_EXIT line.
            self.assertNotIn("DIRECT_EGRESS_OPEN", control.split("GATE_EXIT")[0])
            self.assertNotIn("RUNNER_PORT_OPEN", control.split("GATE_EXIT")[0])

    def test_real_holo_outputs_came_from_the_same_digest(self):
        for run in self.each_run():
            real = run / "real-output"
            holo = sha256(run / "nested" / "out" / "holo" / "eligibility.holo")
            identity = (real / "identity.txt").read_text()
            self.assertIn(f"holo_sha256_from_manifest={holo}", identity)
            self.assertIn(f"holo_sha256_of_file={holo}", identity)
            self.assertIn("prism_code=0.9.5", identity)
            self.assertRegex(identity, r"(?m)^failures=0$")
            self.assertTrue(all(row["result"] == "PASS" for row in rows(real / "results.tsv")))
            for name in ("sm01-probe-report.json", "cli-probe-report.json"):
                report = json.loads((real / name).read_text())
                self.assertEqual(report["artifact"]["sha256"], holo, name)
                self.assertEqual((report["passed"], report["total"], report["verdict"]), (12, 12, "FIXTURE_PASS"), name)
                self.assertFalse(report["productionEligible"])
                for test in report["tests"]:
                    self.assertEqual(test["actual"], test["expected"], test["case"])
                    self.assertEqual(test["exitCode"], 0, test["case"])
            evaluated = rows(real / "cli-evaluate.tsv")
            self.assertEqual(sum(row["result"] == "PASS" for row in evaluated), 12)
            self.assertFalse([row["case"] for row in evaluated if row["result"] == "FAIL"])
            independent = (real / "independent-prism-code.txt").read_text()
            self.assertIn(f"12 of 12 vectors passed (holo, {APPLICATION}, identities verified)", independent)
            self.assertIn("digest_mismatch", independent)

    def test_assurance_is_reported_as_the_checker_graded_it(self):
        for run in self.each_run():
            identity = (run / "real-output" / "identity.txt").read_text()
            grade = re.search(r"(?m)^assurance_grade_observed=(P[0-3] \w+)", identity).group(1)
            independent = (run / "real-output" / "independent-prism-code.txt").read_text()
            self.assertIn(grade, independent)
            if RECORD.is_file():
                self.assertIn(grade, RECORD.read_text(encoding="utf-8"))

    @unittest.skipUnless(RECORD.is_file(), "the authored record is not written yet")
    def test_the_authored_record_quotes_the_run_exactly_and_states_its_limits(self):
        record = RECORD.read_text(encoding="utf-8")
        for run in self.each_run():
            if run.name not in record:
                continue
            folder = run / "nested" / "out" / "receipts" / "eligibility"
            acceptance = json.loads((folder / "application-acceptance.json").read_text())
            for value in (
                sha256(folder / "manifest.json"),
                sha256(run / "nested" / "out" / "holo" / "eligibility.holo"),
                acceptance["holo"]["archive_fingerprint"],
                re.search(r"subject_sha=([0-9a-f]{40})", (run / "nested" / "run.txt").read_text()).group(1),
            ):
                self.assertIn(value, record)
        self.assertTrue(any(run.name in record for run in run_directories()), "the record cites no committed run")
        for phrase in (
            "P0 unverified",
            "NOT_INSTALLED",
            "not an accepted production release",
            "advisory database",
            "trust root",
            "fixture",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, record)


if __name__ == "__main__":
    unittest.main()
