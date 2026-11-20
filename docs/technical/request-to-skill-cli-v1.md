# Ordinary request → pinned corpus refusal (development slice 17-A)

**State:** the request-first read-only CLI is integrated on main; this additional C3→C4→C5 same-source binding is a development candidate. No genuine production composer approval or host execution is claimed. This is the **first shared local CLI source-admission seam**, not the completed user-facing skill generator.

## Command

This adds **\`qortara-skills create\`** to the normal [local CLI](../technical/local-cli.md). It delegates to the *already merged* Python C1/C4/C5 catalog, comparison and exact-source preflight. The command never generates a starter, invents expertise, invokes an LLM, creates an installation or substitutes its own Prism eligibility logic. It deliberately refuses until the owner has independently approved source/asset rights, evidence, host authority and essential outcomes. Its source requirements are stricter than ordinary starter drafting.

Prerequisites: Node.js 22+, Python 3.11+, and the exact pinned *read-only* Skillz handoff **plus** the separately checked-out original source revision.

- Published Skillz handoff commit: \`efba572262fc5fa3ff1934b054aa4f15ce149c1a\`
- Original source commit: \`31a8c518dd97b7828adcc728202fa41388a306d7\`
- Original source tree SHA-1: \`e6d5dfeb42bcd7777ddff52605922fead62135ff\`

The runtime checks the original snapshot manifest and source bytes rather than trusting the caller's revision label.

\`\`\`sh
qortara-skills create \
  --request "Build an accessible responsive UI component with keyboard interactions" \
  --route software-engineering/frontend \
  --host ChatGPT \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/exact-source-tree \
  --method governed:anthropic-skills/frontend-design \
  --report /new/path/refusal.json
\`\`\`

The command returns a JSON record with \`schema:qortara/request-to-skill-evaluation/1\` and **exit 2 for a safe refusal**. The output includes the request SHA-256 (not raw request), exact source commit/tree, complete evidence-linked compared candidates (with review statuses and source package-byte state), any unassessed name-only leads, comparison receipt hash, exact inspected governed ID and source binding, all denial codes, and distinct truth flags for rights, host, Prism, composer and production.

**One explicit route is required.** Free-form semantic routing is not justified by the pinned taxonomy and cannot self-select expert procedures. If omitted, the command refuses \`ROUTE_REQUIRED\`. A route absent from the 247 recognized graph refuses \`UNKNOWN_ROUTE\`; a recognized route with no evidence-linked governed review reports \`MAPPING_GAP\` without claiming no skill exists anywhere. Multiple evidence-linked reviews require \`--method governed:REVIEW_ID\` for **inspection only**, not automatic “best skill” selection or eligibility.

Optional on-demand **external** package inspection requires all of \`--method\`, \`--external-checkout\` and \`--external-repository-tree\`. The inspected Git tree must bind to exactly the selected governed record. Full tracked package bytes, nested source reference leads and license pointers are source evidence; they do **not** grant reuse or host rights. Unknown, rejected or retired material remains blocked. Never read live \`skillz/main\` or bulk-copy third-party skills to fill a missing method.

## Full external source inspection through one ordinary request

The normal `create` command now has one auditable **C3→C4→C5 transaction**. When an exact external Git checkout is supplied with a selected governed review, C4 verifies the source tree, every tracked file and package asset-review leads once. C5 consumes **that same in-process C4 receipt**, rather than repeating the checkout scan and potentially seeing a different worktree. C5's refusal binding includes `comparison_receipt_sha256`, `package_inspection_sha256`, snapshot commit/tree, selected review identity and host/route.

The ordinary request evaluator independently compares the C4 package hash, review hash, source snapshot, route, host and final C5 binding digest. It will refuse `COMPARISON_INTEGRITY`, `EXTERNAL_ASSET_REVIEW` or `SOURCE_BINDING_MISMATCH` if these disagree. This does **not** authenticate publisher rights, close dependency references, or authorize asset redistribution.

```sh
qortara-skills create \
  --request "Build an accessible responsive UI component with keyboard interactions" \
  --route software-engineering/frontend --host ChatGPT \
  --handoff /pinned/skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout /pinned/skillz-source \
  --method governed:anthropic-skills/frontend-design \
  --external-checkout /pinned/anthropics-skills \
  --external-repository-tree d482eba557f7b2035c8a83589809628b96f6f40e
