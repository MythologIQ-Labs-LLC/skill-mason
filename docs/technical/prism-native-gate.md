# Running the native Prism gate on an isolated runner

**Status:** implemented; the first complete run is pending and nothing on this page is a result. This page says how the SDK image is run and what the arrangement does and does not protect. It is not an approval of the SDK image as a trust root: that remains the owner's decision ([ADR-0003](../adr/0003-prism-application-adoption.md), remaining decision 2).

**Owner of the requirement:** [issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9).

## The problem

The gate runs inside `ghcr.io/afflom/prismpm-sdk-patched@sha256:3dfa5f72…`, the image the template's `prismpm.lock` selects. It is published under a personal registry namespace. A digest fixes its bytes. It says nothing about who published them or what they do. The first qualification runs gave that image the Docker socket on a machine that held session credentials.

## The arrangement

[`prism-native-gate.yml`](../../.github/workflows/prism-native-gate.yml) runs every SDK command on a GitHub-hosted runner: a virtual machine created for one job, with its own Docker daemon, destroyed when the job ends.

| Requirement in issue #9 | How it is met | Where it is enforced or checked |
| --- | --- | --- |
| Disposable runner with its own daemon | GitHub-hosted `ubuntu-24.04`, one VM per job | workflow `runs-on` |
| Credential-free | No secret is referenced. The token has no permission (`permissions: {}`). The first step fails if any variable name in the job environment looks like a credential. The user that starts the container has an empty home and an environment built from nothing (`env -i`) | workflow; [`prism_reference_gate.sh`](../../scripts/prism_reference_gate.sh) refuses again on its own check |
| No host Docker socket | The socket is never mounted into the SDK container. The wrapper's opt-in variable does not appear in the workflow or the driver | `tests/test_prism_native_gate_workflow.py` |
| No recursive change to a real checkout | The wrapper clones the source into a new directory and gives only that copy to uid 1000. Repositories on the runner are anonymous clones made for the job | `tests/test_prism_gate_wrapper.py` |
| Narrow, auditable network | The container joins an internal Docker network with no route out. The only exit is [`prism_egress_proxy.py`](../../scripts/prism_egress_proxy.py), which tunnels to three exact hosts on port 443 and logs every request, allowed or refused. The runner accepts connections from that network on the proxy port only | workflow; the driver's `egress-control` step, run from inside the container before the gate |
| Unreduced gate | The instance's own `just vv`, unchanged. The driver adds checks before and after it and removes none | [`prism_native_gate.sh`](../../scripts/prism_native_gate.sh) |
| Refusals before a container starts | Credentialed runner, symlinked or dirty checkout, unexpected or mutable image, reused work directory, network that is not internal | wrapper tests with a stand-in for `docker` |
| No image deletion or replacement | The image is pulled by digest onto the throwaway VM. Nothing is deleted anywhere else | workflow |

Allowed hosts: `static.crates.io`, `index.crates.io` (crates) and `github.com` (the RustSec advisory database, read by `just deny`). The image itself comes from `ghcr.io` and `pkg-containers.githubusercontent.com`, pulled by the runner's daemon before any container exists.

## The jobs

| Job | What it runs | Permission |
| --- | --- | --- |
| `SDK / reference` | The upstream template's own application, pristine, through `just vv` | none |
| `SDK / author` | `lexlean lock` and `lexlean fmt` on the overlay's model, and emits the files the tools wrote | none |
| `SDK / nested` | The Qortara Skills Eligibility instance nested at `prism/` under the root governance files: preflight, egress control, complete `just vv`, offline repeat, planted defects | none |
| `Real holo outputs` | The built holo through `prism-code@0.9.5`, [`sm01_probe.mjs`](../../scripts/sm01_probe.mjs) and the [local CLI](local-cli.md), on a second VM that never ran the SDK image | none |
| `Publish … evidence` | Copies the uploaded files, byte for byte, to a new `evidence/prism-native-gate-<run>` branch. Runs only after every job above passed. It never starts the SDK image, the runtime or the holo | `contents: write` |

The nested phase builds a throwaway repository on the runner: one commit of this repository's `AGENTS.md`, `GOVERNANCE.md`, `SECURITY.md`, `ARCHITECTURE_INDEX.md` and `docs/README.md`, then one commit that adds `prism/` from the pinned template and [`prism-overlay/`](../../prism-overlay/README.md). The second commit is the installing commit `audit-prism` measures. Author identity and dates are fixed, so the commit and tree hashes depend only on the two pinned inputs.

## What differs from the template's own bootstrap

The template's `bootstrap.yml` is universal policy. It stays byte-identical under `prism/` and inert, because GitHub runs only workflows at a repository's root. This workflow is not that file and does not claim to be.

- Upstream's bootstrap mounts the Docker socket and, before `just vv`, checks Buildx, the image's two-platform manifest and the devcontainer CLI. Those three checks need the socket. They are **not run here**.
- `just vv` itself is the same recipe, run once, in order.
- Upstream runs the gate on `linux/arm64` as well for `main` and tags. Only `linux/amd64` is run here.
- Upstream may reuse a kept proof on pull requests. Every run here proves in full.

So the honest statement is: *the directory `prism/` is a byte-conformant instance whose complete `just vv` is run by a project workflow, without the bootstrap's socket-dependent pre-checks*.

## What this arrangement does not establish

- **That the image is trustworthy.** It limits what the image can reach. It does not inspect what the image does with what it is given. The staged source and the build outputs are fully under its control, so a receipt it writes is evidence only as far as that toolchain is trusted.
- **Isolation stronger than a container on a throwaway VM.** The boundary is Docker's default confinement, with no socket and no added privilege. A container escape would reach a runner that holds a token with no permission and no secret.
- **A hermetic build.** `just deny` reads the RustSec advisory database at the moment it runs. A pass is reproducible only together with that state.
- **Anything about a GitHub-hosted runner beyond what GitHub documents.** The runner image, its preinstalled software and its network are GitHub's.

## Running it

A pull request that changes the overlay, the wrapper, the driver, the proxy, the probe or the CLI starts the workflow. A pull request from a fork never starts the SDK image. `workflow_dispatch` runs it on demand once the workflow is on the default branch.

To change the model, follow the `prism-model-first` skill: edit the authored files, let the `author` job run the tools, and commit the files exactly as it emitted them. `lexlean.lock` is never typed by hand.

To use a different runner, it must meet every row of the first table. The wrapper's refusal on a credentialed machine is the answer, not an obstacle to route around.
