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
  buildAssistedSubmissionPack,
  buildCrossDomainFinalUrlDecisionPatch,
  validateCrossDomainFinalUrlDecisions,
  writeCrossDomainFinalUrlDecisionPatchReport,
  writeAssistedSubmissionPack,
} from './assisted-pack.js';
import {
  buildAuthLoginPlan,
  writeAuthLoginPlan,
} from './auth-login-plan.js';
import {
  buildAuthLoginNext,
  buildAuthLoginStatus,
  writeAuthLoginNext,
  writeAuthLoginStatus,
} from './auth-login-status.js';
import {
  buildAuthLoginOperatorPack,
  writeAuthLoginOperatorPack,
} from './auth-login-operator-pack.js';
import {
  buildAuthRescoutPlan,
  writeAuthRescoutPlan,
} from './auth-rescout-plan.js';
import {
  buildAuthWorkflowRefresh,
  writeAuthWorkflowRefresh,
} from './auth-workflow-refresh.js';
import {
  applyCoverageReviewQueue,
  buildCoverageReviewEvidence,
  buildCoverageReviewBatch,
  buildCoverageReviewDraft,
  buildCoverageReport,
  buildCoverageReviewManualPack,
  buildCoverageReviewQueue,
  buildCoverageReviewSuggestions,
  importCoverageReview,
  promoteCoverageReviewBatch,
  validateCoverageReviewBatch,
  validateCoverageReview,
  writeCoverageCandidatesCsv,
  writeCoverageReviewEvidence,
  writeCoverageReviewSuggestions,
  writeCoverageReviewDraft,
  writeCoverageReviewManualPack,
  writeCoverageReviewBatch,
  writeCoverageReviewPromotionReport,
  writeCoverageReport,
  writeCoverageReviewQueue,
  writeCoverageReviewCsv,
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

export async function assistedSubmissionPackCommand(opts = {}) {
  const pack = buildAssistedSubmissionPack({
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    productConfig: opts.productConfig,
    modes: opts.modes,
    offset: opts.offset,
    limit: opts.limit,
    includePaid: Boolean(opts.includePaid),
    includeHighRisk: Boolean(opts.includeHighRisk),
    includeSubmitted: Boolean(opts.includeSubmitted),
    productContextPaths: opts.productContextPaths,
  });
  const written = writeAssistedSubmissionPack(pack, {
    outputDir: opts.outputDir,
  });
  const result = {
    ...pack.summary,
    output_dir: written.output_dir,
    files: written.files,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`Registry: ${pack.registry}`);
  console.log(`Output dir: ${written.output_dir}`);
  console.log(`Rows: ${pack.summary.total_rows}`);
  console.log(`Next rows: ${pack.summary.next_rows}`);
  console.log(`Excluded rows: ${pack.summary.excluded_rows}`);
  console.log(`Priority counts: ${JSON.stringify(pack.summary.by_priority)}`);
  console.log(`Manual buckets: ${JSON.stringify(pack.summary.by_manual_bucket)}`);
  console.log(`Automation after human: ${JSON.stringify(pack.summary.by_automation_after_human)}`);
  console.log(`Full CSV: ${written.files.full_csv}`);
  console.log(`Next CSV: ${written.files.next_csv}`);
  console.log(`Summary: ${written.files.summary_md}`);

  return result;
}

export async function validateCrossDomainFinalUrlDecisionsCommand(filePath, opts = {}) {
  const result = validateCrossDomainFinalUrlDecisions(filePath, {
    allowUnreviewed: Boolean(opts.allowUnreviewed),
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok && opts.failOnBlockers) process.exitCode = 1;
    return result;
  }

  console.log(`Decision file: ${result.file}`);
  console.log(`Rows: ${result.rows}`);
  console.log(`OK: ${result.ok}`);
  console.log(`Blockers: ${result.blockers_count}`);
  console.log(`Warnings: ${result.warnings_count}`);
  console.log(`By decision: ${JSON.stringify(result.by_decision)}`);
  for (const item of result.blockers.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`BLOCKER\tline:${item.line}\t${item.code}\t${item.target_id}\t${item.message}`);
  }
  for (const item of result.warnings.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`WARNING\tline:${item.line}\t${item.code}\t${item.target_id}\t${item.message}`);
  }
  if (!result.ok && opts.failOnBlockers) process.exitCode = 1;

  return result;
}

