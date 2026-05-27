# worker-02

Generated: 2026-05-27T13:56:14.161Z

- Lane count: 2
- Rows: 35
- Estimated minutes: 160

### auth-login-001

- Type: auth_manual_login
- Priority: P0
- Rows: 10
- Estimated minutes: 60
- Notes: Run manual auth login only. No submission. Refresh auth workflow after login capture.
- Validate: (none)
- Merge/Follow-up: "node" "src/cli.js" "targets" "auth-workflow-refresh" "backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-direct-login-queue.csv" "backlink-url/assisted-submission-pack/resolved-direct-login/auth-login-plan-batch-resolved-001.json" "backlink-url/assisted-submission-pack/resolved-direct-login/auth-login-plan-batch-resolved-002.json" "--registry" "resources/targets.canonical.yaml" "--auth-dir" "playwright/.auth" "--output-dir" "backlink-url/assisted-submission-pack/resolved-direct-login" "--next-name" "auth-login-next-resolved-current" "--summary-name" "auth-workflow-refresh-resolved-summary" "--next-limit" "10" "--rescout-limit" "100"

### coverage-review-p2-003

- Type: coverage_manual_review_p2
- Priority: P2
- Rows: 25
- Estimated minutes: 100
- Notes: Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.
- Validate: node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p2-003.csv" --fail-on-blockers
- Merge/Follow-up: node src/cli.js targets promote-coverage-review-batch "backlink-url/coverage-review.csv" "backlink-url/backlog-lanes/lanes/coverage-review-p2-003.csv" --registry "resources/targets.canonical.yaml" --output "backlink-url/backlog-lanes/merge/coverage-review-p2-003-coverage-review.updated.csv" --dry-run
