#!/usr/bin/env python3
"""Full pinned 247-route capability gap ledger and draft-workflow review queue.

This is a discovery + human-review queue. It does not change upstream skillz,
declare capability coverage, qualify rights, or install executable skill content.
"""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import sys

from scripts.catalog_handoff import COMMIT, Refusal, parse_json, read_exact, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph

SCHEMA = "qortara/capability-gap-ledger/1"
PROPOSAL_SCHEMA = "qortara/essential-workflow-proposals/1"
PROPOSAL_SOURCE = "registry/capability-outcome-register.json"
CATEGORIES = (
    "LINKED_SOURCE_NEEDS_WORKFLOW_DEFINITION",
    "NAME_ONLY_LEADS_NEED_SOURCE_REVIEW",
    "NO_EVIDENCE_LINKS_NEEDS_DISCOVERY",
    "DEFINED_WORKFLOW_NEEDS_QUALIFICATION",
    "DEFINED_WORKFLOW_NEEDS_SOURCING",
)
REQUIRED_OUTCOME_FIELDS = (
    "objective", "inputs", "outputs", "acceptance_criteria",
    "dependencies", "failure_modes", "refusal_rule",
)


def _text(value, key):
    require(isinstance(value, str) and bool(value.strip()) and len(value) <= 2000,
            "PROPOSAL_SCHEMA", "missing, empty or oversized proposal field: " + key)
    return value


def _strings(value, key):
    require(isinstance(value, list) and 1 <= len(value) <= 20 and
            all(isinstance(x, str) and 0 < len(x.strip()) <= 1000 for x in value) and
            len(set(value)) == len(value),
            "PROPOSAL_SCHEMA", "empty, duplicate or malformed " + key)
    return value


def load_proposals(graph, proposal_path):
    """Fail closed on stale source pins, stale outcome rows and any rights promotion."""
    if proposal_path is None:
        return {}
    raw = read_exact(Path(proposal_path), 2_000_000)
    data = parse_json(raw)
    require(isinstance(data, dict) and
            data.get("schema_version") == PROPOSAL_SCHEMA and
            data.get("source_commit") == COMMIT and
            data.get("source_outcome_register") == PROPOSAL_SOURCE and
            data.get("authority") == "proposals-only-not-imported-into-skillz-or-capability-graph" and
            data.get("outcome_definition_status") ==
            "draft-requires-upstream-source-and-owner-review" and
            data.get("qualification_status") == "not-tested" and
            data.get("rights_assessed") is False and
            data.get("host_validated") is False and
            data.get("composition_eligible") is False,
            "PROPOSAL_AUTHORITY", "draft workflow file cannot assert upstream qualification")
    rows = data.get("rows")
    require(isinstance(rows, list) and len(rows) <= len(graph.paths),
            "PROPOSAL_SCHEMA", "missing or oversized draft set")
    output = {}
    for row in rows:
        require(isinstance(row, dict) and isinstance(row.get("route"), str) and
                row["route"] in graph.paths and row["route"] not in output,
                "PROPOSAL_ROUTE", "unknown, duplicated or malformed route")
        route = row["route"]
        outcome = graph.outcome_by_path[route]
        require(not outcome["essential_outcomes"] and
                row.get("source_outcome_current_status") ==
                outcome.get("outcome_definition_status"),
                "PROPOSAL_STALE", "recognized outcome already defined or source status changed")
        anchor = row.get("source_anchor")
        require(isinstance(anchor, dict) and
                anchor.get("source_commit") == COMMIT and
                anchor.get("outcome_register_path") == PROPOSAL_SOURCE and
                anchor.get("route") == route,
                "PROPOSAL_SOURCE", "draft is not linked to exact original outcome row")
        require(row.get("proposal_status") == "DRAFT_NOT_GOVERNED" and
                row.get("method_source_attested") is False and
                row.get("rights_qualified") is False and
                row.get("behavior_tested") is False,
                "PROPOSAL_AUTHORITY", "unapproved capabilities cannot be asserted")
        _text(row.get("objective"), "objective")
        _text(row.get("refusal_rule"), "refusal_rule")
        for field in ("inputs", "outputs", "acceptance_criteria",
                      "dependencies", "failure_modes"):
            _strings(row.get(field), field)
        require(len(row["acceptance_criteria"]) >= 2,
                "PROPOSAL_SCHEMA", "outcome proposal needs testable acceptance criteria")
        output[route] = row
    return output


