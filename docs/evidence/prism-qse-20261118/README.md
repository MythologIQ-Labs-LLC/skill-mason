# Qortara Skills Eligibility: qualification record, 2026-11-18

**What this is:** what was run for the Prism application **Qortara Skills Eligibility** (first capability `SM-01`), where, the unedited outputs, and what they do and do not establish. It is evidence for the owner's decisions. It is not a decision, an approval or a release.

**State it leaves:** the application passed the complete gate in a *staged* nested instance and produced a real holo that returns the modeled decisions. `prism/` is **NOT_INSTALLED** in this repository, the SDK image is not an accepted trust root, and the holo is `P0 unverified check_exit=1`.

**Performed by:** Claude Code. It wrote the scripts and this record in a cloud session that holds credentials, so nothing was executed there: every SDK command and every real-holo run happened on GitHub-hosted runners through [`prism-native-gate.yml`](../../../.github/workflows/prism-native-gate.yml). No human ran or observed the commands. The owner reviewed the work on [PR #15](https://github.com/MythologIQ-Labs-LLC/skill-mason/pull/15) while it ran, and that review's findings changed it; they are recorded in section 6.

**The subject revision is not the revision this record is in.** A run's evidence can only be committed after the run, so this record sits one or more commits after the revision it describes. Those later commits add evidence files, this record and documentation, and merge `main`. The run for the head that contains this record is reported on the pull request, not here.

**Unedited runner output:** [`../prism-native-gate-runs/`](../prism-native-gate-runs/), one directory per workflow run, committed by the workflow's own publish job with a `SHA256SUMS` over every file. Values in this record are copied from those files by script. [`tests/test_prism_native_gate_evidence.py`](../../../tests/test_prism_native_gate_evidence.py) checks the files against their checksums and each other, and checks this record against them.

Committed runs:

- `44223605441-1`: baseline-anchored ratchet controls absent. Subject revision `5fbd8ce30e17ade819d76eb7d29acc3cbb3a5f93`; an earlier complete run, kept for comparison. [Files](../prism-native-gate-runs/44223605441-1/).
- `44230700283-1`: baseline-anchored ratchet controls present. Subject revision `fa521f0e10807195f26db183d64ebf552eabeb60`; the run this record's tables are copied from. [Files](../prism-native-gate-runs/44230700283-1/).

## Result

| Gate | Result |
| --- | --- |
| Isolated execution of the SDK image ([issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)) | **Executed.** GitHub-hosted runner, no secret, no token permission, no Docker socket, staged copy, allowlisted egress. 12 of 12 unsafe conditions refused before any container started |
| Upstream reference application, complete `just vv` | **PASS**, exit 0, without the Docker socket |
| Qortara Skills Eligibility, complete unreduced `just vv` in a nested instance | **PASS**, exit 0, `vv: the acceptance gate passed` |
| Offline repeat of the application stage | **PASS**: same holo, same attestation id |
| Planted defects in the model, vectors, policy files and generated files | **All refused** by the gate that owns each claim, with the expected diagnostic |
| Shrink-only ratchet for the nested instance | **Inert in the template when nested** (found here). **Enforced by a companion gate** that runs the template's own audit; the defects planted under `prism/` were refused. Multi-commit bypasses (laundering, move-then-restore) are refused when measured against the accepted baseline |
| Real holo through `prism-code`, the SM-01 probe and the local CLI | **PASS**: 12 of 12 fixtures returned the modeled response from the guest |
| Independent proof-level verification of the artifact | **Not established: `P0 unverified check_exit=1`.** The SDK at this pin writes nothing that could be signed (section 8) |
| `prism/` installed in this repository | **NOT_INSTALLED.** Blocked on the owner's remaining decisions in [ADR-0003](../../adr/0003-prism-application-adoption.md) |
| SDK image as a trust root | **Not accepted.** The image ran as a development candidate on throwaway runners |
| Native Qortara checks | `NOT_RUN` |

## 1. Identities

| Item | Value | Source in the run |
| --- | --- | --- |
| Workflow run | `44230700283`, attempt `1`, event `pull_request` | `nested/run.txt` |
| Subject revision | `fa521f0e10807195f26db183d64ebf552eabeb60` | `nested/run.txt` |
| Runner | github-hosted Linux X64 image=ubuntu24 20261111.370.1; kernel `Linux 7.0.0-1017-azure arch=x86_64 cpus=4`; Docker `28.0.4` | `nested/run.txt`, `nested/out/identities.txt` |
| Template | `UOR-Foundation/template@b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b` | anonymous clone on the runner |
| SDK image | `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3` | from the template's `prismpm.lock` |
| Image as pulled | `repo_digests=["ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3"] id=sha256:b707da3d9e220d9a9bacce9efa7015f32e6671c26bf08985f0912679e805e4fd size=15173314776 platform=linux/amd64` | `nested/sdk-image.txt` |
| Tool in the image | `prismpm 0.4.0` | `nested/logs/tool-versions.log` |
| Tool in the image | `lexlean 0.4.0` | `nested/logs/tool-versions.log` |
| Tool in the image | `language 1.0` | `nested/logs/tool-versions.log` |
| Tool in the image | `compiler-semantics 07859acb5a756221018b7f65e7f725d99b00a694670eecc7cd264832ba1333fb` | `nested/logs/tool-versions.log` |
| Tool in the image | `lean-toolchain leanprover/lean4:v4.32.1` | `nested/logs/tool-versions.log` |
| Tool in the image | `Lean (version 4.32.1, x86_64-unknown-linux-gnu, commit f054605aea4b840552cca2e725580bffd1e1b704, Release)` | `nested/logs/tool-versions.log` |
| Tool in the image | `Lake version 5.0.0-src+f054605 (Lean version 4.32.1)` | `nested/logs/tool-versions.log` |
| Tool in the image | `rustc 1.97.1 (8bab26f4f 2026-07-14)` | `nested/logs/tool-versions.log` |
| Tool in the image | `cargo 1.97.1 (c980f4866 2026-06-30)` | `nested/logs/tool-versions.log` |
| Tool in the image | `just 1.57.0` | `nested/logs/tool-versions.log` |
| Tool in the image | `cargo-deny 0.20.2` | `nested/logs/tool-versions.log` |
| Tool in the image | `v22.23.2` | `nested/logs/tool-versions.log` |
| Staged root commit and tree | `c43cb44071b8c056071eb94749d2d5a11a3c6bf7`, `d98f0d383029c6bdd7050e1920a1ce523d4cf4f3` (subject tree `d98f0d383029c6bdd7050e1920a1ce523d4cf4f3`) | `nested/out/identities.txt` |
| Staged installing commit and tree | `3698ae92ef7cc7b633b169b8ff2c89781d2bd005`, `240c7346592d06b444ac32738aed3f3b0115d432` | same |
| Instance against the pin | template_files=201 identical_blobs=198 patched=['CONFORMANCE.md', 'Justfile', 'model/ids.toml'] added_by_overlay=32 | same |
| Root and nested `AGENTS.md` SHA-256 | `b2487038dd55bde3061868e980a067da6d541be4545e5b089c0daf2d26e73650`, `9a1fe3f73ab2963812c35976909c331292e1ca39ce47c0711ec1aafe8b869d87` | same |

The SDK image is published under a personal registry namespace. Its digest fixes its bytes. It says nothing about who published them or what they do. `prismpm.lock` declares `sdk_version` `0.3.0` and the binary reports `prismpm 0.4.0`; both are recorded and neither is a release identity. PrismPM's own `README.md` at the pin says 0.4.0 is not an accepted production release.

Upstream drift on 2026-11-18: the template and Prism-DevRel pins equal upstream `HEAD`; PrismPM, LexLean and `prism` have moved. They were not read or repinned. The executed toolchain is fixed by the template pin, which did not move. See [`.claude/PRISM_SOURCES.md`](../../../.claude/PRISM_SOURCES.md).

## 2. Runner and isolation

How the SDK image was run is described in [Running the native Prism gate on an isolated runner](../../technical/prism-native-gate.md). What the run's own files show:

- Each phase's `run.txt` records `docker_socket_bound_into_sdk_container=no token_permissions=none secrets=none`, and every SDK log's second line records `docker_socket=not-mounted` and `net=none` or `net=allowlist`.
- The job's first step fails if any variable name in the job environment looks like a credential. It passed. The user that starts the container has an empty home and an environment built with `env -i`.
- Facts recorded rather than hidden: on these runners uid 1000 is a pre-existing account, `packer`, a member of the `sudo`, `adm`, `lxd` and `docker` groups; and the runner user's home holds a `.docker/config.json`. The SDK container is given no path to either. The image's entrypoint runs as uid 1000 whatever is asked, so the staged copy has to belong to that uid.
- Before the gate, the wrapper was asked to run under each unsafe condition with the real Docker client. Each of the 12 was refused with exit 77 and its reason, and none left a gate log, which the wrapper writes immediately before `docker run`: a credential-like variable, a credential store, a symlinked checkout, a dirty tree, an unexpected SDK digest, the socket without its exact opt-in, the host network without its opt-in, a shared, missing or non-internal network, a reused work directory, and a work directory inside the source. The source tree was unchanged afterwards. Outputs are in `nested/logs/refusals/`.
- From inside the SDK container (`nested/logs/egress-control.log`): direct connections to `1.1.1.1:443`, the metadata address and the runner's own port 22 failed; the proxy answered `403 Forbidden` for `example.com:443` and `200 Connection Established` for `static.crates.io:443`.

The boundary is Docker's default confinement on a throwaway virtual machine, with no socket and no added privilege. It limits what the image can reach. It does not inspect what the image does with what it is given: the staged source and every build output are under the image's control, so a receipt it writes is evidence only as far as that toolchain is trusted.

## 3. Upstream reference application

The template's own application, pristine at the pin, through its unmodified `just vv` on the isolated runner: exit 0.

| Identity | This run | 2026-11-17, different machine |
| --- | --- | --- |
| Holo SHA-256 | `da1a5c9fea5180e13f2b25e91ce65a18bfb796e5245ff32272cf874f0ed8650e` | `da1a5c9fea5180e13f2b25e91ce65a18bfb796e5245ff32272cf874f0ed8650e` |
| `archive_fingerprint` | `9fdfcd05f039104c091eaef5aa5b9ba6499a49397bc1a06f467192bbcda91dfc` | `9fdfcd05f039104c091eaef5aa5b9ba6499a49397bc1a06f467192bbcda91dfc` |
| Attestation id | `271b467076164392817e28116e278d726a53d7c8e87f2ab19dc44f60584ac730` | `927392b7031ac862683e5f28bbaf11431a1049ed13e2158921fca329c6f1539f` |
| `build_id` | `fd83301a20d67557919e13b07819681fc36754d1d06361575051935bdf334c27` | (see the earlier receipts) |

The holo bytes and the archive fingerprint are the same as on 2026-11-17, on a different machine and under the earlier wrapper. The attestation id differs: it is the hash of `manifest.json`, which records machine-specific build detail. So the artifact reproduced across machines and the manifest did not. One pair of machines, one architecture.

This run also settles a question the earlier record left open: **the complete gate passes without the Docker socket.** Upstream's `bootstrap.yml` uses the socket for pre-checks outside `just vv` (Buildx, the image's two-platform manifest, the devcontainer CLI). Those were not run.

