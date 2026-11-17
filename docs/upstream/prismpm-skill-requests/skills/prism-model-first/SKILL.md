---
name: prism-model-first
description: Author or change a Prism application model in a UOR template instance the way the locked toolchain requires, registering the claim, scenario and failing test before the model, and keeping every decision total and fail-closed. Use when adding or editing a `.lex.tex` model, a conformance ID, an acceptance vector or a decision rule, and when judging whether a behaviour is representable at all.
---

# Model-first Prism application construction

A Prism application is a model that the locked toolchain compiled, proved and accepted. Code that imports a Prism library, or a model nobody verified, is not one. This skill keeps the model the only place the decision lives.

It covers the template route: authored `.lex.tex`, `prismpm`, `lexlean` and `just vv` inside the SDK image that `prismpm.lock` selects. Run `prism-source-gate` first, and have a known-good run of the template's own reference application for your exact pins before touching a model.

## What you may and may not edit

| Path class | Examples | Rule |
| --- | --- | --- |
| Universal policy, byte-bound by `template.lock` | `.devcontainer/devcontainer.json`, `.github/workflows/bootstrap.yml`, `AGENTS.md`, `VERIFICATION.md`, `prismpm.lock`, `template-contract.json`, `template.lock` | Never edit. `prismpm template check` refuses one changed byte (`PP1101`) |
| Generated | `CONFORMANCE.md`, everything under `.prism/`, `.lexlean/`, `.prism-proof/`, generated Lean | Regenerate with the tool. Never hand-edit |
| Project content | the `.lex.tex` graph, `model/ids.toml`, `features/suites/*.feature`, conformance tests, added `just` recipes | Yours, under R1 to R6 |

`AGENTS.md` is universal policy. A repository that already has its own root `AGENTS.md` cannot adopt the template at its root without replacing that file. A template instance in a subdirectory passes `prismpm template check`, `prismpm lock check` and `just model`, but GitHub runs only root workflows, so the instance's `bootstrap.yml` is then inert and a root workflow must run the same gate.

## The shrink-only ratchet decides when a capability can be added

`audit-prism`, part of `just model`, measures hand-written Rust, JavaScript, Python, shell, CSS and HTML against the commit's first parent. It refuses a new non-Prism file and any net growth in such lines. `.lex.tex`, TOML and JSON are free.

- The conformance test that `just new-capability` scaffolds for a new suite is a new Rust file, so in an ordinary later commit the gate refuses it: `1 new non-Prism file(s)` and `grew by N lines`.
- The commit that installs the instance is different: `installed here; the parent ran no ratchet, so this commit sets the ceiling`. Capabilities present in that commit are part of the baseline.
- So put the first slice's capabilities in the installing commit. A capability added later must put its test in a file the parent already has and delete at least as many hand-written lines elsewhere. Decide what gets deleted as a design question, not at merge time.

When you apply a patch to an instance nested inside another repository, use `patch -p1`. `git apply` run in a subdirectory of an enclosing repository skips every path and still exits 0.

## Order of work (R3: the order is the discipline)

0. **For a new PrismPM project directory**, copy the shape of the template's `app/`: `lexlean.toml` (name, `module_prefix`, `entrypoints`), `prismpm.toml` (`project`), `lakefile.toml`, `lake-manifest.json`, `lean-toolchain`, the `language/` lexicon and the `Foundation` modules the model imports. Run `lexlean lock` before anything else; `lexlean fmt` refuses a project with no lock (`LLC0102`). Add a recipe for the project to the `Justfile` and to the `vv` list, so the complete gate proves it.
1. **Register first.** Inside the SDK image:
   ```bash
   just new-capability CX-01 build parsing "One line that states the claim"
   ```
   This appends the `model/ids.toml` row, the scenario, a failing test named `<suite>_<id>`, and regenerates `CONFORMANCE.md`. Levels are `some-true` (reproduced from a cited authority), `build` (constructed and validated here) and `open` (measured, never asserted).