def _category(node, outcome):
    has_evidence = bool(node["matched"])
    if not outcome["essential_outcomes"]:
        if has_evidence:
            return CATEGORIES[0]
        if node["hints"]:
            return CATEGORIES[1]
        return CATEGORIES[2]
    return CATEGORIES[3] if has_evidence else CATEGORIES[4]


def build_ledger(graph, proposals=None, *, limit=40):
    require(type(limit) is int and 1 <= limit <= 247,
            "LIMIT", "route sample limit must be between 1 and 247")
    proposals = proposals if proposals is not None else {}
    require(isinstance(proposals, dict) and all(x in graph.paths for x in proposals),
            "PROPOSAL_ROUTE", "unknown route in proposed workflow set")
    by_domain = defaultdict(list)
    categories = Counter()
    routes = {}
    governed = {r["raw"]["record_id"]: r for r in graph.corpus.records
                if r["family"] == "governed"}
    linked_unique = set()
    for route in sorted(graph.paths):
        node = graph.paths[route]
        outcome = graph.outcome_by_path[route]
        category = _category(node, outcome)
        categories[category] += 1
        linked = sorted(node["matched"])
        hints = sorted(node["hints"])
        linked_unique.update(linked)
        state_counts = dict(sorted(Counter(
            governed[rid]["review_status"] for rid in linked).items()))
        row = {
            "route": route, "domain": node["domain"]["id"],
            "subdomain": node["subdomain"]["id"],
            "gap_category": category,
            "evidence_linked_review_count": len(linked),
            "evidence_linked_review_statuses": state_counts,
            "review_ids": linked,
            "name_only_hint_count": len(hints),
            "name_only_hint_ids": hints,
            "defined_essential_outcome_count": len(outcome["essential_outcomes"]),
            "outcome_qualification_count": outcome.get("qualified_essential_outcome_count"),
            "recorded_capability_statements_not_proofs":
                outcome.get("existing_capability_statements", []),
            "draft_workflow_proposal_count": 1 if route in proposals else 0,
            "draft_workflow_status": ("DRAFT_REVIEW_READY_NOT_IMPORTED"
                                      if route in proposals else "NO_DRAFT"),
            "next_action": (
                "Review proposed inputs, outputs, correctness, dependency and failure criteria "
                "with exact source evidence; publish upstream only after approval."
                if route in proposals else
                "Define testable essential outcome inputs/outputs/acceptance before method qualification."
                if not outcome["essential_outcomes"] else
                "Verify complete pinned sources, compare candidates and test host outcomes."),
            "rights_qualified": False,
            "host_qualified": False,
            "composition_eligible": False,
        }
        routes[route] = row
        by_domain[row["domain"]].append(row)
    require(len(routes) == len(graph.paths) and len(linked_unique) == len(graph.mapped),
            "LEDGER_CARDINALITY", "ledger silently dropped or duplicated recognized routes")
    domains = []
    for name in sorted(by_domain):
        items = by_domain[name]
        domains.append({
            "domain": name, "recognized_subdomains": len(items),
            "subdomains_with_evidence_linked_reviews": sum(
                bool(x["evidence_linked_review_count"]) for x in items),
            "subdomains_with_name_only_hints": sum(bool(x["name_only_hint_count"]) for x in items),
            "missing_essential_workflows": sum(
                x["defined_essential_outcome_count"] == 0 for x in items),
            "draft_proposals_review_pending": sum(x["draft_workflow_proposal_count"] for x in items),
            "qualified_or_approved_methods_asserted": 0})
    # Interleave domain queues. This is a transparent *work distribution* heuristic,
    # not a relative skill-quality, coverage or eligibility score.
    priorities = {}
    for name, rows in by_domain.items():
        priorities[name] = sorted(
            rows, key=lambda x: (-x["draft_workflow_proposal_count"],
                                 CATEGORIES.index(x["gap_category"]), x["route"]))
    ordered = []
    max_size = max(len(x) for x in priorities.values())
    for k in range(max_size):
        for name in sorted(priorities):
            rows = priorities[name]
            if k < len(rows):
                ordered.append(rows[k])
    require(len(ordered) == len(routes), "LEDGER_CARDINALITY",
            "worklist lost recognized routes")
    gaps_without_evidence = sum(not r["evidence_linked_review_count"] for r in routes.values())
    return {"schema": SCHEMA,
            "state": "GOVERNED_REVIEW_QUEUE_NOT_SKILL_ADMISSION",
            "source_commit": COMMIT,
            "recognized_domains": len(domains),
            "recognized_subdomains": len(routes),
            "subdomains_without_evidence_linked_reviews": gaps_without_evidence,
            "subdomains_with_evidence_linked_reviews": len(routes) - gaps_without_evidence,
            "essential_outcome_definitions_missing": sum(
                r["defined_essential_outcome_count"] == 0 for r in routes.values()),
            "unqualified_or_unknown_outcome_routes": sum(
                r["outcome_qualification_count"] is None for r in routes.values()),
            "reviewed_identities_with_evidence_links": len(linked_unique),
            "governed_reviews_unmapped": graph.corpus.manifest["counts"]["unmapped"],
            "raw_source_path_observations_not_reviewed": (
                graph.corpus.family_counts["g1-g3"] +
                graph.corpus.family_counts["four-source"]),
            "gap_categories": dict(sorted(categories.items())),
            "draft_workflow_proposals_pending_review": len(proposals),
            "draft_workflows_have_not_changed_pinned_outcomes": True,
            "domains": domains,
            "work_queue_total": len(ordered),
            "queue_sample": ordered[:limit],
            "queue_sample_truncated": limit < len(ordered),
            "queue_policy": "round-robin-by-domain; per-domain drafts first then explicit gap class",
            "semantic_candidate_exhaustiveness_proven": False,
            "review_quality_not_inferred_from_counts": True,
            "source_rights_or_host_authority_assessed": False,
            "methods_admitted": 0,
            "composition_eligible": False}


