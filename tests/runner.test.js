import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runPlan } from '../src/runner/run.js';
import {
  defaultStateForPlan,
  getItemState,
  isTerminalStatus,
  markItem,
} from '../src/runner/queue.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-runner-'));
}

function writeRegistry(path, targets) {
  writeFileSync(path, JSON.stringify({
    version: 1,
    targets: targets.map(target => ({
      id: target.id,
      submit_url: target.submit_url,
      submission: { mode: target.mode },
    })),
  }, null, 2));
}

function readyConfig() {
  return {
    product: {
      name: 'Demo App',
      url: 'https://demoapp.io',
      description: 'A concise but useful description.',
      long_description: 'Demo App helps teams automate backlink submissions with safe, audited, recoverable workflows for directory marketing.',
      email: 'hello@demoapp.io',
      categories: ['developer-tools'],
      pricing: 'free',
      pricing_url: 'https://demoapp.io/pricing',
      privacy_url: 'https://demoapp.io/privacy',
      terms_url: 'https://demoapp.io/terms',
      logo_url: 'https://demoapp.io/logo.png',
    },
  };
}

describe('runner queue state', () => {
  it('creates default state and marks items', () => {
    const state = defaultStateForPlan({
      created_at: 'plan-1',
      targets: [{ id: 'a' }],
    });

    assert.equal(state.items.length, 1);
    assert.equal(getItemState(state, 'a').status, 'queued');
    markItem(state, 'a', { status: 'dry_run_ready' });
    assert.equal(getItemState(state, 'a').status, 'dry_run_ready');
    assert.equal(isTerminalStatus('submitted'), true);
    assert.equal(isTerminalStatus('dry_run_ready'), false);
  });
});

describe('plan runner dry-run safety', () => {
  it('dry-runs auto_safe targets and skips unsafe modes by default', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'state.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      const targets = [
        { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe', status: 'queued' },
        { id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate', status: 'queued' },
      ];
      writeRegistry(registry, targets);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets,
      }, null, 2));

      const summary = await runPlan(plan, { state, results, delay: '0ms' });
      const parsedState = JSON.parse(readFileSync(state, 'utf-8'));
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.processed, 1);
      assert.equal(summary.skipped, 1);
      assert.equal(parsedState.items.find(item => item.id === 'safe').status, 'dry_run_ready');
      assert.equal(parsedState.items.find(item => item.id === 'candidate').status, 'skipped');
      assert.equal(lines[0].status, 'dry_run_ready');
      assert.equal(lines[1].status, 'skipped');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires explicit allow flag for auto_candidate even in dry-run', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'state.json');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate' },
        ],
      }));

      const summary = await runPlan(plan, {
        state,
        results: join(dir, 'results.jsonl'),
        allowAutoCandidate: true,
        delay: '0ms',
      });
      const parsedState = JSON.parse(readFileSync(state, 'utf-8'));

      assert.equal(summary.processed, 1);
      assert.equal(parsedState.items[0].status, 'dry_run_ready');
      assert.equal(existsSync(state), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips stale plan targets whose registry mode changed', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'state.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'assisted' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      const summary = await runPlan(plan, { state, results, delay: '0ms' });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.processed, 0);
      assert.equal(summary.skipped, 1);
      assert.equal(lines[0].status, 'skipped');
      assert.equal(lines[0].reason, 'target_mode_changed_in_registry:auto_safe->assisted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires product readiness before executing a plan', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      await assert.rejects(
        () => runPlan(plan, {
          execute: true,
          delay: '0ms',
          configObject: { product: { name: 'Incomplete' } },
        }),
        /Product readiness check failed/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes artifact directory into submit during controlled execution', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { order: 1, id: 'safe', name: 'Safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      const calls = [];
      const summary = await runPlan(plan, {
        execute: true,
        delay: '0ms',
        results,
        configObject: readyConfig(),
        submitFn: async (site, opts) => {
          calls.push({ site, opts });
          return { status: 'pending_review', url: 'https://safe.example/listing/demo' };
        },
      });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.submitted, 1);
      assert.equal(calls[0].site, 'https://safe.example/submit');
      assert.match(calls[0].opts.artifactDir, /001-safe$/);
      assert.ok(existsSync(lines[0].artifact_dir));
      assert.ok(existsSync(join(lines[0].artifact_dir, 'submission-result.json')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