export async function applyCrossDomainFinalUrlDecisionsCommand(filePath, opts = {}) {
  const result = buildCrossDomainFinalUrlDecisionPatch(
    opts.registry || DEFAULT_REGISTRY_FILE,
    filePath,
    {
      requireReviewer: opts.requireReviewer !== false,
      requireReviewNotes: opts.requireReviewNotes !== false,
    }
  );

  if (opts.output) {
    result.output = opts.output;
    const written = writeCrossDomainFinalUrlDecisionPatchReport(result, opts.output);
    result.output = written;
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  console.log(`Decision file: ${result.decision_file}`);
  console.log(`Registry: ${result.registry}`);
  console.log(`Dry run: ${result.dry_run}`);
  console.log(`Wrote registry: ${result.wrote_registry}`);
  console.log(`OK: ${result.ok}`);
  console.log(`Status: ${result.status}`);
  console.log(`Rows: ${result.rows}`);
  console.log(`Proposals: ${result.proposals_count}`);
  console.log(`Skipped: ${result.skipped_rows}`);
  console.log(`Blockers: ${result.blockers_count}`);
  if (result.output) console.log(`Patch report: ${result.output}`);

  for (const item of result.blockers.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`BLOCKER\tline:${item.line}\t${item.code}\t${item.target_id}\t${item.message}`);
  }
  for (const item of result.proposals.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`PROPOSAL\tline:${item.line}\t${item.target_id}\t${item.action}\tchanges:${Object.keys(item.changes || {}).length}`);
  }
  if (!result.ok) process.exitCode = 1;

  return result;
}

export async function authLoginPlanCommand(queuePath, opts = {}) {
  const plan = buildAuthLoginPlan(queuePath, {
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    productConfig: opts.productConfig,
    authDir: opts.authDir,
    offset: opts.offset,
    limit: opts.limit,
  });
  const written = writeAuthLoginPlan(plan, {
    output: opts.output,
    csvOutput: opts.csvOutput,
  });

  if (opts.json) {
    console.log(JSON.stringify({ ...plan, files: written }, null, 2));
    return plan;
  }

  console.log(`Queue: ${plan.source_queue}`);
  console.log(`Registry: ${plan.registry}`);
  console.log(`Manual login queued: ${plan.targets.length}`);
  console.log(`Pending login rows: ${plan.summary.pending_rows}`);
  console.log(`Batch: ${plan.summary.current_batch_start}-${plan.summary.current_batch_end} of ${plan.summary.pending_rows}`);
  console.log(`Remaining after batch: ${plan.summary.remaining_after_batch}`);
  console.log(`Completed profiles: ${plan.completed.length}`);
  console.log(`Excluded: ${plan.excluded.length}`);
  console.log(`Exclusion reasons: ${JSON.stringify(plan.summary.by_exclusion_reason)}`);
  if (written.output) console.log(`Plan written: ${written.output}`);
  if (written.csv_output) console.log(`CSV written: ${written.csv_output}`);
  for (const target of plan.targets.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${target.order}. ${target.priority}\t${target.target_id}\t${target.login_url}`);
  }

  return plan;
}

export async function authLoginStatusCommand(batchPath, opts = {}) {
  const report = buildAuthLoginStatus(batchPath, {
    authDir: opts.authDir,
  });
  const written = writeAuthLoginStatus(report, {
    output: opts.output,
    csvOutput: opts.csvOutput,
  });

  if (opts.json) {
    console.log(JSON.stringify({ ...report, files: written }, null, 2));
    return report;
  }

  console.log(`Batch: ${report.source_batch}`);
  console.log(`Auth dir: ${report.constraints.auth_dir}`);
  console.log(`Rows: ${report.summary.source_rows}`);
  console.log(`Profiles found: ${report.summary.auth_profiles_found}`);
  console.log(`Profiles missing: ${report.summary.auth_profiles_missing}`);
  console.log(`Ready for auth rescout: ${report.summary.ready_for_auth_rescout_rows}`);
  console.log(`Status counts: ${JSON.stringify(report.summary.by_status)}`);
  console.log(`Next actions: ${JSON.stringify(report.summary.by_next_action)}`);
  if (written.output) console.log(`Report written: ${written.output}`);
  if (written.csv_output) console.log(`CSV written: ${written.csv_output}`);
  for (const row of report.rows.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${row.order}. ${row.status}\t${row.target_id}\t${row.next_action}`);
  }

  return report;
}

