# Public four-arm trial: CI triage + release evidence

**Status: development-only, unqualified original-source previews.** This is a public test of whether combining two methods improves actual agent answers. It is **not** an installed, signed, rights-approved or production-qualified skill. The host is not granted permission to run commands, access secrets, modify a repository, publish a release or adopt an unverified source.

**[Prepare a free trial packet](../../bin/public-four-arm-trial.mjs)** · [Task source](../../tests/fixtures/combined-ci-release-boundaries-v1.json) · [Submit observed feedback](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/new?template=skill-trial-feedback.yml)

## Get the instructions with no signing keys or model API

The existing [Source-approval receipt CI workflow](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/workflows/backend-source-receipt.yml) publishes the artifact **`public-four-arm-original-source-trial`**. Download the artifact from the latest **successful run on `main`** and inspect `public-four-arm-trial.json`.

Or, from a checkout of this repository with Node 22 or newer, generate the same preview directly:

```bash
node bin/public-four-arm-trial.mjs --prepare > public-four-arm-trial.json
```

Neither route needs an inference API key, a Prism `.holo`, operator signing keys, Cloudflare credentials or private corpus access. The generator reads and verifies two complete **historically SHA-256/Git-blob-pinned first-party original procedure files** already included in this repository. It renders the same deterministic instruction template as the compiler, without pretending source rights or eligibility have been approved.

The packet contains:

- `arms.baseline = null`: no additional skill instructions.
- `arms.ci_only.instructions`: the original **CI Failure Triage v5** method.
- `arms.release_only.instructions`: the original **Release Readiness Review v2** method.
- `arms.combined.instructions`: both originals plus the compiler's evidence-reconciliation instructions.
- `tasks`: eight fictional, evidence-tagged tasks, intended to be run once under each of the four arm configurations, for **32 total fresh sessions**. Each task includes `prompt`, `evidence` and `formatInstructions`. No expected verdicts or answer-key oracles are included.

Every preview includes the original source SHA-256 and commit, and a SHA-256 of the exact instructions. Keep those values unchanged when recording responses. If you're concerned about response length, **do not shorten or edit** the skill during the first trial; report that it was too long or impractical. That is useful negative quality data.

## Run real model/agent tests

For each case and arm, start a new **tool-disabled** conversation with a consistent model and settings. In the baseline arm use no special skill. For other arms, paste the corresponding `instructions` string in the host's permitted user instructions, followed by the exact case prompt and each evidence line, for example `[policy] ...`. This is **pasted-instruction emulation**, not proof of native skill installation. Do not grant tools or ask the model to execute commands merely because an instruction file is present.

Request the exact output shape in `formatInstructions`, with these headings:

```text
CI_STATE: WITHHELD
RELEASE_DECISION: EVIDENCE_INCOMPLETE
EVIDENCE_IDS: policy, green-job
ACTIONS_EXECUTED: NONE
FINDINGS: Explain the actual supported conclusion using supplied evidence, unresolved uncertainties and the smallest permitted next check.
```

Those sample labels illustrate format only, not the correct answer to a particular case. **Keep the entire real raw answer unchanged**, including errors and unexpected material. Do not write a success answer on the model's behalf. Do not reveal the original `tests/fixtures/combined-ci-release-boundaries-v1.json` file to the model because that *does* contain author-written expected decisions.

## Score operator-recorded responses

Prepare a local UTF-8 JSON record, following this structure:

```json
{
  "schema": "qortara/public-four-arm-host-responses/1",
  "previewSha256ByArm": {
    "baseline": null,
    "ci_only": "THE_EXACT_CI_PREVIEW_SHA256",
    "release_only": "THE_EXACT_RELEASE_PREVIEW_SHA256",
    "combined": "THE_EXACT_COMBINED_PREVIEW_SHA256"
  },
  "arms": {
    "baseline": {"schema":"qortara/combined-ci-release-raw-responses/1","origin":"OPERATOR_TRANSCRIBED_UNATTESTED","cases":[]},
    "ci_only": {"schema":"qortara/combined-ci-release-raw-responses/1","origin":"OPERATOR_TRANSCRIBED_UNATTESTED","cases":[]},
    "release_only": {"schema":"qortara/combined-ci-release-raw-responses/1","origin":"OPERATOR_TRANSCRIBED_UNATTESTED","cases":[]},
    "combined": {"schema":"qortara/combined-ci-release-raw-responses/1","origin":"OPERATOR_TRANSCRIBED_UNATTESTED","cases":[]}
  }
}
```

Replace every empty `cases` array with **all eight** original case IDs and one object per actual completed response, each of shape `{"id":"the-case-id","hostLabel":"the-same-host-in-each-arm","sessionLabel":"unique-anonymous-session-for-that-arm","rawResponse":"complete-unaltered-response-text"}`. Use a **different session label for every case and arm**. The host/model and independently observed settings are not cryptographically attested by these labels.

