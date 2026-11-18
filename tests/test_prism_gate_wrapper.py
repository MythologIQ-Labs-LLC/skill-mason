"""Tests of scripts/prism_reference_gate.sh with a stand-in for `docker`.

No container and no SDK image is involved. These tests show that the wrapper
refuses unsafe conditions before it would start a container, never touches the
source checkout, and builds the `docker run` arguments it documents. They do
not show that the real gate passes under this wrapper: that is NOT_RUN.
"""
from pathlib import Path
import hashlib
import os
import shutil
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prism_reference_gate.sh"
IMAGE = (
    "ghcr.io/afflom/prismpm-sdk-patched@sha256:"
    "3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3"
)
OTHER = "ghcr.io/afflom/prismpm-sdk-patched@sha256:" + "a" * 64
REFUSED = 77
SOCKET = Path("/var/run/docker.sock")

STUB = """#!/usr/bin/env bash
if [[ ${1:-} == network && ${2:-} == inspect ]]; then
  # Answers only for the network named in STUB_NETWORK; any other is missing.
  [[ ${5:-} == "${STUB_NETWORK:-}" ]] || exit 1
  printf '%s\\n' "${STUB_INTERNAL:-false}"
  exit 0
fi
printf '%s\\n' "$@" > "$STUB_OUT"
echo "stub docker ran"
exit "${STUB_RC:-0}"
"""


