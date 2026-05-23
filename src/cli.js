#!/usr/bin/env node
// backlink-pilot CLI entry point

import { Command } from 'commander';
import { initConfig, loadConfig } from './config.js';
import { scout } from './scout/discover.js';
import { submit } from './submit.js';
import { generateAwesomeIssue } from './awesome/templates.js';
import { pingIndexNow } from './indexnow.js';
import { showStatus } from './tracker.js';
import { forceUpdate } from './bb-update.js';
import { runCampaign } from './campaign.js';
import {
  applyCrossDomainFinalUrlDecisionsCommand,
  applyCoverageReviewQueueCommand,
  assistedSubmissionPackCommand,
  authLoginNextCommand,
  authLoginOperatorPackCommand,
  authLoginPlanCommand,
  authLoginStatusCommand,
  authRescoutPlanCommand,
  authWorkflowRefreshCommand,
  crossDomainFinalUrlDecisionDraftCommand,
  crossDomainFinalUrlEvidenceCommand,
  crossDomainFinalUrlManualPackCommand,
  coverageReviewDraftCommand,
  coverageReviewEvidenceCommand,
  coverageReviewBatchCommand,
  coverageReviewManualPackCommand,
  coverageReviewSuggestCommand,
  importTargetsCommand,
  auditTargetsCommand,
  coverageReviewQueueCommand,
  coverageTargetsCommand,
  dedupeTargetIdsCommand,
  importCoverageReviewCommand,
  listTargetsCommand,
  normalizeTargetsCommand,
  applyPricingReviewDecisionsCommand,
  pricingReviewDecisionBatchCommand,
  pricingReviewDecisionDraftCommand,
  pricingReviewEvidenceCommand,
  pricingReviewQueueCommand,
  pricingReviewSuggestCommand,
  promoteCoverageReviewBatchCommand,
  statsTargetsCommand,
  validateCrossDomainFinalUrlDecisionsCommand,
  validatePricingReviewDecisionsCommand,
  validateCoverageReviewBatchCommand,
  validateCoverageReviewCommand,
} from './targets/commands.js';
import { buildSubmissionPlan, saveSubmissionPlan } from './planner/plan.js';
import { scoutQueueCommand } from './planner/commands.js';
import { pipelineCommand } from './pipeline/commands.js';
import { runPlan } from './runner/run.js';
import { verifyBacklinkCommand, verifyResultsCommand } from './verification/commands.js';
import { reportCommand } from './report/commands.js';
import { scoutPlan } from './scout/plan.js';
import { readinessCommand } from './readiness/commands.js';
import {
  authClearCommand,
  authListCommand,
  authLoginCommand,
  authStatusCommand,
} from './auth/commands.js';
import { configWithAuthProfile } from './auth/session.js';

const program = new Command();

program
  .name('backlink-pilot')
  .description('Automated backlink submission toolkit for indie hackers')
  .version('2.1.0');

function addConfigOptions(command, { product = false } = {}) {
  command
    .option('--config <path>', 'Config file path')
    .option('--engine <engine>', 'Browser engine: bb or playwright');

  if (product) {
    command
      .option('--product-url <url>', 'Product website URL; auto-generates config when config is missing')
      .option('--product-name <name>', 'Product name')
      .option('--product-description <text>', 'Short product description')
      .option('--product-long-description <text>', 'Long product description')
      .option('--product-email <email>', 'Contact email used in submissions')
      .option('--product-categories <items>', 'Comma-separated product categories')
      .option('--product-features <items>', 'Comma-separated product features')
      .option('--product-pricing <pricing>', 'Pricing label: free, freemium, paid, etc.')
      .option('--product-logo-url <url>', 'Product logo URL')
      .option('--product-github-url <url>', 'Product GitHub URL')
      .option('--product-twitter <handle>', 'Product Twitter/X handle')
      .option('--no-write-config', 'Use product flags for this run without writing config.yaml');
  }

  return command;
}

addConfigOptions(
  program
    .command('init')
    .description('Auto-generate local config from a product URL or product flags')
    .requiredOption('--url <url>', 'Product website URL')
    .option('--force', 'Overwrite existing local config'),
  { product: true }
)
  .action(async (opts) => {
    const { path, config } = await initConfig({
      ...opts,
      productUrl: opts.productUrl || opts.url,
    });
    console.log(`✅ Config generated: ${path}`);
    console.log(`   Product: ${config.product.name}`);
    console.log(`   URL: ${config.product.url}`);
    console.log(`   Browser engine: ${config.browser.engine}`);
  });

addConfigOptions(program
  .command('campaign <productUrl>')
  .description('Submit a product URL to selected backlink targets')
  .option('--limit <n>', 'Number of auto targets to submit to', '3')
  .option('--targets <items>', 'Comma-separated target names or submit URLs')
  .option('--interval <seconds>', 'Delay between real submissions', '90')
  .option('--dry-run', 'Show selected targets without actually submitting'),
  { product: true }
)
  .action(async (productUrl, opts) => {
    await runCampaign(productUrl, opts);
  });

