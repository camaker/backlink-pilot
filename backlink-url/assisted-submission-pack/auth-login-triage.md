# Auth Login Triage

Generated: 2026-05-27T10:27:45.503Z
Source queue: backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv
Source audit: backlink-url/assisted-submission-pack/auth-login-audit.json

Policy: read-only triage only. No login, no scout, no submission, no registry writes.

## Summary

- Rows: 69
- Pricing review before login: 44
- Dedupe before login: 3
- Registry recheck before login: 2
- Manual surface review before login: 3
- Direct manual login rows: 17

### By Action

| Action | Count |
|---|---:|
| dedupe_same_site_before_login | 3 |
| manual_login_then_rescout | 17 |
| manual_surface_review_before_login | 3 |
| pricing_review_before_login | 44 |
| registry_recheck_before_login | 2 |

## Files

- Triage CSV: backlink-url/assisted-submission-pack/auth-login-triage.csv
- Pricing review queue CSV: backlink-url/assisted-submission-pack/auth-login-pricing-review-before-login.csv
- Dedupe queue CSV: backlink-url/assisted-submission-pack/auth-login-dedupe-before-login.csv
- Registry recheck queue CSV: backlink-url/assisted-submission-pack/auth-login-registry-recheck-before-login.csv
- Manual surface review queue CSV: backlink-url/assisted-submission-pack/auth-login-manual-surface-review-before-login.csv
- Direct login queue CSV: backlink-url/assisted-submission-pack/auth-login-direct-login-queue.csv

## Safe Next Commands

```powershell
node src/cli.js targets pricing-review-queue --target-file backlink-url/assisted-submission-pack/auth-login-pricing-review-before-login.csv --output-dir backlink-url/auth-triage-pricing
node src/cli.js targets auth-login-plan backlink-url/assisted-submission-pack/auth-login-direct-login-queue.csv --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output backlink-url/assisted-submission-pack/auth-login-plan-triaged.json --csv-output backlink-url/assisted-submission-pack/auth-login-plan-triaged.csv
```

## Direct Login Rows

| Order | Priority | Target ID | Domain | Flags |
|---|---|---|---|---|
| 1 | P0 | ai-tool-guru | aitoolguru.com | no_persisted_form_evidence |
| 2 | P0 | ai-tools-arena | aitoolsarena.com | required_fields_unmapped |
| 3 | P0 | alternative-me | alternative.me | no_persisted_form_evidence |
| 4 | P0 | bestofai | bestofai.com | no_persisted_form_evidence |
| 5 | P0 | chatgptdemo | chatgptdemo.com |  |
| 6 | P0 | f6s | f6s.com | no_persisted_form_evidence |
| 7 | P0 | favird | favird.com | no_persisted_form_evidence |
| 8 | P0 | ai-infinity | forms.gle | shared_form_host; no_persisted_form_evidence |
| 9 | P0 | gpt-forge | forms.gle | shared_form_host; no_persisted_form_evidence |
| 10 | P0 | nextpedia | nextpedia.io | required_fields_unmapped |
| 11 | P0 | promptzone | promptzone.com |  |
| 12 | P0 | resource-fyi | resource.fyi |  |
| 13 | P0 | sitelike | sitelike.org | submit_button_missing |
| 14 | P0 | startup-collections | startupcollections.com | required_fields_unmapped |
| 15 | P0 | startuptracker | startuptracker.io | no_persisted_form_evidence |
| 16 | P0 | the-hack-stack | thehackstack.com | required_fields_unmapped |
| 17 | P0 | tools-robingood-com | tools.robingood.com | no_persisted_form_evidence |

