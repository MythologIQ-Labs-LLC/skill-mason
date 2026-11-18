# External exact-pinned third-party package inspection (Skill Mason #30, C3)

**Status:** Development candidate, read-only, exact-byte proof only. Not a rights clearance, endorsement, behavioral evaluation, agent-host authorization or Prism admission.

## Why this is a real C3 increment

The governed \`skillz\` handoff preserves external repository, source commit, original SKILL.md blob, package-tree digest, review status and original evidence references. But the pinned \`skillz\` checkout often contains a Gitlink rather than the complete third-party package bytes. Metadata is not a complete package, and matching a filename is not sufficient.

\`scripts/external_package_resolver.py\` takes an **existing, separately provisioned Git checkout** plus an exact governed review ID. It does not initiate network access, install software or execute skill files. It validates:

1. Exact governed record ID, third-party source class, original recorded source repository, full 40-character commit and source \`SKILL.md\` path.
2. Canonical HTTPS GitHub source repository and the checkout's local remote identity (consistency only, **not** independent publisher authentication).
3. Exact checkout Git HEAD and **independently supplied source repository tree SHA-1**. A later upstream HEAD is not substituted.
4. Exact package subtree Git tree SHA-1 and SKILL.md Git blob SHA-1 from the pinned governed review.
5. Complete recursive tracked file inventory in that subtree, including nested assets, with regular Git blob modes only; reject Gitlinks, symlinks and unsupported modes.
6. Actual on-disk files match the full Git inventory with no extra ignored/untracked files, missing files or symlinks. Hash each actual file against its exact Git blob and report its SHA-256 and byte count. Accept bounded empty regular files.
7. Read-only, incomplete inline Markdown reference leads. Report unresolved within-package, out-of-package and remote URL references as unqualified; do not fetch them. This is **not** evidence of transitive dependency closure.

Inputs are bounded to 2,000 files, 16 MB per file, 64 MB total. The underlying source index still verifies the **separately pinned, complete original \`skillz\` source checkout and handoff before external inspection**.

The report explicitly declares publisher authentication unestablished, license/asset rights unassessed, redistribution/modification not cleared, host authority unknown, dependencies not closed, semantic review not upgraded, behavioral validation not executed, and composition ineligible.

The verifier accepts no source-selected executable recipe, plugin code, git hooks or shell steps from the external package. A user must separately authorize source access and any use, copying, modification or execution.

## Actual external fixture

The CI job checks the reviewed exact-version \`anthropic-skills/frontend-design\` package:

- Recorded original repository: \`https://github.com/anthropics/skills\`
- Exact repository commit: \`8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4\`
- Exact repository Git tree: \`d482eba557f7b2035c8a83589809628b96f6f40e\`
- Original package Git tree: \`d79e2a5bb4df4a386c2adcdd9ab8709bba28c3f6\`
- Original SKILL.md blob: \`a5333457c414d20d625f307df945842c0952ecc3\`
- Original source package has \`SKILL.md\` and \`LICENSE.txt\`. **Presence of a license file is not a rights decision.**

GitHub upstream object inspection established the tree and blob pin values. The CI checkouts use fixed exact revisions, no stored credentials and no submodules; they do **not** execute source repository code.

## Example

~~~sh
python3 -m scripts.external_package_resolver \
  --handoff /path/to/skillz-published/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  --external-checkout /path/to/anthropics-skills-at-exact-commit \
  --expected-repository-tree d482eba557f7b2035c8a83589809628b96f6f40e \
  governed:anthropic-skills/frontend-design
~~~

\`tests/test_external_package_resolver.py\` constructs fresh, local synthetic Git objects to exercise positive and negative checks for real byte drift, Git tree drift, wrong checkout pin/origin, untracked files, invalid external source, symlinked parents, unsafe paths and rights non-promotion.

## Missing for actual skill consumption

The next gate is **independent exact-package rights and dependencies**: check original publisher/terms and each asset/NOTICE/license separately, confirm the intended use (read-only reference, unchanged-use, adaptation, redistribution), understand linked references and scripts, and bind target-host permissions. That must be recorded as exact source/host evidence and reviewed by the governing owner. Static grades, Git signatures, hashes and this byte receipt are not substitutes.

Only after that and independently tested host outcomes may a qualified method be offered to C4/C5 selection and Prism. The current inspector cannot infer a right to copy, compose or redistribute third-party material. Existing held draft PRs #31 through #35 remain separate and are not release-qualified by this gate.
