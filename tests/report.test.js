import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildReport,
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
      assert.deepEqual(ids, [
        'verify_submitted_results',
        'execute_dry_run_ready_targets',
        'scout_unverified_targets',
        'review_unknown_pricing',
        'prepare_assisted_sessions',
      ]);
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
});
