import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { parse as parseYaml, stringify } from 'yaml';
import { DEFAULT_AUTH_DIR, authMetaPath, authProfileStatus } from '../auth/session.js';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

const AUTH_LOGIN_STATUS_HEADERS = [
  'order',
  'priority',
  'target_id',
  'name',
  'domain',
  'pricing',
  'risk',
  'auth_profile',
  'auth_state_path',
  'auth_meta_path',
  'status',
  'next_action',
  'ready_for_auth_rescout',
  'saved_at',
  'size_bytes',
  'login_url',
  'submit_url',
  'auth_login_command',
  'auth_status_command',
  'auth_scout_command',
];

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
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

function cleanCommand(command = '', ...urls) {
  let cleaned = String(command || '');
  for (const url of urls.filter(Boolean)) {
    cleaned = cleaned.replace(url, cleanUrl(url));
  }
  return cleaned;
}

function incrementCount(counts, key) {
  const normalized = String(key || 'unknown');
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function parseStructuredRows(raw, batchPath) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { sourceType: 'empty', rows: [] };

  if (String(batchPath || '').toLowerCase().endsWith('.csv')) {
    return { sourceType: 'csv', rows: parseCsv(raw) };
  }

  const parsed = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? JSON.parse(trimmed)
    : parseYaml(trimmed);

  if (Array.isArray(parsed)) return { sourceType: 'array', rows: parsed };
  if (Array.isArray(parsed?.targets)) return { sourceType: 'plan_targets', rows: parsed.targets };
  if (Array.isArray(parsed?.rows)) return { sourceType: 'rows', rows: parsed.rows };

  throw new Error('auth login status input must be a CSV, an array, or an object with targets/rows');
}

function rowProfile(row = {}) {
  return row.auth_profile || row.profile || row.target_id || row.id || '';
}

function rowTargetId(row = {}) {
  return row.target_id || row.id || '';
}

function statusForRow(row = {}, status = {}) {
  const profile = rowProfile(row);
  if (!String(profile || '').trim()) return 'blocked_missing_auth_profile';
  return status.exists ? 'auth_profile_saved' : 'manual_login_required';
}

function nextActionForRow(row = {}, status = {}) {
  const profile = rowProfile(row);
  if (!String(profile || '').trim()) return 'fix_batch_auth_profile';
  if (status.exists) {
    return row.auth_scout_command ? 'run_auth_scout_command' : 'regenerate_auth_rescout_plan';
  }
  return row.auth_login_command ? 'run_auth_login_command' : 'manual_login_command_missing';
}

function statusRow(row = {}, index = 0, opts = {}) {
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const profile = rowProfile(row);
  const hasProfile = Boolean(String(profile || '').trim());
  const status = profile
    ? authProfileStatus(profile, { authDir })
    : {
        profile: '',
        exists: false,
        path: '',
        meta_path: '',
        updated_at: '',
        size_bytes: 0,
      };
  const rowStatus = statusForRow(row, status);
  const nextAction = nextActionForRow(row, status);
  const safeProfile = status.profile || profile;

  return {
    order: row.order || String(index + 1),
    priority: row.priority || '',
    target_id: rowTargetId(row),
    name: row.name || '',
    domain: row.domain || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    auth_profile: safeProfile,
    auth_state_path: normalizePath(status.path || row.auth_state_path || ''),
    auth_meta_path: hasProfile ? normalizePath(status.meta_path || authMetaPath(safeProfile, authDir)) : '',
    status: rowStatus,
    next_action: nextAction,
    ready_for_auth_rescout: status.exists ? 'yes' : 'no',
    saved_at: status.updated_at || '',
    size_bytes: status.size_bytes || 0,
    login_url: cleanUrl(row.login_url || ''),
    submit_url: cleanUrl(row.submit_url || ''),
    auth_login_command: cleanCommand(row.auth_login_command || '', row.login_url),
    auth_status_command: row.auth_status_command || (
      safeProfile ? `node src/cli.js auth status --profile ${commandQuote(safeProfile)}` : ''
    ),
    auth_scout_command: cleanCommand(row.auth_scout_command || '', row.submit_url, row.login_url),
  };
}

function summaryFor(rows = []) {
  const byStatus = {};
  const byNextAction = {};
  for (const row of rows) {
    incrementCount(byStatus, row.status);
    incrementCount(byNextAction, row.next_action);
  }

  return {
    source_rows: rows.length,
    auth_profiles_found: byStatus.auth_profile_saved || 0,
    auth_profiles_missing: byStatus.manual_login_required || 0,
    missing_auth_profile_rows: byStatus.blocked_missing_auth_profile || 0,
    ready_for_auth_rescout_rows: rows.filter(row => row.ready_for_auth_rescout === 'yes').length,
    manual_login_rows: rows.filter(row => row.next_action === 'run_auth_login_command').length,
    by_status: byStatus,
    by_next_action: byNextAction,
  };
}

export function buildAuthLoginStatus(batchPath, opts = {}) {
  if (!batchPath) throw new Error('auth login batch path is required');

  const raw = readFileSync(batchPath, 'utf-8');
  const { sourceType, rows } = parseStructuredRows(raw, batchPath);
  const statusRows = rows.map((row, index) => statusRow(row, index, opts));

  return {
    version: 1,
    created_at: nowIso(),
    source_batch: normalizePath(batchPath),
    source_type: sourceType,
    constraints: {
      purpose: 'manual_auth_login_status_check',
      auth_dir: normalizePath(opts.authDir || DEFAULT_AUTH_DIR),
      no_real_submission: true,
      no_browser_launch: true,
      no_network_access_required: true,
    },
    rows: statusRows,
    summary: summaryFor(statusRows),
  };
}

export function authLoginStatusCsv(rows = []) {
  return [
    AUTH_LOGIN_STATUS_HEADERS.join(','),
    ...rows.map(row => AUTH_LOGIN_STATUS_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

export function writeAuthLoginStatus(report, opts = {}) {
  const written = {};
  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    const body = opts.output.endsWith('.json')
      ? JSON.stringify(report, null, 2)
      : stringify(report);
    writeFileSync(opts.output, `${body.trimEnd()}\n`, 'utf-8');
    written.output = normalizePath(opts.output);
  }
  if (opts.csvOutput) {
    mkdirSync(dirname(opts.csvOutput), { recursive: true });
    writeFileSync(opts.csvOutput, authLoginStatusCsv(report.rows), 'utf-8');
    written.csv_output = normalizePath(opts.csvOutput);
  }
  return written;
}
