# Composer source-approval proof persistence (P0 development extension)

**Proposed feature on a branch based on PR #28**, with no changes to either the existing PR #28 branch or the independent source-ingestion PR #37. The implementation lives in [compose.mjs](../../src/backend/compose.mjs) and [source-proof receipt tests](../../tests/backend_source_approval_receipt.test.mjs).

## Exact evidence and authority boundary

The existing P0 composer obtains an independently signed four-fact result from an injected trusted `assertMethod` adapter, then calls the actual pinned Prism guest. Its original assertion receipt records the `subjectSha256` and the signed four-fact `proofDigest`. It did **not** preserve the source-selection operator approval and source/asset inventory binding introduced in the separate corpus lane.

The new **strict source-approval mode** is selected **only** by the trusted coordinator constructor:

```js
createComposer({
  assertMethod: sourceBoundSignedAssertionGuard,
  runPrism: exactPinnedPrismGuest,
  holoSha256: exactPin,
  sourceApprovalBindings: {
    'operator-reviewed-method-id': '64-lowercase-hex-source-binding-sha256'
  }
})
```

This configuration must originate from authenticated operator state. It is **not** a user recipe field, source-skill declaration, catalog metadata label or caller-supplied optional `eligible` flag.

When the trusted coordinator opts in:

1. Every selected method must have its own operator-pinned exact source binding, a pinned source snapshot and package pin. Extra/missing or malformed binding inputs refuse before any Prism call.
2. The independent `assertMethod` adapter must provide `sourceBindingSha256`, `sourceAcceptanceProofSha256`, exact `subjectSha256`, and its existing separate four-fact `proofDigest`. Missing or mismatched source proof refuses **before** invoking the guest.
3. The sealed `RECEIPT.json` retains both distinct proof digests in the correct method assertion row, alongside the subject digest and source binding. `skill-mason.json` stores the canonical receipt hash. The existing exclusive disk writer stores these files and writes its completion seal last.
4. `verifyPackage` and `readPackage` reject missing, partial, malformed or cross-method source approval records and verify the original receipt/disk hashes. They always return `sourceAcceptanceSignatureVerified:false` and `signedFourFactAssertionReverified:false`. Hash matching is not independent signature replay, license verification or production clearance.
5. When the coordinator does *not* configure this strict mode, the existing fixture-only P0 path remains byte-compatible with prior candidate receipts; it **refuses** unexpected source-approval claims rather than silently dropping them. Legacy output remains `DEVELOPMENT_CANDIDATE`, never a qualified skill.

## Important limitation

