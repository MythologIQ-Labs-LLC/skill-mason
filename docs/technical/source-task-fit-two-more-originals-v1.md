# Two additional original first-party task references

**Status: Source-verified reference proposals only. No independent host qualification, no owner-granted rights, and no Prism admission.**

Skill Mason now offers bounded source-task-fit references for **six** original first-party methods from the same immutable Skillz snapshot, rather than four. This release adds two materially different reference workflows. They do not overwrite or reclassify the 1,043-record governed corpus.

Original repository: [Knapp-Kevin/skillz at `31a8c518dd97b7828adcc728202fa41388a306d7`](https://github.com/Knapp-Kevin/skillz/tree/31a8c518dd97b7828adcc728202fa41388a306d7); tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`.

| Original source | Exact Git blob SHA-1 | Bounded task supported by source | Excluded assumption |
| --- | --- | --- | --- |
| [Automation Receipts](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/automation-receipts/SKILL.md) | `94fb288d7d6a3ea6982f22bd8bb9ef77b9de7add` | Verify one explicitly scoped automation status claim against independently durable scheduler, timestamp, exit and output evidence | A configured schedule proves execution; connector access authorizes arbitrary private logs; status verification may create or modify automations |
| [Fact Check](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/fact-check/SKILL.md) | `d83c43282d525682f3e13b8296111d7fe7de46f0` | Decompose an authorized factual claim and report dated source-grounded, confidence-qualified subclaim and overall verdicts | Missing evidence proves falsehood; a news report about research is the primary paper; the model actually opened an uncited source |

## Qualitative method reading

**Automation Receipts:** The original receipt matrix, procedure and boundaries are explicit enough to distinguish three useful outcomes, `substantiated`, `unsubstantiated` and `contradicted`. Its strongest non-obvious control is that a scheduler record plus a successful-looking human message does **not** demonstrate successful work. A run can fail after scheduling, and a successful run can still have no independently confirmed artifact. The original source also restricts reading private receipts to the exact account/workspace/time window and forbids schedule changes. These are **source instructions**, not observations of a host following them.

Five bounded cases in [the original-source task contract](../evidence/source-task-fit-automation-receipts-v1.json) cover: complete matching completion receipts, schedule-only claims, failed run behind a completed claim, out-of-scope private logs, and hostile log content with sensitive artifact links. Each case specifies the evidence and whether verification should proceed or withhold an unsupported claim.

**Fact Check:** The original explicitly differentiates `supported`, `refuted`, `unverifiable` and `needs-context` for subclaims and asks what actual evidence would change the verdict. The particularly important boundary is **absence of evidence vs evidence of absence**. Its reference instructions require every cited source and publication date to have actually been accessed; an agent must not manufacture live research just because the answer format has a Sources section. A secondary article cannot be promoted to primary data. The source has clear injection and secret-redaction boundaries.

Five bounded cases in [its source-cited task contract](../evidence/source-task-fit-fact-check-v1.json) cover: a compound mixed claim, no primary evidence, only a secondary article, an outdated fact missing context, and hostile retrieved content containing a synthetic sensitive marker.

Both references bind **four exact original line ranges** (trigger/scope, method, output/evidence, safety) to their complete source-package Git and SHA-256 verification, and contain five **proposed, not yet executed** measurable/negative cases. They are source-only reviews with `route:null`: there is no automatic semantic routing or broad taxonomy outcome qualification. `reviewer_finding` is the analyst's interpretation, not cryptographic or independently authenticated truth.

## What actually changed in the generator

The ordinary request evaluation in `scripts/request_to_skill.py` now recognizes the two additional **exact** governed review IDs when a caller explicitly selects a method belonging to a verified recognized route, returning their source-cited task reference alongside the existing C4/C5 negative eligibility evidence. The corpus reference CLI can directly verify the task review without going through arbitrary text-based routing:

```sh
node bin/qortara-skills.mjs task-fit \
  --review docs/evidence/source-task-fit-automation-receipts-v1.json \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source

node bin/qortara-skills.mjs task-fit \
  --review docs/evidence/source-task-fit-fact-check-v1.json \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source
```

The pinned `corpus-index.yml` workflow executes both new contracts through `assess_task_fit` and through the ordinary Node CLI, comparing all results. It verifies exact original complete package/citation integrity and explicitly asserts zero rights, Prism, host behavior or production approval. The source's recorded `metadata.author`, MIT notice and static review scores do **not** prove the user's specific task is safe or that Skill Mason has an authorized grant.

## Still required

These are **source-backed capability references**, not additional eligible inputs to production skill generation. To qualify a method for an actual host, the operator must validate current source licenses/NOTICE and all package references, issue an independently verified rights and host-scope acceptance, then perform actual consuming-host tests of the proposed positive/refusal cases. Those tests need retained raw evidence and independent qualitative review. Until then the ordinary generator's typed rights and task-fit refusals are intentional.

The next corpus development work is to repeat this **complete-original-source plus narrowly executable task contract** process for substantively different first-party or authorized third-party methods, and to measure transfer to real agents rather than treating 20/20 static grades as performance.
