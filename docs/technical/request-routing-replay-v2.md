# Untuned request-routing replay: adversarial 46-case holdout

**State:** experimental evaluation only, no model adoption or user-facing route selection. Related [generator acceptance #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17) and [first 45-case screen](verdant-request-benchmark-v1.md).

## Question

The first author-labeled benchmark showed a large retrieval improvement (30/39 top-1 vs 0/39) on 13 ungoverned workflow descriptions. Does the **exact same already-merged** retrieval implementation generalize to different requests and abstain when the user explicitly *negates* an outcome or presents multiple incompatible interpretations?

### Frozen method

- **Candidate:** `scripts/evaluate_request_language.py:GroundedLexicalRetriever` from the existing main baseline. No new classifier, new thresholds, keyword aliases, or model training introduced in this change.
- **Reference:** same 13 `DRAFT_NOT_GOVERNED` objectives and supporting declared inputs/outputs/acceptance/dependencies. No source rights implied. The original Skillz graph itself stays pinned to the 1,043-record handoff and historical source bytes.
- **New test inputs:** [46-case author-labeled holdout](../../benchmarks/request-routing-adversarial-v2.json), constructed as 26 new capability requests (two per route), 12 outside-the-13-route requests, and 8 explicit negations, multi-capability or undecided requests. These prompts are distinct from the first 45. They were fixed **before** original-source replay. Their labels are **not independently human adjudicated**, and outside-13 does not mean outside all 247 Skillz routes.
- **Acceptance bar declared before execution:** at least 19/26 correctly routed, at most 1/26 wrong non-abstaining route, exactly 0/12 false positives outside the evaluated routes, and exactly 0/8 positive selections for ambiguous/negated requests.
- **Adversarial boundary:** Wrong/confident selection matters independently of top-3 recall. Hard negations must not be treated as positive instructions. An accepted benchmark would only justify *separate* human adjudication, **not automatic route selection**, license approval, Prism admission, or source composition.

The read-only executor [`scripts/replay_request_retrieval.py`](../../scripts/replay_request_retrieval.py) imports the existing frozen retriever unchanged, evaluates the real original Skillz `CapabilityGraph.search` in parallel, and publishes the exact per-case results with stable input hashes. An adverse metric produces a **NO-GO decision while CI still passes** if the executable correctly measures it; CI is evidence-integrity, not product acceptance. There is no Rust/Prism SDK, Verdant model, model inference, or additional production integration in this job.

```gherkin
Feature: New retrieval must earn the right to be considered
  Scenario: Different task vocabulary
    Given the previous model and thresholds are frozen
    And twenty-six new task descriptions have experimental route labels
    When the actual pinned Skillz graph and the frozen retriever classify them
    Then report correct, wrong, and abstained independently, with raw receipts
    And report an adverse result rather than tuning against this holdout

  Scenario: Explicit negative or undecided user intent
    Given eight users explicitly reject or leave their desired capability unclear
    When the retriever runs
    Then record every accidental confident route as an unsafe false positive
    And never call Prism, source rights gates or the composer

  Scenario: Source or label integrity changed
    Given the exact source pin or cardinality differs
    When replay begins
    Then reject the benchmark without a success-shaped report
```

**Next legitimate step:** If this stricter replay fails, prefer evidence-backed ambiguity/negation handling or a manual choice UI over adding a new model. If it passes, independently adjudicate a fresh sample, then offer read-only *candidate* suggestions through normal `create` UX without allowing a classifier to become source authority. In either case, first positive rights-qualified Skill Mason output remains the product milestone.
