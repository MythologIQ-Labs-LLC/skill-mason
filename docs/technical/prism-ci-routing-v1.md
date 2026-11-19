# Evidence-aware Prism native CI routing (development P0)

**State:** Fast, fail-closed routing proposal implemented as a separate workflow on the trusted \`main\` branch. It is **not a full native gate pass**, an SDK trust-root decision, release authorization, or an automatic skip for active draft #15 until that PR's workflow deliberately consumes the tested decision. The original \`just vv\`, nested ratchet, negative controls and disposable-runner execution are unchanged.

## Why this exists

Five consecutive successful native Prism runs on #15 averaged **39.2 minutes elapsed** (range 32.9–44.8 minutes) and repeatedly produced the same pinned 17,346-byte Qortara Skills Eligibility holo. The last full rerun occurred after unrelated corpus/compiler files had been merged into the active Prism branch, despite unchanged trusted Prism inputs. The earliest full runs caught an actual nested ratchet bypass and ignored package lock, so dropping native verification entirely would be irresponsible.

Two distinct facts must remain separate:

- **A Git commit changed:** the repository still needs normal CI, docs/security, exact tree and native Qortara checks.
- **Inputs actually executed by the isolated Prism SDK changed:** a new full reference + author + nested/negative acceptance is essential. If any such input is unknown, changed or not independently evidenced, the router returns \`FULL_NATIVE_REQUIRED\`.

## Existing successful P0 observation

The separately pinned [observation record](../../.github/prism-ci/previous-p0-observation.json) points to [workflow #44437233577](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44437233577), head \`70ee027a1bfbcf05c98e80833c93b779c8e5fe8b\`, and records full reference/author/nested/real-output jobs and four original nonexpired GitHub artifacts. Every routing decision independently checks GitHub's **actual run head, success, required jobs, artifact identities and expiry** through a read-only API token; the manifest itself does not manufacture success. This observation is **P0 unverified**, not P2, and the SDK publisher is not owner-trusted.

## Trust-input boundary and fail-closed decisions

[\`scripts/prism_ci_route.py\`](../../scripts/prism_ci_route.py) must run from trusted base code, not a PR's copy. It compares actual Git blob/path differences from the pinned successful observation commit to the proposed candidate. It requires direct ancestry and an exact immutable commit ID. Every changed path must be in a **conservative explicit non-native allowlist**: documentation, backend composer-only files, first-party pilot fixtures, and unrelated source-only workflows. Changes in \`prism/**\`, \`prism-overlay/**\`, SDK pins, all native gate/ratchet/egress scripts, the holo CLI, unknown paths, Git configuration, routing logic or the observation record force full native qualification.

An **installed \`prism/\`** instance always requires a new *installation-qualified* native baseline; the current observation was created before installation. Evidence unavailable, expired artifact, failed nested job, changed publisher image/template/runtime pin, fork, missing ancestry, ambiguous Git file name, or explicit owner full request also forces a full run. A matching holo digest alone is never enough for evidence reuse.

The router outputs one of:

- \`FULL_NATIVE_REQUIRED\`: the previous observation cannot replace a full run; retain the native security gate as required.
- \`REUSE_PREVIOUS_P0_OBSERVATION\`: exact native input closure has not changed and every prior full-run artifact was independently confirmed; an integrated future workflow may avoid a *duplicate development P0 observation* while retaining the prior full evidence and all ordinary current-head checks.

**Neither routing result says PASS, eligible, owner GO, production-ready or approved SDK.** Normal repository-source/security/host acceptance and actual native Qortara merge checks remain separate.

## Workflow security

[\`prism-ci-routing.yml\`](../../.github/workflows/prism-ci-routing.yml) has a fast \`pull_request\` test job and a \`pull_request_target\` observation job, both with **read-only** content and Actions permissions, timeouts and no SDK. The target job checks out the trusted base commit and only *fetches* the proposed Git commit as data. It **never checks out or executes PR source**, runs user-supplied scripts, uses secrets or grants workflow write permissions. Forks always receive \`FULL_NATIVE_REQUIRED\`.

The currently active [#15 native SDK workflow](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15) is intentionally untouched. After the fast workflow qualifies, its owner can wire routing as a *mandatory before-SDK decision*, **never** as a replacement green check. A full release / installation still requires real native SDK qualification when its trusted inputs or trust root differ. Guard against job-skipping-as-success by retaining a required final qualification check that verifies either full SDK jobs completed at this exact input closure, or the verified historical P0 observation with unchanged closure and current-head policy checks.

## Gherkin acceptance

\`\`\`gherkin
Feature: Avoid redundant P0 SDK execution without bypassing native qualification
  Scenario: Only unrelated backend and documentation changed
    Given a previously observed full native run with verified job results and artifacts
    And the entire trusted Prism executable and input closure is unchanged
    When the read-only trusted-base router checks the new Git commit
    Then it returns REUSE_PREVIOUS_P0_OBSERVATION
    But it does not claim P2, source rights, owner GO or production eligibility

  Scenario: Any Prism or unknown runtime input changes
    Given a changed ratchet, native workflow, model, SDK input, CLI or unknown source
    When the trusted-base router checks the changed Git tree
    Then it returns FULL_NATIVE_REQUIRED
    And no previous holo hash alone can satisfy the required native gate

  Scenario: The previous native observation is invalid
    Given a missing job, failed nested phase, expired artifact or unverifiable revision
    When the router attempts to reuse evidence
    Then it returns FULL_NATIVE_REQUIRED

  Scenario: A nested Prism instance is being installed
    Given a prior P0 observation of the staged uninstalled instance
    When the new Git revision contains prism/ source files
    Then the router requires a complete new native installation qualification
    And the prior staged run does not count as enforcement of the installed ratchet
\`\`\`

The [regression tests](../../tests/test_prism_ci_route.py) use disposable real Git repositories, precise renames, signed-off refusal invariants and deliberately malformed GitHub job/artifact responses. CI additionally compares the **actual** previously qualified source \`70ee027\` and later \`25bd1ee\`, which changed unrelated code but no native runtime input, against the **live GitHub Actions** baseline evidence. The test does not run any third-party container.

**Qualification gate for integrating this optimization into active #15:** real observed fast routing tests PASS, native Qortara source-document/architecture/all checks on the exact combined tree, isolated false-negative/adversarial audit, explicit workflow integration review by its active owner, and no regression in the required native SDK/ratchet or release checks. No permanent full-SDK bypass is authorized merely by merging the router.
