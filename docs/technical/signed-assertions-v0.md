# Signed method-assertion verifier v0

**Status:** Implemented offline **development-only** cryptographic verification primitive, not an approved trust root, not a legal rights decision, and not a qualified Prism admission.

**Implementation:** [`src/backend/signed-assertions.mjs`](../../src/backend/signed-assertions.mjs). **Tests:** [`tests/backend_signed_assertions.test.mjs`](../../tests/backend_signed_assertions.test.mjs). **Owner:** Qortara Skills backend, subordinate to the [Skill Mason pipeline](../architecture/skill-mason-pipeline-v0.md) and open generator [issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17).

## Intended integration boundary

The candidate composer has two separately owned responsibilities: `assertMethod` authenticates the facts about exact pinned sources; a real `runPrism` adapter sends those four facts to the pinned SM-01 guest for **eligibility/refusal**. This verifier implements only the first boundary. It never calls Prism itself, writes skill packages, installs anything, or decides whether a signed claim is legally correct.

`createSignedAssertionAdapter({trust,loadEnvelope,readEvidence,nowEpoch})` returns the composer's `assertMethod({recipe,method,subjectSha256})` callback. Production code **must** pin `trust`, the claim loader and evidence resolver from a separate operator-controlled configuration and an immutable read-only evidence store. Neither the user request, the catalog export, a source skill, a browser request nor a signed envelope may select its own trusted public key, adjust the clock or disable revocations.

The trust configuration (`qortara/method-assertion-trust/1`) pins a single permitted Ed25519 `issuer`, `keyId`, SPKI public-key SHA-256 and exact `policyRevision`. It also contains an operator-controlled, time-bounded revocation inventory of signed proof digests. The pinned verification key **is not accepted merely because its bytes appear in a skill**. This configuration is deliberately supplied at process startup, not by an external request. A multi-issuer, signed revocation distribution protocol is **not implemented**.

A signed envelope (`qortara/signed-method-assertion/1`) contains a `qortara/method-assertion/1` payload and a canonical Base64URL Ed25519 signature. Its signature covers the domain-separated bytes `QORTARA-METHOD-ASSERTION-V1\n` + canonical sorted JSON of the payload. The payload binds:

- the **exact** SHA-256 `subjectSha256` computed by the composer from normalized plan + exact source/method pin and required outcomes;
- issuer, key identity and policy revision;
- bounded `validFrom`/`expiresAt` epoch seconds (at most 30 days);
- explicit boolean evidence, rights, authority and coverage statements;
- exact SHA-256 digests for the evidence backing each **true** statement. False statements require `null` evidence digests.

The verifier rejects any signature mismatch, subject/key/policy drift, unknown fields, missing or altered evidence bytes, expired or future assertion, non-current revocation policy, and a revoked signed proof digest. For positive facts it uses the trusted `readEvidence({sha256,field})` resolver and independently hashes every bounded byte payload. It returns authenticated booleans and the signed proof digest, enabling the composer to send `01000101` for a **signed rights denial** and require the actual Prism guest to refuse. **Unasserted claims fail closed before Prism.**

## What is NOT proved

A valid Ed25519 signature proves that an allowed key signed the payload; a matching evidence digest proves only byte identity. Neither establishes ownership of the copyright, truth of the rights judgment, provenance beyond the asserted source record, freshness of the external source, the truth of declared capability coverage, or a user's authority to run the method. A malicious or mistaken trusted issuer can sign bad facts. Actual permission evidence, signature key custody/rotation, authenticated revocation issuance, source publisher root, ownership review and real target-host acceptance remain separately governed and currently **NOT_ESTABLISHED**.

The composer's output remains `DEVELOPMENT_CANDIDATE`, `productionEligible:false`, `hostValidated:false`, and `modelCallsMeasured:false`. The existing catalog export's `not-established-by-export` rights state must not be upgraded by this module. This is not a P2 proof, not a production rollout and not a change to the Prism guest. All tests use **synthetic ephemeral signer keys and fixture evidence**. There are no embedded production private keys or newly trusted external packages.

## Repeatable tests

```sh
node --test tests/backend_signed_assertions.test.mjs
node --test tests/backend_compose.test.mjs
```

The suite covers valid signed assertions through the candidate composer, real Prism *adapter interface* (mocked in this suite), signed denials routed to Prism, tampering, wrong key, wrong subject, wrong policy, expired/future statements, expired or revoked inventories, missing/tampered evidence and schema/encoding problems. CI green proves the **code and fixture contract only**; it does not make the signing key or legal evidence real.

## Next governed implementation steps

1. Establish and document the exact operator authority allowed to judge **rights** versus security **evidence**, caller **authority** and essential-outcome **coverage**, with separate proof chains and revocation responsibilities. Prefer explicitly different issuers/roles once the semantics are accepted; this v0 single-key primitive must not be promoted as a blanket four-fact authority.
2. Provide an independently controlled read-only evidence store with authenticated source-method bytes/rights clearance at exact catalog snapshot pins. Never accept an arbitrary user-supplied claim repository as a source of authority.
3. Integrate approved trust roots with the final Prism application/guest after the native gate, SDK trust-root and repository governance conditions are accepted. Run real deny/allow vectors and two distinct target-host behaviors.
4. Measure zero inference during the actual integrated skill build and keep packaging/behavior receipts separate.
