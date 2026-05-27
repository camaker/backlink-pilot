# Pricing Review Queue

Generated: 2026-05-27T06:54:35.781Z

Policy: read-only queue for runnable targets whose pricing is still `unknown`. This file does not approve submissions and does not write the registry.

## Summary

- Total candidates: 1
- Selected rows: 1
- Rows with scout evidence: 1
- Rows with forms: 1
- Submitted rows still needing pricing classification: 1

### By Mode

| Mode | Count |
|---|---:|
| auto_safe | 1 |

## Rows

| Order | Priority | Target ID | Domain | Mode | Submit URL |
|---|---|---|---|---|---|
| 1 | P0 | cooltools | backdata.net | auto_safe | https://backdata.net/submit-site.html |

## Next Commands

```powershell
node src/cli.js targets pricing-review-evidence backlink-url/pricing-review/pricing-review-queue.csv --output backlink-url/pricing-review/pricing-review-evidence.csv --json-output backlink-url/pricing-review/pricing-review-evidence.json
node src/cli.js targets pricing-review-suggest backlink-url/pricing-review/pricing-review-queue.csv backlink-url/pricing-review/pricing-review-evidence.csv --output backlink-url/pricing-review/pricing-review-suggestions.csv --json-output backlink-url/pricing-review/pricing-review-suggestions.json
```
