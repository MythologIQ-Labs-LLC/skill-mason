#!/usr/bin/env python3
"""Explicitly unapproved request route preview from pinned Skillz evidence.

No auto-selected route. No method, rights, Prism, composer, host or execution.
The similarity engine is a previously measured experimental lexical candidate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

from scripts.catalog_handoff import COMMIT, TREE, Refusal, require
from scripts.catalog_index import CorpusIndex
from scripts.capability_graph import CapabilityGraph
from scripts.evaluate_request_language import GroundedLexicalRetriever

SCHEMA = "qortara/manual-route-preview/1"
EXPECTED_PROPOSAL_SHA256 = "2a9bd2c6efb50cd222c87ce73e787a5fcdccc7a67a278a838d610ba7dddcb345"
PROPOSAL_PATH = Path(__file__).resolve().parents[1] / "docs/technical/essential-workflow-proposals-v1.json"
CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def preview(graph, proposal_doc, request, *, limit=3):
    require(type(limit) is int and 1 <= limit <= 3, "PREVIEW_LIMIT",
            "preview limit must be one to three unapproved leads")
    require(isinstance(request,str) and request==unicodedata.normalize("NFC",request)
            and 16 <= len(request.strip()) <= 1200 and len(request.split())>=4
            and not CONTROL.search(request), "PREVIEW_REQUEST",
            "describe a bounded actual task in NFC text without controls")
    require(isinstance(proposal_doc,dict) and
            proposal_doc.get("schema_version")=="qortara/essential-workflow-proposals/1" and
            proposal_doc.get("authority")=="proposals-only-not-imported-into-skillz-or-capability-graph" and
            proposal_doc.get("source_commit")==COMMIT,
            "PREVIEW_PROPOSALS", "expected published non-governed route descriptions")
    rows=proposal_doc.get("rows")
    require(isinstance(rows,list) and len(rows)==13 and
            all(isinstance(x,dict) and x.get("proposal_status")=="DRAFT_NOT_GOVERNED" and
                isinstance(x.get("route"),str) and x["route"] in graph.paths for x in rows)
            and len({x["route"] for x in rows})==13,
            "PREVIEW_PROPOSALS", "incomplete or promoted route descriptions")
    source=graph.corpus.manifest["source"]
    require(source.get("commit")==COMMIT and source.get("git_tree_sha1")==TREE,
            "SOURCE_PIN", "pinned source commit and source tree required")
    candidate=GroundedLexicalRetriever(rows).route(request)
    state = ("LEADS_REQUIRE_USER_CHOICE" if candidate["prediction"] is not None
             else "ABSTAIN_NO_AUTOMATIC_ROUTE")
    matches=candidate["top3"][:limit] if candidate["prediction"] is not None else []
    leads=[]
    for route, score, overlap in matches:
        require(route in graph.paths, "PREVIEW_PROMOTION", "candidate outside exact recognized graph")
        leads.append({
            "route":route,
            "similarity_score_not_confidence":score,
            "shared_content_token_count":overlap,
            "review_status":"UNASSESSED_LEXICAL_LEAD_NOT_A_METHOD_OR_APPROVAL"})
    return {
        "schema":SCHEMA, "state":state,
        "request_sha256":hashlib.sha256(" ".join(request.split()).encode("utf-8")).hexdigest(),
        "pinned_source_commit":COMMIT,"pinned_source_tree":TREE,
        "route_universe":"13_UNGOVERNED_WORKFLOW_DESCRIPTIONS_WITHIN_247_RECOGNIZED_ROUTES",
        "evaluated_route_count":13,
        "recognized_route_count":len(graph.paths),
        "candidate_method_count":0,
        "unapproved_route_leads":leads,
        "suggestion_quality":"EXPERIMENTAL_AUTHOR_LABELED_REPLAY_FAILED_NEGATED_AMBIGUOUS",
        "semantic_negation_handling_verified":False,
        "user_must_explicitly_select_route":True,
        "selected_route":None,
        "source_rights_established":False,
        "host_authority_established":False,
        "prism_invoked":False,
        "composer_invoked":False,
        "output_package_created":False,
        "composition_eligible":False,
        "production_eligible":False
    }


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--request",required=True)
    p.add_argument("--handoff",required=True)
    p.add_argument("--source-checkout",required=True)
    p.add_argument("--limit",type=int,default=3)
    args=p.parse_args(argv)
    try:
        raw=PROPOSAL_PATH.read_bytes()
        require(hashlib.sha256(raw).hexdigest()==EXPECTED_PROPOSAL_SHA256,
                "PREVIEW_PROPOSALS", "published experimental descriptions changed")
        proposals=json.loads(raw)
        graph=CapabilityGraph(CorpusIndex(args.handoff,args.source_checkout))
        result=preview(graph,proposals,args.request,limit=args.limit)
        result["proposal_source_sha256"]=EXPECTED_PROPOSAL_SHA256
        print(json.dumps(result,indent=2,sort_keys=True))
        return 0
    except (Refusal,ValueError,KeyError,OSError) as exc:
        print(json.dumps({"schema":SCHEMA,"state":"REFUSED","code":getattr(exc,"code","PREVIEW_FAILED"),
                          "message":str(exc),"composition_eligible":False,
                          "production_eligible":False},sort_keys=True))
        return 2


if __name__=="__main__":
    raise SystemExit(main())
