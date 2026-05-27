import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { parse, stringify } from 'yaml';
import { DEFAULT_AUTH_DIR, authProfileStatus } from '../auth/session.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry } from './registry.js';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
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

function parseLimit(value, fallback = 100) {
  const parsed = Number.parseInt(value || fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function loadRegistryTargetMap(registryPath = '') {
  const path = String(registryPath || '').trim();
  if (!path || !existsSync(path)) return null;
  const registry = loadRegistry(path);
  return new Map(
    (registry.targets || [])
      .map(target => [String(target.id || '').trim(), target])
      .filter(([id]) => id)
  );
}

function isAuthRescoutRow(row = {}) {
  return row.automation_after_human === 'rescout_after_saved_login_profile' ||
    row.manual_bucket === 'manual_login_then_rescout';
}

function exclusionReason(row = {}, status = {}, registryTargetMap = null) {
  if (!String(row.target_id || '').trim()) return 'missing_target_id';
  if (!String(row.submit_url || '').trim()) return 'missing_submit_url';
  if (!isAuthRescoutRow(row)) return 'not_auth_rescout_row';
  if (registryTargetMap) {
    const target = registryTargetMap.get(String(row.target_id || '').trim());
    if (!target) return 'registry_target_missing';
    if (target.submission?.mode !== 'assisted') return `registry_mode_not_assisted:${target.submission?.mode || 'unknown'}`;
  }
  if (!String(row.auth_profile || '').trim()) return 'missing_auth_profile';
  if (!status.exists) return 'auth_profile_missing';
  return '';
}

function excludedRow(row = {}, status = {}, reason = '') {
  return {
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    submit_url: cleanUrl(row.submit_url || ''),
    mode: row.mode || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    manual_bucket: row.manual_bucket || '',
    automation_after_human: row.automation_after_human || '',
    auth_profile: status.profile || row.auth_profile || '',
    auth_state_path: normalizePath(status.path || ''),
    exclusion_reason: reason,
    auth_login_command: cleanCommand(row.auth_login_command || '', row.submit_url, row.final_url),
  };
}

function planTarget(entry, order) {
  const { row, status } = entry;
  return {
    order,
    id: row.target_id,
    name: row.name || '',
    domain: row.domain || '',
    submit_url: cleanUrl(row.submit_url),
    mode: row.mode || 'assisted',
    reason: row.reason || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    status: 'queued',
    auth_profile: status.profile,
    auth_state_path: normalizePath(status.path),
    auth_meta_path: normalizePath(status.meta_path),
    assisted_rank: row.rank || '',
    priority: row.priority || '',
    manual_bucket: row.manual_bucket || '',
    automation_after_human: row.automation_after_human || '',
  };
}

function summaryFor(sourceRows, eligible, targets, excluded) {
  const byExclusionReason = {};
  for (const row of excluded) incrementCount(byExclusionReason, row.exclusion_reason);

  return {
    source_rows: sourceRows.length,
    eligible_rows: eligible.length,
    queued_rows: targets.length,
    excluded_rows: excluded.length,
    auth_profiles_found: eligible.length,
    auth_profiles_missing: byExclusionReason.auth_profile_missing || 0,
    by_exclusion_reason: byExclusionReason,
  };
}

export function buildAuthRescoutPlan(queuePath, opts = {}) {
  if (!queuePath) throw new Error('auth rescout queue path is required');

  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const limit = parseLimit(opts.limit, 100);
  const sourceRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const registryTargetMap = opts.registryFilter
    ? loadRegistryTargetMap(opts.registry || DEFAULT_REGISTRY_FILE)
    : null;
  const eligible = [];
  const excluded = [];

  for (const row of sourceRows) {
    const status = row.auth_profile
      ? authProfileStatus(row.auth_profile, { authDir })
      : { profile: '', exists: false, path: '', meta_path: '' };
    const reason = exclusionReason(row, status, registryTargetMap);
    if (reason) {
      excluded.push(excludedRow(row, status, reason));
      continue;
    }
    eligible.push({ row, status });
  }

  const selected = eligible.slice(0, limit);
  for (const entry of eligible.slice(limit)) {
    excluded.push(excludedRow(entry.row, entry.status, 'over_limit'));
  }

  const targets = selected.map((entry, index) => planTarget(entry, index + 1));

  return {
    version: 1,
    created_at: nowIso(),
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    source_queue: normalizePath(queuePath),
    product: loadProductIdentity(opts.productConfig),
    constraints: {
      purpose: 'auth_rescout_after_saved_login_profile',
      limit,
      auth_dir: normalizePath(authDir),
      product_config: opts.productConfig || '',
      requires_saved_playwright_auth_profile: true,
      no_real_submission: true,
      update_registry_required_for_execution: true,
    },
    targets,
    excluded,
    summary: summaryFor(sourceRows, eligible, targets, excluded),
  };
}

export function writeAuthRescoutPlan(plan, outputPath) {
  if (!outputPath) throw new Error('output path is required');
  mkdirSync(dirname(outputPath), { recursive: true });
  const body = outputPath.endsWith('.json')
    ? JSON.stringify(plan, null, 2)
    : stringify(plan);
  writeFileSync(outputPath, `${body.trimEnd()}\n`, 'utf-8');
  return normalizePath(outputPath);
}