## 4. The artifact

| Identity | Value |
| --- | --- |
| Application name in the acceptance receipt | `Qortara Skills Eligibility` |
| Holo file | `'Qortara Skills Eligibility.holo'`, 17,346 bytes |
| **Holo SHA-256** | `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e` |
| **Attestation id** (printed by the gate; equals SHA-256 of `manifest.json`, recomputed) | `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518` |
| `archive_fingerprint` | `193438f420f8b0bb0533eed12bf105c5783c175bb6642e324002a4ee6a96fcaf` |
| `build_id` | `3bc366fa5354eb2b09cb30dbb3c3dd5d62ca9af82b3eaba968231c23f67419da` |
| `source_id` | `e8fb4f0112a2e3c39d4dccf8aafa36155b54ab343e16f4b48f9b284dc3c824a8` |
| `lexlean_attestation_id` | `941841fcded1aa16caf1d45191f18e51964afff93fe67678822e0e7f83b98bf2` |
| Acceptance | `prismpm/application-acceptance/1`, `status: verified`, `regeneration: byte-identical`, 12 modeled vectors |
| `eligible_decides` | observed axioms `['propext']`, declared `['propext']`; 11 project declarations, each `ok` with observed equal to declared |
| Model SHA-256 (`Eligibility.lex.tex`) | `533e9cec2e5f16f31f5855b5d90b0aca1605ded2d1687ad55fe770b714cb181d` |
| `lexlean.lock` SHA-256 | `13c955f54969713d6b937b03793eb0348d84431603f6a52273bc4e8b5840cb06` |

