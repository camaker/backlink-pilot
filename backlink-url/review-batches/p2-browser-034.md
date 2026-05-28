# Coverage Review Batch: coverage-review-p2-034

Generated: 2026-05-28T14:56:43.446Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 28
Batch rows: 15
Remaining after batch: 6
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
| 8 | 522 | P2 | verify_directory_fit_before_any_approval | techqiah.com | https://www.techqiah.com/2024/11/192-168-100-1.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 526 | P2 | verify_directory_fit_before_any_approval | thenerdswife.com | https://thenerdswife.com/happy-sisters-day-with-frozen-and-disney.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 529 | P2 | verify_directory_fit_before_any_approval | thinkgrowgiggle.com | http://www.thinkgrowgiggle.com/2020/07/10-best-mentor-texts-to-use-for-reading.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 530 | P2 | verify_directory_fit_before_any_approval | threewood.jp | https://threewood.jp/hpgen/HPB/entries/25.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 533 | P2 | verify_directory_fit_before_any_approval | tonypolecastro.com | https://tonypolecastro.com/at204 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 534 | P2 | verify_directory_fit_before_any_approval | tonypolecastro.com | https://tonypolecastro.com/guitar-notes-for-beginners/comment-page-12 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 546 | P2 | verify_directory_fit_before_any_approval | visitrichmond.co.uk | https://www.visitrichmond.co.uk/blog/read/2024/03/english-tourism-week-2024-gardens-and-parks-b48 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 548 | P2 | verify_directory_fit_before_any_approval | wallhaven.cc | https://wallhaven.cc/user/lauralehman | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 556 | P2 | verify_directory_fit_before_any_approval | weirdsciencedccomics.com | https://www.weirdsciencedccomics.com/2022/02/batmancatwoman-10-review.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 561 | P2 | verify_directory_fit_before_any_approval | whimsysoul.com | https://whimsysoul.com/napa-valley-wine-train | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 562 | P2 | verify_directory_fit_before_any_approval | wiki.alumni.net | https://wiki.alumni.net/wiki/User:MincEdlate33363909 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 563 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/food/best-wet-markets-kuala-lumpur.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 564 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/tips/heading-to-malaysia-the-superstitions-you-ought-to-know.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 565 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/tips/sport-activities-on-a-vacation-in-malaysia.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 568 | P2 | verify_directory_fit_before_any_approval | yandex.com | https://yandex.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
