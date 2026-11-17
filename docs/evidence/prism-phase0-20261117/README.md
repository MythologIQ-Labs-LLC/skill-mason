# Prism qualification record, 2026-11-17

**What this is:** the commands that were run, their unedited logs and receipts, and what they do and do not establish. It is evidence for a decision, not a decision. **Skill Mason is not a Prism-built application**: the eligibility decision below is a candidate carried as an overlay, pending [ADR-0003](../../adr/0003-prism-application-adoption.md).

**Subject revision:** Skill Mason `42d8e35e4d2f825964a8fa11cb7d1ca3825191bd` plus the change that adds this record.
**Performed by:** Claude Code in a cloud container, `linux/amd64`, 4 CPUs, Docker 29.10.0. No human ran or observed these commands.

## Result

| Gate | Result |
| --- | --- |
| Phase 0: three developer skills discovered and invoked by the host | **PASS**, after an initial failure that is explained below |
| Phase 0: one compatible, pinned authoring route demonstrated | **PASS**: route A |
| Phase 0: upstream reference application through its complete gate, with negative controls | **PASS**: `just vv` exit 0 twice, seven planted defects refused |
| Phase 1: adoption without replacing Qortara governance | **Feasible as a nested instance**; decision is the owner's |
| Phase 1: smallest eligibility decision in the genuine framework | **Built and verified as a candidate**: complete gate exit 0, twice, on a nested instance carrying `SM-01` |
| Independent proof-level verification of any artifact | **Not established**: `P0 unverified` |
| Native Qortara checks | `NOT_RUN` ([issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4)) |

## 1. Identities

| Item | Value | How observed |
| --- | --- | --- |
| `UOR-Foundation/template` | `b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b` | `git ls-remote … HEAD` equalled the recorded pin |
| `UOR-Foundation/PrismPM` | `d896ab59e287650aecbcf02b8e867121601fdde5` | same |
| `UOR-Foundation/LexLean` | `a74b1f99bba637e51d19fb4efc508316aafa6664` | same; cloned, not read in this run |
| `UOR-Foundation/prism` | `507995bab43c0cb06ec244c96e6fc25b3f502204` | same |
| `afflom/prism-devrel` | `ace153e37c7c29646f3efa6e273c3c4f8c9fb8bc` | same |
| SDK image | `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3`, 21.6 GB | from the template's `prismpm.lock`; `docker pull` by digest |
| Tools in the image | `prismpm 0.4.0`, `lexlean 0.4.0`, Lean 4.32.1 (`f054605`), Lake 5.0.0, `rustc 1.97.1`, `just 1.57.0`, `cargo-deny 0.20.2` | each binary's `--version`, run in the image |
| Independent checker | `prism-code 0.9.5`, npm integrity `sha512-PcXiUzhYJwY4ZM9wKpzazq5m/KVCWooj8dFF+7l57KcUQpNdiVDbETyYFo4A9O6OoY9tVghg5YawkIlgYYUjNA==` | `npm install --ignore-scripts prism-code@0.9.5` |

Discrepancies recorded, not resolved:

- `prismpm.lock` declares `sdk_version` `0.3.0`; the binary in that image reports `prismpm 0.4.0`.
- `template.lock` names `template_revision` `263b14a2…`, the policy commit before the pinned lock commit. Upstream documents this two-commit scheme.
- Prism-DevRel at its pin selects a different digest of the same image repository (`sha256:a4dcef36…`).
- The image repository is `ghcr.io/afflom/…-patched`, a personal namespace.

## 2. Developer-skill qualification

| Skill | Session-start listing | Invoked right after checkout | Invoked after the host refreshed | After the skill file was rewritten |
| --- | --- | --- | --- | --- |
| `prism-source-gate` | absent | `Unknown skill` | loaded, full text returned | relisted with the new description |
| `prism-model-first` | absent | `Unknown skill` | loaded, full text returned | relisted with the new description |
| `prism-proof-audit` | absent | `Unknown skill` | loaded, full text returned | relisted with the new description |

The session started on a branch at `main`, which has no `.claude/` directory, so the host had nothing to discover. After the working branch was fast-forwarded to `42d8e35`, the first three invocations failed. The host's skill listing then refreshed on its own and all three loaded through the Skill tool. So: **presence in Git did not prove activation, a checkout that adds skills mid-session is not usable immediately, and a refreshed listing is.** A session started directly on a branch that contains `.claude/skills/` was not tested.

These are observations of one Claude Code host. They are not recorded as tool logs because skill discovery is not a shell command; the evidence is the session transcript.

