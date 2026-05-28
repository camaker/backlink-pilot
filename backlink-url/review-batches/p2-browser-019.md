# Coverage Review Batch: coverage-review-p2-019

Generated: 2026-05-28T12:59:20.583Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 253
Batch rows: 15
Remaining after batch: 231
Priority counts: {"P2":15}
Action counts: {"verify_directory_fit_before_any_approval":15}

## Review Rules

- Edit only review_decision, review_notes, reviewed_by, submission_url_override, canonical_name, pricing, and lang.
- Use approved only for verified public submit forms with no paid, login-only, CAPTCHA-only, or source-page blocker.
- Use approved_domain_variant only when a same-domain URL is a distinct valid submit endpoint and not a duplicate registry URL.
- Use reject_not_submit, reject_duplicate, reject_paid, reject_auth_required, or reject_not_directory when evidence is insufficient.
- After editing, run validate-coverage-review-batch and promote-coverage-review-batch --dry-run before writing any updated review CSV.

## Promotion Gate

Validate the edited batch first:

```bash
node src/cli.js targets validate-coverage-review-batch <batch.csv> --fail-on-blockers
```

Then run the full promotion gate. This validates the batch, simulates applying it to the source review CSV, validates the updated review CSV, and runs an import dry-run against the registry:

```bash
node src/cli.js targets promote-coverage-review-batch <coverage-review.csv> <batch.csv> --registry resources/targets.canonical.yaml --output <coverage-review.updated.csv> --dry-run
```

Only remove `--dry-run` after the promotion result is OK. Promotion never submits to external sites and import dry-run never changes the registry.

## Decision Vocabulary

- `approved`: verified public submit form; no auth/CAPTCHA/payment/source-page blocker.
- `approved_domain_variant`: same-domain candidate is a distinct valid submit endpoint, not a duplicate.
- `reject_not_submit`: page is not a submission endpoint.
- `reject_duplicate`: already represented by an existing registry submit URL.
- `reject_paid`: paid listing or paid-only submission.
- `reject_auth_required`: login/OAuth is required before submission.
- `reject_not_directory`: not a relevant directory/listing surface.

## Rows

| order | review_row | priority | action | domain | url | decision options |
|---:|---:|---|---|---|---|---|
| 8 | 552 | P2 | verify_directory_fit_before_any_approval | webmasterworld.com | https://www.webmasterworld.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 554 | P2 | verify_directory_fit_before_any_approval | weebly.com | https://www.weebly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 555 | P2 | verify_directory_fit_before_any_approval | wefunder.com | https://wefunder.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 557 | P2 | verify_directory_fit_before_any_approval | wellness.com | https://www.wellness.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 558 | P2 | verify_directory_fit_before_any_approval | whatlaunchedtoday.com | https://whatlaunchedtoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 560 | P2 | verify_directory_fit_before_any_approval | where2go.com | https://www.where2go.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 566 | P2 | verify_directory_fit_before_any_approval | wordpress.com | https://wordpress.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 569 | P2 | verify_directory_fit_before_any_approval | yellowpagesgoesgreen.org | https://www.yellowpagesgoesgreen.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 570 | P2 | verify_directory_fit_before_any_approval | yogatrail.com | https://www.yogatrail.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 579 | P2 | verify_directory_fit_before_any_approval | zapier.com | https://zapier.com/developer | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 571 | P2 | verify_directory_fit_before_any_approval | your-product.com | https://your-product.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 404 | P2 | verify_directory_fit_before_any_approval | openclaw.ai | https://openclaw.ai/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 361 | P2 | verify_directory_fit_before_any_approval | metric-converter.net | https://metric-converter.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 396 | P2 | verify_directory_fit_before_any_approval | nodejs.org | https://nodejs.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 499 | P2 | verify_directory_fit_before_any_approval | startup88.com | https://startup88.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
