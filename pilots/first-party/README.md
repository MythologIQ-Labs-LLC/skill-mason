# Original first-party text-review pilot methods

These two procedures were **authored for Skill Mason** as original, instruction-only development examples. They are not copied from the external `skillz` catalog and contain no scripts, bundled assets, credential requirements or network dependencies.

| Source procedure | Explicit outcome | Original Git blob SHA-1 | Pinned SHA-256 |
| --- | --- | --- | --- |
| [CI failure triage](ci-failure-triage/procedure.json) | `triage CI failure` | `23bd3a94a3da68996f406892dcbb94be247a6db9` | `9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47` |
| [Governance drift review](governance-drift-review/procedure.json) | `review governance drift` | `0d18cb3c2a5a08ad64f395ce3adf48eec88a0c07` | `949abaa21513610ce2d9b4a1b64da75af6edb4b9cea73266979eda85aec043d1` |

The original authoring commit is [`87a6a5965a25af95a50127f26ec5afb404e0f2b8`](https://github.com/MythologIQ-Labs-LLC/skill-mason/commit/87a6a5965a25af95a50127f26ec5afb404e0f2b8). Code in [`src/backend/first-party-pilots.mjs`](../../src/backend/first-party-pilots.mjs) checks both original Git object identities **and independently pinned SHA-256 values** against the bytes in this checkout, then derives the bundled recipe snapshot digest before any candidate generation. A changed source file refuses rather than silently retargeting the procedure.

Each JSON file is a bounded, *declarative, text-only* workflow: when to use and stop, required input evidence, actionable review steps, required evidence for each step, and the output fields to produce. [`text-procedure.mjs`](../../src/backend/text-procedure.mjs) rejects unknown fields, unbounded text and code/tool invocation fields; only this exact schema/version is interpreted into agent-facing steps. Unknown method versions remain quoted as inert source excerpts.

**Ownership and rights:** This is a first-party *authorship candidate*, not a signed publisher or legal reuse-rights certificate. No public redistribution license is established by placing a file in this repository. The pilot's signing key and its four rights/evidence/authority/coverage claims are **ephemeral synthetic fixtures only**, used to demonstrate actual Prism guest execution. No official operator key or user source-rights approval is claimed. The generator therefore emits only `DEVELOPMENT_CANDIDATE`.

## What can be tested

The two procedures are materially different work domains: diagnostic CI-log review and governance-to-evidence reconciliation. Their source bytes and explicit outcomes are preserved in the reproducible `SOURCES.json` and receipt.

The generated `SKILL.md` has Agent Skills-compatible basic frontmatter (`name`, `description`) and substantive, bounded instructions. That **format** is based on the [Agent Skills specification](https://agentskills.io/specification); host *execution* compatibility is not established by static parsing. The positive unit tests run the candidate composer with **mock Prism and fixture source attestations**. The separate [real P0 pilot](../../docs/technical/real-holo-pilot.md) invokes the actual holo in isolated CI but also retains fixture-only rights.

No generated candidate is automatically installed in ChatGPT, Codex, Claude or another host. Real host task behavior and answer quality must be observed before issue #17 can be closed.

## Reproduce locally in a disposable development environment

Prerequisites: Node.js 22+, an isolated/credential-free developer VM or CI runner, pinned `prism-code@0.9.5`, and the exact **17,346-byte** original P0 holo with SHA-256 `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`. Do not run untrusted SDK/build material on a privileged workstation.

```sh
mkdir -p /tmp/qortara-pilot-output
node bin/first-party-pilot.mjs \
  --id ci-failure-triage \
  --holo /absolute/path/to/verified/eligibility.holo \
  --sha256 9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e \
  --output-root /tmp/qortara-pilot-output \
  --dev-p0-fixture
```

Substitute `--id governance-drift-review` for the second original procedure. The output is a new folder whose name matches the Agent Skills frontmatter. It includes `SKILL.md`, `SOURCES.json`, `RECEIPT.json`, `skill-mason.json` and `.qortara-complete`. The last file is a *development candidate completion seal*, not an authority signature or permission to install. A repeated attempt at the same destination refuses instead of overwriting.

**Do not use the ephemeral fixture signature for production source eligibility.** The command deliberately refuses without `--dev-p0-fixture` or without an exact pinned holo digest. It performs no LLM inference, but it does not currently instrument integrated model-call counts; the receipt correctly preserves `modelCallsMeasured:false`.

The intended next product gate is one real host task per procedure, with recorded input prompt, the generated `SKILL.md`, observed response, checks for missing evidence/unsafe behavior, and negative cases. That requires controlled host execution and owner-accepted source rights, not just another green static CI run.
