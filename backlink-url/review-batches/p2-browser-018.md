# Coverage Review Batch: coverage-review-p2-018

Generated: 2026-05-28T12:36:30.093Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 268
Batch rows: 15
Remaining after batch: 246
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
| 8 | 507 | P2 | verify_directory_fit_before_any_approval | strava.com | https://www.strava.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 508 | P2 | verify_directory_fit_before_any_approval | strikingly.com | https://www.strikingly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 511 | P2 | verify_directory_fit_before_any_approval | substack.com | https://substack.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 512 | P2 | verify_directory_fit_before_any_approval | sulekha.com | https://www.sulekha.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 517 | P2 | verify_directory_fit_before_any_approval | taalk.com | https://taalk.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 518 | P2 | verify_directory_fit_before_any_approval | teacherspayteachers.com | https://www.teacherspayteachers.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 519 | P2 | verify_directory_fit_before_any_approval | tech.co | https://tech.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 528 | P2 | verify_directory_fit_before_any_approval | thesaasdirectory.com | https://thesaasdirectory.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 532 | P2 | verify_directory_fit_before_any_approval | todaylaunches.com | https://todaylaunches.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 538 | P2 | verify_directory_fit_before_any_approval | toolsfine.com | https://toolsfine.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 540 | P2 | verify_directory_fit_before_any_approval | trustmrr.com | https://trustmrr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 542 | P2 | verify_directory_fit_before_any_approval | tumblr.com | https://www.tumblr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 543 | P2 | verify_directory_fit_before_any_approval | tupalo.com | https://tupalo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 549 | P2 | verify_directory_fit_before_any_approval | warriorforum.com | https://www.warriorforum.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 551 | P2 | verify_directory_fit_before_any_approval | webdesign-inspiration.com | https://webdesign-inspiration.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
