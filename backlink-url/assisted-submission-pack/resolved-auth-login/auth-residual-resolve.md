# Auth Residual Resolve

Generated: 2026-05-27T12:38:33.822Z
Source triage: backlink-url/assisted-submission-pack/auth-login-triage.json
Source residual: backlink-url/assisted-submission-pack/residual-shrink/auth-residual-shrink.json
Source queue: backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv

Policy: read-only queue resolution only. No login, no submission, no registry writes, no browser launch.

## Summary

- Triage direct-login rows: 17
- Residual keep-auth rows added back: 3
- Resolved direct-login rows: 20
- Resolved needs-scout rows: 1
- Resolved manual-review rows: 2
- Dropped duplicate rows: 2
- Still unresolved manual-review rows: 1

## Residual Decisions

| Target | Review Type | Resolution | Lane | Notes |
|---|---|---|---|---|
| beta-list | dedupe | keep_primary_auth_candidate | direct_login | dedupe score 77; persisted scout present; pricing:free; auth_required status; submit-like path; submit surface signal; auth or oauth signal; group primary: beta-list; persisted final: https://betalist.com/sign_in |
| betalist-com | dedupe | drop_duplicate_before_login | dropped | dedupe score 37; persisted scout present; auth_required status; generic or login path; submit surface signal; auth or oauth signal; group primary: beta-list; persisted final: https://betalist.com/sign_in |
| betalist | dedupe | drop_duplicate_before_login | dropped | dedupe score -30; status new; generic or login path; group primary: beta-list |
| mergeek | registry_recheck | move_out_of_auth_to_needs_scout | needs_scout | classification mismatch recorded; persisted submit surface signal; required unmapped fields: 1 |
| top-best-alternatives | registry_recheck | move_out_of_auth_to_manual_surface_review | manual_review | classification mismatch recorded; search-only surface; oauth signal present |
| orbic-ai | manual_surface_review | manual_surface_review_required_continue | manual_review | submit surface signal present; callback or return URL checked; no successful surface fetch |
| promoteproject | manual_surface_review | keep_in_auth_queue_after_surface_review | direct_login | auth signal present; oauth signal present; submit surface signal present; directory signal present |
| tool-ai | manual_surface_review | keep_in_auth_queue_after_surface_review | direct_login | auth signal present; oauth signal present; submit surface signal present; directory signal present; callback or return URL checked |

## Files

- Summary JSON: backlink-url/assisted-submission-pack/resolved-auth-login/auth-residual-resolve.json
- Summary Markdown: backlink-url/assisted-submission-pack/resolved-auth-login/auth-residual-resolve.md
- Resolved direct-login queue CSV: backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-direct-login-queue.csv
- Needs-scout queue CSV: backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-needs-scout.csv
- Manual-review queue CSV: backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-manual-review.csv
- Dropped queue CSV: backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-dropped.csv

