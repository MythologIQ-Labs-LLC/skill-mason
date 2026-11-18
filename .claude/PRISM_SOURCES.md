# Prism upstream source pins for Claude development skills

**Recorded:** 2026-11-17. **Status:** Pins re-verified against upstream `HEAD` and the route A toolchain executed for the upstream reference application and for one Skill Mason candidate; see the [qualification record](../docs/evidence/prism-phase0-20261117/README.md). Skill Mason itself is **not runtime-qualified**: no Prism application is adopted. Commit pins below are observations of upstream `main` at this checkpoint, not proof that dependencies are license-compatible or that the SDK is a production release.

| Upstream source | Exact commit | Primary authoritative material inspected | Role |
| --- | --- | --- | --- |
| [UOR-Foundation/template](https://github.com/UOR-Foundation/template/tree/b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b) | `b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b` | `README.md`, `AGENTS.md`, `Justfile`, `model/ids.toml`, `TEMPLATE-CONTRACT.md`, `CONFORMANCE.md`, `prismpm.lock` | **Canonical starting point for a model-first Prism application** |
| [UOR-Foundation/PrismPM](https://github.com/UOR-Foundation/PrismPM/tree/d896ab59e287650aecbcf02b8e867121601fdde5) | `d896ab59e287650aecbcf02b8e867121601fdde5` | `SPEC.md` (normative), `README.md` (explanatory), `AGENTS.md` | Compiler, verifier, package boundaries and accepted command semantics |
| [UOR-Foundation/LexLean](https://github.com/UOR-Foundation/LexLean/tree/a74b1f99bba637e51d19fb4efc508316aafa6664) | `a74b1f99bba637e51d19fb4efc508316aafa6664` | Pinned `README.md`, normative `SPEC.md` and `AGENTS.md` source-inspected; runtime/compiler verification **not executed** | Closed LexLean language/compiler contract; support for Skill Mason's intended application semantics still unproven |
| [UOR-Foundation/prism](https://github.com/UOR-Foundation/prism/tree/507995bab43c0cb06ec244c96e6fc25b3f502204) | `507995bab43c0cb06ec244c96e6fc25b3f502204` | `README.md`, `AGENTS.md` | Standard-library façade and separate replay façade; **not** the full application template |
| [afflom/prism-devrel](https://github.com/afflom/prism-devrel/tree/ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc) | `ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc` | `README.md`, `AGENTS.md`, `TEMPLATE-CONTRACT.md` | Worked Prism application and proof/coverage learning reference, not automatic feature authority |

## Drift observed, not adopted (2026-11-18)

`git ls-remote … HEAD` for each source, compared with the pins above. The pins are unchanged: a pin change is a governed PR that reruns the affected gates.

| Source | Upstream `HEAD` on 2026-11-18 | Against the pin |
| --- | --- | --- |
| UOR-Foundation/template | `b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b` | equal |
| UOR-Foundation/PrismPM | `17d3b106f2276047d8c8dbbdb96983a86a7122ac` | **moved**; not read |
| UOR-Foundation/LexLean | `f0900179937827a0ddb3e069a56a67af0a1a3c79` | **moved**; not read |
| UOR-Foundation/prism | `5f0cccab724d3146acf35615eac6fb84cf91a1f3` | **moved**; not read |
| afflom/prism-devrel | `ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc` | equal |

Route A's executed toolchain is fixed by the template pin, whose `prismpm.lock` selects the SDK image by digest. That pin did not move, so the three moved repositories change nothing that ran. They are documentation and library sources here; what their newer commits say is `NOT_RUN` and unread.

## Executed toolchain identities

Observed on 2026-11-17, `linux/amd64`. The image digest is the identity; version strings are what each binary printed.

| Item | Identity | State |
| --- | --- | --- |
| SDK image selected by template `prismpm.lock` | `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3` | `EXECUTED` |
| In that image | `prismpm 0.4.0`, `lexlean 0.4.0`, Lean 4.32.1, Lake 5.0.0, `rustc 1.97.1`, `just 1.57.0`, `cargo-deny 0.20.2` | `EXECUTED` |
| Independent holo checker | `prism-code@0.9.5` from npm | `EXECUTED` for `vectors`, `check`, `inspect`, `run` |
| `create-prism-code`, `@prism-code/mcp`, `@prism-code/cli` | `E404` from the npm registry | `UNAVAILABLE` |
| `prismpm.lock` field `sdk_version` | `0.3.0`, which disagrees with the binary's `0.4.0` | recorded discrepancy |

## Required version compatibility check

Before interpreting any upstream authoring instructions, read [PRISM_COMPATIBILITY.md](PRISM_COMPATIBILITY.md), including [upstream PrismPM docs issue #718](https://github.com/UOR-Foundation/PrismPM/issues/718). The pinned PrismPM `SPEC.md`/`README.md`, `0.6` spec JSON guides, and `1.0-beta` CLI guide are **different version-scoped surfaces**. Their tools, authoritative model inputs, and acceptance gates must not be combined without observed, compatible toolchain evidence.

**Additional pinned PrismPM docs inspected:** `docs/site/guides/write-the-model.md`, `docs/site/guides/write-from-examples.md`, `docs/site/get-started/quickstart.md`, `docs/site/guides/agents.md` and `RELEASE-STATUS.md` at `d896ab59e287650aecbcf02b8e867121601fdde5`.

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

Missing upstream evidence -> **UNVERIFIED / HOLD**. An inaccessible document -> **UNAVAILABLE**, not permission to improvise. A passing test of Skill Mason's Python documentation checker is not a Prism conformance or holo acceptance test. Evidence states (`UNAVAILABLE`, `SOURCE_INSPECTED`, `HELP_OBSERVED`, `EXECUTED`, `NOT_RUN`) are defined in the `prism-source-gate` skill.

Do not silently repin `main`. When a source changes, compare revisions, make a governed pin-update PR and rerun affected model/proof tests. The existing Skill Mason `docs/RFC-0001-prism-feasibility.md` and issue #3 own investigation, not this register.
