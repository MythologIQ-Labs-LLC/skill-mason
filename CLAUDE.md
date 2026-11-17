# Skill Mason: Claude Code development entrypoint

These are **project-local development instructions**, not Skill Mason-generated agent skills and not catalog entries in `Knapp-Kevin/skillz`.

1. Read `AGENTS.md`, `ARCHITECTURE_INDEX.md`, `docs/README.md`, `GOVERNANCE.md`, `SECURITY.md`, and `docs/RFC-0001-prism-feasibility.md`. The register routes to the actual owner of every architectural claim.
2. **Before changing anything described as a Prism application**, invoke/read `.claude/skills/prism-source-gate/SKILL.md` and the exact upstream pins in `.claude/PRISM_SOURCES.md`. Source claims are evidence-bound, never guessed.
3. For application design and implementation, use `.claude/skills/prism-model-first/SKILL.md`. A Rust program importing `uor-prism` alone is **not** the model-first PrismPM/LexLean application promised by the project.
4. For build, proof, replay, holo and release claims, use `.claude/skills/prism-proof-audit/SKILL.md`. Distinguish `check`, `build`, `verify`, independent artifact checks, test results and external behavior.
5. **Stop before product code** if the pinned source does not establish the requested syntax, feature or command, the exact SDK lock cannot be authenticated, the application bootstrap route is unresolved, or the required development environment is absent. Record the gap in the existing RFC/issue with exact evidence, not a fictitious API.
6. Product architecture remains governed by Skill Mason owner acceptance. Source guides/skills cannot authorize merges, change Qortara policies, import unlicensed assets or manually append `.qortara` Shadow events.

The root `CLAUDE.md` is an orientation map. The three `.claude/skills/` files are Claude-only development procedures; never ingest them into `skillz` or the generated-skill output catalog. Verify Claude actually discovers them in the intended host/session before relying on automatic activation.
