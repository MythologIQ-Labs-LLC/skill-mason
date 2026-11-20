# Four-arm manual agent-host comparison, v1

**Implemented:** [key-free prepare and score CLI](../../bin/four-arm-quality-trial.mjs), [source-bound comparison functions](../../src/evaluation/ci-release-combined-score.mjs), and [eight joined CI/release tasks](../../tests/fixtures/combined-ci-release-boundaries-v1.json).

**Evidence status:** A working manual trial packet and paired response scorer. The CI regression uses **manufactured, oracle-derived model replies** to test parsing, source pins, paired counts, loss detection, privacy controls and exit statuses. CI **does not call an inference model** and is **not** a behavioral result. The current in-chat assistant is not an isolated or independently adjudicating host.

## Why this capability is useful

A combined skill can accidentally produce a longer, worse answer than either original method. Passing compiler checks only proves that it has the right bytes and source receipts. The tool now makes **all four** capability configurations comparable against the **same** eight tasks, without credential setup:

- `baseline`: no skill instructions
- `ci_only`: exactly original CI Failure Triage v5
- `release_only`: exactly original Release Readiness Review v2
- `combined`: those exact two methods plus deterministic compiler reconciliation rules

The CLI verifies the complete **disk-sealed** nonbaseline skill packages and compares each against a **separately retained package manifest SHA-256**. The original historical method SHA-256s must match their immutable pins; a single-method package cannot impersonate the combined source. No skill is installed or granted authority by preparing a trial. A red/green test score must not be confused with real operator rights acceptance.

## Prepare: 32 prompts with no answer leakage

1. Obtain the three complete development candidate folders from a trusted operator coordinator. Use [single-method operator composer](../../src/backend/operator-source-composition.mjs) for the two individual arms and [multi-method composer](../../src/backend/operator-multi-source-composition.mjs) for the combined arm. These are **development fixture paths until actual owner source approval is established**, never a public user self-approval mechanism.
2. Independently retain each original package's `skill-mason.json` digest before exposing it to the host. Never compute the expected digest from the same candidate at scoring time.
3. Create a local operator-owned JSON file, for example `/absolute/path/four-arm-input.json`, with this structure (replace all placeholders with verified real paths and SHA-256s):

```json
{
  "schema": "qortara/four-arm-trial-input/1",
  "caseFile": "/absolute/path/skill-mason/tests/fixtures/combined-ci-release-boundaries-v1.json",
  "artifacts": {
    "baseline": null,
    "ci_only": {
      "candidateDir": "/absolute/path/ci-failure-triage-v5",
      "expectedManifestSha256": "EXACT_PREVIOUSLY_RETAINED_64_HEX"
    },
    "release_only": {
      "candidateDir": "/absolute/path/release-readiness-review-v2",
      "expectedManifestSha256": "EXACT_PREVIOUSLY_RETAINED_64_HEX"
    },
    "combined": {
      "candidateDir": "/absolute/path/ci-release-review",
      "expectedManifestSha256": "EXACT_PREVIOUSLY_RETAINED_64_HEX"
    }
  },
  "responses": {
    "baseline": "/absolute/path/baseline-recorded-answers.json",
    "ci_only": "/absolute/path/ci-recorded-answers.json",
    "release_only": "/absolute/path/release-recorded-answers.json",
    "combined": "/absolute/path/combined-recorded-answers.json"
  }
}
```

```bash
node bin/four-arm-quality-trial.mjs --mode prepare --input /absolute/path/four-arm-input.json > /absolute/path/trial-packet.json
```

`prepare` does **not** read the answer files. It emits the same eight prompts and evidence snippets in all four arms, with `skillInstructions: null` for baseline or the exact sealed `SKILL.md` for the other three arms. **It never includes** oracle decision labels, mandatory-citation keys or forbidden-answer phrases from the fixtures. Do not give the model the original whole fixture JSON (which *does* contain oracles).

Run each of the **32** tasks in a fresh independent host conversation using identical model identity, temperature/settings, tool policy and task format. Put the arm's skill instructions into the allowed instruction position and give the agent only that task's `taskPrompt`. No tools, repository writes, secrets or network-dependent task execution are necessary. If a host cannot provide isolated sessions, record that limitation; do not mark a shared chat session as independent.

**Responses must be actual unchanged host output**, not answers reconstructed by the scorer, author, or oracle. Record the observed raw text and separately observed host/model/session metadata, timestamps and relevant failure/refusal information where available. The tool's minimum response schema intentionally does **not** cryptographically attest these claims. The response files each use the existing `qortara/combined-ci-release-raw-responses/1` schema, `origin: OPERATOR_TRANSCRIBED_UNATTESTED`, and exactly eight cases with `{id,hostLabel,sessionLabel,rawResponse}` matching the original case IDs. Each case/arm must have a distinct session label, and all four arm labels for a case must name the same host. Values are operator testimony, not proof of host identity.

## Score and inspect real answers

```bash
node bin/four-arm-quality-trial.mjs --mode score --input /absolute/path/four-arm-input.json > /absolute/path/four-arm-results.json
```

The output records per-arm pass/fail counts, **paired wins/losses/ties** for the combined arm against baseline, each single method and the **best passing single arm per case**, and every underlying error code. Any lexical or structural case failure gives exit code `2` but **does not invalidate the useful negative evidence** in the JSON report. A green result is only that the known lexical oracle passed, not proof that the answer is correct or genuinely sourced.

The comparison refuses incorrect historical method identities, wrong independently retained hashes, fake combined-single method substitution, missing/duplicate response cases, reused session labels and different named target hosts for the same task. It does not have external provider attestation, cannot validate transcript authenticity, and cannot establish model temperature or hidden host configuration from claims in response files.

## Qualitative review and actual product decision

Independently read all **32** raw answers against each task's true evidence, including those that pass the lexical scorer. Score the harder questions the lexical oracle cannot settle: whether the first error was truly inferred, whether unrelated failing jobs were conflated, whether owner-mandatory release policy is actual authority, whether quoted evidence supports the conclusion, whether redaction removed meaningful context, and whether the final recommendation is more useful than the baseline. If all four arms pass the simple eight known tasks, **report a ceiling effect, not proof that the combined skill adds value**.

The product claim is supported only when real host tasks, independently assessed, show the combined skill reliably performs the *joined* job better than neither or either single method, on new representative cases, without higher hallucination, latency or overreach. Keep track of failures, cost, length, model/context effects and adversarial attempts. If no improvement is demonstrated, revisit the coordination instructions and case difficulty rather than silently declaring the generated package excellent.

**Unchanged holds:** author-approved source rights and asset use, custodied signer trust, genuine Prism P0 plus higher host policy, independently witnessed host acceptance, and production eligibility. The four-arm scorer cannot establish any of them.
