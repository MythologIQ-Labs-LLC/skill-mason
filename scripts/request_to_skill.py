#!/usr/bin/env python3
"""First user-request entrypoint over the real pinned Skillz corpus.

This is read-only admission, NOT a second eligibility engine. It delegates
selection evidence to C4 and authentic-source denials to C5. No source rights,
host permissions, semantic routing or P0 fixture facts are inferred from text.
"""
import argparse
import json
from pathlib import Path
import re
import sys
import unicodedata

from scripts.catalog_handoff import Refusal, canonical, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.capability_gap_backlog import load_proposals
from scripts.source_outcome_scope_review import assess_scope, SCHEMA as SCOPE_SCHEMA, DISPOSITION as SCOPE_DISPOSITION
from scripts.catalog_handoff import parse_json, read_exact
from scripts.candidate_comparison import compare
from scripts.prism_input_preflight import prepare_preflight

SCHEMA = "qortara/request-to-skill-evaluation/1"
REFUSAL_SCHEMA = "qortara/skill-generation-refusal/1"
CONTROL = re.compile(r"[\x00-\x1f\x7f]")
# The user's intent never becomes signed authority or generated method text.
MIN_WORDS = 4
MAX_REQUEST = 1200


def _request(value):
    require(isinstance(value, str), "REQUEST_REQUIRED",
            "describe an actual requested outcome")
    require(value == unicodedata.normalize("NFC", value) and
            len(value) <= MAX_REQUEST and not CONTROL.search(value),
            "REQUEST_INVALID", "request must be bounded NFC text with no controls")
    normalized = " ".join(value.split())
    require(16 <= len(normalized) <= MAX_REQUEST and
            len(normalized.split(" ")) >= MIN_WORDS,
            "REQUEST_TOO_SHORT", "supply an actual task and specific outcome")
    return normalized


def _snapshot(graph):
    source = graph.corpus.manifest["source"]
    require(isinstance(source, dict) and
            source.get("commit") == "31a8c518dd97b7828adcc728202fa41388a306d7" and
            source.get("git_tree_sha1") == "e6d5dfeb42bcd7777ddff52605922fead62135ff",
            "SOURCE_PIN", "only the separately verified pinned source snapshot is supported")
    return {
        "repository": source["repository"],
        "commit": source["commit"],
        "git_tree_sha1": source["git_tree_sha1"]
    }



def _source_outcome_coverage(graph, route, comparison):
    """Explain pinned outcome gaps; never convert definitions into permission."""
    rows = getattr(graph, "outcome_by_path", None)
    require(isinstance(rows, dict) and route in rows,
            "OUTCOME_SOURCE_MISSING", "recognized route lacks a pinned source outcome row")
    row = rows[route]
    require(isinstance(row, dict) and row.get("path") == route and
            isinstance(row.get("essential_outcomes"), list),
            "OUTCOME_SOURCE_DRIFT", "source outcome row is malformed or mismatched")
    defined = row["essential_outcomes"]
    qualified = row.get("qualified_essential_outcome_count")
    require(qualified is None or
            (type(qualified) is int and 0 <= qualified <= len(defined)),
            "OUTCOME_SOURCE_DRIFT", "source qualification count is malformed")
    # C4 is a separate consumer of the same immutable C2 source. A forged or
    # stale count cannot quietly make a blocked route appear fully specified.
    require(comparison.get("outcome_definition_status") ==
                row.get("outcome_definition_status") and
            comparison.get("defined_essential_outcomes") == len(defined) and
            comparison.get("essential_outcome_qualification_count") == qualified,
            "OUTCOME_COMPARISON_DRIFT", "C2 source and C4 comparison disagree")
    gap_code = ("OUTCOME_DEFINITION_MISSING" if not defined else
                "OUTCOME_QUALIFICATION_UNVERIFIED")
    return {
        "schema": "qortara/route-outcome-coverage/1",
        "route": route,
        "source_outcome_row": graph.corpus.taxonomy_paths["outcomes"],
        "source_outcome_row_sha256": sha256(canonical(row)),
        "outcome_definition_status": row.get("outcome_definition_status"),
        "defined_essential_outcomes": defined,
        "defined_essential_outcome_count": len(defined),
        "source_claimed_qualified_count_not_independent_proof": qualified,
        "gap_code": gap_code,
        "next_action": ("Define and govern testable inputs, outputs and "
                        "acceptance criteria through the upstream source "
                        "process, then explicitly accession the new snapshot."
                        if not defined else
                        "Independently establish outcome coverage, rights and "
                        "host behavior before authorizing composition."),
        "outcomes_independently_qualified": False,
        "composition_eligible": False,
    }


