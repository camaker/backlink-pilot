# Backlink URL Coverage Review Workflow

本文档记录 `backlink-url/` 外链数据进入规范化目标库之前的安全审核流程。目标是把候选 URL 逐步转成可 scout 的 `needs_scout` 目标，而不是把原始外链列表直接变成自动提交目标。

## Current State

当前 `backlink-url/` 数据已经纳入覆盖审计：

- Registry targets: `481`
- Files scanned: `9`
- URL occurrences: `1962`
- Unique URLs: `1059`
- Exact in registry: `481`
- Domain in registry only: `53`
- Missing domain: `525`

重要结论：

- `backlink-url/` 里的 URL 已经被扫描和对比。
- 不是所有 URL 都应该导入；其中包含 source pages、文章页、主页、登录页、社区页面、付费页面和重复 submit URL。
- 覆盖导入路径只允许导入人工审核通过的候选，并且强制导入为非执行的 `needs_scout`。
- 覆盖导入不会生成 `auto_safe`，也不会触发真实提交。

## Files

- `backlink-url/coverage-report.json`: 覆盖审计 JSON 报告。
- `backlink-url/coverage-candidates.csv`: 候选 URL 明细。
- `backlink-url/coverage-review.csv`: 主人工审核表。
- `backlink-url/coverage-review-queue.csv`: 已排序的审核队列。
- `backlink-url/review-batches/p0-001.csv`: 首个 P0 审核批次。
- `backlink-url/review-batches/p0-001.md`: 首个 P0 批次说明。
- `backlink-url/review-batches/p0-001-evidence.csv`: 首个 P0 批次的只读 HTTP/HTML evidence。
- `backlink-url/review-batches/p0-001-suggestions.csv`: 基于 evidence 的非绑定审核建议。

## Safety Rules

任何候选进入 registry 之前必须满足以下规则：

- 不直接从原始 URL 列表导入。
- 不导入 source/index/article/list 页面。
- 不导入 paid-only 候选。
- 不导入 login-only、OAuth-only、CAPTCHA-only 或 Cloudflare 阻断页面。
- 同域变体必须使用 `approved_domain_variant`，不能用普通 `approved`。
- 改域必须使用 `approved_domain_change` 且填写 `submission_url_override`。
- 批次中的 `review_decision` 只能使用该行 `review_decision_options` 允许的值。
- Approved 行必须填写 `reviewed_by` 和 `review_notes`。
- 导入后的目标必须保持 `needs_scout`，不能直接执行。

## Review Batch Workflow

生成审核队列：

```bash
node src/cli.js targets coverage-review-queue backlink-url/coverage-review.csv \
  --output backlink-url/coverage-review-queue.csv \
  --limit 20
```

生成 25 行 P0 批次：

```bash
node src/cli.js targets coverage-review-batch backlink-url/coverage-review-queue.csv \
  --priority P0 \
  --limit 25 \
  --offset 0 \
  --batch-id p0-001 \
  --output backlink-url/review-batches/p0-001.csv \
  --markdown backlink-url/review-batches/p0-001.md \
  --preview 25
```

当前 `p0-001` 状态：

- Matching rows: `105`
- Batch rows: `25`
- Remaining after batch: `80`
- Action: `verify_distinct_submit_url_for_existing_domain`

这 25 行都是同域候选，必须判断是否真的是不同于 registry 已有 URL 的 submit endpoint。GitHub、主页、marketplace 页面、非提交页不得批准为自动候选。

## Editing Rules

只编辑以下列：

- `review_decision`
- `review_notes`
- `reviewed_by`
- `submission_url_override`
- `canonical_name`
- `pricing`
- `lang`

推荐 decision：

- `approved`: 仅用于 verified public submit form，且无付费、登录、CAPTCHA、source-page 阻断。
- `approved_domain_variant`: 同域候选确实是不同的有效 submit endpoint，且不是 registry 已有 submit URL 的重复。
- `reject_not_submit`: 页面不是提交入口。
- `reject_duplicate`: 已被 registry 中现有 submit URL 覆盖。
- `reject_paid`: 付费或 paid-only。
- `reject_auth_required`: 登录/OAuth 后才可提交。
- `reject_not_directory`: 不是相关目录/列表收录面。

## Promotion Gate

