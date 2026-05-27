# Pricing Review Decision Batch: auth-triage-paid

Generated: 2026-05-27T10:35:00.599Z
Draft: backlink-url/auth-triage-pricing/pricing-review-decision-draft.csv
Offset: 0
Limit: 30
Matching rows: 22
Batch rows: 22
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 22

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| mark_paid | 22 |

### Confidence

| Confidence | Count |
|---|---:|
| high | 22 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 5 | appalist-com | appalist.com | mark_paid | paid | (blank) |
| 2 | 10 | launchscroll-com | launchscroll.com | mark_paid | paid | (blank) |
| 3 | 11 | mylaunchstash-com | mylaunchstash.com | mark_paid | paid | (blank) |
| 4 | 13 | poweruptools-com | poweruptools.com | mark_paid | paid | (blank) |
| 5 | 14 | productlistdir-com | productlistdir.com | mark_paid | paid | (blank) |
| 6 | 15 | productwing-com | productwing.com | mark_paid | paid | (blank) |
| 7 | 16 | saasfield-com | saasfield.com | mark_paid | paid | (blank) |
| 8 | 17 | saashubdirectory-com | saashubdirectory.com | mark_paid | paid | (blank) |
| 9 | 18 | saasroots-com | saasroots.com | mark_paid | paid | (blank) |
| 10 | 19 | smartkithub-com | smartkithub.com | mark_paid | paid | (blank) |
| 11 | 20 | softwarebolt-com | softwarebolt.com | mark_paid | paid | (blank) |
| 12 | 22 | sourcedir-com | sourcedir.com | mark_paid | paid | (blank) |
| 13 | 23 | stackdirectory-com | stackdirectory.com | mark_paid | paid | (blank) |
| 14 | 24 | startupvessel-com | startupvessel.com | mark_paid | paid | (blank) |
| 15 | 25 | theapptools-com | theapptools.com | mark_paid | paid | (blank) |
| 16 | 29 | toolfinddir-com | toolfinddir.com | mark_paid | paid | (blank) |
| 17 | 30 | toolsignal-com | toolsignal.com | mark_paid | paid | (blank) |
| 18 | 31 | toolslisthq-com | toolslisthq.com | mark_paid | paid | (blank) |
| 19 | 32 | toolsunderradar-com | toolsunderradar.com | mark_paid | paid | (blank) |
| 20 | 33 | toptrendtools-com | toptrendtools.com | mark_paid | paid | (blank) |
| 21 | 34 | toshilist-com | toshilist.com | mark_paid | paid | (blank) |
| 22 | 36 | weliketools-com | weliketools.com | mark_paid | paid | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-paid.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-paid.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/auth-triage-pricing/decision-batches/auth-triage-paid.csv
- Batch JSON: backlink-url/auth-triage-pricing/decision-batches/auth-triage-paid.json
