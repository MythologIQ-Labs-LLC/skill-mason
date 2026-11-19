# Operator-signed source binding before Prism's signed facts

**Development candidate only.** This is an explicit handoff boundary between a C4 source-selection receipt and the real P0 Prism signed-assertion/composer interfaces in separate PR #28. It does not certify rights, approve a source, assert the four Prism facts, run a Prism guest, or produce a generated skill.

Implementation: [source_acceptance_gate.mjs](../../scripts/source_acceptance_gate.mjs). Tests: [source_acceptance_gate.test.mjs](../../tests/source_acceptance_gate.test.mjs). Real pinned external-source refusal: [external-package-probe.yml](../../.github/workflows/external-package-probe.yml).

## Source-to-subject signature contract

The C4/C5 preflight already checks a specific evidence-linked governed record, pinned original source checkout, full Git package byte evidence, its source-asset/license inventory, recognized capability route, and requested target host. Its canonical **binding SHA-256** changes if its source records, asset-review ledger, host, route or original pin changes. Even when every package byte verifies, that preflight truthfully contains four **false** unsigned facts and a typed pre-admission refusal.

The owner/operator must **separately accept a specific source and review state** before a production-eligible assertion can be considered. An externally configured, pinned Ed25519 key and revocation policy (not a recipe, remote API request, source directory or untrusted user-supplied key) signs a narrowly scoped acceptance envelope.

The signed payload schema `qortara/source-method-acceptance/1` binds all of:

- The full C4 preflight `sourceBindingSha256`, source snapshot commit/tree, exact governed review ID and package-inspection receipt SHA-256 (which transits the all-file asset/license review digest).
- The target-host name and the evidence-linked capability route, matched against a separate operator-controlled trust scope.
- The actual **P0 composer's** computed `composerSubjectSha256`. This is the digest over the normalized recipe and selected method, not a caller-computed surrogate or a guessed source identifier.
- Operator issuer/key/policy revision, issued validity bounds and a revocable exact signed-envelope digest.

Signature verification is Ed25519 over the canonical payload with the domain separator `QORTARA-SOURCE-METHOD-ACCEPTANCE-V1` and an LF. The trust key fingerprint, signature shape, policy revision, expiration, currently applicable revocations and exact trust scope are independently checked. No fallback signer or automatic approval exists.

## Two gates, not one

A valid operator signature authenticates **who accepted that exact source-to-composer selection**. It does **not** prove an asserted license is factually valid or that a method works. The second, independent PR #28 assertion verifier still requires its own trusted issuer, evidence bytes, evidence/rights/authority/coverage facts, revocation checks, and exact P0 assurance subject. The **real Prism guest**, not this JavaScript module, then makes the eligible/refused decision on those four verified facts. Host behavioral testing is another independent acceptance.

`createSourceBoundAssertionGuard` wraps the production coordinator's **separately configured signed four-fact adapter**. It refuses until a matching, fresh operator acceptance verifies, and **only then** delegates to that adapter for the actual P0 subject. Source acceptance never provides a default `rights: true`, modifies the signed facts, or bypasses the guest.

The guard now returns **both** the independently verified `sourceBindingSha256` and the operator's signed `sourceAcceptanceProofSha256` to the trusted coordinator. These must match the operator-pinned method map in the separate strict composer [PR #38](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/38) before its guest runs. The two PRs remain separately reviewed. **PR #28's existing branch does not yet persist these values into its candidate artifact/receipt. PR #38 proposes that strictly opt-in persisted receipt change.** That release/replay integration remains an explicit separate dependency and production HOLD; do not claim fully replayable production provenance from this module alone.

## Real source and development test

The source verifier's real two-file Anthropic `frontend-design` review produces `source_package_bytes_verified=true`, but its four signed facts remain false. The credential-free GitHub CI invocation

```sh
node scripts/source_acceptance_gate.mjs --preflight "$PWD/external-prism-denial-preflight.json"
```

**must exit 2** with `SOURCE_ACCEPTANCE_MISSING`. The CLI deliberately accepts **no** signing key, acceptance envelope or rights override flags. It cannot manufacture an operator's signature from a downloaded skill.

The 24 Node tests use a **disposable, generated Ed25519 test-only key** and constructed source-preflight fixtures to verify correct signature handling plus hostile cases: fake positive facts, altered source bytes or rights-ledger hashes, changed host/route, alternate composer subject, forged policy/issuer/key, bad signing key, stale/revoked acceptance, and mutation after guard bootstrap. The positive fixture is **only** proof that cryptographic verification works. It is neither legal clearance nor production source approval.

## Exact-pinned P0 backend interoperability in isolated CI

The [cross-branch integration test](../../tests/integration/source_acceptance_p0_adapters.mjs) uses a **real full-byte-verified external corpus selection receipt** generated earlier in the same CI job. It checks out the existing P0 signed-fact implementation from [PR #28](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/28) at **exact commit `5cbb978e5041eab18d884d0cdd6e01ed61e5cc3b`** into an isolated secondary workspace, without persisted credentials or submodules. Its Node tests execute inside a separate network namespace.

The interop test creates **two independent ephemeral fixture signing keys**, one for source acceptance and another for the actual P0 `createSignedAssertionAdapter` module. It verifies the real Python-generated C4 selection hash under JavaScript canonicalization, obtains a signed operator-selection **fixture** for a deliberately fixture-only P0 subject, and checks that the separately signed four-fact adapter returns **four false facts**. Removing the acceptance or changing the package/license evidence SHA stops the process **before** the four-fact verifier is invoked. The metadata-only receipt keeps *separate* source-acceptance and four-fact proof digests. Neither private test key, source text nor license bytes are exported.

This proves the two adapters' cryptographic and ordering interoperability. It **does not** sign a real composable method, invoke the P0 guest, test a target agent host, or prove real legal authorization. The fixture P0 subject must never be reported as a generated skill or production acceptance. The remaining composer source-acceptance proof persistence boundary is still open.

## Remaining production gates

1. Owner accepts authentic publisher custody, complete source/asset rights, dependency closure and exact method-level outcome/host behavior.
2. Register a real operator signing key, independently authenticated trust root, policy revision and revocation authority outside the request/source repository. Configure the trusted source approval resolver without accepting caller-provided keys.
3. Integrate this source binding guard with PR #28's real signed four-fact adapter **and record both proof digests** in sealed composition receipts. Verify a changed or revoked source-selection approval refuses before any guest call.
4. Execute actual pinned P0 Prism guest on correctly evidenced method, then test at least two real host/task outcomes. Retain the P0 assurance limit and forbid release without further evidence.
5. Run native Qortara qualification, adversarial independent review and explicit owner acceptance on the full PR/dependency chain.

Until these gates are met, `compositionEligible=false` and `productionEligible=false` stay authoritative.
