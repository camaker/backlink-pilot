# Coverage Review Batch: coverage-review-p2-035

Generated: 2026-05-28T14:59:13.244Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 13
Batch rows: 6
Remaining after batch: 0
Priority counts: {"P2":6}
Action counts: {"verify_directory_fit_before_any_approval":6}

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
| 8 | 573 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/almond-banana-bread | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 574 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/banana-bread-coffee-cake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 575 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/candy-cane-muddy-buddies | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 576 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/cinnamon-toast-crunch-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 577 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/easy-to-make-snowman-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 578 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/pineapple-mango-bruschetta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
