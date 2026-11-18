#!/usr/bin/env bash
# Run a UOR template checkout's own gate inside the SDK image its prismpm.lock selects.
#
# This is a host wrapper, not a gate. It runs the command you pass (default
# `just vv`) unchanged inside that image. It adds no check to the gate and skips
# none. What it adds is refusal: it will not start a container unless the
# preconditions in issue #9 hold.
#
# usage: prism_reference_gate.sh <checkout-dir> <none|allowlist|host> <logfile> [command...]
#
#   <checkout-dir>  a template instance: a clean Git working tree, or a
#                   subdirectory of one. It is never mounted and never modified.
#                   A throwaway copy is staged and the gate runs in the copy.
#   <network>       `none` proves a stage needs no network. `allowlist` attaches
#                   the container to an internal Docker network whose only way
#                   out is an allowlisting CONNECT proxy
#                   (scripts/prism_egress_proxy.py), so every destination is
#                   named in advance and logged. `host` shares the runner's
#                   network namespace and is the widest of the three.
#
# Required environment:
#   PRISM_GATE_WORKDIR   a directory that does not exist yet. The staged copy,
#                        the container's /tmp and every output are written here
#                        and nowhere else. Delete it yourself when done.
#
# Required with `allowlist`:
#   PRISM_GATE_EGRESS_NETWORK  name of an existing Docker network. It must be
#                              internal (`docker network create --internal`).
#   PRISM_GATE_EGRESS_PROXY    http://<IPv4>:<port> of the allowlisting proxy on
#                              that network. The caller's own proxy variables
#                              and CA bundle are never forwarded in this mode.
#
# Optional environment:
#   PRISM_GATE_EXPECT_IMAGE  the exact image reference the lock must select.
#                            Default: the digest recorded in .claude/PRISM_SOURCES.md.
#   PRISM_GATE_UID           uid:gid to run as. Default 1000:1000, because the
#                            image's entrypoint runs as that user whatever --user says.
#   PRISM_GATE_CA            extra CA bundle to trust in the container (TLS-
#                            re-terminating egress proxies). Only with `host`.
#   PRISM_GATE_SEED_TMP      a directory from an earlier run (its `<workdir>/tmp`)
#                            whose contents are copied into this run's /tmp, so a
#                            warm crate cache lets a stage run with `none`. It is
#                            copied, never shared: runs cannot corrupt each other.
#   PRISM_GATE_DOCKER_SOCKET set to `disposable-daemon` to bind the Docker socket
#                            into the SDK container. Off by default. The socket
#                            gives that image control of the daemon, which is
#                            root on the machine that runs it. Only ever set this
#                            on a throwaway machine with its own Docker daemon.
#
# Refused before any container starts (exit 77, or 64/65/66 for usage and inputs):
#   - the caller's environment holds credential-like variables, or the caller's
#     home holds credential stores: this runner is not credential-free;
#   - the checkout path or its repository root is a symlink or sits under one;
#   - the working tree is not clean, so the source identity is not fixed;
#   - the lock selects a different image from the expected one, or a mutable tag;
#   - `allowlist` is asked for and the named network is missing or not internal;
#   - PRISM_GATE_WORKDIR already exists.
#
# The copy is identified by commit and tree hash, recorded at the top of the log.
#
# Status: the refusals and the argument construction are tested with a stand-in
# for `docker` (tests/test_prism_gate_wrapper.py). This header claims no result.
# Every run against the real SDK image keeps its own log, which opens with the
# GATE_SOURCE and GATE_RUN lines written below; committed runs are under
# docs/evidence/. The runs in docs/evidence/prism-phase0-20261117/ used an
# earlier revision, which mounted and chowned the checkout directly and always
# bound the socket, so they say nothing about this one.
set -uo pipefail

DEFAULT_IMAGE='ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f7284ace57c08bfe8d2effe2e08ab41da1a53f5820d48cccd498bd528c3'

refuse() {
  echo "prism_reference_gate: REFUSED before starting a container: $*" >&2
  exit 77
}

if [[ $# -lt 3 ]]; then
  sed -n '2,63p' "$0" >&2
  exit 64
fi

given=$1
net=$2
log=$3
shift 3

case $net in none | allowlist | host) ;; *)
  echo "network must be 'none', 'allowlist' or 'host'" >&2
  exit 64
  ;;
esac

# --- the runner must be credential-free -------------------------------------
# Names only: values are never read or printed.
credentialed=()
while IFS='=' read -r name _; do
  case $name in
    PRISM_GATE_*) ;;
    *TOKEN* | *SECRET* | *PASSWORD* | *PASSWD* | *CREDENTIAL* | *API_KEY* | *ACCESS_KEY* | *PRIVATE_KEY*)
      credentialed+=("$name")
      ;;
  esac
