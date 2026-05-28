# Coverage Review Batch: coverage-review-p2-029

Generated: 2026-05-28T14:40:50.434Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 103
Batch rows: 15
Remaining after batch: 81
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
| 8 | 353 | P2 | verify_directory_fit_before_any_approval | makeupsavvy.co.uk | https://www.makeupsavvy.co.uk/2019/12/best-budget-concealers-for-pale-skin-2019.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 354 | P2 | verify_directory_fit_before_any_approval | mangoandsalt.com | https://www.mangoandsalt.com/2023/05/04/galgos-podencos-tout-savoir-adoption-levriers-despagne | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 355 | P2 | verify_directory_fit_before_any_approval | mangoandsalt.com | https://www.mangoandsalt.com/2024/07/11/collection-de-chaussures-barefoot-avis-conseils-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 356 | P2 | verify_directory_fit_before_any_approval | manilashopper.com | https://www.manilashopper.com/2014/11/the-stoneware-pottery-shop-in-cagayan.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 359 | P2 | verify_directory_fit_before_any_approval | mastodon.social | https://mastodon.social/@rstevens/112532171747034727 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 362 | P2 | verify_directory_fit_before_any_approval | michaelgeist.ca | https://www.michaelgeist.ca/2023/05/this-must-stop-government-and-liberal-party-go-all-in-on-speech-regulation-with-political-truth-oversight-bodies-mandated-press-source-tracing-and-disclosure-of-critics-communications | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 367 | P2 | verify_directory_fit_before_any_approval | moonsoap.com | https://www.moonsoap.com/hpgen/HPB/entries/8.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 368 | P2 | verify_directory_fit_before_any_approval | multichain.com | https://multichain.com/qa/user/parrotcatsup3 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 369 | P2 | verify_directory_fit_before_any_approval | mummyfever.co.uk | https://mummyfever.co.uk/family-skiing-in-bulgaria | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 370 | P2 | verify_directory_fit_before_any_approval | mummyfever.co.uk | https://mummyfever.co.uk/the-best-youtube-home-workouts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 372 | P2 | verify_directory_fit_before_any_approval | musthavemom.com | https://musthavemom.com/how-to-get-a-designer-look-without-the-interior-decorator-price-tag | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 374 | P2 | verify_directory_fit_before_any_approval | myanimelist.net | https://myanimelist.net/profile/Akizuki_Airi | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 375 | P2 | verify_directory_fit_before_any_approval | mycomics.de | https://www.mycomics.de/profil/tedcrane.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 379 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/167783170-ChatGPT-in-Spain-Revolutionizing-Communication-and-AI-Interaction?order=popular&page=2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 380 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/18132-o-stronie-wiadomosci-na-glownej-itp?order=popular | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
