# Auth Login Audit

Generated: 2026-05-27T10:11:04.969Z
Source queue: backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv

## Safety Policy

- Read-only audit only.
- No login, no submission, no scout, no registry writes.
- Use this audit to shrink the auth queue before asking a human to collect more login state.

## Summary

- Rows: 69
- Duplicate domain groups: 1
- Duplicate domain rows: 3
- Shared form host groups: 1
- Pricing unknown rows: 46
- Classification mismatch rows: 6
- Evidence gap rows: 60

## Suggested Actions

| Action | Count |
|---|---:|
| dedupe_same_site_before_login | 3 |
| manual_login_then_rescout | 17 |
| pricing_review_before_login | 44 |
| registry_recheck_before_login | 2 |
| manual_surface_review_before_login | 3 |

## Duplicate Domain Groups

| Group | Size | Target IDs |
|---|---:|---|
| betalist.com | 3 | beta-list, betalist-com, betalist |

## Shared Form Host Groups

| Group | Size | Target IDs |
|---|---:|---|
| forms.gle | 2 | ai-infinity, gpt-forge |

## Files

- Audit CSV: backlink-url/assisted-submission-pack/auth-login-audit.csv
- Audit JSON: backlink-url/assisted-submission-pack/auth-login-audit.json
- Audit Markdown: backlink-url/assisted-submission-pack/auth-login-audit.md

