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

function scoutableHref(href) {
  if (!href) return false;
  return /^https?:/i.test(href) || href.startsWith('/') || href.startsWith('./') || href.startsWith('../');
}

function normalizedHost(value = '') {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isTrustedExternalFormHost(host = '') {
  return /(^|\.)tally\.so$|(^|\.)typeform\.com$|^forms\.gle$|^docs\.google\.com$|(^|\.)airtable\.com$|(^|\.)jotform\.com$/i
    .test(host);
}

export function canDeepScoutSubmitLink(href = '', baseUrl = '') {
  const resolved = resolveHref(href, baseUrl);
  const baseHost = normalizedHost(baseUrl);
  const hrefHost = normalizedHost(resolved);

  if (!baseHost || !hrefHost) return false;
  if (hrefHost === baseHost) return true;
  return isTrustedExternalFormHost(hrefHost);
}

export function submitLinkScore(link, baseUrl) {
  const href = link.href || '';
  const text = link.text || '';
  const combined = `${href} ${text}`.toLowerCase();
  const baseHost = normalizedHost(baseUrl);
  const hrefHost = normalizedHost(href);
  let score = 0;

  if (hrefHost && baseHost && hrefHost === baseHost) score += 100;
  else if (hrefHost) score -= 40;

  if (/\/(submit|add|suggest|contribute|promote|get-started)(\/|$|[?#-])/i.test(href)) score += 80;
  if (/submit[\s-]?(tool|ai|product|startup|site)|add[\s-]?(url|tool|site|listing)|suggest|contribute|提交|收录|投稿/i.test(text)) score += 60;
  if (/submission-select|submission-guidelines|submit\.php|submit-tool|submit-ai|add-ai|add-tool/i.test(href)) score += 40;
  if (href.replace(/\/+$/, '') === baseUrl.replace(/\/+$/, '')) score -= 10;

  if (/submitsaas|submitmatic|140\+ directories|submission service|we submit your|fast[-\s]?track|advertis|pricing|checkout|payment/i.test(combined)) score -= 120;
  if (/x\.com|twitter\.com|facebook\.com|linkedin\.com|instagram\.com/i.test(hrefHost)) score -= 120;

  return score;
}

export function isSubmitLinkCandidate(href = '', text = '', baseUrl = '') {
  if (!scoutableHref(href)) return false;

  const resolved = resolveHref(href, baseUrl);
  let parsed;
  try {
    parsed = new URL(resolved);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathAndQuery = `${parsed.pathname} ${parsed.search}`.toLowerCase();
  const label = String(text || '').toLowerCase();
  const combined = `${pathAndQuery} ${label}`;

  if (/chromewebstore\.google\.com|x\.com|twitter\.com|facebook\.com|linkedin\.com|instagram\.com/.test(host)) return false;
  if (/add to chrome|chrome extension|we submit your|140\+ directories|submitmatic/i.test(label)) return false;
  if (/\/(product|products|category|categories|blog|changelog|press-releases|social-profiles|community-platforms|resource-sharing-sites|ai-directories|hacks)(\/|$)/i.test(parsed.pathname)) {
    return /submit|add url|提交|收录|投稿/i.test(label);
  }

  return /submit|suggest|contribute|add[-\s]?(url|tool|site|listing|product)|promote|get-started|submission|提交|收录|投稿/i.test(combined);
}

export function sortSubmitLinks(links = [], baseUrl) {
  return [...links]
    .map((link, index) => ({
      ...link,
      _score: submitLinkScore(link, baseUrl),
      _index: index,
    }))
    .sort((a, b) => b._score - a._score || a._index - b._index)
    .map(({ _score, _index, ...link }) => link);
}

async function readPageUrl(page) {
  try {
    return typeof page.url === 'function' ? page.url() : '';
  } catch {
    return '';
  }
}

export async function gotoScoutPage(page, url, opts = {}) {
  const timeout = opts.timeout || 30000;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    return { ok: true, fallback: false, error: '' };
  } catch (error) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(timeout, 15000) });
      return { ok: true, fallback: true, error: error.message };
    } catch (fallbackError) {
      fallbackError.message = `${fallbackError.message}\nInitial networkidle error: ${error.message}`;
      throw fallbackError;
    }
  }
}

