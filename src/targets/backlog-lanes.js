import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { parseCsv } from './importers/csv.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry, registryStats } from './registry.js';

const DEFAULT_PRICING_STATUS = 'backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-status.json';
const DEFAULT_PRICING_MANUAL = 'backlink-url/pricing-review/manual-review/pricing-potential-free-001-manual-review.csv';
const DEFAULT_COVERAGE_SUMMARY = 'backlink-url/manual-review/manual-review-summary.json';
const DEFAULT_COVERAGE_MANUAL = 'backlink-url/manual-review/remaining-manual-review.csv';
const DEFAULT_COVERAGE_REVIEW = 'backlink-url/coverage-review.csv';
const DEFAULT_AUTH_SUMMARY = 'backlink-url/assisted-submission-pack/resolved-direct-login/auth-workflow-refresh-resolved-summary.json';
const DEFAULT_AUTH_NEEDS_SCOUT_SUMMARY = 'backlink-url/assisted-submission-pack/resolved-needs-scout-pack/auth-resolved-needs-scout-pack.json';
const DEFAULT_AUTH_MANUAL_REVIEW_SUMMARY = 'backlink-url/assisted-submission-pack/resolved-manual-review-pack/auth-resolved-manual-review-pack.json';
const DEFAULT_OUTPUT_DIR = 'backlink-url/backlog-lanes';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonFile(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function parseCsvFile(path) {
  if (!path || !existsSync(path)) return [];
  return parseCsv(readFileSync(path, 'utf-8'));
}

function shellQuote(value = '') {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function stripKnownExtension(value = '') {
  return String(value || '').replace(/\.(json|csv|ya?ml)$/i, '');
}

function baseNameWithoutExtension(value = '') {
  return stripKnownExtension(basename(String(value || '')));
}

function deriveAuthRefreshCommand(summary, opts = {}) {
  if (opts.authRefreshCommand) return opts.authRefreshCommand;

  const queuePath = summary?.source_queue || '';
  const batchPaths = Array.isArray(summary?.source_batches)
    ? summary.source_batches.filter(Boolean)
    : [];
  if (!queuePath || !batchPaths.length) return '';

  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const authDir = opts.authDir || summary?.constraints?.auth_dir || '';
  const outputDir = summary?.files?.output_dir || dirname(summary?.files?.summary || '');
  const nextName = baseNameWithoutExtension(summary?.files?.next_login?.output || 'auth-login-next-current');
  const summaryName = baseNameWithoutExtension(summary?.files?.summary || 'auth-workflow-refresh-summary');
  const nextLimit = String(
    opts.authNextLimit
    ?? summary?.summary?.next_login?.limit
    ?? summary?.summary?.next_login?.task_rows
    ?? 10
  );
  const rescoutLimit = String(
    opts.authRescoutLimit
    ?? summary?.auth_rescout?.constraints?.limit
    ?? summary?.constraints?.rescout_limit
    ?? 100
  );

  const args = [
    'node',
    'src/cli.js',
    'targets',
    'auth-workflow-refresh',
    queuePath,
    ...batchPaths,
    '--registry',
    normalizePath(registryPath),
  ];

  if (authDir) {
    args.push('--auth-dir', normalizePath(authDir));
  }
  if (outputDir) {
    args.push('--output-dir', normalizePath(outputDir));
  }
  if (nextName) {
    args.push('--next-name', nextName);
  }
  if (summaryName) {
    args.push('--summary-name', summaryName);
  }
  if (nextLimit) {
    args.push('--next-limit', nextLimit);
  }
  if (rescoutLimit) {
    args.push('--rescout-limit', rescoutLimit);
  }

  return args.map(shellQuote).join(' ');
}

function chunkRows(rows = [], size = 25) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function priorityRank(value = '') {
  const priority = String(value || '').trim().toUpperCase();
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  if (priority === 'P3') return 3;
  return 9;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (!/[",\r\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function writeRowsCsv(rows = [], extraHeaders = []) {
  const headerSet = new Set(extraHeaders);
  for (const row of rows) {
    Object.keys(row || {}).forEach(key => {
      if (!headerSet.has(key)) headerSet.add(key);
    });
  }
  const headers = [...headerSet];
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row?.[header] ?? '')).join(',')),
  ].join('\n') + '\n';
}

