import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRel, extractLinks, findBacklink, verifyBacklink } from '../src/verification/backlink.js';

describe('backlink verification parsing', () => {
  it('extracts links and resolves relative URLs', () => {
    const links = extractLinks(
      '<a href="/go" rel="nofollow ugc">Visit <strong>Product</strong></a>',
      'https://directory.example/listing'
    );

    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://directory.example/go');
    assert.deepEqual(links[0].rel, ['nofollow', 'ugc']);
    assert.equal(links[0].anchor_text, 'Visit Product');
  });

  it('classifies rel values conservatively', () => {
    assert.equal(classifyRel([]), 'dofollow_candidate');
    assert.equal(classifyRel(['nofollow']), 'nofollow');
    assert.equal(classifyRel(['ugc']), 'ugc');
    assert.equal(classifyRel(['sponsored']), 'sponsored');
  });

  it('finds normalized product backlinks after stripping tracking params', () => {
    const backlink = findBacklink(
      '<a href="https://www.product.example/?utm_source=dir" rel="nofollow">Product</a>',
      'https://directory.example/listing',
      'https://product.example/'
    );

    assert.equal(backlink.href, 'https://www.product.example/?utm_source=dir');
    assert.equal(backlink.link_type, 'nofollow');
  });

  it('returns null when the product URL is absent', () => {
    const backlink = findBacklink(
      '<a href="https://other.example/">Other</a>',
      'https://directory.example/listing',
      'https://product.example/'
    );

    assert.equal(backlink, null);
  });
});

describe('verifyBacklink', () => {
  it('fetches a listing and reports verified backlink details', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 200,
      url: 'https://directory.example/listing',
      text: async () => '<html><a href="https://product.example" rel="sponsored">Product</a></html>',
    });

    try {
      const result = await verifyBacklink(
        'https://directory.example/listing',
        'https://product.example/'
      );

      assert.equal(result.status, 'backlink_verified');
      assert.equal(result.backlink_found, true);
      assert.equal(result.backlink.link_type, 'sponsored');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports fetch failures without throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('offline');
    };

    try {
      const result = await verifyBacklink(
        'https://directory.example/listing',
        'https://product.example/'
      );

      assert.equal(result.status, 'fetch_failed');
      assert.equal(result.backlink_found, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
