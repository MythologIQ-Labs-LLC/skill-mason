#!/usr/bin/env python3
"""Real pinned-corpus 13-route product probe. Non-admitting by construction.

Run only against the complete exact-pinned skillz handoff and original source.
A user request here is explicitly pre-routed to a recognized capability: this
is NOT an LLM semantic classifier, license authority or skill runtime.
"""
import argparse
from collections import Counter
import json
import sys

from scripts.catalog_handoff import COMMIT, Refusal, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.capability_gap_backlog import load_proposals
from scripts.candidate_comparison import compare
from scripts.prism_input_preflight import prepare_preflight

SCHEMA = "qortara/capability-product-live-probe/1"
DENIAL = "REFUSED_PRE_ADMISSION"
MAX_ROUTES = 24


def evaluate(graph, proposals, *, comparator=compare, preflight=prepare_preflight,
             requested_routes=None):
    """Evaluate true pinned review/source evidence, without accepting sources."""
    require(isinstance(proposals, dict) and len(proposals) > 0,
            "PROBE_INPUT", "review-ready proposal routes must be present")
    routes = sorted(proposals) if requested_routes is None else requested_routes
    require(isinstance(routes, list) and 1 <= len(routes) <= MAX_ROUTES and
            len(routes) == len(set(routes)) and
            all(isinstance(x, str) and x in proposals and x in graph.paths
                for x in routes),
            "PROBE_ROUTE", "use distinct recognized source-pinned workflow routes")
    rows, codes = [], Counter()
    for route in routes:
        proposal = proposals[route]
        require(proposal["proposal_status"] == "DRAFT_NOT_GOVERNED" and
                proposal["rights_qualified"] is False and
                proposal["behavior_tested"] is False and
                proposal["method_source_attested"] is False,
                "PROBE_AUTHORITY", "a proposed workflow cannot self-authorize a method")
        host = "ChatGPT" if len(rows) % 2 == 0 else "Claude"
        result = comparator(graph, route, host, include_lexical=False, limit=5)
        require(result["route"] == route and result["chosen_method"] is None and
                result["eligible_candidate_count"] == 0 and
                result["composition_eligible"] is False and
                result["prism_invoked"] is False and
                result["full_package_rights_and_host_qualification_established"] is False,
                "PROBE_PROMOTION", "comparison cannot claim a qualified or selected skill")
        evidence = result["evidence_linked_reviews"]
        require(len(evidence) == result["evidence_linked_review_count"] and
                all(v["eligible"] is False for v in evidence),
                "PROBE_EVIDENCE", "route evidence count or admission flags disagree")
        # Deterministic inspection order, NOT a relevance/quality rank.
        # Prefer bytes-inspectable first-party source, then other evidence links.
        sampled = sorted(evidence, key=lambda e: (
            0 if e["source_class"] == "first-party" else 1,
            e["governed_id"]))
        candidate = sampled[0] if sampled else None
        negative = None
        if candidate is not None:
            gid = "governed:" + candidate["governed_id"]
            negative = preflight(graph, route, host, gid)
            require(negative["binding"]["governed_id"] == candidate["governed_id"] and
                    negative["binding"]["requested_route"] == route and
                    negative["negative_test_vector_hex"] == "00000000" and
                    negative["source_package_bytes_verified"] is
                        negative["typed_generation_refusal"]["original_source_bytes_proven"] and
                    negative["typed_generation_refusal"]["state"] == DENIAL and
                    negative["prism_invoked"] is False and
                    negative["composition_eligible"] is False and
                    negative["operator_accepted_rights"] is False and
                    all(v is False for v in negative["facts_verified"].values()),
                    "PROBE_PROMOTION", "preflight invented a positive source or Prism fact")
            blockers = negative["typed_generation_refusal"]["codes"]
            source_verified = negative["source_package_bytes_verified"]
            proof = negative["binding_sha256"]
        else:
            blockers = ["NO_EVIDENCE_LINKED_REVIEW", "OUTCOME_UNQUALIFIED",
                        "RIGHTS_UNRESOLVED", "HOST_NOT_VALIDATED"]
            source_verified = False
            proof = None
        for code in blockers:
            codes[code] += 1
        rows.append({
            "route": route,
            "requested_task": proposal["objective"],
            "target_host_label_not_authority": host,
            "proposal_status": proposal["proposal_status"],
            "acceptance_criteria_count": len(proposal["acceptance_criteria"]),
            "evidence_linked_review_count": len(evidence),
            "review_status_counts": result["evidence_linked_review_dispositions"],
            "name_only_unassessed_count": result["name_only_lead_count"],
            "sampled_governed_id_not_a_recommendation":
                candidate["governed_id"] if candidate is not None else None,
            "sampled_source_class":
                candidate["source_class"] if candidate is not None else None,
            "sampled_source_bytes_verified": source_verified,
            "sampled_source_binding_sha256": proof,
            "refusal_codes": blockers,
            "state": DENIAL, "chosen_method": None,
            "method_rights_established": False, "host_behavior_tested": False,
            "prism_invoked": False, "composition_eligible": False
        })
    return {
        "schema": SCHEMA,
        "state": "LIVE_PINNED_SOURCE_INSPECTION_NOT_SKILL_QUALIFICATION",
        "pinned_original_source_commit": COMMIT,
        "source_checkout_bytes_verified_by_corpus_loader": True,
        "proposal_count": len(proposals),
        "tested_distinct_routes": len(rows),
        "routes_with_evidence_linked_reviews": sum(
            bool(x["evidence_linked_review_count"]) for x in rows),
        "routes_with_no_evidence_linked_reviews": sum(
            not x["evidence_linked_review_count"] for x in rows),
        "sampled_original_source_bytes_verified_count": sum(
            x["sampled_source_bytes_verified"] for x in rows),
        "sampled_governed_records_count": sum(
            x["sampled_governed_id_not_a_recommendation"] is not None for x in rows),
        "refusal_code_occurrences_not_unique_skills": dict(sorted(codes.items())),
        "scenarios": rows,
        "pre_routed_requests_are_not_semantic_matching": True,
        "reviewed_candidates_are_not_necessarily_complete_packages": True,
        "original_source_identity_is_not_a_license": True,
        "rights_accepted": False,
        "real_host_invocations": 0,
        "actual_prism_guest_invocations": 0,
        "qualified_skills": 0,
        "composition_eligible": False
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    parser.add_argument("--proposals", required=True)
    options = parser.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(options.handoff, options.source_checkout))
        proposals = load_proposals(graph, options.proposals)
        report = evaluate(graph, proposals)
        print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
