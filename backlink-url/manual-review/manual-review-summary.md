# Manual Review Pack

Generated: 2026-05-22T09:19:31.825Z

## Scope

- Current queue rows: 429
- P0 rows: 28
- P2 rows: 401
- Rows with evidence or suggestion history: 429
- Rows without evidence or suggestion history: 0
- Rows blocked by safety gate in prior drafts: 223
- Possible approvals after manual confirmation: 5

Policy: manual review only. No approvals, no registry imports, no real submissions, no login or CAPTCHA/Cloudflare bypass.

## By Priority

| Priority | Count |
|---|---:|
| P2 | 401 |
| P0 | 28 |

## By Review Action

| Action | Count |
|---|---:|
| verify_directory_fit_before_any_approval | 401 |
| verify_submit_form_then_approve_or_reject | 23 |
| verify_distinct_submit_url_for_existing_domain | 5 |

## By Manual Bucket

| Bucket | Count |
|---|---:|
| safety_gate_blocked_auto_rejection | 223 |
| fetch_failed_cannot_decide | 104 |
| medium_confidence_requires_human_confirmation | 92 |
| manual_browser_check_required | 5 |
| manual_submit_form_confirmation_required | 5 |

## By Suggested Decision

| Suggested Decision | Count |
|---|---:|
| reject_auth_required | 310 |
| needs_manual_check | 114 |
| reject_not_submit | 5 |

## P0 Manual Queue

| Rank | Review Row | Domain | Manual Bucket | Suggested Decision | Confidence | URL |
|---:|---:|---|---|---|---|---|
| 1 | 75 | aiscout.net | fetch_failed_cannot_decide | needs_manual_check | low | https://aiscout.net/submit |
| 2 | 79 | aitoolsdirectory.com | fetch_failed_cannot_decide | needs_manual_check | low | https://aitoolsdirectory.com/submit |
| 3 | 208 | devhunt.org | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://devhunt.org/submit |
| 4 | 472 | sideprojectors.com | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://www.sideprojectors.com/project/new |
| 5 | 497 | stackshare.io | fetch_failed_cannot_decide | needs_manual_check | low | https://stackshare.io/new-product |
| 6 | 63 | ai.xyz | fetch_failed_cannot_decide | needs_manual_check | low | https://ai.xyz/submit |
| 7 | 64 | aiagents.live | fetch_failed_cannot_decide | needs_manual_check | low | https://aiagents.live/submit |
| 8 | 65 | aiagentsbase.com | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://aiagentsbase.com/submit |
| 9 | 68 | aiagentsmarketplace.com | manual_submit_form_confirmation_required | needs_manual_check | low | https://aiagentsmarketplace.com/submit |
| 10 | 72 | aimatchpro.ai | fetch_failed_cannot_decide | needs_manual_check | low | https://aimatchpro.ai/submit |
| 11 | 78 | aitools.love | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://aitools.love/submit |
| 12 | 81 | aitrendytools.com | fetch_failed_cannot_decide | needs_manual_check | low | https://www.aitrendytools.com/submit |
| 13 | 115 | bestofweb.io | fetch_failed_cannot_decide | needs_manual_check | low | https://bestofweb.io/submit |
| 14 | 274 | getbyte.co | manual_submit_form_confirmation_required | needs_manual_check | low | https://getbyte.co/submit |
| 15 | 332 | launchvault.com | fetch_failed_cannot_decide | needs_manual_check | low | https://launchvault.com/submit |
| 16 | 392 | nocodedevs.com | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://www.nocodedevs.com/submit |
| 17 | 395 | nocodelist.co | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://nocodelist.co/submit |
| 18 | 550 | wearenocode.com | fetch_failed_cannot_decide | needs_manual_check | low | https://www.wearenocode.com/submit |
| 19 | 55 | a.example | fetch_failed_cannot_decide | needs_manual_check | low | https://a.example/submit |
| 20 | 90 | any-directory.com | fetch_failed_cannot_decide | needs_manual_check | low | https://any-directory.com/submit |
| 21 | 92 | any-site.com | medium_confidence_requires_human_confirmation | reject_auth_required | medium | https://any-site.com/submit |
| 22 | 104 | b.example | fetch_failed_cannot_decide | needs_manual_check | low | https://b.example/submit |
| 23 | 171 | c.example | fetch_failed_cannot_decide | needs_manual_check | low | https://c.example/submit |
| 24 | 204 | custom.example | fetch_failed_cannot_decide | needs_manual_check | low | https://custom.example/submit |
| 25 | 206 | d.example | fetch_failed_cannot_decide | needs_manual_check | low | https://d.example/submit |
| 26 | 221 | e.example | fetch_failed_cannot_decide | needs_manual_check | low | https://e.example/submit |
| 27 | 385 | new-site.com | manual_submit_form_confirmation_required | needs_manual_check | low | https://new-site.com/submit |
| 28 | 489 | some-directory.com | fetch_failed_cannot_decide | needs_manual_check | low | https://some-directory.com/submit |

## Files

- Full remaining queue: remaining-manual-review.csv
- P0-only queue: p0-manual-review.csv
- Next queue slice: next-100-manual-review.csv
- Machine-readable summary: manual-review-summary.json
- Readiness blockers: product-readiness-blockers.md

## Human Review Rules

1. Do not approve based on HTTP fetch alone. Approval requires a visible valid submit form, directory fit, no mandatory login/payment/CAPTCHA, and a clear submit URL.
2. Do not reject on fetch failure alone. Retry in a normal browser first.
3. Treat auth/OAuth/2FA/CAPTCHA/Cloudflare as assisted/manual, never auto.
4. Treat paid/sponsored-only listing paths as reject_paid unless a free path is visible.
5. Any approved row must remain non-executable needs_scout until scout evidence maps the form fields and submit button.