def snapshot(directory: Path) -> dict:
    """Owner, mode and content hash of every file, so any mutation is visible."""
    out = {}
    for path in sorted(directory.rglob("*")):
        info = path.lstat()
        digest = ""
        if path.is_file() and not path.is_symlink():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        out[str(path.relative_to(directory))] = (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode), digest)
    return out


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "needs git and bash")
class GateWrapperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="gate-wrapper-")).resolve()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.home = self.tmp / "home"
        self.home.mkdir()
        self.bin = self.tmp / "bin"
        self.bin.mkdir()
        stub = self.bin / "docker"
        stub.write_text(STUB)
        stub.chmod(0o755)
        self.stub_out = self.tmp / "docker-args.txt"
        self.work = self.tmp / "work"
        self.log = self.tmp / "gate.log"
        self.repo = self.make_repo("repo", IMAGE)

    def git(self, repo: Path, *args: str) -> None:
        subprocess.run(
            ["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.invalid", *args],
            check=True,
            capture_output=True,
            env=self.env(),
        )

    def make_repo(self, name: str, image: str, subdir: str = "") -> Path:
        repo = self.tmp / name
        instance = repo / subdir if subdir else repo
        instance.mkdir(parents=True)
        subprocess.run(["git", "init", "-q", str(repo)], check=True, env=self.env())
        (instance / "prismpm.lock").write_text('{"schema":"prismpm/sdk-lock/2","sdk_image":"%s","sdk_version":"0.3.0"}' % image)
        (instance / "Justfile").write_text("vv:\n    @echo ok\n")
        self.git(repo, "add", "-A")
        self.git(repo, "commit", "-q", "-m", "instance")
        return repo

    def env(self, **extra: str) -> dict:
        base = {
            "PATH": f"{self.bin}:/usr/local/bin:/usr/bin:/bin",
            "HOME": str(self.home),
            "PRISM_GATE_WORKDIR": str(self.work),
            "PRISM_GATE_UID": f"{os.getuid()}:{os.getgid()}",
            "STUB_OUT": str(self.stub_out),
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_SYSTEM": os.devnull,
        }
        base.update(extra)
        return base

    def run_gate(self, checkout: Path, network: str = "none", command=(), **extra: str):
        return subprocess.run(
            ["bash", str(SCRIPT), str(checkout), network, str(self.log), *command],
            capture_output=True,
            text=True,
            env=self.env(**extra),
        )

    def assert_refused(self, result, reason: str):
        self.assertEqual(result.returncode, REFUSED, result.stderr)
        self.assertIn("REFUSED before starting a container", result.stderr)
        self.assertIn(reason, result.stderr)
        self.assertFalse(self.stub_out.exists(), "docker must not have been invoked")

    def docker_args(self) -> list:
        return self.stub_out.read_text().splitlines()

    # --- the run it does allow ------------------------------------------------

    def test_runs_in_a_staged_copy_and_leaves_the_source_untouched(self):
        before = snapshot(self.repo)
        result = self.run_gate(self.repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(snapshot(self.repo), before, "the source checkout was modified")
        args = self.docker_args()
        staged = str(self.work / "src")
        self.assertEqual(args[:4], ["run", "--rm", "--network", "none"])
        self.assertIn(f"{staged}:{staged}", args)
        self.assertEqual(args[args.index("--workdir") + 1], staged)
        self.assertEqual(args[-3:], [IMAGE, "just", "vv"])
        self.assertFalse(any(str(self.repo) + ":" in a for a in args), "the source path was mounted")
        log = self.log.read_text()
        commit = subprocess.run(["git", "-C", str(self.repo), "rev-parse", "HEAD"], capture_output=True, text=True, env=self.env()).stdout.strip()
        self.assertIn(f"commit={commit}", log)
        self.assertIn("docker_socket=not-mounted", log)
        self.assertIn("net=none egress_network=none egress_proxy=none", log)
        self.assertRegex(log, r"GATE_EXIT=0 image=\S+@sha256:[0-9a-f]{64} ")

    def test_docker_socket_is_not_mounted_unless_explicitly_requested(self):
        self.assertEqual(self.run_gate(self.repo).returncode, 0)
        self.assertFalse(any("docker.sock" in a for a in self.docker_args()))

    def test_docker_socket_opt_in_takes_one_exact_value(self):
        self.assert_refused(self.run_gate(self.repo, PRISM_GATE_DOCKER_SOCKET="1"), "accepts only 'disposable-daemon'")
        self.assertFalse(self.work.exists())
        result = self.run_gate(self.repo, PRISM_GATE_DOCKER_SOCKET="disposable-daemon")
        if SOCKET.is_socket():
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("/var/run/docker.sock:/var/run/docker.sock", self.docker_args())
        else:
            self.assert_refused(result, "is not a socket")

    def test_nested_instance_mounts_the_staged_repository_and_runs_in_the_subdirectory(self):
        repo = self.make_repo("outer", IMAGE, subdir="prism")
        result = self.run_gate(repo / "prism", command=("prismpm", "template", "check"))
        self.assertEqual(result.returncode, 0, result.stderr)
        args = self.docker_args()
        staged = str(self.work / "src")
        self.assertIn(f"{staged}:{staged}", args)
        self.assertEqual(args[args.index("--workdir") + 1], f"{staged}/prism")
        self.assertEqual(args[-3:], ["prismpm", "template", "check"])
        self.assertIn("subdir=prism", self.log.read_text())

    def test_the_command_exit_status_is_passed_through(self):
        result = self.run_gate(self.repo, STUB_RC="9")
        self.assertEqual(result.returncode, 9)
        self.assertIn("GATE_EXIT=9 ", self.log.read_text())

    def test_proxy_settings_reach_the_container_only_with_host_network(self):
        self.assertEqual(self.run_gate(self.repo, HTTPS_PROXY="http://proxy.invalid:1").returncode, 0)
        self.assertNotIn("HTTPS_PROXY", self.docker_args())
        shutil.rmtree(self.work)
        self.assertEqual(self.run_gate(self.repo, "host", HTTPS_PROXY="http://proxy.invalid:1").returncode, 0)
        self.assertIn("HTTPS_PROXY", self.docker_args())

    def test_allowlist_network_uses_the_internal_network_and_only_the_named_proxy(self):
        result = self.run_gate(
            self.repo, "allowlist",
            PRISM_GATE_EGRESS_NETWORK="prism-gate-egress", PRISM_GATE_EGRESS_PROXY="http://172.30.99.1:3128",
            STUB_NETWORK="prism-gate-egress", STUB_INTERNAL="true",
            HTTPS_PROXY="http://ambient.invalid:1", PRISM_GATE_CA="/etc/hostname",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        args = self.docker_args()
        self.assertEqual(args[:4], ["run", "--rm", "--network", "prism-gate-egress"])
        self.assertIn("HTTPS_PROXY=http://172.30.99.1:3128", args)
        self.assertIn("https_proxy=http://172.30.99.1:3128", args)
        self.assertNotIn("HTTPS_PROXY", args, "the caller's ambient proxy variable was forwarded")
        self.assertFalse(any("ambient.invalid" in a or "prism-gate-ca" in a for a in args))
        self.assertFalse(any("docker.sock" in a for a in args))
        log = self.log.read_text()
        self.assertIn("net=allowlist egress_network=prism-gate-egress egress_proxy=http://172.30.99.1:3128", log)

    def test_allowlist_refuses_a_network_that_is_missing_or_not_internal(self):
        common = dict(PRISM_GATE_EGRESS_NETWORK="prism-gate-egress", PRISM_GATE_EGRESS_PROXY="http://172.30.99.1:3128")
        self.assert_refused(self.run_gate(self.repo, "allowlist", **common), "does not exist")
        self.assertFalse(self.work.exists())
        self.assert_refused(
            self.run_gate(self.repo, "allowlist", STUB_NETWORK="prism-gate-egress", STUB_INTERNAL="false", **common),
            "is not internal",
        )
        self.assertFalse(self.work.exists())
        for shared in ("host", "bridge", "none"):
            with self.subTest(network=shared):
                self.assert_refused(
                    self.run_gate(self.repo, "allowlist", PRISM_GATE_EGRESS_NETWORK=shared,
                                  PRISM_GATE_EGRESS_PROXY="http://172.30.99.1:3128"),
                    "dedicated internal network",
                )

    def test_allowlist_requires_a_network_name_and_a_literal_proxy_address(self):
        for extra in (
            {},
            {"PRISM_GATE_EGRESS_NETWORK": "prism-gate-egress"},
            {"PRISM_GATE_EGRESS_NETWORK": "prism-gate-egress", "PRISM_GATE_EGRESS_PROXY": "http://proxy.example:3128"},
            {"PRISM_GATE_EGRESS_NETWORK": "prism-gate-egress", "PRISM_GATE_EGRESS_PROXY": "https://172.30.99.1:3128"},
            {"PRISM_GATE_EGRESS_NETWORK": "--privileged", "PRISM_GATE_EGRESS_PROXY": "http://172.30.99.1:3128"},
        ):
            with self.subTest(extra=extra):
                result = self.run_gate(self.repo, "allowlist", STUB_NETWORK="prism-gate-egress", STUB_INTERNAL="true", **extra)
                self.assertEqual(result.returncode, 64, result.stderr)
                self.assertFalse(self.stub_out.exists())
                self.assertFalse(self.work.exists())

    def test_seed_cache_is_copied_in_and_never_shared(self):
        seed = self.tmp / "seed"
        (seed / "cargo").mkdir(parents=True)
        (seed / "cargo" / "crate.bin").write_text("cached")
        before = snapshot(seed)
        result = self.run_gate(self.repo, PRISM_GATE_SEED_TMP=str(seed))
        self.assertEqual(result.returncode, 0, result.stderr)
        copied = self.work / "tmp" / "cargo" / "crate.bin"
        self.assertEqual(copied.read_text(), "cached")
        self.assertNotEqual(copied.stat().st_ino, (seed / "cargo" / "crate.bin").stat().st_ino, "the seed file was linked, not copied")
        copied.write_text("changed by the run")
        self.assertEqual(snapshot(seed), before, "the seed directory was modified")
        self.assertFalse(any(str(seed) in a for a in self.docker_args()), "the seed was mounted")
        self.assertIn(f"seed_tmp={seed}", self.log.read_text())

    def test_refuses_a_seed_that_is_missing_or_a_symlink(self):
        self.assert_refused(self.run_gate(self.repo, PRISM_GATE_SEED_TMP=str(self.tmp / "nope")), "not a real directory")
        real = self.tmp / "real-seed"
        real.mkdir()
        link = self.tmp / "seed-link"
        link.symlink_to(real)
        self.assert_refused(self.run_gate(self.repo, PRISM_GATE_SEED_TMP=str(link)), "not a real directory")

    # --- what it refuses, before any container --------------------------------

    def test_refuses_a_runner_with_credential_like_variables(self):
        for name in ("GH_TOKEN", "AWS_SECRET_ACCESS_KEY", "CLOUDFLARE_API_TOKEN", "DB_PASSWORD", "OPENAI_API_KEY"):
            with self.subTest(name=name):
                result = self.run_gate(self.repo, **{name: "value-that-must-not-be-printed"})
                self.assert_refused(result, name)
                self.assertNotIn("value-that-must-not-be-printed", result.stderr + result.stdout)
                self.assertFalse(self.work.exists())

    def test_refuses_a_runner_with_credential_stores(self):
        for store in (".ssh", ".aws", ".config/gh", ".docker/config.json", ".netrc"):
            with self.subTest(store=store):
                path = self.home / store
                path.parent.mkdir(parents=True, exist_ok=True)
                path.mkdir() if "." not in path.name[1:] else path.write_text("{}")
                self.assert_refused(self.run_gate(self.repo), "credential store")
                shutil.rmtree(self.home)
                self.home.mkdir()

    def test_refuses_a_symlinked_checkout(self):
        link = self.tmp / "link"
        link.symlink_to(self.repo)
        self.assert_refused(self.run_gate(link), "symlink")

    def test_refuses_a_dirty_or_untracked_tree(self):
        (self.repo / "untracked.txt").write_text("x")
        self.assert_refused(self.run_gate(self.repo), "not clean")
        (self.repo / "untracked.txt").unlink()
        (self.repo / "Justfile").write_text("vv:\n    @echo changed\n")
        self.assert_refused(self.run_gate(self.repo), "not clean")

    def test_refuses_a_directory_that_is_not_a_git_working_tree(self):
        plain = self.tmp / "plain"
        plain.mkdir()
        (plain / "prismpm.lock").write_text('{"sdk_image":"%s"}' % IMAGE)
        self.assert_refused(self.run_gate(plain), "not inside a Git working tree")

    def test_refuses_an_unexpected_sdk_digest_unless_it_is_named(self):
        repo = self.make_repo("other", OTHER)
        self.assert_refused(self.run_gate(repo), "not the expected")
        result = self.run_gate(repo, PRISM_GATE_EXPECT_IMAGE=OTHER)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.docker_args()[-3], OTHER)

    def test_refuses_a_mutable_image_tag(self):
        repo = self.make_repo("tagged", "ghcr.io/afflom/prismpm-sdk-patched:latest")
        self.assert_refused(self.run_gate(repo), "digest-pinned")

    def test_refuses_to_reuse_or_overwrite_a_work_directory(self):
        self.work.mkdir()
        (self.work / "keep.txt").write_text("mine")
        self.assert_refused(self.run_gate(self.repo), "already exists")
        self.assertEqual((self.work / "keep.txt").read_text(), "mine")

    def test_refuses_to_write_into_the_source_repository(self):
        inside = self.repo / "work"
        self.assert_refused(self.run_gate(self.repo, PRISM_GATE_WORKDIR=str(inside)), "outside the source repository")
        self.assertFalse(inside.exists())
        result = subprocess.run(
            ["bash", str(SCRIPT), str(self.repo), "none", str(self.repo / "gate.log")],
            capture_output=True, text=True, env=self.env(),
        )
        self.assert_refused(result, "outside the source repository")
        self.assertFalse((self.repo / "gate.log").exists())

    def test_requires_a_work_directory_and_a_valid_network(self):
        env = self.env()
        del env["PRISM_GATE_WORKDIR"]
        result = subprocess.run(["bash", str(SCRIPT), str(self.repo), "none", str(self.log)], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 64)
        self.assertFalse(self.stub_out.exists())
        self.assertEqual(self.run_gate(self.repo, "bridge").returncode, 64)
        self.assertFalse(self.stub_out.exists())

    # --- the script's own text ------------------------------------------------

    def test_script_never_chowns_or_mounts_the_source_and_states_its_status(self):
        text = SCRIPT.read_text()
        self.assertNotIn('chown -R "$uid" "$scratch" "$mount"', text)
        self.assertNotIn('--volume "$mount:$mount"', text)
        self.assertNotIn("--privileged", text)
        self.assertEqual(text.count("chown "), 1, "exactly one chown, of the throwaway work directory")
        self.assertIn('chown -R "$uid" "$work"', text)
        self.assertIn("has NOT been run", text)
        self.assertIn("NOT_RUN", text)
        self.assertIn(f"DEFAULT_IMAGE='{IMAGE}'", text)


if __name__ == "__main__":
    unittest.main()
