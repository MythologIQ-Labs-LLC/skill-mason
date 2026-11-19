# CI Failure Triage v4: provenance, falsification and qualitative continuation

**Development-only candidate.** Source-pin v4 was authored on 2026-11-19 from the frozen v3 baseline. It does **not** overwrite v3, make a production rights claim, confer host authorization or replace Prism's P0 assurance.

## Product changes

- Revision binding is mandatory at the **top of the generated investigation**, including explicit `REQUESTED`, `LOG`, and `RELATION` values. Missing identity is `NOT_PROVIDED / UNVERIFIED`; mismatched identity is `MISMATCHED`. Neither status permits an exact-head recovery claim.
- Every independent blocker requires hypotheses A/B and a bounded discriminating check: what prerequisite is needed, what observation supports A, and what contrasting observation supports B. A generic rerun alone is not enough.
- Worked example distinguishes a missing installed tool from a valid executable outside `PATH`. Redaction, log-injection refusal, unexecuted-action declarations and lack of caller authority carry forward from v3.
- v4 is **explicitly selectable** through the existing first-party recipe/CLI, using its unique source digest and original source Git blob. Earlier method pins are unchanged.

## Evidence completed in this branch

1. Twelve **new synthetic** cases in [the independent input fixture](../../tests/fixtures/ci-triage-v4-novel-spectrum.json): missing revision, exact match, wrong-head mismatch, successful retry, independent Linux/Windows failures, ambiguous exit 137, private-registry 401, disk bytes versus inodes, TLS clock/chain ambiguity, multiline fake authorization, forged role instruction, and summary-only abstention.
2. Twelve **case-by-case written** analyses in [the emulation record](ci-triage-v4-direct-emulation-12.json). Every analysis has a revision binding, original-log citation, two plausible hypotheses, A/B conditional observations, a closure condition, and explicit `NOT_RUN` status. The split synthetic authorization values are redacted. The summary-only case abstains on root cause; the wrong-head case refuses to infer current-head status.
3. Source and evidence regression tests in [`ci_triage_v4_quality.test.mjs`](../../tests/ci_triage_v4_quality.test.mjs), including deliberately wrong revision relation, hallucinated citations, leaked token span, identical A/B branch and fabricated execution. These are deterministic contract controls, **not** independent expert adjudication.
4. The v3 frozen set remains [20/30 on its original strict rubric](ci-triage-v3-direct-emulation-review.md), plus [5/5 simple redaction canaries](ci-triage-v3-sensitive-canary-emulation.json). Do not retroactively regrade those cases with the successor's rubric or report 12/12 as a paired v3-to-v4 improvement.

## Token and quality economics

| Measurement | v3 | v4 | Interpretation |
| --- | ---: | ---: | --- |
| Original procedure UTF-8 bytes | 7,914 | 8,461 | +547 bytes (+6.91%); **not token usage** |
| Structured steps | 12 | 12 | A targeted replacement, not an extra gate |
| Model tokens used during this source edit and author-written emulation | **Not instrumented** | **Not instrumented** | Do not confuse authored instruction volume with inference-token metering |
| Prism deterministic assembly inference tokens | **Not instrumented end to end** | **Not instrumented end to end** | No causal claim of zero external inference from these artifacts |
| Downstream host prompt, completion tokens, latency | **No paired live comparison** | **No paired live comparison** | Net cost or savings remains `NOT_MEASURED` |

**Qualification interpretation:** 12/12 authored records meet the explicit v4 output contract in the repository tests if CI is green, but this cannot establish that other models will follow the procedure. The same author both authored and reviewed the answers and saw the expected outcome labels. Their correctness must be independently checked, preferably blind, on new cases. Even genuinely useful text can be a surprisingly expensive way to tell a model what commit it is reading.

## Next decisive behavioral test

Generate and seal a v4 Agent Skills candidate with the exact pinned P0 holo on the credential-free runner; capture the complete `SKILL.md` bytes and package receipt. Compare v3/v4 **on fresh unseen logs** using the same real model, same prompts, alternating arm order, no tool access, separate expert adjudication and provider-reported input/output tokens plus wall time. Measure explicit revision correctness, hallucination/unsafe disclosures, hypotheses with actual falsifiers, useful triage resolution, completion-gate honesty and token cost per materially correct answer. Do not promote the skill or claim model-independent transfer until that evidence exists.

**Trust state:** source-content pinned; original method rights, independent publisher identity, native-host behavior, full Prism authority and production adoption are `NOT_ESTABLISHED`. Issue [#1](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/1) remains open.