addConfigOptions(program
  .command('scout <url>')
  .description('Discover submit pages and form fields on a site')
  .option('--deep', 'Follow links to find hidden submit pages')
  .option('--screenshot <path>', 'Save screenshot of submit page')
  .option('--target-id <id>', 'Target ID when persisting or updating the canonical registry')
  .option('--auth-profile <name>', 'Saved manual auth profile to use while scouting')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--persist', 'Persist structured scout result to resources/scout-results')
  .option('--scout-dir <path>', 'Directory for persisted scout results')
  .option('--output <path>', 'Write structured scout result to a specific JSON file')
  .option('--update-registry', 'Update canonical registry with the scout classification')
  .option('--registry <path>', 'Canonical registry path for --update-registry')
  .option('--summary', 'Print a YAML scout summary')
  .option('--json', 'Print full structured scout result as JSON')
)
  .action(async (url, opts) => {
    let config = await loadConfig({ ...opts, requireProduct: false });
    if (opts.engine) config._engine = opts.engine;
    if (opts.authProfile) config = configWithAuthProfile(config, opts.authProfile, opts);
    await scout(url, { ...opts, config });
  });

addConfigOptions(program
  .command('submit <site>')
  .description('Submit to a directory site (name or URL for generic)')
  .option('--dry-run', 'Show what would be submitted without actually doing it')
  .option('--screenshot <path>', 'Save screenshot after submission'),
  { product: true }
)
  .action(async (site, opts) => {
    const config = await loadConfig(opts);
    if (opts.engine) config._engine = opts.engine;
    await submit(site, { ...opts, config });
  });

addConfigOptions(program
  .command('awesome <repo>')
  .description('Generate GitHub Issue body for an awesome-list submission')
  .option('--open', 'Open the issue creation page in browser'),
  { product: true }
)
  .action(async (repo, opts) => {
    const config = await loadConfig(opts);
    await generateAwesomeIssue(repo, { ...opts, config });
  });

addConfigOptions(program
  .command('indexnow <url>')
  .description('Ping Bing/Yandex about a new or updated page')
  .option('--key <key>', 'IndexNow API key')
)
  .action(async (url, opts) => {
    const config = await loadConfig({ ...opts, requireProduct: false });
    await pingIndexNow(url, { ...opts, config });
  });

program
  .command('status')
  .description('Show submission tracking status')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await showStatus(opts);
  });

const auth = program
  .command('auth')
  .description('Manage manual browser login sessions for assisted submissions');

auth
  .command('login')
  .description('Open a browser for manual login, then save Playwright storage state')
  .requiredOption('--url <url>', 'Login URL to open')
  .option('--profile <name>', 'Auth profile name', 'default')
  .option('--auth-dir <path>', 'Auth directory')
  .option('--timeout <ms>', 'Navigation timeout in milliseconds')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await authLoginCommand(opts);
  });

auth
  .command('status')
  .description('Show whether an auth profile exists')
  .option('--profile <name>', 'Auth profile name', 'default')
  .option('--auth-dir <path>', 'Auth directory')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    authStatusCommand(opts);
  });

auth
  .command('list')
  .description('List saved auth profiles')
  .option('--auth-dir <path>', 'Auth directory')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    authListCommand(opts);
  });

auth
  .command('clear')
  .description('Delete a saved auth profile')
  .option('--profile <name>', 'Auth profile name', 'default')
  .option('--auth-dir <path>', 'Auth directory')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    authClearCommand(opts);
  });

const targets = program
  .command('targets')
  .description('Manage the canonical backlink target registry');

targets
  .command('import <file>')
  .description('Import targets from YAML, JSON, or CSV into the canonical registry')
  .option('--registry <path>', 'Canonical registry path')
  .option('--source <name>', 'Source label to attach to imported targets')
  .option('--type <type>', 'Default target type when source rows do not provide one')
  .option('--lang <lang>', 'Default language when source rows do not provide one')
  .option('--group <group>', 'Default group when source rows do not provide one')
  .action(async (file, opts) => {
    await importTargetsCommand(file, opts);
  });

targets
  .command('list')
  .description('List targets from the canonical registry')
  .option('--registry <path>', 'Canonical registry path')
  .option('--free', 'Only list free targets')
  .option('--paid', 'Only list paid targets')
  .option('--mode <mode>', 'Filter by submission mode')
  .option('--risk <risk>', 'Filter by risk level')
  .option('--lang <lang>', 'Filter by language')
  .option('--source <name>', 'Filter by source')
  .option('--backlink-status <status>', 'Filter by backlink status: verified, not_found, skipped, failed')
  .option('--verified', 'Only list targets with verified backlinks')
  .option('--not-found', 'Only list targets whose latest backlink check did not find the backlink')
  .option('--has-live-listing', 'Only list targets with a recorded live listing URL')
  .option('--runnable', 'Only list runnable candidates: auto_safe, auto_candidate, assisted')
  .option('--limit <n>', 'Maximum rows to print')
  .option('--json', 'Output full rows as JSON')
  .action(async (opts) => {
    await listTargetsCommand(opts);
  });

targets
  .command('normalize')
  .description('Re-normalize, reclassify, and deduplicate the canonical registry')
  .option('--registry <path>', 'Canonical registry path')
  .action(async (opts) => {
    await normalizeTargetsCommand(opts);
  });

targets
  .command('dedupe-ids')
  .description('Rename duplicate target IDs while preserving existing registry evidence')
  .option('--registry <path>', 'Canonical registry path')
  .action(async (opts) => {
    await dedupeTargetIdsCommand(opts);
  });

