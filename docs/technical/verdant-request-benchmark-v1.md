# Request-understanding benchmark: 45 held-out tasks

**Status:** experimental evaluation, no product integration or source-use authorization. Follow-up to [Verdant interface screen](verdant-language-fit-v1.md) and [request-to-qualified-skill issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17).

## Decision question

Would a local language system improve Skill Mason's ability to identify a request's intended capability and testable outcomes before Prism? This experiment establishes the **actual original Skill Mason baseline** and probes whether a cheap, bounded *passage-like lexical* retrieval adapter is sufficient to improve it. The adapter is **not Verdant** and is not a trained SLM. Any improvement from this adapter is evidence **against adopting a neural dependency merely to achieve better token matching**. The previously examined Verdant `CodedSlmDirector` has a real 16-engine-action vocabulary and cannot independently produce Skillz route labels; its `VerdantLanguageEngine` is domain-specific NPC dialogue grounding, not verified skill authoring.

## Predeclared data and rules

- [Held-out benchmark](../../benchmarks/verdant-request-holdout-v1.json): **45 manually authored** requests, three variants for each of 13 distinct Skill Mason draft workflow routes (39 in scope), plus six outside the *evaluated 13-route subset*. These are **author-labeled experimental labels**, not independently adjudicated task truth. An outside request may still belong to another recognized Skillz route.
- **Candidate evidence corpus:** the existing 13 DRAFT_NOT_GOVERNED rows in [essential workflow proposals](essential-workflow-proposals-v1.json). Their objective, declared inputs, outputs, acceptance criteria, dependencies and route name are retrieval text, **never authority**.
- **Actual current baseline:** the unchanged `CapabilityGraph.search(prompt,limit=25)` over the separately authenticated historical Skillz handoff, not a mock. The current CLI's `create` requires the route; this baseline applies full requests to its existing lexical route search.
- **Experimental retriever:** deterministic bag of tokens and source-row inverse document frequency, 2 or more overlapping content tokens, minimum query-weighted overlap **0.18**, ambiguity margin **0.045**. These thresholds were set before the first original-source CI measurement. Returns an unassessed lexical **lead** or abstains, never passes to Prism/composer.
- **Verdant native trial:** Optional `--verdant-cli /absolute/path` invokes the **genuine** original `route-intent` for all 45 requests and records its native engine-action outputs or refusals. It cannot be scored for direct Skillz route accuracy, because there is no authorized engine-to-Skillz mapping. The active source-only experiment does not claim a native Verdant run.

## Metrics and limitations

The evaluation reports, for each arm, exact top-1 and top-3 recognition among the 39 labeled requests, incorrect non-abstaining predictions, abstentions among known routes, and false positive vs abstain for the six outside-the-13-route examples. It retains all 45 case records and input hashes. All model-inference metrics apply only to the **deterministic lexical arms**, not a future native Verdant experiment. We have **not** measured essential-outcome extraction precision/recall, source rights, verified method coverage, cost of a trained SLM, or real host task success.

The small benchmark exposes performance problems; it **cannot justify production adoption** without separate ground-truth review, actual native model use, cost measurements, and held-out adversarial retests.

## Reproduce with the original pinned Skillz corpus

Use `Knapp-Kevin/skillz@efba572262fc5fa3ff1934b054aa4f15ce149c1a` for the export and its original source worktree `31a8c518dd97b7828adcc728202fa41388a306d7` with tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`.

```bash
python3 -m unittest discover -s tests -p 'test_evaluate_request_language.py' -v
python3 -m scripts.evaluate_request_language \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  > request-language-benchmark.json
```

[Original-source benchmark CI](../../.github/workflows/request-language-benchmark.yml) performs these exact steps on a read-only original checkout and stores its complete per-case evidence for 14 days, with no additional native Prism SDK gate, no local model installation, and no remote model API call. The signed rights/authority decision is **out of scope**.

### GO / NO-GO

1. **No direct Verdant integration** based on engine intent output or the lexical adapter alone. The 16 intents are for Verdant's engine. Raw native logits are not calibrated model probabilities.
2. If an adapted language interface is proposed, show a **material improvement over the lexical comparator** on a different held-out set, without worsening out-of-domain false positives. Measure outcome extraction, operator intervention, latency, memory, model tokens/compute and runtime permissions. This requires separately accepted mapping and native evaluation.
3. Regardless of interpretation approach, final Skill Mason creation still requires independently evidenced method/asset rights, source provenance, host permissions and Prism acceptance. The model cannot issue approvals for itself.

The answer to the user must distinguish **better request-to-route retrieval** from the much larger **request-to-qualified-skill** objective.
