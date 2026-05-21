import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