export async function authLoginNextCommand(batchPaths, opts = {}) {
  const report = buildAuthLoginNext(batchPaths, {
    authDir: opts.authDir,
    offset: opts.offset,
    limit: opts.limit,
  });
  const written = writeAuthLoginNext(report, {
    output: opts.output,
    csvOutput: opts.csvOutput,
  });

  if (opts.json) {
    console.log(JSON.stringify({ ...report, files: written }, null, 2));
    return report;
  }

  console.log(`Batches: ${report.source_batches.join(', ')}`);
  console.log(`Auth dir: ${report.constraints.auth_dir}`);
  console.log(`Actionable login rows: ${report.summary.actionable_rows}`);
  console.log(`Tasks selected: ${report.summary.task_rows}`);
  console.log(`Batch: ${report.summary.current_batch_start}-${report.summary.current_batch_end} of ${report.summary.actionable_rows}`);
  console.log(`Remaining after batch: ${report.summary.remaining_after_batch}`);
  console.log(`Priority counts: ${JSON.stringify(report.summary.by_priority)}`);
  console.log(`Exclusion reasons: ${JSON.stringify(report.summary.by_exclusion_reason)}`);
  if (written.output) console.log(`Tasks written: ${written.output}`);
  if (written.csv_output) console.log(`CSV written: ${written.csv_output}`);
  for (const row of report.tasks.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${row.task_order}. ${row.priority}\t${row.target_id}\t${row.auth_login_command}`);
  }

  return report;
}

export async function authLoginOperatorPackCommand(inputPath, opts = {}) {
  const pack = buildAuthLoginOperatorPack(inputPath, {
    refreshCommand: opts.refreshCommand,
  });
  const written = writeAuthLoginOperatorPack(pack, {
    outputDir: opts.outputDir,
    name: opts.name,
  });

  if (opts.json) {
    console.log(JSON.stringify({ ...pack, files: written }, null, 2));
    return pack;
  }

  console.log(`Source: ${pack.source}`);
  console.log(`Tasks: ${pack.summary.task_rows}`);
  console.log(`Runnable manual login rows: ${pack.summary.runnable_manual_login_rows}`);
  console.log(`Blocked rows: ${pack.summary.blocked_rows}`);
  console.log(`Markdown: ${written.markdown}`);
  console.log(`PowerShell: ${written.powershell}`);
  console.log(`Summary: ${written.summary}`);
  for (const task of pack.tasks.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${task.task_order}. ${task.priority}\t${task.target_id}\t${task.login_url}`);
  }

  return pack;
}

