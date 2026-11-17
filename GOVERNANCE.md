# Skill Mason Governance

**Status:** Proposed repository-specific governance baseline, pending owner acceptance in [PR #2](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/2). This file does not authenticate an approval, relax GitHub permissions, or prove that the Qortara native host gates ran.

## Owner, roles and intent

- **Accountable project owner:** MythologIQ Labs, LLC retains product direction, repository governance, security posture, legal/licensing, merge, release and deployment decisions.
- **Maintainer model:** Solo-developer owner workflow is the stated working context. Owner-authorized adversarial review is an acceptable form of challenge; do not invent a second required human. Actual GitHub protections and host permissions remain separately authoritative.
- **Repository visibility:** GitHub reports **public** as of 2026-11-17. Visibility does not establish contribution policy or license rights.
- **Contribution intent:** `NOT_ESTABLISHED` until the owner explicitly confirms closed / invited / open. Repository visibility is not evidence of contribution policy.
- **Maintainers and agents:** May propose/review/modify only as independently authorized for the specific task, repository, branch and host. Tool access or an agent statement does not constitute owner acceptance.

This project implements a skill generator. It consumes `Knapp-Kevin/skillz` as a read-only upstream source and does not gain authority over that repository.

## Canonical architecture and decision flow

1. Start from [ARCHITECTURE_INDEX.md](ARCHITECTURE_INDEX.md) and its **one** [owner register](docs/README.md).
2. Read the accepted ADR or contract that owns the particular subject. The current foundation ADRs are **proposed**, not silently accepted because they exist in Git.
3. Identify the accepted source revision, branch origin and candidate revision before a consequential architectural change. An apparently newer document or commit cannot supersede the accepted subject-owner decision.
4. Record unresolved drift between design, implementation, evidence or policy as a defect. Include impacted consumers, security/authority consequences, required revalidation and the relevant owner.
5. In one reviewed change, update the owning decision/contract, the owner register and affected README/instructions/tests. Explicit supersession names the old and new owners, scope, rationale, authorized acceptance revision and affected evidence.
6. Qualify the **exact revision** through applicable local checks, adversarial review and any genuinely required host-side assurance. CI green, file hash, proposal or remote advisory `ALLOW` is not merge/release authorization.
7. Owner or authorized delegate alone accepts consequential merges, deployment, publication, risk acceptance, rights changes and governance-policy amendments; platform permissions and branch protections still govern the action.

## Changes, exceptions and escalation

Make governance, architectural or security changes reviewable on a branch/PR. Adversarial review records the reviewer/model/method, exact revision, findings and limitations; it is not mislabeled as a non-author GitHub approval.

An exception or amendment must identify the current rule, proposed difference, owner, scope, reason, risk, compensating measures, expiry/rollback where applicable and required verification. **No repository-editable opt-out** may suppress mandatory `GOVERNANCE.md`, `SECURITY.md`, root architecture-index or canonical-register requirements. On unresolved authority, security contact or missing assurance, record `NOT_ESTABLISHED` and block the protected action.

## Evidence and learning

The [governed evidence layout](docs/technical/governed-evidence.md) defines the **single** canonical `.qortara/shadow.jsonl` and chained ledger/gate family. Generated reports and issue descriptions are views, not alternative authoritative stores. No direct hand-editing of event records, fake sessions, backdated audit PASSes or fabricated owner signatures.

## References

- [Security policy](SECURITY.md)
- [Architecture entrypoint](ARCHITECTURE_INDEX.md) and [canonical owner register](docs/README.md)
- [Proposed Skill Mason governance decision](docs/adr/0002-qortara-governance-adoption.md)
- [Qortara Logic ADR-0025](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0025-canonical-architecture-index-oversight.md)
- [Qortara Logic ADR-0027](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0027-mandatory-repository-document-governance.md)
