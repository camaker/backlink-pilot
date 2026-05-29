# Pricing Review Decision Batch: three-sites-pricing-001

Generated: 2026-05-29T13:24:23.174Z
Draft: backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.csv
Offset: 0
Limit: 9
Matching rows: 9
Batch rows: 9
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 9

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 2 |
| mark_freemium | 3 |
| mark_paid | 4 |

### Confidence

| Confidence | Count |
|---|---:|
| high | 4 |
| low | 2 |
| medium | 3 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 1 | ai-ailookme | ailookme.com | keep_unknown | unknown | (blank) |
| 2 | 2 | poweruptools-com | poweruptools.com | mark_paid | paid | (blank) |
| 3 | 3 | saashubdirectory-com | saashubdirectory.com | mark_freemium | freemium | (blank) |
| 4 | 4 | softwarebolt-com | softwarebolt.com | mark_freemium | freemium | (blank) |
| 5 | 5 | solvertools-com | solvertools.com | mark_freemium | freemium | (blank) |
| 6 | 6 | theapptools-com | theapptools.com | mark_paid | paid | (blank) |
| 7 | 7 | toolsignal-com | toolsignal.com | mark_paid | paid | (blank) |
| 8 | 8 | weliketools-com | weliketools.com | mark_paid | paid | (blank) |
| 9 | 9 | alternativeto | alternativeto.net | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/submission-materials/pricing-review-three-sites/decision-batches/three-sites-pricing-001.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/submission-materials/pricing-review-three-sites/decision-batches/three-sites-pricing-001.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/submission-materials/pricing-review-three-sites/decision-batches/three-sites-pricing-001.csv
- Batch JSON: backlink-url/submission-materials/pricing-review-three-sites/decision-batches/three-sites-pricing-001.json
