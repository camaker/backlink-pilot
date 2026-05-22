# Coverage Review Batch: p2-reclass-005

Generated: 2026-05-22T11:44:58.886Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 0
Limit: 128
Matching rows: 128
Batch rows: 128
Remaining after batch: 0
Priority counts: {"P2":128}
Action counts: {"verify_directory_fit_before_any_approval":128}

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
| 1 | 3 | P2 | verify_directory_fit_before_any_approval | 2findlocal.com | https://www.2findlocal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 2 | 4 | P2 | verify_directory_fit_before_any_approval | 4shared.com | https://www.4shared.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 3 | 5 | P2 | verify_directory_fit_before_any_approval | 500px.com | https://500px.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 4 | 56 | P2 | verify_directory_fit_before_any_approval | about.me | https://about.me/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 5 | 59 | P2 | verify_directory_fit_before_any_approval | activerain.com | https://activerain.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 6 | 71 | P2 | verify_directory_fit_before_any_approval | aiforme.wiki | https://aiforme.wiki/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 7 | 80 | P2 | verify_directory_fit_before_any_approval | aitoolsguide.com | https://aitoolsguide.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 8 | 95 | P2 | verify_directory_fit_before_any_approval | apitracker.io | https://apitracker.io/mcp-servers | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 9 | 100 | P2 | verify_directory_fit_before_any_approval | artstation.com | https://www.artstation.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 10 | 101 | P2 | verify_directory_fit_before_any_approval | athlinks.com | https://www.athlinks.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 11 | 111 | P2 | verify_directory_fit_before_any_approval | bandcamp.com | https://bandcamp.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 12 | 114 | P2 | verify_directory_fit_before_any_approval | behance.net | https://www.behance.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 13 | 126 | P2 | verify_directory_fit_before_any_approval | bizsugar.com | https://www.bizsugar.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 14 | 142 | P2 | verify_directory_fit_before_any_approval | blogarama.com | https://www.blogarama.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 15 | 146 | P2 | verify_directory_fit_before_any_approval | blogger.com | https://www.blogger.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 16 | 169 | P2 | verify_directory_fit_before_any_approval | businesshunt.co | https://businesshunt.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 17 | 172 | P2 | verify_directory_fit_before_any_approval | cabinetm.com | https://www.cabinetm.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 18 | 173 | P2 | verify_directory_fit_before_any_approval | calameo.com | https://www.calameo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 19 | 202 | P2 | verify_directory_fit_before_any_approval | cuspera.com | https://www.cuspera.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 20 | 216 | P2 | verify_directory_fit_before_any_approval | directory.ldmstudio.com | https://www.directory.ldmstudio.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 21 | 217 | P2 | verify_directory_fit_before_any_approval | disqus.com | https://disqus.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 22 | 224 | P2 | verify_directory_fit_before_any_approval | ecosystem.hubspot.com | https://ecosystem.hubspot.com/marketplace | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 23 | 227 | P2 | verify_directory_fit_before_any_approval | etsy.com | https://www.etsy.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 24 | 228 | P2 | verify_directory_fit_before_any_approval | eu-business.com | https://www.eu-business.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 25 | 230 | P2 | verify_directory_fit_before_any_approval | evernote.com | https://evernote.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 26 | 238 | P2 | verify_directory_fit_before_any_approval | ezinearticles.com | https://ezinearticles.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 27 | 251 | P2 | verify_directory_fit_before_any_approval | finduslocal.com | https://www.finduslocal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 28 | 261 | P2 | verify_directory_fit_before_any_approval | flickr.com | https://www.flickr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 29 | 286 | P2 | verify_directory_fit_before_any_approval | gitlab.com | https://gitlab.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 30 | 288 | P2 | verify_directory_fit_before_any_approval | glama.ai | https://glama.ai/mcp/servers | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 31 | 293 | P2 | verify_directory_fit_before_any_approval | gptforge.net | https://gptforge.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 32 | 295 | P2 | verify_directory_fit_before_any_approval | gravatar.com | https://gravatar.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 33 | 297 | P2 | verify_directory_fit_before_any_approval | growthhackers.com | https://growthhackers.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 34 | 303 | P2 | verify_directory_fit_before_any_approval | hg.org | https://www.hg.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 35 | 309 | P2 | verify_directory_fit_before_any_approval | ibuildnew.com.au | https://www.ibuildnew.com.au/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 36 | 310 | P2 | verify_directory_fit_before_any_approval | imgur.com | https://imgur.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 37 | 312 | P2 | verify_directory_fit_before_any_approval | indiamart.com | https://www.indiamart.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 38 | 313 | P2 | verify_directory_fit_before_any_approval | indiehacker.tools | https://www.indiehacker.tools/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 39 | 314 | P2 | verify_directory_fit_before_any_approval | indiehustles.com | https://www.indiehustles.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 40 | 316 | P2 | verify_directory_fit_before_any_approval | issuu.com | https://issuu.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 41 | 325 | P2 | verify_directory_fit_before_any_approval | justlanded.com | https://www.justlanded.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 42 | 326 | P2 | verify_directory_fit_before_any_approval | kaggle.com | https://www.kaggle.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 43 | 338 | P2 | verify_directory_fit_before_any_approval | livejournal.com | https://www.livejournal.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 44 | 339 | P2 | verify_directory_fit_before_any_approval | llmrelevance.com | https://www.llmrelevance.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 45 | 352 | P2 | verify_directory_fit_before_any_approval | makerthrive.com | https://makerthrive.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 46 | 358 | P2 | verify_directory_fit_before_any_approval | massagetherapy.com | https://www.massagetherapy.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 47 | 364 | P2 | verify_directory_fit_before_any_approval | mixcloud.com | https://www.mixcloud.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 48 | 387 | P2 | verify_directory_fit_before_any_approval | newswiretoday.com | https://www.newswiretoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 49 | 397 | P2 | verify_directory_fit_before_any_approval | notion.so | https://www.notion.so/integrations | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 50 | 401 | P2 | verify_directory_fit_before_any_approval | onlineprnews.com | https://www.onlineprnews.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 51 | 413 | P2 | verify_directory_fit_before_any_approval | patreon.com | https://www.patreon.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 52 | 426 | P2 | verify_directory_fit_before_any_approval | porch.com | https://porch.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 53 | 428 | P2 | verify_directory_fit_before_any_approval | pr-free.com | https://www.pr-free.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 54 | 444 | P2 | verify_directory_fit_before_any_approval | quibblo.com | https://www.quibblo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 55 | 467 | P2 | verify_directory_fit_before_any_approval | scribd.com | https://www.scribd.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 56 | 476 | P2 | verify_directory_fit_before_any_approval | sitepoint.com | https://www.sitepoint.com/community | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 57 | 482 | P2 | verify_directory_fit_before_any_approval | slant.co | https://www.slant.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 58 | 485 | P2 | verify_directory_fit_before_any_approval | slideshare.net | https://www.slideshare.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 59 | 491 | P2 | verify_directory_fit_before_any_approval | soundcloud.com | https://soundcloud.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 60 | 501 | P2 | verify_directory_fit_before_any_approval | startupfa.me | https://startupfa.me/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 61 | 502 | P2 | verify_directory_fit_before_any_approval | startups.com | https://www.startups.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 62 | 505 | P2 | verify_directory_fit_before_any_approval | startus.cc | https://startus.cc/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 63 | 507 | P2 | verify_directory_fit_before_any_approval | strava.com | https://www.strava.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 64 | 511 | P2 | verify_directory_fit_before_any_approval | substack.com | https://substack.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 65 | 517 | P2 | verify_directory_fit_before_any_approval | taalk.com | https://taalk.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 66 | 518 | P2 | verify_directory_fit_before_any_approval | teacherspayteachers.com | https://www.teacherspayteachers.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 67 | 519 | P2 | verify_directory_fit_before_any_approval | tech.co | https://tech.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 68 | 538 | P2 | verify_directory_fit_before_any_approval | toolsfine.com | https://toolsfine.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 69 | 540 | P2 | verify_directory_fit_before_any_approval | trustmrr.com | https://trustmrr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 70 | 542 | P2 | verify_directory_fit_before_any_approval | tumblr.com | https://www.tumblr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 71 | 543 | P2 | verify_directory_fit_before_any_approval | tupalo.com | https://tupalo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 72 | 552 | P2 | verify_directory_fit_before_any_approval | webmasterworld.com | https://www.webmasterworld.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 73 | 557 | P2 | verify_directory_fit_before_any_approval | wellness.com | https://www.wellness.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 74 | 558 | P2 | verify_directory_fit_before_any_approval | whatlaunchedtoday.com | https://whatlaunchedtoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 75 | 560 | P2 | verify_directory_fit_before_any_approval | where2go.com | https://www.where2go.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 76 | 571 | P2 | verify_directory_fit_before_any_approval | your-product.com | https://your-product.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 77 | 361 | P2 | verify_directory_fit_before_any_approval | metric-converter.net | https://metric-converter.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 78 | 499 | P2 | verify_directory_fit_before_any_approval | startup88.com | https://startup88.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 79 | 58 | P2 | verify_directory_fit_before_any_approval | accounts.google.com | https://accounts.google.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 80 | 89 | P2 | verify_directory_fit_before_any_approval | anspblog.org | https://www.anspblog.org/fin-to-limb-to-art | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 81 | 93 | P2 | verify_directory_fit_before_any_approval | api.indexnow.org | https://api.indexnow.org/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 82 | 97 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2022/06/calendarizacao-da-mobilidade-por-doenca | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 83 | 98 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2024/05/e-depois-de-abril-paulo-prudencio | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 84 | 110 | P2 | verify_directory_fit_before_any_approval | bakersroyale.com | https://bakersroyale.com/chocolate-banana-bread-muffins-stuffed-with-reeses-peanut-butter-cup | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 85 | 112 | P2 | verify_directory_fit_before_any_approval | bangshift.com | https://bangshift.com/bangshift1320/baby-gators-photos-nhra-divisional-sportsman-drag-racing-action-shots | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 86 | 118 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/awards/breaking-news-announcing-the-2023-better-reading-top-100 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 87 | 119 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/book-life/wine-coffee-tea-what-do-you-drink-while-youre-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 88 | 120 | P2 | verify_directory_fit_before_any_approval | bevcooks.com | https://bevcooks.com/2019/06/creamy-chicken-and-asparagus-casserole | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 89 | 123 | P2 | verify_directory_fit_before_any_approval | bing.com | https://www.bing.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 90 | 128 | P2 | verify_directory_fit_before_any_approval | blafusel.de | https://www.blafusel.de/phpbb/memberlist.php?mode=viewprofile&u=8625 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 91 | 130 | P2 | verify_directory_fit_before_any_approval | blend4web.com | https://www.blend4web.com/ru/forums/users/alexreynolds/posts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 92 | 131 | P2 | verify_directory_fit_before_any_approval | blog.bmtmicro.com | https://blog.bmtmicro.com/4449-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 93 | 132 | P2 | verify_directory_fit_before_any_approval | blog.goaffpro.com | https://blog.goaffpro.com/mastering-affiliate-product-reviews-a-step-by-step-guide-for-engaging-content-and-conversions | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 94 | 139 | P2 | verify_directory_fit_before_any_approval | blog.setlist.fm | http://blog.setlist.fm/2009/03/setlistfm-hits-blogosphere.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 95 | 161 | P2 | verify_directory_fit_before_any_approval | brownbagteacher.com | https://brownbagteacher.com/what-im-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 96 | 178 | P2 | verify_directory_fit_before_any_approval | career.tu-sofia.bg | https://career.tu-sofia.bg/employer/geometry-dash-subzero | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 97 | 179 | P2 | verify_directory_fit_before_any_approval | cartoonresearch.com | https://cartoonresearch.com/index.php/forgotten-anime-57-kirara-2000 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 98 | 187 | P2 | verify_directory_fit_before_any_approval | cinescopia.com | https://cinescopia.com/las-10-mejores-peliculas-de-casey-affleck/2024/08 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 99 | 207 | P2 | verify_directory_fit_before_any_approval | demilked.com | https://www.demilked.com/just-a-girl | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 100 | 253 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/7-easy-everyday-gluten-free-swaps | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 101 | 276 | P2 | verify_directory_fit_before_any_approval | ginjfo.com | https://www.ginjfo.com/actualites/logiciels/jeux-video-logiciels/les-sims-4-fetent-leur-25e-anniversaire-avec-du-nouveau-contenu-massif-20250227 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 102 | 287 | P2 | verify_directory_fit_before_any_approval | gizlogic.com | https://www.gizlogic.com/android-auto-8-4-lanzamiento | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 103 | 291 | P2 | verify_directory_fit_before_any_approval | godchild.keenspot.com | http://godchild.keenspot.com/comic/evolution-of-maggie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 104 | 299 | P2 | verify_directory_fit_before_any_approval | happyhealthymama.com | https://happyhealthymama.com/air-fryer-apples-healthy.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 105 | 315 | P2 | verify_directory_fit_before_any_approval | iotwreport.com | https://iotwreport.com/letitia-james-indicted-for-banking-fraud | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 106 | 320 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/94f737822923f4567e1a7ce9681e5b9a-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 107 | 321 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/grilled-lemon-garlic-potato-kabobs/grilled-potato-kabobs-with-lemon-and-garlic | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 108 | 327 | P2 | verify_directory_fit_before_any_approval | kcn.ne.jp | http://www.kcn.ne.jp/~gorosan/cgi-bin/diarypro/diary.cgi?mode=comment&no=97 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 109 | 328 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=224 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 110 | 329 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=239 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 111 | 330 | P2 | verify_directory_fit_before_any_approval | labsk.net | https://labsk.net/index.php?action=profile%3Bu%3D50620 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 112 | 342 | P2 | verify_directory_fit_before_any_approval | loveandmarriageblog.com | https://loveandmarriageblog.com/beach-water-cocktail | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 113 | 359 | P2 | verify_directory_fit_before_any_approval | mastodon.social | https://mastodon.social/@rstevens/112532171747034727 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 114 | 367 | P2 | verify_directory_fit_before_any_approval | moonsoap.com | https://www.moonsoap.com/hpgen/HPB/entries/8.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 115 | 379 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/167783170-ChatGPT-in-Spain-Revolutionizing-Communication-and-AI-Interaction?order=popular&page=2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 116 | 380 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/18132-o-stronie-wiadomosci-na-glownej-itp?order=popular | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 117 | 409 | P2 | verify_directory_fit_before_any_approval | papertraildesign.com | https://www.papertraildesign.com/football-water-bottle-labels-free-printable | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 118 | 412 | P2 | verify_directory_fit_before_any_approval | patisserie-okumoto.com | https://www.patisserie-okumoto.com/hpgen/HPB/entries/1.html?https%3A%2F%2Ffuhrerschein-eu.com%2F= | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 119 | 418 | P2 | verify_directory_fit_before_any_approval | pharmahub.org | https://pharmahub.org/kb/registration/login2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 120 | 419 | P2 | verify_directory_fit_before_any_approval | pinkcaddytravelogue.com | https://www.pinkcaddytravelogue.com/7-day-iceland-itinerary | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 121 | 457 | P2 | verify_directory_fit_before_any_approval | ru.esosedi.org | https://ru.esosedi.org/RU/BA/8564043/ust_saldyibash | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 122 | 530 | P2 | verify_directory_fit_before_any_approval | threewood.jp | https://threewood.jp/hpgen/HPB/entries/25.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 123 | 568 | P2 | verify_directory_fit_before_any_approval | yandex.com | https://yandex.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 124 | 573 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/almond-banana-bread | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 125 | 574 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/banana-bread-coffee-cake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 126 | 575 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/candy-cane-muddy-buddies | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 127 | 576 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/cinnamon-toast-crunch-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 128 | 577 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/easy-to-make-snowman-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
