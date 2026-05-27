import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

const KEEP_AUTH_RESOLUTIONS = new Set([
  'keep_primary_auth_candidate',
  'keep_in_auth_queue',
  'keep_in_auth_queue_after_surface_review',
]);

const NEEDS_SCOUT_RESOLUTIONS = new Set([
  'move_out_of_auth_to_needs_scout',
]);

const MANUAL_REVIEW_RESOLUTIONS = new Set([
  'move_out_of_auth_to_manual_surface_review',
  'manual_surface_review_required_continue',
  'keep_manual_surface_review',
  'manual_dedupe_review_required',
  'manual_registry_recheck_required',
]);

const DROP_RESOLUTIONS = new Set([
  'drop_duplicate_before_login',
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function csvEscape(value = '') {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function markdownEscape(value = '') {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function queueCsv(headers = [], rows = []) {
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row?.[header])).join(',')),
  ].join('\n') + '\n';
}

function countBy(rows = [], keyOrFn) {
  return rows.reduce((acc, row) => {
    const key = typeof keyOrFn === 'function'
      ? keyOrFn(row)
      : row?.[keyOrFn];
    const normalized = String(key || 'unknown');
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {});
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function parseSourceCsv(sourceQueuePath) {
  const raw = readFileSync(sourceQueuePath, 'utf-8');
  const rows = parseCsv(raw);
  const sourceLines = raw.trimEnd() ? raw.trimEnd().split(/\r?\n/) : [];
  const headers = sourceLines[0]
    ? sourceLines[0].split(',')
    : Object.keys(rows[0] || {});
  return { headers, rows };
}

function ensureUniqueTargetIds(rows = [], label = 'rows') {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const targetId = String(row?.target_id || '').trim();
    if (!targetId) continue;
    if (seen.has(targetId)) duplicates.add(targetId);
    seen.add(targetId);
  }
  if (duplicates.size > 0) {
    throw new Error(`duplicate target ids in ${label}: ${[...duplicates].join(', ')}`);
  }
}

function resolutionLane(value = '') {
  const normalized = String(value || '').trim();
  if (KEEP_AUTH_RESOLUTIONS.has(normalized)) return 'direct_login';
  if (NEEDS_SCOUT_RESOLUTIONS.has(normalized)) return 'needs_scout';
  if (MANUAL_REVIEW_RESOLUTIONS.has(normalized)) return 'manual_review';
  if (DROP_RESOLUTIONS.has(normalized)) return 'dropped';
  throw new Error(`unsupported residual resolution: ${normalized || '(blank)'}`);
}

function sourceRowIndex(rows = []) {
  const index = new Map();
  for (const row of rows) {
    const targetId = String(row?.target_id || '').trim();
    if (!targetId) continue;
    if (index.has(targetId)) {
      throw new Error(`duplicate target id in source queue: ${targetId}`);
    }
    index.set(targetId, row);
  }
  return index;
}

function collectTargetIds(rows = []) {
  return rows
    .map(row => String(row?.target_id || '').trim())
    .filter(Boolean);
}

function ensureSourceRowsExist(targetIds = [], sourceIndex = new Map(), label = 'target ids') {
  const missing = [...new Set(targetIds)].filter(targetId => !sourceIndex.has(targetId));
  if (missing.length > 0) {
    throw new Error(`missing source queue rows for ${label}: ${missing.join(', ')}`);
  }
}

function normalizeResidualDecision(row = {}) {
  return {
    review_type: row.review_type || '',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    status: row.status || '',
    submit_url: cleanUrl(row.submit_url || ''),
    suggested_resolution: row.suggested_resolution || '',
    resolution_bucket: row.resolution_bucket || '',
    lane: resolutionLane(row.suggested_resolution),
    notes: row.notes || '',
  };
}

function filterRowsByIds(rows = [], ids = new Set()) {
  return rows.filter(row => ids.has(String(row?.target_id || '').trim()));
}

function summaryMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Residual Resolve',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source triage: ${report.source_triage || ''}`,
    `Source residual: ${report.source_residual || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    '',
    'Policy: read-only queue resolution only. No login, no submission, no registry writes, no browser launch.',
    '',
    '## Summary',
    '',
    `- Triage direct-login rows: ${report.summary?.triage_direct_login_rows || 0}`,
    `- Residual keep-auth rows added back: ${report.summary?.residual_keep_auth_rows || 0}`,
    `- Resolved direct-login rows: ${report.summary?.resolved_direct_login_rows || 0}`,
    `- Resolved needs-scout rows: ${report.summary?.resolved_needs_scout_rows || 0}`,
    `- Resolved manual-review rows: ${report.summary?.resolved_manual_review_rows || 0}`,
    `- Dropped duplicate rows: ${report.summary?.resolved_dropped_rows || 0}`,
    `- Still unresolved manual-review rows: ${report.summary?.unresolved_manual_review_rows || 0}`,
    '',
    '## Residual Decisions',
    '',
    '| Target | Review Type | Resolution | Lane | Notes |',
    '|---|---|---|---|---|',
    ...(report.decisions || []).map(row => `| ${markdownEscape(row.target_id)} | ${markdownEscape(row.review_type)} | ${markdownEscape(row.suggested_resolution)} | ${markdownEscape(row.lane)} | ${markdownEscape(row.notes)} |`),
    '',
    '## Files',
    '',
    `- Summary JSON: ${files.summary_json || ''}`,
    `- Summary Markdown: ${files.summary_md || ''}`,
    `- Resolved direct-login queue CSV: ${files.direct_login_queue_csv || ''}`,
    `- Needs-scout queue CSV: ${files.needs_scout_queue_csv || ''}`,
    `- Manual-review queue CSV: ${files.manual_review_queue_csv || ''}`,
    `- Dropped queue CSV: ${files.dropped_queue_csv || ''}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function buildAuthResidualResolve(triagePath, residualPath) {
  if (!triagePath) throw new Error('auth residual resolve triage path is required');
  if (!residualPath) throw new Error('auth residual resolve residual path is required');

  const triage = readJsonFile(triagePath);
  const residual = readJsonFile(residualPath);
  const normalizedTriagePath = normalizePath(triagePath);
  const normalizedResidualPath = normalizePath(residualPath);
  const triageSourceQueue = normalizePath(triage.source_queue || '');
  const residualSourceTriage = normalizePath(residual.source_triage || '');
  const residualSourceQueue = normalizePath(residual.source_queue || '');

  if (residualSourceTriage && residualSourceTriage !== normalizedTriagePath) {
    throw new Error(`residual source triage mismatch: expected ${normalizedTriagePath}, got ${residualSourceTriage}`);
  }
  if (triageSourceQueue && residualSourceQueue && triageSourceQueue !== residualSourceQueue) {
    throw new Error(`triage/residual source queue mismatch: ${triageSourceQueue} != ${residualSourceQueue}`);
  }

  const sourceQueuePath = triage.source_queue || residual.source_queue;
  if (!sourceQueuePath) throw new Error('auth residual resolve source queue path is missing');

  const { headers, rows: sourceRows } = parseSourceCsv(sourceQueuePath);
  ensureUniqueTargetIds(sourceRows, 'source queue');
  const sourceIndex = sourceRowIndex(sourceRows);

  const triageDirectLoginRows = triage.queues?.direct_login || [];
  ensureUniqueTargetIds(triageDirectLoginRows, 'triage direct-login queue');
  const triageDirectLoginIds = collectTargetIds(triageDirectLoginRows);
  ensureSourceRowsExist(triageDirectLoginIds, sourceIndex, 'triage direct-login rows');

  const decisions = (residual.rows || []).map(normalizeResidualDecision);
  ensureUniqueTargetIds(decisions, 'residual decisions');
  const residualTargetIds = collectTargetIds(decisions);
  ensureSourceRowsExist(residualTargetIds, sourceIndex, 'residual decision rows');

  const overlap = triageDirectLoginIds.filter(targetId => residualTargetIds.includes(targetId));
  if (overlap.length > 0) {
    throw new Error(`triage direct-login rows overlap with residual decisions: ${overlap.join(', ')}`);
  }

  const resolvedDirectLoginIds = new Set(triageDirectLoginIds);
  const needsScoutIds = new Set();
  const manualReviewIds = new Set();
  const droppedIds = new Set();

  for (const decision of decisions) {
    switch (decision.lane) {
      case 'direct_login':
        resolvedDirectLoginIds.add(decision.target_id);
        break;
      case 'needs_scout':
        needsScoutIds.add(decision.target_id);
        break;
      case 'manual_review':
        manualReviewIds.add(decision.target_id);
        break;
      case 'dropped':
        droppedIds.add(decision.target_id);
        break;
      default:
        throw new Error(`unsupported residual decision lane: ${decision.lane}`);
    }
  }

  const resolvedDirectLoginRows = filterRowsByIds(sourceRows, resolvedDirectLoginIds);
  const resolvedNeedsScoutRows = filterRowsByIds(sourceRows, needsScoutIds);
  const resolvedManualReviewRows = filterRowsByIds(sourceRows, manualReviewIds);
  const resolvedDroppedRows = filterRowsByIds(sourceRows, droppedIds);

  return {
    version: 1,
    created_at: nowIso(),
    source_triage: normalizedTriagePath,
    source_residual: normalizedResidualPath,
    source_queue: normalizePath(sourceQueuePath),
    source_headers: headers,
    constraints: {
      purpose: 'read_only_auth_residual_resolution',
      no_real_submission: true,
      no_browser_launch: true,
      no_registry_write: true,
      no_in_place_queue_mutation: true,
    },
    decisions,
    queues: {
      direct_login: resolvedDirectLoginRows,
      needs_scout: resolvedNeedsScoutRows,
      manual_review: resolvedManualReviewRows,
      dropped: resolvedDroppedRows,
    },
    summary: {
      source_queue_rows: sourceRows.length,
      triage_direct_login_rows: triageDirectLoginIds.length,
      residual_rows: decisions.length,
      residual_keep_auth_rows: decisions.filter(row => row.lane === 'direct_login').length,
      residual_needs_scout_rows: decisions.filter(row => row.lane === 'needs_scout').length,
      residual_manual_review_rows: decisions.filter(row => row.lane === 'manual_review').length,
      residual_drop_rows: decisions.filter(row => row.lane === 'dropped').length,
      resolved_direct_login_rows: resolvedDirectLoginRows.length,
      resolved_needs_scout_rows: resolvedNeedsScoutRows.length,
      resolved_manual_review_rows: resolvedManualReviewRows.length,
      resolved_dropped_rows: resolvedDroppedRows.length,
      unresolved_manual_review_rows: decisions.filter(row => row.resolution_bucket === 'needs_manual_review').length,
      direct_login_delta_vs_triage: resolvedDirectLoginRows.length - triageDirectLoginIds.length,
      by_review_type: countBy(decisions, 'review_type'),
      by_suggested_resolution: countBy(decisions, 'suggested_resolution'),
      by_lane: countBy(decisions, 'lane'),
    },
  };
}

export function writeAuthResidualResolve(report = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack/resolved-auth-login';
  const name = opts.name || 'auth-residual-resolve';
  mkdirSync(outputDir, { recursive: true });

  const files = {
    output_dir: normalizePath(outputDir),
    summary_json: normalizePath(join(outputDir, `${name}.json`)),
    summary_md: normalizePath(join(outputDir, `${name}.md`)),
    direct_login_queue_csv: normalizePath(join(outputDir, 'auth-login-resolved-direct-login-queue.csv')),
    needs_scout_queue_csv: normalizePath(join(outputDir, 'auth-login-resolved-needs-scout.csv')),
    manual_review_queue_csv: normalizePath(join(outputDir, 'auth-login-resolved-manual-review.csv')),
    dropped_queue_csv: normalizePath(join(outputDir, 'auth-login-resolved-dropped.csv')),
  };

  writeFileSync(files.direct_login_queue_csv, queueCsv(report.source_headers || [], report.queues?.direct_login || []), 'utf-8');
  writeFileSync(files.needs_scout_queue_csv, queueCsv(report.source_headers || [], report.queues?.needs_scout || []), 'utf-8');
  writeFileSync(files.manual_review_queue_csv, queueCsv(report.source_headers || [], report.queues?.manual_review || []), 'utf-8');
  writeFileSync(files.dropped_queue_csv, queueCsv(report.source_headers || [], report.queues?.dropped || []), 'utf-8');
  writeFileSync(files.summary_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.summary_md, summaryMarkdown(report, files), 'utf-8');

  return files;
}
