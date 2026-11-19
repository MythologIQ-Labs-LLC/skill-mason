"""Gherkin controls for a read-only Verdant feasibility evaluation."""
from copy import deepcopy
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from scripts.verdant_fit_eval import EvaluationError, run_native_cli, screen_sources

SLUGS = [f"engine-action-{n}" for n in range(16)]
CORE = (
    "pub const fn slug(self) -> &'static str { match self {\n" +
    "".join(f'  Self::Action{n} => "{slug}",\n' for n, slug in enumerate(SLUGS)) +
    "} }\nfn from_index(idx: usize) {}\n"
)
LANG = ("pub struct VerdantLanguageEngine {}\n"
        "fn tokenize_content_words(text: &str) {}\n"
        "pub fn evaluate_npc_dialogue_turn() {}\n"
        "knowledge_facts\ninfer_coded_slm_intent_logits(\n")


def proposals():
    return {
        "schema_version": "qortara/essential-workflow-proposals/1",
        "authority": "proposals-only-not-imported-into-skillz-or-capability-graph",
        "rows": [
            {"route": f"domain/capability-{n}",
             "objective": f"Make a skill for distinct task {n}",
             "proposal_status": "DRAFT_NOT_GOVERNED"} for n in range(13)
        ]
    }


class VerdantFitTests(unittest.TestCase):
    def test_given_original_16_engine_routes_when_screening_13_skills_then_no_skill_routes_are_claimed(self):
        report = screen_sources(CORE, LANG, proposals())
        self.assertEqual(report["intent_count"], 16)
        self.assertEqual(report["benchmark_objectives"], 13)
        self.assertEqual(report["direct_shared_route_identifiers"], [])
        self.assertEqual(report["semantic_route_accuracy"], "NOT_MEASURED")
        self.assertEqual(report["essential_outcome_extraction"], "NOT_MEASURED")
        self.assertEqual(report["source_rights_or_authority"], "NOT_ASSESSED")
        self.assertEqual(report["decision"], "DO_NOT_INTEGRATE_AS_DIRECT_ROUTE_ENGINE")

    def test_given_upstream_interface_drift_when_screening_then_refuse_not_silently_pass(self):
        with self.assertRaises(EvaluationError):
            screen_sources(CORE.replace("fn from_index", "fn renamed"), LANG, proposals())
        with self.assertRaises(EvaluationError):
            screen_sources(CORE, LANG.replace("knowledge_facts", "removed"), proposals())

    def test_given_proposal_promoted_or_omitted_when_screening_then_refuse(self):
        changed = proposals()
        changed["rows"][0]["proposal_status"] = "QUALIFIED"
        with self.assertRaises(EvaluationError):
            screen_sources(CORE, LANG, changed)
        changed = proposals()
        changed["rows"].pop()
        with self.assertRaises(EvaluationError):
            screen_sources(CORE, LANG, changed)

    def test_given_actual_verdant_cli_intent_when_sampling_then_it_cannot_become_skillz_eligibility(self):
        result = SimpleNamespace(returncode=0, stdout="INTENT OK: slug=engine-action-3 score_milli=970 raw_logit=123\n", stderr="")
        with patch("scripts.verdant_fit_eval.subprocess.run", return_value=result) as mocked:
            out = run_native_cli("/pinned/verdant", proposals()["rows"][:1], set(SLUGS))
        mocked.assert_called_once_with(
            ["/pinned/verdant", "route-intent", "Make a skill for distinct task 0"],
            capture_output=True, text=True, timeout=15, check=False)
        self.assertEqual(out[0]["state"], "ENGINE_INTENT_UNMAPPED_TO_SKILLZ")
        self.assertEqual(out[0]["raw_score_milli_not_calibrated_probability"], 970)
        self.assertNotIn("eligible", out[0])

    def test_given_missing_or_forged_native_output_when_sampling_then_no_positive_mapping(self):
        result = SimpleNamespace(returncode=0, stdout="INTENT OK: slug=domain/capability-0 score_milli=1000 raw_logit=100\n", stderr="")
        with patch("scripts.verdant_fit_eval.subprocess.run", return_value=result):
            out = run_native_cli("/pinned/verdant", proposals()["rows"][:1], set(SLUGS))
        self.assertEqual(out[0]["state"], "UPSTREAM_REFUSAL_OR_UNEXPECTED_RESPONSE")


if __name__ == "__main__":
    unittest.main()
