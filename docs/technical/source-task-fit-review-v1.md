# Original-source task-fit review (C3/C4 qualitative handoff)

**Purpose:** Turn an original reviewed skill into a *bounded, evidence-grounded method candidate* with an explicit input/output contract and future behavioral acceptance cases. This is useful source material for Skill Mason's generator, not a new admission gate or a claim of a working skill on every model.

## Contract and evidence

The reviewer-authored `docs/evidence/source-task-fit-mcp-vetting-v1.json` declares a narrow task, required inputs and outputs, exclusions, separate measured-task and mandatory-withhold scenarios, and four distinct evidence functions:

1. Trigger and operational scope, including exact exclusions.
2. Original method steps needed for the bounded task.
3. Required evidence/report output and decision behavior.
4. Security and authority boundaries.

`scripts/source_task_fit_review.py` validates this submitted interpretation against a separately authenticated **complete original first-party Skillz package**, not just text returned by a search engine or a `verified` label. It checks the source snapshot commit/tree, governed review ID, bidirectional route crosswalk, original entrypoint Git blob, entire package file list, each referenced source file SHA-256/Git blob, bounded line numbers and the quoted bytes. It returns citation links, exact quote hashes, a task specification and five acceptance scenarios for later consuming-host evaluation. An unsupported or unlinked source, forged status/rights, stale pin, omitted safety role, empty scenarios or unmatched original bytes fails closed.

The content still requires human evaluation: the source lines are authentic, but the **reviewer's interpretation** is not independently proven. A test plan is not a passing execution. The returned record has `source_quotes_prove_bytes_not_reviewers_semantic_conclusion:true`, `actual_consumer_host_task_runs:0`, `rights_qualified:false`, `host_validated:false`, `operator_source_acceptance_signed:false`, and `composition_eligible:false`.

## Real original method: MCP server preconnection vetting

The pinned [Skillz MCP Vetting entrypoint](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/mcp-vetting/SKILL.md) actually describes an evidence-based **static MCP server preconnection security review**, including exact candidate identity, tool inventory/authority, credentials and outbound data, injection/dependency review and a scoped recommendation. The author records it as non-installing and non-connecting. The source is a substantive reference for generating that narrower procedure, provided the real source-rights, publisher, host and method-behavior qualifications follow.

The broader **`security/supply-chain`** route proposes inventorying arbitrary release dependencies and artifact provenance before a release decision. This source does not establish those broader outcomes. The reviewer file therefore records explicit noncoverage and scenario `broad-non-mcp-release-demand`: refuse treating MCP-only static review as general software release qualification.

The source also identifies its `metadata.author` as `frostwulf.zo.computer`. That is a **recorded claim**, not independently authenticated authorship or permission to redistribute, edit or embed this skill. This module never opens secret stores, executes external skill instructions, signs positive source assertions, grants rights or invokes Prism.

## Exact pinned command

```sh
python3 -m scripts.source_task_fit_review \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  --review docs/evidence/source-task-fit-mcp-vetting-v1.json \
  > corpus-task-fit-reference.json
```

The existing `corpus-index.yml` workflow checks out the independent immutable Skillz source revision and exercises that command against actual original source. Synthetic adversarial tests detect several ways stale or forged evidence could otherwise look plausible.

## Completion boundary

**Delivered:** a task-specific, original-source-bound reference contract and scenarios for real qualitative evaluation.

**Not delivered:** a reviewer-independent semantic sufficiency verdict, legal rights, closed reference dependencies, a signed operator source acceptance, a positive Prism admission, cross-model behavior evidence, or a production-ready generated skill.

**Next:** perform the acceptance scenarios on real user-authorized host/model executions, score actual reported outcomes against original source requirements, independently verify publisher/asset rights, and accept a specific *narrow* method with the existing trusted source/four-fact mechanisms. Only those evidenced and authorized actions can move the source toward composition.
