#!/usr/bin/env bash
# Drive the native Prism gate on a disposable, credential-free runner (issue #9).
#
# This is orchestration, not a gate. Every SDK command goes through
# scripts/prism_reference_gate.sh, which stages a throwaway copy, never binds
# the Docker socket here, and refuses an unsafe runner before any container
# starts. The gate itself is the instance's own unmodified `just vv`. This
# script adds checks around it; it removes and reorders none.
#
# usage: prism_native_gate.sh <phase> <skill-mason-dir> <skill-mason-commit> <template-checkout> <base-dir>
#
#   reference  the upstream template's own application, pristine, through `just vv`
#   author     run `lexlean lock` and `lexlean fmt` on the overlay's model and emit
#              the tool-written files, so no lock or canonical form is hand-edited
#   nested     the Qortara Skills Eligibility instance, nested at prism/ under the
#              root governance files: canonical-form preflight, egress control,
#              the complete `just vv`, an offline repeat of the application stage,
#              and one planted defect per claim against the gate that owns it
#
# Required environment (see .github/workflows/prism-native-gate.yml):
#   PRISM_GATE_EGRESS_NETWORK, PRISM_GATE_EGRESS_PROXY   the allowlisted way out
#
# Everything is written under <base-dir>, which must not exist yet:
#   logs/      one unedited log per SDK invocation, each ending in GATE_EXIT=<n>
#   out/       receipts, the built .holo files, regenerated files, summary.tsv
#   work/      staged copies and container scratch; safe to delete afterwards
set -uo pipefail

if [[ $# -ne 5 ]]; then
  sed -n '2,27p' "$0" >&2
  exit 64
fi
phase=$1
sm=$(cd "$2" && pwd -P)
sm_commit=$3
template=$(cd "$4" && pwd -P)
base=$5

case $phase in reference | author | nested) ;; *)
  echo "unknown phase: $phase" >&2
  exit 64
  ;;
esac
[[ $sm_commit =~ ^[0-9a-f]{40}$ ]] || {
  echo "skill-mason commit must be a full SHA" >&2
  exit 64
}
if [[ -e $base ]]; then
  echo "$base already exists" >&2
  exit 73
fi
mkdir -p "$base/logs" "$base/out" "$base/work"
base=$(cd "$base" && pwd -P)
wrapper=$sm/scripts/prism_reference_gate.sh
summary=$base/out/summary.tsv
identities=$base/out/identities.txt
failures=0
printf 'label\tnetwork\texpected\texit\tresult\tcommand\n' >"$summary"

note() { printf '%s\n' "$*" | tee -a "$identities"; }

# sdk <label> <checkout> <network> <seed-tmp-or-> <command...>
# Runs one command in the SDK image through the wrapper. Returns its exit status.
sdk() {
  local label=$1 checkout=$2 network=$3 seed=$4
  shift 4
  local vars=("PRISM_GATE_WORKDIR=$base/work/$label")
  [[ $seed == - ]] || vars+=("PRISM_GATE_SEED_TMP=$seed")
  env "${vars[@]}" "$wrapper" "$checkout" "$network" "$base/logs/$label.log" "$@"
}

