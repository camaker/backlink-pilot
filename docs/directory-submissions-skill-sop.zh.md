# Directory Submissions Skill 应用 SOP

本文档说明如何把以下三类能力串成一条可审计、可执行、可扩展的外链作业流：

- `directory-submissions`：目录外链策略框架、分层和文案体系
- `7deer_skills`：外链机会发现、目录情报、联系人外联补充
- `backlink-pilot`：安全审核、scout、计划、执行、验证

目标不是“直接跑一个自动提交脚本”，而是用最小风险的方式，把新线索稳定转成真实上线的外链。

## 核心原则

- `directory-submissions` 负责“发到哪里、怎么写、怎么分批”
- `7deer` 负责“发现更多线索、补情报、补外联机会”
- `backlink-pilot` 负责“审核、侦察、执行、验证”

严格边界：

- 不跳过登录、OAuth、2FA、CAPTCHA、Cloudflare
- 不把原始发现结果直接导入可执行 registry
- 不把弱成功信号当作真实提交成功
- 任何新候选先导入为 `needs_scout`

## 0. 先准备产品资料

初始化本地产品配置：

```bash
node src/cli.js init --url https://your-product.com
node src/cli.js readiness --level automation
```

最低要求：

- 产品名称
- URL
- 简短描述
- 联系邮箱
- 定价状态
- Logo / 截图 / 落地页

如果 `readiness` 阻塞，先补资料，不进入后续提交链。

## 1. 用 directory-submissions 做目录分层

参考：

- `C:\Users\ZH\.agents\skills\directory-submissions\references\directory-list.md`
- `C:\Users\ZH\.agents\skills\directory-submissions\references\positioning-variations.md`
- `C:\Users\ZH\.agents\skills\directory-submissions\references\submission-tracker-template.csv`

建议按层分批：

- Tier 1：Launch / 发布站
- Tier 2：SaaS / Startup / Software
- Tier 3：AI tools directory
- Tier 4：Agent / MCP
- Tier 6：Editorial / best-of listicles
- Tier 8：Profile / content / dev identity

要求：

- 每个 tier 使用不同描述 opening
- 不要在所有目录站重复同一段长描述
- 每次只提交一个聚焦批次

## 2. 用 7deer discovery 扩充候选池

优先使用：

- `D:\workspace\7deer_skills\backlink-discovery\scripts\discovery_engine.py`

它的作用不是自动提交，而是发现：

- 新 submit page
- 新目录域名
- Alternatives 页面
- GitHub awesome list
- 社区 / 资源页

产物通常是 `platforms.json`。

## 3. 把 7deer discovery 结果接入 backlink-pilot

新增命令：

```bash
node src/cli.js targets discovery-intake "D:\path\to\platforms.json" \
  --registry resources/targets.canonical.yaml \
  --output-dir backlink-url/discovery-intake/xtimer \
  --source 7deer-discovery
```

这个命令会自动生成：

- 标准化 intake CSV
- `coverage-report.json`
- `coverage-candidates.csv`
- `coverage-review.csv`
- `coverage-review-queue.csv`

重要说明：

- 这一步不会导入 registry
- 不会 scout
- 不会提交
- 只是把 discovery 线索转成可审计的 coverage 工件

## 4. 审核 discovery 候选

从队列里切出小批次：

```bash
node src/cli.js targets coverage-review-batch \
  backlink-url/discovery-intake/xtimer/coverage-review-queue.csv \
  --priority P0 \
  --limit 25 \
  --batch-id discovery-p0-001 \
  --output backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.csv \
  --markdown backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.md
```

收集只读证据：

```bash
node src/cli.js targets coverage-review-evidence \
  backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.csv \
  --output backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001-evidence.csv \
  --json-output backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001-evidence.json
```

生成非绑定建议：

```bash
node src/cli.js targets coverage-review-suggest \
  backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.csv \
  backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001-evidence.csv \
  --output backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001-suggestions.csv
```

## 5. 通过 promotion gate 后导入 registry

先验证批次：

```bash
node src/cli.js targets validate-coverage-review-batch \
  backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.csv \
  --fail-on-blockers
```

再跑 dry-run promotion：

```bash
node src/cli.js targets promote-coverage-review-batch \
  backlink-url/discovery-intake/xtimer/coverage-review.csv \
  backlink-url/discovery-intake/xtimer/review-batches/discovery-p0-001.csv \
  --registry resources/targets.canonical.yaml \
  --output backlink-url/discovery-intake/xtimer/coverage-review.updated.csv \
  --dry-run
```

最后才允许导入：

```bash
node src/cli.js targets import-coverage-review \
  backlink-url/discovery-intake/xtimer/coverage-review.updated.csv \
  --registry resources/targets.canonical.yaml
```

导入结果仍然是：

- `needs_scout`
- 不是 `auto_safe`
- 不能直接执行

## 6. scout 真实表单，再执行

构建 scout 队列：

```bash
node src/cli.js scout-queue \
  --registry resources/targets.canonical.yaml \
  --mode needs_scout \
  --free-only \
  --allow-unknown-pricing \
  --limit 20 \
  --output runs/scout-xtimer/plan.json
```

批量 scout：

```bash
node src/cli.js scout-plan runs/scout-xtimer/plan.json \
  --update-registry \
  --registry resources/targets.canonical.yaml
```

只有 scout 证明：

- 页面可达
- 无 auth/CAPTCHA/payment blocker
- 字段映射完整
- submit button 明确

目标才可能升级为 `auto_safe`。

执行：

```bash
node src/cli.js plan \
  --registry resources/targets.canonical.yaml \
  --product-config config.yaml \
  --free-only \
  --mode auto_safe \
  --output runs/exec-xtimer/plan.json

node src/cli.js run-plan runs/exec-xtimer/plan.json \
  --execute \
  --registry resources/targets.canonical.yaml \
  --config config.yaml
```

## 7. 验证外链是否真上线

```bash
node src/cli.js verify-results runs/exec-xtimer/results.jsonl \
  --product-url https://your-product.com \
  --output runs/exec-xtimer/verification-results.jsonl \
  --update-registry \
  --registry resources/targets.canonical.yaml
```

只要 listing URL 不明确、置信度不够、或页面只是 thank-you/login/checkout，都不会假装成功。

## 8. 把 skill 用在“目录之外”的外链

`seo-link-strategy` 适合：

- Alternatives 文章站
- 联系人发现
- 个性化外联草稿

不适合：

- 目录自动提交主线
- Gmail 自动发送主线

建议做法：

- 让它产出联系人和草稿
- 人工审核后再发送
- 单独做 editorial outreach 工作台

## 9. 不建议的做法

以下做法不要进入主线：

- 直接使用 `seo-backlink-submitter` 做真实批量提交
- 把 `thank/success/submitted` 文本当作成功
- 直接把 discovery 结果写进可执行 registry
- 把第三方外链投放 API 当目录提交器

## 最终工作模型

推荐分工：

1. `directory-submissions`
   - 目录分层
   - 文案策略
   - tracker

2. `7deer discovery`
   - 新候选发现
   - 新 submit surface 线索

3. `backlink-pilot`
   - coverage 审核
   - scout
   - plan
   - run-plan
   - verify

4. `seo-link-strategy`
   - 外联草稿
   - 联系人发现

这是当前仓库里最安全、最严谨、最能扩张规模的 skill 应用方式。
