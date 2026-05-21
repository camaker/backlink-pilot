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
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        targets: [
          { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe', status: 'queued' },
          { id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate', status: 'queued' },
        ],
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
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
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
});
