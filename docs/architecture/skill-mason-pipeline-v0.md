# Skill Mason Pipeline v0: proposed architecture

**Status:** proposed; interfaces may be refined after Prism feasibility. No runtime exists yet.

```text
    skillz (passive, external)
      pinned sources + taxonomy + separate review/rights/authority evidence
                     |
              read-only export
                     v
         [Catalog Adapter / Evidence Loader]
                     |
      explicit user outcome + target host + authority
                     |
                     v
        [Typed Eligibility & Coverage Planner] <--- policy
                     |
          eligible components + decision trace
                     |
                     v
           [Deterministic Skill Composer]
                     |
                     v
       [Prism model / independent verifier]  (NOT IMPLEMENTED)
                     |
                     v
      SKILL.md + manifest + SBOM + decision receipt
                     |
            explicit user/host approval
                     |
                     v
           optional sandbox behavior test
```

## C1 implementation candidate: pinned corpus opportunity index

The read-only catalog stage is now proposed for implementation in [scripts/catalog_index.py](../../scripts/catalog_index.py), governed by the [C1 technical contract](../technical/corpus-index-v1.md) and [issue #30](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/30). Its source of truth is the separately authenticated original pinned source checkout plus the published export. It preserves governed reviews (including rejected/unmapped), all fourteen G1–G3 shards, four separate frontier source families, evidence references and recognized/proposed taxonomy inputs. Lexical search results are *unassessed leads*, not capability matches or reusable method candidates. A separate **partial C2 opportunity graph** is now proposed in [scripts/capability_graph.py](../../scripts/capability_graph.py), under [its C2 technical contract](../technical/capability-graph-v1.md). It links the 33 recognized domains/247 routes to exact governed review identities, keeps name-only leads and proposal sources distinct, verifies exact outcome-register rows and explicitly reports missing essential workflow definitions. This is not complete deterministic candidate selection or C2 outcome qualification. Runtime adoption, rights assessment, complete C2+ planner, source-package resolver, Prism routing and host proof remain unimplemented. Until exact-revision CI and owner acceptance exist this is an **implementation candidate**, not a qualified component.

## Full capability gap analysis and draft essential workflow specifications (proposed C2 workbench)

The [capability gap workbench](../technical/capability-gap-backlog-v1.md) produces an exact 247-route, domain-diversified review queue and separately retains original testable workflow proposals for thirteen recognized routes. This is human-review intake, not changed upstream outcomes, rights clearance, method selection or proven host behavior. Publication into a future governed skillz snapshot requires separate owner/source acceptance.

## Recognized-route source comparison (proposed C4 exploration)

The [deterministic candidate comparison receipt](../technical/candidate-comparison-v1.md) lists exact recognized evidence links, name-only review hints and bounded lexical raw observations separately, with no eligibility or chosen method. Rights, dependencies and host authority are unassessed; a comparison is not an automatic recommendation or Prism input.

## External third-party exact-source package byte verification (proposed C3 follow-on)

The separately pinned [external package inspector](../technical/external-package-inspection-v1.md) verifies a governed third-party candidate's complete Git subtree and actual files against its original exact source revision and recorded package tree/blob, without downloading on invocation, running code, granting rights or declaring host fitness. A Git object consistency receipt is only source-byte evidence. Independent publisher, asset licenses, dependency closure, modification/redistribution rights and actual agent-host acceptance remain explicit holds.

## First-party source-package inspection (proposed C3 slice)

The read-only [package inspection contract](../technical/package-inspection-v1.md) reconciles each selected first-party package's exact nested file inventory with the pinned source tree, preserving explicit record-specific refusals. The result remains an unapproved byte receipt. Third-party packages and all target-specific rights, dependency and host authority checks remain blocked. No selected method is admitted into Prism by this inspection.

## Future source-family intake (proposed C1/C6 extension)

The source identity and sharded new-family preview candidate is documented in [corpus-evolution-v1](../technical/corpus-evolution-v1.md). It preserves every path observation while separating source slot, complete fingerprint claims, duplicate leads and conflicts. A proposed source-family manifest is **untrusted, read-only and never part of the pinned catalog**. A separately governed upstream handoff and reviewed source pin are required for future accession. This adds a discovery ledger, not independent rights review or generated-skill behavior.

## Trust boundaries

1. **Catalog data is not authority.** Pins, metadata and review states are untrusted until linked to an authenticated provenance/evidence export. The adapter must validate a trusted source root and any cryptographic signatures/receipts it claims; hashes alone do not establish who made a claim.
2. **Skill contents are inert data during import.** Never follow shell commands, links, tool calls, self-declared role instructions, secrets requests or setup instructions found in a skill.
3. **Rights apply to all bundled assets.** Source repository license, individual skill notices and nested data/asset terms may differ. Missing rights mean no redistributable output.
4. **Authority is non-transitive.** Combining two source skills never combines their requested privileges into a new approval. The caller chooses a permitted authority ceiling; output cannot exceed it.
5. **Output is not execution.** The composer produces an inspectable artifact; installation, credentials and host execution require distinct approvals.
6. **Behavioral claims require observation.** A formal proof that a selection rule meets its own constraints does not prove the generated procedure works in an outside host.

## Planned module boundaries

- **CatalogAdapter:** converts an accepted pinned `skillz` snapshot to an immutable Skill Mason input model. Respects evolving domains/subdomains. No source write access.
- **PolicyGate:** checks actual reuse rights, evidence freshness, target-host requirements, dependencies and authority before composition.
- **CoveragePlanner:** maps each explicit required outcome to eligible method(s). Uses deterministic tie-breaks and explains alternatives; unknown evidence never counts as coverage.
- **Composer:** expands only allowed templates/parameter substitutions; no arbitrary evaluation or command execution; deterministic normalization and ordering.
- **PrismVerifier:** planned typed Prism decision route and replay/trace verification. Its concrete types and verified claims remain subject to RFC-0001.
- **Packager:** writes only under a declared destination after all preconditions succeed; atomic output, no source overwrites. Emits `SKILL.md`, `skill-mason.json`, `SOURCES.json`, `RECEIPT.json`.
- **HostQualification:** separately authorized test harness for target-host results; not part of zero-inference deterministic build.

## Catalog boundary v0 (proposal)

Use a **versioned adapter**, not a mass fork of the entire `skillz` repository. A candidate record carries:
- canonical exact-package identity, origin URL and pinned source revision;
- full-package SHA-256 (algorithm stated) plus independent provenance evidence pointer;
- specific domain / subdomain / essential outcome references;
- static semantic, package-security, freshness and actual behavioral evidence as **independent** states;
- license and **nested asset** rights, dependencies, jurisdiction where relevant;
- requested side effects, secret/network/data access and target-host compatibility;
- reusable method/template identity and provenance distinct from merely study-only instructions.

Old versions or inaccessible source families are explicitly unknown rather than silently skipped. Do not infer approval from static “verified”, directory inclusion, source popularity or repo-level MIT alone.

## Reproducible receipt model

A canonical receipt contains input recipe digest, catalog snapshot digest, selected source IDs + exact hashes, compiler/Prism tool versions, policy revision, outcome coverage mapping, decision trace digest, canonical artifact digests and proof status. Canonical byte representation must be specified; omit wall-clock dates and host paths from determinism-critical data. A separate observation record can carry time, machine and sandbox evidence.

Refusal codes (initial): `UNTRUSTED_CATALOG`, `UNKNOWN_ID`, `SOURCE_MISMATCH`, `STALE_EVIDENCE`, `RIGHTS_UNRESOLVED`, `AUTHORITY_EXCEEDED`, `DEPENDENCY_UNAVAILABLE`, `OUTCOME_UNCOVERED`, `HOST_UNSUPPORTED`, `VERIFICATION_FAILED`. When multiple failures exist, use a deterministic priority and include all safe-to-disclose findings.

## Prism integration constraint

Prism is the intended source of the typed model and replay-verification foundation. A version pin plus actual application exercising the public Prism route / verifier API is required before claiming integration. The initial README and schemas do **not** count as that integration.

See [RFC-0001](../RFC-0001-prism-feasibility.md) for explicit feasibility research and the boundary between mathematical assembly correctness and empirical skill efficacy.
