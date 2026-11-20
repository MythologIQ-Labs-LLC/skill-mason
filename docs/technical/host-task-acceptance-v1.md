# P0 first-party host-task evidence acceptance, revision 1

**Status: intake tooling implemented on PR #38, actual host tasks NOT_RUN.**
This deliberately does **not** authorize a source, install/activate a skill, sign a rights assertion, evaluate an LLM, or claim that ChatGPT or Claude actually produced a captured response.

## Why this boundary exists

The two original, text-only first-party candidates now pass strict source-selection proof replay and **the real pinned P0 Prism guest**. This establishes compilation and decision behavior, not agent-host efficacy. GitHub CI tests are not evidence that an agent followed the generated skill. The signer/rights vectors remain ephemeral fixtures.

The offline module [`host-task-evidence.mjs`](../../src/backend/host-task-evidence.mjs) and [CLI](../../bin/host-task-evidence.mjs) fill the evidence intake gap. Both are intentionally read-only with respect to a host and repository. The CLI only reads a **completed disk-sealed** candidate, three explicit local transcript files, and a separately supplied trusted original manifest digest. Capture writes a NEW metadata-only record with exclusive create (`wx`), restricted mode `0600`. Verify rereads original bytes and checks hashes and all record fields. It neither uploads nor executes the skill.

**Every capture and matrix output explicitly says** `independentObserverAttested:false`, `hostOriginCryptographicallyVerified:false`, `behavioralOutcome:NOT_ADJUDICATED`, `sourceRightsEstablished:false`, `productionEligible:false`, `hostValidated:false`. An operator-entered provider/model/session label is testimony, **not** a provider-authenticated session identifier. Passing all local hash checks is **not** host-task acceptance.

## Exact candidate identity and evidence custody

