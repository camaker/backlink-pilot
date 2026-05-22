import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative } from 'path';
import {
  canonicalTargetFromRow,
  loadRegistry,
  mergeTargets,
  saveRegistry,
} from './registry.js';
import { normalizePricing, normalizeUrl } from './normalize.js';
import { parseCsv } from './importers/csv.js';

const DEFAULT_IGNORED_FILENAMES = new Set([
  'coverage-report.json',
  'coverage-candidates.csv',
  'coverage-review.csv',
  'coverage-summary.md',
]);

const CSV_URL_COLUMNS = [
  'submission_link',
  'submit_url',
  'target_url',
  'url',
  'primaryExternalUrl',
  'href',
  'link',
];

const SOURCE_PAGE_FIELDS = new Set([
  'archiveUrls',
  'articleUrl',
  'source_article_url',
  'source_url',
]);

const BARE_DOMAIN_FIELDS = new Set([
  'domain',
  'target_domain',
]);

const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]}]+/gi;
const APPROVED_DECISIONS = new Set(['approved', 'approve', 'yes', 'y', 'true', '1']);
const DOMAIN_VARIANT_APPROVALS = new Set(['approved_domain_variant', 'approve_domain_variant']);
const DOMAIN_CHANGE_APPROVALS = new Set(['approved_domain_change', 'approve_domain_change']);
const REJECTED_DECISION_PATTERN = /^(reject|rejected|skip|skipped|already|duplicate)/;
const COVERAGE_REVIEW_HEADERS = [
  'review_decision',
  'review_instruction',
  'review_notes',
  'reviewed_by',
  'canonical_name',
  'submission_url_override',
  'pricing',
  'lang',
  'classification',
  'candidate_import_recommendation',
  'url',
  'domain',
  'source_files',
  'source_locations',
  'registry_target_ids',
  'registry_submit_urls',
  'occurrence_count',
];
const REVIEW_QUEUE_HEADERS = [
  'priority',
  'priority_score',
  'review_row',
  'review_decision',
  'review_decision_options',
  'review_action',
  'review_instruction',
  'review_notes',
  'reviewed_by',
  'submission_url_override',
  'canonical_name',
  'pricing',
  'lang',
  'classification',
  'candidate_import_recommendation',
  'url',
  'domain',
  'occurrence_count',
  'source_files',
  'source_locations',
  'registry_target_ids',
  'registry_submit_urls',
];
const REVIEW_BATCH_HEADERS = [
  'batch_id',
  'batch_order',
  ...REVIEW_QUEUE_HEADERS,
];
const REVIEW_EVIDENCE_HEADERS = [
  'batch_id',
  'batch_order',
  'review_row',
  'review_action',
  'url',
  'domain',
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
  'duplicate_registry_url',
  'suggested_decision',
  'evidence_notes',
  'fetch_error',
  'checked_at',
];
const REVIEW_SUGGESTION_HEADERS = [
  'batch_id',
  'batch_order',
  'review_row',
  'priority',
  'review_action',
  'url',
  'domain',
  'current_review_decision',
  'review_decision_options',
  'evidence_suggested_decision',
  'suggested_review_decision',
  'suggestion_confidence',
  'possible_approval_decision',
  'reviewer_action',
  'suggested_review_notes',
  'suggested_pricing',
  'suggestion_basis',
  'evidence_matched',
  'evidence_match_key',
  'http_status',
  'fetch_ok',
  'final_url',
  'final_domain',
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
  'duplicate_registry_url',
  'fetch_error',
  'checked_at',
];
const REVIEW_QUEUE_EDITABLE_FIELDS = [
  'review_decision',
  'review_notes',
  'reviewed_by',
  'canonical_name',
  'submission_url_override',
  'pricing',
  'lang',
];
const MANUAL_REVIEW_HEADERS = [
  'manual_rank',
  'priority',
  'priority_score',
  'review_row',
  'review_decision',
  'review_decision_options',
  'review_action',
  'review_instruction',
  'review_notes',
  'reviewed_by',
  'submission_url_override',
  'manual_bucket',
  'risk_level',
  'recommended_next_step',
  'url',
  'domain',
  'canonical_name',
  'pricing',
  'lang',
  'classification',
  'candidate_import_recommendation',
  'occurrence_count',
  'registry_target_ids',
  'registry_submit_urls',
  'source_files',
  'source_locations',
  'latest_batch_id',
  'evidence_file',
  'suggestion_file',
  'http_status',
  'fetch_ok',
  'final_url',
  'form_count',
  'input_count',
  'submit_path_signal',
  'directory_signal',
  'auth_signal',
  'oauth_signal',
  'captcha_signal',
  'cloudflare_signal',
  'payment_signal',
  'evidence_suggested_decision',
  'suggested_review_decision',
  'suggestion_confidence',
  'possible_approval_decision',
  'reviewer_action',
  'suggested_review_notes',
  'safety_gate_reason',
  'safety_gate_batch_id',
  'safety_gate_report',
  'checked_at',
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanupUrlToken(value) {
  return String(value || '')
    .trim()
    .replace(/^["'`(<\[]+/, '')
    .replace(/[.,;:!?'"`)\]>]+$/g, '');
}

function isHttpLikeUrl(value) {
  return /^(https?:)?\/\//i.test(String(value || '').trim());
}

function firstNormalizedUrl(value, opts = {}) {
  const cleaned = cleanupUrlToken(value);
  if (!opts.allowBareDomain && !isHttpLikeUrl(cleaned)) return null;
  return normalizeUrl(cleaned);
}

function addRecord(records, rawValue, context = {}) {
  const normalized = firstNormalizedUrl(rawValue, {
    allowBareDomain: Boolean(context.allow_bare_domain),
  });
  if (!normalized) return;

  records.push({
    raw_url: String(rawValue || '').trim(),
    url: normalized.url,
    domain: normalized.domain,
    normalized_key: normalized.dedupeKey,
    source_file: normalizePath(context.source_file),
    source_location: context.source_location || context.source_file || '',
    source_field: context.source_field || '',
    source_type: context.source_type || '',
  });
}

function extractUrlsFromText(text, context = {}) {
  const records = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = line.match(URL_PATTERN) || [];
    for (const match of matches) {
      addRecord(records, match, {
        ...context,
        source_location: `${context.source_file}:${index + 1}`,
        source_type: context.source_type || 'text',
      });
    }
  });
  return records;
}

function extractUrlsFromCsv(text, context = {}) {
  const records = [];
  const rows = parseCsv(text);

  rows.forEach((row, rowIndex) => {
    for (const column of CSV_URL_COLUMNS) {
      if (!Object.prototype.hasOwnProperty.call(row, column)) continue;
      addRecord(records, row[column], {
        ...context,
        allow_bare_domain: true,
        source_location: `${context.source_file}:row ${rowIndex + 2}:${column}`,
        source_field: column,
        source_type: 'csv',
      });
    }
  });

  return records;
}

function jsonPath(parentPath, key) {
  if (!parentPath) return String(key);
  return `${parentPath}.${String(key)}`;
}

function extractUrlsFromJsonValue(value, context = {}, path = '') {
  const records = [];
  const fieldName = path.split('.').pop() || '';
  const plainFieldName = fieldName.replace(/\[\d+\]$/, '');

  if (typeof value === 'string') {
    const direct = firstNormalizedUrl(value, {
      allowBareDomain: BARE_DOMAIN_FIELDS.has(plainFieldName),
    });
    if (direct) {
      records.push({
        raw_url: value.trim(),
        url: direct.url,
        domain: direct.domain,
        normalized_key: direct.dedupeKey,
        source_file: normalizePath(context.source_file),
        source_location: `${context.source_file}:json:${path || '$'}`,
        source_field: plainFieldName,
        source_type: 'json',
      });
      return records;
    }

    const embedded = value.match(URL_PATTERN) || [];
    for (const match of embedded) {
      addRecord(records, match, {
        ...context,
        source_location: `${context.source_file}:json:${path || '$'}`,
        source_field: plainFieldName,
        source_type: 'json',
      });
    }
    return records;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      records.push(...extractUrlsFromJsonValue(child, context, `${path}[${index}]`));
    });
    return records;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      records.push(...extractUrlsFromJsonValue(child, context, jsonPath(path, key)));
    }
  }

  return records;
}

function extractUrlsFromJson(text, context = {}) {
  try {
    return extractUrlsFromJsonValue(JSON.parse(text), context);
  } catch {
    return extractUrlsFromText(text, { ...context, source_type: 'text' });
  }
}

function listFiles(rootDir, opts = {}) {
  const ignored = new Set([
    ...DEFAULT_IGNORED_FILENAMES,
    ...asArray(opts.ignoreFilenames),
  ]);
  const root = rootDir;
  const files = [];

  function walk(path) {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        walk(join(path, entry));
      }
      return;
    }
    if (!stat.isFile()) return;
    if (ignored.has(path.split(/[\\/]/).pop())) return;
    files.push(path);
  }

  walk(root);
  return files;
}

function extractFileRecords(rootDir, filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const sourceFile = normalizePath(relative(rootDir, filePath));
  const context = {
    source_file: sourceFile,
  };
  const ext = extname(filePath).toLowerCase();

  if (ext === '.csv') return extractUrlsFromCsv(text, context);
  if (ext === '.json') return extractUrlsFromJson(text, context);
  return extractUrlsFromText(text, { ...context, source_type: ext.replace('.', '') || 'text' });
}

function registryIndexes(registry) {
  const byKey = new Map();
  const byDomain = new Map();

  for (const target of registry.targets || []) {
    const normalized = normalizeUrl(target.submit_url);
    if (!normalized) continue;
    const key = target.normalized_key || normalized.dedupeKey;
    const domainTargets = byDomain.get(normalized.domain) || [];
    const keyTargets = byKey.get(key) || [];

    keyTargets.push(target);
    domainTargets.push(target);
    byKey.set(key, keyTargets);
    byDomain.set(normalized.domain, domainTargets);
  }

  return { byKey, byDomain };
}

function aggregateRecords(records) {
  const byKey = new Map();

  for (const record of records) {
    const existing = byKey.get(record.normalized_key);
    if (!existing) {
      byKey.set(record.normalized_key, {
        url: record.url,
        domain: record.domain,
        normalized_key: record.normalized_key,
        source_files: [record.source_file],
        source_locations: [record.source_location],
        source_fields: [record.source_field].filter(Boolean),
        source_types: [record.source_type].filter(Boolean),
        occurrence_count: 1,
      });
      continue;
    }

    existing.occurrence_count += 1;
    existing.source_files = unique([...existing.source_files, record.source_file]);
    existing.source_locations = unique([...existing.source_locations, record.source_location]);
    existing.source_fields = unique([...existing.source_fields, record.source_field]);
    existing.source_types = unique([...existing.source_types, record.source_type]);
  }

  return [...byKey.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain) || a.url.localeCompare(b.url)
  );
}

function classifyCoverageItem(item, indexes) {
  const exactTargets = indexes.byKey.get(item.normalized_key) || [];
  if (exactTargets.length) {
    return {
      ...item,
      classification: 'exact_in_registry',
      registry_target_ids: exactTargets.map(target => target.id).filter(Boolean),
      registry_submit_urls: exactTargets.map(target => target.submit_url).filter(Boolean),
    };
  }

  const domainTargets = indexes.byDomain.get(item.domain) || [];
  if (domainTargets.length) {
    return {
      ...item,
      classification: 'domain_in_registry_only',
      registry_target_ids: domainTargets.map(target => target.id).filter(Boolean),
      registry_submit_urls: domainTargets.map(target => target.submit_url).filter(Boolean),
    };
  }

  return {
    ...item,
    classification: 'missing_domain',
    registry_target_ids: [],
    registry_submit_urls: [],
  };
}

function isSourcePage(item) {
  if (item.domain === '91wink.com') return true;
  return item.source_fields.some(field => SOURCE_PAGE_FIELDS.has(field));
}

function looksLikeSubmissionUrl(item) {
  const text = `${item.url} ${item.source_fields.join(' ')}`.toLowerCase();
  return /submit|submission|add[-_/]?tool|add[-_/]?product|list[-_/]?your|claim|vendor|products\/new|submissions\/new|showcase/.test(text);
}

function candidateRecommendation(item) {
  if (item.classification === 'exact_in_registry') return 'already_in_registry';
  if (item.classification === 'domain_in_registry_only') return 'review_submit_url';
  if (isSourcePage(item)) return 'skip_source_page';
  if (looksLikeSubmissionUrl(item)) return 'review_submit_url';
  return 'needs_manual_review';
}