export async function authRescoutPlanCommand(queuePath, opts = {}) {
  const plan = buildAuthRescoutPlan(queuePath, {
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    productConfig: opts.productConfig,
    authDir: opts.authDir,
    limit: opts.limit,
  });

  if (opts.output) {
    writeAuthRescoutPlan(plan, opts.output);
  }

  if (opts.json) {
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  console.log(`Queue: ${plan.source_queue}`);
  console.log(`Registry: ${plan.registry}`);
  console.log(`Targets queued: ${plan.targets.length}`);
  console.log(`Excluded: ${plan.excluded.length}`);
  console.log(`Auth profiles found: ${plan.summary.auth_profiles_found}`);
  console.log(`Auth profiles missing: ${plan.summary.auth_profiles_missing}`);
  console.log(`Exclusion reasons: ${JSON.stringify(plan.summary.by_exclusion_reason)}`);
  if (opts.output) console.log(`Plan written: ${opts.output}`);
  for (const target of plan.targets.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${target.order}. ${target.id} - ${target.auth_profile} - ${target.submit_url}`);
  }

  return plan;
}

export async function authWorkflowRefreshCommand(queuePath, batchPaths, opts = {}) {
  const report = buildAuthWorkflowRefresh(queuePath, batchPaths, {
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    productConfig: opts.productConfig,
    authDir: opts.authDir,
    nextOffset: opts.nextOffset,
    nextLimit: opts.nextLimit || opts.limit,
    rescoutLimit: opts.rescoutLimit,
  });
  const written = writeAuthWorkflowRefresh(report, {
    outputDir: opts.outputDir,
    nextName: opts.nextName,
    summaryName: opts.summaryName,
  });

  if (opts.json) {
    console.log(JSON.stringify({
      version: report.version,
      created_at: report.created_at,
      source_queue: report.source_queue,
      source_batches: report.source_batches,
      constraints: report.constraints,
      files: written,
      summary: report.summary,
    }, null, 2));
    return report;
  }

  console.log(`Queue: ${report.source_queue}`);
  console.log(`Batches: ${report.source_batches.join(', ')}`);
  console.log(`Auth dir: ${report.constraints.auth_dir}`);
  console.log(`Status rows: ${report.summary.status.source_rows}`);
  console.log(`Profiles found: ${report.summary.status.auth_profiles_found}`);
  console.log(`Profiles missing: ${report.summary.status.auth_profiles_missing}`);
  console.log(`Ready for auth rescout: ${report.summary.status.ready_for_auth_rescout_rows}`);
  console.log(`Next login tasks: ${report.summary.next_login.task_rows}`);
  console.log(`Auth rescout queued: ${report.summary.auth_rescout.queued_rows}`);
  console.log(`Auth rescout missing profiles: ${report.summary.auth_rescout.auth_profiles_missing}`);
  console.log(`Output dir: ${written.output_dir}`);
  console.log(`Next login CSV: ${written.next_login.csv_output}`);
  console.log(`Auth rescout plan: ${written.auth_rescout}`);
  console.log(`Summary: ${written.summary}`);
  for (const task of report.next_login.tasks.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${task.task_order}. ${task.priority}\t${task.target_id}\t${task.auth_login_command}`);
  }

  return report;
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

  if (opts.review) {
    writeCoverageReviewCsv(report, opts.review, {
      includeExact: Boolean(opts.includeExact),
    });
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
  if (opts.review) console.log(`Review CSV: ${opts.review}`);

  return report;
}

export async function importCoverageReviewCommand(reviewPath, opts = {}) {
  const result = importCoverageReview(
    opts.registry || DEFAULT_REGISTRY_FILE,
    reviewPath,
    {
      source: opts.source || 'coverage-review',
      group: opts.group || 'coverage-review',
      lang: opts.lang,
      dryRun: Boolean(opts.dryRun),
      allowPartial: Boolean(opts.allowPartial),
    }
  );

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.blocked_import) process.exitCode = 1;
    return result;
  }

  console.log(`Review: ${result.review}`);
  console.log(`Registry: ${result.path}`);
  console.log(`Dry run: ${result.dry_run}`);
  console.log(`Rows: ${result.rows}`);
  console.log(`Approved rows: ${result.approved_rows}`);
  console.log(`Imported: ${result.imported}`);
  console.log(`Would import: ${result.would_import}`);
  console.log(`Duplicates merged: ${result.duplicates}`);
  console.log(`Skipped rows: ${result.skipped}`);
  console.log(`Blocked rows: ${result.blocked}`);
  console.log(`Registry total: ${result.registry_total}`);
  console.log(`Resulting total: ${result.resulting_total}`);
  console.log(`Mode policy: ${result.mode_policy}`);

  if (result.blocked_import) {
    console.log('Import blocked: approved rows failed safety checks. Fix the review file or pass --allow-partial for a controlled partial import.');
    for (const row of result.blocked_rows.slice(0, 10)) {
      console.log(`- line ${row.line}: ${row.reason} ${row.url}`);
    }
    process.exitCode = 1;
  }

  return result;
}

