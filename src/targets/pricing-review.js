import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { isRunnableMode } from './classify.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry } from './registry.js';
import { normalizeUrl, stripWww } from './normalize.js';
import { parseCsv } from './importers/csv.js';

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