function blank(value) {
  return !String(value || '').trim();
}

function laneId(type, index) {
  return `${type}-${String(index + 1).padStart(3, '0')}`;
}

function workerId(index) {
  return `worker-${String(index + 1).padStart(2, '0')}`;
}

function summarizeRegistryBacklog(registryPath) {
  const registry = loadRegistry(registryPath);
  const targets = registry.targets || [];
  const stats = registryStats(targets);
  const nonSkipTargets = targets.filter(target => target.submission?.mode !== 'skip');
  return {
    registry: normalizePath(registryPath),
    total_targets: stats.total || 0,
    non_skip_targets: nonSkipTargets.length,
    by_mode: stats.by_mode || {},
    by_pricing: stats.by_pricing || {},
    by_risk: stats.by_risk || {},
    by_lang: stats.by_lang || {},
  };
}

function highestPriority(rows = [], fallback = 'P2') {
  const values = rows
    .map(row => String(row.priority || '').trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => priorityRank(a) - priorityRank(b));
  return values[0] || fallback;
}

function laneBase(type, rows, opts = {}) {
  const estimatedMinutesPerRow = Number(opts.estimatedMinutesPerRow || 0);
  const rowCount = rows.length;
  const priority = opts.priority || highestPriority(rows, 'P2');

  return {
    lane_type: type,
    row_count: rowCount,
    priority,
    estimated_minutes_per_row: estimatedMinutesPerRow,
    estimated_total_minutes: rowCount * estimatedMinutesPerRow,
    source_file: normalizePath(opts.sourceFile || ''),
    source_kind: opts.sourceKind || '',
    execution_mode: opts.executionMode || 'manual_read_only',
    requires_human_browser: Boolean(opts.requiresHumanBrowser),
    writes_registry: false,
    writes_network: false,
    notes: opts.notes || '',
    validate_command: opts.validateCommand || '',
    merge_command: opts.mergeCommand || '',
    refresh_command: opts.refreshCommand || '',
  };
}

function buildPricingLanes(rows = [], opts = {}) {
  const pendingRows = rows.filter(row => blank(row.review_decision));
  const chunks = chunkRows(pendingRows, parsePositiveInt(opts.laneSize, 10));
  return chunks.map((chunk, index) => {
    const id = laneId('pricing-review', index);
    const lanePath = join(opts.outputDir, 'lanes', `${id}.csv`);
    const mergePath = join(opts.outputDir, 'merge', `${id}-draft-merge.csv`);
    const mergeJson = join(opts.outputDir, 'merge', `${id}-draft-merge.json`);
    return {
      lane_id: id,
      ...laneBase('pricing_review_manual', chunk, {
        estimatedMinutesPerRow: 8,
        priority: 'P0',
        sourceFile: opts.sourceFile,
        sourceKind: 'pricing_manual_review',
        executionMode: 'manual_browser_review',
        requiresHumanBrowser: true,
        notes: 'Review pricing/free-vs-paid signals manually. Do not write the registry directly.',
        validateCommand: `node src/cli.js targets validate-pricing-review-decisions "${normalizePath(lanePath)}" --fail-on-blockers`,
        mergeCommand: `node src/cli.js targets merge-pricing-review-decision-batch "${normalizePath(opts.pricingDraft)}" "${normalizePath(lanePath)}" --output "${normalizePath(mergePath)}" --json-output "${normalizePath(mergeJson)}" --fail-on-blockers`,
      }),
      rows: chunk,
    };
  });
}

function authStatusCsvPaths(summary, opts = {}) {
  if (Array.isArray(opts.authStatusCsvs) && opts.authStatusCsvs.length) return opts.authStatusCsvs;
  const reports = summary?.files?.status_reports || [];
  return reports.map(row => row.csv_output).filter(Boolean);
}

