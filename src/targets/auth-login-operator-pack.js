import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { parseCsv } from './importers/csv.js';
import { authLoginDomainBlocker } from './auth-login-safety.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function incrementCount(counts, key) {
  const normalized = String(key || 'unknown');
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function psSingle(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function parseStructuredTasks(raw, inputPath = '') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { source_type: 'empty', tasks: [] };

  if (String(inputPath || '').toLowerCase().endsWith('.csv')) {
    return { source_type: 'csv', tasks: parseCsv(raw) };
  }

  const parsed = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? JSON.parse(trimmed)
    : parseYaml(trimmed);

  if (Array.isArray(parsed)) return { source_type: 'array', tasks: parsed };
  if (Array.isArray(parsed?.tasks)) return { source_type: 'tasks', tasks: parsed.tasks };
  if (Array.isArray(parsed?.rows)) return { source_type: 'rows', tasks: parsed.rows };

  throw new Error('auth login operator pack input must be a CSV, an array, or an object with tasks/rows');
}

function normalizeTask(row = {}, index = 0) {
  const targetId = row.target_id || row.id || '';
  const authProfile = row.auth_profile || row.profile || targetId;
  const loginUrl = row.login_url || '';
  const domainBlocker = authLoginDomainBlocker({ ...row, login_url: loginUrl });
  const blocker = !authProfile || !loginUrl
    ? 'missing_auth_profile_or_login_url'
    : domainBlocker;
  const manualLoginCommand = !blocker && authProfile && loginUrl
    ? `node src/cli.js auth login --profile "${authProfile}" --url "${loginUrl}"`
    : '';
  const statusCommand = !blocker && authProfile
    ? `node src/cli.js auth status --profile "${authProfile}"`
    : '';
  return {
    task_order: String(row.task_order || row.order || index + 1),
    source_batch: normalizePath(row.source_batch || ''),
    batch_order: String(row.batch_order || row.order || ''),
    priority: row.priority || '',
    target_id: targetId,
    name: row.name || '',
    domain: row.domain || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    auth_profile: authProfile,
    status: row.status || '',
    login_url: loginUrl,
    submit_url: row.submit_url || '',
    auth_state_path: normalizePath(row.auth_state_path || ''),
    auth_meta_path: normalizePath(row.auth_meta_path || ''),
    manual_login_command: manualLoginCommand,
    status_command: statusCommand,
    blocker,
  };
}

function summaryFor(tasks = []) {
  const byPriority = {};
  const byPricing = {};
  const byRisk = {};
  const byBlocker = {};
  for (const task of tasks) {
    incrementCount(byPriority, task.priority);
    incrementCount(byPricing, task.pricing);
    incrementCount(byRisk, task.risk);
    if (task.blocker) incrementCount(byBlocker, task.blocker);
  }

  return {
    task_rows: tasks.length,
    runnable_manual_login_rows: tasks.filter(task => !task.blocker).length,
    blocked_rows: tasks.filter(task => task.blocker).length,
    by_priority: byPriority,
    by_pricing: byPricing,
    by_risk: byRisk,
    by_blocker: byBlocker,
  };
}

function defaultRefreshCommand() {
  return [
    'node src/cli.js targets auth-workflow-refresh',
    'backlink-url/assisted-submission-pack/resolved-auth-login/auth-login-resolved-direct-login-queue.csv',
    'backlink-url/assisted-submission-pack/resolved-direct-login/auth-login-plan-batch-resolved-001.json',
    'backlink-url/assisted-submission-pack/resolved-direct-login/auth-login-plan-batch-resolved-002.json',
    '--registry resources/targets.canonical.yaml',
    '--auth-dir playwright/.auth',
    '--output-dir backlink-url/assisted-submission-pack/resolved-direct-login',
    '--next-name auth-login-next-resolved-current',
    '--summary-name auth-workflow-refresh-resolved-summary',
    '--next-limit 10',
    '--rescout-limit 100',
  ].join(' ');
}

