# Web app and future local MCP

**Owner direction (2026-11-17): local CLI first, GitHub Pages second, local stdio MCP third, hosted remote MCP deferred.**

## GitHub Pages interface

The Pages app is a static, browser-only Prism development client. It has no hosted API, server process, accounts, analytics, model inference or file upload. Users select an actual, independently pinned Qortara Skills Eligibility holo, acknowledge development-only P0, verify the SHA-256 and Prism's pure-world policy, then inspect raw bytes returned by the real holo. The interface contains no duplicate eligibility algorithm.

At this stage the interface is **not** a skill generator. It cannot certify catalog provenance, evidence, rights, authority, outcome coverage, installation or production readiness.

### Build and test

On a disposable Node.js 22+ build checkout with approved registry trust:

~~~bash
npm install --no-save --ignore-scripts --package-lock=false prism-code@0.9.5 esbuild@0.25.12
node --test web/tests/*.test.mjs
node web/build.mjs
~~~

Source is in `web/`. Output is in `web-dist/`, with relative URLs suitable for a GitHub Pages project subpath. The build bundles Prism's pinned browser JavaScript locally and includes the established Qortara Skills banner and icon. No SDK native gate, Docker socket or holo is built by this workflow. The build tool and package versions are pinned, but registry supply-chain acceptance remains a separate gate.

GitHub Actions builds the site for PRs and attempts deployment only after a merge to `main`. A successful CI build is **not proof of a live Pages URL**. If Pages is not enabled, the owner must use repository Settings → Pages → Build and deployment → Source: GitHub Actions. The workflow requests enablement but actual permissions and deployment must be observed.

### Security

Public Pages cannot store secrets, enforce private host authority, or accept dynamic MCP requests. A user-selected holo is kept in browser memory and dispatched locally; no file upload is made. A pasted SHA-256 can detect substitution against an independently retained receipt, but does not prove who authored or signed the artifact. Acceptance is P0 fixture-only until a compatible and verified proof level is established. Production state is always false.

## Why not host MCP on Pages?

GitHub Pages serves static HTML/CSS/JavaScript and cannot run an MCP server. MCP requires a live stdio or Streamable HTTP process to handle tool calls. Even when Prism code runs in a browser, that page cannot become the public MCP endpoint served by GitHub Pages.

After the CLI and Pages functionality are tested, the next priority is a **local MCP server using stdio**. A compatible agent starts the process on the user's machine; no Cloudflare Worker, hosted gateway or open network port is required. The server must be a thin boundary over the same verified Prism contracts with explicit authority and host controls. Remote MCP is deferred.

References: [SM-01 local CLI](local-cli.md), [output probe](sm01-output-probe.md), [Prism ADR-0003](../adr/0003-prism-application-adoption.md), [runner isolation issue #9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9), [native governance and security issue #4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4).
