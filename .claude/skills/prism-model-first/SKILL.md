---
name: prism-model-first
description: Build Skill Mason as a genuine LexLean-modelled, PrismPM-built application using the verified UOR template contract, with registered claims, behavioral scenarios, failing tests and locked dependencies.
---

# Model-first Prism application development

**For Claude Code working in Skill Mason; NOT a skill for the external `skillz` corpus or Skill Mason's future generated output.**

## Preconditions

1. Run/read `prism-source-gate` and `.claude/PRISM_SOURCES.md`. Check real source at the pinned commits, not remembered syntax.
2. Locate the actual Skill Mason accepted architecture owner via `ARCHITECTURE_INDEX.md` -> `docs/README.md`. Proposed RFCs/ADRs have not automatically been accepted.
3. Inspect the pinned [UOR application template](https://github.com/UOR-Foundation/template) completely enough to preserve its **mandatory universal policy**, lock, bootstrap, verification, and model contract. Do not blindly paste selected source files into Skill Mason.
4. **Integration decision required:** Skill Mason already exists with Qortara docs, Git history, governance, and `.qortara/shadow.jsonl`. A full template-based application is the **proposed** route; prepare an evidence-backed migration/adoption design that retains those contracts and explicitly declares any unsupported template requirement. Never call a partial template transplant `uor/template-contract/1` conformant.

## Model-first workflow (after the integration is authorized)

1. Define the **smallest genuine Prism application behavior** required for the first Skill Mason pilot: a typed choice of source methods for explicit required outcomes, with fail-closed rights and authority decisions. Distinguish **formal model behavior** from host IO, source authentication, rights judgments and package delivery.
2. Register each capability ID and its claim level in the template's authoritative model register (`model/ids.toml` **in the adopted template**). Imported facts are `some-true`, locally constructed+validated claims are `build`, and unknown/empirical claims are `open`; never promote one level silently.
3. Register a behavioral scenario in the template's `features/suites/` and a **failing test** bound to the ID before implementing it. The upstream template documents `just new-capability` for this workflow; check its actual help/recipe at the pinned source before executing it.
4. Author actual application semantics in the model's `.lex.tex` files (the template includes `app/src/Contract.lex.tex`). Consult the pinned LexLean compiler/docs before choosing any construct; do not invent grammar, types or syntax from natural-language examples.
5. Generate derived model/conformance output only with upstream-supported commands (template documents `just model-write`). Never hand-edit generated `CONFORMANCE.md`, `.lean`, `lakefile.lean`, app-specific Rust/Wasm behavior, or proof assertions as a stand-in for the modeled source.
6. Implement only the modeled behavior. Every public failure must be typed, registered and covered by a **planted negative test**. No stubs, knowingly deferred requirements, speculative optional-feature escapes, or hidden alternate non-Prism implementation that bypasses the generated guest.
7. Use exact locked production dependency versions, SDK digest and toolchains from a **validated** `prismpm.lock` and related locks. The UOR template's claims do not make a copied or hand-modified lock trustworthy; independently verify it.
8. Maintain the Skill Mason-specific `docs/architecture/` owner register, rights/authority source boundaries, refusal semantics, and Qortara `.qortara/` writer custody as a separate governance obligation. Do not replace Qortara's event writer with a model claim or invent history.

## Mandatory constraints

- `uor-prism` Rust façade import or `prism_model!` alone is **not** sufficient to say the resulting skill compiler is a PrismPM-built application.
- The Rust/Python/Node scaffolding may integrate tools or independently evaluate real artifacts **only** within the actual accepted host boundary. Never move the product's claimed application semantics into a handwritten fallback.
- PrismPM `SPEC.md` and the selected template contract control the application model; proposed Skill Mason requirements cannot invent unsupported Prism language features.
- If the Prism model cannot represent an intended skill-composition operation, make a typed explicit limitation/gap and return to design review, rather than substituting unverified prose or host behavior.
- Preserve exact source pins and the decision's proof limits.

## Acceptance handoff

Give `prism-proof-audit` the exact model/claim IDs, scenarios, negative tests, source revision, selected toolchain/lock, and build commands **verified at that revision**. A completed draft model is **not** an independently verified Prism application.
