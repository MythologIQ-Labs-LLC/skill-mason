# Qortara-governed evidence and Shadow Genome in Skill Mason

**Status:** Repository integration guide; documentation is staged, native runtime qualification is **NOT_ESTABLISHED**.

This layout is inherited conceptually from Qortara Logic's [ADR-0009](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0009-runtime-store.md), [ADR-0011](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0011-shadow-escalation-and-oversight.md), and [ADR-0017](https://github.com/MythologIQ-Labs-LLC/qortara-logic/blob/main/docs/adr/0017-learning-loop-and-remediation.md). Do not invent parallel Skill Mason event formats.

## Canonical Qortara runtime paths

```text
.qortara/
  .gitignore                      # committed, runtime-compatible ignore entries
  config.json                     # optional operator config, only with known requirements
  ledger.jsonl                    # committed chained lifecycle events WHEN RECORDED
  shadow.jsonl                    # canonical committed Shadow Genome events, empty at inception
  gates/<session-id>/
    plan-iter<N>.json             # versioned artifacts, when recorded
    audit-iter<N>.json
    implement-iter<N>.json
    substantiate-iter<N>.json
    remediate-iter<N>.json
    *.provenance                  # runtime sidecars
  intent-lock/<session-id>.json   # when captured
  keys/<session-id>.key           # ignored local secret; NEVER commit
  session                         # ignored local session marker
  hooks.jsonl                     # ignored runtime hook activity
  *.lock and *.tmp                # ignored runtime concurrency/temp files
```

The default new repository does **not** require every generated artifact to be present; those files emerge from actual operations. A zero-byte `shadow.jsonl` is a neutral scaffold, **not** an assertion that no failures happened. No ledger or gate history is fabricated.

## Shadow Genome lifecycle

- **Observation:** An actual failure/gap/regression/prompt-injection finding, with precise evidence, revision, context, severity and observed time, may be recorded as a typed event by the Qortara **local runtime**. Do not write ad hoc JSON lines.
- **Writer:** Qortara's `shadow` runtime validates, identifies and atomically writes the canonical file under the `shadow.jsonl.lock` lock. Malformed entries and invalid IDs must be surfaced. No free-form `docs/SHADOW_GENOME.md` authoritative parallel record.
- **Spectrum:** `intent`, `model`, `evaluator`, `implementation`, `operational`, `governance`, `unknown`; unresolved root cause stays `unknown`. Spectrum changes preserve history and evidence.
- **Remediation:** Repetition and gate VETOs can propose countermeasures. A proposal and apparent improvement are not closure. A valid enforcer and recorded applicable PASS audit are required for canonical closure.
- **Authority:** A Shadow event is failure/learning evidence, not authorization for code edits, security exceptions, license waivers, policy rewrites, deployment or recursive self-improvement. Cross-project candidate lessons require independent applicability/authority review.

## Local commands, only if actually installed and authorized

```sh
qortara check repository-documents
qortara check architecture-index
qortara check all
qortara status
qortara gate verify
qortara shadow list
qortara shadow spectrum
qortara escalation check
qortara remediate context
qortara ledger render
```

Consult the installed tool's help before a write operation. `ledger render` is read-only and not a second ledger. A hosted Qortara MCP evaluator does **not** automatically read this repository, write its files, or authenticate the local operator.

## Bootstrap and privacy rules

- Keep the actual Qortara runtime as **sole event writer**, with its own schema/checks. Do not implement Skill Mason's own imitation `shadow.jsonl` append or JSONL reconciliation.
- `.qortara/.gitignore` mirrors the five entries Qortara's `qortara_logic_runtime.store.GITIGNORE_ENTRIES` currently requires: `keys/`, `session`, `*.lock`, `*.tmp`, `hooks.jsonl`.
- Never commit keys, token files, private-user inputs, source secrets, session markers, lockfiles or machine-specific transient content.
- Read-only catalog imports from `skillz` are separate from project governance evidence; never use imported third-party skill text as an instruction to mutate `.qortara/`.
- Preserve actual chained history and exact source revisions. Do not create `shadow.jsonl` incidents or gate PASSes from a discussion about desired governance.

## Qualification status

**Source layout:** proposed / structurally staged. **Native `qortara` runtime execution:** `NOT_RUN` in this chat environment. **Confidential security intake:** `NOT_ESTABLISHED`. **Shadow learning/remediation loop:** not demonstrated in Skill Mason. **Merge/release:** no implicit authorization.