function perFileStats(rootDir, files, records, items) {
  return files.map(file => {
    const sourceFile = normalizePath(relative(rootDir, file));
    const fileRecords = records.filter(record => record.source_file === sourceFile);
    const fileKeys = new Set(fileRecords.map(record => record.normalized_key));
    const fileItems = items.filter(item =>
      item.source_files.includes(sourceFile)
    );

    return {
      file: sourceFile,
      urls_found: fileRecords.length,
      unique_urls: fileKeys.size,
      exact_in_registry: fileItems.filter(item => item.classification === 'exact_in_registry').length,
      domain_in_registry_only: fileItems.filter(item => item.classification === 'domain_in_registry_only').length,
      missing_domain: fileItems.filter(item => item.classification === 'missing_domain').length,
    };
  });
}

function classificationCounts(items) {
  return {
    exact_in_registry: items.filter(item => item.classification === 'exact_in_registry').length,
    domain_in_registry_only: items.filter(item => item.classification === 'domain_in_registry_only').length,
    missing_domain: items.filter(item => item.classification === 'missing_domain').length,
  };
}

function recommendationCounts(items) {
  const counts = {};
  for (const item of items) {
    counts[item.candidate_import_recommendation] = (counts[item.candidate_import_recommendation] || 0) + 1;
  }
  return counts;
}

