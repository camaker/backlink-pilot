import { mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { stringify } from 'yaml';
import { DEFAULT_AUTH_DIR } from '../auth/session.js';
import {
  buildAuthLoginNext,
  buildAuthLoginStatus,
  writeAuthLoginNext,
  writeAuthLoginStatus,
} from './auth-login-status.js';
import {
  buildAuthRescoutPlan,
  writeAuthRescoutPlan,
} from './auth-rescout-plan.js';
import { DEFAULT_REGISTRY_FILE } from './registry.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parseNonNegative(value, fallback = 0) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositive(value, fallback = 10) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function batchSuffix(batchPath = '', index = 0) {
  const stem = basename(String(batchPath || '')).replace(/\.(csv|json|ya?ml)$/i, '');
  const match = stem.match(/batch[-_]?(\d+)/i);
  if (match) return `batch-${match[1].padStart(3, '0')}`;
  return `batch-${String(index + 1).padStart(3, '0')}`;
}

function publicStatusSummary(report = {}, suffix = '') {
  return {
    suffix,
    source_batch: report.source_batch || '',
    source_type: report.source_type || '',
    source_rows: report.summary?.source_rows || 0,
    auth_profiles_found: report.summary?.auth_profiles_found || 0,
    auth_profiles_missing: report.summary?.auth_profiles_missing || 0,
    ready_for_auth_rescout_rows: report.summary?.ready_for_auth_rescout_rows || 0,
    manual_login_rows: report.summary?.manual_login_rows || 0,
    by_status: report.summary?.by_status || {},
    by_next_action: report.summary?.by_next_action || {},
  };
}

export function buildAuthWorkflowRefresh(queuePath, batchPaths, opts = {}) {
  const batches = Array.isArray(batchPaths) ? batchPaths.filter(Boolean) : [batchPaths].filter(Boolean);
  if (!queuePath) throw new Error('auth workflow refresh queue path is required');
  if (!batches.length) throw new Error('at least one auth login batch or status path is required');

  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const statusReports = batches.map((batchPath, index) => ({
    suffix: batchSuffix(batchPath, index),
    report: buildAuthLoginStatus(batchPath, { authDir }),
  }));
  const next = buildAuthLoginNext(batches, {
    authDir,
    offset: parseNonNegative(opts.nextOffset, 0),
    limit: parsePositive(opts.nextLimit ?? opts.limit, 10),
  });
  const authRescout = buildAuthRescoutPlan(queuePath, {
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    productConfig: opts.productConfig,
    authDir,
    limit: parsePositive(opts.rescoutLimit, 100),
  });

  const statusSummaries = statusReports.map(entry => publicStatusSummary(entry.report, entry.suffix));
  const totalStatus = statusSummaries.reduce((acc, row) => ({
    source_rows: acc.source_rows + row.source_rows,
    auth_profiles_found: acc.auth_profiles_found + row.auth_profiles_found,
    auth_profiles_missing: acc.auth_profiles_missing + row.auth_profiles_missing,
    ready_for_auth_rescout_rows: acc.ready_for_auth_rescout_rows + row.ready_for_auth_rescout_rows,
    manual_login_rows: acc.manual_login_rows + row.manual_login_rows,
  }), {
    source_rows: 0,
    auth_profiles_found: 0,
    auth_profiles_missing: 0,
    ready_for_auth_rescout_rows: 0,
    manual_login_rows: 0,
  });

  return {
    version: 1,
    created_at: nowIso(),
    source_queue: normalizePath(queuePath),
    source_batches: batches.map(normalizePath),
    constraints: {
      purpose: 'refresh_manual_auth_workflow_artifacts',
      auth_dir: normalizePath(authDir),
      no_real_submission: true,
      no_browser_launch: true,
      no_network_access_required: true,
      no_command_execution: true,
      human_must_complete_login: true,
    },
    status_reports: statusReports,
    next_login: next,
    auth_rescout: authRescout,
    summary: {
      status: totalStatus,
      by_batch: statusSummaries,
      next_login: next.summary,
      auth_rescout: authRescout.summary,
    },
  };
}

function summaryDocument(report = {}, files = {}) {
  return {
    version: report.version,
    created_at: report.created_at,
    source_queue: report.source_queue,
    source_batches: report.source_batches,
    constraints: report.constraints,
    files,
    summary: report.summary,
  };
}

export function writeAuthWorkflowRefresh(report, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  const nextName = opts.nextName || 'auth-login-next-current';
  const summaryName = opts.summaryName || 'auth-workflow-refresh-summary';
  mkdirSync(outputDir, { recursive: true });

  const statusReports = [];
  for (const entry of report.status_reports || []) {
    const output = join(outputDir, `auth-login-status-${entry.suffix}.json`);
    const csvOutput = join(outputDir, `auth-login-status-${entry.suffix}.csv`);
    statusReports.push(writeAuthLoginStatus(entry.report, { output, csvOutput }));
  }

  const nextLogin = writeAuthLoginNext(report.next_login, {
    output: join(outputDir, `${nextName}.json`),
    csvOutput: join(outputDir, `${nextName}.csv`),
  });
  const authRescout = normalizePath(writeAuthRescoutPlan(
    report.auth_rescout,
    join(outputDir, 'auth-rescout-plan.json')
  ));
  const summaryPath = join(outputDir, `${summaryName}.json`);

  const files = {
    output_dir: normalizePath(outputDir),
    status_reports: statusReports,
    next_login: nextLogin,
    auth_rescout: authRescout,
    summary: normalizePath(summaryPath),
  };
  writeFileSync(
    summaryPath,
    `${JSON.stringify(summaryDocument(report, files), null, 2)}\n`,
    'utf-8'
  );
  return files;
}

export function authWorkflowRefreshYaml(report, files = {}) {
  return stringify(summaryDocument(report, files));
}
