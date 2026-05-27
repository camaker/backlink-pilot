# Pricing Review Decision Draft

Generated: 2026-05-27T10:33:48.106Z

Policy: editable human decision draft only. It does not write the registry, does not approve submissions, and intentionally leaves `review_decision` blank.

## Summary

- Rows: 44
- Rows requiring human review: 44

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 12 |
| mark_freemium | 8 |
| mark_paid | 22 |
| needs_manual_check | 2 |

### Suggested Pricing

| Pricing | Count |
|---|---:|
| freemium | 8 |
| paid | 22 |
| unknown | 14 |

## Rows

| Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |
|---|---|---|---|---|---|
| 1 | 247webdirectory | 247webdirectory.com | keep_unknown | unknown | (blank) |
| 2 | asr | activesearchresults.com | keep_unknown | unknown | (blank) |
| 3 | ai-ailookme | ailookme.com | keep_unknown | unknown | (blank) |
| 4 | ai-nav | ainavpro.com | keep_unknown | unknown | (blank) |
| 5 | appalist-com | appalist.com | mark_paid | paid | (blank) |
| 6 | ashlist-com | ashlist.com | mark_freemium | freemium | (blank) |
| 7 | foundr-ai | foundr.ai | needs_manual_check | unknown | (blank) |
| 8 | hhlink-com | hhlink.com | keep_unknown | unknown | (blank) |
| 9 | iforai | iforai.com | keep_unknown | unknown | (blank) |
| 10 | launchscroll-com | launchscroll.com | mark_paid | paid | (blank) |
| 11 | mylaunchstash-com | mylaunchstash.com | mark_paid | paid | (blank) |
| 12 | offpagesavvy | offpagesavvy.com | mark_freemium | freemium | (blank) |
| 13 | poweruptools-com | poweruptools.com | mark_paid | paid | (blank) |
| 14 | productlistdir-com | productlistdir.com | mark_paid | paid | (blank) |
| 15 | productwing-com | productwing.com | mark_paid | paid | (blank) |
| 16 | saasfield-com | saasfield.com | mark_paid | paid | (blank) |
| 17 | saashubdirectory-com | saashubdirectory.com | mark_paid | paid | (blank) |
| 18 | saasroots-com | saasroots.com | mark_paid | paid | (blank) |
| 19 | smartkithub-com | smartkithub.com | mark_paid | paid | (blank) |
| 20 | softwarebolt-com | softwarebolt.com | mark_paid | paid | (blank) |
| 21 | solvertools-com | solvertools.com | mark_freemium | freemium | (blank) |
| 22 | sourcedir-com | sourcedir.com | mark_paid | paid | (blank) |
| 23 | stackdirectory-com | stackdirectory.com | mark_paid | paid | (blank) |
| 24 | startupvessel-com | startupvessel.com | mark_paid | paid | (blank) |
| 25 | theapptools-com | theapptools.com | mark_paid | paid | (blank) |
| 26 | thecoretools-com | thecoretools.com | mark_freemium | freemium | (blank) |
| 27 | tinytoolhub-com | tinytoolhub.com | mark_freemium | freemium | (blank) |
| 28 | toolcosmos-com | toolcosmos.com | mark_freemium | freemium | (blank) |
| 29 | toolfinddir-com | toolfinddir.com | mark_paid | paid | (blank) |
| 30 | toolsignal-com | toolsignal.com | mark_paid | paid | (blank) |
| 31 | toolslisthq-com | toolslisthq.com | mark_paid | paid | (blank) |
| 32 | toolsunderradar-com | toolsunderradar.com | mark_paid | paid | (blank) |
| 33 | toptrendtools-com | toptrendtools.com | mark_paid | paid | (blank) |
| 34 | toshilist-com | toshilist.com | mark_paid | paid | (blank) |
| 35 | trustiner-com | trustiner.com | mark_freemium | freemium | (blank) |
| 36 | weliketools-com | weliketools.com | mark_paid | paid | (blank) |
| 37 | xinquji-com | xinquji.com | needs_manual_check | unknown | (blank) |
| 38 | aitoptools | aitoptools.com | keep_unknown | unknown | (blank) |
| 39 | broadwise-org | broadwise.org | mark_freemium | freemium | (blank) |
| 40 | dizkaz-com | dizkaz.com | keep_unknown | unknown | (blank) |
| 41 | gainweb-org | gainweb.org | keep_unknown | unknown | (blank) |
| 42 | openfuture-ai | openfuture.ai | keep_unknown | unknown | (blank) |
| 43 | www-ruanyifeng-com | ruanyifeng.com | keep_unknown | unknown | (blank) |
| 44 | wechalet-cn | wechalet.cn | keep_unknown | unknown | (blank) |

## Human Fill Requirements

1. Open each target manually before editing `review_decision`.
2. Fill `review_decision`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Use `mark_paid` only when no free submission path exists; it will downgrade the target to `skip` if written.
4. `mark_free` can make an already `auto_safe` target eligible for future free-only planning after audit; use it only with clear evidence.
5. `mark_freemium` records a free-plus-paid path but does not count as `free` in the current free-only planner.

## Validation

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/auth-triage-pricing/pricing-review-decision-draft.csv --json
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.csv --registry resources/targets.canonical.yaml --json
```

## Files

- Draft CSV: backlink-url/auth-triage-pricing/pricing-review-decision-draft.csv
- Draft JSON: backlink-url/auth-triage-pricing/pricing-review-decision-draft.json
