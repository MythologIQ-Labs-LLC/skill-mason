# One independently signed source → sealed P0 development candidate

The new [operator source composition adapter](../../src/backend/operator-source-composition.mjs) closes the execution seam between Skill Mason's previously disconnected **source-acceptance signature gate** and **strict Prism-backed composer**. It is a real callable backend integration, not a new public `create` switch.

### Execution (trusted coordinator only)

A separately authenticated backend must supply a verified source-method registry and explicit recipe, a **full C4/C5 preflight** for exactly one governed source, its independently accepted Ed25519 source trust root with current revocations, four **independently custodied** hashes (the C4 source binding, original method-text SHA-256, complete original source-package SHA-256, original source snapshot SHA-256), a source-acceptance envelope resolver, an independent signed-four-fact adapter and an exact pinned local P0 holo/runtime.

`composeOperatorBoundP0({ sourceRegistry, recipe, preflight, operatorTrust, expectedSourceBindingSha256, expectedMethodSha256, expectedPackageSha256, expectedSnapshotSha256, readOperatorAcceptance, assertSignedMethod, holoPath, holoSha256, outputRoot })` runs these stages, in order:

1. Re-hash complete source method/package bytes and bind requested outcome, target host and immutable snapshot via the existing recipe adapter. Refuse multiple methods until **each** can be independently cross-checked.
2. Validate the source preflight and ensure its governed record, route, target host and snapshot bind to the selected method. Match all four separately configured exact SHA-256 pins **before** any signer or guest call.
3. Verify a current, nonrevoked operator Ed25519 selection acceptance for the composer's **actual** calculated method/recipe subject. Only afterward consult the **separate** signed-four-fact/evidence adapter. Never mint a source approval or substitute rights from a package's own metadata.
4. Send the verified four facts to the exact pinned P0 Prism guest. A signed `rights:false`, stale evidence or denied Prism response **cannot** create a candidate.
5. Persist **both distinct proof digests** into the strict receipt, content-address the final `SKILL.md`, seal all files on disk exclusively, re-read and compare against the original generated package. Return the original package manifest SHA-256 for custody outside the artifact. Never overwrite a previous candidate.

A successful invocation yields `STRICT_SIGNED_SOURCE_P0_DEVELOPMENT_CANDIDATE` with `productionEligible:false`, `hostValidated:false` and `guestAssurance:'P0 unverified'`. It proves only that the configured source signer and four-fact delegate gave a replayable **P0 development decision**. It does not prove trust-root custody, actual legal reuse rights, semantic correctness, host activation or independent model quality. The four-fact delegate's cryptographic verification is the **delegate's** responsibility; this adapter does not independently replay its signature.

**Governance constraint:** This function is not exported from the ordinary `qortara-skills create` command, GitHub Pages or a remote API. A browser request, downloaded skill, synthetic CI key or repository copy is never allowed to configure the operator trust root, issuer approval, independent expected digests or guest. Real operator keys/signers and accepted legal source evidence are **not present** in the repository; supplying such external operator custody and performing real host trials remain prerequisites for production.

### Evidence and test boundaries

The [source-bound composition tests](../../tests/operator_source_composition.test.mjs) load the **original Git-object- and SHA256-pinned** `release-readiness-review-v2` method through `loadFirstPartyPilots`, use two separate randomly generated **test-only Ed25519 signing keys**, and exercise the real source signature verifier, real four-fact verifier, real composer/receipt, real complete-disk seal, and the **Prism adapter fed by an explicitly mocked runtime**. False source or fact rights, changed method/host/route/source/snapshot, missing approval, stale revocations and a destination overwrite fail closed. No external API key or model calls are involved.

The existing [full P0 gate](../../.github/workflows/prism-native-gate.yml) continues to be required if its own native input closure changes. This integration does not modify that closure and runs in the focused [source receipt CI](../../.github/workflows/backend-source-receipt.yml) instead. A real P0 guest was exercised in historical strict-receipt CI; **these new tests use only a mock Prism runtime**, so do not count this PR's mock as another real guest execution.

### Next acceptance

Connect independently operator-reviewed real rights and provenance evidence to an accepted C4 preflight and trust store; then invoke the same callable interface under a real pinned Prism holo, independently replay its sealed receipt with the retained source and fact proofs, run behavioral controls on an actual consuming host, and obtain explicit owner release acceptance. Without these, all source/host/admission gates remain HOLD.
