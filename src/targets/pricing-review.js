import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { isRunnableMode } from './classify.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from './registry.js';
import { normalizeUrl, stripWww } from './normalize.js';
import { parseCsv } from './importers/csv.js';
import { auditRegistry } from './audit.js';
import { buildSubmissionPlan } from '../planner/plan.js';

const QUEUE_HEADERS = [
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
];

const EVIDENCE_HEADERS = [
  'queue_order',
  'target_id',
  'name',
  'domain',
  'mode',
  'submit_url',
  'http_status',
  'fetch_ok',
  'final_url',
  'final_domain',
  'domain_changed',
  'content_type',
  'title',
  'form_count',
  'input_count',
  'submit_button_signal',
  'submit_path_signal',
  'directory_signal',
  'auth_signal',
  'oauth_signal',
  'captcha_signal',
  'cloudflare_signal',
  'payment_signal',
  'free_signal',
  'freemium_signal',
  'pricing_page_signal',
  'pricing_page_links',
  'suggested_pricing_signal',
  'evidence_notes',
  'fetch_error',
  'checked_at',
];

const SUGGESTION_HEADERS = [
  'queue_order',
  'target_id',
  'name',
  'domain',
  'mode',
  'submit_url',
  'current_pricing',
  'suggested_pricing',
  'suggested_review_decision',
  'suggestion_confidence',
  'reviewer_action',
  'suggested_review_notes',
  'suggestion_basis',
  'evidence_matched',
  'http_status',
  'fetch_ok',
  'final_url',
  'final_domain',
  'submit_button_signal',
  'submit_path_signal',
  'directory_signal',
  'auth_signal',
  'oauth_signal',
  'captcha_signal',
  'cloudflare_signal',
  'payment_signal',
  'free_signal',
  'freemium_signal',
  'pricing_page_signal',
  'checked_at',
  'automation_policy',
];

const PRICING_REVIEW_DECISIONS = new Set([
  'mark_free',
  'mark_freemium',
  'mark_paid',
  'keep_unknown',
  'needs_manual_check',
]);

const PRICING_DECISION_HEADERS = [
  'queue_order',
  'target_id',
  'name',
  'domain',
  'mode',
  'submit_url',
  'current_pricing',
  'suggested_pricing',
  'suggested_review_decision',
  'suggestion_confidence',
  'review_decision',
  'reviewed_pricing',
  'reviewer',
  'reviewed_at',
  'review_notes',
  'evidence_url',
  'evidence_matched',
  'http_status',
  'fetch_ok',
  'payment_signal',
  'free_signal',
  'freemium_signal',
  'captcha_signal',
  'cloudflare_signal',
  'suggestion_basis',
  'automation_policy',
];

const PRICING_DECISION_BATCH_HEADERS = [
  'batch_id',
  'batch_order',
  ...PRICING_DECISION_HEADERS,
];

const PRICING_REVIEW_WRITE_FIELDS = [
  'review_decision',
  'reviewed_pricing',
  'reviewer',
  'reviewed_at',
  'review_notes',
];

const PRICING_MANUAL_REVIEW_HELPER_HEADERS = [
  'manual_review_status',
  'manual_review_url',
  'reviewed_pricing_hint',
  'allowed_review_decisions',
  'manual_review_checklist',
  'review_notes_template',
];

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function markdownEscape(value = '') {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function boolText(value) {
  if (value === 'unknown') return 'unknown';
  return value ? 'yes' : 'no';
}

function signalTrue(value) {
  return value === true || String(value || '').toLowerCase() === 'yes';
}

function countBy(rows = [], keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectedSlice(rows = [], opts = {}) {
  const offset = Math.max(0, parseInteger(opts.offset, 0));
  const limit = opts.limit === undefined || opts.limit === ''
    ? rows.length
    : Math.max(0, parseInteger(opts.limit, rows.length));
  return rows.slice(offset, offset + limit);
}

function modeSet(value = '') {
  const items = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return items.length ? new Set(items) : null;
}

function commaSet(value = '') {
  const items = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return items.length ? new Set(items) : null;
}

function targetPriority(target = {}) {
  const mode = target.submission?.mode || '';
  const formCount = Array.isArray(target.forms) ? target.forms.length : 0;
  if (mode === 'auto_safe') return { priority: 'P0', score: 300 };
  if (mode === 'assisted' && formCount > 0) return { priority: 'P1', score: 240 };
  if (mode === 'assisted') return { priority: 'P1', score: 220 };
  if (mode === 'auto_candidate') return { priority: 'P2', score: 160 };
  return { priority: 'P3', score: 100 };
}

function queueRowFromTarget(target = {}, index = 0) {
  const priority = targetPriority(target);
  const normalized = normalizeUrl(target.submit_url || '');
  return {
    queue_order: String(index + 1),
    priority: priority.priority,
    priority_score: String(priority.score),
    target_id: target.id || '',
    name: target.name || '',
    domain: target.domain || normalized?.domain || '',
    mode: target.submission?.mode || '',
    submission_status: target.submission?.status || '',
    pricing: target.pricing || 'unknown',
    risk: target.quality?.risk || 'unknown',
    lang: target.lang || 'unknown',
    submit_url: normalized?.url || target.submit_url || '',
    final_url: target.technical?.final_url || '',
    last_scouted_at: target.technical?.last_scouted_at || '',
    auth: target.technical?.auth || 'unknown',
    captcha: target.technical?.captcha || 'unknown',
    form_count: String(Array.isArray(target.forms) ? target.forms.length : 0),
    last_submitted_at: target.submission?.last_submitted_at || '',
    review_decision: '',
    review_decision_options: 'mark_free | mark_freemium | mark_paid | keep_unknown | needs_manual_check',
    review_notes: '',
    reviewed_by: '',
  };
}

function pricingQueueSummary(rows = []) {
  return {
    rows: rows.length,
    by_mode: countBy(rows, row => row.mode),
    by_priority: countBy(rows, row => row.priority),
    by_risk: countBy(rows, row => row.risk),
    by_auth: countBy(rows, row => row.auth),
    by_captcha: countBy(rows, row => row.captcha),
    submitted_rows: rows.filter(row => row.last_submitted_at).length,
    rows_with_scout: rows.filter(row => row.last_scouted_at).length,
    rows_with_forms: rows.filter(row => parseInteger(row.form_count, 0) > 0).length,
  };
}

export function buildPricingReviewQueue(opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const modes = modeSet(opts.modes);
  const candidates = (registry.targets || [])
    .filter(target => isRunnableMode(target.submission?.mode))
    .filter(target => String(target.pricing || 'unknown').toLowerCase() === 'unknown')
    .filter(target => !modes || modes.has(target.submission?.mode || ''))
    .map(queueRowFromTarget)
    .sort((a, b) =>
      parseInteger(b.priority_score, 0) - parseInteger(a.priority_score, 0) ||
      a.domain.localeCompare(b.domain) ||
      a.target_id.localeCompare(b.target_id)
    )
    .map((row, index) => ({ ...row, queue_order: String(index + 1) }));
  const rows = selectedSlice(candidates, opts);

  return {
    generated_at: nowIso(),
    registry: normalizePath(registryPath),
    constraints: {
      read_only: true,
      no_network: true,
      no_registry_writes: true,
      no_login: true,
      no_submission: true,
      review_required_before_registry_change: true,
    },
    total_candidates: candidates.length,
    offset: Math.max(0, parseInteger(opts.offset, 0)),
    limit: opts.limit === undefined || opts.limit === '' ? '' : String(opts.limit),
    rows,
    summary: pricingQueueSummary(rows),
  };
}

export function pricingReviewQueueCsv(queue = {}) {
  const rows = queue.rows || [];
  return [
    QUEUE_HEADERS.join(','),
    ...rows.map(row => QUEUE_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function queueRowsTable(rows = []) {
  if (!rows.length) return '| - | - | - | - | - | - |';
  return rows.map(row => [
    row.queue_order,
    row.priority,
    row.target_id,
    row.domain,
    row.mode,
    row.submit_url,
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

function countsTable(counts = {}) {
  const entries = Object.entries(counts);
  if (!entries.length) return '| - | 0 |';
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `| ${markdownEscape(key)} | ${count} |`)
    .join('\n');
}

function pricingReviewQueueMarkdown(queue = {}, files = {}) {
  return [
    '# Pricing Review Queue',
    '',
    `Generated: ${queue.generated_at}`,
    '',
    'Policy: read-only queue for runnable targets whose pricing is still `unknown`. This file does not approve submissions and does not write the registry.',
    '',
    '## Summary',
    '',
    `- Total candidates: ${queue.total_candidates}`,
    `- Selected rows: ${queue.summary.rows}`,
    `- Rows with scout evidence: ${queue.summary.rows_with_scout}`,
    `- Rows with forms: ${queue.summary.rows_with_forms}`,
    `- Submitted rows still needing pricing classification: ${queue.summary.submitted_rows}`,
    '',
    '### By Mode',
    '',
    '| Mode | Count |',
    '|---|---:|',
    countsTable(queue.summary.by_mode),
    '',
    '## Rows',
    '',
    '| Order | Priority | Target ID | Domain | Mode | Submit URL |',
    '|---|---|---|---|---|---|',
    queueRowsTable(queue.rows),
    '',
    '## Next Commands',
    '',
    '```powershell',
    `node src/cli.js targets pricing-review-evidence ${files.queue_csv || 'pricing-review-queue.csv'} --output backlink-url/pricing-review/pricing-review-evidence.csv --json-output backlink-url/pricing-review/pricing-review-evidence.json`,
    `node src/cli.js targets pricing-review-suggest ${files.queue_csv || 'pricing-review-queue.csv'} backlink-url/pricing-review/pricing-review-evidence.csv --output backlink-url/pricing-review/pricing-review-suggestions.csv --json-output backlink-url/pricing-review/pricing-review-suggestions.json`,
    '```',
    '',
  ].join('\n');
}

export function writePricingReviewQueue(queue = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/pricing-review';
  mkdirSync(outputDir, { recursive: true });
  const files = {
    queue_csv: join(outputDir, 'pricing-review-queue.csv'),
    queue_json: join(outputDir, 'pricing-review-queue.json'),
    queue_md: join(outputDir, 'pricing-review-queue.md'),
  };
  const publicFiles = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, normalizePath(value)]));

  writeFileSync(files.queue_csv, pricingReviewQueueCsv(queue), 'utf-8');
  writeFileSync(files.queue_json, JSON.stringify({ ...queue, files: publicFiles }, null, 2) + '\n', 'utf-8');
  writeFileSync(files.queue_md, pricingReviewQueueMarkdown(queue, publicFiles), 'utf-8');
  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
  };
}

function htmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().slice(0, 180) : '';
}

function visibleText(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPricingLinks(html = '', baseUrl = '') {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) && links.length < 8) {
    const href = match[1] || '';
    const label = visibleText(match[2] || '').slice(0, 80);
    if (!/(pricing|price|plans?|payment|checkout|submit|add|list|收费|价格|付费|提交|收录)/i.test(`${href} ${label}`)) {
      continue;
    }
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      links.push(href);
    }
  }
  return [...new Set(links)].slice(0, 5);
}

