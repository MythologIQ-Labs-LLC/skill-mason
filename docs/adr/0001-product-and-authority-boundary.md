# ADR-0001: Skill Mason product and authority boundary

**Status:** Proposed; owner-directed product intent, but no authenticated acceptance revision or Prism implementation. **Scope:** Skill Mason vs. skillz vs. Prism and host control.

## Context

The owner established [Knapp-Kevin/skillz](https://github.com/Knapp-Kevin/skillz) as a continuously expanded, passive, evidence-graded skill/capability knowledge base. The new [Skill Mason](https://github.com/MythologIQ-Labs-LLC/skill-mason) repository is intended to build an independently governed deterministic skill generator. A filename count or taxonomy route is not a demonstrated working method.

## Proposed decision

1. **skillz owns** discovery, capability domains/subdomains, source identity/version, static assessment, license and evidence ledgers. Skill Mason reads eligible exports; it cannot mutate the passive catalog or silently change its review statuses.
2. **Skill Mason owns** deterministic input modeling, fit/coverage decisions, rights and authority refusal, template/component composition, output receipts, target-host packaging and independently authorized host testing. It must refuse non-expressible capabilities instead of fabricating expertise.
3. **Prism is a candidate deterministic substrate, not yet implemented.** A real pinned implementation, trace, replay and formal-scope audit are required before claiming proof.
4. **Human/host authority remains external.** Generated text may not grant permissions, install, access data, run tools, approve releases or redefine evidence. Review policy depends on the actual consumer environment.
5. Zero-inference-token assembly means **no LLM inference calls during the deterministic build**, not zero tokens in authored inputs or in a downstream host that reads generated skills.
6. **One authority per claim.** Governed development and Shadow memory use the actual Qortara repository-local contract, not a second Skill Mason policy engine or improvised JSONL semantics.

## Acceptance required before elevation

Provide actual implementation scope, code/host trust boundary, missing-workflow behavior, evidence/rights precedence, target compatibility, verification limitations and owner acceptance. See the [registered proposed architecture](../architecture/skill-mason-pipeline-v0.md) and [RFC-0001](../RFC-0001-prism-feasibility.md).

## Supersession

None. This is a new proposed decision; it does not rewrite Qortara Logic's upstream ADRs, `skillz`'s governance or another product's architecture.
