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
  importTargetsCommand,
  listTargetsCommand,
  normalizeTargetsCommand,
  statsTargetsCommand,
} from './targets/commands.js';
import { buildSubmissionPlan, saveSubmissionPlan } from './planner/plan.js';

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
)
  .action(async (url, opts) => {
    const config = await loadConfig({ ...opts, requireProduct: false });
    if (opts.engine) config._engine = opts.engine;
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
  .command('stats')
  .description('Show canonical registry statistics')
  .option('--registry <path>', 'Canonical registry path')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await statsTargetsCommand(opts);
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
  .command('bb-update')
  .description('Update bb-browser community site adapters')
  .action(() => {
    forceUpdate();
  });

program.parse();
