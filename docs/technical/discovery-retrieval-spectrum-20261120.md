# Discovery retrieval spectrum: first corpus-wide falsification

**Issue:** [#97](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/97) (P0, remains OPEN).
**Status:** Source-pinned experiments and regression implementation. No independent
human gold labels, consumer host results, rights, fitness or production admission.

## What actually failed

After PR #98 eliminated metadata-key leakage from the **capability graph**,
the more general `CorpusIndex.search` still searched serialized record JSON.
Nested keys such as `original_evidence`, `record_id` and `semantic_status`
could therefore create spurious leads. This patch changes **record search**
to complete Unicode case-folded tokens from original source **values** only.
It preserves source family, identity, original record bytes, and
`composition_eligible: false`; no source contents or rights determinations
are altered. The separate manifest *path-reference* search remains a
deliberate path lookup, not a task relevance scorer.

The synthetic regressions distinguish metadata names, source-value hits,
false substrings, punctuation, and no-token refusals. These tests establish
exact lexical predicates, not semantic fitness.

## Why we must not simply turn on partial-overlap routing

The pinned source contains 33 domains and 247 recognized subdomain routes
(commit `31a8c518dd97b7828adcc728202fa41388a306d7`,
tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`).
**246 of 247** original essential-outcome lists are empty.

A read-only reproduction using the same source fields, exact-token predicate,
and frozen `benchmarks/request-routing-adversarial-v2.json` inputs produced:

| Measure (author-labeled 13-route experiment only) | Exact all-query-word baseline | Untuned partial route-name overlap |
| --- | ---: | ---: |
| Correct top-1 of 26 positive tasks | 0 | 3 |
| Expected route in top-3 of 26 | 0 | 6 |
| Incorrect non-abstaining top-1 of 26 | 0 | 20 |
| Abstained on positives | 26 | 3 |
| Non-abstained on 8 ambiguous/negated requests | 0 | 8 |
| Non-abstained on 12 outside-*13* requests | 0 | 7 |

**Critical denominator rule:** `outside_13` does NOT mean outside all 247
recognized routes. Those seven non-abstentions cannot be called seven
false positives against the whole corpus without independent labels.

The baseline retrieved no candidate for any of the 26 labeled
natural-language positive requests. A completely unthresholded weighted
route-name probe found only three correct top-1 results, emitted 20 wrong
top-1 leads, and failed to abstain on all eight adverse requests. These
results **reject automatic route selection by either method**; higher
non-abstention is not proof of better discovery.

## Reproducible experiment and limits

`scripts/discovery_retrieval_audit.py` builds its probe exclusively from
source route IDs, domain names and subdomain names. It uses the existing,
documented experimental word normalizer, inverse-document-frequency weights,
stable tie order, and **no threshold tuned to these 46 cases**. It compares
against the actual production graph's exact-token search. Its output includes
case-by-case predictions, source-name overlap, per-group denominators,
pinned input hashes, and an explicit `NO_GO_AUTOMATIC_ROUTE_SELECTION`.

It also probes **all 247 exact route IDs**, verifying that each source route
is retrievable somewhere in the bounded results. In the read-only predicate
reproduction all 247 identities were found, 242 were first and all 247
occurred in the first three. These are **taxonomy echo/integration controls**,
not natural-language retrieval accuracy and not independent adjudication.

Run in the existing pinned-source `corpus-index.yml` job:

```sh
python3 -m unittest discover -s tests -p 'test_catalog_index.py' -v
python3 -m unittest discover -s tests -p 'test_discovery_retrieval_audit.py' -v
python3 -m scripts.discovery_retrieval_audit \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  > corpus-reference-evidence/discovery-retrieval-spectrum.json
```

The 46 inputs are author-labeled and public in the repository; neither the
benchmark's labels nor its prompts are a genuinely blind independent holdout.
Using these inputs repeatedly to set weights, aliases, thresholds or negation
rules would contaminate future validation. The source-name probe is
**audit-only**. Neither `CapabilityGraph.search` nor consumer API semantics
have been silently replaced.

## Next independent qualification, without inventing gold labels

Issue #97 remains open for a new, separately held-out set covering **every
one of the 247 routes**, including rare capabilities, synonyms, hard
near-misses, contradictory/negated tasks, multi-intent routing, out-of-domain
requests, missing prerequisites, unsafe source instructions and source-family
bias. A blind independent reviewer must adjudicate expected route sets and
legitimate abstentions before candidate tuning. Report top-1 and top-3
correctness, wrong non-abstentions, abstention appropriateness, rare-route
recall, reviewer disagreement, and unknown denominators independently.

After a route is found, source-task fitness, rights, exact package bytes,
host execution and independent operator acceptance remain separate
qualification stages. A high retrieval score alone cannot authorize any of
them.