## 3. Route selection

Recorded in the [route decision record](../../../.claude/PRISM_COMPATIBILITY.md). In short: route A executed; route B exists only as an experimental `prism-code mcp` journey and was not run; route C's packages return `E404` from npm; route D is a library, not an application route. PrismPM `SPEC.md` at the pin never mentions `spec.json`, and section 1.2 requires `.lex.tex`.

[PrismPM #718](https://github.com/UOR-Foundation/PrismPM/issues/718) was read: open, one comment by its author carrying a four-file documentation patch, no maintainer response, no linked pull request. The patch was not applied or tested.

## 4. Upstream reference application

The template's own application (`app/`, capability `TC-01`) in a pristine checkout at the pin, inside the SDK image, through the unmodified `just vv`.

| Run | Network | Command | Exit | Log |
| --- | --- | --- | --- | --- |
| Cold, offline | none | `just vv` | 101 at `model`: `Could not resolve host: static.crates.io` | `logs/ref-vv-offline.log` |
| 1 | host | `just vv` | **0**, 378 s, `vv: the acceptance gate passed` | `logs/ref-vv-net1.log` |
| Clean tree, warm crates, offline | none | `just vv` | 1 at `deny`: cannot fetch `github.com/RustSec/advisory-db` | `logs/ref-vv-run2-offline.log` |
| 2, clean tree | host | `just vv` | **0**, 347 s, `vv: the acceptance gate passed` | `logs/ref-vv-run2-net.log` |
| 3, clean tree, offline | none | `just app` | **0**, 341 s | `logs/ref-app-run3-offline.log` |

Receipts, unedited, in `receipts/reference/`:

| Identity | Value |
| --- | --- |
| Attestation id, printed by all three passing runs | `927392b7031ac862683e5f28bbaf11431a1049ed13e2158921fca329c6f1539f` |
| SHA-256 of `manifest.json` | the same value, recomputed |
| `.holo` SHA-256, identical in runs 1, 2 and 3 | `da1a5c9fea5180e13f2b25e91ce65a18bfb796e5245ff32272cf874f0ed8650e` |
| `archive_fingerprint` | `9fdfcd05f039104c091eaef5aa5b9ba6499a49397bc1a06f467192bbcda91dfc` |
| Acceptance | `prismpm/application-acceptance/1`, `status: verified`, `regeneration: byte-identical`, 9 modeled vectors |

**Repeatability.** Before runs 2 and 3 every generated output was deleted. `manifest.json` and `lexlean-attestation.json` are byte-identical across runs. The acceptance files differ only in `browser_timing` microseconds, which upstream keeps outside the acceptance digest. This is same-machine repeatability, not cross-machine reproducibility.

**Network.** The complete gate is not hermetic: a cold cache needs `static.crates.io`, and `just deny` needs the RustSec advisory database every time, which is a mutable input. The application stage alone, which builds the holo, runs Lean and leanchecker and replays the vectors, passed with the container's network disabled.

### Negative controls on the reference application

Each was planted in the checkout, run against the gate that owns the claim, and reverted to a clean tree.

| Planted defect | Command | Exit | Diagnostic | Log |
| --- | --- | --- | --- | --- |
| One line appended to `AGENTS.md` | `prismpm template check` | 2 | `PP1101: template policy path changed: AGENTS.md` | `logs/nc3-policy-drift.log` |
| One inventory digest changed in `prismpm.lock` | `prismpm lock check` | 4 | `PP5401: SDK platform inventory or index binding is invalid` | `logs/nc4a-lock-tamper-lockcheck.log` |
| Same | `prismpm template check` | 4 | `PP5401` | `logs/nc4b-lock-tamper-templatecheck.log` |
| `CONFORMANCE.md` statement edited | `just model` | 1 | `CONFORMANCE.md is stale: it disagrees with model/ids.toml` | `logs/nc5-stale-conformance.log` |
| `conformant` no longer checks `bootstrap` | `prismpm --project app verify` | 1 | `PP5001`, Lean `unsolved goals` | `logs/nc1-weakened-decision.log` |
| First vector's response changed by one byte | `prismpm --project app verify` | 1 | `PP5301 … disagrees with a modeled vector` | `logs/nc2-wrong-vector.log` |
| Theorem's `axioms: [propext]` emptied | `prismpm --project app verify` | 1 | `LLV7005 … violates its none axiom policy: observed [propext]` | `logs/nc7-undeclared-axiom.log` |
| One byte flipped in the `.holo` | `prism-code vectors` | 1 | `digest_mismatch … the holo was altered` | `independent/prism-code-0.9.5.txt` |

### Independent artifact check

`prism-code 0.9.5` is a separate JavaScript implementation from `prismpm`. Its output for both holos is in `independent/prism-code-0.9.5.txt`.

| Check | Result |
| --- | --- |
| `prism-code vectors` on the reference holo | `9 of 9 vectors passed (holo, Template contract, identities verified)` |
| `prism-code inspect` | footer, labels and cross-references `ok`; digests equal the acceptance receipt's |
| `prism-code check`, default policy | **`FAILED P0 unverified`**: no provenance, proof or replay statement inside the holo; the policy requires P2 |
| `prism-code check` on the package's own `Calculator.holo` fixture | also `P0 unverified`; `22 of 22 vectors passed` |

So the vectors were independently replayed and the archive identities independently verified. The proof was **not** independently verified: it is attested by sidecar receipts written by the toolchain that built the artifact.

## 5. Adoption experiments

| Question | Experiment | Result | Log |
| --- | --- | --- | --- |
| Can the template's `AGENTS.md` differ from the locked bytes? | Control `nc3` above | No: `PP1101` | `logs/nc3-policy-drift.log` |
| Does an instance pass when nested under a repository whose root `AGENTS.md` is Skill Mason's? | Root commit with both | `template contract passed` | `logs/nest-template-check.log` |
| | | `SDK lock is canonical and valid` | `logs/nest-lock-check.log` |
| | | `validate: every gate passed` | `logs/nest-model.log` |
| Can it be added to a repository that already has history? | One commit of governance files, then one commit adding `prism/` | `audit-prism: installed here; the parent ran no ratchet, so this commit sets the ceiling` | `logs/nest2-with-history-model.log` |
| | | `template contract passed` | `logs/nest2-with-history-template-check.log` |

Root SHA-256 of Skill Mason's `AGENTS.md` is `b2487038…`; the template's is `9a1fe3f7…`. They cannot share a path.

## 6. The eligibility candidate, `SM-01`

Source: [`prism-overlay/`](../../../prism-overlay/README.md). Built in a template instance at the pin, as a second PrismPM project `eligibility/`.

| Step | Command | Exit | What happened | Log |
| --- | --- | --- | --- | --- |
| Lock | `lexlean lock` | 0 | `wrote lexlean.lock` | `logs/el-lock.log` |
| Format | `lexlean fmt` | 0 | `formatted 1 module` | `logs/el-fmt.log` |
| Static | `prismpm --project eligibility check` | 0 | `check passed` | `logs/el-check.log` |
| Verify, first attempt | `prismpm --project eligibility verify` | **1** | `LLV7005`: `codeAt` declared no axioms, Lean observed `[Quot.sound, propext]` | `logs/el-verify-1.log` |
| Verify, axioms declared as observed, offline | same | **0**, 331 s | `verified attestation: 7bed00d0…` | `logs/el-verify-2.log` |
| Register (R3) | `just new-capability SM-01 build eligibility "…"` | 0 | row, scenario, failing test, `CONFORMANCE.md` | `logs/el-new-capability.log` |
| Red | `cargo test … --test eligibility` | **101** | `SM-01 is registered and not built` | `logs/el-red-test.log` |
| Green | same, after writing the test | 0 | `test eligibility_sm_01 ... ok` | `logs/el-green-test.log` |
| Rust formatting | `just fmt-check` | **1** | the gate's formatter rejected the hand-written test; fixed with `just fmt` | `logs/el-fmtcheck.log` |
| Added in a commit after installation | `just fmt-check model` | **1** | `audit-prism: 1 new non-Prism file(s) … grew by 81 lines` | `logs/el-model-after-commit.log` |
| **Complete gate**, nested instance with history, capability in the installing commit | `just vv` | **0**, 660 s | `vv: the acceptance gate passed` | `logs/sm01-nested-vv-run1.log` |
| **Complete gate again**, instance rebuilt by `scripts/prism_instance.sh`, clean | `just vv` | **0**, 670 s | `vv: the acceptance gate passed`; ceiling message identical | `logs/sm01-nested-vv-run2-script-built.log` |

Receipts, unedited, in `receipts/eligibility/`:

| Identity | Value |
| --- | --- |
| Attestation id, and SHA-256 of `manifest.json` | `7bed00d0e9c306489ad1b57e9c46ade9cd3d681b7b34e805b197de2c5e7ec4a0` |
| `.holo` SHA-256 | `4092fea915c0c718c668be332c076c75d8593836e2a055e604b4772026ee6962` |
| `archive_fingerprint` | `b5d8011b76c20ac654962dc38914d7002d1c8f4d1e13649218f94ef1003d6ce9` |
| Acceptance | `status: verified`, `regeneration: byte-identical`, 12 modeled vectors |
| `eligible_decides` | observed axioms `[propext]`, equal to its declared policy |

The standalone offline verify and both nested complete-gate runs produced the same attestation id, the same `.holo` bytes, and byte-identical `manifest.json` and `lexlean-attestation.json`. The second nested run started from an instance rebuilt from the pinned template and `prism-overlay/` by the committed script, so the comparison covers the reconstruction as well. In both nested runs `audit-prism` printed `installed here; the parent ran no ratchet, so this commit sets the ceiling: 13501 lines in 78 files`.

### Adversarial controls on the candidate

| Planted defect | Command | Exit | Diagnostic | Log |
| --- | --- | --- | --- | --- |
| `eligible` no longer checks rights | `prismpm --project eligibility verify` | 1 | `PP5001`, Lean `unsolved goals` | `logs/el-nc1-rights-check-dropped.log` |
| Vector claims rights code `2` is `eligible` | same | 1 | `PP5301 … disagrees with a modeled vector` | `logs/el-nc2-prohibited-rights-claimed-eligible.log` |
| An axiom not declared | same | 1 | `LLV7005` | `logs/el-verify-1.log` (this happened unplanned) |
| Capability added after installation | `just model` | 1 | `audit-prism` refusal | `logs/el-model-after-commit.log` |

Independent runtime, `prism-code 0.9.5`: `12 of 12 vectors passed (holo, Skill Mason eligibility, identities verified)`; `check` reports `P0 unverified`. Requests outside the vector set, dispatched with `prism-code run … --allow-unverified`: `01010102` gave `refused: OUTCOME_UNCOVERED`, `02020202` gave all four reasons, `abcd` gave all four reasons, `abc` gave `invalid request`, `01010101` gave `eligible`.

## 7. Network and inference

- Hosts contacted during gate runs: `ghcr.io`, `pkg-containers.githubusercontent.com` (image pull), `static.crates.io` and `index.crates.io` (crates), `github.com` (RustSec advisory database).
- `pkg-containers.githubusercontent.com` was first refused by the environment's network policy; the owner approved adding that one host.
- No hosted verifier was used. `prism-code` was only ever given local `.holo` files. `mcp.uor.foundation` was never contacted.
- The gate invokes no model API. The stages that passed with `--network none` could not have made one: `just app` for the reference application, and `prismpm verify` for the candidate. That is the whole basis for a zero-inference statement here, and it covers only the build-and-prove path. This qualification work itself was performed by a language model, and any host that later reads a generated skill spends inference tokens.

## 8. Not established

- That any input code is true. The proof is about four bytes.
- Independent proof-level verification: every artifact is `P0 unverified`.
- Cross-machine or cross-architecture reproducibility. `linux/arm64` was not run.
- That the SDK is fit for production. Upstream states 0.4.0 is not an accepted production release.
- Routes B and C.
- LexLean's specification was not read in this run; every construct used has a precedent in the template's own model.
- Native Qortara checks, including how they treat a second `AGENTS.md` under `prism/`: `NOT_RUN`.
- Session-start discovery of the skills on a branch that already contains them.
- Anything about generated skill bytes or a consuming host.

## 9. Deviations and discarded runs

- The first gate attempts failed before reaching the gate: the wrapper lacked upstream's `--user` flag, then the image's entrypoint turned out to run as uid 1000 regardless. The wrapper now runs as uid 1000 on a checkout it owns. No gate content was changed.
- Runs 1 and 2 of section 4 and the controls used a scratch copy of the wrapper. `scripts/prism_reference_gate.sh` is that wrapper with the proxy CA and mount made configurable; it was used for section 4 run 3 and everything in sections 5 and 6.
- One offline `just app` run was discarded. It shared a scratch `/tmp` with other containers started at the same time and failed with `PP5008 … custody absent or changed after generation`. The same command passed when run alone. The discarded log is not included.
- The first `scripts/prism_instance.sh` used `git apply`, which silently skipped the patch inside a nested repository. Comparing its output tree with the instance under test caught it; the script now uses `patch` and verifies each hunk.
- Image pull logs are not included because they contain short-lived signed URLs.

## 10. Reproduce

See [`prism-overlay/README.md`](../../../prism-overlay/README.md). Expect about 25 GB of disk, six minutes per reference gate run and eleven per run with the candidate, on four cores.
