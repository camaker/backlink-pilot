# Backlink Pilot v2.1

**[English](README.md)**

<p align="center">
  <img src="docs/overview.zh.svg" alt="Backlink Pilot v2.1 概览" width="100%"/>
</p>

**安全、可审计的一条命令外链提交工具。** 配置一次产品信息，先侦察、再计划、再 dry-run，最后只提交已验证安全的目录站。

> 由 AI Agent ([OpenClaw](https://openclaw.ai)) 在真实外链建设中构建，30+ 站点实战验证。

当前使用 [`resources/targets.canonical.yaml`](resources/targets.canonical.yaml) 作为规范化目标库。旧数据里的 `auto: yes` 只会被视为 `auto_candidate`；只有经过 scout 证据确认的目标才会升级为 `auto_safe` 并允许自动执行。

---

## 最快上手 — Claude Code（推荐）

> 有 Claude Code？**不需要看下面任何文档。** 三步搞定：

```bash
git clone https://github.com/s87343472/backlink-pilot.git
cd backlink-pilot && npm install
claude    # 打开 Claude Code，直接说「帮我提交外链」
```

Claude 自动读取 `CLAUDE.md`，引导你配置产品信息、安装 bb-browser、开始提交。

详细教程：[docs/tutorial.md](docs/tutorial.md) | 完整指南：[docs/guide.md](docs/guide.md)

---

## 快速开始

```bash
# 1. 克隆安装
git clone https://github.com/s87343472/backlink-pilot.git
cd backlink-pilot && npm install

# 2. 安装 bb-browser（推荐）
npm install -g bb-browser

# 3. 自动生成本地配置
node src/cli.js init --url https://your-product.com

# 4. 真实提交前先做产品资料准入检查
node src/cli.js readiness --level automation

# 5. 先侦察未验证目标，写回证据，刷新安全运行计划，并 dry-run
node src/cli.js pipeline --run-dir runs/batch-001 --registry resources/targets.canonical.yaml --free-only --allow-unknown-pricing --scout-queue --update-registry --limit 10

# 6. 复核 runs/batch-001/plan.json 后，只执行已验证的 auto_safe 目标
node src/cli.js pipeline --run-dir runs/execute-001 --registry resources/targets.canonical.yaml --config config.yaml --free-only --mode auto_safe --limit 3 --execute --delay 90s
```

也可以完全不预先生成配置，直接在命令里传产品信息；工具会自动生成被 `.gitignore` 忽略的本地 `config.yaml`：

```bash
node src/cli.js submit https://any-site.com/submit \
  --product-url https://your-product.com \
  --product-name "Your Product" \
  --product-description "Short product description" \
  --product-email hello@your-product.com \
  --engine bb
```

`bb-browser` 会在需要时自动启动 daemon；通常不需要手动执行 `bb-browser daemon start`。真实执行会把每个目标的截图、HTML、字段映射、结果 JSON 写到 `runs/.../artifacts/`，该目录默认不会提交到 git。

---

## Assisted 登录会话

有些目录站必须先正常登录账号，提交表单才会出现。Backlink Pilot 把这类目标归为 `assisted`：支持复用人工登录后的浏览器会话，但不绕过登录、OAuth、2FA、CAPTCHA、Cloudflare、付费墙或人工审核。

```bash
# 可选：从已生成批次中挑选下一组人工登录任务。
# 该命令只写入/打印命令清单，不启动浏览器，也不提交任何内容。
node src/cli.js targets auth-login-next \
  backlink-url/assisted-submission-pack/auth-login-status-batch-001.json \
  backlink-url/assisted-submission-pack/auth-login-status-batch-002.json \
  backlink-url/assisted-submission-pack/auth-login-status-batch-003.json \
  --limit 10 \
  --output backlink-url/assisted-submission-pack/auth-login-next-001.json \
  --csv-output backlink-url/assisted-submission-pack/auth-login-next-001.csv

# 可选：一次性刷新当前 assisted 登录工作流产物。
# 只写入状态报告、下一批登录任务、认证后重扫计划和摘要；不启动浏览器，也不提交。
node src/cli.js targets auth-workflow-refresh \
  backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv \
  backlink-url/assisted-submission-pack/auth-login-status-batch-001.json \
  backlink-url/assisted-submission-pack/auth-login-status-batch-002.json \
  backlink-url/assisted-submission-pack/auth-login-status-batch-003.json \
  --registry resources/targets.canonical.yaml \
  --output-dir backlink-url/assisted-submission-pack \
  --next-limit 10

# 可选：生成人工登录 runbook 和 PowerShell 辅助脚本。
# 生成的脚本每个目标都要求人工确认，且不会提交、不会 scout、不会执行 run-plan。
node src/cli.js targets auth-login-operator-pack \
  backlink-url/assisted-submission-pack/auth-login-next-current.json \
  --output-dir backlink-url/assisted-submission-pack \
  --name auth-login-operator-current

# 1. 打开可见 Playwright 浏览器，手动完成登录
node src/cli.js auth login --profile saashub --url https://www.saashub.com/login

# 2. 确认会话已经保存
node src/cli.js auth status --profile saashub

# 3. 使用登录态 scout 真实提交表单，并把选择器写回规范化目标库
node src/cli.js scout https://www.saashub.com/product/new \
  --auth-profile saashub \
  --engine playwright \
  --target-id saashub \
  --deep \
  --persist \
  --update-registry \
  --registry resources/targets.canonical.yaml

# 4. 产品准入通过且 scout 映射存在后，才执行 assisted 目标
node src/cli.js run-plan runs/batch-001/plan.json \
  --execute \
  --assisted \
  --auth-profile saashub \
  --engine playwright \
  --delay 90s \
  --config config.yaml \
  --registry resources/targets.canonical.yaml
```

登录会话保存为 Playwright `storageState`，位置在 `playwright/.auth/`，该目录已被 `.gitignore` 忽略。带登录态的通用提交必须有已持久化的 scout 字段选择器和提交按钮选择器；缺失时会直接失败，不会现场猜表单或盲点提交。

---

## 受控测试 Override

真实执行默认必须通过产品准入、目标库 audit 和 `auto_safe` scout 证据。危险 override 被刻意设计成高摩擦：

- `--allow-auto-candidate`
- `--skip-readiness-check`
- `--skip-target-audit`

这些参数只要和 `--execute` 一起使用，就必须显式传入：

```bash
--confirm-controlled-test CONTROLLED_TEST_ONLY
```

确认短语和 override 列表会写入 `runs/.../artifacts/run-execution-overrides.json`。正常外链批次不要使用这些开关。

---

## 引擎对比

| 引擎 | 安装 | 优点 | 缺点 |
|------|------|------|------|
| **bb-browser**（推荐） | `npm i -g bb-browser` | 真实 Chrome，100% 隐身，支持 OAuth | 需要 Chrome |
| **playwright**（默认） | `npm install` | 零配置 | 被反爬检测，Cloudflare 拦截 |

---

## 命令速查

```bash
node src/cli.js submit <站点名或URL>     # 提交到目录站
node src/cli.js campaign <产品官网>      # 自动选择外链目标并提交
node src/cli.js init --url <产品官网>    # 自动生成本地产品配置
node src/cli.js readiness                # 检查产品资料是否满足真实提交准入
node src/cli.js auth login --url <URL>   # 为 assisted 目标保存人工登录会话
node src/cli.js scout <URL> --deep       # 侦察站点表单
node src/cli.js scout-queue              # 生成未侦察目标队列
node src/cli.js targets coverage-review-batch <队列CSV>   # 从外链候选队列生成小批次人工审核表
node src/cli.js targets coverage-review-suggest <批次CSV> <evidence.csv>  # 从只读证据生成非绑定审核建议
node src/cli.js targets coverage-review-draft <批次CSV> <suggestions.csv>  # 从高置信建议生成仅拒绝的批次草案
node src/cli.js targets promote-coverage-review-batch <主review> <批次CSV> --dry-run  # 批次回写前的完整安全门禁
node src/cli.js targets coverage-review-manual-pack <队列CSV>  # 从剩余候选生成可审计人工复核包
node src/cli.js targets pricing-review-queue       # 排队 pricing 仍 unknown 的 runnable 目标
node src/cli.js targets pricing-review-evidence <队列CSV>      # GET-only 价格证据，不登录不提交
node src/cli.js targets pricing-review-suggest <队列CSV> <evidence.csv>  # 生成非绑定价格建议
node src/cli.js targets pricing-review-decision-draft <suggestions.csv>  # 生成空白人工价格决策草稿
node src/cli.js targets apply-pricing-review-decisions <draft.csv>        # 预览/应用已人工审核的价格决策
node src/cli.js targets auth-login-next <批次...>  # 只挑选下一批人工登录任务，不执行
node src/cli.js targets auth-login-operator-pack <next-login.json>  # 生成人工登录 runbook 和 PowerShell 辅助脚本
node src/cli.js targets auth-workflow-refresh <queue.csv> <批次...>  # 刷新 assisted 登录工作流产物，不执行命令
node src/cli.js pipeline --scout-queue   # 侦察未验证目标，刷新计划，再 dry-run 或执行
node src/cli.js scout-plan <计划文件>    # 批量侦察计划里的目标并更新安全等级
node src/cli.js run-plan <计划文件>      # dry-run 或执行 auto_safe 目标
node src/cli.js verify-results <JSONL>   # 从执行结果里验证外链是否上线
node src/cli.js awesome <仓库名>          # 生成 awesome-list Issue
node src/cli.js indexnow <URL>           # 通知搜索引擎
node src/cli.js status                   # 查看提交记录
node src/cli.js bb-update                # 更新 bb-browser 适配器
node src/batch-submit.js --limit N       # 批量博客评论
```

---

## 验证闭环

`run-plan --execute` 会同时记录浏览器最终 URL 和提取到的 listing 候选。只有高置信候选会写入 `listing_url`；低置信候选只保留在 `listing_url_candidates` 里，供人工复核。

```bash
node src/cli.js verify-results runs/batch-001/results.jsonl \
  --product-url https://your-product.com \
  --output runs/batch-001/verification-results.jsonl
```

如果目标站只返回 thank-you 页、submit 页、checkout 页、login 页或低置信普通 URL，验证会以 `missing_listing_url` 或 `no_high_confidence_listing_url` 跳过，不会假装外链已经存在。

---

## 外链策略

**为什么要做外链？** Google 排名逻辑 = 别的网站链接到你 = 投票。票越多、来源越权威，排名越高。

### 最佳渠道（按 ROI 排序）

1. **GitHub awesome-lists** — 最高 ROI，永久收录，$0，每个 5 分钟
2. **免费目录站** — 只自动执行已经验证为 `auto_safe` 的目标
3. **博客评论** — Website 字段留链接，批量自动化

### 提交节奏

- 先 scout，再 dry-run，最后 execute
- 不同站点间隔 1-3 分钟，每天 5-10 个
- **同一产品不要重复提交到同一站点**
- 不绕过登录、CAPTCHA、付费或人工审核；这些目标只能走 `assisted` 或 `manual_strategic`

### 避坑清单

| 站点 | 原因 |
|------|------|
| IndieHub | 看起来免费，发布要 $4.9 |
| OpenHunts | 免费排队 51 周 |
| toolify.ai | $99 |
| Product Hunt | 反爬机制，只能手动 |

---

## Agent 集成

### Claude Code

克隆仓库 → 运行 `claude` → 直接对话。`CLAUDE.md` 是 AI 的操作手册，Claude 自动读取。

### OpenClaw

```bash
ln -s ~/path/to/backlink-pilot ~/.openclaw/skills/backlink-pilot
```

然后说：「帮我提交外链」

---

## 项目结构

```
backlink-pilot/
├── README.md                  ← 英文文档
├── README.zh.md               ← 你在这里
├── CLAUDE.md                  ← Claude Code 指令
├── LICENSE
├── package.json
├── config.example.yaml        ← 配置模板
├── targets.yaml               ← 259 个目标站点
│
├── docs/                      ← 文档
│   ├── index.md               ← 文档首页（VitePress）
│   ├── guide.md               ← 完整使用指南
│   ├── tutorial.md            ← 上手教程
│   ├── troubleshooting.md     ← 20+ 排错记录
│   ├── adapters.md            ← 适配器参考
│   ├── contributing.md        ← 贡献指南
│   └── skill.md               ← OpenClaw 技能定义
│
├── src/                       ← 源码
│   ├── cli.js                 ← 命令行入口
│   ├── submit.js              ← 提交调度器
│   ├── bb.js                  ← bb-browser 封装
│   ├── browser.js             ← 双引擎管理
│   ├── config.js              ← 配置加载 + UTM
│   ├── tracker.js             ← 提交去重追踪
│   ├── captcha.js             ← 验证码解决器
│   ├── indexnow.js            ← 搜索引擎通知
│   ├── batch-submit.js        ← 批量博客评论
│   ├── bb-update.js           ← bb-browser 适配器更新
│   ├── sites/                 ← 站点适配器
│   │   ├── generic.js         ← 通用适配器
│   │   ├── saashub.js
│   │   ├── uneed.js
│   │   ├── baitools.js
│   │   └── startup88.js
│   ├── scout/discover.js      ← 表单字段发现
│   └── awesome/templates.js   ← Awesome-list Issue 生成器
│
├── tests/                     ← 测试
└── bak/                       ← 废弃代码（不上传）
```

---

## 开发者

### 写新适配器

```bash
# 方式 1：通用提交（不用写代码）
node src/cli.js submit https://new-site.com/submit --engine bb

# 方式 2：自定义适配器
node src/cli.js scout https://new-site.com --deep
# 然后创建 src/sites/newsite.js — 参考 docs/adapters.md
```

### 运行测试

```bash
npm test
```

> 完整排错记录：[docs/troubleshooting.md](docs/troubleshooting.md)

---

## 贡献

参见 [docs/contributing.md](docs/contributing.md)。欢迎 PR：新适配器、验证码改进、Bug 修复。

## 许可证

MIT

## 致谢

使用 [OpenClaw](https://openclaw.ai) 构建。浏览器自动化：[bb-browser](https://github.com/niciral/bb-browser)、[rebrowser-playwright](https://github.com/nickthecoder/rebrowser-playwright)。