export function buildAuthLoginOperatorPack(inputPath, opts = {}) {
  if (!inputPath) throw new Error('auth login operator pack input path is required');

  const raw = readFileSync(inputPath, 'utf-8');
  const parsed = parseStructuredTasks(raw, inputPath);
  const tasks = parsed.tasks.map((row, index) => normalizeTask(row, index));
  const refreshCommand = opts.refreshCommand === false
    ? ''
    : (opts.refreshCommand || defaultRefreshCommand());

  return {
    version: 1,
    created_at: nowIso(),
    source: normalizePath(inputPath),
    source_type: parsed.source_type,
    constraints: {
      purpose: 'manual_auth_login_operator_pack',
      generation_no_real_submission: true,
      generation_no_browser_launch: true,
      generation_no_network_access_required: true,
      generation_no_command_execution: true,
      generated_script_requires_human_confirmation_per_target: true,
      generated_script_may_launch_visible_browser_for_manual_login: true,
      generated_script_no_submit_command: true,
      generated_script_no_scout_command: true,
      generated_script_no_run_plan_execute: true,
      generated_script_no_payment: true,
    },
    refresh_command: refreshCommand,
    tasks,
    summary: summaryFor(tasks),
  };
}

export function authLoginOperatorMarkdown(pack = {}) {
  const tasks = pack.tasks || [];
  const lines = [
    '# Auth Login Operator Pack',
    '',
    `Generated: ${pack.created_at || ''}`,
    `Source: ${pack.source || ''}`,
    '',
    '## Safety Policy',
    '',
    '- Human-only login collection.',
    '- Do not bypass CAPTCHA, Cloudflare, OAuth, 2FA, payment, or moderator review.',
    '- Do not submit products from this pack.',
    '- Do not run scout or run-plan from this pack.',
    '- Stop on any paid-only flow, unclear ownership, file upload requirement, reciprocal-link demand, or legal/ToS ambiguity.',
    '',
    '## Summary',
    '',
    `- Tasks: ${pack.summary?.task_rows || 0}`,
    `- Runnable manual login rows: ${pack.summary?.runnable_manual_login_rows || 0}`,
    `- Blocked rows: ${pack.summary?.blocked_rows || 0}`,
    '',
    '## Operating Sequence',
    '',
    '1. Run one login task at a time in a normal terminal.',
    '2. Complete only the normal manual login in the visible browser.',
    '3. Press Enter in the terminal only after the login state is visibly complete.',
    '4. Run the matching auth status command.',
    '5. After the batch, refresh the workflow and review whether any targets enter authenticated rescout.',
    '',
    '## Tasks',
    '',
    '| # | Priority | Target | Domain | Pricing | Risk | Login URL | Profile | Commands |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  for (const task of tasks) {
    const commands = task.blocker
      ? `Blocked: ${task.blocker}`
      : [
          `Login: \`${task.manual_login_command}\``,
          `Status: \`${task.status_command}\``,
        ].join('<br>');
    lines.push([
      task.task_order,
      task.priority,
      task.target_id || task.name,
      task.domain,
      task.pricing,
      task.risk,
      task.login_url,
      task.auth_profile,
      commands,
    ].map(mdEscape).join('|').replace(/^/, '|').replace(/$/, '|'));
  }

  if (pack.refresh_command) {
    lines.push(
      '',
      '## Refresh Command',
      '',
      'Run this after completing manual login tasks:',
      '',
      '```bash',
      pack.refresh_command,
      '```'
    );
  }

  return `${lines.join('\n')}\n`;
}

