# Qortara Skills: GitHub Pages access

**Priority 2:** public browser application after local CLI. Hosted remote MCP is deferred; user-hosted stdio MCP comes third.

## User journey

1. Describe the skill outcome in plain language. No .holo file, SHA-256 or Prism knowledge is required for the ordinary user path.
2. Select **Create starter skill**. An offline deterministic, bounded template formats that request into a structured `SKILL.md`. The output is visibly labeled **starter draft**, includes unverified provenance and explicit host/security limitations, and does not claim to be a qualified skill.
3. Review, copy or download the resulting text. No skill installation or host activation occurs.

The initial workflow does **not** retrieve the pinned `skillz` catalog, qualify source/reuse rights, compile a Prism application, use an LLM, or establish method coverage. The generic draft contains no invented domain expertise. A fully qualified skill compiler remains the primary development objective, not a delivered claim.

### Prism developer diagnostics

A separate collapsed **Developer tools** section retains the existing real `Qortara Skills Eligibility` `.holo` loading, externally pinned digest, explicit P0 consent, raw-byte guest dispatch and 12-vector replay. This still requires a native artifact created in an isolated qualified Prism build. Passing static browser tests does not demonstrate such an execution.

### Verdant visual animation

The small rotating prism is rendered using an exact, locally vendored module from **Verdant Engine**, `afflom/verdant-engine@c21176cf24c51d9a0de07f649cefe2ee4b522093`, under the original MIT option (see [notice and source](../../web/vendor/verdant/NOTICE.md)). The renderer is presentation-only; it never executes a Prism model or decides eligibility.

States are `idle`, `working` (formatting a starter locally), `draft` and `refused`. No state named 'verified' or 'published' exists in the animation. A CSS fallback appears if WebGL2 is unavailable; `prefers-reduced-motion` disables animation.

## Build and testing

On a disposable, approved Node 22+ checkout:

~~~sh
npm install --no-save --ignore-scripts --package-lock=false prism-code@0.9.5 esbuild@0.25.12
node --test web/tests/*.test.mjs
node web/build.mjs
~~~

The Pages workflow bundles the pinned browser Prism runtime and local Verdant renderer, runs safety/regression tests, and publishes the static site after merge. It does not run the 21 GB native Prism SDK, accept an unqualified holo, or call LLM providers.

GitHub Pages deployment first succeeded in [run 44206841779](https://github.com/MythologIQ-Labs-LLC/skill-mason/actions/runs/44206841779) at https://mythologiq-labs-llc.github.io/skill-mason/. HTTP smoke-testing, interactive regression on an actual browser, real-holo dispatch and all generated-skill behavioral tests remain separate.

## Trust and authority

- User text is bounded, normalized and escaped before inclusion in draft Markdown. Results are created entirely client-side, and downloaded locally; no telemetry or uploads.
- The output marks source methods, Prism evaluation, host qualification and model-call instrumentation as **not established**. A deterministic template makes no claim about catalog evidence.
- Importing or adapting a `skillz` method requires pinned records, rights, coverage, host authority, version/freshness and actual Prism decision; none may be inferred from a user's request.
- Pages is static hosting. It cannot itself serve MCP tools, store server-side secrets, or authorize host actions.
- Qortara governance/security reporting [#4](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/4), native SDK isolation [#9](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/9), and independent P0/P2 proof concerns are unchanged.

See [local CLI](local-cli.md), [Prism output probe](sm01-output-probe.md), [ADR-0003](../adr/0003-prism-application-adoption.md), and [ADR-0004](../adr/0004-access-surfaces.md).
