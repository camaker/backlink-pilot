import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractListingCandidates,
  extractTextUrls,
  scoreListingCandidate,
} from '../src/verification/listing.js';

const context = {
  submitUrl: 'https://directory.example/submit',
  product: {
    name: 'Demo App',
    url: 'https://demoapp.io',
  },
};

describe('listing URL extraction', () => {
  it('accepts specific product listing URLs and rejects submit or product URLs', () => {
    const listing = scoreListingCandidate({
      url: 'https://directory.example/products/demo-app',
      source: 'final_url',
    }, context);

    assert.ok(listing.confidence >= 0.75);
    assert.equal(scoreListingCandidate({ url: 'https://directory.example/submit', source: 'final_url' }, context), null);
    assert.equal(scoreListingCandidate({ url: 'https://demoapp.io/', source: 'final_url' }, context), null);
  });

  it('does not treat generic thank-you or checkout pages as listings', () => {
    assert.equal(
      scoreListingCandidate({ url: 'https://directory.example/thank-you', source: 'final_url' }, context),
      null
    );
    assert.equal(
      scoreListingCandidate({ url: 'https://directory.example/checkout/demo-app', source: 'final_url' }, context),
      null
    );
  });

  it('extracts listing candidates from confirmation page links', () => {
    const result = extractListingCandidates({
      url: 'https://directory.example/thank-you',
      raw: {
        url: 'https://directory.example/thank-you',
        html: '<a href="/tools/demo-app">View listing</a><a href="/pricing">Pricing</a>',
      },
    }, context);

    assert.equal(result.best.url, 'https://directory.example/tools/demo-app');
    assert.equal(result.best.source, 'page_link');
    assert.ok(result.candidates.every(candidate => !candidate.url.includes('/pricing')));
  });

  it('extracts mentioned listing URLs from confirmation text', () => {
    const urls = extractTextUrls('Live at https://directory.example/tools/demo-app.');
    assert.deepEqual(urls, ['https://directory.example/tools/demo-app']);

    const result = extractListingCandidates({
      body_text: 'Your page is live: https://directory.example/tools/demo-app.',
    }, context);

    assert.equal(result.best.url, 'https://directory.example/tools/demo-app');
    assert.equal(result.best.source, 'text_url');
  });

  it('dedupes candidates and keeps the highest confidence source', () => {
    const result = extractListingCandidates({
      url: 'https://directory.example/products/demo-app?ref=thanks',
      raw: {
        html: '<a href="https://directory.example/products/demo-app">View listing</a>',
      },
    }, context);

    assert.equal(result.candidates.length, 1);
    assert.equal(result.best.source, 'page_link');
    assert.ok(result.best.reasons.includes('listing_anchor_signal'));
  });

  it('keeps low-confidence candidates out of best listing_url', () => {
    const result = extractListingCandidates({
      raw: {
        html: '<a href="/blog/random">Read more</a>',
      },
    }, context);

    assert.equal(result.best, null);
    assert.equal(result.candidates.length, 1);
    assert.ok(result.candidates[0].confidence < result.min_confidence);
  });

  it('does not promote generic directory index pages even with listing anchor text', () => {
    const result = extractListingCandidates({
      raw: {
        html: '<a href="/products">View listing</a>',
      },
    }, context);

    assert.equal(result.best, null);
    assert.equal(result.candidates[0].url, 'https://directory.example/products');
    assert.ok(result.candidates[0].reasons.includes('generic_directory_path_cap'));
  });
});
