# Pricing Review Decision Batch: cooltools-pricing-001

Generated: 2026-05-27T06:58:39.068Z
Draft: backlink-url/pricing-review/cooltools-draft/pricing-review-decision-draft.csv
Offset: 0
Limit: 10
Matching rows: 1
Batch rows: 1
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 1

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 1 |

### Confidence

| Confidence | Count |
|---|---:|
| low | 1 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 1 | cooltools | backdata.net | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/pricing-review/cooltools-batch/cooltools-pricing-001.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/cooltools-batch/cooltools-pricing-001.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/pricing-review/cooltools-batch/cooltools-pricing-001.csv
- Batch JSON: backlink-url/pricing-review/cooltools-batch/cooltools-pricing-001.json
