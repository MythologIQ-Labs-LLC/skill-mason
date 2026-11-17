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
