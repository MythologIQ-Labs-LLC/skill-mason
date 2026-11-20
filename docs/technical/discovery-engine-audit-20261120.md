# Discovery and evaluation engine: source-grounding audit

**Status:** First independently falsifiable code defect fixed in a branch; P0 [engine-quality issue #97](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/97) remains open. This is **a lexical false-positive correction**, not proof that the system has the best semantic retriever or that any source has been qualified for a target host.

## Verified initial finding

The previous `CapabilityGraph.search` performed substring matching against `json.dumps` of a dictionary with the literal keys `path`, `domain_name`, `subdomain_name`, `statements` and `essential_outcomes`. **Every** route serialized with those keys. A query naming a field could therefore retrieve all **247 recognized routes** without any relevant original capability statement. A partial character sequence inside a longer unrelated word could also match.

**Affected consumers:** the user-facing `scripts/user_route_discovery.py` (delegates to `graph.search`), baseline retrieval in `scripts/evaluate_request_language.py`, and any direct `scripts/capability_graph.py search` caller. Ineligible names were not promoted to rights/host/Prism approval, but the returned *discovery leads* were systematically overinclusive for such inputs.

The correction in `scripts/capability_graph.py` requires **complete, NFC-normalized, case-folded Unicode lexical tokens** found in declared original-source values: exact route ID, domain/subdomain names, existing capability statements and essential outcomes. It never indexes serialized JSON labels, fabricated source metadata, raw name-only review hints or unverified admission status. Slash, hyphen, underscore and punctuation separate tokens; there is no stemming, synonym inference, negation reasoning, embedding, model/API call or implicit method selection. Every query token must be present in the same recognized route's value set. Search remains deterministic, bounded and read-only.

The regression suite `tests/test_capability_search_grounding.py` exercises Gherkin-style positive and negative controls: JSON-key-only queries, false substring matches, field-name lookalikes, actual route tokens, punctuation/case/Unicode variation, all-word matching across actual source fields, empty-token refusal, stable route ordering, truncation and preserved non-admission. These are **synthetic controls** for a concrete implementation bug, not independently labeled real task relevance.

## Exact original corpus before/after audit

The pre-change predicate is reproduced read-only in `scripts/audit_route_search_grounding.py`; production search never calls it. The existing **pinned corpus** workflow executes the old and corrected predicates against the same 247 original routes from the unchanged Skillz source commit `31a8c518dd97b7828adcc728202fa41388a306d7` and tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`.

The CI receipt `corpus-reference-evidence/route-search-grounding.json` records, for each of five synthetic metadata-key traps and three normal lexical queries, the original match count, new source-value match count, old-only unsupported hits and newly reachable punctuation-token hits. The workflow explicitly requires that the previous predicate matches **247/247** routes for each metadata-key trap and the fixed predicate matches **fewer than 247**. These numbers measure a structural false-positive bug on the actual corpus, not a broad semantic precision or recall score. No independent held-out labels were used; any claim that this is a better *semantic* retrieval engine would require separate evaluation.

## Engine stages still requiring hard qualitative review

| Stage | Current evidence | Remaining quality question |
| --- | --- | --- |
| Source ingestion and source integrity | Original pinned source inventory, source/graph drift controls and receipt checks | How does it handle freshness, alias identity, moved packages, license/NOTICE drift and source-family sampling bias? |
| Capability route discovery | 247 recognized routes, repaired source-value token matching, separate experimental 13-route lexical preview | What is the independent top-1/top-3/abstain/false-positive behavior on held-out requests across all 247 routes, including synonyms, negation and composite tasks? |
| Candidate-to-outcome comparison | Exact evidence-linked and name-only leads separated; rights and host approval absent | Does a method actually cover the requested task and essentials? How do missing or conflicting evidence and competing methods affect selection? |
| Original task-method review | Nine bounded first-party original method references and original-source quotes | Do real consuming agents follow the methods and refusals on unseen tasks, and does the combined result outperform alternatives? |
| Evaluation/adjudication | Author-labeled tests and blind reviewer packet machinery with input/source pins | Are the judges independent, are references grounded, and are failures and uncertainty counted rather than ignored? |
| Authority, rights and delivery | Negative permission/host gates and native Prism holds | What independent owner-granted rights, approved host, exact output bytes and real acceptance evidence close the gaps? |

**Priority after this repair:** Establish an independent or genuinely blind held-out route benchmark across the full taxonomy, including paired negated requests and out-of-domain controls. Compare exact-token retrieval, the existing 13-route experimental grounded retriever and defensible alternatives on the same inputs and cost footprint. Preserve distinct unknown/missing labels, report per-route denominators and calibrate abstention before even considering automatic route choice. Do not put unapproved proposal descriptions into recognized route truth.

This repair does **not** change the pinned upstream Skillz corpus, the nine bounded method-review records, PRISM qualification, model-execution claims, source reuse rights or production authority. The issue remains open until independently reviewed selection/fitness metrics and end-to-end consuming-host outcomes justify closing it.
