---
name: prism-proof-audit
description: Run and audit the selected Prism route's complete acceptance gate and say exactly what was proved, replayed, reproduced and independently checked. Use before any "verified", "Prism-built", "reproducible" or "zero-inference" claim, after every model or pin change, and whenever a Prism result is about to be cited in a PR, ADR, README or release note.
---

# Prism application proof and qualification

**Claude Code developer procedure only.** Not a Skill Mason output skill, not a `skillz` catalog item, and not a source of release authority. An audit reports evidence; the owner accepts.

## Preconditions

Run `prism-source-gate` and `prism-model-first`, and read `.claude/PRISM_COMPATIBILITY.md` for the selected route. Commands below are **route A** commands, observed in the SDK image that the template's `prismpm.lock` selects. For any other route, establish that route's own contract first; do not run these commands against a `prism/spec.json` project or the reverse.

## What each stage establishes

| Stage | Command | Establishes | Does not establish |
| --- | --- | --- | --- |
| Format | `just fmt-check` | Rust sources are formatted | anything about the model |
| Model register | `just model` | `CONFORMANCE.md` equals the register; R4, R5 and bootstrap audits hold | that a claim is true |
| Template and lock | `prismpm template check`, `prismpm lock check` | universal files and the SDK inventory match their locks | that the SDK is a production release |
| Lint, tests | `just lint`, `just test` | Clippy clean; every ID has a scenario and a test; claim-binding tests hold | the proof itself |
| Dependencies | `just deny` | no advisory, licence, ban or source violation **against the advisory database fetched at that moment** | the same verdict tomorrow |
| Application | `just app`, which runs `prismpm --project app verify` | Lean and leanchecker accept every theorem with its declared axioms; the built guest replays every vector; regeneration is byte-identical | behaviour for inputs outside the modeled bounds, or anything about the outside world |
| Whole | `just vv` | all of the above, once each, in order | host behaviour, licence truth, source authenticity |

`prismpm check` validates; `prismpm build` builds and makes no acceptance claim; only `prismpm verify` writes `prismpm/application-acceptance/1`. A passing subset is not the gate.

## Execution workflow

1. **Fix identity first.** Record the Skill Mason commit, each upstream pin, the SDK image digest from `prismpm.lock`, platform, and `--version` output for `prismpm`, `lexlean`, `lean`, `lake`, `just`, `cargo` and `prism-code`. Record a lock field and a binary that disagree as a discrepancy.
2. **Check the runner before anything runs.** The SDK image comes from a personal registry namespace, and a digest fixes its bytes, not its publisher or its behaviour. Run it only on a disposable, credential-free, isolated machine with its own Docker daemon ([issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9)). Never run it in a session or on a workstation that holds tokens, keys or logins, and never hand it a Docker socket you would mind losing: the socket is root on that machine. If no such runner exists, the native gate is `HOLD`. Report that; do not look for a way around it.
3. **Run the reference application first**, from a clean checkout at the template pin:
   ```bash
   PRISM_GATE_WORKDIR=<fresh-dir> scripts/prism_reference_gate.sh <checkout> host <logfile>
   ```
   The wrapper stages a throwaway copy identified by commit and tree hash, never mounts or chowns the source, and refuses before starting a container when the runner holds credentials, the path is symlinked, the tree is not clean, the lock selects an unexpected image, or the work directory exists. Facts that matter:
   - The image's entrypoint runs as uid 1000 whatever `--user` says; the wrapper gives the staged copy to that uid.
   - A cold cache needs network: crates from `static.crates.io`, and the RustSec advisory database from `github.com` for `just deny`. To run a stage with `none`, pass an earlier run's `<workdir>/tmp` as `PRISM_GATE_SEED_TMP`; it is copied in, not shared.
   - Point the wrapper at a nested instance's directory and it stages the whole enclosing repository, so Git history is visible to the audits.
   - The socket is not bound by default. The recorded runs all had it; whether the complete gate passes without it is `NOT_RUN`. If a stage needs it, record that as a finding. `PRISM_GATE_DOCKER_SOCKET=disposable-daemon` is the explicit opt-in.
   - **Run one gate at a time per scratch directory.** Two runs sharing one `/tmp` corrupt each other; the symptom observed was `PP5008 … custody absent or changed after generation` on a run that passes alone. Separate work directories prevent it. Discard such a run; do not report it as a failure of the model.

   Keep upstream success separate from any Skill Mason model's success.
4. **Run the complete gate** for the model under audit and keep the full log with its exit status. Never reduce it to `cargo test`, a library import check or a mocked response. If a stage fails, report that stage and stop; do not rerun a later stage in isolation and call the gate green.
5. **Read the receipts, do not paraphrase them.** After a pass, `<project>/.prism/verified/<attestation-id>/` holds `application-acceptance.json`, `lexlean-attestation.json` and `manifest.json`. Check, and quote:
   - `status` is `verified` and `regeneration` is `byte-identical` in the acceptance;
   - the attestation id printed by the gate equals the SHA-256 of `manifest.json` (recompute it);
   - `modeled_vectors` equals the number of vectors in the model;
   - `lexlean-attestation.json` lists every declaration with its observed axioms, and binds the Lean, Lake and LexLean executables by SHA-256.
