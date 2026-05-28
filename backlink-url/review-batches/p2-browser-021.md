# Coverage Review Batch: coverage-review-p2-021

Generated: 2026-05-28T13:13:36.367Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 223
Batch rows: 15
Remaining after batch: 201
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
| 8 | 118 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/awards/breaking-news-announcing-the-2023-better-reading-top-100 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 119 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/book-life/wine-coffee-tea-what-do-you-drink-while-youre-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 120 | P2 | verify_directory_fit_before_any_approval | bevcooks.com | https://bevcooks.com/2019/06/creamy-chicken-and-asparagus-casserole | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 121 | P2 | verify_directory_fit_before_any_approval | bevcooks.com | https://bevcooks.com/2024/08/homemade-ricotta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 123 | P2 | verify_directory_fit_before_any_approval | bing.com | https://www.bing.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 128 | P2 | verify_directory_fit_before_any_approval | blafusel.de | https://www.blafusel.de/phpbb/memberlist.php?mode=viewprofile&u=8625 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 129 | P2 | verify_directory_fit_before_any_approval | blankitinerary.com | https://blankitinerary.com/santana-fall.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 130 | P2 | verify_directory_fit_before_any_approval | blend4web.com | https://www.blend4web.com/ru/forums/users/alexreynolds/posts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 131 | P2 | verify_directory_fit_before_any_approval | blog.bmtmicro.com | https://blog.bmtmicro.com/4449-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 132 | P2 | verify_directory_fit_before_any_approval | blog.goaffpro.com | https://blog.goaffpro.com/mastering-affiliate-product-reviews-a-step-by-step-guide-for-engaging-content-and-conversions | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 133 | P2 | verify_directory_fit_before_any_approval | blog.metastock.com | https://blog.metastock.com/2024/08/mastering-ichimoku-method-jeff-gibby.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 134 | P2 | verify_directory_fit_before_any_approval | blog.myesr.org | https://blog.myesr.org/espanol/los-casos-de-dr-pepe-caso-de-torax-12 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 135 | P2 | verify_directory_fit_before_any_approval | blog.myesr.org | https://blog.myesr.org/espanol/los-casos-de-dr-pepe-caso-de-torax-14 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 136 | P2 | verify_directory_fit_before_any_approval | blog.organicfood.vn | https://blog.organicfood.vn/thoi-gian-ngam-cac-loai-hat-la-bao-lau-tai-sao-phai-ngam-hat | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 137 | P2 | verify_directory_fit_before_any_approval | blog.pianetamamma.it | https://blog.pianetamamma.it/amoredimamma/polpette-di-prosciutto-cotto-e-ricotta-al-forno | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
