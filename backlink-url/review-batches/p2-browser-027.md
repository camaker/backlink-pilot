# Coverage Review Batch: coverage-review-p2-027

Generated: 2026-05-28T14:32:21.847Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 133
Batch rows: 15
Remaining after batch: 111
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
| 8 | 290 | P2 | verify_directory_fit_before_any_approval | godchild.keenspot.com | http://godchild.keenspot.com/comic/chapter-3-page-05 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 291 | P2 | verify_directory_fit_before_any_approval | godchild.keenspot.com | http://godchild.keenspot.com/comic/evolution-of-maggie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 296 | P2 | verify_directory_fit_before_any_approval | greenerideal.com | https://greenerideal.com/wellness/disconnect-to-reconnect-connecting-with-nature-in-the-digital-age | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 299 | P2 | verify_directory_fit_before_any_approval | happyhealthymama.com | https://happyhealthymama.com/air-fryer-apples-healthy.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 300 | P2 | verify_directory_fit_before_any_approval | happyhourprojects.com | https://happyhourprojects.com/snake-bracelet | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 302 | P2 | verify_directory_fit_before_any_approval | help.lametric.com | https://help.lametric.com/support/discussions/topics/6000067542 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 304 | P2 | verify_directory_fit_before_any_approval | holdtoreset.com | https://holdtoreset.com/where-is-the-shipwreck-today-in-gta-online | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 315 | P2 | verify_directory_fit_before_any_approval | iotwreport.com | https://iotwreport.com/letitia-james-indicted-for-banking-fraud | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 317 | P2 | verify_directory_fit_before_any_approval | itsfilmedthere.com | https://www.itsfilmedthere.com/2019/01/whats-happening.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 318 | P2 | verify_directory_fit_before_any_approval | jilliancyork.com | https://jilliancyork.com/2010/02/20/on-memorability | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 320 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/94f737822923f4567e1a7ce9681e5b9a-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 321 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/grilled-lemon-garlic-potato-kabobs/grilled-potato-kabobs-with-lemon-and-garlic | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 322 | P2 | verify_directory_fit_before_any_approval | jobs.hyperisland.com | https://jobs.hyperisland.com/company/georgiana-al-usa | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 323 | P2 | verify_directory_fit_before_any_approval | jonnegroni.com | https://jonnegroni.com/2017/11/20/cinemaholics-review-justice-league-punisher | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 327 | P2 | verify_directory_fit_before_any_approval | kcn.ne.jp | http://www.kcn.ne.jp/~gorosan/cgi-bin/diarypro/diary.cgi?mode=comment&no=97 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
