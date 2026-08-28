# Analytics data-quality standards

## Required checks

Every analysis selects checks appropriate to its grain and decision:

- completeness: missing required identifiers/values and incomplete periods
- uniqueness: exact/composite-key duplicates at intended grain
- validity: date parsing/order, allowed states, ranges and unexpected negatives
- consistency: currency/unit/status/timestamp agreement
- integrity: tenant-safe parent-child coverage and join expansion/loss
- timeliness: source freshness and late-arriving partitions
- volume/shape: row/category drift and schema additions/removals/retypes
- reconciliation: mismatched source/result totals where a control total exists
- outliers: robust IQR/MAD/quantile review before hard exclusions

## Status semantics

| Status | Meaning | Consumer behaviour |
| --- | --- | --- |
| `good` | Required checks pass | May present with normal metric caveats |
| `warning` | Output may be useful but is stale, incomplete or low-signal | Show warning/stale state; do not overstate confidence |
| `blocked` | Grain, validity or isolation failure can materially mislead | Do not present as decision-ready; fall back or request remediation |

Critical grain/tenant failures block. Stale or empty snapshots warn. Empty data must
never be rendered as proof that performance is zero/normal.

## Current automated checks

- source freshness
- empty dataset
- duplicate task/product identifiers
- task lifecycle date sequence
- unexpected negative inventory values
- Pydantic contract/schema validation

## Schema drift

New APIs forbid unknown envelope fields and validate analysis-specific records.
Additive source fields may be ignored only where the pilot explicitly permits them.
Removing, retyping or changing required meaning requires a contract/version change.

## Outlier policy

Outliers are flags for review, not automatically deleted observations. Any exclusion
must record method, threshold, affected count, decision impact and owner approval.

## Test fixtures

Normal tests use deterministic synthetic fixtures for valid, empty, stale, duplicate,
negative and invalid-date cases. Live production data is never required by CI.
