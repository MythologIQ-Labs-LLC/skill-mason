# Capability candidate comparison receipt v1 (C4 discovery-only)

**Status:** Proposed. Exact pinned source, no rights/host-qualified method, no chosen method, no Prism invocation. This is a blocked-decision audit, not a complete method recommender.

## Objective

For one recognized capability route and a caller-named target host, explain the candidate evidence available *today* in the exact pinned corpus. A source reviewed as verified, rejected, retired, or unmapped is not silently omitted or upgraded. A verified package byte receipt alone cannot authorize method adaptation, reuse, release, or execution.

The scripts/candidate_comparison.py report separates four explicit levels:

1. **Evidence-linked governed reviews**: the exact recognized route crosswalk from the CapabilityGraph, preserving recorded review status, source class, all cross-domain evidence paths, and a categorical hold. Rejected and retired reviews are separately blocked. Verified-with-portability-caveats is never treated as equivalent to host acceptance.
2. **Complete first-party package bytes**: exact package inspection results from the separately tested C3 resolver when a linked record is first-party. Package files verified still implies no target rights or dependency closure; third-party package bytes are not assumed available.
3. **Name-only governed leads**: names, unknown IDs, and overlaps remain discovery hints, never proof of relevance or an acceptable method.
4. **Lexical source-path observations**: a bounded, explicit query scans every pinned G1-G3 and four-source row. Total literal matches and sampled pointers are included; source path observations are not semantic methods or independently qualified packages. This search is intentionally incomplete as a discovery measure because semantic relevance cannot be captured by the literal subdomain tokens alone.

No ranking, weighted quality score, approval, signer, transitive content copying, or broad "best skill" claim is computed. The report always shows chosen_method=null and eligible_candidate_count=0 until an actual rights/dependency/authority/host assessment has been implemented and independently accepted. Unknown sources remain unknown, not rejected or absent.

The target-host label is caller-supplied context only. It is not proof of a connected target host or its policies.

## Offline usage

Requires exact pinned skillz publication and original source checkouts.

~~~sh
python3 -m scripts.candidate_comparison \
  --handoff /path/to/skillz-publication/registry/exports/skill-mason-v1 \
  --source-checkout /path/to/skillz-original \
  --route software-engineering/frontend \
  --host ChatGPT --limit 25
~~~

Use --no-lexical when a full path-observation sweep is not requested; the receipt explicitly records that reduced search scope.

## Remaining completion criteria

C4 must eventually compare **all actual, independently relevant and admissible source methods**, not just evidence links, path keyword matches, and name hints. Necessary future work includes independent cross-snapshot taxonomy alignment, complete third-party source retrieval, evidence-backed essential-outcome decomposition, bounded semantic matching, exact authority/rights verification, transparent policy-restricted ranking, contradiction checks and outcome coverage metrics. The current receipt is explicitly NOT that.

The CI and adversarial tests in tests/test_candidate_comparison.py enforce zero selection and rejection/retirement preservation. Native Qortara validation, owner acceptance, actual Prism composition, agent-host success and release gates remain HOLD.
