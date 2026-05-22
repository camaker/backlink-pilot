import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import { verifyResults } from '../src/verification/results.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-verify-results-'));
}

describe('verifyResults', () => {
  it('verifies listing URLs from JSONL run results', async () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      const output = join(dir, 'verification.jsonl');
      writeFileSync(results, [
        JSON.stringify({ target_id: 'a', status: 'pending_review', listing_url: 'https://dir.example/a' }),
        JSON.stringify({ target_id: 'b', status: 'pending_review' }),
        '',
      ].join('\n'));

      const summary = await verifyResults(results, {
        productUrl: 'https://product.example',
        output,
        verifyFn: async (listingUrl, productUrl) => ({
          listing_url: listingUrl,
          product_url: productUrl,
          http_status: 200,
          backlink_found: true,
          status: 'backlink_verified',
          backlink: { href: productUrl, rel: [], link_type: 'dofollow_candidate' },
        }),
      });

      const lines = readFileSync(output, 'utf-8').trim().split('\n').map(JSON.parse);
      assert.equal(summary.checked, 1);
      assert.equal(summary.verified, 1);
      assert.equal(summary.skipped, 1);
      assert.equal(lines[0].status, 'backlink_verified');
      assert.equal(lines[1].status, 'skipped');
      assert.equal(lines[1].reason, 'missing_listing_url');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses high-confidence candidates and skips low-confidence candidates', async () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      const output = join(dir, 'verification.jsonl');
      writeFileSync(results, [
        JSON.stringify({
          target_id: 'candidate',
          status: 'pending_review',
          listing_url_candidates: [
            { url: 'https://dir.example/tools/demo-app', confidence: 0.82, source: 'page_link' },
          ],
        }),
        JSON.stringify({
          target_id: 'low',
          status: 'pending_review',
          listing_url_candidates: [
            { url: 'https://dir.example/blog/random', confidence: 0.54, source: 'page_link' },
          ],
        }),
        '',
      ].join('\n'));

      const checked = [];
      const summary = await verifyResults(results, {
        productUrl: 'https://product.example',
        output,
        verifyFn: async (listingUrl, productUrl) => {
          checked.push(listingUrl);
          return {
            listing_url: listingUrl,
            product_url: productUrl,
            http_status: 200,
            backlink_found: false,
            status: 'backlink_not_found',
          };
        },
      });
      const lines = readFileSync(output, 'utf-8').trim().split('\n').map(JSON.parse);

      assert.deepEqual(checked, ['https://dir.example/tools/demo-app']);
      assert.equal(summary.checked, 1);
      assert.equal(summary.skipped, 1);
      assert.equal(lines[0].listing_url_source, 'page_link');
      assert.equal(lines[0].listing_url_confidence, 0.82);
      assert.equal(lines[1].reason, 'no_high_confidence_listing_url');
      assert.equal(lines[1].listing_url_candidates.length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('optionally writes verification evidence back to the registry', async () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      const output = join(dir, 'verification.jsonl');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: a
    submit_url: https://dir.example/submit
    submission:
      mode: auto_safe
      status: mapped
  - id: b
    submit_url: https://other.example/submit
    submission:
      mode: auto_safe
      status: mapped
`);
      writeFileSync(results, [
        JSON.stringify({
          target_id: 'a',
          status: 'pending_review',
          submit_url: 'https://dir.example/submit',
          listing_url: 'https://dir.example/tools/demo-app',
          listing_url_confidence: 0.9,
        }),
        JSON.stringify({
          target_id: 'b',
          status: 'pending_review',
        }),
        '',
      ].join('\n'));

      const summary = await verifyResults(results, {
        productUrl: 'https://demoapp.io',
        output,
        registry,
        updateRegistry: true,
        verifyFn: async (listingUrl, productUrl) => ({
          listing_url: listingUrl,
          product_url: productUrl,
          checked_at: '2026-05-22T00:00:00.000Z',
          http_status: 200,
          backlink_found: true,
          status: 'backlink_verified',
          backlink: { href: productUrl, rel: ['ugc'], link_type: 'ugc' },
        }),
      });

      const parsed = parse(readFileSync(registry, 'utf-8'));
      const a = parsed.targets.find(target => target.id === 'a');
      const b = parsed.targets.find(target => target.id === 'b');

      assert.equal(summary.registry_update.updated, 2);
      assert.equal(a.submission.backlink_status, 'verified');
      assert.equal(a.submission.live_listing_url, 'https://dir.example/tools/demo-app');
      assert.equal(a.submission.backlink_type, 'ugc');
      assert.equal(b.submission.backlink_status, 'skipped');
      assert.equal(b.submission.verification_error, 'missing_listing_url');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires product URL', async () => {
    const dir = tempDir();
    try {
      const results = join(dir, 'results.jsonl');
      writeFileSync(results, '');
      await assert.rejects(() => verifyResults(results), /product URL is required/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
