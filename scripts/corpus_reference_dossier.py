#!/usr/bin/env python3
"""C3/C4 original-source reference dossier for evidence-based corpus review.

The corpus is a source of *candidate reference material*. This inspector makes
its original first-party package bytes and precise citations accessible without
turning static review, a route crosswalk, or a quoted passage into legal
permission, semantic coverage or host execution.
"""
import argparse
import json
import re
import sys

from scripts.catalog_handoff import COMMIT, TREE, Refusal, git_blob, require, sha256
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.package_resolver import inspect_package

SCHEMA = "qortara/original-source-reference-dossier/1"
SOURCE_URL = "https://github.com/Knapp-Kevin/skillz/blob/" + COMMIT + "/"
MAX_CITATION_LINES = 12
MAX_CITATION_BYTES = 1600
MAX_FILE_BYTES = 1_000_000
LINE_RANGE = re.compile(r"^([1-9][0-9]{0,5}):([1-9][0-9]{0,5})$")


def reference_dossier(graph, route, *, governed_method=None, citation=None,
                      inspector=inspect_package):
    """Inspect the exact linked review set, retaining non-qualifying records.

    citation: (relative_package_file, first_line, last_line), inclusive.
    Only the explicitly selected, fully source-verified first-party method may
    return original text. Default result is link/digest evidence, not copied
    skill instructions.
    """
    require(isinstance(route, str) and route in graph.paths,
            "UNKNOWN_ROUTE", "select an exact recognized capability route")
    require(isinstance(graph.corpus.manifest.get("source"), dict) and
            graph.corpus.manifest["source"].get("commit") == COMMIT and
            graph.corpus.manifest["source"].get("git_tree_sha1") == TREE,
            "SOURCE_PIN", "reference source snapshot is not the exact pinned tree")
    node = graph.paths[route]
    selected = governed_method.removeprefix("governed:") if (
        isinstance(governed_method, str) and governed_method.startswith("governed:")
    ) else None
    if governed_method is not None:
        require(selected is not None and selected in node["matched"],
                "METHOD_SELECTION", "method must be an exact evidence-linked governed review")
    if citation is not None:
        require(selected is not None and isinstance(citation, (tuple, list))
                and len(citation) == 3, "CITATION_SELECTION",
                "cite a bounded file range of one explicitly selected method")

    source = graph.corpus
    candidates = []
    quoted = None
    for rid in sorted(node["matched"]):
        item = source.by_id.get("governed:" + rid)
        require(isinstance(item, dict) and item.get("family") == "governed"
                and item.get("raw", {}).get("record_id") == rid
                and route in item["raw"]["capability_mapping"]["evidence_linked_paths"],
                "CROSSWALK_DRIFT", "linked source identity or route differs from snapshot")
        status = item["raw"]["review"]["semantic_status"]
        row = {
            "governed_review_id": "governed:" + rid,
            "recorded_static_review": status,
            "source_class": item["source_class"],
            "evidence_linked_route_not_proven_method_fit": route,
            "original_package": None,
            "inspection_state": "THIRD_PARTY_ORIGINAL_PACKAGE_NOT_INSPECTED",
            "rights_qualified": False,
            "host_validated": False,
            "method_scope_qualified": False,
            "composition_eligible": False,
        }
        if item["source_class"] == "first-party":
            try:
                pkg = inspector(source, "governed:" + rid)
                require(isinstance(pkg, dict) and
                        pkg.get("state") == "PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED" and
                        pkg.get("record_id") == rid and
                        pkg.get("original_snapshot_commit") == COMMIT and
                        pkg.get("rights_assessed") is False and
                        pkg.get("composition_eligible") is False and
                        pkg.get("method_contract_qualified") is False,
                        "PACKAGE_INTEGRITY", "inspector attempted unverified package admission")
                root = pkg.get("source_root")
                files = pkg.get("files")
                require(isinstance(root, str) and
                        root + "SKILL.md" in source.first_party_paths and
                        isinstance(files, list) and
                        len(files) == pkg.get("package_file_count") and
                        all(isinstance(f, dict) and isinstance(f.get("path"), str) and
                            isinstance(f.get("sha256"), str) and
                            isinstance(f.get("git_blob_sha1"), str) for f in files),
                        "PACKAGE_INTEGRITY", "verified original package inventory is missing")
                entry = [f for f in files if f["path"] == "SKILL.md"]
                require(len(entry) == 1 and
                        source.source_files[root + "SKILL.md"]["sha256"] == entry[0]["sha256"],
                        "PACKAGE_INTEGRITY", "original entrypoint does not match package declaration")
                row["inspection_state"] = pkg["state"]
                row["original_package"] = {
                    "source_root_at_pinned_commit": root,
                    "entrypoint_url": SOURCE_URL + root + "SKILL.md",
                    "entrypoint_git_blob_sha1": entry[0]["git_blob_sha1"],
                    "entrypoint_sha256": entry[0]["sha256"],
                    "package_tree_git_sha1": pkg["package_git_tree_sha1"],
                    "package_file_list_sha256": pkg["package_file_list_sha256"],
                    "package_file_count": len(files),
                    "file_paths_and_sha256": [
                        {"path": f["path"], "sha256": f["sha256"]} for f in files
                    ],
                    "inline_reference_leads_not_dependency_closure": pkg["reference_leads"],
                    "complete_source_bytes_verified": True,
                    "full_dependency_closure_proven": False,
                    "redistribution_rights_proven": False,
                    "original_source_not_a_instruction_to_execute": True,
                }
                if citation is not None and rid == selected:
                    rel, first, last = citation
                    require(isinstance(rel, str) and rel in
                            {f["path"] for f in files} and
                            type(first) is int and type(last) is int and
                            first >= 1 and last >= first and
                            last - first + 1 <= MAX_CITATION_LINES,
                            "CITATION_RANGE", "cite only 1-12 lines inside a verified package file")
                    f = next(f for f in files if f["path"] == rel)
                    require(next((x["bytes"] for x in pkg["files"] if x["path"] == rel), 0)
                            <= MAX_FILE_BYTES, "CITATION_SIZE",
                            "reference source file exceeds citation review limit")
                    raw = source._raw_source(root + rel)
                    require(sha256(raw) == f["sha256"] and
                            git_blob(raw) == f["git_blob_sha1"],
                            "CITATION_SOURCE_DRIFT", "citation source bytes differ from original package")
                    try:
                        lines = raw.decode("utf-8", errors="strict").splitlines(keepends=True)
                    except UnicodeError:
                        raise Refusal("CITATION_UTF8", "only UTF-8 source citations are supported")
                    require(last <= len(lines), "CITATION_RANGE", "citation outside original file")
                    excerpt = "".join(lines[first - 1:last])
                    require(len(excerpt.encode("utf-8")) <= MAX_CITATION_BYTES and
                            "\x00" not in excerpt and
                            all(ch == "\n" or ch == "\t" or ord(ch) >= 32
                                for ch in excerpt),
                            "CITATION_SIZE", "source excerpt is too long or contains control bytes")
                    quoted = {
                        "governed_review_id": "governed:" + rid,
                        "path": root + rel,
                        "source_url": SOURCE_URL + root + rel + "#L" +
                            str(first) + "-L" + str(last),
                        "first_line": first, "last_line": last,
                        "source_file_sha256": f["sha256"],
                        "source_file_git_blob_sha1": f["git_blob_sha1"],
                        "exact_source_excerpt_sha256": sha256(excerpt.encode("utf-8")),
                        "exact_original_lines_for_human_review": excerpt,
                        "quotation_is_not_semantic_truth_or_reuse_rights": True,
                    }
            except Refusal as exc:
                if rid == selected:
                    raise
                row["inspection_state"] = "FIRST_PARTY_INSPECTION_REFUSED"
                row["source_refusal_code"] = exc.code
        candidates.append(row)
    if citation is not None:
        require(quoted is not None, "CITATION_SELECTION",
                "selected method has no verified first-party original source to cite")

    outcomes = graph.outcome_by_path[route]
    require(isinstance(outcomes.get("essential_outcomes"), list) and
            outcomes.get("path") == route, "OUTCOME_DRIFT",
            "registered route outcomes are missing or swapped")
    return {
        "schema": SCHEMA,
        "state": "SOURCE_REFERENCE_MATERIAL_FOR_HUMAN_QUALIFICATION",
        "exact_source_commit": COMMIT,
        "exact_source_tree": TREE,
        "route": route,
        "registered_essential_outcomes_not_behaviour_proof": outcomes["essential_outcomes"],
        "outcome_definition_status": outcomes.get("outcome_definition_status"),
        "linked_governed_review_count": len(node["matched"]),
        "name_only_review_leads_not_source_evidence": sorted(node["hints"]),
        "candidates": candidates,
        "selected_method_for_source_inspection_only": governed_method,
        "original_source_citation": quoted,
        "next_qualification": [
            "Review source passages against a specific bounded requested user outcome",
            "Evaluate complete package dependencies, assets, attribution and source rights",
            "Record independent host authority and actual task behavior",
            "Require operator-approved signed evidence before Prism method admission",
        ],
        "rights_qualified": False,
        "host_validated": False,
        "outcome_coverage_qualified": False,
        "method_selected_for_composition": None,
        "prism_invoked": False,
        "composition_eligible": False,
        "production_eligible": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--source-checkout", required=True)
    parser.add_argument("--route", required=True)
    parser.add_argument("--method")
    parser.add_argument("--file")
    parser.add_argument("--lines")
    args = parser.parse_args(argv)
    try:
        require((args.file is None) == (args.lines is None),
                "CITATION_SELECTION", "--file and --lines must be provided together")
        cite = None
        if args.lines is not None:
            matched = LINE_RANGE.fullmatch(args.lines)
            require(matched is not None, "CITATION_RANGE",
                    "use --lines FIRST:LAST, inclusive")
            cite = (args.file, int(matched[1]), int(matched[2]))
        graph = CapabilityGraph(CorpusIndex(args.handoff, args.source_checkout))
        result = reference_dossier(graph, args.route, governed_method=args.method,
                                  citation=cite)
        print(json.dumps(result, sort_keys=True, ensure_ascii=False, indent=2))
        return 0
    except Refusal as exc:
        print(json.dumps({"schema": SCHEMA, "state": "REFUSED",
                          "code": exc.code, "detail": str(exc),
                          "composition_eligible": False}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
