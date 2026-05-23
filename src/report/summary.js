import { existsSync, readFileSync } from 'fs';
import { DEFAULT_REGISTRY_FILE, loadRegistry, registryStats } from '../targets/registry.js';
import { auditTargets } from '../targets/audit.js';

const SUBMITTED_OR_PENDING_STATUSES = new Set(['submitted', 'pending_review', 'accepted']);
const SCOUT_QUEUE_MODES = new Set(['auto_candidate', 'needs_scout']);

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

function readJsonl(path, label) {
  if (!path) return [];
  if (!existsSync(path)) throw new Error(`${label} file not found: ${path}`);
  return readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
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

function action(priority, id, title, reason, command = '') {
  return { priority, id, title, reason, command };
}

function buildNextActions(runSummary, verificationSummary, registrySummary, inputs = {}) {
  const actions = [];
  const registry = inputs.registry || DEFAULT_REGISTRY_FILE;
  const results = inputs.results || '<results.jsonl>';
  const automation = registrySummary.automation || {};
  const submittedWithoutVerification = summarizePipeline(runSummary, verificationSummary, registrySummary)
    .submitted_without_verification;

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

  if (!actions.length) {
    actions.push(action(
      9,
      'no_automation_backlog',
      'No immediate automation backlog detected',
      'No submitted verification backlog, dry-run queue, auto_safe queue, or unscouted free/unknown queue was detected.',
      ''
    ));
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildReport(opts = {}) {
  const resultRows = readJsonl(opts.results, 'results');
  const verificationRows = readJsonl(opts.verification, 'verification');
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const run = summarizeRunRows(resultRows);
  const verification = summarizeVerificationRows(verificationRows);
  const registry = summarizeRegistry(registryPath, { explicit: Boolean(opts.registry) });

  return {
    generated_at: nowIso(),
    inputs: {
      results: opts.results || null,
      verification: opts.verification || null,
      registry: registryPath,
    },
    run,
    verification,
    registry,
    pipeline: summarizePipeline(run, verification, registry),
    next_actions: buildNextActions(run, verification, registry, {
      results: opts.results,
      registry: registryPath,
    }),
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
    'Next actions',
    ...((report.next_actions || []).map(item =>
      `P${item.priority} ${item.id}: ${item.title}${item.command ? ` - ${item.command}` : ''}`
    )),
  ].join('\n');
}