export async function validateCoverageReviewCommand(reviewPath, opts = {}) {
  const result = validateCoverageReview(reviewPath, {
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok && opts.failOnBlockers) process.exitCode = 1;
    return result;
  }

  console.log(`Review: ${result.review}`);
  console.log(`Rows: ${result.rows}`);
  console.log(`Approved rows: ${result.approved}`);
  console.log(`Rejected rows: ${result.rejected}`);
  console.log(`Unreviewed rows: ${result.unreviewed}`);
  console.log(`Unknown decisions: ${result.unknown_decision}`);
  console.log(`Blockers: ${result.blockers_count}`);
  console.log(`Warnings: ${result.warnings_count}`);
  for (const item of result.blockers.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`BLOCKER\tline:${item.line}\t${item.code}\t${item.url}`);
  }
  for (const item of result.warnings.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`WARNING\tline:${item.line}\t${item.code}\t${item.url}`);
  }
  if (!result.ok && opts.failOnBlockers) process.exitCode = 1;

  return result;
}

export async function validateCoverageReviewBatchCommand(batchPath, opts = {}) {
  const result = validateCoverageReviewBatch(batchPath, {
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok && opts.failOnBlockers) process.exitCode = 1;
    return result;
  }

  console.log(`Batch: ${result.batch}`);
  console.log(`Rows: ${result.rows}`);
  console.log(`Approved rows: ${result.approved}`);
  console.log(`Rejected rows: ${result.rejected}`);
  console.log(`Unreviewed rows: ${result.unreviewed}`);
  console.log(`Unknown decisions: ${result.unknown_decision}`);
  console.log(`Blockers: ${result.blockers_count}`);
  console.log(`Warnings: ${result.warnings_count}`);
  for (const item of result.blockers.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`BLOCKER\tline:${item.line}\t${item.code}\t${item.url}`);
  }
  for (const item of result.warnings.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
    console.log(`WARNING\tline:${item.line}\t${item.code}\t${item.url}`);
  }
  if (!result.ok && opts.failOnBlockers) process.exitCode = 1;

  return result;
}

export async function coverageReviewQueueCommand(reviewPath, opts = {}) {
  const queue = buildCoverageReviewQueue(reviewPath, {
    includeSkipped: Boolean(opts.includeSkipped),
  });

  if (opts.output) {
    writeCoverageReviewQueue(queue, opts.output);
  }

  if (opts.json) {
    console.log(JSON.stringify(queue, null, 2));
    return queue;
  }

  console.log(`Review: ${queue.review}`);
  console.log(`Review rows: ${queue.total_review_rows}`);
  console.log(`Queue rows: ${queue.queue_rows}`);
  console.log(`Priority counts: ${JSON.stringify(queue.priority_counts)}`);
  if (opts.output) console.log(`Queue CSV: ${opts.output}`);
  for (const row of queue.rows.slice(0, Number.parseInt(opts.limit || 10, 10))) {
    console.log(`${row.priority}\t${row.priority_score}\trow:${row.review_row}\t${row.review_action}\t${row.url}`);
  }

  return queue;
}

