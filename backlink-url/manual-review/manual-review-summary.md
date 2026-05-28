# Manual Review Pack

Generated: 2026-05-28T05:55:06.661Z

## Scope

- Current queue rows: 364
- P0 rows: 6
- P2 rows: 358
- Rows with evidence or suggestion history: 364
- Rows without evidence or suggestion history: 0
- Rows blocked by safety gate in prior drafts: 0
- Possible approvals after manual confirmation: 1

Policy: manual review only. No approvals, no registry imports, no real submissions, no login or CAPTCHA/Cloudflare bypass.

## By Priority

| Priority | Count |
|---|---:|
| P2 | 358 |
| P0 | 6 |

## By Review Action

| Action | Count |
|---|---:|
| verify_directory_fit_before_any_approval | 358 |
| verify_submit_form_then_approve_or_reject | 4 |
| verify_distinct_submit_url_for_existing_domain | 2 |

## By Manual Bucket

| Bucket | Count |
|---|---:|
| directory_fit_requires_human_confirmation | 242 |
| fetch_failed_cannot_decide | 74 |
| medium_confidence_requires_human_confirmation | 46 |
| manual_browser_check_required | 1 |
| manual_submit_form_confirmation_required | 1 |

## By Suggested Decision

| Suggested Decision | Count |
|---|---:|
| reject_auth_required | 162 |
| reject_not_directory | 111 |
| needs_manual_check | 76 |
| reject_not_submit | 14 |
| reject_paid | 1 |

## P0 Manual Queue

| Rank | Review Row | Domain | Manual Bucket | Suggested Decision | Confidence | URL |
|---:|---:|---|---|---|---|---|
| 1 | 75 | aiscout.net | fetch_failed_cannot_decide | needs_manual_check | low | https://aiscout.net/submit |
| 2 | 79 | aitoolsdirectory.com | fetch_failed_cannot_decide | needs_manual_check | low | https://aitoolsdirectory.com/submit |
| 3 | 63 | ai.xyz | fetch_failed_cannot_decide | needs_manual_check | low | https://ai.xyz/submit |
| 4 | 64 | aiagents.live | fetch_failed_cannot_decide | needs_manual_check | low | https://aiagents.live/submit |
| 5 | 72 | aimatchpro.ai | fetch_failed_cannot_decide | needs_manual_check | low | https://aimatchpro.ai/submit |
| 6 | 115 | bestofweb.io | fetch_failed_cannot_decide | needs_manual_check | low | https://bestofweb.io/submit |

## Files

- Full remaining queue: remaining-manual-review.csv
- P0-only queue: p0-manual-review.csv
- Next queue slice: next-100-manual-review.csv
- Machine-readable summary: manual-review-summary.json
- Readiness blockers: product-readiness-blockers.md

The CSV files include the required coverage-review queue columns. After a human edits `review_decision`, `review_notes`, `reviewed_by`, and optional override fields, validate the edited file before promotion:

```bash
node src/cli.js targets validate-coverage-review-batch <edited-manual-review.csv> --fail-on-blockers
node src/cli.js targets promote-coverage-review-batch backlink-url/coverage-review.csv <edited-manual-review.csv> --registry resources/targets.canonical.yaml --output backlink-url/coverage-review.updated.csv --dry-run
```

## Human Review Rules

1. Do not approve based on HTTP fetch alone. Approval requires a visible valid submit form, directory fit, no mandatory login/payment/CAPTCHA, and a clear submit URL.
2. Do not reject on fetch failure alone. Retry in a normal browser first.
3. Treat auth/OAuth/2FA/CAPTCHA/Cloudflare as assisted/manual, never auto.
4. Treat paid/sponsored-only listing paths as reject_paid unless a free path is visible.
5. Any approved row must remain non-executable needs_scout until scout evidence maps the form fields and submit button.
