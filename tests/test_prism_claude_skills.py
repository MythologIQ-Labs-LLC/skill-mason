"""Static checks of Claude-only Prism development skills. No Prism tool execution."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("prism-source-gate", "prism-model-first", "prism-proof-audit")
PINNED = {
    "UOR-Foundation/template": "b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b",
    "UOR-Foundation/PrismPM": "d896ab59e287650aecbcf02b8e867121601fdde5",
    "UOR-Foundation/LexLean": "a74b1f99bba637e51d19fb4efc508316aafa6664",
    "UOR-Foundation/prism": "507995bab43c0cb06ec244c96e6fc25b3f502204",
    "afflom/prism-devrel": "ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc",
}


class PrismClaudeSkillTests(unittest.TestCase):
    def test_uses_claude_code_project_skill_layout(self):
        for name in NAMES:
            with self.subTest(name=name):
                p = ROOT / ".claude" / "skills" / name / "SKILL.md"
                self.assertTrue(p.is_file(), str(p))
                text = p.read_text(encoding="utf-8")
                self.assertTrue(text.startswith("---\n"))
                pieces = text.split("---\n", 2)
                self.assertGreaterEqual(len(pieces), 3)
                self.assertRegex(pieces[1], rf"(?m)^name: {re.escape(name)}$")
                self.assertRegex(pieces[1], r"(?m)^description: \S+")
                self.assertGreaterEqual(len(pieces[2].strip()), 100)

    def test_source_record_uses_real_full_commit_pins(self):
        text = (ROOT / ".claude" / "PRISM_SOURCES.md").read_text(encoding="utf-8")
        for repo, sha in PINNED.items():
            with self.subTest(repo=repo):
                self.assertIn(f"https://github.com/{repo}/tree/{sha}", text)
                self.assertRegex(sha, r"^[0-9a-f]{40}$")

    def test_skills_call_source_gate_before_implementation(self):
        for name in NAMES[1:]:
            with self.subTest(name=name):
                text = (ROOT / ".claude" / "skills" / name / "SKILL.md").read_text()
                self.assertIn("prism-source-gate", text)
                self.assertIn("Prism", text)
        self.assertIn("prism-source-gate", (ROOT / "CLAUDE.md").read_text())

    def test_product_skill_corpus_is_not_used_for_claude_skills(self):
        project = (ROOT / "CLAUDE.md").read_text()
        self.assertIn("NOT", project.upper())
        self.assertIn("not catalog entries", project.lower())
        self.assertFalse((ROOT / "skills" / "authored" / "prism-source-gate").exists())

    def test_developer_instructions_link_project_skills_without_polluting_readme(self):
        readme = (ROOT / "README.md").read_text()
        agents = (ROOT / "AGENTS.md").read_text()
        claude = (ROOT / "CLAUDE.md").read_text()
        self.assertNotIn(".claude/skills/", readme)
        for name in NAMES:
            with self.subTest(name=name):
                self.assertIn(f".claude/skills/{name}/SKILL.md", agents)
                self.assertIn(f".claude/skills/{name}/SKILL.md", claude)
        self.assertIn(".claude/PRISM_SOURCES.md", agents)

    def test_public_product_brand_and_artwork_are_present(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("# Qortara Skills", readme)
        self.assertIn("zero-inference-token agent-skill builder", readme)
        self.assertIn("assets/brand/qortara-skills-banner.webp", readme)
        self.assertIn("assets/brand/qortara-skills-icon.webp", readme)
        self.assertNotIn("Qortara Logic", readme)
        for name in ("qortara-skills-banner.webp", "qortara-skills-icon.webp"):
            self.assertTrue((ROOT / "assets" / "brand" / name).is_file())


    def test_version_conflict_is_explicit_and_pinned(self):
        doc = (ROOT / ".claude" / "PRISM_COMPATIBILITY.md").read_text()
        self.assertIn('available_in: "0.6"', doc)
        self.assertIn('available_in: "1.0-beta"', doc)
        self.assertIn("d896ab59e287650aecbcf02b8e867121601fdde5", doc)
        self.assertIn("issues/718", doc)
        # The record now reports an executed route. It must say which one, bind it to
        # the exact toolchain digest, and still refuse to call Skill Mason Prism-built.
        self.assertIn("Route A selected for development", doc)
        self.assertIn("reference gate EXECUTED", doc)
        self.assertIn(
            "sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3", doc
        )
        self.assertIn("Skill Mason is not a Prism-built application", doc)
        self.assertIn("docs/evidence/prism-phase0-20261117/README.md", doc)

    def test_unexecuted_routes_are_not_presented_as_available(self):
        doc = (ROOT / ".claude" / "PRISM_COMPATIBILITY.md").read_text()
        rows = {line.split("|")[1].strip()[:4]: line for line in doc.splitlines() if line.startswith("| **")}
        self.assertIn("`EXECUTED`", rows["**A."])
        self.assertNotIn("`EXECUTED`", rows["**B."])
        self.assertIn("`HOLD`", rows["**B."])
        self.assertIn("`UNAVAILABLE`", rows["**C."])
        self.assertNotIn("`EXECUTED`", rows["**D."])

    def test_product_implementation_requires_route_qualification(self):
        entry = (ROOT / "CLAUDE.md").read_text()
        model = (ROOT / ".claude" / "skills" / "prism-model-first" / "SKILL.md").read_text()
        source = (ROOT / ".claude" / "skills" / "prism-source-gate" / "SKILL.md").read_text()
        for text in (entry, model, source):
            self.assertIn(".claude/PRISM_COMPATIBILITY.md", text)
        self.assertIn("**route A**", model)
        self.assertIn("**route B**", model)
        self.assertIn("HOLD", model)
        self.assertIn("not selected and not executed", model)
        self.assertIn("no Prism application adopted", (ROOT / ".claude" / "PRISM_COMPATIBILITY.md").read_text())
        self.assertIn("ADR-0003", entry)
        self.assertIn("not a Prism-built application", entry)

    def test_adoption_decision_is_proposed_not_accepted(self):
        adr = (ROOT / "docs" / "adr" / "0003-prism-application-adoption.md").read_text()
        self.assertIn("**Status:** Proposed.", adr)
        self.assertNotIn("**Status:** Accepted", adr)
        self.assertIn("9a1fe3f73ab2963812c35976909c331292e1ca39ce47c0711ec1aafe8b869d87", adr)
        self.assertIn("Owner decisions requested", adr)
        register = (ROOT / "docs" / "README.md").read_text()
        self.assertEqual(register.count("](adr/0003-prism-application-adoption.md)"), 1)
        self.assertIn("Proposed; owner decision pending; nothing adopted", register)

    def test_skills_use_one_evidence_vocabulary_and_observed_diagnostics(self):
        source = (ROOT / ".claude" / "skills" / "prism-source-gate" / "SKILL.md").read_text()
        for state in ("UNAVAILABLE", "SOURCE_INSPECTED", "HELP_OBSERVED", "EXECUTED", "NOT_RUN"):
            self.assertIn(f"`{state}`", source)
        audit = (ROOT / ".claude" / "skills" / "prism-proof-audit" / "SKILL.md").read_text()
        record = (ROOT / "docs" / "evidence" / "prism-phase0-20261117" / "README.md").read_text()
        # Every refusal the audit skill tells Claude to expect was actually observed.
        for code in ("PP1101", "PP5401", "PP5001", "PP5301", "LLV7005", "digest_mismatch"):
            with self.subTest(code=code):
                self.assertIn(code, audit)
                self.assertIn(code, record)
        self.assertIn("P0 unverified", audit)
        self.assertIn("scripts/prism_reference_gate.sh", audit)
        model = (ROOT / ".claude" / "skills" / "prism-model-first" / "SKILL.md").read_text()
        self.assertIn("scripts/prism_instance.sh", model)
        self.assertIn("this commit sets the ceiling", model)
        self.assertIn("Never overwrite Skill Mason's root `AGENTS.md`", model)

    def test_no_staged_prism_app_claim(self):
        register = (ROOT / ".claude" / "PRISM_SOURCES.md").read_text()
        self.assertIn("not runtime-qualified", register)
        self.assertIn("not the full application template", register.lower().replace("**", ""))
        for text in (register, (ROOT / "README.md").read_text(), (ROOT / "CLAUDE.md").read_text()):
            self.assertNotRegex(text, r"(?i)skill mason is (now )?(a )?prism-built")
            self.assertNotRegex(text, r"(?i)independently verified")


UPSTREAM = ROOT / "docs" / "upstream" / "prismpm-skill-requests"
PROJECT_TERMS = (
    "skill mason", "skill-mason", "skillz", "qortara", "mythologiq", "knapp",
    "sm-01", "eligib", "adr-0", "rfc-0001", "prism-overlay", "prism_compat",
    "prism_sources", "/tmp/", "claude/", ".claude/", "issue #3", "issue #4",
)


class UpstreamSkillSubmissionTests(unittest.TestCase):
    """The copies prepared for upstream must stand alone and carry no project trace."""

    def test_submission_files_name_nothing_from_this_project(self):
        files = [p for p in UPSTREAM.rglob("*") if p.is_file()]
        self.assertGreaterEqual(len(files), 11)
        for path in files:
            text = path.read_text(encoding="utf-8").lower()
            for term in PROJECT_TERMS:
                with self.subTest(path=path.name, term=term):
                    self.assertNotIn(term, text)

    def test_each_issue_embeds_its_skill_verbatim_in_upstream_form(self):
        for name in NAMES:
            with self.subTest(name=name):
                skill = (UPSTREAM / "skills" / name / "SKILL.md").read_text()
                self.assertRegex(skill, rf"(?m)^name: {re.escape(name)}$")
                body = (UPSTREAM / f"{name}.issue.md").read_text()
                self.assertIn(skill.rstrip("\n"), body)
                position = 0
                for heading in (
                    "### Submitted by\n\nAI agent",
                    "### Component\n\ndocs",
                    "### Problem",
                    "### Proposed API or behavior",
                    "### Acceptance test",
                    "### Current workaround",
                    "### Searched existing requests",
                ):
                    found = body.find(heading, position)
                    self.assertGreaterEqual(found, 0, heading)
                    position = found
                self.assertIn("- [ ] I searched /docs/requests.md", body)
                self.assertTrue(body.rstrip().endswith("_Generated by [Claude Code](https://claude.ai/code)_"))
                title = (UPSTREAM / f"{name}.title.txt").read_text()
                self.assertTrue(title.startswith(f"[feature] Agent skill: {name}"))

    def test_submission_records_where_each_skill_was_filed(self):
        readme = (UPSTREAM / "README.md").read_text()
        self.assertIn("Status: filed on 2026-11-17", readme)
        for name, number in zip(NAMES, (720, 721, 722)):
            with self.subTest(name=name):
                self.assertRegex(
                    readme,
                    rf"\| `{re.escape(name)}` \| \[UOR-Foundation/PrismPM#{number}\]"
                    rf"\(https://github\.com/UOR-Foundation/PrismPM/issues/{number}\) \|",
                )

    def test_upstream_copies_keep_the_substance_of_the_project_skills(self):
        for name in NAMES:
            with self.subTest(name=name):
                ours = (ROOT / ".claude" / "skills" / name / "SKILL.md").read_text()
                theirs = (UPSTREAM / "skills" / name / "SKILL.md").read_text()
                codes = set(re.findall(r"\b(?:PP|LLV|LLC)\d{4}\b", ours))
                self.assertTrue(codes <= set(re.findall(r"\b(?:PP|LLV|LLC)\d{4}\b", theirs)), codes)


if __name__ == "__main__":
    unittest.main()
