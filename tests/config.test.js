import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig, inferProduct, productOptionsFromInput, utmUrl } from '../src/config.js';

describe('product config automation', () => {
  it('reads product details from CLI-style options', () => {
    const product = productOptionsFromInput({
      productName: 'Test App',
      productUrl: 'https://test.example',
      productCategories: 'ai, productivity',
      productFeatures: 'fast, private',
    });

    assert.equal(product.name, 'Test App');
    assert.equal(product.url, 'https://test.example');
    assert.deepEqual(product.categories, ['ai', 'productivity']);
    assert.deepEqual(product.features, ['fast', 'private']);
  });

  it('infers missing product fields from URL without manual YAML editing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('offline');
    };

    let product;
    try {
      product = await inferProduct({
        productUrl: 'https://example.com',
        productDescription: 'A useful product.',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(product.url, 'https://example.com');
    assert.equal(product.name, 'Example');
    assert.equal(product.email, 'hello@example.com');
    assert.equal(product.description, 'A useful product.');
  });

  it('builds a runnable default config from inferred product details', () => {
    const config = buildConfig({
      name: 'Test App',
      url: 'https://test.example',
      description: 'A useful product.',
      long_description: 'A useful product.',
      email: 'hello@test.example',
      categories: ['ai'],
      pricing: 'free',
      logo_url: '',
      github_url: '',
      twitter: '',
      features: [],
    });

    assert.equal(config.product.name, 'Test App');
    assert.equal(config.browser.engine, 'bb');
    assert.equal(config.utm.base_url, 'https://test.example');
  });
});

describe('utmUrl', () => {
  it('appends UTM params by default', () => {
    const config = { product: { url: 'https://example.com' } };
    const result = utmUrl(config, 'testsite');
    assert.equal(result, 'https://example.com?utm_source=testsite&utm_medium=directory&utm_campaign=backlink');
  });

  it('uses utm.base_url when provided', () => {
    const config = {
      product: { url: 'https://example.com' },
      utm: { base_url: 'https://custom.com', medium: 'social', campaign: 'launch' },
    };
    const result = utmUrl(config, 'twitter');
    assert.equal(result, 'https://custom.com?utm_source=twitter&utm_medium=social&utm_campaign=launch');
  });

  it('returns clean URL when utm.enabled is false', () => {
    const config = {
      product: { url: 'https://example.com' },
      utm: { enabled: false, base_url: 'https://example.com' },
    };
    const result = utmUrl(config, 'testsite');
    assert.equal(result, 'https://example.com');
  });

  it('returns clean product.url when utm.enabled is false and no base_url', () => {
    const config = {
      product: { url: 'https://example.com' },
      utm: { enabled: false },
    };
    const result = utmUrl(config, 'testsite');
    assert.equal(result, 'https://example.com');
  });

  it('appends UTM when utm.enabled is true', () => {
    const config = {
      product: { url: 'https://example.com' },
      utm: { enabled: true },
    };
    const result = utmUrl(config, 'testsite');
    assert.match(result, /utm_source=testsite/);
  });

  it('appends UTM when utm.enabled is not set (backwards compat)', () => {
    const config = {
      product: { url: 'https://example.com' },
      utm: { medium: 'dir' },
    };
    const result = utmUrl(config, 'x');
    assert.match(result, /utm_source=x/);
    assert.match(result, /utm_medium=dir/);
  });
});
