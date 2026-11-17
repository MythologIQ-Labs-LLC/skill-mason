# Test actual SM-01 Prism outputs

**Status: development-only consumer, NOT a generator, NOT P2 proof, NOT a runtime qualification.** ADR-0003 accepts the nested architecture at `prism/`, but the application is not yet installed in this repository.

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

## Recorded and missing tests

`node --test tests/sm01_probe.test.mjs` uses a **stand-in Prism interface** to check command guardrails, all 12 raw byte fixtures, digest/policy refusals, exact output matching and no-overwrite behavior. It is **not** evidence of executing a real holo. Do not claim native execution from this test or a green CI status.

The remaining gate is to build and install the actual nested `prism/` application with application name **Qortara Skills Eligibility**, run the full unreduced `just vv` in an isolated approved runner ([issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)), replay acceptance vectors with pinned `prism-code vectors`, and run this probe against the resulting **exact-digest** holo. Run Qortara's native repository checks and resolve reporting [issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4) separately. Do not turn this into a production eligibility decision until all four codes have authenticated evidence/rights/authority/coverage assertions and freshness/revocation checks. `skillz` is never modified by this probe.
