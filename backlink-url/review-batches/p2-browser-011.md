# Coverage Review Batch: p2-browser-011

Generated: 2026-05-28T09:45:20.292Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 0
Limit: 15
Matching rows: 345
Batch rows: 15
Remaining after batch: 330
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
| 1 | 3 | P2 | verify_directory_fit_before_any_approval | 2findlocal.com | https://www.2findlocal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 2 | 80 | P2 | verify_directory_fit_before_any_approval | aitoolsguide.com | https://aitoolsguide.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 3 | 95 | P2 | verify_directory_fit_before_any_approval | apitracker.io | https://apitracker.io/mcp-servers | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 4 | 142 | P2 | verify_directory_fit_before_any_approval | blogarama.com | https://www.blogarama.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 5 | 169 | P2 | verify_directory_fit_before_any_approval | businesshunt.co | https://businesshunt.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 6 | 173 | P2 | verify_directory_fit_before_any_approval | calameo.com | https://www.calameo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 7 | 202 | P2 | verify_directory_fit_before_any_approval | cuspera.com | https://www.cuspera.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 8 | 216 | P2 | verify_directory_fit_before_any_approval | directory.ldmstudio.com | https://www.directory.ldmstudio.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 217 | P2 | verify_directory_fit_before_any_approval | disqus.com | https://disqus.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 224 | P2 | verify_directory_fit_before_any_approval | ecosystem.hubspot.com | https://ecosystem.hubspot.com/marketplace | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 227 | P2 | verify_directory_fit_before_any_approval | etsy.com | https://www.etsy.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 228 | P2 | verify_directory_fit_before_any_approval | eu-business.com | https://www.eu-business.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 230 | P2 | verify_directory_fit_before_any_approval | evernote.com | https://evernote.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 238 | P2 | verify_directory_fit_before_any_approval | ezinearticles.com | https://ezinearticles.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 251 | P2 | verify_directory_fit_before_any_approval | finduslocal.com | https://www.finduslocal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
