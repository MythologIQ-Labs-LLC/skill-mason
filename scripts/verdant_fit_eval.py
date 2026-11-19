#!/usr/bin/env python3
"""Read-only Verdant/Skill Mason compatibility evaluation.

This is a source/interface screen, NOT a semantic benchmark or a proof
of either model's task accuracy. --verdant-cli optionally runs the real
upstream route-intent command; there is no shell or network invocation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

EXTERNAL_PIN = "9e356f25dce15ae15dfd87169baf0fb0fba549a5"
SCREEN_SCHEMA = "qortara/verdant-language-fit-screen/1"
SLUGS = re.compile(r'Self::[A-Za-z0-9_]+\s*=>\s*"([a-z][a-z0-9-]+)"')
CLI_OUTPUT = re.compile(r"^INTENT OK: slug=([a-z][a-z0-9-]+) score_milli=(\d+) raw_logit=(-?\d+)$")


class EvaluationError(Exception):
    pass


def screen_sources(core, language, proposals):
    anchor = core.find("pub const fn slug(self)")
    end = core.find("fn from_index(", anchor)
    if anchor < 0 or end <= anchor:
        raise EvaluationError("Verdant intent interface absent or changed")
    intents = SLUGS.findall(core[anchor:end])
    if len(intents) != 16 or len(set(intents)) != 16:
        raise EvaluationError("Expected 16 unique Verdant engine intents; re-review upstream")
    required = ("pub struct VerdantLanguageEngine", "fn tokenize_content_words(",
                "pub fn evaluate_npc_dialogue_turn(", "knowledge_facts",
                "infer_coded_slm_intent_logits(")
    if any(marker not in language for marker in required):
        raise EvaluationError("Verdant grounded dialogue interface changed; re-review upstream")
    if proposals.get("schema_version") != "qortara/essential-workflow-proposals/1" or \
       proposals.get("authority") != "proposals-only-not-imported-into-skillz-or-capability-graph":
        raise EvaluationError("Expected the existing ungoverned Skill Mason proposal corpus")
    rows = proposals.get("rows")
    if not isinstance(rows, list) or len(rows) != 13:
        raise EvaluationError("Expected 13 source-pinned draft workflow objectives")
    routes = []
    for row in rows:
        if not isinstance(row, dict) or row.get("proposal_status") != "DRAFT_NOT_GOVERNED" or \
           not isinstance(row.get("route"), str) or "/" not in row["route"] or \
           not isinstance(row.get("objective"), str) or not row["objective"].strip():
            raise EvaluationError("Ungoverned benchmark objective malformed or promoted")
        routes.append(row["route"])
    if len(set(routes)) != len(routes):
        raise EvaluationError("Duplicate benchmark route")
    return {
        "schema": SCREEN_SCHEMA,
        "evidence_type": "STATIC_INTERFACE_COMPATIBILITY_ONLY",
        "external_expected_commit_not_verified_by_this_function": EXTERNAL_PIN,
        "verdant_engine_intents": intents,
        "intent_count": len(intents),
        "benchmark_objectives": len(rows),
        "benchmark_routes": routes,
        "direct_shared_route_identifiers": sorted(set(intents).intersection(routes)),
        "direct_skillz_route_interface_available": False,
        "language_component": "NPC_PASSAGE_GROUNDED_DIALOGUE_NOT_SKILL_AUTHORING",
        "semantic_route_accuracy": "NOT_MEASURED",
        "essential_outcome_extraction": "NOT_MEASURED",
        "host_task_success": "NOT_MEASURED",
        "source_rights_or_authority": "NOT_ASSESSED",
        "decision": "DO_NOT_INTEGRATE_AS_DIRECT_ROUTE_ENGINE",
    }


def run_native_cli(executable, rows, valid_intents):
    """Invoke actual Verdant CLI without a shell, and record raw responses.

    An intent is NEVER mapped to a Skillz route by guessed synonyms.
    """
    out = []
    for idx, row in enumerate(rows):
        try:
            proc = subprocess.run([executable, "route-intent", row["objective"]],
                                  capture_output=True, text=True, timeout=15, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            out.append({"case": idx + 1, "expected_draft_route": row["route"],
                        "state": "EXECUTION_UNAVAILABLE", "error": type(exc).__name__})
            continue
        match = CLI_OUTPUT.fullmatch(proc.stdout.strip()) if proc.returncode == 0 else None
        if match and match.group(1) in valid_intents:
            out.append({"case": idx + 1, "expected_draft_route": row["route"],
                        "state": "ENGINE_INTENT_UNMAPPED_TO_SKILLZ",
                        "engine_intent": match.group(1),
                        "raw_score_milli_not_calibrated_probability": int(match.group(2)),
                        "raw_logit": int(match.group(3))})
        else:
            out.append({"case": idx + 1, "expected_draft_route": row["route"],
                        "state": "UPSTREAM_REFUSAL_OR_UNEXPECTED_RESPONSE",
                        "exit_code": proc.returncode,
                        "stdout_excerpt": proc.stdout[:120], "stderr_excerpt": proc.stderr[:120]})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verdant-repo", type=Path, required=True,
                        help="local checkout of the exact pinned upstream revision")
    parser.add_argument("--proposals", type=Path, default=Path("docs/technical/essential-workflow-proposals-v1.json"))
    parser.add_argument("--verdant-cli", type=Path, help="optional built upstream binary, not a mock")
    args = parser.parse_args()
    root = args.verdant_repo.resolve()
    revision = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"],
                              capture_output=True, text=True, check=False)
    if revision.returncode != 0 or revision.stdout.strip() != EXTERNAL_PIN:
        raise EvaluationError("Verdant checkout is not the reviewed exact source revision")
    core_path = root / "crates/verdant-core/src/cybernetics.rs"
    language_path = root / "crates/verdant-core/src/observer.rs"
    core = core_path.read_text(encoding="utf-8")
    language = language_path.read_text(encoding="utf-8")
    proposals = json.loads(args.proposals.read_text(encoding="utf-8"))
    report = screen_sources(core, language, proposals)
    report["external_revision_verified"] = True
    report["source_sha256"] = {
        "cybernetics": hashlib.sha256(core.encode()).hexdigest(),
        "observer": hashlib.sha256(language.encode()).hexdigest(),
        "proposals": hashlib.sha256(args.proposals.read_bytes()).hexdigest(),
    }
    report["native_execution"] = "NOT_RUN"
    if args.verdant_cli is not None:
        report["native_execution"] = run_native_cli(str(args.verdant_cli.resolve()),
                                                    proposals["rows"], set(report["verdant_engine_intents"]))
    print(json.dumps(report, sort_keys=True, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (EvaluationError, OSError, ValueError, json.JSONDecodeError) as err:
        print(f"VERDANT_FIT_REFUSED: {err}", file=sys.stderr)
        sys.exit(2)