targets
  .command('stats')
  .description('Show canonical registry statistics')
  .option('--registry <path>', 'Canonical registry path')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await statsTargetsCommand(opts);
  });

targets
  .command('audit')
  .description('Audit target registry safety before automated execution')
  .option('--registry <path>', 'Canonical registry path')
  .option('--code <items>', 'Only display findings with these comma-separated finding codes')
  .option('--severity <items>', 'Only display findings with these comma-separated severities, e.g. blocker,warning')
  .option('--limit-findings <n>', 'Maximum blockers and warnings to print', '50')
  .option('--fail-on-blockers', 'Exit non-zero when blockers are found')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await auditTargetsCommand(opts);
  });

targets
  .command('assisted-pack')
  .description('Generate a manual assisted-submission pack from assisted and review targets without submitting')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include product identity in the pack')
  .option('--output-dir <path>', 'Directory to write the assisted submission pack')
  .option('--modes <items>', 'Comma-separated target modes to include', 'assisted,needs_review')
  .option('--offset <n>', 'Zero-based offset within the prioritized pack', '0')
  .option('--limit <n>', 'Rows to include in the next work slice', '100')
  .option('--include-paid', 'Include paid/paywalled targets in the pack')
  .option('--include-high-risk', 'Include high-risk targets in the pack')
  .option('--include-submitted', 'Include targets with previous submission evidence')
  .option('--product-context-paths <items>', 'Comma-separated product context paths to check')
  .option('--json', 'Output summary as JSON')
  .action(async (opts) => {
    await assistedSubmissionPackCommand(opts);
  });

targets
  .command('pricing-review-queue')
  .description('Generate a read-only queue of runnable targets whose pricing is unknown')
  .option('--registry <path>', 'Canonical registry path')
  .option('--output-dir <path>', 'Directory to write the pricing review queue')
  .option('--modes <items>', 'Comma-separated runnable modes to include, e.g. assisted,auto_safe')
  .option('--offset <n>', 'Zero-based offset within the prioritized queue', '0')
  .option('--limit <n>', 'Rows to include in this queue slice')
  .option('--json', 'Output summary as JSON')
  .action(async (opts) => {
    await pricingReviewQueueCommand(opts);
  });

targets
  .command('pricing-review-evidence <queue>')
  .description('Collect GET-only HTTP/HTML pricing evidence for a pricing review queue without submitting')
  .option('--output <path>', 'Write evidence CSV')
  .option('--json-output <path>', 'Write full evidence JSON')
  .option('--offset <n>', 'Zero-based offset within evidence URL checks', '0')
  .option('--limit <n>', 'Maximum URL checks to fetch')
  .option('--timeout-ms <n>', 'Per-URL fetch timeout in milliseconds', '15000')
  .option('--user-agent <value>', 'HTTP user-agent for read-only evidence fetches')
  .option('--json', 'Output summary as JSON')
  .action(async (queue, opts) => {
    await pricingReviewEvidenceCommand(queue, opts);
  });

targets
  .command('pricing-review-suggest <queue> <evidence>')
  .description('Create non-binding pricing suggestions from a pricing review queue and read-only evidence')
  .option('--output <path>', 'Write suggestions CSV', 'backlink-url/pricing-review/pricing-review-suggestions.csv')
  .option('--json-output <path>', 'Write suggestions JSON', 'backlink-url/pricing-review/pricing-review-suggestions.json')
  .option('--markdown-output <path>', 'Write suggestions Markdown', 'backlink-url/pricing-review/pricing-review-suggestions.md')
  .option('--json', 'Output summary as JSON')
  .action(async (queue, evidence, opts) => {
    await pricingReviewSuggestCommand(queue, evidence, opts);
  });

targets
  .command('pricing-review-decision-draft <suggestions>')
  .description('Generate an editable pricing review decision draft with blank review_decision rows')
  .option('--output-dir <path>', 'Directory to write the decision draft', 'backlink-url/pricing-review')
  .option('--json', 'Output summary as JSON')
  .action(async (suggestions, opts) => {
    await pricingReviewDecisionDraftCommand(suggestions, opts);
  });

targets
  .command('pricing-review-decision-batch <draft>')
  .description('Create a focused editable batch from a pricing review decision draft')
  .option('--output-dir <path>', 'Directory to write batch files', 'backlink-url/pricing-review/decision-batches')
  .option('--output <path>', 'Write batch CSV')
  .option('--json-output <path>', 'Write batch JSON')
  .option('--markdown-output <path>', 'Write batch Markdown')
  .option('--batch-id <id>', 'Stable batch identifier')
  .option('--offset <n>', 'Zero-based offset within matching draft rows', '0')
  .option('--limit <n>', 'Maximum batch rows', '20')
  .option('--suggested-decision <list>', 'Comma-separated suggested_review_decision filter')
  .option('--confidence <list>', 'Comma-separated suggestion_confidence filter')
  .option('--include-reviewed', 'Include rows that already have review_decision')
  .option('--json', 'Output summary as JSON')
  .action(async (draft, opts) => {
    await pricingReviewDecisionBatchCommand(draft, opts);
  });

