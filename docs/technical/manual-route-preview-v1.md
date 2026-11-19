# Optional request-to-route preview: human choice required

**State:** experimental, read-only CLI feature under [issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17). This is **not** auto-routing, approved source selection, method composition, or a finished skill.

## Why

The independently executed [adversarial replay](request-routing-replay-v2.md) found that a bounded lexical retriever matches 19/26 new in-scope requests, but makes positive selections on **6/8 negated or ambiguous requests**. That predeclared acceptance failure prohibits automatic routing.

However, its matches may still help a user manually explore the available opportunity space. The experimental Python CLI now exposes **unassessed, user-confirmed discovery leads only**. It never selects a route, and existing `create` still requires the user to supply `--route`. There is no new network/model/third-party runtime dependency.

## Execute against original pinned sources

Requires Python 3.11+, historical Skillz handoff, and its separately verified original source checkout (as already required by `create`). The ordinary Node `qortara-skills` command is deliberately unchanged so this preview does not trigger unrelated full native Prism SDK qualification.

```sh
python3 -m scripts.manual_route_preview \
  --request "Check signed packages and build provenance before shipping a release" \
  --handoff /original/skillz/registry/exports/skill-mason-v1 \
  --source-checkout /original/skillz-source \
  --limit 3
```

The output is a `qortara/manual-route-preview/1` receipt, with `selected_route:null`, source commit/tree and immutable SHA-256 of the exact 13 proposal descriptions, up to three `unapproved_route_leads` with raw lexical similarity **not confidence**, and the explicit warnings `semantic_negation_handling_verified:false` and `user_must_explicitly_select_route:true`. A no-signal or ambiguous numeric score returns `ABSTAIN_NO_AUTOMATIC_ROUTE` and no leads.

The **user chooses** the route separately, by inspecting an exact `qortara-skills routes --path DOMAIN/SUBDOMAIN` receipt or passing `--route DOMAIN/SUBDOMAIN` to the existing read-only `create` evaluator. The method rights, source, host and Prism checks remain unchanged and will refuse without independent authorization. Preview does not choose a method, load/execute any skill, authorize source redistribution, run a model, or provide a user-host acceptance result.

**Scope caveat:** the displayed routes are drawn solely from the **13 ungoverned draft workflow descriptions**, not all 247 recognized capability routes, let alone the broad raw source corpus. The draft file's byte hash is pinned to the previously measured experiment. The command's success means it produced an honest *preview*, not that its lead matches are correct. The user must review even when there is one confident-looking candidate.

```gherkin
Feature: An imperfect request router must not choose on behalf of the user
  Scenario: Preview an ordinary request
    Given the exact source snapshot and frozen experimental descriptions
    When a user submits a natural-language request
    Then report only unapproved matching route leads
    And report no selected route, method, source rights, composer, or host result
    And require explicit user choice before a separate admission attempt

  Scenario: A request explicitly negates a capability
    Given the lexical retriever is known to mishandle negative intent
    When the user previews that request
    Then no returned text or JSON can grant route authority or select a method
    And semantic negation understanding stays marked unverified

  Scenario: Candidate output or source is forged
    Given a result claims a method is eligible, a route was chosen, or source pins drifted
    When the Python preview checks the pinned source and candidate fields
    Then it refuses to accept the forged state
```

The [existing request-language benchmark CI](../../.github/workflows/request-language-benchmark.yml) runs the Python preview end-to-end against actual pinned Skillz source bytes, with negative cases. No new recurring SDK/Cargo gate, and no shared Node/Prism runtime changes.

### Adoption threshold

This only authorizes *research-preview availability*, not automatic routing or a production UX default. Evaluate real user choice quality, misleading suggestions, and adverse negation cases before making any suggestion more authoritative. If users do not benefit, remove the preview code rather than retaining a component for appearances.
