# Pricing Review Manual Pack

Generated: 2026-05-23T12:31:15.295Z
Status: manual_pack_ready
Draft: backlink-url/pricing-review/pricing-review-decision-draft.csv
Batch: backlink-url/pricing-review/decision-batches/pricing-potential-free-001.csv

Policy: manual review only. No approvals, no registry writes, no real submissions, no login, and no CAPTCHA/Cloudflare bypass. Suggestions are non-binding.

## Summary

- Rows: 7
- Unreviewed rows: 7
- Strict validation: currently blocked
- Strict validation blockers: 7
- Source identity blockers: 0

### Suggested Review Decisions

| Decision | Count |
|---|---:|
| mark_free | 2 |
| mark_freemium | 5 |

### Suggested Pricing

| Pricing | Count |
|---|---:|
| free | 2 |
| freemium | 5 |

### Payment Signals

| Signal | Count |
|---|---:|
| no | 5 |
| yes | 2 |

## Review Rows

| Order | Target ID | Domain | Suggested Decision | Confidence | Payment | Free | Review URL |
|---|---|---|---|---|---|---|---|
| 1 | changelog | changelog.com | mark_freemium | medium | no | no | https://changelog.com/news/submit |
| 2 | mergeek | mergeek.com | mark_free | high | no | yes | https://mergeek.com/publish_project |
| 3 | sonic-run | sonicrun.com | mark_free | high | no | yes | https://www.sonicrun.com/freelisting.html |
| 4 | top-best-alternatives | topbestalternatives.com | mark_freemium | medium | no | no | https://www.topbestalternatives.com/ |
| 5 | trustiner-com | trustiner.com | mark_freemium | medium | yes | no | https://trustiner.com/ |
| 6 | websitehunt | websitehunt.co | mark_freemium | medium | no | no | https://www.websitehunt.co/ |
| 7 | submitdirs-com | submitdirs.com | mark_freemium | medium | yes | no | https://submitdirs.com/ |

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
node src/cli.js targets validate-pricing-review-decisions backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.csv --fail-on-blockers
node src/cli.js targets merge-pricing-review-decision-batch backlink-url/pricing-review/pricing-review-decision-draft.csv backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.csv --output backlink-url/pricing-review/pricing-review-decision-draft.reviewed.csv --json-output backlink-url/pricing-review/pricing-review-decision-batch-merge-reviewed.json --fail-on-blockers
node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.reviewed.csv --registry resources/targets.canonical.yaml --output backlink-url/pricing-review/pricing-review-decision-apply-preview.json --json
node src/cli.js targets pricing-review-post-apply-gate --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output backlink-url/pricing-review/pricing-review-post-apply-gate.json --json
```

Do not run an apply step with `--write-registry` until validation, merge preview, and apply preview have been reviewed.

## Files

- Editable manual CSV: backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.csv
- Machine-readable JSON: backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.json
- Runbook Markdown: backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.md
