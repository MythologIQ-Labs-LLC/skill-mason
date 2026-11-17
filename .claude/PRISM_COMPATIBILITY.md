# Prism application version compatibility and authoring decision

**Status:** DEVELOPMENT RESEARCH, **NOT_EXECUTED**, recorded 2026-11-17.
**Authoritative work item:** [Skill Mason issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) and [RFC-0001](../docs/RFC-0001-prism-feasibility.md).
**Upstream docs issue and source-locked proposed correction:** [PrismPM #718](https://github.com/UOR-Foundation/PrismPM/issues/718).

## Why this check exists

The exact [PrismPM source pin](https://github.com/UOR-Foundation/PrismPM/tree/d896ab59e287650aecbcf02b8e867121601fdde5) contains docs for **different authoring generations**. The normative `SPEC.md` and `README.md` describe a closed `.lex.tex` source graph, while pages tagged `available_in: "0.6"` describe `prism/spec.json`; the quickstart tagged `available_in: "1.0-beta"` uses the `prism` CLI. These should not be mixed as one simultaneously supported toolchain.

| Route | Exact source and inspected behavior | Status/evidence | Do NOT assume |
| --- | --- | --- | --- |
| **A. UOR template / PrismPM candidate** | [template@`b64cc73`](https://github.com/UOR-Foundation/template/tree/b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b) `AGENTS.md`, `Justfile`, `app/src/Contract.lex.tex`; [PrismPM@`d896ab5`](https://github.com/UOR-Foundation/PrismPM/blob/d896ab59e287650aecbcf02b8e867121601fdde5/SPEC.md) | A model-authored `.lex.tex` route with model IDs, scenario, tests, digest-selected SDK and `just vv` gate is described at these pins. **Toolchain/SDK and Skill Mason integration: NOT_RUN; upstream 0.4.0 production release not accepted per README/RELEASE-STATUS.** | That the template files can be copied selectively, that `just vv` has passed for Skill Mason, or that `prism/spec.json` belongs to this candidate |
| **B. JSON decision-app authoring guide** | [write-the-model](https://github.com/UOR-Foundation/PrismPM/blob/d896ab59e287650aecbcf02b8e867121601fdde5/docs/site/guides/write-the-model.md), [write-from-examples](https://github.com/UOR-Foundation/PrismPM/blob/d896ab59e287650aecbcf02b8e867121601fdde5/docs/site/guides/write-from-examples.md), `available_in: "0.6"`; [Prism-DevRel builder](https://github.com/afflom/prism-devrel/blob/ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc/builder/prompt.mjs) | `prism/spec/1`, `prism/spec.json`, bounded decision outcomes / rules, deterministic model rendering described. **Installed 0.6 SDK/release and independent verification: NOT_RUN / NOT_ESTABLISHED.** | That the 0.4.x template accepts spec JSON, supports arbitrary skill text or stateful apps; [stateful gap #664](https://github.com/UOR-Foundation/PrismPM/issues/664) |
| **C. Future/beta CLI quickstart** | [PrismPM quickstart](https://github.com/UOR-Foundation/PrismPM/blob/d896ab59e287650aecbcf02b8e867121601fdde5/docs/site/get-started/quickstart.md), `available_in: "1.0-beta"`; `npm create prism-code`, `prism build/check/run` | Documentation describes a 1.0-beta.1 CLI journey and distinguishes it from tools available on npm at writing. **Actual compatible CLI and SDK available for Skill Mason: NOT_ESTABLISHED.** | That the beta commands exist in the pinned older SDK, or that a README example is a locally executed acceptance record |
| **D. Rust façade** | [uor-prism@`507995b`](https://github.com/UOR-Foundation/prism/tree/507995bab43c0cb06ec244c96e6fc25b3f502204) | Library and `uor-prism-verify` replay façade source inspected. **Not the PrismPM application acceptance route.** | That adding the Rust crate makes a product a Prism-built app |

[LexLean@`a74b1f9`](https://github.com/UOR-Foundation/LexLean/tree/a74b1f99bba637e51d19fb4efc508316aafa6664) `README.md`, `SPEC.md`, `AGENTS.md` were source-inspected; they establish LexLean's *own* language/compiler contract, not automatic support for each Skill Mason use case. The [PrismPM release status](https://github.com/UOR-Foundation/PrismPM/blob/d896ab59e287650aecbcf02b8e867121601fdde5/RELEASE-STATUS.md) also makes clear that passing component checks is not production SDK release acceptance.

## Phase 0: developer-skills qualification before product code

1. Confirm Claude can discover and invoke all three `.claude/skills/*/SKILL.md` project-local skills. Merely existing in Git does **not** prove discovery.
2. For each intended tool operation, cite exact repo SHA, file/section or CLI help, chosen release and lock identity, executed status, and what proof it can actually discharge.
3. Compare **one** real, pinned and available application route against Skill Mason's bounded outcome/rights/authority decision; document both supported and unrepresentable semantics.
4. Reproduce a known upstream app with its own full verification gate, versioned receipts and a planted negative test. Keep upstream success distinct from new product qualification.
5. Review adopting the complete template/SDK contract without rewriting Skill Mason's Qortara `GOVERNANCE.md`, `SECURITY.md`, canonical `docs/README.md`, or `.qortara/` events. A template is not conformant when universal policy/locks/gates are selectively transplanted.
6. Do **not** begin product implementation when the selected route, CLI or syntax is unverified. Record `HOLD` and the exact blocker in issue #3 and RFC-0001.

## Decision record to complete at the exact source revision

| Item | Result required |
| --- | --- |
| Selected route | A, B, or another independently verified route with justification |
| Authoritative application input | Exact path/format and whether authored or generated |
| Verified command contract | Actual help output for installed binary; SDK/platform/version digest |
| Template and downstream ownership | Universal policy, product content, Qortara architectural governance boundaries |
| Modelability of first pilot | Explicit typed inputs, bounded decisions/refusals, unsupported operations |
| Proof and output claims | Exactly what is verified, replayed, materialized and observed |
| Required tests | Positive, refusal, deliberate mutation, offline repeatability and zero-inference measurement |
| Blocking items | What cannot be established; no invented fallback or accepted status |

**No route is selected or qualified for Skill Mason at this checkpoint.** An application can be legitimately Prism-built only after the selected route passes its real version-appropriate verification requirements.