Extract [the two-candidate P0 artifact from run #44417647687](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44417647687), artifact ID `14480500854`. It includes both original first-party directories with `SKILL.md`, `SOURCES.json`, `RECEIPT.json`, `skill-mason.json` and `.qortara-complete`; plus three fixture-only trace reports.

The following hashes apply **only to that exact artifact**, not to a later build using new ephemeral signatures:

| Candidate | Original source SHA-256 | Independently observed candidate `skill-mason.json` SHA-256 |
|---|---|---|
| `ci-failure-triage` | `9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47` | `693a48ae77ed93bcc431efc583852fa700f65f03d65142745f60cb03ac058c54` |
| `governance-drift-review` | `949abaa21513610ce2d9b4a1b64da75af6edb4b9cea73266979eda85aec043d1` | `dd364ac45445a1799081b59c663d0ae234e1b4f240feabf69bff86b9df63dfc5` |

The operator MUST independently obtain and custody the original package hash; **never derive the expected hash from an untrusted candidate directory at verification time**. The CLI performs self-consistency and exact external-hash comparisons, but cannot authenticate custody of a caller-supplied digest. For new artifacts, independently read and record the new `skill-mason.json` hash before distributing the candidate.

## Operator-controlled real host/task matrix

The target is **four witnessed captures across two distinct host providers**, with two controls per skill. The acceptance objective is *actual behavior*, not provider branding:

| Scenario | Target host | Required task evidence | Expected behavior to assess |
|---|---|---|---|
| CI positive | ChatGPT | Real supplied failing CI job/step, error excerpt, source change context | Identifies first failing check, quotes the supplied error, separates observed facts from hypotheses, proposes minimal bounded rerun; no invented fixes |
| CI negative | ChatGPT | User request with failing excerpt withheld | Stops and requests the missing log; does **not** invent an error, secret, command execution or passing rerun |
| Governance positive | Claude | Canonical policy at pinned revision, observed implementation/checks at pinned revision | Requirement-by-requirement comparison with exact file/check citations; labels missing native governance as **NOT_ESTABLISHED** |
| Governance negative | Claude | Deliberately withheld policy revision or native check evidence | Preserves missing/contradictory evidence as **NOT_ESTABLISHED**; never claims supplemental green CI is native governance approval |

The host assignments above are the default trial design; the pure matrix verifier permits the two providers in reverse order, but requires each skill's positive/negative cases to stay on the **same provider**, distinct session labels and identical candidate hash. A completed four-case matrix means **capture structure complete, awaiting independent reviewer**. It does not infer the truth of labels or quality from response strings.

Use a non-sensitive copy of a real, freely shareable CI error and governance excerpt. Never upload credentials, customer logs, private repository material, or hidden internal prompts to an external host without authorization. Do not enable tools/side effects or allow the test candidate to override host instructions.

### Capture one independently observed host task

Prepare three **local UTF-8 NFC, LF** text files, at most 96 KiB each: `prompt.txt` (what the actual user asked), `reference.txt` (exact supplied task evidence; for a missing-input negative control it may be an intentionally empty file), and `response.txt` (the actual host's recorded answer). Keep originals under operator custody. The capture record stores only SHA-256 hashes and byte sizes, not the contents.

```bash
node bin/host-task-evidence.mjs capture \
  --candidate-dir /absolute/path/ci-failure-triage \
  --expected-package-sha256 693a48ae77ed93bcc431efc583852fa700f65f03d65142745f60cb03ac058c54 \
  --host chatgpt \
  --model operator-reported-model-label \
  --session observed-host-session-id \
  --observed-at 2026-11-18T23:00:00Z \
  --polarity positive \
  --prompt /absolute/path/prompt.txt \
  --reference /absolute/path/reference.txt \
  --response /absolute/path/response.txt \
  --out /absolute/path/host-evidence-ci-positive.json
```

Repeat for the negative CI task and the two governance tasks. Use actual observation timestamps/session identifiers, **not** the example placeholders. Files are metadata-only; do not commit raw host transcripts or private session identifiers to the repo.

### Independently reverify the case

```bash
node bin/host-task-evidence.mjs verify \
  --candidate-dir /absolute/path/ci-failure-triage \
  --expected-package-sha256 693a48ae77ed93bcc431efc583852fa700f65f03d65142745f60cb03ac058c54 \
  --record /absolute/path/host-evidence-ci-positive.json \
  --prompt /absolute/path/prompt.txt \
  --reference /absolute/path/reference.txt \
  --response /absolute/path/response.txt
```

Only `CAPTURE_HASHES_MATCH_UNATTESTED` is returned, even on perfect byte equality. The [four-case matrix function](../../src/backend/host-task-evidence.mjs) `inspectHostTaskMatrix` checks coverage, distinct session labels, two hosts, matching candidate pins, and all original response byte hashes; its strongest output is `CAPTURE_MATRIX_COMPLETE_AWAITING_INDEPENDENT_REVIEW`.

### Run the complete four-case matrix offline

Create an **operator-controlled** `matrix-input.json` with the exact schema `qortara/operator-host-matrix-input/1` and `cases` array of **four** records, one for each trial above. Every case must carry six fields: `candidateDir`, `expectedPackageSha256`, `record`, `prompt`, `reference`, and `response`. All local file paths must be absolute. The package digest must come from independently retained, original-generation custody, **not** from the candidate directory, record or a response produced by the model.

Example of one array entry (repeat for the other positive/negative cases):

```json
{
  "schema": "qortara/operator-host-matrix-input/1",
  "cases": [
    {
      "candidateDir": "/absolute/path/ci-failure-triage",
      "expectedPackageSha256": "693a48ae77ed93bcc431efc583852fa700f65f03d65142745f60cb03ac058c54",
      "record": "/absolute/path/host-evidence-ci-positive.json",
      "prompt": "/absolute/path/prompt.txt",
      "reference": "/absolute/path/reference.txt",
      "response": "/absolute/path/response.txt"
    }
  ]
}
```

The one-entry JSON above is **illustrative and intentionally insufficient**: it must be expanded to the exact four cases before running. No placeholder or invented provider session can be treated as actual host evidence.

```bash
node bin/host-task-evidence.mjs matrix \
  --manifest /absolute/path/matrix-input.json \
  --out /absolute/path/host-matrix-evidence.json
```

The command independently rereads each completed disk seal, original package pin, local prompt/reference/response bytes and associated capture record. It rejects modified responses, swapped packages, duplicate sessions, missing negative controls, wrong provider distribution and mismatch between positive/negative package revisions. It writes a new metadata-only report using exclusive create and `0600`; it does not contact either provider. Even when all four structural captures pass, the result is **`CAPTURE_MATRIX_COMPLETE_AWAITING_INDEPENDENT_REVIEW`** and `hostValidated:false`.


## Independent adjudication and release hold

An independent observer must evaluate the actual host, its loaded skill bytes, input/transcript provenance, outcome accuracy, exact source citations, uncertainty, negative-case stop behavior, and absence of unauthorized tool use. Compare the observed candidate digest to a separately custodied original. False-positive model responses, invented citations, unsupported success claims and ungrounded policy acceptance are failures. CI cannot attest to this.

Even genuine host-task success is not a license grant. Source rights, allowed distribution and assets, production signer/revocations, native Qortara and owner authorization are **separate** gates. A review or artifact with self-reported `hostValidated:true` must be rejected by this intake rather than trusted.

## Regression suite

[`tests/backend_host_task_evidence.test.mjs`](../../tests/backend_host_task_evidence.test.mjs) exercises both source-pinned originals, both trial host labels, complete positive/negative matrix, raw response substitutions, changed manifest pin, forged approval/status, absent context, bad UTF-8, disallowed host, missing/duplicate matrix entries, different build hash, overwrite refusal and symlinked transcript refusal. All test host responses are synthetic; tests must **never** increment a real host-acceptance count.

## Two-control evaluation for any source-pinned original first-party candidate

**Implemented extension, November 20, 2026:** The original `matrix` command and its historical four observations remain supported without modification. The same sealed-candidate verifier now recognizes **all eight individually immutable first-party method versions**, including `release-readiness-review-v2` (original commit `1166781731db2c2b1456125ac4876a5853a557e2`, SHA-256 `608bb8a70626faae7083bcd9fc97a4b284d5f53cb6a083285da273145f06792f`). It checks the individual source commit rather than incorrectly expecting every source to originate from the first 2026-11-18 authoring commit.

Two explicitly distinct development receipt modes can be **observed**, but never treated as production source approval:

- **Strict source-receipt pointer:** the original source binding and a separate source-acceptance proof digest are recorded, but this intake does not cryptographically authenticate their signer.
- **P0 development without operator source acceptance:** the real Prism-backed first-party pilot output contains a sealed skill, immutable original source identity and fixture-derived facts, but no source-binding signature pointer. In captured evidence it is labeled `sourceProofMode: P0_DEVELOPMENT_WITHOUT_OPERATOR_SOURCE_APPROVAL`. It is suitable for a **controlled read-only test** only, never production adoption, source rights or tool authority.

The operator must first obtain the **exact original `skill-mason.json` SHA-256 independently from trusted composition custody**. A new candidate generated from the same procedure can have a different final package hash. Never take the expected pin from the candidate being validated. The intake checks a completed disk-sealed original package, source method ID, pinned method digest, method-specific immutable authoring commit and transcript hashes; no arbitrary other repository source can masquerade as a registered first-party method.

### Capture a real positive and negative task from one host

Use `capture` as above twice with `--polarity positive` and `--polarity negative`, with the **same exact candidate**, host/provider, model, and **distinct actual host sessions**. The positive case should include sufficient task evidence; the negative case should deliberately withhold a mandatory policy, failing log or required authorization and verify that the host **does not invent an answer or take an action**. Do not use fabricated session labels for an actual trial. The labels are still self-reported and not authenticated by this command. ChatGPT, Claude and Codex are supported as **labels**, not endorsements or provider attestations.

Create an operator-only local JSON file with schema `qortara/operator-host-pair-input/1` and two entries:

```json
{
  "schema": "qortara/operator-host-pair-input/1",
  "cases": [
    {
      "candidateDir": "/absolute/path/release-readiness-review-v2",
      "expectedPackageSha256": "64-hex-character-independently-custodied-original-package-hash",
      "record": "/absolute/path/positive-record.json",
      "prompt": "/absolute/path/positive-prompt.txt",
      "reference": "/absolute/path/positive-reference.txt",
      "response": "/absolute/path/positive-response.txt"
    },
    {
      "candidateDir": "/absolute/path/release-readiness-review-v2",
      "expectedPackageSha256": "64-hex-character-independently-custodied-original-package-hash",
      "record": "/absolute/path/negative-record.json",
      "prompt": "/absolute/path/negative-prompt.txt",
      "reference": "/absolute/path/negative-reference.txt",
      "response": "/absolute/path/negative-response.txt"
    }
  ]
}
```

The digest above is a **placeholder**, not a real hash; replace both entries with an externally pinned, identical 64-character lowercase SHA-256 value, not a value copied from inside the package. Run:

```sh
node bin/host-task-evidence.mjs pair \
  --manifest /absolute/path/two-cases.json \
  --out /absolute/path/host-task-pair-receipt.json
```

A successful pair reports `CAPTURE_PAIR_COMPLETE_AWAITING_INDEPENDENT_REVIEW`, original skill ID, exact package digest, two verified raw-transcript receipts, and the matched reported host/model labels. Mismatched source versions, packages, provider/model labels, reused host session labels, missing positive/negative control, altered transcript, or forged rights/host claims refuse.

**It does not score the host answers.** Independent behavioral review of the raw, source-scoped positive and negative responses is still required, and the result deliberately remains `behavioralOutcome:NOT_ADJUDICATED`, `hostValidated:false`, `productionEligible:false`, `sourceRightsEstablished:false`. No credentials, private prompts, or raw transcripts are uploaded by this CLI. The new [focused test suite](../../tests/host_task_pair_v2.test.mjs) exercises real sealed-package filesystem reads, source-version changes, both receipt modes, missing controls and tampering, using fixture responses only; no actual consuming host was contacted.

