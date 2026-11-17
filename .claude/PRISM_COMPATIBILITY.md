# Prism application version compatibility and authoring decision

**Status:** Route A selected for development, **reference gate EXECUTED** on 2026-11-17 at the pins below. Skill Mason itself has **no Prism application adopted**: where one lives in this repository is an open owner decision ([ADR-0003](../docs/adr/0003-prism-application-adoption.md), Proposed).
**Authoritative work item:** [Skill Mason issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) and [RFC-0001](../docs/RFC-0001-prism-feasibility.md).
**Evidence:** [Phase 0 qualification record](../docs/evidence/prism-phase0-20261117/README.md), with unedited logs and receipts.
**Upstream docs issue and source-locked proposed correction:** [PrismPM #718](https://github.com/UOR-Foundation/PrismPM/issues/718), open, no maintainer response and no linked PR when read on 2026-11-17.

## Why this check exists

The exact [PrismPM source pin](https://github.com/UOR-Foundation/PrismPM/tree/d896ab59e287650aecbcf02b8e867121601fdde5) contains docs for **different authoring generations**. The normative `SPEC.md` and `README.md` describe a closed `.lex.tex` source graph, while pages tagged `available_in: "0.6"` describe `prism/spec.json`; the quickstart tagged `available_in: "1.0-beta"` uses the `prism` CLI. These are not one simultaneously supported toolchain.

One fact resolves most of the confusion: `docs/site/reference/release-status.md` at the pin says the `available_in` release ids "plan the `prism` CLI, which has not shipped, and are not `prism-code` version numbers". A page's tag is a roadmap position, not an installable version.

## Routes, as observed

Evidence states are defined in the [`prism-source-gate`](skills/prism-source-gate/SKILL.md) skill.

| Route | Authored input and driver | What was observed on 2026-11-17 | State | Disposition |
| --- | --- | --- | --- | --- |
| **A. UOR template, LexLean and PrismPM** | `.lex.tex` graph; `prismpm`, `lexlean` and `just vv` inside the SDK image that `prismpm.lock` selects | [template@`b64cc73`](https://github.com/UOR-Foundation/template/tree/b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b) passed its complete `just vv` twice in `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f72…`, with `prismpm 0.4.0`, `lexlean 0.4.0`, Lean 4.32.1. Seven planted defects were each refused by the intended gate. PrismPM `SPEC.md` section 1.2 requires `.lex.tex` and never mentions `spec.json` | `EXECUTED` | **Selected** |
| **B. JSON decision spec** | `prism/spec.json` (`prism/spec/1`); the `prism-code mcp` tools `prism_spec`, `prism_prove`, `prism_build` | The engine exists in published `prism-code@0.9.5` under `src/journey/`. The tool's own help marks `mcp` experimental. The default proving path is hosted and stores source unlisted. No reference run was made | `HELP_OBSERVED` | Not selected; `HOLD` |
| **C. `prism` CLI** | `prism/spec.json`; `prism`, `npm create prism-code` | `create-prism-code`, `@prism-code/mcp` and `@prism-code/cli` return `E404` from the npm registry. The quickstart itself says the CLI "ships with 1.0-beta.1" | `UNAVAILABLE` | Not selectable |
| **D. Rust façade** | Rust; `uor-prism` crates | [uor-prism@`507995b`](https://github.com/UOR-Foundation/prism/tree/507995bab43c0cb06ec244c96e6fc25b3f502204) source read only. Not the PrismPM application acceptance route | `SOURCE_INSPECTED` | Not an application route |

### Why route A

- It is the only route whose complete acceptance gate ran here, from a pinned source, in a digest-pinned toolchain, with negative controls.
- The normative specification at the pin describes it. Route B is described only by guides and an experimental tool surface; route C is unpublished.
- Its authored input is a model a person can read and a proof Lean checks, which is the property Skill Mason needs from an eligibility decision.

### What route A costs, as observed

- **The SDK is a candidate.** PrismPM `README.md` and `RELEASE-STATUS.md` at the pin state that 0.4.0 is not an accepted production release. Route A is selected for development and evidence, not for a production claim.
- **`prismpm.lock` says `sdk_version` `0.3.0`; the binary says `prismpm 0.4.0`.** Both are recorded; neither is treated as a release identity. The image digest is the identity.
- **The image lives at `ghcr.io/afflom/prismpm-sdk-patched`**, a personal namespace with "patched" in its name, not a `uor-foundation` one. Prism-DevRel pins a different digest in the same repository. This is a trust-root fact for the owner to weigh.
- **The gate is not hermetic.** A cold run needs `static.crates.io`, and `just deny` fetches the RustSec advisory database from `github.com` on every run, so the full verdict depends on a mutable external input. The application stage alone (`just app`) was run with networking disabled; see the evidence record for its result.
- **Non-Prism code may only shrink.** `audit-prism` refuses any new hand-written Rust, JavaScript, Python, shell, CSS or HTML file and any net growth in such lines against the parent commit. A capability's conformance test is Rust, so its lines must be paid for by deletion elsewhere.
- **`AGENTS.md` is byte-bound universal policy.** `template.lock` fixes its SHA-256 to `9a1fe3f7…`; Skill Mason's root `AGENTS.md` is `b2487038…`. Changing one byte fails `prismpm template check` with `PP1101`. Root-level adoption would replace a Skill Mason governance file. A template instance nested in a subdirectory of a repository with a different root `AGENTS.md` passed `prismpm template check`, `prismpm lock check` and `just model`.
- **Independent proof-level checking is not available at these versions.** `prism-code check` grades the emitted holo `P0 unverified`: it carries no embedded provenance, proof or replay statement. `prism-code vectors` did replay 9 of 9 vectors with identities verified. The proof evidence is in sidecar receipts written by the same toolchain that built the holo.

## Rules that follow

1. Do not mix routes. A `prism …` command or a `prism/spec.json` file does not belong in a route A project, and `.lex.tex` authoring does not belong in a route B project.
2. A command or flag is admissible in a script or document only after the installed binary's own help or a run showed it (`HELP_OBSERVED` or `EXECUTED`).
3. Reaching route B or C later is a new qualification: a fresh source gate, a reference run and negative controls for that route, then a governed change to this record.
4. No tool may send Skill Mason source or candidate skill text to a hosted verifier without explicit owner authorization. Use `--local` or the SDK image.
5. Upstream passing its own gate shows the toolchain works at these pins. It is not evidence about any Skill Mason decision.

## Decision record at the exact source revisions

| Item | Result |
| --- | --- |
| Selected route | **A**, for development and evidence. Production use is blocked on upstream SDK acceptance and on ADR-0003 |
| Authoritative application input | Authored `.lex.tex` modules listed in the project's `lexlean.toml` `entrypoints`; generated Lean, `.prism/` and `CONFORMANCE.md` are never authored |
| Verified command contract | `just vv` = `fmt-check model template-check lint test deny app`, where `app` runs `prismpm --project app verify`; help for `prismpm` and `lexlean` captured from the image |
| Toolchain identity | SDK image `sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3`, `linux/amd64`; `prismpm 0.4.0`, `lexlean 0.4.0`, Lean 4.32.1, Lake 5.0.0, Rust 1.97.1, `just 1.57.0`, `cargo-deny 0.20.2`; independent checker `prism-code 0.9.5` |
| Template and downstream ownership | Seven universal files are byte-bound and never edited; `CONFORMANCE.md` is generated project content; models, IDs, scenarios and tests are project content. Skill Mason's Qortara files stay where they are. Topology is ADR-0003's decision |
| Modelability of first pilot | A bounded, total, fail-closed decision over fixed-width coded inputs with a decides-theorem and acceptance vectors has the same shape as the executed reference model. See [ADR-0003](../docs/adr/0003-prism-application-adoption.md) for what was and was not built |
| Proof and output claims | Proved: the theorems in the model, with exactly their declared axioms. Replayed: every acceptance vector, in the build and again by `prism-code`. Not established: truth of inputs, source authenticity, licence determinations, host behaviour, independent proof-level verification |
| Required tests | Positive, each refusal dimension, malformed lengths, planted defects per gate, clean-tree repeat, offline application stage, no hosted service used |
| Blocking items | ADR-0003 owner acceptance; upstream SDK is a candidate; the gate's network dependence; the shrink-only ratchet; P0 independent assurance level; native Qortara checks still `NOT_RUN` ([issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4)) |

**Skill Mason is not a Prism-built application at this checkpoint.** It becomes one only when a Skill Mason model passes the selected route's complete gate inside an owner-accepted adoption.
