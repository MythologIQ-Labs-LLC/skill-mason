"""Static consistency checks of the Prism eligibility overlay. No Prism tool is executed.

These tests read the authored model as text. Passing them says the committed
files agree with each other and with an independent oracle. It does not say
the model is proved or the application verified: only the pinned toolchain's
complete gate can say that.
"""
from pathlib import Path
import hashlib
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
OVERLAY = ROOT / "prism-overlay"
MODEL = OVERLAY / "files" / "eligibility" / "src" / "Eligibility.lex.tex"
EVIDENCE = ROOT / "docs" / "evidence" / "prism-phase0-20261117"
TEMPLATE_PIN = "b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b"
REASONS = (
    " EVIDENCE_UNQUALIFIED",
    " RIGHTS_UNRESOLVED",
    " AUTHORITY_EXCEEDED",
    " OUTCOME_UNCOVERED",
)
UNIVERSAL = (
    ".devcontainer/devcontainer.json",
    ".github/workflows/bootstrap.yml",
    "AGENTS.md",
    "VERIFICATION.md",
    "prismpm.lock",
    "template-contract.json",
    "template.lock",
)


def oracle(request: bytes) -> bytes:
    """The intended decision, written independently of the model."""
    if len(request) != 4:
        return b"invalid request"
    if all(code == 1 for code in request):
        return b"eligible"
    failing = "".join(r for code, r in zip(request, REASONS) if code != 1)
    return b"refused:" + failing.encode()


def vectors(model: str) -> list[tuple[bytes, bytes]]:
    pairs = re.findall(r"request := 0x([0-9a-f]*), response := 0x([0-9a-f]*)\}", model)
    return [(bytes.fromhex(a), bytes.fromhex(b)) for a, b in pairs]


class PrismOverlayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = MODEL.read_text(encoding="utf-8")
        cls.vectors = vectors(cls.model)

    def test_every_vector_agrees_with_the_independent_oracle(self):
        self.assertEqual(len(self.vectors), 12)
        for request, response in self.vectors:
            with self.subTest(request=request.hex()[:16]):
                self.assertEqual(response, oracle(request))

    def test_vectors_cover_every_outcome_class_and_boundary(self):
        requests = [r for r, _ in self.vectors]
        responses = {resp for _, resp in self.vectors}
        self.assertIn(b"eligible", responses)
        self.assertIn(b"invalid request", responses)
        for index, reason in enumerate(REASONS):
            single = bytes(0 if i == index else 1 for i in range(4))
            with self.subTest(reason=reason.strip()):
                self.assertIn(single, requests)
                self.assertIn(b"refused:" + reason.encode(), responses)
        self.assertIn(bytes(4), requests, "all four facts refused together")
        self.assertIn(b"", requests)
        self.assertTrue(any(len(r) == 3 for r in requests), "too short")
        self.assertTrue(any(len(r) == 5 for r in requests), "too long")
        self.assertTrue(any(len(r) == 512 for r in requests), "allocation boundary")

    def test_only_the_single_admitted_code_is_ever_eligible(self):
        eligible = [r for r, resp in self.vectors if resp == b"eligible"]
        self.assertEqual(eligible, [bytes([1, 1, 1, 1])])
        codes_seen = {code for r, _ in self.vectors if len(r) == 4 for code in r}
        self.assertTrue({0, 2, 255} <= codes_seen, "undefined and prohibited codes are exercised")
        for request, response in self.vectors:
            if len(request) == 4 and any(code != 1 for code in request):
                self.assertTrue(response.startswith(b"refused:"), request.hex())

    def test_model_states_the_claim_the_conformance_test_binds(self):
        self.assertIn(
            "statement: (((eligible request) = true) <-> (Eligible request)),", self.model
        )
        self.assertIn(
            "definition{name: admitted, parameters: [code : Nat], result: Bool, body: (code =? 1)}",
            self.model,
        )
        self.assertIn("capabilitiesEmpty := true", self.model)
        self.assertIn("requestMaximum := (4 : UInt32)", self.model)
        test = (OVERLAY / "files/crates/conformance/tests/eligibility.rs").read_text()
        self.assertIn("fn eligibility_sm_01()", test)
        self.assertNotIn("panic!(\"SM-01 is registered and not built", test)

    def test_overlay_touches_no_universal_policy_file(self):
        shipped = {
            p.relative_to(OVERLAY / "files").as_posix()
            for p in (OVERLAY / "files").rglob("*")
            if p.is_file()
        }
        patched = set(
            re.findall(r"^\+\+\+ b/(.+)$", (OVERLAY / "template.patch").read_text(), re.M)
        )
        self.assertEqual(patched, {"CONFORMANCE.md", "Justfile", "model/ids.toml"})
        for path in UNIVERSAL:
            with self.subTest(path=path):
                self.assertNotIn(path, shipped)
                self.assertNotIn(path, patched)

    def test_overlay_does_not_vendor_the_upstream_template(self):
        files = [p for p in (OVERLAY / "files").rglob("*") if p.is_file()]
        self.assertLessEqual(len(files), 12)
        self.assertFalse((OVERLAY / "files" / "eligibility" / "language").exists())
        self.assertFalse((OVERLAY / "files" / "eligibility" / "src" / "Foundation").exists())
        self.assertFalse((ROOT / "prism").exists(), "no instance is adopted before ADR-0003")

    def test_instance_script_pins_the_template_revision(self):
        script = (ROOT / "scripts" / "prism_instance.sh").read_text()
        self.assertIn(f"PIN={TEMPLATE_PIN}", script)
        self.assertNotIn("git apply", script.split("patch --quiet")[1])
        gate = (ROOT / "scripts" / "prism_reference_gate.sh").read_text()
        self.assertIn("@sha256:[0-9a-f]{64}$", gate, "only a digest-pinned image may run")
        self.assertNotIn("--privileged", gate)

    def test_overlay_is_documented_as_a_candidate(self):
        readme = (OVERLAY / "README.md").read_text()
        self.assertIn("candidate, not adopted", readme)
        self.assertIn("does not make Qortara Skills Prism-built", readme)
        for request, response in self.vectors:
            if 0 < len(request) <= 5:
                self.assertIn(f"`{request.hex()}` | `{response.decode()}`", readme)


