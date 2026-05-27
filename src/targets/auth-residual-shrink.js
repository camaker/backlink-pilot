import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { sameSite } from './auth-login-safety.js';
import { parseCsv } from './importers/csv.js';
import { cleanTrackingUrl, normalizeUrl } from './normalize.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry } from './registry.js';

const RESIDUAL_HEADERS = [
  'review_type',
  'review_order',
  'priority',
  'target_id',
  'name',
  'domain',
  'pricing',
  'status',
  'submit_url',
  'suggested_resolution',
  'resolution_bucket',
  'canonical_target_id',
  'group_key',
  'group_size',
  'related_target_ids',
  'evidence_source',
  'evidence_status',
  'final_url',
  'http_status',
  'login_signal',
  'oauth_signal',
  'submit_surface_signal',
  'search_only_signal',
  'required_unmapped_fields',
  'classification_mismatch',
  'notes',
];

const MANUAL_SURFACE_EVIDENCE_HEADERS = [
  'target_id',
  'name',
  'domain',
  'url_kind',
  'url',
  'http_status',
  'fetch_ok',
  'final_url',
  'content_type',
  'title',
  'form_count',
  'input_count',
  'auth_signal',
  'oauth_signal',
  'submit_button_signal',
  'submit_path_signal',
  'directory_signal',
  'search_only_signal',
  'fetch_error',
  'evidence_notes',
  'checked_at',
];

const CALLBACK_PARAM_KEYS = [
  'callbackUrl',
  'callbackurl',
  'returnUrl',
  'returnurl',
  'redirect',
  'next',
  'continue',
  'return_to',
];

