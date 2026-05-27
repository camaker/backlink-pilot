# worker-01

Generated: 2026-05-27T15:49:49.282Z

- Lane count: 2
- Rows: 42
- Estimated minutes: 185

### coverage-review-p0-001

- Type: coverage_manual_review_p0
- Priority: P0
- Rows: 17
- Estimated minutes: 85
- Notes: Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.
- Validate: node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p0-001.csv" --fail-on-blockers
- Merge/Follow-up: node src/cli.js targets promote-coverage-review-batch "backlink-url/coverage-review.csv" "backlink-url/backlog-lanes/lanes/coverage-review-p0-001.csv" --registry "resources/targets.canonical.yaml" --output "backlink-url/backlog-lanes/merge/coverage-review-p0-001-coverage-review.updated.csv" --dry-run

### coverage-review-p2-005

- Type: coverage_manual_review_p2
- Priority: P2
- Rows: 25
- Estimated minutes: 100
- Notes: Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.
- Validate: node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p2-005.csv" --fail-on-blockers
- Merge/Follow-up: node src/cli.js targets promote-coverage-review-batch "backlink-url/coverage-review.csv" "backlink-url/backlog-lanes/lanes/coverage-review-p2-005.csv" --registry "resources/targets.canonical.yaml" --output "backlink-url/backlog-lanes/merge/coverage-review-p2-005-coverage-review.updated.csv" --dry-run
