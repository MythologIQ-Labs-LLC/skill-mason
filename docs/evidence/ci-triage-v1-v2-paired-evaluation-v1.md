# CI Failure Triage: generated v1 versus v2, paired behavioral acceptance

**Status (2026-11-19):** both versions **really generated and sealed** by pinned original Prism P0; **live model comparison not yet run**. This experiment measures behavior, not source-authorization or production admission. [Generator milestone #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17) remains open.

## Two actual Skill Mason outputs, not handwritten alternatives

Both packages come from [real Prism request generation run #44574297023](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44574297023), artifact ID `14556620721`. The source and 5-file disk seal of **each** are verified by `readPackage()` and its exact independent digest before any model call.

| | v1 original | v2 revised method |
| --- | --- | --- |
| Exact `SKILL.md` SHA-256 | `92fda9597af84d89b11415d6a86f4b7e6317d6a99ab90d496e8039d115c952a1` | `25b74b564861e72b3d2e63060177d39e35c995875c589976f2b1fa401b3ef714` |
| Original method SHA-256 | `9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47` | `0b3350725eee7c5ef8c6d7bff5db7538ba546a8597c35c601499c85434cbe2c1` |
| Git source commit | `87a6a5965a25af95a50127f26ec5afb404e0f2b8` | `ef8bd8046df65ca2a7419a7191f8f2e959d53156` |
| Exact generated package manifest SHA-256 | `877c30b5abcc65cc8b09c03c0ca677f9f4956e7c5885548e2b96962ac8cfc2fd` | `a950f740323450ffff774d286435fe1ef7ad247dfbe24fab8ead88d2fe6a4c5d` |
| Generated instruction bytes | 2,913 | 7,145 |
| Trust status | Synthetic P0, unqualified | Synthetic P0, unqualified |

The v2 instruction content is approximately **2.45× larger**. Whether the extra prompt tokens are worthwhile is part of the question. Passing CI or having a longer procedure does not answer it.

## Comparative design

The [fixed 30-case spectrum](../../tests/fixtures/ci-triage-quality-spectrum-v2.json) has six examples in each of five groups: language/build, dependencies/environment, runner/infrastructure, execution ordering, and adversarial/integrity. Both arms use the **same model, parameters, user request/log and minimal JSON-only response contract**, with per-case arm order alternated. The extra host trust/safety directions supplied by the original four-case harness are **removed** so that the skill itself must supply those behaviors. Each model is given **no external tools or repository access**.

The [paired evaluator](../../bin/ci-triage-v1-v2-compare.mjs) records all 60 raw outputs, per-case checks, error flags, source and instruction digests, token usage and wall-clock latency. Its deterministic judge checks six minimum dimensions: exact supplied-log evidence, first failing step(s), calibrated uncertainty/abstention, discriminating next check, observed completion criteria and no dangerous/fabricated action claims.

**Decision gates declared before live execution:**

- **Candidate improvement:** v2 scores at least **five additional passing tasks out of 30** over v1, with no increased unsafe-log obedience, evidence fabrication, unauthorized action claims or regression on mandatory abstentions. Inspect per-group scores and paired win/loss cases rather than only aggregate pass rates.
- **Cost:** Measure v1/v2 prompt/completion tokens and wall-clock time. If the additional instruction length increases cost without a corresponding useful quality gain, **NO-GO** for replacing v1.
- **Human qualitative review:** Independently examine the full raw outputs, preferably blind to version, for technical accuracy, hypothesis discrimination and practical usefulness. Regex/substring scoring can be gamed or reject reasonable phrasing and cannot establish semantic correctness.
- **Confidence:** This is a small author-labeled sample with one response per arm and no independent gold adjudication. Even a positive result is a **promising development finding**, not proof of generalization or host product admission. Repeat independent/real incident trials before release.

The same case is scored pairwise. `scoreSpectrum()` failing is an observed task deficiency, **not a CI execution error**. Only corrupted source/artifact provenance or broken evaluation mechanics should make PR CI red.

## Running it

The new [paired-quality workflow](../../.github/workflows/ci-triage-v1-v2-pair.yml) runs cheap contract and exact original package checks on PRs, **no model calls**. Its actual-model job runs **only** when explicitly launched using GitHub Actions `workflow_dispatch`, with an approved model, explicit consent text `COMPARE_60_HOST_CALLS` and the repository secret `SKILL_MASON_HOST_OPENAI_API_KEY`. Neither the GitHub source-download token nor repository credentials are passed into the model evaluation job.

The model phase is limited to **60 calls**, 30 tasks by two arms. Failures and partial outputs are retained as private GitHub Actions artifacts where possible. The underlying test logs are synthetic, but API responses are real if the configured provider actually responds. The presence of a model ID and a test pass still does not provide cryptographic host attestation.

**Qualified skill status remains NO-GO:** method rights not independently accepted, Prism positive facts are P0 synthetic, the native agent host has not installed the skill, and zero model tokens during **compiler assembly** remain uninstrumented end-to-end. This workflow cannot change any of those flags.

## Current grounded qualitative comparison (instruction coverage, not model outcomes)

- **v1**: correctly prescribes identifying the first failed check, quoting an error line, distinguishing hypotheses and proposing verification. It does not directly address stale source revisions, complex job graphs, retries, explicit log injection or non-causal infrastructure failures.
- **v2**: explicitly handles those categories in authored procedure steps 1 through 9 and outputs separate facts, unknowns, and verification requirements. This is materially broader **instruction coverage**, but whether a consuming model follows those instructions or benefits from their length **is unmeasured**.
- **Known evaluator limitation**: requiring exact substrings may penalize semantically correct paraphrases or overlook subtly wrong inferences. The qualitative review must re-examine each apparent difference using actual log lines and response texts.

**Next action:** execute the owner-authorized model comparison and adjudicate the actual outputs. Do not label simulated judge tests as execution of the skills in ChatGPT/Claude.
