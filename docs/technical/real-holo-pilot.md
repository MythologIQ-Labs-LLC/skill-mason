# P0 real-holo candidate integration acceptance

**Scope:** Development-only actual Prism guest execution at the full candidate pipeline boundary. This is **not** a production SDK trust-root acceptance, not P2 proof, not an assertion of source rights, and not evidence that a generated skill succeeds in a consuming host.

**Observed result:** [GitHub Actions run #44249035051](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44249035051) completed **SUCCESS** in both isolated jobs. The actual guest returned `eligible` for the positive fixtures and `refused: RIGHTS_UNRESOLVED` for the signed denial; all three guest calls completed. The report recorded `BYTE_IDENTICAL_WITHIN_RUN`, `INTEGRITY_VERIFIED` disk read-back, and manifest SHA-256 `bbb7b6a4b8d43d42f38496a7c72d4cc8f4eac5c91867fcbca1ddfb68ce5ef432`. This is explicit **P0** development evidence using synthetic rights, not a qualified user skill. Report artifact: `real-prism-p0-candidate-pilot` (ID `14402857673`).

**Two first-party candidates now accepted in isolated development execution:** [run #44333394001](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44333394001) completed **SUCCESS** on both jobs at subject `6a67a9da44377af1502eb7227799a517cacef86b`. The actual P0 guest executed **five** calls: the original two eligible / one rights-denied fixture vectors plus one positive request each for [CI failure triage](../../pilots/first-party/ci-failure-triage/procedure.json) and [governance drift review](../../pilots/first-party/governance-drift-review/procedure.json). Both original first-party procedures produced substantive Agent Skills-format, sealed candidate directories. Their reported candidate manifest SHA-256 values were `bc82353c81ecc8355f348773ad47d4d650c68bdd27556ec08468131875a4cc41` and `797d73377422a5e95a1dd9e0c57a524c19b3bb73f9420c8433796605870cdc74` respectively. The complete artifact including hidden `.qortara-complete` seals is `real-prism-p0-candidate-pilot`, **artifact ID `14438994926`**, with ZIP digest `sha256:099bae0715c04add74eb144748f479095a9bd18f6be5c5863d355cc4f8b1d383`. An independent post-download byte/hash replay checked both manifest, receipt, SKILL, SOURCES, seal and folder naming. **The signer remains an ephemeral fixture and neither candidate is production-approved or host-behaviorally validated.**

**Integration test:** [`tests/real_holo_candidate_acceptance.mjs`](../../tests/real_holo_candidate_acceptance.mjs). **Workflow:** [`real-holo-candidate.yml`](../../.github/workflows/real-holo-candidate.yml). **Source model:** [candidate composer](../../src/backend/compose.mjs), [public recipe adapter](../../src/backend/recipe-adapter.mjs), [Ed25519 claims](../../src/backend/signed-assertions.mjs), and the existing [Prism CLI consumer](../../bin/qortara-skills.mjs).

## Exact independent input pins

- Prior full [native gate run #44235570627](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44235570627) on subject `1719fd11c654528d3492ae9b6c71c9d2924fefae`, artifact ID `14399257681`, name `prism-native-nested-1719fd11c654528d3492ae9b6c71c9d2924fefae`.
- Compiled `eligibility.holo`: **17,346 bytes**; SHA-256 `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`.
- Native receipt manifest SHA-256 / attestation ID `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518`.
- Independent consumer `prism-code@0.9.5`, npm tarball integrity `sha512-PcXiUzhYJwY4ZM9wKpzazq5m/KVCWooj8dFF+7l57KcUQpNdiVDbETyYFo4A9O6OoY9tVghg5YawkIlgYYUjNA==`.

These were rechecked against the downloaded **actual** native artifact, not inferred from the PR's prose. The workflow defaults to that exact run/artifact, independently checks the complete holo and manifest hashes, and hands off only the holo to a separate runner. It accepts a different explicit run/artifact pair **only if both original SHA-256 pins still match**. It never selects a new compiler output merely because a later run is green. It pins and checks the runtime tarball before installing it with `--ignore-scripts`.

## Isolation and positive/negative vectors

The artifact retrieval job alone has `actions:read`. The guest runner requests **no repository token permissions**, uses a checkout with no persisted Git credentials, and invokes the real Prism guest inside a separate network namespace after its runtime dependencies are installed. No external source skill code, package setup scripts, browser uploads, or model inference is performed by the test.

The test follows the initial synthetic fixture flow **and** repeats the actual guest admission for each original first-party text-only procedure via the local [first-party pilot CLI](../../bin/first-party-pilot.mjs). That command checks the historical Git blob source identities, renders actionable steps, then independently reads back the sealed candidate without installing it. The first-party procedures do not change the legal-rights hold.

The initial test then follows:

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

The earlier P0 test uploaded only the candidate report. The current acceptance artifact additionally includes two original first-party generated `SKILL.md` files, receipts, source pins and hidden completion seals. CI initially omitted hidden seal files by default; that defect was corrected with `include-hidden-files: true` and the successful run above confirms a complete downloadable bundle. Neither result implies actual agent-host execution.

## Durable CI and artifact-retention policy

The original native artifact ID `14399257681` expires at **2026-12-18 04:55:33 UTC** according to GitHub's artifact metadata. The result report also has limited retention. Making this cross-run download a permanently required pull-request check would cause unrelated PRs to start failing when GitHub deletes the source ZIP. That is unacceptable maintenance drift.

For that reason the versioned workflow is **`workflow_dispatch` only**, not an automatic PR or required merge gate. After this workflow is on `main`, an operator can use **Actions → Real Prism candidate assembly (P0 development only) → Run workflow**, entering an exact completed native run ID and nested artifact ID. The holo digest, manifest digest and runtime tarball integrity remain hardcoded independently of those inputs. A newer P0 artifact with byte-identical holo/manifest can be used after the original expires. A changed digest requires an explicit governed pin review and new acceptance evidence. Native PR #15's independently gated `just vv` is not replaced by this manual replay.

A **passing run is not durable owner approval** or a source-rights license. The test itself and the traceable acceptance run remain reviewable independently of artifact retention; future replay needs a retained matching artifact, a new independent native build, or a separately owner-approved stable artifact distribution. This workflow does not create that distribution and makes no claim about it.