function buildAuthLanes(rows = [], opts = {}) {
  const actionableRows = rows.filter(row => row.status === 'manual_login_required');
  const chunks = chunkRows(actionableRows, parsePositiveInt(opts.laneSize, 10));
  return chunks.map((chunk, index) => {
    const id = laneId('auth-login', index);
    const lanePath = join(opts.outputDir, 'lanes', `${id}.csv`);
    return {
      lane_id: id,
      ...laneBase('auth_manual_login', chunk, {
        estimatedMinutesPerRow: 6,
        priority: highestPriority(chunk, 'P0'),
        sourceFile: opts.sourceFile,
        sourceKind: 'auth_login_status',
        executionMode: 'manual_browser_login',
        requiresHumanBrowser: true,
        notes: 'Run manual auth login only. No submission. Refresh auth workflow after login capture.',
        refreshCommand: opts.refreshCommand || '',
      }),
      validate_command: '',
      merge_command: '',
      rows: chunk.map(row => ({
        ...row,
        lane_csv_path: normalizePath(lanePath),
      })),
    };
  });
}

function buildCoverageLanes(rows = [], opts = {}) {
  const pendingRows = rows.filter(row => blank(row.review_decision));
  const p0Rows = pendingRows.filter(row => String(row.priority || '').trim().toUpperCase() === 'P0');
  const otherRows = pendingRows.filter(row => String(row.priority || '').trim().toUpperCase() !== 'P0');
  const lanes = [];
  const p0Chunks = chunkRows(p0Rows, parsePositiveInt(opts.p0LaneSize, Math.max(p0Rows.length, 1)));
  const otherChunks = chunkRows(otherRows, parsePositiveInt(opts.laneSize, 25));
  const allChunks = [
    ...p0Chunks.map(chunk => ({ rows: chunk, priority: 'P0', type: 'coverage-review-p0' })),
    ...otherChunks.map(chunk => ({ rows: chunk, priority: highestPriority(chunk, 'P2'), type: 'coverage-review-p2' })),
  ];

  allChunks.forEach((entry, index) => {
    const id = laneId(entry.type, index);
    const lanePath = join(opts.outputDir, 'lanes', `${id}.csv`);
    const reviewOutput = join(opts.outputDir, 'merge', `${id}-coverage-review.updated.csv`);
    lanes.push({
      lane_id: id,
      ...laneBase(entry.priority === 'P0' ? 'coverage_manual_review_p0' : 'coverage_manual_review_p2', entry.rows, {
        estimatedMinutesPerRow: entry.priority === 'P0' ? 5 : 4,
        priority: entry.priority,
        sourceFile: opts.sourceFile,
        sourceKind: 'coverage_manual_review',
        executionMode: 'manual_directory_review',
        requiresHumanBrowser: true,
        notes: 'Validate directory fit and submission surface manually. Approved rows remain non-executable until scout evidence exists.',
        validateCommand: `node src/cli.js targets validate-coverage-review-batch "${normalizePath(lanePath)}" --fail-on-blockers`,
        mergeCommand: `node src/cli.js targets promote-coverage-review-batch "${normalizePath(opts.coverageReviewPath)}" "${normalizePath(lanePath)}" --registry "${normalizePath(opts.registry)}" --output "${normalizePath(reviewOutput)}" --dry-run`,
      }),
      rows: entry.rows,
    });
  });

  return lanes;
}

function buildAuthNeedsScoutLanes(rows = [], opts = {}) {
  const chunks = chunkRows(rows, parsePositiveInt(opts.laneSize, 10));
  return chunks.map((chunk, index) => {
    const id = laneId('auth-needs-scout', index);
    const lanePath = join(opts.outputDir, 'lanes', `${id}.csv`);
    return {
      lane_id: id,
      ...laneBase('auth_resolved_needs_scout', chunk, {
        estimatedMinutesPerRow: 5,
        priority: 'P1',
        sourceFile: opts.sourceFile,
        sourceKind: 'auth_resolved_needs_scout',
        executionMode: 'manual_or_read_only_scout_planning',
        requiresHumanBrowser: false,
        notes: 'Targets were explicitly moved out of auth. Refresh public scout evidence and reclassify before any auth re-entry.',
      }),
      rows: chunk.map((row, indexInLane) => ({
        lane_order: String(indexInLane + 1),
        ...row,
        lane_csv_path: normalizePath(lanePath),
      })),
    };
  });
}