# Only already published, negative-only evidence records may add scope gaps.
# The source review stays outside the compiler and can never authorize a method.
_SCOPE_NOTES = {
    ("security/supply-chain", "local-skills/mcp-vetting"):
        "source-outcome-scope-mcp-vetting-v1.json",
}


def _verified_scope_gap(graph, route, selected):
    key = (route, selected.removeprefix("governed:"))
    name = _SCOPE_NOTES.get(key)
    if name is None:
        return None
    root = Path(__file__).resolve().parents[1]
    proposals = load_proposals(
        graph, root / "docs/technical/essential-workflow-proposals-v1.json")
    review = parse_json(read_exact(root / "docs/evidence" / name, 128_000))
    return assess_scope(graph, proposals, review)


def evaluate_request(graph, request, host, route=None, governed_method=None,
                     *, external_selection=None, comparator=compare,
                     preflight=prepare_preflight, scope_evaluator=None):
    """One real task requirement -> reviewed source disposition or typed refusal.

    Even an externally byte-verified method is *not* licensed or signed by the
    catalog. There is no authorized positive path in this first user entrypoint.
    """
    requested = _request(request)
    require(route is not None and route != "", "ROUTE_REQUIRED",
            "select one explicit recognized route; free text cannot grant semantic routing")
    require(isinstance(route, str) and route in graph.paths, "UNKNOWN_ROUTE",
            "requested route is absent from the exact pinned capability graph")
    require(isinstance(host, str) and 0 < len(host.strip()) <= 128 and
            not CONTROL.search(host), "HOST_REQUIRED",
            "provide a bounded target host label; the label grants no host permissions")
    host = host.strip()
    if governed_method is not None:
        require(isinstance(governed_method, str) and
                governed_method.startswith("governed:") and len(governed_method) <= 220,
                "METHOD_SELECTION", "only one exact governed record ID is allowed")
    require(external_selection is None or (
        isinstance(external_selection, dict) and
        set(external_selection) == {"record_id", "checkout", "repo_tree"} and
        external_selection["record_id"] == governed_method),
        "EXTERNAL_SELECTION", "external source evidence must identify the chosen governed record")
    snapshot = _snapshot(graph)
    comparison = comparator(
        graph, route, host, include_lexical=False, limit=25,
        external_selection=external_selection)
    require(isinstance(comparison, dict) and
            comparison.get("schema") == "qortara/candidate-comparison/1" and
            comparison.get("route") == route and
            comparison.get("state") == "READ_ONLY_COMPARISON_NO_ADMISSION" and
            comparison.get("composition_eligible") is False and
            comparison.get("prism_invoked") is False and
            comparison.get("full_package_rights_and_host_qualification_established") is False and
            comparison.get("chosen_method") is None and
            comparison.get("eligible_candidate_count") == 0,
            "UNTRUSTED_PROMOTION", "comparison tried to assert an authorized method")
    coverage = _source_outcome_coverage(graph, route, comparison)
    reviewed = comparison.get("evidence_linked_reviews")
    require(isinstance(reviewed, list) and
            comparison.get("evidence_linked_review_count") == len(reviewed) and
            all(isinstance(x, dict) and x.get("eligible") is False and
                isinstance(x.get("governed_id"), str) for x in reviewed),
            "COMPARISON_INTEGRITY", "comparison lacks the complete non-admitting reviewed set")
    # None of the reviewed records may be automatically *composed*. A single
    # source may be inspected for a better refusal without claiming preference.
    matched = {x["governed_id"]: x for x in reviewed}
    require(len(matched) == len(reviewed), "COMPARISON_INTEGRITY",
            "duplicate governed comparison identity")
    selected = None
    if governed_method is not None:
        selected_id = governed_method.removeprefix("governed:")
        require(selected_id in matched, "METHOD_SELECTION",
                "selected review is not evidence-linked to the declared route")
        selected = governed_method
    elif len(reviewed) == 1:
        selected = "governed:" + reviewed[0]["governed_id"]

    # Full review set and any unassessed name-only leads are retained in the
    # comparison receipt. No discovery row is silently made eligible.
    inspected = None
    binding = None
    if selected is not None:
        inspected = preflight(graph, route, host, selected,
                             external_selection=external_selection,
                             comparison_receipt=comparison)
        expected_id = selected.removeprefix("governed:")
        require(isinstance(inspected, dict) and
                inspected.get("schema") == "qortara/method-to-prism-preflight/1" and
                inspected.get("state") == "UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION" and
                inspected.get("composition_eligible") is False and
                inspected.get("prism_invoked") is False and
                inspected.get("operator_accepted_rights") is False and
                inspected.get("host_authority_verified") is False and
                inspected.get("independently_authenticated_method_assertion") is False and
                inspected.get("selected_method_for_composition") is None and
                inspected.get("facts_verified") ==
                    {"evidence": False, "rights": False, "authority": False, "coverage": False} and
                inspected.get("binding", {}).get("governed_id") == expected_id and
                inspected.get("binding", {}).get("requested_route") == route and
                inspected.get("negative_test_vector_hex") == "00000000",
                "UNTRUSTED_PROMOTION", "preflight attempted to grant source or host authority")
        # Bind the selected C5 fact vector to the *same*, already verified
        # C4 package receipt. A second repository scan between passes could
        # otherwise see a different source tree or license/asset review.
        if preflight is prepare_preflight:
            candidate = matched[expected_id]
            bound = inspected.get("binding")
            source_record = graph.corpus.by_id.get(selected)
            require(isinstance(bound, dict) and source_record is not None and
                    bound.get("governed_id") == expected_id and
                    bound.get("snapshot_commit") == snapshot["commit"] and
                    bound.get("snapshot_tree") == snapshot["git_tree_sha1"] and
                    bound.get("requested_route") == route and
                    bound.get("requested_host_label_not_authority") == host and
                    bound.get("review_status") == candidate["review_status"] and
                    bound.get("review_disposition") == candidate["disposition"] and
                    bound.get("governed_record_sha256") ==
                        sha256(canonical(source_record["raw"])) and
                    bound.get("package_inspection_sha256") ==
                        sha256(canonical(candidate["package_bytes"])) and
                    bound.get("comparison_receipt_sha256") ==
                        sha256(canonical(comparison)) and
                    bound.get("package_bytes_verified") is
                        (candidate["package_bytes"].get("status") in (
                            "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
                            "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED")) and
                    inspected.get("binding_sha256") == sha256(canonical(bound)),
                    "SOURCE_BINDING_MISMATCH",
                    "C4 source, asset and C5 refusal receipts do not identify the same evidence")
        binding = inspected["binding_sha256"]
        refusal_codes = inspected["typed_generation_refusal"]["codes"]
        require(isinstance(refusal_codes, list) and
                "RIGHTS_UNRESOLVED" in refusal_codes,
                "UNTRUSTED_PROMOTION", "unsigned source rights must remain explicitly unresolved")
        for important in ("STATIC_REVIEW_REJECTED", "SOURCE_RETIRED",
                          "STATIC_REVIEW_UNKNOWN"):
            if important in refusal_codes:
                code = important
                break
        else:
            code = "RIGHTS_UNRESOLVED"
    elif len(reviewed) == 0:
        code, refusal_codes = "MAPPING_GAP", ["MAPPING_GAP", "OUTCOME_UNCOVERED"]
    else:
        code, refusal_codes = "METHOD_SELECTION_REQUIRED", [
            "METHOD_SELECTION_REQUIRED", "RIGHTS_UNRESOLVED", "OUTCOME_UNCOVERED"]

    # Source-scope review is an additional denial, never a source of eligibility.
    scope_gap = None
    if selected is not None and scope_evaluator is not None:
        scope_gap = scope_evaluator(graph, route, selected)
        if scope_gap is not None:
            rid = selected.removeprefix("governed:")
            require(isinstance(scope_gap, dict) and
                    scope_gap.get("schema") == SCOPE_SCHEMA and
                    scope_gap.get("state") ==
                        "NONADMITTING_SOURCE_SCOPE_GAP_RECORDED" and
                    scope_gap.get("reviewer_observation_disposition_not_independent_qualification")
                        == SCOPE_DISPOSITION and
                    scope_gap.get("route") == route and
                    scope_gap.get("governed_review_id") == rid and
                    scope_gap.get("source_snapshot_commit") == snapshot["commit"] and
                    scope_gap.get("source_snapshot_tree") == snapshot["git_tree_sha1"] and
                    scope_gap.get("rights_qualified") is False and
                    scope_gap.get("host_validated") is False and
                    scope_gap.get("outcome_coverage_qualified") is False and
                    scope_gap.get("prism_invoked") is False and
                    scope_gap.get("composer_invoked") is False and
                    scope_gap.get("composition_eligible") is False,
                    "SCOPE_REVIEW_INTEGRITY",
                    "source-scope review must identify the exact selected method and remain a denial")

    # Keep the primary source/method refusal stable; report the independent
    # source-outcome blocker alongside it, never as permission to compose.
    refusal_codes = list(refusal_codes)
    if coverage["gap_code"] not in refusal_codes:
        refusal_codes.append(coverage["gap_code"])
    if scope_gap is not None and "METHOD_SCOPE_UNESTABLISHED" not in refusal_codes:
        refusal_codes.append("METHOD_SCOPE_UNESTABLISHED")

    return {
        "schema": SCHEMA,
        "state": "REFUSED_PRE_ADMISSION",
        "request_sha256": sha256(requested.encode("utf-8")),
        "requested_route_explicit_not_semantic_matching": route,
        "target_host_label_not_approved": host,
        "pinned_source": snapshot,
        "comparison_receipt_sha256": sha256(canonical(comparison)),
        "source_outcome_coverage": coverage,
        "reviewed_method_scope_gap": (None if scope_gap is None else {
            "state": scope_gap["state"],
            "source_entrypoint": scope_gap["source_entrypoint"],
            "original_source_sha256": scope_gap["entrypoint_sha256"],
            "complete_package_file_list_sha256": scope_gap["original_complete_package_file_list_sha256"],
            "proposal_sha256": scope_gap["proposal_sha256"],
            "review_sha256": scope_gap["review_sha256"],
            "unestablished_requested_outcomes": scope_gap["unestablished_requested_outcomes"],
            "narrower_workflow_candidate_not_governed":
                scope_gap["narrower_workflow_candidate_not_governed"],
            "rights_qualified": False,
            "composition_eligible": False,
        }),
        "evidence_linked_review_count": len(reviewed),
        "candidates": [{
            "governed_id": x["governed_id"],
            "review_status": x["review_status"],
            "source_class": x["source_class"],
            "disposition": x["disposition"],
            "package_bytes": x["package_bytes"],
            "eligible": False,
        } for x in reviewed],
        "name_only_unassessed_leads": comparison["name_only_unassessed_leads"],
        "inspected_governed_record_not_selected_for_composition": selected,
        "selected_source_binding_sha256": binding,
        "selected_package_comparison_source_bound": bool(
            selected is not None and preflight is prepare_preflight),
        "comparison_reused_for_preflight_without_second_source_scan": bool(
            selected is not None and preflight is prepare_preflight),
        "refusal": {
            "schema": REFUSAL_SCHEMA,
            "code": code,
            "codes": refusal_codes,
            "stage": "source-method-qualification",
            "missing_authorization": "independently accepted rights, evidence, host authority and outcome coverage",
            "no_method_composed": True
        },
        "exact_source_package_bytes_verified":
            bool(inspected and inspected["source_package_bytes_verified"]),
        "external_source_inspection_is_not_rights_approval": True,
        "inference_calls_observed_in_this_python_entrypoint": 0,
        "end_to_end_inference_tokens_measured": False,
        "method_rights_established": False,
        "host_validated": False,
        "prism_invoked": False,
        "composer_invoked": False,
        "output_package_created": False,
        "production_eligible": False
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--request", required=True)
    p.add_argument("--route")
    p.add_argument("--host", required=True)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    p.add_argument("--method")
    p.add_argument("--external-checkout")
    p.add_argument("--external-repository-tree")
    args = p.parse_args(argv)
    try:
        externals = (args.external_checkout, args.external_repository_tree)
        require(all(x is None for x in externals) or all(x is not None for x in externals),
                "EXTERNAL_SELECTION", "external checkout and tree must be supplied together")
        require(not any(x is not None for x in externals) or args.method is not None,
                "EXTERNAL_SELECTION", "external package must be tied to an explicitly selected review")
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        evidence = (
            {"record_id": args.method, "checkout": args.external_checkout,
             "repo_tree": args.external_repository_tree}
            if args.external_checkout is not None else None)
        outcome = evaluate_request(graph, args.request, args.host, args.route,
                                   args.method, external_selection=evidence,
                                   scope_evaluator=_verified_scope_gap)
        print(json.dumps(outcome, indent=2, ensure_ascii=False, sort_keys=True))
        # Expected refusal is a nonzero exit, so unattended builds cannot
        # mistake a fully blocked task for a generated skill.
        return 2
    except Refusal as exc:
        print(json.dumps({
            "schema": SCHEMA, "state": "REFUSED_PRE_ADMISSION",
            "refusal": {"schema": REFUSAL_SCHEMA, "code": exc.code,
                        "message": str(exc), "no_method_composed": True},
            "prism_invoked": False, "composer_invoked": False,
            "output_package_created": False, "production_eligible": False
        }, sort_keys=True), file=sys.stdout)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