export function buildCoverageReport(inputDir, opts = {}) {
  const registryPath = opts.registry;
  const registry = loadRegistry(registryPath);
  const files = listFiles(inputDir, opts);

  const records = files.flatMap(file => extractFileRecords(inputDir, file));
  const aggregated = aggregateRecords(records);
  const indexes = registryIndexes(registry);
  const items = aggregated.map(item => {
    const classified = classifyCoverageItem(item, indexes);
    return {
      ...classified,
      candidate_import_recommendation: candidateRecommendation(classified),
    };
  });
  const counts = classificationCounts(items);

  return {
    generated_at: nowIso(),
    input_dir: inputDir,
    registry: registryPath || 'resources/targets.canonical.yaml',
    summary: {
      registry_targets: registry.targets.length,
      files_scanned: files.length,
      files_with_urls: new Set(records.map(record => record.source_file)).size,
      url_occurrences: records.length,
      unique_urls_in_input: items.length,
      ...counts,
    },
    recommendations: {
      do_not_import_blindly: true,
      default_import_mode: 'needs_scout',
      counts: recommendationCounts(items),
      notes: [
        'Exact matches are already covered by the canonical registry.',
        'Same-domain differences require manual URL review before changing submit_url.',
        'Missing domains should be reviewed and imported only as needs_scout unless scout evidence proves automation safety.',
      ],
    },
    by_file: perFileStats(inputDir, files, records, items),
    samples: {
      domain_in_registry_only: items.filter(item => item.classification === 'domain_in_registry_only').slice(0, 20),
      missing_domain: items.filter(item => item.classification === 'missing_domain').slice(0, 20),
    },
    items,
  };
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

export function writeCoverageReport(report, path) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function coverageCandidatesCsv(report) {
  const headers = [
    'classification',
    'candidate_import_recommendation',
    'url',
    'domain',
    'source_files',
    'source_locations',
    'registry_target_ids',
    'registry_submit_urls',
    'occurrence_count',
  ];

  const rows = report.items.map(item => [
    item.classification,
    item.candidate_import_recommendation,
    item.url,
    item.domain,
    item.source_files,
    item.source_locations,
    item.registry_target_ids,
    item.registry_submit_urls,
    item.occurrence_count,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeCoverageCandidatesCsv(report, path) {
  ensureParent(path);
  writeFileSync(path, coverageCandidatesCsv(report), 'utf-8');
}

function defaultReviewDecision(item) {
  if (item.candidate_import_recommendation === 'skip_source_page') return 'reject_source_page';
  if (item.candidate_import_recommendation === 'already_in_registry') return 'already_in_registry';
  return '';
}

function reviewInstruction(item) {
  if (item.classification === 'exact_in_registry') return 'do_not_import';
  if (item.candidate_import_recommendation === 'skip_source_page') return 'do_not_import_source_page';
  if (item.classification === 'domain_in_registry_only') return 'use_approved_domain_variant_only_if_this_is_a_distinct_valid_submit_url';
  if (item.candidate_import_recommendation === 'review_submit_url') return 'verify_submit_form_before_approval';
  return 'verify_directory_fit_before_approval';
}

function coverageReviewRows(report, opts = {}) {
  const includeExact = Boolean(opts.includeExact);
  return report.items
    .filter(item => includeExact || item.classification !== 'exact_in_registry')
    .map(item => ({
      review_decision: defaultReviewDecision(item),
      review_instruction: reviewInstruction(item),
      review_notes: '',
      reviewed_by: '',
      canonical_name: item.domain,
      submission_url_override: '',
      pricing: 'unknown',
      lang: 'unknown',
      classification: item.classification,
      candidate_import_recommendation: item.candidate_import_recommendation,
      url: item.url,
      domain: item.domain,
      source_files: item.source_files,
      source_locations: item.source_locations,
      registry_target_ids: item.registry_target_ids,
      registry_submit_urls: item.registry_submit_urls,
      occurrence_count: item.occurrence_count,
    }));
}

export function coverageReviewCsv(report, opts = {}) {
  const rows = coverageReviewRows(report, opts).map(row =>
    COVERAGE_REVIEW_HEADERS.map(header => row[header])
  );

  return [
    COVERAGE_REVIEW_HEADERS.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeCoverageReviewCsv(report, path, opts = {}) {
  ensureParent(path);
  writeFileSync(path, coverageReviewCsv(report, opts), 'utf-8');
}

function reviewDecision(row) {
  const direct = String(row.review_decision || row.decision || '').trim().toLowerCase();
  if (direct) return direct;
  const approved = String(row.approved || '').trim().toLowerCase();
  if (APPROVED_DECISIONS.has(approved)) return 'approved';
  return '';
}

function isApprovedDecision(decision) {
  return APPROVED_DECISIONS.has(decision) ||
    DOMAIN_VARIANT_APPROVALS.has(decision) ||
    DOMAIN_CHANGE_APPROVALS.has(decision);
}

function isRejectedDecision(decision) {
  return REJECTED_DECISION_PATTERN.test(decision);
}

function rowImportUrl(row) {
  return String(row.submission_url_override || row.submit_url || row.url || '').trim();
}

function numericValue(value, fallback = 0) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function lineNumberFromReviewRow(row) {
  const value = String(row.review_row || '').trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed >= 2 ? parsed : null;
}

function blockReason(row, normalized, decision) {
  const classification = String(row.classification || '').trim();
  const recommendation = String(row.candidate_import_recommendation || '').trim();
  const pricing = normalizePricing(row.pricing, row.price_text || row.status);

  if (!decision) return 'not_reviewed';
  if (isRejectedDecision(decision)) return 'rejected_by_review';
  if (!isApprovedDecision(decision)) return 'unknown_review_decision';
  if (!normalized) return 'invalid_url';
  if (classification === 'exact_in_registry') return 'already_in_registry';
  if (recommendation === 'already_in_registry') return 'already_in_registry';
  if (recommendation === 'skip_source_page') return 'source_page_not_importable';
  if (pricing === 'paid') return 'paid_candidate_not_imported';
  if (classification === 'domain_in_registry_only' && !DOMAIN_VARIANT_APPROVALS.has(decision)) {
    return 'domain_variant_needs_explicit_approval';
  }
  const originalDomain = String(row.domain || '').trim().toLowerCase();
  if (
    originalDomain &&
    normalized.domain !== originalDomain.replace(/^www\./, '') &&
    !DOMAIN_CHANGE_APPROVALS.has(decision)
  ) {
    return 'domain_change_needs_explicit_approval';
  }
  return '';
}

function reviewFinding(row, line, severity, code, message) {
  return {
    line,
    severity,
    code,
    message,
    url: rowImportUrl(row) || row.url || '',
    domain: row.domain || '',
    classification: row.classification || '',
    candidate_import_recommendation: row.candidate_import_recommendation || '',
    review_decision: reviewDecision(row),
  };
}

function splitReviewList(value) {
  return String(value || '')
    .split(/\s*;\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizedRegistrySubmitUrls(row) {
  return splitReviewList(row.registry_submit_urls)
    .map(value => normalizeUrl(value))
    .filter(Boolean);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || '').slice(0, 180);
}

function boolText(value) {
  return value ? 'yes' : 'no';
}

function htmlSignalEvidence(html, url = '') {
  const raw = String(html || '');
  const lower = raw.toLowerCase();
  const text = stripHtml(raw).toLowerCase();
  const combined = `${url}\n${text}`;
  const formCount = (raw.match(/<form\b/gi) || []).length;
  const inputCount = (raw.match(/<(input|textarea|select)\b/gi) || []).length;
  const submitButtonSignal = /type=["']?submit|>\s*(submit|add (tool|product|startup|site|app)|list (your|my)|send|publish|launch|提交|发布|收录)\b/i.test(raw);
  const submitPathSignal = /submit|submission|add[-_/]?(tool|product|site|startup|app)|products\/new|submissions\/new|vendors\/new|claim|showcase/i.test(url);
  const directorySignal = /directory|tools?|startup|submit your|add your|list your|product|saas|ai tool|marketplace|catalog|目录|导航|收录/i.test(combined);
  const authSignal = /sign\s?in|log\s?in|login|create account|register|authentication|required account|登录|注册/i.test(text);
  const oauthSignal = /continue with (google|github|twitter|x)|sign in with (google|github)|oauth|google-oauth/i.test(text);
  const captchaSignal = /captcha|recaptcha|hcaptcha|turnstile|verify you are human|robot|验证码|人机验证/i.test(lower);
  const cloudflareSignal = /cloudflare|cf-browser-verification|checking your browser|just a moment|cf-turnstile/i.test(lower);
  const paymentSignal = /stripe|checkout|payment|pricing|buy now|paid listing|\$\s?\d+|付费|收费|付款|购买/i.test(text);

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
  };
}

function suggestedEvidenceDecision(row, evidence) {
  if (evidence.fetch_error) return 'review_fetch_failed';
  if (evidence.duplicate_registry_url) return 'reject_duplicate';
  if (evidence.payment_signal) return 'reject_paid';
  if (evidence.auth_signal || evidence.oauth_signal) return 'reject_auth_required';
  if (evidence.captcha_signal || evidence.cloudflare_signal) return 'reject_auth_required';
  if (evidence.form_count > 0 && (evidence.submit_button_signal || evidence.submit_path_signal)) {
    return String(row.classification || '') === 'domain_in_registry_only'
      ? 'review_possible_domain_variant'
      : 'review_possible_submit_form';
  }
  if (!evidence.submit_path_signal && !evidence.submit_button_signal) return 'reject_not_submit';
  return 'review_manually';
}

function signalTrue(value) {
  return value === true || value === 'yes';
}

function evidenceNotes(evidence) {
  const notes = [];
  if (signalTrue(evidence.duplicate_registry_url)) notes.push('normalized URL duplicates registry submit URL');
  if (signalTrue(evidence.payment_signal)) notes.push('payment/pricing signal found');
  if (signalTrue(evidence.auth_signal)) notes.push('login/register signal found');
  if (signalTrue(evidence.oauth_signal)) notes.push('OAuth signal found');
  if (signalTrue(evidence.captcha_signal)) notes.push('CAPTCHA signal found');
  if (signalTrue(evidence.cloudflare_signal)) notes.push('Cloudflare/human verification signal found');
  if (evidence.form_count > 0) notes.push(`${evidence.form_count} form(s), ${evidence.input_count} input/select/textarea fields`);
  if (signalTrue(evidence.submit_button_signal)) notes.push('submit/add/list/publish button text signal found');
  if (signalTrue(evidence.submit_path_signal)) notes.push('URL path looks like a submission endpoint');
  if (signalTrue(evidence.directory_signal)) notes.push('directory/listing marketplace text signal found');
  if (signalTrue(evidence.domain_changed)) notes.push(`final domain changed to ${evidence.final_domain}`);
  if (evidence.fetch_error) notes.push(evidence.fetch_error);
  return notes.join('; ');
}

async function fetchTextEvidence(url, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const timeoutMs = Math.max(1000, numericValue(opts.timeoutMs, 15000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent || 'BacklinkPilotReviewEvidence/2.1',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      final_url: response.url || url,
      content_type: response.headers?.get?.('content-type') || '',
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function evidenceRowFromFailure(row, index, error, checkedAt) {
  const url = rowImportUrl(row) || row.url || '';
  const normalized = normalizeUrl(url);
  const evidence = {
    batch_id: row.batch_id || '',
    batch_order: row.batch_order || index + 1,
    review_row: row.review_row || '',
    review_action: row.review_action || '',
    url,
    domain: row.domain || normalized?.domain || '',
    http_status: '',
    fetch_ok: 'no',
    final_url: '',
    final_domain: '',
    domain_changed: 'unknown',
    content_type: '',
    title: '',
    form_count: 0,
    input_count: 0,
    submit_button_signal: 'no',
    submit_path_signal: boolText(/submit|submission|add[-_/]?(tool|product|site|startup|app)|products\/new|submissions\/new|vendors\/new|claim|showcase/i.test(url)),
    directory_signal: 'unknown',
    auth_signal: 'unknown',
    oauth_signal: 'unknown',
    captcha_signal: 'unknown',
    cloudflare_signal: 'unknown',
    payment_signal: 'unknown',
    duplicate_registry_url: 'unknown',
    suggested_decision: 'review_fetch_failed',
    fetch_error: error.message || String(error),
    checked_at: checkedAt,
  };
  evidence.evidence_notes = evidenceNotes(evidence);
  return evidence;
}

function evidenceRowFromResponse(row, index, fetched, checkedAt) {
  const url = rowImportUrl(row) || row.url || '';
  const normalized = normalizeUrl(url);
  const finalNormalized = normalizeUrl(fetched.final_url) || normalized;
  const htmlSignals = htmlSignalEvidence(fetched.text, fetched.final_url || url);
  const registryUrls = normalizedRegistrySubmitUrls(row);
  const duplicateRegistryUrl = Boolean(
    (normalized && registryUrls.some(existing => existing.dedupeKey === normalized.dedupeKey)) ||
    (finalNormalized && registryUrls.some(existing => existing.dedupeKey === finalNormalized.dedupeKey))
  );
  const domainChanged = Boolean(
    normalized?.domain &&
    finalNormalized?.domain &&
    normalized.domain !== finalNormalized.domain
  );
  const evidence = {
    batch_id: row.batch_id || '',
    batch_order: row.batch_order || index + 1,
    review_row: row.review_row || '',
    review_action: row.review_action || '',
    url,
    domain: row.domain || normalized?.domain || '',
    http_status: fetched.status,
    fetch_ok: boolText(fetched.ok),
    final_url: fetched.final_url || '',
    final_domain: finalNormalized?.domain || '',
    domain_changed: boolText(domainChanged),
    content_type: fetched.content_type,
    title: htmlSignals.title,
    form_count: htmlSignals.form_count,
    input_count: htmlSignals.input_count,
    submit_button_signal: boolText(htmlSignals.submit_button_signal),
    submit_path_signal: boolText(htmlSignals.submit_path_signal),
    directory_signal: boolText(htmlSignals.directory_signal),
    auth_signal: boolText(htmlSignals.auth_signal),
    oauth_signal: boolText(htmlSignals.oauth_signal),
    captcha_signal: boolText(htmlSignals.captcha_signal),
    cloudflare_signal: boolText(htmlSignals.cloudflare_signal),
    payment_signal: boolText(htmlSignals.payment_signal),
    duplicate_registry_url: boolText(duplicateRegistryUrl),
    fetch_error: fetched.ok ? '' : `HTTP ${fetched.status}`,
    checked_at: checkedAt,
  };
  const booleanEvidence = {
    ...evidence,
    domain_changed: domainChanged,
    submit_button_signal: htmlSignals.submit_button_signal,
    submit_path_signal: htmlSignals.submit_path_signal,
    directory_signal: htmlSignals.directory_signal,
    auth_signal: htmlSignals.auth_signal,
    oauth_signal: htmlSignals.oauth_signal,
    captcha_signal: htmlSignals.captcha_signal,
    cloudflare_signal: htmlSignals.cloudflare_signal,
    payment_signal: htmlSignals.payment_signal,
    duplicate_registry_url: duplicateRegistryUrl,
    fetch_error: evidence.fetch_error,
  };
  evidence.suggested_decision = suggestedEvidenceDecision(row, booleanEvidence);
  evidence.evidence_notes = evidenceNotes(booleanEvidence);
  return evidence;
}

export async function buildCoverageReviewEvidence(batchPath, opts = {}) {
  const rows = parseCsv(readFileSync(batchPath, 'utf-8'));
  const offset = Math.max(0, numericValue(opts.offset, 0));
  const limit = opts.limit === undefined || opts.limit === null || opts.limit === ''
    ? rows.length
    : Math.max(1, numericValue(opts.limit, rows.length));
  const selected = rows.slice(offset, offset + limit);
  const evidenceRows = [];

  for (let index = 0; index < selected.length; index += 1) {
    const row = selected[index];
    const checkedAt = nowIso();
    const url = rowImportUrl(row) || row.url || '';
    const normalized = normalizeUrl(url);
    if (!normalized) {
      evidenceRows.push(evidenceRowFromFailure(row, offset + index, new Error('invalid_url'), checkedAt));
      continue;
    }

    try {
      const fetched = await fetchTextEvidence(normalized.url, opts);
      evidenceRows.push(evidenceRowFromResponse(row, offset + index, fetched, checkedAt));
    } catch (error) {
      evidenceRows.push(evidenceRowFromFailure(row, offset + index, error, checkedAt));
    }
  }

  return {
    generated_at: nowIso(),
    batch: batchPath,
    offset,
    limit,
    total_rows: rows.length,
    checked_rows: evidenceRows.length,
    summary: evidenceRows.reduce((acc, row) => {
      acc.suggested_decisions[row.suggested_decision] = (acc.suggested_decisions[row.suggested_decision] || 0) + 1;
      if (row.auth_signal === 'yes' || row.oauth_signal === 'yes') acc.auth_signals += 1;
      if (row.captcha_signal === 'yes' || row.cloudflare_signal === 'yes') acc.captcha_or_cloudflare_signals += 1;
      if (row.payment_signal === 'yes') acc.payment_signals += 1;
      if (row.duplicate_registry_url === 'yes') acc.duplicate_registry_urls += 1;
      if (Number(row.form_count) > 0) acc.rows_with_forms += 1;
      return acc;
    }, {
      suggested_decisions: {},
      rows_with_forms: 0,
      auth_signals: 0,
      captcha_or_cloudflare_signals: 0,
      payment_signals: 0,
      duplicate_registry_urls: 0,
    }),
    evidence_rows: evidenceRows,
  };
}

export function coverageReviewEvidenceCsv(evidence) {
  const rows = evidence.evidence_rows.map(row =>
    REVIEW_EVIDENCE_HEADERS.map(header => row[header])
  );
  return [
    REVIEW_EVIDENCE_HEADERS.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeCoverageReviewEvidence(evidence, opts = {}) {
  if (opts.output) {
    ensureParent(opts.output);
    writeFileSync(opts.output, coverageReviewEvidenceCsv(evidence), 'utf-8');
  }
  if (opts.jsonOutput) {
    ensureParent(opts.jsonOutput);
    writeFileSync(opts.jsonOutput, JSON.stringify(evidence, null, 2) + '\n', 'utf-8');
  }
}

function firstExistingValue(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function evidenceMatchKeys(row) {
  const keys = [];
  const reviewRow = String(row.review_row || '').trim();
  const batchId = String(row.batch_id || '').trim();
  const batchOrder = String(row.batch_order || '').trim();
  const url = normalizeUrl(rowImportUrl(row) || row.url || '');
  const finalUrl = normalizeUrl(row.final_url || '');

  if (reviewRow) keys.push(`review_row:${reviewRow}`);
  if (batchId && batchOrder) keys.push(`batch:${batchId}:${batchOrder}`);
  if (url) keys.push(`url:${url.dedupeKey}`);
  if (finalUrl) keys.push(`url:${finalUrl.dedupeKey}`);
  return unique(keys);
}

function indexEvidenceRows(rows) {
  const indexed = new Map();
  for (const row of rows) {
    for (const key of evidenceMatchKeys(row)) {
      if (!indexed.has(key)) indexed.set(key, row);
    }
  }
  return indexed;
}

function findEvidenceForBatchRow(row, evidenceIndex) {
  for (const key of evidenceMatchKeys(row)) {
    const evidence = evidenceIndex.get(key);
    if (evidence) return { evidence, key };
  }
  return { evidence: null, key: '' };
}

function evidenceYes(row, field) {
  return String(row?.[field] || '').trim().toLowerCase() === 'yes';
}

function evidenceNumber(row, field) {
  const parsed = Number.parseInt(String(row?.[field] || ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function possibleApprovalDecision(row) {
  return String(row.classification || '') === 'domain_in_registry_only'
    ? 'approved_domain_variant'
    : 'approved';
}

const CONFIDENCE_RANKS = {
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
};

function confidenceRank(value) {
  return CONFIDENCE_RANKS[value] || 0;
}

function suggestionSummary(rows) {
  return rows.reduce((acc, row) => {
    const decision = row.suggested_review_decision || 'needs_manual_check';
    const confidence = row.suggestion_confidence || 'none';
    acc.suggested_review_decisions[decision] = (acc.suggested_review_decisions[decision] || 0) + 1;
    acc.confidence[confidence] = (acc.confidence[confidence] || 0) + 1;
    if (row.evidence_matched === 'yes') acc.evidence_matched += 1;
    else acc.evidence_missing += 1;
    if (confidenceRank(confidence) >= confidenceRank('high') && isRejectedDecision(decision)) {
      acc.high_confidence_rejections += 1;
    }
    if (row.possible_approval_decision) acc.possible_approval_after_manual_confirmation += 1;
    return acc;
  }, {
    suggested_review_decisions: {},
    confidence: {},
    evidence_matched: 0,
    evidence_missing: 0,
    high_confidence_rejections: 0,
    possible_approval_after_manual_confirmation: 0,
  });
}

function hasExplicitSubmissionPath(value) {
  try {
    const normalized = normalizeUrl(value);
    if (!normalized) return false;
    const path = new URL(normalized.url).pathname.toLowerCase();
    return /(?:^|\/)(submit|submission|submissions|add|add[-_/]?(tool|product|site|startup|app)|submit[-_/]?a[-_/]?(tool|startup|product)|new[-_/]?product|project\/new|products\/new|submissions\/new|vendors\/new|company\/create|claim|showcase)(?:\/|$|\.)/.test(path);
  } catch {
    return false;
  }
}

function isSameDomainNonSubmitCandidate(row, evidence) {
  if (String(row.classification || '') !== 'domain_in_registry_only') return false;
  const candidateUrl = rowImportUrl(row) || row.url || evidence?.url || '';
  return !hasExplicitSubmissionPath(candidateUrl);
}

function conservativeSuggestion(row, evidence) {
  if (!evidence) {
    return {
      suggested_review_decision: 'needs_manual_check',
      suggestion_confidence: 'none',
      possible_approval_decision: '',
      reviewer_action: 'collect_or_review_evidence',
      suggested_pricing: '',
      basis: ['no matching evidence row found'],
    };
  }

  const basis = [];
  const fetchOk = evidenceYes(evidence, 'fetch_ok');
  const fetchError = firstExistingValue(evidence.fetch_error, fetchOk ? '' : evidence.http_status ? `HTTP ${evidence.http_status}` : '');
  const duplicate = evidenceYes(evidence, 'duplicate_registry_url');
  const paid = evidenceYes(evidence, 'payment_signal');
  const auth = evidenceYes(evidence, 'auth_signal') || evidenceYes(evidence, 'oauth_signal');
  const challenge = evidenceYes(evidence, 'captcha_signal') || evidenceYes(evidence, 'cloudflare_signal');
  const submitSignal = evidenceYes(evidence, 'submit_button_signal') || evidenceYes(evidence, 'submit_path_signal');
  const submitSurface = evidenceYes(evidence, 'submit_path_signal') ||
    /submit|submission|add (tool|product|startup|site|app)|list your|publish|claim/i.test(`${evidence.title || ''} ${evidence.url || ''}`);
  const directorySignal = evidenceYes(evidence, 'directory_signal');
  const forms = evidenceNumber(evidence, 'form_count');
  const httpStatus = evidenceNumber(evidence, 'http_status');

  if (duplicate) {
    basis.push('normalized URL duplicates an existing registry submit URL');
    return {
      suggested_review_decision: 'reject_duplicate',
      suggestion_confidence: 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_if_registry_url_is_the_same_submission_endpoint',
      suggested_pricing: '',
      basis,
    };
  }

  if ([404, 410].includes(httpStatus)) {
    basis.push(`HTTP ${httpStatus} indicates the candidate URL is not a live submit endpoint`);
    return {
      suggested_review_decision: 'reject_not_submit',
      suggestion_confidence: 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_unless_manual_review_finds_a_current_submit_url',
      suggested_pricing: '',
      basis,
    };
  }

  if (isSameDomainNonSubmitCandidate(row, evidence)) {
    basis.push('same-domain candidate URL does not contain an explicit submission path');
    basis.push('existing registry submit URL should remain canonical unless manual review finds a distinct submit endpoint at this exact URL');
    return {
      suggested_review_decision: 'reject_not_submit',
      suggestion_confidence: 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_unless_manual_review_finds_a_distinct_submit_endpoint_at_this_exact_url',
      suggested_pricing: '',
      basis,
    };
  }

  if (paid && submitSurface) {
    basis.push('payment/pricing signal appears on a submit/listing surface');
    return {
      suggested_review_decision: 'reject_paid',
      suggestion_confidence: 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_unless_manual_review_confirms_free_submission_path',
      suggested_pricing: 'paid',
      basis,
    };
  }

  if (auth) {
    basis.push('login/register or OAuth signal found');
    return {
      suggested_review_decision: 'reject_auth_required',
      suggestion_confidence: 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_or_route_to_assisted_manual_flow',
      suggested_pricing: '',
      basis,
    };
  }

  if (challenge) {
    basis.push('CAPTCHA or Cloudflare/human-verification signal found');
    return {
      suggested_review_decision: 'reject_auth_required',
      suggestion_confidence: fetchOk ? 'medium' : 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_for_automation_unless_human_assisted_flow_is_explicitly_planned',
      suggested_pricing: '',
      basis,
    };
  }

  if (fetchError) {
    basis.push(fetchError);
    return {
      suggested_review_decision: 'needs_manual_check',
      suggestion_confidence: 'low',
      possible_approval_decision: '',
      reviewer_action: 'manual_browser_check_required_before_decision',
      suggested_pricing: '',
      basis,
    };
  }

  if (!submitSignal && !forms) {
    basis.push('no submit path, submit button, or form signal found');
    return {
      suggested_review_decision: 'reject_not_submit',
      suggestion_confidence: directorySignal ? 'medium' : 'high',
      possible_approval_decision: '',
      reviewer_action: 'reject_unless_manual_review_finds_hidden_submit_entry',
      suggested_pricing: '',
      basis,
    };
  }

  if (forms > 0 && submitSignal && directorySignal) {
    basis.push('form, submit signal, and directory/listing signal found');
    return {
      suggested_review_decision: 'needs_manual_check',
      suggestion_confidence: 'medium',
      possible_approval_decision: possibleApprovalDecision(row),
      reviewer_action: 'manual_confirm_public_free_submit_form_before_approval',
      suggested_pricing: '',
      basis,
    };
  }

  if (submitSignal) {
    basis.push('submit URL/button signal found but evidence is incomplete');
    return {
      suggested_review_decision: 'needs_manual_check',
      suggestion_confidence: 'low',
      possible_approval_decision: '',
      reviewer_action: 'manual_confirm_submit_form_and_blockers',
      suggested_pricing: '',
      basis,
    };
  }

  basis.push('evidence is ambiguous');
  return {
    suggested_review_decision: 'needs_manual_check',
    suggestion_confidence: 'low',
    possible_approval_decision: '',
    reviewer_action: 'manual_review_required',
    suggested_pricing: '',
    basis,
  };
}

function suggestionNotes(row, evidence, suggestion) {
  const notes = [
    ...suggestion.basis,
    evidence?.evidence_notes ? `evidence: ${evidence.evidence_notes}` : '',
    suggestion.possible_approval_decision
      ? `if manually confirmed, use ${suggestion.possible_approval_decision} with reviewer notes`
      : '',
    String(row.classification || '') === 'domain_in_registry_only'
      ? 'same-domain variant must not use generic approved'
      : '',
  ].filter(Boolean);
  return unique(notes).join('; ');
}

function suggestionRow(row, evidenceMatch) {
  const evidence = evidenceMatch.evidence;
  const suggestion = conservativeSuggestion(row, evidence);
  return {
    batch_id: row.batch_id || evidence?.batch_id || '',
    batch_order: row.batch_order || evidence?.batch_order || '',
    review_row: row.review_row || evidence?.review_row || '',
    priority: row.priority || '',
    review_action: row.review_action || evidence?.review_action || '',
    url: rowImportUrl(row) || row.url || evidence?.url || '',
    domain: row.domain || evidence?.domain || '',
    current_review_decision: reviewDecision(row),
    review_decision_options: row.review_decision_options || '',
    evidence_suggested_decision: evidence?.suggested_decision || '',
    suggested_review_decision: suggestion.suggested_review_decision,
    suggestion_confidence: suggestion.suggestion_confidence,
    possible_approval_decision: suggestion.possible_approval_decision,
    reviewer_action: suggestion.reviewer_action,
    suggested_review_notes: suggestionNotes(row, evidence, suggestion),
    suggested_pricing: suggestion.suggested_pricing,
    suggestion_basis: suggestion.basis.join('; '),
    evidence_matched: evidence ? 'yes' : 'no',
    evidence_match_key: evidenceMatch.key || '',
    http_status: evidence?.http_status || '',
    fetch_ok: evidence?.fetch_ok || '',
    final_url: evidence?.final_url || '',
    final_domain: evidence?.final_domain || '',
    form_count: evidence?.form_count || '',
    input_count: evidence?.input_count || '',
    submit_button_signal: evidence?.submit_button_signal || '',
    submit_path_signal: evidence?.submit_path_signal || '',
    directory_signal: evidence?.directory_signal || '',
    auth_signal: evidence?.auth_signal || '',
    oauth_signal: evidence?.oauth_signal || '',
    captcha_signal: evidence?.captcha_signal || '',
    cloudflare_signal: evidence?.cloudflare_signal || '',
    payment_signal: evidence?.payment_signal || '',
    duplicate_registry_url: evidence?.duplicate_registry_url || '',
    fetch_error: evidence?.fetch_error || '',
    checked_at: evidence?.checked_at || '',
  };
}

export function buildCoverageReviewSuggestions(batchPath, evidencePath, opts = {}) {
  const batchRows = parseCsv(readFileSync(batchPath, 'utf-8'));
  const evidenceRows = parseCsv(readFileSync(evidencePath, 'utf-8'));
  const offset = Math.max(0, numericValue(opts.offset, 0));
  const limit = opts.limit === undefined || opts.limit === null || opts.limit === ''
    ? batchRows.length
    : Math.max(1, numericValue(opts.limit, batchRows.length));
  const selected = batchRows.slice(offset, offset + limit);
  const evidenceIndex = indexEvidenceRows(evidenceRows);
  const rows = selected.map(row => suggestionRow(row, findEvidenceForBatchRow(row, evidenceIndex)));

  return {
    generated_at: nowIso(),
    batch: batchPath,
    evidence: evidencePath,
    mode_policy: 'suggestions_are_non_binding_and_do_not_modify_review_decisions',
    offset,
    limit,
    total_batch_rows: batchRows.length,
    evidence_rows: evidenceRows.length,
    suggestion_rows: rows.length,
    summary: suggestionSummary(rows),
    rows,
  };
}

export function coverageReviewSuggestionsCsv(suggestions) {
  const rows = suggestions.rows.map(row =>
    REVIEW_SUGGESTION_HEADERS.map(header => row[header])
  );
  return [
    REVIEW_SUGGESTION_HEADERS.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeCoverageReviewSuggestions(suggestions, opts = {}) {
  if (opts.output) {
    ensureParent(opts.output);
    writeFileSync(opts.output, coverageReviewSuggestionsCsv(suggestions), 'utf-8');
  }
  if (opts.jsonOutput) {
    ensureParent(opts.jsonOutput);
    writeFileSync(opts.jsonOutput, JSON.stringify(suggestions, null, 2) + '\n', 'utf-8');
  }
}

function splitDecisionOptions(value) {
  return String(value || '')
    .split('|')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function confidenceAtLeast(value, minimum) {
  const threshold = String(minimum || 'high').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(CONFIDENCE_RANKS, threshold)) {
    throw new Error(`Invalid min confidence: ${minimum}. Use high, medium, low, or none.`);
  }
  return confidenceRank(value) >= confidenceRank(threshold);
}

function normalizeConfidenceThreshold(value) {
  const threshold = String(value || 'high').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(CONFIDENCE_RANKS, threshold)) {
    throw new Error(`Invalid min confidence: ${value}. Use high, medium, low, or none.`);
  }
  return threshold;
}

function defaultDraftDecisions(opts = {}) {
  const values = splitFilterValues(opts.decisions || '');
  return new Set(values.length ? values : [
    'reject_auth_required',
    'reject_duplicate',
    'reject_not_submit',
    'reject_paid',
  ]);
}

function draftNoteFromSuggestion(suggestion) {
  const notes = [
    'drafted from read-only evidence suggestion',
    suggestion.suggestion_confidence ? `confidence: ${suggestion.suggestion_confidence}` : '',
    suggestion.suggested_review_notes || suggestion.suggestion_basis || '',
  ].filter(Boolean);
  return unique(notes).join('; ');
}

export function buildCoverageReviewDraft(batchPath, suggestionsPath, opts = {}) {
  const batchRows = parseCsv(readFileSync(batchPath, 'utf-8'));
  const suggestionRows = parseCsv(readFileSync(suggestionsPath, 'utf-8'));
  const suggestionIndex = indexEvidenceRows(suggestionRows);
  const minConfidence = normalizeConfidenceThreshold(opts.minConfidence);
  const allowedDraftDecisions = defaultDraftDecisions(opts);
  const reviewedBy = String(opts.reviewedBy || 'read_only_evidence').trim();
  const rows = batchRows.map(row => ({ ...row }));
  const drafted = [];
  const skipped = [];
  const blocked = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const currentDecision = reviewDecision(row);
    const { evidence: suggestion, key } = findEvidenceForBatchRow(row, suggestionIndex);

    if (currentDecision) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'already_has_review_decision',
      });
      return;
    }

    if (!suggestion) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'no_matching_suggestion',
      });
      return;
    }

    const suggestedDecision = String(suggestion.suggested_review_decision || '').trim().toLowerCase();
    const confidence = String(suggestion.suggestion_confidence || '').trim().toLowerCase();
    if (!isRejectedDecision(suggestedDecision)) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'suggestion_is_not_rejection',
        suggested_review_decision: suggestedDecision,
      });
      return;
    }

    if (!allowedDraftDecisions.has(suggestedDecision)) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'suggestion_rejection_not_enabled',
        suggested_review_decision: suggestedDecision,
      });
      return;
    }

    if (!confidenceAtLeast(confidence, minConfidence)) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'suggestion_confidence_below_threshold',
        suggested_review_decision: suggestedDecision,
        suggestion_confidence: confidence,
      });
      return;
    }

    const decisionOptions = splitDecisionOptions(row.review_decision_options);
    if (decisionOptions.length && !decisionOptions.includes(suggestedDecision)) {
      blocked.push({
        line,
        review_row: row.review_row || '',
        url: row.url || '',
        reason: 'suggested_decision_not_allowed_for_batch_row',
        suggested_review_decision: suggestedDecision,
        review_decision_options: row.review_decision_options || '',
      });
      return;
    }

    row.review_decision = suggestedDecision;
    row.review_notes = draftNoteFromSuggestion(suggestion);
    if (reviewedBy) row.reviewed_by = reviewedBy;
    if (
      suggestion.suggested_pricing &&
      (!String(row.pricing || '').trim() || String(row.pricing || '').trim().toLowerCase() === 'unknown')
    ) {
      row.pricing = suggestion.suggested_pricing;
    }

    drafted.push({
      line,
      review_row: row.review_row || '',
      url: row.url || '',
      domain: row.domain || '',
      suggested_review_decision: suggestedDecision,
      suggestion_confidence: confidence,
      suggestion_match_key: key,
    });
  });

  const priorityCounts = rows.reduce((acc, row) => {
    acc[row.priority] = (acc[row.priority] || 0) + 1;
    return acc;
  }, {});
  const actionCounts = rows.reduce((acc, row) => {
    acc[row.review_action] = (acc[row.review_action] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: nowIso(),
    batch: batchPath,
    suggestions: suggestionsPath,
    batch_id: firstExistingValue(...rows.map(row => row.batch_id)),
    mode_policy: 'drafts_rejections_only_no_approvals_no_registry_changes',
    min_confidence: minConfidence,
    reviewed_by: reviewedBy,
    enabled_rejection_decisions: [...allowedDraftDecisions],
    batch_rows: rows.length,
    suggestion_rows: suggestionRows.length,
    drafted_rows: drafted.length,
    skipped_rows: skipped.length,
    blocked_rows: blocked.length,
    priority_counts: priorityCounts,
    action_counts: actionCounts,
    rows,
    drafted,
    skipped,
    blocked,
  };
}

export function writeCoverageReviewDraft(draft, opts = {}) {
  if (opts.output) {
    ensureParent(opts.output);
    writeFileSync(opts.output, coverageReviewBatchCsv(draft), 'utf-8');
  }
  if (opts.jsonOutput) {
    const { rows, ...publicDraft } = draft;
    ensureParent(opts.jsonOutput);
    writeFileSync(opts.jsonOutput, JSON.stringify(publicDraft, null, 2) + '\n', 'utf-8');
  }
}

function reviewQualityFindings(row, line, opts = {}) {
  const decision = reviewDecision(row);
  const blockers = [];
  const warnings = [];
  const classification = String(row.classification || '').trim();
  const recommendation = String(row.candidate_import_recommendation || '').trim();
  const pricing = normalizePricing(row.pricing, row.price_text || row.status);
  const normalized = normalizeUrl(rowImportUrl(row));
  const originalDomain = String(row.domain || '').trim().toLowerCase().replace(/^www\./, '');
  const requireReviewer = opts.requireReviewer !== false;
  const requireReviewNotes = opts.requireReviewNotes !== false;

  if (!decision) return { blockers, warnings };
  if (isRejectedDecision(decision)) return { blockers, warnings };

  if (!isApprovedDecision(decision)) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'unknown_review_decision',
      'Review decision is non-empty but is not an approved or rejected decision.'
    ));
    return { blockers, warnings };
  }

  if (!normalized) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_invalid_url',
      'Approved review row does not resolve to a valid HTTP(S) import URL.'
    ));
  }

  if (requireReviewer && !String(row.reviewed_by || '').trim()) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_missing_reviewed_by',
      'Approved review row must record who performed the human review.'
    ));
  }

  if (requireReviewNotes && !String(row.review_notes || '').trim()) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_missing_review_notes',
      'Approved review row must include reviewer notes describing the evidence checked.'
    ));
  }

  if (classification === 'exact_in_registry' || recommendation === 'already_in_registry') {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_already_in_registry',
      'Already-covered rows must not be approved for import.'
    ));
  }

  if (recommendation === 'skip_source_page') {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_source_page',
      'Source/index pages must not be approved as importable submit targets.'
    ));
  }

  if (pricing === 'paid') {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'approved_paid_candidate',
      'Paid candidates cannot be imported through the coverage review path.'
    ));
  }

  if (pricing === 'unknown') {
    warnings.push(reviewFinding(
      row,
      line,
      'warning',
      'approved_unknown_pricing',
      'Approved row has unknown pricing and must be checked before any free-only execution plan.'
    ));
  }

  if (classification === 'domain_in_registry_only' && !DOMAIN_VARIANT_APPROVALS.has(decision)) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'domain_variant_needs_explicit_approval',
      'Same-domain variants require approved_domain_variant, not generic approved.'
    ));
  }

  if (DOMAIN_VARIANT_APPROVALS.has(decision)) {
    const registryUrls = normalizedRegistrySubmitUrls(row);
    if (classification !== 'domain_in_registry_only') {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'domain_variant_approval_wrong_classification',
        'approved_domain_variant is only valid for domain_in_registry_only rows.'
      ));
    }
    if (!registryUrls.length) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'domain_variant_missing_registry_context',
        'approved_domain_variant requires existing registry submit URLs for comparison.'
      ));
    }
    if (normalized && registryUrls.some(existing => existing.dedupeKey === normalized.dedupeKey)) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'domain_variant_duplicates_registry_url',
        'approved_domain_variant points to a URL already present in the registry.'
      ));
    }
  }

  if (normalized && originalDomain && normalized.domain !== originalDomain && !DOMAIN_CHANGE_APPROVALS.has(decision)) {
    blockers.push(reviewFinding(
      row,
      line,
      'blocker',
      'domain_change_needs_explicit_approval',
      'Changing the candidate domain requires approved_domain_change.'
    ));
  }

  if (DOMAIN_CHANGE_APPROVALS.has(decision)) {
    if (!String(row.submission_url_override || '').trim()) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'domain_change_requires_submission_url_override',
        'approved_domain_change must use submission_url_override so the original extracted URL remains auditable.'
      ));
    }
    if (normalized && originalDomain && normalized.domain === originalDomain) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'domain_change_without_changed_domain',
        'approved_domain_change was used but the import URL domain did not change.'
      ));
    }
  }

  if (recommendation === 'needs_manual_review') {
    warnings.push(reviewFinding(
      row,
      line,
      'warning',
      'approved_manual_review_candidate',
      'Approved row came from a broad manual-review bucket; scout evidence is mandatory before any execution.'
    ));
  }

  return { blockers, warnings };
}

