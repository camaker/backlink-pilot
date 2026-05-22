# Coverage Review Batch: p2-recheck-004

Generated: 2026-05-22T11:22:30.146Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 112
Limit: 100
Matching rows: 205
Batch rows: 93
Remaining after batch: 0
Priority counts: {"P2":93}
Action counts: {"verify_directory_fit_before_any_approval":93}

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
| 113 | 356 | P2 | verify_directory_fit_before_any_approval | manilashopper.com | https://www.manilashopper.com/2014/11/the-stoneware-pottery-shop-in-cagayan.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 114 | 359 | P2 | verify_directory_fit_before_any_approval | mastodon.social | https://mastodon.social/@rstevens/112532171747034727 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 115 | 362 | P2 | verify_directory_fit_before_any_approval | michaelgeist.ca | https://www.michaelgeist.ca/2023/05/this-must-stop-government-and-liberal-party-go-all-in-on-speech-regulation-with-political-truth-oversight-bodies-mandated-press-source-tracing-and-disclosure-of-critics-communications | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 116 | 367 | P2 | verify_directory_fit_before_any_approval | moonsoap.com | https://www.moonsoap.com/hpgen/HPB/entries/8.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 117 | 369 | P2 | verify_directory_fit_before_any_approval | mummyfever.co.uk | https://mummyfever.co.uk/family-skiing-in-bulgaria | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 118 | 370 | P2 | verify_directory_fit_before_any_approval | mummyfever.co.uk | https://mummyfever.co.uk/the-best-youtube-home-workouts | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 119 | 372 | P2 | verify_directory_fit_before_any_approval | musthavemom.com | https://musthavemom.com/how-to-get-a-designer-look-without-the-interior-decorator-price-tag | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 120 | 374 | P2 | verify_directory_fit_before_any_approval | myanimelist.net | https://myanimelist.net/profile/Akizuki_Airi | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 121 | 375 | P2 | verify_directory_fit_before_any_approval | mycomics.de | https://www.mycomics.de/profil/tedcrane.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 122 | 379 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/167783170-ChatGPT-in-Spain-Revolutionizing-Communication-and-AI-Interaction?order=popular&page=2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 123 | 380 | P2 | verify_directory_fit_before_any_approval | nasze-lasie-pl.sugester.pl | https://nasze-lasie-pl.sugester.pl/18132-o-stronie-wiadomosci-na-glownej-itp?order=popular | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 124 | 381 | P2 | verify_directory_fit_before_any_approval | negociosyemprendimiento.org | https://www.negociosyemprendimiento.org/2024/12/historia-temu.html?m=0 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 125 | 383 | P2 | verify_directory_fit_before_any_approval | netboard.hu | https://www.netboard.hu/searchuser_full.php?id=139760 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 126 | 389 | P2 | verify_directory_fit_before_any_approval | nintendoworldreport.com | https://www.nintendoworldreport.com/forums/index.php?action=profile%3Bu%3D56540 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 127 | 398 | P2 | verify_directory_fit_before_any_approval | notsowimpyteacher.com | https://notsowimpyteacher.com/2024/01/5-reasons-why-teaching-grammar-is-still-important.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 128 | 400 | P2 | verify_directory_fit_before_any_approval | onesweetmess.com | https://www.onesweetmess.com/2017/06/08/cherry-negroni | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 129 | 408 | P2 | verify_directory_fit_before_any_approval | paleorunningmomma.com | https://www.paleorunningmomma.com/garlic-tuscan-shrimp-paleo-whole30 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 130 | 409 | P2 | verify_directory_fit_before_any_approval | papertraildesign.com | https://www.papertraildesign.com/football-water-bottle-labels-free-printable | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 131 | 410 | P2 | verify_directory_fit_before_any_approval | participacion.puertodelrosario.org | https://participacion.puertodelrosario.org/profiles/albaucb/groups | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 132 | 412 | P2 | verify_directory_fit_before_any_approval | patisserie-okumoto.com | https://www.patisserie-okumoto.com/hpgen/HPB/entries/1.html?https%3A%2F%2Ffuhrerschein-eu.com%2F= | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 133 | 417 | P2 | verify_directory_fit_before_any_approval | peoplespunditdaily.com | https://www.peoplespunditdaily.com/news/us/2020/03/27/trump-pulls-trigger-on-defense-production-act-to-require-gm-to-make-ventilators | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 134 | 418 | P2 | verify_directory_fit_before_any_approval | pharmahub.org | https://pharmahub.org/kb/registration/login2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 135 | 419 | P2 | verify_directory_fit_before_any_approval | pinkcaddytravelogue.com | https://www.pinkcaddytravelogue.com/7-day-iceland-itinerary | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 136 | 422 | P2 | verify_directory_fit_before_any_approval | pixel77.com | https://pixel77.com/fonts-for-posters | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 137 | 423 | P2 | verify_directory_fit_before_any_approval | pixel77.com | https://pixel77.com/typography-rules-technique | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 138 | 425 | P2 | verify_directory_fit_before_any_approval | poppyandgrace.com | https://poppyandgrace.com/2017/09/raleys-lilo-and-stitch-birthday-luau | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 139 | 430 | P2 | verify_directory_fit_before_any_approval | predictiveanalyticsworld.com | https://www.predictiveanalyticsworld.com/machinelearningtimes/dont-let-yourself-be-fooled-by-data-drift/13125 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 140 | 431 | P2 | verify_directory_fit_before_any_approval | premierchess.com | https://premierchess.com/chess-growth/maythebestplayerwin | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 141 | 432 | P2 | verify_directory_fit_before_any_approval | premierchess.com | https://premierchess.com/uncategorized/is-chess-a-sport-an-introduction-of-chess-in-and-within-the-sports-world | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 142 | 433 | P2 | verify_directory_fit_before_any_approval | preview.amplethemes.com | https://preview.amplethemes.com/blog-vlog-pro/2018/12/14/lovely-cat | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 143 | 437 | P2 | verify_directory_fit_before_any_approval | programas.cooperativa.cl | http://programas.cooperativa.cl/enaccion/2010/09/10/los-reportes-de-sustentabilidad | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 144 | 439 | P2 | verify_directory_fit_before_any_approval | proofreadanywhere.com | https://proofreadanywhere.com/get-paid-to-proofread | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 145 | 441 | P2 | verify_directory_fit_before_any_approval | pt-media.org | https://pt-media.org/2022/11/02/kuvitteellinen-hakaristi-pahoitti-mielen | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 146 | 442 | P2 | verify_directory_fit_before_any_approval | pv-magazine.com | https://www.pv-magazine.com/2022/01/15/the-weekend-read | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 147 | 445 | P2 | verify_directory_fit_before_any_approval | radioink.com | https://radioink.com/2025/04/14/donald-trump-jr-lara-trump-take-stakes-in-salem-media-group | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 148 | 446 | P2 | verify_directory_fit_before_any_approval | rcinet.ca | https://www.rcinet.ca/bhm-en/2021/02/02/a-variety-of-activities-unveiled-for-black-history-month | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 149 | 447 | P2 | verify_directory_fit_before_any_approval | rcinet.ca | https://www.rcinet.ca/rci70-en/2015/02/24/test1 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 150 | 448 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/kimberley-australia-luxury-expedition-cruise-seabourn | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 151 | 449 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/mexico-city-itinerary-the-best-things-to-do-in-4-days | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 152 | 450 | P2 | verify_directory_fit_before_any_approval | reneeroaming.com | https://www.reneeroaming.com/new-england-fall-road-trip | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 153 | 451 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2013/02/barn-card-for-sprout-tv.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 154 | 452 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2019/01/crochet-moss-stitch-in-a-rectangle.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 155 | 453 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2019/05/crochet-avocado.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 156 | 454 | P2 | verify_directory_fit_before_any_approval | repeatcrafterme.com | https://www.repeatcrafterme.com/2025/02/crochet-furry-friends-book.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 157 | 456 | P2 | verify_directory_fit_before_any_approval | ride.guru | https://ride.guru/content/newsroom/finding-your-fare-with-rideguru-a-how-to-guide | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 158 | 457 | P2 | verify_directory_fit_before_any_approval | ru.esosedi.org | https://ru.esosedi.org/RU/BA/8564043/ust_saldyibash | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 159 | 459 | P2 | verify_directory_fit_before_any_approval | runningwithspoons.com | https://www.runningwithspoons.com/easy-homemade-teriyaki-sauce | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 160 | 460 | P2 | verify_directory_fit_before_any_approval | runningwithspoons.com | https://www.runningwithspoons.com/flourless-carrot-cake-muffins | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 161 | 461 | P2 | verify_directory_fit_before_any_approval | runpee.com | https://runpee.com/10-best-math-movies-for-middle-school-students | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 162 | 468 | P2 | verify_directory_fit_before_any_approval | selfloverainbow.com | https://www.selfloverainbow.com/self-improvement-7-reasons-why-we-struggle | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 163 | 470 | P2 | verify_directory_fit_before_any_approval | sharonsantoni.com | https://sharonsantoni.com/2023/05/making-strawberry-jam-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 164 | 473 | P2 | verify_directory_fit_before_any_approval | simonsaysstampblog.com | https://www.simonsaysstampblog.com/blog/amore-laurafadora-3/comment-page-1 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 165 | 478 | P2 | verify_directory_fit_before_any_approval | sites.suffolk.edu | https://sites.suffolk.edu/connormulcahy/2014/02/28/solar-energy-lab | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 166 | 479 | P2 | verify_directory_fit_before_any_approval | sites.williams.edu | https://sites.williams.edu/srd4/methods-exercises/methods-exercise-6 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 167 | 480 | P2 | verify_directory_fit_before_any_approval | sites.williams.edu | https://sites.williams.edu/srd4/why-we-sing | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 168 | 484 | P2 | verify_directory_fit_before_any_approval | slice.uccs.edu | https://slice.uccs.edu/?p=804 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 169 | 486 | P2 | verify_directory_fit_before_any_approval | snipplr.com | https://snipplr.com/users/mcleanross?language=all | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 170 | 487 | P2 | verify_directory_fit_before_any_approval | soccernet.ng | https://soccernet.ng/2024/03/were-looking-forward-to-it-atalantas-lookman-pumped-ahead-of-nigerias-jollof-derby-against-ghana.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 171 | 493 | P2 | verify_directory_fit_before_any_approval | speechandlanguagekids.com | https://www.speechandlanguagekids.com/week-7-summer-speech-challenge | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 172 | 495 | P2 | verify_directory_fit_before_any_approval | squatuniversity.com | https://squatuniversity.com/2015/12/01/the-squat-fix-hip-mobility-pt-1/comment-page-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 173 | 496 | P2 | verify_directory_fit_before_any_approval | squatuniversity.com | https://squatuniversity.com/2016/04/07/how-to-perfect-the-front-squat/comment-page-4 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 174 | 498 | P2 | verify_directory_fit_before_any_approval | stampstampede.org | https://www.stampstampede.org/society-stampers/groups/sprunki-game-1453889805/members | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 175 | 506 | P2 | verify_directory_fit_before_any_approval | steffisrecipes.com | https://www.steffisrecipes.com/2020/04/idli-kurma.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 176 | 509 | P2 | verify_directory_fit_before_any_approval | stylelovely.com | https://stylelovely.com/diybalamoda/2016/01/diy-recicla-un-jersey | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 177 | 510 | P2 | verify_directory_fit_before_any_approval | stylishpetite.com | https://stylishpetite.com/2023/07/high-tea-at-langham-hotel-pasadena.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 178 | 514 | P2 | verify_directory_fit_before_any_approval | sydnestyle.com | https://www.sydnestyle.com/2023/12/how-to-create-a-warm-neutrals-christmas-tree-filled-with-memories | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 179 | 515 | P2 | verify_directory_fit_before_any_approval | syncedreview.com | https://syncedreview.com/2022/06/29/nvidias-global-context-vit-achieves-sota-performance-on-cv-tasks-without-expensive-computation | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 180 | 516 | P2 | verify_directory_fit_before_any_approval | syncedreview.com | https://syncedreview.com/2024/09/09/microsofts-fully-pipelined-distributed-transformer-processes-16x-sequence-length-with-extreme-hardware-efficiency | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 181 | 520 | P2 | verify_directory_fit_before_any_approval | tech.winstonsalem.com | http://tech.winstonsalem.com/2011/09/frameworks-becoming-totally-responsible.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 182 | 522 | P2 | verify_directory_fit_before_any_approval | techqiah.com | https://www.techqiah.com/2024/11/192-168-100-1.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 183 | 526 | P2 | verify_directory_fit_before_any_approval | thenerdswife.com | https://thenerdswife.com/happy-sisters-day-with-frozen-and-disney.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 184 | 529 | P2 | verify_directory_fit_before_any_approval | thinkgrowgiggle.com | http://www.thinkgrowgiggle.com/2020/07/10-best-mentor-texts-to-use-for-reading.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 185 | 530 | P2 | verify_directory_fit_before_any_approval | threewood.jp | https://threewood.jp/hpgen/HPB/entries/25.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 186 | 533 | P2 | verify_directory_fit_before_any_approval | tonypolecastro.com | https://tonypolecastro.com/at204 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 187 | 534 | P2 | verify_directory_fit_before_any_approval | tonypolecastro.com | https://tonypolecastro.com/guitar-notes-for-beginners/comment-page-12 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 188 | 545 | P2 | verify_directory_fit_before_any_approval | url | https://url/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 189 | 546 | P2 | verify_directory_fit_before_any_approval | visitrichmond.co.uk | https://www.visitrichmond.co.uk/blog/read/2024/03/english-tourism-week-2024-gardens-and-parks-b48 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 190 | 548 | P2 | verify_directory_fit_before_any_approval | wallhaven.cc | https://wallhaven.cc/user/lauralehman | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 191 | 556 | P2 | verify_directory_fit_before_any_approval | weirdsciencedccomics.com | https://www.weirdsciencedccomics.com/2022/02/batmancatwoman-10-review.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 192 | 561 | P2 | verify_directory_fit_before_any_approval | whimsysoul.com | https://whimsysoul.com/napa-valley-wine-train | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 193 | 562 | P2 | verify_directory_fit_before_any_approval | wiki.alumni.net | https://wiki.alumni.net/wiki/User:MincEdlate33363909 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 194 | 563 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/food/best-wet-markets-kuala-lumpur.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 195 | 564 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/tips/heading-to-malaysia-the-superstitions-you-ought-to-know.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 196 | 565 | P2 | verify_directory_fit_before_any_approval | wonderfulmalaysia.com | https://www.wonderfulmalaysia.com/tips/sport-activities-on-a-vacation-in-malaysia.htm | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 197 | 567 | P2 | verify_directory_fit_before_any_approval | xxx.com | https://xxx.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 198 | 568 | P2 | verify_directory_fit_before_any_approval | yandex.com | https://yandex.com/indexnow | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 199 | 572 | P2 | verify_directory_fit_before_any_approval | your-site.com | https://your-site.com/ | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 200 | 573 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/almond-banana-bread | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 201 | 574 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/banana-bread-coffee-cake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 202 | 575 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/candy-cane-muddy-buddies | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 203 | 576 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/cinnamon-toast-crunch-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 204 | 577 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/easy-to-make-snowman-cupcakes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 205 | 578 | P2 | verify_directory_fit_before_any_approval | yourcupofcake.com | https://www.yourcupofcake.com/pineapple-mango-bruschetta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
