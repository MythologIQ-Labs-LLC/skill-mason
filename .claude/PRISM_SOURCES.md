# Prism upstream source pins for Claude development skills

**Recorded:** 2026-11-17. **Status:** Repository/document sources inspected, **not runtime-qualified**. Commit pins below are observations of upstream `main` at this checkpoint, not proof that every command works in Skill Mason or that dependencies are license-compatible.

| Upstream source | Exact commit | Primary authoritative material inspected | Role |
| --- | --- | --- | --- |
| [UOR-Foundation/template](https://github.com/UOR-Foundation/template/tree/b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b) | `b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b` | `README.md`, `AGENTS.md`, `Justfile`, `model/ids.toml`, `TEMPLATE-CONTRACT.md`, `CONFORMANCE.md`, `prismpm.lock` | **Canonical starting point for a model-first Prism application** |
| [UOR-Foundation/PrismPM](https://github.com/UOR-Foundation/PrismPM/tree/d896ab59e287650aecbcf02b8e867121601fdde5) | `d896ab59e287650aecbcf02b8e867121601fdde5` | `SPEC.md` (normative), `README.md` (explanatory), `AGENTS.md` | Compiler, verifier, package boundaries and accepted command semantics |
| [UOR-Foundation/LexLean](https://github.com/UOR-Foundation/LexLean/tree/a74b1f99bba637e51d19fb4efc508316aafa6664) | `a74b1f99bba637e51d19fb4efc508316aafa6664` | Repository identity pinned; syntax/semantic source **not yet inspected at this pin** | Required language implementation, detailed API review pending |
| [UOR-Foundation/prism](https://github.com/UOR-Foundation/prism/tree/507995bab43c0cb06ec244c96e6fc25b3f502204) | `507995bab43c0cb06ec244c96e6fc25b3f502204` | `README.md`, `AGENTS.md` | Standard-library façade and separate replay façade; **not** the full application template |
| [afflom/prism-devrel](https://github.com/afflom/prism-devrel/tree/ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc) | `ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc` | `README.md`, `AGENTS.md`, `TEMPLATE-CONTRACT.md` | Worked Prism application and proof/coverage learning reference, not automatic feature authority |

## Source-of-truth order for claims

- **Prism application structure / project gate:** template `AGENTS.md`, `TEMPLATE-CONTRACT.md`, actual `Justfile` and `model/` files at its exact pin, then executable observed output.
- **PrismPM behavior:** `SPEC.md` **normative**, `README.md` explanatory, actual command help and tested binary built from the exact locked SDK.
- **LexLean syntax and generated proofs:** actual pinned `LexLean` language documentation/compiler and templates, never language syntax invented from natural-language examples.
- **Rust Prism standard library:** pinned `prism` source and its normative UOR-Framework wiki; a library import or macro alone does not satisfy the Prism application build contract.
- **Prism-DevRel case studies:** examples to examine and compare with authoritative toolchain. Their scope is not automatically generalizable to an arbitrary skill compiler.
- **Claude project skill format:** [Claude Code custom skills documentation](https://code.claude.com/docs/en/skills) verifies `.claude/skills/[name]/SKILL.md`. These files are development guidance, not model or source-of-truth records.

## Observed contract excerpts, paraphrased

1. Template `AGENTS.md` rules R1–R6 require one model source; separated imported/built/open claim levels; registered ID, scenario and red test before implementation; no deferred/stubbed public claims; typed failures and negative tests; locked production dependencies.
2. Template `Justfile` defines `just vv` as a full verification gate. Its `app` recipe runs `prismpm --project app verify`. It also defines `model-write` / `new-capability` flows that must be inspected in the adopted template before use.
3. Template `README.md` presents a real Prism app as a LexLean model + Lean 4 proof + PrismPM build into a content-addressed `.holo` with independent verification. This is the intended **application** standard, not simply importing `uor-prism` into a hand-written Rust executable.
4. PrismPM `SPEC.md` states `check` validates a semantic snapshot, `build` produces artifacts **without a proof claim**, and only `verify` may produce its application-acceptance artifact. It forbids handwritten formal `.lean` authority and alternate target-language application semantics.
5. Upstream PrismPM README currently describes its v0.4.0 production SDK as a **candidate**, not accepted as a production release. Do not claim Skill Mason is production-qualified based on that dependency or README.

## Mandatory claim ledger for development work

Before any Prism-specific change, record:
`proposed interface/command/feature | exact upstream repo and commit | path/symbol | source observation | locally executed test (or NOT_RUN) | decision/limitation`.

Missing upstream evidence -> **UNVERIFIED / HOLD**. An inaccessible document -> **UNAVAILABLE**, not permission to improvise. A passing test of Skill Mason's Python documentation checker is not a Prism conformance or holo acceptance test.

Do not silently repin `main`. When a source changes, compare revisions, make a governed pin-update PR and rerun affected model/proof tests. The existing Skill Mason `docs/RFC-0001-prism-feasibility.md` and issue #3 own investigation, not this register.
