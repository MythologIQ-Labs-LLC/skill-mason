# Source-bound Prism eligibility preflight

**Status: Development-only and refusal-first.** This is a source-binding and negative-test-vector contract, not Prism execution, signed proof, method admission, artifact composition, or host acceptance.

Source: [scripts/prism_input_preflight.py](../../scripts/prism_input_preflight.py). Tests: [tests/test_prism_input_preflight.py](../../tests/test_prism_input_preflight.py).

## Purpose

The C4 comparator separates evidence-linked governed reviews from name-only leads and, when selected source checkouts exist, checks complete package bytes. The P0 composer in [PR #28](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/28) accepts four **independently signed, subject-bound and evidence-digest-checked** facts in this wire order: evidence, rights, authority, coverage.

Neither a static review marked verified, a matching Git package tree, nor a user-supplied host label establishes any of these four facts. Source byte integrity is not independent evidence of correctness, source/asset reuse rights, actual host permissions, or essential-outcome qualification.

The preflight binds one exact governed reviewed ID and evidence-linked capability route to the pinned source commit and tree, canonical full governed-record SHA-256, inspected-package receipt SHA-256, and the requested host label. For an inspected external source, the package receipt now contains an exact hash of **every verified source file's unresolved rights and reference-review inventory**, so its content is covered transitively by the preflight's own binding SHA-256. Altering the asset/notice review ledger changes that binding. No source permission is inferred. Name-only leads, invented IDs, mismatched external source selections, unrecognized routes and malformed pinned source identities refuse. External source byte inspection is invoked directly; callers cannot provide JSON receipts as proof.

## Output and refusal contract

The report contains a SHA-256 fingerprint of the exact binding and a separate Boolean describing whether full source package bytes were inspected. The only four-fact output is the **unsigned, negative P0 test vector 00000000**. The evidence, rights, authority and coverage facts are all false; the expected real guest refusal labels are EVIDENCE_UNQUALIFIED, RIGHTS_UNRESOLVED, AUTHORITY_EXCEEDED and OUTCOME_UNCOVERED. A rejected or retired static review adds another explicit blocker.

The report additionally returns a versioned **REFUSED_PRE_ADMISSION** typed generation refusal, listing every missing qualification fact and a separate SOURCE_PACKAGE_BYTES_UNVERIFIED blocker where appropriate. That is a pre-admission refusal, **not** a verdict produced by the Prism guest or an observed agent-host outcome. The program **does not invoke Prism**, load a holo, issue a signed assertion, create or install skill packages, grant rights or host authority, or assert outcome coverage. There is no positive fact override. The vector is diagnostic only. The production signer and independent evidence resolver in PR #28 must separately verify source-specific rights, host scope, coverage, issuer custody and revocations before any positive Prism request; the real Prism guest still makes the final decision.

## Exact-pinned command

```sh
python3 -m scripts.prism_input_preflight \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/original-source \
  --route software-engineering/frontend --host ChatGPT \
  --governed-record governed:anthropic-skills/frontend-design
```

To inspect actual third-party package bytes, additionally supply all three options: --external-record governed:anthropic-skills/frontend-design, --external-checkout /path/to/pinned-external-source, and --external-repository-tree d482eba557f7b2035c8a83589809628b96f6f40e. The selected and inspected record IDs must match. Neither invocation initiates network calls or executes third-party material.

## Tests and next gates

The full pinned source CI checks the no-external-checkout case and verifies no unsigned fact becomes positive. Separate external-package CI checks the real two-file Anthropic package and then verifies package byte success still produces four false facts. Adversarial tests cover source/record binding drift, fake rights, review rejection and retirement, invented IDs, host labels, and source-byte refusal propagation.

Completing this preflight does not satisfy native Qortara governance, independent source-rights verification, accepted publisher trust, actual Prism execution for this selected source, produced packages, or observed agent-host task success. Issues #17 and #30 remain open.
