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

    def test_readme_and_agent_instructions_link_project_skills(self):
        readme = (ROOT / "README.md").read_text()
        agents = (ROOT / "AGENTS.md").read_text()
        for name in NAMES:
            with self.subTest(name=name):
                self.assertIn(f".claude/skills/{name}/SKILL.md", readme)
                self.assertIn(f".claude/skills/{name}/SKILL.md", agents)
        self.assertIn(".claude/PRISM_SOURCES.md", agents)


    def test_version_conflict_is_explicit_and_pinned(self):
        doc = (ROOT / ".claude" / "PRISM_COMPATIBILITY.md").read_text()
        self.assertIn('available_in: "0.6"', doc)
        self.assertIn('available_in: "1.0-beta"', doc)
        self.assertIn("d896ab59e287650aecbcf02b8e867121601fdde5", doc)
        self.assertIn("issues/718", doc)
        self.assertIn("NOT_EXECUTED", doc)
        self.assertIn("No route is selected or qualified", doc)

    def test_product_implementation_requires_route_qualification(self):
        entry = (ROOT / "CLAUDE.md").read_text()
        model = (ROOT / ".claude" / "skills" / "prism-model-first" / "SKILL.md").read_text()
        source = (ROOT / ".claude" / "skills" / "prism-source-gate" / "SKILL.md").read_text()
        for text in (entry, model, source):
            self.assertIn(".claude/PRISM_COMPATIBILITY.md", text)
        self.assertIn("**route A**", model)
        self.assertIn("**route B**", model)
        self.assertIn("HOLD", model)
        self.assertIn("No route is selected", (ROOT / ".claude" / "PRISM_COMPATIBILITY.md").read_text())

    def test_no_staged_prism_app_claim(self):
        register = (ROOT / ".claude" / "PRISM_SOURCES.md").read_text()
        self.assertIn("not runtime-qualified", register)
        self.assertIn("not the full application template", register.lower().replace("**", ""))


if __name__ == "__main__":
    unittest.main()
