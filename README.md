![Qortara Skills banner](assets/brand/qortara-skills-banner.webp)

# Qortara Skills

**Portable agent skills are the product. [UOR Prism](https://github.com/UOR-Foundation/prism) is the model-driven decision and verification foundation.** The zero-inference-token compiler remains a development target, not a qualified release.

Qortara Skills is building an evidence-driven compiler for portable AI-agent skills. It already has a **local development CLI**, a **GitHub Pages browser client**, and a **request-to-starter-draft workflow**. The browser application has passed its custom build/deploy pipeline, but the live site's publishing source is under remediation in [issue #13](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/13). The product goal remains reproducible packages composed from eligible, version-pinned source methods, with explicit refusals when evidence, rights, permissions or coverage are insufficient.

> **Project state: Functional development prototype, not an alpha release.** The [local CLI](docs/technical/local-cli.md) and [Pages browser client](https://mythologiq-labs-llc.github.io/skill-mason/) implement a downloadable, explicitly labeled **starter** `SKILL.md` draft flow ([PR #16](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/16)). Pages publication is being corrected ([#13](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/13)). The **qualified Prism-backed, catalog-composing generator remains unimplemented** ([#17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17)). Native output acceptance, host tests and measured zero-inference-token assembly are unproven; the owner selected private security intake in [PR #20](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/20), while native Qortara qualification and SDK trust remain separate holds ([#3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3), [#4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4), [#9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)).

[Brand icon](assets/brand/qortara-skills-icon.webp) · [Prism repository](https://github.com/UOR-Foundation/prism) · [Prism application template](https://github.com/UOR-Foundation/template) · [Product requirements](docs/PRD.md) · [Architecture](docs/architecture/skill-mason-pipeline-v0.md) · [Governance](GOVERNANCE.md) · [Current work](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/1)

## Skills are the output. Prism is the decision substrate.

**Qortara Skills** aims to produce small, portable, inspectable agent skills from qualified methods. The skill and its evidence are what users take away.

**[UOR Prism](https://github.com/UOR-Foundation/prism)** has an equally important architectural responsibility: the intended model-governed decision layer. It defines and checks bounded eligibility/refusal decisions before Skill Mason is permitted to assemble an output. Prism is **not** the source catalog, the skill author, a replacement for rights review, or evidence that a generated skill works in an agent host.

| Component | Role in the intended architecture |
| --- | --- |
| **Skills** | The user-facing product: a `SKILL.md` package, source/rights provenance, decision receipt and reproducible identity |
| **[Prism](https://github.com/UOR-Foundation/prism)** | The decision substrate: explicitly modeled eligibility and refusal rules, verification evidence, and a replayable execution boundary |
| **[UOR application template](https://github.com/UOR-Foundation/template)** | The pinned LexLean/PrismPM application-building and `just vv` qualification route used for the first Prism decision candidate |
| **[skillz](https://github.com/Knapp-Kevin/skillz)** | External, read-only discovery and source evidence; it does not automatically authorize reuse or execution |
| **Qortara governance and the host** | Repository/change authority, source assertions and runtime permissions; the consuming host separately tests actual behavior |

**Current reality:** the owner accepted the [nested `prism/` architecture](docs/adr/0003-prism-application-adoption.md). A bounded `SM-01` eligibility model exists as a [candidate overlay](prism-overlay/README.md), with native qualification work in [draft PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15). This repository has **not yet installed or qualified** the intended Prism decision application on `main`. The browser's starter-draft formatter is not that Prism-backed skill compiler.

---

## Contents

- [Skills are the output; Prism is the decision substrate](#skills-are-the-output-prism-is-the-decision-substrate)
- [Why Qortara Skills exists](#why-qortara-skills-exists)
- [What it will do](#what-it-will-do)
- [How the pieces fit together](#how-the-pieces-fit-together)
- [The zero-inference-token contract](#the-zero-inference-token-contract)
- [Capability model and output](#capability-model-and-output)
- [Trust, security, and refusals](#trust-security-and-refusals)
- [Project status and roadmap](#project-status-and-roadmap)
- [Explore the repository](#explore-the-repository)
- [Develop and validate](#develop-and-validate)
- [Local development CLI](#local-development-cli)
- [GitHub Pages web app](#github-pages-web-app)
- [Repository governance](#repository-governance)
- [Frequently asked questions](#frequently-asked-questions)
- [Contributions and licensing](#contributions-and-licensing)

## Why Qortara Skills exists

Finding a skill is not the same as having a skill an agent can safely and effectively use.

A catalog may identify hundreds of promising procedures, but a specific task still needs reliable answers: **What outcome must the agent achieve? Which method actually covers it? May that source be reused? Which tools, permissions, data, and host features are required? What has been tested?**

[skillz](https://github.com/Knapp-Kevin/skillz) is growing into a broad, curated capability library across disciplines. Qortara Skills is its **separate downstream engineering project**. Instead of treating discovery counts as finished capabilities, Qortara Skills aims to assemble methods only when the requested outcome and its constraints can be supported.

The goal is not to manufacture impressive-looking `SKILL.md` files. It is to produce **small, traceable, fit-for-purpose skills**, or explain precisely why one cannot yet be produced.

### Who it is for

| Audience | Intended value |
| --- | --- |
| Agent users | A relevant skill matched to a concrete outcome, with clear limitations |
| Solo developers and teams | Reproducible packages that are easier to review, compare, and update |
| Skill maintainers | Provenance, dependency and rights boundaries retained across composition |
| Security and governance reviewers | Explicit authority limits, refusals, and evidence that can be checked independently |
| Host and tool builders | A future versioned recipe, artifact, and verification contract rather than opaque prompts |

## What it will do

The planned compiler has six responsibilities:

1. **Understand the requested outcome.** Identify the domain, subdomain, specific capability, essential workflow, target host, and permitted authority.
2. **Read a pinned catalog snapshot.** Inspect exact source identities and evidence supplied through an approved, read-only adapter. An unindexed capability is **unknown**, not necessarily absent.
3. **Qualify possible building blocks.** Check fit, rights (including nested assets), source freshness, package security, dependencies, portability, and permitted side effects independently.
4. **Choose and compose deterministically.** Assemble eligible methods using declared rules, templates, and parameters. Refuse an essential outcome that cannot be represented faithfully.
5. **Produce inspectable artifacts.** Emit a portable skill, provenance and source manifest, decision trace, verification status, and reproducible digests.
6. **Support separate behavioral qualification.** A consuming host can later run authorized sandbox tests. Passing a compiler check never means the skill actually worked in that host.

These are **compiler requirements, not shipped end-to-end capabilities**. The existing local CLI and request-to-starter web interface are narrower implemented development surfaces. The [PRD](docs/PRD.md) and [acceptance matrix](docs/ACCEPTANCE.md) define the pilot's actual completion criteria.

### What it will not do

Qortara Skills will not silently copy an entire third-party corpus, treat a popular skill as safe, infer reuse rights from a repository badge, execute commands found in candidate text, grant itself permissions, install packages without approval, or invent missing expertise. New method authorship may eventually be supported through an **explicitly separate** process; it is not part of the zero-inference build.

## How the pieces fit together

| System | Owns | Does **not** authorize |
| --- | --- | --- |
| [skillz](https://github.com/Knapp-Kevin/skillz) | Passive discovery, taxonomy, source versions, reviews, and qualification leads | Automatically reusing or executing discovered methods |
| **Qortara Skills** | Planned selection, eligibility decisions, deterministic assembly, and artifact receipts | Rewriting upstream assessments or activating output in a host |
| **[UOR Prism](https://github.com/UOR-Foundation/prism)** | Accepted **architectural role** as the model-governed eligibility/refusal and verification substrate; candidate execution via the [UOR template](https://github.com/UOR-Foundation/template) | External facts or source rights, model-free skill authorship, and actual host task success |
| **Consuming agent / authorized host** | Actual installation, execution, credentials, and observed use | Treating compiled text as permission to bypass host policy |

```text
  USER / HOST REQUEST
  outcome + target + permitted authority
                 |
                 v
  skillz: pinned capability evidence (read only)
                 |
                 v
  [Catalog adapter + independently checked assertions]
                 |
                 v
    [PRISM model-governed eligibility decision]
          |                         |
       refused                 eligible input
          |                         |
          v                         v
   typed refusal       [Deterministic skill composer]
                                              |
                                              v
                            [Verification and replay]  (planned)
                                              |
                                              v
                          SKILL.md + sources + receipt + hashes
                                              |
                                      user/host approval
                                              |
                                              v
                            optional, separate behavioral test
```

**Prism feasibility remains open, with first evidence.** The verified-application route using the [UOR template](https://github.com/UOR-Foundation/template) was executed on 2026-11-17: its reference application passed its complete gate, and one candidate eligibility decision was built and verified in a rebuilt instance ([evidence](docs/evidence/prism-phase0-20261117/README.md)). The owner has accepted [ADR-0003](docs/adr/0003-prism-application-adoption.md)'s **nested Prism architecture**; installation, full native checks and artifact assurance remain unqualified, so Qortara Skills is **not yet a Prism-built application**. See [RFC-0001](docs/RFC-0001-prism-feasibility.md) and [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3).

## The zero-inference-token contract

**Zero inference tokens at build time** means the deterministic assembly path makes **zero LLM inference calls**. It is a measurable execution property, not a metaphor.

| Situation | Token implication |
| --- | --- |
| Selecting and assembling from already qualified, structured methods | Target: **0 LLM inference tokens** during the build |
| Preparing new expert-authored source material | Human work or other authoring cost; not part of the zero-inference claim |
| Optional future LLM-assisted method authoring | Model tokens would be counted separately and disclosed |
| A host agent reading or executing a generated skill | May use context and inference tokens; **not** zero-token consumption |
| Compiling/verifying with CPU, storage, or tools | Still consumes compute, time, and possibly infrastructure cost |

The pilot must demonstrate this with actual instrumentation, offline repeatability, pinned dependencies, and independently checked outputs. **No such measurement has been completed here yet.**

A deterministic compiler cannot derive a new expert procedure from an empty catalog by wishing harder. A missing method becomes a **recorded capability gap**, not a confident paragraph.

## Capability model and output

Coverage is evaluated at the level of the **essential outcome**, not the number of files in a parent domain.

```text
Domain
  -> Subdomain
      -> Capability
          -> Essential outcome / acceptance condition
              -> Eligible method(s) and constraints
```

A method may support several capability routes without duplicating its canonical identity. Every route retains its own evidence and gaps. Source candidates, statically assessed packages, approved reusable components, generated outputs, and behaviorally validated skills are distinct states.

### Planned recipe-to-package contract

The [draft recipe schema](schemas/recipe.v0.schema.json) describes the fields a future caller would supply: a skill ID and description, target host, required outcomes, exact catalog snapshot, selected method identities and hashes, and an explicit authority ceiling.

When implemented, a successful compilation is expected to produce:

```text
<requested-output-directory>/
  SKILL.md               # Human/agent-readable procedure
  skill-mason.json       # Package identity, format, host target
  SOURCES.json           # Exact source identities, dependencies, reuse terms
  RECEIPT.json           # Selection rationale, outcome coverage, hashes, limits
```

**Illustrative output contract only.** No such package has been generated by this repository. The schema describes syntax, not actual source trust or execution eligibility. File naming and serialization are still subject to the accepted implementation contract.

### When no valid skill can be built

An honest result should identify the missing outcome or blocked constraint, report which evidence was evaluated, and suggest the next **authorized** discovery or authorship step. Example refusal classes include `OUTCOME_UNCOVERED`, `RIGHTS_UNRESOLVED`, `SOURCE_MISMATCH`, `AUTHORITY_EXCEEDED`, and `HOST_UNSUPPORTED`. See the [proposed architecture](docs/architecture/skill-mason-pipeline-v0.md) for the draft refusal vocabulary.

## Trust, security, and refusals

**Source content is untrusted input, even when it appears in a familiar repository.** A candidate skill cannot tell the compiler to run code, reveal a secret, contact a server, or rewrite governance.

The design separates evidence into independent gates:

| Gate | Question that must be answered |
| --- | --- |
| Identity and provenance | Is this the exact inspected package at its declared source revision? |
| Capability fit | Does the method cover each required outcome, with observable acceptance criteria? |
| Rights and dependencies | May the text, supporting files, and nested assets actually be transformed and redistributed? |
| Semantic review | What was reviewed, by whom or what, and at which source version? |
| Security and authority | What was checked, what permissions are requested, and what remains unknown? |
| Host compatibility | Can the target host interpret and use the intended procedure? |
| Behavioral evidence | Was this particular output tested in the relevant host and environment? |

An aggregate score may help prioritize methods, but it **cannot override a failed essential gate**. Unknown, stale, incomplete, rejected, or reference-only status must remain visible. A formal proof of selection rules does **not** prove that an external instruction is medically, legally, scientifically, or technically correct.

For repository vulnerabilities and disclosure rules, read [SECURITY.md](SECURITY.md). The owner selected [GitHub Private Vulnerability Reporting](https://github.com/MythologIQ-Labs-LLC/skill-mason/security/advisories/new) in [PR #20](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/20); availability of that setting and native Qortara qualification still require separate verification ([issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4)). Do not disclose vulnerabilities in public issues.

## Project status and roadmap

**Source checkpoint (November 17, 2026; `main` at `6b445a0` after PR #20):** a working developer prototype, **not** a production-qualified skill builder. The source repository, real native host tests, and installed Prism application must be checked independently.

| Milestone | Verified evidence | Status |
| --- | --- | --- |
| Public repository and brand | [Foundation PR #2](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/2), Qortara Skills README/banner/icon | Merged |
| Governed source baseline | [PR #7](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/7) merged Prism route-A evidence; owner accepted nested `prism/` in [ADR-0003](docs/adr/0003-prism-application-adoption.md) | Architecture accepted; native app **not installed** |
| Reproducible Prism source stage | [PR #10](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/10), [successful source-staging run](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44202124743) | Source-only PASS; not a built holo |
| Local development CLI | [PR #11](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/11), `qortara-skills status/evaluate/probe` | Implemented; actual native holo test **NOT_RUN** |
| Browser client and publishing | [PR #12](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/12), [PR #16](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/16), [custom Pages build/deploy](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216793111), [publishing regression #13](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/13) | Custom app build qualified by CI; later branch-mode Jekyll deploys may supersede its artifact; live app smoke not verified |
| Request-to-`SKILL.md` workflow | [PR #16](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/16), deterministic starter formatter with explicit limits, Verdant presentation animation | Usable **starter draft**, not a source-qualified generated skill |
| Browser and structural regression tests | [PR #16 CI](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216569133): **23/23** browser tests; [main documentation run](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216793109): **61/61** Python tests; Node checks passed | Structural/fixture checks pass; not host qualification |
| SDK isolation and final named holo | [Draft PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15), [issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9), [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) | In progress; native output acceptance not established on `main` |
| Pinned skillz metadata ingestion | [Read-only handoff inspector](scripts/catalog_handoff.py), [trust and test contract](docs/technical/catalog-handoff.md) | Implemented source-only inspector; synthetic negative tests, actual 1,043-record import and source authentication **NOT_RUN** |
| Qualified deterministic skill composer | [Issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17) | Not implemented; no catalog-backed skill package or host acceptance |
| Local MCP server | [ADR-0004](docs/adr/0004-access-surfaces.md), [issue #14](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/14) | Deferred, behind CLI/Pages native output tests |
| Security reporting and native Qortara governance | [PR #20](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/20) recorded owner-selected private reporting, [main security-policy screen PASS](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44227740461); [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4) tracks native verification | Owner policy established; native Qortara qualification and independently observed private intake remain **NOT_VERIFIED** |

**Straight-line delivery path:** (1) inspect the pinned catalog inventory **without granting rights**, (2) authenticate source packages, rights and essential-outcome mappings, (3) complete the final-name native Prism SM-01 run and bind verified assertions, (4) compose the first useful deterministic skill plus receipts, (5) demonstrate actual host behavior and unify CLI/Pages, then (6) implement local stdio MCP. Claude's native runner [draft PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15) runs in parallel to catalog inspection; neither is an end-to-end release.

The [delivery epic #1](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/1) owns milestones and completion criteria.

## Explore the repository

| Start here | Purpose |
| --- | --- |
| [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md) | Required architecture entrypoint; **locator only** |
| [`docs/README.md`](docs/README.md) | Single canonical owner register, statuses, and supersession rules |
| [`docs/PRD.md`](docs/PRD.md) | Stakeholders, intended outcomes, functional requirements, pilot release criteria |
| [`docs/architecture/skill-mason-pipeline-v0.md`](docs/architecture/skill-mason-pipeline-v0.md) | Proposed component model, trust boundaries, receipts, and refusals |
| [`docs/RFC-0001-prism-feasibility.md`](docs/RFC-0001-prism-feasibility.md) | Open Prism integration questions and evidence needed |
| [`schemas/recipe.v0.schema.json`](schemas/recipe.v0.schema.json) | Draft input format; **not** a working generator API |
| [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) | Planned positive, adversarial, and host acceptance cases |
| [`GOVERNANCE.md`](GOVERNANCE.md) · [`SECURITY.md`](SECURITY.md) | Owner authority, change controls, and unresolved reporting policy |
| [`AGENTS.md`](AGENTS.md) | Required operating instructions for development agents |
| [`docs/technical/governed-evidence.md`](docs/technical/governed-evidence.md) | Internal governance evidence and audit-record procedures |
| [`scripts/check_governance_static.py`](scripts/check_governance_static.py) · [tests](tests/test_governance_static.py) | Supplemental read-only layout lint and planted controls |

There are **no released generator packages, deployed host connectors or qualified generated skills**. The local CLI and a browser-based starter-draft creator are developer previews, not accepted Prism compiler releases.

## Develop and validate

This repository is **public**. Source visibility does not confer contribution rights, reuse rights, or an installed release.

```sh
git clone https://github.com/MythologIQ-Labs-LLC/skill-mason.git
cd skill-mason
```

The source foundation and development prototype are on `main`. To inspect them locally:

```sh
# Supplemental structural/guardrail tests only; Python 3 and Node 22+ required.
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs web/tests/*.test.mjs

# Layout-only CI: fails on broken documents, registrations, links or Shadow syntax.
# It still prints unresolved qualification holds for visibility.
python3 scripts/check_governance_static.py --root . --mode layout

# Separate, fail-closed security-policy screen (must pass on current main).
python3 scripts/check_governance_static.py --root . --mode guard
```

The **Documentation structure** workflow uses the `layout` mode; it must fail for missing governance files, invalid links, owner-register gaps, or malformed Shadow records, while reporting outstanding security-policy holds without calling them structural failures. A **separate security-policy check** uses `guard` mode; after the owner-qualified reporting decision in PR #20, it passes on current `main`. **Neither check substitutes for native Qortara validation, owner acceptance, or product/host behavior.**

**No `skill-mason build` command is currently implemented.** The code block above tests documentation scaffolding only.

A [development-only SM-01 output probe](docs/technical/sm01-output-probe.md) is available for testing **actual compiled Prism `.holo` outputs**, once the nested application produces an artifact at a verified digest. Its local contract tests use a stand-in; no real holo has yet been run through the probe in this repository. It is not a skill builder or proof of P2 assurance.

## Local development CLI

A first **development-only CLI** is available under `bin/qortara-skills.mjs`. It offers `status`, `evaluate` (raw bytes to a real Prism holo), and `probe` (12 recorded SM-01 cases). It does not assemble, install, or publish skills. **No native holo has yet been accepted in this repository.**

```sh
npm link
qortara-skills help
qortara-skills status
npm run test:cli
```

See [local CLI usage and explicit P0 limits](docs/technical/local-cli.md). The local CLI and its stand-in tests are not proof of a Prism-built application or a zero-inference-token generator.

## GitHub Pages web app

**[Open Qortara Skills](https://mythologiq-labs-llc.github.io/skill-mason/)**. The request-first page accepts a plain-language skill request and returns a **downloadable starter `SKILL.md` draft** produced by a deterministic local template. It is a *request handoff*, not a vetted or Prism-qualified skill generator: no catalog sources, rights, or host behavior are verified. The separate developer panel retains the real pinned `.holo` diagnostic path. The page uses a [pinned Verdant Engine renderer](web/vendor/verdant/NOTICE.md) to animate the visual prism, with accessible CSS fallback. No hosted MCP, accounts, uploads or server are involved.

The [Pages workflow](.github/workflows/pages.yml) successfully deployed the request-first site at commit `34eb63d` in [run 44216793111](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216793111) (GitHub environment URL confirmed; independent browser smoke and native holo execution still outstanding). See [Pages design and limits](docs/technical/pages-web.md). A local `stdio` MCP remains the third access priority.

## Repository governance

Development governance is **not part of the Qortara Skills product architecture**. The [governance policy](GOVERNANCE.md), [security policy](SECURITY.md), [architecture index](ARCHITECTURE_INDEX.md) and [documentation register](docs/README.md) describe how this repository is maintained and reviewed. The [developer instructions](AGENTS.md) document agent and contributor workflows. The [PR #2 merge record](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/2) documents the bounded source-only exception; unresolved security and native-governance qualification remain tracked in [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4).

## Frequently asked questions

**Is Qortara Skills a replacement for skillz?**  
No. `skillz` remains the passive discovery and evaluation source. Qortara Skills is a proposed **active, separate** builder and output collection. Neither project automatically changes the other's accepted evidence.

**Does zero-token mean a generated skill costs no tokens to use?**  
No. It means the **deterministic generation transaction** uses no model inference. A consuming agent may still spend tokens reading and applying the instructions.

**Can it generate a skill for any possible task?**  
That is the long-term coverage aspiration, **not a present guarantee**. If an essential procedure is missing, unqualified, or legally unavailable for reuse, the correct outcome is a refusal plus a recorded gap.

**Does Prism verify that a skill is safe and effective?**  
Not by itself. The nested Prism architecture is **owner-accepted**, and historical route-A evidence exists, but the final Qortara Skills Prism application and its artifacts are **not yet qualified on `main`**. Actual task effectiveness, source truth, reuse rights and host authority require separate evidence.

**Can I install Qortara Skills today?**  
No released skill generator or product installer exists. Developers can link the [local CLI](docs/technical/local-cli.md) to check prerequisites and test real Prism eligibility outputs once a verified native holo is available.

**Why did the documentation CI job fail?**  
The old job mixed **passing structural checks** with an unresolved **security-reporting policy hold** from `SECURITY.md`. The checks are now separate: structural CI tests the repository layout, and a dedicated fail-closed security-policy check preserves the unresolved owner decision under [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4). A green layout check is not native Qortara or production qualification.

## Contributions and licensing

This is a **public, owner-maintained** project governed by [GOVERNANCE.md](GOVERNANCE.md). Public visibility does not mean open contributions, and acceptance of outside contributions is not established. Access or a submitted patch does not authorize adoption, changes to architecture, or redistribution of source material.

**No repository-wide license has been adopted here.** Do not assume the project code or generated artifacts are MIT-licensed because some upstream dependencies or catalog sources use MIT. Every incorporated method and bundled asset retains its own verified rights constraints.

For scoped development work, start with [`AGENTS.md`](AGENTS.md), the [architecture owner register](docs/README.md), the [acceptance matrix](docs/ACCEPTANCE.md), and the relevant live issue. Keep changes in a reviewable branch; document actual checks and unresolved risks. Only publish or distribute artifacts with separately established authority and licensing.

---

**Project principle:** A skill is ready only when the requested outcome, source rights, authority, build evidence, and actual host behavior support that claim. Until then, the most valuable output may be a precise refusal.
