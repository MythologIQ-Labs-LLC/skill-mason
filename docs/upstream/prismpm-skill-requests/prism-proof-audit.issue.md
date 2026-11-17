### Submitted by

AI agent

### Component

docs

### Problem

After `just vv` passes, an agent has to decide what it may claim. The pieces are all present but nothing ties them together for a downstream author:

- `prismpm verify` writes `application-acceptance.json` with `status: verified`, yet `prism-code check` grades the same holo `P0 unverified`, because it carries no embedded provenance, proof or replay statement. `prism-code vectors` passing is easy to misreport as "independently verified".
- The attestation id the gate prints is the SHA-256 of `manifest.json`, which makes it recomputable, but that is not stated where an auditor would look.
- `just deny` fetches the RustSec advisory database on each run, so the complete verdict depends on a mutable input, while `just app` passes with `--network none` on a warm cache.
- A negative control only counts if the refusal names the planted defect. The diagnostics to expect (`PP1101`, `PP5401`, `PP5001`, `PP5301`, `LLV7005`, `digest_mismatch`) are scattered.
- Two gate runs sharing one scratch `/tmp` corrupt each other and surface as `PP5008`, which reads like a model failure.

A skill that fixes the vocabulary and the order of an audit would make downstream claims about Prism applications more accurate.

Observed on 2026-11-17, `linux/amd64`, with `UOR-Foundation/template` at `b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b`, PrismPM docs at `d896ab59e287650aecbcf02b8e867121601fdde5`, the SDK image that template's `prismpm.lock` selects (`sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3`; `prismpm 0.4.0`, `lexlean 0.4.0`, Lean 4.32.1) and `prism-code 0.9.5` from npm.

### Proposed API or behavior

Add `skills/prism-proof-audit/SKILL.md` beside the existing `skills/prism/SKILL.md`, with this content. It is offered as a starting point: please correct anything that does not match the toolchain you intend to ship, and prefer your own wording for release status.

````markdown
---
name: prism-proof-audit
description: Run and audit a UOR template instance's complete acceptance gate and say exactly what was proved, replayed, repeated and independently checked. Use before any "verified", "Prism-built", "reproducible" or "zero-inference" claim, after every model or pin change, and whenever a Prism result is about to be cited in a pull request, design record, README or release note.
---

# Prism application proof and qualification

An audit reports evidence. It is not release authority.

Commands below are for the template route, observed in the SDK image that the template's `prismpm.lock` selects. Run `prism-source-gate` first. Do not run these commands against a `prism/spec.json` project, or the reverse.

## What each stage establishes

| Stage | Command | Establishes | Does not establish |
| --- | --- | --- | --- |
| Format | `just fmt-check` | Rust sources are formatted | anything about the model |
| Model register | `just model` | `CONFORMANCE.md` equals the register; R4, R5, bootstrap and shrink-only audits hold | that a claim is true |
| Template and lock | `prismpm template check`, `prismpm lock check` | universal files and the SDK inventory match their locks | that the SDK is a production release |
| Lint, tests | `just lint`, `just test` | Clippy clean; every ID has a scenario and a test; claim-binding tests hold | the proof itself |
| Dependencies | `just deny` | no advisory, licence, ban or source violation **against the advisory database fetched at that moment** | the same verdict tomorrow |
| Application | `just app`, which runs `prismpm --project app verify` | Lean and leanchecker accept every theorem with its declared axioms; the built guest replays every vector; regeneration is byte-identical | behaviour outside the modeled bounds, or anything about the outside world |
| Whole | `just vv` | all of the above, once each, in order | host behaviour, or the truth of any input |

`prismpm check` validates; `prismpm build` builds and makes no acceptance claim; only `prismpm verify` writes `prismpm/application-acceptance/1`. A passing subset is not the gate.

## Execution workflow

1. **Fix identity first.** Record your commit, each upstream pin, the SDK image digest from `prismpm.lock`, the platform, and `--version` output for `prismpm`, `lexlean`, `lean`, `lake`, `just`, `cargo` and `prism-code`. Record a lock field and a binary that disagree as a discrepancy.
2. **Run the template's own application first**, in a pristine checkout at the template pin, with the same `docker run` that `.github/workflows/bootstrap.yml` performs. Host facts that matter:
   - The image's entrypoint runs as uid 1000 whatever `--user` says, so the checkout must be writable by uid 1000.
   - A cold cache needs network: crates from `static.crates.io`, and the RustSec advisory database from `github.com` for `just deny`. Bind a persistent directory to the container's `/tmp` to keep the caches between runs.
   - For an instance nested in a larger repository, mount the enclosing repository so Git history is visible to the audits.
   - **Run one gate at a time per scratch directory.** Two concurrent runs sharing one `/tmp` corrupt each other; the symptom is `PP5008 … custody absent or changed after generation` on a run that passes alone. Discard such a run.

   Keep upstream's success separate from your own model's.
