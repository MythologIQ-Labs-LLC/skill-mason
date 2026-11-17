# Three agent skills, ready to file with PrismPM

**Status: prepared, not filed.** Filing needs a GitHub identity that can open issues on `UOR-Foundation/PrismPM`. The automated session that prepared these could not write to that repository.

Everything under this directory is written to stand alone. It names only upstream repositories, upstream commits and upstream tool versions.

## What is here

| File | Purpose |
| --- | --- |
| `skills/prism-source-gate/SKILL.md` | The proposed skill: check pins, surfaces, registry and real `--help` before building |
| `skills/prism-model-first/SKILL.md` | The proposed skill: author a template-route model in the order R3 requires |
| `skills/prism-proof-audit/SKILL.md` | The proposed skill: audit a passing gate and state what it proved |
| `<name>.title.txt` | The issue title |
| `<name>.issue.md` | The issue body, in the section layout PrismPM's `CONTRIBUTING.md` asks agents to use |
| `build_issues.py` | Regenerates the bodies from the skill files |

Each body follows PrismPM's feature-request form: Submitted by, Component (`docs`), Problem, Proposed API or behavior, Acceptance test, Current workaround, Searched existing requests.

## Before filing

1. Read PrismPM's rendered `/docs/requests.md` and confirm no request already covers these. The open and closed issues were searched on 2026-11-17 and only #353 (closed) is related; the rendered page itself could not be loaded.
2. Tick the box under "Searched existing requests" in each body once you have. PrismPM's intake leaves a request in `triage/needs-information` otherwise.
3. Decide whether you want three requests or one. Three matches the form's one-capability-per-request shape and lets each be voted on separately. To file one, concatenate the three "Proposed" sections under a single body.

## File

These are the commands PrismPM's `CONTRIBUTING.md` documents for filing without a browser. Run them from this directory.

```bash
gh issue create --repo UOR-Foundation/PrismPM --label kind/feature,agent-submitted --title "$(cat prism-source-gate.title.txt)" --body-file prism-source-gate.issue.md
```

```bash
gh issue create --repo UOR-Foundation/PrismPM --label kind/feature,agent-submitted --title "$(cat prism-model-first.title.txt)" --body-file prism-model-first.issue.md
```

```bash
gh issue create --repo UOR-Foundation/PrismPM --label kind/feature,agent-submitted --title "$(cat prism-proof-audit.title.txt)" --body-file prism-proof-audit.issue.md
```

If `gh` reports that you may not apply labels, drop `--label`; the intake workflow adds `agent-submitted` and the area label from the body.

## What the proposals claim, and do not

The skills describe behaviour observed with one set of pins on one platform, named in each issue body. They are offered as starting points for upstream to correct. They do not claim that the template route is a supported release, and they repeat upstream's own statement that the 0.4.0 SDK is a candidate.

The acceptance test in each body was evaluated against the proposed file and against `ERRORS.md` at the PrismPM pin: every `PP` diagnostic the skills name is registered there. `LLV` and `LLC` codes are LexLean's and are not in that file.

## After editing a skill

```bash
python3 build_issues.py
```