function countReviewDecisions(rows) {
  const counts = {
    approved: 0,
    rejected: 0,
    unreviewed: 0,
    unknown_decision: 0,
  };

  for (const row of rows) {
    const decision = reviewDecision(row);
    if (!decision) counts.unreviewed += 1;
    else if (isApprovedDecision(decision)) counts.approved += 1;
    else if (isRejectedDecision(decision)) counts.rejected += 1;
    else counts.unknown_decision += 1;
  }

  return counts;
}

function validateCoverageReviewRows(rows, opts = {}) {
  const blockers = [];
  const warnings = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const findings = reviewQualityFindings(row, line, opts);
    blockers.push(...findings.blockers);
    warnings.push(...findings.warnings);
  });

  return {
    generated_at: nowIso(),
    rows: rows.length,
    ...countReviewDecisions(rows),
    ok: blockers.length === 0,
    blockers_count: blockers.length,
    warnings_count: warnings.length,
    blockers,
    warnings,
  };
}

export function validateCoverageReview(reviewPath, opts = {}) {
  const rows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  return {
    review: reviewPath,
    ...validateCoverageReviewRows(rows, opts),
  };
}

function allowedBatchDecisions(row) {
  return String(row.review_decision_options || '')
    .split('|')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function validateCoverageReviewBatchRows(rows, opts = {}) {
  const base = validateCoverageReviewRows(rows, opts);
  const blockers = [...base.blockers];
  const warnings = [...base.warnings];
  const seenReviewRows = new Set();

  rows.forEach((row, index) => {
    const line = index + 2;
    const reviewLine = lineNumberFromReviewRow(row);
    if (!reviewLine) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'batch_missing_or_invalid_review_row',
        'Batch row must retain a valid review_row value from the source review CSV.'
      ));
    } else if (seenReviewRows.has(reviewLine)) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'batch_duplicate_review_row',
        'Batch contains the same review_row more than once.'
      ));
    } else {
      seenReviewRows.add(reviewLine);
    }

    const decision = reviewDecision(row);
    if (!decision || isRejectedDecision(decision)) return;
    const allowed = allowedBatchDecisions(row);
    if (!allowed.length) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'batch_missing_decision_options',
        'Approved batch rows must retain review_decision_options from the queue.'
      ));
      return;
    }
    if (!allowed.includes(decision)) {
      blockers.push(reviewFinding(
        row,
        line,
        'blocker',
        'batch_decision_not_allowed',
        'Review decision is not one of the decision options allowed for this queue row.'
      ));
    }
  });

  return {
    ...base,
    ok: blockers.length === 0,
    blockers_count: blockers.length,
    warnings_count: warnings.length,
    blockers,
    warnings,
  };
}

