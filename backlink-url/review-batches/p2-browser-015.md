# Coverage Review Batch: coverage-review-p2-015

Generated: 2026-05-28T12:16:47.657Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 313
Batch rows: 15
Remaining after batch: 291
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
| 8 | 358 | P2 | verify_directory_fit_before_any_approval | massagetherapy.com | https://www.massagetherapy.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 360 | P2 | verify_directory_fit_before_any_approval | merchantcircle.com | https://www.merchantcircle.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 364 | P2 | verify_directory_fit_before_any_approval | mixcloud.com | https://www.mixcloud.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 366 | P2 | verify_directory_fit_before_any_approval | modelmayhem.com | https://www.modelmayhem.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 371 | P2 | verify_directory_fit_before_any_approval | mumsnet.com | https://www.mumsnet.com/Talk | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 373 | P2 | verify_directory_fit_before_any_approval | my.g2.com | https://my.g2.com/sellers/welcome | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 377 | P2 | verify_directory_fit_before_any_approval | myfolio.com | https://myfolio.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 382 | P2 | verify_directory_fit_before_any_approval | neilpatel.com | https://neilpatel.com/ai-tools | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 386 | P2 | verify_directory_fit_before_any_approval | newsaasly.com | https://newsaasly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 387 | P2 | verify_directory_fit_before_any_approval | newswiretoday.com | https://www.newswiretoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 394 | P2 | verify_directory_fit_before_any_approval | nocodefounders.com | https://www.nocodefounders.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 397 | P2 | verify_directory_fit_before_any_approval | notion.so | https://www.notion.so/integrations | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 399 | P2 | verify_directory_fit_before_any_approval | noxilo.com | https://noxilo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 401 | P2 | verify_directory_fit_before_any_approval | onlineprnews.com | https://www.onlineprnews.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 403 | P2 | verify_directory_fit_before_any_approval | open-launch.com | https://open-launch.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
