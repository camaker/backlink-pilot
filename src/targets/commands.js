import {
  DEFAULT_REGISTRY_FILE,
  dedupeRegistryIds,
  filterTargets,
  importTargets,
  loadRegistry,
  normalizeRegistry,
  registryStats,
} from './registry.js';
import { auditRegistry, formatAuditReport } from './audit.js';
import {
  buildCoverageReport,
  writeCoverageCandidatesCsv,
  writeCoverageReport,
} from './coverage.js';

function printStats(stats) {
  console.log(`Total: ${stats.total}`);
  console.log('By mode:', JSON.stringify(stats.by_mode));
  console.log('By pricing:', JSON.stringify(stats.by_pricing));
  console.log('By risk:', JSON.stringify(stats.by_risk));
  console.log('By lang:', JSON.stringify(stats.by_lang));
}

export async function importTargetsCommand(inputPath, opts = {}) {
  const registry = opts.registry || DEFAULT_REGISTRY_FILE;
  const result = importTargets(registry, inputPath, {
    source: opts.source,
    type: opts.type,
    lang: opts.lang,
    group: opts.group,
  });

  console.log(`Imported: ${result.imported}`);
  console.log(`Duplicates merged: ${result.duplicates}`);
  console.log(`Registry total: ${result.total}`);
  console.log(`Registry: ${result.path}`);
}

export async function listTargetsCommand(opts = {}) {
  const registry = loadRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  const rows = filterTargets(registry.targets, {
    free: Boolean(opts.free),
    paid: Boolean(opts.paid),
    mode: opts.mode,
    risk: opts.risk,
    lang: opts.lang,
    source: opts.source,
    backlinkStatus: opts.backlinkStatus,
    verified: Boolean(opts.verified),
    notFound: Boolean(opts.notFound),
    hasLiveListing: Boolean(opts.hasLiveListing),
    runnable: Boolean(opts.runnable),
  });
  const limit = Number.parseInt(opts.limit || rows.length, 10);
  const selected = rows.slice(0, Number.isFinite(limit) && limit >= 0 ? limit : rows.length);

  if (opts.json) {
    console.log(JSON.stringify(selected, null, 2));
    return;
  }

  for (const target of selected) {
    console.log([
      target.id,
      target.submission?.mode || 'unknown',
      target.pricing || 'unknown',
      target.quality?.risk || 'unknown',
      target.submission?.backlink_status || 'unverified',
      target.submission?.live_listing_url || '',
      target.submit_url,
    ].join('\t'));
  }

  if (!selected.length) console.log('No targets matched.');
}

export async function normalizeTargetsCommand(opts = {}) {
  const result = normalizeRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  console.log(`Normalized registry: ${result.path}`);
  console.log(`Targets: ${result.total}`);
  console.log(`Duplicates removed: ${result.duplicates}`);
  console.log(`IDs renamed: ${result.renamed_ids}`);
}

export async function statsTargetsCommand(opts = {}) {
  const registry = loadRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  const stats = registryStats(registry.targets);
  if (opts.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  printStats(stats);
}

export async function auditTargetsCommand(opts = {}) {
  const report = auditRegistry(opts.registry || DEFAULT_REGISTRY_FILE, opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatAuditReport(report, opts));
  }
  if (!report.ok && opts.failOnBlockers) process.exitCode = 1;
  return report;
}

export async function dedupeTargetIdsCommand(opts = {}) {
  const result = dedupeRegistryIds(opts.registry || DEFAULT_REGISTRY_FILE);
  console.log(`Registry: ${result.path}`);
  console.log(`Targets: ${result.total}`);
  console.log(`IDs renamed: ${result.renamed_ids}`);
  return result;
}

export async function coverageTargetsCommand(inputDir, opts = {}) {
  const report = buildCoverageReport(inputDir, {
    ...opts,
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
  });

  if (opts.output) {
    writeCoverageReport(report, opts.output);
  }

  if (opts.candidates) {
    writeCoverageCandidatesCsv(report, opts.candidates);
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log(`Input: ${inputDir}`);
  console.log(`Registry: ${report.registry}`);
  console.log(`Registry targets: ${report.summary.registry_targets}`);
  console.log(`Files scanned: ${report.summary.files_scanned}`);
  console.log(`URL occurrences: ${report.summary.url_occurrences}`);
  console.log(`Unique URLs: ${report.summary.unique_urls_in_input}`);
  console.log(`Exact in registry: ${report.summary.exact_in_registry}`);
  console.log(`Domain in registry only: ${report.summary.domain_in_registry_only}`);
  console.log(`Missing domain: ${report.summary.missing_domain}`);
  console.log(`Candidate recommendations: ${JSON.stringify(report.recommendations.counts)}`);
  if (opts.output) console.log(`Coverage report: ${opts.output}`);
  if (opts.candidates) console.log(`Candidate CSV: ${opts.candidates}`);

  return report;
}
