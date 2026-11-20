#!/usr/bin/env python3
"""Read-only capability routing and essential-outcome gap lookup on the pinned corpus.

Evidence-linked discovery is not target-specific method eligibility or behavioral proof.
"""
import argparse
from collections import Counter
import json
import re
import sys
import unicodedata

from scripts.catalog_handoff import COMMIT, Refusal, parse_json, require
from scripts.catalog_index import CorpusIndex

SCHEMA = "qortara/capability-opportunity-graph/1"

# Exact lexical matches are only evidence that a route *mentions* the tokens.
# No stemming, synonym expansion, method eligibility or semantic confidence.
# Splitting at punctuation also makes slash/hyphen route identifiers searchable.
_SEARCH_TOKEN = re.compile(r"[^\\W_]+", re.UNICODE)


def _tokens(text):
    return frozenset(_SEARCH_TOKEN.findall(
        unicodedata.normalize("NFC", text).casefold()))


def _source_values(node):
    """Declared taxonomy prose only, never JSON labels, keys or review status."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, list):
        for item in node:
            yield from _source_values(item)
    elif isinstance(node, dict):
        for value in node.values():
            yield from _source_values(value)




class CapabilityGraph:
    def __init__(self, corpus, *, expected_domains=33, expected_subdomains=247):
        self.corpus = corpus
        paths = corpus.taxonomy_paths
        self.directory = parse_json(corpus._raw_source(paths["recognized"]))
        self.outcomes = parse_json(corpus._raw_source(paths["outcomes"]))
        # Parse proposal surfaces, but never merge or promote them into recognized routes.
        self.prior_proposals = parse_json(corpus._raw_source(paths["prior_proposals"]))
        self.new_proposals = parse_json(corpus._raw_source(paths["new_proposals"]))
        require(isinstance(self.directory, dict) and isinstance(self.outcomes, dict) and
                isinstance(self.prior_proposals, dict) and isinstance(self.new_proposals, dict),
                "CAPABILITY_SCHEMA", "taxonomy source is not an object")

        domains = self.directory.get("domains")
        rows = self.outcomes.get("rows")
        require(isinstance(domains, list) and len(domains) == expected_domains,
                "CAPABILITY_COUNT", "recognized domain count disagrees")
        require(isinstance(rows, list) and len(rows) == expected_subdomains,
                "CAPABILITY_COUNT", "essential-outcome register is truncated")
        self.paths = {}
        self.review_routes = {}
        reviewed = {item["raw"]["record_id"]: item for item in corpus.records
                    if item["family"] == "governed"}
        self.mapped = Counter()
        for domain in domains:
            require(isinstance(domain, dict) and isinstance(domain.get("id"), str) and
                    isinstance(domain.get("subdomains"), list),
                    "CAPABILITY_SCHEMA", "invalid recognized domain")
            for sub in domain["subdomains"]:
                require(isinstance(sub, dict) and isinstance(sub.get("id"), str),
                        "CAPABILITY_SCHEMA", "invalid recognized subdomain")
                path = domain["id"] + "/" + sub["id"]
                require(path not in self.paths, "DUPLICATE_CAPABILITY", "duplicate route: " + path)
                matched = sub.get("matched_skill_ids")
                hints = sub.get("name_only_review_candidate_ids", [])
                require(isinstance(matched, list) and isinstance(hints, list) and
                        all(isinstance(x, str) and x for x in matched + hints) and
                        len(matched) == len(set(matched)) and len(hints) == len(set(hints)),
                        "CAPABILITY_SCHEMA", "malformed matched/hint identities: " + path)
                for rid in matched:
                    require(rid in reviewed, "UNKNOWN_REVIEW_REFERENCE",
                            "mapped source identity missing from governed records: " + rid)
                    require(path in reviewed[rid]["raw"]["capability_mapping"]["evidence_linked_paths"],
                            "CROSSWALK_DRIFT", "mapped record and capability source disagree: " + rid)
                    self.mapped[rid] += 1
                self.paths[path] = {"domain": domain, "subdomain": sub,
                                    "matched": matched, "hints": hints}
        require(len(self.paths) == expected_subdomains, "CAPABILITY_COUNT",
                "recognized capability routes are incomplete")
        for rid, item in reviewed.items():
            expected_routes = item["raw"]["capability_mapping"]["evidence_linked_paths"]
            require(self.mapped[rid] == len(expected_routes),
                    "CROSSWALK_DRIFT", "mapped review has an omitted recognized route: " + rid)

        self.outcome_by_path = {}
        for row in rows:
            require(isinstance(row, dict) and isinstance(row.get("path"), str) and
                    isinstance(row.get("essential_outcomes"), list),
                    "OUTCOME_SCHEMA", "invalid essential-outcome entry")
            path = row["path"]
            require(path not in self.outcome_by_path, "DUPLICATE_CAPABILITY",
                    "duplicate outcome entry: " + path)
            count = row.get("qualified_essential_outcome_count")
            require(count is None or (type(count) is int and 0 <= count <= len(row["essential_outcomes"])),
                    "OUTCOME_SCHEMA", "outcome qualification count is inconsistent: " + path)
            self.outcome_by_path[path] = row
        require(set(self.outcome_by_path) == set(self.paths),
                "CROSSWALK_DRIFT", "recognized routes and outcome rows differ")

    def summary(self):
        return {"schema": SCHEMA, "source_commit": COMMIT,
                "recognized_domains": len(self.directory["domains"]),
                "recognized_subdomains": len(self.paths),
                "evidence_mapped_governed_identities": len(self.mapped),
                "unmapped_governed_identities": self.corpus.manifest["counts"]["unmapped"],
                "outcome_definitions_missing": sum(
                    not r["essential_outcomes"] for r in self.outcome_by_path.values()),
                "unqualified_or_unknown_outcome_routes": sum(
                    r.get("qualified_essential_outcome_count") is None
                    for r in self.outcome_by_path.values()),
                "proposals_are_separate": {
                    "prior_proposals": self.corpus.taxonomy_paths["prior_proposals"],
                    "new_proposals": self.corpus.taxonomy_paths["new_proposals"]},
                "discovery_path_observations_without_governed_crosswalk": (
                    self.corpus.family_counts["g1-g3"] + self.corpus.family_counts["four-source"]),
                "cross_domain_links_preserved": True,
                "unmapped_does_not_mean_absent": True,
                "lexical_or_name_hints_are_not_evidence": True,
                "rights_assessed": False, "host_qualified": False,
                "composition_eligible": False}

    def show(self, path):
        require(path in self.paths, "UNRECOGNIZED_CAPABILITY",
                "not a recognized exact capability route; may be proposed or unknown")
        node = self.paths[path]
        outcome = self.outcome_by_path[path]
        candidates = []
        for rid in sorted(node["matched"]):
            record = self.corpus.by_id["governed:" + rid]
            candidates.append({
                "record_id": rid,
                "source_class": record["source_class"],
                "review_status": record["review_status"],
                "evidence_link_type": "pinned_navigation_only",
                "composition_eligibility": "not-assessed",
                "rights_clearance": "not-established"})
        return {"schema": SCHEMA, "source_commit": COMMIT, "path": path,
                "status": "DISCOVERY_ONLY_OUTCOME_GAPS_UNRESOLVED",
                "recognized": True,
                "domain": {"id": node["domain"]["id"], "name": node["domain"].get("name")},
                "subdomain": {"id": node["subdomain"]["id"],
                              "name": node["subdomain"].get("name")},
                "evidence_linked_reviews": candidates,
                "name_only_review_leads_not_qualified": sorted(node["hints"]),
                "outcome_definition_status": outcome.get("outcome_definition_status"),
                "essential_outcomes": outcome["essential_outcomes"],
                "existing_capability_statements_not_proofs":
                    outcome.get("existing_capability_statements", []),
                "qualified_essential_outcome_count":
                    outcome.get("qualified_essential_outcome_count"),
                "qualification_status": outcome.get("qualification_status"),
                "explicit_gaps": {
                    "needs_workflow_decomposition": not bool(outcome["essential_outcomes"]),
                    "rights_not_assessed": True,
                    "host_behavior_not_tested": True,
                    "discovery_observations_not_semantically_crosswalked": True},
                "source_outcome_row": self.corpus.taxonomy_paths["outcomes"],
                "composition_eligible": False}

    def search(self, query, limit=25):
        require(isinstance(query, str) and bool(query.strip()), "QUERY_REQUIRED", "query required")
        require(type(limit) is int and 0 < limit <= 200,
                "QUERY_LIMIT", "limit must be between 1 and 200")
        # Query only the *values* of recognized, pinned taxonomy fields.
        # Searching serialized JSON leaked field names such as "path" and
        # "essential_outcomes" into EVERY route, creating spurious matches.
        # An exact token match never constitutes source/rights/host admission.
        words = _tokens(query)
        require(bool(words), "QUERY_REQUIRED",
                "query must include a searchable lexical token")
        matched = []
        for path in sorted(self.paths):
            node = self.paths[path]
            outcome = self.outcome_by_path[path]
            values = (path, node["domain"].get("name"),
                      node["subdomain"].get("name"),
                      outcome.get("existing_capability_statements", []),
                      outcome["essential_outcomes"])
            indexed = frozenset().union(*(
                _tokens(value) for field in values
                for value in _source_values(field)))
            if words.issubset(indexed):
                matched.append(path)
        return {"schema": SCHEMA, "query": query,
                "search_type": "recognized_capability_lexical_routing_not_method_admission",
                "total_matches": len(matched), "truncated": len(matched) > limit,
                "routes": [self.show(path) for path in matched[:limit]],
                "unmapped_or_unreviewed_methods_not_proven_absent": True,
                "composition_eligible": False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    cmd = p.add_subparsers(dest="command", required=True)
    cmd.add_parser("summary")
    show = cmd.add_parser("show")
    show.add_argument("path")
    search = cmd.add_parser("search")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=25)
    args = p.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        if args.command == "summary":
            result = graph.summary()
        elif args.command == "show":
            result = graph.show(args.path)
        else:
            result = graph.search(args.query, limit=args.limit)
        print(json.dumps(result, sort_keys=True, indent=2, ensure_ascii=False))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
