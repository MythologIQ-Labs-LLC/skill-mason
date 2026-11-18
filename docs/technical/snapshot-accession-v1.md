# Complete snapshot accession preflight (C1/C6 versioned handoff gate)

**Development contract.** The purpose is to detect and preserve changes between the currently trusted pinned \`skillz\` publication and a proposed future one, **not** to follow \`main\`, automatically approve a version, or infer author rights. Source code: [scripts/snapshot_accession.py](../../scripts/snapshot_accession.py). Synthetic adversarial controls: [tests/test_snapshot_accession.py](../../tests/test_snapshot_accession.py).

## Trust boundary and required source inputs

The current snapshot is authenticated by the existing immutable Skill Mason pin and independently indexed with \`CorpusIndex\`. It is the **accepted comparison baseline**, not evidence that its 1,043 reviewed sources are usable methods.

The candidate must be provided as a separate handoff directory and separate exact Git source checkout. Its complete 40-character \`--candidate-manifest-blob\`, \`--candidate-source-commit\`, and \`--candidate-source-tree\` are **caller-supplied candidate claims**, not independent publisher signatures. The inspector refuses missing/mismatching pins, manifests and source trees. The source checker reads Git objects and SHA-256 checks every declared regular tracked source file; it also checks all Gitlinks, source-count denominators and symlink-safe actual paths.

The candidate must preserve the existing v1 artifact contract or undergo separately accepted schema migration. Exactly two export artifacts are expected: \`governed.ndjson\` and \`discovery-manifests.json\`, each hashed and byte-counted in the exact manifest. All governed lines must be canonical, uniquely identified, self-consistent and retain non-admission states. For each declared source family, load **all** source-verified observation shards and reconcile full record counts, manifest pointers, evidence pointers and first-party source entrypoint references. No bounded representative sample may stand in for complete denominator validation.

## Review receipt

The emitted report includes:

- Complete \`governed\` ID changes: additions, removals, changes at the same identity; the review-status transition matrix, counts of every top-level changed governed field, and exact source pin references.
- Complete \`observed_source_rows\` changes by full source-file plus exact JSON row pointer; this tracks **observations**, not unique skills or semantic coverage.
- Tracked original source-file path+SHA-256 changes and separate discovery/evidence/first-party/engine pointer changes.
- Explicit changed taxonomy artifacts and changed original Git commit/tree/manifest pin flags.
- Per-delta full counts, lexicographically bounded examples, and SHA-256 of the **complete ordered changed-identity list**. A sample is never the denominator, and observations never become approved methods solely by being newly enumerable.

All source and review changes require human evidence review. Even a zero delta or exactly matching SHA-1 identity **does not** grant modification, redistribution, network/tool access, target host fit, or Prism composition.

## Offline CLI

The proposed candidate pin must have been independently obtained and accepted in the governing repository before recording it as a new active pinned snapshot. Previewing a proposed pin is not acceptance.

~~~sh
python3 -m scripts.snapshot_accession \
  --old-handoff /path/to/previous-publication/registry/exports/skill-mason-v1 \
  --old-source-checkout /path/to/previous-original-source \
  --candidate-handoff /path/to/proposed-publication/registry/exports/skill-mason-v1 \
  --candidate-source-checkout /path/to/proposed-original-source \
  --candidate-manifest-blob <40-hex-exact-Git-manifest-blob> \
  --candidate-source-commit <40-hex-exact-source-commit> \
  --candidate-source-tree <40-hex-exact-source-tree> \
  --report /path/to/new-report.json
~~~

The optional report path uses exclusive create, not overwrite. The tool writes no source/corpus bytes and never changes accepted pins. It is source-read-only and returns code 2 for all explicit refusals.

## Initial pinned native-CI integration

\`.github/workflows/corpus-index.yml\` runs the candidate inspector using **the exact currently accepted handoff and original source as both inputs**, with the known independently pinned old manifest Git blob \`55974d44fdfde36bd537a552feac933c341e1895\`. It must report precisely **0** additions/removals/changes in **1,043** governed reviews, **66,139** observed raw source-path rows and **2,825** tracked source files. It must retain the 247-route capability gap and all 13 draft workflow checks from the prior stack. This is a regression proof for the new comparison engine, **not** a test of a future revised snapshot or new source publication.

The 23 synthetic tests plant changed source hashes, review-state upgrades, omitted records, source path drift, unsafe rights claims and manifest/shard population failures. Such fabricated snapshots either trigger explicit refusal or remain visible in a blocked comparison receipt. None is admitted.

## Next gates

1. Review and qualify upstream [\`skillz\` exporter issue #726](https://github.com/Knapp-Kevin/skillz/issues/726) and [draft PR #727](https://github.com/Knapp-Kevin/skillz/pull/727). The historical snapshot remains immutable.
2. Publish a **new** immutable source handoff and independent revision pin with a full source/record migration report. Verify the new complete original source checkout, then run this preflight against the accepted old source.
3. Investigate every changed source/record/pointer, including deleted records, source-origin and license/authority changes, review-state upgrades and losses of prior evidence. Do not auto-resolve conflicts.
4. Independently qualify publisher/source rights, external complete package dependency closure and host authority, and obtain native Qortara + adversarial + owner acceptance. Only then update accepted import pins in a separately reviewed commit.

**No completed snapshot upgrade, installed skill, rights clearance, or host success is claimed by this proposed gate.**
