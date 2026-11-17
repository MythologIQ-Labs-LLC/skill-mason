# Skill Mason

**Deterministic skill assembly and verification.**

Skill Mason is a separate, active skill-engineering system. It consumes evidence-backed, exact-version capability records from [skillz](https://github.com/Knapp-Kevin/skillz) and produces auditable agent-skill packages without LLM inference during deterministic assembly.

> Status: **inception / experimental**. No generated skill has yet been behaviorally qualified. Do not describe the generator as generally capable, secure, or Prism-verified until the relevant tests and proof artifacts exist.

## Project objective

Build a capability-oriented generator that can:

1. Identify required outcomes and candidate methods by domain, subdomain, and capability.
2. Accept only eligible, version-pinned, rights-compatible source packages for the selected use.
3. Assemble a portable skill from reviewed, explicitly licensed, composable building blocks.
4. Refuse incomplete coverage, ambiguous authority, unresolved rights, stale evidence, unsafe dependencies, and unsupported target hosts.
5. Produce a deterministic, reproducible build receipt that explains source identities, decisions, verification limits, and output hashes.
6. Test selected builds against observable acceptance cases in a separately authorized sandbox before describing them as behaviorally validated.

**“Zero-token” means zero model-inference calls/tokens in the deterministic compiler path.** It does not mean the output is token-free when a host agent later reads a generated skill, nor does it imply the system can invent new methods without an authored or otherwise qualified source.

## Architectural boundary

- **skillz:** Passive discovery, source records, taxonomy, exact-version curation, security/license/authority evidence. Read-only input to Skill Mason; no generator runtime, background processing, or generated-user-skill writes in skillz.
- **Skill Mason:** Active selection, compatibility/coverage checks, authorized composition, build receipts, local verification and packaging. Never silently upgrades source review states.
- **UOR Prism:** Planned deterministic computation/typed modeling and replay-verification substrate. Integration and conformance are **not yet established**; no claim of Prism-backed proof is made.
- **User/host:** Explicitly controls authorization to install, execute, export, access private data, use a model, or write to an external system.

## First delivery gate

A bounded MVP accepts an explicit, version-pinned local catalog export and an explicit recipe; it refuses unknown or unqualified sources and insufficient coverage, writes a reproducible skill package to a requested destination, and emits an independently checkable receipt. No network crawling, license inference, automatic installation, secret access, or model calls.

Success requires both positive and adversarial tests, then separately evidenced Prism integration and observed host qualification.

## Governance

- Solo-developer owner authority; adversarial review substitutes for an independent human approval role, never for evidence.
- Changes to the generator must retain provenance, exact hashes, source rights, safety constraints, and reproducibility tests.
- Generated skill packages are outputs of **this repository / the user's host**, never written back into `skillz` by default.
- CI passing is not proof of intended host behavior. State source/content validation, machine checks, and observed behavior separately.

See `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `ARCHITECTURE_INDEX.md` on the upcoming architecture branch for the proposed build contract.
