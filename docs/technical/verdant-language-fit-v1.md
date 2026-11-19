# Verdant language fit evaluation: decision before integration

**Status:** evaluation experiment; no production integration authorized. **Owner outcome:** [issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17). This is a source compatibility screen, not a native performance or host acceptance result.

## Why this exists

Skill Mason needs to understand requested outcomes and match proven expert methods before deterministic composition. Its current route search is lexical; its real request CLI requires an explicit route and refuses creation when rights or outcome evidence is unavailable. Language understanding may help, but no model output can self-attest rights, security, operator authority or host effectiveness.

A user proposed adapting Verdant Engine's embedded language capability rather than immediately integrating an unrelated local LLM. We should measure benefit before committing to another runtime.

## Source inspection, exact pinned revision

- Upstream **Verdant Engine**: `afflom/verdant-engine@9e356f25dce15ae15dfd87169baf0fb0fba549a5`, license MIT OR Apache-2.0 (at repository level; no authorization to copy third-party nested materials inferred).
- `crates/verdant-core/src/cybernetics.rs`: `CodedSlmDirector` handles natural-language and observer-state inputs by keyword-derived features, compressed two-layer neural computation, and one of **16 engine-specific intent slugs**. Weights are constructed deterministically in Rust, not a general-purpose pretrained text generator.
- `crates/verdant-core/src/observer.rs`: `VerdantLanguageEngine` implements NPC dialogue acts, lexical passage matching, `coded_gemm` scores over grounded `knowledgeFacts`, and explicit abstention. Its world-state and character dependencies are not a reusable skill-request compiler without adaptation.
- `crates/verdant-cli/src/lib.rs` exposes the **real** `route-intent` command; an optional native comparison may call it explicitly.
- The 13 distinct Skill Mason workflow objectives are from `docs/technical/essential-workflow-proposals-v1.json`, which are **DRAFT_NOT_GOVERNED**, not accepted rights/coverage evidence.

The bounded read-only screening script `scripts/verdant_fit_eval.py` checks the exact source revision, counts the advertised intent interface and draft workflow routes, and refuses to invent an adapter mapping. It never runs model inference unless explicitly passed a real Verdant CLI binary. The native CLI score is a raw ranking value, not a calibrated confidence or proof. There is no source reuse or host permission granted by this experiment.

### Gherkin compatibility screen

```gherkin
Feature: Evaluate Verdant before adopting its language engine
  Scenario: The upstream route interface is engine-specific
    Given a pinned original Verdant source revision with sixteen engine intent labels
    And thirteen distinct ungoverned Skill Mason workflow requests
    When we inspect direct interface compatibility
    Then we record the engine labels and source digests
    And we do not mislabel an engine intent as a qualified Skillz route
    And semantic accuracy remains NOT_MEASURED

  Scenario: A native model produces an intent, not skill-source authority
    Given the real Verdant route-intent executable
    When it returns an engine action for a skill-generation request
    Then the raw response is retained as an unmapped engine intent
    And it cannot select, authorize, compose, or validate a source method

  Scenario: Source or benchmark assumptions drift
    Given a changed upstream API or promoted draft workflow
    When the comparison screen executes
    Then it refuses until the assessment is reviewed again
```

## Reproducing the limited screen

The fast isolated CI job checks out the exact Verdant revision and runs:

```bash
python3 -m unittest tests.test_verdant_fit_eval -v
python3 -m scripts.verdant_fit_eval \
  --verdant-repo verdant-evaluation-source \
  --proposals docs/technical/essential-workflow-proposals-v1.json \
  > verdant-fit-screen.json
```

An **optional manual native experiment**, after installing or building that exact pinned Verdant binary, adds `--verdant-cli /absolute/path/to/verdant`. Its results will be raw upstream intent labels, not skill-route predictions, unless a separately evaluated mapping adapter exists. No expensive Verdant cargo build is scheduled on routine Skill Mason CI.

## Go / no-go for a proposed language layer

**Direct Verdant router adoption is NO-GO:** its action vocabulary is engine-specific, and it has no demonstrated general skill-route understanding, essential-outcome extraction or method-authoring capability. A syntactically valid response is not sufficient evidence.

**Adaptation remains an experiment**, and must earn adoption through a separate held-out benchmark of **at least 30 consented, non-sensitive requests** across independent capability domains, comparing (A) existing lexical/exact-route search, (B) an adapted Verdant language retrieval path, and optionally (C) another suitable local language model. Log the actual independent expected outcomes and corresponding ground-truth routes, top-1/top-3 route accuracy, essential-outcome precision/recall, calibrated abstentions, latency, RAM and genuine inference invocation/token accounting. Do not label Skillz draft objective text as verified method truth.

Pilot acceptance should require a **material improvement over baseline**, not merely different wording, with **zero fabricated rights, unearned coverage, host permissions, or production claims**. Include out-of-domain and adversarial requests; pass unqualified model proposals to the existing independent Prism gates rather than treating them as approved. Only after an improvement is demonstrated should an optional isolated adapter be implemented. Deterministic assembly's zero-model-call claim remains a separately instrumented property.

**Current verdict:** Verdant offers relevant grounding/abstention *ideas*, but its currently shipped embedded language surface is not the missing general-purpose skill authoring engine. Resist integrating it until the above behavioral evidence proves added value.