export async function coverageReviewBatchCommand(queuePath, opts = {}) {
  const batch = buildCoverageReviewBatch(queuePath, {
    priority: opts.priority,
    action: opts.action,
    offset: opts.offset,
    limit: opts.limit,
    batchId: opts.batchId,
  });

  writeCoverageReviewBatch(batch, {
    output: opts.output,
    markdown: opts.markdown,
  });

  if (opts.json) {
    console.log(JSON.stringify(batch, null, 2));
    return batch;
  }

  console.log(`Queue: ${batch.queue}`);
  console.log(`Batch: ${batch.batch_id}`);
  console.log(`Matching rows: ${batch.matching_rows}`);
  console.log(`Batch rows: ${batch.batch_rows}`);
  console.log(`Remaining after batch: ${batch.remaining_after_batch}`);
  console.log(`Priority counts: ${JSON.stringify(batch.priority_counts)}`);
  console.log(`Action counts: ${JSON.stringify(batch.action_counts)}`);
  if (opts.output) console.log(`Batch CSV: ${opts.output}`);
  if (opts.markdown) console.log(`Batch instructions: ${opts.markdown}`);
  for (const row of batch.rows.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log(`${row.batch_order}\t${row.priority}\trow:${row.review_row}\t${row.review_action}\t${row.url}`);
  }

  return batch;
}

export async function coverageReviewEvidenceCommand(batchPath, opts = {}) {
  const evidence = await buildCoverageReviewEvidence(batchPath, {
    offset: opts.offset,
    limit: opts.limit,
    timeoutMs: opts.timeoutMs,
    userAgent: opts.userAgent,
  });

  writeCoverageReviewEvidence(evidence, {
    output: opts.output,
    jsonOutput: opts.jsonOutput,
  });

  if (opts.json) {
    console.log(JSON.stringify(evidence, null, 2));
    return evidence;
  }

  console.log(`Batch: ${evidence.batch}`);
  console.log(`Rows: ${evidence.total_rows}`);
  console.log(`Checked rows: ${evidence.checked_rows}`);
  console.log(`Summary: ${JSON.stringify(evidence.summary)}`);
  if (opts.output) console.log(`Evidence CSV: ${opts.output}`);
  if (opts.jsonOutput) console.log(`Evidence JSON: ${opts.jsonOutput}`);
  for (const row of evidence.evidence_rows.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log([
      row.batch_order,
      row.http_status || 'ERR',
      row.suggested_decision,
      row.form_count,
      row.auth_signal,
      row.payment_signal,
      row.url,
    ].join('\t'));
  }

  return evidence;
}

export async function coverageReviewSuggestCommand(batchPath, evidencePath, opts = {}) {
  const suggestions = buildCoverageReviewSuggestions(batchPath, evidencePath, {
    offset: opts.offset,
    limit: opts.limit,
  });

  writeCoverageReviewSuggestions(suggestions, {
    output: opts.output,
    jsonOutput: opts.jsonOutput,
  });

  if (opts.json) {
    console.log(JSON.stringify(suggestions, null, 2));
    return suggestions;
  }

  console.log(`Batch: ${suggestions.batch}`);
  console.log(`Evidence: ${suggestions.evidence}`);
  console.log(`Batch rows: ${suggestions.total_batch_rows}`);
  console.log(`Evidence rows: ${suggestions.evidence_rows}`);
  console.log(`Suggestion rows: ${suggestions.suggestion_rows}`);
  console.log(`Summary: ${JSON.stringify(suggestions.summary)}`);
  if (opts.output) console.log(`Suggestion CSV: ${opts.output}`);
  if (opts.jsonOutput) console.log(`Suggestion JSON: ${opts.jsonOutput}`);
  for (const row of suggestions.rows.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log([
      row.batch_order,
      row.suggested_review_decision,
      row.suggestion_confidence,
      row.possible_approval_decision || '-',
      row.reviewer_action,
      row.url,
    ].join('\t'));
  }

  return suggestions;
}

