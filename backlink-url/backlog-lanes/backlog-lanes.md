# Backlog Lanes

Generated: 2026-05-27T15:49:49.282Z

## Registry Backlog

- Total targets: 481
- Non-skip targets: 241
- By mode: {"skip":240,"needs_review":119,"assisted":100,"auto_safe":1,"manual_strategic":21}
- By pricing: {"unknown":263,"paid":72,"free":145,"freemium":1}

## Workflow Backlog

- Pricing manual rows: 0
- Auth manual login rows: 20
- Auth resolved needs-scout rows: 1
- Auth resolved manual-review rows: 2
- Coverage manual review rows: 132
- Total workflow rows: 155
- Pricing/Auth shared target IDs: 0

## Lanes

| Lane ID | Type | Priority | Rows | Est. Minutes |
|---|---|---|---:|---:|
| auth-login-001 | auth_manual_login | P0 | 10 | 60 |
| auth-login-002 | auth_manual_login | P0 | 10 | 60 |
| auth-needs-scout-001 | auth_resolved_needs_scout | P1 | 1 | 5 |
| auth-manual-review-fail-closed-001 | auth_manual_review_fail_closed | P0 | 1 | 7 |
| auth-manual-review-classification-002 | auth_manual_review_classification | P1 | 1 | 6 |
| coverage-review-p0-001 | coverage_manual_review_p0 | P0 | 17 | 85 |
| coverage-review-p2-002 | coverage_manual_review_p2 | P2 | 25 | 100 |
| coverage-review-p2-003 | coverage_manual_review_p2 | P2 | 25 | 100 |
| coverage-review-p2-004 | coverage_manual_review_p2 | P2 | 25 | 100 |
| coverage-review-p2-005 | coverage_manual_review_p2 | P2 | 25 | 100 |
| coverage-review-p2-006 | coverage_manual_review_p2 | P2 | 15 | 60 |

## Worker Assignment

| Worker | Lanes | Rows | Est. Minutes | Lane IDs |
|---|---:|---:|---:|---|
| worker-01 | 2 | 42 | 185 | coverage-review-p0-001, coverage-review-p2-005 |
| worker-02 | 2 | 35 | 160 | auth-login-001, coverage-review-p2-003 |
| worker-03 | 2 | 35 | 160 | auth-login-002, coverage-review-p2-004 |
| worker-04 | 5 | 43 | 178 | auth-manual-review-fail-closed-001, auth-manual-review-classification-002, auth-needs-scout-001, coverage-review-p2-002, coverage-review-p2-006 |

All lanes remain manual/read-only. Nothing here performs real submissions, login bypass, or registry writes.
