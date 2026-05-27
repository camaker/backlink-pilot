import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildOpsStatus,
  buildReport,
  formatOpsStatus,
  formatReport,
  latestByTarget,
  summarizeRunRows,
  summarizeVerificationRows,
} from '../src/report/summary.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-report-'));
}

describe('report summaries', () => {
  it('keeps only the latest row per target in run summaries', () => {
    const summary = summarizeRunRows([
      { target_id: 'a', status: 'failed' },
      { target_id: 'a', status: 'pending_review' },
      { target_id: 'b', status: 'skipped' },
    ]);

    assert.equal(summary.events, 3);
    assert.equal(summary.targets, 2);
    assert.equal(summary.submitted_or_pending, 1);
    assert.equal(summary.by_status.pending_review, 1);
    assert.equal(summary.by_status.failed, undefined);
    assert.equal(summary.skipped, 1);
  });

  it('summarizes backlink verification status and link types', () => {
    const summary = summarizeVerificationRows([
      {
        target_id: 'a',
        status: 'backlink_verified',
        backlink: { link_type: 'ugc' },
      },
      {
        target_id: 'b',
        status: 'backlink_not_found',
      },
      {
        target_id: 'c',
        status: 'fetch_failed',
      },
      {
        target_id: 'd',
        status: 'skipped',
      },
    ]);

    assert.equal(summary.verified, 1);
    assert.equal(summary.not_found, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.by_link_type.ugc, 1);
  });

  it('builds a full report from result, verification, and registry files', () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      const verification = join(dir, 'verification.jsonl');
      const registry = join(dir, 'registry.yaml');

      writeFileSync(results, [
        JSON.stringify({ target_id: 'a', status: 'pending_review' }),
        JSON.stringify({ target_id: 'b', status: 'dry_run_ready' }),
        '',
      ].join('\n'));
      writeFileSync(verification, [
        JSON.stringify({
          target_id: 'a',
          status: 'backlink_verified',
          backlink: { link_type: 'dofollow_candidate' },
        }),
        '',
      ].join('\n'));
      writeFileSync(registry, `
version: 1
targets:
  - id: a
    submit_url: https://dir.example/submit
    pricing: free
    submission:
      mode: auto_safe
      backlink_status: verified
      backlink_type: dofollow_candidate
      live_listing_url: https://dir.example/tools/demo
    quality:
      risk: low
  - id: b
    submit_url: https://other.example/submit
    pricing: unknown
    submission:
      mode: needs_scout
    quality:
      risk: unknown
`);

      const report = buildReport({ results, verification, registry });
      const formatted = formatReport(report);

      assert.equal(report.run.submitted_or_pending, 1);
      assert.equal(report.verification.verified, 1);
      assert.equal(report.registry.by_backlink_status.verified, 1);
      assert.equal(report.registry.by_backlink_status.unverified, 1);
      assert.equal(report.registry.live_listing_count, 1);
      assert.equal(report.pipeline.submitted_without_verification, 0);
      assert.equal(report.next_actions[0].id, 'execute_dry_run_ready_targets');
      assert.ok(report.next_actions.some(action => action.id === 'scout_unverified_targets'));
      assert.match(formatted, /Backlink Pilot Report/);
      assert.match(formatted, /Submitted or pending: 1/);
      assert.match(formatted, /Automation readiness/);
      assert.match(formatted, /Next actions/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recommends verification, execution, scout, pricing review, and assisted preparation', () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      const registry = join(dir, 'registry.yaml');

      writeFileSync(results, [
        JSON.stringify({ target_id: 'submitted', status: 'pending_review' }),
        JSON.stringify({ target_id: 'ready', status: 'dry_run_ready' }),
        '',
      ].join('\n'));
      writeFileSync(registry, `
version: 1
targets:
  - id: ready
    name: Ready Free
    domain: ready.example
    submit_url: https://ready.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
    quality:
      risk: low
  - id: pricing-review
    name: Pricing Review
    domain: pricing.example
    submit_url: https://pricing.example/submit
    pricing: unknown
    submission:
      mode: auto_safe
      status: mapped
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
    quality:
      risk: low
  - id: scout-me
    name: Scout Me
    domain: scout.example
    submit_url: https://scout.example/submit
    pricing: unknown
    submission:
      mode: auto_candidate
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
  - id: assisted
    name: Assisted
    domain: assisted.example
    submit_url: https://assisted.example/submit
    pricing: free
    submission:
      mode: assisted
    quality:
      risk: medium
`);

      const report = buildReport({ results, registry });
      const ids = report.next_actions.map(action => action.id);

      assert.equal(report.registry.automation.execute_ready_auto_safe_free, 1);
      assert.equal(report.registry.automation.auto_safe_pricing_review, 1);
      assert.equal(report.registry.automation.scout_queue_free_or_unknown, 1);
      assert.equal(report.registry.automation.assisted_targets, 1);
      assert.deepEqual(ids.slice(0, 5), [
        'verify_submitted_results',
        'execute_dry_run_ready_targets',
        'scout_unverified_targets',
        'review_unknown_pricing',
        'prepare_assisted_sessions',
      ]);
      assert.ok(ids.includes('work_auth_manual_login_backlog'));
      assert.ok(ids.includes('work_auth_needs_scout_backlog'));
      assert.ok(ids.includes('work_auth_manual_review_backlog'));
      assert.ok(ids.includes('work_directory_coverage_backlog'));
      assert.match(report.next_actions[0].command, /verify-results/);
      assert.match(report.next_actions[1].command, /--execute/);
      assert.match(report.next_actions[2].command, /--scout-queue --update-registry/);
      assert.match(report.next_actions[3].command, /pricing-review-queue/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recommends dry-run when registry has executable auto_safe targets but no run rows', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: ready
    name: Ready Free
    domain: ready.example
    submit_url: https://ready.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
    quality:
      risk: low
`);

      const report = buildReport({ registry });

      assert.equal(report.next_actions[0].id, 'dry_run_auto_safe_targets');
      assert.match(report.next_actions[0].command, /--mode auto_safe/);
      assert.doesNotMatch(report.next_actions[0].command, /--execute/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surfaces backlog lanes and manual workflow actions in the report', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const backlog = join(dir, 'backlog-lanes.json');
      writeFileSync(registry, `
version: 1
targets:
  - id: assisted
    name: Assisted
    domain: assisted.example
    submit_url: https://assisted.example/submit
    pricing: free
    submission:
      mode: assisted
    quality:
      risk: medium
`);
      writeFileSync(backlog, JSON.stringify({
        generated_at: '2026-05-27T13:56:14.161Z',
        workflow_backlog: {
          pricing_manual_rows: 3,
          auth_manual_login_rows: 20,
          auth_resolved_needs_scout_rows: 1,
          auth_resolved_manual_review_rows: 2,
          coverage_manual_review_rows: 132,
          total_workflow_rows: 158,
        },
        lanes_summary: {
          lane_count: 11,
          by_type: {
            auth_manual_login: 2,
            auth_resolved_needs_scout: 1,
            auth_manual_review_fail_closed: 1,
            auth_manual_review_classification: 1,
            coverage_manual_review_p0: 1,
            coverage_manual_review_p2: 5,
            pricing_review_manual: 1,
          },
        },
        lane_policy: {
          workers_requested: 4,
        },
        source_files: {
          auth_summary: 'backlink-url/assisted-submission-pack/resolved-direct-login/auth-workflow-refresh-resolved-summary.json',
        },
        workers: [
          {
            worker_id: 'worker-02',
            lane_count: 1,
            row_count: 20,
            estimated_total_minutes: 120,
            lanes: [
              {
                lane_id: 'auth-login-001',
                lane_type: 'auth_manual_login',
                priority: 'P0',
                row_count: 10,
                estimated_total_minutes: 60,
              },
            ],
          },
        ],
        lanes: [
          {
            lane_id: 'auth-login-001',
            lane_type: 'auth_manual_login',
            row_count: 10,
            priority: 'P0',
            validate_command: '',
            merge_command: '',
            refresh_command: 'node src/cli.js targets auth-workflow-refresh demo',
            rows: [
              {
                auth_login_command: 'node src/cli.js auth login --profile "demo" --url "https://example.com/login"',
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/auth-login-001.csv',
              },
            ],
          },
          {
            lane_id: 'auth-needs-scout-001',
            lane_type: 'auth_resolved_needs_scout',
            row_count: 1,
            priority: 'P1',
            rows: [
              {
                auth_scout_command: 'node src/cli.js scout "https://example.com/submit" --target-id "mergeek"',
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/auth-needs-scout-001.csv',
              },
            ],
          },
          {
            lane_id: 'auth-manual-review-fail-closed-001',
            lane_type: 'auth_manual_review_fail_closed',
            row_count: 2,
            priority: 'P0',
            rows: [
              {
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/auth-manual-review-fail-closed-001.csv',
              },
            ],
          },
          {
            lane_id: 'coverage-review-p0-001',
            lane_type: 'coverage_manual_review_p0',
            row_count: 25,
            priority: 'P0',
            validate_command: 'node src/cli.js targets validate-coverage-review-batch "backlink-url/backlog-lanes/lanes/coverage-review-p0-001.csv" --fail-on-blockers',
            rows: [
              {
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/coverage-review-p0-001.csv',
              },
            ],
          },
          {
            lane_id: 'pricing-review-001',
            lane_type: 'pricing_review_manual',
            row_count: 3,
            priority: 'P0',
            validate_command: 'node src/cli.js targets validate-pricing-review-decisions "backlink-url/backlog-lanes/lanes/pricing-review-001.csv" --fail-on-blockers',
            rows: [
              {
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/pricing-review-001.csv',
              },
            ],
          },
        ],
        files: {
          summary_json: backlog,
          workers: [
            {
              worker_id: 'worker-02',
              markdown: 'backlink-url/backlog-lanes/workers/worker-02.md',
              json: 'backlink-url/backlog-lanes/workers/worker-02.json',
            },
          ],
          lanes: [
            {
              lane_id: 'auth-login-001',
              csv: 'backlink-url/backlog-lanes/lanes/auth-login-001.csv',
              json: 'backlink-url/backlog-lanes/lanes/auth-login-001.json',
            },
          ],
        },
      }, null, 2));

      const report = buildReport({ registry, backlog });
      const formatted = formatReport(report);
      const ids = report.next_actions.map(action => action.id);

      assert.equal(report.backlog.workflow_backlog.total_workflow_rows, 158);
      assert.equal(report.backlog.lanes_summary.by_type.auth_manual_login, 2);
      assert.ok(ids.includes('work_auth_manual_login_backlog'));
      assert.ok(ids.includes('work_auth_needs_scout_backlog'));
      assert.ok(ids.includes('work_auth_manual_review_backlog'));
      assert.ok(ids.includes('work_directory_coverage_backlog'));
      assert.ok(ids.includes('work_pricing_review_backlog'));
      assert.match(report.next_actions.find(action => action.id === 'work_auth_manual_login_backlog').command, /targets backlog-worker "worker-02"/);
      assert.match(report.next_actions.find(action => action.id === 'work_auth_needs_scout_backlog').command, /scout|targets backlog-worker|targets backlog-lane/);
      assert.match(report.next_actions.find(action => action.id === 'work_directory_coverage_backlog').command, /validate-coverage-review-batch|targets backlog-worker-exec|targets backlog-lane/);
      assert.equal(report.backlog_freshness.is_stale, false);
      assert.match(formatted, /Manual backlog/);
      assert.match(formatted, /Auth manual login: 20/);
      assert.match(formatted, /Lane count: 11/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not count previously submitted auto_safe free targets as execute-ready', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: submitted
    name: Submitted Free
    domain: submitted.example
    submit_url: https://submitted.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
      last_submitted_at: 2026-05-22T00:00:00.000Z
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
    quality:
      risk: low
`);

      const report = buildReport({ registry });

      assert.equal(report.registry.automation.execute_ready_auto_safe_free, 0);
      assert.ok(!report.next_actions.some(action => action.id === 'dry_run_auto_safe_targets'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses stable fallback target keys for rows without target IDs', () => {
    const latest = latestByTarget([
      { submit_url: 'https://dir.example/submit', status: 'failed' },
      { submit_url: 'https://dir.example/submit', status: 'pending_review' },
      { listing_url: 'https://dir.example/tools/demo', status: 'backlink_verified' },
    ]);

    assert.equal(latest.length, 2);
    assert.equal(latest[0].status, 'pending_review');
    assert.equal(latest[1].target_key, 'https://dir.example/tools/demo');
  });

  it('builds ops status with blocker summary, worker leads, and formatted output', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const backlog = join(dir, 'backlog-lanes.json');
      writeFileSync(registry, `
version: 1
targets:
  - id: ready
    name: Ready Free
    domain: ready.example
    submit_url: https://ready.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
    quality:
      risk: low
  - id: blocked
    name: Blocked Unknown Pricing
    domain: blocked.example
    submit_url: https://blocked.example/submit
    pricing: unknown
    submission:
      mode: auto_safe
      status: new
    technical:
      last_scouted_at: null
      auth: unknown
      captcha: unknown
      reachable: unknown
    forms: []
    quality:
      risk: low
`);
      writeFileSync(backlog, JSON.stringify({
        generated_at: new Date().toISOString(),
        workflow_backlog: {
          auth_manual_login_rows: 2,
          total_workflow_rows: 2,
        },
        lanes_summary: {
          lane_count: 1,
          by_type: {
            auth_manual_login: 1,
          },
        },
        workers: [
          {
            worker_id: 'worker-01',
            lane_count: 1,
            row_count: 2,
            estimated_total_minutes: 12,
            lanes: [
              {
                lane_id: 'auth-login-001',
                lane_type: 'auth_manual_login',
                priority: 'P0',
                row_count: 2,
                estimated_total_minutes: 12,
              },
            ],
          },
        ],
        lanes: [
          {
            lane_id: 'auth-login-001',
            lane_type: 'auth_manual_login',
            row_count: 2,
            priority: 'P0',
            rows: [
              {
                auth_login_command: 'node src/cli.js auth login --profile "ready" --url "https://ready.example/login"',
                lane_csv_path: 'backlink-url/backlog-lanes/lanes/auth-login-001.csv',
              },
            ],
          },
        ],
        files: {
          summary_json: backlog,
          workers: [
            {
              worker_id: 'worker-01',
              markdown: 'backlink-url/backlog-lanes/workers/worker-01.md',
            },
          ],
        },
      }, null, 2));

      const status = buildOpsStatus({ registry, backlog });
      const formatted = formatOpsStatus(status);

      assert.equal(status.headline.registry_targets, 2);
      assert.equal(status.headline.backlog_rows, 2);
      assert.equal(status.readiness.automation_ready, false);
      assert.ok(status.readiness.top.blocker_codes.length > 0);
      assert.equal(status.backlog.worker_leads[0].worker_id, 'worker-01');
      assert.match(formatted, /Backlink Pilot Ops Status/);
      assert.match(formatted, /Automation ready: no/);
      assert.match(formatted, /worker-01/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
