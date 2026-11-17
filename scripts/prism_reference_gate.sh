#!/usr/bin/env bash
# Run a UOR template checkout's own gate inside the SDK image its prismpm.lock selects.
#
# This is a thin host wrapper, not a gate. It reproduces the `docker run` that the
# template's hand-reviewed `.github/workflows/bootstrap.yml` performs, and then runs
# the command you pass (default: `just vv`) unchanged inside that image. It adds no
# check, skips no check, and never substitutes a host tool for an SDK tool.
#
# usage: prism_reference_gate.sh <checkout-dir> <none|host> <logfile> [command...]
#
#   <none|host>   container network. `none` proves a stage needs no network.
#                 `host` is needed on a cold cache (crates, RustSec advisory database).
#
# environment:
#   PERSIST_SCRATCH   directory reused as the container's /tmp across runs, so the
#                     downloaded crate and advisory caches survive. Unset: a fresh
#                     scratch directory is created and removed.
#   PRISM_GATE_CA     path to an extra CA bundle to trust inside the container, for
#                     hosts that re-terminate TLS at an egress proxy. Optional.
#   PRISM_GATE_MOUNT  directory to bind-mount instead of the checkout itself. It must
#                     contain the checkout. Use it when the template instance is a
#                     subdirectory of a larger Git repository. Default: the checkout.
#   PRISM_GATE_UID    uid:gid the SDK image runs as. Default 1000:1000, because the
#                     image's entrypoint runs as that user regardless of --user 0.
#
# The mounted and scratch directories are chowned to PRISM_GATE_UID. Point this at
# a disposable checkout, never at a working tree you care about the ownership of.
#
# Observed with ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f72… (template
# b64cc73): see docs/evidence/prism-phase0-20261117/README.md.
set -uo pipefail

if [[ $# -lt 3 ]]; then
  sed -n '2,27p' "$0" >&2
  exit 64
fi

dir=$(cd "$1" && pwd) || exit 66
net=$2
log=$3
shift 3

case $net in none | host) ;; *)
  echo "network must be 'none' or 'host'" >&2
  exit 64
  ;;
esac

image=$(sed -n 's/.*"sdk_image":"\([^"]*\)".*/\1/p' "$dir/prismpm.lock")
if [[ ! $image =~ ^[a-z0-9.-]+(:[0-9]{1,5})?/[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]]; then
  echo "prismpm.lock does not select an immutable SDK image" >&2
  exit 64
fi

uid=${PRISM_GATE_UID:-1000:1000}
mount=$(cd "${PRISM_GATE_MOUNT:-$dir}" && pwd) || exit 66
case $dir/ in "$mount"/*) ;; *)
  echo "PRISM_GATE_MOUNT must contain the checkout" >&2
  exit 64
  ;;
esac
if [[ -n ${PERSIST_SCRATCH:-} ]]; then
  scratch=$PERSIST_SCRATCH
  mkdir -p "$scratch"
else
  scratch=$(mktemp -d -p "$(dirname "$dir")" scratch.XXXX)
fi
mkdir -p "$scratch/prismpm-home/.docker"
printf '{}\n' >"$scratch/prismpm-home/.docker/config.json"
chown -R "$uid" "$scratch" "$mount"

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

[[ $# -gt 0 ]] || set -- just vv

start=$(date -u +%s)
docker run --rm --network "$net" \
  --user "$uid" --group-add "$(stat -c '%g' /var/run/docker.sock)" \
  --volume "$scratch:/tmp" \
  --volume "$mount:$mount" \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --workdir "$dir" \
  --env DOCKER_CONFIG=/tmp/prismpm-home/.docker \
  --env BUILDX_CONFIG=/tmp/prismpm-buildx \
  --env HOME=/tmp/prismpm-home \
  --env PRISMPM_EPHEMERAL_HOME=1 \
  --env SDK_IMAGE="$image" \
  "${extra[@]}" "$image" "$@" >"$log" 2>&1
rc=$?
echo "GATE_EXIT=$rc image=$image net=$net elapsed=$(($(date -u +%s) - start))s cmd=$*" >>"$log"

[[ -n ${PERSIST_SCRATCH:-} ]] || rm -rf "$scratch"
exit $rc
