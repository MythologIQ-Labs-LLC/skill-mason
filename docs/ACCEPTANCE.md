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
