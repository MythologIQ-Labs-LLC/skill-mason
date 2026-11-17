# Three agent skills, filed with PrismPM

**Status: filed on 2026-11-17.** The bodies below were filed unchanged.

| Skill | Request |
| --- | --- |
| `prism-source-gate` | [UOR-Foundation/PrismPM#720](https://github.com/UOR-Foundation/PrismPM/issues/720) |
| `prism-model-first` | [UOR-Foundation/PrismPM#721](https://github.com/UOR-Foundation/PrismPM/issues/721) |
| `prism-proof-audit` | [UOR-Foundation/PrismPM#722](https://github.com/UOR-Foundation/PrismPM/issues/722) |

As filed, each carries the labels `area/docs` and `agent-submitted`. None carries `kind/feature`, which is the label PrismPM's request index ranks by, so the requests may not appear there until a maintainer triages them. The "Searched existing requests" box in each body was still unticked when checked after filing.

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

## If a body needs to change

Edit the skill file, regenerate the body, and update the request by hand or with `gh issue edit <number> --repo UOR-Foundation/PrismPM --body-file <name>.issue.md`. Keep the filed text and this directory identical.

## What the proposals claim, and do not

The skills describe behaviour observed with one set of pins on one platform, named in each issue body. They are offered as starting points for upstream to correct. They do not claim that the template route is a supported release, and they repeat upstream's own statement that the 0.4.0 SDK is a candidate.

The acceptance test in each body was evaluated against the proposed file and against `ERRORS.md` at the PrismPM pin: every `PP` diagnostic the skills name is registered there. `LLV` and `LLC` codes are LexLean's and are not in that file.

## After editing a skill

```bash
python3 build_issues.py
```
