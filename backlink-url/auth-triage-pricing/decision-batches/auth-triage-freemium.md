# Pricing Review Decision Batch: auth-triage-freemium

Generated: 2026-05-27T10:35:00.661Z
Draft: backlink-url/auth-triage-pricing/pricing-review-decision-draft.csv
Offset: 0
Limit: 20
Matching rows: 8
Batch rows: 8
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 8

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| mark_freemium | 8 |

### Confidence

| Confidence | Count |
|---|---:|
| low | 1 |
| medium | 7 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 6 | ashlist-com | ashlist.com | mark_freemium | freemium | (blank) |
| 2 | 12 | offpagesavvy | offpagesavvy.com | mark_freemium | freemium | (blank) |
| 3 | 21 | solvertools-com | solvertools.com | mark_freemium | freemium | (blank) |
| 4 | 26 | thecoretools-com | thecoretools.com | mark_freemium | freemium | (blank) |
| 5 | 27 | tinytoolhub-com | tinytoolhub.com | mark_freemium | freemium | (blank) |
| 6 | 28 | toolcosmos-com | toolcosmos.com | mark_freemium | freemium | (blank) |
| 7 | 35 | trustiner-com | trustiner.com | mark_freemium | freemium | (blank) |
| 8 | 39 | broadwise-org | broadwise.org | mark_freemium | freemium | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-freemium.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-freemium.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/auth-triage-pricing/decision-batches/auth-triage-freemium.csv
- Batch JSON: backlink-url/auth-triage-pricing/decision-batches/auth-triage-freemium.json
