import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scoutPlan } from '../src/scout/plan.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-scout-plan-'));
}

describe('scoutPlan', () => {
  it('scouts plan targets with a durable state and JSONL results', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'scout-state.json');
      const results = join(dir, 'scout-results.jsonl');
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        targets: [
          { id: 'a', submit_url: 'https://a.example/submit', mode: 'auto_candidate' },
          { id: 'b', submit_url: 'https://b.example/submit', mode: 'assisted' },
        ],
      }));

      const summary = await scoutPlan(plan, {
        state,
        results,
        delay: '0ms',
        configObject: { browser: { engine: 'playwright' } },
        scoutFn: async (url, opts) => ({
          target_id: opts.targetId,
          submit_url: url,
          classification: {
            mode: opts.targetId === 'a' ? 'auto_safe' : 'assisted',
            status: opts.targetId === 'a' ? 'mapped' : 'auth_required',
            reasons: ['test'],
          },
        }),
      });

      const parsedState = JSON.parse(readFileSync(state, 'utf-8'));
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.processed, 2);
      assert.deepEqual(summary.by_mode, { auto_safe: 1, assisted: 1 });
      assert.equal(parsedState.items.find(item => item.id === 'a').status, 'scouted');
      assert.equal(parsedState.items.find(item => item.id === 'a').classification_mode, 'auto_safe');
      assert.equal(lines.length, 2);
      assert.equal(lines[0].classification.mode, 'auto_safe');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters by plan mode and records scout failures', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'scout-state.json');
      const results = join(dir, 'scout-results.jsonl');
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        targets: [
          { id: 'a', submit_url: 'https://a.example/submit', mode: 'auto_candidate' },
          { id: 'b', submit_url: 'https://b.example/submit', mode: 'assisted' },
        ],
      }));

      const summary = await scoutPlan(plan, {
        state,
        results,
        mode: 'auto_candidate',
        delay: '0ms',
        configObject: { browser: { engine: 'playwright' } },
        scoutFn: async () => {
          throw new Error('browser unavailable');
        },
      });

      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);
      assert.equal(summary.processed, 0);
      assert.equal(summary.failed, 1);
      assert.equal(lines.length, 1);
      assert.equal(lines[0].target_id, 'a');
      assert.equal(lines[0].status, 'scout_failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('times out a stuck target and continues with the next target', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'scout-state.json');
      const results = join(dir, 'scout-results.jsonl');
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        targets: [
          { id: 'stuck', submit_url: 'https://stuck.example/submit', mode: 'auto_candidate' },
          { id: 'next', submit_url: 'https://next.example/submit', mode: 'auto_candidate' },
        ],
      }));

      const summary = await scoutPlan(plan, {
        state,
        results,
        delay: '0ms',
        targetTimeout: '10ms',
        configObject: { browser: { engine: 'playwright' } },
        scoutFn: async (url, opts) => {
          if (opts.targetId === 'stuck') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return {
            target_id: opts.targetId,
            submit_url: url,
            classification: { mode: 'needs_review', status: 'no_form_detected', reasons: ['test'] },
          };
        },
      });

      const parsedState = JSON.parse(readFileSync(state, 'utf-8'));
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.failed, 1);
      assert.equal(summary.processed, 1);
      assert.equal(parsedState.items.find(item => item.id === 'stuck').status, 'scout_failed');
      assert.equal(parsedState.items.find(item => item.id === 'next').status, 'scouted');
      assert.match(lines[0].error, /scout target timed out/);
      assert.equal(lines[1].target_id, 'next');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes target-level scout failures back to the registry when requested', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'scout-state.json');
      const results = join(dir, 'scout-results.jsonl');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        targets: [
          { id: 'dead', submit_url: 'https://dead.example/submit', mode: 'auto_candidate' },
        ],
      }));
      writeFileSync(registry, `
version: 1
targets:
  - id: dead
    submit_url: https://dead.example/submit
    technical:
      auth: unknown
      captcha: unknown
      reachable: unknown
    submission:
      mode: auto_candidate
      status: new
`);

      const summary = await scoutPlan(plan, {
        state,
        results,
        registry,
        updateRegistry: true,
        delay: '0ms',
        configObject: { browser: { engine: 'playwright' } },
        scoutFn: async () => {
          throw new Error('page.goto: net::ERR_NAME_NOT_RESOLVED at https://dead.example/submit');
        },
      });

      const parsedRegistry = readFileSync(registry, 'utf-8');
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.failed, 1);
      assert.match(parsedRegistry, /mode: skip/);
      assert.match(parsedRegistry, /status: dead/);
      assert.equal(lines[0].registry_updated, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses target-level auth profiles from an authenticated rescout plan', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'auth-rescout-plan.json');
      const state = join(dir, 'scout-state.json');
      const results = join(dir, 'scout-results.jsonl');
      const authDir = join(dir, 'auth');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'a.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(join(authDir, 'b.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-auth',
        constraints: { purpose: 'auth_rescout_after_saved_login_profile' },
        targets: [
          { id: 'a', submit_url: 'https://a.example/submit', mode: 'assisted', auth_profile: 'a' },
          { id: 'b', submit_url: 'https://b.example/submit', mode: 'assisted', auth_profile: 'b' },
        ],
      }));

      const seen = [];
      const summary = await scoutPlan(plan, {
        state,
        results,
        authDir,
        delay: '0ms',
        configObject: { browser: { engine: 'playwright' } },
        scoutFn: async (url, opts) => {
          seen.push({
            targetId: opts.targetId,
            authProfile: opts.authProfile,
            authStatePath: opts.config._authStatePath,
            engine: opts.config.browser.engine,
          });
          return {
            target_id: opts.targetId,
            submit_url: url,
            classification: { mode: 'assisted', status: 'auth_required', reasons: ['test'] },
          };
        },
      });

      assert.equal(summary.processed, 2);
      assert.deepEqual(seen.map(item => item.authProfile), ['a', 'b']);
      assert.match(seen[0].authStatePath, /a\.storage-state\.json$/);
      assert.match(seen[1].authStatePath, /b\.storage-state\.json$/);
      assert.equal(seen[0].engine, 'playwright');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
