# Coverage Review Batch: coverage-review-p2-032

Generated: 2026-05-28T14:51:38.979Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 58
Batch rows: 15
Remaining after batch: 36
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
| 8 | 452 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2019/01/crochet-moss-stitch-in-a-rectangle.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 453 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2019/05/crochet-avocado.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 454 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2025/02/crochet-furry-friends-book.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 456 | P2 | verify_directory_fit_before_any_approval | ride.guru | https://ride.guru/content/newsroom/finding-your-fare-with-rideguru-a-how-to-guide | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 457 | P2 | verify_directory_fit_before_any_approval | ru.esosedi.org | https://ru.esosedi.org/RU/BA/8564043/ust_saldyibash | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 459 | P2 | verify_directory_fit_before_any_approval | runningwithspoons.com | https://www.runningwithspoons.com/easy-homemade-teriyaki-sauce | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 460 | P2 | verify_directory_fit_before_any_approval | runningwithspoons.com | https://www.runningwithspoons.com/flourless-carrot-cake-muffins | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 461 | P2 | verify_directory_fit_before_any_approval | runpee.com | https://runpee.com/10-best-math-movies-for-middle-school-students | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 465 | P2 | verify_directory_fit_before_any_approval | scandasia.com | https://scandasia.com/binh-duong-province-of-vietnam-attracts-more-than-4000-foreign-direct-investment-projects | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 468 | P2 | verify_directory_fit_before_any_approval | selfloverainbow.com | https://www.selfloverainbow.com/self-improvement-7-reasons-why-we-struggle | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 470 | P2 | verify_directory_fit_before_any_approval | sharonsantoni.com | https://sharonsantoni.com/2023/05/making-strawberry-jam-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 473 | P2 | verify_directory_fit_before_any_approval | simonsaysstampblog.com | https://www.simonsaysstampblog.com/blog/amore-laurafadora-3/comment-page-1 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 478 | P2 | verify_directory_fit_before_any_approval | sites.suffolk.edu | https://sites.suffolk.edu/connormulcahy/2014/02/28/solar-energy-lab | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 479 | P2 | verify_directory_fit_before_any_approval | sites.williams.edu | https://sites.williams.edu/srd4/methods-exercises/methods-exercise-6 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 480 | P2 | verify_directory_fit_before_any_approval | sites.williams.edu | https://sites.williams.edu/srd4/why-we-sing | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
