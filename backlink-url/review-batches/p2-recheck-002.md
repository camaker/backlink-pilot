# Coverage Review Batch: p2-recheck-002

Generated: 2026-05-22T10:45:09.833Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 47
Limit: 100
Matching rows: 340
Batch rows: 100
Remaining after batch: 193
Priority counts: {"P2":100}
Action counts: {"verify_directory_fit_before_any_approval":100}

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
| 48 | 373 | P2 | verify_directory_fit_before_any_approval | my.g2.com | https://my.g2.com/sellers/welcome | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 49 | 377 | P2 | verify_directory_fit_before_any_approval | myfolio.com | https://myfolio.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 50 | 386 | P2 | verify_directory_fit_before_any_approval | newsaasly.com | https://newsaasly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 51 | 387 | P2 | verify_directory_fit_before_any_approval | newswiretoday.com | https://www.newswiretoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 52 | 394 | P2 | verify_directory_fit_before_any_approval | nocodefounders.com | https://www.nocodefounders.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 53 | 397 | P2 | verify_directory_fit_before_any_approval | notion.so | https://www.notion.so/integrations | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 54 | 399 | P2 | verify_directory_fit_before_any_approval | noxilo.com | https://noxilo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 55 | 401 | P2 | verify_directory_fit_before_any_approval | onlineprnews.com | https://www.onlineprnews.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 56 | 403 | P2 | verify_directory_fit_before_any_approval | open-launch.com | https://open-launch.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 57 | 405 | P2 | verify_directory_fit_before_any_approval | openclawdir.com | https://openclawdir.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 58 | 411 | P2 | verify_directory_fit_before_any_approval | pastebin.com | https://pastebin.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 59 | 413 | P2 | verify_directory_fit_before_any_approval | patreon.com | https://www.patreon.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 60 | 414 | P2 | verify_directory_fit_before_any_approval | pearltrees.com | https://www.pearltrees.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 61 | 416 | P2 | verify_directory_fit_before_any_approval | penzu.com | https://penzu.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 62 | 420 | P2 | verify_directory_fit_before_any_approval | pipedream.com | https://pipedream.com/docs/components | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 63 | 424 | P2 | verify_directory_fit_before_any_approval | placester.com | https://placester.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 64 | 426 | P2 | verify_directory_fit_before_any_approval | porch.com | https://porch.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 65 | 428 | P2 | verify_directory_fit_before_any_approval | pr-free.com | https://www.pr-free.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 66 | 429 | P2 | verify_directory_fit_before_any_approval | pr.com | https://www.pr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 67 | 434 | P2 | verify_directory_fit_before_any_approval | prlog.org | https://www.prlog.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 68 | 440 | P2 | verify_directory_fit_before_any_approval | proofstories.io | https://proofstories.io/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 69 | 444 | P2 | verify_directory_fit_before_any_approval | quibblo.com | https://www.quibblo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 70 | 455 | P2 | verify_directory_fit_before_any_approval | replit.com | https://replit.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 71 | 458 | P2 | verify_directory_fit_before_any_approval | rundown.ai | https://www.rundown.ai/tools | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 72 | 466 | P2 | verify_directory_fit_before_any_approval | scoop.it | https://www.scoop.it/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 73 | 467 | P2 | verify_directory_fit_before_any_approval | scribd.com | https://www.scribd.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 74 | 469 | P2 | verify_directory_fit_before_any_approval | semfirms.com | https://www.semfirms.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 75 | 476 | P2 | verify_directory_fit_before_any_approval | sitepoint.com | https://www.sitepoint.com/community | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 76 | 482 | P2 | verify_directory_fit_before_any_approval | slant.co | https://www.slant.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 77 | 485 | P2 | verify_directory_fit_before_any_approval | slideshare.net | https://www.slideshare.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 78 | 490 | P2 | verify_directory_fit_before_any_approval | sooperarticles.com | https://www.sooperarticles.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 79 | 491 | P2 | verify_directory_fit_before_any_approval | soundcloud.com | https://soundcloud.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 80 | 494 | P2 | verify_directory_fit_before_any_approval | spoke.com | https://www.spoke.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 81 | 501 | P2 | verify_directory_fit_before_any_approval | startupfa.me | https://startupfa.me/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 82 | 502 | P2 | verify_directory_fit_before_any_approval | startups.com | https://www.startups.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 83 | 505 | P2 | verify_directory_fit_before_any_approval | startus.cc | https://startus.cc/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 84 | 507 | P2 | verify_directory_fit_before_any_approval | strava.com | https://www.strava.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 85 | 508 | P2 | verify_directory_fit_before_any_approval | strikingly.com | https://www.strikingly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 86 | 511 | P2 | verify_directory_fit_before_any_approval | substack.com | https://substack.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 87 | 512 | P2 | verify_directory_fit_before_any_approval | sulekha.com | https://www.sulekha.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 88 | 517 | P2 | verify_directory_fit_before_any_approval | taalk.com | https://taalk.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 89 | 518 | P2 | verify_directory_fit_before_any_approval | teacherspayteachers.com | https://www.teacherspayteachers.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 90 | 519 | P2 | verify_directory_fit_before_any_approval | tech.co | https://tech.co/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 91 | 528 | P2 | verify_directory_fit_before_any_approval | thesaasdirectory.com | https://thesaasdirectory.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 92 | 532 | P2 | verify_directory_fit_before_any_approval | todaylaunches.com | https://todaylaunches.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 93 | 538 | P2 | verify_directory_fit_before_any_approval | toolsfine.com | https://toolsfine.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 94 | 540 | P2 | verify_directory_fit_before_any_approval | trustmrr.com | https://trustmrr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 95 | 542 | P2 | verify_directory_fit_before_any_approval | tumblr.com | https://www.tumblr.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 96 | 543 | P2 | verify_directory_fit_before_any_approval | tupalo.com | https://tupalo.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 97 | 549 | P2 | verify_directory_fit_before_any_approval | warriorforum.com | https://www.warriorforum.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 98 | 551 | P2 | verify_directory_fit_before_any_approval | webdesign-inspiration.com | https://webdesign-inspiration.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 99 | 552 | P2 | verify_directory_fit_before_any_approval | webmasterworld.com | https://www.webmasterworld.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 100 | 554 | P2 | verify_directory_fit_before_any_approval | weebly.com | https://www.weebly.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 101 | 555 | P2 | verify_directory_fit_before_any_approval | wefunder.com | https://wefunder.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 102 | 557 | P2 | verify_directory_fit_before_any_approval | wellness.com | https://www.wellness.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 103 | 558 | P2 | verify_directory_fit_before_any_approval | whatlaunchedtoday.com | https://whatlaunchedtoday.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 104 | 560 | P2 | verify_directory_fit_before_any_approval | where2go.com | https://www.where2go.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 105 | 566 | P2 | verify_directory_fit_before_any_approval | wordpress.com | https://wordpress.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 106 | 569 | P2 | verify_directory_fit_before_any_approval | yellowpagesgoesgreen.org | https://www.yellowpagesgoesgreen.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 107 | 570 | P2 | verify_directory_fit_before_any_approval | yogatrail.com | https://www.yogatrail.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 108 | 579 | P2 | verify_directory_fit_before_any_approval | zapier.com | https://zapier.com/developer | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 109 | 571 | P2 | verify_directory_fit_before_any_approval | your-product.com | https://your-product.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 110 | 404 | P2 | verify_directory_fit_before_any_approval | openclaw.ai | https://openclaw.ai/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 111 | 361 | P2 | verify_directory_fit_before_any_approval | metric-converter.net | https://metric-converter.net/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 112 | 396 | P2 | verify_directory_fit_before_any_approval | nodejs.org | https://nodejs.org/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 113 | 499 | P2 | verify_directory_fit_before_any_approval | startup88.com | https://startup88.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 114 | 57 | P2 | verify_directory_fit_before_any_approval | abracomex.org | https://abracomex.org/aula-inaugural-graduacao-servicos-juridicos-online | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 115 | 58 | P2 | verify_directory_fit_before_any_approval | accounts.google.com | https://accounts.google.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 116 | 89 | P2 | verify_directory_fit_before_any_approval | anspblog.org | https://www.anspblog.org/fin-to-limb-to-art | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 117 | 93 | P2 | verify_directory_fit_before_any_approval | api.indexnow.org | https://api.indexnow.org/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 118 | 97 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2022/06/calendarizacao-da-mobilidade-por-doenca | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 119 | 98 | P2 | verify_directory_fit_before_any_approval | arlindovsky.net | https://www.arlindovsky.net/2024/05/e-depois-de-abril-paulo-prudencio | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 120 | 102 | P2 | verify_directory_fit_before_any_approval | athomeinthefuture.com | https://athomeinthefuture.com/2022/03/design-decorate-perfect-backyard | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 121 | 107 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/16-sweet-easter-treats | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 122 | 108 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/sweets-for-the-season | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 123 | 109 | P2 | verify_directory_fit_before_any_approval | bakerella.com | https://www.bakerella.com/yummy-mummy-snack-cakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 124 | 110 | P2 | verify_directory_fit_before_any_approval | bakersroyale.com | https://bakersroyale.com/chocolate-banana-bread-muffins-stuffed-with-reeses-peanut-butter-cup | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 125 | 112 | P2 | verify_directory_fit_before_any_approval | bangshift.com | https://bangshift.com/bangshift1320/baby-gators-photos-nhra-divisional-sportsman-drag-racing-action-shots | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 126 | 113 | P2 | verify_directory_fit_before_any_approval | beautythroughimperfection.com | https://www.beautythroughimperfection.com/reindeer-donuts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 127 | 118 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/awards/breaking-news-announcing-the-2023-better-reading-top-100 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 128 | 119 | P2 | verify_directory_fit_before_any_approval | betterreading.com.au | https://www.betterreading.com.au/news/book-life/wine-coffee-tea-what-do-you-drink-while-youre-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 129 | 120 | P2 | verify_directory_fit_before_any_approval | bevcooks.com | https://bevcooks.com/2019/06/creamy-chicken-and-asparagus-casserole | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 130 | 121 | P2 | verify_directory_fit_before_any_approval | bevcooks.com | https://bevcooks.com/2024/08/homemade-ricotta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 131 | 123 | P2 | verify_directory_fit_before_any_approval | bing.com | https://www.bing.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 132 | 128 | P2 | verify_directory_fit_before_any_approval | blafusel.de | https://www.blafusel.de/phpbb/memberlist.php?mode=viewprofile&u=8625 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 133 | 129 | P2 | verify_directory_fit_before_any_approval | blankitinerary.com | https://blankitinerary.com/santana-fall.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 134 | 130 | P2 | verify_directory_fit_before_any_approval | blend4web.com | https://www.blend4web.com/ru/forums/users/alexreynolds/posts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 135 | 131 | P2 | verify_directory_fit_before_any_approval | blog.bmtmicro.com | https://blog.bmtmicro.com/4449-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 136 | 132 | P2 | verify_directory_fit_before_any_approval | blog.goaffpro.com | https://blog.goaffpro.com/mastering-affiliate-product-reviews-a-step-by-step-guide-for-engaging-content-and-conversions | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 137 | 133 | P2 | verify_directory_fit_before_any_approval | blog.metastock.com | https://blog.metastock.com/2024/08/mastering-ichimoku-method-jeff-gibby.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 138 | 134 | P2 | verify_directory_fit_before_any_approval | blog.myesr.org | https://blog.myesr.org/espanol/los-casos-de-dr-pepe-caso-de-torax-12 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 139 | 135 | P2 | verify_directory_fit_before_any_approval | blog.myesr.org | https://blog.myesr.org/espanol/los-casos-de-dr-pepe-caso-de-torax-14 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 140 | 136 | P2 | verify_directory_fit_before_any_approval | blog.organicfood.vn | https://blog.organicfood.vn/thoi-gian-ngam-cac-loai-hat-la-bao-lau-tai-sao-phai-ngam-hat | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 141 | 137 | P2 | verify_directory_fit_before_any_approval | blog.pianetamamma.it | https://blog.pianetamamma.it/amoredimamma/polpette-di-prosciutto-cotto-e-ricotta-al-forno | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 142 | 138 | P2 | verify_directory_fit_before_any_approval | blog.prusa3d.com | https://blog.prusa3d.com/make-it-fly-contest-winners_77429 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 143 | 139 | P2 | verify_directory_fit_before_any_approval | blog.setlist.fm | http://blog.setlist.fm/2009/03/setlistfm-hits-blogosphere.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 144 | 140 | P2 | verify_directory_fit_before_any_approval | blog.tallmenshoes.com | https://blog.tallmenshoes.com/2018/10/5-ways-to-elevate-your-fashion.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 145 | 141 | P2 | verify_directory_fit_before_any_approval | blog.thefirestore.com | http://blog.thefirestore.com/2017/06/aztek-kit-strong-versatile-reliable.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 146 | 144 | P2 | verify_directory_fit_before_any_approval | blogg.ng.se | https://blogg.ng.se/michael-gill/2016/01/jag-och-dottern-oppnar-star-wars-lador | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 147 | 145 | P2 | verify_directory_fit_before_any_approval | blogg.ng.se | https://blogg.ng.se/paparazzibloggen/2021/03/exklusiv-forhandslyssning-av-david-bowies-dotters-nya-musik | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
