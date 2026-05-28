# Coverage Review Batch: coverage-review-p2-030

Generated: 2026-05-28T14:44:39.107Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 88
Batch rows: 15
Remaining after batch: 66
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
| 8 | 381 | P2 | verify_directory_fit_before_any_approval | negociosyemprendimiento.org | https://www.negociosyemprendimiento.org/2024/12/historia-temu.html?m=0 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 383 | P2 | verify_directory_fit_before_any_approval | netboard.hu | https://www.netboard.hu/searchuser_full.php?id=139760 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 389 | P2 | verify_directory_fit_before_any_approval | nintendoworldreport.com | https://www.nintendoworldreport.com/forums/index.php?action=profile%3Bu%3D56540 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 398 | P2 | verify_directory_fit_before_any_approval | notsowimpyteacher.com | https://notsowimpyteacher.com/2024/01/5-reasons-why-teaching-grammar-is-still-important.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 400 | P2 | verify_directory_fit_before_any_approval | onesweetmess.com | https://www.onesweetmess.com/2017/06/08/cherry-negroni | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 408 | P2 | verify_directory_fit_before_any_approval | paleorunningmomma.com | https://www.paleorunningmomma.com/garlic-tuscan-shrimp-paleo-whole30 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 409 | P2 | verify_directory_fit_before_any_approval | papertraildesign.com | https://www.papertraildesign.com/football-water-bottle-labels-free-printable | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 410 | P2 | verify_directory_fit_before_any_approval | participacion.puertodelrosario.org | https://participacion.puertodelrosario.org/profiles/albaucb/groups | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 412 | P2 | verify_directory_fit_before_any_approval | patisserie-okumoto.com | https://www.patisserie-okumoto.com/hpgen/HPB/entries/1.html?https%3A%2F%2Ffuhrerschein-eu.com%2F= | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 417 | P2 | verify_directory_fit_before_any_approval | peoplespunditdaily.com | https://www.peoplespunditdaily.com/news/us/2020/03/27/trump-pulls-trigger-on-defense-production-act-to-require-gm-to-make-ventilators | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 418 | P2 | verify_directory_fit_before_any_approval | pharmahub.org | https://pharmahub.org/kb/registration/login2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 419 | P2 | verify_directory_fit_before_any_approval | pinkcaddytravelogue.com | https://www.pinkcaddytravelogue.com/7-day-iceland-itinerary | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 422 | P2 | verify_directory_fit_before_any_approval | pixel77.com | https://pixel77.com/fonts-for-posters | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 423 | P2 | verify_directory_fit_before_any_approval | pixel77.com | https://pixel77.com/typography-rules-technique | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 425 | P2 | verify_directory_fit_before_any_approval | poppyandgrace.com | https://poppyandgrace.com/2017/09/raleys-lilo-and-stitch-birthday-luau | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
