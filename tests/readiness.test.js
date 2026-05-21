import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProductReadiness,
  formatReadinessReport,
  knownReadinessUrlFields,
  validateProductReadiness,
} from '../src/readiness/product.js';

function readyProduct(overrides = {}) {
  return {
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
    ...overrides,
  };
}

describe('product readiness validation', () => {
  it('passes automation readiness when required product assets exist', () => {
    const report = validateProductReadiness({ product: readyProduct() });
    assert.equal(report.ok, true);
    assert.equal(report.blockers.length, 0);
    assert.equal(report.level, 'automation');
  });

  it('blocks placeholder and incomplete products before real execution', () => {
    const report = validateProductReadiness({
      product: {
        name: 'Example Product',
        url: 'https://example.com',
        description: 'short',
        email: 'not-an-email',
      },
    });

    assert.equal(report.ok, false);
    assert.ok(report.blockers.some(item => item.id === 'product_url_public'));
    assert.ok(report.blockers.some(item => item.id === 'product_email'));
    assert.ok(report.blockers.some(item => item.id === 'pricing_page'));
  });

  it('rejects reserved non-production domains', () => {
    const report = validateProductReadiness({
      product: readyProduct({
        url: 'https://demo.test',
        pricing_url: 'https://demo.invalid/pricing',
      }),
    });

    assert.equal(report.ok, false);
    assert.ok(report.blockers.some(item => item.id === 'product_url_public'));
    assert.ok(report.blockers.some(item => item.id === 'pricing_page'));
  });

  it('supports nested page and asset URLs', () => {
    const report = validateProductReadiness({
      product: readyProduct({
        pricing_url: '',
        privacy_url: '',
        terms_url: '',
        logo_url: '',
        pages: {
          pricing: 'https://demoapp.io/pricing',
          privacy: 'https://demoapp.io/privacy',
          terms: 'https://demoapp.io/terms',
        },
        assets: {
          logo_png_url: 'https://demoapp.io/logo.png',
        },
      }),
    });

    assert.equal(report.ok, true);
  });

  it('launch readiness adds screenshots, video, and destination page blockers', () => {
    const report = validateProductReadiness({ product: readyProduct() }, { level: 'launch' });
    assert.equal(report.ok, false);
    assert.ok(report.blockers.some(item => item.id === 'screenshots'));
    assert.ok(report.blockers.some(item => item.id === 'demo_video'));
    assert.ok(report.blockers.some(item => item.id === 'alternative_pages'));
    assert.ok(report.blockers.some(item => item.id === 'use_case_pages'));
  });

  it('throws an actionable error when readiness fails', () => {
    assert.throws(
      () => assertProductReadiness({ product: { name: 'Bad' } }),
      /Product readiness check failed/
    );
  });

  it('formats a readable report and exposes known URL fields', () => {
    const report = validateProductReadiness({ product: readyProduct() });
    const formatted = formatReadinessReport(report);
    assert.match(formatted, /Readiness level: automation/);
    assert.ok(knownReadinessUrlFields().includes('privacy_url'));
  });
});