function htmlPricingSignals(html = '', url = '') {
  const raw = String(html || '');
  const text = visibleText(raw);
  const lower = text.toLowerCase();
  const combined = `${url} ${text}`;
  const pricingLinks = extractPricingLinks(raw, url);
  const paymentSignal = /paid listing|sponsored listing|featured listing|pay to submit|submission fee|payment required|checkout|stripe|buy now|one[- ]time payment|\$\s?[1-9]\d*|usd\s?[1-9]\d*|付费|收费|付款|购买/i.test(text);
  const freeSignal = /free submission|submit for free|free listing|free basic listing|add your (?:site|tool|startup|product|app) for free|basic listing[^.]{0,40}free|free to submit|免费提交|免费收录|免费发布/i.test(text);
  const freemiumSignal = /free[^.]{0,80}(paid|premium|sponsored|featured)|(?:paid|premium|sponsored|featured)[^.]{0,80}free|free basic|premium listing|featured listing|upgrade/i.test(text);
  const pricingPageSignal = /pricing|plans?|price|payment|checkout|收费|价格|付费/i.test(combined) || pricingLinks.length > 0;
  const submitPathSignal = /submit|submission|add[-_/]?(tool|product|site|startup|app)|products\/new|submissions\/new|vendors\/new|claim|list/i.test(url);
  const directorySignal = /directory|tools?|startup|submit your|add your|list your|product|saas|ai tool|marketplace|catalog|目录|导航|收录/i.test(combined);
  const authSignal = /sign\s?in|log\s?in|login|create account|register|authentication|required account|登录|注册/i.test(text);
  const oauthSignal = /continue with (google|github|twitter|x)|sign in with (google|github)|oauth|google-oauth/i.test(text);
  const captchaSignal = /captcha|recaptcha|hcaptcha|turnstile|verify you are human|robot|验证码|人机验证/i.test(lower);
  const cloudflareSignal = /cloudflare|cf-browser-verification|checking your browser|just a moment|cf-turnstile/i.test(lower);
  const formCount = (raw.match(/<form\b/gi) || []).length;
  const inputCount = (raw.match(/<(input|textarea|select)\b/gi) || []).length;
  const submitButtonSignal = /type=["']submit["']|>\s*(submit|send|add|list|publish|提交|发送|收录)\s*</i.test(raw);

  let suggestedPricingSignal = 'unknown';
  if ((paymentSignal && freeSignal) || freemiumSignal) suggestedPricingSignal = 'freemium';
  else if (paymentSignal) suggestedPricingSignal = 'paid';
  else if (freeSignal) suggestedPricingSignal = 'free';

  return {
    title: htmlTitle(raw),
    form_count: formCount,
    input_count: inputCount,
    submit_button_signal: submitButtonSignal,
    submit_path_signal: submitPathSignal,
    directory_signal: directorySignal,
    auth_signal: authSignal,
    oauth_signal: oauthSignal,
    captcha_signal: captchaSignal,
    cloudflare_signal: cloudflareSignal,
    payment_signal: paymentSignal,
    free_signal: freeSignal,
    freemium_signal: freemiumSignal,
    pricing_page_signal: pricingPageSignal,
    pricing_page_links: pricingLinks.join(' | '),
    suggested_pricing_signal: suggestedPricingSignal,
  };
}

function evidenceNotes(evidence = {}) {
  const notes = [];
  if (signalTrue(evidence.payment_signal)) notes.push('paid/payment signal found');
  if (signalTrue(evidence.free_signal)) notes.push('free submission/listing signal found');
  if (signalTrue(evidence.freemium_signal)) notes.push('free plus premium/sponsored signal found');
  if (signalTrue(evidence.pricing_page_signal)) notes.push('pricing/plan link or text found');
  if (signalTrue(evidence.submit_button_signal)) notes.push('submit/add/list button signal found');
  if (signalTrue(evidence.submit_path_signal)) notes.push('submit-like URL path found');
  if (signalTrue(evidence.auth_signal) || signalTrue(evidence.oauth_signal)) notes.push('auth/login signal found');
  if (signalTrue(evidence.captcha_signal) || signalTrue(evidence.cloudflare_signal)) notes.push('CAPTCHA/Cloudflare signal found');
  if (evidence.fetch_error) notes.push(evidence.fetch_error);
  return notes.join('; ');
}

async function fetchTextEvidence(url, opts = {}) {
  const timeoutMs = parseInteger(opts.timeoutMs, 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchFn = opts.fetchFn || globalThis.fetch;
    if (!fetchFn) throw new Error('fetch_unavailable');
    const response = await fetchFn(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent || 'backlink-pilot-pricing-review/1.0 (+read-only evidence)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    const text = await response.text();
    const contentType = typeof response.headers?.get === 'function' ? response.headers.get('content-type') || '' : '';
    return {
      status: response.status,
      ok: response.ok,
      final_url: response.url || url,
      content_type: contentType,
      text: text.slice(0, opts.maxBytes || 250000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function evidenceRowFromFailure(row = {}, error, checkedAt = nowIso()) {
  const evidence = {
    queue_order: row.queue_order || '',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    mode: row.mode || '',
    submit_url: row.submit_url || '',
    http_status: '',
    fetch_ok: 'no',
    final_url: '',
    final_domain: '',
    domain_changed: 'unknown',
    content_type: '',
    title: '',
    form_count: '',
    input_count: '',
    submit_button_signal: 'unknown',
    submit_path_signal: 'unknown',
    directory_signal: 'unknown',
    auth_signal: 'unknown',
    oauth_signal: 'unknown',
    captcha_signal: 'unknown',
    cloudflare_signal: 'unknown',
    payment_signal: 'unknown',
    free_signal: 'unknown',
    freemium_signal: 'unknown',
    pricing_page_signal: 'unknown',
    pricing_page_links: '',
    suggested_pricing_signal: 'unknown',
    evidence_notes: '',
    fetch_error: error?.message || String(error || 'fetch_failed'),
    checked_at: checkedAt,
  };
  evidence.evidence_notes = evidenceNotes(evidence);
  return evidence;
}

function evidenceRowFromResponse(row = {}, fetched = {}, checkedAt = nowIso()) {
  const normalizedFinal = normalizeUrl(fetched.final_url || row.submit_url || '');
  const finalDomain = normalizedFinal?.domain || '';
  const targetDomain = stripWww(row.domain || '');
  const signals = htmlPricingSignals(fetched.text, fetched.final_url || row.submit_url || '');
  const evidence = {
    queue_order: row.queue_order || '',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    mode: row.mode || '',
    submit_url: row.submit_url || '',
    http_status: String(fetched.status || ''),
    fetch_ok: boolText(Boolean(fetched.ok)),
    final_url: normalizeUrl(fetched.final_url || '')?.url || fetched.final_url || '',
    final_domain: finalDomain,
    domain_changed: finalDomain && targetDomain ? boolText(finalDomain !== targetDomain) : 'unknown',
    content_type: fetched.content_type || '',
    title: signals.title,
    form_count: String(signals.form_count),
    input_count: String(signals.input_count),
    submit_button_signal: boolText(signals.submit_button_signal),
    submit_path_signal: boolText(signals.submit_path_signal),
    directory_signal: boolText(signals.directory_signal),
    auth_signal: boolText(signals.auth_signal),
    oauth_signal: boolText(signals.oauth_signal),
    captcha_signal: boolText(signals.captcha_signal),
    cloudflare_signal: boolText(signals.cloudflare_signal),
    payment_signal: boolText(signals.payment_signal),
    free_signal: boolText(signals.free_signal),
    freemium_signal: boolText(signals.freemium_signal),
    pricing_page_signal: boolText(signals.pricing_page_signal),
    pricing_page_links: signals.pricing_page_links,
    suggested_pricing_signal: signals.suggested_pricing_signal,
    evidence_notes: '',
    fetch_error: '',
    checked_at: checkedAt,
  };
  evidence.evidence_notes = evidenceNotes(evidence);
  return evidence;
}

export async function buildPricingReviewEvidence(queuePath, opts = {}) {
  const allRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const selected = selectedSlice(allRows, opts);
  const checkedAt = nowIso();
  const evidenceRows = [];

  for (const row of selected) {
    const normalized = normalizeUrl(row.submit_url || '');
    if (!normalized) {
      evidenceRows.push(evidenceRowFromFailure(row, new Error('invalid_submit_url'), checkedAt));
      continue;
    }
    try {
      const fetched = await fetchTextEvidence(normalized.url, opts);
      evidenceRows.push(evidenceRowFromResponse({ ...row, submit_url: normalized.url }, fetched, checkedAt));
    } catch (error) {
      evidenceRows.push(evidenceRowFromFailure(row, error, checkedAt));
    }
  }

  return {
    generated_at: nowIso(),
    queue: normalizePath(queuePath),
    constraints: {
      read_only: true,
      get_only: true,
      no_registry_writes: true,
      no_login: true,
      no_submission: true,
      no_browser_execution: true,
    },
    total_rows: allRows.length,
    checked_rows: evidenceRows.length,
    offset: Math.max(0, parseInteger(opts.offset, 0)),
    limit: opts.limit === undefined || opts.limit === '' ? '' : String(opts.limit),
    summary: {
      fetch_ok: evidenceRows.filter(row => row.fetch_ok === 'yes').length,
      fetch_failed: evidenceRows.filter(row => row.fetch_ok !== 'yes').length,
      by_suggested_pricing_signal: countBy(evidenceRows, row => row.suggested_pricing_signal),
      payment_signals: evidenceRows.filter(row => row.payment_signal === 'yes').length,
      free_signals: evidenceRows.filter(row => row.free_signal === 'yes').length,
      freemium_signals: evidenceRows.filter(row => row.freemium_signal === 'yes').length,
      auth_signals: evidenceRows.filter(row => row.auth_signal === 'yes' || row.oauth_signal === 'yes').length,
      captcha_or_cloudflare_signals: evidenceRows.filter(row => row.captcha_signal === 'yes' || row.cloudflare_signal === 'yes').length,
    },
    evidence_rows: evidenceRows,
  };
}

export function pricingReviewEvidenceCsv(evidence = {}) {
  const rows = evidence.evidence_rows || [];
  return [
    EVIDENCE_HEADERS.join(','),
    ...rows.map(row => EVIDENCE_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

export function writePricingReviewEvidence(evidence = {}, opts = {}) {
  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, pricingReviewEvidenceCsv(evidence), 'utf-8');
  }
  if (opts.jsonOutput) {
    mkdirSync(dirname(opts.jsonOutput), { recursive: true });
    writeFileSync(opts.jsonOutput, JSON.stringify(evidence, null, 2) + '\n', 'utf-8');
  }
}

function evidenceIndex(rows = []) {
  const index = new Map();
  for (const row of rows) {
    if (row.target_id) index.set(`id:${row.target_id}`, row);
    const normalized = normalizeUrl(row.submit_url || '');
    if (normalized) index.set(`url:${normalized.dedupeKey}`, row);
  }
  return index;
}

function findEvidence(row = {}, index = new Map()) {
  if (row.target_id && index.has(`id:${row.target_id}`)) return index.get(`id:${row.target_id}`);
  const normalized = normalizeUrl(row.submit_url || '');
  if (normalized && index.has(`url:${normalized.dedupeKey}`)) return index.get(`url:${normalized.dedupeKey}`);
  return null;
}

function suggestionFromEvidence(evidence = null) {
  const basis = [];
  if (!evidence) {
    return {
      suggested_pricing: 'unknown',
      suggested_review_decision: 'keep_unknown',
      suggestion_confidence: 'low',
      reviewer_action: 'collect_pricing_evidence_or_open_manually',
      basis: ['no matching read-only evidence row found'],
    };
  }

  if (evidence.fetch_ok !== 'yes') {
    basis.push(`fetch did not succeed${evidence.fetch_error ? `: ${evidence.fetch_error}` : ''}`);
    return {
      suggested_pricing: 'unknown',
      suggested_review_decision: 'keep_unknown',
      suggestion_confidence: 'low',
      reviewer_action: 'open_manually_before_editing_pricing',
      basis,
    };
  }

  const challenge = signalTrue(evidence.captcha_signal) || signalTrue(evidence.cloudflare_signal);
  const auth = signalTrue(evidence.auth_signal) || signalTrue(evidence.oauth_signal);
  const payment = signalTrue(evidence.payment_signal);
  const free = signalTrue(evidence.free_signal);
  const freemium = signalTrue(evidence.freemium_signal) || evidence.suggested_pricing_signal === 'freemium';
  const submitSurface = signalTrue(evidence.submit_button_signal) || signalTrue(evidence.submit_path_signal);

  if (challenge) basis.push('CAPTCHA/Cloudflare signal blocks reliable pricing automation');
  if (auth) basis.push('auth/login signal found');
  if (payment) basis.push('payment or paid-listing signal found');
  if (free) basis.push('free submission/listing signal found');
  if (freemium) basis.push('free plus premium/sponsored signal found');
  if (submitSurface) basis.push('submit surface signal found');
  if (signalTrue(evidence.pricing_page_signal)) basis.push('pricing/plan link or text found');

  if (challenge) {
    return {
      suggested_pricing: 'unknown',
      suggested_review_decision: 'needs_manual_check',
      suggestion_confidence: 'low',
      reviewer_action: 'open_manually_without_bypassing_challenge_then_record_pricing',
      basis,
    };
  }

  if (freemium || (payment && free)) {
    return {
      suggested_pricing: 'freemium',
      suggested_review_decision: 'mark_freemium',
      suggestion_confidence: submitSurface ? 'medium' : 'low',
      reviewer_action: 'confirm_free_submission_path_exists_before_any_free_only_plan',
      basis,
    };
  }

  if (payment && !free) {
    return {
      suggested_pricing: 'paid',
      suggested_review_decision: 'mark_paid',
      suggestion_confidence: submitSurface ? 'high' : 'medium',
      reviewer_action: 'verify_no_free_submission_path_exists_then_mark_paid_or_skip',
      basis,
    };
  }

  if (free && !payment) {
    return {
      suggested_pricing: 'free',
      suggested_review_decision: 'mark_free',
      suggestion_confidence: submitSurface ? 'high' : 'medium',
      reviewer_action: 'confirm free submission path manually before registry update',
      basis,
    };
  }

  basis.push('no decisive pricing signal found');
  return {
    suggested_pricing: 'unknown',
    suggested_review_decision: 'keep_unknown',
    suggestion_confidence: 'low',
    reviewer_action: 'open_manually_and_record_pricing_evidence',
    basis,
  };
}

function suggestionRow(row = {}, evidence = null) {
  const suggestion = suggestionFromEvidence(evidence);
  return {
    queue_order: row.queue_order || evidence?.queue_order || '',
    target_id: row.target_id || evidence?.target_id || '',
    name: row.name || evidence?.name || '',
    domain: row.domain || evidence?.domain || '',
    mode: row.mode || evidence?.mode || '',
    submit_url: row.submit_url || evidence?.submit_url || '',
    current_pricing: row.pricing || 'unknown',
    suggested_pricing: suggestion.suggested_pricing,
    suggested_review_decision: suggestion.suggested_review_decision,
    suggestion_confidence: suggestion.suggestion_confidence,
    reviewer_action: suggestion.reviewer_action,
    suggested_review_notes: [
      evidence?.evidence_notes ? `evidence: ${evidence.evidence_notes}` : '',
      `basis: ${suggestion.basis.join('; ')}`,
    ].filter(Boolean).join(' | '),
    suggestion_basis: suggestion.basis.join('; '),
    evidence_matched: evidence ? 'yes' : 'no',
    http_status: evidence?.http_status || '',
    fetch_ok: evidence?.fetch_ok || '',
    final_url: evidence?.final_url || '',
    final_domain: evidence?.final_domain || '',
    submit_button_signal: evidence?.submit_button_signal || '',
    submit_path_signal: evidence?.submit_path_signal || '',
    directory_signal: evidence?.directory_signal || '',
    auth_signal: evidence?.auth_signal || '',
    oauth_signal: evidence?.oauth_signal || '',
    captcha_signal: evidence?.captcha_signal || '',
    cloudflare_signal: evidence?.cloudflare_signal || '',
    payment_signal: evidence?.payment_signal || '',
    free_signal: evidence?.free_signal || '',
    freemium_signal: evidence?.freemium_signal || '',
    pricing_page_signal: evidence?.pricing_page_signal || '',
    checked_at: evidence?.checked_at || '',
    automation_policy: 'non_binding_suggestion_no_registry_write_no_submission',
  };
}

function pricingReviewSuggestionSummary(rows = []) {
  return {
    rows: rows.length,
    evidence_matched: rows.filter(row => row.evidence_matched === 'yes').length,
    by_suggested_pricing: countBy(rows, row => row.suggested_pricing),
    by_suggested_review_decision: countBy(rows, row => row.suggested_review_decision),
    by_confidence: countBy(rows, row => row.suggestion_confidence),
  };
}

export function buildPricingReviewSuggestions(queuePath, evidencePath) {
  const queueRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const evidenceRows = parseCsv(readFileSync(evidencePath, 'utf-8'));
  const index = evidenceIndex(evidenceRows);
  const rows = queueRows.map(row => suggestionRow(row, findEvidence(row, index)));

  return {
    generated_at: nowIso(),
    queue: normalizePath(queuePath),
    evidence: normalizePath(evidencePath),
    constraints: {
      read_only: true,
      no_registry_writes: true,
      no_login: true,
      no_submission: true,
      non_binding: true,
    },
    summary: pricingReviewSuggestionSummary(rows),
    rows,
  };
}

export function pricingReviewSuggestionsCsv(suggestions = {}) {
  const rows = suggestions.rows || [];
  return [
    SUGGESTION_HEADERS.join(','),
    ...rows.map(row => SUGGESTION_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function pricingReviewSuggestionsMarkdown(suggestions = {}, files = {}) {
  return [
    '# Pricing Review Suggestions',
    '',
    `Generated: ${suggestions.generated_at}`,
    '',
    'Policy: non-binding suggestions only. These rows do not write the registry, do not approve real submissions, and must be manually reviewed before pricing changes.',
    '',
    '## Summary',
    '',
    `- Rows: ${suggestions.summary.rows}`,
    `- Evidence matched: ${suggestions.summary.evidence_matched}`,
    '',
    '### Suggested Pricing',
    '',
    '| Pricing | Count |',
    '|---|---:|',
    countsTable(suggestions.summary.by_suggested_pricing),
    '',
    '### Suggested Review Decisions',
    '',
    '| Decision | Count |',
    '|---|---:|',
    countsTable(suggestions.summary.by_suggested_review_decision),
    '',
    '## Files',
    '',
    `- Suggestions CSV: ${files.suggestions_csv || 'pricing-review-suggestions.csv'}`,
    `- Suggestions JSON: ${files.suggestions_json || 'pricing-review-suggestions.json'}`,
    '',
  ].join('\n');
}

export function writePricingReviewSuggestions(suggestions = {}, opts = {}) {
  const output = opts.output || 'backlink-url/pricing-review/pricing-review-suggestions.csv';
  const jsonOutput = opts.jsonOutput || 'backlink-url/pricing-review/pricing-review-suggestions.json';
  const markdownOutput = opts.markdownOutput || 'backlink-url/pricing-review/pricing-review-suggestions.md';
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(jsonOutput), { recursive: true });
  mkdirSync(dirname(markdownOutput), { recursive: true });
  const files = {
    suggestions_csv: normalizePath(output),
    suggestions_json: normalizePath(jsonOutput),
    suggestions_md: normalizePath(markdownOutput),
  };
  writeFileSync(output, pricingReviewSuggestionsCsv(suggestions), 'utf-8');
  writeFileSync(jsonOutput, JSON.stringify({ ...suggestions, files }, null, 2) + '\n', 'utf-8');
  writeFileSync(markdownOutput, pricingReviewSuggestionsMarkdown(suggestions, files), 'utf-8');
  return { files };
}

function expectedPricingForDecision(decision = '') {
  if (decision === 'mark_free') return 'free';
  if (decision === 'mark_freemium') return 'freemium';
  if (decision === 'mark_paid') return 'paid';
  if (decision === 'keep_unknown' || decision === 'needs_manual_check') return 'unknown';
  return '';
}

function pricingDecisionDraftRow(row = {}) {
  const suggestedDecision = PRICING_REVIEW_DECISIONS.has(row.suggested_review_decision)
    ? row.suggested_review_decision
    : 'keep_unknown';
  return {
    queue_order: row.queue_order || '',
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    mode: row.mode || '',
    submit_url: row.submit_url || '',
    current_pricing: row.current_pricing || 'unknown',
    suggested_pricing: row.suggested_pricing || expectedPricingForDecision(suggestedDecision) || 'unknown',
    suggested_review_decision: suggestedDecision,
    suggestion_confidence: row.suggestion_confidence || '',
    review_decision: '',
    reviewed_pricing: '',
    reviewer: '',
    reviewed_at: '',
    review_notes: '',
    evidence_url: row.final_url || row.submit_url || '',
    evidence_matched: row.evidence_matched || '',
    http_status: row.http_status || '',
    fetch_ok: row.fetch_ok || '',
    payment_signal: row.payment_signal || '',
    free_signal: row.free_signal || '',
    freemium_signal: row.freemium_signal || '',
    captcha_signal: row.captcha_signal || '',
    cloudflare_signal: row.cloudflare_signal || '',
    suggestion_basis: row.suggestion_basis || '',
    automation_policy: 'pricing_decision_draft_no_registry_write_no_submission',
  };
}

function pricingDecisionSummary(rows = []) {
  return {
    rows: rows.length,
    rows_requiring_human_review: rows.filter(row => !row.review_decision).length,
    by_suggested_review_decision: countBy(rows, row => row.suggested_review_decision),
    by_suggested_pricing: countBy(rows, row => row.suggested_pricing),
    by_confidence: countBy(rows, row => row.suggestion_confidence),
  };
}

export function buildPricingReviewDecisionDraft(suggestionsPath) {
  const suggestionRows = parseCsv(readFileSync(suggestionsPath, 'utf-8'));
  const rows = suggestionRows.map(row => pricingDecisionDraftRow(row));
  return {
    generated_at: nowIso(),
    suggestions: normalizePath(suggestionsPath),
    constraints: {
      read_only: true,
      no_registry_writes: true,
      no_login: true,
      no_submission: true,
      no_mode_promotion: true,
      review_decision_left_blank: true,
    },
    rows,
    summary: pricingDecisionSummary(rows),
  };
}

export function pricingReviewDecisionDraftCsv(draft = {}) {
  const rows = draft.rows || [];
  return [
    PRICING_DECISION_HEADERS.join(','),
    ...rows.map(row => PRICING_DECISION_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function pricingDecisionRowsTable(rows = []) {
  if (!rows.length) return '| - | - | - | - | - | - |';
  return rows.slice(0, 100).map(row => [
    row.queue_order,
    row.target_id,
    row.domain,
    row.suggested_review_decision,
    row.suggested_pricing,
    row.review_decision || '(blank)',
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

function pricingReviewDecisionDraftMarkdown(draft = {}, files = {}) {
  return [
    '# Pricing Review Decision Draft',
    '',
    `Generated: ${draft.generated_at}`,
    '',
    'Policy: editable human decision draft only. It does not write the registry, does not approve submissions, and intentionally leaves `review_decision` blank.',
    '',
    '## Summary',
    '',
    `- Rows: ${draft.summary.rows}`,
    `- Rows requiring human review: ${draft.summary.rows_requiring_human_review}`,
    '',
    '### Suggested Review Decisions',
    '',
    '| Decision | Count |',
    '|---|---:|',
    countsTable(draft.summary.by_suggested_review_decision),
    '',
    '### Suggested Pricing',
    '',
    '| Pricing | Count |',
    '|---|---:|',
    countsTable(draft.summary.by_suggested_pricing),
    '',
    '## Rows',
    '',
    '| Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |',
    '|---|---|---|---|---|---|',
    pricingDecisionRowsTable(draft.rows),
    '',
    '## Human Fill Requirements',
    '',
    '1. Open each target manually before editing `review_decision`.',
    '2. Fill `review_decision`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.',
    '3. Use `mark_paid` only when no free submission path exists; it will downgrade the target to `skip` if written.',
    '4. `mark_free` can make an already `auto_safe` target eligible for future free-only planning after audit; use it only with clear evidence.',
    '5. `mark_freemium` records a free-plus-paid path but does not count as `free` in the current free-only planner.',
    '',
    '## Validation',
    '',
    '```powershell',
    `node src/cli.js targets validate-pricing-review-decisions ${files.decision_csv || 'pricing-review-decision-draft.csv'} --json`,
    'node src/cli.js targets apply-pricing-review-decisions backlink-url/pricing-review/pricing-review-decision-draft.csv --registry resources/targets.canonical.yaml --json',
    '```',
    '',
    '## Files',
    '',
    `- Draft CSV: ${files.decision_csv || 'pricing-review-decision-draft.csv'}`,
    `- Draft JSON: ${files.decision_json || 'pricing-review-decision-draft.json'}`,
    '',
  ].join('\n');
}

export function writePricingReviewDecisionDraft(draft = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/pricing-review';
  mkdirSync(outputDir, { recursive: true });
  const files = {
    decision_csv: join(outputDir, 'pricing-review-decision-draft.csv'),
    decision_json: join(outputDir, 'pricing-review-decision-draft.json'),
    decision_md: join(outputDir, 'pricing-review-decision-draft.md'),
  };
  const publicFiles = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, normalizePath(value)]));
  writeFileSync(files.decision_csv, pricingReviewDecisionDraftCsv(draft), 'utf-8');
  writeFileSync(files.decision_json, JSON.stringify({ ...draft, files: publicFiles }, null, 2) + '\n', 'utf-8');
  writeFileSync(files.decision_md, pricingReviewDecisionDraftMarkdown(draft, publicFiles), 'utf-8');
  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
  };
}

function pricingDecisionBatchId(opts = {}) {
  if (opts.batchId) return String(opts.batchId).trim();
  const offset = Math.max(0, parseInteger(opts.offset, 0));
  const limit = opts.limit === undefined || opts.limit === ''
    ? 'all'
    : String(Math.max(0, parseInteger(opts.limit, 20)));
  return `pricing-decision-${String(offset + 1).padStart(3, '0')}-${limit}`;
}

function pricingDecisionBatchSummary(rows = [], totalMatchingRows = 0) {
  return {
    rows: rows.length,
    matching_rows: totalMatchingRows,
    rows_requiring_human_review: rows.filter(row => !row.review_decision).length,
    by_suggested_review_decision: countBy(rows, row => row.suggested_review_decision),
    by_suggested_pricing: countBy(rows, row => row.suggested_pricing),
    by_confidence: countBy(rows, row => row.suggestion_confidence),
  };
}

export function buildPricingReviewDecisionBatch(draftPath, opts = {}) {
  const draftRows = parseCsv(readFileSync(draftPath, 'utf-8'));
  const suggestedDecisions = commaSet(opts.suggestedDecision || opts.suggestedDecisions);
  const confidences = commaSet(opts.confidence || opts.confidences);
  const includeReviewed = Boolean(opts.includeReviewed);
  const filtered = draftRows
    .filter(row => includeReviewed || !String(row.review_decision || '').trim())
    .filter(row => !suggestedDecisions || suggestedDecisions.has(row.suggested_review_decision || ''))
    .filter(row => !confidences || confidences.has(row.suggestion_confidence || ''));
  const offset = Math.max(0, parseInteger(opts.offset, 0));
  const limit = opts.limit === undefined || opts.limit === ''
    ? filtered.length
    : Math.max(0, parseInteger(opts.limit, 20));
  const selected = filtered.slice(offset, offset + limit);
  const batchId = pricingDecisionBatchId({ ...opts, offset, limit });
  const rows = selected.map((row, index) => ({
    batch_id: batchId,
    batch_order: String(offset + index + 1),
    ...PRICING_DECISION_HEADERS.reduce((acc, header) => {
      acc[header] = row[header] || '';
      return acc;
    }, {}),
  }));

  return {
    generated_at: nowIso(),
    draft: normalizePath(draftPath),
    batch_id: batchId,
    offset,
    limit: opts.limit === undefined || opts.limit === '' ? '' : String(limit),
    filters: {
      suggested_decision: suggestedDecisions ? [...suggestedDecisions] : [],
      confidence: confidences ? [...confidences] : [],
      include_reviewed: includeReviewed,
    },
    constraints: {
      read_only: true,
      no_network: true,
      no_registry_writes: true,
      no_login: true,
      no_submission: true,
      no_mode_promotion: true,
      review_decision_left_as_source: true,
    },
    total_draft_rows: draftRows.length,
    matching_rows: filtered.length,
    remaining_after_batch: Math.max(0, filtered.length - offset - selected.length),
    rows,
    summary: pricingDecisionBatchSummary(rows, filtered.length),
  };
}

export function pricingReviewDecisionBatchCsv(batch = {}) {
  const rows = batch.rows || [];
  return [
    PRICING_DECISION_BATCH_HEADERS.join(','),
    ...rows.map(row => PRICING_DECISION_BATCH_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function pricingDecisionBatchRowsTable(rows = []) {
  if (!rows.length) return '| - | - | - | - | - | - | - |';
  return rows.map(row => [
    row.batch_order,
    row.queue_order,
    row.target_id,
    row.domain,
    row.suggested_review_decision,
    row.suggested_pricing,
    row.review_decision || '(blank)',
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

export function pricingReviewDecisionBatchMarkdown(batch = {}, files = {}) {
  return [
    `# Pricing Review Decision Batch: ${batch.batch_id}`,
    '',
    `Generated: ${batch.generated_at}`,
    `Draft: ${batch.draft}`,
    `Offset: ${batch.offset}`,
    `Limit: ${batch.limit || '(all)'}`,
    `Matching rows: ${batch.matching_rows}`,
    `Batch rows: ${batch.summary.rows}`,
    `Remaining after batch: ${batch.remaining_after_batch}`,
    '',
    'Policy: editable human decision batch only. It does not write the registry, does not approve submissions, and must be validated before any apply step.',
    '',
    '## Summary',
    '',
    `- Rows requiring human review: ${batch.summary.rows_requiring_human_review}`,
    '',
    '### Suggested Review Decisions',
    '',
    '| Decision | Count |',
    '|---|---:|',
    countsTable(batch.summary.by_suggested_review_decision),
    '',
    '### Confidence',
    '',
    '| Confidence | Count |',
    '|---|---:|',
    countsTable(batch.summary.by_confidence),
    '',
    '## Rows',
    '',
    '| Batch Order | Queue Order | Target ID | Domain | Suggested Decision | Suggested Pricing | Review Decision |',
    '|---|---|---|---|---|---|---|',
    pricingDecisionBatchRowsTable(batch.rows),
    '',
    '## Human Fill Requirements',
    '',
    '1. Open each target manually before editing `review_decision`.',
    '2. Fill `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.',
    '3. Run validation on this batch before any apply command.',
    '4. Run apply without `--write-registry` first; only use `--write-registry` after reviewing the preview and then rerun target audit.',
    '',
    '## Validation',
    '',
    '```powershell',
    `node src/cli.js targets validate-pricing-review-decisions ${files.batch_csv || '<edited-batch.csv>'} --fail-on-blockers`,
    `node src/cli.js targets apply-pricing-review-decisions ${files.batch_csv || '<edited-batch.csv>'} --registry resources/targets.canonical.yaml --json`,
    '```',
    '',
    '## Files',
    '',
    `- Batch CSV: ${files.batch_csv || ''}`,
    `- Batch JSON: ${files.batch_json || ''}`,
    '',
  ].join('\n');
}

export function writePricingReviewDecisionBatch(batch = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/pricing-review/decision-batches';
  mkdirSync(outputDir, { recursive: true });
  const baseName = batch.batch_id || pricingDecisionBatchId(opts);
  const files = {
    batch_csv: opts.output || join(outputDir, `${baseName}.csv`),
    batch_json: opts.jsonOutput || join(outputDir, `${baseName}.json`),
    batch_md: opts.markdownOutput || join(outputDir, `${baseName}.md`),
  };
  const publicFiles = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, normalizePath(value)]));
  writeFileSync(files.batch_csv, pricingReviewDecisionBatchCsv(batch), 'utf-8');
  writeFileSync(files.batch_json, JSON.stringify({ ...batch, files: publicFiles }, null, 2) + '\n', 'utf-8');
  writeFileSync(files.batch_md, pricingReviewDecisionBatchMarkdown(batch, publicFiles), 'utf-8');
  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
  };
}

function rowByTargetId(rows = []) {
  const byId = new Map();
  const duplicates = new Set();
  for (const row of rows) {
    const id = String(row.target_id || '').trim();
    if (!id) continue;
    if (byId.has(id)) duplicates.add(id);
    else byId.set(id, row);
  }
  return { byId, duplicates: [...duplicates] };
}

function comparableDecisionValue(header, value = '') {
  if (header === 'submit_url' || header === 'evidence_url') return normalizedDedupeKey(value);
  return String(value || '').trim();
}

function pricingDecisionIdentityBlockers(source = {}, candidate = {}) {
  const blockers = [];
  for (const header of PRICING_DECISION_HEADERS) {
    if (PRICING_REVIEW_WRITE_FIELDS.includes(header)) continue;
    const sourceValue = comparableDecisionValue(header, source[header]);
    const candidateValue = comparableDecisionValue(header, candidate[header]);
    if (sourceValue !== candidateValue) {
      blockers.push({
        code: `decision_batch_${header}_changed`,
        message: `${header} differs between source draft and batch.`,
        source_value: source[header] || '',
        batch_value: candidate[header] || '',
      });
    }
  }
  return blockers;
}

function pricingDecisionReviewDiff(source = {}, candidate = {}) {
  return PRICING_REVIEW_WRITE_FIELDS
    .filter(header => String(source[header] || '') !== String(candidate[header] || ''))
    .map(header => ({
      field: header,
      before: source[header] || '',
      after: candidate[header] || '',
    }));
}

function decisionMergeFinding(code, row = {}, message, details = {}) {
  return {
    severity: 'blocker',
    code,
    target_id: row.target_id || '',
    domain: row.domain || '',
    batch_id: row.batch_id || '',
    batch_order: row.batch_order || '',
    message,
    ...details,
  };
}

function decisionDraftRowsWithHeaders(rows = []) {
  return rows.map(row => PRICING_DECISION_HEADERS.reduce((acc, header) => {
    acc[header] = row[header] || '';
    return acc;
  }, {}));
}

function decisionDraftMergeSummary(rows = []) {
  return {
    rows: rows.length,
    reviewed_rows: rows.filter(row => row.review_decision).length,
    unreviewed_rows: rows.filter(row => !row.review_decision).length,
    by_decision: countBy(rows, row => row.review_decision || 'unreviewed'),
  };
}

function pricingManualReviewBaseName(pack = {}) {
  if (pack.name) return pack.name;
  if (pack.source?.batch) {
    return basename(pack.source.batch).replace(/\.[^.]+$/, '') + '-manual-review';
  }
  return 'pricing-review-manual-current';
}

function pricingManualReviewUrl(row = {}) {
  return row.evidence_url || row.submit_url || '';
}

function pricingManualReviewChecklist(row = {}) {
  const checks = [
    'open URL in a normal browser',
    'verify visible directory or submission fit',
    'verify whether a free/basic path exists',
    'verify whether payment is mandatory',
    'verify no CAPTCHA/Cloudflare/OAuth/login is required for auto treatment',
    'record exact evidence in review_notes',
  ];
  if (signalTrue(row.payment_signal)) checks.push('payment signal was detected; do not mark free unless a free path is visible');
  if (signalTrue(row.captcha_signal) || signalTrue(row.cloudflare_signal)) checks.push('challenge signal was detected; keep manual/unknown unless resolved by human review');
  return checks.join('; ');
}

function pricingManualReviewNotesTemplate(row = {}) {
  return [
    `Manual browser review checked ${pricingManualReviewUrl(row) || row.domain || row.target_id}.`,
    `Suggested decision: ${row.suggested_review_decision || 'unknown'} (${row.suggestion_confidence || 'unknown'} confidence).`,
    `Signals: payment=${row.payment_signal || 'unknown'}, free=${row.free_signal || 'unknown'}, freemium=${row.freemium_signal || 'unknown'}, captcha=${row.captcha_signal || 'unknown'}, cloudflare=${row.cloudflare_signal || 'unknown'}.`,
    'Conclusion: <explain free/freemium/paid/unknown evidence checked>.',
  ].join(' ');
}

function pricingManualReviewRow(row = {}) {
  const suggestedDecision = row.suggested_review_decision || '';
  return {
    ...row,
    manual_review_status: row.review_decision ? 'reviewed' : 'needs_human_review',
    manual_review_url: pricingManualReviewUrl(row),
    reviewed_pricing_hint: expectedPricingForDecision(suggestedDecision) || row.suggested_pricing || '',
    allowed_review_decisions: [...PRICING_REVIEW_DECISIONS].join(' | '),
    manual_review_checklist: pricingManualReviewChecklist(row),
    review_notes_template: pricingManualReviewNotesTemplate(row),
  };
}

function pricingManualReviewSummary(rows = [], strictValidation = {}, identityBlockers = []) {
  return {
    rows: rows.length,
    reviewed_rows: rows.filter(row => row.review_decision).length,
    unreviewed_rows: rows.filter(row => !row.review_decision).length,
    strict_validation_ok: Boolean(strictValidation.ok),
    strict_validation_blockers: strictValidation.blockers_count || 0,
    identity_blockers: identityBlockers.length,
    by_mode: countBy(rows, row => row.mode),
    by_suggested_review_decision: countBy(rows, row => row.suggested_review_decision),
    by_suggested_pricing: countBy(rows, row => row.suggested_pricing),
    by_confidence: countBy(rows, row => row.suggestion_confidence),
    by_review_decision: countBy(rows, row => row.review_decision || 'unreviewed'),
    by_payment_signal: countBy(rows, row => row.payment_signal || 'unknown'),
    by_free_signal: countBy(rows, row => row.free_signal || 'unknown'),
    by_freemium_signal: countBy(rows, row => row.freemium_signal || 'unknown'),
    by_captcha_signal: countBy(rows, row => row.captcha_signal || 'unknown'),
    by_cloudflare_signal: countBy(rows, row => row.cloudflare_signal || 'unknown'),
  };
}

function pricingManualReviewTable(rows = []) {
  if (!rows.length) return '| - | - | - | - | - | - | - | - |';
  return rows.slice(0, 100).map(row => [
    row.batch_order || row.queue_order,
    row.target_id,
    row.domain,
    row.suggested_review_decision,
    row.suggestion_confidence,
    row.payment_signal || 'unknown',
    row.free_signal || 'unknown',
    row.manual_review_url,
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

export function buildPricingReviewManualPack(draftPath, opts = {}) {
  const draftRows = decisionDraftRowsWithHeaders(parseCsv(readFileSync(draftPath, 'utf-8')));
  const { byId: draftById, duplicates: draftDuplicates } = rowByTargetId(draftRows);
  const blockers = [];
  for (const targetId of draftDuplicates) {
    blockers.push(decisionMergeFinding('decision_draft_duplicate_target_id', { target_id: targetId }, 'Source decision draft contains a duplicate target_id.'));
  }

  let sourceRows = draftRows;
  let sourceKind = 'draft';
  let strictValidationPath = draftPath;
  let sourceHeaders = PRICING_DECISION_HEADERS;
  const batchPath = opts.batchPath || opts.batch;

  if (batchPath) {
    sourceKind = 'batch';
    strictValidationPath = batchPath;
    sourceHeaders = PRICING_DECISION_BATCH_HEADERS;
    sourceRows = parseCsv(readFileSync(batchPath, 'utf-8'));
    const { duplicates: batchDuplicates } = rowByTargetId(sourceRows);
    for (const targetId of batchDuplicates) {
      blockers.push(decisionMergeFinding('decision_batch_duplicate_target_id', { target_id: targetId }, 'Decision batch contains a duplicate target_id.'));
    }
    for (const row of sourceRows) {
      const draftRow = draftById.get(row.target_id);
      if (!draftRow) {
        blockers.push(decisionMergeFinding('decision_batch_target_not_found', row, 'Batch target_id does not exist in the source decision draft.'));
        continue;
      }
      const identityBlockers = pricingDecisionIdentityBlockers(draftRow, row);
      if (identityBlockers.length) {
        blockers.push(decisionMergeFinding(
          'decision_batch_identity_changed',
          row,
          'Batch row identity differs from the source decision draft.',
          { identity_blockers: identityBlockers }
        ));
      }
    }
  } else {
    const suggestedDecisions = commaSet(opts.suggestedDecision || opts.suggestedDecisions);
    const confidences = commaSet(opts.confidence || opts.confidences);
    const includeReviewed = Boolean(opts.includeReviewed);
    sourceRows = sourceRows
      .filter(row => includeReviewed || !String(row.review_decision || '').trim())
      .filter(row => !suggestedDecisions || suggestedDecisions.has(row.suggested_review_decision || ''))
      .filter(row => !confidences || confidences.has(row.suggestion_confidence || ''));
    sourceRows = selectedSlice(sourceRows, opts);
  }

  const strictValidation = validatePricingReviewDecisions(strictValidationPath, {
    requireReviewer: opts.requireReviewer,
    requireReviewedAt: opts.requireReviewedAt,
    requireReviewNotes: opts.requireReviewNotes,
  });
  const rows = sourceRows.map(pricingManualReviewRow);
  const editableHeaders = [
    ...sourceHeaders,
    ...PRICING_MANUAL_REVIEW_HELPER_HEADERS,
  ];

  return {
    generated_at: nowIso(),
    name: opts.name || '',
    ok: blockers.length === 0,
    status: blockers.length ? 'blocked_source_identity' : 'manual_pack_ready',
    draft: normalizePath(draftPath),
    source: {
      kind: sourceKind,
      draft: normalizePath(draftPath),
      batch: batchPath ? normalizePath(batchPath) : '',
    },
    constraints: {
      read_only: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      no_registry_writes: true,
      no_auto_decisions: true,
      helper_columns_ignored_by_validation: true,
    },
    strict_validation: strictValidation,
    blockers,
    blockers_count: blockers.length,
    editable_headers: editableHeaders,
    rows,
    summary: pricingManualReviewSummary(rows, strictValidation, blockers),
  };
}

export function pricingReviewManualPackCsv(pack = {}) {
  const headers = pack.editable_headers || [...PRICING_DECISION_HEADERS, ...PRICING_MANUAL_REVIEW_HELPER_HEADERS];
  const rows = pack.rows || [];
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function pricingReviewManualPackMarkdown(pack = {}, files = {}) {
  const validationStatus = pack.strict_validation?.ok ? 'currently passes' : 'currently blocked';
  const reviewedDraftPath = 'backlink-url/pricing-review/pricing-review-decision-draft.reviewed.csv';
  const applyDecisionFile = pack.source?.kind === 'batch'
    ? reviewedDraftPath
    : (files.manual_csv || '<edited-manual-review.csv>');
  const mergeCommand = pack.source?.kind === 'batch'
    ? `node src/cli.js targets merge-pricing-review-decision-batch ${pack.draft} ${files.manual_csv || '<edited-manual-review.csv>'} --output ${reviewedDraftPath} --json-output backlink-url/pricing-review/pricing-review-decision-batch-merge-reviewed.json --fail-on-blockers`
    : '';
  const sourceLines = pack.source?.batch ? [`Batch: ${pack.source.batch}`] : [];
  const validationCommands = [
    `node src/cli.js targets validate-pricing-review-decisions ${files.manual_csv || '<edited-manual-review.csv>'} --fail-on-blockers`,
    ...(mergeCommand ? [mergeCommand] : []),
    `node src/cli.js targets apply-pricing-review-decisions ${applyDecisionFile} --registry resources/targets.canonical.yaml --output backlink-url/pricing-review/pricing-review-decision-apply-preview.json --json`,
    'node src/cli.js targets pricing-review-post-apply-gate --registry resources/targets.canonical.yaml --product-config backlink-url/submission-materials/xtimer.config.yaml --output backlink-url/pricing-review/pricing-review-post-apply-gate.json --json',
  ];
  return [
    '# Pricing Review Manual Pack',
    '',
    `Generated: ${pack.generated_at}`,
    `Status: ${pack.status}`,
    `Draft: ${pack.draft}`,
    ...sourceLines,
    '',
    'Policy: manual review only. No approvals, no registry writes, no real submissions, no login, and no CAPTCHA/Cloudflare bypass. Suggestions are non-binding.',
    '',
    '## Summary',
    '',
    `- Rows: ${pack.summary.rows}`,
    `- Unreviewed rows: ${pack.summary.unreviewed_rows}`,
    `- Strict validation: ${validationStatus}`,
    `- Strict validation blockers: ${pack.summary.strict_validation_blockers}`,
    `- Source identity blockers: ${pack.blockers_count}`,
    '',
    '### Suggested Review Decisions',
    '',
    '| Decision | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_suggested_review_decision),
    '',
    '### Suggested Pricing',
    '',
    '| Pricing | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_suggested_pricing),
    '',
    '### Payment Signals',
    '',
    '| Signal | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_payment_signal),
    '',
    '## Review Rows',
    '',
    '| Order | Target ID | Domain | Suggested Decision | Confidence | Payment | Free | Review URL |',
    '|---|---|---|---|---|---|---|---|',
    pricingManualReviewTable(pack.rows),
    '',
    '## Required Human Edits',
    '',
    '1. Open `manual_review_url` in a normal browser before changing any decision.',
    '2. Fill only `review_decision`, `reviewed_pricing`, `reviewer`, `reviewed_at`, and `review_notes`.',
    '3. Do not change `target_id`, `domain`, `submit_url`, evidence fields, suggested fields, or automation policy.',
    '4. Use `mark_free` only when a visible free submission/listing path exists and no hard blocker is present.',
    '5. Use `mark_freemium` when a free/basic path exists but paid/featured upgrades are also offered.',
    '6. Use `mark_paid` when submission is paid-only; registry apply will downgrade that target to `skip`.',
    '7. Use `keep_unknown` or `needs_manual_check` when evidence is ambiguous, blocked, login-gated, CAPTCHA-gated, or Cloudflare-gated.',
    '',
    '## Validation Flow',
    '',
    '```powershell',
    ...validationCommands,
    '```',
    '',
    'Do not run an apply step with `--write-registry` until validation, merge preview, and apply preview have been reviewed.',
    '',
    '## Files',
    '',
    `- Editable manual CSV: ${files.manual_csv || ''}`,
    `- Machine-readable JSON: ${files.manual_json || ''}`,
    `- Runbook Markdown: ${files.manual_md || ''}`,
    '',
  ].join('\n');
}

export function writePricingReviewManualPack(pack = {}, opts = {}) {
  const outputDir = opts.outputDir || join(dirname(pack.source?.batch || pack.draft || 'backlink-url/pricing-review'), 'manual-review');
  mkdirSync(outputDir, { recursive: true });
  const baseName = opts.name || pricingManualReviewBaseName(pack);
  const files = {
    manual_csv: join(outputDir, `${baseName}.csv`),
    manual_json: join(outputDir, `${baseName}.json`),
    manual_md: join(outputDir, `${baseName}.md`),
  };
  const publicFiles = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, normalizePath(value)]));
  const body = { ...pack, files: publicFiles };
  writeFileSync(files.manual_csv, pricingReviewManualPackCsv(pack), 'utf-8');
  writeFileSync(files.manual_json, JSON.stringify(body, null, 2) + '\n', 'utf-8');
  writeFileSync(files.manual_md, pricingReviewManualPackMarkdown(pack, publicFiles), 'utf-8');
  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
  };
}

export function buildPricingReviewDecisionBatchMerge(draftPath, batchPath, opts = {}) {
  const draftRows = decisionDraftRowsWithHeaders(parseCsv(readFileSync(draftPath, 'utf-8')));
  const batchRows = parseCsv(readFileSync(batchPath, 'utf-8'));
  const validation = validatePricingReviewDecisions(batchPath, {
    requireReviewer: opts.requireReviewer,
    requireReviewedAt: opts.requireReviewedAt,
    requireReviewNotes: opts.requireReviewNotes,
  });
  const report = {
    generated_at: nowIso(),
    ok: false,
    status: 'blocked_batch_validation',
    draft: normalizePath(draftPath),
    batch: normalizePath(batchPath),
    constraints: {
      read_only: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      no_registry_writes: true,
      merge_only_review_fields: true,
      explicit_output_required: true,
      overwrite_reviewed_rows: Boolean(opts.allowOverwrite),
    },
    validation,
    draft_rows: draftRows.length,
    batch_rows: batchRows.length,
    proposals_count: 0,
    unchanged_rows: 0,
    blockers_count: validation.blockers_count,
    blockers: [...validation.blockers],
    proposals: [],
    unchanged: [],
    updated_rows: draftRows,
    updated_summary: decisionDraftMergeSummary(draftRows),
  };

  if (!validation.ok) return report;

  const blockers = [];
  const { byId: draftById, duplicates: draftDuplicates } = rowByTargetId(draftRows);
  const { duplicates: batchDuplicates } = rowByTargetId(batchRows);
  for (const targetId of draftDuplicates) {
    blockers.push(decisionMergeFinding('decision_draft_duplicate_target_id', { target_id: targetId }, 'Source decision draft contains a duplicate target_id.'));
  }
  for (const targetId of batchDuplicates) {
    blockers.push(decisionMergeFinding('decision_batch_duplicate_target_id', { target_id: targetId }, 'Decision batch contains a duplicate target_id.'));
  }

  const updatedById = new Map(draftRows.map(row => [row.target_id, { ...row }]));
  const proposals = [];
  const unchanged = [];

  for (const batchRow of batchRows) {
    const draftRow = draftById.get(batchRow.target_id);
    if (!draftRow) {
      blockers.push(decisionMergeFinding('decision_batch_target_not_found', batchRow, 'Batch target_id does not exist in the source decision draft.'));
      continue;
    }

    const identityBlockers = pricingDecisionIdentityBlockers(draftRow, batchRow);
    if (identityBlockers.length) {
      blockers.push(decisionMergeFinding(
        'decision_batch_identity_changed',
        batchRow,
        'Batch row identity differs from the source decision draft.',
        { identity_blockers: identityBlockers }
      ));
      continue;
    }

    const diff = pricingDecisionReviewDiff(draftRow, batchRow);
    if (!diff.length) {
      unchanged.push({
        target_id: batchRow.target_id,
        domain: batchRow.domain,
        batch_id: batchRow.batch_id || '',
        batch_order: batchRow.batch_order || '',
        reason: 'review_fields_unchanged',
      });
      continue;
    }

    if (draftRow.review_decision && !opts.allowOverwrite) {
      blockers.push(decisionMergeFinding(
        'decision_draft_row_already_reviewed',
        batchRow,
        'Source decision draft row is already reviewed; use allowOverwrite only after resolving the conflict.',
        { existing_review_decision: draftRow.review_decision, incoming_review_decision: batchRow.review_decision }
      ));
      continue;
    }

    const updatedRow = { ...draftRow };
    for (const field of PRICING_REVIEW_WRITE_FIELDS) updatedRow[field] = batchRow[field] || '';
    updatedById.set(batchRow.target_id, updatedRow);
    proposals.push({
      target_id: batchRow.target_id,
      domain: batchRow.domain,
      batch_id: batchRow.batch_id || '',
      batch_order: batchRow.batch_order || '',
      review_decision: batchRow.review_decision || '',
      reviewed_pricing: batchRow.reviewed_pricing || '',
      changed_fields: diff.map(item => item.field),
    });
  }

  const updatedRows = draftRows.map(row => updatedById.get(row.target_id) || row);
  report.blockers = blockers;
  report.blockers_count = blockers.length;
  report.proposals = proposals;
  report.proposals_count = proposals.length;
  report.unchanged = unchanged;
  report.unchanged_rows = unchanged.length;
  report.updated_rows = updatedRows;
  report.updated_summary = decisionDraftMergeSummary(updatedRows);
  report.ok = blockers.length === 0;
  report.status = report.ok ? 'merge_preview_ready' : 'blocked_merge_identity';
  return report;
}

export function writePricingReviewDecisionBatchMerge(report = {}, opts = {}) {
  const files = {};
  if (opts.output && report.ok) {
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, pricingReviewDecisionDraftCsv({ rows: report.updated_rows || [] }), 'utf-8');
    files.updated_draft_csv = normalizePath(opts.output);
  }
  if (opts.jsonOutput) {
    mkdirSync(dirname(opts.jsonOutput), { recursive: true });
    files.merge_report_json = normalizePath(opts.jsonOutput);
    const body = {
      ...report,
      updated_rows: undefined,
      files,
    };
    writeFileSync(opts.jsonOutput, JSON.stringify(body, null, 2) + '\n', 'utf-8');
  }
  return { files };
}

function validationFinding(severity, code, row = {}, line, message) {
  return {
    severity,
    code,
    line,
    target_id: row.target_id || '',
    domain: row.domain || '',
    review_decision: row.review_decision || '',
    message,
  };
}

function isHttpUrl(value = '') {
  return Boolean(normalizeUrl(value));
}

function validatePricingDecisionRow(row = {}, line, opts = {}) {
  const blockers = [];
  const warnings = [];
  const decision = String(row.review_decision || '').trim();
  const reviewedPricing = String(row.reviewed_pricing || '').trim().toLowerCase();
  const expectedPricing = expectedPricingForDecision(decision);

  if (!row.target_id) {
    blockers.push(validationFinding('blocker', 'target_id_missing', row, line, 'target_id is required.'));
  }
  if (!row.domain) {
    blockers.push(validationFinding('blocker', 'domain_missing', row, line, 'domain is required.'));
  }
  if (!isHttpUrl(row.submit_url || '')) {
    blockers.push(validationFinding('blocker', 'submit_url_invalid', row, line, 'submit_url must be HTTP(S).'));
  }
  if (row.evidence_url && !isHttpUrl(row.evidence_url)) {
    blockers.push(validationFinding('blocker', 'evidence_url_invalid', row, line, 'evidence_url must be HTTP(S) when present.'));
  }
  if (row.automation_policy !== 'pricing_decision_draft_no_registry_write_no_submission') {
    blockers.push(validationFinding('blocker', 'automation_policy_modified', row, line, 'automation_policy must remain pricing_decision_draft_no_registry_write_no_submission.'));
  }

  if (!decision) {
    const finding = validationFinding('blocker', 'review_decision_missing', row, line, 'review_decision must be filled before this row can affect registry data.');
    if (opts.allowUnreviewed) warnings.push({ ...finding, severity: 'warning' });
    else blockers.push(finding);
    return { blockers, warnings };
  }

  if (!PRICING_REVIEW_DECISIONS.has(decision)) {
    blockers.push(validationFinding('blocker', 'review_decision_invalid', row, line, `review_decision must be one of: ${[...PRICING_REVIEW_DECISIONS].join(', ')}.`));
  }

  if (reviewedPricing && !['free', 'freemium', 'paid', 'unknown'].includes(reviewedPricing)) {
    blockers.push(validationFinding('blocker', 'reviewed_pricing_invalid', row, line, 'reviewed_pricing must be free, freemium, paid, unknown, or blank.'));
  }
  if (expectedPricing && reviewedPricing && reviewedPricing !== expectedPricing) {
    blockers.push(validationFinding('blocker', 'reviewed_pricing_mismatch', row, line, `reviewed_pricing "${reviewedPricing}" does not match review_decision "${decision}".`));
  }

  if (opts.requireReviewer !== false && !String(row.reviewer || '').trim()) {
    blockers.push(validationFinding('blocker', 'reviewer_missing', row, line, 'reviewer is required on reviewed rows.'));
  }
  if (opts.requireReviewedAt !== false && !String(row.reviewed_at || '').trim()) {
    blockers.push(validationFinding('blocker', 'reviewed_at_missing', row, line, 'reviewed_at is required on reviewed rows.'));
  }
  if (opts.requireReviewNotes !== false && String(row.review_notes || '').trim().length < 12) {
    blockers.push(validationFinding('blocker', 'review_notes_insufficient', row, line, 'review_notes must describe the evidence checked.'));
  }

  if (decision === 'mark_free' && row.fetch_ok !== 'yes') {
    warnings.push(validationFinding('warning', 'mark_free_without_fetch_ok', row, line, 'mark_free is based on a row without successful GET evidence; manual notes must justify it.'));
  }
  if (decision === 'mark_free' && (row.payment_signal === 'yes' || row.captcha_signal === 'yes' || row.cloudflare_signal === 'yes')) {
    warnings.push(validationFinding('warning', 'mark_free_conflicting_signals', row, line, 'mark_free has payment or challenge signals; verify carefully before writing.'));
  }

  return { blockers, warnings };
}

export function validatePricingReviewDecisions(filePath, opts = {}) {
  const rows = parseCsv(readFileSync(filePath, 'utf-8'));
  const blockers = [];
  const warnings = [];
  rows.forEach((row, index) => {
    const result = validatePricingDecisionRow(row, index + 2, opts);
    blockers.push(...result.blockers);
    warnings.push(...result.warnings);
  });
  return {
    file: normalizePath(filePath),
    ok: blockers.length === 0,
    rows: rows.length,
    blockers,
    warnings,
    blockers_count: blockers.length,
    warnings_count: warnings.length,
    by_decision: countBy(rows, row => row.review_decision || 'unreviewed'),
    constraints: {
      read_only: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      no_registry_writes_without_explicit_apply: true,
      allowed_review_decisions: [...PRICING_REVIEW_DECISIONS],
    },
  };
}

function normalizedDedupeKey(value = '') {
  return normalizeUrl(value)?.dedupeKey || '';
}

function buildPricingProposal(target = {}, row = {}) {
  const decision = String(row.review_decision || '').trim();
  const nextPricing = expectedPricingForDecision(decision);
  const currentMode = target.submission?.mode || '';
  const proposal = {
    target_id: target.id || '',
    domain: target.domain || '',
    submit_url: target.submit_url || '',
    review_decision: decision,
    previous_pricing: target.pricing || 'unknown',
    next_pricing: nextPricing,
    previous_mode: currentMode,
    next_mode: currentMode,
    previous_reason: target.submission?.reason || '',
    next_reason: target.submission?.reason || '',
    action: 'no_change',
    write_allowed: false,
    notes: row.review_notes || '',
  };

  if (decision === 'keep_unknown' || decision === 'needs_manual_check') {
    proposal.next_pricing = target.pricing || 'unknown';
    proposal.action = decision;
    return proposal;
  }

  proposal.action = 'update_pricing';
  proposal.write_allowed = true;
  if (decision === 'mark_paid') {
    proposal.next_mode = 'skip';
    proposal.next_reason = 'pricing_review_paid_confirmed';
    proposal.action = 'update_pricing_and_skip_paid';
  }
  return proposal;
}

export function buildPricingReviewDecisionPatch(registryPath, decisionFilePath, opts = {}) {
  const validation = validatePricingReviewDecisions(decisionFilePath, {
    requireReviewer: opts.requireReviewer,
    requireReviewedAt: opts.requireReviewedAt,
    requireReviewNotes: opts.requireReviewNotes,
  });
  const report = {
    generated_at: nowIso(),
    ok: false,
    status: 'blocked_decision_validation',
    registry: normalizePath(registryPath || DEFAULT_REGISTRY_FILE),
    decision_file: normalizePath(decisionFilePath),
    dry_run: true,
    wrote_registry: false,
    constraints: {
      no_network: true,
      no_login: true,
      no_submission: true,
      no_mode_promotion: true,
      explicit_write_required: true,
    },
    validation,
    rows: validation.rows,
    proposals_count: 0,
    skipped_rows: 0,
    blockers_count: validation.blockers_count,
    blockers: [...validation.blockers],
    warnings: [...validation.warnings],
    proposals: [],
    skipped: [],
  };

  if (!validation.ok) return report;

  const registry = loadRegistry(registryPath || DEFAULT_REGISTRY_FILE);
  const targetsById = new Map((registry.targets || []).map(target => [target.id, target]));
  const decisionRows = parseCsv(readFileSync(decisionFilePath, 'utf-8'));

  for (const row of decisionRows) {
    const target = targetsById.get(row.target_id);
    if (!target) {
      report.blockers.push(validationFinding('blocker', 'target_not_found', row, '', 'Decision target_id does not exist in registry.'));
      continue;
    }
    if (String(target.domain || '') !== String(row.domain || '')) {
      report.blockers.push(validationFinding('blocker', 'target_domain_changed', row, '', 'Registry target domain no longer matches the decision row.'));
      continue;
    }
    if (normalizedDedupeKey(target.submit_url) !== normalizedDedupeKey(row.submit_url)) {
      report.blockers.push(validationFinding('blocker', 'target_submit_url_changed', row, '', 'Registry target submit_url no longer matches the decision row.'));
      continue;
    }
    if (String(target.pricing || 'unknown') !== String(row.current_pricing || 'unknown')) {
      report.blockers.push(validationFinding('blocker', 'target_pricing_changed', row, '', 'Registry target pricing no longer matches current_pricing in the decision row.'));
      continue;
    }
    if (row.mode && String(target.submission?.mode || '') !== String(row.mode || '')) {
      report.blockers.push(validationFinding('blocker', 'target_mode_changed', row, '', 'Registry target mode no longer matches the decision row.'));
      continue;
    }

    const proposal = buildPricingProposal(target, row);
    if (proposal.write_allowed) report.proposals.push(proposal);
    else report.skipped.push(proposal);
  }

  report.proposals_count = report.proposals.length;
  report.skipped_rows = report.skipped.length;
  report.blockers_count = report.blockers.length;
  report.ok = report.blockers_count === 0;
  report.status = report.ok ? 'preview_ready' : 'blocked_registry_identity';
  return report;
}

export function applyPricingReviewDecisionPatch(registryPath, decisionFilePath, opts = {}) {
  const report = buildPricingReviewDecisionPatch(registryPath, decisionFilePath, opts);
  report.write_requested = Boolean(opts.writeRegistry);
  if (!opts.writeRegistry || !report.ok) return report;

  const registry = loadRegistry(registryPath || DEFAULT_REGISTRY_FILE);
  const proposalsById = new Map(report.proposals.map(proposal => [proposal.target_id, proposal]));
  const updatedTargets = (registry.targets || []).map(target => {
    const proposal = proposalsById.get(target.id);
    if (!proposal) return target;
    return {
      ...target,
      pricing: proposal.next_pricing,
      submission: {
        ...(target.submission || {}),
        mode: proposal.next_mode,
        reason: proposal.next_reason,
      },
      source_meta: {
        ...(target.source_meta || {}),
        pricing_review_decision: proposal.review_decision,
        pricing_reviewed_at: nowIso(),
      },
      updated_at: nowIso(),
    };
  });
  const saved = saveRegistry({ ...registry, targets: updatedTargets }, registryPath || DEFAULT_REGISTRY_FILE);
  return {
    ...report,
    dry_run: false,
    wrote_registry: true,
    status: 'registry_written_requires_audit_before_execution',
    updated_targets: report.proposals.length,
    registry_updated_at: saved.updated_at,
  };
}

export function writePricingReviewDecisionPatchReport(report = {}, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return normalizePath(filePath);
}

function postApplyGateBlocker(code, message, details = {}) {
  return {
    severity: 'blocker',
    code,
    message,
    ...details,
  };
}

export function buildPricingReviewPostApplyGate(opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const allowPlanTargets = Boolean(opts.allowPlanTargets);
  const planLimit = Math.max(1, parseInteger(opts.limit, 30));
  const audit = auditRegistry(registryPath, { level: 'automation' });
  const plan = buildSubmissionPlan({
    registry: registryPath,
    productConfig: opts.productConfig,
    freeOnly: true,
    mode: 'auto_safe',
    limit: planLimit,
    allowUnknownPricing: false,
    includeSubmitted: false,
    includeRisk: false,
  });
  const blockers = [];

  if (!audit.ok) {
    blockers.push(postApplyGateBlocker(
      'post_apply_target_audit_blocked',
      'Registry audit has blockers after pricing review changes.',
      { audit_blockers: audit.summary?.blockers || 0 }
    ));
  }

  if (!allowPlanTargets && plan.targets.length > 0) {
    blockers.push(postApplyGateBlocker(
      'post_apply_auto_safe_plan_not_empty',
      'Strict free-only auto_safe plan is not empty after pricing review changes.',
      {
        plan_targets: plan.targets.length,
        target_ids: plan.targets.map(row => row.id).join(', '),
      }
    ));
  }

  const ok = blockers.length === 0;
  const report = {
    generated_at: nowIso(),
    ok,
    status: ok ? 'post_apply_gate_passed' : 'post_apply_gate_blocked',
    registry: normalizePath(registryPath),
    product_config: normalizePath(opts.productConfig || ''),
    constraints: {
      read_only: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      target_audit_required: true,
      plan_check_required: true,
      plan_free_only: true,
      plan_mode: 'auto_safe',
      plan_allow_unknown_pricing: false,
      plan_include_submitted: false,
      plan_targets_allowed: allowPlanTargets,
    },
    audit_summary: {
      ok: audit.ok,
      blockers: audit.summary?.blockers || 0,
      warnings: audit.summary?.warnings || 0,
      by_code: audit.summary?.by_code || {},
    },
    plan_summary: {
      targets: plan.targets.length,
      target_ids: plan.targets.map(row => row.id),
      limit: planLimit,
      constraints: plan.constraints,
    },
    blockers,
    blockers_count: blockers.length,
  };
  if (opts.includeDetails) {
    report.audit = audit;
    report.plan = plan;
  }
  return report;
}

export function writePricingReviewPostApplyGateReport(report = {}, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return normalizePath(filePath);
}