Files prismpm wrote into the verified directory (`nested/out/receipts/eligibility/verified-directory-listing.txt`):

```
d 4096 .
f 2645 ./application-acceptance.json
f 43200 ./lexlean-attestation.json
f 49640 ./manifest.json
```

The first table row matters: the application's name is part of the holo. The earlier candidate, `Skill Mason eligibility`, had holo SHA-256 `4092fea9…6962` and attestation `7bed00d0…c4a0`. Nothing recorded for it is evidence for this artifact.

`lexlean.lock` was written by `lexlean lock` in the SDK image on the runner and committed unchanged. The run before it refused the stale lock in 8 seconds with `LLC0102: lexlean.lock is stale or noncanonical` ([run 44216086799](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216086799)), which is the red before the green for the rename. The `author` phase of this run reports zero drift between the committed files and what the tools write.

## 5. Every step of the nested phase

The throwaway repository's first commit is the whole subject revision of this repository, and its tree hash equals the subject's. The second commit adds `prism/` from the pinned template and [`prism-overlay/`](../../../prism-overlay/README.md). All 201 template files reached that commit; 198 have the pin's blob and three are the ones the overlay patches. The seven universal policy files are byte-identical to the pin as committed.

| Step | Network | Expected | Exit | Result | Seconds |
| --- | --- | --- | --- | --- | --- |
| `tool-versions` | none | exit 0 | 0 | **PASS** | 8 |
| `pre-canonical` | none | exit 0 | 0 | **PASS** | 7 |
| `refuse-credential-variable` | none | exit 77: credential-like variables are set (FAKE_SERVICE_API_TOKEN) | 77 | **PASS** |  |
| `refuse-credential-store` | none | exit 77: credential store | 77 | **PASS** |  |
| `refuse-symlinked-checkout` | none | exit 77: passes through a symlink | 77 | **PASS** |  |
| `refuse-dirty-tree` | none | exit 77: is not clean | 77 | **PASS** |  |
| `refuse-unexpected-sdk-digest` | none | exit 77: not the expected | 77 | **PASS** |  |
| `refuse-socket-without-exact-opt-in` | none | exit 77: accepts only 'disposable-daemon' | 77 | **PASS** |  |
| `refuse-host-network-without-opt-in` | host | exit 77: unfiltered and unlogged | 77 | **PASS** |  |
| `refuse-shared-network` | allowlist | exit 77: dedicated internal network | 77 | **PASS** |  |
| `refuse-missing-network` | allowlist | exit 77: does not exist | 77 | **PASS** |  |
| `refuse-network-not-internal` | allowlist | exit 77: is not internal | 77 | **PASS** |  |
| `refuse-existing-workdir` | none | exit 77: already exists | 77 | **PASS** |  |
| `refuse-workdir-inside-source` | none | exit 77: outside the source repository | 77 | **PASS** |  |
| `refusals-left-the-source-untouched` | - | clean tree | 0 | **PASS** |  |
| `egress-control` | allowlist | exit 0 | 0 | **PASS** | 13 |
| `sm01-vv` | allowlist | exit 0 | 0 | **PASS** | 793 |
| `sm01-eligibility-offline` | none | exit 0 | 0 | **PASS** | 364 |
| `repeat-identical` | none | same holo and attestation | 0 | **PASS** |  |
| `nc-policy-drift` | allowlist | refusal: PP1101: template policy path changed: AGENTS\.md | 2 | **PASS** | 4 |
| `nc-lock-tamper` | allowlist | refusal: PP5401 | 4 | **PASS** | 5 |
| `nc-stale-conformance` | allowlist | refusal: CONFORMANCE\.md is stale | 1 | **PASS** | 12 |
| `nc-ratchet-root-layout` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 12 |
| `obs-nested-test-added-after-install` | allowlist | recorded, not judged | 0 | **OBSERVED** | 11 |
| `obs-root-file-added-after-install` | allowlist | recorded, not judged | 0 | **OBSERVED** | 11 |
| `ratchet-installing-commit` | allowlist | exit 0: audit-prism: a root commit; non-Prism implementation is [0-9]+ lines in [0-9]+ files | 0 | **PASS** | 11 |
| `ratchet-engaged-uncounted-change` | allowlist | exit 0: files in the parent\); it only shrinks | 0 | **PASS** | 11 |
| `nc-nested-ratchet-new-file` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 11 |
| `nc-nested-ratchet-growth` | allowlist | refusal: non-Prism implementation grew by | 1 | **PASS** | 11 |
| `obs-first-parent-comparison-misses-the-launder` | allowlist | recorded, not judged | 0 | **OBSERVED** | 11 |
| `nc-nested-ratchet-two-commit-launder` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 11 |
| `obs-first-parent-comparison-resets-the-ceiling` | allowlist | recorded, not judged | 0 | **OBSERVED** | 12 |
| `nc-nested-ratchet-move-then-restore` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 12 |
| `nc-nested-ratchet-ignores-justfile` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 12 |
| `nc-nested-ratchet-ignores-tampered-root-gate` | allowlist | refusal: new non-Prism file | 1 | **PASS** | 12 |
| `refuse-ratchet-instance-moved` | - | exit 77: moved or removed | 77 | **PASS** |  |
| `refuse-ratchet-audit-altered` | - | exit 77: prism/xtask/src/audit.rs differs from the template pin | 77 | **PASS** |  |
| `refuse-ratchet-audit-dependency-altered` | - | exit 77: prism/crates/model/src/lib.rs differs from the template pin | 77 | **PASS** |  |
| `refuse-ratchet-build-script-added` | - | exit 77: holds files the template pin does not | 77 | **PASS** |  |
| `refuse-ratchet-baseline-not-ancestor` | - | exit 77: is not an ancestor of the candidate | 77 | **PASS** |  |
| `nc-evidence-check-dropped` | allowlist | refusal: PP5001\|unsolved goals | 1 | **PASS** | 13 |
| `nc-rights-check-dropped` | allowlist | refusal: PP5001\|unsolved goals | 1 | **PASS** | 14 |
| `nc-authority-check-dropped` | allowlist | refusal: PP5001\|unsolved goals | 1 | **PASS** | 14 |
| `nc-coverage-check-dropped` | allowlist | refusal: PP5001\|unsolved goals | 1 | **PASS** | 14 |
| `nc-admits-code-two` | allowlist | refusal: PP5001\|unsolved goals\|PP5301\|disagrees with a modeled vector | 1 | **PASS** | 14 |
| `nc-vector-prohibited-rights-eligible` | allowlist | refusal: PP5301\|disagrees with a modeled vector | 1 | **PASS** | 281 |
| `nc-five-byte-request-accepted` | allowlist | refusal: PP5301\|disagrees with a modeled vector | 1 | **PASS** | 280 |
| `nc-undeclared-axiom` | allowlist | refusal: LLV7005 | 1 | **PASS** | 101 |
| `nc-reason-renamed` | allowlist | refusal: must be named RIGHTS_UNRESOLVED | 101 | **PASS** | 10 |