6. **Plant negative controls against the gate that owns each claim.** A control counts only when the refusal's diagnostic names the planted defect; an unrelated parse error is not a pass. Restore and confirm a clean tree after each.

   | Planted defect | Run | Expected refusal |
   | --- | --- | --- |
   | One byte added to a universal file | `prismpm template check` | `PP1101: template policy path changed: <path>` |
   | One inventory digest changed in `prismpm.lock` | `prismpm lock check`, `prismpm template check` | `PP5401` |
   | Generated `CONFORMANCE.md` edited | `just model` | `CONFORMANCE.md is stale` |
   | Decision function weakened, proposition left alone | `prismpm --project <dir> verify` | `PP5001`, Lean `unsolved goals` |
   | An acceptance vector's response changed | `prismpm --project <dir> verify` | `PP5301`, execution disagrees with a modeled vector |
   | A declared axiom removed | `prismpm --project <dir> verify` | `LLV7005`, axiom policy violated |
   | One byte flipped in the `.holo` | `prism-code vectors <holo>` | `digest_mismatch`, the holo was altered |
   | A conformance test added in a commit after installation | `just model` | `audit-prism`: `1 new non-Prism file(s)`, `grew by N lines` |

   For a Skill Mason decision, add its own semantics: each refusal dimension, an out-of-range code, and each malformed length, as vectors and as planted defects.
7. **Check the artifact with the separate implementation.** `prism-code` (npm) is a different program from `prismpm` (Rust). Run:
   ```bash
   prism-code vectors <app.holo>
   prism-code check <app.holo>
   prism-code inspect <app.holo>
   ```
   To probe requests that are not among the vectors, dispatch them through the same independent runtime:
   ```bash
   prism-code run <app.holo> "<input>" --rm --allow-unverified
   ```
   `--allow-unverified` is needed only because the holo is P0; say so when you report the result. A shell cannot pass a NUL byte in an argument, so a request containing `0x00` must go in as a vector instead.

   `vectors` replays every acceptance vector through the guest and verifies archive identities. `check` grades the holo **P0 to P3** from statements carried *inside* it: provenance for P1, proof for P2, replay for P3, and the default policy requires P2. A holo with no embedded statements is **P0 unverified** even when its sidecar receipts say `verified`. Report the level you observed. "Independently verified" requires P2 or above; "vectors independently replayed, identities verified" is the accurate phrase for P0.
8. **Test repeatability properly.** Delete every generated output (`.prism-proof`, `<project>/.prism`, `<project>/.lexlean`, both `target` directories), rerun the complete gate, and compare the `.holo` SHA-256, the attestation id, `source_id`, `build_id` and the acceptance file. Name any field that legitimately varies, such as browser timing. Two runs on one machine show repeatability here, not cross-machine reproducibility. A stronger variant rebuilds the whole instance from pinned inputs with `scripts/prism_instance.sh` before the second run, so the comparison also covers the reconstruction.
9. **Measure inference and network separately.** A run with `--network none` shows which stages need no network at all. The gate invokes no model API, but say what you measured: stages that passed offline, hosts contacted online, and that no hosted verifier was used. A zero-inference claim covers only the path you ran, and never the downstream host that later reads a generated skill.
10. **Keep evidence where it belongs.** Put logs and receipts, unedited, under `docs/evidence/<name>/` with the commands that produced them. Never write to `.qortara/shadow.jsonl` or `ledger.jsonl` by hand; the Qortara runtime owns those.

## Qualification report

Fill every row. `NOT_RUN` and `FAIL` are acceptable answers; a blank or an inferred pass is not.

| Item | Status and exact evidence |
| --- | --- |
| Source and SDK pins | full SHAs, image digest, tool versions, discrepancies |
| Upstream reference application | PASS / FAIL / NOT_RUN, command, exit status, attestation id |
| Skill Mason model and scenarios | IDs, model paths, test names, red-then-green record |
| Gate stages | each stage's own result, including what `audit-prism` printed about its ceiling |
| Lean proof and acceptance scope | the exact theorem statements and axioms, vector count |
| Negative controls | defect, command, diagnostic, restored |
| Independent artifact check | `prism-code` version, vectors result, assurance level P0 to P3 |
| Repeatability | which identities matched across clean runs, what varied |
| Runner isolation | disposable, credential-free, own daemon; whether the socket was bound; `HOLD` if not met |
| Network and inference | offline-passing stages, hosts contacted, hosted services used |
| Limits and blockers | what was not established, with follow-on issues |

**HOLD** merge, release, `Prism-built` and `zero-token generator` claims until the selected route's complete gate has passed for the Skill Mason model itself and the owner has accepted the adoption decision. Upstream's reference passing shows the toolchain works; it proves nothing about a Skill Mason decision. No substitute implementation makes an unavailable gate pass.
