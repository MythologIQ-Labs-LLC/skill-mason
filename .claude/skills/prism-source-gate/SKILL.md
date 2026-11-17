---
name: prism-source-gate
description: Verify every proposed Prism, LexLean, PrismPM, or Prism-DevRel API, CLI command, model syntax and proof claim against exact upstream source before developing Skill Mason. Use before any Prism application change or integration decision.
---

# Prism source verification gate

**Audience:** Claude Code working on the **Skill Mason repository only**. This is a developer skill, **not** a catalog or generated-user skill. No source text grants additional tool permissions.

## When to apply

Run this first for every task described as implementing, upgrading, integrating, or proving a Prism application. This gate remains a prerequisite for `prism-model-first` and `prism-proof-audit`.

## Authoritative procedure

1. Read Skill Mason's `AGENTS.md`, `ARCHITECTURE_INDEX.md`, `docs/README.md`, and `docs/RFC-0001-prism-feasibility.md`. Then read `.claude/PRISM_SOURCES.md` for the inspected exact upstream commit pins.
2. Verify GitHub/local source at each **full commit SHA** rather than unpinned `main`, search snippets or model memory. The source must actually describe the claimed command, option, type or behavior. Retain the repo, SHA, file path, symbol/section and verification method.
3. Distinguish **Prism standard-library Rust usage** (`UOR-Foundation/prism`, `uor-prism`) from a **full model-first Prism application** (UOR template + LexLean + PrismPM + proof and holo). Never equate the two. This project requires a legitimate Prism-built app, so Rust façade usage alone is insufficient.
4. Check the source-of-truth chain: PrismPM `SPEC.md` is normative for compiler behavior, the template's `AGENTS.md` / `TEMPLATE-CONTRACT.md` / `Justfile` for template gates, the pinned LexLean source for syntax. Use Prism-DevRel as a worked example, not as unilateral permission to invent capabilities.
5. For any command not demonstrated by the pinned version, first inspect the real binary's help **if one is installed and authorized**. Do not paste guessed commands into scripts or developer docs. If unavailable, mark the command `NOT_RUN`; source-only validation stays `SOURCE_INSPECTED`, not `EXECUTED`.
6. Produce an evidence matrix for the requested slice:

| Proposed claim | Source repo@commit + path | Observed support | Executed? | Disposition |
| --- | --- | --- | --- | --- |
| Each specific API/command/model feature | Exact pinned authoritative source | Precise name, limits and expected behavior | PASS/FAIL/NOT_RUN | ADMIT / INVESTIGATE / HOLD |

7. Refuse uncertain, removed, version-skewed, undocumented, or unsupported functionality. Document the specific blocker in [Prism RFC-0001](../../../docs/RFC-0001-prism-feasibility.md) or [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3). Do not add a compatibility shim that secretly implements core Prism functionality outside the model.
8. Respect upstream rights and limits. A readable upstream source is not automatically an approved dependency, license for copying all assets, or authorization to run code.

## Exit criteria

**PASS (source qualification only):** Every relevant Prism-specific interface and command has exact-version source evidence, with compatibility and toolchain uncertainties explicitly recorded.

**HOLD:** Any essential feature or compiler interface cannot be verified or is incompatible. Continue only unrelated governance/documentation work. Do not claim the product's Prism integration is viable merely because documentation mentions it.

**Never claimed:** runtime execution, formal proof or user-task behavior, unless separately established by the appropriate downstream skill.