const SUBMIT_PATH_RE = /\/(submit|submission|submissions|publish|add(?:[-_/](?:tool|product|startup|app|site))?|list(?:[-_/](?:tool|product|startup|app|site))?|launch|products\/new|vendors\/new|showcase|tools?\/new)\b/i;
const LOGIN_PATH_RE = /\/(login|log-in|signin|sign-in|sign_in|register|users\/sign_in)\b/i;
const SUBMIT_TEXT_RE = /\b(submit|submission|publish|list(?:ing)?|add(?:\s+(?:tool|product|startup|app|site))?|launch|nominate|feature my product)\b|提交|发布|收录|推广|首发|添加/iu;
const AUTH_TEXT_RE = /\b(sign in|log in|login|log in with|register|create account|continue with|forgot password)\b|登录|注册/iu;
const OAUTH_TEXT_RE = /\b(google|github|facebook|twitter|x\.com|oauth)\b/iu;
const DIRECTORY_TEXT_RE = /\b(directory|directories|startup|launch|tool(?:s)?|product(?:s)?|showcase|alternatives?)\b|导航|收录|产品/iu;
const SEARCH_TEXT_RE = /\b(find alternatives to|search|placeholder=["'][^"']*(search|find alternatives))/i;

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function csvEscape(value = '') {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function markdownEscape(value = '') {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function boolText(value) {
  return value ? 'yes' : 'no';
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function queueCsv(headers = [], rows = []) {
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row?.[header])).join(',')),
  ].join('\n') + '\n';
}

function reviewTypeRank(value = '') {
  switch (String(value || '')) {
    case 'dedupe':
      return 0;
    case 'registry_recheck':
      return 1;
    case 'manual_surface_review':
      return 2;
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

function sortResidualRows(rows = []) {
  return [...rows].sort((a, b) =>
    reviewTypeRank(a.review_type) - reviewTypeRank(b.review_type) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    String(a.domain || '').localeCompare(String(b.domain || '')) ||
    String(a.target_id || '').localeCompare(String(b.target_id || ''))
  ).map((row, index) => ({
    ...row,
    review_order: String(index + 1),
  }));
}

function resolutionBucket(value = '') {
  switch (String(value || '')) {
    case 'keep_primary_auth_candidate':
    case 'keep_in_auth_queue':
    case 'keep_in_auth_queue_after_surface_review':
      return 'keep_auth';
    case 'drop_duplicate_before_login':
    case 'move_out_of_auth_to_needs_scout':
    case 'move_out_of_auth_to_manual_surface_review':
      return 'shrink_auth_queue';
    default:
      return 'needs_manual_review';
  }
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function deriveQueueFiles(triagePath, triage = {}) {
  const baseDir = dirname(triagePath);
  return {
    dedupe: triage.files?.dedupe_queue_csv || normalizePath(join(baseDir, 'auth-login-dedupe-before-login.csv')),
    registry_recheck: triage.files?.registry_recheck_queue_csv || normalizePath(join(baseDir, 'auth-login-registry-recheck-before-login.csv')),
    manual_surface_review: triage.files?.manual_surface_review_queue_csv || normalizePath(join(baseDir, 'auth-login-manual-surface-review-before-login.csv')),
  };
}

function parseQueueRows(path) {
  if (!path || !existsSync(path)) return [];
  return parseCsv(readFileSync(path, 'utf-8'));
}

function scoutResultPath(targetId, scoutDir) {
  return join(scoutDir, `${targetId}.json`);
}

function loadScoutResult(targetId = '', scoutDir = 'resources/scout-results') {
  if (!targetId) return null;
  const path = scoutResultPath(targetId, scoutDir);
  if (!existsSync(path)) return null;
  return readJsonFile(path);
}

function registryIndexById(registry = {}) {
  return new Map((registry.targets || []).map(target => [target.id, target]));
}

function rowMismatch(row = {}, registryTarget = {}) {
  const rowReason = `${row.reason || ''} ${row.audit_flags || ''}`;
  return Boolean(
    /classification_mismatch/i.test(rowReason) ||
    registryTarget.source_meta?.scout_classification_mismatch
  );
}

function scoutFinalUrl(scout = null, fallback = '') {
  return cleanUrl(scout?.final_url || fallback || '');
}

function scoutHttpStatus(scout = null) {
  return scout?.http_status ? String(scout.http_status) : '';
}

function scoutRequiredUnmappedCount(scout = null) {
  if (!scout?.forms) return 0;
  return scout.forms.reduce((sum, form) => sum + (form.fields || []).filter(field =>
    field.required && !field.mapped_to
  ).length, 0);
}

function scoutSubmitButtons(scout = null) {
  if (!scout?.forms) return [];
  return scout.forms.flatMap(form => form.submit_buttons || []);
}

function scoutFields(scout = null) {
  if (!scout?.forms) return [];
  return scout.forms.flatMap(form => form.fields || []);
}

function scoutHasSubmitSurface(scout = null) {
  if (!scout) return false;
  const linkSignal = Array.isArray(scout.submit_links) && scout.submit_links.some(link =>
    SUBMIT_PATH_RE.test(String(link.href || '')) || SUBMIT_TEXT_RE.test(String(link.text || ''))
  );
  const buttonSignal = scoutSubmitButtons(scout).some(button =>
    SUBMIT_TEXT_RE.test(String(button.text || button.value || ''))
  );
  const pathSignal = SUBMIT_PATH_RE.test(String(scout.submit_url || ''));
  return Boolean(linkSignal || buttonSignal || pathSignal);
}

function scoutSearchOnlySignal(scout = null) {
  if (!scout) return false;
  const fields = scoutFields(scout);
  const combined = fields.map(field => [
    field.name,
    field.id,
    field.placeholder,
    field.aria_label,
  ].join(' ')).join(' ');
  const searchLike = /\b(s|q)\b|search|find alternatives/i.test(combined);
  const mappedProductFields = fields.filter(field => String(field.mapped_to || '').startsWith('product.'));
  return Boolean(
    searchLike &&
    mappedProductFields.length === 0 &&
    !scoutHasSubmitSurface(scout)
  );
}

function normalizedPathScore(url = '') {
  const normalized = normalizeUrl(url);
  if (!normalized) return -50;
  let score = 0;
  if (normalized.path === '/') score -= 10;
  if (LOGIN_PATH_RE.test(normalized.path)) score -= 25;
  if (SUBMIT_PATH_RE.test(normalized.path)) score += 20;
  return score;
}

function dedupeScoreBreakdown(row = {}, scout = null) {
  let score = 0;
  const reasons = [];
  if (scout) {
    score += 30;
    reasons.push('persisted scout present');
  }
  if (String(row.pricing || '') && row.pricing !== 'unknown') {
    score += 10;
    reasons.push(`pricing:${row.pricing}`);
  }
  if (String(row.status || '') === 'auth_required') {
    score += 8;
    reasons.push('auth_required status');
  }
  if (String(row.status || '') === 'new') {
    score -= 5;
    reasons.push('status new');
  }
  const pathScore = normalizedPathScore(row.submit_url || '');
  score += pathScore;
  if (pathScore > 0) reasons.push('submit-like path');
  if (pathScore < 0 && pathScore > -50) reasons.push('generic or login path');
  if (scoutHasSubmitSurface(scout)) {
    score += 6;
    reasons.push('submit surface signal');
  }
  if (scout?.signals?.login_required || scout?.signals?.oauth_available) {
    score += 3;
    reasons.push('auth or oauth signal');
  }
  return { score, reasons };
}

function collapseWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function dedupeGroupRows(rows = [], scoutDir) {
  if (!rows.length) return { residual_rows: [], groups: [] };
  const grouped = new Map();
  for (const row of rows) {
    const key = row.duplicate_group_key || row.domain || '';
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const residualRows = [];
  const groups = [];

  for (const [groupKey, groupRows] of grouped.entries()) {
    const scored = groupRows.map(row => {
      const scout = loadScoutResult(row.target_id, scoutDir);
      const scoring = dedupeScoreBreakdown(row, scout);
      return {
        row,
        scout,
        score: scoring.score,
        score_reasons: scoring.reasons,
      };
    }).sort((a, b) =>
      b.score - a.score ||
      priorityRank(a.row.priority) - priorityRank(b.row.priority) ||
      String(a.row.target_id || '').localeCompare(String(b.row.target_id || ''))
    );

    const primary = scored[0] || null;
    const runnerUp = scored[1] || null;
    const ambiguous = Boolean(primary && runnerUp && (primary.score - runnerUp.score) < 5);
    groups.push({
      group_key: groupKey,
      size: groupRows.length,
      primary_target_id: ambiguous ? '' : (primary?.row?.target_id || ''),
      ambiguous,
      target_ids: groupRows.map(row => row.target_id || ''),
    });

    for (const entry of scored) {
      const relatedTargetIds = groupRows
        .map(row => row.target_id || '')
        .filter(id => id && id !== entry.row.target_id);
      const suggestedResolution = ambiguous
        ? 'manual_dedupe_review_required'
        : entry.row.target_id === primary?.row?.target_id
          ? 'keep_primary_auth_candidate'
          : 'drop_duplicate_before_login';
      const notes = [
        `dedupe score ${entry.score}`,
        ...entry.score_reasons,
        primary?.row?.target_id ? `group primary: ${primary.row.target_id}` : '',
        entry.scout?.final_url ? `persisted final: ${cleanUrl(entry.scout.final_url)}` : '',
      ].filter(Boolean).join('; ');
      residualRows.push({
        review_type: 'dedupe',
        review_order: '',
        priority: entry.row.priority || '',
        target_id: entry.row.target_id || '',
        name: entry.row.name || '',
        domain: entry.row.domain || '',
        pricing: entry.row.pricing || 'unknown',
        status: entry.row.status || '',
        submit_url: cleanUrl(entry.row.submit_url || ''),
        suggested_resolution: suggestedResolution,
        resolution_bucket: resolutionBucket(suggestedResolution),
        canonical_target_id: ambiguous ? '' : (primary?.row?.target_id || ''),
        group_key: groupKey,
        group_size: String(groupRows.length),
        related_target_ids: relatedTargetIds.join('; '),
        evidence_source: 'persisted_scout',
        evidence_status: entry.scout ? 'scout_present' : 'scout_missing',
        final_url: scoutFinalUrl(entry.scout, entry.row.final_url || ''),
        http_status: scoutHttpStatus(entry.scout),
        login_signal: entry.scout ? boolText(Boolean(entry.scout.signals?.login_required)) : 'unknown',
        oauth_signal: entry.scout ? boolText(Boolean(entry.scout.signals?.oauth_available)) : 'unknown',
        submit_surface_signal: entry.scout ? boolText(scoutHasSubmitSurface(entry.scout)) : 'unknown',
        search_only_signal: entry.scout ? boolText(scoutSearchOnlySignal(entry.scout)) : 'unknown',
        required_unmapped_fields: entry.scout ? String(scoutRequiredUnmappedCount(entry.scout)) : '',
        classification_mismatch: 'no',
        notes,
      });
    }
  }

  return {
    residual_rows: residualRows,
    groups,
  };
}

function registryRecheckResolution(row = {}, registryTarget = {}, scout = null) {
  const mismatch = rowMismatch(row, registryTarget);
  if (!scout) {
    return {
      suggested_resolution: 'manual_registry_recheck_required',
      notes: ['no persisted scout result found'],
    };
  }

  const requiredUnmapped = scoutRequiredUnmappedCount(scout);
  const submitSurface = scoutHasSubmitSurface(scout);
  const searchOnly = scoutSearchOnlySignal(scout);
  const authSignal = Boolean(scout.signals?.login_required);
  const oauthSignal = Boolean(scout.signals?.oauth_available);
  const notes = [];
  if (mismatch) notes.push('classification mismatch recorded');
  if (submitSurface) notes.push('persisted submit surface signal');
  if (requiredUnmapped > 0) notes.push(`required unmapped fields: ${requiredUnmapped}`);
  if (searchOnly) notes.push('search-only surface');
  if (authSignal) notes.push('login signal present');
  if (oauthSignal) notes.push('oauth signal present');

  if (mismatch && !authSignal && !oauthSignal && submitSurface && requiredUnmapped > 0) {
    return {
      suggested_resolution: 'move_out_of_auth_to_needs_scout',
      notes,
    };
  }

  if (mismatch && (searchOnly || (!submitSurface && !(scout.submit_links || []).length))) {
    return {
      suggested_resolution: 'move_out_of_auth_to_manual_surface_review',
      notes,
    };
  }

  if (mismatch && !authSignal && !oauthSignal && submitSurface) {
    return {
      suggested_resolution: 'move_out_of_auth_to_needs_scout',
      notes,
    };
  }

  return {
    suggested_resolution: 'keep_in_auth_queue',
    notes,
  };
}

function registryRecheckRows(rows = [], registryById = new Map(), scoutDir = 'resources/scout-results') {
  return rows.map(row => {
    const registryTarget = registryById.get(row.target_id || '') || {};
    const scout = loadScoutResult(row.target_id, scoutDir);
    const resolution = registryRecheckResolution(row, registryTarget, scout);
    return {
      review_type: 'registry_recheck',
      review_order: '',
      priority: row.priority || '',
      target_id: row.target_id || '',
      name: row.name || '',
      domain: row.domain || '',
      pricing: row.pricing || 'unknown',
      status: row.status || '',
      submit_url: cleanUrl(row.submit_url || ''),
      suggested_resolution: resolution.suggested_resolution,
      resolution_bucket: resolutionBucket(resolution.suggested_resolution),
      canonical_target_id: '',
      group_key: '',
      group_size: '',
      related_target_ids: row.related_target_ids || '',
      evidence_source: 'registry_and_persisted_scout',
      evidence_status: scout ? 'scout_present' : 'scout_missing',
      final_url: scoutFinalUrl(scout, row.final_url || registryTarget.technical?.final_url || ''),
      http_status: scoutHttpStatus(scout),
      login_signal: scout ? boolText(Boolean(scout.signals?.login_required)) : 'unknown',
      oauth_signal: scout ? boolText(Boolean(scout.signals?.oauth_available)) : 'unknown',
      submit_surface_signal: scout ? boolText(scoutHasSubmitSurface(scout)) : 'unknown',
      search_only_signal: scout ? boolText(scoutSearchOnlySignal(scout)) : 'unknown',
      required_unmapped_fields: scout ? String(scoutRequiredUnmappedCount(scout)) : '',
      classification_mismatch: boolText(rowMismatch(row, registryTarget)),
      notes: resolution.notes.join('; '),
    };
  });
}

function callbackCandidateUrls(row = {}) {
  const normalizedSubmit = normalizeUrl(row.submit_url || '');
  if (!normalizedSubmit) return [];
  const parsed = new URL(normalizedSubmit.url);
  const callbackKeys = new Set(CALLBACK_PARAM_KEYS.map(key => key.toLowerCase()));
  const candidates = [];
  for (const [name, raw] of parsed.searchParams.entries()) {
    if (!callbackKeys.has(String(name || '').toLowerCase())) continue;
    if (!raw) continue;
    let resolved = '';
    try {
      resolved = new URL(decodeURIComponent(raw), normalizedSubmit.rootUrl).toString();
    } catch {
      resolved = '';
    }
    const normalized = normalizeUrl(resolved);
    if (!normalized) continue;
    if (!sameSite(normalized.domain, row.domain || normalizedSubmit.domain)) continue;
    candidates.push(normalized.url);
  }
  return [...new Set(candidates)];
}

function rootUrlForRow(row = {}) {
  const normalized = normalizeUrl(row.submit_url || '');
  if (normalized) return normalized.rootUrl;
  if (row.domain) return `https://${row.domain.replace(/^www\./i, '')}/`;
  return '';
}

function manualSurfaceChecksForRow(row = {}) {
  const checks = [];
  const seen = new Set();
  const pushCheck = (urlKind, value) => {
    const normalized = normalizeUrl(value);
    if (!normalized) return;
    if (seen.has(normalized.dedupeKey)) return;
    seen.add(normalized.dedupeKey);
    checks.push({
      target_id: row.target_id || '',
      name: row.name || '',
      domain: row.domain || '',
      priority: row.priority || '',
      url_kind: urlKind,
      url: normalized.url,
    });
  };

  pushCheck('submit_url', row.submit_url || '');
  for (const value of callbackCandidateUrls(row)) pushCheck('callback_url', value);
  pushCheck('root_url', rootUrlForRow(row));
  return checks;
}

function htmlTitle(text = '') {
  const match = String(text || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return collapseWhitespace(match?.[1] || '');
}

function htmlSignalSummary(text = '', url = '') {
  const html = String(text || '');
  const flat = collapseWhitespace(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  const formCount = (html.match(/<form\b/gi) || []).length;
  const inputCount = (html.match(/<(input|textarea|select)\b/gi) || []).length;
  const title = htmlTitle(html);
  const authSignal = AUTH_TEXT_RE.test(flat);
  const oauthSignal = OAUTH_TEXT_RE.test(flat);
  const submitButtonSignal = SUBMIT_TEXT_RE.test(flat);
  const submitPathSignal = SUBMIT_PATH_RE.test(String(url || ''));
  const directorySignal = DIRECTORY_TEXT_RE.test(flat);
  const searchOnlySignal = SEARCH_TEXT_RE.test(flat) && !submitButtonSignal && !submitPathSignal;
  return {
    title,
    form_count: formCount,
    input_count: inputCount,
    auth_signal: authSignal,
    oauth_signal: oauthSignal,
    submit_button_signal: submitButtonSignal,
    submit_path_signal: submitPathSignal,
    directory_signal: directorySignal,
    search_only_signal: searchOnlySignal,
  };
}

async function fetchTextEvidence(url, opts = {}) {
  const fetchFn = opts.fetchFn || globalThis.fetch;
  if (!fetchFn) throw new Error('fetch_unavailable');
  const timeoutMs = Math.max(1000, parseInteger(opts.timeoutMs, 15000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent || 'backlink-pilot-auth-residual-shrink/1.0 (+read-only surface evidence)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      final_url: response.url || url,
      content_type: typeof response.headers?.get === 'function' ? response.headers.get('content-type') || '' : '',
      text: (await response.text()).slice(0, opts.maxBytes || 250000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function manualSurfaceEvidenceFailure(check = {}, error, checkedAt = nowIso()) {
  return {
    target_id: check.target_id || '',
    name: check.name || '',
    domain: check.domain || '',
    url_kind: check.url_kind || '',
    url: check.url || '',
    http_status: '',
    fetch_ok: 'no',
    final_url: '',
    content_type: '',
    title: '',
    form_count: '0',
    input_count: '0',
    auth_signal: 'unknown',
    oauth_signal: 'unknown',
    submit_button_signal: 'unknown',
    submit_path_signal: boolText(SUBMIT_PATH_RE.test(check.url || '')),
    directory_signal: 'unknown',
    search_only_signal: 'unknown',
    fetch_error: error?.message || String(error || 'fetch_failed'),
    evidence_notes: error?.message || String(error || 'fetch_failed'),
    checked_at: checkedAt,
  };
}

function manualSurfaceEvidenceResponse(check = {}, fetched = {}, checkedAt = nowIso()) {
  const summary = htmlSignalSummary(fetched.text, fetched.final_url || check.url || '');
  const notes = [];
  if (summary.auth_signal) notes.push('auth signal');
  if (summary.oauth_signal) notes.push('oauth signal');
  if (summary.submit_button_signal) notes.push('submit button text');
  if (summary.submit_path_signal) notes.push('submit-like path');
  if (summary.directory_signal) notes.push('directory text');
  if (summary.search_only_signal) notes.push('search-only signal');
  if (!fetched.ok) notes.push(`HTTP ${fetched.status}`);
  return {
    target_id: check.target_id || '',
    name: check.name || '',
    domain: check.domain || '',
    url_kind: check.url_kind || '',
    url: check.url || '',
    http_status: String(fetched.status || ''),
    fetch_ok: boolText(Boolean(fetched.ok)),
    final_url: cleanUrl(fetched.final_url || ''),
    content_type: fetched.content_type || '',
    title: summary.title,
    form_count: String(summary.form_count),
    input_count: String(summary.input_count),
    auth_signal: boolText(summary.auth_signal),
    oauth_signal: boolText(summary.oauth_signal),
    submit_button_signal: boolText(summary.submit_button_signal),
    submit_path_signal: boolText(summary.submit_path_signal),
    directory_signal: boolText(summary.directory_signal),
    search_only_signal: boolText(summary.search_only_signal),
    fetch_error: fetched.ok ? '' : `HTTP ${fetched.status}`,
    evidence_notes: notes.join('; '),
    checked_at: checkedAt,
  };
}

function surfaceEvidenceByTarget(rows = []) {
  return rows.reduce((acc, row) => {
    const list = acc.get(row.target_id) || [];
    list.push(row);
    acc.set(row.target_id, list);
    return acc;
  }, new Map());
}

function anySignal(rows = [], key) {
  return rows.some(row => row[key] === 'yes');
}

function firstSuccessfulFinalUrl(rows = []) {
  return rows.find(row => row.fetch_ok === 'yes' && row.final_url)?.final_url || '';
}

function firstHttpStatus(rows = []) {
  return rows.find(row => row.http_status)?.http_status || '';
}

function manualSurfaceResolution(row = {}, evidenceRows = []) {
  const fetchOk = evidenceRows.some(item => item.fetch_ok === 'yes');
  const authSignal = anySignal(evidenceRows, 'auth_signal');
  const oauthSignal = anySignal(evidenceRows, 'oauth_signal');
  const submitSurface = anySignal(evidenceRows, 'submit_button_signal') || anySignal(evidenceRows, 'submit_path_signal');
  const directorySignal = anySignal(evidenceRows, 'directory_signal');
  const searchOnlySignal = evidenceRows.length > 0 && evidenceRows.every(item => item.search_only_signal === 'yes');
  const callbackChecked = evidenceRows.some(item => item.url_kind === 'callback_url');
  const notes = [];
  if (authSignal) notes.push('auth signal present');
  if (oauthSignal) notes.push('oauth signal present');
  if (submitSurface) notes.push('submit surface signal present');
  if (directorySignal) notes.push('directory signal present');
  if (callbackChecked) notes.push('callback or return URL checked');
  if (searchOnlySignal) notes.push('only search-like surface found');
  if (!fetchOk) notes.push('no successful surface fetch');

  if (!fetchOk) {
    return {
      suggested_resolution: 'manual_surface_review_required_continue',
      notes,
    };
  }

  if ((authSignal || oauthSignal) && (submitSurface || directorySignal || callbackChecked)) {
    return {
      suggested_resolution: 'keep_in_auth_queue_after_surface_review',
      notes,
    };
  }

  if (!authSignal && !oauthSignal && submitSurface) {
    return {
      suggested_resolution: 'move_out_of_auth_to_needs_scout',
      notes,
    };
  }

  if (searchOnlySignal || (!submitSurface && !authSignal && !oauthSignal)) {
    return {
      suggested_resolution: 'keep_manual_surface_review',
      notes,
    };
  }

  return {
    suggested_resolution: 'manual_surface_review_required_continue',
    notes,
  };
}

async function manualSurfaceReviewRows(rows = [], opts = {}) {
  const checks = rows.flatMap(manualSurfaceChecksForRow);
  const evidenceRows = [];

  for (const check of checks) {
    const checkedAt = nowIso();
    try {
      const fetched = await fetchTextEvidence(check.url, opts);
      evidenceRows.push(manualSurfaceEvidenceResponse(check, fetched, checkedAt));
    } catch (error) {
      evidenceRows.push(manualSurfaceEvidenceFailure(check, error, checkedAt));
    }
  }

  const byTarget = surfaceEvidenceByTarget(evidenceRows);
  const residualRows = rows.map(row => {
    const targetEvidence = byTarget.get(row.target_id || '') || [];
    const resolution = manualSurfaceResolution(row, targetEvidence);
    return {
      review_type: 'manual_surface_review',
      review_order: '',
      priority: row.priority || '',
      target_id: row.target_id || '',
      name: row.name || '',
      domain: row.domain || '',
      pricing: row.pricing || 'unknown',
      status: row.status || '',
      submit_url: cleanUrl(row.submit_url || ''),
      suggested_resolution: resolution.suggested_resolution,
      resolution_bucket: resolutionBucket(resolution.suggested_resolution),
      canonical_target_id: '',
      group_key: '',
      group_size: '',
      related_target_ids: row.related_target_ids || '',
      evidence_source: 'get_only_surface_checks',
      evidence_status: targetEvidence.some(item => item.fetch_ok === 'yes') ? 'surface_fetch_ok' : 'surface_fetch_failed',
      final_url: firstSuccessfulFinalUrl(targetEvidence),
      http_status: firstHttpStatus(targetEvidence),
      login_signal: targetEvidence.length ? boolText(anySignal(targetEvidence, 'auth_signal')) : 'unknown',
      oauth_signal: targetEvidence.length ? boolText(anySignal(targetEvidence, 'oauth_signal')) : 'unknown',
      submit_surface_signal: targetEvidence.length ? boolText(anySignal(targetEvidence, 'submit_button_signal') || anySignal(targetEvidence, 'submit_path_signal')) : 'unknown',
      search_only_signal: targetEvidence.length ? boolText(targetEvidence.every(item => item.search_only_signal === 'yes')) : 'unknown',
      required_unmapped_fields: '',
      classification_mismatch: 'no',
      notes: resolution.notes.join('; '),
    };
  });

  return {
    residual_rows: residualRows,
    evidence_rows: evidenceRows,
  };
}

function residualMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Residual Shrink',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source triage: ${report.source_triage || ''}`,
    `Source queue: ${report.source_queue || ''}`,
    '',
    'Policy: read-only residual shrink only. No login, no submission, no registry writes, no browser launch.',
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary?.rows || 0}`,
    `- Dedupe rows: ${report.summary?.dedupe_rows || 0}`,
    `- Registry recheck rows: ${report.summary?.registry_recheck_rows || 0}`,
    `- Manual surface review rows: ${report.summary?.manual_surface_review_rows || 0}`,
    `- Rows that shrink the auth queue: ${report.summary?.shrink_auth_rows || 0}`,
    `- Rows kept in auth: ${report.summary?.keep_auth_rows || 0}`,
    `- Rows still needing manual review: ${report.summary?.needs_manual_review_rows || 0}`,
    `- Manual surface URLs checked: ${report.summary?.manual_surface_checked_urls || 0}`,
    '',
    '## By Resolution',
    '',
    '| Resolution | Count |',
    '|---|---:|',
    ...Object.entries(report.summary?.by_suggested_resolution || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `| ${markdownEscape(key)} | ${count} |`),
    '',
    '## Key Rows',
    '',
    '| Type | Target | Resolution | Bucket | Notes |',
    '|---|---|---|---|---|',
    ...sortResidualRows(report.rows || []).map(row =>
      `| ${markdownEscape(row.review_type)} | ${markdownEscape(row.target_id)} | ${markdownEscape(row.suggested_resolution)} | ${markdownEscape(row.resolution_bucket)} | ${markdownEscape(row.notes)} |`
    ),
    '',
    '## Files',
    '',
    `- Residual CSV: ${files.residual_csv || ''}`,
    `- Residual JSON: ${files.residual_json || ''}`,
    `- Residual Markdown: ${files.residual_md || ''}`,
    `- Manual surface evidence CSV: ${files.manual_surface_evidence_csv || ''}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export async function buildAuthResidualShrink(triagePath, opts = {}) {
  if (!triagePath) throw new Error('auth residual shrink triage path is required');
  const triage = readJsonFile(triagePath);
  const queueFiles = deriveQueueFiles(triagePath, triage);
  const dedupeRows = parseQueueRows(queueFiles.dedupe);
  const registryRows = parseQueueRows(queueFiles.registry_recheck);
  const manualRows = parseQueueRows(queueFiles.manual_surface_review);
  const scoutDir = opts.scoutDir || 'resources/scout-results';
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const registryById = registryIndexById(registry);

  const dedupe = dedupeGroupRows(dedupeRows, scoutDir);
  const registryRecheck = registryRecheckRows(registryRows, registryById, scoutDir);
  const manualSurface = await manualSurfaceReviewRows(manualRows, opts);
  const rows = sortResidualRows([
    ...dedupe.residual_rows,
    ...registryRecheck,
    ...manualSurface.residual_rows,
  ]);

  return {
    version: 1,
    created_at: nowIso(),
    source_triage: normalizePath(triagePath),
    source_queue: normalizePath(triage.source_queue || ''),
    queue_files: {
      dedupe: normalizePath(queueFiles.dedupe),
      registry_recheck: normalizePath(queueFiles.registry_recheck),
      manual_surface_review: normalizePath(queueFiles.manual_surface_review),
    },
    constraints: {
      purpose: 'read_only_auth_residual_shrink',
      no_real_submission: true,
      no_browser_launch: true,
      no_registry_write: true,
      no_login: true,
      manual_surface_evidence_get_only: true,
    },
    rows,
    dedupe_groups: dedupe.groups,
    manual_surface_evidence_rows: manualSurface.evidence_rows,
    summary: {
      rows: rows.length,
      dedupe_rows: dedupeRows.length,
      registry_recheck_rows: registryRows.length,
      manual_surface_review_rows: manualRows.length,
      shrink_auth_rows: rows.filter(row => row.resolution_bucket === 'shrink_auth_queue').length,
      keep_auth_rows: rows.filter(row => row.resolution_bucket === 'keep_auth').length,
      needs_manual_review_rows: rows.filter(row => row.resolution_bucket === 'needs_manual_review').length,
      manual_surface_checked_urls: manualSurface.evidence_rows.length,
      by_review_type: countBy(rows, 'review_type'),
      by_suggested_resolution: countBy(rows, 'suggested_resolution'),
      by_resolution_bucket: countBy(rows, 'resolution_bucket'),
    },
  };
}

export function authResidualShrinkCsv(report = {}) {
  return queueCsv(RESIDUAL_HEADERS, report.rows || []);
}

export function authResidualSurfaceEvidenceCsv(rows = []) {
  return queueCsv(MANUAL_SURFACE_EVIDENCE_HEADERS, rows);
}

export function writeAuthResidualShrink(report = {}, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack/residual-shrink';
  const name = opts.name || 'auth-residual-shrink';
  mkdirSync(outputDir, { recursive: true });
  const files = {
    output_dir: normalizePath(outputDir),
    residual_csv: normalizePath(join(outputDir, `${name}.csv`)),
    residual_json: normalizePath(join(outputDir, `${name}.json`)),
    residual_md: normalizePath(join(outputDir, `${name}.md`)),
    manual_surface_evidence_csv: normalizePath(join(outputDir, `${name}-manual-surface-evidence.csv`)),
  };

  writeFileSync(files.residual_csv, authResidualShrinkCsv(report), 'utf-8');
  writeFileSync(files.residual_json, `${JSON.stringify({ ...report, files }, null, 2)}\n`, 'utf-8');
  writeFileSync(files.residual_md, residualMarkdown(report, files), 'utf-8');
  writeFileSync(files.manual_surface_evidence_csv, authResidualSurfaceEvidenceCsv(report.manual_surface_evidence_rows || []), 'utf-8');
  return files;
}
