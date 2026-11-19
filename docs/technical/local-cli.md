# Qortara Skills local development CLI

**State: request-first source qualification/refusal CLI plus P0 Prism developer evaluation; not an approved skill generator or released product.** On 2026-11-18 `status`, `probe` and `evaluate` were run against the real `Qortara Skills Eligibility` holo on the isolated runner: preflight ready, 12 of 12 fixtures, and the guest's actual response for each of 17 requests. The holo is `P0 unverified` and its inputs are fixtures. See the [qualification record](../evidence/prism-qse-20261118/README.md).
The CLI is the first local access surface. Its `evaluate` and `probe` commands use the real pinned Prism runtime to call an externally built SM-01 holo. The new `create` command uses the separately pinned read-only Skillz catalog and actual C4/C5 preflight to return **a source-grounded typed refusal**; it does **not** create or install an approved SKILL.md, grant permissions, download an SDK image, infer a missing expert method or treat fixture assertions as real rights.

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

## Discover an exact capability before creating a skill

The ordinary CLI now exposes the **existing, exact pinned Skillz capability graph**. You no longer need to know the route name in advance or run a separate Python developer command.

```sh
qortara-skills routes --summary \
  --handoff /path/to/skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-source

qortara-skills routes --search frontend --limit 10 \
  --handoff /path/to/skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-source

qortara-skills routes --path software-engineering/frontend \
  --handoff /path/to/skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-source
```

The output gives a recognized route ID suitable for the subsequent `create --route`, the essential outcomes, the actual evidence-linked governed reviews and unqualified leads. Search is **lexical filtering**, not semantic expertise or an eligibility ranking; no matches does not mean no source exists. All methods remain `rights_clearance:not-established` and `composition_eligible:false`. The source SHA and snapshot tree are verified independently before search. Relative directories are resolved against the invoking operator's working directory, not the installed CLI's source root. You can write the JSON to a new, private receipt with `--report`; existing receipts are never overwritten.

The three modes are mutually exclusive: `--summary`, `--search TEXT [--limit 1..25]`, or `--path DOMAIN/SUBDOMAIN`. Invalid routes and tampered source checkouts refuse with a nonzero exit. **This discovery feature does not execute a source skill, invoke Prism or an LLM, approve reuse, or create an installation.**

## Request-to-source-refusal on the ordinary CLI (no Prism or model call)

This path is available via `qortara-skills create` on the implementation branch. It requires **Node.js 22+, Python 3.11+** and separate exact, read-only handoff and original source checkouts. It does not use the P0 fixture key or invoke a Prism container.

```sh
qortara-skills create \
  --request "Build an accessible responsive UI component with keyboard interactions" \
  --route software-engineering/frontend \
  --host ChatGPT \
  --handoff /path/to/skillz-export/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-source \
  --method governed:anthropic-skills/frontend-design \
  --report /new/path/denial.json
```

The command checks the *whole* pinned catalog/source checkout and returns JSON with an exact route, all evidence-linked candidates and their source inspection state, a refusal code such as `RIGHTS_UNRESOLVED`, and `composer_invoked:false`/`production_eligible:false`. A refusal deliberately exits **2**, avoiding false-success shell pipelines. If no governed review is linked, it returns `MAPPING_GAP`; for more than one linked candidate it requires an explicit inspected record. Free-form semantic route determination is **not** qualified.

See [the implementation and Gherkin acceptance contract](request-to-skill-cli-v1.md). The user-request body is hashed rather than repeated in persistent result JSON. Report paths are new-only (no overwrite). This is not positive rights/host authorization or end-to-end build-token accounting.

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

1. Native `prism/` instance and final-name holo built through the *entire unreduced* `just vv` on a credential-free isolated runner. Capture exact SDK/runtime source, hashes, host conditions, exit codes and negative controls. **Done for a staged instance (2026-11-18); `prism/` itself is not installed.**
2. Independent verifier replays vectors on the final holo. Run `qortara-skills probe` and `evaluate` against that **same digest**; preserve outputs and proof limitations. **Done on the isolated runner (2026-11-18), at P0.**
3. Actual catalog-evidence/rights/authority/coverage assertion adapters implemented with versioned, revocable authority, then a separately governed deterministic skill composer and portable output contract.
4. Host usage, no-inference instrumentation, repository security reporting and native Qortara governance qualified separately.

See [SM-01 probe contract](sm01-output-probe.md), [ADR-0003](../adr/0003-prism-application-adoption.md), [issue #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3), [issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9), and [security issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4).
