import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildScoutQueuePlan, buildSubmissionPlan, saveSubmissionPlan } from '../planner/plan.js';
import { buildReport } from '../report/summary.js';
import { runPlan } from '../runner/run.js';
import { scoutPlan } from '../scout/plan.js';
import { DEFAULT_REGISTRY_FILE } from '../targets/registry.js';
import { verifyResults } from '../verification/results.js';

function nowIso() {
  return new Date().toISOString();
}

function safeTimestamp() {
  return nowIso().replace(/[:.]/g, '-');
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
  return path;
}

function defaultRunDir() {
  return join('runs', `batch-${safeTimestamp()}`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pipelinePaths(runDir) {
  return {
    run_dir: runDir,
    scout_plan: join(runDir, 'scout-plan.json'),
    plan: join(runDir, 'plan.json'),
    scout_state: join(runDir, 'scout-state.json'),
    scout_results: join(runDir, 'scout-results.jsonl'),
    state: join(runDir, 'state.json'),
    results: join(runDir, 'results.jsonl'),
    verification: join(runDir, 'verification-results.jsonl'),
    artifacts: join(runDir, 'artifacts'),
    report: join(runDir, 'report.json'),
    manifest: join(runDir, 'pipeline-manifest.json'),
  };
}

function resolveProductUrl(opts = {}, plan = {}) {
  return opts.productUrl || plan.product?.url || '';
}

function planOptions(opts, registry, productConfig, limit) {
  return {
    registry,
    productConfig,
    freeOnly: Boolean(opts.freeOnly),
    allowUnknownPricing: Boolean(opts.allowUnknownPricing),
    mode: opts.mode || 'runnable',
    lang: opts.lang,
    source: opts.source,
    limit,
    includeRisk: Boolean(opts.includeRisk),
    includeScouted: Boolean(opts.includeScouted),
  };
}

function scoutQueueOptions(opts, registry, productConfig, limit) {
  return {
    registry,
    productConfig,
    freeOnly: Boolean(opts.freeOnly),
    allowUnknownPricing: Boolean(opts.allowUnknownPricing),
    modes: opts.scoutModes,
    lang: opts.lang,
    source: opts.source,
    limit,
    includeRisk: Boolean(opts.includeRisk),
    includeScouted: Boolean(opts.includeScouted),
  };
}

function summarizePlanStep(plan, output, extra = {}) {
  return {
    targets: plan.targets?.length || 0,
    excluded: plan.excluded?.length || 0,
    output,
    ...extra,
  };
}

function ensureJsonlFile(path) {
  if (!existsSync(path)) writeFileSync(path, '', 'utf-8');
}

export async function runPipeline(opts = {}) {
  const execute = Boolean(opts.execute);
  const shouldScout = Boolean(opts.scout || opts.scoutQueue);
  if (opts.verify && !execute) {
    throw new Error('--verify requires --execute in pipeline because dry-run results do not contain listing URLs');
  }
  if (opts.scoutQueue && !opts.updateRegistry) {
    throw new Error('--scout-queue requires --update-registry so scout evidence can safely refresh the run plan');
  }

  const runDir = opts.runDir || defaultRunDir();
  const registry = opts.registry || DEFAULT_REGISTRY_FILE;
  const productConfig = opts.productConfig || opts.config;
  const limit = parsePositiveInt(opts.limit, 10);
  const paths = pipelinePaths(runDir);
  ensureDir(runDir);

  const buildPlanFn = opts.buildPlanFn || buildSubmissionPlan;
  const buildScoutQueueFn = opts.buildScoutQueueFn || buildScoutQueuePlan;
  const savePlanFn = opts.savePlanFn || saveSubmissionPlan;
  const scoutPlanFn = opts.scoutPlanFn || scoutPlan;
  const runPlanFn = opts.runPlanFn || runPlan;
  const verifyResultsFn = opts.verifyResultsFn || verifyResults;
  const buildReportFn = opts.buildReportFn || buildReport;

  let plan = shouldScout && opts.scoutQueue
    ? buildScoutQueueFn(scoutQueueOptions(opts, registry, productConfig, limit))
    : buildPlanFn(planOptions(opts, registry, productConfig, limit));
  const activePlanPath = shouldScout ? paths.scout_plan : paths.plan;
  savePlanFn(plan, activePlanPath);

  const summary = {
    run_dir: runDir,
    execute,
    registry,
    paths,
    steps: {
      plan: summarizePlanStep(plan, activePlanPath, {
        phase: shouldScout ? 'pre_scout' : 'run',
        source: shouldScout && opts.scoutQueue ? 'scout_queue' : 'run_plan',
      }),
    },
  };

  if (shouldScout) {
    const { mode: _planMode, ...scoutOpts } = opts;
    summary.steps.scout = await scoutPlanFn(paths.scout_plan, {
      ...scoutOpts,
      state: paths.scout_state,
      results: paths.scout_results,
      limit,
      delay: opts.scoutDelay || '10s',
      registry,
      productConfig,
      persist: opts.persist !== false,
      updateRegistry: Boolean(opts.updateRegistry),
    });

    if (opts.updateRegistry || opts.scoutQueue) {
      const refreshed = buildPlanFn(planOptions(opts, registry, productConfig, limit));
      savePlanFn(refreshed, paths.plan);
      summary.steps.scout_plan = summary.steps.plan;
      summary.steps.plan = summarizePlanStep(refreshed, paths.plan, {
        phase: 'post_scout',
        source: 'run_plan',
        refreshed_after_scout: Boolean(opts.updateRegistry),
        scout_queue: Boolean(opts.scoutQueue),
      });
      plan = refreshed;
    } else {
      savePlanFn(plan, paths.plan);
      summary.steps.plan = summarizePlanStep(plan, paths.plan, {
        phase: 'run',
        source: 'run_plan',
        refreshed_after_scout: false,
      });
    }
  }

  summary.steps.run = await runPlanFn(paths.plan, {
    ...opts,
    execute,
    registry,
    state: paths.state,
    results: paths.results,
    artifacts: paths.artifacts,
    limit,
    delay: opts.delay || (execute ? '90s' : '0ms'),
    productConfig,
  });
  ensureJsonlFile(paths.results);

  if (opts.verify) {
    const productUrl = resolveProductUrl(opts, plan);
    if (!productUrl) {
      throw new Error('--product-url is required for pipeline --verify when the plan has no product URL');
    }

    summary.steps.verify = await verifyResultsFn(paths.results, {
      ...opts,
      output: paths.verification,
      productUrl,
      registry,
      updateRegistry: Boolean(opts.updateRegistry),
      minListingConfidence: opts.minListingConfidence,
    });
    ensureJsonlFile(paths.verification);
  }

  const report = buildReportFn({
    results: paths.results,
    verification: opts.verify ? paths.verification : undefined,
    registry,
  });
  writeJson(paths.report, report);
  summary.steps.report = {
    output: paths.report,
    submitted_or_pending: report.pipeline?.submitted_or_pending_targets || 0,
    verified: report.pipeline?.verified_targets || 0,
    registry_verified: report.pipeline?.registry_verified_targets || 0,
  };

  writeJson(paths.manifest, summary);
  return summary;
}