Phase `reference`:

| Step | Network | Exit | Result | Seconds |
| --- | --- | --- | --- | --- |
| `tool-versions` | none | 0 | **PASS** | 6 |
| `ref-vv` | allowlist | 0 | **PASS** | 408 |

Phase `author`:

| Step | Network | Exit | Result | Seconds |
| --- | --- | --- | --- | --- |
| `author-regenerate` | none | 0 | **PASS** | 11 |

`audit-prism` in the complete gate printed `installed here; the parent ran no ratchet, so this commit sets the ceiling: 13501 lines in 78 files`, the same count as on 2026-11-17.

## 6. Planted defects, and what one of them found

Each defect is one commit on its own branch from the installing commit, run against the gate that owns the claim. A control passes only when the command exits non-zero **and** its log carries the diagnostic that names the defect.

| Control | Command | Exit | Diagnostics found in its log |
| --- | --- | --- | --- |
| `nc-policy-drift` | `prismpm template check` | 2 | `PP1101: template policy path changed: AGENTS.md` |
| `nc-lock-tamper` | `prismpm lock check` | 4 | `PP5401` |
| `nc-stale-conformance` | `just model` | 1 | `CONFORMANCE.md is stale` |
| `nc-ratchet-root-layout` | `just model` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-nested-ratchet-new-file` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-nested-ratchet-growth` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `non-Prism implementation grew by`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-nested-ratchet-two-commit-launder` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here` |
| `nc-nested-ratchet-move-then-restore` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-nested-ratchet-ignores-justfile` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-nested-ratchet-ignores-tampered-root-gate` | `cargo run -q --locked -p xtask -- audit-prism` | 1 | `new non-Prism file`, `audit-prism: only Prism may be implemented here`, `grew by` |
| `nc-evidence-check-dropped` | `prismpm --project eligibility verify` | 1 | `PP5001`, `unsolved goals` |
| `nc-rights-check-dropped` | `prismpm --project eligibility verify` | 1 | `PP5001`, `unsolved goals` |
| `nc-authority-check-dropped` | `prismpm --project eligibility verify` | 1 | `PP5001`, `unsolved goals` |
| `nc-coverage-check-dropped` | `prismpm --project eligibility verify` | 1 | `PP5001`, `unsolved goals` |
| `nc-admits-code-two` | `prismpm --project eligibility verify` | 1 | `PP5001`, `unsolved goals` |
| `nc-vector-prohibited-rights-eligible` | `prismpm --project eligibility verify` | 1 | `PP5301`, `disagrees with a modeled vector` |
| `nc-five-byte-request-accepted` | `prismpm --project eligibility verify` | 1 | `PP5301`, `disagrees with a modeled vector` |
| `nc-undeclared-axiom` | `prismpm --project eligibility verify` | 1 | `LLV7005` |
| `nc-reason-renamed` | `cargo test --locked -p repo-conformance --test eligibility` | 101 | `must be named RIGHTS_UNRESOLVED` |

