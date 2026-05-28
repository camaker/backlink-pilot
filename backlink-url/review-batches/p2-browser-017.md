# Coverage Review Batch: coverage-review-p2-017

Generated: 2026-05-28T12:30:06.255Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 283
Batch rows: 15
Remaining after batch: 261
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
| 8 | 455 | P2 | verify_directory_fit_before_any_approval | replit.com | https://replit.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 458 | P2 | verify_directory_fit_before_any_approval | rundown.ai | https://www.rundown.ai/tools | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 466 | P2 | verify_directory_fit_before_any_approval | scoop.it | https://www.scoop.it/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 467 | P2 | verify_directory_fit_before_any_approval | scribd.com | https://www.scribd.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 469 | P2 | verify_directory_fit_before_any_approval | semfirms.com | https://www.semfirms.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 471 | P2 | verify_directory_fit_before_any_approval | showmelocal.com | https://www.showmelocal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 476 | P2 | verify_directory_fit_before_any_approval | sitepoint.com | https://www.sitepoint.com/community | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 482 | P2 | verify_directory_fit_before_any_approval | slant.co | https://www.slant.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 485 | P2 | verify_directory_fit_before_any_approval | slideshare.net | https://www.slideshare.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 490 | P2 | verify_directory_fit_before_any_approval | sooperarticles.com | https://www.sooperarticles.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 491 | P2 | verify_directory_fit_before_any_approval | soundcloud.com | https://soundcloud.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 494 | P2 | verify_directory_fit_before_any_approval | spoke.com | https://www.spoke.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 501 | P2 | verify_directory_fit_before_any_approval | startupfa.me | https://startupfa.me/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 502 | P2 | verify_directory_fit_before_any_approval | startups.com | https://www.startups.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 505 | P2 | verify_directory_fit_before_any_approval | startus.cc | https://startus.cc/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