def focus(graph, route, proposals=None):
    require(isinstance(route, str) and route in graph.paths,
            "UNKNOWN_ROUTE", "focus requires an exact recognized route")
    summary = build_ledger(graph, proposals=proposals, limit=247)
    result = next(item for item in summary["queue_sample"] if item["route"] == route)
    proposed = (proposals or {}).get(route)
    return {"schema": SCHEMA, "state": "FOCUSED_WORKFLOW_REVIEW_NOT_ADMISSION",
            "source_commit": COMMIT, "route": result,
            "proposed_workflow": proposed,
            "proposal_is_authoritative": False,
            "actual_registered_essential_outcomes": graph.outcome_by_path[route]["essential_outcomes"],
            "source_corpus_reviewed": True,
            "source_methods_qualified": False,
            "composition_eligible": False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True, type=Path)
    p.add_argument("--source-checkout", required=True, type=Path)
    p.add_argument("--proposals", type=Path)
    sub = p.add_subparsers(dest="command", required=True)
    backlog = sub.add_parser("summary")
    backlog.add_argument("--limit", type=int, default=40)
    focused = sub.add_parser("focus")
    focused.add_argument("route")
    args = p.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        proposals = load_proposals(graph, args.proposals)
        report = (build_ledger(graph, proposals, limit=args.limit)
                  if args.command == "summary"
                  else focus(graph, args.route, proposals))
        print(json.dumps(report, sort_keys=True, ensure_ascii=False, indent=2))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