The four `…-check-dropped` controls remove one fact each from the decision function while the proposition still requires it; Lean refuses each with unsolved goals. `nc-admits-code-two` admits an undefined code. The two vector controls contradict the model with a vector and with a changed request length. `nc-reason-renamed` renames a refusal reason consistently in the model and its vectors, which would still verify; only the conformance test that binds the claim refuses it.

### The ratchet finding

The template's `audit-prism` refuses new hand-written files and net growth in hand-written lines. The first complete run, [44217491838](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44217491838) at `021011a`, planted a hand-written test file in a commit after installation and expected a refusal. The gate accepted it. That run was red for that one row and is not committed here; its job log is the record of it.

The cause is in the template at the pin, `xtask/src/audit.rs`, function `audit`: it decides whether the parent commit ran the ratchet by reading `xtask/src/audit.rs` from the parent at that path from the repository root. In a nested instance the file is at `prism/xtask/src/audit.rs`, the lookup misses, and every commit is treated as the installing one. **Left to itself, the template's ratchet never engages under `prism/`.** The earlier record and ADR-0003 had observed the ratchet in a root-level instance and assumed it for the nested one.

- `audit-prism: installed here; the parent ran no ratchet, so this commit sets the ceiling: 13501 lines in 78 files`
- `repeat offline: holo_sha256 and attestation id identical (9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e, cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518)`
- `observation obs-nested-test-added-after-install: just model exit=0; audit-prism: installed here; the parent ran no ratchet, so this commit sets the ceiling: 13503 lines in 79 files`
- `observation obs-root-file-added-after-install: just model exit=0; audit-prism: installed here; the parent ran no ratchet, so this commit sets the ceiling: 13501 lines in 78 files`
- `observation obs-first-parent-comparison-misses-the-launder: exit=0; GATE_EXIT=0 image=ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3 net=allowlist elapsed=11s cmd=cargo run -q --locked -p xtask -- audit-prism`
- `observation obs-first-parent-comparison-resets-the-ceiling: exit=0; GATE_EXIT=0 image=ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3 net=allowlist elapsed=12s cmd=cargo run -q --locked -p xtask -- audit-prism`