export function validateCoverageReviewBatch(batchPath, opts = {}) {
  const rows = parseCsv(readFileSync(batchPath, 'utf-8'));
  return {
    batch: batchPath,
    ...validateCoverageReviewBatchRows(rows, opts),
  };
}

function forceNonExecutableImportMode(target) {
  if (['manual_strategic', 'skip'].includes(target.submission?.mode)) return target;
  return {
    ...target,
    auto: '',
    original_auto: '',
    technical: {
      ...(target.technical || {}),
      last_scouted_at: null,
      auth: 'unknown',
      captcha: 'unknown',
      reachable: 'unknown',
    },
    submission: {
      ...(target.submission || {}),
      mode: 'needs_scout',
      status: 'new',
      reason: 'coverage_review_approved_needs_scout',
      last_submitted_at: null,
      last_verified_at: null,
    },
    quality: {
      ...(target.quality || {}),
      risk: 'unknown',
    },
  };
}

function targetFromReviewRow(row, normalized, opts = {}) {
  const now = nowIso();
  const name = String(row.canonical_name || row.title || row.name || row.domain || normalized.domain).trim();
  const notes = [
    row.review_notes ? `review_notes: ${row.review_notes}` : '',
    row.review_instruction ? `review_instruction: ${row.review_instruction}` : '',
  ].filter(Boolean).join('\n');
  const target = canonicalTargetFromRow({
    title: name || normalized.domain,
    submission_link: normalized.url,
    pricing: row.pricing || 'unknown',
    price_text: row.price_text || '',
    lang: row.lang || opts.lang || 'unknown',
    group: row.group || opts.group || 'coverage-review',
    type: 'form',
    notes,
    source_files: row.source_files,
    source_locations: row.source_locations,
    occurrence_count: row.occurrence_count,
  }, {
    source: opts.source || 'coverage-review',
  });

  if (!target) return null;
  const safeTarget = forceNonExecutableImportMode(target);
  return {
    ...safeTarget,
    source_meta: {
      ...(safeTarget.source_meta || {}),
      coverage_classification: row.classification || '',
      coverage_recommendation: row.candidate_import_recommendation || '',
      coverage_registry_target_ids: row.registry_target_ids || '',
      coverage_registry_submit_urls: row.registry_submit_urls || '',
      coverage_review_decision: reviewDecision(row),
      coverage_reviewed_by: row.reviewed_by || '',
      coverage_reviewed_at: opts.reviewedAt || now,
      coverage_original_url: row.url || '',
      coverage_original_domain: row.domain || '',
    },
  };
}

function importCoverageReviewRows(registryPath, reviewLabel, rows, opts = {}) {
  const registry = loadRegistry(registryPath);
  const validation = validateCoverageReviewRows(rows, opts);
  const validationBlockersByLine = new Map();
  for (const blocker of validation.blockers) {
    if (!validationBlockersByLine.has(blocker.line)) {
      validationBlockersByLine.set(blocker.line, blocker);
    }
  }
  const incoming = [];
  const skipped = [];
  const blocked = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const decision = reviewDecision(row);
    const normalized = normalizeUrl(rowImportUrl(row));
    const validationBlocker = validationBlockersByLine.get(line);
    const reason = blockReason(row, normalized, decision) || validationBlocker?.code || '';

    if (reason) {
      const entry = {
        line,
        url: rowImportUrl(row) || row.url || '',
        domain: row.domain || normalized?.domain || '',
        classification: row.classification || '',
        review_decision: decision,
        reason,
        message: validationBlocker?.message || '',
      };
      if (!decision || isRejectedDecision(decision)) skipped.push(entry);
      else blocked.push(entry);
      return;
    }

    const target = targetFromReviewRow(row, normalized, opts);
    if (!target) {
      blocked.push({
        line,
        url: rowImportUrl(row),
        domain: row.domain || '',
        classification: row.classification || '',
        review_decision: decision,
        reason: 'target_conversion_failed',
      });
      return;
    }
    incoming.push(target);
  });

  const blockedImport = blocked.length > 0 && !opts.allowPartial;
  const importable = blockedImport ? [] : incoming;
  const merged = mergeTargets(registry.targets || [], importable);
  const saved = opts.dryRun || blockedImport
    ? { targets: registry.targets || [] }
    : saveRegistry({ ...registry, targets: merged.targets }, registryPath);

  return {
    path: registryPath,
    review: reviewLabel,
    dry_run: Boolean(opts.dryRun),
    blocked_import: blockedImport,
    rows: rows.length,
    approved_rows: incoming.length,
    imported: importable.length,
    would_import: incoming.length,
    duplicates: merged.duplicates,
    renamed_ids: merged.renamed_ids || 0,
    skipped: skipped.length,
    blocked: blocked.length,
    registry_total: (registry.targets || []).length,
    resulting_total: blockedImport ? (registry.targets || []).length : merged.targets.length,
    total: saved.targets.length,
    review_validation: validation,
    mode_policy: 'approved_rows_imported_as_non_executable_needs_scout_unless_manual_or_skip',
    imported_targets: importable.map(target => ({
      id: target.id,
      mode: target.submission?.mode,
      pricing: target.pricing,
      submit_url: target.submit_url,
    })),
    skipped_rows: skipped,
    blocked_rows: blocked,
  };
}

