import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_AUTH_DIR } from '../auth/session.js';
import {
  buildAuthLoginNext,
  writeAuthLoginNext,
} from './auth-login-status.js';
import {
  buildAuthLoginOperatorPack,
  writeAuthLoginOperatorPack,
} from './auth-login-operator-pack.js';
import {
  buildAuthLoginPlanBatches,
  writeAuthLoginPlanBatches,
} from './auth-login-plan.js';
import {
  buildAuthResidualResolve,
  writeAuthResidualResolve,
} from './auth-residual-resolve.js';
import {
  buildAuthWorkflowRefresh,
  writeAuthWorkflowRefresh,
} from './auth-workflow-refresh.js';
import { DEFAULT_REGISTRY_FILE } from './registry.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function commandQuote(value = '') {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function buildRefreshCommand(queuePath = '', batchPaths = [], opts = {}) {
  const registry = opts.registry || DEFAULT_REGISTRY_FILE;
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const outputDir = opts.rebuildOutputDir || 'backlink-url/assisted-submission-pack/resolved-direct-login';
  const nextName = opts.refreshNextName || 'auth-login-next-resolved-current';
  const summaryName = opts.refreshSummaryName || 'auth-workflow-refresh-resolved-summary';
  const nextLimit = String(opts.nextLimit ?? 10);
  const rescoutLimit = String(opts.rescoutLimit ?? 100);
  const args = [
    'node',
    'src/cli.js',
    'targets',
    'auth-workflow-refresh',
    queuePath,
    ...batchPaths,
    '--registry',
    registry,
    '--auth-dir',
    authDir,
    '--output-dir',
    outputDir,
    '--next-name',
    nextName,
    '--summary-name',
    summaryName,
    '--next-limit',
    nextLimit,
    '--rescout-limit',
    rescoutLimit,
  ];
  if (opts.productConfig) {
    args.push('--product-config', opts.productConfig);
  }
  return args.map(commandQuote).join(' ');
}

