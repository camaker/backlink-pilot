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
  'manual_rank',
  'target_id',
  'name',
  'domain',
  'pricing',
  'risk',
  'lang',
  'submit_url',
  'auth_profile',
  'review_route',
  'review_bucket',
  'strict_policy',
  'required_human_question',
  'allowed_outcomes',
  'disallowed_outcomes',
  'next_step',
  'notes',
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

function reviewRow(row = {}, index = 0) {
  const targetId = row.target_id || '';
  if (targetId === 'orbic-ai') {
    return {
      manual_rank: String(index + 1),
      target_id: targetId,
      name: row.name || '',
      domain: row.domain || '',
      pricing: row.pricing || 'unknown',
      risk: row.risk || 'unknown',
      lang: row.lang || '',
      submit_url: cleanUrl(row.submit_url || ''),
      auth_profile: row.auth_profile || targetId,
      review_route: 'manual_surface_review_fail_closed',
      review_bucket: 'manual_surface_review_required_continue',
      strict_policy: 'do_not_reenter_auth_without_verified_surface_evidence; no_login_execution; no_submission; no_registry_write',
      required_human_question: 'Does a normal browser session reveal a genuine product submission surface after login without CAPTCHA/Cloudflare/OAuth ambiguity?',
      allowed_outcomes: 'keep_manual_review_only | move_to_needs_scout_after_clear_public_surface',
      disallowed_outcomes: 'direct_login_ready | auto_ready | success_claim_without_evidence',
      next_step: 'Retry manual surface inspection in a normal browser and keep fail-closed unless evidence is explicit.',
      notes: 'orbic-ai must remain fail-closed. Fetch failure or ambiguous login callback evidence is not enough to restore auth execution.',
    };
  }

  if (targetId === 'top-best-alternatives') {
    return {
      manual_rank: String(index + 1),
      target_id: targetId,
      name: row.name || '',
      domain: row.domain || '',
      pricing: row.pricing || 'unknown',
      risk: row.risk || 'unknown',
      lang: row.lang || '',
      submit_url: cleanUrl(row.submit_url || ''),
      auth_profile: row.auth_profile || targetId,
      review_route: 'manual_surface_classification_review',
      review_bucket: 'move_out_of_auth_to_manual_surface_review',
      strict_policy: 'do_not_return_to_direct_login_without_new_classification_evidence; no_login_execution; no_submission; no_registry_write',
      required_human_question: 'Is this actually a valid product submission surface, or should it be reclassified outside the auth lane?',
      allowed_outcomes: 'keep_manual_review_only | move_to_needs_scout | move_out_of_submission_scope',
      disallowed_outcomes: 'direct_login_ready_without_new_scout | success_claim_without_listing_evidence',
      next_step: 'Classify the surface manually and only re-enter another lane after explicit evidence exists.',
      notes: 'top-best-alternatives should stay out of direct-login until manual surface classification is resolved.',
    };
  }

  return {
    manual_rank: String(index + 1),
    target_id: targetId,
    name: row.name || '',
    domain: row.domain || '',
    pricing: row.pricing || 'unknown',
    risk: row.risk || 'unknown',
    lang: row.lang || '',
    submit_url: cleanUrl(row.submit_url || ''),
    auth_profile: row.auth_profile || targetId,
    review_route: 'manual_review',
    review_bucket: 'manual_review',
    strict_policy: 'no_login_execution; no_submission; no_registry_write',
    required_human_question: 'What is the correct safe classification for this surface?',
    allowed_outcomes: 'keep_manual_review_only',
    disallowed_outcomes: 'unverified_promotion_to_runnable',
    next_step: 'Resolve manually with explicit evidence.',
    notes: '',
  };
}

function summaryMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Resolved Manual-Review Pack',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    '',
    'Policy: manual review only. No login execution, no submission, no registry writes, no browser automation.',
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary?.rows || 0}`,
    `- Fail-closed rows: ${report.summary?.fail_closed_rows || 0}`,
    '',
    '## Targets',
    '',
    '| Rank | Target | Route | Allowed Outcomes | Disallowed Outcomes |',
    '|---|---|---|---|---|',
    ...(report.rows || []).map(row => `| ${markdownEscape(row.manual_rank)} | ${markdownEscape(row.target_id)} | ${markdownEscape(row.review_route)} | ${markdownEscape(row.allowed_outcomes)} | ${markdownEscape(row.disallowed_outcomes)} |`),
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

export function buildAuthResolvedManualReviewPack(queuePath) {
  if (!queuePath) throw new Error('auth resolved manual-review queue path is required');

  const sourceRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const rows = sourceRows.map((row, index) => reviewRow(row, index));

  return {
    version: 1,
    created_at: nowIso(),
    source_queue: normalizePath(queuePath),
    constraints: {
      purpose: 'read_only_auth_resolved_manual_review_pack',
      no_real_submission: true,
      no_browser_launch: true,
      no_registry_write: true,
      no_login_execution: true,
      fail_closed: true,
    },
    rows,
    summary: {
      rows: rows.length,
      fail_closed_rows: rows.filter(row => row.review_route === 'manual_surface_review_fail_closed').length,
      by_route: countBy(rows, 'review_route'),
      by_bucket: countBy(rows, 'review_bucket'),
      by_pricing: countBy(rows, 'pricing'),
      by_risk: countBy(rows, 'risk'),
    },
  };
}

export function writeAuthResolvedManualReviewPack(report = {}, opts = {}) {
  const outputDir = opts.outputDir || join(dirname(report.source_queue || '.'), 'resolved-manual-review-pack');
  const name = opts.name || 'auth-resolved-manual-review-pack';
  mkdirSync(outputDir, { recursive: true });

  const files = {
    output_dir: normalizePath(outputDir),
    pack_csv: normalizePath(join(outputDir, `${name}.csv`)),
    next_queue_csv: normalizePath(join(outputDir, 'next-auth-resolved-manual-review.csv')),
    summary_json: normalizePath(join(outputDir, `${name}.json`)),
    summary_md: normalizePath(join(outputDir, `${name}.md`)),
  };

  writeFileSync(files.pack_csv, packCsv(report.rows || []), 'utf-8');
  writeFileSync(files.next_queue_csv, packCsv(report.rows || []), 'utf-8');
  writeFileSync(files.summary_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.summary_md, summaryMarkdown(report, files), 'utf-8');
  return files;
}
