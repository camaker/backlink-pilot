# worker-02

Generated: 2026-05-27T07:01:29.207Z

- Lane count: 4
- Rows: 60
- Estimated minutes: 280

### auth-login-001

- Type: auth_manual_login
- Priority: P0
- Rows: 10
- Estimated minutes: 60
- Notes: Run manual auth login only. No submission. Refresh auth workflow after login capture.
- Validate: (none)
- Merge/Follow-up: node src/cli.js targets auth-workflow-refresh "backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv" "backlink-url/assisted-submission-pack/auth-login-plan-batch-001.json" "backlink-url/assisted-submission-pack/auth-login-plan-batch-002.json" "backlink-url/assisted-submission-pack/auth-login-plan-batch-003.json" --registry "resources/targets.canonical.yaml" --product-config "backlink-url/submission-materials/xtimer.config.yaml" --output-dir "backlink-url/assisted-submission-pack" --next-name auth-login-next-current --summary-name auth-workflow-refresh-summary --next-limit 10

### auth-login-004

- Type: auth_manual_login
- Priority: P0
- Rows: 10
- Estimated minutes: 60
- Notes: Run manual auth login only. No submission. Refresh auth workflow after login capture.
- Validate: (none)
- Merge/Follow-up: node src/cli.js targets auth-workflow-refresh "backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv" "backlink-url/assisted-submission-pack/auth-login-plan-batch-001.json" "backlink-url/assisted-submission-pack/auth-login-plan-batch-002.json" "backlink-url/assisted-submission-pack/auth-login-plan-batch-003.json" --registry "resources/targets.canonical.yaml" --product-config "backlink-url/submission-materials/xtimer.config.yaml" --output-dir "backlink-url/assisted-submission-pack" --next-name auth-login-next-current --summary-name auth-workflow-refresh-summary --next-limit 10

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
