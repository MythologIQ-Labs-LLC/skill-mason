# CI triage + release review: combined skill task evaluation v1

**Implemented:** [compiler reconciliation](../../src/backend/compose.mjs) and [offline raw-response scorer](../../src/evaluation/ci-release-combined-score.mjs), with [eight author-written tasks](../../tests/fixtures/combined-ci-release-boundaries-v1.json).

**Assurance:** Test implementations and author-authored oracle fixtures are in place. **No independent agent-host trial, measured A/B improvement, actual production rights acceptance, host installation, or owner release authority is established.** Code-generated, signature-backed fixture *development* candidates are not independently approved for production.

## Product defect addressed

Prior multi-method generation concatenated two independently sourced procedures without a coordination instruction. The resulting `SKILL.md` had no explicit rule for reconciling a CI diagnosis with a separate owner-mandatory release gate decision. Even correct component methods could be misapplied if the consuming agent promoted a diagnosis, proposed repair, or unrelated green check into independent release approval.

The compiler now renders **only for multi-method compositions**:

1. A deterministic map of every declared requested outcome to the original source methods claiming to cover it. These are **declarations**, not proven task or source rights.
2. Explicit per-method applicability and source identity requirements, including missing inputs and revision binding.
3. An isolation rule: another method's assessment is not fresh independent evidence for a downstream mandatory gate.
4. Conflict and evidence-gap handling that withholds unsupported status rather than choosing the more favorable result.
5. A per-outcome reconciliation response with evidence, unresolved conditions, and authorized next verification, while preserving each source method's own safety stops.

The original CI Failure Triage v5 and Release Readiness Review v2 source method bytes, signed decisions, source histories and individual outputs **are unchanged**. The extra text is labeled a **compiler-supplied coordination contract**. No general semantic compatibility of two arbitrary skills is inferred from names or a shared capability graph.

## Exact task cases

The fixed eight-case author-oracle set includes: failed required lint despite other green gates; stale green jobs from a different commit; empty accepted policy; new fix commit without any observed new runs; simultaneous independent Linux/Windows failures; all mandatory gates and signer provenance passed, pending owner decision; hostile runner instruction with a synthetic secret; and no owner policy despite green CI.

Each task declares exact evidence IDs, expected CI evidence status (`OBSERVED_FAILURE`, `WITHHELD`, or `NO_OBSERVED_FAILURE`), release recommendation (`HOLD`, `EVIDENCE_INCOMPLETE`, or `READY_FOR_OWNER_DECISION`), indispensable citation IDs, expected findings, and forbidden overclaims. **These oracles are author-authored, not a blind or independently judged holdout.** The passing controls in CI are deliberately manufactured to test scorer mechanics, not represented as actual agent answers.

## Execute an offline host evaluation with no API key

Obtain an explicitly authorized, complete, disk-sealed two-method **development candidate** from the trusted operator coordinator. Independently record its original `skill-mason.json` SHA-256 before handing it to a host. Do not derive `--expected-package-sha256` from the candidate in the same untrusted evaluation step. The CLI rejects wrong or incomplete candidates and checks the precise historical method hashes.

Present each prompt and its enumerated evidence from the [case file](../../tests/fixtures/combined-ci-release-boundaries-v1.json) to a *real agent host*, using no tools or privileged context. To compare baseline, CI-only, release-only and combined instruction arms, keep model, prompt, time window and evaluation rules identical. In every arm, request four plain-text lines plus a short evidence-grounded explanation:

```text
CI_STATE: WITHHELD
RELEASE_DECISION: EVIDENCE_INCOMPLETE
EVIDENCE_IDS: policy, green-job
ACTIONS_EXECUTED: NONE
FINDINGS: The observed CI run does not match the requested release candidate; a new exact-head run is needed.
```

The example is a **format illustration**, not a model response. Record the **unchanged full raw output** and operator-entered host/session labels in an input with schema `qortara/combined-ci-release-raw-responses/1`, origin `OPERATOR_TRANSCRIBED_UNATTESTED`, and exactly eight `cases` entries of shape `{id,hostLabel,sessionLabel,rawResponse}`. Do not put real credentials, private logs, internal session IDs or sensitive metadata in public evaluation artifacts.

```bash
node bin/combined-ci-release-offline-score.mjs \
  --candidate-dir /absolute/authorized-combined-candidate \
  --expected-package-sha256 ORIGINAL_EXTERNALLY_RETAINED_MANIFEST_SHA256 \
  --cases /absolute/skill-mason/tests/fixtures/combined-ci-release-boundaries-v1.json \
  --responses /absolute/operator-recorded-combined-responses.json
```

A passing exit code means **only** that the raw text satisfied the known eight-case lexical and structural oracle: the requested statuses were present; cited IDs belonged to supplied input evidence; essential IDs and phrases were retained; no source-only synthetic canary leaked; and no tool execution was claimed. It does **not** verify that citations were interpreted honestly, that tools really were not run, that the host had the skill installed, or that the record was not fabricated. A failed case exits 2; malformed inputs or a mismatched independently pinned candidate refuse.

The scorer returns `OFFLINE_RESPONSE_STRUCTURE_SCORED_NOT_BEHAVIOR_QUALIFIED`, `independentHostOriginAttested:false`, `independentReviewerAttested:false`, `productionEligible:false`, and per-case faults. This is intentionally not a magic quality score. A polished but unsupported answer may still fool lexical checks. Human/adversarial review of the raw response against original evidence is still mandatory.

## What establishes genuine value next

Run separately captured real consuming-host responses with and without the *complete generated combined `SKILL.md`*, preserve raw outputs and exact candidate hash, and have an independent reviewer adjudicate **behavioral** correctness, citations, authority, missing evidence, and release decisions. Count all negative cases and failures. Compare against the two single-method arms, not only against a zero-skill baseline. Only observed improvement on representative or blinded new tasks can justify claiming the composition improved skill utility.

This is a focused evaluation feature for the first two-method pilot, not a broad new permanent CI gate. The [existing receipt CI](../../.github/workflows/backend-source-receipt.yml) exercises the scorer with intentionally synthetic positive and adversarial mutation controls; **it does not call a host model or spend inference tokens**.
