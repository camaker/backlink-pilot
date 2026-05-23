import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeFieldCandidates,
  requiredScoutMappingForAuth,
  scoutMappedFields,
  selectorForScoutField,
} from '../src/sites/generic.js';
import {
  canDeepScoutSubmitLink,
  gotoScoutPage,
  isSubmitLinkCandidate,
  selectorForField,
  sortSubmitLinks,
} from '../src/scout/discover.js';

describe('scout selector generation', () => {
  it('builds stable selectors from discovered field attributes', () => {
    assert.equal(
      selectorForField({ tag: 'input', name: 'tool[name]' }),
      'input[name="tool[name]"]'
    );
    assert.equal(
      selectorForField({ tag: 'textarea', id: 'description' }),
      'textarea[id="description"]'
    );
    assert.equal(
      selectorForField({ tag: 'input', placeholder: 'Website URL' }),
      'input[placeholder="Website URL"]'
    );
    assert.equal(
      selectorForField({ tag: 'button', type: 'submit' }),
      'button[type="submit"]'
    );
  });

  it('prioritizes same-domain submit links over external submission services', () => {
    const links = sortSubmitLinks([
      {
        text: 'We Submit Your SaaS to 140+ Directories Effortlessly',
        href: 'https://submitsaas.com/',
      },
      {
        text: 'Submit Tool',
        href: 'https://aixcollection.com/get-started',
      },
      {
        text: '',
        href: 'https://x.com/submitmatic',
      },
    ], 'https://aixcollection.com/');

    assert.equal(links[0].href, 'https://aixcollection.com/get-started');
  });

  it('does not classify directory names, product pages, or browser stores as submit links', () => {
    assert.equal(
      isSubmitLinkCandidate('https://ashlist.com/product/example', 'Example', 'https://ashlist.com/'),
      false
    );
    assert.equal(
      isSubmitLinkCandidate('https://chromewebstore.google.com/detail/example', 'Add to Chrome', 'https://example.com/'),
      false
    );
    assert.equal(
      isSubmitLinkCandidate('https://appalist.com/latest', 'Latest', 'https://appalist.com/'),
      false
    );
  });

  it('only deep scouts same-domain submission links or trusted external form hosts', () => {
    assert.equal(
      canDeepScoutSubmitLink('https://example.com/submit', 'https://example.com/'),
      true
    );
    assert.equal(
      canDeepScoutSubmitLink('https://tally.so/r/3lOGLk', 'https://example.com/'),
      true
    );
    assert.equal(
      canDeepScoutSubmitLink('https://aisite.medsci.cn/submit', 'https://submitmatic.com/'),
      false
    );
  });

  it('falls back to domcontentloaded when networkidle navigation times out', async () => {
    const calls = [];
    const page = {
      async goto(url, options) {
        calls.push({ url, options });
        if (options.waitUntil === 'networkidle') throw new Error('networkidle timeout');
        return { status: () => 204 };
      },
    };

    const result = await gotoScoutPage(page, 'https://example.com/submit');

    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
    assert.equal(result.status, 204);
    assert.match(result.error, /networkidle timeout/);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.waitUntil, 'networkidle');
    assert.equal(calls[1].options.waitUntil, 'domcontentloaded');
  });

  it('records the HTTP status from successful scout navigation', async () => {
    const page = {
      async goto() {
        return { status: () => 404 };
      },
    };

    const result = await gotoScoutPage(page, 'https://example.com/missing');

    assert.equal(result.ok, true);
    assert.equal(result.status, 404);
  });
});

describe('generic scout mapping reuse', () => {
  it('converts registry scout forms into fillable generic field candidates', () => {
    const fields = scoutMappedFields({
      forms: [
        {
          fields: [
            { tag: 'input', name: 'name', mapped_to: 'product.name', required: true },
            { tag: 'input', selector: 'input[data-url]', mapped_to: 'product.url' },
            { tag: 'input', name: 'ignored' },
          ],
        },
      ],
    });

    assert.deepEqual(fields.map(field => field.mapped_to), ['product.name', 'product.url']);
    assert.equal(fields[0].selector, 'input[name="name"]');
    assert.equal(fields[0].source, 'scout');
    assert.equal(fields[1].selector, 'input[data-url]');
  });

  it('uses existing selectors and derives missing ones', () => {
    assert.equal(
      selectorForScoutField({ selector: 'textarea.description' }),
      'textarea.description'
    );
    assert.equal(
      selectorForScoutField({ tag: 'input', aria_label: 'Contact Email' }),
      'input[aria-label="Contact Email"]'
    );
  });

  it('prioritizes scout candidates while retaining snapshot fallbacks', () => {
    const merged = mergeFieldCandidates(
      [{ mapped_to: 'product.url', selector: 'input[name="url"]', source: 'scout' }],
      [{ mapped_to: 'product.url', ref: '@7', source: 'snapshot' }],
      [{ mapped_to: 'product.name', ref: '@2', source: 'snapshot' }]
    );

    const url = merged.find(field => field.mapped_to === 'product.url');
    const name = merged.find(field => field.mapped_to === 'product.name');

    assert.equal(url.selector, 'input[name="url"]');
    assert.equal(url.candidates.length, 2);
    assert.deepEqual(url.candidates.map(candidate => candidate.source), ['scout', 'snapshot']);
    assert.equal(name.ref, '@2');
    assert.equal(name.candidates.length, 1);
  });

  it('requires persisted scout selectors for authenticated generic submissions', () => {
    const config = { _authStatePath: 'playwright/.auth/demo.storage-state.json' };
    assert.throws(
      () => requiredScoutMappingForAuth(config, [], 'button[type="submit"]'),
      /requires persisted scout field mappings/
    );
    assert.throws(
      () => requiredScoutMappingForAuth(
        config,
        [{ mapped_to: 'product.name', candidates: [{ source: 'snapshot', ref: '@1' }] }],
        'button[type="submit"]'
      ),
      /requires scout-backed selectors/
    );
    assert.throws(
      () => requiredScoutMappingForAuth(
        config,
        [{ mapped_to: 'product.name', candidates: [{ source: 'scout', selector: 'input[name="name"]' }] }],
        '@9'
      ),
      /requires a persisted scout submit button selector/
    );
    assert.doesNotThrow(() => requiredScoutMappingForAuth(
      config,
      [{ mapped_to: 'product.name', candidates: [{ source: 'scout', selector: 'input[name="name"]' }] }],
      'button[type="submit"]'
    ));
  });
});
