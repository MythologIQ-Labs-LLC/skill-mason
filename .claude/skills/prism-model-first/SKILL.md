---
name: prism-model-first
description: Help build Skill Mason as a real version-pinned Prism application; first qualify the active LexLean/PrismPM or JSON-spec workflow, then preserve its single model source, locked SDK, claims, tests and proof boundaries.
---

# Genuine Prism application construction

**Claude Code developer skill only.** Never import it into `skillz` or include it in Skill Mason's generated user-skill corpus.

## Mandatory prerequisites

1. Read/invoke `prism-source-gate`. Review `.claude/PRISM_SOURCES.md`, `.claude/PRISM_COMPATIBILITY.md`, Skill Mason RFC-0001, and upstream [PrismPM documentation issue #718](https://github.com/UOR-Foundation/PrismPM/issues/718).
2. Locate the actual accepted Skill Mason architecture owner at root `ARCHITECTURE_INDEX.md` -> `docs/README.md`. A proposed ADR is **not** owner acceptance.
3. **Choose one version-correct, demonstrated application route.** The pins record different authoring generations: old UOR template uses authored `.lex.tex`; newer `available_in: "0.6"` docs describe authored `prism/spec.json` for decisions; the `1.0-beta` quickstart documents a different `prism` CLI. Never treat their instructions as interchangeable.
4. Establish a real SDK, lock, binary and reference app, then run the version's documented full gate and negative controls. If the selected version cannot be installed/verified, return **HOLD** without product code, rather than emulate Prism.

## If **route A** is actually selected: UOR template / older model-authoring contract

- Preserve the **complete** upstream template contract `uor/template-contract/1` (universal R1–R6, lock and trust roots, bootstrap, conformance generation, tests and `just vv`), not cherry-picked source files. The existing Skill Mason repo already has Qortara-owned documentation, history and `.qortara/`; preserve those while reviewing how full template adoption can occur.
- Use its supported authoritative model graph (`app/src/Contract.lex.tex` is the template's example), `model/ids.toml`, scenarios and failing tests. Confirm all concrete LexLean syntax against the pinned LexLean `SPEC.md`, examples and actual SDK.
- Template documentation describes `just new-capability`, `just model-write` and `just vv`. Use those **only** after the exact route has been adopted and their real commands and gate outcomes verified. Never hand-edit generated conformance or Lean code.
- Every claimed capability has a registered ID, scenario and red test first. Every public failure has a typed model entry and planted negative control. No hidden handwritten substitute for model semantics.

## If **route B** is actually selected: version-compatible JSON decision spec

- Require an actual supported implementation of the `prism/spec/1` profile and associated SDK/CLI. The `0.6` help pages are **source descriptions, not a verified installed release**.
- Author the accepted decision-app semantics in `prism/spec.json`, using precisely its supported field kinds, conditions, ordered rules, outcomes, guarantees and acceptance vectors. Treat rendered LexLean as **generated**, not writable application authority. Never author a second competing `.lex.tex` model.
- The bounded JSON profile describes **stateless decision applications**. The upstream stateful/JSON-spec gap is [PrismPM #664](https://github.com/UOR-Foundation/PrismPM/issues/664). Do not assume it supports arbitrary skill generation, file IO, mutable package state, network access or complex proof claims.
- Discover the exact version-correct build, check, verify, template and artifact commands from installed help/contract. The `1.0-beta` `prism` CLI is not automatically part of an earlier SDK.
- If scope is too narrow for the intended generator, record unrepresentable behavior as a product/design blocker. Do not move its *claimed* application semantics into handwritten Rust/Python/JS while still calling it Prism-built.

## In either route, after actual qualification

1. Model only the smallest honest first decision: bounded explicit outcomes, source evidence state, reuse rights, authority ceiling and fail-closed refusal. Inputs that are accepted as external fact are **not** proven true by formal verification.
2. Preserve precisely one canonical authoring input for the selected toolchain. Register tests and proof obligations as that toolchain demands.
3. Run applicable positive, malicious, tampered, uncovered and rights-restricted cases; capture actual failure boundary and exit result. Reuse the exact locked dependencies and SDK identity.
4. Separate formal decision verification from actual source authenticity, license determinations, artifact bytes and host behavioral use. Do not claim capabilities that were not demonstrated.
5. Preserve Skill Mason's canonical architecture owner register, Qortara `GOVERNANCE.md` / `SECURITY.md` and canonical `.qortara/` runtime writer.

## Exit

Pass to `prism-proof-audit` the selected version/route, exact source/toolchain pins, authoritative input, registered model/scenario/test links, build and negative outputs, and limits. If the branch lacks a genuine version-compatible Prism application, state **NOT_IMPLEMENTED**. Do not call an imported Rust façade or docs-only scaffold proof of a Prism-built product.