function rebuildMarkdown(report = {}, files = {}) {
  const lines = [
    '# Auth Residual Rebuild',
    '',
    `Generated: ${report.created_at || ''}`,
    `Source triage: ${report.source_triage || ''}`,
    `Source residual: ${report.source_residual || ''}`,
    '',
    'Policy: read-only workflow rebuild only. No login, no submission, no registry writes, no browser launch.',
    '',
    '## Summary',
    '',
    `- Resolved direct-login rows: ${report.summary?.resolved_direct_login_rows || 0}`,
    `- Needs-scout rows moved out of auth: ${report.summary?.resolved_needs_scout_rows || 0}`,
    `- Manual-review rows kept out of auth: ${report.summary?.resolved_manual_review_rows || 0}`,
    `- Dropped duplicate rows: ${report.summary?.resolved_dropped_rows || 0}`,
    `- Rebuilt direct-login pending rows: ${report.summary?.pending_login_rows || 0}`,
    `- Rebuilt batch count: ${report.summary?.batch_count || 0}`,
    `- Rebuilt next-login task rows: ${report.summary?.next_login_task_rows || 0}`,
    `- Rebuilt auth-rescout queued rows: ${report.summary?.auth_rescout_queued_rows || 0}`,
    '',
    '## Files',
    '',
    `- Resolve summary: ${files.resolve_summary_json || ''}`,
    `- Direct-login queue: ${files.resolved_direct_login_queue_csv || ''}`,
    `- Rebuilt batch summary: ${files.batch_summary_json || ''}`,
    `- Rebuilt next-login JSON: ${files.next_login_json || ''}`,
    `- Rebuilt operator pack JSON: ${files.operator_pack_json || ''}`,
    `- Rebuilt workflow refresh summary: ${files.workflow_refresh_summary_json || ''}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function runAuthResidualRebuild(triagePath, residualPath, opts = {}) {
  if (!triagePath) throw new Error('auth residual rebuild triage path is required');
  if (!residualPath) throw new Error('auth residual rebuild residual path is required');

  const registry = opts.registry || DEFAULT_REGISTRY_FILE;
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const resolveOutputDir = opts.resolveOutputDir || 'backlink-url/assisted-submission-pack/resolved-auth-login';
  const rebuildOutputDir = opts.rebuildOutputDir || 'backlink-url/assisted-submission-pack/resolved-direct-login';
  const resolveName = opts.resolveName || 'auth-residual-resolve';
  const batchNamePrefix = opts.batchNamePrefix || 'auth-login-plan-batch-resolved';
  const batchSummaryName = opts.batchSummaryName || 'auth-login-plan-batches-resolved-summary';
  const nextName = opts.nextName || 'auth-login-next-resolved';
  const operatorName = opts.operatorName || 'auth-login-operator-resolved';
  const refreshNextName = opts.refreshNextName || 'auth-login-next-resolved-current';
  const refreshSummaryName = opts.refreshSummaryName || 'auth-workflow-refresh-resolved-summary';
  const summaryName = opts.summaryName || 'auth-residual-rebuild-summary';

  const resolveReport = buildAuthResidualResolve(triagePath, residualPath);
  const resolveFiles = writeAuthResidualResolve(resolveReport, {
    outputDir: resolveOutputDir,
    name: resolveName,
  });

  const planBatchesReport = buildAuthLoginPlanBatches(resolveFiles.direct_login_queue_csv, {
    registry,
    registryFilter: true,
    productConfig: opts.productConfig,
    authDir,
    batchSize: opts.batchSize || opts.limit,
    maxBatches: opts.maxBatches,
  });
  const planBatchesFiles = writeAuthLoginPlanBatches(planBatchesReport, {
    outputDir: rebuildOutputDir,
    namePrefix: batchNamePrefix,
    summaryName: batchSummaryName,
  });
  const batchPaths = planBatchesFiles.batches.map(batch => batch.output);

  const nextReport = buildAuthLoginNext(batchPaths, {
    authDir,
    registry,
    registryFilter: true,
    offset: opts.nextOffset,
    limit: opts.nextLimit,
  });
  const nextFiles = writeAuthLoginNext(nextReport, {
    output: join(rebuildOutputDir, `${nextName}.json`),
    csvOutput: join(rebuildOutputDir, `${nextName}.csv`),
  });

  const refreshCommand = buildRefreshCommand(resolveFiles.direct_login_queue_csv, batchPaths, {
    ...opts,
    registry,
    authDir,
    rebuildOutputDir,
    refreshNextName,
    refreshSummaryName,
  });
  const operatorPack = buildAuthLoginOperatorPack(nextFiles.output, {
    refreshCommand,
  });
  const operatorFiles = writeAuthLoginOperatorPack(operatorPack, {
    outputDir: rebuildOutputDir,
    name: operatorName,
  });

  const refreshReport = buildAuthWorkflowRefresh(resolveFiles.direct_login_queue_csv, batchPaths, {
    registry,
    registryFilter: true,
    productConfig: opts.productConfig,
    authDir,
    nextOffset: opts.nextOffset,
    nextLimit: opts.nextLimit,
    rescoutLimit: opts.rescoutLimit,
  });
  const refreshFiles = writeAuthWorkflowRefresh(refreshReport, {
    outputDir: rebuildOutputDir,
    nextName: refreshNextName,
    summaryName: refreshSummaryName,
  });

  mkdirSync(rebuildOutputDir, { recursive: true });
  const summaryFiles = {
    output_dir: normalizePath(rebuildOutputDir),
    resolve_summary_json: resolveFiles.summary_json,
    resolved_direct_login_queue_csv: resolveFiles.direct_login_queue_csv,
    batch_summary_json: planBatchesFiles.summary,
    next_login_json: nextFiles.output,
    next_login_csv: nextFiles.csv_output,
    operator_pack_json: operatorFiles.summary,
    workflow_refresh_summary_json: refreshFiles.summary,
    summary_json: normalizePath(join(rebuildOutputDir, `${summaryName}.json`)),
    summary_md: normalizePath(join(rebuildOutputDir, `${summaryName}.md`)),
  };

  const report = {
    version: 1,
    created_at: nowIso(),
    source_triage: normalizePath(triagePath),
    source_residual: normalizePath(residualPath),
    constraints: {
      purpose: 'read_only_auth_residual_rebuild',
      registry: normalizePath(registry),
      auth_dir: normalizePath(authDir),
      no_real_submission: true,
      no_browser_launch: true,
      no_registry_write: true,
      no_command_execution: true,
    },
    files: {
      resolve: resolveFiles,
      plan_batches: planBatchesFiles,
      next_login: nextFiles,
      operator_pack: operatorFiles,
      workflow_refresh: refreshFiles,
      summary: summaryFiles.summary_json,
      summary_md: summaryFiles.summary_md,
    },
    reports: {
      resolve: {
        summary: resolveReport.summary,
      },
      plan_batches: {
        summary: planBatchesReport.summary,
      },
      next_login: {
        summary: nextReport.summary,
      },
      operator_pack: {
        summary: operatorPack.summary,
        refresh_command: refreshCommand,
      },
      workflow_refresh: {
        summary: refreshReport.summary,
      },
    },
    summary: {
      resolved_direct_login_rows: resolveReport.summary.resolved_direct_login_rows,
      resolved_needs_scout_rows: resolveReport.summary.resolved_needs_scout_rows,
      resolved_manual_review_rows: resolveReport.summary.resolved_manual_review_rows,
      resolved_dropped_rows: resolveReport.summary.resolved_dropped_rows,
      pending_login_rows: planBatchesReport.summary.pending_rows,
      batch_count: planBatchesReport.summary.batch_count,
      next_login_task_rows: nextReport.summary.task_rows,
      next_login_remaining_rows: nextReport.summary.remaining_after_batch,
      auth_rescout_queued_rows: refreshReport.summary.auth_rescout.queued_rows,
      auth_profiles_missing: refreshReport.summary.status.auth_profiles_missing,
    },
  };

  writeFileSync(summaryFiles.summary_json, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  writeFileSync(summaryFiles.summary_md, rebuildMarkdown(report, summaryFiles), 'utf-8');

  return report;
}
