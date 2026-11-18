# Test actual SM-01 Prism outputs

**Status: development-only consumer, NOT a generator, NOT P2 proof, NOT a runtime qualification.** ADR-0003 accepts the nested architecture at `prism/`, but the application is not yet installed in this repository.

**Executed 2026-11-18:** the probe ran against the real `Qortara Skills Eligibility` holo (SHA-256 `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e`) on the isolated runner and all 12 fixtures returned the modeled response from the guest. It refused a copy with one flipped byte, with the true digest and with the copy's own. The holo is `P0 unverified` and its inputs are fixtures. Reports and limits: [qualification record](../evidence/prism-qse-20261118/README.md).

The program [sm01_probe.mjs](../../scripts/sm01_probe.mjs) sends the 12 recorded SM-01 requests to a **real compiled Prism holo**, using the exact `prism-code@0.9.5` API `prism.containers.run(holo, Uint8Array, options)`. It **does not implement eligibility in JavaScript**. These are constant expectations; all actual decisions and outputs come back from the holo. Raw bytes carry NUL and FF, so a shell-argument test would be incorrect.

## Use

Prerequisites: Node.js >=22, a disposable credential-free test environment, and a real `.holo` built from the pinned nested Prism template and SM-01 overlay. **No holo is checked into this repository.** The earlier candidate digest `4092fea915c0c718c668be332c076c75d8593836e2a055e604b4772026ee6962` must NOT be reused after renaming or rebuilding. The pinned package integrity observed in phase-0 evidence is `sha512-PcXiUzhYJwY4ZM9wKpzazq5m/KVCWooj8dFF+7l57KcUQpNdiVDbETyYFo4A9O6OoY9tVghg5YawkIlgYYUjNA==`. An ordinary unpinned dependency install does not satisfy that supply-chain requirement.

```sh
# In a disposable checkout. Verify the package tarball integrity before trusting it.
npm install --no-save --ignore-scripts --omit=optional prism-code@0.9.5
# Supply the EXPECTED digest from an independently preserved native-gate receipt,
# not a hash freshly computed from a potentially substituted artifact.
node scripts/sm01_probe.mjs --holo /absolute/path/Eligibility.holo \
  --sha256 <independently-recorded-sha256> --allow-p0 \
  --report /absolute/path/to/unused-output-report.json

# Or one fixture:
node scripts/sm01_probe.mjs --holo /absolute/path/Eligibility.holo \
  --sha256 <independently-recorded-sha256> --allow-p0 --case prohibited-rights
```

If the holo, checksum or exact runtime is missing, the command **refuses**. A passed fixture requires a true Prism container exit 0 and exact output bytes. Runtime exceptions, malformed output or a Prism refusal are visible as failed test cases, not covered over with a simulation. Reports are create-only (`wx`), so an existing evidence file cannot silently be overwritten.

**Assurance boundary:** `--allow-p0` explicitly enables a restrictive development-fixture policy `minimum: P0, effects: []` while independently embedded signed proofs are unavailable. The program deliberately does **not** pass the runtime's `allowUnverified: true` override, which would bypass failed check results. Even a 12/12 pass remains **P0 unverified** and does not prove the truth of the four input assertions or the fitness of generated skills.

## Source-only staging artifact

The [Prism source-staging workflow](../../.github/workflows/prism-source-stage.yml) fetches the **exact pinned UOR template**, applies the locally versioned SM-01 overlay and compares all seven protected template policy files byte-for-byte. It runs **no Docker, SDK, native Prism gate, Prism guest, or Qortara verification**. It publishes a source-only tarball and a source manifest for a subsequent isolated build runner. The archive is **not** an executable holo, not an SDK trust endorsement, and not a completed acceptance artifact.

A full Prism application must still be installed through the accepted nested architecture and run through the unreduced native gate. The source-staging artifact is a reproducible input, not proof of output behavior.

## Recorded and missing tests

`node --test tests/sm01_probe.test.mjs` uses a **stand-in Prism interface** to check command guardrails, all 12 raw byte fixtures, digest/policy refusals, exact output matching and no-overwrite behavior. It is **not** evidence of executing a real holo. Do not claim native execution from this test or a green CI status.

Done on a staged instance, on the isolated runner ([issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)): the full unreduced `just vv` for **Qortara Skills Eligibility**, `prism-code vectors` on the result, and this probe against that exact digest. [`scripts/sm01_real_holo_acceptance.sh`](../../scripts/sm01_real_holo_acceptance.sh) is the script that does the last two. Still to do: install the nested `prism/` application in this repository, which waits on the owner's remaining decisions in ADR-0003. Run Qortara's native repository checks and resolve reporting [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4) separately. Do not turn this into a production eligibility decision until all four codes have authenticated evidence/rights/authority/coverage assertions and freshness/revocation checks. `skillz` is never modified by this probe.