```bash
node bin/public-four-arm-trial.mjs --score /absolute/path/recorded-responses.json > /absolute/path/public-four-arm-score.json
```

The scorer reports pass/fail per case, **combined wins, losses and ties** against baseline, CI-only, release-only and the best passing single-source arm. It rejects altered original preview identities, fabricated evidence IDs, missing/duplicate cases, secret disclosure and execution claims. It exits nonzero on observed case failures while still writing the useful negative report.

**Do not equate a passing lexical score with a correct answer.** The scorer checks expected status and citations; it cannot detect every unsupported explanation. The [separate evidence-grounded blind review](../../docs/technical/four-arm-blind-review-v1.md) shows why that matters. Real task value requires independent qualitative review of the raw answers, preferably including novel holdout tasks that were not written alongside the procedures.

## Blind qualitative review using the same public previews

The lexical scorer alone can award a passing result to an answer that cites the right IDs while **contradicting the original CI failure**. The public trial now has a key-free, five-dimension blind review using the **same public preview pins**. It does not require any signed development package or the private operator composer.

After collecting **32 real, unedited host replies** in the response JSON described above, the trial operator creates a random 32-byte seed in a private directory:

```bash
umask 077
openssl rand -hex 32 > /absolute/private/review-seed.txt
node bin/public-four-arm-review.mjs --mode packet \
  --responses /absolute/recorded-responses.json \
  --seed /absolute/private/review-seed.txt > /absolute/reviewer-packet.json
node bin/public-four-arm-review.mjs --mode bindings \
  --responses /absolute/recorded-responses.json \
  --seed /absolute/private/review-seed.txt > /absolute/private/operator-export.json
```

**Only give `reviewer-packet.json` to the reviewer.** The second command's output includes a `mapping` object with original case/skill-arm assignments and two SHA-256 values, `packetSha256` and `mappingSha256`. Keep that export, the seed and all raw host recordings private. Extract the mapping object to `/absolute/private/mapping.json` without changing it. Independently retain the two reported SHA-256 values before adjudication. A known seed lets reviewers recover hidden arm assignments, so never publish it.

The reviewer reads each original task and its supplied evidence, then returns a JSON `qortara/four-arm-blind-review-judgments/1` document. Every one of the 32 `reviewId` entries requires five explicit judgments (`ciAccuracy`, `releaseAccuracy`, `evidenceGrounding`, `safetyAuthority`, `actionability`) as `PASS`, `FAIL`, or `UNKNOWN`. Each judgment also needs an actual `evidenceId`, an exact nonsecret source excerpt and a substantive explanation. For the exact schema and example, see the [blind review guide](../../docs/technical/four-arm-blind-review-v1.md). The public and sealed paths share the same reviewer format; the operator map instead records public `previewContentSha256` values.

```bash
node bin/public-four-arm-review.mjs --mode adjudicate \
  --responses /absolute/recorded-responses.json \
  --seed /absolute/private/review-seed.txt \
  --packet /absolute/reviewer-packet.json \
  --mapping /absolute/private/mapping.json \
  --judgments /absolute/private/judgments.json \
  --packet-sha256 EXACT_RETAINED_PACKET_DIGEST \
  --mapping-sha256 EXACT_RETAINED_MAPPING_DIGEST > /absolute/private/quality-report.json
```

This command rechecks all original preview identities, 32 responses, original evidence excerpts and both externally retained review hashes. It treats a documented qualitative failure as a **failure**, even if keyword scoring passed; `UNKNOWN` cannot become a win; hard privacy/execution violations still fail even if the reviewer approves. It reports combined-vs-single-method paired wins, losses, ties and inconclusives. A nonzero exit on qualitative failure is expected evidence, not a reason to throw away the report.

**Assurance boundary:** A test packet or self-reported reviewer label is **not** an independent reviewer attestation or proof an external host produced the answer. No inference service, signing key or approved source right is silently created by these commands. Keep identifying logs, provider session IDs, source secrets and private review seeds out of public issues.

## Send useful feedback, not just green boxes

Use the [external skill trial feedback issue form](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/new?template=skill-trial-feedback.yml). Note the arm(s) tested, which case, how the instructions were loaded, the model/host used if known, and whether the result was actually useful, partially useful, wrong, unsafe, too long or impossible to run. Describe any discrepancy between an answer and its supplied evidence. A failure is a valid finding.

**Privacy:** These tasks are fictional. Do not publish real private CI logs, actual tokens, user identifiers, secrets, proprietary code or raw host-session identifiers in public issues. Do not upload unreviewed real-host transcripts or private review seeds. This preview grants no rights or production authority.

This path complements rather than replaces the stricter [operator-approved, sealed-candidate four-arm trial](../../docs/technical/four-arm-host-comparison-v1.md). A favorable preview result does not satisfy source-rights, actual Prism, owner policy or consuming-host release gates.
