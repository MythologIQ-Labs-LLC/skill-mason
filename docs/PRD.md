# PRD: Skill Mason

**Status:** Proposed, pre-implementation. **Owner:** solo developer. **Target:** deterministic, zero-inference-token skill engineering.

## Problem and stakeholders

Agent capability libraries are expanding faster than an agent can reliably choose, combine and qualify methods. Counting packages or discovering a filename does not demonstrate that a requested workflow is actually served. A method may be well written but unusable because its license, authority, dependencies or host compatibility are unresolved.

Stakeholders:
- **Agent consumers** need a portable, narrow, runnable skill fitted to an explicit task.
- **Solo developers and development teams** need auditable, reproducible skill packages and differentiated capability choices.
- **Curators and maintainers** need exact-source attribution and unchanged evidence/rights states.
- **Security and compliance operators** need refusal boundaries, approval, reproducible evidence and no implicit authority escalation.
- **Source authors and rights holders** need faithful provenance and respect for reuse terms.

## Jobs to be done

1. Describe a requested outcome and the target host; discover eligible methods without assuming an absent index means absent capability.
2. Compare alternative methods by actual essential outcomes, portability, dependencies, authority and rights.
3. Choose compatible qualified building blocks and a deterministic assembly recipe.
4. Emit a skill that a user can inspect **before** any installation or execution.
5. Validate the assembly decision and record everything that was verified, refused or not run.
6. Detect unsupported requested outcomes and route to source discovery or separately authorized new authorship, not invented expertise.

## Non-goals for the first pilot

No autonomous crawling, cross-account personalization, third-party code execution, remote connectors, silent source copying, unconditional trust in catalog metadata, dependency installation, recursive self-modification, LLM inference, general behavioral truth proofs or universal skill coverage.

## First-pilot functional requirements

| ID | Requirement | Acceptance |
|---|---|---|
| SM-01 | Capability outcomes are explicit and versioned | Every essential outcome is named independently of its parent domain |
| SM-02 | Read-only catalog import | Exact repository/source commit + package identity/hash and evidence provenance are retained |
| SM-03 | Deterministic method selection and assembly | Same inputs, compiler version and pinned dependencies produce byte-identical canonical output |
| SM-04 | Rights gate | Unknown/restricted/conflicting license or nested asset rights refuse copying/composition |
| SM-05 | Security and authority gate | Unknown, failed, incomplete or stale evidence and permissions beyond policy refuse |
| SM-06 | Coverage gate | Missing essential outcomes refuse; aggregate score or adjacent-domain entry cannot hide a gap |
| SM-07 | Portable package | Generated `SKILL.md` and manifest use a declared target-host contract |
| SM-08 | Traceable artifact | Output records source IDs/pins/hash, eligibility, decisions, coverage, output hashes and proof limits |
| SM-09 | No build inference | Instrumentation observes zero model invocations and zero model-billed tokens on the deterministic path |
| SM-10 | Explicit host control | Generation does not install, activate, execute, or grant permissions to the skill |
| SM-11 | Hard refusals | Unsafe, unverifiable and unsupported input produces a typed refusal with recovery guidance |
| SM-12 | Testable replay | Independent verifier can recompute canonical hashes and decision outcomes from pinned inputs |

## Important product distinctions

- `DISCOVERED` != `REVIEWED` != `ELIGIBLE` != `GENERATED` != `BEHAVIORALLY_VALIDATED`.
- Essential workflow coverage belongs to the **individual outcome**, not a domain badge or a file count.
- `skillz` remains a passive, maintained library. Skill Mason builds outputs in its own workspace / explicit host destination.
- Source text can be malicious even if a source catalog says it passed a review; provenance and trust must be independently established.
- A deterministic assembly system can remix and instantiate formally defined methods. If no valid method exists, it must refuse. Optional model-assisted method authorship is a separate mode with separately recorded token cost.
- Build tokens are not the same as the downstream agent's context-window tokens.

## Pilot success metrics

1. Reproducibility: 100% byte-for-byte canonical equality for identical pinned inputs over the test matrix.
2. Refusal integrity: all required negative cases deterministically refuse before materialization.
3. Coverage integrity: 100% of declared essential outcomes mapped to explicit accepted evidence, or the build refuses.
4. Build inference: precisely 0 LLM inference calls/tokens, confirmed by instrumentation and offline tests.
5. Source integrity: independently replayable package hashes, rights and decision evidence.
6. Two distinct domain/subdomain samples, with sandbox behavioral outcomes reported **separately** from build correctness.

## Release condition

Do not label Skill Mason a reliable zero-token skill generator until a real Prism-backed pilot, independent replay, adversarial tests, versioned receipts and observed target-host behavior pass. For now it is a candidate architecture, with an open feasibility RFC.
