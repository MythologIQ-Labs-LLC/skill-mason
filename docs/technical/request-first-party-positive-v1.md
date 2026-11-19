# First positive request-to-generated-skill pipeline (bounded P0)

**Status:** executable development compiler path; not a fully qualified or installed skill. This feature progresses [#17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17), but does not close its acceptance criteria.

## What now works

For the **two original, source-byte-pinned first-party methods** in `pilots/first-party/`, a developer can submit an actual bounded user request, explicitly select the covered capability and original method, invoke the **existing real pinned Prism guest**, and get an entire **sealed Agent Skills development candidate folder** on disk.

The new [request entrypoint](../../bin/request-first-party-pilot.mjs) binds a SHA-256 of the exact user request to its returned build receipt. The request text itself is **not embedded** in the skill or used as a command, signed fact or source assertion. The skill is a **reusable method**, rather than a bespoke answer to one log. Different user requests selecting the same method intentionally produce the same substantive instructions (the ephemeral synthetic fixture signatures/receipts can differ between builds). This is not free-form intent inference; the user must choose exactly one supported capability and corresponding method. Only two bounded capabilities exist:

| Explicit capability | Original source method | Effect |
| --- | --- | --- |
| `triage CI failure` | `ci-failure-triage` | Grounded review of a supplied failure log without network, secrets or command execution |
| `review governance drift` | `governance-drift-review` | Compare supplied canonical requirements with actual implementation evidence, without editing policy |

Both original methods are tracked at `87a6a5965a25af95a50127f26ec5afb404e0f2b8`. This Git authorship and byte identity are **not a public distribution license**. This new command does **not** connect the upstream Skillz corpus, infer rights, or implement the full general-purpose qualified generator.

## Run from a trusted developer checkout

Node 22+ and the previously pinned original P0 holo/runtime are required, as in the existing [real-holo development acceptance](real-holo-pilot.md). The P0 holo identity remains SHA-256 `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`.

```sh
node bin/request-first-party-pilot.mjs \
  --request "Triage the supplied failing CI job and propose the smallest evidence-based verification" \
  --capability "triage CI failure" \
  --method ci-failure-triage \
  --host agent-skills-text-only-fixture \
  --holo /absolute/path/to/pinned/eligibility.holo \
  --sha256 9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e \
  --output-root /absolute/existing/empty/output-parent \
  --dev-p0-fixture
```

The command either refuses before output or produces `<output-root>/ci-failure-triage/` containing `SKILL.md`, `SOURCES.json`, `RECEIPT.json`, `skill-mason.json`, and a hidden `.qortara-complete` seal. The returned JSON includes `state:GENERATED_UNQUALIFIED_SEALED_SKILL`, the request SHA-256, exact method/source/P0 holo identities, the resulting artifact hash, and **`productionEligible:false`**.

**No silent fallback:** if the source method, declared capability or host label mismatches, or the real original holo is unavailable, the command refuses. Existing package write/readback protections detect tampering, redirection through symlinks and incomplete output. No model invocation is added to assembly, but the complete end-to-end inference accounting remains **not instrumented**.

## What passing this test does and does not prove

[Focused request test CI](../../.github/workflows/request-first-party-positive.yml) checks exact original source pins, two distinct method options, user input validation, and absence of output when Prism is missing. For the dedicated first positive PR branch, a limited one-shot integration test also replays the actual previously verified P0 holo and checks that a real request produces the full sealed candidate. No 28-minute Prism SDK build runs on unrelated PRs. The standard [manual real-holo P0 acceptance workflow](../../.github/workflows/real-holo-candidate.yml) also executes this request path and retains its output for subsequent authorized runs.

**This is meaningful but incomplete:** synthetic ephemeral four-fact signatures do not prove rights, operator authority or source review; the P0 guest has no approved production trust root; and a generated skill is not automatically observed in an actual consuming agent host. Real host-task testing has its own [A/B workflow](../../.github/workflows/first-skill-host-acceptance.yml), which still needs an owner-authorized external model credential or independently authenticated host result. We will not rename an unqualified candidate to claim the milestone.

The next development move is to replace the *fixture-signed* positive path with genuinely owner-accepted source evidence, preserving the same skill output and request UX, then run one actual consuming-host task.
