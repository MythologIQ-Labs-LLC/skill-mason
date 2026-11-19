# First qualified skill milestone: original CI failure triage

**Status:** real qualification attempt, not automatically approved. [Generator issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17) remains open until the complete chain is independently evidenced.

## Skill chosen

Original first-party procedure [`ci-failure-triage`](../../pilots/first-party/ci-failure-triage/procedure.json), introduced by the repository owner on commit `87a6a5965a25af95a50127f26ec5afb404e0f2b8` on 2026-11-18. Historical Git blob `23bd3a94a3da68996f406892dcbb94be247a6db9`; SHA-256 `9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47`. It covers evidence-grounded diagnosis and next verification for supplied CI logs; **no execution, network, secrets, fixes, or unverified conclusions**.

The existing deterministic source-pinned P0 composer successfully generated a sealed Agent Skills candidate for this original procedure in [real Prism run #44333394001](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44333394001), artifact `real-prism-p0-candidate-pilot` ID `14438994926`, ZIP SHA-256 `099bae0715c04add74eb144748f479095a9bd18f6be5c5863d355cc4f8b1d383`. That build executed **real** Prism P0 policy guest but used **synthetic ephemeral evidence/rights/authority signatures**. It is therefore a **DEVELOPMENT_CANDIDATE**, not legally or production-qualified.

## New end-to-end behavioral acceptance

The [four fixed, synthetic task cases](../../tests/fixtures/ci-triage-agent-host-cases-v1.json) exercise:

1. Identify a genuine first failing lint step, not downstream skipped tests.
2. Abstain and request evidence when a failing job lacks its error lines.
3. Resist instruction injection embedded in an untrusted install-error log, without following or executing the attack.
4. Distinguish passed build/package from failed deployment, and avoid a verified-fix claim.

The [real-host harness](../../bin/ci-triage-live-host-test.mjs) **reads the original complete disk-sealed generated package using `readPackage`**. It will reject missing/symlinked/tampered manifests, receipt, source or completion-seal bytes *before any host API call*. It then sends each synthetic CI task to the chosen text-only model as **two separately measured arms**, one baseline and one with the complete generated `SKILL.md`. Calls provide no tools, credentials from the CI logs or repository access. The scorer requires an exact log-line citation, correct first-failure/abstention behavior, explicitly uncertain causes, proposed (not executed) verification, completion criteria and zero claimed actions.

The judge is deterministic and limited, **not an independent human adjudication or general assurance that the diagnosis is correct**. Model responses are retained for adversarial review. A positive task result is downstream **host behavior**, never evidence that the compiler invoked zero model tokens, that original content is licensed, that Prism P2 passed, or that the host natively installed a skill.

### Running actual host acceptance

1. Independently review the source rights and authorize distribution/host use for the specific first-party method and version. This repository has no root LICENSE; the Git author identity is useful provenance, not a public reuse license.
2. Configure owner-controlled repository secret `SKILL_MASON_HOST_OPENAI_API_KEY` with a suitable credential, and choose a supported, explicitly authorized OpenAI model. **Do not add a key to the repository, PR comments or job logs.**
3. From the default branch use **Actions → First Skill CI triage host acceptance → Run workflow**, providing the model ID. Only this explicit `workflow_dispatch` can invoke the real host. It requires the immutable original artifact ID `14438994926` and independently checks the recorded ZIP SHA-256 before loading the sealed package. If GitHub artifact retention has expired or a different artifact is supplied, it **fails closed** pending review/re-pin.
4. Inspect the downloaded `first-skill-ci-triage-host-observations` artifact: exact model/request IDs, raw synthetic task responses, per-case errors, input and generated package SHA-256, downstream token use, baseline vs skill scores. A missing key, unsupported model, provider error, malformed JSON, failed task, or failed artifact integrity cannot be labeled a qualified host pass.

The API calls are optional, limited to eight chat completions (4 cases × 2 arms), with no recurring schedule, no third-party NPM dependency and no full SDK gate on unrelated changes. Model inference occurs **during consuming-host evaluation**, not deterministic compiler assembly; it must not be conflated with the build token metric.

The PR event runs **only the local mock host-contract and exact first-party composer tests**, which explicitly mark `TEST_DOUBLE_NO_HOST_OBSERVATION` and cannot report a real host success. A real live run records `LIVE_HOST_RESPONSES_OBSERVED`, but its result remains `productionEligible:false`, `legalReuseQualified:false`, and `hostInstalledSkill:false` until separate, genuinely accepted evidence exists.

## Actual milestone completion gates

| Gate | Current evidence | Completion boundary |
| --- | --- | --- |
| Original method byte identity | Verified historical Git blob, SHA-256 and original owner commit | Revalidate exact original bytes at accepted pin |
| Rights and asset use | No third-party assets in this bounded procedure, but **no independently owner-approved reuse grant** | Owner accepts explicit first-party rights for target host/use |
| Real Prism model decision | Actual P0 guest passed, but facts were synthetic and SDK publisher trust remains on HOLD | Independently sourced, signed four facts and approved trust root with actual P0/higher host policy |
| Deterministic sealed package | Actual development candidate complete; disk readback and identity checked | Independent replay against real accepted source/rights facts |
| Consumer-agent behavior | New hard-case A/B harness exists; **live-host result not yet observed** | Real model execution, full raw response record, task outcomes pass with no unauthorized claims |
| Build inference instrumentation | **Not independently measured for the qualified build** | Measure zero inference in deterministic assembly separately from consuming agent inference |

**Do not declare first skill qualified until these are verified.** For right-now progress, this adds the missing executable *real host outcome* measurement, rather than another refusal-only source checker.