class PrismEvidenceTests(unittest.TestCase):
    """The evidence record must quote its receipts exactly, and say what it did not establish."""

    @classmethod
    def setUpClass(cls):
        cls.record = (EVIDENCE / "README.md").read_text(encoding="utf-8")

    def test_attestation_id_is_the_manifest_digest(self):
        for name in ("reference", "eligibility"):
            with self.subTest(receipts=name):
                folder = EVIDENCE / "receipts" / name
                digest = hashlib.sha256((folder / "manifest.json").read_bytes()).hexdigest()
                self.assertIn(digest, self.record)
                log = "ref-vv-net1.log" if name == "reference" else "el-verify-2.log"
                self.assertIn(
                    f"verified attestation: {digest}", (EVIDENCE / "logs" / log).read_text()
                )

    def test_acceptance_receipts_say_verified_and_are_quoted(self):
        for path in sorted((EVIDENCE / "receipts").rglob("application-acceptance*.json")):
            with self.subTest(path=path.name):
                receipt = json.loads(path.read_text())
                self.assertEqual(receipt["schema"], "prismpm/application-acceptance/1")
                self.assertEqual(receipt["status"], "verified")
                self.assertEqual(receipt["regeneration"], "byte-identical")
                self.assertIn(receipt["holo"]["archive_fingerprint"], self.record)

    def test_reference_runs_differ_only_in_browser_timing(self):
        folder = EVIDENCE / "receipts" / "reference"
        one = json.loads((folder / "application-acceptance.run1.json").read_text())
        two = json.loads((folder / "application-acceptance.run2.json").read_text())
        one.pop("browser_timing")
        two.pop("browser_timing")
        self.assertEqual(one, two)

    def test_axiom_policy_matches_observation_for_every_declaration(self):
        attestation = json.loads(
            (EVIDENCE / "receipts" / "eligibility" / "lexlean-attestation.json").read_text()
        )
        self.assertEqual(attestation["status"], "verified")
        ours = [
            d
            for d in attestation["declarations"]
            if d["name"].startswith("SkillMasonEligibility.Eligibility.")
        ]
        self.assertEqual(len(ours), 11)
        for declaration in ours:
            with self.subTest(name=declaration["name"]):
                self.assertEqual(declaration["result"], "ok")
                self.assertEqual(declaration["observed"], declaration["policy"]["axioms"])
        theorem = next(d for d in ours if d["name"].endswith(".eligible_decides"))
        self.assertEqual(theorem["observed"], ["propext"])

    def test_every_cited_log_exists_and_records_its_exit(self):
        cited = set(re.findall(r"`logs/([A-Za-z0-9._-]+\.log)`", self.record))
        self.assertGreaterEqual(len(cited), 20)
        for name in sorted(cited):
            with self.subTest(log=name):
                text = (EVIDENCE / "logs" / name).read_text()
                self.assertRegex(text, r"GATE_EXIT=\d+ image=\S+@sha256:[0-9a-f]{64} ")

    def test_negative_controls_were_refused_by_the_named_diagnostic(self):
        expected = {
            "nc1-weakened-decision.log": "unsolved goals",
            "nc2-wrong-vector.log": "disagrees with a modeled vector",
            "nc3-policy-drift.log": "PP1101: template policy path changed: AGENTS.md",
            "nc4a-lock-tamper-lockcheck.log": "PP5401",
            "nc4b-lock-tamper-templatecheck.log": "PP5401",
            "nc5-stale-conformance.log": "CONFORMANCE.md is stale",
            "nc7-undeclared-axiom.log": "LLV7005",
            "el-nc1-rights-check-dropped.log": "unsolved goals",
            "el-nc2-prohibited-rights-claimed-eligible.log": "disagrees with a modeled vector",
            "el-verify-1.log": "LLV7005",
            "el-red-test.log": "SM-01 is registered and not built",
            "el-model-after-commit.log": "1 new non-Prism file(s)",
        }
        for name, diagnostic in expected.items():
            with self.subTest(log=name):
                text = (EVIDENCE / "logs" / name).read_text()
                self.assertIn(diagnostic, text)
                self.assertNotRegex(text, r"GATE_EXIT=0 ")

    def test_record_states_its_limits(self):
        for phrase in (
            "P0 unverified",
            "not an accepted production release",
            "NOT_RUN",
            "Skill Mason is not a Prism-built application",
            "advisory database",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.record)


if __name__ == "__main__":
    unittest.main()
