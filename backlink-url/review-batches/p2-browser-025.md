# Coverage Review Batch: coverage-review-p2-025

Generated: 2026-05-28T14:18:43.787Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 163
Batch rows: 15
Remaining after batch: 141
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
| 8 | 212 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2019/12/23/kaiserschmarrn-torn-shredded-pancake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 213 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2021/11/03/plant-based-deep-n-delicious-chocolate-cake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 214 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/recipes/butterscotch-pecan-mmmuffins | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 218 | P2 | verify_directory_fit_before_any_approval | diythrill.com | https://diythrill.com/2018/09/23/orange-citrus-poo-pourri-recipe | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 222 | P2 | verify_directory_fit_before_any_approval | earthpeopletechnology.com | https://earthpeopletechnology.com/forums/profile/contractwarn | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 225 | P2 | verify_directory_fit_before_any_approval | eilentein.com | http://www.eilentein.com/2019/02/ryijy-ja-kuinka-sen-tein.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 232 | P2 | verify_directory_fit_before_any_approval | everythingboardgames.com | https://everythingboardgames.com/2024/11/exploring-the-world-of-online-board-games.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 233 | P2 | verify_directory_fit_before_any_approval | everythingetsy.com | https://www.everythingetsy.com/2013/02/10-social-media-tips-to-make-you-a-rock-star | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 237 | P2 | verify_directory_fit_before_any_approval | exsloth.com | https://exsloth.com/vegan-breakfast-cookies | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 241 | P2 | verify_directory_fit_before_any_approval | fallfordiy.com | https://fallfordiy.com/blog/2015/11/18/diy-paint-dipped-advent-calendar-bottles | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 242 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/10/20/roasted-butternut-squash-and-apple-soup | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 243 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/11/10/2014119turkey-roulade | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 244 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/12/01/2014121make-ahead-monday-shepherds-pie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 245 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/12/28/creamy-ham-and-pea-pasta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 249 | P2 | verify_directory_fit_before_any_approval | feettothefire.blogs.wesleyan.edu | https://feettothefire.blogs.wesleyan.edu/2009/02/26/main-street-marketplace/comment-page-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
