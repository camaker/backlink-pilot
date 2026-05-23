# Pricing Review Decision Batch: pricing-paid-high-001

Generated: 2026-05-23T11:20:10.132Z
Draft: backlink-url/pricing-review/pricing-review-decision-draft.csv
Offset: 0
Limit: 20
Matching rows: 33
Batch rows: 20
Remaining after batch: 13

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 20

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| mark_paid | 20 |

### Confidence

| Confidence | Count |
|---|---:|
| high | 20 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 6 | appalist-com | appalist.com | mark_paid | paid | (blank) |
| 2 | 7 | ashlist-com | ashlist.com | mark_paid | paid | (blank) |
| 3 | 15 | launchscroll-com | launchscroll.com | mark_paid | paid | (blank) |
| 4 | 18 | mylaunchstash-com | mylaunchstash.com | mark_paid | paid | (blank) |
| 5 | 20 | poweruptools-com | poweruptools.com | mark_paid | paid | (blank) |
| 6 | 21 | productlistdir-com | productlistdir.com | mark_paid | paid | (blank) |
| 7 | 22 | productwing-com | productwing.com | mark_paid | paid | (blank) |
| 8 | 23 | saasfield-com | saasfield.com | mark_paid | paid | (blank) |
| 9 | 24 | saashubdirectory-com | saashubdirectory.com | mark_paid | paid | (blank) |
| 10 | 25 | saasroots-com | saasroots.com | mark_paid | paid | (blank) |
| 11 | 26 | smartkithub-com | smartkithub.com | mark_paid | paid | (blank) |
| 12 | 27 | softwarebolt-com | softwarebolt.com | mark_paid | paid | (blank) |
| 13 | 28 | solvertools-com | solvertools.com | mark_paid | paid | (blank) |
| 14 | 30 | sourcedir-com | sourcedir.com | mark_paid | paid | (blank) |
| 15 | 31 | stackdirectory-com | stackdirectory.com | mark_paid | paid | (blank) |
| 16 | 32 | startupvessel-com | startupvessel.com | mark_paid | paid | (blank) |
| 17 | 33 | theapptools-com | theapptools.com | mark_paid | paid | (blank) |
| 18 | 34 | thecoretools-com | thecoretools.com | mark_paid | paid | (blank) |
| 19 | 35 | tinytoolhub-com | tinytoolhub.com | mark_paid | paid | (blank) |
| 20 | 36 | toolcosmos-com | toolcosmos.com | mark_paid | paid | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/pricing-review/decision-batches/pricing-paid-high-001.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/decision-batches/pricing-paid-high-001.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/pricing-review/decision-batches/pricing-paid-high-001.csv
- Batch JSON: backlink-url/pricing-review/decision-batches/pricing-paid-high-001.json
