// generic.js — Universal directory submission adapter using bb-browser
// Works with any directory site by auto-detecting form fields via snapshot

import { withBrowser, delay } from '../browser.js';
import { mapField, productValueForField } from '../scout/field-mapper.js';

const SUBMIT_PATTERNS = /submit|send|add|post|create|list|suggest|save/i;
const REQUIRED_MAPPED_FIELDS = new Set(['product.name', 'product.url', 'product.description']);

/**
 * Parse bb-browser snapshot output to find interactive elements
 * Snapshot format: lines like "@3 [textbox] Name ..." or "@7 [button] Submit"
 */
function parseSnapshot(snapshot) {
  const fields = [];
  let submit = null;
  const lines = snapshot.split('\n');

  for (const line of lines) {
    const refMatch = line.match(/^.*?(@\d+)\s+\[(\w+)\]\s*(.*)$/);
    if (!refMatch) continue;

    const [, ref, role, label] = refMatch;
    const labelLower = label.toLowerCase();

    // Match input/textarea fields
    if (role === 'textbox' || role === 'combobox') {
      const mappedTo = mapField({ label });
      if (mappedTo) {
        fields.push({ ref, role, label, mapped_to: mappedTo });
      }
    }

    // Match submit button
    if ((role === 'button' || role === 'link') && SUBMIT_PATTERNS.test(labelLower)) {
      if (!submit) submit = ref;
    }
  }

  return { fields, submit };
}

function mappedFieldSet(fields) {
  return new Set(fields.map(field => field.mapped_to));
}

function missingRequiredMappedFields(fields) {
  const mapped = mappedFieldSet(fields);
  return [...REQUIRED_MAPPED_FIELDS].filter(field => !mapped.has(field));
}

export default {
  name: 'generic',
  url: null,
  auth: 'none',
  captcha: 'none',
  engine: 'bb', // forces bb-browser

  async submit(product, config) {
    const targetUrl = config._genericUrl || config._targetUrl;
    if (!targetUrl) throw new Error('No target URL provided for generic submission');

    return withBrowser({ ...config, _engine: 'bb' }, async ({ page }) => {
      // 1. Navigate to submission page
      console.log(`  📄 Opening ${targetUrl}`);
      await page.goto(targetUrl);
      await delay(2000);

      // 1.5. Validate page — check for dead/login/paid pages
      const pageUrl = typeof page.url === 'function' ? page.url() : '';
      const pageTitle = await page.textContent('title').catch(() => '');
      const bodyText = await page.textContent('body').catch(() => '');
      const bodySnippet = bodyText.substring(0, 500).toLowerCase();

      if (/404|not found|page not found/.test(bodySnippet) || /404/.test(pageTitle)) {
        throw new Error(`Page returned 404 — submit URL may have changed. Check the site root.`);
      }
      if (/500|server error|internal error/.test(bodySnippet)) {
        throw new Error(`Page returned 500 Server Error — site may be down.`);
      }
      if (/login|sign.?in|log.?in|create.?account/.test(pageUrl.toLowerCase()) ||
          (/login|sign.?in/.test(bodySnippet) && !/submit|add.*tool|description/.test(bodySnippet))) {
        throw new Error(`Page redirected to login — this site now requires an account.`);
      }
      if (/stripe\.com|checkout|payment|pricing|buy now|\$\d+/.test(bodySnippet) &&
          !/free/.test(bodySnippet)) {
        throw new Error(`Page appears to be a payment page — this site may no longer be free.`);
      }

      // 2. Take interactive snapshot
      console.log('  🔍 Scanning form fields...');
      const snapshot = await page.snapshot();
      const parsed = parseSnapshot(snapshot);
      const fields = parsed.fields;

      const detected = fields
        .map(field => `${field.mapped_to}=${field.ref}`)
        .join(', ');
      console.log(`  📋 Detected: ${detected || 'none'}`);

      if (!fields.length) {
        throw new Error('No recognizable form fields found. Use scout first.');
      }

      const missing = missingRequiredMappedFields(fields);
      if (missing.length) {
        throw new Error(`Required submission fields not detected: ${missing.join(', ')}. Use scout first.`);
      }

      // 3. Fill detected fields
      const filled = new Set();
      for (const field of fields) {
        if (filled.has(field.mapped_to)) continue;
        const value = productValueForField(product, field.mapped_to);
        if (!value) continue;
        console.log(`  ✏️  Filling ${field.mapped_to}`);
        await page.fill(field.ref, value);
        await delay(300);
        filled.add(field.mapped_to);
      }

      // 4. Screenshot before submit
      try {
        const screenshotDir = config.browser?.screenshot_dir || './screenshots';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot(`${screenshotDir}/generic-${timestamp}.png`);
      } catch {}

      // 5. Submit
      if (parsed.submit) {
        console.log(`  🚀 Clicking submit (${parsed.submit})`);
        await page.click(parsed.submit);
        await delay(3000);
      } else {
        console.log('  ⚠️  No submit button found — form filled but not submitted');
      }

      const currentUrl = page.url();
      return {
        url: currentUrl,
        body_text: await page.textContent('body').catch(() => ''),
        confirmation: parsed.submit
          ? 'Generic submission completed — verify manually'
          : 'filled_unsubmitted: no submit button found',
      };
    });
  },
};
