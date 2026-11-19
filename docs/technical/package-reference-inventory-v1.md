# Exact-source package reference and asset-rights inventory (C3 to C5)

**Status: Development candidate; source evidence only.** The package inspector now emits a bounded, deterministic review queue for every original verified package file, including a source-specific license pointer and nested Markdown dependency leads. This is not license clearance, complete dependency closure, semantic method evidence or permission to generate/install a skill.

Implementation: [package_reference_inventory.py](../../scripts/package_reference_inventory.py). Integrated into the [exact third-party Git resolver](../../scripts/external_package_resolver.py). Negative controls: [test_package_reference_inventory.py](../../tests/test_package_reference_inventory.py).

## Input and trust contract

The consumer starts **after** the separate external resolver has verified a selected governed record against its original repository commit, root Git tree, package subtree and SKILL.md blob, checked that the actual checkout inventory contains no missing, extra, ignored or symlinked files, and hashed every file against its original Git object. The scanner accepts the original verified bytes plus the complete file/hash receipt. It rechecks path/digest/count agreement and refuses extra/missing files rather than trusting a caller-supplied list.

No network fetch, code execution, package installation, license acceptance, host call or compilation occurs.

## Source-specific review inventory

Each verified file carries its exact relative path, Git blob ID, SHA-256, byte length, preliminary role classification and explicit `UNASSESSED` rights/`NOT_ESTABLISHED` host permissions. Categories distinguish entrypoint instructions, licenses/notices, Markdown references, scripts/executables, media/binary assets and other files.

For every Markdown file in the exact package, the scanner resolves bounded inline Markdown links **relative to that file's own directory**, including nested references, percent-decoding, URL query/fragment components and parent-directory safety. It distinguishes matched package-file leads, missing local references, outside-package references and remote/scheme references. It never follows references outside the already verified package.

The Agent Skills entrypoint also receives a conservative **frontmatter `license:` lead** scan. For example, the original exact-pinned Anthropic `frontend-design` source declares "Complete terms in LICENSE.txt". Its two verified files are `SKILL.md` and `LICENSE.txt`, and the report records the exact in-package license pointer and SHA-256 of the field text. A pointer to `../LICENSE.txt` or a remote license URL cannot masquerade as the in-package license. An SPDX-like string may be recorded as text but does not establish file content or legal clearance.

**Known limitations:** Inline Markdown links and one frontmatter license field are not exhaustive dependency analysis. The scanner cannot reliably infer dynamic imports, shell commands, external APIs, model/tool requirements, reference-style links, embedded URLs, image use encoded in source, transitive dependencies, asset authorship or rights. It may over- or under-identify text leads. None of those gaps becomes a positive source qualification. All final status flags remain false: `dependency_closure_proven`, `all_instructional_references_closed`, `each_asset_rights_cleared`, `source_license_and_notice_obligations_assessed`, `target_host_approved` and `composition_eligible`.

The output is **bounded metadata and hashes only**; it does not copy source code or legal terms to the result. Source files are preserved separately in the exact-pinned checkout, not imported into the Skill Mason catalog.

## CI acceptance

The [external source workflow](../../.github/workflows/external-package-probe.yml) runs 19 synthetic adversarial tests plus the exact full-package Anthropic source verifier. The real-source acceptance requires two original verified files, one matching frontmatter pointer to `LICENSE.txt`, no inferred rights or closure and zero eligible methods. The wider corpus workflow continues to test the pinned 1,043 governed records and 66,139 raw source observations without replacing their independent review states.

## Remaining qualification

An independent reviewer must examine each source and asset's actual authorship, notices and license obligations for a **specific proposed use**, close relevant script/reference/data dependencies, establish legal modification/distribution rights where applicable, verify host/tool authority, then produce appropriate signed evidence bound to an exact source and coverage claim for the existing Prism composer. A package containing an Apache-2.0 text file is **not by itself** that full rights acceptance.

The source inspection can guide these next steps, but it does not replace native Qortara governance or owner acceptance. PR #28's P0 synthetic signer stays synthetic and cannot be promoted by this inventory. No new skill is admitted by this work.