export function importCoverageReview(registryPath, reviewPath, opts = {}) {
  const rows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  return importCoverageReviewRows(registryPath, reviewPath, rows, opts);
}

function reviewQueuePriority(row) {
  const decision = reviewDecision(row);
  const classification = String(row.classification || '').trim();
  const recommendation = String(row.candidate_import_recommendation || '').trim();
  const url = rowImportUrl(row).toLowerCase();
  const sourceFiles = String(row.source_files || '').toLowerCase();
  const occurrenceCount = numericValue(row.occurrence_count, 1);

  if (isRejectedDecision(decision) || recommendation === 'skip_source_page') {
    return {
      priority: 'P9',
      score: 0,
      action: 'skip_rejected_or_source_page',
      decision_options: 'leave_rejected',
    };
  }

  if (classification === 'exact_in_registry' || recommendation === 'already_in_registry') {
    return {
      priority: 'P9',
      score: 0,
      action: 'skip_already_in_registry',
      decision_options: 'leave_already_in_registry',
    };
  }

  let score = 0;
  if (recommendation === 'review_submit_url') score += 100;
  if (classification === 'domain_in_registry_only') score += 75;
  if (classification === 'missing_domain') score += 25;
  if (/submit|submission|add[-_/]?(tool|product|site|startup|app)|products\/new|submissions\/new|vendors\/new|claim|showcase/.test(url)) score += 50;
  if (/coverage|directory-submissions|notion|91wink/.test(sourceFiles)) score += 10;
  score += Math.min(occurrenceCount, 10);

  if (classification === 'domain_in_registry_only') {
    score += 100;
    return {
      priority: 'P0',
      score,
      action: 'verify_distinct_submit_url_for_existing_domain',
      decision_options: 'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required',
    };
  }

  if (recommendation === 'review_submit_url') {
    return {
      priority: 'P0',
      score,
      action: 'verify_submit_form_then_approve_or_reject',
      decision_options: 'approved | reject_not_submit | reject_paid | reject_auth_required',
    };
  }

  if (/submit|add[-_/]?(tool|product|site|startup|app)|claim|showcase/.test(url)) {
    return {
      priority: 'P1',
      score,
      action: 'verify_possible_submit_url',
      decision_options: 'approved | reject_not_submit | reject_paid | reject_auth_required',
    };
  }

  return {
    priority: 'P2',
    score,
    action: 'verify_directory_fit_before_any_approval',
    decision_options: 'approved | reject_not_directory | reject_not_submit | reject_paid',
  };
}

function compareReviewQueueRows(a, b) {
  const priority = a.priority.localeCompare(b.priority);
  if (priority) return priority;
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  return String(a.domain).localeCompare(String(b.domain)) ||
    String(a.url).localeCompare(String(b.url));
}

