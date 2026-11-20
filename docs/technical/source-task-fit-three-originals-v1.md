# Three original Skillz methods: source-verified task fit (C3/C4)

**Status:** Source-specific qualitative method reference candidates, **not** approved source reuse or independently validated agent behavior. Original upstream pin: [Skillz `31a8c518`](https://github.com/Knapp-Kevin/skillz/tree/31a8c518dd97b7828adcc728202fa41388a306d7).

The earlier MCP preconnection review was the only independently source-cited task contract. This development adds three **materially different original methods** from the 48 first-party records in the exact governed Skillz export. We inspected their exact original source text and recorded 15 concrete acceptance scenarios with positive and negative task outcomes.

| Original method | Exact original Git blob | Narrow, proposed use | Important exclusion |
| --- | --- | --- | --- |
| [Repo Doctor](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/repo-doctor/SKILL.md) | `fed90fa0a664611e560bbc3ded630eb9e72253e1` | One user-approved repository's non-mutating, evidence-ranked health punch list | Not arbitrary private org traversal, unsafe Git-helper execution, or automatic fixes |
| [Agent Postmortem](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/agent-postmortem/SKILL.md) | `dde789e87da090b92021b3e55304299244f62ac2` | One approved session's timeline, earliest determining cause and 1–3 falsifiable lessons | Not automatic memory/governance writes or fabricated certainty from incomplete logs |
| [Permissions Review](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/permissions-review/SKILL.md) | `18f46840032829963715ec23894f7826dbbfcb77` | Scope-bound inventory of agent-accessible tools, credential classes and host-enforced restrictions | Not broad `Bash(git *)` permission, secret-store reads, changing settings or unapproved scheduling |

Each [review contract](../evidence/source-task-fit-repo-doctor-v1.json) is a complete source-bound proposal with five Gherkin-style scenarios, separately scoped inputs/outputs, explicit exclusions and four exact original source quotation roles. The other two contracts are [Agent Postmortem](../evidence/source-task-fit-agent-postmortem-v1.json) and [Permissions Review](../evidence/source-task-fit-permissions-review-v1.json).

## Why source-only reviews are necessary

A governed skill can have a valid technical/source identity while its linked capability taxonomy is much broader than its actual purpose. Requiring a reviewer to pick a matching broad route before examining the original method encourages accidental scope promotion. We now accept an explicit `"route": null` in a **source-only task review**. That is not an automatic route choice. It binds the exact governed first-party ID, checks the entire source package and original Git blob, validates the *actual* complete pinned recorded crosswalk, and then reports all linked routes as **`original_evidence_linked_routes_not_task_qualified`**.

The result cannot be interpreted as a route/outcome admission: `source_only_review_no_route_claim:true`, `route:null`, `registered_route_outcomes_not_qualified:null`, `outcome_coverage_qualified:false`, `composition_eligible:false`. The earlier exact-route MCP review still works unchanged. A forged linked path or unrecognized method refuses; an unmapped or incorrectly mapped source is not silently assigned a new route.

## Qualitative observations from original text

- **Repo Doctor:** Includes a specific, non-obvious safety condition: local `git status --porcelain` may execute a program configured through repository `core.fsmonitor`; read-only cannot be inferred from command name. This is useful reference material for a safe repository audit, but the source does not demonstrate that a connected consuming agent can enforce safe Git inspection.
- **Agent Postmortem:** Distinguishes the earliest determining causal point from the last visible failure, demands time-bound evidence, and permits `undetermined`. Its lessons are proposals, not writes. It needs actual agent-host application to show it consistently refuses unsupported causal certainty.
- **Permissions Review:** Correctly rejects the superficially narrower `Bash(git *)` shell wildcard and treats last-use unknown as a finding rather than authority to revoke. It also requires separate approval before scheduling future reviews.

All three upstream static reviewer records say **independent consuming-host behavior remains unverified**. Repo Doctor and Permissions Review have additional source-specific held scanner/host evidence in the original registry. The underlying original repository reports an MIT license for first-party sources, but its *recorded* source license is **not a signed reuse decision or permission check by Skill Mason's trusted operator**. We do not copy their skill text into a generated package.

## Actual pinned end-to-end source verification

The preexisting `corpus-index.yml` exact-source job loads a single pinned upstream `CorpusIndex` + `CapabilityGraph`. It then runs `assess_task_fit` on all three source-specific reviews, verifies the complete package, immutable original Git blob and source quotations, 4 evidence roles and 5 future scenarios each, and **checks no rights/host/route approval was created**. After that, the ordinary `qortara-skills task-fit --review ...` command runs all three against the same pinned upstream and the results are compared to the direct Python verifier.

From a checked-out repo with the pinned published export and separate original source tree:

```sh
for method in repo-doctor agent-postmortem permissions-review; do
  node bin/qortara-skills.mjs task-fit \
    --review "docs/evidence/source-task-fit-${method}-v1.json" \
    --handoff skillz-export/registry/exports/skill-mason-v1 \
    --source-checkout skillz-source
done
```

## Direct task application after source validation

The later [six synthetic case inputs](../../tests/fixtures/corpus-three-originals-evaluation-6.json) have been directly evaluated through these original-method instructions by the same assistant. Their [six complete authored reports](../evidence/corpus-three-originals-direct-6.json) preserve the observed, source-linked decisions and redacted/withheld information. A [runnable checker](../../scripts/grade_corpus_three_originals.mjs) and [12 adversarial regressions](../../tests/corpus_three_originals_qualitative.test.mjs) catch missing critical findings, unsupported evidence IDs, unapproved Git-helper operations, invented agent root causes, credential leakage, dangerous MCP permission under-ranking, unauthorized scheduling, and assertions of production/host evidence.

Results are reviewed **within the exact fictional task inputs only**; the six answers are not independently blind-judged, do not measure transfer to lower-capability models and were not produced by a separately installed consuming agent. Even a passing regression does not change `host_validated:false` or `rights_qualified:false`. This is a *method-specific qualitative exploration*, not a production acceptance test.

**Next real capability:** Run original-method instructions against separately supplied, permissioned, unseen host tasks; preserve complete output/negative-control evidence; independently evaluate the results and rights before any governed operator source acceptance or Prism composition. Source-hash verification is necessary but does not imply good decisions or lawful redistribution.