export function authLoginOperatorPowerShell(pack = {}) {
  const lines = [
    '# Generated by Backlink Pilot. Human-only assisted login helper.',
    '# This script does not submit products, run scout, run run-plan, pay, or bypass challenges.',
    'param(',
    '  [switch]$DryRun',
    ')',
    '$ErrorActionPreference = "Stop"',
    '',
    'function Invoke-ManualLogin {',
    '  param(',
    '    [string]$Order,',
    '    [string]$TargetId,',
    '    [string]$Name,',
    '    [string]$Domain,',
    '    [string]$Profile,',
    '    [string]$LoginUrl',
    '  )',
    '  Write-Host ""',
    '  Write-Host "[$Order] $TargetId $Domain" -ForegroundColor Cyan',
    '  Write-Host "Profile: $Profile"',
    '  Write-Host "Login URL: $LoginUrl"',
    '  Write-Host "Safety: human login only; no payment; no CAPTCHA/Cloudflare bypass; no submission." -ForegroundColor Yellow',
    '  $answer = Read-Host "Type LOGIN to open manual login browser, SKIP to skip"',
    '  if ($answer -ne "LOGIN") {',
    '    Write-Host "Skipped $TargetId"',
    '    return',
    '  }',
    '  if ($DryRun) {',
    '    Write-Host "DRY RUN: node src/cli.js auth login --profile $Profile --url $LoginUrl"',
    '    Write-Host "DRY RUN: node src/cli.js auth status --profile $Profile"',
    '    return',
    '  }',
    '  & node src/cli.js auth login --profile $Profile --url $LoginUrl',
    '  if ($LASTEXITCODE -ne 0) { throw "auth login failed for $TargetId" }',
    '  & node src/cli.js auth status --profile $Profile',
    '  if ($LASTEXITCODE -ne 0) { throw "auth status failed for $TargetId" }',
    '}',
    '',
    'Write-Host "Backlink Pilot assisted login operator pack" -ForegroundColor Green',
    'Write-Host "No real submission will be performed by this script." -ForegroundColor Yellow',
  ];

  for (const task of pack.tasks || []) {
    if (task.blocker) {
      lines.push(`Write-Host ${psSingle(`Blocked ${task.target_id || task.task_order}: ${task.blocker}`)} -ForegroundColor Red`);
      continue;
    }
    lines.push([
      'Invoke-ManualLogin',
      `-Order ${psSingle(task.task_order)}`,
      `-TargetId ${psSingle(task.target_id)}`,
      `-Name ${psSingle(task.name)}`,
      `-Domain ${psSingle(task.domain)}`,
      `-Profile ${psSingle(task.auth_profile)}`,
      `-LoginUrl ${psSingle(task.login_url)}`,
    ].join(' '));
  }

  if (pack.refresh_command) {
    lines.push(
      '',
      'Write-Host ""',
      'Write-Host "After completing logins, run this read-only refresh command:" -ForegroundColor Green',
      `Write-Host ${psSingle(pack.refresh_command)}`
    );
  }

  return `${lines.join('\n')}\n`;
}

function summaryDocument(pack = {}, files = {}) {
  return {
    version: pack.version,
    created_at: pack.created_at,
    source: pack.source,
    source_type: pack.source_type,
    constraints: pack.constraints,
    refresh_command: pack.refresh_command,
    files,
    summary: pack.summary,
    tasks: pack.tasks,
  };
}

export function writeAuthLoginOperatorPack(pack, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  const name = opts.name || 'auth-login-operator-current';
  mkdirSync(outputDir, { recursive: true });

  const files = {
    output_dir: normalizePath(outputDir),
    markdown: normalizePath(join(outputDir, `${name}.md`)),
    powershell: normalizePath(join(outputDir, `${name}.ps1`)),
    summary: normalizePath(join(outputDir, `${name}.json`)),
  };

  writeFileSync(files.markdown, authLoginOperatorMarkdown(pack), 'utf-8');
  writeFileSync(files.powershell, authLoginOperatorPowerShell(pack), 'utf-8');
  writeFileSync(
    files.summary,
    `${JSON.stringify(summaryDocument(pack, files), null, 2)}\n`,
    'utf-8'
  );

  return files;
}
