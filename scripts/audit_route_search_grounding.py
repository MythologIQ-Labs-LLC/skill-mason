#!/usr/bin/env python3
"""Measure the original JSON-key route search bug against the exact pinned corpus.

This is a lexical defect audit, NOT held-out semantic accuracy, rights clearance,
method preference, or independent host qualification. Preserve the legacy
algorithm in this audit for before/after evidence without exposing it to users.
"""
import argparse
import json

from scripts.catalog_handoff import COMMIT, TREE, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph

SCHEMA = "qortara/route-search-source-grounding-audit/1"
FIELD_ONLY_PROBES = ("path", "domain_name", "subdomain_name",
                     "statements", "essential_outcomes")
SANITY_QUERIES = ("frontend", "software-engineering", "fact checking")


def legacy_matches(graph, query):
    """Reproduce the previous buggy *serialized-key* predicate verbatim."""
    words = query.casefold().split()
    matched = []
    for path in sorted(graph.paths):
        node = graph.paths[path]
        outcome = graph.outcome_by_path[path]
        content = json.dumps({
            "path": path,
            "domain_name": node["domain"].get("name"),
            "subdomain_name": node["subdomain"].get("name"),
            "statements": outcome.get("existing_capability_statements", []),
            "essential_outcomes": outcome["essential_outcomes"],
        }, ensure_ascii=False).casefold()
        if all(word in content for word in words):
            matched.append(path)
    return matched


def measure(graph):
    source = graph.corpus.manifest["source"]
    require(source.get("commit") == COMMIT and source.get("git_tree_sha1") == TREE,
            "SOURCE_PIN", "audit requires exact immutable original corpus")
    require(len(graph.paths) == 247, "CAPABILITY_COUNT",
            "route audit requires full 247-route taxonomy")
    probes = []
    for query in FIELD_ONLY_PROBES + SANITY_QUERIES:
        old = set(legacy_matches(graph, query))
        current = graph.search(query, limit=200)
        # Graph.search cannot return all 247 paths within its bounded result
        # limit. Measure the full set via exact per-route source tokens using
        # only the current graph's own query semantics, not the first 200.
        from scripts.capability_graph import _source_values, _tokens
        request_tokens = _tokens(query)
        current_all = {
            path for path, node in graph.paths.items()
            if request_tokens.issubset(
                frozenset().union(*(
                    _tokens(v) for field in (
                        path, node["domain"].get("name"),
                        node["subdomain"].get("name"),
                        graph.outcome_by_path[path].get("existing_capability_statements", []),
                        graph.outcome_by_path[path]["essential_outcomes"])
                    for v in _source_values(field))))
        }
        require(current["total_matches"] == len(current_all) and
                current["composition_eligible"] is False and
                all(x["path"] in current_all for x in current["routes"]) and
                len(current["routes"]) <= 200,
                "AUDIT_DRIFT", "live route search disagrees with source-only tokens")
        probes.append({
            "query": query,
            "legacy_serialized_json_match_count": len(old),
            "source_values_exact_token_match_count": len(current_all),
            "legacy_only_unsupported_query_hits": len(old - current_all),
            "newly_reachable_punctuation_token_hits": len(current_all - old),
        })
    for probe in probes[:len(FIELD_ONLY_PROBES)]:
        require(probe["legacy_serialized_json_match_count"] == 247 and
                probe["source_values_exact_token_match_count"] < 247,
                "AUDIT_FALSE_POSITIVE",
                "field-key phantom result regression could not be reproduced")
    require(graph.search("frontend", limit=25)["total_matches"] > 0,
            "AUDIT_RECALL_SANITY", "genuine source route is no longer searchable")
    return {
        "schema": SCHEMA,
        "state": "PINNED_LEXICAL_GROUNDING_MEASURED_NOT_SEMANTIC_QUALIFICATION",
        "pinned_source_commit": COMMIT, "pinned_source_tree": TREE,
        "total_recognized_routes": len(graph.paths),
        "legacy_algorithm": "ALL_QUERY_WHITESPACE_WORDS_AS_SUBSTRINGS_OF_SERIALIZED_JSON",
        "corrected_algorithm": "ALL_EXACT_UNICODE_WORD_TOKENS_IN_DECLARED_SOURCE_VALUES",
        "probes": probes,
        "heldout_independent_labeling_performed": False,
        "semantic_top1_precision_recall_established": False,
        "source_rights_assessed": False, "host_validated": False,
        "composition_eligible": False, "production_eligible": False
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    args = parser.parse_args(argv)
    graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
    print(json.dumps(measure(graph), sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