The owner ruled on PR #15 that recording the gap was not enough: the ratchet has to be enforced for the nested instance itself. [`scripts/prism_nested_ratchet.sh`](../../../scripts/prism_nested_ratchet.sh) does that without reimplementing the measure. It projects the nested instance to a repository root and runs the template's own unmodified `audit-prism` there. In this run, the audit:

- passed the installing commit: `audit-prism: a root commit; non-Prism implementation is 13501 lines in 78 files`;
- passed a later documentation-only commit with `(13501 lines, 78 files in the parent); it only shrinks`, the message it prints only when it compared against a gated parent;
- refused a hand-written test added under `prism/`: `1 new non-Prism file(s): crates/conformance/tests/added_later.rs` and `grew by 2 lines (13501 to 13503)`;
- refused an existing test grown by four lines: `grew by 4 lines (13501 to 13505)`;
- refused the same added file when `model` had been removed from the instance's `vv` recipe.

The companion refused, before any audit ran, an instance moved to another directory and an edit to the audit's own gate marker.

**Measured against a named baseline, not a first parent.** The owner's second review found that comparing a commit only with its first parent can be defeated with two commits. The companion therefore takes an accepted baseline from its caller, refuses one that is not an ancestor, and pins everything the audit binary is built from, not only `xtask`. In this run, with the installing commit as the baseline, the template's audit gave these answers for the same final commits:

| Two-commit case | Against the commit's first parent (recorded, not judged) | Against the accepted baseline (the control) |
| --- | --- | --- |
| **Laundering.** A adds a hand-written test; B keeps it and deletes an unrelated hand-written script | **Accepted**, exit 0: `non-Prism implementation is 13388 lines in 78 files (13503 lines, 79 files in the parent); it only shrinks` | **Refused**, exit 1: `1 new non-Prism file(s): crates/conformance/tests/added_later.rs` |
| **Move, then restore.** A moves the instance away; B moves it back with a new hand-written test | **Accepted**, exit 0, as a fresh install: `RATCHET_STATE=installing`, `audit-prism: a root commit; non-Prism implementation is 13503 lines in 79 files` | **Refused**, exit 1: `1 new non-Prism file(s)` and `grew by 2 lines (13501 to 13503)` |

So both bypasses are real against a first-parent comparison and both are closed against a named baseline. Also in this run:

- **A gutted root gate.** A candidate that overwrote this repository's own copies of the companion, the driver and the workflow, and added a file, was still refused, because the companion that ran came from the trusted checkout and not from the tree under test.
- Refused before any audit ran, exit 77: a change to `crates/model`, which the audit links (`prism/crates/model/src/lib.rs differs from the template pin`); a build script added beside it (`holds files the template pin does not: crates/model/build.rs`); and a baseline that is not an ancestor of the candidate.

**What this does not show.** It is a rehearsal on a staged repository. It shows the mechanism. It does not show that this repository enforces it, because this repository has no `prism/`. Running the companion on every `prism/**` change, from a revision the candidate cannot edit and behind a required check, is an obligation of the installing change and partly a matter of repository settings only the owner can make ([ADR-0003](../../adr/0003-prism-application-adoption.md)).

## 7. Real holo outputs

On a second runner that never ran the SDK image, with `prism-code@0.9.5` installed from a tarball whose SHA-512 integrity was checked against the pinned value first, without lifecycle scripts. The expected digest was read from the gate's `manifest.json`, not computed from the holo.

| Check | Expected | Observed | Result |
| --- | --- | --- | --- |
| holo-matches-manifest | 9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e | 9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e | **PASS** |
| independent-vectors | exit 0, 12 of 12 vectors passed | exit 0, 12 of 12 vectors passed (holo, Qortara Skills Eligibility, identities verified) | **PASS** |
| independent-assurance-grade | recorded as observed | P0 unverified (check exit 1) | **PASS** |
| independent-inspect | exit 0 | exit 0 | **PASS** |
| tampered-holo-refused-by-runtime | non-zero, digest_mismatch | exit 1 | **PASS** |
| tampered-holo-refused-by-probe-digest | exit 2, DIGEST_MISMATCH | exit 2 | **PASS** |
| tampered-holo-not-run-without-override | exit 1, FIXTURE_FAIL, 0 passed | exit 1 | **PASS** |
| probe-twelve-fixtures | exit 0, 12 passed | exit 0, 12 passed | **PASS** |
| probe-refuses-without-allow-p0 | exit 2, ASSURANCE_HOLD | exit 2 | **PASS** |
| cli-status-preflight | exit 0, preflightReady true | exit 0 | **PASS** |
| cli-probe-twelve-fixtures | exit 0, 12 passed | exit 0, 12 passed | **PASS** |
| cli-evaluate-twelve-fixtures | exit 0, 12 PASS rows | exit 0, 12 PASS rows | **PASS** |
| cli-refuses-without-allow-p0 | exit 2, ASSURANCE_HOLD | exit 2 | **PASS** |
| cli-refuses-wrong-digest | exit 2, DIGEST_MISMATCH | exit 2 | **PASS** |

