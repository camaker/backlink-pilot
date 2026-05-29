# Pricing Review Decision Draft

Generated: 2026-05-29T13:24:02.567Z

Policy: editable human decision draft only. It does not write the registry, does not approve submissions, and intentionally leaves `review_decision` blank.

## Summary

- Rows: 9
- Rows requiring human review: 9

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 2 |
| mark_freemium | 3 |
| mark_paid | 4 |

### Suggested Pricing

| Pricing | Count |
|---|---:|
| freemium | 3 |
| paid | 4 |
| unknown | 2 |

## Rows

| Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|
| 1 | ai-ailookme | ailookme.com | keep_unknown | unknown | (blank) |
| 2 | poweruptools-com | poweruptools.com | mark_paid | paid | (blank) |
| 3 | saashubdirectory-com | saashubdirectory.com | mark_freemium | freemium | (blank) |
| 4 | softwarebolt-com | softwarebolt.com | mark_freemium | freemium | (blank) |
| 5 | solvertools-com | solvertools.com | mark_freemium | freemium | (blank) |
| 6 | theapptools-com | theapptools.com | mark_paid | paid | (blank) |
| 7 | toolsignal-com | toolsignal.com | mark_paid | paid | (blank) |
| 8 | weliketools-com | weliketools.com | mark_paid | paid | (blank) |
| 9 | alternativeto | alternativeto.net | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Use `mark_paid` only when no free submission path exists; it will downgrade the target to `skip` if written.
4. `mark_free` can make an already `auto_safe` target eligible for future free-only planning after audit; use it only with clear evidence.
5. `mark_freemium` records a free-plus-paid path but does not count as `free` in the current free-only planner.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.csv --json
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Draft CSV: backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.csv
- Draft JSON: backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.json
