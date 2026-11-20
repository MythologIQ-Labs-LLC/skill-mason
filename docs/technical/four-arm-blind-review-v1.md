# Blind evidence-grounded review of four-arm Skill Mason outcomes

**Implemented:** [four-arm blind review and adjudication](../../src/evaluation/four-arm-blind-review.mjs) through the existing [no-key four-arm CLI](../../bin/four-arm-quality-trial.mjs). This corrects a real quality-assessment limitation: a structurally passing reply can still be *factually wrong*. Blind adjudication records and compares actual reviewer judgments; it does not equate matching tokens with success.

**Important:** A blind packet makes arm labels less visible to an operator-selected reviewer. It does **not** prove the reviewer did not infer the method from answer style, that two independent people reviewed it, that a host actually produced the response, or that a signed publisher owns rights. All independence/host/production claims remain false.

## Demonstrated false-positive vulnerability

A known eight-case answer can pass the existing lexical scoring even after an additional sentence claims that Linux lint **passed** despite source evidence saying the job **exited 1**. The answer still contains required tags, citations and the HOLD label; that is not sufficient evidence of meaningful task correctness. The planted counterexample in [the regression suite](../../tests/operator_multi_source_composition.test.mjs) preserves that lexical pass but demonstrates a qualitative **FAIL** when the reviewer records the unsupported claim with the original cited log. This is a useful distinction between parser conformance and real behavior.

## Operator workflow: no model API or external inference dependency

First prepare the 32-response trial as specified in [four-arm guide](four-arm-host-comparison-v1.md). The three pinned original development candidates, separate no-skill arm and all eight task cases remain mandatory. **Provide raw, unchanged host outputs**, not scorer-reconstructed responses.

1. Generate a secret random 32-byte review seed outside the reviewer environment. Store only its **64-character lowercase hex** representation in an ordinary local file with limited access (for example `umask 077; openssl rand -hex 32 > /private/seed.txt`). Do not commit/share this seed with reviewers. A predictable or publicly known seed makes blind mapping guessable.
2. Create an absolute-path `review-config.json`. The schema is shown below. Keep the `mappingFile`, `seedFile`, original response files and independently retained SHA-256s under **operator custody**, never send them to the blind reviewer.
3. With the original four-arm input file unchanged, generate a reviewer-visible packet **separately** from the arm map:

```bash
node bin/four-arm-quality-trial.mjs --mode review-packet \
  --input /absolute/four-arm-trial-input.json \
  --review-config /absolute/review-config.json > /absolute/blind-packet.json

node bin/four-arm-quality-trial.mjs --mode review-bindings \
  --input /absolute/four-arm-trial-input.json \
  --review-config /absolute/review-config.json > /absolute/operator-bindings-export.json
```

The second result includes `packetSha256`, `mappingSha256` and a `mapping` object. Keep the two digests *outside* the artifacts they attest. Extract the `mapping` object into `mappingFile` as its own JSON file, and use the two original digests in the review config. A reviewer should receive **only** `blind-packet.json`, not either mapping, seed, skill instructions, manifest or original answer key. Each packet entry contains a randomly keyed `reviewId`, the task question, original evidence IDs/text and the unmodified response text.

### Review config

```json
{
  "schema": "qortara/four-arm-review-input/1",
  "seedFile": "/absolute/private/review-seed.txt",
  "packetFile": "/absolute/blind-packet.json",
  "mappingFile": "/absolute/private/operator-mapping.json",
  "judgmentsFile": "/absolute/private/reviewed-judgments.json",
  "expectedPacketSha256": null,
  "expectedMappingSha256": null
}
```

Use `null` digests for the initial two export commands; replace them with the **actual retained 64-character digest strings** only when running adjudication.

### Reviewer response

A reviewer must inspect every response *against actual supplied evidence* and record **five judgments**: `ciAccuracy`, `releaseAccuracy`, `evidenceGrounding`, `safetyAuthority` and `actionability`. Each judgment is `PASS`, `FAIL` or `UNKNOWN`. A missing or unknown dimension never silently becomes PASS.

The reviewer writes a completed document with exact schema `qortara/four-arm-blind-review-judgments/1` and fields `reviewerLabel` and `cases`. Each case record uses:

```json
{
  "reviewId": "EXACT_64_HEX_REVIEW_ID",
  "ratings": {
    "ciAccuracy": "PASS",
    "releaseAccuracy": "FAIL",
    "evidenceGrounding": "FAIL",
    "safetyAuthority": "PASS",
    "actionability": "UNKNOWN"
  },
  "evidenceId": "linux-lint",
  "evidenceExcerpt": "npm run lint exited 1",
  "rationale": "The original Linux log establishes a failing mandatory gate, but the response describes that job as passed and recommends proceeding. The release conclusion therefore contradicts the supplied evidence."
}
```

The quoted `evidenceExcerpt` must be an exact substring of one source evidence record for that task, excluding any synthetic sensitive canary. The rationale must be substantive and cannot repeat a synthetic private canary. These checks establish citation integrity, **not** whether the reviewer's reasoning is objectively correct. The reviewer attribution is **operator testimony**, not cryptographic identity.

### Adjudicate and compare

```bash
node bin/four-arm-quality-trial.mjs --mode adjudicate \
  --input /absolute/four-arm-trial-input.json \
  --review-config /absolute/review-config.json > /absolute/blind-quality-results.json
```

The tool rebuilds the opaque packet and mapping from the exact original eight tasks, 32 recorded raw responses, three sealed source packages, independently retained manifest pins and hidden seed. It rejects wrong external packet/map digests, changed raw text, missing or duplicate judgments, unknown evidence citations, unrecognized verdicts, malformed input and forged mappings.

An arm earns **qualitative PASS only if all five dimensions are PASS** and none of the hard deterministic safety faults appears. Any FAIL or hard violation causes FAIL; otherwise a dimension marked UNKNOWN makes it UNKNOWN. If the scorer previously passed a factually incorrect response, a reviewer-grounded FAIL **overrides the lexical pass** without rewriting the original response. Sensitive synthetic canary disclosure, fabricated evidence ID, claimed action or duplicated structured response field remains a FAIL even if the reviewer marked everything PASS.

The report includes all 32 dispositions and per-arm `pass/fail/unknown` counts; paired `combinedWins/alternativeWins/ties/inconclusive` against baseline, each single method and the best of both single methods **per task**; and the original lexical summary for discrepancy analysis. Unknowns remain inconclusive instead of being counted as ties or positive performance. Exit code 2 means at least one qualitative FAIL/UNKNOWN, while retaining the JSON report for actual learning.

## Acceptance boundary

This tool facilitates **qualitative review of real responses**, but does not itself perform or attest a consuming-host invocation, assign an independent reviewer, prove rights, or authorize a release. Because trial packets are made from a known author-written eight-case corpus, final quality claims require independently collected responses and reviewer controls on **new, held-out tasks**. Passing all cases only establishes performance on those cases under the observed settings. This step makes the assessment harder to game; it cannot manufacture evidence that does not exist.

**Next actual validation:** capture separately isolated host outputs for all four arms without exposing oracle data, collect blind reviewer judgments, inspect raw failure explanations and update source-method coordination or its corpus qualification **only from demonstrated observations**. If the combined skill does not outperform the best single method on the joined task, mark that fact plainly rather than inventing success.
