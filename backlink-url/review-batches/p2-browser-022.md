# Coverage Review Batch: coverage-review-p2-022

Generated: 2026-05-28T13:21:45.384Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 208
Batch rows: 15
Remaining after batch: 186
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
| 8 | 138 | P2 | verify_directory_fit_before_any_approval | blog.prusa3d.com | https://blog.prusa3d.com/make-it-fly-contest-winners_77429 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 139 | P2 | verify_directory_fit_before_any_approval | blog.setlist.fm | http://blog.setlist.fm/2009/03/setlistfm-hits-blogosphere.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 140 | P2 | verify_directory_fit_before_any_approval | blog.tallmenshoes.com | https://blog.tallmenshoes.com/2018/10/5-ways-to-elevate-your-fashion.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 141 | P2 | verify_directory_fit_before_any_approval | blog.thefirestore.com | http://blog.thefirestore.com/2017/06/aztek-kit-strong-versatile-reliable.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 144 | P2 | verify_directory_fit_before_any_approval | blogg.ng.se | https://blogg.ng.se/michael-gill/2016/01/jag-och-dottern-oppnar-star-wars-lador | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 145 | P2 | verify_directory_fit_before_any_approval | blogg.ng.se | https://blogg.ng.se/paparazzibloggen/2021/03/exklusiv-forhandslyssning-av-david-bowies-dotters-nya-musik | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 147 | P2 | verify_directory_fit_before_any_approval | blogs.city.ac.uk | https://blogs.city.ac.uk/sustainable-city/sortingchallenge/sorting-challenge-2014-15 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 148 | P2 | verify_directory_fit_before_any_approval | blogs.deusto.es | https://blogs.deusto.es/innovandis/exprime-las-naranjas | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 149 | P2 | verify_directory_fit_before_any_approval | blogs.deusto.es | https://blogs.deusto.es/innovandis/llegando-al-nivel-pro-con-lxs-20g-en-innovandis | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 150 | P2 | verify_directory_fit_before_any_approval | blogs.eltiempo.com | https://blogs.eltiempo.com/el-tiempo-del-cine/2025/02/10/oscar-2025-analisis-de-cada-categoria-parte-i | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 151 | P2 | verify_directory_fit_before_any_approval | blogs.evergreen.edu | http://blogs.evergreen.edu/morisa24/box-2-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 152 | P2 | verify_directory_fit_before_any_approval | blogs.evergreen.edu | http://blogs.evergreen.edu/morisa24/box-4 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 153 | P2 | verify_directory_fit_before_any_approval | blogs.memphis.edu | https://blogs.memphis.edu/padm3601/2015/02/11/death-penalty | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 154 | P2 | verify_directory_fit_before_any_approval | blogs.ubc.ca | https://blogs.ubc.ca/etec540socialmedia2013/sample-page/introduction-to-google | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 155 | P2 | verify_directory_fit_before_any_approval | blogs.ucl.ac.uk | https://blogs.ucl.ac.uk/brits/2014/06/01/sales-growth-curves | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
