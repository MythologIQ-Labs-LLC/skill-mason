#!/usr/bin/env python3
"""Source-grounded, task-specific qualitative reference review; NEVER admission.

A human reviewer names a narrow task, evidence passages and executable future
acceptance scenarios. Original source bytes and citation locations are checked
against C3's complete pinned package. The reviewer's *interpretation* remains
explicitly unverified; source availability is not rights, host, or Prism proof.
"""
import argparse
import json
from pathlib import Path
import sys

from scripts.catalog_handoff import COMMIT, TREE, Refusal, canonical, git_blob, parse_json, read_exact, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.package_resolver import inspect_package

SCHEMA = "qortara/source-task-fit-reference-review/1"
INPUT = "qortara/source-task-fit-review/1"
AUTHORITY = "reviewer-observation-task-fit-not-semantic-or-legal-qualification"
ROLES = {"TRIGGER_AND_LIMIT", "METHOD_STEPS", "EVIDENCE_AND_REPORT", "SAFETY_BOUNDARY"}
DISPOSITIONS = {"TEST_MEASURED_TASK", "WITHHOLD_UNSUPPORTED_CLAIM"}
ORIGINAL_URL = "https://github.com/Knapp-Kevin/skillz/blob/" + COMMIT + "/"


def _text(x, label, limit=800):
    require(isinstance(x, str) and 16 <= len(x.strip()) <= limit and
            x == x.strip() and not any(ord(c) < 32 for c in x),
            "TASK_REVIEW_SCHEMA", label + " must be nonempty bounded one-line text")
    return x


def _strings(x, label, low=1, high=16):
    require(isinstance(x, list) and low <= len(x) <= high,
            "TASK_REVIEW_SCHEMA", label + " needs a bounded list")
    for s in x:
        _text(s, label)
    require(len(set(x)) == len(x), "TASK_REVIEW_SCHEMA", label + " has duplicate entries")
    return x


