# Pricing Review Decision Batch: pricing-potential-free-001

Generated: 2026-05-23T11:20:10.131Z
Draft: backlink-url/pricing-review/pricing-review-decision-draft.csv
Offset: 0
Limit: 10
Matching rows: 7
Batch rows: 7
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 7

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| mark_free | 2 |
| mark_freemium | 5 |

### Confidence

| Confidence | Count |
|---|---:|
| high | 2 |
| medium | 5 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 9 | changelog | changelog.com | mark_freemium | freemium | (blank) |
| 2 | 17 | mergeek | mergeek.com | mark_free | free | (blank) |
| 3 | 29 | sonic-run | sonicrun.com | mark_free | free | (blank) |
| 4 | 41 | top-best-alternatives | topbestalternatives.com | mark_freemium | freemium | (blank) |
| 5 | 44 | trustiner-com | trustiner.com | mark_freemium | freemium | (blank) |
| 6 | 45 | websitehunt | websitehunt.co | mark_freemium | freemium | (blank) |
| 7 | 70 | submitdirs-com | submitdirs.com | mark_freemium | freemium | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/pricing-review/decision-batches/pricing-potential-free-001.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/decision-batches/pricing-potential-free-001.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/pricing-review/decision-batches/pricing-potential-free-001.csv
- Batch JSON: backlink-url/pricing-review/decision-batches/pricing-potential-free-001.json
