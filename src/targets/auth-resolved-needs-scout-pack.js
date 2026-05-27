import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl } from './normalize.js';

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

const PACK_HEADERS = [
  'scout_order',
  'target_id',
  'name',
  'domain',
  'pricing',
  'risk',
  'lang',
  'current_mode',
  'current_status',
  'current_manual_bucket',
  'current_automation_after_human',
  'submit_url',
  'auth_profile',
  'auth_login_command',
  'auth_scout_command',
  'recommended_route',
  'reason_for_exit_from_auth',
  'operator_goal',
  'strict_policy',
  'next_step',
];

function packCsv(rows = []) {
  return [
    PACK_HEADERS.join(','),
    ...rows.map(row => PACK_HEADERS.map(header => csvEscape(row?.[header])).join(',')),
  ].join('\n') + '\n';
}

function countBy(rows = [], key) {
  return rows.reduce((acc, row) => {
    const normalized = String(row?.[key] || 'unknown');
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {});
}

function packRow(row = {}, index = 0) {
  const targetId = row.target_id || '';
  return {
    scout_order: String(index + 1),
    target_id: targetId,
    name: row.name || '',
    domain: row.domain || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    lang: row.lang || '',
    current_mode: row.mode || '',
    current_status: row.status || '',
    current_manual_bucket: row.manual_bucket || '',
    current_automation_after_human: row.automation_after_human || '',
    submit_url: cleanUrl(row.submit_url || ''),
    auth_profile: row.auth_profile || targetId,
    auth_login_command: row.auth_login_command || '',
    auth_scout_command: row.auth_scout_command || '',
    recommended_route: 'needs_scout_outside_auth_lane',
    reason_for_exit_from_auth: 'classification_mismatch_or_missing_submit_evidence_requires_fresh_scout',
    operator_goal: 'capture current public submit surface and reclassify target before any auth workflow re-entry',
    strict_policy: 'read_only_plan_only; no_login_execution; no_submission; no_registry_write',
    next_step: 'Collect public scout evidence first. Re-enter auth only if a later scout confirms auth is genuinely required.',
  };
}

function summaryMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Resolved Needs-Scout Pack',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    '',
    'Policy: read-only planning only. No login, no submission, no registry writes, no browser launch.',
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary?.rows || 0}`,
    `- Needs-scout targets moved out of auth: ${report.summary?.rows || 0}`,
    '',
    '## Targets',
    '',
    '| Order | Target | Domain | Route | Next Step |',
    '|---|---|---|---|---|',
    ...(report.rows || []).map(row => `| ${markdownEscape(row.scout_order)} | ${markdownEscape(row.target_id)} | ${markdownEscape(row.domain)} | ${markdownEscape(row.recommended_route)} | ${markdownEscape(row.next_step)} |`),
    '',
    '## Files',
    '',
    `- Pack CSV: ${files.pack_csv || ''}`,
    `- Next queue CSV: ${files.next_queue_csv || ''}`,
    `- Summary JSON: ${files.summary_json || ''}`,
    `- Summary Markdown: ${files.summary_md || ''}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function buildAuthResolvedNeedsScoutPack(queuePath) {
  if (!queuePath) throw new Error('auth resolved needs-scout queue path is required');

  const sourceRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const rows = sourceRows.map((row, index) => packRow(row, index));

  return {
    version: 1,
    created_at: nowIso(),
    source_queue: normalizePath(queuePath),
    constraints: {
      purpose: 'read_only_auth_resolved_needs_scout_pack',
      no_real_submission: true,
      no_browser_launch: true,
      no_registry_write: true,
      no_login_execution: true,
      no_queue_mutation: true,
    },
    rows,
    summary: {
      rows: rows.length,
      by_pricing: countBy(rows, 'pricing'),
      by_risk: countBy(rows, 'risk'),
      by_lang: countBy(rows, 'lang'),
      by_route: countBy(rows, 'recommended_route'),
    },
  };
}

export function writeAuthResolvedNeedsScoutPack(report = {}, opts = {}) {
  const outputDir = opts.outputDir || join(dirname(report.source_queue || '.'), 'resolved-needs-scout-pack');
  const name = opts.name || 'auth-resolved-needs-scout-pack';
  mkdirSync(outputDir, { recursive: true });

  const files = {
    output_dir: normalizePath(outputDir),
    pack_csv: normalizePath(join(outputDir, `${name}.csv`)),
    next_queue_csv: normalizePath(join(outputDir, 'next-auth-resolved-needs-scout.csv')),
    summary_json: normalizePath(join(outputDir, `${name}.json`)),
    summary_md: normalizePath(join(outputDir, `${name}.md`)),
  };

  writeFileSync(files.pack_csv, packCsv(report.rows || []), 'utf-8');
  writeFileSync(files.next_queue_csv, packCsv(report.rows || []), 'utf-8');
  writeFileSync(files.summary_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.summary_md, summaryMarkdown(report, files), 'utf-8');
  return files;
}
