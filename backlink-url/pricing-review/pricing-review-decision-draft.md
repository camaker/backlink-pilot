# Pricing Review Decision Draft

Generated: 2026-05-27T06:57:31.484Z

Policy: editable human decision draft only. It does not write the registry, does not approve submissions, and intentionally leaves `review_decision` blank.

## Summary

- Rows: 1
- Rows requiring human review: 1

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 1 |

### Suggested Pricing

| Pricing | Count |
|---|---:|
| unknown | 1 |

## Rows

| Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|
| 1 | cooltools | backdata.net | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Use `mark_paid` only when no free submission path exists; it will downgrade the target to `skip` if written.
4. `mark_free` can make an already `auto_safe` target eligible for future free-only planning after audit; use it only with clear evidence.
5. `mark_freemium` records a free-plus-paid path but does not count as `free` in the current free-only planner.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.csv --json
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Draft CSV: backlink-url/pricing-review/pricing-review-decision-draft.csv
- Draft JSON: backlink-url/pricing-review/pricing-review-decision-draft.json
