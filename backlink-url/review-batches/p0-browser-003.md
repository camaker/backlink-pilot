# Coverage Review Batch: p0-browser-003

Generated: 2026-05-28T05:37:25.842Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P0
Action filter: (all)
Offset: 0
Limit: 20
Matching rows: 20
Batch rows: 20
Remaining after batch: 0
Priority counts: {"P0":20}
Action counts: {"verify_distinct_submit_url_for_existing_domain":5,"verify_submit_form_then_approve_or_reject":15}

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
| 1 | 75 | P0 | verify_distinct_submit_url_for_existing_domain | aiscout.net | https://aiscout.net/submit | approved_domain_variant \| reject_duplicate \| reject_not_submit \| reject_paid \| reject_auth_required |
| 2 | 79 | P0 | verify_distinct_submit_url_for_existing_domain | aitoolsdirectory.com | https://aitoolsdirectory.com/submit | approved_domain_variant \| reject_duplicate \| reject_not_submit \| reject_paid \| reject_auth_required |
| 3 | 208 | P0 | verify_distinct_submit_url_for_existing_domain | devhunt.org | https://devhunt.org/submit | approved_domain_variant \| reject_duplicate \| reject_not_submit \| reject_paid \| reject_auth_required |
| 4 | 472 | P0 | verify_distinct_submit_url_for_existing_domain | sideprojectors.com | https://www.sideprojectors.com/project/new | approved_domain_variant \| reject_duplicate \| reject_not_submit \| reject_paid \| reject_auth_required |
| 5 | 497 | P0 | verify_distinct_submit_url_for_existing_domain | stackshare.io | https://stackshare.io/new-product | approved_domain_variant \| reject_duplicate \| reject_not_submit \| reject_paid \| reject_auth_required |
| 6 | 63 | P0 | verify_submit_form_then_approve_or_reject | ai.xyz | https://ai.xyz/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 7 | 64 | P0 | verify_submit_form_then_approve_or_reject | aiagents.live | https://aiagents.live/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 8 | 65 | P0 | verify_submit_form_then_approve_or_reject | aiagentsbase.com | https://aiagentsbase.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 68 | P0 | verify_submit_form_then_approve_or_reject | aiagentsmarketplace.com | https://aiagentsmarketplace.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 72 | P0 | verify_submit_form_then_approve_or_reject | aimatchpro.ai | https://aimatchpro.ai/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 78 | P0 | verify_submit_form_then_approve_or_reject | aitools.love | https://aitools.love/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 81 | P0 | verify_submit_form_then_approve_or_reject | aitrendytools.com | https://www.aitrendytools.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 115 | P0 | verify_submit_form_then_approve_or_reject | bestofweb.io | https://bestofweb.io/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 274 | P0 | verify_submit_form_then_approve_or_reject | getbyte.co | https://getbyte.co/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 332 | P0 | verify_submit_form_then_approve_or_reject | launchvault.com | https://launchvault.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 390 | P0 | verify_submit_form_then_approve_or_reject | nocode.mba | https://www.nocode.mba/tools/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 392 | P0 | verify_submit_form_then_approve_or_reject | nocodedevs.com | https://www.nocodedevs.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 393 | P0 | verify_submit_form_then_approve_or_reject | nocodefinder.com | https://www.nocodefinder.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 395 | P0 | verify_submit_form_then_approve_or_reject | nocodelist.co | https://nocodelist.co/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 550 | P0 | verify_submit_form_then_approve_or_reject | wearenocode.com | https://www.wearenocode.com/submit | approved \| reject_not_submit \| reject_paid \| reject_auth_required |