2. **See it red.** Run the new test and confirm it fails for the stated reason. A capability that was never red has no evidence its test can fail.
3. **Write the model**, using only constructs that have a precedent in your pinned sources. The template's `app/src/Contract.lex.tex` demonstrates `structure`, `definition` with `Bool` and `Prop` results, `project`, `record`, `match` on `Nat`, `if … then … else`, `=?`, `&&`, `/\`, `<->`, `prim` byte and text operations, `theorem` with `proof: simplify{definitions: […]}` and an `axioms:` list, and the `application` record carrying acceptance vectors and limits. For anything else, find it in the pinned LexLean `SPEC.md` and a compiling example first. Do not write syntax from memory or from prose examples.
4. **Iterate on the cheapest tier that can refuse the edit:**

   | Tier | Command | Roughly | Refuses |
   | --- | --- | --- | --- |
   | Format and lock | `lexlean fmt --check`, `lexlean lock --check` in the project directory | seconds | non-canonical source, stale lock |
   | Static | `prismpm --project <dir> check` | seconds | syntax, types, model shape |
   | Proof and acceptance | `prismpm --project <dir> verify` | seconds to fail, minutes to pass | false theorems, axiom policy, vector mismatch, guest limits |
   | Complete gate | `just vv` | minutes | everything, including R1 to R6 |

   `lexlean fmt` and `lexlean lock` without `--check` rewrite; run them, then review the diff. The formatter collapses a short declaration onto one line and keeps a long one multi-line, so a test that reads the model must accept both layouts. Format Rust with `just fmt` before `just fmt-check` judges it.
5. **Turn the test green by asserting the claim, not the outcome.** The proof is checked by Lean during `verify`. The conformance test fixes what that proof is about: the theorem's exact statement, its axiom list, and that the response the application returns is decided by the proved function. Mirror the template's `contract_tc_01`. A weakened statement would still verify; only this test catches it.
6. **Plant the defect, then restore.** For each claim, break it once and confirm the intended gate refuses it with a diagnostic that names the defect. Record the defect, command, diagnostic and restored result.
7. **Run `just vv` to completion** in the image `prismpm.lock` selects. Nothing short of it is acceptance.

## Shaping a decision so the proof means something

- **Total and fail-closed.** Every request maps to exactly one outcome. Admit one explicit code per dimension and refuse everything else, including codes nobody has defined yet. Give malformed input its own outcome rather than a default success.
- **Two forms, one theorem.** Write the decision as a `Bool` function the guest runs and as a `Prop` a person reads, then prove `(decide x = true) <-> (Decide x)`. That theorem is the claim. State a separate theorem only when you will also prove it.
- **Axioms are declared exactly.** A declaration's `axioms:` list must equal the set Lean observes; a missing or extra axiom is refused (`LLV7005`). Do not guess the set: declare none, run `verify`, and read the diagnostic, which names the declaration and the observed axioms. Byte indexing brings `Quot.sound` and `propext`, and every definition that calls it inherits them. `lexlean explain <code>` prints a diagnostic's registered meaning.
- **Vectors cover every outcome class and each boundary:** the admitted case, each single-dimension refusal, a combined refusal, a too-short request, a too-long request and the empty request. A vector the model contradicts is refused at verify (`PP5301`).
- **Bound the guest.** Declare request, response and allocation maxima and leave capabilities empty unless a capability is itself the claim. Include a vector whose request is exactly the allocation maximum; a vector set without that boundary is refused (`PP2009`).
- **Inputs are facts taken on trust.** The proof covers the decision over the request bytes. It says nothing about whether those bytes are true. Name the party that asserts each input.

## When the model cannot say it

If the intended behaviour needs file IO, network, mutable state, unbounded lists or free-text interpretation, record it as a design blocker. Do not move the claimed semantics into Rust, Python or JavaScript beside the model and keep calling the result Prism-built. Code outside the model may carry bytes to and from the application; it may not decide.

## Exit

Hand `prism-proof-audit` the exact source and SDK pins, the authored model paths, the registered IDs with their scenario and test names, the planted defects and their diagnostics, the gate outputs and the limits. If no model passed the complete gate, the status is **NOT_IMPLEMENTED**.
