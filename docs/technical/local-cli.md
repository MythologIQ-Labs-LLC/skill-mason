# Qortara Skills local development CLI

**State: initial development CLI, not a skill generator or released product.**
The CLI is the first local access surface. It uses the real pinned Prism runtime to call an externally built SM-01 holo. It does **not** evaluate catalog claims, create or install SKILL.md, grant permissions, download an SDK image or infer missing methods.

## Start locally (Node.js 22+)

```sh
git clone https://github.com/MythologIQ-Labs-LLC/skill-mason.git
cd skill-mason
npm link                 # local CLI shim only, no runtime download
qortara-skills help
qortara-skills version
qortara-skills status
npm run test:cli         # stand-in guardrails; not a holo execution
```

`status` exits nonzero until prerequisites exist and reports `preflightReady`, NOT proof or application qualification. Node v22 or later is necessary for the pinned runtime. This package is private and has no declared automatic SDK dependency.

## Test a REAL compiled holo (development fixture only)

Obtain a *final named*, exact-revision `Qortara Skills Eligibility` holo from a trusted, isolated native build, together with the independently recorded SHA-256 in its gate receipt. **The existing old-name candidate and the source-only GitHub artifact are not substitutes.** An SDK trust-root decision and isolated runner remain separate under issue #9.

The previously observed Prism runtime version is `prism-code@0.9.5`, subject to its independently inspected integrity and approved package acquisition. **Do not assume `npm install` alone qualifies the package's trust root.** In a disposable test checkout after qualification:

```sh
npm install --no-save --ignore-scripts --omit=optional prism-code@0.9.5
qortara-skills status --holo /path/to/Eligibility.holo --sha256 <sha-from-native-gate>
qortara-skills evaluate --holo /path/to/Eligibility.holo --sha256 <sha-from-native-gate> --hex 01010101 --allow-p0
qortara-skills evaluate --holo /path/to/Eligibility.holo --sha256 <sha-from-native-gate> --hex 01000101 --allow-p0 --report fresh-result.json
qortara-skills probe --holo /path/to/Eligibility.holo --sha256 <sha-from-native-gate> --allow-p0 --report fresh-12-case-report.json
```

The `evaluate` command transports *raw byte input* to `prism.containers.run`, retains the actual guest output and exact hexadecimal response, and makes **no second eligibility decision**. `probe` runs the twelve recorded positive, refusal, malformed-length and boundary fixtures through the same Prism runtime and compares returned bytes to model vectors. Both refuse absent or wrong SHA, missing/wrong pinned runtime and omitted `--allow-p0`. Report files use exclusive creation.

**Assurance is P0 unverified**, despite a fixture run that may pass. This opt-in uses an explicit policy (`minimum: P0`, `effects: []`) but never the SDK's `allowUnverified` bypass. The four input codes in the current model are *fixtures*, not authenticated statements about source rights, evidence, user authority or coverage. No real user skill should be built or trusted from these codes yet.

## Completion criteria

1. Native `prism/` instance and final-name holo built through the *entire unreduced* `just vv` on a credential-free isolated runner. Capture exact SDK/runtime source, hashes, host conditions, exit codes and negative controls.
2. Independent verifier replays vectors on the final holo. Run `qortara-skills probe` and `evaluate` against that **same digest**; preserve outputs and proof limitations.
3. Actual catalog-evidence/rights/authority/coverage assertion adapters implemented with versioned, revocable authority, then a separately governed deterministic skill composer and portable output contract.
4. Host usage, no-inference instrumentation, repository security reporting and native Qortara governance qualified separately.

See [SM-01 probe contract](sm01-output-probe.md), [ADR-0003](../adr/0003-prism-application-adoption.md), [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3), [issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9), and [security issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4).
