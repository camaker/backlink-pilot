const URL_LIKE_FIELDS = new Set([
  'url',
  'pricing_url',
  'privacy_url',
  'terms_url',
  'logo_url',
  'logo_png_url',
  'logo_svg_url',
  'square_logo_url',
  'favicon_url',
  'demo_video_url',
]);

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function valueAt(object, path) {
  return String(path)
    .split('.')
    .reduce((current, key) => current?.[key], object);
}

function firstValue(product, paths) {
  for (const path of paths) {
    const value = valueAt(product, path);
    if (Array.isArray(value) && value.length) return value;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function publicHttpUrl(value) {
  if (!validHttpUrl(value)) return false;
  const host = new URL(String(value).trim()).hostname.toLowerCase();
  if (host === 'example.com' || host.endsWith('.example.com')) return false;
  if (/\.(example|test|invalid)$/.test(host)) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  return true;
}

function minText(value, length) {
  return String(value || '').trim().length >= length;
}

function fieldCheck(id, field, severity, message, remediation, test) {
  return { id, field, severity, message, remediation, test };
}

function fieldPaths(product, paths) {
  const value = firstValue(product, paths);
  return value;
}

const AUTOMATION_CHECKS = [
  fieldCheck(
    'product_name',
    'product.name',
    'blocker',
    'Product name is required.',
    'Set product.name to the exact public product name.',
    product => minText(product.name, 2)
  ),
  fieldCheck(
    'product_url_public',
    'product.url',
    'blocker',
    'Product URL must be a public HTTP(S) URL, not example.com or localhost.',
    'Set product.url to the live marketing page that directories should link to.',
    product => publicHttpUrl(product.url)
  ),
  fieldCheck(
    'product_email',
    'product.email',
    'blocker',
    'A valid contact email is required for directory forms.',
    'Set product.email to a monitored inbox.',
    product => validEmail(product.email)
  ),
  fieldCheck(
    'product_short_description',
    'product.description',
    'blocker',
    'Short description is too short for reliable submissions.',
    'Set product.description to a concise 20+ character value proposition.',
    product => minText(product.description, 20)
  ),
  fieldCheck(
    'product_long_description',
    'product.long_description',
    'blocker',
    'Long description is required for directories that ask for detailed copy.',
    'Set product.long_description to 80+ characters of non-duplicate product copy.',
    product => minText(product.long_description || product.description, 80)
  ),
  fieldCheck(
    'product_categories',
    'product.categories',
    'blocker',
    'At least one category is required.',
    'Set product.categories to one or more directory-ready categories.',
    product => asArray(product.categories).length > 0
  ),
  fieldCheck(
    'product_pricing',
    'product.pricing',
    'blocker',
    'Pricing label is required.',
    'Set product.pricing to free, freemium, paid, or another accurate pricing label.',
    product => present(product.pricing)
  ),
  fieldCheck(
    'pricing_page',
    'product.pricing_url',
    'blocker',
    'A pricing page URL is required before real submissions.',
    'Set product.pricing_url, product.pages.pricing, or product.urls.pricing.',
    product => publicHttpUrl(fieldPaths(product, [
      'pricing_url',
      'pricingUrl',
      'pages.pricing',
      'pages.pricing_url',
      'urls.pricing',
    ]))
  ),
  fieldCheck(
    'privacy_page',
    'product.privacy_url',
    'blocker',
    'A privacy policy URL is required before real submissions.',
    'Set product.privacy_url, product.privacy_policy_url, product.pages.privacy, or product.urls.privacy.',
    product => publicHttpUrl(fieldPaths(product, [
      'privacy_url',
      'privacy_policy_url',
      'privacyPolicyUrl',
      'pages.privacy',
      'pages.privacy_url',
      'urls.privacy',
    ]))
  ),
  fieldCheck(
    'terms_page',
    'product.terms_url',
    'blocker',
    'A terms URL is required before real submissions.',
    'Set product.terms_url, product.pages.terms, or product.urls.terms.',
    product => publicHttpUrl(fieldPaths(product, [
      'terms_url',
      'termsUrl',
      'pages.terms',
      'pages.terms_url',
      'urls.terms',
    ]))
  ),
  fieldCheck(
    'logo_asset',
    'product.logo_url',
    'blocker',
    'At least one logo URL is required.',
    'Set product.logo_url or product.assets.logo_png_url to a public image URL.',
    product => publicHttpUrl(fieldPaths(product, [
      'logo_url',
      'logoUrl',
      'logo_png_url',
      'assets.logo_url',
      'assets.logo_png_url',
    ]))
  ),
];

const LAUNCH_CHECKS = [
  fieldCheck(
    'screenshots',
    'product.screenshot_urls',
    'blocker',
    'Launch-ready submissions need at least 5 real screenshots.',
    'Set product.screenshot_urls or product.assets.screenshots to 5+ public screenshots.',
    product => asArray(fieldPaths(product, [
      'screenshot_urls',
      'screenshots',
      'assets.screenshots',
      'assets.screenshot_urls',
    ])).filter(validHttpUrl).length >= 5
  ),
  fieldCheck(
    'demo_video',
    'product.demo_video_url',
    'blocker',
    'A demo video URL is required for launch-ready directory submissions.',
    'Set product.demo_video_url to a public demo video or hosted product walkthrough.',
    product => publicHttpUrl(fieldPaths(product, [
      'demo_video_url',
      'video_url',
      'assets.demo_video_url',
      'assets.video_url',
    ]))
  ),
  fieldCheck(
    'alternative_pages',
    'product.destination_pages.alternatives',
    'blocker',
    'At least 3 competitor alternative pages should exist before launch-scale submissions.',
    'Set product.destination_pages.alternatives to 3+ public URLs.',
    product => asArray(fieldPaths(product, [
      'destination_pages.alternatives',
      'pages.alternatives',
    ])).filter(publicHttpUrl).length >= 3
  ),
  fieldCheck(
    'use_case_pages',
    'product.destination_pages.use_cases',
    'blocker',
    'At least 3 use-case or ICP pages should exist before launch-scale submissions.',
    'Set product.destination_pages.use_cases to 3+ public URLs.',
    product => asArray(fieldPaths(product, [
      'destination_pages.use_cases',
      'pages.use_cases',
    ])).filter(publicHttpUrl).length >= 3
  ),
];

const RECOMMENDED_CHECKS = [
  fieldCheck(
    'logo_svg',
    'product.logo_svg_url',
    'warning',
    'SVG logo URL is missing.',
    'Set product.logo_svg_url or product.assets.logo_svg_url.',
    product => publicHttpUrl(fieldPaths(product, ['logo_svg_url', 'assets.logo_svg_url']))
  ),
  fieldCheck(
    'square_logo',
    'product.square_logo_url',
    'warning',
    'Square 1024x1024 logo URL is missing.',
    'Set product.square_logo_url or product.assets.square_logo_url.',
    product => publicHttpUrl(fieldPaths(product, ['square_logo_url', 'assets.square_logo_url']))
  ),
  fieldCheck(
    'favicon',
    'product.favicon_url',
    'warning',
    'Favicon URL is missing.',
    'Set product.favicon_url or product.assets.favicon_url.',
    product => publicHttpUrl(fieldPaths(product, ['favicon_url', 'assets.favicon_url']))
  ),
  fieldCheck(
    'faq_schema',
    'product.schema.faq',
    'warning',
    'FAQ schema is not marked as present.',
    'Set product.schema.faq: true after FAQPage JSON-LD is live.',
    product => valueAt(product, 'schema.faq') === true
  ),
  fieldCheck(
    'product_schema',
    'product.schema.product',
    'warning',
    'Product or SoftwareApplication schema is not marked as present.',
    'Set product.schema.product: true after Product/SoftwareApplication JSON-LD is live.',
    product => valueAt(product, 'schema.product') === true || valueAt(product, 'schema.software_application') === true
  ),
];

function checksForLevel(level) {
  if (level === 'launch') return [...AUTOMATION_CHECKS, ...LAUNCH_CHECKS];
  return AUTOMATION_CHECKS;
}

function normalizeLevel(level) {
  return level === 'launch' ? 'launch' : 'automation';
}

function runCheck(product, check) {
  const ok = Boolean(check.test(product || {}));
  const entry = {
    id: check.id,
    field: check.field,
    severity: check.severity,
    message: check.message,
    remediation: check.remediation,
  };
  return { ok, entry };
}

export function validateProductReadiness(config = {}, opts = {}) {
  const level = normalizeLevel(opts.level || opts.readinessLevel || 'automation');
  const product = config.product || {};
  const blockers = [];
  const warnings = [];
  const passed = [];

  for (const check of checksForLevel(level)) {
    const result = runCheck(product, check);
    if (result.ok) passed.push(result.entry);
    else blockers.push(result.entry);
  }

  for (const check of RECOMMENDED_CHECKS) {
    const result = runCheck(product, check);
    if (result.ok) passed.push(result.entry);
    else warnings.push(result.entry);
  }

  return {
    checked_at: nowIso(),
    level,
    ok: blockers.length === 0,
    product: {
      name: product.name || '',
      url: product.url || '',
    },
    blockers,
    warnings,
    passed,
  };
}

export function formatReadinessReport(report = {}) {
  const lines = [];
  lines.push(`Readiness level: ${report.level || 'automation'}`);
  lines.push(`Product: ${report.product?.name || '(missing)'} — ${report.product?.url || '(missing)'}`);
  lines.push(`Status: ${report.ok ? 'ready' : 'blocked'}`);

  if (report.blockers?.length) {
    lines.push('');
    lines.push('Blockers:');
    for (const item of report.blockers) {
      lines.push(`- ${item.field}: ${item.message} ${item.remediation}`);
    }
  }

  if (report.warnings?.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const item of report.warnings) {
      lines.push(`- ${item.field}: ${item.message} ${item.remediation}`);
    }
  }

  lines.push('');
  lines.push(`Passed checks: ${report.passed?.length || 0}`);
  return lines.join('\n');
}

export function readinessErrorMessage(report = {}) {
  const blockers = report.blockers || [];
  const preview = blockers
    .slice(0, 8)
    .map(item => `- ${item.field}: ${item.message}`)
    .join('\n');
  const suffix = blockers.length > 8 ? `\n- ...and ${blockers.length - 8} more` : '';
  return [
    `Product readiness check failed for level "${report.level || 'automation'}".`,
    preview + suffix,
    'Run: node src/cli.js readiness --level automation',
    'If you intentionally want to override this gate for a controlled test, pass --skip-readiness-check.',
  ].join('\n');
}

export function assertProductReadiness(config = {}, opts = {}) {
  const report = validateProductReadiness(config, opts);
  if (!report.ok) {
    const error = new Error(readinessErrorMessage(report));
    error.report = report;
    throw error;
  }
  return report;
}

export function knownReadinessUrlFields() {
  return [...URL_LIKE_FIELDS];
}
