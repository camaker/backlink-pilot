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

export function importCoverageReview(registryPath, reviewPath, opts = {}) {
  const registry = loadRegistry(registryPath);
  const rows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  const incoming = [];
  const skipped = [];
  const blocked = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const decision = reviewDecision(row);
    const normalized = normalizeUrl(rowImportUrl(row));
    const reason = blockReason(row, normalized, decision);

    if (reason) {
      const entry = {
        line,
        url: rowImportUrl(row) || row.url || '',
        domain: row.domain || normalized?.domain || '',
        classification: row.classification || '',
        review_decision: decision,
        reason,
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
    review: reviewPath,
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
      decision_options: 'approved_domain_variant | reject_duplicate | reject_not_submit',
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

function coverageReviewRowsCsv(rows) {
  const csvRows = rows.map(row =>
    COVERAGE_REVIEW_HEADERS.map(header => row[header])
  );
  return [
    COVERAGE_REVIEW_HEADERS.join(','),
    ...csvRows.map(row => row.map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function applyCoverageReviewQueue(reviewPath, queuePath, opts = {}) {
  const reviewRows = parseCsv(readFileSync(reviewPath, 'utf-8'));
  const queueRows = parseCsv(readFileSync(queuePath, 'utf-8'));
  const updatedRows = reviewRows.map(row => ({ ...row }));
  const applied = [];
  const skipped = [];
  const blocked = [];
  const seenReviewRows = new Set();

  queueRows.forEach((row, index) => {
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

  const blockedApply = blocked.length > 0 && !opts.allowPartial;
  const output = opts.output || (opts.inPlace ? reviewPath : '');
  if (!opts.dryRun && output && !blockedApply) {
    ensureParent(output);
    writeFileSync(output, coverageReviewRowsCsv(updatedRows), 'utf-8');
  }

  return {
    review: reviewPath,
    queue: queuePath,
    output,
    dry_run: Boolean(opts.dryRun),
    in_place: Boolean(opts.inPlace),
    allow_partial: Boolean(opts.allowPartial),
    blocked_apply: blockedApply,
    review_rows: reviewRows.length,
    queue_rows: queueRows.length,
    applied_rows: blockedApply ? 0 : applied.length,
    skipped_rows: skipped.length,
    blocked_rows: blocked.length,
    editable_fields: REVIEW_QUEUE_EDITABLE_FIELDS,
    applied,
    skipped,
    blocked,
  };
}