async function readField(input) {
  const tag = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
  const type = await input.getAttribute('type').catch(() => '') || tag;
  const name = await input.getAttribute('name').catch(() => '') || '';
  const id = await input.getAttribute('id').catch(() => '') || '';
  const placeholder = await input.getAttribute('placeholder').catch(() => '') || '';
  const ariaLabel = await input.getAttribute('aria-label').catch(() => '') || '';
  const required = await input.evaluate(el =>
    el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
  ).catch(() => false);

  return {
    tag,
    type,
    name,
    id,
    placeholder,
    aria_label: ariaLabel,
    selector: selectorForField({ tag, type, name, id, placeholder, aria_label: ariaLabel }),
    label: '',
    required,
  };
}

async function readButton(button) {
  const tag = await button.evaluate(el => el.tagName.toLowerCase()).catch(() => 'button');
  const type = await button.getAttribute('type').catch(() => '') || '';
  const name = await button.getAttribute('name').catch(() => '') || '';
  const id = await button.getAttribute('id').catch(() => '') || '';
  const text = await button.textContent().catch(() => '') || '';
  const value = await button.getAttribute('value').catch(() => '') || '';
  const selector = selectorForField({ tag, type, name, id });
  return {
    tag,
    type,
    name,
    id,
    text: text.trim() || value,
    value,
    selector,
  };
}

function cssString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function selectorForField(field = {}) {
  const tag = field.tag || 'input';
  if (field.id) return `${tag}[id="${cssString(field.id)}"]`;
  if (field.name) return `${tag}[name="${cssString(field.name)}"]`;
  if (field.placeholder) return `${tag}[placeholder="${cssString(field.placeholder)}"]`;
  if (field.aria_label) return `${tag}[aria-label="${cssString(field.aria_label)}"]`;
  if (field.type) return `${tag}[type="${cssString(field.type)}"]`;
  return tag;
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
      const inspected = await readButton(button);
      if (/submit|send|add|post|create|list|suggest|save|提交|发送|添加/i.test(`${inspected.type} ${inspected.text} ${inspected.value}`)) {
        submitButtons.push(inspected);
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
    const initialNavigation = await gotoScoutPage(page, url);
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

    if (initialNavigation.fallback) {
      result.navigation = {
        fallback: 'domcontentloaded',
        error: initialNavigation.error,
      };
    }

    // Find submit/add links
    const links = await page.locator('a').all();
    const submitLinks = [];

    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => '');
      const text = await link.textContent().catch(() => '');
      if (!href) continue;

      if (isSubmitLinkCandidate(href, text, url)) {
        submitLinks.push({
          text: text?.trim().slice(0, 60),
          href: resolveHref(href, url),
        });
      }
    }
    result.submit_links = sortSubmitLinks(submitLinks, url);

    console.log(`📋 Submit-related links found: ${submitLinks.length}`);
    for (const l of submitLinks) {
      console.log(`  → ${l.text} — ${l.href}`);
    }

    // If deep scouting, follow first submit link
    const deepLink = result.submit_links.find(link => canDeepScoutSubmitLink(link.href, url));
    if (opts.deep && deepLink) {
      const target = deepLink.href;
      console.log(`\n📝 Following: ${target}`);
      const deepNavigation = await gotoScoutPage(page, target);
      await delay(1000);
      result.final_url = await readPageUrl(page);
      if (deepNavigation.fallback) {
        result.navigation = {
          ...(result.navigation || {}),
          deep_fallback: 'domcontentloaded',
          deep_error: deepNavigation.error,
        };
      }

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
