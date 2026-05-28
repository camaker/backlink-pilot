# Coverage Review Batch: coverage-review-p2-020

Generated: 2026-05-28T13:06:38.744Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 238
Batch rows: 15
Remaining after batch: 216
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
| 8 | 547 | P2 | verify_directory_fit_before_any_approval | w3.org | http://www.w3.org/2000/svg | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 57 | P2 | verify_directory_fit_before_any_approval | abracomex.org | https://abracomex.org/aula-inaugural-graduacao-servicos-juridicos-online | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 58 | P2 | verify_directory_fit_before_any_approval | accounts.google.com | https://accounts.google.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 61 | P2 | verify_directory_fit_before_any_approval | advicefromatwentysomething.com | https://advicefromatwentysomething.com/3-simple-ways-to-reconnect-with-your-creativity | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 89 | P2 | verify_directory_fit_before_any_approval | anspblog.org | https://www.anspblog.org/fin-to-limb-to-art | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 93 | P2 | verify_directory_fit_before_any_approval | api.indexnow.org | https://api.indexnow.org/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 97 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2022/06/calendarizacao-da-mobilidade-por-doenca | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 98 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2024/05/e-depois-de-abril-paulo-prudencio | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 102 | P2 | verify_directory_fit_before_any_approval | athomeinthefuture.com | https://athomeinthefuture.com/2022/03/design-decorate-perfect-backyard | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 107 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/16-sweet-easter-treats | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 108 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/sweets-for-the-season | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 109 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/yummy-mummy-snack-cakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 110 | P2 | verify_directory_fit_before_any_approval | bakersroyale.com | https://bakersroyale.com/chocolate-banana-bread-muffins-stuffed-with-reeses-peanut-butter-cup | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 112 | P2 | verify_directory_fit_before_any_approval | bangshift.com | https://bangshift.com/bangshift1320/baby-gators-photos-nhra-divisional-sportsman-drag-racing-action-shots | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 113 | P2 | verify_directory_fit_before_any_approval | beautythroughimperfection.com | https://www.beautythroughimperfection.com/reindeer-donuts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
