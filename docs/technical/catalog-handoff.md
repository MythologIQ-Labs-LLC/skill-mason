# skillz catalog handoff: read-only integrity inspection

**Implemented source-only:** metadata ingestion and complete-review-count reconciliation. No composition permissions, Prism evaluation or user-output skill generation.

Source: [skillz Skill Mason handoff](https://github.com/Knapp-Kevin/skillz/tree/main/registry/exports/skill-mason-v1). Observed pinned source commit `31a8c518dd97b7828adcc728202fa41388a306d7`, Git tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`, and published manifest Git blob `55974d44fdfde36bd537a552feac933c341e1895`.

The handoff identifies 1,043 governed paired reviews (48 first-party, 995 third-party; 122 mapped, 921 unmapped), versus 61,326 G1–G3 observations and 4,813 four-source paths. **Do not add overlapping populations or treat verification as reproduction rights.**

## Local invocation

```sh
python3 scripts/catalog_handoff.py \
  --handoff /path/to/skillz/registry/exports/skill-mason-v1 \
  --report /path/to/new-report.json
```

The inspector checks the published manifest Git blob, the declared source commit/tree identities, exactly two generated artifact SHA-256 and byte sizes, canonical UTF-8 records, unique review IDs, every state count, and explicit not-assessed composition/rights state. It rejects altered, symlinked or missing inputs and refuses to overwrite an existing report. It does not run source instructions, network requests, model calls or a Prism guest. **Only synthetic fixture tests are automated in this PR; an actual 1,043-record checkout acceptance remains separately required.**

An exact Git blob match proves manifest byte integrity **relative to that pin**. It does not independently authenticate publisher identity or verify that the source commit resolves to its declared tree. Source-file content hashes (2,825 files) and submodule pins (12) are counted, **not yet independently checked**. Any method selection must separately establish real source rights, freshness, required outcome coverage, target host authority, dependencies, and a genuine Prism decision.

## Full source-byte integrity verifier (new, separate from rights)

The read-only [source snapshot verifier](../../scripts/verify_catalog_source.py) closes the prior gap between **declared** source-file fingerprints and actual pinned checkout bytes. It invokes the existing pinned handoff inspector first, verifies the source's exact Git commit and tree, then checks the complete tracked blob/gitlink inventory against the manifest. For every tracked source file, it requires a non-symlinked regular file at the declared relative path and independently recomputes its **byte count, Git blob SHA-1 and SHA-256**. Every declared submodule gitlink must match its pinned commit. No submodule is initialized or executed. Missing/extra declarations, stale checkouts, symlinks, corrupt bytes and changed manifest data refuse.

The publication snapshot is `Knapp-Kevin/skillz@efba572262fc5fa3ff1934b054aa4f15ce149c1a` (the commit that published the export), while its source manifest points to the **earlier** source commit `31a8c518dd97b7828adcc728202fa41388a306d7` / tree `e6d5dfeb42bcd7777ddff52605922fead62135ff`. These are different commits **by design**, so checkout both. Running the verifier against the export commit as if it were the source revision must refuse.

```sh
# Using two distinct, pinned, disposable, credential-free checkouts:
python3 -m scripts.verify_catalog_source \
  --handoff /path/to/export/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/checked-out-source-31a8c518 \
  --report /path/to/unused-report.json
python3 -m unittest discover -s tests -p 'test_catalog_snapshot.py' -v
```

The [pinned CI job](../../.github/workflows/catalog-source-integrity.yml) checks out the export publication with **no submodules**, creates an offline Git worktree at the historical source commit, and runs both synthetic negative tests and the complete real byte inventory. It does not run third-party skill code, invoke a model, authenticate publisher ownership/signatures, inspect submodule contents, or authorize rights. Even a full source-byte PASS remains `composition_eligible:false`, `source_rights_assessed:false`, and `production_qualified:false`.

**Prior live metadata-only observation:** a connector-based comparison of the manifest to the Git commit tree matched 2,825/2,825 Git blob identities/sizes and 12/12 gitlinks. This observation alone did **not** recompute file SHA-256. The independent checkout CI result, once complete, is the separate source of actual byte verification.

## Straight-line completion sequence

1. Inspect the pinned metadata handoff with all records, rejects and unmapped entries retained. Source-only importer implemented; live dataset test pending.
2. Authenticate upstream commit/tree and all source-package bytes and assets; accept explicit rights and freshness evidence.
3. Bind those assertions to the real native Prism SM-01 model and verify genuine refusal/output vectors.
4. Compose the first task-specific, source-backed `SKILL.md` and exact provenance/coverage receipt, without model inference.
5. Test actual host behavior and receipts; then integrate the same qualified core through CLI and GitHub Pages. Local `stdio` MCP remains deferred behind these.

Native Prism work is owned by draft [PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15). Do not merge or reproduce its work here. Security/native Qortara qualification remains open in [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4).
