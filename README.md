# Backlink Pilot v2.1

**[中文文档](README.zh.md)**

<p align="center">
  <img src="docs/overview.svg" alt="Backlink Pilot v2.1 Overview" width="100%"/>
</p>

**One config, one command. Safe, audited backlink submission for indie products.**

> Built by an AI Agent ([OpenClaw](https://openclaw.ai)) during real-world link building — battle-tested on 30+ sites.

The project now uses a canonical target registry in [`resources/targets.canonical.yaml`](resources/targets.canonical.yaml). Static `auto: yes` is treated as `auto_candidate`; a target only becomes executable after scout evidence upgrades it to `auto_safe`.

---

## Quickest Start — Claude Code (Recommended)

> Have Claude Code? **You don't need to read any docs.** Three steps:

```bash
git clone https://github.com/s87343472/backlink-pilot.git
cd backlink-pilot && npm install
claude    # Open Claude Code, just say "submit my product to free directories"
```

Claude automatically reads `CLAUDE.md`, guides you through config, installs bb-browser, and starts submitting.

Detailed tutorial: [docs/tutorial.md](docs/tutorial.md) | Full guide: [docs/guide.md](docs/guide.md)

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/s87343472/backlink-pilot.git
cd backlink-pilot && npm install

# 2. Install bb-browser (recommended)
npm install -g bb-browser

# 3. Auto-generate local config from your product homepage
node src/cli.js init --url https://your-product.com

# 4. Check readiness before real submissions
node src/cli.js readiness --level automation

# 5. Scout unverified targets, refresh the safe run plan, and dry-run it
node src/cli.js pipeline --run-dir runs/batch-001 --registry resources/targets.canonical.yaml --free-only --allow-unknown-pricing --scout-queue --update-registry --limit 10

# 6. Execute only verified auto_safe targets after reviewing runs/batch-001/plan.json
node src/cli.js pipeline --run-dir runs/execute-001 --registry resources/targets.canonical.yaml --config config.yaml --free-only --mode auto_safe --limit 3 --execute --delay 90s
```

You can also skip pre-generating config and pass product details directly. The CLI will create the gitignored local `config.yaml` automatically:

```bash
node src/cli.js submit https://any-site.com/submit \
  --product-url https://your-product.com \
  --product-name "Your Product" \
  --product-description "Short product description" \
  --product-email hello@your-product.com \
  --engine bb
```

When `bb` is selected, the CLI tries to start the `bb-browser` daemon automatically. Real `run-plan --execute` writes per-target evidence under `runs/.../artifacts/`, which is gitignored.

---

## Assisted Login Sessions

Some directories require a normal account login before the submit form is visible. Backlink Pilot supports these as `assisted` targets, but it does not bypass login, OAuth, 2FA, CAPTCHA, Cloudflare, payment, or moderator review.

```bash
# 1. Open a visible Playwright browser and complete login manually
node src/cli.js auth login --profile saashub --url https://www.saashub.com/login

# 2. Confirm the saved session exists
node src/cli.js auth status --profile saashub

# 3. Scout the logged-in submit form and persist selectors into the registry
node src/cli.js scout https://www.saashub.com/product/new \
  --auth-profile saashub \
  --engine playwright \
  --target-id saashub \
  --deep \
  --persist \
  --update-registry \
  --registry resources/targets.canonical.yaml

# 4. Execute assisted targets only after readiness passes and scout mappings exist
node src/cli.js run-plan runs/batch-001/plan.json \
  --execute \
  --assisted \
  --auth-profile saashub \
  --engine playwright \
  --delay 90s \
  --config config.yaml \
  --registry resources/targets.canonical.yaml
```

Saved sessions are Playwright `storageState` files under `playwright/.auth/`, which is gitignored. Authenticated generic submissions require persisted scout selectors and a persisted submit button selector; if those are missing, execution fails closed instead of guessing.

---

## Controlled Test Overrides

Real execution normally requires product readiness, target audit, and `auto_safe` scout evidence. Dangerous overrides are intentionally friction-heavy:

- `--allow-auto-candidate`
- `--skip-readiness-check`
- `--skip-target-audit`

When any of these are used with `--execute`, the runner now requires:

```bash
--confirm-controlled-test CONTROLLED_TEST_ONLY
```

The confirmation and override list are written to `runs/.../artifacts/run-execution-overrides.json`. Do not use these switches for normal backlink campaigns.

---

## Engine Comparison

| Engine | Setup | Pros | Cons |
|--------|-------|------|------|
| **bb-browser** (recommended) | `npm i -g bb-browser` | Real Chrome, invisible, OAuth works | Requires Chrome |
| **playwright** (default) | `npm install` | No extra setup | Detected by anti-bot, blocked by Cloudflare |

---

## Commands

```bash
node src/cli.js submit <site-or-url>     # Submit to directory
node src/cli.js init --url <product-url> # Auto-generate local product config
node src/cli.js readiness                # Validate product readiness before real submissions
node src/cli.js auth login --url <url>   # Save a manual login session for assisted targets
node src/cli.js scout <url> --deep       # Discover form fields
node src/cli.js scout-queue              # Build a plan of unscouted targets
node src/cli.js targets coverage-review-batch <queue.csv>   # Create small human review batches from backlink URL candidates
node src/cli.js targets coverage-review-suggest <batch.csv> <evidence.csv>  # Create non-binding review suggestions from read-only evidence
node src/cli.js targets coverage-review-draft <batch.csv> <suggestions.csv>  # Draft rejection-only batch edits from high-confidence suggestions
node src/cli.js targets promote-coverage-review-batch <review.csv> <batch.csv> --dry-run  # Validate batch promotion before import/scout
node src/cli.js pipeline --scout-queue   # Scout unverified targets, refresh plan, dry-run or execute
node src/cli.js scout-plan <plan>        # Scout a generated plan and update target safety
node src/cli.js run-plan <plan>          # Dry-run or execute verified auto_safe targets
node src/cli.js verify-results <jsonl>   # Verify backlinks from run results
node src/cli.js awesome <repo>           # Generate awesome-list Issue
node src/cli.js indexnow <url>           # Ping search engines
node src/cli.js status                   # Check submission history
node src/cli.js bb-update                # Update bb-browser adapters
node src/batch-submit.js --limit N       # Batch blog comments
```

---

## Verification Loop

`run-plan --execute` records both the browser's final URL and extracted listing candidates. Only high-confidence listing candidates are written to `listing_url`; lower-confidence candidates stay in `listing_url_candidates` for manual review.

```bash
node src/cli.js verify-results runs/batch-001/results.jsonl \
  --product-url https://your-product.com \
  --output runs/batch-001/verification-results.jsonl
```

If a target only returns a thank-you page, submit page, checkout page, login page, or a generic low-confidence URL, verification skips it with `missing_listing_url` or `no_high_confidence_listing_url` instead of pretending a backlink exists.

---

## Strategy

**Why backlinks?** Google ranking = other sites linking to you = votes. More quality votes = higher ranking.

### Best channels by ROI

1. **GitHub awesome-lists** — highest ROI, permanent, $0, 5 min each
2. **Free directory sites** — only execute targets verified as `auto_safe`
3. **Blog comments** — Website field backlinks, batch-automated

### Submission pace

- Scout first, dry-run second, execute third
- 1-3 min between sites, 5-10 per day
- **Never submit the same product to the same site twice**
- Do not bypass login, CAPTCHA, payment, or human review. Those targets are `assisted` or `manual_strategic`.

### Sites to avoid

| Site | Why |
|------|-----|
| IndieHub | Hidden $4.9 paywall |
| OpenHunts | 51-week free queue |
| toolify.ai | $99 |
| Product Hunt | Anti-bot, manual only |

---

## Agent Integration

### Claude Code

Clone the repo, run `claude`, and talk. `CLAUDE.md` is the instruction manual — Claude reads it automatically.

### OpenClaw

```bash
ln -s ~/path/to/backlink-pilot ~/.openclaw/skills/backlink-pilot
```

Then just say: "Submit to free directories"

---

## Project Structure

```
backlink-pilot/
├── README.md                  ← You are here
├── README.zh.md               ← Chinese docs
├── CLAUDE.md                  ← Claude Code agent instructions
├── LICENSE
├── package.json
├── config.example.yaml        ← Config template
├── targets.yaml               ← 259 target sites
│
├── docs/                      ← Documentation
│   ├── index.md               ← Docs home (VitePress)
│   ├── guide.md               ← Complete usage guide
│   ├── tutorial.md            ← Step-by-step tutorial
│   ├── troubleshooting.md     ← 20+ debugging notes
│   ├── adapters.md            ← Site adapters reference
│   ├── contributing.md        ← PR guidelines
│   └── skill.md               ← OpenClaw skill definition
│
├── src/                       ← Source code
│   ├── cli.js                 ← CLI entry point
│   ├── submit.js              ← Submission dispatcher
│   ├── bb.js                  ← bb-browser wrapper
│   ├── browser.js             ← Dual-engine manager
│   ├── config.js              ← Config loader + UTM
│   ├── tracker.js             ← Submission tracking
│   ├── captcha.js             ← CAPTCHA solvers
│   ├── indexnow.js            ← Search engine ping
│   ├── batch-submit.js        ← Batch blog comments
│   ├── bb-update.js           ← bb-browser adapter updater
│   ├── sites/                 ← Site adapters
│   │   ├── generic.js         ← Universal adapter
│   │   ├── saashub.js
│   │   ├── uneed.js
│   │   ├── baitools.js
│   │   └── startup88.js
│   ├── scout/discover.js      ← Form field discovery
│   └── awesome/templates.js   ← Awesome-list Issue generator
│
├── tests/                     ← Test suite
└── bak/                       ← Deprecated code (not tracked)
```

---

## Developer

### Writing a new adapter

```bash
# Option 1: Generic (no code needed)
node src/cli.js submit https://new-site.com/submit --engine bb

# Option 2: Custom adapter
node src/cli.js scout https://new-site.com --deep
# Then create src/sites/newsite.js — see docs/adapters.md
```

### Running tests

```bash
npm test
```

> Full debugging notes: [docs/troubleshooting.md](docs/troubleshooting.md)

---

## Contributing

See [docs/contributing.md](docs/contributing.md). PRs welcome: new adapters, CAPTCHA improvements, bug fixes.

## License

MIT

## Credits

Built with [OpenClaw](https://openclaw.ai). Browser automation by [bb-browser](https://github.com/niciral/bb-browser) and [rebrowser-playwright](https://github.com/nickthecoder/rebrowser-playwright).
