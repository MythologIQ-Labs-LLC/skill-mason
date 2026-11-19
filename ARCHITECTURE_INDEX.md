# Skill Mason Architecture Index

**Role:** Mandatory root architecture entrypoint. It is a **routing contract**, not the canonical decision register, second architecture authority, sign-off, test result or implementation claim.

The **one canonical architecture-owner register** is [docs/README.md](docs/README.md). Start there before planning, reviewing, implementing, changing documentation or substantiating an architecture-affecting change. It identifies the exact owner of each scoped claim, including the proposed architecture and ADRs.

## Mandatory Qortara-style rules

1. Resolve the current **accepted** subject decision/contract and exact revision; a later file, code change or test PASS does not silently supersede it.
2. Record architecture drift when code, docs, contract or evidence disagree. Preserve the conflicting revisions, effects and owner.
3. A proposal must name the current owner, replacement claim, dependencies/consumers, security and authority effects, migration and regression obligations.
4. Update the owning decision/contract **and its registration in docs/README.md together**, with explicit accepted supersession once actual owner approval is established.
5. Validate the entrypoint/register, direct registration of `docs/architecture/*.md` documents, link integrity and non-disableable repository-document requirements with the genuine Qortara local checker when available. Structural checks do not certify semantic correctness.
6. Governed activity and Shadow learning evidence belong in `.qortara/` and must be written by their canonical runtime, not by editing a Markdown report or agent memory.

**Maturity:** Development repository. The mandatory source-document baseline was merged in [PR #2](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/2), and owner security/contribution policies in [PR #20](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/20). The first real native Qortara checks on six exact Skill Mason revisions are preserved in [isolated evidence run #44434601424](https://github.com/MythologIQ-Labs-LLC/qortara-logic/actions/runs/44434601424): `architecture-index` passed; `repository-documents` and `check all` failed on the previously missing ledger genesis and document-section classification. [Issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4) tracks the corrective candidate and repeat qualification. Actual host acceptance, independent private-reporting verification, branch enforcement and owner adoption of proposed ADRs remain **not established**.
