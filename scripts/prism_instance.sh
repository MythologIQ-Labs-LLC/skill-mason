#!/usr/bin/env bash
# Materialise a UOR template instance that carries Skill Mason's eligibility
# candidate, from a pinned template checkout plus `prism-overlay/`.
#
# usage: prism_instance.sh <template-checkout> <new-instance-dir>
#
# The result is the template at the exact pin, unchanged, plus:
#   - `eligibility/`, a second PrismPM project whose model is Skill Mason's;
#     its lexicon, toolchain file and two foundation modules are copied
#     unchanged from the template's own `app/`;
#   - the scenario and conformance test for `SM-01`;
#   - `prism-overlay/template.patch`: one register row, the regenerated
#     `CONFORMANCE.md` rows, and an `eligibility` recipe added to `just vv`.
#
# No universal policy file is touched, so `prismpm template check` still passes.
# This script only writes files. Commit the result in a Git repository before
# running the gate: `audit-prism` measures the commit against its parent, and the
# commit that installs the instance sets its ceiling.
#
# Then: scripts/prism_reference_gate.sh <new-instance-dir> host <logfile>
set -euo pipefail

PIN=b64cc73c94773ed5bcc9d0549b1ae2c836fa1e0b

if [[ $# -ne 2 ]]; then
  sed -n '2,20p' "$0" >&2
  exit 64
fi

src=$(cd "$1" && pwd)
out=$2
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
overlay=$root/prism-overlay

head=$(git -C "$src" rev-parse HEAD)
if [[ $head != "$PIN" ]]; then
  echo "template checkout is at $head, not the pin $PIN" >&2
  exit 65
fi
if [[ -n $(git -C "$src" status --porcelain) ]]; then
  echo "template checkout is not clean" >&2
  exit 65
fi
if [[ -e $out ]]; then
  echo "$out already exists" >&2
  exit 73
fi

mkdir -p "$out"
git -C "$src" archive "$PIN" | tar -x -C "$out"

mkdir -p "$out/eligibility/src/Foundation/View/Text/V1"
cp -r "$out/app/language" "$out/eligibility/language"
cp "$out/app/lean-toolchain" "$out/eligibility/lean-toolchain"
cp "$out/app/src/Foundation/Bytes.lex.tex" "$out/eligibility/src/Foundation/Bytes.lex.tex"
cp "$out/app/src/Foundation/View/Text/V1/Model.lex.tex" \
  "$out/eligibility/src/Foundation/View/Text/V1/Model.lex.tex"

cp -r "$overlay/files/." "$out/"
# `git apply` silently skips every path when it runs in a subdirectory of an
# enclosing repository, which is exactly the nested case, so use patch(1) and
# then confirm each hunk landed.
patch --quiet --strip=1 --directory="$out" --no-backup-if-mismatch <"$overlay/template.patch"
grep -q '^id = "SM-01"$' "$out/model/ids.toml"
grep -q '^eligibility:$' "$out/Justfile"
grep -q '^| `SM-01` | `build` |' "$out/CONFORMANCE.md"

echo "instance written to $out (template $PIN + prism-overlay)"
