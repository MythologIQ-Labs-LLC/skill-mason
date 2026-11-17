---
name: prism-proof-audit
description: Verify whether Skill Mason has genuinely produced and independently checked a model-first Prism application, using pinned PrismPM and template acceptance gates, negative controls and exact artifact receipts.
---

# Prism application proof and qualification

**Claude Code developer procedure only.** Not a Skill Mason output skill, not an upstream `skillz` catalog item, and not an independent source of release authority.

## Preconditions

Run/read `prism-source-gate` and `prism-model-first`, then inspect the actual adopted template's `Justfile`, `prismpm.lock`, `TEMPLATE-CONTRACT.md`, `AGENTS.md` and the pinned PrismPM `SPEC.md`. If those files were not actually adopted into Skill Mason and validated, the commands below are *upstream reference commands*, not runnable project gates.

## The actual upstream distinctions

- PrismPM `check`: model/snapshot validation, **not** proof of an app's output.
- PrismPM `build`: generates artifacts but **does not issue an acceptance claim**.
- PrismPM `verify`: only stage permitted by the inspected PrismPM specification to issue a `prismpm/application-acceptance/1` artifact, subject to exact supported toolchain.
- Upstream template's `just vv`: full acceptance recipe combining formatting, model checks, SDK template/lock checks, Clippy, tests, dependency policy and actual app verification.
- Upstream template `just app`: executes `prismpm --project app verify` in the declared application path, using the **selected digest-pinned SDK image** and appropriate proof reuse restrictions.
- Independent checking of `.holo` with `prism-code` is described in the UOR template README; **actual binary/API, version and verification command must still be verified and executed** before making a standalone independent replay claim.

## Execution workflow

1. Prove environment and source identity: exact Skill Mason commit, template/PrismPM/LexLean pins, SDK manifest digest, architecture and platform, installed binaries' versions and observed command help. Verify `prismpm.lock` and `standards.lock` through their supported authentic SDK route.
2. Run a **known-good upstream reference case** in the pinned environment first, showing a real app verification. Keep its output/receipt, and keep upstream feasibility separate from success of the new Skill Mason model.
3. Run the adopted Skill Mason `just vv` full gate (or the exact upstream-supported equivalent after an explicit integration decision). Do not reduce the gate to `cargo test`, `prism_model!`, an SDK import check, or a mocked verification response. Capture each step's exit status.
4. Confirm a real `prismpm verify` result, generated model and guest identities, and exact artifact hashes. Distinguish: source syntax check, source build, Lean proof, PrismPM application-acceptance, independent holo inspection, behavioral acceptance in a consuming host.
5. Plant and observe meaningful **negative controls**: uncovered essential outcome, rights refused, unauthorized side effect, tampered model/artifact or wrong source pin, and one broken proof or acceptance-vector binding. Verify each is refused by the **specific claimed gate** rather than an unrelated parse error.
6. Independently replay the emitted exact-version artifact/receipt using the supported verifier. If a verifier is unavailable or the replay fails, report `NOT_RUN` / `FAIL`; never label it independently verified.
7. Run the deterministic build twice on identical pinned inputs; compare actual canonical output bytes, identity hashes and decision traces. Instrument actual model-inference calls separately; a controlled offline build can support a zero-inference claim **only** for the path actually tested.
8. Record any host consuming the skill as a **separate observational claim**. A valid formal decision does not imply the instructions are effective, safe in every context, or free of downstream inference tokens.
9. Keep proof/verification outputs as exact revision-bound artifacts in an authorized evidence location. Do not write or manually change Qortara `.qortara/shadow.jsonl` or fake `ledger.jsonl` gate records. Use the canonical Qortara runtime for actual governed activity.

## Qualification report

| Item | Status and exact evidence |
| --- | --- |
| Source and SDK pins | exact full SHA, digest and tool versions |
| UOR reference application | PASS/FAIL/NOT_RUN, commands and receipts |
| Skill Mason model and scenarios | IDs, model files, test results |
| PrismPM check/build/verify | each actual stage, no inferred success |
| Lean proof / acceptance scope | exact propositions and verified roots only |
| Independent holo replay | verified verifier, manifest and digest or NOT_RUN |
| Positive and adversarial controls | tested target gates, not just CI green |
| Zero-inference build | measured calls/tokens; downstream excluded |
| Unverified or failing capabilities | explicit blockers and follow-on issues |

**HOLD** merge, release, `Prism-built` and `zero-token generator` claims until the exact required gates and owner acceptance are satisfied. No arbitrary implementation substitute makes an unavailable SDK pass.
