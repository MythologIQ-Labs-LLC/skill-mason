#!/usr/bin/env bash
# Run a natively built Qortara Skills Eligibility holo through the independent
# runtime, the SM-01 probe and the local CLI, and keep every actual output.
#
# Nothing here decides eligibility. Every response is whatever the Prism guest
# returned for the bytes it was sent. The expected digest is read from the
# native gate's manifest receipt, never computed from the holo it then checks.
#
# usage: sm01_real_holo_acceptance.sh <built.holo> <manifest.json> <new-output-dir>
#
# Requires Node.js 22+ and exactly prism-code@0.9.5 installed beside this
# repository (see docs/technical/sm01-output-probe.md). Run it on a disposable,
# credential-free machine: the holo was built by a development-candidate SDK.
#
# The assurance grade `prism-code check` reports is recorded as observed. A
# pass here is fixture acceptance at that grade. It is not P2 unless that
# command says so.
set -uo pipefail

if [[ $# -ne 3 ]]; then
  sed -n '2,17p' "$0" >&2
  exit 64
fi
holo=$(cd "$(dirname "$1")" && pwd -P)/$(basename "$1")
manifest=$2
out=$3
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
[[ -f $holo && -f $manifest ]] || {
  echo "holo or manifest not found" >&2
  exit 66
}
if [[ -e $out ]]; then
  echo "$out already exists" >&2
  exit 73
fi
mkdir -p "$out"
out=$(cd "$out" && pwd -P)
cd "$root" || exit 70
failures=0
results=$out/results.tsv
printf 'check\texpected\tobserved\tresult\n' >"$results"
check() { # <name> <expected> <observed> <ok:0|1>
  local result=PASS
  [[ $4 -eq 0 ]] || {
    result=FAIL
    failures=$((failures + 1))
  }
  printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$result" | tee -a "$results"
}
prism_code() { npx --no-install prism-code "$@"; }
cli() { node bin/qortara-skills.mjs "$@"; }

# --- identity: the receipt names the holo --------------------------------------
expected=$(python3 - "$manifest" <<'PY'
import json, sys
named = set()
def walk(node):
    if isinstance(node, dict):
        if str(node.get("path", "")).endswith(".holo") and "sha256" in node:
            named.add(node["sha256"])
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for value in node:
            walk(value)
walk(json.load(open(sys.argv[1])))
if len(named) != 1:
    sys.exit(f"manifest names {len(named)} holo digests, expected 1")
print(next(iter(named)))
PY
) || exit 65
actual=$(sha256sum "$holo" | cut -d' ' -f1)
attestation=$(sha256sum "$manifest" | cut -d' ' -f1)
{
  echo "holo_sha256_from_manifest=$expected"
  echo "holo_sha256_of_file=$actual"
  echo "holo_bytes=$(stat -c %s "$holo")"
  echo "manifest_sha256_attestation_id=$attestation"
  echo "node=$(node --version)"
  echo "prism_code=$(node -e 'console.log(require("prism-code/package.json").version)')"
} | tee "$out/identity.txt"
check holo-matches-manifest "$expected" "$actual" "$([[ $expected == "$actual" ]]; echo $?)"

# --- the separate implementation: replay, grade, inspect ------------------------
ind=$out/independent-prism-code.txt
last=$out/.last-command-output
run() { # <command...>: record the command, its output and its exit status
  echo "\$ ${*/#prism_code/prism-code}" >>"$ind"
  "$@" >"$last" 2>&1
  local rc=$?
  cat "$last" >>"$ind"
  echo "[exit $rc]" >>"$ind"
  echo >>"$ind"
  return $rc
}
run prism_code vectors "$holo"
rc=$?
vectors_line=$(grep -E '^[0-9]+ of [0-9]+ vectors passed' "$last" | tail -1)
check independent-vectors "exit 0, 12 of 12 vectors passed" "exit $rc, ${vectors_line:-no result line}" \
  "$([[ $rc -eq 0 && $vectors_line == "12 of 12 vectors passed"* ]]; echo $?)"

run prism_code check "$holo"
check_rc=$?
grade=$(grep -Eo '\bP[0-3] [a-z]+' "$last" | head -1)
echo "assurance_grade_observed=${grade:-none} check_exit=$check_rc" | tee -a "$out/identity.txt"
# Recorded, never asserted upward: the grade is whatever the checker printed.
check independent-assurance-grade "recorded as observed" "${grade:-none} (check exit $check_rc)" \
  "$([[ -n $grade ]]; echo $?)"

run prism_code inspect "$holo"
check independent-inspect "exit 0" "exit $?" $?

# A flipped byte must be refused by the independent runtime, and by the probe
# whether it is given the true digest or the tampered file's own.
tampered=$out/tampered.holo
python3 - "$holo" "$tampered" <<'PY'
import pathlib, sys
data = bytearray(pathlib.Path(sys.argv[1]).read_bytes())
data[len(data) // 2] ^= 0x01
pathlib.Path(sys.argv[2]).write_bytes(bytes(data))
PY
run prism_code vectors "$tampered"
rc=$?
check tampered-holo-refused-by-runtime "non-zero, digest_mismatch" "exit $rc" \
  "$([[ $rc -ne 0 ]] && grep -q 'digest_mismatch' "$last"; echo $?)"
rm -f "$last"

node scripts/sm01_probe.mjs --holo "$tampered" --sha256 "$expected" --allow-p0 >"$out/probe-tampered-true-digest.out" 2>&1
rc=$?
check tampered-holo-refused-by-probe-digest "exit 2, DIGEST_MISMATCH" "exit $rc" \
  "$([[ $rc -eq 2 ]] && grep -q 'DIGEST_MISMATCH' "$out/probe-tampered-true-digest.out"; echo $?)"

node scripts/sm01_probe.mjs --holo "$tampered" --sha256 "$(sha256sum "$tampered" | cut -d' ' -f1)" --allow-p0 >"$out/probe-tampered-own-digest.out" 2>&1
rc=$?
check tampered-holo-not-run-without-override "exit 1, FIXTURE_FAIL, 0 passed" "exit $rc" \
  "$([[ $rc -eq 1 ]] && grep -q '"verdict": "FIXTURE_FAIL"' "$out/probe-tampered-own-digest.out" && grep -q '"passed": 0' "$out/probe-tampered-own-digest.out"; echo $?)"
rm -f "$tampered"

# --- the probe: twelve raw-byte fixtures through the real guest -----------------
node scripts/sm01_probe.mjs --holo "$holo" --sha256 "$expected" --allow-p0 --report "$out/sm01-probe-report.json" >"$out/sm01-probe.out" 2>&1
rc=$?
passed=$(sed -n 's/^ *"passed": \([0-9]*\),$/\1/p' "$out/sm01-probe-report.json" 2>/dev/null)
check probe-twelve-fixtures "exit 0, 12 passed" "exit $rc, ${passed:-?} passed" "$([[ $rc -eq 0 && ${passed:-} == 12 ]]; echo $?)"

node scripts/sm01_probe.mjs --holo "$holo" --sha256 "$expected" >"$out/probe-without-allow-p0.out" 2>&1
rc=$?
check probe-refuses-without-allow-p0 "exit 2, ASSURANCE_HOLD" "exit $rc" \
  "$([[ $rc -eq 2 ]] && grep -q 'ASSURANCE_HOLD' "$out/probe-without-allow-p0.out"; echo $?)"

# --- the local CLI ---------------------------------------------------------------
cli status --holo "$holo" --sha256 "$expected" --json >"$out/cli-status.json" 2>&1
rc=$?
check cli-status-preflight "exit 0, preflightReady true" "exit $rc" \
  "$([[ $rc -eq 0 ]] && grep -q '"preflightReady": true' "$out/cli-status.json"; echo $?)"

cli probe --holo "$holo" --sha256 "$expected" --allow-p0 --report "$out/cli-probe-report.json" >"$out/cli-probe.out" 2>&1
rc=$?
passed=$(sed -n 's/^ *"passed": \([0-9]*\),$/\1/p' "$out/cli-probe-report.json" 2>/dev/null)
check cli-probe-twelve-fixtures "exit 0, 12 passed" "exit $rc, ${passed:-?} passed" "$([[ $rc -eq 0 && ${passed:-} == 12 ]]; echo $?)"

# `evaluate` for each of the twelve fixtures and for requests outside the vector
# set. Expectations for the twelve are the model's own vectors (the probe's
# constant table). The off-vector requests are recorded, not asserted.
mkdir -p "$out/cli-evaluate"
node --input-type=module - "$holo" "$expected" "$out/cli-evaluate" <<'JS' >"$out/cli-evaluate.tsv" 2>"$out/cli-evaluate.err"
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CASES } from './scripts/sm01_probe.mjs';
const [holo, sha, dir] = process.argv.slice(2);
const extra = [
  { id: 'off-vector-coverage-two', hex: '01010102' },
  { id: 'off-vector-all-two', hex: '02020202' },
  { id: 'off-vector-ascii-abcd', hex: '61626364' },
  { id: 'off-vector-ascii-abc', hex: '616263' },
  { id: 'off-vector-all-ff', hex: 'ffffffff' },
];
let bad = 0;
console.log(['case', 'request_hex', 'cli_exit', 'status', 'response', 'expected', 'result'].join('\t'));
for (const c of [...CASES, ...extra]) {
  const report = `${dir}/${c.id}.json`;
  const run = spawnSync(process.execPath, ['bin/qortara-skills.mjs', 'evaluate', '--holo', holo, '--sha256', sha,
    '--hex', c.hex, '--allow-p0', '--report', report], { encoding: 'utf8' });
  let value = {};
  try { value = JSON.parse(readFileSync(report, 'utf8')); } catch { /* reported below as a failure */ }
  const completed = run.status === 0 && value.status === 'GUEST_COMPLETED';
  const ok = 'expected' in c ? completed && value.response === c.expected : completed;
  if (!ok) bad++;
  const hex = c.hex.length > 24 ? `${c.hex.slice(0, 16)}...(${c.hex.length / 2} bytes)` : (c.hex || '(empty)');
  console.log([c.id, hex, run.status, value.status ?? 'NO_REPORT', value.response ?? '', c.expected ?? '(recorded)',
    ok ? ('expected' in c ? 'PASS' : 'RECORDED') : 'FAIL'].join('\t'));
}
process.exitCode = bad ? 1 : 0;
JS
rc=$?
rows=$(grep -c $'\tPASS$' "$out/cli-evaluate.tsv")
check cli-evaluate-twelve-fixtures "exit 0, 12 PASS rows" "exit $rc, $rows PASS rows" "$([[ $rc -eq 0 && $rows -eq 12 ]]; echo $?)"

cli evaluate --holo "$holo" --sha256 "$expected" --hex 01010101 >"$out/cli-without-allow-p0.out" 2>&1
rc=$?
check cli-refuses-without-allow-p0 "exit 2, ASSURANCE_HOLD" "exit $rc" \
  "$([[ $rc -eq 2 ]] && grep -q 'ASSURANCE_HOLD' "$out/cli-without-allow-p0.out"; echo $?)"

cli evaluate --holo "$holo" --sha256 "$(printf '%064d' 0)" --hex 01010101 --allow-p0 >"$out/cli-wrong-digest.out" 2>&1
rc=$?
check cli-refuses-wrong-digest "exit 2, DIGEST_MISMATCH" "exit $rc" \
  "$([[ $rc -eq 2 ]] && grep -q 'DIGEST_MISMATCH' "$out/cli-wrong-digest.out"; echo $?)"

echo "failures=$failures" | tee -a "$out/identity.txt"
exit $((failures > 0))
