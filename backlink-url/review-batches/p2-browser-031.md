# Coverage Review Batch: coverage-review-p2-031

Generated: 2026-05-28T14:48:56.531Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 73
Batch rows: 15
Remaining after batch: 51
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
| 8 | 430 | P2 | verify_directory_fit_before_any_approval | predictiveanalyticsworld.com | https://www.predictiveanalyticsworld.com/machinelearningtimes/dont-let-yourself-be-fooled-by-data-drift/13125 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 431 | P2 | verify_directory_fit_before_any_approval | premierchess.com | https://premierchess.com/chess-growth/maythebestplayerwin | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 432 | P2 | verify_directory_fit_before_any_approval | premierchess.com | https://premierchess.com/uncategorized/is-chess-a-sport-an-introduction-of-chess-in-and-within-the-sports-world | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 433 | P2 | verify_directory_fit_before_any_approval | preview.amplethemes.com | https://preview.amplethemes.com/blog-vlog-pro/2018/12/14/lovely-cat | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 437 | P2 | verify_directory_fit_before_any_approval | programas.cooperativa.cl | http://programas.cooperativa.cl/enaccion/2010/09/10/los-reportes-de-sustentabilidad | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 439 | P2 | verify_directory_fit_before_any_approval | proofreadanywhere.com | https://proofreadanywhere.com/get-paid-to-proofread | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 441 | P2 | verify_directory_fit_before_any_approval | pt-media.org | https://pt-media.org/2022/11/02/kuvitteellinen-hakaristi-pahoitti-mielen | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 442 | P2 | verify_directory_fit_before_any_approval | pv-magazine.com | https://www.pv-magazine.com/2022/01/15/the-weekend-read | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 445 | P2 | verify_directory_fit_before_any_approval | radioink.com | https://radioink.com/2025/04/14/donald-trump-jr-lara-trump-take-stakes-in-salem-media-group | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 446 | P2 | verify_directory_fit_before_any_approval | rcinet.ca | https://www.rcinet.ca/bhm-en/2021/02/02/a-variety-of-activities-unveiled-for-black-history-month | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 447 | P2 | verify_directory_fit_before_any_approval | rcinet.ca | https://www.rcinet.ca/rci70-en/2015/02/24/test1 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 448 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/kimberley-australia-luxury-expedition-cruise-seabourn | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 449 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/mexico-city-itinerary-the-best-things-to-do-in-4-days | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 450 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/new-england-fall-road-trip | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 451 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2013/02/barn-card-for-sprout-tv.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