record() { # <label> <network> <expected> <exit> <result> <command...>
  local label=$1 network=$2 expected=$3 rc=$4 result=$5
  shift 5
  local shown=${*//$'\n'/ }
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$label" "$network" "$expected" "$rc" "$result" "${shown:0:160}" >>"$summary"
  echo "== $label: $result (exit $rc, expected $expected)"
  [[ $result == PASS ]] || failures=$((failures + 1))
}

# must_pass <label> <checkout> <network> <seed> <required-last-words-or-> <command...>
must_pass() {
  local label=$1 checkout=$2 network=$3 seed=$4 words=$5
  shift 5
  local rc=0 result=PASS
  sdk "$label" "$checkout" "$network" "$seed" "$@" || rc=$?
  [[ $rc -eq 0 ]] || result=FAIL
  if [[ $words != - ]] && ! grep -qF -- "$words" "$base/logs/$label.log"; then
    result=FAIL
  fi
  record "$label" "$network" "exit 0" "$rc" "$result" "$@"
  [[ $result == PASS ]]
}

sha() { sha256sum "$1" | cut -d' ' -f1; }

# Copy one project's receipts and holo out of a staged run, and name them.
collect() { # <label> <project-dir-in-staged-copy> <name>
  local label=$1 project=$2 name=$3
  local verified=$project/.prism/verified
  local dest=$base/out/receipts/$name
  mkdir -p "$dest" "$base/out/holo"
  local found=0 dir dir_manifest=
  for dir in "$verified"/*/; do
    [[ -f $dir/manifest.json ]] || continue
    found=$((found + 1))
    local id
    id=$(basename "$dir")
    cp "$dir/manifest.json" "$dir/application-acceptance.json" "$dir/lexlean-attestation.json" "$dest/"
    dir_manifest=$dir/manifest.json
    note "$label $name attestation_id=$id manifest_sha256=$(sha "$dir/manifest.json")"
  done
  [[ $found -eq 1 ]] || {
    echo "expected exactly one verified attestation under $verified, found $found" >&2
    return 1
  }
  # The manifest names the holo and its SHA-256. Copy the file that is those
  # bytes; a .holo the manifest does not name is a finding, not an output.
  python3 - "$dir_manifest" "$project/.prism" "$base/out/holo/$name.holo" <<'PY' | tee -a "$identities"
import hashlib, json, pathlib, shutil, sys
manifest, build, dest = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
named = set()
def walk(node):
    if isinstance(node, dict):
        if str(node.get("path", "")).endswith(".holo") and "sha256" in node:
            named.add((node["path"], node["sha256"], node.get("byte_length")))
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for value in node:
            walk(value)
walk(json.loads(manifest.read_text()))
if len(named) != 1:
    sys.exit(f"manifest names {len(named)} distinct holo artifacts, expected 1: {sorted(named)}")
path, digest, length = next(iter(named))
files = sorted(p for p in build.rglob("*.holo") if p.is_file() and not p.is_symlink())
matching = [p for p in files if hashlib.sha256(p.read_bytes()).hexdigest() == digest]
others = [p for p in files if p not in matching]
if not matching:
    sys.exit(f"no .holo under {build} has the SHA-256 the manifest records ({digest})")
shutil.copyfile(matching[0], dest)
print(f"holo_name={path!r} holo_bytes={dest.stat().st_size} manifest_bytes={length} holo_sha256={digest} copies={len(matching)} unnamed_holo_files={len(others)}")
PY
  [[ ${PIPESTATUS[0]} -eq 0 ]]
}

note "phase=$phase"
note "skill_mason_commit=$sm_commit"
note "template_commit=$(git -C "$template" rev-parse HEAD)"
note "sdk_image=$(sed -n 's/.*"sdk_image":"\([^"]*\)".*/\1/p' "$template/prismpm.lock")"
note "runner_kernel=$(uname -sr) arch=$(uname -m) cpus=$(nproc)"
note "docker_server=$(docker version --format '{{.Server.Version}}')"

versions='prismpm --version; lexlean --version; lean --version; lake --version; rustc --version; cargo --version; just --version; cargo deny --version; node --version'

# --- phase: reference --------------------------------------------------------
if [[ $phase == reference ]]; then
  must_pass tool-versions "$template" none - - bash -c "$versions" || true
  if must_pass ref-vv "$template" allowlist - 'vv: the acceptance gate passed' just vv; then
    collect ref-vv "$base/work/ref-vv/src/app" reference || failures=$((failures + 1))
  fi
  echo "failures=$failures" | tee -a "$identities"
  exit $((failures > 0))
fi

# --- a throwaway repository: this repository first, then the instance --------
# The first commit is the whole subject revision, so the rehearsal meets the
# same root .gitignore, .gitattributes and hand-written code a real install
# would. The commit that adds prism/ is the installing commit: audit-prism
# measures it against a parent that ran no ratchet. Identity and dates are
# fixed so the commit and tree hashes depend only on the two pinned inputs.
repo=$base/repo
export GIT_AUTHOR_NAME=prism-gate GIT_AUTHOR_EMAIL=prism-gate@example.invalid
export GIT_COMMITTER_NAME=prism-gate GIT_COMMITTER_EMAIL=prism-gate@example.invalid
export GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
git init --quiet --initial-branch=main "$repo"
git -C "$sm" archive "$sm_commit" | tar -x -C "$repo" || exit 70
if [[ -e $repo/prism ]]; then
  echo "the subject revision already contains prism/; this driver stages an install, it does not re-stage one" >&2
  exit 70
fi
git -C "$repo" add -A
git -C "$repo" commit --quiet -m "root: skill-mason at $sm_commit"
note "staged_root_commit=$(git -C "$repo" rev-parse HEAD) staged_root_tree=$(git -C "$repo" rev-parse 'HEAD^{tree}') subject_tree=$(git -C "$sm" rev-parse "$sm_commit^{tree}")"
"$sm/scripts/prism_instance.sh" "$template" "$repo/prism" || exit 70
git -C "$repo" add -A
git -C "$repo" commit --quiet -m "prism: install nested instance (template pin + prism-overlay at $sm_commit)"
install=$(git -C "$repo" rev-parse HEAD)
# Nothing the instance holds may be dropped or rewritten by a root rule. Every
# template file must reach the commit with the blob the pin has, except the
# three the overlay's patch changes.
ignored=$(git -C "$repo" status --porcelain --ignored -- prism)
if [[ -n $ignored ]]; then
  echo "root ignore rules keep instance files out of the installing commit:" >&2
  echo "$ignored" >&2
  exit 70
fi
python3 - "$template" "$repo" <<'PY' | tee -a "$identities" || exit 70
import subprocess, sys
template, repo = sys.argv[1], sys.argv[2]
def tree(directory, rev, prefix=""):
    out = subprocess.run(["git", "-C", directory, "ls-tree", "-r", rev, *([prefix] if prefix else [])],
                         check=True, capture_output=True, text=True).stdout
    entries = {}
    for line in out.splitlines():
        meta, path = line.split("\t", 1)
        mode, _, blob = meta.split()
        entries[path[len(prefix):] if prefix else path] = (mode, blob)
    return entries
pinned, staged = tree(template, "HEAD"), tree(repo, "HEAD", "prism/")
patched = {"CONFORMANCE.md", "Justfile", "model/ids.toml"}
missing = sorted(set(pinned) - set(staged))
changed = sorted(path for path in pinned if path in staged and pinned[path] != staged[path])
if missing or set(changed) != patched:
    sys.exit(f"instance differs from the template pin beyond the overlay's patch: missing={missing} changed={changed}")
print(f"template_files={len(pinned)} identical_blobs={len(pinned) - len(patched)} patched={sorted(patched)} added_by_overlay={len(set(staged) - set(pinned))}")
PY
note "staged_install_commit=$install staged_install_tree=$(git -C "$repo" rev-parse 'HEAD^{tree}')"
note "staged_root_agents_sha256=$(git -C "$repo" show HEAD:AGENTS.md | sha256sum | cut -d' ' -f1) staged_prism_agents_sha256=$(git -C "$repo" show HEAD:prism/AGENTS.md | sha256sum | cut -d' ' -f1)"
for policy in .devcontainer/devcontainer.json .github/workflows/bootstrap.yml AGENTS.md VERIFICATION.md prismpm.lock template-contract.json template.lock; do
  git -C "$repo" show "HEAD:prism/$policy" | cmp -s -- - "$template/$policy" || {
    echo "universal policy file differs from the pin: $policy" >&2
    exit 70
  }
done
note "universal_policy_files=7/7 byte-identical to the template pin, as committed"
instance=$repo/prism

# --- phase: author -----------------------------------------------------------
# The tools rewrite the staged copy. Nothing here is typed by hand: the lock and
# the canonical model are copied out exactly as `lexlean` wrote them.
if [[ $phase == author ]]; then
  must_pass author-regenerate "$instance" none - - bash -c \
    'set -euo pipefail; cd eligibility; lexlean lock; lexlean fmt; lexlean lock; lexlean fmt --check; lexlean lock --check; cd ..; prismpm --project eligibility check' || true
  staged=$base/work/author-regenerate/src/prism/eligibility
  mkdir -p "$base/out/regenerated/eligibility/src"
  drift=0
  for file in lexlean.lock src/Eligibility.lex.tex; do
    if [[ -f $staged/$file ]]; then
      cp "$staged/$file" "$base/out/regenerated/eligibility/$file"
      if cmp -s "$staged/$file" "$sm/prism-overlay/files/eligibility/$file"; then
        note "author $file canonical=yes sha256=$(sha "$staged/$file")"
      else
        drift=$((drift + 1))
        note "author $file canonical=NO committed_sha256=$(sha "$sm/prism-overlay/files/eligibility/$file") tool_sha256=$(sha "$staged/$file")"
        diff -u "$sm/prism-overlay/files/eligibility/$file" "$staged/$file" >"$base/out/regenerated/$(basename "$file").diff" || true
      fi
    fi
  done
  note "author_drift_files=$drift"
  echo "failures=$failures" | tee -a "$identities"
  exit $((failures > 0))
fi

# --- phase: nested -----------------------------------------------------------
must_pass tool-versions "$instance" none - - bash -c "$versions" || true

# Added before the gate, cheapest first: a stale lock or non-canonical model is
# reported in seconds. `just vv` runs the same two checks again in its own order.
if ! must_pass pre-canonical "$instance" none - 'lexlean.lock is current' bash -c \
  'cd eligibility && lexlean fmt --check && lexlean lock --check'; then
  echo "the overlay's tool-owned files are not canonical; run the author phase and commit what the tools wrote" >&2
  echo "failures=$failures" | tee -a "$identities"
  exit 1
fi

# The network claim, tested from inside the SDK container: nothing is reachable
# directly, a host off the allowlist is refused by the proxy, an allowlisted
# host is tunnelled.
must_pass egress-control "$instance" allowlist - 'EGRESS_CONTROL_OK' bash -c '
  set -uo pipefail
  proxy=${HTTPS_PROXY#http://}; host=${proxy%:*}; port=${proxy#*:}
  if timeout 8 bash -c "exec 3<>/dev/tcp/1.1.1.1/443" 2>/dev/null; then echo "DIRECT_EGRESS_OPEN 1.1.1.1:443"; exit 1; fi
  if timeout 8 bash -c "exec 3<>/dev/tcp/169.254.169.254/80" 2>/dev/null; then echo "DIRECT_EGRESS_OPEN metadata"; exit 1; fi
  if timeout 8 bash -c "exec 3<>/dev/tcp/$host/22" 2>/dev/null; then echo "RUNNER_PORT_OPEN $host:22"; exit 1; fi
  echo "direct egress refused: 1.1.1.1:443, 169.254.169.254:80, $host:22"
  ask() { exec 3<>"/dev/tcp/$host/$port" || return 9; printf "CONNECT %s:443 HTTP/1.1\r\nHost: %s:443\r\n\r\n" "$1" "$1" >&3; IFS= read -r -t 20 line <&3; exec 3<&- 3>&-; printf "%s\n" "${line//[[:cntrl:]]/}"; }
  denied=$(ask example.com); echo "CONNECT example.com:443 -> $denied"
  allowed=$(ask static.crates.io); echo "CONNECT static.crates.io:443 -> $allowed"
  [[ $denied == *" 403 "* && $allowed == *" 200 "* ]] || exit 1
  echo EGRESS_CONTROL_OK' || {
  echo "the egress control failed; the complete gate is not started on a network that is not what it claims" >&2
  echo "failures=$failures" | tee -a "$identities"
  exit 1
}

# The complete, unreduced gate.
gate_ok=0
if must_pass sm01-vv "$instance" allowlist - 'vv: the acceptance gate passed' just vv; then
  gate_ok=1
  collect sm01-vv "$base/work/sm01-vv/src/prism/eligibility" eligibility || failures=$((failures + 1))
  collect sm01-vv "$base/work/sm01-vv/src/prism/app" reference ||
    note "sm01-vv reference: the template application's receipts were not collected in this phase"
  grep -F 'audit-prism:' "$base/logs/sm01-vv.log" | tee -a "$identities"
fi
seed=$base/work/sm01-vv/tmp
if [[ $gate_ok -ne 1 ]]; then
  echo "the complete gate did not pass; controls and the repeat are not run against a failing baseline" >&2
  echo "failures=$failures" | tee -a "$identities"
  exit 1
fi

# Repeat the application stage from a fresh staged copy with the network off,
# seeded only with the first run's crate cache. Same bytes or it is a finding.
if must_pass sm01-eligibility-offline "$instance" none "$seed" 'verified attestation:' just eligibility; then
  project=$base/work/sm01-eligibility-offline/src/prism/eligibility
  first=$(sha "$base/out/holo/eligibility.holo")
  again=$(find "$project/.prism" -type f -name '*.holo' -exec sha256sum {} + | cut -d' ' -f1 | grep -x -m1 -- "$first")
  first_id=$(sed -n 's/^verified attestation: \([0-9a-f]\{64\}\)$/\1/p' "$base/logs/sm01-vv.log" | tail -1)
  again_id=$(sed -n 's/^verified attestation: \([0-9a-f]\{64\}\)$/\1/p' "$base/logs/sm01-eligibility-offline.log" | tail -1)
  if [[ $first == "$again" && -n $first_id && $first_id == "$again_id" ]]; then
    note "repeat offline: holo_sha256 and attestation id identical ($first, $first_id)"
    record repeat-identical none "same holo and attestation" 0 PASS compare
  else
    note "repeat offline: DIFFERENT first_holo=$first found_again=${again:-no} attestation=$first_id vs $again_id"
    record repeat-identical none "same holo and attestation" 1 FAIL compare
  fi
  rm -rf "$base/work/sm01-eligibility-offline"
fi

# --- planted defects ---------------------------------------------------------
# Each defect is one commit on its own branch from the installing commit, run
# against the gate that owns the claim. A control passes only when the command
# exits non-zero AND its log carries the diagnostic that names the defect.
model=prism/eligibility/src/Eligibility.lex.tex

edit() { # <file> <exact-old> <exact-new>: replace exactly one occurrence, or fail
  python3 - "$repo/$1" "$2" "$3" <<'PY'
import pathlib, sys
path, old, new = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text(encoding="utf-8")
if text.count(old) != 1:
    sys.exit(f"planting failed: expected exactly one occurrence in {path.name}, found {text.count(old)}")
path.write_text(text.replace(old, new), encoding="utf-8")
PY
}

control() { # <label> <diagnostic-regex> <command...>   (the defect is already in the working tree)
  local label=$1 diagnostic=$2
  shift 2
  git -C "$repo" add -A
  if git -C "$repo" diff --cached --quiet; then
    record "$label" allowlist "refusal: $diagnostic" - "FAIL(nothing planted)" "$@"
    git -C "$repo" checkout --quiet --force main
    return
  fi
  git -C "$repo" commit --quiet -m "planted defect: $label"
  local rc=0 result=PASS
  sdk "$label" "$instance" allowlist "$seed" "$@" || rc=$?
  if [[ $rc -eq 0 ]]; then
    result="FAIL(accepted)"
  elif ! grep -Eq -- "$diagnostic" "$base/logs/$label.log"; then
    result="FAIL(wrong diagnostic)"
  fi
  record "$label" allowlist "refusal: $diagnostic" "$rc" "$result" "$@"
  rm -rf "$base/work/$label"
  git -C "$repo" checkout --quiet --force main
}

plant() { git -C "$repo" checkout --quiet -b "$1" "$install"; }

verify=(prismpm --project eligibility verify)

plant nc-policy-drift
printf '\nOne line the template never wrote.\n' >>"$repo/prism/AGENTS.md"
control nc-policy-drift 'PP1101: template policy path changed: AGENTS\.md' prismpm template check

plant nc-lock-tamper
python3 - "$repo/prism/prismpm.lock" <<'PY' || exit 70
import pathlib, re, sys
path = pathlib.Path(sys.argv[1]); text = path.read_text()
match = re.search(r'"digest":"sha256:([0-9a-f]{64})"', text)
old = match.group(1); new = ("0" if old[0] != "0" else "1") + old[1:]
path.write_text(text.replace(old, new, 1))
PY
control nc-lock-tamper 'PP5401' prismpm lock check

plant nc-stale-conformance
edit prism/CONFORMANCE.md 'coverage codes are each the single admitted code |' 'coverage codes are each an admitted code |' || exit 70
control nc-stale-conformance 'CONFORMANCE\.md is stale' just model

plant nc-ratchet-new-test
printf '#[test]\nfn added_after_installation() {}\n' >"$repo/prism/crates/conformance/tests/added_later.rs"
control nc-ratchet-new-test 'new non-Prism file' just model

# An observation, not a control: nobody has shown whether the nested ratchet
# measures hand-written code outside prism/. A shell file is added at the
# repository root in a commit after installation, and whatever `just model`
# says is recorded. Either answer is a design fact for the installing commit.
plant obs-root-file-added-after-install
printf '#!/usr/bin/env bash\necho added after installation, outside prism\n' >"$repo/scripts/added_after_install.sh"
git -C "$repo" add -A
git -C "$repo" commit --quiet -m "observation: hand-written file added outside prism/ after installation"
obs_rc=0
sdk obs-root-file-added-after-install "$instance" allowlist "$seed" just model || obs_rc=$?
printf '%s\t%s\t%s\t%s\t%s\t%s\n' obs-root-file-added-after-install allowlist "recorded, not judged" "$obs_rc" OBSERVED "just model" >>"$summary"
note "observation root-file-added-after-install: just model exit=$obs_rc; $(grep -F 'audit-prism' "$base/logs/obs-root-file-added-after-install.log" | tail -1)"
rm -rf "$base/work/obs-root-file-added-after-install"
git -C "$repo" checkout --quiet --force main

# One weakened decision per fact: the function stops checking it, the
# proposition still requires it, so eligible_decides is false and Lean says so.
plant nc-evidence-check-dropped
edit "$model" '((admitted (project request evidence)) && ((admitted (project request rights)) && ((admitted (project request authority)) && (admitted (project request coverage)))))' \
  '((admitted (project request rights)) && ((admitted (project request authority)) && (admitted (project request coverage))))' || exit 70
control nc-evidence-check-dropped 'PP5001|unsolved goals' "${verify[@]}"

plant nc-rights-check-dropped
edit "$model" '((admitted (project request rights)) && ((admitted (project request authority)) && (admitted (project request coverage))))' \
  '((admitted (project request authority)) && (admitted (project request coverage)))' || exit 70
control nc-rights-check-dropped 'PP5001|unsolved goals' "${verify[@]}"

plant nc-authority-check-dropped
edit "$model" '((admitted (project request authority)) && (admitted (project request coverage)))' \
  '(admitted (project request coverage))' || exit 70
control nc-authority-check-dropped 'PP5001|unsolved goals' "${verify[@]}"

plant nc-coverage-check-dropped
edit "$model" '((admitted (project request authority)) && (admitted (project request coverage)))' \
  '(admitted (project request authority))' || exit 70
control nc-coverage-check-dropped 'PP5001|unsolved goals' "${verify[@]}"

# An undefined code admitted: the function admits 2 and refuses 1, the
# proposition still requires 1.
plant nc-admits-code-two
edit "$model" 'body: (code =? 1)}' 'body: (code =? 2)}' || exit 70
control nc-admits-code-two 'PP5001|unsolved goals|PP5301|disagrees with a modeled vector' "${verify[@]}"

plant nc-vector-prohibited-rights-eligible
edit "$model" '{request := 0x01020101, response := 0x726566757365643a205249474854535f554e5245534f4c564544}' \
  '{request := 0x01020101, response := 0x656c696769626c65}' || exit 70
control nc-vector-prohibited-rights-eligible 'PP5301|disagrees with a modeled vector' "${verify[@]}"

plant nc-five-byte-request-accepted
edit "$model" '(if ((Foundation.Bytes::byteLength value) =? 4) then' '(if ((Foundation.Bytes::byteLength value) =? 5) then' || exit 70
control nc-five-byte-request-accepted 'PP5301|disagrees with a modeled vector' "${verify[@]}"

plant nc-undeclared-axiom
edit "$model" '  axioms: [propext]
}' '  axioms: []
}' || exit 70
control nc-undeclared-axiom 'LLV7005' "${verify[@]}"

# The claim binding: a refusal reason renamed in the model and in its vector
# would still verify. Only the conformance test fixes what SM-01 names.
plant nc-reason-renamed
python3 - "$repo/$model" <<'PY' || exit 70
import pathlib, sys
path = pathlib.Path(sys.argv[1]); text = path.read_text()
old_text, new_text = " RIGHTS_UNRESOLVED", " RIGHTS_UNDECIDED "
old_hex, new_hex = old_text.encode().hex(), new_text.encode().hex()
assert len(old_text) == len(new_text) and text.count(f'"{old_text}"') == 1 and text.count(old_hex) == 3
path.write_text(text.replace(f'"{old_text}"', f'"{new_text}"').replace(old_hex, new_hex))
PY
control nc-reason-renamed 'must be named RIGHTS_UNRESOLVED' cargo test --locked -p repo-conformance --test eligibility

echo "failures=$failures" | tee -a "$identities"
exit $((failures > 0))