targets
  .command('validate-pricing-review-decisions <file>')
  .description('Validate edited pricing review decisions without writing the registry')
  .option('--allow-unreviewed', 'Warn instead of blocking blank review_decision rows')
  .option('--no-require-reviewer', 'Do not require reviewer on reviewed rows')
  .option('--no-require-reviewed-at', 'Do not require reviewed_at on reviewed rows')
  .option('--no-require-review-notes', 'Do not require substantive review notes on reviewed rows')
  .option('--limit-findings <n>', 'Maximum blockers and warnings to print', '20')
  .option('--fail-on-blockers', 'Exit non-zero when blockers are found')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await validatePricingReviewDecisionsCommand(file, opts);
  });

targets
  .command('apply-pricing-review-decisions <file>')
  .description('Preview or explicitly write reviewed pricing decisions to the registry')
  .option('--registry <path>', 'Canonical registry path')
  .option('--write-registry', 'Write reviewed pricing decisions; mark_paid also downgrades target to skip')
  .option('--no-require-reviewer', 'Do not require reviewer on reviewed rows')
  .option('--no-require-reviewed-at', 'Do not require reviewed_at on reviewed rows')
  .option('--no-require-review-notes', 'Do not require substantive review notes on reviewed rows')
  .option('--output <path>', 'Write patch report JSON')
  .option('--preview <n>', 'Maximum proposal rows to print', '10')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await applyPricingReviewDecisionsCommand(file, opts);
  });

targets
  .command('validate-cross-domain-final-url-decisions <file>')
  .description('Validate edited cross-domain final URL decisions without writing the registry')
  .option('--allow-unreviewed', 'Warn instead of blocking blank review_decision rows')
  .option('--no-require-reviewer', 'Do not require reviewer on reviewed rows')
  .option('--no-require-review-notes', 'Do not require substantive review notes on reviewed rows')
  .option('--limit-findings <n>', 'Maximum blockers and warnings to print', '20')
  .option('--fail-on-blockers', 'Exit non-zero when blockers are found')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await validateCrossDomainFinalUrlDecisionsCommand(file, opts);
  });

targets
  .command('apply-cross-domain-final-url-decisions <file>')
  .description('Dry-run a registry patch preview from reviewed cross-domain final URL decisions')
  .option('--registry <path>', 'Canonical registry path')
  .option('--write-registry', 'Write only safe downgrade decisions to the registry; allowlist and replacement decisions remain blocked')
  .option('--no-require-reviewer', 'Do not require reviewer on reviewed rows')
  .option('--no-require-review-notes', 'Do not require substantive review notes on reviewed rows')
  .option('--output <path>', 'Write dry-run patch report JSON')
  .option('--preview <n>', 'Maximum proposal rows to print', '10')
  .option('--limit-findings <n>', 'Maximum blockers to print', '20')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await applyCrossDomainFinalUrlDecisionsCommand(file, opts);
  });

targets
  .command('cross-domain-final-url-evidence <queue>')
  .description('Collect read-only HTTP/HTML evidence for cross-domain final URL review rows without submitting')
  .option('--output <path>', 'Write evidence CSV')
  .option('--json-output <path>', 'Write full evidence JSON')
  .option('--offset <n>', 'Zero-based offset within evidence URL checks', '0')
  .option('--limit <n>', 'Maximum URL checks to fetch')
  .option('--timeout-ms <n>', 'Per-URL fetch timeout in milliseconds', '15000')
  .option('--user-agent <value>', 'HTTP user-agent for read-only evidence fetches')
  .option('--json', 'Output as JSON')
  .action(async (queue, opts) => {
    await crossDomainFinalUrlEvidenceCommand(queue, opts);
  });

targets
  .command('cross-domain-final-url-manual-pack <queue>')
  .description('Generate a manual review pack from cross-domain final URL evidence without approving or writing registry')
  .option('--evidence <path>', 'Read cross-domain final URL evidence CSV')
  .option('--suggestions <path>', 'Read cross-domain final URL suggestions CSV')
  .option('--output-dir <path>', 'Directory to write the manual review pack')
  .option('--json', 'Output summary as JSON')
  .action(async (queue, opts) => {
    await crossDomainFinalUrlManualPackCommand(queue, opts);
  });

targets
  .command('cross-domain-final-url-decision-draft <manualReview>')
  .description('Generate an editable cross-domain decision draft that leaves review_decision blank until human review')
  .option('--output-dir <path>', 'Directory to write the decision draft')
  .option('--json', 'Output summary as JSON')
  .action(async (manualReview, opts) => {
    await crossDomainFinalUrlDecisionDraftCommand(manualReview, opts);
  });

targets
  .command('auth-login-plan <queue>')
  .description('Build a manual login work plan from auth-login-rescout-queue.csv without opening browsers')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include in the plan')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--offset <n>', 'Zero-based offset within missing auth profiles', '0')
  .option('--limit <n>', 'Maximum missing auth profiles to queue', '25')
  .option('--output <path>', 'Write login plan to JSON/YAML')
  .option('--csv-output <path>', 'Write login work queue to CSV')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output full plan as JSON')
  .action(async (queue, opts) => {
    await authLoginPlanCommand(queue, opts);
  });

targets
  .command('auth-login-status <batch>')
  .description('Check saved auth profiles for an auth-login batch without launching browsers')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--output <path>', 'Write status report to JSON/YAML')
  .option('--csv-output <path>', 'Write per-target status rows to CSV')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output full status report as JSON')
  .action(async (batch, opts) => {
    await authLoginStatusCommand(batch, opts);
  });