The local CLI, one `evaluate` call per request. The response column is what the Prism guest returned. The twelve fixtures are compared with the model's own vectors; the last five requests are outside the vector set and are recorded, not asserted.

| Fixture | Request | CLI exit | Guest status | Actual guest response | Result |
| --- | --- | --- | --- | --- | --- |
| `eligible` | `01010101` | 0 | GUEST_COMPLETED | `eligible` | PASS |
| `evidence` | `00010101` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED` | PASS |
| `rights` | `01000101` | 0 | GUEST_COMPLETED | `refused: RIGHTS_UNRESOLVED` | PASS |
| `prohibited-rights` | `01020101` | 0 | GUEST_COMPLETED | `refused: RIGHTS_UNRESOLVED` | PASS |
| `authority` | `01010001` | 0 | GUEST_COMPLETED | `refused: AUTHORITY_EXCEEDED` | PASS |
| `coverage` | `01010100` | 0 | GUEST_COMPLETED | `refused: OUTCOME_UNCOVERED` | PASS |
| `all-refused` | `00000000` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED` | PASS |
| `unknown-code` | `ff010101` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED` | PASS |
| `short` | `010101` | 0 | GUEST_COMPLETED | `invalid request` | PASS |
| `long` | `0101010101` | 0 | GUEST_COMPLETED | `invalid request` | PASS |
| `empty` | `(empty)` | 0 | GUEST_COMPLETED | `invalid request` | PASS |
| `allocation-boundary` | `0000000000000000...(512 bytes)` | 0 | GUEST_COMPLETED | `invalid request` | PASS |
| `off-vector-coverage-two` | `01010102` | 0 | GUEST_COMPLETED | `refused: OUTCOME_UNCOVERED` | RECORDED |
| `off-vector-all-two` | `02020202` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED` | RECORDED |
| `off-vector-ascii-abcd` | `61626364` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED` | RECORDED |
| `off-vector-ascii-abc` | `616263` | 0 | GUEST_COMPLETED | `invalid request` | RECORDED |
| `off-vector-all-ff` | `ffffffff` | 0 | GUEST_COMPLETED | `refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED` | RECORDED |

No part of the probe, the CLI or the acceptance script decides eligibility. `tests/test_prism_native_gate_workflow.py` fails if the acceptance script so much as names a refusal reason.

## 8. Assurance: `P0 unverified check_exit=1`, and why it cannot be raised at these pins

`prism-code check` grades a holo from statements carried inside it, signed by a signer the caller names: provenance for P1, proof for P2, replay for P3. Its verdict on this holo, in full, is in `real-output/independent-prism-code.txt`:

```
FAILED  P0 unverified  policy default requires P2 or above
  provenance.statement (Verification, withholds P1)   The holo carries no provenance statement.
  proof.statement (ProofMismatch, withholds P2)       The holo carries no proof statement.
  replay.statement (Replay, withholds P3)             The holo carries no replay statement.
