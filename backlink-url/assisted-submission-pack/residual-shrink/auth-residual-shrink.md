# Auth Residual Shrink

Generated: 2026-05-27T11:27:36.839Z
Source triage: backlink-url/assisted-submission-pack/auth-login-triage.json
Source queue: backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv

Policy: read-only residual shrink only. No login, no submission, no registry writes, no browser launch.

## Summary

- Rows: 8
- Dedupe rows: 3
- Registry recheck rows: 2
- Manual surface review rows: 3
- Rows that shrink the auth queue: 4
- Rows kept in auth: 3
- Rows still needing manual review: 1
- Manual surface URLs checked: 8

## By Resolution

| Resolution | Count |
|---|---:|
| drop_duplicate_before_login | 2 |
| keep_in_auth_queue_after_surface_review | 2 |
| keep_primary_auth_candidate | 1 |
| manual_surface_review_required_continue | 1 |
| move_out_of_auth_to_manual_surface_review | 1 |
| move_out_of_auth_to_needs_scout | 1 |

## Key Rows

| Type | Target | Resolution | Bucket | Notes |
|---|---|---|---|---|
| dedupe | beta-list | keep_primary_auth_candidate | keep_auth | dedupe score 77; persisted scout present; pricing:free; auth_required status; submit-like path; submit surface signal; auth or oauth signal; group primary: beta-list; persisted final: https://betalist.com/sign_in |
| dedupe | betalist-com | drop_duplicate_before_login | shrink_auth_queue | dedupe score 37; persisted scout present; auth_required status; generic or login path; submit surface signal; auth or oauth signal; group primary: beta-list; persisted final: https://betalist.com/sign_in |
| dedupe | betalist | drop_duplicate_before_login | shrink_auth_queue | dedupe score -30; status new; generic or login path; group primary: beta-list |
| registry_recheck | mergeek | move_out_of_auth_to_needs_scout | shrink_auth_queue | classification mismatch recorded; persisted submit surface signal; required unmapped fields: 1 |
| registry_recheck | top-best-alternatives | move_out_of_auth_to_manual_surface_review | shrink_auth_queue | classification mismatch recorded; search-only surface; oauth signal present |
| manual_surface_review | orbic-ai | manual_surface_review_required_continue | needs_manual_review | submit surface signal present; callback or return URL checked; no successful surface fetch |
| manual_surface_review | promoteproject | keep_in_auth_queue_after_surface_review | keep_auth | auth signal present; oauth signal present; submit surface signal present; directory signal present |
| manual_surface_review | tool-ai | keep_in_auth_queue_after_surface_review | keep_auth | auth signal present; oauth signal present; submit surface signal present; directory signal present; callback or return URL checked |

## Files

- Residual CSV: backlink-url/assisted-submission-pack/residual-shrink/auth-residual-shrink.csv
- Residual JSON: backlink-url/assisted-submission-pack/residual-shrink/auth-residual-shrink.json
- Residual Markdown: backlink-url/assisted-submission-pack/residual-shrink/auth-residual-shrink.md
- Manual surface evidence CSV: backlink-url/assisted-submission-pack/residual-shrink/auth-residual-shrink-manual-surface-evidence.csv

