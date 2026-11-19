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

## Qualification status (2026-11-18)

- **Skills:** all three were discovered and invoked by a Claude Code host, after an initial `Unknown skill` failure. A session that starts on a branch without `.claude/skills/` does not see them, and a checkout that adds them is not usable until the host refreshes its listing. Confirm each skill appears in the session's skill listing before relying on it.
- **Route:** route A is selected and its upstream reference application passed the complete gate here. See [`.claude/PRISM_COMPATIBILITY.md`](.claude/PRISM_COMPATIBILITY.md).
- **Evidence:** [`docs/evidence/prism-phase0-20261117/README.md`](docs/evidence/prism-phase0-20261117/README.md).
- **Candidate:** one eligibility decision, `SM-01`, is carried in [`prism-overlay/`](prism-overlay/README.md) as the application **Qortara Skills Eligibility**. Under that name it passed the complete gate in a staged nested instance on the isolated runner on 2026-11-18, with planted defects, an offline repeat and real holo outputs through the probe and the CLI: [record](docs/evidence/prism-qse-20261118/README.md). It is **not adopted**, and its holo is `P0 unverified`.
- **Decision:** the owner accepted the nested `prism/` location as architecture direction only ([ADR-0003](docs/adr/0003-prism-application-adoption.md)). That is a layout decision, not an installation.
- **Hold:** Skill Mason is not a Prism-built application and nothing is installed. The installing commit is a separately qualified change. The runner in issue #9 and a complete gate run on the renamed application now exist. What it still needs is the owner's remaining decisions in ADR-0003: the SDK trust root, the browser frame, who asserts each input code, the network hosts, and acceptance of the companion ratchet. Until then do not create `prism/`, replace root `AGENTS.md`, or extend the candidate into general skill generation.
- **Ratchet:** in a nested instance the template's own `audit-prism` never engages (it looks for its parent gate at a root-relative path), so a passing `just model` in `prism/` says nothing about it. The ratchet is enforced for `prism/` by `scripts/prism_nested_ratchet.sh`, which runs the template's unmodified audit on a projection of the nested instance, accepted baseline then candidate. Always name the baseline from the event (the protected branch's commit), never a first parent. Do not edit anything the audit is built from under `prism/`, do not move the instance, and do not weaken or bypass the companion: the owner made nested enforcement a condition of acceptance. The staged rehearsal shows the mechanism only; continuous enforcement on this repository is an obligation of the installing change (ADR-0003).

- **Runner hold:** do not run the SDK image in any session, workstation or runner that holds credentials, and do not delete or replace the cached image. The native gate runs only through the [isolated-runner workflow](docs/technical/prism-native-gate.md) ([issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)): a pull request that touches the overlay or the gate scripts starts it. While that pull request is a draft the SDK image starts only when the label `prism-native-gate:run` is added or the draft is marked ready; once it is not a draft, every push runs the complete gate. A head is natively qualified only when the `Native qualification decision` check is green for it; a run that did not start the SDK image fails that check on purpose. The wrapper refuses to start anywhere else; treat a refusal as the answer, not an obstacle. Do not run a real holo in a credentialed session either: the workflow's second job does that.

Useful entry points: `scripts/prism_instance.sh` rebuilds an instance from the pinned template plus the overlay; `scripts/prism_reference_gate.sh` runs a clean checkout's own gate, in a staged copy, inside the SDK image its lock selects; `scripts/prism_native_gate.sh` drives the whole qualification on the runner; `scripts/sm01_real_holo_acceptance.sh` runs a built holo through the independent runtime, the probe and the CLI.