```

Whether that could be raised was tested rather than assumed (`real-output/assurance-experiment.txt`; network off, on a copy of the holo, with a key made and discarded on the runner, and adding no row to the results):

- The verified directory holds exactly three files: `application-acceptance.json`, `lexlean-attestation.json` and `manifest.json`. `prism-code attest --statement` signs "a whole statement such as the verified directory's proof-statement.json". There is no such file. `prismpm 0.4.0` at this pin does not write one.
- `prism-code inspect` reports `Attestations: none`.
- `prism-code attest --unsigned --key …` answered `signing_failed: the holo has no unsigned statement, and no statement was given`.
- Naming a key the holo was never signed with left the grade at P0.

So no compatible proof statement exists to sign, and a key made by the job that built the artifact would not be a trusted signer if one did. **The holo is `P0 unverified check_exit=1` and stays so until an SDK writes a proof statement, a signer the owner trusts signs it, and `prism-code check` under a stated policy reports P2.**

What was independently done at P0: `prism-code`, a separate implementation from `prismpm`, replayed all 12 acceptance vectors through the guest and verified the archive's footer, labels and cross-references, and refused a copy with one flipped byte (`digest_mismatch`). The accurate phrase is "vectors independently replayed, identities verified". It is not "independently verified".

### What the proof is about

Lean and leanchecker accepted `eligible_decides` with exactly the axiom it declares: for every request, `eligible request = true` exactly when the evidence, rights, authority and coverage codes each equal `1`. The conformance test fixes that the response is decided by that function, that one code is admitted, and that a request of any other length is invalid.

That is a statement about four bytes. It is not a statement about the world:

- It does not say a code is true. Nothing here checks that evidence exists or is current, that a rights determination is correct, that authority was granted, or that a method covers an outcome.
- It does not say who set a code. No asserting party is named for any of the four (ADR-0003, remaining decision 4). Until each is, with freshness and revocation tested, every input here is a **fixture** and `01010101` means "the fixture said yes", nothing more.
- It says nothing about generated skill text, a consuming host, or licence terms.

A correct decision over inputs nobody has vouched for is not a qualified eligibility result.

## 9. Repeatability

- Within the run: the application stage was repeated from a fresh staged copy with the network off, seeded only with the first run's crate cache. Same holo SHA-256, same attestation id.
- Across runs and machines: 2 committed runs on separate runner virtual machines, at different subject revisions with the same overlay, built the same holo bytes and the same attestation id: `44223605441-1` holo `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e` attestation `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518`; `44230700283-1` holo `9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e` attestation `cca7f46f31b909a22602505e3ccf3a6fbeb1ec0bc9a692c381bc7db2d0988518`. Run 44217491838 at `021011a` printed the same two values in its job log.
- The reference application's holo is byte-identical to the 2026-11-17 build on a different machine (section 3).
- Not shown: another architecture. `linux/arm64` was not run.

## 10. Network and inference

- `reference`: 1× `START 172.30.99.1:3128 allow=github.com,index.crates.io,static.crates.io`; 2× `CLOSED - no-request`; 1× `ALLOW static.crates.io:443`; 1× `ALLOW github.com:443`
- `author`: 1× `START 172.30.99.1:3128 allow=github.com,index.crates.io,static.crates.io`; 2× `CLOSED - no-request`
- `nested`: 1× `START 172.30.99.1:3128 allow=github.com,index.crates.io,static.crates.io`; 2× `CLOSED - no-request`; 1× `DENY example.com:443 not-on-allowlist`; 2× `ALLOW static.crates.io:443`; 1× `ALLOW github.com:443`

`CLOSED - no-request` lines are the workflow's own readiness probe of the proxy port. `index.crates.io` was allowed and never used. The image itself was pulled by the runner's daemon from `ghcr.io` and `pkg-containers.githubusercontent.com` before any container existed.

The complete gate is not hermetic: `just deny` reads the RustSec advisory database from `github.com` when it runs, so a pass is reproducible only together with that database's state at that moment.

No hosted verifier was used; `mcp.uor.foundation` is not on the allowlist and no request to it appears in any proxy log. The gate invokes no model API, and the stages that ran with `net=none` could not have. That covers the build-and-prove path only. This work was itself done by a language model, and any host that later reads a generated skill spends inference tokens.

## 11. Not established

- That any input code is true, or who asserts it. The four inputs are fixtures.
- Independent proof-level verification. `P0 unverified check_exit=1`.
- That the SDK is fit for production, or that its publisher is trusted. Upstream says 0.4.0 is not an accepted production release; the image's namespace is personal.
- Continuous enforcement of anything on this repository: `prism/` is NOT_INSTALLED.
- The template's `bootstrap.yml` pre-checks, which need the Docker socket, and `linux/arm64`.
- Isolation stronger than a container on a throwaway virtual machine.
- Native Qortara checks, including how they treat a second `AGENTS.md` under `prism/`: `NOT_RUN`.
- Anything about generated skills, source rights, the catalog, or a consuming host.

## 12. Runs that are not this record's evidence

| Run | Head | What happened |
| --- | --- | --- |
| [44215627807](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44215627807) | `c31e8fd` | Failed before any image was pulled: the gate user could not read the job's working directory |
| [44216086799](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44216086799) | `c5d95e5` | `author` wrote the lock; `nested` refused the stale lock with `LLC0102`, as intended |
| three runs at `595f455`, `1943435`, `375bdf9` | | Cancelled by the next push to the pull request, which restarts the workflow |
| none at `4fc2910` | | GitHub starts no pull-request workflow while the pull request conflicts with its base. `main` had moved; the next head merged it |
| [44217491838](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44217491838) | `021011a` | Gate passed; the nested ratchet control was accepted instead of refused (section 6). No real-holo job, no publication |

A root `.gitignore` rule, `package-lock.json`, would have kept `prism/package-lock.json` out of an installing commit. Staging the whole repository as the root found it before any run. The rules are now anchored to the root and the driver refuses when any instance file is ignored.

## 13. Reproduce

Only through the [isolated-runner workflow](../../technical/prism-native-gate.md). A pull request that touches the overlay or the gate scripts starts it. Do not run the SDK image, or a holo it built, on a machine that holds credentials; the wrapper refuses, and that refusal is the answer.