def assess_task_fit(graph, review, *, inspector=inspect_package):
    require(isinstance(review, dict) and set(review) == {
        "schema_version", "authority", "source_commit", "source_tree", "route",
        "governed_review_id", "source_entrypoint", "source_git_blob_sha1",
        "narrow_task_spec", "source_evidence", "broader_claims_not_supported",
        "rights_qualified", "host_validated", "outcome_coverage_qualified",
        "composition_eligible",
    }, "TASK_REVIEW_SCHEMA", "unsupported task-fit input fields")
    require(review["schema_version"] == INPUT and
            review["authority"] == AUTHORITY and
            all(review[k] is False for k in ("rights_qualified", "host_validated",
                                              "outcome_coverage_qualified",
                                              "composition_eligible")),
            "TASK_REVIEW_AUTHORITY", "reviewer cannot assert source or method approval")
    corpus = graph.corpus
    source = corpus.manifest.get("source")
    require(isinstance(source, dict) and source.get("commit") == COMMIT and
            source.get("git_tree_sha1") == TREE and
            review["source_commit"] == COMMIT and review["source_tree"] == TREE,
            "TASK_SOURCE_PIN", "snapshot or reviewer pin is not the exact original tree")
    route, rid = review["route"], review["governed_review_id"]
    require(isinstance(rid, str) and 0 < len(rid) <= 200,
            "TASK_CROSSWALK", "exact governed source identity required")
    item = corpus.by_id.get("governed:" + rid)
    # A source may be evaluated for its *actual narrow method* without
    # pretending one of its broad taxonomy routes proves the task.
    # Null route is never a request to select or compose a route.
    source_only = route is None
    if not source_only:
        require(isinstance(route, str) and route in graph.paths and
                rid in graph.paths[route]["matched"],
                "TASK_CROSSWALK", "method not evidence-linked to exactly requested route")
    else:
        require(isinstance(item, dict),
                "TASK_CROSSWALK", "source-only review requires an exact governed identity")
        recorded = item.get("raw", {}).get("capability_mapping", {}).get(
            "evidence_linked_paths")
        require(isinstance(recorded, list) and len(recorded) == len(set(recorded)) and
                all(isinstance(p, str) and p in graph.paths and
                    rid in graph.paths[p]["matched"] for p in recorded),
                "TASK_CROSSWALK", "source-only review must preserve the full pinned crosswalk")
    require(isinstance(item, dict) and item.get("family") == "governed" and
            item.get("source_class") == "first-party" and
            item.get("raw", {}).get("record_id") == rid and
            item.get("review_status") in ("verified", "verified-with-portability-caveats"),
            "TASK_REVIEW_STATUS", "source lacks a usable original first-party static review")
    pkg = inspector(corpus, "governed:" + rid)
    require(isinstance(pkg, dict) and
            pkg.get("state") == "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED" and
            pkg.get("record_id") == rid and
            pkg.get("original_snapshot_commit") == COMMIT and
            pkg.get("rights_assessed") is False and
            pkg.get("composition_eligible") is False and
            pkg.get("method_contract_qualified") is False,
            "TASK_PACKAGE", "complete original package must verify without rights promotion")
    root, files = pkg.get("source_root"), pkg.get("files")
    require(isinstance(root, str) and root + "SKILL.md" in corpus.first_party_paths and
            isinstance(files, list) and len(files) == pkg.get("package_file_count") and
            len(files) <= 2000 and
            isinstance(pkg.get("package_file_list_sha256"), str),
            "TASK_PACKAGE", "original package identity or inventory is missing")
    by_file = {f.get("path"): f for f in files if isinstance(f, dict)}
    require(len(by_file) == len(files) and
            "SKILL.md" in by_file and
            review["source_entrypoint"] == root + "SKILL.md" and
            review["source_git_blob_sha1"] == by_file["SKILL.md"].get("git_blob_sha1"),
            "TASK_ENTRYPOINT", "reviewer entrypoint does not match exact package")
    task = review["narrow_task_spec"]
    require(isinstance(task, dict) and set(task) == {
        "objective", "inputs", "outputs", "explicit_exclusions", "acceptance_scenarios",
    }, "TASK_REVIEW_SCHEMA", "task specification is missing bounded evidence/test fields")
    _text(task["objective"], "objective", 1000)
    for field in ("inputs", "outputs", "explicit_exclusions"):
        _strings(task[field], field, 2, 12)
    scenarios = task["acceptance_scenarios"]
    require(isinstance(scenarios, list) and 4 <= len(scenarios) <= 12,
            "TASK_SCENARIOS", "need measured and refusal task acceptance cases")
    dispositions = []
    for sc in scenarios:
        require(isinstance(sc, dict) and set(sc) == {
            "id", "given", "when", "then", "expected_disposition", "evidence_required",
        }, "TASK_SCENARIOS", "scenario must define executable task/outcome evidence")
        _text(sc["id"], "scenario_id", 90)
        for field in ("given", "when", "then"):
            _text(sc[field], field)
        _strings(sc["evidence_required"], "evidence_required", 1, 8)
        require(sc["expected_disposition"] in DISPOSITIONS,
                "TASK_SCENARIOS", "unsupported acceptance disposition")
        dispositions.append(sc["expected_disposition"])
    require(len({x["id"] for x in scenarios}) == len(scenarios) and
            set(dispositions) == DISPOSITIONS,
            "TASK_SCENARIOS", "need distinct scenarios for measured tasks and refusal boundaries")
    _strings(review["broader_claims_not_supported"], "broader_claims_not_supported", 2, 12)
    entries = review["source_evidence"]
    require(isinstance(entries, list) and 4 <= len(entries) <= 12,
            "TASK_EVIDENCE", "four source-bound method scope/effect citations required")
    roles = set()
    checked = []
    seen = set()
    for citation in entries:
        require(isinstance(citation, dict) and set(citation) == {
            "relative_path", "first_line", "last_line", "citation_role", "reviewer_finding",
        }, "TASK_EVIDENCE", "invalid original source citation declaration")
        path = citation["relative_path"]
        first, last = citation["first_line"], citation["last_line"]
        role = citation["citation_role"]
        require(isinstance(path, str) and path in by_file and
                type(first) is int and type(last) is int and
                1 <= first <= last and last - first + 1 <= 10 and
                role in ROLES,
                "TASK_EVIDENCE", "source lines must be inside a pinned original package")
        _text(citation["reviewer_finding"], "reviewer_finding")
        key = (path, first, last)
        require(key not in seen, "TASK_EVIDENCE", "duplicate source passage")
        seen.add(key)
        roles.add(role)
        meta = by_file[path]
        require(type(meta.get("bytes")) is int and 0 < meta["bytes"] <= 1_000_000 and
                isinstance(meta.get("sha256"), str) and
                isinstance(meta.get("git_blob_sha1"), str),
                "TASK_PACKAGE", "source file identity/size unavailable")
        raw = corpus._raw_source(root + path)
        require(sha256(raw) == meta["sha256"] and
                git_blob(raw) == meta["git_blob_sha1"],
                "TASK_SOURCE_BYTES", "source bytes differ from complete original package")
        try:
            lines = raw.decode("utf-8", "strict").splitlines(keepends=True)
        except UnicodeError:
            raise Refusal("TASK_SOURCE_UTF8", "citation is not valid UTF-8")
        require(last <= len(lines), "TASK_EVIDENCE", "citation extends past original source")
        excerpt = "".join(lines[first - 1:last])
        require(0 < len(excerpt.encode("utf-8")) <= 2500 and
                "\x00" not in excerpt,
                "TASK_EVIDENCE", "source excerpt is oversized or contains invalid control bytes")
        checked.append({
            "role": role, "original_path": root + path,
            "first_line": first, "last_line": last,
            "source_url": ORIGINAL_URL + root + path + "#L" +
                str(first) + "-L" + str(last),
            "source_file_git_blob_sha1": meta["git_blob_sha1"],
            "source_file_sha256": meta["sha256"],
            "exact_excerpt_sha256": sha256(excerpt.encode("utf-8")),
            "original_lines_for_review": excerpt,
            "reviewer_finding_not_independently_tested": citation["reviewer_finding"],
        })
    require(roles == ROLES, "TASK_EVIDENCE",
            "all scope, method, output and safety boundary roles need exact source evidence")
    if source_only:
        original_outcome = None
        source_routes = sorted(item["raw"]["capability_mapping"]["evidence_linked_paths"])
    else:
        original_outcome = graph.outcome_by_path[route]
        require(isinstance(original_outcome, dict) and
                original_outcome.get("path") == route and
                isinstance(original_outcome.get("essential_outcomes"), list),
                "TASK_OUTCOME", "source capability outcome row is invalid")
        source_routes = [route]
    return {
        "schema": SCHEMA,
        "state": "BOUNDED_ORIGINAL_SOURCE_TASK_REFERENCE_NOT_ADMITTED",
        "source_snapshot_commit": COMMIT,
        "source_snapshot_tree": TREE,
        "governed_review_id": "governed:" + rid,
        "route": route,
        "source_only_review_no_route_claim": source_only,
        "original_evidence_linked_routes_not_task_qualified": source_routes,
        "original_static_review_status": item["review_status"],
        "source_entrypoint": review["source_entrypoint"],
        "entrypoint_git_blob_sha1": review["source_git_blob_sha1"],
        "original_complete_package_file_list_sha256": pkg["package_file_list_sha256"],
        "review_input_sha256": sha256(canonical(review)),
        "source_evidence": checked,
        "reviewer_proposed_task_spec_not_an_admitted_method": task,
        "registered_route_outcomes_not_qualified": (
            None if source_only else original_outcome["essential_outcomes"]),
        "broader_claims_not_supported": review["broader_claims_not_supported"],
        "source_quotes_prove_bytes_not_reviewers_semantic_conclusion": True,
        "acceptance_scenarios_planned_not_executed": len(scenarios),
        "actual_consumer_host_task_runs": 0,
        "rights_qualified": False, "host_validated": False,
        "outcome_coverage_qualified": False, "operator_source_acceptance_signed": False,
        "prism_invoked": False, "composition_eligible": False,
        "production_eligible": False,
        "next_action": "Adversarially evaluate actual task-fit scenarios, independently verify scope, source rights and host authority, then use separately trusted operator acceptance before Prism composition.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    parser.add_argument("--review", required=True)
    args = parser.parse_args(argv)
    try:
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        review = parse_json(read_exact(Path(args.review), 64_000))
        report = assess_task_fit(graph, review)
        print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))
        return 0
    except Refusal as exc:
        print(json.dumps({"schema": SCHEMA, "state": "REFUSED", "code": exc.code,
                          "detail": str(exc), "composition_eligible": False},
                         sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
