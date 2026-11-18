# Corpus evolution and sharded source-frontier intake (Skill Mason #30)

**Status:** Implementation candidate, stacked on PR #31. Read-only, never a grant of reuse, redistribution, execution, or publication authority.

## Why this matters

The pinned 2026-11-18 skillz handoff contains 1,043 governed reviews, 61,326 G1-G3 observations, and 4,813 separately overlapping four-source observations. The resulting 67,182 index rows are *not unique usable skills*. Expanding source coverage without distinguishing exact source placement, content claims, and independent review would make the count larger but the product less truthful.

### Source-placement identity

The new scripts/corpus_evolution.py module uses only a fully verified pinned CorpusIndex. Every original source family, shard path, JSON pointer and raw observation survives. Separate keys preserve (a) source repository, full pinned revision and entrypoint path; (b) observed entry Git blob SHA-1; and (c) observed containing-package Git tree SHA-1.

It counts fully specified placement **claims**, repeated identical observations, conflicting tree claims at the same source/pin/path, and potentially same-tree-hash leads across sources. It marks missing, malformed and unsafe identity fields explicitly. A matching SHA-1 is not independent verification of complete source bytes or authorship; identical package trees do not transfer rights or suitability across source owners. It never executes source instructions.

### Sharded external-source proposal (untrusted)

Additional source families can enter a **preview** using proposal.json plus canonical UTF-8 NDJSON shards. Source families remain open-ended; each shard is independently bounded by byte count and SHA-256 digest, and the manifest declares exact record counts. This enables review of additions without copying them into the production source selection index.

Proposal manifest fields:
- schema_version: qortara/source-frontier-proposal/1
- source_id: stable source-family ID, as claimed
- repository: upstream source identifier, as claimed
- pinned_revision: full lowercase 40-hex Git revision, as claimed
- admission: proposal-only
- review_state: unassessed
- rights_state: unassessed
- record_count: integer total across shards
- parts: list of objects with path, bytes, sha256, record_count

Each NDJSON row carries a source-relative SKILL.md path, an entrypoint_git_blob_sha1 and a package_git_tree_sha1 when known. Untrusted extra fields are never treated as tool instructions, evidence of permission or source qualification. The preview preserves two independent dimensions: the disposition relative to the trusted snapshot (new, duplicate, changed/contradictory or unresolved) and the separate repeated-within-proposal count (identical fingerprint, contradictory fingerprint or unknown fingerprint). It never hides a same-pin contradiction by relabeling it merely as a duplicate. Changed shard bytes, missing files, symlinks, truncated counts, and unsafe shard paths refuse explicitly.

The preview performs **no** source network fetch, source authentication, writes to skillz, corpus admission, license determination, or generated-skill installation. Its SHA-256 checks compare self-declared proposal hashes only. This is structural integrity, not independently authenticated provenance.

## Offline CLI

Prerequisites: Python 3, Git, complete original source checkout at the exact pinned commit and handoff publication checkout.

~~~sh
python3 -m scripts.corpus_evolution \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original summary

python3 -m scripts.corpus_evolution \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  preview --root /path/to/source-proposal

python3 -m scripts.corpus_evolution \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  tree 0123456789abcdef0123456789abcdef01234567 --limit 20
~~~

## Required future expansion

Upstream skillz #599 remains the source of independent discovery and review; skillz #588 owns evidence-backed capability mappings. A proposed frontier does not enter the trusted selection corpus until upstream has published a governed new snapshot and Skill Mason has accepted its **separate exact handoff/publication/source pins** through an independently reviewed change. The existing C1 adapter deliberately rejects arbitrary newer manifests. A future exporter should declare every source-family denominator and the evidence pointer count and report previous-versus-new snapshot delta explicitly. No newly discovered, removed, changed or unreviewed identity may be silently promoted or omitted.

After successful accession, Skill Mason C2 decomposes essential outcomes, C3 resolves actual complete relevant package assets and independent rights/dependency/host permissions, and only then may governed Prism selection/composition be attempted. This change does not finish C3, #30, or #17.

Synthetic positive and planted negative controls live in tests/test_corpus_evolution.py, and exact pinned-source regression tests live in .github/workflows/corpus-index.yml. Native Qortara and owner acceptance are independent HOLDs.
