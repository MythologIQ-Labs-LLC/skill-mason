# Capability and essential-outcome opportunity graph v1 (issue #30, C2 first tranche)

**Status:** Read-only implementation candidate, scoped to the recognized source taxonomy. No method/asset admission, license decision, Prism execution, host behavior proof or owner acceptance is implied.

## Inputs, controls and meaning

scripts/capability_graph.py wraps the exact-pinned and source-verified corpus opportunity index. It reads four source-checked taxonomy files without creating a new authority:

1. registry/capability-directory.json: recognized 33 domains and 247 subdomain routes, matched exact governed review IDs and separate name-only leads.
2. registry/capability-outcome-register.json: exactly 247 rows with essential-outcome definitions, qualification status, statements, missing definitions and next-action notes.
3. registry/discovery/capability-domain-expansion-20261102.json: older provisional scope, **not** recognized.
4. registry/capability-scope-extensions-20261117.json: later proposed scope, **not** recognized.

The graph enforces route uniqueness, complete domain/subdomain/outcome coverage, all matched reviewed IDs present in the 1,043-record corpus, and bidirectional agreement between evidence-linked mappings and recognized paths. It refuses missing rows, unknown evidence-linked identities, drifted crosswalks and inconsistent outcome counts rather than making a partial graph.

**Important distinctions:**
- An evidence-linked review is a navigation link, NOT composable-method, rights, quality, security or behavioral approval.
- A name-only candidate is an unassessed lexical lead, NOT an evidence-backed method.
- An empty essential-outcomes array means the workflow still needs decomposition. A nonempty list is an *outcome definition*, not evidence that a method meets it.
- A null qualified-outcome count means NOT ESTABLISHED, not zero validated methods, zero demand or no candidate source.
- Rejected, retired and unmapped reviews retain their original statuses. G1–G3 / four-source observations are not automatically inferred to match subdomains.
- Cross-domain mappings to one exact review ID are retained without pretending they create distinct source packages.
- Recognized, prior provisional and new proposed scope remain distinct. A proposed capability must not inherit a recognized status merely by naming similarity.

## CLI

Requires the same two pinned local checkouts and Python 3 / Git as [C1](corpus-index-v1.md).

~~~sh
python3 -m scripts.capability_graph \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original summary

python3 -m scripts.capability_graph \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  show software-engineering/frontend

python3 -m scripts.capability_graph \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  search "testing" --limit 20
~~~

A route receipt exposes reviewed navigation identities with their actual review state, name-only leads, recorded essential-outcome definitions, unqualified counts and explicit rights/host/method gaps. Search is **lexical routing across recognized capability/outcome descriptions**, not authoritative semantic scoring. The graph never calls a model or source package.

## Qualification and next work

Synthetic tests exercise 33/247 count completeness, raw review IDs, crosswalk mismatch, rejected name-only hints, missing outcome rows and distinct proposed scope. The pinned CI checks the actual graph, source-family inventory and a recognized example. Exact-head test results and native Qortara/owner qualification must still be established separately.

C2 remains **partial** until explicit essential-outcome inputs, outputs, correctness, dependencies and failure handling are decomposed for each relevant requested workflow; capability-aware comparison covers all discoverable relevant source families; and unknown/absent/unreviewed/rejected are accounted for independently. This tranche deliberately does not invent workflow definitions where the source outcome register has none.

C3 is a separate stage: on-demand exact complete package and nested-asset resolution, independent reuse/modification/redistribution rights, source freshness, dependency/host/authority checks. No C2 result may flow into the composer or Prism as eligible until those gates are proven.
