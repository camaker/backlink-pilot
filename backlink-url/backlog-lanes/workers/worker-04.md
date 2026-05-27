# worker-04

Generated: 2026-05-27T15:49:49.282Z

- Lane count: 5
- Rows: 43
- Estimated minutes: 178

### auth-manual-review-fail-closed-001

- Type: auth_manual_review_fail_closed
- Priority: P0
- Rows: 1
- Estimated minutes: 7
- Notes: Fail-closed manual surface review only. Do not restore direct-login without explicit verified evidence.
- Validate: (none)
- Merge/Follow-up: (none)

### auth-manual-review-classification-002

- Type: auth_manual_review_classification
- Priority: P1
- Rows: 1
- Estimated minutes: 6
- Notes: Manual surface classification only. Keep targets out of direct-login until route is re-established.
- Validate: (none)
- Merge/Follow-up: (none)

### auth-needs-scout-001

- Type: auth_resolved_needs_scout
- Priority: P1
- Rows: 1
- Estimated minutes: 5
- Notes: Targets were explicitly moved out of auth. Refresh public scout evidence and reclassify before any auth re-entry.
- Validate: (none)
- Merge/Follow-up: (none)

### coverage-review-p2-002

- Type: coverage_manual_review_p2
- Priority: P2
- Rows: 25
- Estimated minutes: 100
- Notes: Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.
- Validate: node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p2-002.csv" --fail-on-blockers
- Merge/Follow-up: node src/cli.js targets promote-coverage-review-batch "backlink-url/coverage-review.csv" "backlink-url/backlog-lanes/lanes/coverage-review-p2-002.csv" --registry "resources/targets.canonical.yaml" --output "backlink-url/backlog-lanes/merge/coverage-review-p2-002-coverage-review.updated.csv" --dry-run

### coverage-review-p2-006

- Type: coverage_manual_review_p2
- Priority: P2
- Rows: 15
- Estimated minutes: 60
- Notes: Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.
- Validate: node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p2-006.csv" --fail-on-blockers
- Merge/Follow-up: node src/cli.js targets promote-coverage-review-batch "backlink-url/coverage-review.csv" "backlink-url/backlog-lanes/lanes/coverage-review-p2-006.csv" --registry "resources/targets.canonical.yaml" --output "backlink-url/backlog-lanes/merge/coverage-review-p2-006-coverage-review.updated.csv" --dry-run
