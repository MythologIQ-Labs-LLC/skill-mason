#!/usr/bin/env python3
"""Fail-closed, read-only routing for costly P0 Prism native observations.

This tool NEVER authorizes a merge or release. It reports when a previously
successful full development run may be referenced for exactly unchanged native
inputs, so a trusted workflow can avoid a redundant SDK execution. The full
gate remains mandatory whenever the input closure or evidence is uncertain.

Execute this script from an independently trusted BASE repository checkout,
not from an untrusted PR tree. No file from the candidate is executed.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

SCHEMA = "qortara/prism-native-routing/1"
EVIDENCE_SCHEMA = "qortara/prism-native-p0-observation/1"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
REPOSITORY = "MythologIQ-Labs-LLC/skill-mason"
FULL = "FULL_NATIVE_REQUIRED"
REUSE = "REUSE_PREVIOUS_P0_OBSERVATION"
# Every changed path must be explicitly safe. Unknown/new names FAIL CLOSED.
# These files are outside the native gate's script, executable, pin, model,
# overlay, ratchet, holo-consumer or wrapper dependency closure. They still
# require their own independent normal CI and security qualification.
SAFE_EXACT = frozenset({
    "README.md",
    ".github/workflows/backend-source-receipt.yml",
    ".github/workflows/real-holo-candidate.yml",
    ".github/workflows/corpus-index.yml",
    ".github/workflows/request-to-skill.yml",
    "bin/first-party-pilot.mjs",
    "bin/host-task-evidence.mjs",
    "schemas/recipe.v0.schema.json",
    "tests/first_party_pilot_cli.test.mjs",
    "tests/real_holo_candidate_acceptance.mjs",
    "tests/integration/strict_source_receipt_fixture.mjs",
    "tests/local_cli.test.mjs",
    "tests/test_request_to_skill.py",
})
SAFE_PREFIXES = (
    "docs/", "pilots/first-party/", "src/backend/",
    "tests/backend_",  # backend composer tests, not Prism native SDK tests
)
# A native installation is a separate security event. The recorded P0 receipt
# in this file is pre-install and MUST NOT qualify an installed prism/ tree.
INSTALL_PREFIX = "prism/"

def is_safe(path: str) -> bool:
    if not path or path.startswith("/") or "/../" in "/" + path + "/" or "\\" in path:
        return False
    return path in SAFE_EXACT or any(path.startswith(p) for p in SAFE_PREFIXES)


def git(repo: Path, *args: str) -> str:
    p = subprocess.run(["git", "-C", str(repo), *args], capture_output=True,
                       text=True, encoding="utf-8", errors="strict",
                       timeout=30, check=False)
    if p.returncode:
        raise RuntimeError("git " + args[0] + ": exit " + str(p.returncode))
    return p.stdout.strip()


def list_changed_paths(repo: Path, base: str, candidate: str) -> list[str]:
    # --no-renames yields both deleted and added paths, rather than a renamed
    # safe path disguising a new trusted input. No shell, no user-supplied flags.
    value = git(repo, "diff", "--no-ext-diff", "--no-textconv",
                "--no-renames", "--name-only", "--diff-filter=ACDMRTUXB",
                "-z", base, candidate, "--")
    # git() strips trailing whitespace, not interior NUL bytes.
    paths = value.split("\0")
    if paths and paths[-1] == "":
        paths.pop()
    if any(not p or "\n" in p for p in paths):
        raise RuntimeError("ambiguous git path output")
    return sorted(set(paths))


def verify_historical_workflow_pins(repo: Path, baseline: str,
                                    manifest: dict) -> None:
    """Bind the manifest's execution pin values to the exact prior workflow.

    An independently successful run is insufficient if its recorded SDK,
    template or runtime pin was accidentally replaced in the manifest.
    This only reads the original baseline commit as inert Git source.
    """
    source = git(repo, "show",
                 baseline + ":.github/workflows/prism-native-gate.yml")
    mapping = {
        "TEMPLATE_PIN": "template_commit",
        "SDK_IMAGE": "sdk_image",
        "PRISM_CODE_INTEGRITY": "prism_code_integrity",
    }
    for env_name, record_field in mapping.items():
        matches = re.findall(r"^  " + re.escape(env_name) +
                             r":\\s*([^\\r\\n#]+?)\\s*$",
                             source, flags=re.MULTILINE)
        if len(matches) != 1 or matches[0].strip().strip("\"'") != manifest.get(record_field):
            raise RuntimeError(
                "prior native workflow pin does not match manifest: " + env_name)


def github_json(repo: str, route: str, token: str) -> dict:
    if not token:
        raise RuntimeError("read-only GitHub evidence credential unavailable")
    if repo != REPOSITORY or not route.startswith("/"):
        raise RuntimeError("GitHub evidence scope mismatch")
    url = "https://api.github.com/repos/" + repo + route
    request = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "skill-mason-prism-p0-evidence-router",
    })
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read(2 * 1024 * 1024))


def verify_observed_baseline(manifest: dict, api) -> None:
    """Check real GitHub success + each job + immutable artifact identities.

    A successful past CI job is *not* owner trust-root acceptance, proof of P2
    assurance, or current-source qualification. It is only a historical P0
    observation of the same native execution inputs.
    """
    if manifest.get("schema") != EVIDENCE_SCHEMA or manifest.get("repository") != REPOSITORY:
        raise RuntimeError("baseline manifest schema or repository mismatch")
    base = manifest.get("baseline_commit")
    run_id = manifest.get("workflow_run_id")
    jobs = manifest.get("required_jobs")
    artifacts = manifest.get("required_artifacts")
    if not isinstance(base, str) or not HEX40.fullmatch(base) or (
        not isinstance(run_id, int) or isinstance(run_id, bool) or run_id <= 0
    ) or not isinstance(jobs, list) or len(jobs) != 4 or len(set(jobs)) != 4 or (
        not isinstance(artifacts, list) or len(artifacts) != 4
        or len(set(artifacts)) != 4
    ):
        raise RuntimeError("baseline manifest incomplete")
    if any(not isinstance(x, str) for x in jobs + artifacts):
        raise RuntimeError("baseline job/artifact name invalid")
    for artifact in artifacts:
        if not artifact.endswith(base) or not artifact.startswith("prism-"):
            raise RuntimeError("artifact not bound to baseline commit")
    if manifest.get("assurance_grade") != "P0 unverified" or (
        manifest.get("sdk_trust_root_accepted") is not False
        or manifest.get("production_eligible") is not False
    ):
        raise RuntimeError("baseline attempted to elevate assurance or authority")
    if not HEX40.fullmatch(str(manifest.get("template_commit", ""))) or not re.fullmatch(
        r"ghcr\.io/afflom/prismpm-sdk-patched@sha256:[0-9a-f]{64}",
        str(manifest.get("sdk_image", "")),
    ) or not re.fullmatch(r"sha512-[A-Za-z0-9+/]+=*",
        str(manifest.get("prism_code_integrity", "")),
    ) or not re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("holo_sha256", ""))):
        raise RuntimeError("baseline pin or integrity value invalid")
    run = api(f"/actions/runs/{run_id}")
    if run.get("head_sha") != base or run.get("status") != "completed" or (
        run.get("conclusion") != "success" or run.get("name") != manifest.get("workflow_name")
    ) or run.get("repository", {}).get("full_name") != REPOSITORY or (
        run.get("path") != ".github/workflows/prism-native-gate.yml"
    ) or run.get("head_repository", {}).get("full_name") != REPOSITORY:
        raise RuntimeError("full native run not independently confirmed")
    found_jobs = api(f"/actions/runs/{run_id}/jobs?per_page=100")
    if found_jobs.get("total_count", 101) > 100:
        raise RuntimeError("native job list truncated")
    actual = found_jobs.get("jobs")
    if not isinstance(actual, list):
        raise RuntimeError("native job listing malformed")
    for name in jobs:
        rows = [j for j in actual if j.get("name") == name]
        if len(rows) != 1 or rows[0].get("conclusion") != "success" or (
            rows[0].get("status") != "completed"
        ):
            raise RuntimeError("native phase missing or did not pass: " + name)
    found_artifacts = api(f"/actions/runs/{run_id}/artifacts?per_page=100")
    if found_artifacts.get("total_count", 101) > 100:
        raise RuntimeError("native artifact list truncated")
    actual_artifacts = found_artifacts.get("artifacts")
    if not isinstance(actual_artifacts, list):
        raise RuntimeError("native artifact listing malformed")
    for name in artifacts:
        rows = [a for a in actual_artifacts if a.get("name") == name]
        if len(rows) != 1 or rows[0].get("expired") is not False or (
            not isinstance(rows[0].get("size_in_bytes"), int)
            or rows[0]["size_in_bytes"] <= 0
        ):
            raise RuntimeError("native artifact missing, expired or empty: " + name)


def route(repo: Path, candidate: str, manifest: dict, api=None,
          *, force_full: bool = False, same_repository: bool = True) -> dict:
    baseline = str(manifest.get("baseline_commit", ""))
    result = {
        "schema": SCHEMA,
        "mode": FULL,
        "reason": "FAIL_CLOSED",
        "baseline_commit": baseline,
        "candidate_commit": candidate,
        "previous_native_run": manifest.get("workflow_run_id"),
        "changed_paths": [],
        "native_input_changes": [],
        "github_baseline_evidence_verified": False,
        "previous_assurance": "P0 unverified",
        "owner_approval_established": False,
        "sdk_trust_root_accepted": False,
        "p2_proven": False,
        "production_eligible": False,
        "is_native_gate_pass": False,
    }
    if force_full:
        result["reason"] = "FORCED_FULL_QUALIFICATION"
        return result
    if not same_repository:
        result["reason"] = "FORK_NOT_ELIGIBLE_FOR_EVIDENCE_REUSE"
        return result
    if not HEX40.fullmatch(candidate) or not HEX40.fullmatch(baseline):
        result["reason"] = "INVALID_SOURCE_IDENTITY"
        return result
    try:
        if git(repo, "rev-parse", "--verify", candidate + "^{commit}") != candidate or (
            git(repo, "rev-parse", "--verify", baseline + "^{commit}") != baseline
        ):
            raise RuntimeError("source commit identity mismatched")
        if subprocess.run(
            ["git", "-C", str(repo), "merge-base", "--is-ancestor", baseline, candidate],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30,
        ).returncode != 0:
            result["reason"] = "BASELINE_NOT_ANCESTOR"
            return result
        # The recorded full P0 gate predated native prism/ installation; the
        # installing commit (and later installed-instance releases) need a new
        # real full qualification rather than recycling the pre-install pass.
        if subprocess.run(["git", "-C", str(repo), "cat-file", "-e", candidate + ":prism/"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                          timeout=15).returncode == 0:
            result["reason"] = "INSTALLED_PRISM_REQUIRES_NEW_FULL_BASELINE"
            return result
        changed = list_changed_paths(repo, baseline, candidate)
        result["changed_paths"] = changed
        result["native_input_changes"] = [x for x in changed if not is_safe(x)]
        if result["native_input_changes"]:
            result["reason"] = "TRUSTED_OR_UNKNOWN_INPUT_CHANGED"
            return result
        verify_historical_workflow_pins(repo, baseline, manifest)
        if api is None:
            result["reason"] = "GITHUB_BASELINE_EVIDENCE_UNAVAILABLE"
            return result
        verify_observed_baseline(manifest, api)
        result["github_baseline_evidence_verified"] = True
        result["reason"] = "SAME_NATIVE_INPUTS_AND_VERIFIED_PRIOR_P0_OBSERVATION"
        result["mode"] = REUSE
        return result
    except (RuntimeError, ValueError, OSError, subprocess.TimeoutExpired,
            urllib.error.URLError, json.JSONDecodeError) as exc:
        result["reason"] = "UNVERIFIED_INPUT_OR_EVIDENCE"
        result["diagnostic"] = str(exc)[:300]
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--github-repository", default=REPOSITORY)
    parser.add_argument("--force-full", action="store_true")
    parser.add_argument("--fork", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict):
            raise ValueError("manifest must be an object")
    except (OSError, ValueError) as exc:
        print(json.dumps({"schema": SCHEMA, "mode": FULL,
                          "reason": "TRUSTED_MANIFEST_UNAVAILABLE",
                          "diagnostic": str(exc)[:300]}))
        return 0
    api = None
    if not args.fork and args.github_repository == REPOSITORY:
        token = os.environ.get("GITHUB_TOKEN", "")
        if token:
            api = lambda route: github_json(REPOSITORY, route, token)
    result = route(args.repo, args.candidate, manifest, api,
                   force_full=args.force_full,
                   same_repository=not args.fork and args.github_repository == REPOSITORY)
    body = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(body, encoding="utf-8")
    print(body, end="")
    # An unverified request is FULL, never a false "skip" result.
    return 0


if __name__ == "__main__":
    sys.exit(main())
