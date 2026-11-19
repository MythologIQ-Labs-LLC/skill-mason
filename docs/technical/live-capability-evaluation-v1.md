# Live capability-routing evidence from the pinned skillz corpus (C4/C5)

**Scope:** Concrete cross-domain source ingestion and negative product-generation tests, not merely synthetic unit tests. **Not** genuine method qualification, semantic agent routing, rights approval, model inference, or actual consumer-host behavior.

## Exactly what is tested

[`scripts/live_capability_probe.py`](../../scripts/live_capability_probe.py) loads the **complete** published Skillz handoff at `efba572262fc5fa3ff1934b054aa4f15ce149c1a` and its **separately pinned** original source at `31a8c518dd97b7828adcc728202fa41388a306d7` / tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`. Existing `CorpusIndex` validates the original source bytes; `CapabilityGraph` validates 33 recognized capability domains, 247 routes, all paired review identities, and exact evidence-linked crosswalks. There are 1,043 governed reviews and 66,139 overlapping source observations, **not 67,182 qualified skills**.

The live probe processes **all 13 draft essential-workflow objective requests** from [the review-ready proposal file](essential-workflow-proposals-v1.json), including software UI, accessibility, release supply chain, game economy, memory provenance, reproducible science, user testing, model quantization, agent tool contracts, audio mixing, engineering drawings, robotics safety and medical evidence review. Requests are **explicitly tagged with the recognized capability route**, not matched by an unqualified semantic classifier. The alternating ChatGPT/Claude host *labels* are requested targets, not authenticated host authority.

For each request, the probe executes the actual `compare` implementation over the full pinned reviewed corpus. It preserves counts of evidence-linked candidates, name-only unassessed leads, review disposition classes and missing workflow definitions. It samples **one** governed evidence-linked review by a deterministic, explicitly **non-quality-ranking** policy (source-inspectable first-party before external sources, then exact review ID) and calls real `prepare_preflight` against the exact pinned original source. This checks source bytes where possible, binds the governed record, exact source, target host and route to a SHA-256, and emits the *actual* C5 typed denial. When a route has no evidence-linked review, it emits `NO_EVIDENCE_LINKED_REVIEW` rather than pretending no relevant skill exists anywhere.

All results remain `REFUSED_PRE_ADMISSION`. The reporter actively **rejects** any comparison or preflight that claims `chosen_method`, positive evidence/rights/authority/coverage, host validation, composition eligibility or a guest invocation. No third-party executable source instructions or assets are run. A source that is genuinely present and byte-verified is **still refused** if its rights, permissions or outcomes are not independently established.

## Run and inspect actual results

The source-pinned [`corpus-index.yml`](../../.github/workflows/corpus-index.yml) CI installs no untrusted skill, checks out historical Skillz publication and source separately, runs the module and stores `corpus-live-capability-probe.json` in `pinned-corpus-index-summary` with 14-day retention.

```sh
python3 -m scripts.live_capability_probe \
  --handoff /path/to/exact-skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/exact-original-skillz-source \
  --proposals docs/technical/essential-workflow-proposals-v1.json \
  > corpus-live-capability-probe.json
```

The JSON includes the full 13 task statements, route/host labels, evidence-linked review totals, sample governed ID, byte-verification status, original binding hash, typed blocker codes and global refusal histogram. It does **not** include original package source or raw skill instructions, does not write to Skillz, and never says a blocked method is qualified. Reject observations that lack an exact source pin or that promote a mere review status into evidence.

### Reading the outputs accurately

- `sampled_original_source_bytes_verified_count` counts **one selected record per scenario whose pinned source/package bytes were actually checked**. It is not a count of qualified skills.
- `routes_with_no_evidence_linked_reviews` means no *governed evidence crosswalk* on the pinned snapshot; it does not prove absence of discovered or unmapped sources.
- `refusal_code_occurrences_not_unique_skills` counts why selected requests were stopped. Several blockers can apply to the same request.
- `qualified_skills:0`, `actual_prism_guest_invocations:0`, `real_host_invocations:0` are required and asserted by CI. A **different** [P0 real Prism generator workflow](backend-source-approval-receipt-v1.md) has generated two actual original-source unqualified candidates. Do not conflate the two test stages.

The source catalog is independently versioned from Skill Mason. Publishing new Skillz reviews or method packages requires a new pinned snapshot accession and rights/host checks; this evaluator never silently advances to `skillz/main`. In particular, do not add Skill Mason branding or coupling to the separate Skillz README.

## Findings and roadmap gates

Live CI results must be interpreted as actual observed sample outcomes, not predicted by this document. Future expansion should target the strongest **missing verified bytes / unmapped mapping / absent workflow definition** gaps supported by the observed 13-route evidence. This avoids saturating one domain with copied skills and keeps utility and licensing separate. Expand beyond one sample per route only after a source-specific verification/rights plan is recorded; then run actual agent-host task trials on author-approved candidates.

**Release HOLD:** no source or rights decisions have been signed by an authorized operator, none of the 13 requests has a production-qualified method, no genuine target-host task test is run by this probe, no native Qortara check is substituted for a CI success, and no owner merge approval is inferred.

## Regression coverage

[`tests/test_live_capability_probe.py`](../../tests/test_live_capability_probe.py) tests genuine-negative response contracts with synthetic adversarial controls: a byte-verified but unlicensed method never admits, an evidence-link gap does not invent a candidate, a forged chosen method or positive fact is rejected, and absent/duplicate/rights-promoted route input is rejected. The separate CI run verifies **real pinned corpus bytes and governed source pointers**, not just those synthetic units.