```

The exact pinned upstream checkout `anthropics/skills@8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` contains two verified files under the governed frontend-design method, including `LICENSE.txt`. The correct result is **exit 2, `RIGHTS_UNRESOLVED`**, `exact_source_package_bytes_verified:true`, `comparison_reused_for_preflight_without_second_source_scan:true`, `selected_package_comparison_source_bound:true`, and no composer or host invocation. Changed Git tree or missing original bytes must be rejected before the C5 fact vector. CI runs the real source through **both** direct Python and the user-facing Node CLI, checks byte-identical JSON, and exercises the wrong-tree refusal.

```gherkin
Feature: One source inspection is preserved through user-driven admission
  Scenario: Complete external bytes are not genuine reuse permission
    Given the exact verified frontend-design repository and reviewed method
    When the ordinary CLI evaluates the request through C3, C4 and C5
    Then C3 runs once and C5 binds the same complete package review receipt
    And the CLI records the exact source and license-review evidence
    But it refuses RIGHTS_UNRESOLVED and does not create a skill

  Scenario: A source changes or an intermediate receipt is replaced
    Given the source commit or package review differs from the selected C4 evidence
    When C5 is asked to use that evidence
    Then the request fails with a typed source or receipt mismatch
    And no Prism, composer or host call occurs
