#!/usr/bin/env python3
"""Reproducible request-routing benchmark: real pinned Skillz graph vs bounded lexical grounding.

This does NOT execute Verdant by default. The experimental grounded retriever
is NOT Verdant, NOT an LLM, and NOT an eligibility/rights/host gate.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import sys

from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.verdant_fit_eval import run_native_cli

SCHEMA = "qortara/request-understanding-benchmark/1"
STOP = set("""
a an and are as at be before between by can could create do for from given
help how i in into is it its me my of on or our out please should so that
the their this to under using want we what when which with would you your
skill skills assistant system make
""".split())
TOKENS = re.compile(r"[a-z0-9]+")


class BenchmarkError(Exception):
    pass


def words(text):
    """Small, declared lexical normalizer. No embeddings, language model or hidden dictionary."""
    items = []
    for raw in TOKENS.findall(text.casefold()):
        if raw in STOP or len(raw) < 3:
            continue
        word = raw
        if word.endswith("ies") and len(word) > 5:
            word = word[:-3] + "y"
        elif word.endswith("ing") and len(word) > 6:
            word = word[:-3]
        elif word.endswith("ed") and len(word) > 5:
            word = word[:-2]
        elif word.endswith("s") and not word.endswith("ss") and len(word) > 4:
            word = word[:-1]
        if word not in STOP:
            items.append(word)
    return set(items)


def validate_inputs(cases_doc, proposals_doc):
    if cases_doc.get("schema") != "qortara/heldout-request-benchmark/1" or \
       cases_doc.get("status") != "EXPERIMENTAL_AUTHOR_LABELED_NOT_INDEPENDENT_GOLD":
        raise BenchmarkError("Held-out source/label authority changed")
    if proposals_doc.get("schema_version") != "qortara/essential-workflow-proposals/1" or \
       proposals_doc.get("authority") != "proposals-only-not-imported-into-skillz-or-capability-graph":
        raise BenchmarkError("Route descriptions are not the expected ungoverned drafts")
    proposals = proposals_doc.get("rows")
    cases = cases_doc.get("cases")
    if not isinstance(proposals, list) or len(proposals) != 13 or \
       not isinstance(cases, list) or len(cases) != 45 or cases_doc.get("case_count") != 45:
        raise BenchmarkError("Benchmark cardinality drift")
    routes = set()
    for row in proposals:
        if row.get("proposal_status") != "DRAFT_NOT_GOVERNED" or \
           not isinstance(row.get("route"), str):
            raise BenchmarkError("Proposed route promoted or malformed")
        routes.add(row["route"])
    if len(routes) != 13:
        raise BenchmarkError("Duplicate candidate route")
    expected = set()
    counted = Counter()
    for row in cases:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or \
           not isinstance(row.get("prompt"), str) or not (12 <= len(row["prompt"]) <= 400):
            raise BenchmarkError("Malformed request")
        if row["id"] in expected:
            raise BenchmarkError("Duplicate held-out request ID")
        expected.add(row["id"])
        if row.get("kind") == "in_scope" and row.get("expected_route") in routes:
            counted[row["expected_route"]] += 1
        elif row.get("kind") == "outside_13_route_experiment" and row.get("expected_route") is None:
            counted["outside"] += 1
        else:
            raise BenchmarkError("Benchmark labels changed")
    if counted["outside"] != 6 or any(counted[route] != 3 for route in routes):
        raise BenchmarkError("Held-out coverage differs from three-per-route plus six controls")
    return routes


class GroundedLexicalRetriever:
    """Inert similarity probe inspired by passage retrieval, NOT a port of Verdant."""
    def __init__(self, proposals):
        self.documents = {}
        for row in proposals:
            # Never include the held-out prompts or their expected labels in the index.
            fields = [row["route"].replace("/", " ").replace("-", " "),
                      row["objective"]]
            for field in ("inputs", "outputs", "acceptance_criteria", "dependencies"):
                values = row.get(field, [])
                if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                    raise BenchmarkError("Malformed candidate evidence field")
                fields.extend(values)
            self.documents[row["route"]] = words(" ".join(fields))
        n = len(self.documents)
        df = Counter(w for terms in self.documents.values() for w in terms)
        self.idf = {w: 1.0 + math.log((n + 1) / (count + 1)) for w, count in df.items()}

    def route(self, query):
        q = words(query)
        if not q:
            return {"prediction": None, "top3": [], "state": "ABSTAIN"}
        denominator = sum(self.idf.get(w, 1.0 + math.log(14)) for w in q)
        candidates = []
        for route, tokens in self.documents.items():
            shared = q & tokens
            score = sum(self.idf[w] for w in shared) / denominator
            if len(shared) >= 2:
                candidates.append((route, round(score, 6), len(shared)))
        candidates.sort(key=lambda r: (-r[1], -r[2], r[0]))
        if not candidates or candidates[0][1] < 0.18:
            return {"prediction": None, "top3": candidates[:3], "state": "ABSTAIN"}
        if len(candidates) > 1 and candidates[0][1] - candidates[1][1] < 0.045:
            return {"prediction": None, "top3": candidates[:3], "state": "AMBIGUOUS_ABSTENTION"}
        return {"prediction": candidates[0][0], "top3": candidates[:3], "state": "LEXICAL_LEAD_UNASSESSED"}


def evaluate(graph, cases_doc, proposals_doc, *, native_cli=None):
    routes = validate_inputs(cases_doc, proposals_doc)
    if set(graph.paths) and not routes.issubset(graph.paths):
        raise BenchmarkError("Benchmark includes route absent from pinned recognized Skillz graph")
    ranker = GroundedLexicalRetriever(proposals_doc["rows"])
    records = []
    for row in cases_doc["cases"]:
        # Existing real Skill Mason path: full free-form request passed to route search.
        base = graph.search(row["prompt"], limit=25)
        if base.get("schema") != "qortara/capability-opportunity-graph/1" or \
           base.get("composition_eligible") is not False:
            raise BenchmarkError("Actual baseline graph changed admission contract")
        original = [item["path"] for item in base["routes"]]
        ranked = ranker.route(row["prompt"])
        records.append({
            "id": row["id"], "kind": row["kind"],
            "expected_route_experiment_label_only": row["expected_route"],
            "baseline_top1": original[0] if original else None,
            "baseline_top3": original[:3],
            "grounded_top1": ranked["prediction"],
            "grounded_top3": [x[0] for x in ranked["top3"]],
            "grounded_state": ranked["state"],
            "grounded_raw_score_not_probability": ranked["top3"][0][1] if ranked["top3"] else None,
            "source_rights_assessed": False, "composition_eligible": False,
        })
    def summarize(name):
        ins = [r for r in records if r["kind"] == "in_scope"]
        outs = [r for r in records if r["kind"] != "in_scope"]
        return {
            "top1_correct_of_39": sum(r[name + "_top1"] == r["expected_route_experiment_label_only"] for r in ins),
            "top3_contains_expected_of_39": sum(r["expected_route_experiment_label_only"] in r[name + "_top3"] for r in ins),
            "incorrect_nonabstaining_of_39": sum(r[name + "_top1"] not in (None, r["expected_route_experiment_label_only"]) for r in ins),
            "in_scope_abstentions_of_39": sum(r[name + "_top1"] is None for r in ins),
            "out_of_13_scope_false_positive_of_6": sum(r[name + "_top1"] is not None for r in outs),
            "out_of_13_scope_abstentions_of_6": sum(r[name + "_top1"] is None for r in outs),
        }
    report = {
        "schema": SCHEMA, "state": "EXPERIMENTAL_NOT_PRODUCTION_ELIGIBILITY",
        "benchmark_type": "PREDECLARED_AUTHOR_LABELED_NOT_INDEPENDENT_ADJUDICATION",
        "baseline": "ACTUAL_CAPABILITY_GRAPH_EXACT_ALL_WORD_SEARCH",
        "candidate": "NEW_INERT_GROUNDED_LEXICAL_PROBE_NOT_VERDANT_NOT_LLM",
        "baseline_metrics": summarize("baseline"),
        "grounded_metrics": summarize("grounded"),
        "native_verdant": "NOT_RUN",
        "native_verdant_skillz_accuracy": "NOT_COMPARABLE_NO_NATIVE_ROUTE_MAP",
        "essential_outcome_precision_recall": "NOT_MEASURED",
        "inference_token_count": "ZERO_FOR_LEXICAL_ARMS_ONLY",
        "ground_truth_quality": "EXPERIMENTAL_AUTHOR_LABELED",
        "rights_assessed": False, "host_validated": False, "composition_eligible": False,
        "records": records,
    }
    if native_cli is not None:
        raw = run_native_cli(str(Path(native_cli).resolve()),
                             [{"route": r["expected_route"] or "OUTSIDE_13_ROUTE_SCOPE",
                               "objective": r["prompt"]} for r in cases_doc["cases"]],
                             {"focus-observer", "drive-vehicle", "render-tile-wasm", "render-webgl2",
                              "stream-uorc-lod3", "stream-uorc-lod4", "stitch-shard-sync",
                              "inspect-formal-ui", "step-xpbd-physics", "open-role-dashboard",
                              "open-role-code", "open-role-design", "open-role-audio",
                              "open-role-director", "open-role-gameplay", "narrative-interact"})
        report["native_verdant"] = {
            "state": "NATIVE_EXECUTED_UNMAPPED" if all(r["state"] != "EXECUTION_UNAVAILABLE" for r in raw)
                     else "NATIVE_INCOMPLETE",
            "engine_intent_outputs": sum(r["state"] == "ENGINE_INTENT_UNMAPPED_TO_SKILLZ" for r in raw),
            "refused_or_unexpected": sum(r["state"] == "UPSTREAM_REFUSAL_OR_UNEXPECTED_RESPONSE" for r in raw),
            "raw": raw}
    return report


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    p.add_argument("--cases", type=Path, default=Path("benchmarks/verdant-request-holdout-v1.json"))
    p.add_argument("--proposals", type=Path, default=Path("docs/technical/essential-workflow-proposals-v1.json"))
    p.add_argument("--verdant-cli", type=Path)
    args = p.parse_args(argv)
    corpus = CorpusIndex(args.handoff, args.source_checkout)
    graph = CapabilityGraph(corpus)
    cases_doc = json.loads(args.cases.read_text())
    proposals_doc = json.loads(args.proposals.read_text())
    result = evaluate(graph, cases_doc, proposals_doc, native_cli=args.verdant_cli)
    result["evidence_sha256"] = {"cases": hashlib.sha256(args.cases.read_bytes()).hexdigest(),
                                 "proposals": hashlib.sha256(args.proposals.read_bytes()).hexdigest()}
    result["pinned_source_commit"] = corpus.manifest["source"]["commit"]
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BenchmarkError, OSError, ValueError, KeyError) as err:
        print(f"REQUEST_BENCHMARK_REFUSED: {err}", file=sys.stderr)
        raise SystemExit(2) from err
