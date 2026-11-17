# ADR-0003: Adopting a verified Prism application without replacing Qortara governance

**Status:** **Accepted, architecture direction only (option A)** by project owner in conversation on 2026-11-17. The accepted location is a nested `prism/` application preserving root Qortara governance. **Implementation NOT_INSTALLED; Prism application qualification NOT_RUN in this repository; no SDK trust-root acceptance, security exception or production approval is implied.** This records the owner-directed decision, not a cryptographic signature or native Qortara audit.
**Date:** 2026-11-17
**Decision owner:** project owner, per [GOVERNANCE.md](../../GOVERNANCE.md)
**Evidence:** [Phase 0 and Phase 1 qualification record](../evidence/prism-phase0-20261117/README.md)
**Related:** [RFC-0001](../RFC-0001-prism-feasibility.md), [route decision record](../../.claude/PRISM_COMPATIBILITY.md), [ADR-0002](0002-qortara-governance-adoption.md), issues [#3](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/3) and [#4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4)

## Context

The owner requires Skill Mason to be a genuine Prism-built application. Phase 0 selected route A: the UOR template, LexLean and PrismPM, in the SDK image the template's `prismpm.lock` pins. Its reference application passed the complete `just vv` gate here.

Route A's application contract, `uor/template-contract/1`, and Skill Mason's Qortara governance both claim files at a repository root. Seven template files are universal policy, byte-bound by `template.lock`:

`.devcontainer/devcontainer.json`, `.github/workflows/bootstrap.yml`, `AGENTS.md`, `VERIFICATION.md`, `prismpm.lock`, `template-contract.json`, `template.lock`.

Skill Mason already owns a root `AGENTS.md`. The two cannot coexist at one path:

| File | SHA-256 |
| --- | --- |
| Template `AGENTS.md`, as bound by `template.lock` | `9a1fe3f73ab2963812c35976909c331292e1ca39ce47c0711ec1aafe8b869d87` |
| Skill Mason `AGENTS.md` at `42d8e35` | `b2487038dd55bde3061868e980a067da6d541be4545e5b089c0daf2d26e73650` |

Adding one line to the template's `AGENTS.md` made `prismpm template check` exit 2 with `PP1101: template policy path changed: AGENTS.md`. So adopting the contract at the root means replacing a Skill Mason governance file, which the owner has ruled out.

## What was established by execution

1. **A nested instance satisfies the file-level contract.** A template instance in a `prism/` subdirectory of a repository whose root holds Skill Mason's `AGENTS.md`, `GOVERNANCE.md`, `SECURITY.md` and `ARCHITECTURE_INDEX.md` passed `prismpm template check`, `prismpm lock check` and `just model`.
2. **It can be added to a repository that already has history.** `audit-prism` forbids new hand-written non-Prism files and any net growth in such lines against the parent commit. For the commit that first installs the instance it reported `installed here; the parent ran no ratchet, so this commit sets the ceiling`, and passed.
3. **After installation, hand-written code may only shrink.** A later commit that added the `SM-01` conformance test was refused: `1 new non-Prism file(s)` and `grew by 81 lines`. That file is what the template's own `just new-capability` scaffolds. A capability added after installation must pay for its test by deleting other hand-written code, or carry its claim binding some other way.
4. **A bounded eligibility decision is modelable.** See the candidate below.

## Options

| | A. Nested instance | B. Separate repository | C. Root adoption |
| --- | --- | --- | --- |
| Shape | Template instance at `prism/` inside this repository | A new repository created from the template; Skill Mason consumes its released `.holo` by digest | Template files at this repository's root |
| Skill Mason `AGENTS.md`, `GOVERNANCE.md`, `SECURITY.md`, `docs/README.md`, `.qortara/` | Untouched | Untouched | `AGENTS.md` replaced by the template's bytes; its content moved elsewhere |
| File-level template contract | Passes in the subdirectory (executed) | Passes (this is upstream's own layout) | Passes only after the replacement |
| Template's CI trust root | `prism/.github/workflows/bootstrap.yml` is byte-correct but inert: GitHub runs only root workflows. A Skill Mason-owned root workflow must run the same gate in `prism/` | Works as upstream designed | Works as upstream designed |
| Honest conformance statement | "The directory `prism/` is a byte-conformant instance; its gate is run by a project workflow, not by the template's bootstrap" | "`<repo>` conforms to `uor/template-contract/1`" | "This repository conforms" |
| One PR can change a decision and its consumer | Yes | No: two repositories, release then repin | Yes |
| Cost | Roughly 8 MB of template files in this repository, including a browser frame Skill Mason may not want; shrink-only ratchet applies under `prism/` | Second repository to govern, secure and release; Qortara baseline needed there too | Violates the stated boundary |

## Accepted architecture decision: option A

**Owner accepted option A: install the full pinned Prism template as a nested application at `prism/`, not at repository root; do not claim repository-level template conformance.** The installation itself remains a separately qualified change. Reasons:

- It is the only option that preserves every Qortara file, keeps the work in one reviewable repository, and has been executed end to end.
- It is reversible: the instance is one directory, and moving it to its own repository later (option B) keeps the same project-owned content.
- Its one deviation, the inert bootstrap workflow, is visible and can be stated exactly.

Reject option C while the owner's boundary stands. Keep option B as the path if the owner wants the template's own CI trust root to be authoritative, or wants the decision application released independently.

### Conditions required for a qualified implementation of accepted option A

1. The installing commit contains the complete instance at the pinned template revision and every Skill Mason capability intended for the first slice, because that commit sets the ratchet's ceiling.
2. No universal policy file under `prism/` is ever edited. Template changes arrive only through upstream's reviewable update flow and a governed pin change here.
3. A root workflow runs the unreduced `just vv` in `prism/` inside the image `prism/prismpm.lock` selects. It may add checks; it may not skip or reorder the template's.
4. `docs/README.md` registers the instance, its model and its evidence under one owner. `ARCHITECTURE_INDEX.md` stays a routing entrypoint.
5. Skill Mason code outside `prism/` may carry bytes to and from the application and may refuse on its own grounds. It may not decide eligibility.
6. Qortara's native checks ([issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4)) are run on the resulting tree. Whether they accept a second `AGENTS.md` under `prism/` is `NOT_RUN`.

## The candidate first slice

Carried as [`prism-overlay/`](../../prism-overlay/README.md): Skill Mason-authored files plus one patch, applied to a pinned template checkout by `scripts/prism_instance.sh`. The repository therefore holds project-owned content only, not a copy of the template.

**Capability `SM-01` (level `build`):** the decision answers `eligible` exactly when the evidence, rights, authority and coverage codes are each the single admitted code.

| Aspect | Model |
| --- | --- |
| Request | Exactly four bytes: evidence, rights, authority, coverage. Any other length answers `invalid request` |
| Admission | One code, `1`, per fact. Every other value, defined or not, refuses |
| Response | `eligible`, or `refused:` followed by each failing fact's reason: `EVIDENCE_UNQUALIFIED`, `RIGHTS_UNRESOLVED`, `AUTHORITY_EXCEEDED`, `OUTCOME_UNCOVERED` |
| Theorem | `eligible_decides`: `(eligible request) = true <-> Eligible request`, for every request, on `propext` only |
| Vectors | 12: the admitted case, each single refusal, prohibited rights, all four, an undefined code, three malformed lengths, and the allocation boundary |
| Limits | request 4 B, response 256 B, guest allocation 512 B, no capabilities |

What the proof covers: the decision over those four bytes. What it does not cover: whether the evidence is real or current, whether a licence determination is right, who asserted each code, the generated skill's bytes, or any consuming host's behaviour. Those remain Skill Mason's and the owner's responsibility, and each code needs a named asserting party before this slice is used for anything.

The acceptance matrix cases this slice addresses in model form are A5, A6, A7 and A11. It does not address A1 to A4, A8 to A10 or A12 to A18.

## Consequences

- Route A's SDK is a candidate by upstream's own statement. Accepting this ADR accepts a development dependency, not a production one.
- The complete gate depends on a mutable external input, the RustSec advisory database, through `just deny`. A pass is reproducible only together with that database's state.
- The emitted `.holo` grades `P0 unverified` under `prism-code check`, because it carries no embedded proof statement. Independent proof-level verification of the artifact is not available at these versions.
- The SDK image is published under `ghcr.io/afflom/prismpm-sdk-patched`. The owner should decide whether that trust root is acceptable.
- Every later capability meets the shrink-only ratchet. Budget for it in the design, not at merge time.

## Implementation guidance (not approval of remaining dependencies)

**Recommendation date:** 2026-11-17. **Status:** Owner has accepted the nested architecture, not every implementation choice below. These recommendations do not authorize an unqualified install, SDK trust-root acceptance, running the SDK on a developer workstation, or a product release.

1. **Prefer nested option A**, subject to all six proposed conditions and an additional enforced runner-isolation prerequisite in [issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9). Root governance files remain authoritative. The nested template is an instance, not the repository-level trust root.
2. **First application name:** `Qortara Skills Eligibility`. The existing candidate's `Skill Mason eligibility` name is not silently renamed: naming changes require rebuilt holos, fresh hashes/receipts and a complete gate run before installing.
3. **First capability:** only `SM-01`, with its exact four-code decision, scenario, generated conformance registration and test. No broader skill construction or catalog integration in the installing commit. If the first-slice ratchet ceiling cannot support future capability work without modifying generated/universal files, raise a separate SDK ergonomics issue before adoption.
4. **Browser-frame code:** retain the byte-bound upstream frame temporarily as a clearly labelled template artifact, not a supported product feature. Removal should be evaluated as a separate, verifiable shrink-only operation after installation; nothing in this ADR asserts the frame must be user-facing.
5. **Input assertion boundaries:** the builder must not accept caller-supplied `1` codes as truth. Evidence and rights must be backed by a **version-pinned, reviewed source record** and explicit rights policy. Authority must be derived from the authenticated owner's/host's actual permission ceiling. Coverage must be supported by a requirement-to-method evidence mapping. The proposed first slice remains **fixture-only** until each assertion is bound to a named, auditable real authority and freshness/revocation rules are tested.
6. **SDK trust and network:** hold production approval. The pinned personal-registry image is a **development candidate only**. The existing wrapper recursively `chown`s its checkout and exposes the host Docker socket to that image. Do not run it on a workstation or privileged shared runner. [Issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9) requires a disposable, credential-free, isolated build runner, a verified trust root, recorded network dependencies, and negative controls. Do not delete or upgrade the existing 21 GB image without separate explicit authorization.
7. **P0-to-P2 assurance:** do not treat an in-toto signature or `prism-code attest` invocation alone as proof-level qualification. The pinned PrismPM guide calls its attestation section experimental and notes its Rust reader refuses that added section until the wire model changes. Maintain `P0 unverified` for the independently checked holos until an exactly pinned compatible build, embedded statements, trusted signer and verification policy all pass.

**Decision boundary:** Option A is now owner-accepted as the application architecture. The first installing commit must independently satisfy or explicitly govern its remaining dependencies, including isolation, SDK trust and exact-head checks. Native Qortara governance, reporting intake and P2 assurance remain separate, honestly reported gates. Do not convert owner acceptance of a layout into a verified runtime.

## Remaining owner decisions and evidence gates

1. **Resolved:** option A nested at `prism/` accepted. Record the installation revision and verify the six implementation conditions before calling it adopted in code.
2. Accept or reject `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f72…` as a development toolchain trust root.
3. Decide whether the template's browser frame (`site/`, `frame/`, `identity/`, the `FR-` claims) belongs in a Skill Mason instance. Removing it is allowed by the ratchet and is a product decision.
4. Name the party that asserts each of the four input codes, and the evidence each must hold.
5. Confirm the network hosts a gate run may contact: `ghcr.io`, `pkg-containers.githubusercontent.com`, `static.crates.io`, `index.crates.io`, `github.com`.

Until an installing revision has been built and fully qualified under the accepted conditions, `SM-01` stays in `prism-overlay/`; neither this decision nor the route A reference evidence makes Qortara Skills a Prism-built application. Its eventual design must demonstrate Prism as the **decision substrate**: the model governs eligibility, while host glue only transports bounded inputs/outputs, authenticates authorities and can refuse independently, never substitute a competing eligibility algorithm.
