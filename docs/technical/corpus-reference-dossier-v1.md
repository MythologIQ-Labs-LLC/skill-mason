# Corpus original-source reference dossiers (C3/C4 workbench)

**Status:** Development source-inspection utility; reference material for qualitative method review, not a method license, a rights/host qualification, a generated skill or an alternate Prism eligibility engine.

## Delivered behavior

`scripts/corpus_reference_dossier.py` starts with the already verified pinned Skillz source tree, the complete 1,043 reviewed identities, the recognized 247-route graph, and C3's original first-party package verifier. For a recognized route it returns **every evidence-linked governed candidate** without dropping rejected or retired reviews. First-party candidates receive the complete SHA-256 file list, original Git blob/tree identity, source entrypoint URL and the scanner's unresolved-reference evidence. Third-party candidates remain listed but their uninspected text is not fetched or silently recycled.

For a selected first-party reviewed method, a reviewer may request an exact range of up to 12 original source lines. The response binds those lines to the selected governed identity, pinned source commit and tree, file SHA-256 and Git blob, source line numbers, excerpt digest, and a stable original source URL. The source bytes and complete package are verified again by the existing resolver. Missing/mismatched source, unlinked method, path outside the verified package, invalid UTF-8, overly broad range and unauthorized rights promotion all refuse. Nothing in the method's instructions is executed.

This solves **inspectability and citation custody**. It does **not** solve semantic correctness: a digest authenticates the quoted bytes, not whether those lines prove the claimed user outcome. The reviewer must still judge method completeness against the real task, distinguish narrowly supported workflows from route taxonomy links, and obtain independent rights and host authorization. All dossier outputs preserve `composition_eligible:false`, `rights_qualified:false`, `host_validated:false`, and `prism_invoked:false`.

## Exhaustive original first-party qualification queue

The `--all-first-party` mode inspects **all 48 original first-party governed reviews** from the exact pinned snapshot, including sources with no evidence-linked recognized route. It does not count any discovery path, name hint or external review as a first-party method. Each record retains its source URL and digest if verified, static review status, recognized route links (or explicit unmapped status), file count, incomplete reference lead count and its next *qualification* action.

The four distinct review actions are:

- `REVIEW_OUTCOME_FIT_AND_SOURCE_RIGHTS`: original package bytes found and route linked, but no supported task outcome or rights approved.
- `REVIEW_ORIGINAL_METHOD_SCOPE_AND_CREATE_EVIDENCE_CROSSWALK`: verified original method with no source-supported route mapping; inspect its actual workflow before creating one.
- `REPAIR_SOURCE_INTEGRITY_FIRST`: a first-party source cannot be byte-verified or has a malformed/untrusted receipt.
- `STATIC_REVIEW_BLOCKED`: an original review was rejected or retired and cannot quietly become an approved source.

The queue is ordered by exact governed ID and includes an explicit denominator, status counts and no-omission check. It is **not** an automated quality grade or a ranked list of best methods. The review priority indicates what work is missing, not that the package is fit to execute.

```sh
python3 -m scripts.corpus_reference_dossier \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  --all-first-party > source-review-queue.json
```

The pinned corpus CI runs this mode alongside the bounded line-citation example and proves that all 48 original review identities survive without any unearned source, rights, host or composition approval.

## Actual pinned method under review

The original [MCP Vetting method](https://github.com/Knapp-Kevin/skillz/blob/31a8c518dd97b7828adcc728202fa41388a306d7/skills/mcp-vetting/SKILL.md) has a linked `security/supply-chain` route and a genuine source passage expressly limiting the task to **static preconnection MCP-server review**. Its body describes enumerating tools, tracing credentials, injection/dependency risks, evidence quality and a qualified recommendation. Its own instructions forbid installing, connecting or running the server during vetting.

**Qualitative scoped finding:** the method provides credible *reference material* for designing a read-only, preconnection MCP-server review workflow. It does not by itself satisfy the broader proposed outcome of inventorying all software release dependencies and attestation provenance for a release decision. A route link is not proof of that wider functionality. This source-specific, limited finding is an author's reading of the original content, **not an independent host trial, semantic attestation, source-rights approval or generated package**. In particular the source's `metadata.author` is a recorded claim, not authenticated copyright or redistribution authority.

## Reproduce against the exact Skillz source

With the already separately pinned `skillz-export` and `skillz-source` checkouts:

```sh
python3 -m scripts.corpus_reference_dossier \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  --route security/supply-chain

python3 -m scripts.corpus_reference_dossier \
  --handoff skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout skillz-source \
  --route security/supply-chain \
  --method governed:local-skills/mcp-vetting \
  --file SKILL.md --lines 17:21
```

The second command gives a short **verbatim source citation**; inspect the returned `original_source_citation` and `candidates` before forming a bounded method contract. The GitHub Actions corpus-index job tests both forms on exact upstream pins and asserts that no source, rights, method coverage or host promotion occurred.

## Next development capability

Connect reviewer's task-specific scope findings and acceptance scenarios to these exact source citations, then independently evaluate source rights/NOTICE and real consuming-host behavior, and finally have the actual trusted operator issue the existing signed acceptance and four-fact evidence. The existing signed source and Prism guest infrastructure already handles cryptographic verification, but it **cannot manufacture the underlying legal or empirical facts**. Do not bypass those checks to inflate the number of admitted methods.
