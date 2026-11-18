# Deterministic backend composer v0 (development candidate)

**Status:** Implemented source-only package-assembly primitive, **not a public skill generator, not a qualified build and not an accepted Prism application**. This intentionally does not replace the existing [public recipe.v0 schema](../../schemas/recipe.v0.schema.json). It uses a separate, **internal-only** `qortara/internal-composition-plan/1` shape until a governed adapter from public recipes is accepted.

**Source:** [`src/backend/compose.mjs`](../../src/backend/compose.mjs). **Tests:** [`tests/backend_compose.test.mjs`](../../tests/backend_compose.test.mjs). **Product objective:** [#17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17). **Prism native qualification:** independent draft [#15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15).

## Concrete implemented contract

`createComposer({assertMethod,runPrism,holoSha256})` returns an **in-memory** composer. Both callback implementations and the holo pin must come from a trusted, separately approved backend coordinator. They are **not** accepted from an HTTP request, the user, a skill's instructions, a recipe, or the read-only `skillz` metadata export.

1. Validate a bounded internal plan, declared essential outcomes, no ambient network/secrets/execution authority, and an exact source set of 1–16 methods. Unknown fields are rejected.
2. Validate each method's exact source commit, source path, SHA-256 of supplied UTF-8 method text, outcome declarations, and explicit absence of nested assets. Relative path traversal, inconsistent content and missing outcomes refuse before any Prism call.
3. Obtain independent, externally verifiable **assertions** for evidence, rights, actual authority and outcome coverage from the trusted `assertMethod` integration. Every proof must return the exact `subjectSha256` derived from the immutable normalized plan, source commit, method digest and coverage, preventing accidental cross-method proof reuse. Any unknown/missing/misbound assertion refuses. A caller-supplied `eligible` flag is not allowed. **The present code does not yet independently authenticate assertion issuers or source Git roots.**
4. Dispatch the bounded four-byte eligibility request to a **real pinned Prism guest** through the trusted `runPrism` adapter. Trusted true facts become code `1`; explicitly denied facts become `0` and are **sent to Prism for its own refusal decision**. Missing/unknown facts are rejected before execution. Packaging requires a successful exact `qortara/local-eligibility-result/1` with `response = eligible`, matching response bytes, `requestHex = 01010101`, `exitCode = 0` and an exact expected holo SHA-256. A guest that incorrectly admits any denied fact still refuses. This module **does not implement or substitute a second eligibility decision**. The pinned guest/version remains subject to [#3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) and [#9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9).
5. Produce canonical, reproducible `SKILL.md`, `SOURCES.json`, `RECEIPT.json` and `skill-mason.json` bytes. Methods are quoted as *source-pinned, unexecuted text*; nothing is installed, invoked or activated. Source package identity, asserted-proof pointers, exact guest identity and per-file hashes are retained.
6. `verifyPackage` recalculates file/receipt hashes and refuses tampering. It **cannot authenticate a publisher or rights assertion**. `writePackage` is explicitly opt-in and creates a **new** destination folder with exclusive file creation; it never overwrites an existing folder or auto-installs a skill. If writing fails partway through, the new folder may be incomplete and must not be used; atomic materialization and hostile shared-filesystem races require a later design.

No wall-clock time, model call, network fetch or source repository mutation occurs within the pure composer. The receipt records `modelCallsMeasured:false`; a passing unit test is **not** measurement that an integrated build uses zero inference. Canonical receipt hashes are integrity aids, not cryptographic proof that the input assertions were true.

## Executable, offline tests

With Node 22+:

```sh
node --test tests/backend_compose.test.mjs
```

The fixtures inject a **mock assertion source** and **mock Prism guest**. The guest mock also exercises rights-denied input `01000101` and a contradictory eligible response, both requiring refusal. Tests also refuse cross-method assertion replay, guest output-byte mismatch and mutation of a validated plan by callbacks. They prove deterministic byte equality, output file creation, tamper detection, source mismatch, missing coverage, unknown assertion refusal, wrong digest, nested asset refusal, path traversal refusal, no overwrite, and basic authority constraints. They do **not** prove native holo execution, source-rights truth, host behavioral efficacy, or a user-ready complete generated skill. The positive test fixture is never permission to admit an actual `skillz` method.

## Why this is separate from native Prism PR #15

PR #15 owns the pinned full `just vv` gate, isolated SDK execution, real guest, ratchet and qualification evidence. This module is a **downstream materialization boundary**, outside `prism/` and the SDK workflow. It cannot accept free-form user assertion flags, bypass native gate requirements, create a trusted holo, or mark `productionEligible:true`.

The pinned `skillz` handoff still labels composition eligibility `not-assessed` and redistribution clearance `not-established-by-export`. **No method from those 1,043 records is automatically eligible for this composer.**

## Unresolved production dependencies

- Trusted, authenticated source roots and bytes for chosen `skillz` methods, including nested asset rights, issuer identity, freshness and revocation.
- A production-owner-reviewed `assertMethod` integration, not a user-supplied callback. Its claims must bind the same exact source digest, plan, outcome and authority consumed by the guest.
- A verified `runPrism` adapter wired to the final exact pinned native holo and accepted assurance policy; currently P0 unverified/fixture-only.
- A governed public recipe adapter, coverage planner, full portable host contract, non-executable artifact validation and at least two real target-host behavior tests.
- Adversarial injection and deterministic replay across independent hosts plus measured zero inference during full integrated assembly.

**Fail-closed until these exist.** The current browser may continue producing clearly labelled user-request starter drafts; this module does not silently upgrade that behavior.