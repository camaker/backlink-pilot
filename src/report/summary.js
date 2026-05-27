import { existsSync, readFileSync, statSync } from 'fs';
import { dirname } from 'path';
import { DEFAULT_REGISTRY_FILE, loadRegistry, registryStats } from '../targets/registry.js';
import { auditRegistry, auditTargets } from '../targets/audit.js';

const SUBMITTED_OR_PENDING_STATUSES = new Set(['submitted', 'pending_review', 'accepted']);
const SCOUT_QUEUE_MODES = new Set(['auto_candidate', 'needs_scout']);
export const DEFAULT_BACKLOG_PATH = 'backlink-url/backlog-lanes/backlog-lanes.json';
const DEFAULT_BACKLOG_AGING_HOURS = 24;

function nowIso() {
  return new Date().toISOString();
}

function countBy(items = [], keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function shellQuote(value = '') {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function priorityRank(value = '') {
  const priority = String(value || '').trim().toUpperCase();
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  if (priority === 'P3') return 3;
  return 9;
}

function parentDir(path = '') {
  const normalized = normalizePath(path);
  if (!normalized) return normalizePath(DEFAULT_BACKLOG_PATH).replace(/\/backlog-lanes\.json$/i, '');
  if (!normalized.includes('/')) return '.';
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

function flattenPathValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenPathValues);
  if (typeof value === 'object') return Object.values(value).flatMap(flattenPathValues);
  return [String(value)];
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function parseIsoMs(value = '') {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
}

function topCounts(counts = {}, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([code, count]) => ({ code, count }));
}

function readJsonl(path, label) {
  if (!path) return [];
  if (!existsSync(path)) throw new Error(`${label} file not found: ${path}`);
  return readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function readJson(path, label, opts = {}) {
  if (!path) return null;
  if (!existsSync(path)) {
    if (opts.optional) return null;
    throw new Error(`${label} file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function targetKeyFor(row = {}, index = 0) {
  return row.target_id || row.id || row.submit_url || row.listing_url || `row-${index + 1}`;
}

export function latestByTarget(rows = []) {
  const latest = new Map();
  rows.forEach((row, index) => {
    const target_key = targetKeyFor(row, index);
    latest.set(target_key, {
      target_key,
      ...row,
      _report_index: index,
    });
  });
  return [...latest.values()];
}

function normalizedVerificationStatus(status = '') {
  if (status === 'backlink_verified') return 'verified';
  if (status === 'backlink_not_found') return 'not_found';
  if (status === 'skipped') return 'skipped';
  return 'failed';
}

export function summarizeRunRows(rows = []) {
  const latest = latestByTarget(rows);
  const byStatus = countBy(latest, row => row.status);

  return {
    events: rows.length,
    targets: latest.length,
    by_status: byStatus,
    submitted_or_pending: latest.filter(row => SUBMITTED_OR_PENDING_STATUSES.has(row.status)).length,
    dry_run_ready: byStatus.dry_run_ready || 0,
    skipped: byStatus.skipped || 0,
    failed: byStatus.failed || 0,
    latest,
  };
}

export function summarizeVerificationRows(rows = []) {
  const latest = latestByTarget(rows);
  const normalized = countBy(latest, row => normalizedVerificationStatus(row.status));
  const byStatus = countBy(latest, row => row.status);
  const withBacklink = latest.filter(row => row.backlink?.link_type);

  return {
    events: rows.length,
    targets: latest.length,
    by_status: byStatus,
    verified: normalized.verified || 0,
    not_found: normalized.not_found || 0,
    skipped: normalized.skipped || 0,
    failed: normalized.failed || 0,
    by_link_type: countBy(withBacklink, row => row.backlink.link_type),
    latest,
  };
}

function isUnscoutedScoutCandidate(target = {}) {
  return SCOUT_QUEUE_MODES.has(target.submission?.mode || '') &&
    !target.technical?.last_scouted_at &&
    target.quality?.risk !== 'high';
}

function isFreeOrUnknown(target = {}) {
  return target.pricing === 'free' || target.pricing === 'unknown';
}

function hasSubmittedAttempt(target = {}) {
  return Boolean(target.submission?.last_submitted_at);
}

function summarizeAutomationReadiness(targets = []) {
  const audit = auditTargets(targets);
  const targetIdsWithBlockers = new Set(
    audit.blockers
      .map(item => item.target_id)
      .filter(Boolean)
  );
  const hasNoAuditBlockers = target => !targetIdsWithBlockers.has(target.id);
  const scoutCandidates = targets.filter(isUnscoutedScoutCandidate);
  const autoSafe = targets.filter(target => target.submission?.mode === 'auto_safe');
  const executeReadyFree = autoSafe.filter(target =>
    target.pricing === 'free' &&
    target.quality?.risk !== 'high' &&
    !hasSubmittedAttempt(target) &&
    hasNoAuditBlockers(target)
  );
  const pricingReview = autoSafe.filter(target =>
    target.pricing === 'unknown' &&
    hasNoAuditBlockers(target)
  );

  return {
    scout_queue_candidates: scoutCandidates.length,
    scout_queue_free_or_unknown: scoutCandidates.filter(isFreeOrUnknown).length,
    auto_safe_targets: autoSafe.length,
    execute_ready_auto_safe_free: executeReadyFree.length,
    auto_safe_pricing_review: pricingReview.length,
    assisted_targets: targets.filter(target => target.submission?.mode === 'assisted').length,
    manual_strategic_targets: targets.filter(target => target.submission?.mode === 'manual_strategic').length,
    skip_targets: targets.filter(target => target.submission?.mode === 'skip').length,
  };
}

export function summarizeRegistry(registryPath = DEFAULT_REGISTRY_FILE, opts = {}) {
  if (opts.explicit && !existsSync(registryPath)) {
    throw new Error(`registry file not found: ${registryPath}`);
  }

  const registry = loadRegistry(registryPath);
  const targets = registry.targets || [];

  return {
    path: registryPath,
    total: targets.length,
    stats: registryStats(targets),
    by_backlink_status: countBy(targets, target => target.submission?.backlink_status || 'unverified'),
    by_backlink_type: countBy(
      targets.filter(target => target.submission?.backlink_type),
      target => target.submission.backlink_type
    ),
    live_listing_count: targets.filter(target => target.submission?.live_listing_url).length,
    verified_live_listing_count: targets.filter(target =>
      target.submission?.backlink_status === 'verified' &&
      target.submission?.live_listing_url
    ).length,
    automation: summarizeAutomationReadiness(targets),
  };
}

function summarizePipeline(runSummary, verificationSummary, registrySummary) {
  const verificationByTarget = new Map(verificationSummary.latest.map(row => [row.target_key, row]));
  const submittedOrPending = runSummary.latest.filter(row => SUBMITTED_OR_PENDING_STATUSES.has(row.status));

  return {
    submitted_or_pending_targets: submittedOrPending.length,
    submitted_without_verification: submittedOrPending.filter(row => !verificationByTarget.has(row.target_key)).length,
    verified_targets: verificationSummary.verified,
    not_found_targets: verificationSummary.not_found,
    verification_skipped_targets: verificationSummary.skipped,
    verification_failed_targets: verificationSummary.failed,
    registry_verified_targets: registrySummary.by_backlink_status.verified || 0,
    registry_not_found_targets: registrySummary.by_backlink_status.not_found || 0,
    registry_live_listing_targets: registrySummary.live_listing_count,
  };
}

function summarizeBacklog(backlog = {}) {
  if (!backlog) return null;
  const files = backlog.files || {};
  const lanes = Array.isArray(backlog.lanes) ? backlog.lanes : [];
  const workers = Array.isArray(backlog.workers) ? backlog.workers : [];
  const laneFiles = Array.isArray(files.lanes) ? files.lanes : [];
  const workerFiles = Array.isArray(files.workers) ? files.workers : [];
  return {
    generated_at: backlog.generated_at || '',
    workflow_backlog: backlog.workflow_backlog || {},
    lanes_summary: backlog.lanes_summary || {},
    lane_policy: backlog.lane_policy || {},
    source_files: backlog.source_files || {},
    files: {
      output_dir: files.output_dir || parentDir(files.summary_json || DEFAULT_BACKLOG_PATH),
      summary_json: files.summary_json || '',
      summary_md: files.summary_md || '',
      merge_dir: files.merge_dir || '',
      lanes: laneFiles,
      workers: workerFiles,
    },
    lanes,
    workers,
  };
}

function laneFileIndex(backlogSummary = {}) {
  const entries = backlogSummary?.files?.lanes || [];
  return new Map(entries.map(item => [item.lane_id, item]));
}

function workerFileIndex(backlogSummary = {}) {
  const entries = backlogSummary?.files?.workers || [];
  return new Map(entries.map(item => [item.worker_id, item]));
}

function selectWorkerForLaneType(backlogSummary = {}, laneType = '') {
  const workers = Array.isArray(backlogSummary?.workers) ? backlogSummary.workers : [];
  const matchingWorkers = workers.filter(worker =>
    Array.isArray(worker.lanes) &&
    worker.lanes.some(lane => lane.lane_type === laneType)
  );
  if (!matchingWorkers.length) return null;
  return matchingWorkers.sort((a, b) =>
    priorityRank(a.lanes?.[0]?.priority) - priorityRank(b.lanes?.[0]?.priority) ||
    a.estimated_total_minutes - b.estimated_total_minutes ||
    a.worker_id.localeCompare(b.worker_id)
  )[0];
}

function selectLaneForType(backlogSummary = {}, laneType = '') {
  const lanes = Array.isArray(backlogSummary?.lanes) ? backlogSummary.lanes : [];
  const matches = lanes.filter(lane => lane.lane_type === laneType);
  if (!matches.length) return null;
  return matches.sort((a, b) =>
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.row_count - b.row_count ||
    a.lane_id.localeCompare(b.lane_id)
  )[0];
}

function workerOpenCommand(backlogSummary = {}, worker = null) {
  if (!worker) return '';
  const workerFiles = workerFileIndex(backlogSummary);
  const workerFile = workerFiles.get(worker.worker_id);
  return workerFile?.markdown ? `Open ${normalizePath(workerFile.markdown)}` : '';
}

function laneFollowupCommand(backlogSummary = {}, lane = null) {
  if (!lane) return '';
  const files = laneFileIndex(backlogSummary).get(lane.lane_id) || {};
  const laneCsv = files.csv || lane.rows?.[0]?.lane_csv_path || '';
  const commands = [];
  if (lane.rows?.[0]?.auth_login_command) {
    commands.push(lane.rows[0].auth_login_command);
  } else if (lane.rows?.[0]?.auth_scout_command) {
    commands.push(lane.rows[0].auth_scout_command);
  }
  if (lane.validate_command) commands.push(lane.validate_command);
  if (lane.merge_command) commands.push(lane.merge_command);
  if (lane.refresh_command) commands.push(lane.refresh_command);
  if (!commands.length && laneCsv) {
    commands.push(`Review ${normalizePath(laneCsv)}`);
  }
  return commands[0] || '';
}

function describeLaneAssignment(backlogSummary = {}, laneType = '') {
  const lane = selectLaneForType(backlogSummary, laneType);
  const worker = selectWorkerForLaneType(backlogSummary, laneType);
  const workerRef = worker ? `${worker.worker_id}` : 'unassigned-worker';
  const laneRef = lane ? `${lane.lane_id}` : 'unassigned-lane';
  return {
    worker,
    lane,
    summary: `${workerRef} / ${laneRef}`,
  };
}

function summarizeBacklogFreshness(backlogPath, backlogSummary, opts = {}) {
  if (!backlogSummary) return null;

  const staleAfterHours = Number.parseInt(opts.backlogStaleAfterHours ?? DEFAULT_BACKLOG_AGING_HOURS, 10);
  const staleHours = Number.isFinite(staleAfterHours) && staleAfterHours > 0
    ? staleAfterHours
    : DEFAULT_BACKLOG_AGING_HOURS;
  const candidates = uniqueStrings([
    backlogPath,
    backlogSummary.files?.summary_json,
    ...flattenPathValues(backlogSummary.files),
    ...flattenPathValues(backlogSummary.source_files),
  ]).filter(path => existsSync(path));

  const fileStats = candidates.map(path => {
    const stats = statSync(path);
    return {
      path: normalizePath(path),
      mtime_ms: stats.mtimeMs,
      mtime_iso: stats.mtime.toISOString(),
    };
  });

  const generatedMs = parseIsoMs(backlogSummary.generated_at);
  const newestFile = fileStats
    .slice()
    .sort((a, b) => b.mtime_ms - a.mtime_ms || a.path.localeCompare(b.path))[0] || null;
  const referenceMs = newestFile?.mtime_ms ?? generatedMs ?? null;
  const ageMs = referenceMs === null ? null : Date.now() - referenceMs;
  const ageHours = ageMs === null ? null : Number((ageMs / (1000 * 60 * 60)).toFixed(2));
  const isStale = ageHours !== null ? ageHours > staleHours : false;

  return {
    stale_after_hours: staleHours,
    generated_at: backlogSummary.generated_at || '',
    newest_file: newestFile ? {
      path: newestFile.path,
      mtime_iso: newestFile.mtime_iso,
    } : null,
    tracked_file_count: fileStats.length,
    age_hours: ageHours,
    is_stale: isStale,
  };
}

function action(priority, id, title, reason, command = '') {
  return { priority, id, title, reason, command };
}

function buildNextActions(runSummary, verificationSummary, registrySummary, backlogSummary, inputs = {}) {
  const actions = [];
  const registry = inputs.registry || DEFAULT_REGISTRY_FILE;
  const results = inputs.results || '<results.jsonl>';
  const automation = registrySummary.automation || {};
  const submittedWithoutVerification = summarizePipeline(runSummary, verificationSummary, registrySummary)
    .submitted_without_verification;
  const backlogWorkflow = backlogSummary?.workflow_backlog || {};
  const backlogSource = inputs.backlog || DEFAULT_BACKLOG_PATH;
  const backlogDir = parentDir(backlogSource);
  const backlogFreshness = inputs.backlogFreshness || null;

  if (submittedWithoutVerification > 0) {
    actions.push(action(
      1,
      'verify_submitted_results',
      'Verify submitted or pending listings',
      `${submittedWithoutVerification} submitted/pending target(s) have not been checked for a live backlink yet.`,
      `node src/cli.js verify-results ${results} --product-url <product-url> --update-registry --registry ${registry}`
    ));
  }

  if ((runSummary.dry_run_ready || 0) > 0) {
    actions.push(action(
      2,
      'execute_dry_run_ready_targets',
      'Review dry-run output, then execute auto_safe targets',
      `${runSummary.dry_run_ready} target(s) passed dry-run gating. Execute only after reviewing the plan and product readiness.`,
      `node src/cli.js pipeline --registry ${registry} --config config.yaml --free-only --mode auto_safe --limit ${runSummary.dry_run_ready} --execute --delay 90s`
    ));
  }

  if ((runSummary.targets || 0) === 0 && (automation.execute_ready_auto_safe_free || 0) > 0) {
    actions.push(action(
      3,
      'dry_run_auto_safe_targets',
      'Dry-run verified auto_safe targets',
      `${automation.execute_ready_auto_safe_free} free auto_safe target(s) have sufficient evidence for a dry-run plan.`,
      `node src/cli.js pipeline --registry ${registry} --free-only --mode auto_safe --limit ${Math.min(automation.execute_ready_auto_safe_free, 10)}`
    ));
  }

  if ((automation.scout_queue_free_or_unknown || 0) > 0) {
    actions.push(action(
      4,
      'scout_unverified_targets',
      'Scout unverified directory targets',
      `${automation.scout_queue_free_or_unknown} free/unknown-pricing target(s) still need scout evidence before automation.`,
      `node src/cli.js pipeline --registry ${registry} --free-only --allow-unknown-pricing --scout-queue --update-registry --limit ${Math.min(automation.scout_queue_free_or_unknown, 10)}`
    ));
  }

  if ((automation.auto_safe_pricing_review || 0) > 0) {
    actions.push(action(
      5,
      'review_unknown_pricing',
      'Manually verify pricing for auto_safe targets',
      `${automation.auto_safe_pricing_review} auto_safe target(s) have mapped forms but unknown pricing.`,
      `node src/cli.js targets pricing-review-queue --registry ${registry} --modes auto_safe --output-dir backlink-url/pricing-review`
    ));
  }

  if ((automation.assisted_targets || 0) > 0) {
    actions.push(action(
      6,
      'prepare_assisted_sessions',
      'Prepare assisted login sessions where appropriate',
      `${automation.assisted_targets} target(s) require human-in-the-loop login or account context.`,
      'node src/cli.js auth login --profile <target-id> --url <login-url>'
    ));
  }

  if (backlogFreshness?.is_stale) {
    actions.push(action(
      6,
      'refresh_stale_backlog_lanes',
      'Refresh stale backlog lane artifacts',
      `Backlog lane artifacts are ${backlogFreshness.age_hours} hour(s) old, which exceeds the ${backlogFreshness.stale_after_hours}-hour freshness threshold.`,
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`
    ));
  }

  if ((backlogWorkflow.auth_manual_login_rows || 0) > 0) {
    const assigned = describeLaneAssignment(backlogSummary, 'auth_manual_login');
    const command = workerOpenCommand(backlogSummary, assigned.worker) ||
      laneFollowupCommand(backlogSummary, assigned.lane) ||
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`;
    actions.push(action(
      7,
      'work_auth_manual_login_backlog',
      'Work the manual auth login backlog',
      `${backlogWorkflow.auth_manual_login_rows} auth login row(s) are queued in ${assigned.summary} and still require human login capture.`,
      command
    ));
  }

  if ((backlogWorkflow.auth_resolved_needs_scout_rows || 0) > 0) {
    const assigned = describeLaneAssignment(backlogSummary, 'auth_resolved_needs_scout');
    const command = workerOpenCommand(backlogSummary, assigned.worker) ||
      laneFollowupCommand(backlogSummary, assigned.lane) ||
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`;
    actions.push(action(
      8,
      'work_auth_needs_scout_backlog',
      'Refresh public scout evidence for auth-exited targets',
      `${backlogWorkflow.auth_resolved_needs_scout_rows} target(s) were intentionally moved out of auth and are assigned to ${assigned.summary} for fresh public scout evidence before reclassification.`,
      command
    ));
  }

  if ((backlogWorkflow.auth_resolved_manual_review_rows || 0) > 0) {
    const assigned = describeLaneAssignment(backlogSummary, 'auth_manual_review_fail_closed').lane
      ? describeLaneAssignment(backlogSummary, 'auth_manual_review_fail_closed')
      : describeLaneAssignment(backlogSummary, 'auth_manual_review_classification');
    const command = workerOpenCommand(backlogSummary, assigned.worker) ||
      laneFollowupCommand(backlogSummary, assigned.lane) ||
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`;
    actions.push(action(
      9,
      'work_auth_manual_review_backlog',
      'Resolve fail-closed auth manual review backlog',
      `${backlogWorkflow.auth_resolved_manual_review_rows} auth target(s) remain in fail-closed/manual classification review lanes, currently routed to ${assigned.summary}.`,
      command
    ));
  }

  if ((backlogWorkflow.coverage_manual_review_rows || 0) > 0) {
    const assigned = describeLaneAssignment(backlogSummary, 'coverage_manual_review_p0').lane
      ? describeLaneAssignment(backlogSummary, 'coverage_manual_review_p0')
      : describeLaneAssignment(backlogSummary, 'coverage_manual_review_p2');
    const command = workerOpenCommand(backlogSummary, assigned.worker) ||
      laneFollowupCommand(backlogSummary, assigned.lane) ||
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`;
    actions.push(action(
      10,
      'work_directory_coverage_backlog',
      'Process manual directory coverage review backlog',
      `${backlogWorkflow.coverage_manual_review_rows} coverage review row(s) still need human validation before any scout/import follow-up, starting with ${assigned.summary}.`,
      command
    ));
  }

  if ((backlogWorkflow.pricing_manual_rows || 0) > 0) {
    const assigned = describeLaneAssignment(backlogSummary, 'pricing_review_manual');
    const command = workerOpenCommand(backlogSummary, assigned.worker) ||
      laneFollowupCommand(backlogSummary, assigned.lane) ||
      `node src/cli.js targets backlog-lanes --output-dir ${normalizePath(backlogDir)}`;
    actions.push(action(
      11,
      'work_pricing_review_backlog',
      'Process manual pricing review backlog',
      `${backlogWorkflow.pricing_manual_rows} pricing review row(s) still need manual free-vs-paid validation, starting with ${assigned.summary}.`,
      command
    ));
  }

  if (!actions.length) {
    actions.push(action(
      99,
      'no_automation_backlog',
      'No immediate automation backlog detected',
      'No submitted verification backlog, dry-run queue, scout queue, pricing review queue, or manual backlog lane queue was detected.',
      ''
    ));
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildReport(opts = {}) {
  const resultRows = readJsonl(opts.results, 'results');
  const verificationRows = readJsonl(opts.verification, 'verification');
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const backlogPath = opts.backlog || DEFAULT_BACKLOG_PATH;
  const run = summarizeRunRows(resultRows);
  const verification = summarizeVerificationRows(verificationRows);
  const registry = summarizeRegistry(registryPath, { explicit: Boolean(opts.registry) });
  const backlog = summarizeBacklog(readJson(backlogPath, 'backlog', { optional: true }));
  const backlogFreshness = summarizeBacklogFreshness(backlogPath, backlog, opts);

  return {
    generated_at: nowIso(),
    inputs: {
      results: opts.results || null,
      verification: opts.verification || null,
      registry: registryPath,
      backlog: backlog ? backlogPath : null,
    },
    run,
    verification,
    registry,
    backlog,
    backlog_freshness: backlogFreshness,
    pipeline: summarizePipeline(run, verification, registry),
    next_actions: buildNextActions(run, verification, registry, backlog, {
      results: opts.results,
      registry: registryPath,
      backlog: backlogPath,
      backlogFreshness,
    }),
  };
}

function summarizeOpsTopBlockers(audit = {}) {
  const blockers = topCounts(countBy(audit.blockers || [], item => item.code), 5);
  const warnings = topCounts(countBy(audit.warnings || [], item => item.code), 5);
  return {
    blocker_codes: blockers,
    warning_codes: warnings,
  };
}

export function buildOpsStatus(opts = {}) {
  const report = buildReport(opts);
  const registryPath = report.inputs?.registry || opts.registry || DEFAULT_REGISTRY_FILE;
  const audit = auditRegistry(registryPath);
  const backlog = report.backlog || null;
  const backlogFreshness = report.backlog_freshness || null;
  const workerLeads = (backlog?.workers || [])
    .slice()
    .sort((a, b) =>
      priorityRank(a.lanes?.[0]?.priority) - priorityRank(b.lanes?.[0]?.priority) ||
      a.estimated_total_minutes - b.estimated_total_minutes ||
      a.worker_id.localeCompare(b.worker_id)
    )
    .map(worker => {
      const files = workerFileIndex(backlog).get(worker.worker_id) || {};
      return {
        worker_id: worker.worker_id,
        lane_count: worker.lane_count || 0,
        row_count: worker.row_count || 0,
        estimated_total_minutes: worker.estimated_total_minutes || 0,
        markdown: files.markdown || '',
        json: files.json || '',
        first_lane: worker.lanes?.[0] || null,
      };
    });

  return {
    generated_at: nowIso(),
    inputs: report.inputs,
    headline: {
      registry_targets: report.registry?.total || 0,
      execute_ready_auto_safe_free: report.registry?.automation?.execute_ready_auto_safe_free || 0,
      assisted_targets: report.registry?.automation?.assisted_targets || 0,
      backlog_rows: report.backlog?.workflow_backlog?.total_workflow_rows || 0,
      stale_backlog: Boolean(backlogFreshness?.is_stale),
    },
    readiness: {
      automation_ready: audit.ok,
      audit_blockers: audit.summary?.blockers || 0,
      audit_warnings: audit.summary?.warnings || 0,
      top: summarizeOpsTopBlockers(audit),
    },
    backlog: backlog ? {
      workflow_backlog: backlog.workflow_backlog || {},
      lanes_summary: backlog.lanes_summary || {},
      freshness: backlogFreshness,
      worker_leads: workerLeads,
    } : null,
    pipeline: report.pipeline,
    registry: {
      total: report.registry?.total || 0,
      automation: report.registry?.automation || {},
      by_backlink_status: report.registry?.by_backlink_status || {},
    },
    next_actions: report.next_actions,
  };
}

function formatCounts(counts = {}) {
  const entries = Object.entries(counts);
  if (!entries.length) return '{}';
  return entries.map(([key, value]) => `${key}:${value}`).join(', ');
}

export function formatReport(report = {}) {
  return [
    'Backlink Pilot Report',
    `Generated: ${report.generated_at || ''}`,
    `Results: ${report.inputs?.results || '(none)'}`,
    `Verification: ${report.inputs?.verification || '(none)'}`,
    `Registry: ${report.inputs?.registry || '(none)'}`,
    `Backlog: ${report.inputs?.backlog || '(none)'}`,
    `Backlog freshness: ${report.backlog_freshness ? `${report.backlog_freshness.is_stale ? 'stale' : 'fresh'}${report.backlog_freshness.age_hours !== null ? ` (${report.backlog_freshness.age_hours}h)` : ''}` : '(none)'}`,
    '',
    'Run results',
    `Events: ${report.run?.events || 0}`,
    `Latest targets: ${report.run?.targets || 0}`,
    `Submitted or pending: ${report.run?.submitted_or_pending || 0}`,
    `By status: ${formatCounts(report.run?.by_status)}`,
    '',
    'Verification',
    `Events: ${report.verification?.events || 0}`,
    `Latest targets: ${report.verification?.targets || 0}`,
    `Verified: ${report.verification?.verified || 0}`,
    `Not found: ${report.verification?.not_found || 0}`,
    `Skipped: ${report.verification?.skipped || 0}`,
    `Failed: ${report.verification?.failed || 0}`,
    `By link type: ${formatCounts(report.verification?.by_link_type)}`,
    '',
    'Registry evidence',
    `Targets: ${report.registry?.total || 0}`,
    `Backlink status: ${formatCounts(report.registry?.by_backlink_status)}`,
    `Backlink type: ${formatCounts(report.registry?.by_backlink_type)}`,
    `Live listings: ${report.registry?.live_listing_count || 0}`,
    '',
    'Pipeline gaps',
    `Submitted without verification: ${report.pipeline?.submitted_without_verification || 0}`,
    `Registry verified targets: ${report.pipeline?.registry_verified_targets || 0}`,
    `Registry not found targets: ${report.pipeline?.registry_not_found_targets || 0}`,
    '',
    'Automation readiness',
    `Scout queue candidates: ${report.registry?.automation?.scout_queue_candidates || 0}`,
    `Scout queue free/unknown: ${report.registry?.automation?.scout_queue_free_or_unknown || 0}`,
    `Auto-safe targets: ${report.registry?.automation?.auto_safe_targets || 0}`,
    `Execute-ready free auto_safe: ${report.registry?.automation?.execute_ready_auto_safe_free || 0}`,
    `Auto-safe pricing review: ${report.registry?.automation?.auto_safe_pricing_review || 0}`,
    `Assisted targets: ${report.registry?.automation?.assisted_targets || 0}`,
    '',
    'Manual backlog',
    `Workflow rows: ${report.backlog?.workflow_backlog?.total_workflow_rows || 0}`,
    `Auth manual login: ${report.backlog?.workflow_backlog?.auth_manual_login_rows || 0}`,
    `Auth resolved needs-scout: ${report.backlog?.workflow_backlog?.auth_resolved_needs_scout_rows || 0}`,
    `Auth resolved manual-review: ${report.backlog?.workflow_backlog?.auth_resolved_manual_review_rows || 0}`,
    `Coverage manual review: ${report.backlog?.workflow_backlog?.coverage_manual_review_rows || 0}`,
    `Pricing manual review: ${report.backlog?.workflow_backlog?.pricing_manual_rows || 0}`,
    `Lane count: ${report.backlog?.lanes_summary?.lane_count || 0}`,
    `Lane types: ${formatCounts(report.backlog?.lanes_summary?.by_type)}`,
    '',
    'Next actions',
    ...((report.next_actions || []).map(item =>
      `P${item.priority} ${item.id}: ${item.title}${item.command ? ` - ${item.command}` : ''}`
    )),
  ].join('\n');
}

export function formatOpsStatus(status = {}) {
  const workerLines = (status.backlog?.worker_leads || []).map(worker =>
    `- ${worker.worker_id}: lanes=${worker.lane_count} rows=${worker.row_count} est_minutes=${worker.estimated_total_minutes}${worker.markdown ? ` file=${worker.markdown}` : ''}`
  );
  const blockerLines = (status.readiness?.top?.blocker_codes || []).map(item =>
    `- ${item.code}: ${item.count}`
  );

  return [
    'Backlink Pilot Ops Status',
    `Generated: ${status.generated_at || ''}`,
    `Registry: ${status.inputs?.registry || '(none)'}`,
    `Backlog: ${status.inputs?.backlog || '(none)'}`,
    '',
    'Headline',
    `Registry targets: ${status.headline?.registry_targets || 0}`,
    `Execute-ready auto_safe free: ${status.headline?.execute_ready_auto_safe_free || 0}`,
    `Assisted targets: ${status.headline?.assisted_targets || 0}`,
    `Backlog rows: ${status.headline?.backlog_rows || 0}`,
    `Backlog stale: ${status.headline?.stale_backlog ? 'yes' : 'no'}`,
    '',
    'Readiness',
    `Automation ready: ${status.readiness?.automation_ready ? 'yes' : 'no'}`,
    `Audit blockers: ${status.readiness?.audit_blockers || 0}`,
    `Audit warnings: ${status.readiness?.audit_warnings || 0}`,
    `Top blocker codes: ${blockerLines.length ? '' : '(none)'}`,
    ...blockerLines,
    '',
    'Backlog',
    `Workflow rows: ${status.backlog?.workflow_backlog?.total_workflow_rows || 0}`,
    `Lane count: ${status.backlog?.lanes_summary?.lane_count || 0}`,
    `Lane types: ${formatCounts(status.backlog?.lanes_summary?.by_type)}`,
    `Freshness: ${status.backlog?.freshness ? `${status.backlog.freshness.is_stale ? 'stale' : 'fresh'}${status.backlog.freshness.age_hours !== null ? ` (${status.backlog.freshness.age_hours}h)` : ''}` : '(none)'}`,
    'Worker leads',
    ...(workerLines.length ? workerLines : ['- (none)']),
    '',
    'Next actions',
    ...((status.next_actions || []).map(item =>
      `P${item.priority} ${item.id}: ${item.title}${item.command ? ` - ${item.command}` : ''}`
    )),
  ].join('\n');
}
