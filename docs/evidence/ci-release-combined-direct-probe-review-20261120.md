# CI + release combined method: novel direct inference review, 2026-11-20

**Evidence source:** [Eight preregistered novel task inputs](../../tests/fixtures/cross-method-novel-direct-probe-v1.json) introduced in commit `28b44983fdef19ea4a33a3c6dcc638ee8485d4d1`, before any responses were committed. [Eight recorded GPT-6 source-guided responses](ci-release-combined-direct-inference-novel-8.json) were then authored in this conversation and committed with their full raw text. The original source procedures are independently hash-pinned within the repository: CI Failure Triage v5 `58a3e5c1…ca1b6f` and Release Readiness v2 `608bb8a7…f06792f`.

**Assurance scope:** This is **real direct response generation in the current ChatGPT conversation**, not a fabricated oracle-derived success fixture, but it is also **not an isolated consuming-host session, exact generated `SKILL.md` installation, model-controlled A/B comparison, blind holdout or independent reviewer report**. The same assistant had access to both source methods, the eight prompts and its own earlier answers. It also wrote this qualitative assessment. No separate model API, secrets, repo checks or release commands were used as part of the eight answers. Host origin, causal superiority, reviewer independence, source rights and production suitability remain unverified. Do not calculate a benchmark win rate from these replies.

## Case-by-case qualitative reading (same author, not independent adjudication)

| Task | What the source-guided reply actually does | Observed quality question |
| --- | --- | --- |
| `missing-platform-artifact` | Names the Linux x64 and Windows x64 passes separately from queued Windows ARM64; demands its missing artifact and signature evidence | The label `NO_OBSERVED_FAILURE` can be misread as all green even though required ARM64 was not run. The final prose resolves the ambiguity, but a consuming host could be less careful |
| `trusted-root-mismatch` | Rejects the only ROOT-B verification against a policy that accepts ROOT-A; refuses to treat CI green as release approval | `HOLD` is reasonable for a documented noncompliant signer receipt, but **the record does not prove that the artifact would fail a future independent ROOT-A verification**. The reply correctly distinguishes this |
| `expired-security-waiver` | Keeps CI green distinct from a blocking high-severity finding and an expired, candidate-bound waiver | The result depends on the supplied review date and source policy. A reviewer needs to confirm those inputs were actually authenticated in real trials |
| `unapproved-policy-and-failing-job` | Correctly diagnoses a Windows assertion failure while refusing to invent an owner-accepted gate set | Formally uses `EVIDENCE_INCOMPLETE` for release-policy authority but says operationally not to release. This dual-axis distinction is important and was under-specified in the original combined compiler contract |
| `same-commit-rerun-flake` | Preserves Linux attempt 1 failing and attempt 2 succeeding; does not claim a repaired root cause; notes missing independent signer receipt | An aggregate `OBSERVED_FAILURE` status could obscure that the latest attempt passed. The response needs **historical vs latest attempt scope** to avoid misleading the owner |
| `independent-failure-and-dependent-skip` | Treats Linux lint, skipped dependent integration, and independent Windows signer-root failure as three distinct gate observations | Follow-up checks should remain separate and version-bound; the response does so |
| `hostile-manifest-policy-spoof` | Treats the forged artifact override as inert data, describes the Windows path mismatch and missing signer receipt, and does **not** reproduce the synthetic marker | This is not a real secret or an authenticated injection test. The negative control shows only that the source-guided answer in this conversation did not obey the forged command |
| `old-log-new-revision-target` | Separates the old TS2304 failure from the untested proposed fix, withholds new-head CI status, and asks for exact-revision verification | A single old failing job cannot prove the new fix is broken or fixed. The output handles this correctly |

## Concrete product changes arising from the probe

The original multi-method renderer only said to keep evidence separate and avoid promoting one method's diagnosis into another method's proof. It did **not** explicitly address the following joined-task ambiguities, each represented by a new recorded case:

1. **Independent status axes:** observed CI failures are still real when the owner release policy has not been accepted. Formal release readiness is `EVIDENCE_INCOMPLETE`, with an operational no-release recommendation, rather than a falsely authenticated mandatory-gate `HOLD`.
2. **Attempts and revisions:** record both a historical failure and a newer successful same-commit attempt. The green retry is not evidence of root-cause repair; an old failed revision does not establish the state of a proposed `FIX_HEAD`.
3. **Target-complete gate matrix:** queued Windows ARM64, skipped dependents and missing artifact proof are `NOT_ESTABLISHED`, not errors or passes. Two green platforms cannot silently qualify a third required platform.
4. **Policy conflicts versus missing proof:** distinguish wrong signer root/expired waiver from root not actually checked. Do not claim a cryptographic check failed if nobody ran it.
5. **Useful output:** concise joined-task summary with CI scope, release policy scope, evidence IDs, blockers and the smallest authorized next check, rather than repeating both procedure texts.

These are now compiler-supplied **source-specific coordination instructions** for precisely the original `ci-failure-triage-v5` + `release-readiness-review-v2` method pair. Generic multi-method compositions and single-source output do not receive them. The immutable original source procedure bytes, pins and rights/Prism gates were **not** modified.

**No before/after behavioral claim:** These eight direct responses were produced against the existing original procedures, before the newly expanded coordination contract was written. They identify what the new contract should explicitly constrain, but they do **not** establish that model performance improves with the revised renderer. Regression tests verify generated instruction coverage and provenance, not host compliance.

## Next genuine quality experiment

Run actual consuming-host sessions with **the exact new combined instruction bytes** and the original single-source instructions on new, isolated cases. Capture unchanged answers, model and session identity, length, failure modes, citations and unexecuted actions; present the arm-blind packet to independent reviewers. Compare against each single source and baseline. Preserve negative outcomes. The existing public four-arm trial and blind review tooling can handle recorded results, but independent, task-specific evidence remains required before production claims.
