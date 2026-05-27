import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

const AUTH_LOGIN_AUDIT_HEADERS = [
  'audit_order',
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
  'safety_blockers',
  'reason',
  'audit_flags',
  'suggested_pre_login_action',
  'duplicate_group_key',
  'duplicate_group_size',
  'related_target_ids',
  'notes',
];

const SHARED_FORM_HOSTS = new Set([
  'forms.gle',
  'docs.google.com',
  'airtable.com',
  'tally.so',
  'typeform.com',
  'form.typeform.com',
  'jinshuju.net',
  'wj.qq.com',
]);

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

function incrementCount(counts, key) {
  const normalized = String(key || 'unknown');
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function splitSignals(value = '') {
  return String(value || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);
}

function hasSignal(row = {}, token = '') {
  const values = [
    ...splitSignals(row.safety_blockers),
    ...splitSignals(row.reason),
  ];
  return values.some(item => item === token || item.startsWith(`${token}:`));
}

function rowDomainGroupKey(row = {}) {
  return String(row.domain || '').trim().toLowerCase();
}

function isSharedFormHost(domain = '') {
  const normalized = String(domain || '').trim().toLowerCase();
  return SHARED_FORM_HOSTS.has(normalized);
}

function duplicateGroups(rows = []) {
  const byDomain = new Map();
  for (const row of rows) {
    const domain = rowDomainGroupKey(row);
    if (!domain) continue;
    const group = byDomain.get(domain) || [];
    group.push(row);
    byDomain.set(domain, group);
  }

  const exactDomainGroups = new Map();
  const sharedHostGroups = new Map();
  for (const [domain, group] of byDomain.entries()) {
    if (group.length <= 1) continue;
    if (isSharedFormHost(domain)) sharedHostGroups.set(domain, group);
    else exactDomainGroups.set(domain, group);
  }

  return {
    exactDomainGroups,
    sharedHostGroups,
  };
}

function auditFlags(row = {}, groups = {}) {
  const flags = [];
  const domain = rowDomainGroupKey(row);
  if (groups.exactDomainGroups?.has(domain)) flags.push('duplicate_domain_candidate');
  if (groups.sharedHostGroups?.has(domain)) flags.push('shared_form_host');
  if (String(row.pricing || '').trim() === 'unknown') flags.push('pricing_unknown');
  if (String(row.status || '').trim() === 'new') flags.push('status_new');
  if (hasSignal(row, 'classification_mismatch')) flags.push('classification_mismatch');
  if (hasSignal(row, 'required_fields_unmapped')) flags.push('required_fields_unmapped');
  if (hasSignal(row, 'no_persisted_form_evidence')) flags.push('no_persisted_form_evidence');
  if (hasSignal(row, 'submit_button_missing')) flags.push('submit_button_missing');
  if (hasSignal(row, 'manual_surface_review_required')) flags.push('manual_surface_review_required');
  if (hasSignal(row, 'pricing_unknown_verify_free_path')) flags.push('pricing_unknown_verify_free_path');
  return flags;
}

function suggestedAction(flags = []) {
  if (flags.includes('duplicate_domain_candidate')) return 'dedupe_same_site_before_login';
  if (flags.includes('pricing_unknown')) return 'pricing_review_before_login';
  if (flags.includes('classification_mismatch')) return 'registry_recheck_before_login';
  if (flags.includes('manual_surface_review_required')) return 'manual_surface_review_before_login';
  return 'manual_login_then_rescout';
}

function relatedTargetIds(row = {}, groups = {}) {
  const domain = rowDomainGroupKey(row);
  const group = groups.exactDomainGroups?.get(domain) || groups.sharedHostGroups?.get(domain) || [];
  return group
    .map(item => item.target_id || '')
    .filter(Boolean)
    .filter(id => id !== row.target_id);
}

function auditRow(row = {}, index = 0, groups = {}) {
  const flags = auditFlags(row, groups);
  const domain = rowDomainGroupKey(row);
  const group = groups.exactDomainGroups?.get(domain) || groups.sharedHostGroups?.get(domain) || [];
  return {
    audit_order: String(index + 1),
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
    safety_blockers: row.safety_blockers || '',
    reason: row.reason || '',
    audit_flags: flags.join('; '),
    suggested_pre_login_action: suggestedAction(flags),
    duplicate_group_key: group.length > 1 ? domain : '',
    duplicate_group_size: group.length > 1 ? String(group.length) : '',
    related_target_ids: relatedTargetIds(row, groups).join('; '),
    notes: row.notes || '',
  };
}

function summarizeAudit(rows = [], groups = {}) {
  const byAction = {};
  const byFlag = {};
  const bySource = {};
  const byPricing = {};
  const byPriority = {};

  for (const row of rows) {
    incrementCount(byAction, row.suggested_pre_login_action);
    incrementCount(bySource, row.source || 'unknown');
    incrementCount(byPricing, row.pricing || 'unknown');
    incrementCount(byPriority, row.priority || 'unknown');
    for (const flag of splitSignals(row.audit_flags)) incrementCount(byFlag, flag);
  }

  return {
    rows: rows.length,
    duplicate_domain_groups: groups.exactDomainGroups?.size || 0,
    duplicate_domain_rows: rows.filter(row => splitSignals(row.audit_flags).includes('duplicate_domain_candidate')).length,
    shared_form_host_groups: groups.sharedHostGroups?.size || 0,
    shared_form_host_rows: rows.filter(row => splitSignals(row.audit_flags).includes('shared_form_host')).length,
    pricing_unknown_rows: rows.filter(row => splitSignals(row.audit_flags).includes('pricing_unknown')).length,
    classification_mismatch_rows: rows.filter(row => splitSignals(row.audit_flags).includes('classification_mismatch')).length,
    evidence_gap_rows: rows.filter(row => splitSignals(row.audit_flags).some(flag => [
      'required_fields_unmapped',
      'no_persisted_form_evidence',
      'submit_button_missing',
    ].includes(flag))).length,
    by_suggested_pre_login_action: byAction,
    by_flag: byFlag,
    by_source: bySource,
    by_pricing: byPricing,
    by_priority: byPriority,
  };
}

export function buildAuthLoginAudit(queuePath) {
  if (!queuePath) throw new Error('auth login audit queue path is required');

  const sourceRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const groups = duplicateGroups(sourceRows);
  const rows = sourceRows.map((row, index) => auditRow(row, index, groups));

  return {
    version: 1,
    created_at: nowIso(),
    source_queue: normalizePath(queuePath),
    constraints: {
      purpose: 'read_only_auth_login_queue_audit',
      no_real_submission: true,
      no_browser_launch: true,
      no_network_access_required: true,
      no_registry_write: true,
    },
    duplicate_groups: {
      exact_domain: [...(groups.exactDomainGroups?.entries() || [])].map(([domain, rowsInGroup]) => ({
        group_key: domain,
        size: rowsInGroup.length,
        target_ids: rowsInGroup.map(row => row.target_id || ''),
      })),
      shared_form_host: [...(groups.sharedHostGroups?.entries() || [])].map(([domain, rowsInGroup]) => ({
        group_key: domain,
        size: rowsInGroup.length,
        target_ids: rowsInGroup.map(row => row.target_id || ''),
      })),
    },
    rows,
    summary: summarizeAudit(rows, groups),
  };
}

export function authLoginAuditCsv(rows = []) {
  return [
    AUTH_LOGIN_AUDIT_HEADERS.join(','),
    ...rows.map(row => AUTH_LOGIN_AUDIT_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

export function authLoginAuditMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Login Audit',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    '',
    '## Safety Policy',
    '',
    '- Read-only audit only.',
    '- No login, no submission, no scout, no registry writes.',
    '- Use this audit to shrink the auth queue before asking a human to collect more login state.',
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary?.rows || 0}`,
    `- Duplicate domain groups: ${report.summary?.duplicate_domain_groups || 0}`,
    `- Duplicate domain rows: ${report.summary?.duplicate_domain_rows || 0}`,
    `- Shared form host groups: ${report.summary?.shared_form_host_groups || 0}`,
    `- Pricing unknown rows: ${report.summary?.pricing_unknown_rows || 0}`,
    `- Classification mismatch rows: ${report.summary?.classification_mismatch_rows || 0}`,
    `- Evidence gap rows: ${report.summary?.evidence_gap_rows || 0}`,
    '',
    '## Suggested Actions',
    '',
    '| Action | Count |',
    '|---|---:|',
    ...Object.entries(report.summary?.by_suggested_pre_login_action || {})
      .map(([action, count]) => `| ${action} | ${count} |`),
    '',
    '## Duplicate Domain Groups',
    '',
    '| Group | Size | Target IDs |',
    '|---|---:|---|',
    ...(report.duplicate_groups?.exact_domain || []).map(group =>
      `| ${group.group_key} | ${group.size} | ${group.target_ids.join(', ')} |`
    ),
    '',
    '## Shared Form Host Groups',
    '',
    '| Group | Size | Target IDs |',
    '|---|---:|---|',
    ...(report.duplicate_groups?.shared_form_host || []).map(group =>
      `| ${group.group_key} | ${group.size} | ${group.target_ids.join(', ')} |`
    ),
    '',
    '## Files',
    '',
    `- Audit CSV: ${files.audit_csv || ''}`,
    `- Audit JSON: ${files.audit_json || ''}`,
    `- Audit Markdown: ${files.audit_md || ''}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function writeAuthLoginAudit(report, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  const name = opts.name || 'auth-login-audit';
  mkdirSync(outputDir, { recursive: true });

  const files = {
    output_dir: normalizePath(outputDir),
    audit_csv: normalizePath(join(outputDir, `${name}.csv`)),
    audit_json: normalizePath(join(outputDir, `${name}.json`)),
    audit_md: normalizePath(join(outputDir, `${name}.md`)),
  };

  writeFileSync(files.audit_csv, authLoginAuditCsv(report.rows), 'utf-8');
  writeFileSync(files.audit_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.audit_md, authLoginAuditMarkdown(report, files), 'utf-8');
  return files;
}
