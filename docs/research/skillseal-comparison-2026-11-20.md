# Deferred external research: SkillSeal and Skill Mason

**Recorded:** 2026-11-20. **State:** RESEARCH_PRESERVED; **no integration authorization or active development priority**.

**Current owner direction:** Continue Skill Mason's original evidence-driven skill generation and qualitative qualification roadmap. Do not divert engineers to SkillSeal interoperability, package deployment or a merged product. Revisit only after Skill Mason's core skill qualification and consuming-host behavior are demonstrated and the owner explicitly decides to reopen comparison.

## Immutable comparison scope

- External: [getskillseal/skillseal](https://github.com/getskillseal/skillseal/tree/d9492d73b671609ebcd888404ded6679183fd8b3) commit `d9492d73b671609ebcd888404ded6679183fd8b3` (2026-08-13); own [MIT license](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/LICENSE).
- Internal: [Skill Mason](https://github.com/MythologIQ-Labs-LLC/skill-mason/tree/8df838031162eef5845e605a1ab4b0542551f41e) commit `8df838031162eef5845e605a1ab4b0542551f41e` (2026-11-20), preceding this note.
- Research method: read public GitHub code, docs, CI and catalog via the connected repository API; **no local installation or fresh adversarial execution** during comparative review. Distinguish directly observed implementation from claims or untested failure scenarios. External repository findings were not submitted to its maintainers.

## Product boundary

**SkillSeal:** content-addressed, publisher-signed **distribution, download verification and installation** of existing Agent Skills folders. The Node CLI implements v1 tokens, shorter v2 signed-manifest pointers, Ed25519 key checks, publisher trust-on-first-use, optional DNS-domain verification, an offline identity-rotation chain, host directory detection, lockfiles and multi-source retrieval (S3/IPFS-compatible). It does not independently establish source reuse rights, determine correct methods for a requested outcome, compose new task-specific procedures or qualify real consuming-host behavior.

**Skill Mason:** pinned corpus discovery, source-method provenance, task/capability fit and missing essential outcomes, separate rights/asset/host governance, modeled Prism eligibility/refusal, deterministic developmental composition, source/decision receipts and explicit behavioral acceptance requirements. Its ordinary public `create` is **not** an approved generator. P0 receipt composition, synthetic signed fixtures and browser starter drafts must not be confused with production assurance. No production skill distribution/host install system exists here.

These are **complementary lifecycle stages, not duplicate products**. A published cryptographic signature answers *which bytes and key*, not *whether the skill is correct, legally reusable or safe*.

## Findings worth revisiting later

**Potential reusable ideas:** short signed manifest pointer, content-addressed multi-mirror storage, plain Agent Skills installation without a mandatory plugin, publisher key identity continuity, signed update provenance, skill-specific lockfile and offline verification, simple public browsing and distribution. Any use must preserve Skill Mason's existing immutable source/approval evidence and independent host outcomes.

**External qualification cautions, requiring independent validation before reuse:**
- SkillSeal's [installer](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/skillseal/install.mjs) prepares files in a temporary directory, then writes individual files to target directories rather than atomically promoting a complete tree; interrupt/rollback and path containment deserve dedicated tests.
- The [lockfile verifier](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/skillseal/lock.mjs) checks listed files, but additional unexpected files and missing v2 file inventories require stronger complete-tree verification.
- The [publisher identity](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/skillseal/identity.mjs) path deliberately supports a **shared demo signing seed** and a weaker identity outcome when domain-binding cannot be established. Neither is a production rights/issuer approval.
- The [hub catalog](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/web/hub/catalog.json) had **193** unique recorded skill addresses at inspection, all with long v1-style tokens. Its [builder](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/web/hub/build-catalog.mjs) defaults missing license metadata to `MIT`; this is a **display default**, not proof of downstream permission to redistribute each independently authored skill.
- Its latest main-commit [CI](https://github.com/getskillseal/skillseal/blob/d9492d73b671609ebcd888404ded6679183fd8b3/.github/workflows/ci.yml) passed but does not directly invoke the v2-specific `skillseal/test/v2.test.mjs`; a successful demonstration is narrower than an installer security audit.
- Skill Mason's current output and SkillSeal's expected Agent Skills input overlap at `SKILL.md`; **no exact package-format interoperability has been implemented or demonstrated**.

Do not publish detailed security reproductions concerning an unrelated upstream project in this research note. Validate any suspected vulnerability responsibly before using or reporting it. No known exploit success is asserted.

## Parked hypothesis, **not a roadmap commitment**

A future integration could combine: `Skillz source → Skill Mason qualification and deterministic output → independent host trials and owner approval → publisher-signed verifiable package → safe host installation`.

Potential approaches: protocol-compatible export, independently maintained adapter, or explicit upstream collaboration. Repository merge or code import is **not recommended now**. An upstream MIT license applies to its own code, not automatically to the 193 catalog entries. Any later integration must first prove secure installation, independent trust custody and an exact round-trip of Skill Mason's `SKILL.md`, `SOURCES.json`, `RECEIPT.json` and `skill-mason.json` without assurance promotion.

**Reopen criteria:** owner explicitly authorizes investigation after (1) an actual rights-accepted source method, (2) a verified positive Prism composition, (3) independent consuming-host task acceptance, and (4) a published coherent user workflow for Skill Mason.

**Current return point:** [corpus integration issue #30](https://github.com/MythologIQ-Labs-LLC/skill-mason/issues/30), essential-outcome qualification, authentic source rights and behavioral quality. No additional SkillSeal tasks should be created from this note.
