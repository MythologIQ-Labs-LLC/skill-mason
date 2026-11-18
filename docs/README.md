# Qortara Skills Documentation and Canonical Architecture-Owner Register

**Role:** The **single canonical architecture-owner register**. [Root ARCHITECTURE_INDEX.md](../ARCHITECTURE_INDEX.md) routes here; this page maps subjects to their real owners and does not itself approve or prove an architectural claim.

## Decision precedence and states

A subject's latest **owner-accepted** ADR/contract controls its design. Source code and versioned schemas own actual implemented behavior, executed receipts own qualification, and release/deployment observations own delivery. A newer Git commit, unreviewed PR, prose summary or passing structural check does not confer supersession or approval.

Use **Proposed**, **Accepted**, **Implemented**, **Qualified**, **Historical**, **Superseded**, each with exact revision and scope when evidenced. An item may be implemented without being qualified; an owner-accepted design can remain unimplemented. Unknown facts are `NOT_ESTABLISHED`.

## Claim ownership register

| Claim / shelf | Single accountable owner / source | Status / boundary |
|---|---|---|
| Project direction, decisions, branch / review / approval rules | [GOVERNANCE.md](../GOVERNANCE.md) with project-owner acceptance | Proposed; owner authentication / exact adoption not established |
| Confidential vulnerability reporting, response and supported versions | [SECURITY.md](../SECURITY.md) | Owner-selected GitHub Private Vulnerability Reporting (PR #20); setting availability and native Qortara verification **not independently established** |
| Proposed Skill Mason product intent, skillz separation and zero-inference semantics | [ADR-0001](adr/0001-product-and-authority-boundary.md) | Proposed; no generated runtime |
| Qortara repository document baseline, single architecture register, runtime evidence/Shadow boundary | [ADR-0002](adr/0002-qortara-governance-adoption.md) | Proposed adoption based on verified upstream ADRs |
| Skill assembly architecture, components, source trust and output contract | [Skill Mason Pipeline v0](architecture/skill-mason-pipeline-v0.md) | Proposed; **direct registration 1/1** under docs/architecture |
| Requirements, stakeholder journeys and feature acceptance | [PRD](PRD.md) | Proposed; no compiled executable |
| Prism implementation feasibility and formal evidence limitations | [RFC-0001](RFC-0001-prism-feasibility.md) | OPEN research; route A reference gate executed, see evidence |
| Where and how a Prism application is adopted beside Qortara governance | [ADR-0003](adr/0003-prism-application-adoption.md) | **Accepted architecture direction:** nested `prism/` by owner (2026-11-17); no installing commit, SDK trust, native checks or runtime qualification yet |
| Prism qualification evidence: commands, logs, receipts and limits | [Qualification record 2026-11-17](evidence/prism-phase0-20261117/README.md) | Executed evidence at exact pins; proposed evidence location; not an approval |
| Candidate eligibility decision `SM-01` (model, scenario, test, patch) | [prism-overlay](../prism-overlay/README.md) | Candidate; verified in a rebuilt instance; not adopted |
| Pinned skillz handoff and actual historical source-byte integrity (no rights granted) | [Read-only catalog inspector](../scripts/catalog_handoff.py), [source-tree byte verifier](../scripts/verify_catalog_source.py), [negative tests](../tests/test_catalog_snapshot.py), [source pins and trust limits](technical/catalog-handoff.md) | Metadata importer and pinned source-byte verification CI implemented and PASS for the declared historical snapshot; this checks source identity and contents only, **not** publisher identity, redistribution rights, coverage, Prism admission or production readiness |
| Development-only Prism SM-01 output probe | [Probe contract and run instructions](technical/sm01-output-probe.md), [real-holo runner](../scripts/sm01_probe.mjs) | Implemented harness; stand-in tests only; actual holo execution NOT_RUN, assurance P0 unverified |
| Public recipe v0 to source-pinned candidate plan (development-only) | [Recipe schema](../schemas/recipe.v0.schema.json), [strict adapter](../src/backend/recipe-adapter.mjs), [mapped-source contract](technical/recipe-v0-adapter.md), [negative tests](../tests/backend_recipe_adapter.test.mjs) | Implemented explicit snapshot/package-byte/host/outcome mapping to candidate composer; fixture-only positive test, no implicit reuse rights, source-authority proof or real target-host acceptance |
| Development-only candidate skill package composer and receipt boundary | [Implementation](../src/backend/compose.mjs), [contract and limits](technical/backend-composer-v0.md), [unit tests](../tests/backend_compose.test.mjs) | Implemented pure deterministic *candidate* packager and exclusive output writer; assertion adapters and Prism guest **mocked in tests**; no independently trusted source rights, live guest, public recipe adapter, host acceptance or production approval |
| Signed source-method assertion verification boundary (development-only) | [Signed assertion verifier](../src/backend/signed-assertions.mjs), [trust and evidence contract](technical/signed-assertions-v0.md), [synthetic adversarial tests](../tests/backend_signed_assertions.test.mjs) | Offline Ed25519 proof subject/issuer/policy/revocation and evidence-bytes checking implemented; operator trust, publisher/rights truth, source custody and live Prism/host integration **NOT_ESTABLISHED** |
| Real compiled Prism guest to signed candidate integration (P0 development test) | [Pinned original holo/manifest evidence](technical/real-holo-pilot.md), [credential-free real-holo CI](../.github/workflows/real-holo-candidate.yml), [actual guest pilot](../tests/real_holo_candidate_acceptance.mjs) | Fixture signed facts and a hash-verified compiled P0 guest are exercised separately from mock-only unit tests; real rights, trusted SDK publisher, P2 proof, target-host behavior and native Qortara checks **NOT_ESTABLISHED** |
| Bounded Prism CLI guest bridge for backend composition (development-only) | [Pinned guest adapter](../src/backend/prism-guest.mjs), [real consumer transport and limits](technical/prism-guest-adapter-v0.md), [synthetic end-to-end tests](../tests/backend_prism_guest.test.mjs) | Implemented exact-holo-digest and P0-only CLI integration interface; tests exercise synthetic holo plus mocked guest, **not** real native execution or production-proof acceptance |
| Local developer CLI for native Prism eligibility output inspection | [CLI contract and instructions](technical/local-cli.md), [CLI entrypoint](../bin/qortara-skills.mjs), [CLI contract tests](../tests/local_cli.test.mjs) | Implemented offline CLI preflight and raw-byte consumer; fixture tests only; native holo execution NOT_RUN |
| Customer access order, browser and future local MCP boundaries | [ADR-0004](adr/0004-access-surfaces.md) | Accepted direction: CLI → Pages → local stdio MCP; remote MCP deferred |
| Request-first browser draft creator, pinned Verdant animation and advanced Prism diagnostics | [Pages interface](../web/index.html), [starter compiler](../web/src/starter.mjs), [Verdant source/rights](../web/vendor/verdant/NOTICE.md), [test and deployment design](technical/pages-web.md) | Implemented development starter drafts, not Prism-verified source composition; custom app deploy succeeded, but automatic Jekyll publishing regression remains in [issue #13](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/13), HTTP/host acceptance unverified |
| Skills submitted upstream, project-agnostic | [PrismPM skill requests](upstream/prismpm-skill-requests/README.md) | Filed 2026-11-17 as PrismPM #720, #721, #722; awaiting upstream triage; no architectural authority |
| Recipe v0 syntax | [Recipe JSON Schema](../schemas/recipe.v0.schema.json) | Draft; parseable schema is not an authority or eligibility verdict |
| Canonical repository-local lifecycle / Shadow event ownership and custody | [Qortara evidence and Shadow guide](technical/governed-evidence.md), upstream Qortara Logic ADR-0009/0011/0017 | Local reference guide; actual artifacts only by runtime |
| Claude Code Prism development procedures (not product skills) | [CLAUDE.md](../CLAUDE.md), [source register](../.claude/PRISM_SOURCES.md), [version compatibility / decision record](../.claude/PRISM_COMPATIBILITY.md) -> three [project-only skills](../.claude/skills/prism-source-gate/SKILL.md) | Developer instructions; no architectural authority. Execution claims live only in the qualification record |
| Required tests and proof scope | [Acceptance matrix](ACCEPTANCE.md) | Planned; not actual executed acceptance |
| Work in progress and unclosed dependencies | [Epic #1](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/1), [Prism spike #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) | Work tracking, not canonical accepted architecture |

## Registered architecture documents

Each file under `docs/architecture/` must appear **exactly once** in the owning table above, with a specific subject owner. Currently:

- `architecture/skill-mason-pipeline-v0.md`: Skill Mason's proposed deterministic assembly pipeline, owned by the project owner through its eventual accepted architecture decision.

The root entrypoint is a locator. This register is a locator. Neither competes with accepted ADRs or executable evidence.

## Documentation lifecycle and supersession

1. Establish the current accepted owning claim, its exact source revision/digest and authority; distinguish branch base and new candidate.
2. Identify affected interfaces, schemas, threats, security/rights constraints, consumers, tests and prior claims.
3. Submit a scoped change. Proposed claims remain **Proposed** until authenticated owner acceptance, even when on a branch or `main`.
4. Update the **one** owning document and this register in the same change. An accepted supersession records old/new claim, reasons, effective revision/decision, dependent artifacts and stale tests/qualifications needing rerun. Retain history.
5. Run local Qortara structural and lifecycle checks if installed, plus adversarial challenge on exact revision; preserve actual results. If tooling or host authority is unavailable, mark `NOT_RUN` / `NOT_ESTABLISHED`; do not label it compliant.

If code contradicts an accepted owner, register a drift defect; do not silently rewrite either side to get a green check. A solo owner may permit adversarial review without a second human; evidence and actual merge authority remain required.

## Repository-local evidence is separate

`.qortara/ledger.jsonl` is the chained lifecycle event record. `.qortara/shadow.jsonl` is the canonical Shadow Genome history. Gate and intent-lock artifacts accompany actual operations. A README, rendered report or issue is not a substitute. See [governed evidence](technical/governed-evidence.md).
