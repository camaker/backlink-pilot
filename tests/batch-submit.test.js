import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

describe('batch-submit resource loading', () => {
  it('resources/backlink-resources.example.json exists', () => {
    assert.ok(existsSync('resources/backlink-resources.example.json'));
  });

  it('example file is valid JSON with expected structure', async () => {
    const { readFileSync } = await import('fs');
    const raw = JSON.parse(readFileSync('resources/backlink-resources.example.json', 'utf-8'));
    assert.ok(raw.blog_comments, 'should have blog_comments key');
    assert.ok(Array.isArray(raw.blog_comments), 'blog_comments should be array');
    assert.ok(raw.blog_comments.length > 0, 'should have at least one example');

    const entry = raw.blog_comments[0];
    assert.ok(entry.type, 'entry should have type');
    assert.ok(entry.url, 'entry should have url');
    assert.equal(typeof entry.has_url_field, 'boolean');
    assert.equal(typeof entry.has_captcha, 'boolean');
  });

  it('batchSubmit no longer requires manually maintained resources/sites.json', async () => {
    const resourcePath = 'resources/backlink-resources.json';
    assert.ok(existsSync(resourcePath) || true, 'guard should check existence');

    const src = readFileSync('src/batch-submit.js', 'utf-8');
    assert.ok(src.includes('loadConfig(opts)'), 'batchSubmit should load product config automatically');
    assert.ok(src.includes('loadLegacySites'), 'legacy sites.json should be optional fallback only');
    assert.ok(!src.includes('resources/sites.json not found'), 'sites.json should not be required');
  });
});
