# Pinned real-Prism guest adapter v0

**Status:** Implemented **development-only** transport from the candidate composer to the existing local Prism CLI consumer. This **does not** install the native Prism application, certify `P0` as proof, authorize an SDK publisher, approve a source method or release a skill builder.

**Code:** [`src/backend/prism-guest.mjs`](../../src/backend/prism-guest.mjs). **Tests:** [`tests/backend_prism_guest.test.mjs`](../../tests/backend_prism_guest.test.mjs). **Existing, independently tested consumer:** [`bin/qortara-skills.mjs`](../../bin/qortara-skills.mjs) and [`scripts/sm01_probe.mjs`](../../scripts/sm01_probe.mjs).

## Runtime flow

A separately governed backend config supplies **absolute** `.holo` path, an **independently recorded** SHA-256 digest, explicit `developmentP0Consent:true`, and optionally an internally provided pinned runtime loader for tests. The guest adapter `createPinnedPrismGuest(config)` only accepts exact `{requestHex,holoSha256}` calls, with four canonical `00`/`01` bytes and the configured holo digest. Extra caller flags, alternate runtime policies and user-controlled holo selection refuse.

The adapter calls **the existing** `evaluate` function; it does **not** reproduce Prism's admission logic. That function first checks the actual `.holo` bytes against their independently recorded SHA-256, rejecting absent/symlinked/tampered artifact files, then invokes the pinned `prism-code@0.9.5` API `prism.containers.run` with `policy: {minimum:'P0',effects:[]}` and `rm:true`. It never sets `allowUnverified`. Actual guest bytes, exit status and exact identity are returned unchanged for the composer to judge. Runtime failures and malformed UTF-8 never become an eligible result.

The composer's `assertMethod` remains separate: only configured authenticated assertions can generate its four facts; explicit signed denials are transported as zeros to the **real Prism guest**. The composer still refuses an inconsistent/false admission and emits only `DEVELOPMENT_CANDIDATE` with `productionEligible:false`, `hostValidated:false`, `modelCallsMeasured:false`.

## Demonstrated in CI and what it does not prove

```sh
node --test tests/backend_prism_guest.test.mjs
```

This suite uses a **synthetic local `.holo` file** and a stand-in `containers.run` implementation to exercise the real CLI consumer code path, digest/symlink checks, raw four-byte transport and P0 policy. It includes an end-to-end pipeline with an **ephemeral Ed25519 signer**, content-matching fixture evidence, the actual candidate composer, actual CLI transport and a **mock guest**. It proves correct invocation wiring, typed refusal and byte-identical candidate packages under these synthetic inputs.

It does **not** execute a real Prism holo, establish the truth of any legal rights judgment, measure zero inference on an integrated production path, or validate actual generated skills inside a consuming host. The native real-holo evidence belongs to [PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15) and is **not** silently reused as a production trust root. The installed native application and accepted SDK trust are still governed by [issues #3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) and [#9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9).

## Next qualification gates

1. Accept a pinned native Prism application and actual SDK/runtime provenance under existing owner/governance boundaries, without bypassing the verified root/ratchet checks.
2. Replace the synthetic holo and stand-in runtime in an isolated consumer acceptance run with the genuine exact-digest holo; verify positive and negative decisions across independently recorded runtime evidence.
3. Authenticate actual per-method source bytes, source reuse rights, host authority and outcome coverage through trusted, revocable assertions; [signed assertion contract](signed-assertions-v0.md) does not grant these rights.
4. Measure full integrated build inference calls and separately test real target-host task outcomes. Do not call this a working qualified generator until [#17](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/17) accepts the result.
