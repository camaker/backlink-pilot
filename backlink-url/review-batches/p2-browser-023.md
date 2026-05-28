# Coverage Review Batch: coverage-review-p2-023

Generated: 2026-05-28T13:32:04.396Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 193
Batch rows: 15
Remaining after batch: 171
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
| 8 | 156 | P2 | verify_directory_fit_before_any_approval | blogs.urz.uni-halle.de | https://blogs.urz.uni-halle.de/startklar/quellen-und-verweise/comment-page-3 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 157 | P2 | verify_directory_fit_before_any_approval | blogs.uww.edu | https://blogs.uww.edu/artofmakai/2021/03/23/hyper-light-drifter-the-game-that-taught-me-how-to-play-video-games | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 158 | P2 | verify_directory_fit_before_any_approval | blogs.uww.edu | https://blogs.uww.edu/artofmakai/2021/04/13/how-to-draw-the-importance-of-schedules | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 159 | P2 | verify_directory_fit_before_any_approval | blogs.zeiss.com | https://blogs.zeiss.com/news/messtechnik-de/sorgsamkeit-bringt-sie-weiter | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 160 | P2 | verify_directory_fit_before_any_approval | bordeaux.onvasortir.com | https://bordeaux.onvasortir.com/profil_msg_inexistant.php | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 161 | P2 | verify_directory_fit_before_any_approval | brownbagteacher.com | https://brownbagteacher.com/what-im-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 163 | P2 | verify_directory_fit_before_any_approval | browneyedbaker.com | https://www.browneyedbaker.com/how-to-make-pate-a-choux-fill-eclairs-and-cream-puffs | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 164 | P2 | verify_directory_fit_before_any_approval | bugs.documentfoundation.org | https://bugs.documentfoundation.org/show_bug.cgi?id=162681 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 174 | P2 | verify_directory_fit_before_any_approval | calaos.fr | https://calaos.fr/forum/member.php?action=profile&uid=7732 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 175 | P2 | verify_directory_fit_before_any_approval | cantstayoutofthekitchen.com | https://cantstayoutofthekitchen.com/2022/01/06/blueberry-walnut-overnight-oatmeal | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 177 | P2 | verify_directory_fit_before_any_approval | capturebilling.com | https://capturebilling.com/new-quality-aca-reporting-standards | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 178 | P2 | verify_directory_fit_before_any_approval | career.tu-sofia.bg | https://career.tu-sofia.bg/employer/geometry-dash-subzero | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 179 | P2 | verify_directory_fit_before_any_approval | cartoonresearch.com | https://cartoonresearch.com/index.php/forgotten-anime-57-kirara-2000 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 180 | P2 | verify_directory_fit_before_any_approval | certifiedpastryaficionado.com | https://www.certifiedpastryaficionado.com/churro-waffles | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 181 | P2 | verify_directory_fit_before_any_approval | certifiedpastryaficionado.com | https://www.certifiedpastryaficionado.com/nutella-cream-pie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