targets
  .command('auth-login-next <batches...>')
  .description('Select the next manual auth-login tasks from one or more batches without executing them')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--offset <n>', 'Zero-based offset within actionable manual login rows', '0')
  .option('--limit <n>', 'Maximum login tasks to select', '10')
  .option('--output <path>', 'Write task report to JSON/YAML')
  .option('--csv-output <path>', 'Write selected login tasks to CSV')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output full task report as JSON')
  .action(async (batches, opts) => {
    await authLoginNextCommand(batches, opts);
  });

targets
  .command('auth-login-operator-pack <nextLogin>')
  .description('Generate a human-only assisted login runbook and PowerShell helper without executing commands')
  .option('--output-dir <path>', 'Directory to write the operator pack')
  .option('--name <name>', 'Base filename for generated operator pack files', 'auth-login-operator-current')
  .option('--refresh-command <command>', 'Read-only workflow refresh command to print after login collection')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output full operator pack as JSON')
  .action(async (nextLogin, opts) => {
    await authLoginOperatorPackCommand(nextLogin, opts);
  });

targets
  .command('auth-rescout-plan <queue>')
  .description('Build a per-target authenticated scout plan from auth-login-rescout-queue.csv')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include in the plan')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--limit <n>', 'Maximum targets with saved auth profiles to queue', '100')
  .option('--output <path>', 'Write authenticated scout plan to JSON/YAML')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output full plan as JSON')
  .action(async (queue, opts) => {
    await authRescoutPlanCommand(queue, opts);
  });

targets
  .command('auth-workflow-refresh <queue> <batches...>')
  .description('Refresh auth status, next-login tasks, and auth-rescout plan without executing commands')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include in the auth-rescout plan')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--output-dir <path>', 'Directory to write refreshed auth workflow artifacts')
  .option('--next-name <name>', 'Base filename for next-login JSON/CSV outputs', 'auth-login-next-current')
  .option('--summary-name <name>', 'Base filename for workflow summary JSON output', 'auth-workflow-refresh-summary')
  .option('--next-offset <n>', 'Zero-based offset within actionable manual login rows', '0')
  .option('--next-limit <n>', 'Maximum next-login tasks to select', '10')
  .option('--rescout-limit <n>', 'Maximum authenticated rescout targets to queue', '100')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output workflow summary as JSON')
  .action(async (queue, batches, opts) => {
    await authWorkflowRefreshCommand(queue, batches, opts);
  });

targets
  .command('coverage <dir>')
  .description('Compare extracted backlink URL files against the canonical target registry')
  .option('--registry <path>', 'Canonical registry path')
  .option('--output <path>', 'Write full coverage report JSON')
  .option('--candidates <path>', 'Write review candidate CSV')
  .option('--review <path>', 'Write human review CSV for approved-only importing')
  .option('--include-exact', 'Include already-covered exact matches in the review CSV')
  .option('--json', 'Output full report as JSON')
  .action(async (dir, opts) => {
    await coverageTargetsCommand(dir, opts);
  });

targets
  .command('import-coverage-review <file>')
  .description('Import approved coverage review rows as non-executable needs_scout targets')
  .option('--registry <path>', 'Canonical registry path')
  .option('--source <name>', 'Source label for imported targets', 'coverage-review')
  .option('--group <group>', 'Group label for imported targets', 'coverage-review')
  .option('--lang <lang>', 'Default language for imported targets')
  .option('--dry-run', 'Validate and summarize without writing the registry')
  .option('--allow-partial', 'Import safe approved rows even if some approved rows are blocked')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await importCoverageReviewCommand(file, opts);
  });

targets
  .command('validate-coverage-review <file>')
  .description('Validate approved coverage review rows before importing')
  .option('--no-require-reviewer', 'Do not require reviewed_by on approved rows')
  .option('--no-require-review-notes', 'Do not require review_notes on approved rows')
  .option('--limit-findings <n>', 'Maximum blockers and warnings to print', '20')
  .option('--fail-on-blockers', 'Exit non-zero when blockers are found')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await validateCoverageReviewCommand(file, opts);
  });

targets
  .command('coverage-review-queue <file>')
  .description('Prioritize coverage review rows for human approval without importing')
  .option('--output <path>', 'Write prioritized review queue CSV')
  .option('--include-skipped', 'Include rejected/source/already-covered rows in the queue output')
  .option('--limit <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output as JSON')
  .action(async (file, opts) => {
    await coverageReviewQueueCommand(file, opts);
  });

targets
  .command('coverage-review-batch <queue>')
  .description('Create a focused editable batch from a prioritized coverage review queue')
  .option('--output <path>', 'Write batch CSV')
  .option('--markdown <path>', 'Write reviewer instructions as Markdown')
  .option('--priority <items>', 'Comma-separated priority values to include', 'P0')
  .option('--action <items>', 'Comma-separated review_action values to include')
  .option('--offset <n>', 'Zero-based offset within filtered rows', '0')
  .option('--limit <n>', 'Maximum rows in the batch', '25')
  .option('--batch-id <id>', 'Stable batch id to write into the CSV')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output as JSON')
  .action(async (queue, opts) => {
    await coverageReviewBatchCommand(queue, opts);
  });

