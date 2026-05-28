# Coverage Review Batch: coverage-review-p2-026

Generated: 2026-05-28T14:26:43.047Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 7
Limit: 15
Matching rows: 148
Batch rows: 15
Remaining after batch: 126
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
| 8 | 253 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/7-easy-everyday-gluten-free-swaps | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 254 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/a-festive-holiday-sangria-recipe-tips-for-a-healthier-cocktail | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 255 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/how-to-make-homemade-oat-milk | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 256 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/how-to-make-juice-without-a-juicer-3-green-juice-recipes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 257 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/qa-founders-motion-matcha-one-go-energy-boosters | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 259 | P2 | verify_directory_fit_before_any_approval | fivereasonssports.com | https://www.fivereasonssports.com/news/ultimate-miami-heat-fan-travel-guide-tickets-hotels-and-local-hotspots | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 262 | P2 | verify_directory_fit_before_any_approval | flokii.com | https://flokii.com/users/view/58762 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 264 | P2 | verify_directory_fit_before_any_approval | forum.epicbrowser.com | https://forum.epicbrowser.com/profile.php?id=78821 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 265 | P2 | verify_directory_fit_before_any_approval | forum.gekko.wizb.it | https://forum.gekko.wizb.it/user-14910.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 266 | P2 | verify_directory_fit_before_any_approval | forum.padowan.dk | https://forum.padowan.dk/profile.php?id=33438 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 268 | P2 | verify_directory_fit_before_any_approval | forums.maxperformanceinc.com | https://forums.maxperformanceinc.com/forums/member.php?u=202517 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 270 | P2 | verify_directory_fit_before_any_approval | freesound.org | https://freesound.org/people/florianreichelt/sounds/440601 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 276 | P2 | verify_directory_fit_before_any_approval | ginjfo.com | https://www.ginjfo.com/actualites/logiciels/jeux-video-logiciels/les-sims-4-fetent-leur-25e-anniversaire-avec-du-nouveau-contenu-massif-20250227 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 287 | P2 | verify_directory_fit_before_any_approval | gizlogic.com | https://www.gizlogic.com/android-auto-8-4-lanzamiento | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 289 | P2 | verify_directory_fit_before_any_approval | global21.oceansconference.org | https://global21.oceansconference.org/2019/04/01/join-5000-ocean-technology-experts-at-ocean-business | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
