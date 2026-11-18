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

The guard currently returns an additional `sourceAcceptanceProofSha256` to the trusted coordinator. **The current PR #28 composer does not yet persist this new value into its candidate artifact/receipt.** That release/replay integration remains an explicit separate dependency and production HOLD; do not claim fully replayable production provenance from this module alone.

## Real source and development test

The source verifier's real two-file Anthropic `frontend-design` review produces `source_package_bytes_verified=true`, but its four signed facts remain false. The credential-free GitHub CI invocation

```sh
node scripts/source_acceptance_gate.mjs --preflight "$PWD/external-prism-denial-preflight.json"
```

**must exit 2** with `SOURCE_ACCEPTANCE_MISSING`. The CLI deliberately accepts **no** signing key, acceptance envelope or rights override flags. It cannot manufacture an operator's signature from a downloaded skill.

The 24 Node tests use a **disposable, generated Ed25519 test-only key** and constructed source-preflight fixtures to verify correct signature handling plus hostile cases: fake positive facts, altered source bytes or rights-ledger hashes, changed host/route, alternate composer subject, forged policy/issuer/key, bad signing key, stale/revoked acceptance, and mutation after guard bootstrap. The positive fixture is **only** proof that cryptographic verification works. It is neither legal clearance nor production source approval.

## Remaining production gates

1. Owner accepts authentic publisher custody, complete source/asset rights, dependency closure and exact method-level outcome/host behavior.
2. Register a real operator signing key, independently authenticated trust root, policy revision and revocation authority outside the request/source repository. Configure the trusted source approval resolver without accepting caller-provided keys.
3. Integrate this source binding guard with PR #28's real signed four-fact adapter **and record both proof digests** in sealed composition receipts. Verify a changed or revoked source-selection approval refuses before any guest call.
4. Execute actual pinned P0 Prism guest on correctly evidenced method, then test at least two real host/task outcomes. Retain the P0 assurance limit and forbid release without further evidence.
5. Run native Qortara qualification, adversarial independent review and explicit owner acceptance on the full PR/dependency chain.

Until these gates are met, `compositionEligible=false` and `productionEligible=false` stay authoritative.