done < <(env)
if [[ ${#credentialed[@]} -gt 0 ]]; then
  refuse "credential-like variables are set (${credentialed[*]}). Run on a disposable, credential-free runner."
fi
home=${HOME:-}
if [[ -n $home ]]; then
  for store in .ssh .aws .gnupg .config/gh .config/gcloud .netrc .git-credentials .docker/config.json .npmrc; do
    if [[ -e $home/$store ]]; then
      refuse "credential store $home/$store exists. Run on a disposable, credential-free runner."
    fi
  done
fi

# --- the checkout must be a real, clean, identifiable source ----------------
[[ -d $given ]] || {
  echo "checkout directory not found: $given" >&2
  exit 66
}
abs=$(cd "$given" && pwd -L)
real=$(cd "$given" && pwd -P)
if [[ $abs != "$real" ]]; then
  refuse "the checkout path passes through a symlink ($abs resolves to $real)."
fi
if ! repo=$(git -C "$real" rev-parse --show-toplevel 2>/dev/null); then
  refuse "$real is not inside a Git working tree, so its source identity cannot be fixed."
fi
if [[ -L $repo || $(cd "$repo" && pwd -P) != "$repo" ]]; then
  refuse "the repository root $repo is a symlink."
fi
if [[ -n $(git -C "$repo" status --porcelain --untracked-files=all) ]]; then
  refuse "the working tree at $repo is not clean. Commit or remove changes first; the gate runs an exact commit."
fi
commit=$(git -C "$repo" rev-parse HEAD)
tree=$(git -C "$repo" rev-parse 'HEAD^{tree}')
sub=${real#"$repo"}
sub=${sub#/}

# --- the lock must select exactly the expected immutable image --------------
lock=$real/prismpm.lock
[[ -f $lock && ! -L $lock ]] || {
  echo "no regular prismpm.lock in $real" >&2
  exit 66
}
image=$(sed -n 's/.*"sdk_image":"\([^"]*\)".*/\1/p' "$lock")
if [[ ! $image =~ ^[a-z0-9.-]+(:[0-9]{1,5})?/[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]]; then
  refuse "prismpm.lock does not select an immutable, digest-pinned SDK image."
fi
expect=${PRISM_GATE_EXPECT_IMAGE:-$DEFAULT_IMAGE}
if [[ $image != "$expect" ]]; then
  refuse "prismpm.lock selects $image, not the expected $expect. A different SDK is a governed pin change, not a default."
fi

# --- everything is written under one new, throwaway directory ---------------
work=${PRISM_GATE_WORKDIR:-}
[[ -n $work ]] || {
  echo "PRISM_GATE_WORKDIR is required: a directory that does not exist yet" >&2
  exit 64
}
if [[ -e $work || -L $work ]]; then
  refuse "PRISM_GATE_WORKDIR $work already exists. Give a fresh path so nothing is reused or overwritten."
fi
parent=$(dirname "$work")
[[ -d $parent ]] || {
  echo "parent of PRISM_GATE_WORKDIR does not exist: $parent" >&2
  exit 66
}
parent=$(cd "$parent" && pwd -P)
work=$parent/$(basename "$work")
case $work/ in "$repo"/*) refuse "PRISM_GATE_WORKDIR must be outside the source repository." ;; esac

seed=${PRISM_GATE_SEED_TMP:-}
if [[ -n $seed ]]; then
  [[ -d $seed && ! -L $seed ]] || refuse "PRISM_GATE_SEED_TMP $seed is not a real directory."
  seed=$(cd "$seed" && pwd -P)
  case $seed/ in "$repo"/*) refuse "PRISM_GATE_SEED_TMP must be outside the source repository." ;; esac
fi

socket=()
case ${PRISM_GATE_DOCKER_SOCKET:-} in
  '') ;;
  disposable-daemon)
    [[ -S /var/run/docker.sock ]] || refuse "PRISM_GATE_DOCKER_SOCKET is set but /var/run/docker.sock is not a socket."
    socket=(--volume /var/run/docker.sock:/var/run/docker.sock
      --group-add "$(stat -c '%g' /var/run/docker.sock)")
    ;;
  *) refuse "PRISM_GATE_DOCKER_SOCKET accepts only 'disposable-daemon'." ;;
esac

# --- allowlist egress: an internal network and one named proxy --------------
docker_net=$net
egress_proxy=
egress_label=none
if [[ $net == allowlist ]]; then
  docker_net=${PRISM_GATE_EGRESS_NETWORK:-}
  egress_proxy=${PRISM_GATE_EGRESS_PROXY:-}
  [[ $docker_net =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$ ]] || {
    echo "PRISM_GATE_EGRESS_NETWORK is required with 'allowlist': the name of an internal Docker network" >&2
    exit 64
  }
  case $docker_net in none | host | bridge | default) refuse "PRISM_GATE_EGRESS_NETWORK must be a dedicated internal network, not '$docker_net'." ;; esac
  [[ $egress_proxy =~ ^http://([0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}$ ]] || {
    echo "PRISM_GATE_EGRESS_PROXY is required with 'allowlist': http://<IPv4>:<port>" >&2
    exit 64
  }
  internal=$(docker network inspect --format '{{.Internal}}' "$docker_net" 2>/dev/null) ||
    refuse "Docker network $docker_net does not exist."
  [[ $internal == true ]] ||
    refuse "Docker network $docker_net is not internal, so the container could reach hosts the proxy never sees."
  egress_label=$docker_net
fi

log_dir=$(dirname "$log")
[[ -d $log_dir ]] || {
  echo "log directory does not exist: $log_dir" >&2
  exit 66
}
log=$(cd "$log_dir" && pwd -P)/$(basename "$log")
case $log in "$repo"/*) refuse "the log must be written outside the source repository." ;; esac

# --- stage the copy; the source is never mounted, chowned or written --------
uid=${PRISM_GATE_UID:-1000:1000}
mkdir -m 0700 "$work" || exit 73
staged=$work/src
scratch=$work/tmp
git clone --quiet --no-hardlinks "$repo" "$staged" || exit 74
git -C "$staged" -c advice.detachedHead=false checkout --quiet --detach "$commit" || exit 74
if [[ $(git -C "$staged" rev-parse 'HEAD^{tree}') != "$tree" ]]; then
  refuse "the staged copy's tree does not match the source tree $tree."
fi
mkdir -p "$scratch"
if [[ -n $seed ]]; then
  cp -a "$seed/." "$scratch/" || exit 74
fi
mkdir -p "$scratch/prismpm-home/.docker"
printf '{}\n' >"$scratch/prismpm-home/.docker/config.json"
if [[ $(stat -c '%u:%g' "$work") != "$uid" ]]; then
  chown -R "$uid" "$work" || refuse "cannot give the staged copy to $uid. Run as that user or as root on the disposable runner."
fi
run_dir=$staged${sub:+/$sub}

extra=()
if [[ $net == host ]]; then
  for name in HTTPS_PROXY https_proxy NO_PROXY no_proxy; do
    [[ -n ${!name:-} ]] && extra+=(--env "$name")
  done
  if [[ -n ${PRISM_GATE_CA:-} ]]; then
    extra+=(--volume "$PRISM_GATE_CA:/prism-gate-ca.crt:ro")
    for name in SSL_CERT_FILE CARGO_HTTP_CAINFO GIT_SSL_CAINFO NODE_EXTRA_CA_CERTS CURL_CA_BUNDLE; do
      extra+=(--env "$name=/prism-gate-ca.crt")
    done
  fi
fi
if [[ $net == allowlist ]]; then
  extra+=(--env "HTTPS_PROXY=$egress_proxy" --env "https_proxy=$egress_proxy")
fi

[[ $# -gt 0 ]] || set -- just vv

{
  echo "GATE_SOURCE repo=$repo commit=$commit tree=$tree subdir=${sub:-.}"
  echo "GATE_RUN image=$image net=$net egress_network=$egress_label egress_proxy=${egress_proxy:-none} uid=$uid docker_socket=${PRISM_GATE_DOCKER_SOCKET:-not-mounted} seed_tmp=${seed:-none} workdir=$work"
} >"$log"

start=$(date -u +%s)
docker run --rm --network "$docker_net" \
  --user "$uid" \
  --volume "$scratch:/tmp" \
  --volume "$staged:$staged" \
  --workdir "$run_dir" \
  --env DOCKER_CONFIG=/tmp/prismpm-home/.docker \
  --env BUILDX_CONFIG=/tmp/prismpm-buildx \
  --env HOME=/tmp/prismpm-home \
  --env PRISMPM_EPHEMERAL_HOME=1 \
  --env SDK_IMAGE="$image" \
  "${socket[@]}" "${extra[@]}" "$image" "$@" >>"$log" 2>&1
rc=$?
echo "GATE_EXIT=$rc image=$image net=$net elapsed=$(($(date -u +%s) - start))s cmd=$*" >>"$log"
echo "prism_reference_gate: exit $rc; outputs are under $run_dir; remove $work when done" >&2
exit $rc
