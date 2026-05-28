# Coverage Review Batch: coverage-review-p2-033

Generated: 2026-05-28T14:54:07.663Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 43
Batch rows: 15
Remaining after batch: 21
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
| 8 | 484 | P2 | verify_directory_fit_before_any_approval | slice.uccs.edu | https://slice.uccs.edu/?p=804 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 486 | P2 | verify_directory_fit_before_any_approval | snipplr.com | https://snipplr.com/users/mcleanross?language=all | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 487 | P2 | verify_directory_fit_before_any_approval | soccernet.ng | https://soccernet.ng/2024/03/were-looking-forward-to-it-atalantas-lookman-pumped-ahead-of-nigerias-jollof-derby-against-ghana.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 493 | P2 | verify_directory_fit_before_any_approval | speechandlanguagekids.com | https://www.speechandlanguagekids.com/week-7-summer-speech-challenge | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 495 | P2 | verify_directory_fit_before_any_approval | squatuniversity.com | https://squatuniversity.com/2015/12/01/the-squat-fix-hip-mobility-pt-1/comment-page-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 496 | P2 | verify_directory_fit_before_any_approval | squatuniversity.com | https://squatuniversity.com/2016/04/07/how-to-perfect-the-front-squat/comment-page-4 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 498 | P2 | verify_directory_fit_before_any_approval | stampstampede.org | https://www.stampstampede.org/society-stampers/groups/sprunki-game-1453889805/members | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 506 | P2 | verify_directory_fit_before_any_approval | steffisrecipes.com | https://www.steffisrecipes.com/2020/04/idli-kurma.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 509 | P2 | verify_directory_fit_before_any_approval | stylelovely.com | https://stylelovely.com/diybalamoda/2016/01/diy-recicla-un-jersey | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 510 | P2 | verify_directory_fit_before_any_approval | stylishpetite.com | https://stylishpetite.com/2023/07/high-tea-at-langham-hotel-pasadena.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 513 | P2 | verify_directory_fit_before_any_approval | superstore.co.jp | http://www.superstore.co.jp/wp-includes/fonts/diary.cgi?mode=comment&no=116 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 514 | P2 | verify_directory_fit_before_any_approval | sydnestyle.com | https://www.sydnestyle.com/2023/12/how-to-create-a-warm-neutrals-christmas-tree-filled-with-memories | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 515 | P2 | verify_directory_fit_before_any_approval | syncedreview.com | https://syncedreview.com/2022/06/29/nvidias-global-context-vit-achieves-sota-performance-on-cv-tasks-without-expensive-computation | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 516 | P2 | verify_directory_fit_before_any_approval | syncedreview.com | https://syncedreview.com/2024/09/09/microsofts-fully-pipelined-distributed-transformer-processes-16x-sequence-length-with-extreme-hardware-efficiency | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 520 | P2 | verify_directory_fit_before_any_approval | tech.winstonsalem.com | http://tech.winstonsalem.com/2011/09/frameworks-becoming-totally-responsible.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
