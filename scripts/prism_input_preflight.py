#!/usr/bin/env python3
"""Bind one reviewed source to a P0 Prism refusal preview, never self-assert facts.

The source catalog is untrusted as rights, host authority, semantic evidence and
essential-outcome certification. Full-byte source inspection is *not* any of
the four signed facts required by the real Prism composer. This creates a
deterministic negative development test vector and an auditable candidate
selection binding; it does not produce a signed assurance envelope, invoke a
Prism guest, or authorize composition.
"""
import argparse
import json
import re
import sys

from scripts.catalog_handoff import Refusal, canonical, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.candidate_comparison import compare

SCHEMA = "qortara/method-to-prism-preflight/1"
GUEST = "Qortara Skills Eligibility"
FACTS = ("evidence", "rights", "authority", "coverage")
REFUSALS = ("EVIDENCE_UNQUALIFIED", "RIGHTS_UNRESOLVED",
            "AUTHORITY_EXCEEDED", "OUTCOME_UNCOVERED")
SHA1 = re.compile(r"^[0-9a-f]{40}$")


def prepare_preflight(graph, route, host, governed_id, *,
                      external_selection=None, package_inspector=None,
                      external_inspector=None):
    require(isinstance(governed_id, str) and governed_id.startswith("governed:") and
            len(governed_id) > len("governed:"),
            "METHOD_SELECTION", "explicit governed method ID required")
    if external_selection is not None:
        require(isinstance(external_selection, dict) and
                external_selection.get("record_id") == governed_id,
                "METHOD_SELECTION",
                "inspected external package must be the selected governed method")
    opts = {"include_lexical": False, "external_selection": external_selection}
    if package_inspector is not None:
        opts["package_inspector"] = package_inspector
    if external_inspector is not None:
        opts["external_inspector"] = external_inspector
    comparison = compare(graph, route, host, **opts)
    selected_id = governed_id[len("governed:"):]
    found = [x for x in comparison["evidence_linked_reviews"]
             if x["governed_id"] == selected_id]
    require(len(found) == 1, "METHOD_SELECTION",
            "method must be an exact evidence-linked governed record on this route")
    selected = found[0]
    indexed = graph.corpus.by_id.get(governed_id)
    require(indexed is not None and indexed["family"] == "governed" and
            indexed["raw"]["record_id"] == selected_id,
            "METHOD_SELECTION", "cannot bind an observation or unreviewed name lead")
    record = indexed["raw"]
    source = graph.corpus.manifest["source"]
    require(isinstance(source, dict) and
            isinstance(source.get("commit"), str) and SHA1.fullmatch(source["commit"]) and
            isinstance(source.get("git_tree_sha1"), str) and
            SHA1.fullmatch(source["git_tree_sha1"]),
            "METHOD_SOURCE", "source snapshot must remain exact pinned Git identity")
    package = selected["package_bytes"]
    package_verified = package.get("status") in (
        "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED",
        "EXTERNAL_PACKAGE_PINNED_BYTES_VERIFIED")
    # A recorded static 'verified' review and matching bytes do not establish
    # the semantics of any of the four assurance facts. In particular neither
    # 'rights' nor 'authority' may be taken from a user-controlled payload.
    blockers = [
        {"fact": FACTS[i], "code": REFUSALS[i],
         "reason": (
             "No independent semantic method evidence signed for this exact source"
             if i == 0 else
             "No independently accepted source/asset rights assertion"
             if i == 1 else
             "No operator-verified permission or target-host contract"
             if i == 2 else
             "No qualified essential-outcome and host behavior evidence")}
        for i in range(4)
    ]
    if selected["disposition"] == "BLOCKED_STATIC_REVIEW":
        blockers.insert(0, {"fact": None, "code": "STATIC_REVIEW_REJECTED",
                            "reason": "governed static review rejected this source"})
    elif selected["disposition"] == "BLOCKED_RETIRED":
        blockers.insert(0, {"fact": None, "code": "SOURCE_RETIRED",
                            "reason": "governed static review has retired this source"})
    elif selected["disposition"] == "BLOCKED_REVIEW_UNKNOWN":
        blockers.insert(0, {"fact": None, "code": "STATIC_REVIEW_UNKNOWN",
                            "reason": "governed review has no verified static status"})
    if not package_verified:
        blockers.insert(0, {
            "fact": None, "code": "SOURCE_PACKAGE_BYTES_UNVERIFIED",
            "reason": "complete selected package source bytes have not been established"})
    binding = {
        "snapshot_commit": source["commit"],
        "snapshot_tree": source["git_tree_sha1"],
        "governed_id": selected_id,
        "governed_record_sha256": sha256(canonical(record)),
        "requested_route": comparison["route"],
        "requested_host_label_not_authority": comparison["target_host_requested_not_approved"],
        "package_inspection_sha256": sha256(canonical(package)),
        "package_bytes_verified": package_verified,
        "review_status": selected["review_status"],
        "review_disposition": selected["disposition"],
    }
    return {
        "schema": SCHEMA, "state": "UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION",
        "typed_generation_refusal": {
            "schema": "qortara/skill-generation-refusal/1",
            "state": "REFUSED_PRE_ADMISSION",
            "stage": "source-method-qualification",
            "source_record_id": selected_id,
            "capability_route": comparison["route"],
            "codes": [blocker["code"] for blocker in blockers],
            "original_source_bytes_proven": package_verified,
            "no_method_composed": True,
            "not_a_prism_guest_verdict": True,
            "not_a_host_success_or_failure": True,
        },
        "binding": binding, "binding_sha256": sha256(canonical(binding)),
        "source_package_bytes_verified": package_verified,
        "source_byte_verification_not_semantic_review": True,
        "evidence_link_confirmed_not_coverage_qualified": True,
        "exact_essential_outcomes_qualified": False,
        "independently_authenticated_method_assertion": False,
        "operator_accepted_rights": False,
        "host_authority_verified": False,
        "facts_in_guest_wire_order": list(FACTS),
        "facts_verified": {fact: False for fact in FACTS},
        "negative_test_vector_hex": "00000000",
        "negative_test_vector_only_not_signed_assertion": True,
        "expected_guest_refusals": list(REFUSALS),
        "additional_blockers": blockers,
        "guest_application_intent": GUEST,
        "holo_sha256": None,
        "prism_invoked": False,
        "prism_guest_decision": None,
        "selected_method_for_composition": None,
        "signed_claims_required_before_positive_guest_request": True,
        "production_eligible": False,
        "composition_eligible": False,
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--handoff", required=True)
    p.add_argument("--source-checkout", required=True)
    p.add_argument("--route", required=True)
    p.add_argument("--host", required=True)
    p.add_argument("--governed-record", required=True)
    p.add_argument("--external-record")
    p.add_argument("--external-checkout")
    p.add_argument("--external-repository-tree")
    a = p.parse_args(argv)
    try:
        supplied = (a.external_record, a.external_checkout,
                    a.external_repository_tree)
        require(all(x is not None for x in supplied) or
                all(x is None for x in supplied),
                "EXTERNAL_SELECTION", "external source flags must be provided together")
        external = ({"record_id": a.external_record, "checkout": a.external_checkout,
                     "repo_tree": a.external_repository_tree}
                    if a.external_record is not None else None)
        if external is not None:
            require(external["record_id"] == a.governed_record,
                    "METHOD_SELECTION",
                    "inspected external record must equal selected governed record")
        graph = CapabilityGraph(CorpusIndex(a.handoff, a.source_checkout))
        report = prepare_preflight(
            graph, a.route, a.host, a.governed_record,
            external_selection=external)
        print(json.dumps(report, sort_keys=True, ensure_ascii=False, indent=2))
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
