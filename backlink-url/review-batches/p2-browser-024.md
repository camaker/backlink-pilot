# Coverage Review Batch: coverage-review-p2-024

Generated: 2026-05-28T13:39:18.597Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 178
Batch rows: 15
Remaining after batch: 156
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
| 8 | 183 | P2 | verify_directory_fit_before_any_approval | chandigarhcity.com | https://www.chandigarhcity.com/discussions/threads/quordle-to-quorle | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 184 | P2 | verify_directory_fit_before_any_approval | chayagrossberg.com | https://chayagrossberg.com/diagnosis-versus-you | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 185 | P2 | verify_directory_fit_before_any_approval | chayagrossberg.com | https://chayagrossberg.com/how-do-you-know-if-youre-receiving-informed-consent | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 186 | P2 | verify_directory_fit_before_any_approval | chhs.news.niu.edu | https://chhs.news.niu.edu/2025/01/15/niu-school-of-nursing-adds-hispanic-student-nurses-alianza-hsna-to-support-students | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 187 | P2 | verify_directory_fit_before_any_approval | cinescopia.com | https://cinescopia.com/las-10-mejores-peliculas-de-casey-affleck/2024/08 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 189 | P2 | verify_directory_fit_before_any_approval | claude.ai | https://claude.ai/code | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 190 | P2 | verify_directory_fit_before_any_approval | claude.ai | https://claude.ai/code)%EF%BC%8C%E4%BD%A0%E4%B8%8D%E9%9C%80%E8%A6%81%E7%9C%8B%E4%BB%BB%E4%BD%95%E5%85%B6%E4%BB%96%E6%96%87%E6%A1%A3%E3%80%82Clone | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 194 | P2 | verify_directory_fit_before_any_approval | community.ops.io | https://community.ops.io/albacube_d9724d5112893f8a | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 195 | P2 | verify_directory_fit_before_any_approval | completelydelicious.com | https://www.completelydelicious.com/tips/make-brownies-shiny-crackly-crust | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 196 | P2 | verify_directory_fit_before_any_approval | cornbeanspigskids.com | https://www.cornbeanspigskids.com/2024/08/back-to-school-my-kids-favorite.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 197 | P2 | verify_directory_fit_before_any_approval | craftberrybush.com | https://www.craftberrybush.com/2017/08/watercolor-lessons-and-free-printable.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 198 | P2 | verify_directory_fit_before_any_approval | craftberrybush.com | https://www.craftberrybush.com/2025/01/heart-shaped-flower-arrangement-for-valentines-day.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 207 | P2 | verify_directory_fit_before_any_approval | demilked.com | https://www.demilked.com/just-a-girl | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 209 | P2 | verify_directory_fit_before_any_approval | digitalwellbeing.org | https://digitalwellbeing.org/five-reasons-why-chatgpt-is-the-future-of-digital-mental-health-support | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 211 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2017/12/05/nigels-fruitcake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