export async function coverageReviewDraftCommand(batchPath, suggestionsPath, opts = {}) {
  let draft;
  try {
    draft = buildCoverageReviewDraft(batchPath, suggestionsPath, {
      minConfidence: opts.minConfidence,
      reviewedBy: opts.reviewedBy,
      decisions: opts.decisions,
    });
  } catch (error) {
    console.error(`Draft blocked: ${error.message || String(error)}`);
    process.exitCode = 1;
    return null;
  }

  writeCoverageReviewDraft(draft, {
    output: opts.output,
    jsonOutput: opts.jsonOutput,
  });

  if (opts.json) {
    const { rows, ...publicDraft } = draft;
    console.log(JSON.stringify(publicDraft, null, 2));
    return draft;
  }

  console.log(`Batch: ${draft.batch}`);
  console.log(`Suggestions: ${draft.suggestions}`);
  console.log(`Batch rows: ${draft.batch_rows}`);
  console.log(`Suggestion rows: ${draft.suggestion_rows}`);
  console.log(`Drafted rows: ${draft.drafted_rows}`);
  console.log(`Skipped rows: ${draft.skipped_rows}`);
  console.log(`Blocked rows: ${draft.blocked_rows}`);
  console.log(`Min confidence: ${draft.min_confidence}`);
  console.log(`Enabled rejection decisions: ${draft.enabled_rejection_decisions.join(', ')}`);
  if (opts.output) console.log(`Draft batch CSV: ${opts.output}`);
  if (opts.jsonOutput) console.log(`Draft report JSON: ${opts.jsonOutput}`);
  for (const row of draft.drafted.slice(0, Number.parseInt(opts.preview || 10, 10))) {
    console.log([
      row.review_row,
      row.suggested_review_decision,
      row.suggestion_confidence,
      row.url,
    ].join('\t'));
  }

  if (draft.blocked_rows > 0) process.exitCode = 1;
  return draft;
}

export async function applyCoverageReviewQueueCommand(reviewPath, queuePath, opts = {}) {
  if (!opts.dryRun && !opts.output && !opts.inPlace) {
    throw new Error('Refusing to apply review queue without --dry-run, --output, or --in-place.');
  }

  const result = applyCoverageReviewQueue(reviewPath, queuePath, {
    dryRun: Boolean(opts.dryRun),
    output: opts.output,
    inPlace: Boolean(opts.inPlace),
    allowPartial: Boolean(opts.allowPartial),
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.blocked_apply) process.exitCode = 1;
    return result;
  }

  console.log(`Review: ${result.review}`);
  console.log(`Queue: ${result.queue}`);
  console.log(`Dry run: ${result.dry_run}`);
  console.log(`Review rows: ${result.review_rows}`);
  console.log(`Queue rows: ${result.queue_rows}`);
  console.log(`Applied rows: ${result.applied_rows}`);
  console.log(`Skipped rows: ${result.skipped_rows}`);
  console.log(`Blocked rows: ${result.blocked_rows}`);
  if (result.output) console.log(`Output review CSV: ${result.output}`);

  if (result.blocked_apply) {
    console.log('Apply blocked: queue rows failed identity checks. Fix the queue file or pass --allow-partial for a controlled partial apply.');
    for (const row of result.blocked.slice(0, 10)) {
      console.log(`- queue line ${row.line}: ${row.reason} review_row=${row.review_row}`);
    }
    process.exitCode = 1;
  }

  return result;
}

