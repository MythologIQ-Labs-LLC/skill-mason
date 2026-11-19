# Ordinary request → pinned corpus refusal (development slice 17-A)

**State:** implemented on the request-first development branch; no legitimate production composer approval or host execution is claimed. This is the **first shared local CLI source-admission seam**, not the completed user-facing skill generator.

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

## What “done” looks like in this slice

<escape><table>
<tr><th>Condition</th><th>Actual result</th></tr>
<tr><td>Known reviewed method but missing genuine rights</td><td><code>RIGHTS_UNRESOLVED</code> + all missing facts, no composition</td></tr>
<tr><td>Missing evidence-linked review</td><td><code>MAPPING_GAP</code>, not “source does not exist”</td></tr>
<tr><td>Multiple reviewed alternatives</td><td><code>METHOD_SELECTION_REQUIRED</code>, no fictional winner</td></tr>
<tr><td>Rejected source</td><td><code>STATIC_REVIEW_REJECTED</code>, no candidate promotion</td></tr>
<tr><td>Operator tries to supply fixture authority</td><td><code>UNTRUSTED_PROMOTION</code> or CLI <code>USAGE</code>, no P0 bypass</td></tr>
<tr><td>Exact accepted rights, host, outcomes</td><td><strong>Not yet independently available</strong>. No false positive skill</td></tr>
</table></escape>

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
