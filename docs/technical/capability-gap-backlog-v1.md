# Capability gap ledger and proposed essential workflows (C2 workbench)

**Status:** Read-only and proposed, stacked on Skill Mason corpus PRs #31 through #34 under governing issue #30. No capability coverage, source permission or method eligibility is asserted by this work.

## What is consumed

The original, exactly pinned skillz source checkout provides:
- A complete recognized taxonomy of 33 domains and 247 subdomains.
- All 1,043 governed review records, including 122 evidence-linked review identities, 921 unmapped review identities, static rejections, retirements and the still-unreviewed discovery source observations.
- A 247-row outcome register that explicitly distinguishes existing descriptions, missing essential workflow definitions, and absent qualification.
- Separate prior and proposed extensions. New domains are proposals, not silently merged into recognized taxonomy.

The gap ledger reuses the source-byte-verified CorpusIndex and the crosswalk-verified CapabilityGraph. It generates one precise row per recognized route and refuses missing/duplicate routes or invalid proposal source pins.

## Operational gap classes

1. LINKED_SOURCE_NEEDS_WORKFLOW_DEFINITION: a source-evidence-linked review exists, but a useful, testable essential workflow definition is not yet complete.
2. NAME_ONLY_LEADS_NEED_SOURCE_REVIEW: a name-only review hint exists but no source-evidence-linked method is established, with no defined essential outcome.
3. NO_EVIDENCE_LINKS_NEEDS_DISCOVERY: no evidence-linked or name-only governed review is mapped. This does NOT mean no relevant skill or discovered source exists.
4. DEFINED_WORKFLOW_NEEDS_QUALIFICATION: the workflow is described, source navigation links exist, but rights, source accuracy and behavior are not approved.
5. DEFINED_WORKFLOW_NEEDS_SOURCING: outcome is described, but no governed source has an evidence-backed route link.

The priority queue is an **intake-work distribution queue**, not a subjective ranking of skills. It cycles across domains before returning to a domain, then sorts that domain's routes by presence of a review-ready draft and the explicit gap category. This keeps creative, security, research, science, game and AI systems domains visible rather than allowing software engineering to monopolize the queue.

Every category has 0 approved methods until independent source-specific rights, references, authority and host acceptance are proven. Raw observation counts, popularity, filename words and static grades never change this.

## Thirteen new draft workflow definitions for human review

docs/technical/essential-workflow-proposals-v1.json contains thirteen *new, original requirement proposals* covering software frontend, accessibility testing, software supply-chain, systems balancing, memory provenance, research reproducibility, UX usability testing, model quantization, agent tool design audio mixing, technical drawing, robotics safety and medical evidence appraisal. Each has explicit required inputs, outputs, correctness acceptance criteria, dependencies, failure modes, refusal behavior and exact original outcome-register path/pin.

These are **specification-gap fills**, not newly installed skills. They are explicitly not imported into the skillz essential outcome register. They do not assert that any existing method fulfills the specification. Each proposal must be reviewed against actual source evidence, revised as required, accepted by the owning skillz taxonomy/governance process, and only then captured in a newly pinned export that Skill Mason independently validates.

The parser refuses proposals whose source snapshot, source route or current outcome definition status changed, those with missing acceptance/failure controls, those that claim host/rights/behavior authority, and those for nonexistent or already-defined routes.

## Offline usage

Requires complete pinned skillz publication and original source checkouts. The proposals input is optional and is *not* an authority source.

~~~sh
python3 -m scripts.capability_gap_backlog \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  --proposals docs/technical/essential-workflow-proposals-v1.json \
  summary --limit 40

python3 -m scripts.capability_gap_backlog \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  --proposals docs/technical/essential-workflow-proposals-v1.json \
  focus memory-context/provenance
~~~

## Acceptance and remaining barriers

tests/test_capability_gap_backlog.py covers full route cardinality, domain distribution, name-only lead separation, stale outcomes, missing correctness or failure criteria, fabricated paths, duplicate proposals and false authority promotion. The existing pinned corpus CI executes the complete ledger and representative focus receipts.

No automated discovery crawl, model-generated semantic match, external host execution, legal rights check, or Prism composition happens here. Remaining core gaps are independently reviewed method and package relevance, on-demand third-party full-package retrieval, provenance/license verification, exact host permissions, publisher authentication, real acceptance tests and versioned snapshot accession. This tranche does not close Skill Mason #30 or #17.

## SM-01B: exact-source scope-gap review (nonadmitting)

A matched review in the recognized directory is an invitation to inspect a source, **not** evidence that its method covers the requested essential workflow. The source/workflow review script uses the existing pinned, complete first-party package inspector, the same immutable C2 route/crosswalk and the 13 governed-*draft* requirements. It verifies the original source Git object and SHA-256, the complete package file inventory, exact source passage locations, and the proposal objective before recording a negative scope assessment.

The initial [MCP-vetting scope record](../evidence/source-outcome-scope-mcp-vetting-v1.json) explains a concrete mismatch: the original method is a static, nonexecuting MCP-server preconnection review, while the proposed security/supply-chain objective reaches generic software release dependencies and signing provenance. It does not condemn the original method, silently revise the passive Skillz repository or infer a legal grant from the repository's ownership or the source's author field. A narrower MCP preconnection outcome is explicitly only a candidate for separate upstream review and source snapshot accession.

The machine check establishes **which exact bytes and passages the negative reviewer judgment is based on**. It cannot prove semantic completeness, authenticate the human reviewer or make a positive skill eligible. A changed source/proposal/crosswalk, tampered package receipt, missing or ambiguous quote, forged rights assertion, or inconsistent source pin refuses. Both a successful gap record and a typed refusal leave rights, host validation, Prism admission, composition and actual behavioral coverage **false**.

Run it on the two independently pinned source checkouts:

~~~sh
python3 -m scripts.source_outcome_scope_review \
  --handoff /path/to/skillz-published/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original-pinned \
  --proposals docs/technical/essential-workflow-proposals-v1.json \
  --review docs/evidence/source-outcome-scope-mcp-vetting-v1.json
~~~

The existing request-to-skill CI runs this real original-source review and its adverse controls without adding a separate workflow or an expensive native Prism execution. Its receipt is included with the existing bounded user-request evidence artifact. **Next development dependency:** independently establish source-supported essential outcomes and author/reuse authority under the appropriate Skillz review process; then accession the new snapshot before enabling any candidate in the composer.
