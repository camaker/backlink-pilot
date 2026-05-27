# Auth Login Operator Pack

Generated: 2026-05-27T09:54:52.362Z
Source: backlink-url/assisted-submission-pack/auth-login-next-current.json

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
|1|P0|beta-list|betalist.com|free|unknown|https://betalist.com/sign_in|beta-list|Login: `node src/cli.js auth login --profile "beta-list" --url "https://betalist.com/sign_in"`<br>Status: `node src/cli.js auth status --profile "beta-list"`|
|2|P0|chatgptdemo|chatgptdemo.com|free|unknown|https://chatgptdemo.com/submit-new-ai-tool|chatgptdemo|Login: `node src/cli.js auth login --profile "chatgptdemo" --url "https://chatgptdemo.com/submit-new-ai-tool"`<br>Status: `node src/cli.js auth status --profile "chatgptdemo"`|
|3|P0|promptzone|promptzone.com|free|unknown|https://www.promptzone.com/new|promptzone|Login: `node src/cli.js auth login --profile "promptzone" --url "https://www.promptzone.com/new"`<br>Status: `node src/cli.js auth status --profile "promptzone"`|
|4|P0|resource-fyi|resource.fyi|free|unknown|https://resource.fyi/login|resource-fyi|Login: `node src/cli.js auth login --profile "resource-fyi" --url "https://resource.fyi/login"`<br>Status: `node src/cli.js auth status --profile "resource-fyi"`|
|5|P0|sitelike|sitelike.org|free|unknown|https://www.sitelike.org/add-site|sitelike|Login: `node src/cli.js auth login --profile "sitelike" --url "https://www.sitelike.org/add-site"`<br>Status: `node src/cli.js auth status --profile "sitelike"`|
|6|P0|247webdirectory|247webdirectory.com|unknown|unknown|https://www.247webdirectory.com/|247webdirectory|Login: `node src/cli.js auth login --profile "247webdirectory" --url "https://www.247webdirectory.com/"`<br>Status: `node src/cli.js auth status --profile "247webdirectory"`|
|7|P0|asr|activesearchresults.com|unknown|unknown|https://www.activesearchresults.com/addwebsite.php|asr|Login: `node src/cli.js auth login --profile "asr" --url "https://www.activesearchresults.com/addwebsite.php"`<br>Status: `node src/cli.js auth status --profile "asr"`|
|8|P0|ai-ailookme|ailookme.com|unknown|unknown|https://www.ailookme.com/%e7%bd%91%e5%9d%80%e6%8f%90%e4%ba%a4|ai-ailookme|Login: `node src/cli.js auth login --profile "ai-ailookme" --url "https://www.ailookme.com/%e7%bd%91%e5%9d%80%e6%8f%90%e4%ba%a4"`<br>Status: `node src/cli.js auth status --profile "ai-ailookme"`|
|9|P0|top-best-alternatives|topbestalternatives.com|unknown|unknown|https://www.topbestalternatives.com/|top-best-alternatives|Login: `node src/cli.js auth login --profile "top-best-alternatives" --url "https://www.topbestalternatives.com/"`<br>Status: `node src/cli.js auth status --profile "top-best-alternatives"`|
|10|P0|xinquji-com|xinquji.com|unknown|unknown|https://xinquji.com/submit|xinquji-com|Login: `node src/cli.js auth login --profile "xinquji-com" --url "https://xinquji.com/submit"`<br>Status: `node src/cli.js auth status --profile "xinquji-com"`|

## Refresh Command

Run this after completing manual login tasks:

```bash
node src/cli.js targets auth-workflow-refresh backlink-url/assisted-submission-pack/auth-login-rescout-queue.csv backlink-url/assisted-submission-pack/auth-login-plan-batch-001.json backlink-url/assisted-submission-pack/auth-login-plan-batch-002.json backlink-url/assisted-submission-pack/auth-login-plan-batch-003.json --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output-dir backlink-url/assisted-submission-pack --next-name auth-login-next-current --summary-name auth-workflow-refresh-summary --next-limit 10
```