function buildAuthManualReviewLanes(rows = [], opts = {}) {
  const failClosedRows = rows.filter(row => row.review_route === 'manual_surface_review_fail_closed');
  const classificationRows = rows.filter(row => row.review_route !== 'manual_surface_review_fail_closed');
  const laneEntries = [
    ...chunkRows(failClosedRows, parsePositiveInt(opts.failClosedLaneSize, 10)).map(rowsChunk => ({
      type: 'auth_manual_review_fail_closed',
      priority: 'P0',
      estimatedMinutesPerRow: 7,
      rows: rowsChunk,
    })),
    ...chunkRows(classificationRows, parsePositiveInt(opts.laneSize, 10)).map(rowsChunk => ({
      type: 'auth_manual_review_classification',
      priority: highestPriority(rowsChunk, 'P1'),
      estimatedMinutesPerRow: 6,
      rows: rowsChunk,
    })),
  ];

  return laneEntries.map((entry, index) => {
    const id = laneId(entry.type.replace(/_/g, '-'), index);
    const lanePath = join(opts.outputDir, 'lanes', `${id}.csv`);
    return {
      lane_id: id,
      ...laneBase(entry.type, entry.rows, {
        estimatedMinutesPerRow: entry.estimatedMinutesPerRow,
        priority: entry.priority,
        sourceFile: opts.sourceFile,
        sourceKind: 'auth_resolved_manual_review',
        executionMode: 'manual_review_fail_closed',
        requiresHumanBrowser: true,
        notes: entry.type === 'auth_manual_review_fail_closed'
          ? 'Fail-closed manual surface review only. Do not restore direct-login without explicit verified evidence.'
          : 'Manual surface classification only. Keep targets out of direct-login until route is re-established.',
      }),
      rows: entry.rows.map((row, indexInLane) => ({
        lane_order: String(indexInLane + 1),
        ...row,
        lane_csv_path: normalizePath(lanePath),
      })),
    };
  });
}

function assignWorkers(lanes = [], workers = 4) {
  const count = parsePositiveInt(workers, 4);
  const workerRows = Array.from({ length: count }, (_, index) => ({
    worker_id: workerId(index),
    estimated_total_minutes: 0,
    row_count: 0,
    lane_count: 0,
    lanes: [],
  }));

  const sortedLanes = [...lanes].sort((a, b) => {
    if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
    if (b.estimated_total_minutes !== a.estimated_total_minutes) return b.estimated_total_minutes - a.estimated_total_minutes;
    return a.lane_id.localeCompare(b.lane_id);
  });

  for (const lane of sortedLanes) {
    const worker = workerRows
      .slice()
      .sort((a, b) => a.estimated_total_minutes - b.estimated_total_minutes || a.lane_count - b.lane_count || a.worker_id.localeCompare(b.worker_id))[0];
    worker.lanes.push({
      lane_id: lane.lane_id,
      lane_type: lane.lane_type,
      priority: lane.priority,
      row_count: lane.row_count,
      estimated_total_minutes: lane.estimated_total_minutes,
    });
    worker.estimated_total_minutes += lane.estimated_total_minutes;
    worker.row_count += lane.row_count;
    worker.lane_count += 1;
  }

  return workerRows;
}