targets
  .command('validate-coverage-review-batch <batch>')
  .description('Validate an editable coverage review batch before applying it to the source review CSV')
  .option('--no-require-reviewer', 'Do not require reviewed_by on approved rows')
  .option('--no-require-review-notes', 'Do not require review_notes on approved rows')
  .option('--limit-findings <n>', 'Maximum blockers and warnings to print', '20')
  .option('--fail-on-blockers', 'Exit non-zero when blockers are found')
  .option('--json', 'Output as JSON')
  .action(async (batch, opts) => {
    await validateCoverageReviewBatchCommand(batch, opts);
  });

targets
  .command('coverage-review-evidence <batch>')
  .description('Collect read-only HTTP/HTML evidence for a coverage review batch without submitting')
  .option('--output <path>', 'Write evidence CSV')
  .option('--json-output <path>', 'Write full evidence JSON')
  .option('--offset <n>', 'Zero-based offset within the batch', '0')
  .option('--limit <n>', 'Maximum rows to check')
  .option('--timeout-ms <n>', 'Fetch timeout per URL in milliseconds', '15000')
  .option('--user-agent <value>', 'HTTP user-agent for read-only evidence fetches')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output as JSON')
  .action(async (batch, opts) => {
    await coverageReviewEvidenceCommand(batch, opts);
  });

targets
  .command('coverage-review-suggest <batch> <evidence>')
  .description('Create non-binding review suggestions from a batch and read-only evidence')
  .option('--output <path>', 'Write suggestion CSV')
  .option('--json-output <path>', 'Write full suggestion JSON')
  .option('--offset <n>', 'Zero-based offset within the batch', '0')
  .option('--limit <n>', 'Maximum rows to suggest')
  .option('--preview <n>', 'Rows to preview in text output', '10')
  .option('--json', 'Output as JSON')
  .action(async (batch, evidence, opts) => {
    await coverageReviewSuggestCommand(batch, evidence, opts);
  });

targets
  .command('coverage-review-draft <batch> <suggestions>')
  .description('Create an editable rejection-only review batch draft from non-binding suggestions')
  .option('--output <path>', 'Write drafted batch CSV')
  .option('--json-output <path>', 'Write draft report JSON')
  .option('--min-confidence <value>', 'Minimum suggestion confidence to draft', 'high')
  .option('--reviewed-by <value>', 'Reviewer label to record on drafted rejection rows', 'read_only_evidence')
  .option('--decisions <items>', 'Comma-separated rejection decisions eligible for drafting')
  .option('--preview <n>', 'Drafted rows to preview in text output', '10')
  .option('--json', 'Output as JSON')
  .action(async (batch, suggestions, opts) => {
    await coverageReviewDraftCommand(batch, suggestions, opts);
  });

targets
  .command('apply-coverage-review-queue <review> <queue>')
  .description('Apply editable coverage review queue decisions back to a review CSV without importing')
  .option('--output <path>', 'Write the updated review CSV to a new path')
  .option('--in-place', 'Update the review CSV in place')
  .option('--dry-run', 'Validate and summarize without writing')
  .option('--allow-partial', 'Apply safe rows even if some queue rows are blocked')
  .option('--json', 'Output as JSON')
  .action(async (review, queue, opts) => {
    await applyCoverageReviewQueueCommand(review, queue, opts);
  });

targets
  .command('promote-coverage-review-batch <review> <batch>')
  .description('Safely promote an edited coverage review batch into an updated review CSV after validation and import dry-run')
  .option('--registry <path>', 'Canonical registry path')
  .option('--output <path>', 'Write the validated updated review CSV to a new path')
  .option('--report <path>', 'Write a JSON promotion report')
  .option('--dry-run', 'Validate and summarize without writing the output review CSV')
  .option('--allow-partial', 'Allow partial apply for identity blockers; validation blockers still stop promotion')
  .option('--source <name>', 'Source label for import dry-run', 'coverage-review')
  .option('--group <name>', 'Group label for import dry-run', 'coverage-review')
  .option('--lang <lang>', 'Default language for import dry-run')
  .option('--no-require-reviewer', 'Do not require reviewed_by on approved rows')
  .option('--no-require-review-notes', 'Do not require review_notes on approved rows')
  .option('--limit-findings <n>', 'Maximum blocker rows to print', '20')
  .option('--json', 'Output as JSON')
  .action(async (review, batch, opts) => {
    await promoteCoverageReviewBatchCommand(review, batch, opts);
  });

targets
  .command('coverage-review-manual-pack <queue>')
  .description('Generate a manual review pack from the current review queue and prior evidence without approving or importing')
  .option('--batch-dir <path>', 'Directory containing review batch evidence, suggestions, and draft reports')
  .option('--output-dir <path>', 'Directory to write the manual review pack')
  .option('--next-limit <n>', 'Rows to include in the next manual review slice', '100')
  .option('--product-context-paths <items>', 'Comma-separated product context paths to check')
  .option('--json', 'Output as JSON')
  .action(async (queue, opts) => {
    await coverageReviewManualPackCommand(queue, {
      ...opts,
      productContextPaths: opts.productContextPaths,
    });
  });