The independent source-bound signer currently lives on [corpus PR #37](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/37) and the P0 composer on [PR #28](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/28). The expected source binding must be independently supplied by the operator's trusted coordinator. This PR does **not** import or ship a signing key, issue an operator approval, certify permissions, or change the four Prism facts. A source approval signature itself authenticates who signed an assertion, not whether it is legally/behaviorally true.

The initial 13 receipt tests plus 9 replay tests use synthetic positive fixture facts and mock Prism responses to exercise deterministic receipt recording, strict pin coverage, missing proofs, binding substitution, malformed records, corrupt disk-sealed receipts and legacy receipt behavior. The actual positive Prism guest and authentic source/host approval require separate qualification. Host skill behavior has not been observed.

## Independently configured post-seal proof and guest replay

The additional [source-proof replay module](../../src/backend/source-proof-replay.mjs) accepts a hash-verified strictly source-bound candidate and **operator-provided** expected method/source binding hashes, operator source signature verifier, independent signed four-fact/evidence verifier, and exact pinned Prism guest adapter. Those trust callbacks and the revocation material they use must originate from independent operator custody, **not from a recipe, source skill, signed receipt file or browser request**.

It refuses missing proof mode, incomplete trust/replay configuration, wrong method IDs, changed operator pin, an unmatched/expired/revoked source signature, an unmatched/expired/revoked four-fact signature, any false fact in a previously composed candidate, a different holo hash or a guest result that fails to reproduce the P0 `eligible` response. It verifies one source approval and one four-fact assertion **for each selected method**, then replays the guest decision through the trusted adapter. Both proof envelopes remain in the independent evidence store; the skill candidate package retains only their exact digest references.

The raw in-memory `replaySealedSourceReceipt(packageValue, config)` validates the receipt/hash structure and independently replays injected proof/guest adapters, but **does not check a physical completion seal**. For disk material, use `replaySealedSourceReceiptFromDisk(destination, config)`, which first calls the existing `readPackage` to verify the entire file set, file hashes, filesystem protections and exclusive `.qortara-complete` seal **before** invoking any signature or guest callback. A successful disk-backed replay reports `diskCompletionSealVerified:true` and a `verifiedDiskManifestSha256`; the in-memory route explicitly reports `diskCompletionSealVerified:false`. A disk seal is an integrity/completion marker, not an operator signature or installation approval. Missing/tampered seals refuse before the proof adapters or guest.

The operator-pinned strict binding map now accepts the exact **slash-containing governed review IDs** used by the real corpus, such as `anthropic-skills/frontend-design`. IDs must be bounded NFC text without controls, and prototype-reserved names are refused; method identity must still match the plan and source proof. The regression test for this ID uses **fixture positive evidence only**, not a real Anthropic rights approval or completed source composition.

A successful replay returns `P0_DEVELOPMENT_RECEIPT_REPLAYED_BY_CONFIGURED_ADAPTERS` with `productionEligible:false` and `hostValidated:false`. The function has no independent source-rights judgment, no signing keys, and cannot itself verify whether an injected callback is trusted. It must not be exposed to arbitrary caller-created adapters. It does not upgrade P0 into P2 assurance or certify task efficacy.

[Cross-branch offline fixture](../../tests/integration/strict_source_receipt_fixture.mjs) loads the independently developed source gate from [PR #37](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/37) at **exact SHA `79a70b6e0b88fa1988ff83bc6280b35930a944f0`**, uses two independent **ephemeral fixture Ed25519 keys**, and executes the actual signed four-fact adapter from the P0 development branch. It seals a development candidate, reopens it, cryptographically replays both signed fixture envelopes through the actual verifiers and replays a **mock** guest. Changing the sealed source receipt or withdrawing approval must refuse. It runs inside a network namespace and never materializes a third-party source package or qualified skill.

The baseline suite has **22 new source receipt/replay tests** (13 persistence + 9 replay), with five additional integration-hardening tests for corpus-style IDs, prototype/control rejection, valid disk-backed replay, missing completion seal, and tampered completion seal. These are **test-only** positive signatures, not real source qualifications. The PR-specific real P0 guest integration described below remains separate from real source-specific permissions, production trust roots and two observed host journeys. None of those authority or behavioral qualifications is established by synthetic signatures.

## PR #38: actual pinned P0 guest path (fixture authority only)

The network-isolated [strict receipt integration test](../../tests/integration/strict_source_receipt_fixture.mjs) now supports two explicit modes. The ordinary CI mode retains the mock guest and ephemeral fixture Ed25519 claims. The opt-in real-guest mode requires `--source-gate-root ABS --holo ABS --sha256 9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`. No arbitrary holo pin or runtime policy can be supplied by a skill recipe. Both modes produce `productionEligible:false`, `hostValidated:false` and `sourceRightsEstablished:false`.

The [receipt workflow](../../.github/workflows/backend-source-receipt.yml) adds two **PR #38-only** jobs, not an enduring dependency for unrelated PRs: a scoped Actions-read stage fetches the pre-existing native artifact (run `44235570627`, ID `14399257681`), independently checks the **17,346-byte** holo SHA-256 and original native manifest SHA-256 `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518`, and transfers only the verified holo. A separate runner with **zero GitHub token permissions** checks the tarball integrity of `prism-code@0.9.5` and runs four real P0 guest calls in a network namespace: initial composition, in-memory replay, sealed disk replay, and a separately signed **rights=false** refusal. The source selection and four-fact signers remain fresh **ephemeral test fixtures**, including the intentionally impossible positive claims for a `BLOCKED_RIGHTS_AND_HOST` synthetic source. A changed disk receipt refuses before either signature verifier or guest, and source acceptance withdrawal refuses before fact verification or guest. The test does not run any skill in ChatGPT, Claude, or Codex.

**Retention:** the prior holo artifact expires on December 18, 2026. These PR-specific jobs must not become an unbounded required check on `main` or other PRs. The resulting execution receipt is evidence for **P0 guest integration only**, not owner acceptance, genuine rights, a trusted publisher, P2 assurance or host-task quality.

## Qualification and integration path

1. Independently qualify the source-bound gate and native Qortara governance. Add `sourceBindingSha256` to the trusted guard return, passing the exact independently verified binding through to this composer. Do not import a digest from an unauthenticated recipe.
2. Wire a trusted, operator-owned coordinator to both authentic source acceptance and the existing signed four-fact evidence adapter. Record and replay the two actual signed envelopes from operator-controlled evidence storage; raw receipt hashes alone cannot verify either signature.
3. Run the real pinned guest, then test at least two actual host/task journeys. Retain P0 assurance and `productionEligible:false` until independently accepted release criteria are met.
4. Run exact-head backend CI, native Qortara, adversarial review, and explicit owner GO before merging the dependent branches.

**The production method-qualification and release gates remain HOLD.**