```

## What “done” looks like in this slice

| Condition | Expected actual result |
|---|---|
| Known reviewed method but missing genuine rights | `RIGHTS_UNRESOLVED` and all missing facts; no composition |
| Missing evidence-linked review | `MAPPING_GAP`, not “source does not exist” |
| Multiple reviewed alternatives | `METHOD_SELECTION_REQUIRED`, no fictional winner |
| Rejected source | `STATIC_REVIEW_REJECTED`, no candidate promotion |
| Attempted fixture authority bypass | `UNTRUSTED_PROMOTION` or CLI `USAGE`, no P0 bypass |
| Actual independently authorized source and host | **Not established yet.** No false positive skill |


The CLI's negative output says \`inference_calls_observed_in_this_python_entrypoint:0\`, but \`end_to_end_inference_tokens_measured:false\`: this slice performs no model inference, yet does not falsely certify the whole pipeline's zero-token accounting.

## Gherkin acceptance tests

\`\`\`gherkin
Feature: An ordinary request uses reviewed sources without self-authorization
  Scenario: Reviewed bytes do not grant reuse
    Given a pinned review for frontend design
    And full source identity can be checked
    But no independent rights, evidence, authority and coverage approval exists
    When the ordinary qortara-skills create command evaluates the request
    Then it returns RIGHTS_UNRESOLVED with source and package gaps
    And the composer, Prism guest and host are not invoked
    And no production-eligible package is created

  Scenario: No governed review maps to a requested capability
    Given the route is recognized in the pinned capability graph
    But it has no evidence-linked governed review in that snapshot
    When the user requests that exact route
    Then it returns MAPPING_GAP and preserved unassessed leads
    And it does not invent a method, rights assertion or source absence

  Scenario: A forged positive result attempts to bypass C5
    Given untrusted caller-provided eligibility or rights text
    When the ordinary CLI verifies the evaluator's result
    Then it refuses UNTRUSTED_PROMOTION
    And no report file is overwritten or approved
\`\`\`

The [regressions](../../tests/test_request_to_skill.py) and [Node CLI tests](../../tests/local_cli.test.mjs) prove these narrow contracts with negative controls. [Real original source CI](../../.github/workflows/request-to-skill.yml) checks actual pinned \`anthropic-skills/frontend-design\`, a real unmapped outcome, and JSON-equivalent delegation between the Node CLI and Python source coordinator. These tests must be **executed successfully** before any merge claim.

## Still open: full #17 and #30 delivery

This is deliberately **not** a positive release path. Source-rights issuance, trusted signatory/revocations, normal deterministic authorized composition, exact P0/P2 assurance, actual host-loaded ChatGPT/Claude task behavior and end-user Pages parity are still independent gates. The existing [P0 first-party pilot](../../bin/first-party-pilot.mjs) remains separate, requires explicit fixture consent and is labeled \`productionEligible:false\`. The public [Pages app](../../web/app.mjs) still creates only clearly labeled starter drafts and must not claim to use this Python interpreter or privileged file-system source access. GitHub Pages cannot host the local Python/Prism backend.

**Next authorized development slice:** source/asset authority intake and a real operator-approved positive composition path with independently held keys and revocation evidence; then a human/host integration check. No synthetic signer becomes trusted merely because this CLI is live.


## Source-bound essential-outcome gap in ordinary \`create\`

Each accepted exact route now reports \`source_outcome_coverage\` in the same refusal JSON as C3/C4 source inspection. The receipt binds the actual pinned C2 outcome row (\`registry/capability-outcome-register.json\`) to a SHA-256 digest and checks that the independent C4 comparison agrees on definition status, count, and recorded qualification count. Missing, malformed or mismatched rows refuse; a mismatched comparison refuses \`OUTCOME_COMPARISON_DRIFT\`.

The actual pinned \`software-engineering/frontend\` route has two linked reviewed source methods but **zero** registered essential outcomes. The existing primary source/rights refusal is retained, and \`OUTCOME_DEFINITION_MISSING\` is added as an independent actionable blocker. A populated register instead reports \`OUTCOME_QUALIFICATION_UNVERIFIED\`, even if the source metadata contains a positive qualification count: source metadata is not independent acceptance. Neither condition invokes Prism, the composer, a host, or an install.

The existing thirteen proposed workflows are review drafts, not part of this signed source snapshot. They must be accepted upstream and imported through an explicitly verified next snapshot before they affect actual coverage. The real pinned-corpus workflow asserts the empty frontend outcome and exact ordinary Node/Python refusal parity. No new SDK workflow or additional full-Prism execution was introduced for this read-only feature.

## SM-01C: Verified negative source scope in the actual Create response

The normal \`create\` evaluator now binds the one published, **negative-only** source-to-outcome review for \`security/supply-chain\` plus \`governed:local-skills/mcp-vetting\`. On a matching selected method, it re-verifies the original pinned source package and exact textual observations through the already implemented source-scope reviewer before adding \`METHOD_SCOPE_UNESTABLISHED\` and a \`reviewed_method_scope_gap\` receipt to the ordinary refusal JSON. The receipt identifies the source, full-package/source/proposal/review digests, unsupported broader outcomes and the narrower candidate workflow, without duplicating the original skill's full instructions.

This is a separate, **additive denial**: the primary \`RIGHTS_UNRESOLVED\` response and \`OUTCOME_DEFINITION_MISSING\` hold remain. A wrong source/route/pin or a review that asserts approval refuses with \`SCOPE_REVIEW_INTEGRITY\`. The evidence record does not establish that a new narrow workflow is approved; its source and rights remain subject to the independent Skillz review, scoped owner acceptance and accession steps. Other routes with no published scope review are explicitly \`null\` rather than silently treated as matching.

No new composer, Prism invocation, host activation, inferred source authorship, generated package or new CI workflow is introduced. Existing request-to-skill CI compares real original-source Python results against the ordinary Node.js CLI byte-for-byte, including the scope-gap receipt. This is not yet a positive skill-generation path.


## Exact original task references during `create`

For the pinned first-party Skillz originals `repo-doctor`, `agent-postmortem`, and `permissions-review`, an explicitly selected evidence-linked review now also returns `reviewed_original_task_reference`. It includes four verified original-source citations, the full source-reviewed narrow task and five acceptance scenarios, the unchanged complete-package source inventory digest, and explicit broader exclusions. Users can see the **actual scope** of a selected method in their normal `create` refusal instead of having to separately invoke `task-fit`. The three source reviews are reverified against the same pinned snapshot and original source bytes. An unreviewed source still returns `null`; nothing is invented.

This does **not** infer whether the user's free-form request semantically matches the reviewed narrow method. The registered taxonomy route is an evidence crosswalk only. For all three reviews, `task_semantically_matched_to_user_request:false`, `source_rights_qualified:false`, `outcome_coverage_qualified:false`, `host_validated:false`, and `composition_eligible:false`. The normal primary `RIGHTS_UNRESOLVED` refusal is retained and `ORIGINAL_TASK_FIT_UNQUALIFIED` is added as an explanatory secondary blocker. No source is licensed, composed, installed or executed. The existing independent `task-fit` CLI remains available.

CI exercises all three original pinned methods in the ordinary Python request, cross-checks the repo-doctor result against the Node `create` output, and plants forged source/route, asset, approval and host-claim variants that must refuse.
