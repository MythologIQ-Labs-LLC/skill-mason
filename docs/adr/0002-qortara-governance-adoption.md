# ADR-0002: Adopt Qortara Logic's repository-governance baseline

**Status:** Proposed adoption in Skill Mason; user-directed requirement. No owner signature, implemented native check or production-host qualification is claimed. **Scope:** Skill Mason repository documentation, architectural routing and local lifecycle evidence.

## Upstream authorities (consult pinned accepted revisions when enforcing)

- [Qortara ADR-0025: canonical architecture index](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0025-canonical-architecture-index-oversight.md)
- [Qortara ADR-0027: mandatory governance and security policies](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0027-mandatory-repository-document-governance.md)
- [Qortara ADR-0009: runtime event store](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0009-runtime-store.md)
- [Qortara ADR-0011: one canonical Shadow log](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0011-shadow-escalation-and-oversight.md)
- [Qortara ADR-0017: governed remediation/closure](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0017-learning-loop-and-remediation.md)

These upstream links are **sources**, not a substitute for fixing the exact accepted revision when running a governed operation.

## Proposed local requirements

1. Root `ARCHITECTURE_INDEX.md` is mandatory and points only to one canonical `docs/README.md` architectural register. Every `docs/architecture/*.md` document gets one direct owner registration, even if proposed.
2. Root `GOVERNANCE.md` and `SECURITY.md` are mandatory and **non-disableable** requirements. Incomplete owner-specific security information is explicitly `NOT_ESTABLISHED`, not a boilerplate PASS.
3. Repository intent must distinguish actual maintainer model, visibility and contributions, **not** infer a review policy or host authority from visibility or a README.
4. Architecture changes identify an owner-accepted subject/version, branch origin and candidate. Conflict is drift; no silent supersession. Link only one real owner per scope and record affected dependencies and tests.
5. Local Qortara runtime owns `.qortara/ledger.jsonl`, versioned gate/intent-lock/provenance evidence and `.qortara/shadow.jsonl` as **one** structured Shadow Genome event file. Logs are written/validated by canonical tooling under locking and integrity rules, not hand-authored events or agent-memory summaries.
6. Events become learning candidates, not automatic policy changes. Remediation closure requires applicable enforcers and a recorded applicable PASS audit, not a neat report or a manually toggled status.
7. Local checks (not hosted evaluator guesses) include `qortara check repository-documents`, `qortara check architecture-index`, `qortara check all` and appropriate `qortara shadow`/ledger verification. Actual CLI availability, version and results must be captured before calling the repository qualified.

## Current implementation and holds

This proposed PR establishes source documentation and an **empty** `.qortara/shadow.jsonl` without inventing history. It does **not** seed fake `ledger.jsonl`, gates, sessions, keys, audits, enforcer evidence or closure. Runtime-ledger integration, non-disableable local Qortara enforcement, accepted security intake, exact upstream pin and host qualification are **NOT ESTABLISHED**.

An auxiliary static file-integrity check may help review links, but it must not claim to be `qortara check all` or replace authoritative native checks.

## Supersession

None; new proposed repository-specific adoption. The future accepted decision must name its effective revision and any scope or exceptions. Upstream Qortara Logic authorities remain controlled by their own product owners.
