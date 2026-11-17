# Skill Mason: Claude Code project-only development entrypoint

These instructions prepare Claude to **develop Skill Mason**. The project-local `.claude/skills/` files are **not catalog entries** in `Knapp-Kevin/skillz`, Skill Mason-generated output, or a substitute for verified UOR tools.

## Phase 0, mandatory, before product implementation

1. Read `AGENTS.md`, root `ARCHITECTURE_INDEX.md`, its **single** `docs/README.md` owner register, `GOVERNANCE.md`, `SECURITY.md`, `docs/RFC-0001-prism-feasibility.md` and `.claude/PRISM_SOURCES.md`.
2. Read `.claude/PRISM_COMPATIBILITY.md`. **There are multiple version-scoped upstream Prism authoring routes.** Do not mix the old template's `.lex.tex`/PrismPM/`just vv` contract with the 0.6 JSON-spec guide or the 1.0-beta `prism` CLI.
3. Read and actually invoke/check discovery of `.claude/skills/prism-source-gate/SKILL.md`, `.claude/skills/prism-model-first/SKILL.md` and `.claude/skills/prism-proof-audit/SKILL.md`. Treat these as self-contained developer skills. Log missing host discovery as `NOT_VERIFIED`, not PASS.
4. Use the source gate to inspect **exact pinned upstream versions** and qualify one real supported full Prism application workflow. Do not infer SDK release availability, a CLI verb, LexLean grammar or guarantee from a future-version page.
5. Run and record a known-good upstream reference application through the selected full gate, with planted negative controls, before implementing Skill Mason product behavior. If this cannot be done, keep the Prism-dependent step on HOLD and document the obstacle.

## Development after Phase 0

1. The Skill Mason outcome/rights/authority decision must have a genuine Prism application authority under the **selected, supported SDK route**, and be built/verified as that route actually requires.
2. The standard-library Rust façade alone does not qualify the application. Equally, claiming the 0.6 spec JSON route while running 0.4.x template commands does not qualify it.
3. Maintain single architecture authority, exact source and SDK pins, refuse missing evidence/rights/authority, preserve untrusted skill text as inert data, and separate compile checks from outside-agent behavior.
4. Never hand-author proofs, conformance results, shadow/ledger JSONL events, gate receipts, operator approvals or license rights.
5. Work in reviewable branches, retain issues #1/#3/#4, and stop at unresolved owner decisions; do not fake a second approver.

## Qualification status (2026-11-17)

- **Skills:** all three were discovered and invoked by a Claude Code host, after an initial `Unknown skill` failure. A session that starts on a branch without `.claude/skills/` does not see them, and a checkout that adds them is not usable until the host refreshes its listing. Confirm each skill appears in the session's skill listing before relying on it.
- **Route:** route A is selected and its upstream reference application passed the complete gate here. See [`.claude/PRISM_COMPATIBILITY.md`](.claude/PRISM_COMPATIBILITY.md).
- **Evidence:** [`docs/evidence/prism-phase0-20261117/README.md`](docs/evidence/prism-phase0-20261117/README.md).
- **Candidate:** one eligibility decision, `SM-01`, is carried in [`prism-overlay/`](prism-overlay/README.md) and passed the complete gate in a rebuilt instance. It is **not adopted**.
- **Hold:** Skill Mason is not a Prism-built application. Adoption waits on owner acceptance of [ADR-0003](docs/adr/0003-prism-application-adoption.md). Do not install a template instance into this repository, replace root `AGENTS.md`, or extend the candidate into general skill generation before that.

Useful entry points: `scripts/prism_instance.sh` rebuilds an instance from the pinned template plus the overlay, and `scripts/prism_reference_gate.sh` runs a checkout's own gate inside the SDK image its lock selects.