可选但推荐：先收集只读 HTTP/HTML evidence，辅助人工判断，不填写、不点击、不提交任何表单：

```bash
node src/cli.js targets coverage-review-evidence backlink-url/review-batches/p0-001.csv \
  --limit 25 \
  --timeout-ms 10000 \
  --output backlink-url/review-batches/p0-001-evidence.csv \
  --json-output backlink-url/review-batches/p0-001-evidence.json
```

Evidence 输出包含 HTTP 状态、最终 URL、表单数量、提交按钮信号、登录/OAuth/CAPTCHA/Cloudflare/付费信号、registry URL 重复信号和 `suggested_decision`。`suggested_decision` 只是审核辅助，不会自动写入 `review_decision`。

生成非绑定审核建议：

```bash
node src/cli.js targets coverage-review-suggest \
  backlink-url/review-batches/p0-001.csv \
  backlink-url/review-batches/p0-001-evidence.csv \
  --output backlink-url/review-batches/p0-001-suggestions.csv \
  --json-output backlink-url/review-batches/p0-001-suggestions.json
```

Suggestion 文件仍然不修改任何审核表。它只把 evidence 转成更保守的人工复核建议：

- 明确重复、明确付费提交页、明确登录/OAuth/CAPTCHA 阻断会给出拒绝建议。
- 疑似有效表单不会自动批准，只会给出 `possible_approval_decision`，要求人工确认。
- 同域候选即使可考虑批准，也只提示 `approved_domain_variant`，不能使用普通 `approved`。
- 任何 `needs_manual_check` 都不能导入 registry。

编辑批次后先验证批次：

```bash
node src/cli.js targets validate-coverage-review-batch backlink-url/review-batches/p0-001.csv \
  --fail-on-blockers
```

再运行 promotion dry-run：

```bash
node src/cli.js targets promote-coverage-review-batch \
  backlink-url/coverage-review.csv \
  backlink-url/review-batches/p0-001.csv \
  --registry resources/targets.canonical.yaml \
  --output backlink-url/coverage-review.updated.csv \
  --report backlink-url/review-batches/p0-001-promotion-report.json \
  --dry-run
```

Promotion 会按顺序执行：

1. 验证 batch 本身。
2. 模拟把 batch 决策回写到主 `coverage-review.csv`。
3. 验证更新后的 review。
4. 对 registry 执行 import dry-run。
5. 只有全部通过，且移除 `--dry-run`，才写 `--output` 指定的新 review CSV。

真实写出更新版 review：

```bash
node src/cli.js targets promote-coverage-review-batch \
  backlink-url/coverage-review.csv \
  backlink-url/review-batches/p0-001.csv \
  --registry resources/targets.canonical.yaml \
  --output backlink-url/coverage-review.updated.csv \
  --report backlink-url/review-batches/p0-001-promotion-report.json
```

不要直接 in-place 修改主 review；先生成 `coverage-review.updated.csv`，审查后再决定是否替换。

## Import Gate

只有 promotion 生成的 updated review 通过验证后，才能做导入 dry-run：

```bash
node src/cli.js targets import-coverage-review backlink-url/coverage-review.updated.csv \
  --registry resources/targets.canonical.yaml \
  --dry-run
```

确认无 blocker 后，才允许真实导入 registry：

```bash
node src/cli.js targets import-coverage-review backlink-url/coverage-review.updated.csv \
  --registry resources/targets.canonical.yaml
```

导入策略：

- 只导入 approved 行。
- 所有导入目标强制为 `needs_scout`。
- `pricing`、`risk`、`auth`、`captcha`、`reachable` 保持保守未知状态。
- 不会加入 `auto_safe`。

## After Import

导入 registry 后，下一步不是执行提交，而是生成 scout 队列并收集证据：

```bash
node src/cli.js scout-queue \
  --registry resources/targets.canonical.yaml \
  --mode needs_scout \
  --free-only \
  --allow-unknown-pricing \
  --limit 10 \
  --output runs/scout-coverage-001/plan.json
```

随后用 pipeline/scout-plan 收集表单证据。只有 scout 证据证明页面可达、无 auth/CAPTCHA/payment 阻断、字段映射完整，目标才可能升级为 `auto_safe`。真实执行仍必须通过 readiness、target audit、stale plan 检查和 dry-run。
