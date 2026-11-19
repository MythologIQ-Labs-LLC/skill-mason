#!/usr/bin/env python3
"""User-facing, read-only navigation of the pinned Skillz capability graph.

This is not semantic routing, rights review, method selection, or composition.
It reuses the existing C1/C2 graph and its exact source verifier.
"""
import argparse
import json
import re
import sys
import unicodedata

from scripts.catalog_handoff import COMMIT, TREE, Refusal, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph

SCHEMA = "qortara/user-route-discovery/1"
MAX_QUERY = 160
MAX_RESULTS = 25
CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def discover(graph, *, query=None, path=None, summary=False, limit=10):
    """Reveal recognized routes only; never auto-select or certify a method."""
    require(type(limit) is int and 1 <= limit <= MAX_RESULTS,
            "ROUTE_LIMIT", "limit must be an integer between 1 and 25")
    modes = int(query is not None) + int(path is not None) + int(summary is True)
    require(modes == 1, "ROUTE_MODE",
            "select exactly one of --search, --path or --summary")
    if query is not None:
        require(isinstance(query, str) and query == unicodedata.normalize("NFC", query)
                and 2 <= len(query.strip()) <= MAX_QUERY
                and not CONTROL.search(query),
                "ROUTE_QUERY", "search must be 2-160 NFC characters with no controls")
        words = " ".join(query.split())
        result = graph.search(words, limit=limit)
        require(result.get("schema") == "qortara/capability-opportunity-graph/1"
                and result.get("search_type") ==
                    "recognized_capability_lexical_routing_not_method_admission"
                and result.get("composition_eligible") is False
                and isinstance(result.get("routes"), list)
                and 0 <= len(result["routes"]) <= limit,
                "ROUTE_GRAPH", "graph search returned untrusted route data")
        mode = "SEARCH"
        routes = result["routes"]
        count = result["total_matches"]
        truncated = result["truncated"]
    elif path is not None:
        require(isinstance(path, str) and len(path) <= 200
                and path == unicodedata.normalize("NFC", path)
                and not CONTROL.search(path),
                "ROUTE_PATH", "route must be a bounded exact path")
        detail = graph.show(path)
        mode = "SHOW"
        routes, count, truncated = [detail], 1, False
    else:
        mode, routes, count, truncated = "SUMMARY", [], len(graph.paths), False

    for route in routes:
        require(isinstance(route, dict)
                and route.get("schema") == "qortara/capability-opportunity-graph/1"
                and route.get("source_commit") == COMMIT
                and route.get("recognized") is True
                and route.get("composition_eligible") is False
                and route.get("path") in graph.paths
                and isinstance(route.get("evidence_linked_reviews"), list)
                and all(item.get("composition_eligibility") == "not-assessed"
                        and item.get("rights_clearance") == "not-established"
                        for item in route["evidence_linked_reviews"]),
                "ROUTE_PROMOTION", "graph data attempted route or eligibility promotion")

    stats = graph.summary()
    require(stats.get("schema") == "qortara/capability-opportunity-graph/1"
            and stats.get("source_commit") == COMMIT
            and stats.get("composition_eligible") is False
            and stats.get("rights_assessed") is False
            and stats.get("host_qualified") is False,
            "ROUTE_PROMOTION", "summary attempted to grant method authority")
    return {
        "schema": SCHEMA,
        "state": "READ_ONLY_RECOGNIZED_CAPABILITIES",
        "mode": mode,
        "pinned_source_commit": COMMIT,
        "pinned_source_tree": TREE,
        "recognized_domain_count": stats["recognized_domains"],
        "recognized_route_count": stats["recognized_subdomains"],
        "governed_evidence_mapped_identity_count": stats["evidence_mapped_governed_identities"],
        "unmapped_governed_identity_count": stats["unmapped_governed_identities"],
        "matched_route_count": count,
        "truncated": truncated,
        "routes": routes,
        "search_is_lexical_not_qualified_semantics": True,
        "unmapped_or_unreviewed_methods_not_proven_absent": True,
        "source_rights_established": False,
        "host_validated": False,
        "composition_eligible": False,
        "production_eligible": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--search")
    group.add_argument("--path")
    group.add_argument("--summary", action="store_true")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        output = discover(graph, query=args.search, path=args.path,
                          summary=args.summary, limit=args.limit)
        print(json.dumps(output, indent=2, sort_keys=True, ensure_ascii=False))
        return 0
    except Refusal as exc:
        print(json.dumps({"schema": SCHEMA, "state": "REFUSED",
                          "code": exc.code, "message": str(exc),
                          "composition_eligible": False,
                          "production_eligible": False}, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
