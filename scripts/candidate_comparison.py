#!/usr/bin/env python3
"""Deterministic C4 *discovery* comparison for one recognized outcome route.

Complete snapshot indexing is not a complete set of qualified method candidates.
This is never a source/rights/host admission oracle or a 'best skill' ranker.
"""
import argparse
from collections import Counter
import json
import re
import sys

from scripts.catalog_handoff import COMMIT, Refusal, require, canonical, sha256
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.package_resolver import inspect_package
from scripts.external_package_resolver import inspect_external

SCHEMA = "qortara/candidate-comparison/1"
MAX_LEADS = 50
MAX_HOST_LENGTH = 128


def _status(status):
    if status == "rejected":
        return "BLOCKED_STATIC_REVIEW"
    if status == "retired":
        return "BLOCKED_RETIRED"
    if status in ("verified", "verified-with-portability-caveats"):
        return "BLOCKED_RIGHTS_AND_HOST_UNASSESSED"
    return "BLOCKED_REVIEW_UNKNOWN"


def compare(graph, route, host, *, include_lexical=True, limit=25,
            package_inspector=inspect_package,
            external_selection=None, external_inspector=inspect_external):
    require(isinstance(route, str) and route in graph.paths,
            "UNKNOWN_ROUTE", "select one exact recognized capability route")
    require(isinstance(host, str) and 0 < len(host.strip()) <= MAX_HOST_LENGTH and
            not any(ord(x) < 32 for x in host),
            "HOST_REQUIRED", "target host label required but never grants authority")
    require(type(limit) is int and 0 < limit <= MAX_LEADS,
            "LIMIT", "sample limit out of bounds")
    corpus = graph.corpus
    node = graph.paths[route]
    outcome = graph.outcome_by_path[route]
    matched = sorted(node["matched"])
    hints = sorted(node["hints"])
    reviewed = {item["raw"]["record_id"]: item
                for item in corpus.records if item["family"] == "governed"}
    if external_selection is not None:
        require(isinstance(external_selection, dict) and
                set(external_selection) == {"record_id", "checkout", "repo_tree"},
                "EXTERNAL_SELECTION",
                "supply exact record ID, separately pinned checkout and Git tree")
        ext_id = external_selection["record_id"]
        require(isinstance(ext_id, str) and ext_id.startswith("governed:") and
                ext_id[len("governed:"):] in matched and
                reviewed[ext_id[len("governed:"):]]["source_class"] == "third-party",
                "EXTERNAL_SELECTION",
                "external package must be an evidence-linked third-party review for route")
    evidence = []
    statuses = Counter()
    for rid in matched:
        item = reviewed[rid]
        row = item["raw"]
        status = _status(row["review"]["semantic_status"])
        package = {"status": "NOT_INSPECTED", "reason": "external package source is unavailable"}
        if item["source_class"] == "first-party":
            try:
                package_receipt = package_inspector(corpus, "governed:" + rid)
                package = {"status": package_receipt["state"],
                           "package_files": package_receipt["package_file_count"],
                           "file_list_sha256": package_receipt["package_file_list_sha256"],
                           "reference_dependency_closure_proven": False}
            except Refusal as exc:
                package = {"status": "REFUSED", "code": exc.code}
        elif external_selection is not None and external_selection["record_id"] == "governed:" + rid:
            # Run the full Git inspector directly. Never accept arbitrary
            # caller-supplied JSON as a verified package receipt.
            external = external_inspector(
                corpus, "governed:" + rid, external_selection["checkout"],
                expected_repo_tree=external_selection["repo_tree"])
            review = external.get("complete_package_reference_and_asset_review_queue")
            require(isinstance(review, dict) and
                    review.get("schema") == "qortara/package-reference-inventory/1" and
                    review.get("state") == "VERIFIED_SOURCE_BYTES_REFERENCE_LEADS_ONLY" and
                    review.get("file_count") ==
                        external.get("complete_tracked_package_files_verified") and
                    review.get("each_asset_rights_cleared") is False and
                    review.get("dependency_closure_proven") is False and
                    review.get("source_license_and_notice_obligations_assessed") is False and
                    review.get("target_host_approved") is False and
                    review.get("composition_eligible") is False,
                    "EXTERNAL_ASSET_REVIEW",
                    "external package must provide an unqualified full-file rights review queue")
            package = {
                "status": external["state"],
                "source_asset_rights_review_queue_sha256": sha256(canonical(review)),
                "asset_files_requiring_review": review["file_count"],
                "source_license_pointer_evidence_present":
                    bool(review["frontmatter_license_pointer"]["matched"]),
                "source_asset_rights_and_dependencies_still_unqualified": True,
                "package_files": external["complete_tracked_package_files_verified"],
                "package_git_tree_sha1": external["package_git_tree_sha1"],
                "entrypoint_git_blob_sha1": external["entrypoint_git_blob_sha1"],
                "historical_export_identity_gap_requires_upstream_correction":
                    external["historical_export_identity_gap_requires_upstream_correction"],
                "reference_dependency_closure_proven": False,
                "rights_and_host_still_unapproved": True}
        statuses[status] += 1
        evidence.append({
            "governed_id": rid, "review_status": row["review"]["semantic_status"],
            "source_class": item["source_class"], "disposition": status,
            "evidence_linked_routes": sorted(row["capability_mapping"]["evidence_linked_paths"]),
            "package_bytes": package,
            "reuse_rights_assessed": False,
            "target_host_assessed": False,
            "eligible": False})
    names = []
    for rid in hints:
        item = reviewed.get(rid)
        names.append({"governed_id_or_unresolved_hint": rid,
                      "governed_record_found": item is not None,
                      "recorded_review_status": item["review_status"] if item else None,
                      "evidence_link_assessed": False,
                      "candidate_disposition": "NAME_ONLY_UNASSESSED_NOT_EVIDENCE",
                      "overlaps_evidence_linked": rid in matched,
                      "eligible": False})
    # This is *lexical* search over all declared occurrence rows. It is
    # exhaustive for this literal query and NOT exhaustive for semantic relevance.
    term = node["subdomain"]["id"].replace("-", " ").casefold()
    search_terms = [x for x in re.split(r"\s+", term) if len(x) >= 3]
    lexical_count = 0
    leads = []
    if include_lexical and search_terms:
        for item in corpus.records:
            if item["family"] not in ("g1-g3", "four-source"):
                continue
            raw = json.dumps(item["raw"], sort_keys=True, ensure_ascii=False).casefold()
            if all(token in raw for token in search_terms):
                lexical_count += 1
                if len(leads) < limit:
                    leads.append({"id": item["id"], "family": item["family"],
                                  "source_file": item["source_file"],
                                  "pointer": item["pointer"],
                                  "relevance_class": "UNASSESSED_LEXICAL_LEAD",
                                  "eligible": False})
    return {"schema": SCHEMA, "state": "READ_ONLY_COMPARISON_NO_ADMISSION",
            "exact_source_commit": COMMIT,
            "route": route, "target_host_requested_not_approved": host.strip(),
            "outcome_definition_status": outcome.get("outcome_definition_status"),
            "defined_essential_outcomes": len(outcome["essential_outcomes"]),
            "essential_outcome_qualification_count": outcome.get("qualified_essential_outcome_count"),
            "evidence_linked_review_count": len(evidence),
            "evidence_linked_review_dispositions": dict(sorted(statuses.items())),
            "evidence_linked_reviews": evidence,
            "name_only_lead_count": len(names),
            "name_only_unassessed_leads": names,
            "lexical_observation_query": search_terms if include_lexical else None,
            "lexical_observation_match_count": lexical_count if include_lexical else None,
            "lexical_observation_leads": leads,
            "lexical_observation_truncated": lexical_count > len(leads),
            "declared_observation_rows_swept": (
                corpus.family_counts["g1-g3"] + corpus.family_counts["four-source"]
                if include_lexical else 0),
            "lexical_relevance_is_not_semantic_matching": True,
            "unmapped_and_unreviewed_methods_may_be_relevant": True,
            "all_semantically_relevant_sources_exhaustively_qualified": False,
            "full_package_rights_and_host_qualification_established": False,
            "externally_inspected_governed_id":
                external_selection["record_id"] if external_selection is not None else None,
            "external_inspection_does_not_grant_rights_or_relevance": True,
            "chosen_method": None,
            "eligible_candidate_count": 0,
            "composition_eligible": False,
            "prism_invoked": False,
            "receipt_not_a_best_method_rank": True}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    p.add_argument("--route", required=True)
    p.add_argument("--host", required=True)
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--no-lexical", action="store_true")
    p.add_argument("--external-record")
    p.add_argument("--external-checkout")
    p.add_argument("--external-repository-tree")
    opts = p.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(opts.handoff, opts.source_checkout))
        supplied = (opts.external_record, opts.external_checkout,
                    opts.external_repository_tree)
        require(all(x is not None for x in supplied) or all(
            x is None for x in supplied),
            "EXTERNAL_SELECTION",
            "external record/checkout/tree flags must be provided together")
        external = ({"record_id": opts.external_record,
                     "checkout": opts.external_checkout,
                     "repo_tree": opts.external_repository_tree}
                    if opts.external_record is not None else None)
        receipt = compare(graph, opts.route, opts.host,
                          include_lexical=not opts.no_lexical, limit=opts.limit,
                          external_selection=external)
        print(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
