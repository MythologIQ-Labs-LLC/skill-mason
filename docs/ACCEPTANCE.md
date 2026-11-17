# Acceptance matrix: planned, not executed

| Case | Test input | Required result |
|---|---|---|
| A1 | Pinned eligible source, declared covered outcomes, permitted host | Byte-stable output and replayable receipt |
| A2 | Same recipe/catalog/tool pins repeated | Exact canonical byte equality |
| A3 | Unknown source ID | `UNKNOWN_ID` refusal |
| A4 | Source full-package SHA-256 differs | `SOURCE_MISMATCH` refusal |
| A5 | Unknown, restrictive, or nested-asset reuse rights | `RIGHTS_UNRESOLVED` refusal |
| A6 | Semantic review verified but security failed/incomplete/stale | No unchanged-use admission |
| A7 | A requested essential outcome lacks an eligible method | `OUTCOME_UNCOVERED` refusal |
| A8 | Candidate skill contains an instruction to run a shell command, leak secrets, or elevate authority | Inert data; no action; fail if authority outside policy |
| A9 | Candidate attempts path traversal / destination overwrite | Refuse without any writes outside declared output |
| A10 | Target host unsupported | `HOST_UNSUPPORTED` refusal |
| A11 | Composition requests greater authority than caller permits | `AUTHORITY_EXCEEDED` refusal |
| A12 | Different exact source pins | Different source receipt identity, no silent upgrade |
| A13 | Offline zero-inference build | No inference API calls; model-billed token count 0 |
| A14 | Downstream host consumes package | Separately report input/context token use and observed behavior |
| A15 | Formal route verifies but observed sandbox task fails | Keep formal result; mark behavioral failure, never promote to validated |
| A16 | Source candidate is only discoverable / reference-only | No generated redistributable package; record as gap/reference |
| A17 | Concurrent or interrupted writes | Atomic output or explicit failure, no partial approved package |
| A18 | Source snapshot does not expose a required source family | Unknown/unsearched warning; do not label capability absent |

**Minimum pilot gate:** A1-A14 (relevant cases) automated at pinned source/tool versions, A15 explicitly demonstrated as different evidence classes, and two different capability subdomain scenarios. Evidence must include reproducible commands and actual results. No test in this document has been executed just because it is listed.

## Qortara repository-governance acceptance (not yet executed)

| Case | Expected check / negative control | Required evidence |
|---|---|---|
| D1 | Root `GOVERNANCE.md`, `SECURITY.md`, architecture index and owner register are present and meaningful | Installed `qortara check repository-documents` and `qortara check architecture-index` |
| D2 | Remove either mandatory policy; attempt to disable it via config | Native check rejects both absence and bypass |
| D3 | Add an unregistered or multiply registered `docs/architecture/*.md` | Native architecture-index check refuses |
| D4 | Approved ADR conflicts with a newer unapproved branch doc | Drift reported, not silent acceptance |
| D5 | `.qortara/shadow.jsonl` contains no events at inception | No fabricated findings/closures or clean-health claim |
| D6 | Record a real Shadow event using the canonical runtime | Exact typed event appended/verified with source evidence |
| D7 | Malformed Shadow entry or interrupted ledger chain | Canonical runtime reports/refuses invalid history; no silent rewrite |
| D8 | Simulated remediation without enforcer + applicable PASS audit | Closure refused and pending state preserved |
| D9 | Attempts to commit `.qortara/keys/*`, session markers, locks or temp files | Git ignores local-only paths; no secret publication |
| D10 | Structural docs test passes but confidential reporting route remains unresolved | No qualified security policy or implied owner acceptance |

**Current result:** No native Qortara CLI is installed in this working environment; D1-D10 are planned test cases, **not passed**. An auxiliary static check is not equivalent to native Qortara enforcement.
