import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runPipeline } from '../src/pipeline/run.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-pipeline-'));
}

function writeRegistry(path) {
  writeFileSync(path, `
version: 1
targets:
  - id: safe
    name: Safe Directory
    domain: safe.example
    submit_url: https://safe.example/submit
    pricing: free
    submission:
      mode: auto_safe
      reason: mapped_simple_form
    quality:
      risk: low
  - id: manual
    name: Product Hunt
    domain: producthunt.com
    submit_url: https://www.producthunt.com/posts/new
    pricing: free
    submission:
      mode: manual_strategic
      reason: strategic_manual_surface
    quality:
      risk: medium
`);
}

describe('pipeline runner', () => {
  it('defaults to a dry-run batch and writes plan, results, report, and manifest', async () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const runDir = join(dir, 'run');
      writeRegistry(registry);

      const summary = await runPipeline({
        runDir,
        registry,
        freeOnly: true,
        limit: 5,
      });
      const manifest = JSON.parse(readFileSync(join(runDir, 'pipeline-manifest.json'), 'utf-8'));

      assert.equal(summary.execute, false);
      assert.equal(summary.steps.plan.targets, 1);
      assert.equal(summary.steps.run.processed, 1);
      assert.equal(summary.steps.run.submitted, 0);
      assert.equal(existsSync(join(runDir, 'plan.json')), true);
      assert.equal(existsSync(join(runDir, 'results.jsonl')), true);
      assert.equal(existsSync(join(runDir, 'report.json')), true);
      assert.equal(manifest.steps.plan.targets, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires execute before verification', async () => {
    const dir = tempDir();
    try {
      await assert.rejects(
        () => runPipeline({
          runDir: join(dir, 'run'),
          verify: true,
          verifyResultsFn: async () => ({ verified: 0 }),
        }),
        /--verify requires --execute/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires registry updates for scout queue pipeline runs', async () => {
    const dir = tempDir();
    try {
      await assert.rejects(
        () => runPipeline({
          runDir: join(dir, 'run'),
          scoutQueue: true,
          scoutPlanFn: async () => ({ processed: 0, skipped: 0, failed: 0 }),
        }),
        /--scout-queue requires --update-registry/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runs execute, verification, and report through injected stage functions', async () => {
    const dir = tempDir();
    try {
      const runDir = join(dir, 'run');
      const calls = [];
      const summary = await runPipeline({
        runDir,
        execute: true,
        verify: true,
        updateRegistry: true,
        skipTargetAudit: true,
        productUrl: 'https://demoapp.io',
        buildPlanFn: () => ({
          version: 1,
          created_at: 'plan-1',
          registry: 'registry.yaml',
          product: {},
          targets: [{ id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' }],
          excluded: [],
        }),
        savePlanFn: (plan, path) => {
          calls.push(['savePlan', path]);
          writeFileSync(path, JSON.stringify(plan, null, 2));
        },
        runPlanFn: async (planPath, opts) => {
          calls.push(['runPlan', planPath, opts.execute]);
          writeFileSync(opts.results, [
            JSON.stringify({
              target_id: 'safe',
              status: 'pending_review',
              listing_url: 'https://safe.example/tools/demo',
            }),
            '',
          ].join('\n'));
          return { processed: 1, submitted: 1, skipped: 0, failed: 0 };
        },
        verifyResultsFn: async (resultsPath, opts) => {
          calls.push(['verifyResults', resultsPath, opts.productUrl, opts.updateRegistry]);
          writeFileSync(opts.output, [
            JSON.stringify({
              target_id: 'safe',
              status: 'backlink_verified',
              backlink: { link_type: 'dofollow_candidate' },
            }),
            '',
          ].join('\n'));
          return { checked: 1, verified: 1, not_found: 0, skipped: 0, failed: 0 };
        },
        buildReportFn: (opts) => {
          calls.push(['buildReport', opts.results, opts.verification]);
          return {
            pipeline: {
              submitted_or_pending_targets: 1,
              verified_targets: 1,
              registry_verified_targets: 0,
            },
          };
        },
      });

      assert.deepEqual(calls.map(call => call[0]), ['savePlan', 'runPlan', 'verifyResults', 'buildReport']);
      assert.equal(calls[1][2], true);
      assert.equal(calls[2][2], 'https://demoapp.io');
      assert.equal(calls[2][3], true);
      assert.equal(summary.steps.verify.verified, 1);
      assert.equal(summary.steps.report.verified, 1);
      assert.equal(existsSync(join(runDir, 'pipeline-manifest.json')), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes the run plan after scout updates the registry', async () => {
    const dir = tempDir();
    try {
      const runDir = join(dir, 'run');
      const plans = [
        {
          version: 1,
          targets: [{ id: 'candidate', submit_url: 'https://dir.example/submit', mode: 'auto_candidate' }],
          excluded: [],
        },
        {
          version: 1,
          targets: [{ id: 'safe', submit_url: 'https://dir.example/submit', mode: 'auto_safe' }],
          excluded: [],
        },
      ];
      const savedPlans = [];

      const summary = await runPipeline({
        runDir,
        scout: true,
        updateRegistry: true,
        buildPlanFn: () => plans.shift(),
        savePlanFn: (plan, path) => {
          savedPlans.push({ ids: plan.targets.map(target => target.id), path });
          writeFileSync(path, JSON.stringify(plan));
        },
        scoutPlanFn: async () => ({ processed: 1, skipped: 0, failed: 0, by_mode: { auto_safe: 1 } }),
        runPlanFn: async (planPath, opts) => {
          writeFileSync(opts.results, '');
          return { processed: 1, submitted: 0, skipped: 0, failed: 0, plan: planPath };
        },
        buildReportFn: () => ({
          pipeline: {
            submitted_or_pending_targets: 0,
            verified_targets: 0,
            registry_verified_targets: 0,
          },
        }),
      });

      assert.deepEqual(savedPlans.map(plan => plan.ids), [['candidate'], ['safe']]);
      assert.equal(summary.steps.scout_plan.phase, 'pre_scout');
      assert.equal(summary.steps.plan.phase, 'post_scout');
      assert.equal(summary.steps.plan.refreshed_after_scout, true);
      assert.match(summary.steps.run.plan, /plan\.json$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses a scout queue plan before refreshing the runnable plan', async () => {
    const dir = tempDir();
    try {
      const runDir = join(dir, 'run');
      const savedPlans = [];
      const calls = [];

      const summary = await runPipeline({
        runDir,
        scoutQueue: true,
        updateRegistry: true,
        freeOnly: true,
        allowUnknownPricing: true,
        scoutModes: 'needs_scout',
        includeScouted: true,
        limit: 3,
        buildScoutQueueFn: (opts) => {
          calls.push(['buildScoutQueue', opts.modes, opts.limit, opts.freeOnly, opts.allowUnknownPricing, opts.includeScouted]);
          return {
            version: 1,
            constraints: { purpose: 'scout_queue' },
            targets: [{ id: 'candidate', submit_url: 'https://dir.example/submit', mode: 'needs_scout' }],
            excluded: [],
          };
        },
        buildPlanFn: (opts) => {
          calls.push(['buildPlan', opts.mode, opts.limit]);
          return {
            version: 1,
            targets: [{ id: 'safe', submit_url: 'https://dir.example/submit', mode: 'auto_safe' }],
            excluded: [],
          };
        },
        savePlanFn: (plan, path) => {
          savedPlans.push({ ids: plan.targets.map(target => target.id), path });
          writeFileSync(path, JSON.stringify(plan));
        },
        scoutPlanFn: async (planPath, opts) => {
          calls.push(['scoutPlan', planPath, opts.updateRegistry, opts.limit, opts.mode]);
          return { processed: 1, skipped: 0, failed: 0, by_mode: { auto_safe: 1 } };
        },
        runPlanFn: async (planPath, opts) => {
          calls.push(['runPlan', planPath, opts.limit]);
          writeFileSync(opts.results, '');
          return { processed: 1, submitted: 0, skipped: 0, failed: 0, plan: planPath };
        },
        buildReportFn: () => ({
          pipeline: {
            submitted_or_pending_targets: 0,
            verified_targets: 0,
            registry_verified_targets: 0,
          },
        }),
      });

      assert.deepEqual(savedPlans.map(plan => plan.ids), [['candidate'], ['safe']]);
      assert.deepEqual(calls.map(call => call[0]), ['buildScoutQueue', 'scoutPlan', 'buildPlan', 'runPlan']);
      assert.deepEqual(calls[0], ['buildScoutQueue', 'needs_scout', 3, true, true, true]);
      assert.equal(calls[1][2], true);
      assert.equal(calls[1][4], undefined);
      assert.equal(summary.steps.scout_plan.source, 'scout_queue');
      assert.equal(summary.steps.plan.source, 'run_plan');
      assert.equal(summary.steps.plan.scout_queue, true);
      assert.equal(summary.steps.plan.refreshed_after_scout, true);
      assert.match(summary.steps.run.plan, /plan\.json$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
