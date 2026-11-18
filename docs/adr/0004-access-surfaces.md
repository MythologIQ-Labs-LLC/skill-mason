# ADR-0004: Qortara Skills customer access surfaces

**Status: Accepted product direction, 2026-11-17. Implemented: local CLI (development-only), browser interface in progress. Local MCP not implemented.**

## Owner decision

1. Local CLI first. Implementing a non-privileged, fail-closed Prism client is the fastest path to actual native output inspection. The existing CLI is development-only and does not yet generate SKILL.md.
2. GitHub Pages web app second. It is the planned human-facing experience and future Spectrum capability interface. An initial client-side Prism output lab may run only verified, independently pinned .holo fixtures with no server-side secrets or uploads.
3. Local MCP third. Prefer stdio launched by the consuming agent and local machine. No duplicate eligibility model, installation permission, or network server by default.
4. Remote hosted MCP deferred. No new hosted service, tenant/auth gateway, Cloudflare Worker or payment system is authorized by this decision.

## Architecture boundaries

Prism remains the sole eligibility decision substrate. All surfaces may authenticate assertions, safely transport input/output, check cryptographic digests, refuse unsupported operations, and record receipts. They may not invent trusted source evidence, override a Prism refusal, silently install skills or perform source-corpus writes.

GitHub Pages is static hosting, **not a host for any MCP transport endpoint**. A future browser MCP client is not the same as an MCP server. MCP stdio requires the caller to run a local process; HTTP requires a separately authorized server.

## Evidence and completion

A user-visible page does not establish that a genuine holo ran. The CLI, browser and future MCP require a final named artifact, independent digest, exact SDK/runtime pins, positive and negative cases, and a report of the actual Prism outputs. Current holo assurance remains P0 unverified, and native Qortara/security issue #4 plus SDK isolation #9 remain distinct holds. Full skill generation, source rights, production policies and token instrumentation are not complete.