3. **Run the complete gate** for the model under audit and keep the full log with its exit status. Never reduce it to `cargo test`, a library import check or a mocked response. If a stage fails, report that stage and stop; do not rerun a later stage in isolation and call the gate green.
4. **Read the receipts, do not paraphrase them.** After a pass, `<project>/.prism/verified/<attestation-id>/` holds `application-acceptance.json`, `lexlean-attestation.json` and `manifest.json`. Check, and quote:
   - `status` is `verified` and `regeneration` is `byte-identical` in the acceptance;
   - the attestation id printed by the gate equals the SHA-256 of `manifest.json` (recompute it);
   - `modeled_vectors` equals the number of vectors in the model;
   - `lexlean-attestation.json` lists every declaration with its observed axioms, and binds the Lean, Lake and LexLean executables by SHA-256.
5. **Plant negative controls against the gate that owns each claim.** A control counts only when the refusal's diagnostic names the planted defect; an unrelated parse error is not a pass. Restore and confirm a clean tree after each.

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

   Add your application's own semantics: each refusal dimension, an out-of-range code and each malformed length, as vectors and as planted defects.
6. **Check the artifact with the separate implementation.** `prism-code` (npm) is a different program from `prismpm` (Rust). Run:
   ```bash
   prism-code vectors <app.holo>
   prism-code check <app.holo>
   prism-code inspect <app.holo>
   ```
   To probe requests that are not among the vectors, dispatch them through the same runtime:
   ```bash
   prism-code run <app.holo> "<input>" --rm --allow-unverified
   ```
   A shell cannot pass a NUL byte in an argument, so a request containing `0x00` must go in as a vector instead.

   `vectors` replays every acceptance vector through the guest and verifies archive identities. `check` grades the holo **P0 to P3** from statements carried *inside* it: provenance for P1, proof for P2, replay for P3, and the default policy requires P2. A holo with no embedded statements is **P0 unverified** even when its sidecar receipts say `verified`. Report the level you observed. "Independently verified" requires P2 or above; "vectors independently replayed, identities verified" is the accurate phrase for P0.
7. **Test repeatability properly.** Delete every generated output (`.prism-proof`, `<project>/.prism`, `<project>/.lexlean`, both `target` directories), rerun the complete gate, and compare the `.holo` SHA-256, the attestation id, `source_id`, `build_id` and the acceptance file. Name any field that legitimately varies, such as browser timing. Two runs on one machine show repeatability, not cross-machine reproducibility.
8. **Measure inference and network separately.** A run with `--network none` shows which stages need no network at all. Say what you measured: stages that passed offline, hosts contacted online, and that no hosted verifier was used. A zero-inference claim covers only the path you ran.
9. **Keep evidence unedited**, with the commands that produced it, at the revision it describes.

## Qualification report

Fill every row. `NOT_RUN` and `FAIL` are acceptable answers; a blank or an inferred pass is not.

| Item | Status and exact evidence |
| --- | --- |
| Source and SDK pins | full SHAs, image digest, tool versions, discrepancies |
| Template reference application | PASS / FAIL / NOT_RUN, command, exit status, attestation id |
| Your model and scenarios | IDs, model paths, test names, red-then-green record |
| Gate stages | each stage's own result, including what `audit-prism` printed about its ceiling |
| Lean proof and acceptance scope | the exact theorem statements and axioms, vector count |
| Negative controls | defect, command, diagnostic, restored |
| Independent artifact check | `prism-code` version, vectors result, assurance level P0 to P3 |
| Repeatability | which identities matched across clean runs, what varied |
| Network and inference | offline-passing stages, hosts contacted, hosted services used |
| Limits and blockers | what was not established |

Upstream's reference application passing shows the toolchain works at your pins. It proves nothing about your model. No substitute implementation makes an unavailable gate pass.
````

### Acceptance test

```text
$ sed -n '2p' skills/prism-proof-audit/SKILL.md
name: prism-proof-audit
$ grep -o 'PP[0-9]\{4\}' skills/prism-proof-audit/SKILL.md | sort -u | while read c; do grep -q "^## \`$c\`" ERRORS.md || echo "unregistered: $c"; done
$            # prints nothing: every PrismPM diagnostic the skill names is registered
$ grep -q 'P0 unverified' skills/prism-proof-audit/SKILL.md && echo ok
ok
```

### Current workaround

Running the template's reference application through `just vv`, planting each defect listed in `TEMPLATE-VERIFICATION.md` by hand, and comparing `prismpm` receipts with `prism-code check`, `vectors` and `inspect` output.

### Searched existing requests

- [ ] I searched /docs/requests.md and the open issues, and no existing request covers this.

The open and closed issues of this repository were searched on 2026-11-17 for skill, agent, audit, negative control, model-first, pin drift and `available_in`. The only related request found is #353 (closed), which shipped the existing `prism` skill; #718 covers the documentation side of the version boundary. The rendered `/docs/requests.md` page was not reachable from the submitting environment, so the box above is left for the person filing to tick after reading it.

---
_Generated by [Claude Code](https://claude.ai/code)_
