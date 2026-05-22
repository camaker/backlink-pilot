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
const REVIEW_QUEUE_EDITABLE_FIELDS = [
  'review_decision',
  'review_notes',
  'reviewed_by',
  'canonical_name',
  'submission_url_override',
  'pricing',
  'lang',
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
