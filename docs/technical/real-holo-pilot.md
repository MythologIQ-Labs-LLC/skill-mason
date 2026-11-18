# P0 real-holo candidate integration acceptance

**Scope:** Development-only actual Prism guest execution at the full candidate pipeline boundary. This is **not** a production SDK trust-root acceptance, not P2 proof, not an assertion of source rights, and not evidence that a generated skill succeeds in a consuming host.

**Integration test:** [`tests/real_holo_candidate_acceptance.mjs`](../../tests/real_holo_candidate_acceptance.mjs). **Workflow:** [`real-holo-candidate.yml`](../../.github/workflows/real-holo-candidate.yml). **Source model:** [candidate composer](../../src/backend/compose.mjs), [public recipe adapter](../../src/backend/recipe-adapter.mjs), [Ed25519 claims](../../src/backend/signed-assertions.mjs), and the existing [Prism CLI consumer](../../bin/qortara-skills.mjs).

## Exact independent input pins

- Prior full [native gate run #44235570627](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44235570627) on subject `1719fd11c654528d3492ae9b6c71c9d2924fefae`, artifact ID `14399257681`, name `prism-native-nested-1719fd11c654528d3492ae9b6c71c9d2924fefae`.
- Compiled `eligibility.holo`: **17,346 bytes**; SHA-256 `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`.
- Native receipt manifest SHA-256 / attestation ID `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518`.
- Independent consumer `prism-code@0.9.5`, npm tarball integrity `sha512-PcXiUzhYJwY4ZM9wKpzazq5m/KVCWooj8dFF+7l57KcUQpNdiVDbETyYFo4A9O6OoY9tVghg5YawkIlgYYUjNA==`.

These were rechecked against the downloaded **actual** native artifact, not inferred from the PR's prose. The workflow retrieves that exact run and artifact, checks the complete holo and manifest hashes, and hands off only the holo to a separate runner. It pins and checks the runtime tarball before installing it with `--ignore-scripts`.

## Isolation and positive/negative vectors

The artifact retrieval job alone has `actions:read`. The guest runner requests **no repository token permissions**, uses a checkout with no persisted Git credentials, and invokes the real Prism guest inside a separate network namespace after its runtime dependencies are installed. No external source skill code, package setup scripts, browser uploads, or model inference is performed by the test.

The test then follows:

1. One public `recipe.v0` selects an exact, hash-pinned **original test-owned fixture package** containing the actual method text. The fixture source snapshot has no rights-authority claim.
2. A fresh ephemeral Ed25519 key signs four artificial **test facts**: evidence, rights, authority and coverage. Actual byte digests match the test-owned evidence bytes. No real source license is asserted.
3. The composer sends `01010101` to the **real pinned holo through the existing `qortara-skills evaluate` consumer**, expects its actual `eligible` response and produces an inspectable, unqualified candidate.
4. The package is written into a new sealed directory, independently re-read with `readPackage`, and rebuilt for byte-for-byte identity.
5. A separately signed rights denial sends `01000101` to the **same real holo**. The composer must refuse the actual Prism denial and produce no second package.
6. The separate report explicitly records `P0 unverified`, `productionEligible:false`, `hostValidated:false` and `modelCallsMeasured:false`.

**No fallback:** the test fails if the holo is absent or changed, the pinned runtime is unavailable/mismatched, the actual guest refuses positive input, a signed denial is admitted, or the final read-back does not reproduce the candidate.

## Limits and product decisions

- The compiled application was built with a development-candidate SDK image under an unaccepted personal publisher namespace. Its trust root remains unresolved. This test does **not** supersede native PR #15, the owner's merge HOLD, or actual continuous ratchet enforcement.
- The ephemeral signer authenticates **only synthetic facts from this test**. It does not own third-party content rights or attest a real operator/host authority. It is intentionally destroyed with the job.
- The real holo reports **P0 unverified**, not P2. This test proves a real decision was executed, not the truth of its inputs.
- A source method excerpt and bundled source package can match hash pins and still be unsafe or legally non-redistributable. The owner must establish source legal rights, reviewer custody, revocation, and independently measured target-host behavior.
- This integration test does not install the generated skill into a host, grant a tool, or measure inference tokens during a consumer's subsequent task. Complete production acceptance remains gated under [generator issue #17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17).

The workflow is **intentionally scoped** as an independent, credential-free P0 development test. A passing run does not authorize an installer, publication, SDK re-pin, production tier or removal of a governance hold.
