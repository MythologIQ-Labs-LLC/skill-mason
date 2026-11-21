#!/usr/bin/env python3
"""Corpus-wide retrieval falsification: 247 taxonomy routes, frozen 46-case set.

NOT independently adjudicated semantic accuracy. The 46-case set has author
labels for 13 routes; outside_13 may be inside the full 247-route taxonomy.
No ranking score grants method, rights, host or production authority.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

from scripts.catalog_handoff import COMMIT, TREE, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.evaluate_request_language import words
from scripts.replay_request_retrieval import validate

SCHEMA = "qortara/discovery-retrieval-falsification/1"


class RouteNameProbe:
    """Deliberately weak source-name-only comparison, not a route selector."""

    def __init__(self, graph):
        self.documents = {}
        for path, node in graph.paths.items():
            self.documents[path] = words(" ".join((
                path.replace("/", " ").replace("-", " "),
                str(node["domain"].get("name") or ""),
                str(node["subdomain"].get("name") or ""))))
        count = len(self.documents)
        frequencies = Counter(term for fields in self.documents.values() for term in fields)
        self.idf = {term: 1.0 + math.log((count + 1) / (df + 1))
                    for term, df in frequencies.items()}

    def rank(self, query, *, limit=3):
        query_words = words(query)
        if not query_words:
            return []
        scored = []
        for path, terms in self.documents.items():
            shared = query_words & terms
            if shared:
                # Only source-name overlap. No tuned confidence threshold.
                score = sum(self.idf[word] for word in shared)
                scored.append((path, score, len(shared), sorted(shared)))
        scored.sort(key=lambda x: (-x[1], -x[2], x[0]))
        return [{"path": path, "overlap_weight_not_probability": round(score, 6),
                 "matched_source_name_tokens": shared}
                for path, score, _, shared in scored[:limit]]


def evaluate(graph, cases, proposals):
    routes = validate(cases, proposals)
    require(len(graph.paths) == 247 and routes.issubset(graph.paths),
            "AUDIT_SCOPE", "expected all pinned routes and the 13 trial routes")
    require(graph.corpus.manifest["source"]["commit"] == COMMIT and
            graph.corpus.manifest["source"]["git_tree_sha1"] == TREE,
            "SOURCE_PIN", "corpus provenance disagrees with the pinned source")
    probe = RouteNameProbe(graph)
    # These probes echo actual taxonomy IDs: integration controls, NOT
    # independently adjudicated natural-language task labels.
    identity = {"total": len(graph.paths), "found_somewhere": 0,
                "first_result": 0, "in_first_three": 0, "not_found": []}
    for path in sorted(graph.paths):
        result = graph.search(path, limit=200)
        require(result["truncated"] is False, "AUDIT_TRUNCATED",
                "route identity probe results were truncated")
        found = [row["path"] for row in result["routes"]]
        identity["found_somewhere"] += int(path in found)
        identity["first_result"] += int(bool(found) and found[0] == path)
        identity["in_first_three"] += int(path in found[:3])
        if path not in found:
            identity["not_found"].append(path)
        require(result["composition_eligible"] is False,
                "AUDIT_AUTHORITY", "source route search promoted composition")
    receipts = []
    for item in cases["cases"]:
        baseline = graph.search(item["prompt"], limit=25)
        require(baseline["composition_eligible"] is False,
                "AUDIT_AUTHORITY", "baseline promoted composition")
        old = [row["path"] for row in baseline["routes"]]
        ranked = probe.rank(item["prompt"])
        receipts.append({"id": item["id"], "kind": item["kind"],
                         "author_label_for_13_route_trial": item["expected_route"],
                         "exact_top1": old[0] if old else None,
                         "exact_top3": old[:3],
                         "name_top1": ranked[0]["path"] if ranked else None,
                         "name_top3": [row["path"] for row in ranked],
                         "name_overlap_evidence": ranked,
                         "route_qualified": False})

    def score(method):
        positive = [r for r in receipts if r["kind"] == "in_scope"]
        outside = [r for r in receipts if r["kind"] == "outside_13"]
        adverse = [r for r in receipts if r["kind"] == "ambiguous_or_negated"]
        return {
            "author_labeled_positive_denominator": len(positive),
            "expected_in_top1": sum(r[method + "_top1"] == r["author_label_for_13_route_trial"]
                                    for r in positive),
            "expected_in_top3": sum(r["author_label_for_13_route_trial"] in r[method + "_top3"]
                                    for r in positive),
            "incorrect_nonabstaining_top1_against_13_labels": sum(
                r[method + "_top1"] is not None and
                r[method + "_top1"] != r["author_label_for_13_route_trial"]
                for r in positive),
            "positive_abstentions": sum(r[method + "_top1"] is None for r in positive),
            # Outside the 13-route experiment does not mean outside all 247.
            "outside_13_nonabstaining_NOT_247_false_positives": sum(
                r[method + "_top1"] is not None for r in outside),
            "ambiguous_or_negated_nonabstaining": sum(
                r[method + "_top1"] is not None for r in adverse)}

    return {
        "schema": SCHEMA,
        "decision": "NO_GO_AUTOMATIC_ROUTE_SELECTION",
        "source_commit": COMMIT, "source_tree": TREE,
        "recognized_routes": 247,
        "routes_missing_essential_outcomes": sum(
            not graph.outcome_by_path[path]["essential_outcomes"] for path in graph.paths),
        "route_identity_echo_NOT_semantic_accuracy": identity,
        "benchmarks": {"total": len(receipts), "in_scope_13_only": 26,
                       "outside_13_not_necessarily_outside_247": 12,
                       "adversarial_or_ambiguous": 8},
        "methods": {"source_exact_all_query_tokens": score("exact"),
                    "experimental_source_name_overlap_unthresholded": score("name")},
        "benchmark_labels_independently_adjudicated": False,
        "full_247_route_natural_language_labels_available": False,
        "outside_13_not_counted_as_247_false_positives": True,
        "model_execution": "NOT_RUN", "rights_assessed": False,
        "host_validated": False, "composition_eligible": False,
        "production_eligible": False,
        "records": receipts}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    parser.add_argument("--cases", type=Path,
                        default=Path("benchmarks/request-routing-adversarial-v2.json"))
    parser.add_argument("--proposals", type=Path,
                        default=Path("docs/technical/essential-workflow-proposals-v1.json"))
    args = parser.parse_args(argv)
    cases_blob, proposals_blob = args.cases.read_bytes(), args.proposals.read_bytes()
    corpus = CorpusIndex(args.handoff, args.source_checkout)
    report = evaluate(CapabilityGraph(corpus), json.loads(cases_blob), json.loads(proposals_blob))
    report["inputs_sha256"] = {"cases": hashlib.sha256(cases_blob).hexdigest(),
                               "proposals": hashlib.sha256(proposals_blob).hexdigest()}
    print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
