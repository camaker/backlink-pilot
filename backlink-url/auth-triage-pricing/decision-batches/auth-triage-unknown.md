# Pricing Review Decision Batch: auth-triage-unknown

Generated: 2026-05-27T10:35:00.666Z
Draft: backlink-url/auth-triage-pricing/pricing-review-decision-draft.csv
Offset: 0
Limit: 20
Matching rows: 14
Batch rows: 14
Remaining after batch: 0

Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.

## Summary

- Rows requiring human review: 14

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 12 |
| needs_manual_check | 2 |

### Confidence

| Confidence | Count |
|---|---:|
| low | 14 |

## Rows

| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|---|
| 1 | 1 | 247webdirectory | 247webdirectory.com | keep_unknown | unknown | (blank) |
| 2 | 2 | asr | activesearchresults.com | keep_unknown | unknown | (blank) |
| 3 | 3 | ai-ailookme | ailookme.com | keep_unknown | unknown | (blank) |
| 4 | 4 | ai-nav | ainavpro.com | keep_unknown | unknown | (blank) |
| 5 | 7 | foundr-ai | foundr.ai | needs_manual_check | unknown | (blank) |
| 6 | 8 | hhlink-com | hhlink.com | keep_unknown | unknown | (blank) |
| 7 | 9 | iforai | iforai.com | keep_unknown | unknown | (blank) |
| 8 | 37 | xinquji-com | xinquji.com | needs_manual_check | unknown | (blank) |
| 9 | 38 | aitoptools | aitoptools.com | keep_unknown | unknown | (blank) |
| 10 | 40 | dizkaz-com | dizkaz.com | keep_unknown | unknown | (blank) |
| 11 | 41 | gainweb-org | gainweb.org | keep_unknown | unknown | (blank) |
| 12 | 42 | openfuture-ai | openfuture.ai | keep_unknown | unknown | (blank) |
| 13 | 43 | www-ruanyifeng-com | ruanyifeng.com | keep_unknown | unknown | (blank) |
| 14 | 44 | wechalet-cn | wechalet.cn | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Run validation on this batch before any apply command.
4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-unknown.csv --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/auth-triage-pricing/decision-batches/auth-triage-unknown.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Batch CSV: backlink-url/auth-triage-pricing/decision-batches/auth-triage-unknown.csv
- Batch JSON: backlink-url/auth-triage-pricing/decision-batches/auth-triage-unknown.json
