import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parse, stringify } from 'yaml';
import { DEFAULT_AUTH_DIR, authMetaPath, authProfileStatus, authStatePath } from '../auth/session.js';
import { DEFAULT_REGISTRY_FILE } from './registry.js';
import {
  loadRegistryTargetMap,
  registryBlockerForAuthRow,
} from './auth-registry-filter.js';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';
import { authLoginDomainBlocker } from './auth-login-safety.js';

const AUTH_LOGIN_HEADERS = [
  'order',
  'priority',
  'target_id',
  'name',
  'domain',
  'pricing',
  'risk',
  'auth_profile',
  'auth_state_path',
  'status',
  'login_url',
  'auth_login_command',
  'auth_status_command',
  'auth_scout_command',
  'submit_url',
  'safety_blocker',
  'manual_login_safety_policy',
];

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parseLimit(value, fallback = 25) {
  const parsed = Number.parseInt(value || fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOffset(value, fallback = 0) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseOptionalPositive(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function incrementCount(counts, key) {
  const normalized = String(key || 'unknown');
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function loadProductIdentity(configPath) {
  if (!configPath) return {};
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = raw.trim().startsWith('{') ? JSON.parse(raw) : parse(raw);
    return parsed?.product || {};
  } catch {
    return {};
  }
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function commandQuote(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function commandArg(command = '', flag = '') {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(command || '').match(new RegExp(`${escaped}\\s+(?:"([^"]*)"|'([^']*)'|(\\S+))`));
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function isAuthLoginRow(row = {}) {
  return row.automation_after_human === 'rescout_after_saved_login_profile' ||
    row.manual_bucket === 'manual_login_then_rescout';
}

function loginUrl(row = {}) {
  return cleanUrl(commandArg(row.auth_login_command, '--url') ||
    row.final_url ||
    row.submit_url ||
    row.root_url ||
    '');
}

function loginCommand(row = {}) {
  const profile = row.auth_profile || row.target_id || '';
  const url = loginUrl(row);
  if (!profile || !url) return '';
  return `node src/cli.js auth login --profile ${commandQuote(profile)} --url ${commandQuote(url)}`;
}

function scoutCommand(row = {}) {
  const command = row.auth_scout_command || '';
  if (!command) return '';
  const rawSubmitUrl = row.submit_url || '';
  const rawFinalUrl = row.final_url || '';
  return command
    .replace(rawSubmitUrl, cleanUrl(rawSubmitUrl))
    .replace(rawFinalUrl, cleanUrl(rawFinalUrl));
}

function exclusionReason(row = {}, registryTargetMap = null) {
  if (!String(row.target_id || '').trim()) return 'missing_target_id';
  if (!isAuthLoginRow(row)) return 'not_auth_login_row';
  const registryBlocker = registryBlockerForAuthRow(row, registryTargetMap);
  if (registryBlocker) return registryBlocker;
  if (!String(row.auth_profile || '').trim()) return 'missing_auth_profile';
  if (!loginUrl(row)) return 'missing_login_url';
  const safetyBlocker = authLoginDomainBlocker({
    ...row,
    login_url: loginUrl(row),
    submit_url: cleanUrl(row.submit_url || ''),
  });
  if (safetyBlocker) return safetyBlocker;
  if (!loginCommand(row)) return 'missing_auth_login_command';
  return '';
}

function baseRow(row = {}, status = {}, reason = '') {
  const registryBlocker = reason.startsWith('registry_') ? reason : '';
  const safetyBlocker = reason.startsWith('login_domain_mismatch:') ? reason : '';
  return {
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    submit_url: cleanUrl(row.submit_url || ''),
    priority: row.priority || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    auth_profile: status.profile || row.auth_profile || '',
    auth_state_path: normalizePath(status.path || ''),
    login_url: loginUrl(row),
    auth_login_command: safetyBlocker ? '' : loginCommand(row),
    auth_scout_command: safetyBlocker ? '' : scoutCommand(row),
    safety_blocker: safetyBlocker || registryBlocker,
    registry_blocker: registryBlocker,
    exclusion_reason: reason,
  };
}

function targetRow(row = {}, status = {}, order = 1) {
  const profile = status.profile || row.auth_profile || row.target_id || '';
  return {
    ...baseRow(row, status),
    order,
    status: 'manual_login_required',
    auth_meta_path: normalizePath(status.meta_path || authMetaPath(profile)),
    auth_status_command: `node src/cli.js auth status --profile ${commandQuote(profile)}`,
    manual_login_safety_policy: 'Manual login only. Do not bypass CAPTCHA, 2FA, OAuth consent, Cloudflare, paywalls, or community rules.',
  };
}

function completedRow(row = {}, status = {}) {
  return {
    ...baseRow(row, status, 'auth_profile_already_saved'),
    saved_at: status.updated_at || '',
    size_bytes: status.size_bytes || 0,
  };
}

function summaryFor(sourceRows, loginRows, pendingRows, targets, completed, excluded, opts = {}) {
  const byExclusionReason = {};
  for (const row of excluded) incrementCount(byExclusionReason, row.exclusion_reason);
  const offset = parseOffset(opts.offset, 0);
  const limit = parseLimit(opts.limit, 25);
  const currentBatchStart = targets.length ? offset + 1 : 0;
  const currentBatchEnd = targets.length ? offset + targets.length : 0;

  return {
    source_rows: sourceRows.length,
    auth_login_rows: loginRows,
    pending_rows: pendingRows,
    offset,
    limit,
    current_batch_start: currentBatchStart,
    current_batch_end: currentBatchEnd,
    queued_rows: targets.length,
    remaining_after_batch: Math.max(0, pendingRows - offset - targets.length),
    completed_rows: completed.length,
    excluded_rows: excluded.length,
    auth_profiles_found: completed.length,
    auth_profiles_missing: pendingRows,
    by_exclusion_reason: byExclusionReason,
  };
}

export function buildAuthLoginPlan(queuePath, opts = {}) {
  if (!queuePath) throw new Error('auth login queue path is required');

  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const limit = parseLimit(opts.limit, 25);
  const offset = parseOffset(opts.offset, 0);
  const sourceRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const registryTargetMap = opts.registryFilter ? loadRegistryTargetMap(opts.registry) : null;
  const pending = [];
  const completed = [];
  const excluded = [];
  let loginRows = 0;

  for (const row of sourceRows) {
    if (isAuthLoginRow(row)) loginRows++;
    const reason = exclusionReason(row, registryTargetMap);
    const profile = row.auth_profile || row.target_id || '';
    const status = profile
      ? authProfileStatus(profile, { authDir })
      : {
          profile: '',
          exists: false,
          path: profile ? authStatePath(profile, authDir) : '',
          meta_path: profile ? authMetaPath(profile, authDir) : '',
        };

    if (reason) {
      excluded.push(baseRow(row, status, reason));
      continue;
    }

    if (status.exists) {
      completed.push(completedRow(row, status));
      continue;
    }

    pending.push({ row, status });
  }

  const selected = pending.slice(offset, offset + limit);
  for (const entry of pending.slice(0, offset)) {
    excluded.push(baseRow(entry.row, entry.status, 'before_offset'));
  }
  for (const entry of pending.slice(offset + limit)) {
    excluded.push(baseRow(entry.row, entry.status, 'after_batch_limit'));
  }

  const targets = selected.map((entry, index) => targetRow(entry.row, entry.status, offset + index + 1));

  return {
    version: 1,
    created_at: nowIso(),
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    source_queue: normalizePath(queuePath),
    product: loadProductIdentity(opts.productConfig),
    constraints: {
      purpose: 'manual_auth_login_collection',
      limit,
      offset,
      auth_dir: normalizePath(authDir),
      product_config: opts.productConfig || '',
      no_real_submission: true,
      no_automated_login: true,
      no_captcha_or_2fa_bypass: true,
    },
    targets,
    completed,
    excluded,
    summary: summaryFor(sourceRows, loginRows, pending.length, targets, completed, excluded, { offset, limit }),
  };
}

function authLoginPlanBatchId(index = 0) {
  return `batch-${String(index + 1).padStart(3, '0')}`;
}

export function buildAuthLoginPlanBatches(queuePath, opts = {}) {
  if (!queuePath) throw new Error('auth login queue path is required');

  const batchSize = parseLimit(opts.batchSize ?? opts.limit, 25);
  const maxBatches = parseOptionalPositive(opts.maxBatches ?? opts.batchCount);
  const fullPlan = buildAuthLoginPlan(queuePath, {
    ...opts,
    offset: 0,
    limit: Number.MAX_SAFE_INTEGER,
  });

  const batches = [];
  for (let offset = 0, index = 0; offset < fullPlan.summary.pending_rows; offset += batchSize, index++) {
    if (maxBatches && index >= maxBatches) break;
    const plan = buildAuthLoginPlan(queuePath, {
      ...opts,
      offset,
      limit: batchSize,
    });
    batches.push({
      batch_index: index + 1,
      batch_id: authLoginPlanBatchId(index),
      offset,
      limit: batchSize,
      target_rows: plan.targets.length,
      remaining_after_batch: plan.summary.remaining_after_batch,
      plan,
    });
  }

  const generatedTargetRows = batches.reduce((sum, batch) => sum + batch.target_rows, 0);
  return {
    version: 1,
    created_at: nowIso(),
    registry: fullPlan.registry,
    source_queue: fullPlan.source_queue,
    product: fullPlan.product,
    constraints: {
      ...fullPlan.constraints,
      purpose: 'manual_auth_login_batch_set',
      batch_size: batchSize,
      max_batches: maxBatches || '',
      registry_filter: Boolean(opts.registryFilter),
    },
    summary: {
      source_rows: fullPlan.summary.source_rows,
      auth_login_rows: fullPlan.summary.auth_login_rows,
      pending_rows: fullPlan.summary.pending_rows,
      completed_rows: fullPlan.completed.length,
      excluded_rows: fullPlan.excluded.length,
      auth_profiles_found: fullPlan.summary.auth_profiles_found,
      auth_profiles_missing: fullPlan.summary.auth_profiles_missing,
      by_exclusion_reason: fullPlan.summary.by_exclusion_reason,
      batch_size: batchSize,
      batch_count: batches.length,
      generated_target_rows: generatedTargetRows,
      remaining_unbatched_rows: Math.max(fullPlan.summary.pending_rows - generatedTargetRows, 0),
    },
    batches,
  };
}

export function authLoginPlanCsv(rows = []) {
  return [
    AUTH_LOGIN_HEADERS.join(','),
    ...rows.map(row => AUTH_LOGIN_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

export function writeAuthLoginPlan(plan, opts = {}) {
  const written = {};
  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    const body = opts.output.endsWith('.json')
      ? JSON.stringify(plan, null, 2)
      : stringify(plan);
    writeFileSync(opts.output, `${body.trimEnd()}\n`, 'utf-8');
    written.output = normalizePath(opts.output);
  }
  if (opts.csvOutput) {
    mkdirSync(dirname(opts.csvOutput), { recursive: true });
    writeFileSync(opts.csvOutput, authLoginPlanCsv(plan.targets), 'utf-8');
    written.csv_output = normalizePath(opts.csvOutput);
  }
  return written;
}

function authLoginPlanBatchesSummaryDocument(report = {}, files = {}) {
  return {
    version: report.version,
    created_at: report.created_at,
    registry: report.registry,
    source_queue: report.source_queue,
    product: report.product,
    constraints: report.constraints,
    files,
    summary: report.summary,
  };
}

export function writeAuthLoginPlanBatches(report, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  const namePrefix = opts.namePrefix || 'auth-login-plan-batch';
  const summaryName = opts.summaryName || 'auth-login-plan-batches-summary';
  mkdirSync(outputDir, { recursive: true });

  const batchFiles = [];
  for (const batch of report.batches || []) {
    const suffix = String(batch.batch_index).padStart(3, '0');
    const output = join(outputDir, `${namePrefix}-${suffix}.json`);
    const csvOutput = join(outputDir, `${namePrefix}-${suffix}.csv`);
    const written = writeAuthLoginPlan(batch.plan, { output, csvOutput });
    batchFiles.push({
      batch_index: batch.batch_index,
      batch_id: batch.batch_id,
      target_rows: batch.target_rows,
      remaining_after_batch: batch.remaining_after_batch,
      ...written,
    });
  }

  const summaryPath = join(outputDir, `${summaryName}.json`);
  const files = {
    output_dir: normalizePath(outputDir),
    batches: batchFiles,
    summary: normalizePath(summaryPath),
  };
  writeFileSync(
    summaryPath,
    `${JSON.stringify(authLoginPlanBatchesSummaryDocument(report, files), null, 2)}\n`,
    'utf-8'
  );
  return files;
}
