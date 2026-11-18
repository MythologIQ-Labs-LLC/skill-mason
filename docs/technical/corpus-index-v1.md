# Corpus opportunity index v1 (Skill Mason #30, C1)

**Status:** Implementation candidate; not yet accepted, merged, rights-qualified, Prism-admitted, or behaviorally validated.

## Source boundary

scripts/catalog_index.py provides complete read-only snapshot enumeration and lexical lookup. It loads the verified handoff and separately verified pinned original source checkout, then refuses missing pointers, altered source bytes, unexpected shard counts, duplicate IDs and omitted source families. Imported skill text is inert data. No source skill is executed, activated, installed, or copied.

The publication pin and source pin are different:
- Handoff publication: Knapp-Kevin/skillz commit efba572262fc5fa3ff1934b054aa4f15ce149c1a.
- Original source: commit 31a8c518dd97b7828adcc728202fa41388a306d7, Git tree e6d5dfeb42bcd7777ddff52605922fead62135ff.
- Exact handoff manifest blob: 55974d44fdfde36bd537a552feac933c341e1895.

Git blob/tree SHA-1 and source file SHA-256 are distinct. Neither verifies publisher identity or grants rights.

At this source snapshot the index preserves 1,043 governed review identities (48 first-party, 995 third-party; 337 verified, 702 rejected, 3 retired, 1 verified with portability caveats), including 122 evidence-linked mappings and 921 unmapped records; 61,326 G1–G3 path observations in 14 shards; 4,813 four-source paths with separate frontier manifests and parts; all 170 discovery artifact pointers and 2,322 evidence artifact pointers; 48 original first-party entrypoints and seven separate maintenance entrypoints; four taxonomy inputs (recognized, prior proposals, new proposals, outcome register).

**67,182 indexed rows are NOT 67,182 unique, safe, rights-cleared or usable skills.** Those source populations overlap. Do not equate an observation path, a static review or a lexical hit with a complete method.

The existing source verifier reads the original 2,825 tracked file blobs and 12 Gitlinks from the pinned source checkout before indexing; the new loader also rechecks source bytes at use. Raw records are preserved in the original source files, with stable source file and array-pointer identities and retrievable parsed objects. The adapter never writes to skillz.

## CLI

Prerequisites: Python 3, Git, the published handoff checkout at its exact publication commit and the *complete* original source checkout at its exact source commit. These commands run offline after checkouts are provisioned.

~~~sh
python3 -m scripts.catalog_index \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  summary

python3 -m scripts.catalog_index \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  search "governance" --family governed --limit 20

python3 -m scripts.catalog_index \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  record "governed:exact-record-id"

python3 -m scripts.catalog_index \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  artifact registry/capability-outcome-register.json
~~~

Search is case-folded, lexical lead retrieval over all original record fields. It reports full match count, sample limit, truncation, and the source pointers for later review. It is deliberately **not** a capability-aware method ranking. Record lookup exposes original nested metadata. Artifact lookup returns the exact source pointer, SHA-256 and byte count without turning the referenced file into an instruction or a permission.

Refusals occur before a partial index could be returned. All results retain false rights, Prism, behavior and composition claims. Missing or unreviewed material is not called rejected. Unmapped material is not called absent.

## Verification and remaining work

- Synthetic positive and adversarial refusal tests: tests/test_catalog_index.py.
- Real pinned source/index reconciliation job: .github/workflows/corpus-index.yml; CI preserves only a non-content summary.
- Existing metadata and source-tree tests remain independent.
- Actual native Qortara checks, owner review and production approval remain separate and are **not** established by this change.

C1 does not build a persistent database cache, reconcile cross-snapshot exact duplicates, refresh upstream pins, verify independent rights, materialize third-party complete package trees, rank essential outcomes, route candidates to Prism, integrate browser selection, or test a finished skill in agent hosts. C2 must first build the capability/essential-workflow graph with explicit unknown coverage; C3 must then resolve complete relevant package bytes, nested assets, permissions and host conditions. Only C4/C5 may select genuinely eligible inputs and route them to Prism. See Skill Mason issues #30 and #17.