function countByType(lanes = []) {
  return lanes.reduce((acc, lane) => {
    const key = lane.lane_type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function intersectCount(a = [], b = []) {
  const right = new Set(b.filter(Boolean));
  return [...new Set(a.filter(Boolean))].filter(value => right.has(value)).length;
}

export function buildBacklogLanes(opts = {}) {
  const outputDir = opts.outputDir || DEFAULT_OUTPUT_DIR;
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const pricingStatusPath = opts.pricingStatus || DEFAULT_PRICING_STATUS;
  const pricingStatus = parseJsonFile(pricingStatusPath);
  const pricingManualPath = opts.pricingManual || pricingStatus?.manual || DEFAULT_PRICING_MANUAL;
  const pricingDraft = opts.pricingDraft || pricingStatus?.draft || 'backlink-url/pricing-review/pricing-review-decision-draft.csv';

  const authSummaryPath = opts.authSummary || DEFAULT_AUTH_SUMMARY;
  const authSummary = parseJsonFile(authSummaryPath);
  const authCsvPaths = authStatusCsvPaths(authSummary, opts);
  const authRows = authCsvPaths.flatMap(path => parseCsvFile(path));
  const authNeedsScoutSummaryPath = opts.authNeedsScoutSummary || DEFAULT_AUTH_NEEDS_SCOUT_SUMMARY;
  const authNeedsScoutSummary = parseJsonFile(authNeedsScoutSummaryPath);
  const authNeedsScoutPath = opts.authNeedsScout || authNeedsScoutSummary?.files?.pack_csv || '';
  const authNeedsScoutRows = parseCsvFile(authNeedsScoutPath);
  const authManualReviewSummaryPath = opts.authManualReviewSummary || DEFAULT_AUTH_MANUAL_REVIEW_SUMMARY;
  const authManualReviewSummary = parseJsonFile(authManualReviewSummaryPath);
  const authManualReviewPath = opts.authManualReview || authManualReviewSummary?.files?.pack_csv || '';
  const authManualReviewRows = parseCsvFile(authManualReviewPath);

  const coverageSummaryPath = opts.coverageSummary || DEFAULT_COVERAGE_SUMMARY;
  const coverageSummary = parseJsonFile(coverageSummaryPath);
  const coverageManualPath = opts.coverageManual || coverageSummary?.files?.remaining_manual_review_csv || DEFAULT_COVERAGE_MANUAL;
  const coverageReviewPath = opts.coverageReview || DEFAULT_COVERAGE_REVIEW;

  const pricingRows = parseCsvFile(pricingManualPath);
  const coverageRows = parseCsvFile(coverageManualPath);
  const refreshCommand = deriveAuthRefreshCommand(authSummary, {
    authRefreshCommand: opts.authRefreshCommand,
    registry: registryPath,
    authDir: opts.authDir,
    authNextLimit: opts.authNextLimit,
    authRescoutLimit: opts.authRescoutLimit,
  });

  const pricingLanes = buildPricingLanes(pricingRows, {
    outputDir,
    laneSize: opts.pricingLaneSize,
    sourceFile: pricingManualPath,
    pricingDraft,
  });
  const authLanes = buildAuthLanes(authRows, {
    outputDir,
    laneSize: opts.authLaneSize,
    sourceFile: authSummaryPath,
    refreshCommand,
  });
  const authNeedsScoutLanes = buildAuthNeedsScoutLanes(authNeedsScoutRows, {
    outputDir,
    laneSize: opts.authNeedsScoutLaneSize,
    sourceFile: authNeedsScoutPath || authNeedsScoutSummaryPath,
  });
  const authManualReviewLanes = buildAuthManualReviewLanes(authManualReviewRows, {
    outputDir,
    laneSize: opts.authManualReviewLaneSize,
    failClosedLaneSize: opts.authManualReviewFailClosedLaneSize,
    sourceFile: authManualReviewPath || authManualReviewSummaryPath,
  });
  const coverageLanes = buildCoverageLanes(coverageRows, {
    outputDir,
    laneSize: opts.coverageLaneSize,
    p0LaneSize: opts.coverageP0LaneSize,
    sourceFile: coverageManualPath,
    coverageReviewPath,
    registry: registryPath,
  });
  const lanes = [...pricingLanes, ...authLanes, ...authNeedsScoutLanes, ...authManualReviewLanes, ...coverageLanes];
  const workers = assignWorkers(lanes, opts.workers || 4);

  const pricingPending = pricingRows.filter(row => blank(row.review_decision));
  const authPending = authRows.filter(row => row.status === 'manual_login_required');
  const authNeedsScoutPending = authNeedsScoutRows;
  const authManualReviewPending = authManualReviewRows;
  const coveragePending = coverageRows.filter(row => blank(row.review_decision));

  return {
    generated_at: nowIso(),
    registry_backlog: summarizeRegistryBacklog(registryPath),
    workflow_backlog: {
      pricing_manual_rows: pricingPending.length,
      auth_manual_login_rows: authPending.length,
      auth_resolved_needs_scout_rows: authNeedsScoutPending.length,
      auth_resolved_manual_review_rows: authManualReviewPending.length,
      coverage_manual_review_rows: coveragePending.length,
      total_workflow_rows: pricingPending.length + authPending.length + authNeedsScoutPending.length + authManualReviewPending.length + coveragePending.length,
      overlaps: {
        pricing_auth_shared_target_ids: intersectCount(
          pricingPending.map(row => row.target_id),
          authPending.map(row => row.target_id)
        ),
      },
    },
    source_files: {
      pricing_status: normalizePath(pricingStatusPath),
      pricing_manual: normalizePath(pricingManualPath),
      pricing_draft: normalizePath(pricingDraft),
      auth_summary: normalizePath(authSummaryPath),
      auth_status_csvs: authCsvPaths.map(normalizePath),
      auth_needs_scout_summary: normalizePath(authNeedsScoutSummaryPath),
      auth_needs_scout: normalizePath(authNeedsScoutPath),
      auth_manual_review_summary: normalizePath(authManualReviewSummaryPath),
      auth_manual_review: normalizePath(authManualReviewPath),
      coverage_summary: normalizePath(coverageSummaryPath),
      coverage_manual: normalizePath(coverageManualPath),
      coverage_review: normalizePath(coverageReviewPath),
    },
    lane_policy: {
      workers_requested: parsePositiveInt(opts.workers || 4, 4),
      pricing_lane_size: parsePositiveInt(opts.pricingLaneSize, 10),
      auth_lane_size: parsePositiveInt(opts.authLaneSize, 10),
      auth_needs_scout_lane_size: parsePositiveInt(opts.authNeedsScoutLaneSize, 10),
      auth_manual_review_lane_size: parsePositiveInt(opts.authManualReviewLaneSize, 10),
      auth_manual_review_fail_closed_lane_size: parsePositiveInt(opts.authManualReviewFailClosedLaneSize, 10),
      coverage_lane_size: parsePositiveInt(opts.coverageLaneSize, 25),
      coverage_p0_lane_size: parsePositiveInt(opts.coverageP0LaneSize, Math.max(coveragePending.filter(row => String(row.priority || '').trim().toUpperCase() === 'P0').length, 1)),
      read_only: true,
      no_submission: true,
      no_login_bypass: true,
      no_registry_write_without_explicit_followup: true,
    },
    lanes_summary: {
      lane_count: lanes.length,
      by_type: countByType(lanes),
      total_estimated_minutes: lanes.reduce((sum, lane) => sum + lane.estimated_total_minutes, 0),
    },
    lanes,
    workers,
  };
}

function backlogMarkdown(plan = {}) {
  const laneLines = (plan.lanes || []).map(lane =>
    `| ${lane.lane_id} | ${lane.lane_type} | ${lane.priority} | ${lane.row_count} | ${lane.estimated_total_minutes} |`
  ).join('\n');
  const workerLines = (plan.workers || []).map(worker =>
    `| ${worker.worker_id} | ${worker.lane_count} | ${worker.row_count} | ${worker.estimated_total_minutes} | ${worker.lanes.map(lane => lane.lane_id).join(', ')} |`
  ).join('\n');

  return [
    '# Backlog Lanes',
    '',
    `Generated: ${plan.generated_at || ''}`,
    '',
    '## Registry Backlog',
    '',
    `- Total targets: ${plan.registry_backlog?.total_targets || 0}`,
    `- Non-skip targets: ${plan.registry_backlog?.non_skip_targets || 0}`,
    `- By mode: ${JSON.stringify(plan.registry_backlog?.by_mode || {})}`,
    `- By pricing: ${JSON.stringify(plan.registry_backlog?.by_pricing || {})}`,
    '',
    '## Workflow Backlog',
    '',
    `- Pricing manual rows: ${plan.workflow_backlog?.pricing_manual_rows || 0}`,
    `- Auth manual login rows: ${plan.workflow_backlog?.auth_manual_login_rows || 0}`,
    `- Auth resolved needs-scout rows: ${plan.workflow_backlog?.auth_resolved_needs_scout_rows || 0}`,
    `- Auth resolved manual-review rows: ${plan.workflow_backlog?.auth_resolved_manual_review_rows || 0}`,
    `- Coverage manual review rows: ${plan.workflow_backlog?.coverage_manual_review_rows || 0}`,
    `- Total workflow rows: ${plan.workflow_backlog?.total_workflow_rows || 0}`,
    `- Pricing/Auth shared target IDs: ${plan.workflow_backlog?.overlaps?.pricing_auth_shared_target_ids || 0}`,
    '',
    '## Lanes',
    '',
    '| Lane ID | Type | Priority | Rows | Est. Minutes |',
    '|---|---|---|---:|---:|',
    laneLines,
    '',
    '## Worker Assignment',
    '',
    '| Worker | Lanes | Rows | Est. Minutes | Lane IDs |',
    '|---|---:|---:|---:|---|',
    workerLines,
    '',
    'All lanes remain manual/read-only. Nothing here performs real submissions, login bypass, or registry writes.',
    '',
  ].join('\n');
}

function workerMarkdown(worker = {}, plan = {}) {
  const laneDetails = worker.lanes.map(summary => {
    const lane = (plan.lanes || []).find(item => item.lane_id === summary.lane_id);
    return [
      `### ${summary.lane_id}`,
      '',
      `- Type: ${summary.lane_type}`,
      `- Priority: ${summary.priority}`,
      `- Rows: ${summary.row_count}`,
      `- Estimated minutes: ${summary.estimated_total_minutes}`,
      `- Notes: ${lane?.notes || ''}`,
      `- Validate: ${lane?.validate_command || '(none)'}`,
      `- Merge/Follow-up: ${lane?.merge_command || lane?.refresh_command || '(none)'}`,
      '',
    ].join('\n');
  }).join('\n');

  return [
    `# ${worker.worker_id}`,
    '',
    `Generated: ${plan.generated_at || ''}`,
    '',
    `- Lane count: ${worker.lane_count || 0}`,
    `- Rows: ${worker.row_count || 0}`,
    `- Estimated minutes: ${worker.estimated_total_minutes || 0}`,
    '',
    laneDetails,
  ].join('\n');
}

export function writeBacklogLanes(plan = {}, opts = {}) {
  const outputDir = opts.outputDir || DEFAULT_OUTPUT_DIR;
  const lanesDir = join(outputDir, 'lanes');
  const workersDir = join(outputDir, 'workers');
  const mergeDir = join(outputDir, 'merge');

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(lanesDir, { recursive: true });
  mkdirSync(workersDir, { recursive: true });
  mkdirSync(mergeDir, { recursive: true });

  const laneFiles = [];
  for (const lane of plan.lanes || []) {
    const csvPath = join(lanesDir, `${lane.lane_id}.csv`);
    const jsonPath = join(lanesDir, `${lane.lane_id}.json`);
    const rows = (lane.rows || []).map((row, index) => ({
      lane_id: lane.lane_id,
      lane_type: lane.lane_type,
      lane_priority: lane.priority,
      lane_order: String(index + 1),
      lane_estimated_minutes_per_row: String(lane.estimated_minutes_per_row || 0),
      ...row,
    }));
    writeFileSync(csvPath, writeRowsCsv(rows, [
      'lane_id',
      'lane_type',
      'lane_priority',
      'lane_order',
      'lane_estimated_minutes_per_row',
    ]), 'utf-8');
    writeFileSync(jsonPath, `${JSON.stringify({
      ...lane,
      rows,
    }, null, 2)}\n`, 'utf-8');
    laneFiles.push({
      lane_id: lane.lane_id,
      csv: normalizePath(csvPath),
      json: normalizePath(jsonPath),
    });
  }

  const workerFiles = [];
  for (const worker of plan.workers || []) {
    const jsonPath = join(workersDir, `${worker.worker_id}.json`);
    const mdPath = join(workersDir, `${worker.worker_id}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(worker, null, 2)}\n`, 'utf-8');
    writeFileSync(mdPath, workerMarkdown(worker, plan), 'utf-8');
    workerFiles.push({
      worker_id: worker.worker_id,
      json: normalizePath(jsonPath),
      markdown: normalizePath(mdPath),
    });
  }

  const summaryJson = join(outputDir, 'backlog-lanes.json');
  const summaryMd = join(outputDir, 'backlog-lanes.md');
  const publicPlan = {
    ...plan,
    files: {
      output_dir: normalizePath(outputDir),
      lanes: laneFiles,
      workers: workerFiles,
      summary_json: normalizePath(summaryJson),
      summary_md: normalizePath(summaryMd),
      merge_dir: normalizePath(mergeDir),
    },
  };

  writeFileSync(summaryJson, `${JSON.stringify(publicPlan, null, 2)}\n`, 'utf-8');
  writeFileSync(summaryMd, backlogMarkdown(publicPlan), 'utf-8');

  return publicPlan.files;
}