program
  .command('plan')
  .description('Build a safe submission plan from the canonical target registry')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include in the plan')
  .option('--free-only', 'Only include free targets')
  .option('--allow-unknown-pricing', 'With --free-only, also include targets where pricing has not been verified')
  .option('--mode <mode>', 'Submission mode to include; use runnable for auto_safe/auto_candidate/assisted')
  .option('--lang <lang>', 'Filter by target language')
  .option('--source <name>', 'Filter by source')
  .option('--limit <n>', 'Maximum target count', '30')
  .option('--include-risk', 'Allow high-risk targets in the plan')
  .option('--include-submitted', 'Include targets that already have last_submitted_at evidence')
  .option('--output <path>', 'Write plan to JSON/YAML file')
  .option('--json', 'Print JSON to stdout')
  .action(async (opts) => {
    const plan = buildSubmissionPlan(opts);
    if (opts.output) {
      saveSubmissionPlan(plan, opts.output);
      console.log(`Plan written: ${opts.output}`);
      console.log(`Targets queued: ${plan.targets.length}`);
      console.log(`Excluded: ${plan.excluded.length}`);
      return;
    }
    if (opts.json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    console.log(`Targets queued: ${plan.targets.length}`);
    for (const target of plan.targets) {
      console.log(`${target.order}. ${target.name} — ${target.mode} — ${target.submit_url}`);
    }
    console.log(`Excluded: ${plan.excluded.length}`);
  });

program
  .command('scout-queue')
  .description('Build a plan of unscouted targets that should be scouted before automation')
  .option('--registry <path>', 'Canonical registry path')
  .option('--product-config <path>', 'Product config path to include in the plan')
  .option('--modes <items>', 'Comma-separated modes to scout', 'auto_candidate,needs_scout')
  .option('--free-only', 'Only include free targets')
  .option('--allow-unknown-pricing', 'With --free-only, also include targets where pricing has not been verified')
  .option('--lang <lang>', 'Filter by target language')
  .option('--source <name>', 'Filter by source')
  .option('--limit <n>', 'Maximum target count', '30')
  .option('--include-risk', 'Allow high-risk targets in the scout queue')
  .option('--include-scouted', 'Include targets that already have scout evidence, for explicit retry passes')
  .option('--output <path>', 'Write scout queue plan to JSON/YAML file')
  .option('--json', 'Print JSON to stdout')
  .action(async (opts) => {
    await scoutQueueCommand(opts);
  });

program
  .command('readiness')
  .description('Check whether product config is ready for real directory submissions')
  .option('--config <path>', 'Config file path')
  .option('--product-config <path>', 'Product config path')
  .option('--level <level>', 'Readiness level: automation or launch', 'automation')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await readinessCommand(opts);
  });

program
  .command('run-plan <plan>')
  .description('Run a generated submission plan; defaults to dry-run and only executes auto_safe targets')
  .option('--execute', 'Actually submit targets; without this flag the runner only writes dry-run state')
  .option('--registry <path>', 'Canonical registry path used to verify target mode and submit URL at execution time')
  .option('--state <path>', 'Runner state path')
  .option('--results <path>', 'JSONL results path')
  .option('--artifacts <path>', 'Artifact output directory')
  .option('--limit <n>', 'Maximum targets to process')
  .option('--delay <duration>', 'Delay between executed submissions, e.g. 90s or 2m')
  .option('--retry', 'Retry targets that already reached a terminal state')
  .option('--allow-auto-candidate', 'Allow executing unverified auto_candidate targets')
  .option('--assisted', 'Allow assisted targets to run with human-in-the-loop browser sessions')
  .option('--auth-profile <name>', 'Saved manual auth profile required for assisted targets')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--readiness-level <level>', 'Product readiness level required for --execute: automation or launch', 'automation')
  .option('--skip-readiness-check', 'Skip product readiness gate for a controlled test; result is still audited')
  .option('--skip-target-audit', 'Skip target registry audit for a controlled test; result is still audited')
  .option('--confirm-controlled-test <text>', 'Required confirmation phrase for dangerous execution overrides')
  .option('--config <path>', 'Config file path')
  .option('--product-config <path>', 'Product config path')
  .option('--engine <engine>', 'Browser engine: bb or playwright')
  .action(async (plan, opts) => {
    const summary = await runPlan(plan, opts);
    console.log(`Plan: ${summary.plan}`);
    console.log(`Execute: ${summary.execute}`);
    console.log(`Processed: ${summary.processed}`);
    console.log(`Submitted: ${summary.submitted}`);
    console.log(`Skipped: ${summary.skipped}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`State: ${summary.state}`);
    console.log(`Results: ${summary.results}`);
    console.log(`Artifacts: ${summary.artifacts}`);
    if (summary.readiness) {
      console.log(`Readiness: ${summary.readiness.ok ? 'ok' : 'blocked'} (${summary.readiness.level}${summary.readiness.skipped ? ', skipped' : ''})`);
    }
  });

program
  .command('scout-plan <plan>')
  .description('Scout every target in a generated plan and optionally update the canonical registry')
  .option('--state <path>', 'Scout state path')
  .option('--results <path>', 'JSONL scout results path')
  .option('--limit <n>', 'Maximum targets to scout')
  .option('--delay <duration>', 'Delay between scouts, e.g. 10s or 1m')
  .option('--target-timeout <duration>', 'Maximum time per target, e.g. 120s or 2m')
  .option('--retry', 'Retry targets already marked terminal in the scout state')
  .option('--mode <mode>', 'Only scout targets with this plan mode')
  .option('--no-deep', 'Do not follow submit/add links found on the page')
  .option('--no-persist', 'Do not persist per-target scout JSON files')
  .option('--update-registry', 'Update canonical registry with scout classifications')
  .option('--registry <path>', 'Canonical registry path for --update-registry')
  .option('--scout-dir <path>', 'Directory for persisted scout results')
  .option('--auth-profile <name>', 'Saved manual auth profile to use while scouting')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--config <path>', 'Config file path')
  .option('--product-config <path>', 'Product config path')
  .option('--engine <engine>', 'Browser engine: bb or playwright')
  .action(async (plan, opts) => {
    const summary = await scoutPlan(plan, opts);
    console.log(`Plan: ${summary.plan}`);
    console.log(`Processed: ${summary.processed}`);
    console.log(`Skipped: ${summary.skipped}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`By mode: ${JSON.stringify(summary.by_mode)}`);
    console.log(`State: ${summary.state}`);
    console.log(`Results: ${summary.results}`);
  });

