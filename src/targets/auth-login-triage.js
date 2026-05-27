import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildAuthLoginAudit } from './auth-login-audit.js';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

const TRIAGE_ROW_HEADERS = [
  'triage_order',
  'suggested_pre_login_action',
  'priority',
  'target_id',
  'name',
  'domain',
  'pricing',
  'risk',
  'status',
  'source',
  'submit_url',
  'final_url',
  'audit_flags',
  'safety_blockers',
  'reason',
  'duplicate_group_key',
  'duplicate_group_size',
  'related_target_ids',
  'notes',
];

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function markdownEscape(value = '') {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function countBy(rows = [], key) {
  return rows.reduce((acc, row) => {
    const value = String(row?.[key] || 'unknown');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function actionRank(value = '') {
  switch (String(value || '').trim()) {
    case 'dedupe_same_site_before_login':
      return 0;
    case 'pricing_review_before_login':
      return 1;
    case 'registry_recheck_before_login':
      return 2;
    case 'manual_surface_review_before_login':
      return 3;
    case 'manual_login_then_rescout':
      return 4;
    default:
      return 9;
  }
}

function priorityRank(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'P0') return 0;
  if (normalized === 'P1') return 1;
  if (normalized === 'P2') return 2;
  if (normalized === 'P3') return 3;
  return 9;
}

function triageRow(row = {}, index = 0) {
  return {
    triage_order: String(index + 1),
    suggested_pre_login_action: row.suggested_pre_login_action || '',
    priority: row.priority || '',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    status: row.status || '',
    source: row.source || '',
    submit_url: cleanUrl(row.submit_url || ''),
    final_url: cleanUrl(row.final_url || ''),
    audit_flags: row.audit_flags || '',
    safety_blockers: row.safety_blockers || '',
    reason: row.reason || '',
    duplicate_group_key: row.duplicate_group_key || '',
    duplicate_group_size: row.duplicate_group_size || '',
    related_target_ids: row.related_target_ids || '',
    notes: row.notes || '',
  };
}

function sortRows(rows = []) {
  return [...rows].sort((a, b) =>
    actionRank(a.suggested_pre_login_action) - actionRank(b.suggested_pre_login_action) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.domain.localeCompare(b.domain) ||
    a.target_id.localeCompare(b.target_id)
  );
}

function rowsForAction(rows = [], action = '') {
  return sortRows(rows.filter(row => row.suggested_pre_login_action === action))
    .map((row, index) => triageRow(row, index));
}

function pricingQueueRows(rows = []) {
  return rows.map((row, index) => ({
    queue_order: String(index + 1),
    priority: row.priority || '',
    priority_score: row.priority === 'P0' ? '270' : row.priority === 'P1' ? '240' : '200',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    mode: 'assisted',
    submission_status: row.status || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    lang: 'unknown',
    submit_url: cleanUrl(row.submit_url || ''),
    final_url: cleanUrl(row.final_url || ''),
    last_scouted_at: '',
    auth: row.status === 'auth_required' ? 'yes' : 'unknown',
    captcha: 'unknown',
    form_count: '',
    last_submitted_at: '',
    review_decision: '',
    review_decision_options: 'mark_free | mark_freemium | mark_paid | keep_unknown | needs_manual_check',
    review_notes: '',
    reviewed_by: '',
  }));
}

function queueCsv(headers = [], rows = []) {
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row?.[header])).join(',')),
  ].join('\n') + '\n';
}

function countsTable(counts = {}) {
  const entries = Object.entries(counts);
  if (!entries.length) return '| - | 0 |';
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `| ${markdownEscape(key)} | ${count} |`)
    .join('\n');
}

function rowsTable(rows = []) {
  if (!rows.length) return '| - | - | - | - | - |';
  return rows.map(row => `| ${markdownEscape(row.triage_order)} | ${markdownEscape(row.priority)} | ${markdownEscape(row.target_id)} | ${markdownEscape(row.domain)} | ${markdownEscape(row.audit_flags)} |`).join('\n');
}

function markdownSummary(report = {}, files = {}) {
  return [
    '# Auth Login Triage',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    `Source audit: ${report.source_audit || ''}`,
    '',
    'Policy: read-only triage only. No login, no scout, no submission, no registry writes.',
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary?.rows || 0}`,
    `- Pricing review before login: ${report.summary?.by_suggested_pre_login_action?.pricing_review_before_login || 0}`,
    `- Dedupe before login: ${report.summary?.by_suggested_pre_login_action?.dedupe_same_site_before_login || 0}`,
    `- Registry recheck before login: ${report.summary?.by_suggested_pre_login_action?.registry_recheck_before_login || 0}`,
    `- Manual surface review before login: ${report.summary?.by_suggested_pre_login_action?.manual_surface_review_before_login || 0}`,
    `- Direct manual login rows: ${report.summary?.by_suggested_pre_login_action?.manual_login_then_rescout || 0}`,
    '',
    '### By Action',
    '',
    '| Action | Count |',
    '|---|---:|',
    countsTable(report.summary?.by_suggested_pre_login_action || {}),
    '',
    '## Files',
    '',
    `- Triage CSV: ${files.triage_csv || ''}`,
    `- Pricing review queue CSV: ${files.pricing_review_queue_csv || ''}`,
    `- Dedupe queue CSV: ${files.dedupe_queue_csv || ''}`,
    `- Registry recheck queue CSV: ${files.registry_recheck_queue_csv || ''}`,
    `- Manual surface review queue CSV: ${files.manual_surface_review_queue_csv || ''}`,
    `- Direct login queue CSV: ${files.direct_login_queue_csv || ''}`,
    '',
    '## Safe Next Commands',
    '',
    '```powershell',
    `node src/cli.js targets pricing-review-queue --target-file ${files.pricing_review_queue_csv || 'pricing-review-before-login.csv'} --output-dir backlink-url/auth-triage-pricing`,
    `node src/cli.js targets auth-login-plan ${files.direct_login_queue_csv || 'direct-login-queue.csv'} --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output backlink-url/assisted-submission-pack/auth-login-plan-triaged.json --csv-output backlink-url/assisted-submission-pack/auth-login-plan-triaged.csv`,
    '```',
    '',
    '## Direct Login Rows',
    '',
    '| Order | Priority | Target ID | Domain | Flags |',
    '|---|---|---|---|---|',
    rowsTable(report.queues?.direct_login || []),
    '',
  ].join('\n') + '\n';
}