export async function promoteCoverageReviewBatchCommand(reviewPath, batchPath, opts = {}) {
  const result = promoteCoverageReviewBatch(
    opts.registry || DEFAULT_REGISTRY_FILE,
    reviewPath,
    batchPath,
    {
      output: opts.output,
      dryRun: Boolean(opts.dryRun),
      allowPartial: Boolean(opts.allowPartial),
      source: opts.source || 'coverage-review',
      group: opts.group || 'coverage-review',
      lang: opts.lang,
      requireReviewer: opts.requireReviewer !== false,
      requireReviewNotes: opts.requireReviewNotes !== false,
    }
  );

  if (opts.report) {
    writeCoverageReviewPromotionReport(result, opts.report);
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  console.log(`Review: ${result.review}`);
  console.log(`Batch: ${result.batch}`);
  console.log(`Registry: ${result.registry}`);
  console.log(`Status: ${result.status}`);
  console.log(`OK: ${result.ok}`);
  console.log(`Dry run: ${result.dry_run}`);
  console.log(`Applied rows: ${result.apply.applied_rows}`);
  console.log(`Skipped rows: ${result.apply.skipped_rows}`);
  console.log(`Blocked rows: ${result.apply.blocked_rows}`);
  if (result.updated_review_validation) {
    console.log(`Updated review blockers: ${result.updated_review_validation.blockers_count}`);
    console.log(`Updated review warnings: ${result.updated_review_validation.warnings_count}`);
  }
  if (result.import_dry_run) {
    console.log(`Import dry-run approved rows: ${result.import_dry_run.approved_rows}`);
    console.log(`Import dry-run would import: ${result.import_dry_run.would_import}`);
    console.log(`Import dry-run blocked rows: ${result.import_dry_run.blocked}`);
  }
  if (result.output) console.log(`Output review CSV: ${result.output}`);
  console.log(`Wrote output: ${result.wrote_output}`);
  if (opts.report) console.log(`Promotion report: ${opts.report}`);

  if (!result.ok) {
    const findings = result.apply.blocked.length
      ? result.apply.blocked
      : result.updated_review_validation?.blockers || result.import_dry_run?.blocked_rows || [];
    for (const row of findings.slice(0, Number.parseInt(opts.limitFindings || 20, 10))) {
      console.log(`BLOCKER\tline:${row.line}\t${row.reason || row.code}\t${row.url || ''}`);
    }
    process.exitCode = 1;
  }

  return result;
}

export async function coverageReviewManualPackCommand(queuePath, opts = {}) {
  const pack = buildCoverageReviewManualPack(queuePath, {
    batchDir: opts.batchDir,
    nextLimit: opts.nextLimit,
    productContextPaths: opts.productContextPaths,
  });
  const written = writeCoverageReviewManualPack(pack, {
    outputDir: opts.outputDir,
  });

  const result = {
    ...pack.summary,
    output_dir: written.output_dir,
    files: written.files,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`Queue: ${pack.queue}`);
  console.log(`Batch dir: ${pack.batch_dir}`);
  console.log(`Output dir: ${written.output_dir}`);
  console.log(`Rows: ${pack.summary.queue_rows}`);
  console.log(`Priority counts: ${JSON.stringify(pack.summary.by_priority)}`);
  console.log(`Manual buckets: ${JSON.stringify(pack.summary.by_manual_bucket)}`);
  console.log(`Evidence rows: ${pack.summary.evidence_coverage.rows_with_evidence_or_suggestion}`);
  console.log(`Rows without evidence: ${pack.summary.evidence_coverage.rows_without_evidence_or_suggestion}`);
  console.log(`Safety-gate blocked rows: ${pack.summary.evidence_coverage.rows_with_safety_gate_block}`);
  console.log(`Possible approvals after manual confirmation: ${pack.summary.evidence_coverage.possible_approval_after_manual_confirmation}`);
  console.log(`Product context present: ${pack.summary.product_context_present}`);
  console.log(`Full manual review CSV: ${written.files.remaining_manual_review_csv}`);
  console.log(`P0 manual review CSV: ${written.files.p0_manual_review_csv}`);
  console.log(`Next manual review CSV: ${written.files.next_manual_review_csv}`);
  console.log(`Summary: ${written.files.summary_md}`);

  return result;
}
