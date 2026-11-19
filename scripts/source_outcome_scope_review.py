#!/usr/bin/env python3
"""Read-only, exact-source human scope-gap review for one C2/C4 method.

A negative scope observation is evidence about a missing requirement, never a
positive method-selection, legal-rights, host-authority or Prism admission.
"""
import argparse
import json
from pathlib import Path
import sys

from scripts.catalog_handoff import (
    COMMIT, TREE, Refusal, canonical, git_blob, parse_json, read_exact,
    require, sha256,
)
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.capability_gap_backlog import load_proposals
from scripts.package_resolver import inspect_package

SCHEMA = "qortara/source-outcome-scope-gap/1"
INPUT_SCHEMA = "qortara/source-outcome-scope-review/1"
DISPOSITION = "PROPOSED_WORKFLOW_NOT_ESTABLISHED_BY_EXAMINED_METHOD"
REVIEW_AUTHORITY = "reviewer-observation-negative-only-no-source-rights"


def assess_scope(graph, proposals, review, *, inspector=inspect_package):
    """Validate pinned original bytes, full package and quoted scope evidence.

    The subjective assessment is recorded, not discovered by keyword matching.
    A source passage only authenticates what was inspected, not the truth of the
    reviewer's conclusion or their legal authority to reuse this material.
    """
    require(isinstance(review, dict) and set(review) == {
        "schema_version", "authority", "source_commit", "source_tree",
        "route", "governed_review_id", "source_entrypoint", "source_git_blob_sha1",
        "proposal_objective", "disposition", "evidence", "unestablished_outcomes",
        "narrower_candidate_draft", "rights_qualified", "host_validated",
        "composition_eligible",
    }, "SCOPE_SCHEMA", "scope review has missing or unexpected fields")
    require(review["schema_version"] == INPUT_SCHEMA and
            review["authority"] == REVIEW_AUTHORITY and
            review["disposition"] == DISPOSITION and
            review["rights_qualified"] is False and
            review["host_validated"] is False and
            review["composition_eligible"] is False,
            "SCOPE_AUTHORITY", "scope observation tried to become eligibility")
    corpus = graph.corpus
    source = corpus.manifest.get("source")
    require(review["source_commit"] == COMMIT and
            review["source_tree"] == TREE and
            isinstance(source, dict) and source.get("commit") == COMMIT and
            source.get("git_tree_sha1") == TREE,
            "SCOPE_SOURCE_PIN", "review and original snapshot revisions differ")
    route = review["route"]
    rid = review["governed_review_id"]
    require(isinstance(route, str) and route in graph.paths and
            isinstance(rid, str) and 0 < len(rid) <= 200 and
            rid in graph.paths[route]["matched"],
            "SCOPE_CROSSWALK", "reviewed method is not evidence-linked to exact route")
    item = corpus.by_id.get("governed:" + rid)
    require(isinstance(item, dict) and item.get("family") == "governed" and
            item.get("source_class") == "first-party" and
            item.get("raw", {}).get("record_id") == rid,
            "SCOPE_REVIEW_ID", "source review is missing or not a verified package candidate")
    proposal = proposals.get(route) if isinstance(proposals, dict) else None
    require(isinstance(proposal, dict) and
            review["proposal_objective"] == proposal.get("objective") and
            proposal.get("proposal_status") == "DRAFT_NOT_GOVERNED",
            "SCOPE_PROPOSAL_DRIFT", "review is not bound to the exact nonauthoritative workflow proposal")
    package = inspector(corpus, "governed:" + rid)
    require(isinstance(package, dict) and
            package.get("state") == "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED" and
            package.get("record_id") == rid and
            package.get("original_snapshot_commit") == COMMIT and
            package.get("independently_verified_publisher") is False and
            package.get("rights_assessed") is False and
            package.get("composition_eligible") is False and
            package.get("method_contract_qualified") is False,
            "SCOPE_PACKAGE", "full original package is not verified without rights promotion")
    source_path = review["source_entrypoint"]
    require(isinstance(source_path, str) and
            source_path == package.get("source_root", "") + "SKILL.md" and
            source_path in corpus.first_party_paths,
            "SCOPE_ENTRYPOINT", "reviewed entrypoint does not match exact package identity")
    files = package.get("files")
    require(isinstance(files, list), "SCOPE_PACKAGE", "package file inventory missing")
    entry = [x for x in files if isinstance(x, dict) and x.get("path") == "SKILL.md"]
    require(len(entry) == 1 and
            review["source_git_blob_sha1"] == entry[0].get("git_blob_sha1"),
            "SCOPE_ENTRYPOINT", "entrypoint Git object differs from reviewed source")
    original = corpus._raw_source(source_path)
    require(sha256(original) == entry[0].get("sha256") and
            git_blob(original) == entry[0].get("git_blob_sha1"),
            "SCOPE_SOURCE_BYTES", "original source bytes differ from qualified package inventory")
    try:
        text = original.decode("utf-8")
    except UnicodeError:
        raise Refusal("SCOPE_SOURCE_BYTES", "source entrypoint is not UTF-8")
    evidence = review["evidence"]
    require(isinstance(evidence, list) and 2 <= len(evidence) <= 12,
            "SCOPE_EVIDENCE", "require at least two precise original source observations")
    checked = []
    for line in evidence:
        require(isinstance(line, dict) and
                set(line) == {"exact_source_excerpt", "scope_finding"} and
                isinstance(line["exact_source_excerpt"], str) and
                12 <= len(line["exact_source_excerpt"]) <= 240 and
                isinstance(line["scope_finding"], str) and
                16 <= len(line["scope_finding"]) <= 500,
                "SCOPE_EVIDENCE", "malformed source observation")
        excerpt = line["exact_source_excerpt"]
        require(text.count(excerpt) == 1,
                "SCOPE_EXCERPT", "source excerpt absent or ambiguous in exact pinned bytes")
        checked.append({"exact_source_excerpt": excerpt,
                        "source_char_offset": text.index(excerpt),
                        "scope_finding": line["scope_finding"]})
    require(len({x["exact_source_excerpt"] for x in checked}) == len(checked),
            "SCOPE_EVIDENCE", "duplicate source passage in review")
    gaps = review["unestablished_outcomes"]
    require(isinstance(gaps, list) and 1 <= len(gaps) <= 12 and
            all(isinstance(x, str) and 12 <= len(x) <= 300 for x in gaps) and
            len(set(gaps)) == len(gaps),
            "SCOPE_GAP", "missing or duplicated unestablished outcome")
    narrower = review["narrower_candidate_draft"]
    require(isinstance(narrower, str) and 20 <= len(narrower) <= 500,
            "SCOPE_GAP", "narrowed candidate proposal missing")
    return {
        "schema": SCHEMA,
        "state": "NONADMITTING_SOURCE_SCOPE_GAP_RECORDED",
        "source_snapshot_commit": COMMIT,
        "source_snapshot_tree": TREE,
        "governed_review_id": rid,
        "route": route,
        "source_entrypoint": source_path,
        "entrypoint_git_blob_sha1": entry[0]["git_blob_sha1"],
        "entrypoint_sha256": sha256(original),
        "original_complete_package_file_list_sha256": package["package_file_list_sha256"],
        "proposal_sha256": sha256(canonical(proposal)),
        "review_sha256": sha256(canonical(review)),
        "reviewer_observation_disposition_not_independent_qualification": DISPOSITION,
        "source_scope_observations": checked,
        "unestablished_requested_outcomes": gaps,
        "narrower_workflow_candidate_not_governed": narrower,
        "original_review_status_unchanged": item["review_status"],
        "rights_and_authorship_not_proven_by_repo_possession": True,
        "rights_qualified": False,
        "host_validated": False,
        "outcome_coverage_qualified": False,
        "prism_invoked": False,
        "composer_invoked": False,
        "composition_eligible": False,
        "next_action": "Govern a source-supported narrow outcome, independently check authorship and reuse rights, then accession a reviewed next snapshot.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    parser.add_argument("--proposals", required=True)
    parser.add_argument("--review", required=True)
    args = parser.parse_args(argv)
    try:
        corpus = CorpusIndex(args.handoff, args.source_checkout)
        graph = CapabilityGraph(corpus)
        proposals = load_proposals(graph, args.proposals)
        review = parse_json(read_exact(Path(args.review), 128_000))
        output = assess_scope(graph, proposals, review)
        print(canonical(output).decode(), end="")
        return 0
    except Refusal as exc:
        print(json.dumps({"schema": SCHEMA, "state": "REFUSED",
                          "code": exc.code, "detail": str(exc),
                          "composition_eligible": False}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
