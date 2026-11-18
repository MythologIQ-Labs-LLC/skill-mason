# Selected complete-package inspection v1 (C3 partial, #30)

**Candidate only.** Read-only byte-level inspection of one exact, source-verified first-party skill package. This is NOT reuse permission, recursive dependency closure, or agent-host qualification. Stacked on opportunity index #31 and source evolution #32.

## Verification boundary

scripts/package_resolver.py accepts only a governed:<record-id> from the exact verified CorpusIndex. It refuses third-party candidates because the handoff does not contain independently authenticated complete third-party package bytes. A package tree hash or discovered SKILL.md path is not materialization or rights.

For one first-party record:

1. Check its exact original source commit, entrypoint Git blob, review-to-entrypoint match, and canonical package-file-list SHA-256.
2. Require a unique source root by comparing ALL package-relative files and per-file SHA-256 to the verified Git source inventory; refuse any missing, added, ambiguous, duplicated, absolute or unsafe declaration.
3. Re-read every file, nested asset included, compare SHA-256 and Git blob SHA-1. Never follow symlinks, execute source text or execute shell scripts.
4. Check recorded package Git tree SHA-1 against the original source tree if the source review declared it. Refuse stale tree claims.
5. Return file paths, byte counts, and content fingerprints only, plus a conservative scan of inline Markdown reference *leads*. This scanner is NOT a recursive parser or proof of reference/dependency closure. Missing/outside/remote link leads are explicit gaps.
6. Preserve claimed license and authority only as unqualified metadata. No redistribution, modification, target-host, network/secrets or use rights can be inferred from a verified file digest.

The receipt explicitly states source publisher authentication, source freshness, rights clearance, host permission, method contract and composition eligibility as UNESTABLISHED.

## Offline CLI

Requires a separate published-handoff checkout and original pinned skillz source tree.

~~~sh
python3 -m scripts.package_resolver \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  inspect 'governed:local-skills/<exact-record-id>'

python3 -m scripts.package_resolver \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original first-party-scan
~~~

The scan processes all 48 first-party governed IDs, retaining an explicit refusal record for each unsupported/broken candidate. It never omits failures or claims that all 48 are authorized for reuse.

## Remaining full C3

On-demand complete third-party packages require accepted publisher and repository identity, exact commit/tree/entry verification, full nested assets, license and notices inherited at per-file scope, safe handling of gitlinks/symlinks, references and transitive dependencies, secrets/network/execution authority, modification/redistribution/unchanged-use rights for the requested host, freshness and independent adversarial review.

Future pinned snapshot accession needs an independently reviewed version/delta adapter rather than auto-upgrading from skillz/main. The skillz #599 and #588 program remains the upstream passive authority for new source discovery and evidence-backed capabilities.

Tests are in tests/test_package_resolver.py. Pinned CI exercises the real 48-record source scan without running their content. Native Qortara checks, owner approval, C4 comparison, Prism composition and actual agent-host behavior are separate holds.
