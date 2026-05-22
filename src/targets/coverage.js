import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative } from 'path';
import { loadRegistry } from './registry.js';
import { normalizeUrl } from './normalize.js';
import { parseCsv } from './importers/csv.js';

const DEFAULT_IGNORED_FILENAMES = new Set([
  'coverage-report.json',
  'coverage-candidates.csv',
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
