import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import {
  buildCoverageReport,
  buildCoverageReviewQueue,
  writeCoverageCandidatesCsv,
  writeCoverageReport,
  writeCoverageReviewCsv,
  writeCoverageReviewQueue,
} from './coverage.js';
import { normalizePricing, normalizeUrl, stripWww } from './normalize.js';

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function slugifySourceLabel(value = '') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'discovery';
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function nowIso() {
  return new Date().toISOString();
}

function parseDiscoveryFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const platforms = Array.isArray(raw?.platforms) ? raw.platforms : [];
  return {
    file: filePath,
    last_updated: raw?.last_updated || null,
    platforms,
  };
}

function normalizeDiscoveryPlatform(platform = {}, opts = {}) {
  const rawUrl = String(platform.url || '').trim();
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;

  const source = opts.source || '7deer-discovery';
  const discoveredRound = Number.parseInt(String(platform.discovered_round || ''), 10);
  const relevance = Number.parseFloat(String(platform.relevance ?? ''));
  const pricing = normalizePricing(platform.pricing || platform.price || platform.status || '');
  const lang = String(platform.lang || platform.language || 'unknown').trim().toLowerCase() || 'unknown';
  const title = String(platform.title || platform.name || platform.domain || normalized.domain).trim();
  const domain = stripWww(String(platform.domain || normalized.domain || ''));

  return {
    source,
    source_type: '7deer_discovery_platform',
    source_file: opts.sourceFileLabel,
    source_location: `${opts.sourceFileLabel}:json:platforms[${opts.index}]`,
    source_url: opts.discoveryFilePath,
    discovered_at: platform.found_at || platform.discovered_at || opts.generatedAt,
    discovered_round: Number.isFinite(discoveredRound) ? discoveredRound : '',
    platform_url: normalized.url,
    platform_domain: domain,
    title,
    platform_type: String(platform.platform_type || '').trim(),
    method: String(platform.method || '').trim(),
    relevance: Number.isFinite(relevance) ? relevance.toFixed(2) : '',
    pricing,
    lang,
    notes: String(platform.notes || '').trim(),
    query_used: String(platform.query_used || '').trim(),
  };
}

export function discoveryIntakeCsv(rows = []) {
  const headers = [
    'source',
    'source_type',
    'source_file',
    'source_location',
    'source_url',
    'discovered_at',
    'discovered_round',
    'submission_link',
    'domain',
    'title',
    'platform_type',
    'method',
    'relevance',
    'pricing',
    'lang',
    'notes',
    'query_used',
  ];

  return [
    headers.join(','),
    ...rows.map(row => [
      row.source,
      row.source_type,
      row.source_file,
      row.source_location,
      row.source_url,
      row.discovered_at,
      row.discovered_round,
      row.platform_url,
      row.platform_domain,
      row.title,
      row.platform_type,
      row.method,
      row.relevance,
      row.pricing,
      row.lang,
      row.notes,
      row.query_used,
    ].map(csvEscape).join(',')),
  ].join('\n') + '\n';
}

export function writeDiscoveryIntakeCsv(rows, outputPath) {
  ensureParent(outputPath);
  writeFileSync(outputPath, discoveryIntakeCsv(rows), 'utf-8');
}

export function buildDiscoveryCoverageArtifacts(discoveryFilePath, opts = {}) {
  const parsed = parseDiscoveryFile(discoveryFilePath);
  const generatedAt = nowIso();
  const sourceLabel = opts.source || '7deer-discovery';
  const outputDir = opts.outputDir || join('backlink-url', 'discovery-intake', slugifySourceLabel(sourceLabel));
  const sourceFileLabel = opts.sourceFileLabel || '7deer-discovery.csv';

  const intakeRows = parsed.platforms
    .map((platform, index) => normalizeDiscoveryPlatform(platform, {
      source: sourceLabel,
      sourceFileLabel,
      discoveryFilePath,
      generatedAt,
      index,
    }))
    .filter(Boolean);

  const intakeCsvPath = opts.intakeCsv || join(outputDir, '7deer-discovery.csv');
  writeDiscoveryIntakeCsv(intakeRows, intakeCsvPath);

  const coverageReportPath = opts.output || join(outputDir, 'coverage-report.json');
  const coverageCandidatesPath = opts.candidates || join(outputDir, 'coverage-candidates.csv');
  const coverageReviewPath = opts.review || join(outputDir, 'coverage-review.csv');
  const coverageQueuePath = opts.queue || join(outputDir, 'coverage-review-queue.csv');

  const coverage = buildCoverageReport(outputDir, {
    registry: opts.registry,
  });
  writeCoverageReport(coverage, coverageReportPath);
  writeCoverageCandidatesCsv(coverage, coverageCandidatesPath);
  writeCoverageReviewCsv(coverage, coverageReviewPath, {
    includeExact: Boolean(opts.includeExact),
  });

  const queue = buildCoverageReviewQueue(coverageReviewPath, {
    includeSkipped: Boolean(opts.includeSkipped),
  });
  writeCoverageReviewQueue(queue, coverageQueuePath);

  return {
    generated_at: generatedAt,
    source: sourceLabel,
    discovery_file: discoveryFilePath,
    output_dir: outputDir,
    intake_rows: intakeRows.length,
    files: {
      intake_csv: intakeCsvPath,
      coverage_report: coverageReportPath,
      coverage_candidates: coverageCandidatesPath,
      coverage_review: coverageReviewPath,
      coverage_review_queue: coverageQueuePath,
    },
    coverage,
    queue,
  };
}
