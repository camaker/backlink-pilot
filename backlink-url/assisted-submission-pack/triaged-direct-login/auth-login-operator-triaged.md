# Auth Login Operator Pack

Generated: 2026-05-27T10:39:07.741Z
Source: backlink-url/assisted-submission-pack/triaged-direct-login/auth-login-next-triaged.json

## Safety Policy

- Human-only login collection.
- Do not bypass CAPTCHA, Cloudflare, OAuth, 2FA, payment, or moderator review.
- Do not submit products from this pack.
- Do not run scout or run-plan from this pack.
- Stop on any paid-only flow, unclear ownership, file upload requirement, reciprocal-link demand, or legal/ToS ambiguity.

## Summary

- Tasks: 10
- Runnable manual login rows: 10
- Blocked rows: 0

## Operating Sequence

1. Run one login task at a time in a normal terminal.
2. Complete only the normal manual login in the visible browser.
3. Press Enter in the terminal only after the login state is visibly complete.
4. Run the matching auth status command.
5. After the batch, refresh the workflow and review whether any targets enter authenticated rescout.

## Tasks

| # | Priority | Target | Domain | Pricing | Risk | Login URL | Profile | Commands |
|---|---|---|---|---|---|---|---|---|
|1|P0|chatgptdemo|chatgptdemo.com|free|unknown|https://chatgptdemo.com/submit-new-ai-tool|chatgptdemo|Login: `node src/cli.js auth login --profile "chatgptdemo" --url "https://chatgptdemo.com/submit-new-ai-tool"`<br>Status: `node src/cli.js auth status --profile "chatgptdemo"`|
|2|P0|promptzone|promptzone.com|free|unknown|https://www.promptzone.com/new|promptzone|Login: `node src/cli.js auth login --profile "promptzone" --url "https://www.promptzone.com/new"`<br>Status: `node src/cli.js auth status --profile "promptzone"`|
|3|P0|resource-fyi|resource.fyi|free|unknown|https://resource.fyi/login|resource-fyi|Login: `node src/cli.js auth login --profile "resource-fyi" --url "https://resource.fyi/login"`<br>Status: `node src/cli.js auth status --profile "resource-fyi"`|
|4|P0|sitelike|sitelike.org|free|unknown|https://www.sitelike.org/add-site|sitelike|Login: `node src/cli.js auth login --profile "sitelike" --url "https://www.sitelike.org/add-site"`<br>Status: `node src/cli.js auth status --profile "sitelike"`|
|5|P0|ai-tool-guru|aitoolguru.com|free|unknown|https://aitoolguru.com/login|ai-tool-guru|Login: `node src/cli.js auth login --profile "ai-tool-guru" --url "https://aitoolguru.com/login"`<br>Status: `node src/cli.js auth status --profile "ai-tool-guru"`|
|6|P0|ai-tools-arena|aitoolsarena.com|free|unknown|https://aitoolsarena.com/ai-tools-list-new|ai-tools-arena|Login: `node src/cli.js auth login --profile "ai-tools-arena" --url "https://aitoolsarena.com/ai-tools-list-new"`<br>Status: `node src/cli.js auth status --profile "ai-tools-arena"`|
|7|P0|alternative-me|alternative.me|free|unknown|https://alternative.me/how-to/suggest-alternatives|alternative-me|Login: `node src/cli.js auth login --profile "alternative-me" --url "https://alternative.me/how-to/suggest-alternatives"`<br>Status: `node src/cli.js auth status --profile "alternative-me"`|
|8|P0|bestofai|bestofai.com|free|unknown|https://bestofai.com/tool/add|bestofai|Login: `node src/cli.js auth login --profile "bestofai" --url "https://bestofai.com/tool/add"`<br>Status: `node src/cli.js auth status --profile "bestofai"`|
|9|P0|f6s|f6s.com|free|unknown|https://www.f6s.com/|f6s|Login: `node src/cli.js auth login --profile "f6s" --url "https://www.f6s.com/"`<br>Status: `node src/cli.js auth status --profile "f6s"`|
|10|P0|favird|favird.com|free|unknown|https://favird.com/|favird|Login: `node src/cli.js auth login --profile "favird" --url "https://favird.com/"`<br>Status: `node src/cli.js auth status --profile "favird"`|

## Refresh Command

Run this after completing manual login tasks:

```bash
node src/cli.js targets auth-workflow-refresh backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv backlink-url/assisted-submission-pack/auth-login-plan-batch-001.json backlink-url/assisted-submission-pack/auth-login-plan-batch-002.json backlink-url/assisted-submission-pack/auth-login-plan-batch-003.json --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output-dir backlink-url/assisted-submission-pack --next-name auth-login-next-current --summary-name auth-workflow-refresh-summary --next-limit 10
```
