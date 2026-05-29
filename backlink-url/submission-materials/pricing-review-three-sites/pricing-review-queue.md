# Pricing Review Queue

Generated: 2026-05-29T13:22:41.461Z

Policy: read-only queue for runnable targets whose pricing is still `unknown`. This file does not approve submissions and does not write the registry.

## Summary

- Total candidates: 9
- Selected rows: 9
- Rows with scout evidence: 8
- Rows with forms: 8
- Submitted rows still needing pricing classification: 0

### By Mode

| Mode | Count |
|---|---:|
| assisted | 9 |

## Rows

| Order | Priority | Target ID | Domain | Mode | Submit URL |
|---|---|---|---|---|---|
| 1 | P1 | ai-ailookme | ailookme.com | assisted | https://www.ailookme.com/%e7%bd%91%e5%9d%80%e6%8f%90%e4%ba%a4 |
| 2 | P1 | poweruptools-com | poweruptools.com | assisted | https://poweruptools.com/ |
| 3 | P1 | saashubdirectory-com | saashubdirectory.com | assisted | https://saashubdirectory.com/ |
| 4 | P1 | softwarebolt-com | softwarebolt.com | assisted | https://softwarebolt.com/ |
| 5 | P1 | solvertools-com | solvertools.com | assisted | https://solvertools.com/ |
| 6 | P1 | theapptools-com | theapptools.com | assisted | https://theapptools.com/ |
| 7 | P1 | toolsignal-com | toolsignal.com | assisted | https://toolsignal.com/ |
| 8 | P1 | weliketools-com | weliketools.com | assisted | https://weliketools.com/ |
| 9 | P1 | alternativeto | alternativeto.net | assisted | https://alternativeto.net/faq |

## Next Commands

```powershell
node src/cli.js targets pricing-review-evidence backlink-url/submission-materials/pricing-review-three-sites/pricing-review-queue.csv --output backlink-url/pricing-review/pricing-review-evidence.csv --json-output backlink-url/pricing-review/pricing-review-evidence.json
node src/cli.js targets pricing-review-suggest backlink-url/submission-materials/pricing-review-three-sites/pricing-review-queue.csv backlink-url/pricing-review/pricing-review-evidence.csv --output backlink-url/pricing-review/pricing-review-suggestions.csv --json-output backlink-url/pricing-review/pricing-review-suggestions.json
```