export function buildAuthLoginTriage(queuePath, opts = {}) {
  if (!queuePath) throw new Error('auth login triage queue path is required');

  const audit = opts.audit || buildAuthLoginAudit(queuePath);
  const pricingReview = rowsForAction(audit.rows, 'pricing_review_before_login');
  const dedupe = rowsForAction(audit.rows, 'dedupe_same_site_before_login');
  const registryRecheck = rowsForAction(audit.rows, 'registry_recheck_before_login');
  const manualSurfaceReview = rowsForAction(audit.rows, 'manual_surface_review_before_login');
  const directLogin = rowsForAction(audit.rows, 'manual_login_then_rescout');
  const triageRows = sortRows(audit.rows).map((row, index) => triageRow(row, index));

  return {
    version: 1,
    created_at: nowIso(),
    source_queue: normalizePath(queuePath),
    source_audit: normalizePath(opts.auditPath || ''),
    constraints: {
      purpose: 'read_only_auth_login_triage',
      no_real_submission: true,
      no_browser_launch: true,
      no_network_access_required: true,
      no_registry_write: true,
    },
    queues: {
      all: triageRows,
      pricing_review: pricingReview,
      dedupe,
      registry_recheck: registryRecheck,
      manual_surface_review: manualSurfaceReview,
      direct_login: directLogin,
    },
    summary: {
      rows: triageRows.length,
      by_suggested_pre_login_action: countBy(triageRows, 'suggested_pre_login_action'),
      by_priority: countBy(triageRows, 'priority'),
      by_source: countBy(triageRows, 'source'),
      pricing_review_rows: pricingReview.length,
      dedupe_rows: dedupe.length,
      registry_recheck_rows: registryRecheck.length,
      manual_surface_review_rows: manualSurfaceReview.length,
      direct_login_rows: directLogin.length,
    },
  };
}

export function writeAuthLoginTriage(report = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  const name = opts.name || 'auth-login-triage';
  mkdirSync(outputDir, { recursive: true });
  const directTargetIds = new Set((report.queues?.direct_login || []).map(row => row.target_id));
  const sourceRaw = readFileSync(report.source_queue, 'utf-8');
  const sourceLines = sourceRaw.trimEnd() ? sourceRaw.trimEnd().split(/\r?\n/) : [];
  const sourceHeader = sourceLines[0] || '';
  const sourceRows = parseCsv(sourceRaw);
  const directRows = sourceRows.filter(row => directTargetIds.has(row.target_id || ''));
  const directHeaders = sourceHeader
    ? sourceHeader.split(',')
    : Object.keys(directRows[0] || {});

  const files = {
    output_dir: normalizePath(outputDir),
    triage_csv: normalizePath(join(outputDir, `${name}.csv`)),
    triage_json: normalizePath(join(outputDir, `${name}.json`)),
    triage_md: normalizePath(join(outputDir, `${name}.md`)),
    pricing_review_queue_csv: normalizePath(join(outputDir, 'auth-login-pricing-review-before-login.csv')),
    dedupe_queue_csv: normalizePath(join(outputDir, 'auth-login-dedupe-before-login.csv')),
    registry_recheck_queue_csv: normalizePath(join(outputDir, 'auth-login-registry-recheck-before-login.csv')),
    manual_surface_review_queue_csv: normalizePath(join(outputDir, 'auth-login-manual-surface-review-before-login.csv')),
    direct_login_queue_csv: normalizePath(join(outputDir, 'auth-login-direct-login-queue.csv')),
  };

  writeFileSync(files.triage_csv, queueCsv(TRIAGE_ROW_HEADERS, report.queues?.all || []), 'utf-8');
  writeFileSync(files.pricing_review_queue_csv, queueCsv([
    'queue_order',
    'priority',
    'priority_score',
    'target_id',
    'name',
    'domain',
    'mode',
    'submission_status',
    'pricing',
    'risk',
    'lang',
    'submit_url',
    'final_url',
    'last_scouted_at',
    'auth',
    'captcha',
    'form_count',
    'last_submitted_at',
    'review_decision',
    'review_decision_options',
    'review_notes',
    'reviewed_by',
  ], pricingQueueRows(report.queues?.pricing_review || [])), 'utf-8');
  writeFileSync(files.dedupe_queue_csv, queueCsv(TRIAGE_ROW_HEADERS, report.queues?.dedupe || []), 'utf-8');
  writeFileSync(files.registry_recheck_queue_csv, queueCsv(TRIAGE_ROW_HEADERS, report.queues?.registry_recheck || []), 'utf-8');
  writeFileSync(files.manual_surface_review_queue_csv, queueCsv(TRIAGE_ROW_HEADERS, report.queues?.manual_surface_review || []), 'utf-8');
  writeFileSync(files.direct_login_queue_csv, queueCsv(directHeaders, directRows), 'utf-8');

  writeFileSync(files.triage_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.triage_md, markdownSummary(report, files), 'utf-8');
  return files;
}
