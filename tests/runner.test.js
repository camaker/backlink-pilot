import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runPlan } from '../src/runner/run.js';
import { CONTROLLED_TEST_CONFIRMATION } from '../src/runner/run.js';
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
      forms: target.forms || [],
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
    assert.equal(isTerminalStatus('submitted_unverified'), true);
    assert.equal(isTerminalStatus('scouted'), true);
    assert.equal(isTerminalStatus('scout_failed'), true);
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
        skipTargetAudit: true,
        confirmControlledTest: CONTROLLED_TEST_CONFIRMATION,
        submitFn: async (site, opts) => {
          calls.push({ site, opts });
          return { status: 'pending_review', url: 'https://safe.example/listing/demo' };
        },
      });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.submitted, 1);
      assert.equal(summary.target_audit.skipped, true);
      assert.equal(calls[0].site, 'https://safe.example/submit');
      assert.equal(calls[0].opts.registryTarget.id, 'safe');
      assert.match(calls[0].opts.artifactDir, /001-safe$/);
      assert.ok(existsSync(lines[0].artifact_dir));
      assert.ok(existsSync(join(lines[0].artifact_dir, 'submission-result.json')));
      assert.equal(lines[0].final_url, 'https://safe.example/listing/demo');
      assert.equal(lines[0].listing_url, 'https://safe.example/listing/demo');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('extracts high-confidence listing URLs from submission evidence', async () => {
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
          { order: 1, id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      await runPlan(plan, {
        execute: true,
        delay: '0ms',
        results,
        configObject: readyConfig(),
        skipTargetAudit: true,
        confirmControlledTest: CONTROLLED_TEST_CONFIRMATION,
        submitFn: async () => ({
          status: 'pending_review',
          url: 'https://safe.example/thank-you',
          raw: {
            url: 'https://safe.example/thank-you',
            html: '<a href="/tools/demo-app">View listing</a>',
          },
        }),
      });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(lines[0].final_url, 'https://safe.example/thank-you');
      assert.equal(lines[0].listing_url, 'https://safe.example/tools/demo-app');
      assert.equal(lines[0].listing_url_source, 'page_link');
      assert.ok(lines[0].listing_url_confidence >= 0.75);
      assert.ok(lines[0].listing_url_candidates.length >= 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires a saved auth profile for assisted execution', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
        ],
      }, null, 2));

      const summary = await runPlan(plan, {
        assisted: true,
        authDir: join(dir, 'auth'),
        delay: '0ms',
        results,
      });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.skipped, 1);
      assert.match(lines[0].reason, /^assisted_auth_profile_missing:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('injects storage state when assisted execution has a saved auth profile', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      const authDir = join(dir, 'auth');
      const authState = join(authDir, 'needs-login.storage-state.json');
      writeRegistry(registry, [
        { id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { order: 1, id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
        ],
      }, null, 2));
      mkdirSync(authDir, { recursive: true });
      writeFileSync(authState, JSON.stringify({ cookies: [], origins: [] }));

      const calls = [];
      const summary = await runPlan(plan, {
        assisted: true,
        execute: true,
        skipReadinessCheck: true,
        skipTargetAudit: true,
        confirmControlledTest: CONTROLLED_TEST_CONFIRMATION,
        authDir,
        delay: '0ms',
        results,
        configObject: readyConfig(),
        submitFn: async (site, opts) => {
          calls.push({ site, opts });
          return { status: 'pending_review', url: 'https://login.example/listing/demo' };
        },
      });

      assert.equal(summary.submitted, 1);
      assert.equal(calls[0].opts.config._engine, 'playwright');
      assert.equal(calls[0].opts.config.browser.engine, 'playwright');
      assert.equal(calls[0].opts.config._authProfile, 'needs-login');
      assert.equal(calls[0].opts.config._authStatePath, authState);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects assisted auth execution with non-Playwright engines', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      const authDir = join(dir, 'auth');
      const authState = join(authDir, 'needs-login.storage-state.json');
      writeRegistry(registry, [
        { id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'needs-login', submit_url: 'https://login.example/submit', mode: 'assisted' },
        ],
      }, null, 2));
      mkdirSync(authDir, { recursive: true });
      writeFileSync(authState, JSON.stringify({ cookies: [], origins: [] }));

      const summary = await runPlan(plan, {
        assisted: true,
        authDir,
        engine: 'bb',
        delay: '0ms',
        results,
      });
      const lines = readFileSync(results, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.equal(summary.skipped, 1);
      assert.equal(lines[0].reason, 'assisted_auth_requires_playwright:bb');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates state and results files even when a terminal state skips all targets', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const state = join(dir, 'state.json');
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe', status: 'skipped' },
        ],
      }, null, 2));
      writeFileSync(state, JSON.stringify({
        version: 1,
        items: [
          { id: 'safe', status: 'skipped', attempts: 0, last_error: 'previously_skipped' },
        ],
      }));

      const summary = await runPlan(plan, { state, results, delay: '0ms' });

      assert.equal(summary.skipped, 1);
      assert.equal(existsSync(state), true);
      assert.equal(existsSync(results), true);
      assert.equal(readFileSync(results, 'utf-8'), '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks real execution when target audit finds unsafe auto_safe evidence', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'unsafe', submit_url: 'https://unsafe.example/submit', mode: 'auto_safe' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { id: 'unsafe', submit_url: 'https://unsafe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      await assert.rejects(
        () => runPlan(plan, {
          execute: true,
          delay: '0ms',
          configObject: readyConfig(),
        }),
        /Target audit failed/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes target audit for evidenced auto_safe targets and writes the audit artifact', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const artifacts = join(dir, 'artifacts');
      const registry = join(dir, 'registry.json');
      writeFileSync(registry, JSON.stringify({
        version: 1,
        targets: [
          {
            id: 'safe',
            submit_url: 'https://safe.example/submit',
            pricing: 'free',
            quality: { risk: 'low' },
            technical: {
              last_scouted_at: '2026-05-22T00:00:00.000Z',
              auth: 'none',
              captcha: 'none',
              reachable: 'yes',
            },
            forms: [
              {
                fields: [
                  { mapped_to: 'product.name', selector: 'input[name="name"]', required: true },
                  { mapped_to: 'product.url', selector: 'input[name="url"]', required: true },
                  { mapped_to: 'product.description', selector: 'textarea[name="description"]', required: true },
                ],
                submit_buttons: [{ selector: 'button[type="submit"]' }],
              },
            ],
            submission: { mode: 'auto_safe', status: 'mapped' },
          },
        ],
      }, null, 2));
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { order: 1, id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      const summary = await runPlan(plan, {
        execute: true,
        delay: '0ms',
        artifacts,
        configObject: readyConfig(),
        submitFn: async () => ({ status: 'pending_review', url: 'https://safe.example/tools/demo' }),
      });
      const auditArtifact = JSON.parse(readFileSync(join(artifacts, 'run-target-audit.json'), 'utf-8'));

      assert.equal(summary.submitted, 1);
      assert.equal(summary.target_audit.ok, true);
      assert.equal(summary.target_audit.skipped, false);
      assert.equal(auditArtifact.report.ok, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes successful submission attempts back to the registry without changing mapping status', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const registry = join(dir, 'registry.yaml');
      const results = join(dir, 'results.jsonl');
      writeFileSync(registry, `
version: 1
targets:
  - id: safe
    submit_url: https://safe.example/submit
    pricing: free
    quality:
      risk: low
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
            selector: input[name="name"]
            required: true
          - mapped_to: product.url
            selector: input[name="url"]
            required: true
          - mapped_to: product.description
            selector: textarea[name="description"]
            required: true
        submit_buttons:
          - selector: button[type="submit"]
    submission:
      mode: auto_safe
      status: mapped
      last_submitted_at: null
`);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { order: 1, id: 'safe', submit_url: 'https://safe.example/submit', mode: 'auto_safe' },
        ],
      }, null, 2));

      await runPlan(plan, {
        execute: true,
        delay: '0ms',
        results,
        configObject: readyConfig(),
        submitFn: async () => ({
          status: 'pending_review',
          url: 'https://safe.example/thanks',
          confirmation: 'Thank you',
        }),
      });

      const parsed = JSON.parse(JSON.stringify((await import('yaml')).parse(readFileSync(registry, 'utf-8'))));
      const target = parsed.targets[0];
      assert.equal(target.submission.status, 'mapped');
      assert.equal(target.submission.last_submission_status, 'pending_review');
      assert.equal(typeof target.submission.last_submitted_at, 'string');
      assert.equal(target.submission.last_submission_final_url, 'https://safe.example/thanks');
      assert.equal(target.submission.last_submission_confirmation, 'Thank you');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires a controlled-test confirmation for dangerous execution overrides', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
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
      }, null, 2));

      await assert.rejects(
        () => runPlan(plan, {
          execute: true,
          allowAutoCandidate: true,
          skipTargetAudit: true,
          delay: '0ms',
          configObject: readyConfig(),
        }),
        /Dangerous execution override\(s\) require --confirm-controlled-test CONTROLLED_TEST_ONLY/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records controlled-test override confirmations in run artifacts', async () => {
    const dir = tempDir();
    try {
      const plan = join(dir, 'plan.json');
      const artifacts = join(dir, 'artifacts');
      const registry = join(dir, 'registry.json');
      writeRegistry(registry, [
        { id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate' },
      ]);
      writeFileSync(plan, JSON.stringify({
        created_at: 'plan-1',
        registry,
        targets: [
          { order: 1, id: 'candidate', submit_url: 'https://candidate.example/submit', mode: 'auto_candidate' },
        ],
      }, null, 2));

      const summary = await runPlan(plan, {
        execute: true,
        allowAutoCandidate: true,
        skipTargetAudit: true,
        confirmControlledTest: CONTROLLED_TEST_CONFIRMATION,
        delay: '0ms',
        artifacts,
        configObject: readyConfig(),
        submitFn: async () => ({ status: 'pending_review', url: 'https://candidate.example/listing/demo' }),
      });
      const overrideArtifact = JSON.parse(readFileSync(join(artifacts, 'run-execution-overrides.json'), 'utf-8'));

      assert.equal(summary.submitted, 1);
      assert.deepEqual(summary.execution_overrides.codes.sort(), ['allow_auto_candidate', 'skip_target_audit']);
      assert.equal(summary.execution_overrides.confirmed, true);
      assert.equal(overrideArtifact.controlled_test.confirmed, true);
      assert.deepEqual(overrideArtifact.overrides.map(item => item.code).sort(), [
        'allow_auto_candidate',
        'skip_target_audit',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
