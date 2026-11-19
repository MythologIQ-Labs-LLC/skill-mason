#!/usr/bin/env python3
"""Untuned replay of the existing route retriever, using new adverse requests.

This is test evidence, NOT a new model, production route selector, or a
human-independent gold standard. It imports the unchanged experimental ranker.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.evaluate_request_language import BenchmarkError, GroundedLexicalRetriever

SCHEMA = "qortara/untuned-retrieval-replay/1"


def validate(cases, proposals):
    if cases.get("schema") != "qortara/untuned-retrieval-holdout/1" or \
       cases.get("status") != "AUTHOR_LABELED_SECOND_SET_NOT_INDEPENDENT_HUMAN_ADJUDICATION" or \
       proposals.get("schema_version") != "qortara/essential-workflow-proposals/1" or \
       proposals.get("authority") != "proposals-only-not-imported-into-skillz-or-capability-graph":
        raise BenchmarkError("Unreviewed or promoted evaluation source")
    rows = proposals.get("rows")
    if not isinstance(rows, list) or len(rows) != 13 or \
       any(x.get("proposal_status") != "DRAFT_NOT_GOVERNED" for x in rows):
        raise BenchmarkError("Expected original thirteen ungoverned workflows")
    paths = {x["route"] for x in rows}
    if len(paths) != 13:
        raise BenchmarkError("Duplicated route reference")
    examples = cases.get("cases")
    if not isinstance(examples, list) or len(examples) != 46 or cases.get("total") != 46:
        raise BenchmarkError("Held-out size drift")
    seen, counts = set(), Counter()
    for row in examples:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or \
           row["id"] in seen or not isinstance(row.get("prompt"), str) or \
           not 15 <= len(row["prompt"]) <= 400:
            raise BenchmarkError("Invalid or duplicated evaluation request")
        seen.add(row["id"])
        kind, label = row.get("kind"), row.get("expected_route")
        if kind == "in_scope" and label in paths:
            counts[kind] += 1
        elif kind in ("outside_13", "ambiguous_or_negated") and label is None:
            counts[kind] += 1
        else:
            raise BenchmarkError("Invalid experimental label")
    if counts != Counter({"in_scope":26,"outside_13":12,"ambiguous_or_negated":8}):
        raise BenchmarkError("Held-out case composition drift")
    return paths


def assess(graph, cases, proposals):
    paths = validate(cases, proposals)
    if not paths.issubset(graph.paths):
        raise BenchmarkError("Cannot find all thirteen pinned recognized routes")
    ranker = GroundedLexicalRetriever(proposals["rows"])
    receipts=[]
    for item in cases["cases"]:
        orig=graph.search(item["prompt"],limit=25)
        if orig.get("schema") != "qortara/capability-opportunity-graph/1" or \
           orig.get("composition_eligible") is not False or \
           orig.get("search_type") != "recognized_capability_lexical_routing_not_method_admission":
            raise BenchmarkError("Original catalog search unexpectedly promoted admission")
        baseline=[r["path"] for r in orig["routes"]]
        proposal=ranker.route(item["prompt"])
        if proposal["prediction"] is not None and proposal["prediction"] not in paths:
            raise BenchmarkError("Retriever escaped its thirteen-route experiment")
        receipts.append({
            "id":item["id"],"kind":item["kind"],"expected":item["expected_route"],
            "baseline":baseline[0] if baseline else None,
            "baseline_top3":baseline[:3],
            "grounded":proposal["prediction"],"grounded_top3":[p[0] for p in proposal["top3"]],
            "grounded_state":proposal["state"],
            "rights_established":False,"composition_eligible":False})
    def metrics(name):
        ins=[r for r in receipts if r["kind"]=="in_scope"]
        out=[r for r in receipts if r["kind"]=="outside_13"]
        adv=[r for r in receipts if r["kind"]=="ambiguous_or_negated"]
        return {
            "in_scope_total":26,
            "correct_top1":sum(r[name]==r["expected"] for r in ins),
            "correct_in_top3":sum(r["expected"] in r[name+"_top3"] for r in ins),
            "wrong_nonabstaining":sum(r[name] is not None and r[name]!=r["expected"] for r in ins),
            "in_scope_abstained":sum(r[name] is None for r in ins),
            "outside_13_false_positive":sum(r[name] is not None for r in out),
            "negated_or_ambiguous_false_positive":sum(r[name] is not None for r in adv),
        }
    baseline=metrics("baseline")
    grounded=metrics("grounded")
    # Predeclared conservative adoption bar. Failure does NOT mean CI failure.
    passed=(grounded["correct_top1"] >= 19 and grounded["wrong_nonabstaining"]<=1 and
            grounded["outside_13_false_positive"]==0 and
            grounded["negated_or_ambiguous_false_positive"]==0)
    return {
        "schema":SCHEMA,"state":"EVALUATED_NOT_AUTHORIZED",
        "benchmark_ground_truth":"AUTHOR_LABELED_NOT_INDEPENDENTLY_ADJUDICATED",
        "candidate":"EXACT_FROZEN_UNTUNED_LEXICAL_RETRIEVER_NOT_VERDANT",
        "baseline":"ORIGINAL_PINNED_CAPABILITY_GRAPH_SEARCH",
        "decision":"CANDIDATE_FIT_FOR_INDEPENDENT_ADJUDICATION" if passed else
                   "NO_GO_AUTOMATIC_ROUTE_SELECTION",
        "adoption_criteria_predeclared":{"top1_at_least":19,"wrong_at_most":1,
              "outside_false_positive":0,"ambiguous_or_negated_false_positive":0},
        "baseline_metrics":baseline,"grounded_metrics":grounded,
        "native_verdant":"NOT_RUN",
        "independent_gold_labels":False,
        "outcome_extraction":"NOT_MEASURED",
        "source_rights_established":False,
        "prism_invoked":False,"composer_invoked":False,
        "production_eligible":False,
        "records":receipts}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff",required=True)
    p.add_argument("--source-checkout",required=True)
    p.add_argument("--cases",type=Path,default=Path("benchmarks/request-routing-adversarial-v2.json"))
    p.add_argument("--proposals",type=Path,default=Path("docs/technical/essential-workflow-proposals-v1.json"))
    a=p.parse_args(argv)
    cases=json.loads(a.cases.read_text(encoding="utf-8"))
    proposals=json.loads(a.proposals.read_text(encoding="utf-8"))
    corpus=CorpusIndex(a.handoff,a.source_checkout)
    result=assess(CapabilityGraph(corpus),cases,proposals)
    result["source_commit"]=corpus.manifest["source"]["commit"]
    result["input_hashes"]={
        "case_sha256":hashlib.sha256(a.cases.read_bytes()).hexdigest(),
        "proposal_sha256":hashlib.sha256(a.proposals.read_bytes()).hexdigest()}
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0


if __name__=="__main__":
    try:
        raise SystemExit(main())
    except (BenchmarkError,ValueError,KeyError,OSError) as err:
        print(f"REPLAY_REFUSED: {err}",file=sys.stderr)
        raise SystemExit(2) from err
