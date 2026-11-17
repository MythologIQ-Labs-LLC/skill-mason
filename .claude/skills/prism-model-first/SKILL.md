---
name: prism-model-first
description: Author or change a Skill Mason Prism application model the way the selected, executed toolchain actually requires, registering the claim, scenario and failing test before the model, and keeping every decision total and fail-closed. Use when adding or editing a `.lex.tex` model, a conformance ID, an acceptance vector or a decision rule, and when judging whether a behaviour is representable at all.
---

# Genuine Prism application construction

**Claude Code developer skill only.** Never import it into `skillz` or include it in Skill Mason's generated user-skill corpus.

A Prism application is a model that the locked toolchain compiled, proved and accepted. Code that imports a Prism library, or a model nobody verified, is not one. This skill keeps the model the only place the decision lives.

## Prerequisites

1. Run `prism-source-gate`. Read `.claude/PRISM_SOURCES.md`, `.claude/PRISM_COMPATIBILITY.md`, RFC-0001 and [PrismPM issue #718](https://github.com/UOR-Foundation/PrismPM/issues/718).
2. Find the accepted architecture owner through `ARCHITECTURE_INDEX.md` -> `docs/README.md`. A proposed ADR is **not** owner acceptance; where the Prism application lives in this repository is an owner decision ([ADR-0003](../../../docs/adr/0003-prism-application-adoption.md)).
3. Work only on the one selected route. `.claude/PRISM_COMPATIBILITY.md` records the selection and why; if it says `HOLD`, stop and return `HOLD` without product code.
4. Have a known-good reference run for these exact pins in `docs/evidence/`. If the pins changed, or the record is missing, rerun the reference gate with `prism-proof-audit` before touching a model.

## If **route A** is the selected route: template, LexLean and PrismPM

This is the route with an executed reference gate. Its rules come from the template's `AGENTS.md` (R1 to R6), `TEMPLATE-CONTRACT.md` and `Justfile` at the pin.

### What you may and may not edit

| Path class | Examples | Rule |
| --- | --- | --- |
| Universal policy, byte-bound by `template.lock` | `.devcontainer/devcontainer.json`, `.github/workflows/bootstrap.yml`, `AGENTS.md`, `VERIFICATION.md`, `prismpm.lock`, `template-contract.json`, `template.lock` | Never edit. `prismpm template check` refuses one changed byte (`PP1101`) |
| Generated | `CONFORMANCE.md`, everything under `.prism/`, `.lexlean/`, `.prism-proof/`, generated Lean | Regenerate with the tool. Never hand-edit |
| Project content | the `.lex.tex` graph, `model/ids.toml`, `features/suites/*.feature`, conformance tests, added `just` recipes | Yours, under R1 to R6 |

The template's universal `AGENTS.md` and Skill Mason's own root `AGENTS.md` have different bytes and cannot both sit at one root. **Never overwrite Skill Mason's root `AGENTS.md`, `GOVERNANCE.md`, `SECURITY.md`, `docs/README.md` or `.qortara/`** to make a template check pass.

Until ADR-0003 is accepted, the application is carried as [`prism-overlay/`](../../../prism-overlay/README.md): the authored files plus one patch. Work like this:

1. `scripts/prism_instance.sh <template-checkout-at-pin> <dir>` rebuilds a full instance from the pinned template and the overlay.
2. Commit that directory in a scratch Git repository and edit **there**, where the tools can judge each edit.
3. Copy the canonical results back into `prism-overlay/files/`, and regenerate `prism-overlay/template.patch` with `git diff <installing-parent> -- Justfile model/ids.toml CONFORMANCE.md`.

Apply patches to a nested instance with `patch -p1`, not `git apply`: inside a subdirectory of an enclosing repository `git apply` skips every path and still exits 0.

### The shrink-only ratchet decides when a capability can be added

`audit-prism`, part of `just model`, measures hand-written Rust, JavaScript, Python, shell, CSS and HTML against the commit's first parent. It refuses a new non-Prism file and any net growth in such lines. `.lex.tex`, TOML and JSON are free.

- The conformance test that `just new-capability` scaffolds is a new Rust file, so in an ordinary later commit the gate refuses it: `1 new non-Prism file(s)` and `grew by N lines`.
- The commit that **installs** the instance is different: `installed here; the parent ran no ratchet, so this commit sets the ceiling`. Capabilities present in that commit are part of the baseline.
- So put every capability of the first slice in the installing commit. A capability added later must put its test in a file the parent already has and delete at least as many hand-written lines elsewhere. Decide what gets deleted as a design question, with the owner, not as a merge-time trick.

### Order of work (R3: the order is the discipline)

0. **For a new PrismPM project directory**, copy the shape of the template's `app/`: `lexlean.toml` (name, `module_prefix`, `entrypoints`), `prismpm.toml` (`project`), `lakefile.toml`, `lake-manifest.json`, `lean-toolchain`, the `language/` lexicon and the `Foundation` modules the model imports. Then run `lexlean lock` before anything else; `lexlean fmt` refuses a project with no lock (`LLC0102`). Add a recipe for the project to the `Justfile` and to the `vv` list, so the complete gate proves it.
1. **Register first.** Inside the SDK image:
   ```bash
   just new-capability SM-01 build eligibility "One line that states the claim"
   ```
   This appends the `model/ids.toml` row, the scenario, a failing test named `<suite>_<id>`, and regenerates `CONFORMANCE.md`. Levels are `some-true` (reproduced from a cited authority), `build` (constructed and validated here) and `open` (measured, never asserted).
2. **See it red.** Run `just test` and confirm the new test fails for the stated reason. A capability that was never red has no evidence its test can fail.
3. **Write the model**, using only constructs that have a precedent in the pinned sources. The template's `app/src/Contract.lex.tex` demonstrates, and the reference gate has executed: `structure`, `definition` with `Bool` and `Prop` results, `project`, `record`, `match` on `Nat`, `if … then … else`, `=?`, `&&`, `/\`, `<->`, `prim` byte and text operations, `theorem` with `proof: simplify{definitions: […]}` and an `axioms:` list, and the `application` record carrying acceptance vectors and limits. For anything else, find it in the pinned LexLean `SPEC.md` and a compiling example first. Do not write syntax from memory or from prose examples.
4. **Iterate on the cheapest tier that can refuse the edit:**

   | Tier | Command | Roughly | Refuses |
   | --- | --- | --- | --- |
   | Format and lock | `lexlean fmt --check`, `lexlean lock --check` in the project directory | seconds | non-canonical source, stale lock |
   | Static | `prismpm --project <dir> check` | seconds | syntax, types, model shape |
   | Proof and acceptance | `prismpm --project <dir> verify` | seconds to fail, minutes to pass | false theorems, axiom policy, vector mismatch, guest limits |
   | Complete gate | `just vv` | minutes | everything, including R1 to R6 |

   `lexlean fmt` and `lexlean lock` (without `--check`) rewrite; run them, then review the diff. The formatter collapses a short declaration onto one line (`definition{name: x, …}`) and keeps a long one multi-line, so any test that reads the model must accept both layouts. Format Rust with `just fmt` before `just fmt-check` judges it.
5. **Turn the test green by asserting the claim, not the outcome.** The proof is checked by Lean during `verify`. The conformance test fixes what that proof is about: the theorem's exact statement, its axiom list, and that the response the application returns is decided by the proved function. Mirror the template's `contract_tc_01`. A weakened statement would still verify; only this test catches it.
6. **Plant the defect, then restore.** For each claim, break it once and confirm the intended gate refuses it with a diagnostic that names the defect. Record the defect, command, diagnostic and restored result.
7. **Run `just vv` to completion** in the image `prismpm.lock` selects. Nothing short of it is acceptance.

### Shaping a decision so the proof means something

- **Total and fail-closed.** Every request maps to exactly one outcome. Admit one explicit code per dimension and refuse everything else, including codes nobody has defined yet. Give malformed input its own outcome rather than a default success.
- **Two forms, one theorem.** Write the decision as a `Bool` function the guest runs and as a `Prop` a person reads, then prove `(decide x = true) <-> (Decide x)`. That theorem is the claim. Refusal properties follow from it; state a separate theorem only when you will also prove it.
- **Axioms are declared exactly.** A declaration's `axioms:` list must equal the set Lean observes. A missing or extra axiom is refused (`LLV7005`), so the list is evidence, not decoration. Do not guess the set: declare none, run `verify`, and read the diagnostic, which names the declaration and the observed axioms. Byte indexing brings `Quot.sound` and `propext`, and every definition that calls it inherits them. `lexlean explain <code>` prints the registered meaning of a diagnostic.
- **Vectors cover every outcome class and each boundary:** the admitted case, each single-dimension refusal, a combined refusal, a too-short request, a too-long request and the empty request. A vector the model contradicts is refused at verify (`PP5301`).
- **Bound the guest.** Declare request, response and allocation maxima and leave capabilities empty unless a capability is itself the claim. Include a vector whose request is exactly the allocation maximum; the template's own verification record lists a vector set without that boundary as refused (`PP2009`).
- **Inputs are facts taken on trust.** The proof covers the decision over the request bytes. It says nothing about whether a source is authentic, a licence determination is right, or the evidence is current. Name the external party that asserts each input.

## If **route B** is ever selected: JSON decision spec

Route B is **not selected and not executed** for Skill Mason. Its engine ships in `prism-code` under `src/journey/`, is driven through `prism-code mcp` tools and is marked experimental by the tool. Before any use:

- Require a fresh source gate and a full reference run for that route. Treat the `0.6` pages as source descriptions.
- `prism/spec.json` is then the only authored input, and rendered LexLean is generated. Never keep a second authored `.lex.tex` model beside it.
- The profile is bounded: stateless decisions over at most 8 fields of kind `number` or `choice`, at most 24 ordered rules, `never` and `always` properties. The stateful gap is [PrismPM #664](https://github.com/UOR-Foundation/PrismPM/issues/664).
- Its default proving path is hosted. Use it only with `--local` unless the owner has authorized sending source out.

## When the model cannot say it

If the intended behaviour needs file IO, network, mutable package state, unbounded lists or free text interpretation, record it as a product or design blocker in RFC-0001. Do **not** move the claimed semantics into Rust, Python or JavaScript beside the model and keep calling the result Prism-built. Code outside the model may carry bytes to and from the application; it may not decide.

## Exit

Hand `prism-proof-audit` the route, the exact source and SDK pins, the authored model paths, the registered IDs with their scenario and test names, the planted defects and their diagnostics, the gate outputs and the limits. If the branch has no model that passed the selected route's complete gate, the status is **NOT_IMPLEMENTED**. An imported library, a docs scaffold or an unverified model is not a Prism-built product.
