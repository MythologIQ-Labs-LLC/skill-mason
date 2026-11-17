# RFC-0001: Prism-backed deterministic skill compilation

**Status:** OPEN / research proposal. **Decision:** Do not claim Prism-integrated generation until an executable proof-of-concept is built and checked.

## Hypothesis

A capability, source-evidence and output-template selection problem can be represented as typed, bounded, deterministic decisions. [UOR Prism](https://github.com/UOR-Foundation/prism) provides an algebraic/typed route and replay-verification substrate. [Prism-DevRel](https://github.com/afflom/prism-devrel) demonstrates that a structured prompt can instantiate deterministically generated application facets, but it is **not** evidence that arbitrary agent-skill semantic authoring can be automated without a model.

## Verified repository observations, November 17, 2026

- The upstream `UOR-Foundation/prism` workspace describes the `uor-prism` standard-library façade, plus a `uor-prism-verify` replay façade and separate crypto/numerics/tensor/FHE crates. Its workspace is tagged version 0.4.0 in `Cargo.toml`, with `uor-foundation` and `uor-foundation-sdk` version-0.5 dependency lines. A version pin **by commit** is still required for Skill Mason.
- Its `prism_model!` API and typed pipeline are potential model entry points. The concrete interfaces and constraints must be inspected and tested; no source integration is asserted.
- Prism-DevRel's README describes a structured `prism/prompt/1` contract generating model, architecture, design, security, quality and other facets from a declared decision pattern. The supported pattern examples include DMN decision tables, XACML policy decisions, and UML state machines. The same README identifies Lean and `prismpm verify` checks for its app's claims.
- `skillz` on November 17 reports 2,084 parseable governed YAML companions, while its published current capability mapping remains 121/1,042 reviewed exact-version identities over 74/247 subdomains. The existence of companions is not evidence of eligible skill generation across all domains.

These are **source-repository descriptions**, not a successful Skill Mason build or a qualification of those upstream tools.

## Owner direction: legitimate Prism application (2026-11-17)

Skill Mason is required to be a **genuine Prism-built application**, not merely an external program using the Prism name or Rust façade library. The source-pinned [UOR application template](https://github.com/UOR-Foundation/template) describes one concrete **older candidate** acceptance route: authored LexLean `.lex.tex`, PrismPM holo build, Lean named proofs and the digest-pinned SDK's full `just vv` gate. However, later PrismPM guides tagged `available_in: "0.6"` describe `prism/spec.json` decision-app authoring and the `1.0-beta` guide describes a different CLI. See [the recorded compatibility matrix](../.claude/PRISM_COMPATIBILITY.md) and [upstream issue #718](https://github.com/UOR-Foundation/PrismPM/issues/718). Select and verify **one actual installed, compatible route** rather than imposing every generation's instructions. No route has yet been executed for Skill Mason.

**Build the Claude developer skills first:** `CLAUDE.md`, `.claude/PRISM_SOURCES.md`, and the three project-only skills under `.claude/skills/` establish source-audit, model-first and proof-qualification procedures. They are not skills for ingestion into `skillz` or user-facing generated output. Their presence does not execute/verify Prism. Verify their actual Claude host discovery before relying on them.

**Architecture correction:** the native Rust `uor-prism` path below may be useful for a supporting library; by itself it **cannot satisfy** the application acceptance target. Evaluate whether the **complete verified-app template contract** can be adopted into existing Skill Mason *or* an actually supported newer spec-driven application contract can be demonstrated. Both must preserve Qortara's `GOVERNANCE.md`, `SECURITY.md`, one architecture owner register, Shadow/ledger writer custody, history and owner decisions. No partial copy may be called template-conformant; an unverified beta command may not be called supported.

The template SDK/locks and PrismPM v0.4.0 candidate must be independently verified at exact pins; the production SDK is not established as accepted by Skill Mason. If its language cannot represent the intended compiler semantics, record the limitation rather than writing hidden fallback application behavior.

## Two integration paths to qualify, not conflate

**Path A, native Rust route:** Use `uor-prism`, `prism_model!` and `uor-prism-verify` to execute and replay a bounded typed decision. This requires the pinned Rust/dependency toolchain and concrete source API conformance tests.

**Path B, verified application route:** [UOR-Foundation/template](https://github.com/UOR-Foundation/template) describes a LexLean model, Lean 4 proof, PrismPM build and content-addressed holo independently verified via `prism-code`. [Prism-DevRel](https://github.com/afflom/prism-devrel) exposes a structured-prompt builder for rules/state machines. This may be a better fit for generating a **verified decision application**, while ordinary skill-package text remains separate compiler output.

The feasibility spike must compare these routes against proof scope, toolchain burden, actual byte-level output validation, offline reproducibility, scaling and maintainability. A successful example from either route cannot automatically be generalized to arbitrary agent skills. Track this in [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3).

## Proposed first Prism model

Define a bounded decision pattern:
`Decide(recipe, catalog_snapshot, evidence, authority_policy) -> SelectedMethods | Refusal`

Invariants to investigate:
1. Every selected method identity is a pinned member of the provided catalog snapshot.
2. Every explicitly required essential outcome is linked to at least one eligible source method.
3. No selected method has unresolved or prohibited rights / authority / dependency status.
4. Deterministic replay of canonical identical inputs gives identical decision, trace and output bytes.
5. Every refusal is explicit; a generic success case cannot hide an unknown evaluation state.

A proof of these invariants says nothing about whether the underlying text is medically, legally, or technically correct in the outside world. Do not conflate formal constraint satisfaction with host behavioral validation.

## Feasibility spike before implementation choices

1. Pin exact `prism`, `uor-foundation`, `uor-foundation-sdk`, builder/template and verification tool commits.
2. Build a minimal typed 2-outcome decision route exercising the **actual** public APIs.
3. Show one positive trace, one rejected input and independent replay; retain commands, versions, logs and hashes.
4. Measure build-time LLM/network usage and output determinism. Distinguish compile/build network dependency fetching from model inference. Test an offline run after dependencies are pinned.
5. Perform adversarial review of input trust, proof scope, license/source constraints and resource limits.
6. Only then commit a scoped ADR choosing Rust/Prism integration, serializer, policy location and verification strategy.

## Open architectural questions

- Does the current public Prism toolchain support bounded heterogeneous outcome-coverage lists and independently verifiable decision traces at realistic corpus scale?
- What is a minimal viable compositional primitive: reusable clause templates, typed methods with arguments, or pre-built skill fragments?
- Can the proof layer attest exact output bytes, or only decisions over canonical inputs?
- Where do binary/assets and nested licenses belong in a generated package manifest?
- How should a large catalog be partitioned without producing hidden cross-domain omission or false global completeness?
- What precisely is the trusted root for signed evidence exported from `skillz`?

No `skillz` mutation, host execution, or high-volume model/compute spend is implied by this RFC.