export function buildCoverageReviewQueue(reviewPath, opts = {}) {
  const rows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  const includeSkipped = Boolean(opts.includeSkipped);
  const queue = rows
    .map((row, index) => {
      const priority = reviewQueuePriority(row);
      return {
        ...row,
        review_row: index + 2,
        priority: priority.priority,
        priority_score: priority.score,
        review_action: priority.action,
        review_decision_options: priority.decision_options,
      };
    })
    .filter(row => includeSkipped || row.priority !== 'P9')
    .sort(compareReviewQueueRows);

  const counts = queue.reduce((acc, row) => {
    acc[row.priority] = (acc[row.priority] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: nowIso(),
    review: reviewPath,
    include_skipped: includeSkipped,
    total_review_rows: rows.length,
    queue_rows: queue.length,
    priority_counts: counts,
    instructions: [
      'Review P0 rows first; they are most likely to be valid submit URLs or same-domain submit URL conflicts.',
      'Do not approve paid, source-page, login-only, CAPTCHA-only, or non-directory pages.',
      'Use approved_domain_variant only when a same-domain URL is a distinct valid submit endpoint.',
      'Approved rows still import as needs_scout and cannot execute until scout and target audit pass.',
    ],
    rows: queue,
  };
}

export function coverageReviewQueueCsv(queue) {
  const rows = queue.rows.map(row =>
    REVIEW_QUEUE_HEADERS.map(header => row[header])
  );
  return [
    REVIEW_QUEUE_HEADERS.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeCoverageReviewQueue(queue, path) {
  ensureParent(path);
  writeFileSync(path, coverageReviewQueueCsv(queue), 'utf-8');
}

function splitFilterValues(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function batchIdFromOpts(opts = {}) {
  if (opts.batchId) return String(opts.batchId);
  const priority = splitFilterValues(opts.priority || 'P0').join('-') || 'all';
  const offset = numericValue(opts.offset, 0);
  const limit = numericValue(opts.limit, 25);
  return `coverage-review-${priority.toLowerCase()}-${offset + 1}-${offset + limit}`;
}

export function buildCoverageReviewBatch(queuePath, opts = {}) {
  const rows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const priorities = new Set(splitFilterValues(opts.priority || 'P0'));
  const actions = new Set(splitFilterValues(opts.action || ''));
  const offset = Math.max(0, numericValue(opts.offset, 0));
  const limit = Math.max(1, numericValue(opts.limit, 25));
  const batchId = batchIdFromOpts({ ...opts, offset, limit });
  const filtered = rows.filter(row => {
    if (priorities.size && !priorities.has(row.priority)) return false;
    if (actions.size && !actions.has(row.review_action)) return false;
    return true;
  });
  const selected = filtered.slice(offset, offset + limit).map((row, index) => ({
    ...row,
    batch_id: batchId,
    batch_order: offset + index + 1,
  }));
  const actionCounts = selected.reduce((acc, row) => {
    acc[row.review_action] = (acc[row.review_action] || 0) + 1;
    return acc;
  }, {});
  const priorityCounts = selected.reduce((acc, row) => {
    acc[row.priority] = (acc[row.priority] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: nowIso(),
    queue: queuePath,
    batch_id: batchId,
    priority_filter: [...priorities],
    action_filter: [...actions],
    offset,
    limit,
    matching_rows: filtered.length,
    batch_rows: selected.length,
    remaining_after_batch: Math.max(0, filtered.length - offset - selected.length),
    priority_counts: priorityCounts,
    action_counts: actionCounts,
    instructions: [
      'Edit only review_decision, review_notes, reviewed_by, submission_url_override, canonical_name, pricing, and lang.',
      'Use approved only for verified public submit forms with no paid, login-only, CAPTCHA-only, or source-page blocker.',
      'Use approved_domain_variant only when a same-domain URL is a distinct valid submit endpoint and not a duplicate registry URL.',
      'Use reject_not_submit, reject_duplicate, reject_paid, reject_auth_required, or reject_not_directory when evidence is insufficient.',
      'After editing, run validate-coverage-review-batch and promote-coverage-review-batch --dry-run before writing any updated review CSV.',
    ],
    rows: selected,
  };
}

export function coverageReviewBatchCsv(batch) {
  const rows = batch.rows.map(row =>
    REVIEW_BATCH_HEADERS.map(header => row[header])
  );
  return [
    REVIEW_BATCH_HEADERS.join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function coverageReviewBatchMarkdown(batch) {
  const lines = [
    `# Coverage Review Batch: ${batch.batch_id}`,
    '',
    `Generated: ${batch.generated_at}`,
    `Queue: ${batch.queue}`,
    `Priority filter: ${batch.priority_filter.join(', ') || '(all)'}`,
    `Action filter: ${batch.action_filter.join(', ') || '(all)'}`,
    `Offset: ${batch.offset}`,
    `Limit: ${batch.limit}`,
    `Matching rows: ${batch.matching_rows}`,
    `Batch rows: ${batch.batch_rows}`,
    `Remaining after batch: ${batch.remaining_after_batch}`,
    `Priority counts: ${JSON.stringify(batch.priority_counts)}`,
    `Action counts: ${JSON.stringify(batch.action_counts)}`,
    '',
    '## Review Rules',
    '',
    ...batch.instructions.map(item => `- ${item}`),
    '',
    '## Promotion Gate',
    '',
    'Validate the edited batch first:',
    '',
    '```bash',
    `node src/cli.js targets validate-coverage-review-batch <batch.csv> --fail-on-blockers`,
    '```',
    '',
    'Then run the full promotion gate. This validates the batch, simulates applying it to the source review CSV, validates the updated review CSV, and runs an import dry-run against the registry:',
    '',
    '```bash',
    `node src/cli.js targets promote-coverage-review-batch <coverage-review.csv> <batch.csv> --registry resources/targets.canonical.yaml --output <coverage-review.updated.csv> --dry-run`,
    '```',
    '',
    'Only remove `--dry-run` after the promotion result is OK. Promotion never submits to external sites and import dry-run never changes the registry.',
    '',
    '## Decision Vocabulary',
    '',
    '- `approved`: verified public submit form; no auth/CAPTCHA/payment/source-page blocker.',
    '- `approved_domain_variant`: same-domain candidate is a distinct valid submit endpoint, not a duplicate.',
    '- `reject_not_submit`: page is not a submission endpoint.',
    '- `reject_duplicate`: already represented by an existing registry submit URL.',
    '- `reject_paid`: paid listing or paid-only submission.',
    '- `reject_auth_required`: login/OAuth is required before submission.',
    '- `reject_not_directory`: not a relevant directory/listing surface.',
    '',
    '## Rows',
    '',
    '| order | review_row | priority | action | domain | url | decision options |',
    '|---:|---:|---|---|---|---|---|',
    ...batch.rows.map(row => [
      row.batch_order,
      row.review_row,
      row.priority,
      row.review_action,
      row.domain,
      row.url,
      row.review_decision_options,
    ].map(value => String(value || '').replace(/\|/g, '\\|')).join(' | ')).map(line => `| ${line} |`),
    '',
  ];
  return lines.join('\n');
}

export function writeCoverageReviewBatch(batch, opts = {}) {
  if (opts.output) {
    ensureParent(opts.output);
    writeFileSync(opts.output, coverageReviewBatchCsv(batch), 'utf-8');
  }
  if (opts.markdown) {
    ensureParent(opts.markdown);
    writeFileSync(opts.markdown, coverageReviewBatchMarkdown(batch), 'utf-8');
  }
}

function coverageReviewRowsCsv(rows) {
  const csvRows = rows.map(row =>
    COVERAGE_REVIEW_HEADERS.map(header => row[header])
  );
  return [
    COVERAGE_REVIEW_HEADERS.join(','),
    ...csvRows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

function applyCoverageReviewQueueRows(reviewRows, queueRows, opts = {}) {
  const queueValidation = validateCoverageReviewBatchRows(queueRows, {
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });
  const updatedRows = reviewRows.map(row => ({ ...row }));
  const applied = [];
  const skipped = [];
  const blocked = queueValidation.blockers.map(item => ({
    line: item.line,
    review_row: lineNumberFromReviewRow({
      review_row: queueRows[item.line - 2]?.review_row,
    }) || queueRows[item.line - 2]?.review_row || '',
    reason: item.code,
    url: item.url,
    domain: item.domain,
    message: item.message,
  }));
  const seenReviewRows = new Set();

  if (queueValidation.ok) queueRows.forEach((row, index) => {
    const line = index + 2;
    const reviewLine = lineNumberFromReviewRow(row);
    if (!reviewLine) {
      skipped.push({
        line,
        review_row: row.review_row || '',
        reason: 'missing_or_invalid_review_row',
      });
      return;
    }

    if (seenReviewRows.has(reviewLine)) {
      blocked.push({
        line,
        review_row: reviewLine,
        reason: 'duplicate_review_row_in_queue',
      });
      return;
    }
    seenReviewRows.add(reviewLine);

    const reviewIndex = reviewLine - 2;
    const target = updatedRows[reviewIndex];
    if (!target) {
      blocked.push({
        line,
        review_row: reviewLine,
        reason: 'review_row_out_of_range',
      });
      return;
    }

    const queueUrl = String(row.url || '').trim();
    const reviewUrl = String(target.url || '').trim();
    const queueDomain = String(row.domain || '').trim().toLowerCase();
    const reviewDomain = String(target.domain || '').trim().toLowerCase();
    if ((queueUrl && reviewUrl && queueUrl !== reviewUrl) || (queueDomain && reviewDomain && queueDomain !== reviewDomain)) {
      blocked.push({
        line,
        review_row: reviewLine,
        reason: 'review_row_identity_mismatch',
        queue_url: queueUrl,
        review_url: reviewUrl,
      });
      return;
    }

    const changed = {};
    for (const field of REVIEW_QUEUE_EDITABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
      const nextValue = row[field] ?? '';
      if (String(target[field] ?? '') === String(nextValue)) continue;
      changed[field] = {
        from: target[field] ?? '',
        to: nextValue,
      };
      target[field] = nextValue;
    }

    if (Object.keys(changed).length) {
      applied.push({
        line,
        review_row: reviewLine,
        url: target.url || '',
        domain: target.domain || '',
        changed,
      });
    } else {
      skipped.push({
        line,
        review_row: reviewLine,
        reason: 'no_editable_changes',
      });
    }
  });

  const validationBlocked = !queueValidation.ok;
  const blockedApply = blocked.length > 0 && (validationBlocked || !opts.allowPartial);

  return {
    dry_run: Boolean(opts.dryRun),
    in_place: Boolean(opts.inPlace),
    allow_partial: Boolean(opts.allowPartial),
    validation_blocked: validationBlocked,
    blocked_apply: blockedApply,
    review_rows: reviewRows.length,
    queue_rows: queueRows.length,
    applied_rows: blockedApply ? 0 : applied.length,
    skipped_rows: skipped.length,
    blocked_rows: blocked.length,
    editable_fields: REVIEW_QUEUE_EDITABLE_FIELDS,
    queue_validation: queueValidation,
    updated_rows: updatedRows,
    applied,
    skipped,
    blocked,
  };
}

export function applyCoverageReviewQueue(reviewPath, queuePath, opts = {}) {
  const reviewRows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  const queueRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const output = opts.output || (opts.inPlace ? reviewPath : '');
  const result = applyCoverageReviewQueueRows(reviewRows, queueRows, opts);
  if (!opts.dryRun && output && !result.blocked_apply) {
    ensureParent(output);
    writeFileSync(output, coverageReviewRowsCsv(result.updated_rows), 'utf-8');
  }
  const { updated_rows, ...publicResult } = result;

  return {
    review: reviewPath,
    queue: queuePath,
    output,
    ...publicResult,
  };
}

export function promoteCoverageReviewBatch(registryPath, reviewPath, batchPath, opts = {}) {
  const reviewRows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  const batchRows = parseCsv(readFileSync(batchPath, 'utf-8'));
  const output = opts.output || '';
  const apply = applyCoverageReviewQueueRows(reviewRows, batchRows, {
    dryRun: Boolean(opts.dryRun),
    allowPartial: Boolean(opts.allowPartial),
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });

  let status = 'ready';
  let updatedReviewValidation = null;
  let importDryRun = null;
  let ok = !apply.blocked_apply;

  if (!ok) {
    status = apply.validation_blocked ? 'blocked_batch_validation' : 'blocked_apply';
  } else {
    updatedReviewValidation = validateCoverageReviewRows(apply.updated_rows, {
      requireReviewer: opts.requireReviewer !== false,
      requireReviewNotes: opts.requireReviewNotes !== false,
    });
    ok = updatedReviewValidation.ok;
    if (!ok) {
      status = 'blocked_updated_review_validation';
    } else {
      importDryRun = importCoverageReviewRows(
        registryPath,
        output || reviewPath,
        apply.updated_rows,
        {
          source: opts.source || 'coverage-review',
          group: opts.group || 'coverage-review',
          lang: opts.lang,
          dryRun: true,
          allowPartial: Boolean(opts.allowPartial),
          requireReviewer: opts.requireReviewer !== false,
          requireReviewNotes: opts.requireReviewNotes !== false,
        }
      );
      ok = !importDryRun.blocked_import;
      if (!ok) status = 'blocked_import_dry_run';
    }
  }

  const wroteOutput = Boolean(ok && output && !opts.dryRun);
  if (wroteOutput) {
    ensureParent(output);
    writeFileSync(output, coverageReviewRowsCsv(apply.updated_rows), 'utf-8');
  }

  const { updated_rows, ...applySummary } = apply;
  return {
    generated_at: nowIso(),
    ok,
    status,
    registry: registryPath,
    review: reviewPath,
    batch: batchPath,
    output,
    dry_run: Boolean(opts.dryRun),
    wrote_output: wroteOutput,
    mode_policy: 'promotion_validates_batch_applies_review_validates_updated_review_and_runs_import_dry_run',
    apply: applySummary,
    updated_review_validation: updatedReviewValidation,
    import_dry_run: importDryRun,
  };
}

export function writeCoverageReviewPromotionReport(result, path) {
  ensureParent(path);
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n', 'utf-8');
}

function reviewRowKey(row) {
  return `${String(row.review_row || '').trim()}|${String(rowImportUrl(row) || row.url || '').trim()}`;
}

function dateValue(row, field = 'checked_at') {
  const parsed = Date.parse(row?.[field] || row?.generated_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function newerReviewRecord(current, candidate, field = 'checked_at') {
  if (!current) return candidate;
  const currentDate = dateValue(current, field);
  const candidateDate = dateValue(candidate, field);
  if (candidateDate > currentDate) return candidate;
  if (candidateDate === currentDate) {
    const currentBatch = String(current.batch_id || '');
    const candidateBatch = String(candidate.batch_id || '');
    if (candidateBatch.localeCompare(currentBatch) > 0) return candidate;
  }
  return current;
}

function incrementCount(counts, key) {
  const normalized = key || '(blank)';
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function latestCoverageReviewHistory(batchDir, currentKeys) {
  const evidenceByKey = new Map();
  const suggestionByKey = new Map();
  const blockedByKey = new Map();
  if (!batchDir || !existsSync(batchDir)) {
    return { evidenceByKey, suggestionByKey, blockedByKey };
  }

  for (const file of readdirSync(batchDir)) {
    const fullPath = join(batchDir, file);
    if (!statSync(fullPath).isFile()) continue;

    if (file.endsWith('-evidence.csv')) {
      for (const row of parseCsv(readFileSync(fullPath, 'utf-8'))) {
        const key = reviewRowKey(row);
        if (!currentKeys.has(key)) continue;
        evidenceByKey.set(key, newerReviewRecord(evidenceByKey.get(key), {
          ...row,
          source_evidence_file: file,
        }));
      }
    }

    if (file.endsWith('-suggestions.csv')) {
      for (const row of parseCsv(readFileSync(fullPath, 'utf-8'))) {
        const key = reviewRowKey(row);
        if (!currentKeys.has(key)) continue;
        suggestionByKey.set(key, newerReviewRecord(suggestionByKey.get(key), {
          ...row,
          source_suggestion_file: file,
        }));
      }
    }

    if (file.endsWith('-draft-report.json')) {
      const report = JSON.parse(readFileSync(fullPath, 'utf-8'));
      for (const row of report.blocked || []) {
        const key = reviewRowKey(row);
        if (!currentKeys.has(key)) continue;
        blockedByKey.set(key, newerReviewRecord(blockedByKey.get(key), {
          ...row,
          generated_at: report.generated_at,
          batch_id: report.batch_id,
          source_draft_report_file: file,
        }, 'generated_at'));
      }
    }
  }

  return { evidenceByKey, suggestionByKey, blockedByKey };
}

function manualReviewBucket(queueRow, suggestion, evidence, blocked) {
  if (!suggestion && !evidence) return 'no_read_only_evidence_yet';
  if (blocked) return 'safety_gate_blocked_auto_rejection';
  if (suggestion?.suggested_review_decision === 'needs_manual_check') {
    if (suggestion.evidence_suggested_decision === 'review_fetch_failed') return 'fetch_failed_cannot_decide';
    if (suggestion.reviewer_action === 'manual_confirm_submit_form_and_blockers') return 'manual_submit_form_confirmation_required';
    return 'manual_browser_check_required';
  }
  if (suggestion?.suggestion_confidence === 'medium') return 'medium_confidence_requires_human_confirmation';
  if (suggestion?.suggestion_confidence === 'low') return 'low_confidence_requires_human_confirmation';
  if (queueRow.review_action === 'verify_directory_fit_before_any_approval') return 'directory_fit_requires_human_confirmation';
  if (queueRow.review_action === 'verify_distinct_submit_url_for_existing_domain') return 'same_domain_submit_url_requires_human_confirmation';
  if (evidence?.suggested_decision === 'review_fetch_failed') return 'fetch_failed_cannot_decide';
  return 'manual_confirmation_required';
}

function manualReviewRiskLevel(queueRow, suggestion, evidence, blocked) {
  if (blocked) return 'high_manual_risk';
  if (queueRow.priority === 'P0') return 'high_priority_manual';
  if (suggestion?.suggestion_confidence === 'low' || evidence?.suggested_decision === 'review_fetch_failed') return 'unknown_manual_risk';
  if (queueRow.review_action === 'verify_directory_fit_before_any_approval') return 'fit_risk';
  return 'manual_risk';
}

function manualReviewNextStep(queueRow, suggestion, evidence, blocked) {
  if (blocked) {
    return 'Open in a normal browser, verify directory fit and submit path, then edit review decision manually only if evidence is clear.';
  }
  if (!suggestion && !evidence) return 'Collect read-only evidence or open manually before any decision.';
  if (queueRow.review_action === 'verify_distinct_submit_url_for_existing_domain') {
    return 'Confirm this URL is a distinct valid submit URL from existing registry URLs; reject duplicate or invalid paths.';
  }
  if (suggestion?.suggested_review_decision === 'needs_manual_check' && suggestion?.evidence_suggested_decision === 'review_fetch_failed') {
    return 'Retry in browser; do not reject based only on fetch failure, timeout, 403, 429, CAPTCHA, or Cloudflare.';
  }
  if (suggestion?.possible_approval_decision) {
    return 'Manually verify visible free submit form, required fields, no auth/CAPTCHA/payment blocker, then consider approval as non-executable needs_scout.';
  }
  if (suggestion?.suggested_review_decision === 'reject_auth_required' || evidence?.auth_signal === 'yes') {
    return 'Decide whether this is assisted/manual-strategic; do not automate without explicit login/session plan and persisted selectors.';
  }
  if (suggestion?.suggested_review_decision === 'reject_paid' || evidence?.payment_signal === 'yes') {
    return 'Confirm whether a free submission path exists; reject if only paid/sponsored listing is available.';
  }
  if (queueRow.review_action === 'verify_directory_fit_before_any_approval') {
    return 'Verify this is a real product/startup/SaaS/AI directory, not a source page, blog comment, profile, generic article, or unrelated vertical.';
  }
  return 'Open manually and record approve/reject decision with notes; approval must remain non-executable needs_scout until scout evidence exists.';
}

function productContextPaths(opts = {}) {
  const configured = Array.isArray(opts.productContextPaths)
    ? opts.productContextPaths
    : splitFilterValues(opts.productContextPaths || '');
  return configured.length ? configured : [
    '.agents/product-marketing.md',
    '.claude/product-marketing.md',
    'product-marketing-context.md',
  ];
}

function productContextStatus(opts = {}) {
  return productContextPaths(opts).map(contextPath => ({
    path: contextPath,
    exists: existsSync(contextPath),
  }));
}

function manualReviewRowsFromQueue(queueRows, history) {
  return queueRows.map((queueRow, index) => {
    const key = reviewRowKey(queueRow);
    const evidence = history.evidenceByKey.get(key) || null;
    const suggestion = history.suggestionByKey.get(key) || null;
    const blocked = history.blockedByKey.get(key) || null;

    return {
      manual_rank: String(index + 1),
      priority: queueRow.priority || '',
      priority_score: queueRow.priority_score || '',
      review_row: queueRow.review_row || '',
      review_decision: queueRow.review_decision || '',
      review_decision_options: queueRow.review_decision_options || '',
      review_action: queueRow.review_action || '',
      review_instruction: queueRow.review_instruction || '',
      review_notes: queueRow.review_notes || '',
      reviewed_by: queueRow.reviewed_by || '',
      submission_url_override: queueRow.submission_url_override || '',
      manual_bucket: manualReviewBucket(queueRow, suggestion, evidence, blocked),
      risk_level: manualReviewRiskLevel(queueRow, suggestion, evidence, blocked),
      recommended_next_step: manualReviewNextStep(queueRow, suggestion, evidence, blocked),
      url: rowImportUrl(queueRow) || queueRow.url || '',
      domain: queueRow.domain || '',
      canonical_name: queueRow.canonical_name || '',
      pricing: queueRow.pricing || '',
      lang: queueRow.lang || '',
      classification: queueRow.classification || '',
      candidate_import_recommendation: queueRow.candidate_import_recommendation || '',
      occurrence_count: queueRow.occurrence_count || '',
      registry_target_ids: queueRow.registry_target_ids || '',
      registry_submit_urls: queueRow.registry_submit_urls || '',
      source_files: queueRow.source_files || '',
      source_locations: queueRow.source_locations || '',
      latest_batch_id: suggestion?.batch_id || evidence?.batch_id || '',
      evidence_file: evidence?.source_evidence_file || '',
      suggestion_file: suggestion?.source_suggestion_file || '',
      http_status: suggestion?.http_status || evidence?.http_status || '',
      fetch_ok: suggestion?.fetch_ok || evidence?.fetch_ok || '',
      final_url: suggestion?.final_url || evidence?.final_url || '',
      form_count: suggestion?.form_count || evidence?.form_count || '',
      input_count: suggestion?.input_count || evidence?.input_count || '',
      submit_path_signal: suggestion?.submit_path_signal || evidence?.submit_path_signal || '',
      directory_signal: suggestion?.directory_signal || evidence?.directory_signal || '',
      auth_signal: suggestion?.auth_signal || evidence?.auth_signal || '',
      oauth_signal: suggestion?.oauth_signal || evidence?.oauth_signal || '',
      captcha_signal: suggestion?.captcha_signal || evidence?.captcha_signal || '',
      cloudflare_signal: suggestion?.cloudflare_signal || evidence?.cloudflare_signal || '',
      payment_signal: suggestion?.payment_signal || evidence?.payment_signal || '',
      evidence_suggested_decision: suggestion?.evidence_suggested_decision || evidence?.suggested_decision || '',
      suggested_review_decision: suggestion?.suggested_review_decision || '',
      suggestion_confidence: suggestion?.suggestion_confidence || '',
      possible_approval_decision: suggestion?.possible_approval_decision || '',
      reviewer_action: suggestion?.reviewer_action || '',
      suggested_review_notes: suggestion?.suggested_review_notes || evidence?.evidence_notes || '',
      safety_gate_reason: blocked?.reason || '',
      safety_gate_batch_id: blocked?.batch_id || '',
      safety_gate_report: blocked?.source_draft_report_file || '',
      checked_at: suggestion?.checked_at || evidence?.checked_at || '',
    };
  });
}

function summarizeManualReviewRows(rows, contextStatus) {
  const summary = {
    generated_at: nowIso(),
    queue_rows: rows.length,
    product_context_present: contextStatus.some(row => row.exists),
    product_context_paths: contextStatus,
    policy: 'manual_review_only_no_approvals_no_registry_changes_no_real_submissions',
    by_priority: {},
    by_review_action: {},
    by_manual_bucket: {},
    by_risk_level: {},
    by_suggested_review_decision: {},
    by_suggestion_confidence: {},
    evidence_coverage: {
      rows_with_evidence_or_suggestion: 0,
      rows_without_evidence_or_suggestion: 0,
      rows_with_safety_gate_block: 0,
      possible_approval_after_manual_confirmation: 0,
    },
  };

  for (const row of rows) {
    incrementCount(summary.by_priority, row.priority);
    incrementCount(summary.by_review_action, row.review_action);
    incrementCount(summary.by_manual_bucket, row.manual_bucket);
    incrementCount(summary.by_risk_level, row.risk_level);
    incrementCount(summary.by_suggested_review_decision, row.suggested_review_decision || 'no_suggestion');
    incrementCount(summary.by_suggestion_confidence, row.suggestion_confidence || 'no_suggestion');
    if (row.evidence_file || row.suggestion_file) summary.evidence_coverage.rows_with_evidence_or_suggestion += 1;
    else summary.evidence_coverage.rows_without_evidence_or_suggestion += 1;
    if (row.safety_gate_reason) summary.evidence_coverage.rows_with_safety_gate_block += 1;
    if (row.possible_approval_decision) summary.evidence_coverage.possible_approval_after_manual_confirmation += 1;
  }

  return summary;
}

export function buildCoverageReviewManualPack(queuePath, opts = {}) {
  const queueRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const batchDir = opts.batchDir || join(dirname(queuePath), 'review-batches');
  const currentKeys = new Set(queueRows.map(reviewRowKey));
  const contextStatus = productContextStatus(opts);
  const rows = manualReviewRowsFromQueue(
    queueRows,
    latestCoverageReviewHistory(batchDir, currentKeys)
  );
  const nextLimit = Math.max(1, numericValue(opts.nextLimit, 100));
  const summary = summarizeManualReviewRows(rows, contextStatus);

  return {
    generated_at: summary.generated_at,
    queue: queuePath,
    batch_dir: batchDir,
    mode_policy: summary.policy,
    next_limit: nextLimit,
    rows,
    p0_rows: rows.filter(row => row.priority === 'P0'),
    next_rows: rows.slice(0, nextLimit),
    summary,
  };
}

function manualReviewCsv(rows) {
  return [
    MANUAL_REVIEW_HEADERS.join(','),
    ...rows.map(row => MANUAL_REVIEW_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function markdownTableFromCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
}

function markdownEscape(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function manualReviewSummaryMarkdown(pack) {
  const p0Rows = pack.p0_rows.map(row => [
    row.manual_rank,
    row.review_row,
    row.domain,
    row.manual_bucket,
    row.suggested_review_decision || 'no_suggestion',
    row.suggestion_confidence || '',
    row.url,
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');

  return [
    '# Manual Review Pack',
    '',
    `Generated: ${pack.generated_at}`,
    '',
    '## Scope',
    '',
    `- Current queue rows: ${pack.summary.queue_rows}`,
    `- P0 rows: ${pack.summary.by_priority.P0 || 0}`,
    `- P2 rows: ${pack.summary.by_priority.P2 || 0}`,
    `- Rows with evidence or suggestion history: ${pack.summary.evidence_coverage.rows_with_evidence_or_suggestion}`,
    `- Rows without evidence or suggestion history: ${pack.summary.evidence_coverage.rows_without_evidence_or_suggestion}`,
    `- Rows blocked by safety gate in prior drafts: ${pack.summary.evidence_coverage.rows_with_safety_gate_block}`,
    `- Possible approvals after manual confirmation: ${pack.summary.evidence_coverage.possible_approval_after_manual_confirmation}`,
    '',
    'Policy: manual review only. No approvals, no registry imports, no real submissions, no login or CAPTCHA/Cloudflare bypass.',
    '',
    '## By Priority',
    '',
    '| Priority | Count |',
    '|---|---:|',
    markdownTableFromCounts(pack.summary.by_priority),
    '',
    '## By Review Action',
    '',
    '| Action | Count |',
    '|---|---:|',
    markdownTableFromCounts(pack.summary.by_review_action),
    '',
    '## By Manual Bucket',
    '',
    '| Bucket | Count |',
    '|---|---:|',
    markdownTableFromCounts(pack.summary.by_manual_bucket),
    '',
    '## By Suggested Decision',
    '',
    '| Suggested Decision | Count |',
    '|---|---:|',
    markdownTableFromCounts(pack.summary.by_suggested_review_decision),
    '',
    '## P0 Manual Queue',
    '',
    '| Rank | Review Row | Domain | Manual Bucket | Suggested Decision | Confidence | URL |',
    '|---:|---:|---|---|---|---|---|',
    p0Rows,
    '',
    '## Files',
    '',
    '- Full remaining queue: remaining-manual-review.csv',
    '- P0-only queue: p0-manual-review.csv',
    '- Next queue slice: next-100-manual-review.csv',
    '- Machine-readable summary: manual-review-summary.json',
    '- Readiness blockers: product-readiness-blockers.md',
    '',
    'The CSV files include the required coverage-review queue columns. After a human edits `review_decision`, `review_notes`, `reviewed_by`, and optional override fields, validate the edited file before promotion:',
    '',
    '```bash',
    'node src/cli.js targets validate-coverage-review-batch <edited-manual-review.csv> --fail-on-blockers',
    'node src/cli.js targets promote-coverage-review-batch backlink-url/coverage-review.csv <edited-manual-review.csv> --registry resources/targets.canonical.yaml --output backlink-url/coverage-review.updated.csv --dry-run',
    '```',
    '',
    '## Human Review Rules',
    '',
    '1. Do not approve based on HTTP fetch alone. Approval requires a visible valid submit form, directory fit, no mandatory login/payment/CAPTCHA, and a clear submit URL.',
    '2. Do not reject on fetch failure alone. Retry in a normal browser first.',
    '3. Treat auth/OAuth/2FA/CAPTCHA/Cloudflare as assisted/manual, never auto.',
    '4. Treat paid/sponsored-only listing paths as reject_paid unless a free path is visible.',
    '5. Any approved row must remain non-executable needs_scout until scout evidence maps the form fields and submit button.',
    '',
  ].join('\n');
}

function productReadinessBlockersMarkdown(pack) {
  const contextLines = pack.summary.product_context_paths.map(row =>
    `- ${row.path}: ${row.exists ? 'present' : 'missing'}`
  );
  return [
    '# Product Readiness Blockers',
    '',
    `Generated: ${pack.generated_at}`,
    '',
    'Real submission remains blocked unless product marketing context and launch readiness are complete. Checked paths:',
    '',
    ...contextLines,
    '',
    '## Hard Blocks Before Real Submission',
    '',
    '1. Public product URL with no password wall.',
    '2. Pricing page, even if the product is free while in beta.',
    '3. Privacy policy and terms pages.',
    '4. Logo assets: PNG, SVG, square 1024x1024, favicon.',
    '5. 5-8 real product screenshots and a 60-90 second demo video.',
    '6. GEO-ready landing pages: one H1, sequential headings, FAQ schema, Organization/Product/SoftwareApplication structured data.',
    '7. At least 3 alternative pages and 3 use-case pages live and indexed.',
    '',
    '## Soft Blocks',
    '',
    '1. Template gallery or lead magnet asset when relevant.',
    '2. At least 20 beta or early users who could leave reviews on review platforms.',
    '',
    '## Execution Policy',
    '',
    'Until the hard blocks are satisfied, run-plan execution must stay blocked. The only safe work is candidate review, manual confirmation, scout planning, and dry-run validation.',
    '',
  ].join('\n');
}

export function writeCoverageReviewManualPack(pack, opts = {}) {
  const outputDir = opts.outputDir || join(dirname(pack.queue), 'manual-review');
  mkdirSync(outputDir, { recursive: true });
  const files = {
    remaining_manual_review_csv: join(outputDir, 'remaining-manual-review.csv'),
    p0_manual_review_csv: join(outputDir, 'p0-manual-review.csv'),
    next_manual_review_csv: join(outputDir, `next-${pack.next_limit}-manual-review.csv`),
    summary_json: join(outputDir, 'manual-review-summary.json'),
    summary_md: join(outputDir, 'manual-review-summary.md'),
    readiness_blockers_md: join(outputDir, 'product-readiness-blockers.md'),
  };
  const publicFiles = Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, normalizePath(value)])
  );

  const summary = {
    ...pack.summary,
    files: publicFiles,
  };

  writeFileSync(files.remaining_manual_review_csv, manualReviewCsv(pack.rows), 'utf-8');
  writeFileSync(files.p0_manual_review_csv, manualReviewCsv(pack.p0_rows), 'utf-8');
  writeFileSync(files.next_manual_review_csv, manualReviewCsv(pack.next_rows), 'utf-8');
  writeFileSync(files.summary_json, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
  writeFileSync(files.summary_md, manualReviewSummaryMarkdown({ ...pack, summary }), 'utf-8');
  writeFileSync(files.readiness_blockers_md, productReadinessBlockersMarkdown({ ...pack, summary }), 'utf-8');

  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
    summary,
  };
}