program
  .command('verify-backlink <listingUrl>')
  .description('Verify whether a live listing page links back to the product URL')
  .requiredOption('--product-url <url>', 'Product URL expected on the listing page')
  .option('--timeout <ms>', 'Fetch timeout in milliseconds')
  .option('--json', 'Output as JSON')
  .action(async (listingUrl, opts) => {
    await verifyBacklinkCommand(listingUrl, opts);
  });

program
  .command('verify-results <results>')
  .description('Verify backlinks from a run-plan results.jsonl file')
  .requiredOption('--product-url <url>', 'Product URL expected on listing pages')
  .option('--output <path>', 'Verification JSONL output path')
  .option('--limit <n>', 'Maximum result rows to verify')
  .option('--timeout <ms>', 'Fetch timeout in milliseconds')
  .option('--min-listing-confidence <n>', 'Minimum extracted listing URL confidence to verify', '0.75')
  .option('--update-registry', 'Write verification evidence back to the canonical registry')
  .option('--registry <path>', 'Canonical registry path for --update-registry')
  .option('--json', 'Output summary as JSON')
  .action(async (results, opts) => {
    await verifyResultsCommand(results, opts);
  });

program
  .command('report')
  .description('Summarize run results, backlink verification, and registry evidence')
  .option('--results <path>', 'run-plan results.jsonl path')
  .option('--verification <path>', 'verify-results JSONL path')
  .option('--registry <path>', 'Canonical registry path')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await reportCommand(opts);
  });

program
  .command('pipeline')
  .description('Run a safe batch workflow: plan, optional scout, dry-run or execute, optional verify, report')
  .option('--run-dir <path>', 'Directory for all batch artifacts')
  .option('--registry <path>', 'Canonical registry path')
  .option('--config <path>', 'Config file path')
  .option('--product-config <path>', 'Product config path')
  .option('--product-url <url>', 'Product URL used for verification when config is not embedded in the plan')
  .option('--free-only', 'Only include free targets')
  .option('--allow-unknown-pricing', 'With --free-only, also include targets where pricing has not been verified')
  .option('--mode <mode>', 'Submission mode to include; use runnable for auto_safe/auto_candidate/assisted', 'runnable')
  .option('--lang <lang>', 'Filter by target language')
  .option('--source <name>', 'Filter by source')
  .option('--limit <n>', 'Maximum target count', '10')
  .option('--include-risk', 'Allow high-risk targets in the plan')
  .option('--scout', 'Scout the planned targets before running')
  .option('--scout-queue', 'Build the scout plan from unscouted auto_candidate/needs_scout targets, then refresh the run plan')
  .option('--scout-modes <items>', 'Comma-separated target modes for --scout-queue', 'auto_candidate,needs_scout')
  .option('--scout-delay <duration>', 'Delay between scouts, e.g. 10s or 1m', '10s')
  .option('--include-scouted', 'Include targets that already have scout evidence when building --scout-queue')
  .option('--no-persist', 'Do not persist per-target scout JSON files')
  .option('--execute', 'Actually submit targets; without this flag the pipeline only dry-runs')
  .option('--delay <duration>', 'Delay between run-plan targets, e.g. 90s or 2m')
  .option('--allow-auto-candidate', 'Allow executing unverified auto_candidate targets')
  .option('--assisted', 'Allow assisted targets to run with human-in-the-loop browser sessions')
  .option('--auth-profile <name>', 'Saved manual auth profile required for assisted targets')
  .option('--auth-dir <path>', 'Auth profile directory')
  .option('--readiness-level <level>', 'Product readiness level required for --execute: automation or launch', 'automation')
  .option('--skip-readiness-check', 'Skip product readiness gate for a controlled test; result is still audited')
  .option('--skip-target-audit', 'Skip target registry audit for a controlled test; result is still audited')
  .option('--confirm-controlled-test <text>', 'Required confirmation phrase for dangerous execution overrides')
  .option('--engine <engine>', 'Browser engine: bb or playwright')
  .option('--verify', 'Verify backlinks after execute')
  .option('--min-listing-confidence <n>', 'Minimum extracted listing URL confidence to verify', '0.75')
  .option('--update-registry', 'Write scout and verification evidence back to the canonical registry')
  .option('--json', 'Output summary as JSON')
  .action(async (opts) => {
    await pipelineCommand(opts);
  });

program
  .command('bb-update')
  .description('Update bb-browser community site adapters')
  .action(() => {
    forceUpdate();
  });

program.parse();
