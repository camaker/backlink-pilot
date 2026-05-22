import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import {
  applyVerificationResultToTarget,
  updateRegistryWithVerificationResults,
} from '../src/verification/registry.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-verification-registry-'));
}

describe('verification registry updates', () => {
  it('applies backlink verification evidence without changing execution mode', () => {
    const updated = applyVerificationResultToTarget({
      id: 'demo',
      submit_url: 'https://dir.example/submit',
      submission: {
        mode: 'auto_safe',
        status: 'mapped',
      },
    }, {
      target_id: 'demo',
      status: 'backlink_verified',
      listing_url: 'https://dir.example/tools/demo-app',
      product_url: 'https://demoapp.io',
      http_status: 200,
      checked_at: '2026-05-22T00:00:00.000Z',
      backlink_found: true,
      backlink: {
        href: 'https://demoapp.io',
        rel: ['nofollow'],
        link_type: 'nofollow',
        anchor_text: 'Demo App',
      },
      listing_url_source: 'page_link',
      listing_url_confidence: 0.92,
    });

    assert.equal(updated.submission.mode, 'auto_safe');
    assert.equal(updated.submission.status, 'mapped');
    assert.equal(updated.submission.backlink_status, 'verified');
    assert.equal(updated.submission.live_listing_url, 'https://dir.example/tools/demo-app');
    assert.equal(updated.submission.backlink_type, 'nofollow');
    assert.deepEqual(updated.submission.backlink_rel, ['nofollow']);
    assert.equal(updated.verification.listing_url_confidence, 0.92);
  });

  it('updates persisted registry targets by verification target_id', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: demo
    submit_url: https://dir.example/submit
    submission:
      mode: auto_safe
      status: mapped
  - id: missing
    submit_url: https://missing.example/submit
    submission:
      mode: auto_safe
      status: mapped
`);

      const summary = updateRegistryWithVerificationResults([
        {
          target_id: 'demo',
          status: 'backlink_verified',
          listing_url: 'https://dir.example/tools/demo-app',
          product_url: 'https://demoapp.io',
          checked_at: '2026-05-22T00:00:00.000Z',
          http_status: 200,
          backlink_found: true,
          backlink: {
            href: 'https://demoapp.io',
            rel: [],
            link_type: 'dofollow_candidate',
            anchor_text: 'Demo App',
          },
        },
        {
          target_id: 'unknown',
          status: 'backlink_not_found',
          listing_url: 'https://unknown.example/tools/demo',
          backlink_found: false,
        },
      ], { registry });

      const parsed = parse(readFileSync(registry, 'utf-8'));
      const demo = parsed.targets.find(target => target.id === 'demo');
      const missing = parsed.targets.find(target => target.id === 'missing');

      assert.equal(summary.updated, 1);
      assert.equal(summary.skipped, 1);
      assert.equal(demo.submission.backlink_status, 'verified');
      assert.equal(demo.submission.backlink_type, 'dofollow_candidate');
      assert.equal(missing.submission.backlink_status, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records skipped verification rows without marking backlinks as found', () => {
    const updated = applyVerificationResultToTarget({
      id: 'demo',
      submission: { mode: 'auto_safe' },
    }, {
      target_id: 'demo',
      status: 'skipped',
      reason: 'missing_listing_url',
      at: '2026-05-22T00:00:00.000Z',
    });

    assert.equal(updated.submission.mode, 'auto_safe');
    assert.equal(updated.submission.backlink_status, 'skipped');
    assert.equal(updated.submission.backlink_found, false);
    assert.equal(updated.submission.verification_error, 'missing_listing_url');
  });

  it('does not let skipped verification attempts overwrite existing verified evidence', () => {
    const updated = applyVerificationResultToTarget({
      id: 'demo',
      submission: {
        mode: 'auto_safe',
        backlink_status: 'verified',
        backlink_found: true,
        backlink_type: 'dofollow_candidate',
        backlink_rel: [],
        live_listing_url: 'https://dir.example/tools/demo-app',
      },
    }, {
      target_id: 'demo',
      status: 'skipped',
      reason: 'missing_listing_url',
      at: '2026-05-23T00:00:00.000Z',
    });

    assert.equal(updated.submission.backlink_status, 'verified');
    assert.equal(updated.submission.backlink_found, true);
    assert.equal(updated.submission.backlink_type, 'dofollow_candidate');
    assert.equal(updated.submission.live_listing_url, 'https://dir.example/tools/demo-app');
    assert.equal(updated.submission.verification_error, 'missing_listing_url');
    assert.equal(updated.verification.status, 'skipped');
  });
});
