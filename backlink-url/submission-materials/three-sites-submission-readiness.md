# Three-Site Directory Submission Readiness

Prepared: 2026-05-29

Products:

- XTimer: https://xtimer.app
- Mobyform: https://mobyform.com
- VisioArt: https://visioart.ai

Source projects:

- XTimer: `D:\ai-maker\ai-maker` was provided, but the current prepared XTimer kit lives in this backlink-pilot workspace from prior work.
- Mobyform: `D:\form\tduck-x-web`
- VisioArt: `D:\ai-maker\ai-maker`

## Readiness Results

| Product | Automation readiness | Hard blockers | Warnings |
|---|---|---|---|
| XTimer | Ready | None from CLI readiness | Missing public SVG logo URL. Only two screenshot URLs and no demo video recorded. |
| Mobyform | Ready | None from CLI readiness | Only two screenshot/image URLs and no demo video recorded. |
| VisioArt | Ready | None from CLI readiness | No demo video URL recorded. Competitor-specific alternative coverage should be expanded. |

## Submission Strategy

| Product | Best directory fit | First-wave positioning |
|---|---|---|
| XTimer | SaaS, productivity, event-tech, presentation tools, remote work | Remote-controlled fullscreen timer for events, talks, workshops, streams, and meetings. |
| Mobyform | SaaS, no-code, form builder, survey, online exam, workflow automation | Forms, surveys, exams, analytics, and response workflows in one platform. |
| VisioArt | AI directories, AI video, creator tools, marketing video, SaaS | Multi-model AI video and image creation workspace for production-ready assets. |

## Generated Artifacts

| Product | Config | Kit | Plan |
|---|---|---|---|
| XTimer | `backlink-url/submission-materials/xtimer.config.yaml` | `backlink-url/submission-materials/xtimer-submission-kit.md` | `runs/xtimer/plan.json` |
| Mobyform | `backlink-url/submission-materials/mobyform.config.yaml` | `backlink-url/submission-materials/mobyform-submission-kit.md` | `runs/mobyform/plan.json` |
| VisioArt | `backlink-url/submission-materials/visioart.config.yaml` | `backlink-url/submission-materials/visioart-submission-kit.md` | `runs/visioart/plan.json` |
| All | `backlink-url/submission-materials/three-sites-directory-submission-tracker.csv` | This file | `backlink-url/submission-materials/three-sites-fetch-evidence.jsonl` |
| All tailored queue | `backlink-url/submission-materials/three-sites-first-wave-targets.csv` | `backlink-url/submission-materials/three-sites-assisted-submission-runbook.md` | Per-product first-wave CSV files |

## Execution Notes

- The generated plans each queue 20 free runnable targets from the canonical registry.
- The current registry mostly routes real submissions through `assisted` mode because many directories require login, CAPTCHA, OAuth, or manual review.
- Do not run final real submissions until the target page is open, the filled fields are reviewed, and the user explicitly authorizes the final submit action for that site.
- Do not bypass CAPTCHA, Cloudflare, OAuth, 2FA, login, or payment walls.
- Do not reuse identical long descriptions across all directories. Use the per-surface variants in each kit.

## Priority Fixes Before High-Profile Launches

1. Add a public SVG logo for XTimer or expose an existing vector logo URL.
2. Add 5-8 real product screenshots for XTimer and Mobyform.
3. Add 60-90 second demo videos for all three products.
4. Expand XTimer competitor alternative pages beyond StageTimer.
5. Expand VisioArt competitor alternative pages beyond Runway.
6. Confirm review-ready user base before G2/Capterra pushes.
