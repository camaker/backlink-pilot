# Coverage Review Batch: coverage-review-p2-028

Generated: 2026-05-28T14:37:30.338Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 118
Batch rows: 15
Remaining after batch: 96
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
| 8 | 328 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=224 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 329 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=239 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 330 | P2 | verify_directory_fit_before_any_approval | labsk.net | https://labsk.net/index.php?action=profile%3Bu%3D50620 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 334 | P2 | verify_directory_fit_before_any_approval | learnalanguage.com | https://www.learnalanguage.com/blog/italian-greetings-how-are-you-in-italian | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 335 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/best-time-to-visit-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 336 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/chemka-hot-springs-moshi-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 337 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/materuni-waterfall-moshi-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 342 | P2 | verify_directory_fit_before_any_approval | loveandmarriageblog.com | https://loveandmarriageblog.com/beach-water-cocktail | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 343 | P2 | verify_directory_fit_before_any_approval | lovestrategies.com | https://lovestrategies.com/are-you-a-walking-red-flag-7-habits-that-might-be-sabotaging-your-love-life | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 344 | P2 | verify_directory_fit_before_any_approval | lovestrategies.com | https://lovestrategies.com/types-of-guys-who-stay-single | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 345 | P2 | verify_directory_fit_before_any_approval | madrimasd.org | https://www.madrimasd.org/blogs/astrofisica/2022/05/20/134942 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 346 | P2 | verify_directory_fit_before_any_approval | madrimasd.org | https://www.madrimasd.org/blogs/matematicas/2024/02/11/150483 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 347 | P2 | verify_directory_fit_before_any_approval | mae.gov.bi | https://www.mae.gov.bi/en/an-audience-with-the-iom-head-of-the-mission-in-burundi | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 348 | P2 | verify_directory_fit_before_any_approval | mae.gov.bi | https://www.mae.gov.bi/en/vacancy-announcement | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 349 | P2 | verify_directory_fit_before_any_approval | majalahsains.com | https://www.majalahsains.com/careers/employer/lawrence | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
