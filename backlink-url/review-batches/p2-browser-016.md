# Coverage Review Batch: coverage-review-p2-016

Generated: 2026-05-28T12:23:22.805Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 298
Batch rows: 15
Remaining after batch: 276
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
| 8 | 405 | P2 | verify_directory_fit_before_any_approval | openclawdir.com | https://openclawdir.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 407 | P2 | verify_directory_fit_before_any_approval | openpr.com | https://www.openpr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 411 | P2 | verify_directory_fit_before_any_approval | pastebin.com | https://pastebin.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 413 | P2 | verify_directory_fit_before_any_approval | patreon.com | https://www.patreon.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 414 | P2 | verify_directory_fit_before_any_approval | pearltrees.com | https://www.pearltrees.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 416 | P2 | verify_directory_fit_before_any_approval | penzu.com | https://penzu.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 420 | P2 | verify_directory_fit_before_any_approval | pipedream.com | https://pipedream.com/docs/components | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 424 | P2 | verify_directory_fit_before_any_approval | placester.com | https://placester.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 426 | P2 | verify_directory_fit_before_any_approval | porch.com | https://porch.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 428 | P2 | verify_directory_fit_before_any_approval | pr-free.com | https://www.pr-free.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 429 | P2 | verify_directory_fit_before_any_approval | pr.com | https://www.pr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 434 | P2 | verify_directory_fit_before_any_approval | prlog.org | https://www.prlog.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 436 | P2 | verify_directory_fit_before_any_approval | profithunt.co | https://profithunt.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 440 | P2 | verify_directory_fit_before_any_approval | proofstories.io | https://proofstories.io/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 444 | P2 | verify_directory_fit_before_any_approval | quibblo.com | https://www.quibblo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
