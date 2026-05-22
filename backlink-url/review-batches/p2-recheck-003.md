# Coverage Review Batch: p2-recheck-003

Generated: 2026-05-22T10:59:37.556Z
Queue: backlink-url/coverage-review-queue.csv
Priority filter: P2
Action filter: (all)
Offset: 94
Limit: 100
Matching rows: 287
Batch rows: 100
Remaining after batch: 93
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
| 95 | 147 | P2 | verify_directory_fit_before_any_approval | blogs.city.ac.uk | https://blogs.city.ac.uk/sustainable-city/sortingchallenge/sorting-challenge-2014-15 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 96 | 148 | P2 | verify_directory_fit_before_any_approval | blogs.deusto.es | https://blogs.deusto.es/innovandis/exprime-las-naranjas | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 97 | 149 | P2 | verify_directory_fit_before_any_approval | blogs.deusto.es | https://blogs.deusto.es/innovandis/llegando-al-nivel-pro-con-lxs-20g-en-innovandis | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 98 | 150 | P2 | verify_directory_fit_before_any_approval | blogs.eltiempo.com | https://blogs.eltiempo.com/el-tiempo-del-cine/2025/02/10/oscar-2025-analisis-de-cada-categoria-parte-i | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 99 | 151 | P2 | verify_directory_fit_before_any_approval | blogs.evergreen.edu | http://blogs.evergreen.edu/morisa24/box-2-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 100 | 152 | P2 | verify_directory_fit_before_any_approval | blogs.evergreen.edu | http://blogs.evergreen.edu/morisa24/box-4 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 101 | 153 | P2 | verify_directory_fit_before_any_approval | blogs.memphis.edu | https://blogs.memphis.edu/padm3601/2015/02/11/death-penalty | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 102 | 154 | P2 | verify_directory_fit_before_any_approval | blogs.ubc.ca | https://blogs.ubc.ca/etec540socialmedia2013/sample-page/introduction-to-google | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 103 | 155 | P2 | verify_directory_fit_before_any_approval | blogs.ucl.ac.uk | https://blogs.ucl.ac.uk/brits/2014/06/01/sales-growth-curves | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 104 | 156 | P2 | verify_directory_fit_before_any_approval | blogs.urz.uni-halle.de | https://blogs.urz.uni-halle.de/startklar/quellen-und-verweise/comment-page-3 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 105 | 157 | P2 | verify_directory_fit_before_any_approval | blogs.uww.edu | https://blogs.uww.edu/artofmakai/2021/03/23/hyper-light-drifter-the-game-that-taught-me-how-to-play-video-games | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 106 | 158 | P2 | verify_directory_fit_before_any_approval | blogs.uww.edu | https://blogs.uww.edu/artofmakai/2021/04/13/how-to-draw-the-importance-of-schedules | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 107 | 159 | P2 | verify_directory_fit_before_any_approval | blogs.zeiss.com | https://blogs.zeiss.com/news/messtechnik-de/sorgsamkeit-bringt-sie-weiter | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 108 | 160 | P2 | verify_directory_fit_before_any_approval | bordeaux.onvasortir.com | https://bordeaux.onvasortir.com/profil_msg_inexistant.php | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 109 | 161 | P2 | verify_directory_fit_before_any_approval | brownbagteacher.com | https://brownbagteacher.com/what-im-reading | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 110 | 163 | P2 | verify_directory_fit_before_any_approval | browneyedbaker.com | https://www.browneyedbaker.com/how-to-make-pate-a-choux-fill-eclairs-and-cream-puffs | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 111 | 164 | P2 | verify_directory_fit_before_any_approval | bugs.documentfoundation.org | https://bugs.documentfoundation.org/show_bug.cgi?id=162681 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 112 | 174 | P2 | verify_directory_fit_before_any_approval | calaos.fr | https://calaos.fr/forum/member.php?action=profile&uid=7732 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 113 | 175 | P2 | verify_directory_fit_before_any_approval | cantstayoutofthekitchen.com | https://cantstayoutofthekitchen.com/2022/01/06/blueberry-walnut-overnight-oatmeal | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 114 | 177 | P2 | verify_directory_fit_before_any_approval | capturebilling.com | https://capturebilling.com/new-quality-aca-reporting-standards | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 115 | 178 | P2 | verify_directory_fit_before_any_approval | career.tu-sofia.bg | https://career.tu-sofia.bg/employer/geometry-dash-subzero | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 116 | 179 | P2 | verify_directory_fit_before_any_approval | cartoonresearch.com | https://cartoonresearch.com/index.php/forgotten-anime-57-kirara-2000 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 117 | 180 | P2 | verify_directory_fit_before_any_approval | certifiedpastryaficionado.com | https://www.certifiedpastryaficionado.com/churro-waffles | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 118 | 181 | P2 | verify_directory_fit_before_any_approval | certifiedpastryaficionado.com | https://www.certifiedpastryaficionado.com/nutella-cream-pie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 119 | 183 | P2 | verify_directory_fit_before_any_approval | chandigarhcity.com | https://www.chandigarhcity.com/discussions/threads/quordle-to-quorle | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 120 | 184 | P2 | verify_directory_fit_before_any_approval | chayagrossberg.com | https://chayagrossberg.com/diagnosis-versus-you | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 121 | 185 | P2 | verify_directory_fit_before_any_approval | chayagrossberg.com | https://chayagrossberg.com/how-do-you-know-if-youre-receiving-informed-consent | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 122 | 186 | P2 | verify_directory_fit_before_any_approval | chhs.news.niu.edu | https://chhs.news.niu.edu/2025/01/15/niu-school-of-nursing-adds-hispanic-student-nurses-alianza-hsna-to-support-students | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 123 | 187 | P2 | verify_directory_fit_before_any_approval | cinescopia.com | https://cinescopia.com/las-10-mejores-peliculas-de-casey-affleck/2024/08 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 124 | 189 | P2 | verify_directory_fit_before_any_approval | claude.ai | https://claude.ai/code | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 125 | 190 | P2 | verify_directory_fit_before_any_approval | claude.ai | https://claude.ai/code)%EF%BC%8C%E4%BD%A0%E4%B8%8D%E9%9C%80%E8%A6%81%E7%9C%8B%E4%BB%BB%E4%BD%95%E5%85%B6%E4%BB%96%E6%96%87%E6%A1%A3%E3%80%82Clone | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 126 | 194 | P2 | verify_directory_fit_before_any_approval | community.ops.io | https://community.ops.io/albacube_d9724d5112893f8a | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 127 | 195 | P2 | verify_directory_fit_before_any_approval | completelydelicious.com | https://www.completelydelicious.com/tips/make-brownies-shiny-crackly-crust | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 128 | 196 | P2 | verify_directory_fit_before_any_approval | cornbeanspigskids.com | https://www.cornbeanspigskids.com/2024/08/back-to-school-my-kids-favorite.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 129 | 197 | P2 | verify_directory_fit_before_any_approval | craftberrybush.com | https://www.craftberrybush.com/2017/08/watercolor-lessons-and-free-printable.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 130 | 198 | P2 | verify_directory_fit_before_any_approval | craftberrybush.com | https://www.craftberrybush.com/2025/01/heart-shaped-flower-arrangement-for-valentines-day.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 131 | 207 | P2 | verify_directory_fit_before_any_approval | demilked.com | https://www.demilked.com/just-a-girl | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 132 | 209 | P2 | verify_directory_fit_before_any_approval | digitalwellbeing.org | https://digitalwellbeing.org/five-reasons-why-chatgpt-is-the-future-of-digital-mental-health-support | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 133 | 211 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2017/12/05/nigels-fruitcake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 134 | 212 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2019/12/23/kaiserschmarrn-torn-shredded-pancake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 135 | 213 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/2021/11/03/plant-based-deep-n-delicious-chocolate-cake | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 136 | 214 | P2 | verify_directory_fit_before_any_approval | dinnerwithjulie.com | https://www.dinnerwithjulie.com/recipes/butterscotch-pecan-mmmuffins | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 137 | 218 | P2 | verify_directory_fit_before_any_approval | diythrill.com | https://diythrill.com/2018/09/23/orange-citrus-poo-pourri-recipe | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 138 | 222 | P2 | verify_directory_fit_before_any_approval | earthpeopletechnology.com | https://earthpeopletechnology.com/forums/profile/contractwarn | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 139 | 225 | P2 | verify_directory_fit_before_any_approval | eilentein.com | http://www.eilentein.com/2019/02/ryijy-ja-kuinka-sen-tein.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 140 | 232 | P2 | verify_directory_fit_before_any_approval | everythingboardgames.com | https://everythingboardgames.com/2024/11/exploring-the-world-of-online-board-games.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 141 | 233 | P2 | verify_directory_fit_before_any_approval | everythingetsy.com | https://www.everythingetsy.com/2013/02/10-social-media-tips-to-make-you-a-rock-star | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 142 | 237 | P2 | verify_directory_fit_before_any_approval | exsloth.com | https://exsloth.com/vegan-breakfast-cookies | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 143 | 241 | P2 | verify_directory_fit_before_any_approval | fallfordiy.com | https://fallfordiy.com/blog/2015/11/18/diy-paint-dipped-advent-calendar-bottles | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 144 | 242 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/10/20/roasted-butternut-squash-and-apple-soup | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 145 | 243 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/11/10/2014119turkey-roulade | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 146 | 244 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/12/01/2014121make-ahead-monday-shepherds-pie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 147 | 245 | P2 | verify_directory_fit_before_any_approval | fashionablefoods.com | https://fashionablefoods.com/2014/12/28/creamy-ham-and-pea-pasta | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 148 | 249 | P2 | verify_directory_fit_before_any_approval | feettothefire.blogs.wesleyan.edu | https://feettothefire.blogs.wesleyan.edu/2009/02/26/main-street-marketplace/comment-page-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 149 | 253 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/7-easy-everyday-gluten-free-swaps | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 150 | 254 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/a-festive-holiday-sangria-recipe-tips-for-a-healthier-cocktail | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 151 | 255 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/how-to-make-homemade-oat-milk | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 152 | 256 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/how-to-make-juice-without-a-juicer-3-green-juice-recipes | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 153 | 257 | P2 | verify_directory_fit_before_any_approval | fitlivingeats.com | https://www.fitlivingeats.com/qa-founders-motion-matcha-one-go-energy-boosters | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 154 | 259 | P2 | verify_directory_fit_before_any_approval | fivereasonssports.com | https://www.fivereasonssports.com/news/ultimate-miami-heat-fan-travel-guide-tickets-hotels-and-local-hotspots | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 155 | 262 | P2 | verify_directory_fit_before_any_approval | flokii.com | https://flokii.com/users/view/58762 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 156 | 264 | P2 | verify_directory_fit_before_any_approval | forum.epicbrowser.com | https://forum.epicbrowser.com/profile.php?id=78821 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 157 | 265 | P2 | verify_directory_fit_before_any_approval | forum.gekko.wizb.it | https://forum.gekko.wizb.it/user-14910.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 158 | 266 | P2 | verify_directory_fit_before_any_approval | forum.padowan.dk | https://forum.padowan.dk/profile.php?id=33438 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 159 | 268 | P2 | verify_directory_fit_before_any_approval | forums.maxperformanceinc.com | https://forums.maxperformanceinc.com/forums/member.php?u=202517 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 160 | 270 | P2 | verify_directory_fit_before_any_approval | freesound.org | https://freesound.org/people/florianreichelt/sounds/440601 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 161 | 276 | P2 | verify_directory_fit_before_any_approval | ginjfo.com | https://www.ginjfo.com/actualites/logiciels/jeux-video-logiciels/les-sims-4-fetent-leur-25e-anniversaire-avec-du-nouveau-contenu-massif-20250227 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 162 | 287 | P2 | verify_directory_fit_before_any_approval | gizlogic.com | https://www.gizlogic.com/android-auto-8-4-lanzamiento | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 163 | 289 | P2 | verify_directory_fit_before_any_approval | global21.oceansconference.org | https://global21.oceansconference.org/2019/04/01/join-5000-ocean-technology-experts-at-ocean-business | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 164 | 290 | P2 | verify_directory_fit_before_any_approval | godchild.keenspot.com | http://godchild.keenspot.com/comic/chapter-3-page-05 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 165 | 291 | P2 | verify_directory_fit_before_any_approval | godchild.keenspot.com | http://godchild.keenspot.com/comic/evolution-of-maggie | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 166 | 296 | P2 | verify_directory_fit_before_any_approval | greenerideal.com | https://greenerideal.com/wellness/disconnect-to-reconnect-connecting-with-nature-in-the-digital-age | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 167 | 299 | P2 | verify_directory_fit_before_any_approval | happyhealthymama.com | https://happyhealthymama.com/air-fryer-apples-healthy.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 168 | 300 | P2 | verify_directory_fit_before_any_approval | happyhourprojects.com | https://happyhourprojects.com/snake-bracelet | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 169 | 302 | P2 | verify_directory_fit_before_any_approval | help.lametric.com | https://help.lametric.com/support/discussions/topics/6000067542 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 170 | 315 | P2 | verify_directory_fit_before_any_approval | iotwreport.com | https://iotwreport.com/letitia-james-indicted-for-banking-fraud | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 171 | 317 | P2 | verify_directory_fit_before_any_approval | itsfilmedthere.com | https://www.itsfilmedthere.com/2019/01/whats-happening.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 172 | 318 | P2 | verify_directory_fit_before_any_approval | jilliancyork.com | https://jilliancyork.com/2010/02/20/on-memorability | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 173 | 320 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/94f737822923f4567e1a7ce9681e5b9a-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 174 | 321 | P2 | verify_directory_fit_before_any_approval | joaniesimon.com | https://joaniesimon.com/grilled-lemon-garlic-potato-kabobs/grilled-potato-kabobs-with-lemon-and-garlic | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 175 | 322 | P2 | verify_directory_fit_before_any_approval | jobs.hyperisland.com | https://jobs.hyperisland.com/company/georgiana-al-usa | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 176 | 323 | P2 | verify_directory_fit_before_any_approval | jonnegroni.com | https://jonnegroni.com/2017/11/20/cinemaholics-review-justice-league-punisher | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 177 | 327 | P2 | verify_directory_fit_before_any_approval | kcn.ne.jp | http://www.kcn.ne.jp/~gorosan/cgi-bin/diarypro/diary.cgi?mode=comment&no=97 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 178 | 328 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=224 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 179 | 329 | P2 | verify_directory_fit_before_any_approval | kt.rim.or.jp | http://www.kt.rim.or.jp/~youie/cgi-bin/nanmeri/nanmeri.cgi?mode=comment&no=239 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 180 | 330 | P2 | verify_directory_fit_before_any_approval | labsk.net | https://labsk.net/index.php?action=profile%3Bu%3D50620 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 181 | 334 | P2 | verify_directory_fit_before_any_approval | learnalanguage.com | https://www.learnalanguage.com/blog/italian-greetings-how-are-you-in-italian | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 182 | 335 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/best-time-to-visit-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 183 | 336 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/chemka-hot-springs-moshi-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 184 | 337 | P2 | verify_directory_fit_before_any_approval | lilistravelplans.com | https://www.lilistravelplans.com/materuni-waterfall-moshi-tanzania | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 185 | 342 | P2 | verify_directory_fit_before_any_approval | loveandmarriageblog.com | https://loveandmarriageblog.com/beach-water-cocktail | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 186 | 343 | P2 | verify_directory_fit_before_any_approval | lovestrategies.com | https://lovestrategies.com/are-you-a-walking-red-flag-7-habits-that-might-be-sabotaging-your-love-life | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 187 | 344 | P2 | verify_directory_fit_before_any_approval | lovestrategies.com | https://lovestrategies.com/types-of-guys-who-stay-single | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 188 | 345 | P2 | verify_directory_fit_before_any_approval | madrimasd.org | https://www.madrimasd.org/blogs/astrofisica/2022/05/20/134942 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 189 | 346 | P2 | verify_directory_fit_before_any_approval | madrimasd.org | https://www.madrimasd.org/blogs/matematicas/2024/02/11/150483 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 190 | 347 | P2 | verify_directory_fit_before_any_approval | mae.gov.bi | https://www.mae.gov.bi/en/an-audience-with-the-iom-head-of-the-mission-in-burundi | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 191 | 348 | P2 | verify_directory_fit_before_any_approval | mae.gov.bi | https://www.mae.gov.bi/en/vacancy-announcement | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 192 | 353 | P2 | verify_directory_fit_before_any_approval | makeupsavvy.co.uk | https://www.makeupsavvy.co.uk/2019/12/best-budget-concealers-for-pale-skin-2019.html | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 193 | 354 | P2 | verify_directory_fit_before_any_approval | mangoandsalt.com | https://www.mangoandsalt.com/2023/05/04/galgos-podencos-tout-savoir-adoption-levriers-despagne | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
| 194 | 355 | P2 | verify_directory_fit_before_any_approval | mangoandsalt.com | https://www.mangoandsalt.com/2024/07/11/collection-de-chaussures-barefoot-avis-conseils-2 | approved \| reject_not_directory \| reject_not_submit \| reject_paid \| reject_auth_required |
