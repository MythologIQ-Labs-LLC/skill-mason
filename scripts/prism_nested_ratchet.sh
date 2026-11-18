#!/usr/bin/env bash
# Make the template's shrink-only ratchet engage for the nested instance at prism/.
#
# Why this exists. The template's `audit-prism` (xtask/src/audit.rs, `audit`)
# decides whether the parent commit ran the ratchet by reading
# `xtask/src/audit.rs` from the parent at that path from the repository root.
# Under ADR-0003 the instance lives at prism/, the file is at
# prism/xtask/src/audit.rs, the lookup misses, and every commit is treated as
# the installing one. Run 44217491838 showed a hand-written file added after
# installation being accepted.
#
# What this does. It does not reimplement the ratchet. It builds a small
# repository in which the instance IS the root: one commit whose tree is the
# parent's prism/ subtree, then one whose tree is this commit's prism/ subtree.
# The template's own unmodified `audit-prism` is then run in that repository,
# where its root-relative lookup finds what it looks for:
#
#   scripts/prism_reference_gate.sh <projection-dir> allowlist <log> \
#     cargo run -q --locked -p xtask -- audit-prism
#
# The measure, the languages counted and every refusal are upstream's. This
# script only decides what is compared with what, and refuses, before any
# container starts, the ways the comparison could be made meaningless.
#
# usage: prism_nested_ratchet.sh <repository> <commit> <template-checkout-at-the-pin> <new-projection-dir>
#
# stdout, one line:  RATCHET_STATE=<absent|installing|engaged> ...
#   absent      neither the commit nor its first parent holds a nested instance.
#               Nothing to audit; no projection is written.
#   installing  the commit holds the instance and its parent does not. The
#               projection is one root commit; the audit reports its ceiling.
#   engaged     both hold it. The audit compares the two.
#
# exit 0   the state above; run the audit in the projection unless `absent`
# exit 77  refused: the instance or its audit was moved, removed or altered
# exit 64  usage; exit 65/66/73 bad inputs
#
# Scope, on purpose: hand-written code under prism/ only, which is what ADR-0003
# says the ratchet covers. Code elsewhere in the repository is not measured. The
# instance path is fixed here, not a parameter: moving it is a governed change.
set -uo pipefail

INSTANCE=prism
GATE='pub mod prism {'
UNIVERSAL=(.devcontainer/devcontainer.json .github/workflows/bootstrap.yml AGENTS.md VERIFICATION.md prismpm.lock template-contract.json template.lock)

refuse() {
  echo "prism_nested_ratchet: REFUSED before any audit runs: $*" >&2
  exit 77
}

