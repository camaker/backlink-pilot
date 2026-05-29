# Three-Site Assisted Submission Runbook

Prepared: 2026-05-29

Scope: assisted backlink submission planning for XTimer, Mobyform, and VisioArt. This runbook is for operator-guided submissions only. It does not authorize bypassing login, OAuth, CAPTCHA, 2FA, Cloudflare, payment walls, or moderator requirements.

## Safety Gates

- Review the target page before filling anything.
- Do not submit if the target is paid unless the user explicitly approves the payment.
- Do not submit if the target is not a real product/startup/SaaS/AI/tool directory.
- Do not use the same long description everywhere.
- Stop before the final submit button if the form contains legal claims, paid placement, account binding, review solicitation, or unclear terms.
- Record every attempted submission, final URL, status, and moderator note.

## Product Order

1. VisioArt first: strongest directory-market fit for AI directories.
2. Mobyform second: strong SaaS/no-code/form-builder fit.
3. XTimer third: solid productivity/event-tech fit, but needs SVG/logo and more screenshots for top-tier launch surfaces.

## First-Wave Queues

| Product | Queue file | Use |
|---|---|---|
| VisioArt | `backlink-url/submission-materials/visioart-first-wave-targets.csv` | AI tool, video, creator, and model directories. |
| Mobyform | `backlink-url/submission-materials/mobyform-first-wave-targets.csv` | SaaS, form-builder, no-code, survey, and productivity directories. |
| XTimer | `backlink-url/submission-materials/xtimer-first-wave-targets.csv` | SaaS, productivity, event-tech, presentation, and remote-work directories. |
| Combined | `backlink-url/submission-materials/three-sites-first-wave-targets.csv` | Top 15 tailored candidates per product. |

## VisioArt First-Wave Positioning

Use for AI/video directories:

- Product name: VisioArt
- URL: https://visioart.ai
- Tagline: Multi-model AI video creation workspace
- Short description: Generate AI videos and images across leading models.
- Category: AI Video Generator
- Tags: AI video, text-to-video, image-to-video, AI image generator, creator tools, marketing video, Sora, Kling, Veo
- Best destination URL: https://visioart.ai

Opening variant:

VisioArt brings leading AI video and image models into one workspace for faster creative production. Create social clips, product demos, campaign videos, ecommerce product reveals, and image-guided animations without switching between separate AI tools.

## Mobyform First-Wave Positioning

Use for SaaS/form/no-code directories:

- Product name: Mobyform
- URL: https://mobyform.com/en
- Tagline: Forms that work after submission
- Short description: Build forms, surveys, exams, analytics, and workflows.
- Category: Form Builder
- Tags: form builder, surveys, online exams, data collection, no-code, workflow automation, analytics, webhooks
- Best destination URL: https://mobyform.com/en

Opening variant:

Mobyform helps teams build forms, surveys, exams, and response workflows that keep working after submission. Collect structured responses, analyze trends, collaborate with teammates, and route data to business tools through integrations.

## XTimer First-Wave Positioning

Use for SaaS/productivity/event-tech directories:

- Product name: XTimer
- URL: https://xtimer.app/en
- Tagline: Remote-controlled timer for live events
- Short description: Control fullscreen countdown timers from another device.
- Category: Productivity
- Tags: timer, countdown, event timer, presentation timer, meeting timer, livestreaming, remote control, run-of-show
- Best destination URL: https://xtimer.app/en

Opening variant:

XTimer helps event teams keep speakers, moderators, and audiences in sync with a fullscreen countdown and stage timer that can be controlled remotely from another device.

## Required Logging Per Submission

Record:

- Product.
- Target ID and domain.
- Submit URL.
- Date/time.
- Operator.
- Form fields completed.
- Whether login was required.
- Whether CAPTCHA was present.
- Whether payment was requested.
- Final submission status.
- Confirmation message.
- Listing URL if available.
- Backlink verification status.

## Immediate Blockers To Fix

| Product | Blocker | Severity |
|---|---|---|
| XTimer | No public SVG logo URL found. | Medium |
| XTimer | Only two screenshot URLs recorded. | Medium |
| XTimer | No demo video URL recorded. | Medium |
| Mobyform | Only two screenshot/image URLs recorded. | Medium |
| Mobyform | No demo video URL recorded. | Medium |
| VisioArt | No demo video URL recorded. | Medium |

## Recommended Next Command Sequence

Use dry-run first:

```powershell
node src/cli.js run-plan runs/visioart/plan.json --limit 1 --product-config backlink-url/submission-materials/visioart.config.yaml --registry resources/targets.canonical.yaml --state runs/visioart/state.json --results runs/visioart/results.jsonl --artifacts runs/visioart/artifacts
```

For real assisted submission, open one target at a time, review the filled form, and only proceed when the user explicitly approves that specific final submit action.
