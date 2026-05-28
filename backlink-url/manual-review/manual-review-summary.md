# Manual Review Pack

Generated: 2026-05-28T13:44:13.132Z

## Scope

- Current queue rows: 166
- P0 rows: 3
- P2 rows: 163
- Rows with evidence or suggestion history: 166
- Rows without evidence or suggestion history: 0
- Rows blocked by safety gate in prior drafts: 0
- Possible approvals after manual confirmation: 0

Policy: manual review only. No approvals, no registry imports, no real submissions, no login or CAPTCHA/Cloudflare bypass.

## By Priority

| Priority | Count |
|---|---:|
| P2 | 163 |
| P0 | 3 |

## By Review Action

| Action | Count |
|---|---:|
| verify_directory_fit_before_any_approval | 163 |
| verify_distinct_submit_url_for_existing_domain | 2 |
| verify_submit_form_then_approve_or_reject | 1 |

## By Manual Bucket

| Bucket | Count |
|---|---:|
| directory_fit_requires_human_confirmation | 130 |
| fetch_failed_cannot_decide | 18 |
| medium_confidence_requires_human_confirmation | 18 |

## By Suggested Decision

| Suggested Decision | Count |
|---|---:|
| reject_not_directory | 77 |
| reject_auth_required | 66 |
| needs_manual_check | 18 |
| reject_not_submit | 5 |

## P0 Manual Queue

| Rank | Review Row | Domain | Manual Bucket | Suggested Decision | Confidence | URL |
|---:|---:|---|---|---|---|---|
| 1 | 75 | aiscout.net | fetch_failed_cannot_decide | needs_manual_check | low | https://aiscout.net/submit |
| 2 | 79 | aitoolsdirectory.com | fetch_failed_cannot_decide | needs_manual_check | low | https://aitoolsdirectory.com/submit |
| 3 | 63 | ai.xyz | fetch_failed_cannot_decide | needs_manual_check | low | https://ai.xyz/submit |

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
