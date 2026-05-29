# Pricing Review Manual Pack

Generated: 2026-05-29T13:24:38.028Z
Status: manual_pack_ready
Draft: backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.csv
Batch: backlink-url/submission-materials/pricing-review-three-sites/decision-batches/three-sites-pricing-001.csv

Policy: manual review only. No approvals, no registry writes, no real submissions, no login, and no CAPTCHA/Cloudflare bypass. Suggestions are non-binding.

## Summary

- Rows: 9
- Unreviewed rows: 9
- Strict validation: currently blocked
- Strict validation blockers: 9
- Source identity blockers: 0

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| keep_unknown | 2 |
| mark_freemium | 3 |
| mark_paid | 4 |

### Suggested Pricing

| Pricing | Count |
|---|---:|
| freemium | 3 |
| paid | 4 |
| unknown | 2 |

### Payment Signals

| Signal | Count |
|---|---:|
| no | 2 |
| yes | 7 |

## Review Rows

| Order | Target ID | Domain | Suggested Decision | Confidence | Payment | Free | Review URL |
|---|---|---|---|---|---|---|---|
| 1 | ai-ailookme | ailookme.com | keep_unknown | low | no | no | https://www.ailookme.com/%e7%bd%91%e5%9d%80%e6%8f%90%e4%ba%a4 |
| 2 | poweruptools-com | poweruptools.com | mark_paid | high | yes | no | https://poweruptools.com/ |
| 3 | saashubdirectory-com | saashubdirectory.com | mark_freemium | medium | yes | no | https://saashubdirectory.com/ |
| 4 | softwarebolt-com | softwarebolt.com | mark_freemium | medium | yes | no | https://softwarebolt.com/ |
| 5 | solvertools-com | solvertools.com | mark_freemium | medium | yes | no | https://solvertools.com/ |
| 6 | theapptools-com | theapptools.com | mark_paid | high | yes | no | https://theapptools.com/ |
| 7 | toolsignal-com | toolsignal.com | mark_paid | high | yes | no | https://toolsignal.com/ |
| 8 | weliketools-com | weliketools.com | mark_paid | high | yes | no | https://weliketools.com/ |
| 9 | alternativeto | alternativeto.net | keep_unknown | low | no | no | https://alternativeto.net/faq |

## Required Human Edits

1. Open `manual_review_url` in a normal browser before changing any decision.
2. Fill only `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and `review_notes`.
3. Do not change `target_id`, `domain`, `submit_url`, evidence fields, suggested fields, or automation policy.
4. Use `mark_free` only when a visible free submission/listing path exists and no hard blocker is present.
5. Use `mark_freemium` when a free/basic path exists but paid/featured upgrades are also offered.
6. Use `mark_paid` when submission is paid-only; registry apply will downgrade that target to `skip`.
7. Use `keep_unknown` or `needs_manual_check` when evidence is ambiguous, blocked, login-gated, CAPTCHA-gated, or Cloudflare-gated.

## Validation Flow

```powershell
node src/cli.js targets validate-pricing-review-decisions backlink-url/submission-materials/pricing-review-three-sites/manual-pack/three-sites-pricing-001.csv --fail-on-blockers
node src/cli.js targets merge-pricing-review-decision-batch backlink-url/submission-materials/pricing-review-three-sites/pricing-review-decision-draft.csv backlink-url/submission-materials/pricing-review-three-sites/manual-pack/three-sites-pricing-001.csv --output backlink-url/pricing-review/pricing-review-decision-draft.reviewed.csv --json-output backlink-url/pricing-review/pricing-review-decision-batch-merge-reviewed.json --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.reviewed.csv --registry resources/targets.canonical.yaml --output backlink-url/pricing-review/pricing-review-decision-apply-preview.json --json
node src/cli.js targets pricing-review-post-apply-gate --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output backlink-url/pricing-review/pricing-review-post-apply-gate.json --json
```

Do not run an apply step with `--write-registry` until validation, merge preview, and apply preview have been reviewed.

## Files

- Editable manual CSV: backlink-url/submission-materials/pricing-review-three-sites/manual-pack/three-sites-pricing-001.csv
- Machine-readable JSON: backlink-url/submission-materials/pricing-review-three-sites/manual-pack/three-sites-pricing-001.json
- Runbook Markdown: backlink-url/submission-materials/pricing-review-three-sites/manual-pack/three-sites-pricing-001.md
