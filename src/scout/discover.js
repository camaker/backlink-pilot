// scout/discover.js — Site submit page discovery

import { withBrowser, delay } from '../browser.js';
import { classifyScoutResult } from './classifier.js';
import { mapFormFields } from './field-mapper.js';
import {
  DEFAULT_SCOUT_DIR,
  formatScoutSummary,
  saveScoutResult,
  scoutResultPath,
  updateRegistryWithScoutResult,
} from './persist.js';

function nowIso() {
  return new Date().toISOString();
}

function resolveHref(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

async function readPageUrl(page) {
  try {
    return typeof page.url === 'function' ? page.url() : '';
  } catch {
    return '';
  }
}

async function readField(input) {
  const tag = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
  const type = await input.getAttribute('type').catch(() => '') || tag;
  const name = await input.getAttribute('name').catch(() => '') || '';
  const id = await input.getAttribute('id').catch(() => '') || '';
  const placeholder = await input.getAttribute('placeholder').catch(() => '') || '';
  const ariaLabel = await input.getAttribute('aria-label').catch(() => '') || '';
  const required = await input.getAttribute('required').catch(() => null) !== null;

  return {
    tag,
    type,
    name,
    id,
    placeholder,
    aria_label: ariaLabel,
    label: '',
    required,
  };
}

async function inspectForms(page) {
  const forms = await page.locator('form').all();
  const inspected = [];

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    const inputs = await form.locator('input, textarea, select').all();
    const buttons = await form.locator('button, input[type="submit"]').all().catch(() => []);

    const fields = [];
    for (const input of inputs) {
      fields.push(await readField(input));
    }

    const submitButtons = [];
    for (const button of buttons) {
      const type = await button.getAttribute('type').catch(() => '') || '';
      const text = await button.textContent().catch(() => '') || '';
      const value = await button.getAttribute('value').catch(() => '') || '';
      if (/submit|send|add|post|create|list|suggest|save|提交|发送|添加/i.test(`${type} ${text} ${value}`)) {
        submitButtons.push({ type, text: text.trim() || value });
      }
    }

    inspected.push({
      index: i,
      fields,
      submit_buttons: submitButtons,
    });
  }

  return mapFormFields(inspected);
}

export async function scout(url, opts = {}) {
  const { config } = opts;

  console.log(`\n🔍 Scouting ${url}\n`);

  return withBrowser(config, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1000);

    const result = {
      target_id: opts.targetId || opts.id || '',
      checked_at: nowIso(),
      submit_url: url,
      final_url: await readPageUrl(page),
      reachable: true,
      http_status: 200,
      submit_links: [],
      signals: {
        login_required: false,
        oauth_available: false,
        captcha: false,
        payment: false,
      },
      forms: [],
      classification: null,
    };

    // Find submit/add links
    const links = await page.locator('a').all();
    const submitLinks = [];

    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => '');
      const text = await link.textContent().catch(() => '');
      if (!href) continue;

      const isSubmit = /submit|add|list|suggest|contribute/i.test(href + ' ' + text);
      if (isSubmit) {
        submitLinks.push({
          text: text?.trim().slice(0, 60),
          href: resolveHref(href, url),
        });
      }
    }
    result.submit_links = submitLinks;

    console.log(`📋 Submit-related links found: ${submitLinks.length}`);
    for (const l of submitLinks) {
      console.log(`  → ${l.text} — ${l.href}`);
    }

    // If deep scouting, follow first submit link
    if (opts.deep && submitLinks.length > 0) {
      const target = submitLinks[0].href;
      console.log(`\n📝 Following: ${target}`);
      await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
      await delay(1000);
      result.final_url = await readPageUrl(page);

      // Enumerate form fields
      const forms = await inspectForms(page);
      result.forms = forms;
      console.log(`\n📝 Forms found: ${forms.length}`);

      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        console.log(`\n  Form ${i + 1} (${form.fields.length} fields):`);

        for (const field of form.fields) {
          const label = field.name || field.placeholder || field.aria_label || field.id || '(unnamed)';
          const mapped = field.mapped_to ? ` → ${field.mapped_to}` : '';
          console.log(`    ${field.required ? '* ' : '  '}[${field.type}] ${label}${mapped}`);
        }
      }
    } else {
      result.forms = await inspectForms(page).catch(() => []);
    }

    // Check for auth requirements
    const bodyText = await page.textContent('body');
    const hasLogin = /sign in|log in|create account|register/i.test(bodyText);
    const hasOAuth = /google|github|twitter/i.test(bodyText);
    const hasCaptcha = /captcha|verify|robot/i.test(bodyText);
    const hasPayment = /stripe|checkout|payment|pricing|buy now|\$\d+|付费|收费/i.test(bodyText);
    result.signals = {
      login_required: hasLogin,
      oauth_available: hasOAuth,
      captcha: hasCaptcha,
      payment: hasPayment,
    };
    result.classification = classifyScoutResult({
      ...result,
      body_text: bodyText,
    });

    console.log('\n🔐 Auth signals:');
    console.log(`  Login required: ${hasLogin ? '⚠️ Yes' : '✅ No'}`);
    console.log(`  OAuth available: ${hasOAuth ? '🔑 Yes' : '—'}`);
    console.log(`  CAPTCHA detected: ${hasCaptcha ? '⚠️ Yes' : '✅ No'}`);
    console.log(`  Payment detected: ${hasPayment ? '⚠️ Yes' : '✅ No'}`);
    console.log('\n🧭 Classification:');
    console.log(`  Mode: ${result.classification.mode}`);
    console.log(`  Status: ${result.classification.status}`);
    console.log(`  Reasons: ${result.classification.reasons.join(', ')}`);

    if (opts.persist || opts.output) {
      const path = opts.output || scoutResultPath(result.target_id || new URL(url).hostname, opts.scoutDir || DEFAULT_SCOUT_DIR);
      saveScoutResult(result, path);
      console.log(`\n💾 Scout result saved: ${path}`);
    }

    if (opts.updateRegistry) {
      const updated = updateRegistryWithScoutResult(result, opts);
      console.log(`\n🗂 Registry updated: ${updated.id} → ${updated.submission.mode}`);
    }

    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else if (opts.summary) console.log(formatScoutSummary(result));

    return result;
  });
}
