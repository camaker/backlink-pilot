// generic.js — Universal directory submission adapter using bb-browser
// Works with any directory site by auto-detecting form fields via snapshot

import { join } from 'path';
import { withBrowser, delay } from '../browser.js';
import { mapField, productValueForField } from '../scout/field-mapper.js';
import {
  ensureDir,
  writeArtifactJson,
  writeArtifactText,
} from '../runner/artifacts.js';

const SUBMIT_PATTERNS = /submit|send|add|post|create|list|suggest|save/i;
const REQUIRED_MAPPED_FIELDS = new Set(['product.name', 'product.url', 'product.description']);
const SELECTOR_SPECIALS = /["\\]/g;

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

function cssString(value) {
  return String(value || '').replace(SELECTOR_SPECIALS, '\\$&');
}

export function selectorForScoutField(field = {}) {
  if (field.selector) return field.selector;
  const tag = field.tag || (field.type === 'textarea' ? 'textarea' : 'input');
  if (field.id) return `${tag}[id="${cssString(field.id)}"]`;
  if (field.name) return `${tag}[name="${cssString(field.name)}"]`;
  if (field.placeholder) return `${tag}[placeholder="${cssString(field.placeholder)}"]`;
  if (field.aria_label) return `${tag}[aria-label="${cssString(field.aria_label)}"]`;
  if (field.type) return `${tag}[type="${cssString(field.type)}"]`;
  return '';
}

export function scoutMappedFields(target = {}) {
  return (target.forms || [])
    .flatMap(form => form.fields || [])
    .filter(field => field.mapped_to)
    .map(field => ({
      source: 'scout',
      selector: selectorForScoutField(field),
      label: field.label || field.name || field.placeholder || field.aria_label || field.id || field.type || '',
      mapped_to: field.mapped_to,
      required: Boolean(field.required),
    }))
    .filter(field => field.selector);
}

export function mergeFieldCandidates(...groups) {
  const byMapped = new Map();
  for (const field of groups.flat()) {
    if (!field?.mapped_to) continue;
    const existing = byMapped.get(field.mapped_to);
    if (!existing) {
      byMapped.set(field.mapped_to, field);
      continue;
    }
    const candidates = [
      ...(existing.candidates || [existing]),
      ...(field.candidates || [field]),
    ];
    byMapped.set(field.mapped_to, { ...existing, candidates });
  }
  return [...byMapped.values()].map(field => ({
    ...field,
    candidates: field.candidates || [field],
  }));
}

function hasSubmitButtonFromScout(target = {}) {
  return (target.forms || []).some(form =>
    Array.isArray(form.submit_buttons) && form.submit_buttons.length > 0
  );
}

function scoutSubmitButton(target = {}) {
  for (const form of target.forms || []) {
    for (const button of form.submit_buttons || []) {
      if (button.selector) return button.selector;
    }
  }
  return '';
}

async function fillCandidate(page, field, value) {
  const candidates = field.candidates || [field];
  const errors = [];
  for (const candidate of candidates) {
    const handle = candidate.selector || candidate.ref;
    if (!handle) continue;
    try {
      await page.fill(handle, value);
      return { ok: true, handle, source: candidate.source || 'unknown' };
    } catch (error) {
      errors.push(`${handle}: ${error.message}`);
    }
  }
  return { ok: false, errors };
}

async function readPageUrl(page) {
  try {
    return typeof page.url === 'function' ? page.url() : '';
  } catch {
    return '';
  }
}

async function capturePageArtifact(page, artifactDir, name, extra = {}) {
  if (!artifactDir) return;
  try {
    ensureDir(artifactDir);
    const url = await readPageUrl(page);
    const bodyText = await page.textContent('body').catch(() => '');
    const html = typeof page.content === 'function'
      ? await page.content().catch(() => '')
      : '';
    if (html) writeArtifactText(join(artifactDir, `${name}.html`), html);
    writeArtifactText(join(artifactDir, `${name}.txt`), bodyText);
    writeArtifactJson(join(artifactDir, `${name}.json`), {
      url,
      body_text_length: bodyText.length,
      ...extra,
    });
    await page.screenshot(join(artifactDir, `${name}.png`)).catch(() => {});
  } catch {}
}

export default {
  name: 'generic',
  url: null,
  auth: 'none',
  captcha: 'none',
  engine: 'bb', // forces bb-browser

  async submit(product, config) {
    const targetUrl = config._genericUrl || config._targetUrl;
    const artifactDir = config._artifactDir;
    const registryTarget = config._registryTarget || {};
    if (!targetUrl) throw new Error('No target URL provided for generic submission');

    return withBrowser({ ...config, _engine: 'bb' }, async ({ page }) => {
      // 1. Navigate to submission page
      console.log(`  📄 Opening ${targetUrl}`);
      await page.goto(targetUrl);
      await delay(2000);
      await capturePageArtifact(page, artifactDir, '01-initial', { target_url: targetUrl });

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
      const scoutFields = scoutMappedFields(registryTarget);
      const fields = mergeFieldCandidates(scoutFields, parsed.fields.map(field => ({ ...field, source: 'snapshot' })));
      const submitHandle = parsed.submit || scoutSubmitButton(registryTarget);
      if (artifactDir) {
        writeArtifactText(join(artifactDir, 'snapshot.txt'), snapshot);
        writeArtifactJson(join(artifactDir, 'form-mapping.json'), {
          mapping_source: scoutFields.length ? 'scout_plus_snapshot' : 'snapshot',
          scout_fields: scoutFields,
          snapshot_fields: parsed.fields,
          fields,
          submit: submitHandle,
          snapshot_submit: parsed.submit,
          scout_submit: scoutSubmitButton(registryTarget),
          scout_submit_button_detected: hasSubmitButtonFromScout(registryTarget),
          required_mapped_fields: [...REQUIRED_MAPPED_FIELDS],
        });
      }

      const detected = fields
        .map(field => `${field.mapped_to}=${field.selector || field.ref || field.candidates?.map(c => c.selector || c.ref).join('|')}`)
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
      const fillResults = [];
      for (const field of fields) {
        if (filled.has(field.mapped_to)) continue;
        const value = productValueForField(product, field.mapped_to);
        if (!value) continue;
        console.log(`  ✏️  Filling ${field.mapped_to}`);
        const result = await fillCandidate(page, field, value);
        fillResults.push({
          mapped_to: field.mapped_to,
          ok: result.ok,
          handle: result.handle || '',
          source: result.source || '',
          errors: result.errors || [],
        });
        if (!result.ok) continue;
        await delay(300);
        filled.add(field.mapped_to);
      }
      const missingFilledRequired = [...REQUIRED_MAPPED_FIELDS].filter(field => !filled.has(field));
      if (missingFilledRequired.length) {
        throw new Error(`Required submission fields could not be filled: ${missingFilledRequired.join(', ')}.`);
      }
      if (artifactDir) {
        writeArtifactJson(join(artifactDir, 'filled-fields.json'), {
          filled: [...filled],
          fill_results: fillResults,
          skipped: fields
            .filter(field => !filled.has(field.mapped_to))
            .map(field => ({
              ref: field.ref,
              selector: field.selector,
              label: field.label,
              mapped_to: field.mapped_to,
            })),
        });
      }

      // 4. Screenshot before submit
      try {
        const screenshotDir = config.browser?.screenshot_dir || './screenshots';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot(`${screenshotDir}/generic-${timestamp}.png`);
      } catch {}
      await capturePageArtifact(page, artifactDir, '02-before-submit', {
        fields: fields.map(field => ({
          ref: field.ref,
          selector: field.selector,
          role: field.role,
          label: field.label,
          mapped_to: field.mapped_to,
        })),
      });

      // 5. Submit
      if (submitHandle) {
        console.log(`  🚀 Clicking submit (${submitHandle})`);
        await page.click(submitHandle);
        await delay(3000);
      } else {
        console.log('  ⚠️  No submit button found — form filled but not submitted');
      }

      const currentUrl = page.url();
      await capturePageArtifact(page, artifactDir, '03-after-submit', {
        submitted: Boolean(submitHandle),
      });
      const result = {
        url: currentUrl,
        body_text: await page.textContent('body').catch(() => ''),
        confirmation: submitHandle
          ? 'Generic submission completed — verify manually'
          : 'filled_unsubmitted: no submit button found',
      };
      if (artifactDir) writeArtifactJson(join(artifactDir, 'adapter-result.json'), result);
      return result;
    });
  },
};
