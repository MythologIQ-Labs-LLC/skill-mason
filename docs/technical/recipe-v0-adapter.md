# Public recipe v0 to pinned candidate plan

**State:** Development-only adapter implemented, not production-approved, not autonomous source discovery, not proof of method rights or host usability.

**Input schema:** [`schemas/recipe.v0.schema.json`](../../schemas/recipe.v0.schema.json). **Implementation:** [`src/backend/recipe-adapter.mjs`](../../src/backend/recipe-adapter.mjs). **Tests:** [`tests/backend_recipe_adapter.test.mjs`](../../tests/backend_recipe_adapter.test.mjs). **Owner:** Qortara Skills backend, under [the proposed pipeline](../architecture/skill-mason-pipeline-v0.md).

## How it behaves

`createRecipeAdapter({sourceSnapshot,supportedHosts,components})` is configured with **operator-supplied, independently source-pinned records**, not user-controlled or catalog-imported claims. Each operator component must include a method ID, package ID, package SHA-256, the actual **complete source package bytes**, and a pinned method record with exact source text SHA-256 and declared essential outcomes. The adapter checks every package's byte digest and method's text digest at configuration time, and also requires the exact UTF-8 method text to occur **verbatim** in those pinned package bytes. This pilot does not approve transformations, extraction from compressed binaries, or inferred method content. It copies the selected data and refuses missing/modified/duplicated inputs.

A public recipe must request one or more explicit selected components with exactly matching method ID, package ID and package SHA-256; the recipe's source snapshot identity must match the operator snapshot in all three fields. Target host must be on the **operator-configured host allowlist**, and requested outcomes must be covered by exactly declared method outcomes. Missing coverage refuses; there is no semantic inference, source search, relevance scoring, auto-filling, or unqualified fallback.

The authority ceiling is fixed at `network:false`, `secrets:false`, `execution:false`. Unknown fields and any nonempty parameter substitution refuse because method-specific substitution safety has not been qualified. Duplicate requested components, unknown method IDs, mismatched package hashes or unsupported hosts fail with typed refusal codes.

The adapter returns an internal `qortara/internal-composition-plan/1` and selected source method records. The plan includes **exact source snapshot identity and selected package pins**, and the candidate composer now retains both fields in `SOURCES.json` and binds them through its `recipeSha256` receipt digest. The composer still requires independently authenticated assertions and a real pinned Prism decision before generating any candidate. The public recipe, even if syntactically valid, cannot supply the assertion callback or decide eligibility.

## Functional development demonstration

The test suite exercises a public recipe selecting **two different methods serving two explicitly named outcomes**. It passes the resulting normalized internal plan to the deterministic composer using clearly marked **fixture-only** trusted assertions and a mock Prism guest. The output is four replayable candidate files with the public snapshot and package digests retained, and `productionEligible:false`, `hostValidated:false`, `modelCallsMeasured:false`.

A second run with component/outcome order reversed yields byte-identical packages. Negative controls cover wrong source pin, wrong package bytes, missing package bytes, unknown method, unknown host, missing essential outcome, unsafe authority, injection through unsupported parameters, extra fields, duplicate records, and mutating the operator registry after bootstrap.

```sh
node --test tests/backend_recipe_adapter.test.mjs
node --test tests/backend_compose.test.mjs
```

## Production holds and next boundaries

- **No automatic third-party selection:** the pinned `skillz` snapshot has verified file bytes but does not grant content reuse. An operator-supplied registry is not a trusted rights certificate without independently approved provenance, rights and policy. An attacker-controlled registry can fabricate its own source statements, so it must never be fed directly from a browser or an arbitrary CLI request.
- **No autonomous authoring:** a plain-English prompt cannot be turned into verified outcomes or a permission to invent methods without a separate source-grounded deterministic planner. The static Pages UI remains an accurately labeled starter-draft interface until a real authorized backend route is deployed.
- **No implicit host equivalence:** the development fixture hosts are *not* evidence of real Claude/ChatGPT/VS Code skill behavior. Host compatibility and actual task success must be measured separately.
- **No production Prism assurance:** the native app, SDK trust root and P0 proof limits remain governed under PR #15 and the existing open native issues.
- **No zero-token claim yet:** unit tests do not instrument complete real-world build invocations; the measured source-to-host pipeline and two actual host behavioral tests remain outstanding.
- **Further format work:** a public recipe's snapshot SHA-256 is an operator-supplied pin, not an independently rehashed entire snapshot by this module; whole-source snapshot integrity is a separate `verify_catalog_source.py` step.

Do **not** mark issue #17 or the product as a qualified generator until the real path has been verified end-to-end and independently replayed.
