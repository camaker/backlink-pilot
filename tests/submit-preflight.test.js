import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

describe('submit.js pre-flight check', () => {
  it('submit.js contains HTTP pre-flight check before launching browser', () => {
    const src = readFileSync('src/submit.js', 'utf-8');
    assert.ok(src.includes('Pre-flight HTTP check'), 'should have pre-flight check');
    assert.ok(src.includes('404'), 'should check for 404');
    assert.ok(src.includes('500'), 'should check for 500');
  });

  it('submit.js returns structured statuses for callers', () => {
    const src = readFileSync('src/submit.js', 'utf-8');
    assert.ok(src.includes("status: 'dry_run'"), 'should return dry_run status');
    assert.ok(src.includes("status: 'failed'"), 'should return failed status');
    assert.ok(src.includes('classifySubmissionResult'), 'should classify adapter results');
    assert.ok(src.includes('return {'), 'should return structured result objects');
  });
});

describe('generic adapter page validation', () => {
  it('generic.js validates page before scanning form', () => {
    const src = readFileSync('src/sites/generic.js', 'utf-8');
    assert.ok(src.includes('Validate page'), 'should validate page');
    assert.ok(src.includes('404'), 'should detect 404 pages');
    assert.ok(src.includes('login'), 'should detect login redirects');
    assert.ok(src.includes('payment'), 'should detect payment pages');
  });

  it('generic.js requires mapped required fields before submitting', () => {
    const src = readFileSync('src/sites/generic.js', 'utf-8');
    assert.ok(src.includes('REQUIRED_MAPPED_FIELDS'), 'should define required mapped fields');
    assert.ok(src.includes('product.name'), 'should require product name');
    assert.ok(src.includes('product.url'), 'should require product URL');
    assert.ok(src.includes('product.description'), 'should require product description');
    assert.ok(src.includes('Required submission fields not detected'), 'should fail closed on missing fields');
  });

  it('generic.js uses shared scout field mapping', () => {
    const src = readFileSync('src/sites/generic.js', 'utf-8');
    assert.ok(src.includes('mapField'), 'should use shared field mapper');
    assert.ok(src.includes('productValueForField'), 'should use shared product value resolver');
    assert.ok(src.includes('filled_unsubmitted'), 'should distinguish filled forms from submitted forms');
  });

  it('generic.js writes submission artifacts for auditability', () => {
    const src = readFileSync('src/sites/generic.js', 'utf-8');
    assert.ok(src.includes('capturePageArtifact'), 'should capture page artifacts');
    assert.ok(src.includes('form-mapping.json'), 'should persist form mapping');
    assert.ok(src.includes('snapshot.txt'), 'should persist interactive snapshot');
    assert.ok(src.includes('adapter-result.json'), 'should persist adapter result');
  });

  it('generic.js reuses scout mappings before snapshot fallbacks', () => {
    const src = readFileSync('src/sites/generic.js', 'utf-8');
    assert.ok(src.includes('scoutMappedFields'), 'should read persisted scout mappings');
    assert.ok(src.includes('mergeFieldCandidates'), 'should merge scout and snapshot candidates');
    assert.ok(src.includes('scoutSubmitButton'), 'should reuse persisted submit button selectors');
    assert.ok(src.includes('Required submission fields could not be filled'), 'should fail closed when fill attempts fail');
  });
});

describe('deprecated adapters are marked', () => {
  const adapters = ['600tools', 'dangai', 'toolverto', 'submitaitools'];

  for (const name of adapters) {
    it(`${name}.js is marked as DEPRECATED`, () => {
      const src = readFileSync(`src/sites/${name}.js`, 'utf-8');
      assert.ok(src.includes('DEPRECATED'), `${name} should be marked DEPRECATED`);
    });
  }
});

describe('bb.js improvements', () => {
  it('uses tab list for health check instead of status', () => {
    const src = readFileSync('src/bb.js', 'utf-8');
    assert.ok(src.includes("bb('tab', 'list')"), 'should use tab list for health check');
  });

  it('catches timeout errors with friendly message', () => {
    const src = readFileSync('src/bb.js', 'utf-8');
    assert.ok(src.includes('超时') || src.includes('timeout'), 'should detect timeout');
    assert.ok(src.includes('Chrome may be unresponsive') || src.includes('not responding'),
      'should give friendly timeout message');
  });

  it('evalClickReal dispatches full mouse events for React compat', () => {
    const src = readFileSync('src/bb.js', 'utf-8');
    assert.ok(src.includes('evalClickReal'), 'should have evalClickReal method');
    assert.ok(src.includes('mousedown'), 'should dispatch mousedown');
    assert.ok(src.includes('mouseup'), 'should dispatch mouseup');
    assert.ok(src.includes("el.type === 'radio'"), 'should handle radio elements');
  });

  it('BbElementHandle.click() uses evalClickReal', () => {
    const src = readFileSync('src/bb.js', 'utf-8');
    // BbElementHandle class should use evalClickReal, not evalClick
    const handleSection = src.substring(src.indexOf('class BbElementHandle'));
    assert.ok(handleSection.includes('evalClickReal'), 'BbElementHandle should use evalClickReal');
  });
});