if [[ $# -ne 4 ]]; then
  sed -n '2,42p' "$0" >&2
  exit 64
fi
repo=$1
commit=$2
template=$3
projection=$4

git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || {
  echo "not a Git repository: $repo" >&2
  exit 66
}
git -C "$template" rev-parse --git-dir >/dev/null 2>&1 || {
  echo "not a Git repository: $template" >&2
  exit 66
}
child=$(git -C "$repo" rev-parse --verify -q "$commit^{commit}") || {
  echo "not a commit in $repo: $commit" >&2
  exit 65
}
if [[ -e $projection || -L $projection ]]; then
  echo "$projection already exists" >&2
  exit 73
fi
if [[ $(git -C "$repo" rev-parse --is-shallow-repository) == true ]] && ! git -C "$repo" rev-parse --verify -q "$child^1" >/dev/null; then
  # The same rule the template applies: a hidden parent is a gate that cannot see its ceiling.
  refuse "the clone is shallow, so the parent commit cannot be read. Check out with full history."
fi
parent=$(git -C "$repo" rev-parse --verify -q "$child^1^{commit}") || parent=

holds_instance() { git -C "$repo" cat-file -e "$1:$INSTANCE/xtask/src/audit.rs" 2>/dev/null; }
gated() { git -C "$repo" show "$1:$INSTANCE/xtask/src/audit.rs" 2>/dev/null | grep -qF -- "$GATE"; }

parent_gated=no
if [[ -n $parent ]] && holds_instance "$parent" && gated "$parent"; then
  parent_gated=yes
fi

if ! holds_instance "$child"; then
  if [[ $parent_gated == yes ]]; then
    refuse "the parent commit ${parent:0:12} holds a ratcheted instance at $INSTANCE/ and this commit ${child:0:12} does not. The instance was moved or removed; that is a governed change, not something a commit may do to leave the ratchet behind."
  fi
  echo "RATCHET_STATE=absent commit=$child instance=$INSTANCE"
  exit 0
fi

# The audit that will judge this commit must be the pinned one. Every file of the
# template's xtask and every universal policy file must have the blob the pin has,
# and xtask may hold nothing the pin does not.
pin=$(git -C "$template" rev-parse HEAD)
while IFS= read -r path; do
  want=$(git -C "$template" rev-parse "HEAD:$path")
  have=$(git -C "$repo" rev-parse --verify -q "$child:$INSTANCE/$path") || have=missing
  [[ $have == "$want" ]] || refuse "$INSTANCE/$path differs from the template pin ${pin:0:12} (or is missing). The ratchet cannot be trusted to judge a commit that changes the ratchet."
done < <(
  git -C "$template" ls-tree -r --name-only HEAD xtask
  printf '%s\n' "${UNIVERSAL[@]}"
)
extra=$(comm -13 <(git -C "$template" ls-tree -r --name-only HEAD xtask | sort) <(git -C "$repo" ls-tree -r --name-only "$child" "$INSTANCE/xtask" | sed "s|^$INSTANCE/||" | sort))
[[ -z $extra ]] || refuse "$INSTANCE/xtask holds files the template pin does not: $(echo "$extra" | tr '\n' ' ')"
gated "$child" || refuse "$INSTANCE/xtask/src/audit.rs no longer carries the ratchet."

# --- the projection: the instance as a repository root ------------------------
export GIT_AUTHOR_NAME=prism-ratchet GIT_AUTHOR_EMAIL=prism-ratchet@example.invalid
export GIT_COMMITTER_NAME=prism-ratchet GIT_COMMITTER_EMAIL=prism-ratchet@example.invalid
export GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z
git init --quiet --initial-branch=main "$projection" || exit 73
# Objects only: the projected commits are made from tree ids, never from files on disk.
echo "$(cd "$repo" && git rev-parse --absolute-git-dir)/objects" >"$projection/.git/objects/info/alternates"
child_tree=$(git -C "$repo" rev-parse "$child:$INSTANCE")
if [[ $parent_gated == yes ]]; then
  parent_tree=$(git -C "$repo" rev-parse "$parent:$INSTANCE")
  base=$(git -C "$projection" commit-tree "$parent_tree" -m "projected: $INSTANCE/ at $parent") || exit 70
  head=$(git -C "$projection" commit-tree "$child_tree" -p "$base" -m "projected: $INSTANCE/ at $child") || exit 70
  state=engaged
else
  head=$(git -C "$projection" commit-tree "$child_tree" -m "projected: $INSTANCE/ at $child (installing)") || exit 70
  state=installing
fi
git -C "$projection" update-ref refs/heads/main "$head" || exit 70
git -C "$projection" checkout --quiet --force main || exit 70
# Stand alone: copy the objects in, so the projection survives without the source.
git -C "$projection" repack --quiet -a -d || exit 70
rm -f "$projection/.git/objects/info/alternates"
[[ -z $(git -C "$projection" status --porcelain --untracked-files=all) ]] || {
  echo "the projection is not clean" >&2
  exit 70
}
[[ $(git -C "$projection" rev-parse 'HEAD^{tree}') == "$child_tree" ]] || {
  echo "the projection's tree is not the instance's tree" >&2
  exit 70
}
echo "RATCHET_STATE=$state commit=$child parent=${parent:-none} instance=$INSTANCE instance_tree=$child_tree projected_head=$head template_pin=$pin"
