// config.js — Load, infer, generate, and validate Backlink Pilot config

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { parse, stringify } from 'yaml';

const CONFIG_FILES = ['config.yaml', 'config.yml', 'backlink-pilot.yaml'];
const DEFAULT_CONFIG_FILE = 'config.yaml';

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  return String(value)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function pathFor(cwd, file) {
  return isAbsolute(file) ? file : resolve(cwd, file);
}

function findConfigPath(cwd, customPath) {
  if (customPath) {
    const resolved = pathFor(cwd, customPath);
    return existsSync(resolved) ? resolved : null;
  }

  for (const file of CONFIG_FILES) {
    const resolved = pathFor(cwd, file);
    if (existsSync(resolved)) return resolved;
  }

  return null;
}

function outputConfigPath(cwd, customPath) {
  return pathFor(cwd, customPath || DEFAULT_CONFIG_FILE);
}

function normalizeOptions(input = {}) {
  if (typeof input === 'string') return { configPath: input };
  return input || {};
}

export function productOptionsFromInput(input = {}) {
  const opts = normalizeOptions(input);
  const env = opts.env || process.env;

  const categories = [
    ...asArray(opts.productCategories),
    ...asArray(opts.categories),
    ...asArray(opts.category),
    ...asArray(env.BACKLINK_PRODUCT_CATEGORIES),
  ];

  const features = [
    ...asArray(opts.productFeatures),
    ...asArray(opts.features),
    ...asArray(opts.feature),
    ...asArray(env.BACKLINK_PRODUCT_FEATURES),
  ];

  return {
    name: firstValue(opts.productName, opts.name, env.BACKLINK_PRODUCT_NAME),
    url: firstValue(opts.productUrl, opts.url, env.BACKLINK_PRODUCT_URL),
    description: firstValue(
      opts.productDescription,
      opts.description,
      env.BACKLINK_PRODUCT_DESCRIPTION
    ),
    long_description: firstValue(
      opts.productLongDescription,
      opts.longDescription,
      env.BACKLINK_PRODUCT_LONG_DESCRIPTION
    ),
    email: firstValue(opts.productEmail, opts.email, env.BACKLINK_PRODUCT_EMAIL),
    pricing: firstValue(opts.productPricing, opts.pricing, env.BACKLINK_PRODUCT_PRICING),
    logo_url: firstValue(opts.productLogoUrl, opts.logoUrl, env.BACKLINK_PRODUCT_LOGO_URL),
    github_url: firstValue(opts.productGithubUrl, opts.githubUrl, env.BACKLINK_PRODUCT_GITHUB_URL),
    twitter: firstValue(opts.productTwitter, opts.twitter, env.BACKLINK_PRODUCT_TWITTER),
    categories,
    features,
  };
}

export function hasProductInput(input = {}) {
  const product = productOptionsFromInput(input);
  return Boolean(
    product.name ||
    product.url ||
    product.description ||
    product.long_description ||
    product.email ||
    product.categories.length ||
    product.features.length
  );
}

function htmlDecode(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attrValue(tag, attrName) {
  const attr = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
  return attr ? htmlDecode(attr[1]) : '';
}

function metaContent(html, matcher) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = attrValue(tag, 'name').toLowerCase();
    const property = attrValue(tag, 'property').toLowerCase();
    if (matcher(name) || matcher(property)) return attrValue(tag, 'content');
  }
  return '';
}

function pageTitle(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return '';
  return htmlDecode(match[1]).replace(/\s+[|—-]\s+.*$/, '').trim();
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function nameFromUrl(url) {
  const host = hostFromUrl(url);
  if (!host) return '';
  const base = host.split('.')[0] || host;
  return base
    .split(/[-_]/)
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function emailFromUrl(url) {
  const host = hostFromUrl(url);
  return host ? `hello@${host}` : '';
}

async function fetchProductMetadata(url) {
  if (!url) return {};

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'user-agent': 'BacklinkPilot/2.1 (+https://github.com/s87343472/backlink-pilot)',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('text/html')) return {};

    const html = await res.text();
    const title = metaContent(html, key => key === 'og:title') || pageTitle(html);
    const description = metaContent(html, key => key === 'description' || key === 'og:description');
    return { name: title, description };
  } catch {
    return {};
  }
}

function mergeDefined(base, updates) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (Array.isArray(value)) {
      if (value.length) merged[key] = value;
    } else if (value !== undefined && value !== null && String(value).trim() !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

export async function inferProduct(input = {}) {
  const explicit = productOptionsFromInput(input);
  const metadata = await fetchProductMetadata(explicit.url);

  const product = mergeDefined(metadata, explicit);
  product.name = product.name || nameFromUrl(product.url) || 'Backlink Product';
  product.description = product.description || `${product.name} official website.`;
  product.long_description = product.long_description || product.description;
  product.email = product.email || emailFromUrl(product.url) || 'hello@example.com';
  product.categories = product.categories?.length ? product.categories : ['developer-tools'];
  product.pricing = product.pricing || 'free';
  product.logo_url = product.logo_url || '';
  product.github_url = product.github_url || '';
  product.twitter = product.twitter || '';
  product.features = product.features?.length ? product.features : [];

  return product;
}

function runtimeOptions(input = {}, defaults = {}) {
  const opts = normalizeOptions(input);
  const env = opts.env || process.env;
  const engine = firstValue(opts.engine, env.BACKLINK_BROWSER_ENGINE, defaults.engine);
  const indexnowKey = firstValue(opts.key, opts.indexnowKey, env.BACKLINK_INDEXNOW_KEY, '');
  const utmEnabled = parseBool(firstValue(opts.utmEnabled, env.BACKLINK_UTM_ENABLED));

  return { engine, indexnowKey, utmEnabled };
}

export function buildConfig(product, input = {}) {
  const { engine, indexnowKey, utmEnabled } = runtimeOptions(input, { engine: 'bb' });

  return {
    product,
    credentials: {
      saashub: { email: '', password: '' },
      uneed: { email: '', password: '' },
    },
    utm: {
      enabled: utmEnabled ?? true,
      base_url: product.url,
      medium: 'directory',
      campaign: 'backlink',
    },
    indexnow: {
      key: indexnowKey,
    },
    browser: {
      engine,
      headless: true,
      slow_mo: 100,
      timeout: 30000,
      screenshot_dir: './screenshots',
    },
    bb_browser: {
      auto_update: true,
      update_interval_hours: 24,
    },
    pacing: {
      min_interval_ms: 60000,
      same_site_interval_ms: 3600000,
    },
  };
}

function mergeRuntimeConfig(config, input = {}, productUpdates = null) {
  const { engine, indexnowKey, utmEnabled } = runtimeOptions(input);
  const merged = { ...config };
  const existingProduct = merged.product || {};
  const replacingPlaceholderProduct = productUpdates && isPlaceholderProduct(existingProduct);

  if (productUpdates) {
    merged.product = mergeDefined(replacingPlaceholderProduct ? {} : existingProduct, productUpdates);
  }

  merged.browser = {
    ...(merged.browser || {}),
  };
  if (engine) merged.browser.engine = engine;

  merged.bb_browser = {
    auto_update: true,
    update_interval_hours: 24,
    ...(merged.bb_browser || {}),
  };

  merged.utm = {
    enabled: true,
    base_url: merged.product?.url,
    medium: 'directory',
    campaign: 'backlink',
    ...(merged.utm || {}),
  };

  if (utmEnabled !== undefined) merged.utm.enabled = utmEnabled;
  if (
    merged.product?.url &&
    (!merged.utm.base_url || replacingPlaceholderProduct || isPlaceholderUrl(merged.utm.base_url))
  ) {
    merged.utm.base_url = merged.product.url;
  }

  merged.indexnow = {
    ...(merged.indexnow || {}),
  };
  if (indexnowKey) merged.indexnow.key = indexnowKey;

  return merged;
}

function defaultRuntimeConfig(input = {}) {
  const { engine, indexnowKey, utmEnabled } = runtimeOptions(input, { engine: 'bb' });
  return {
    browser: {
      engine,
      headless: true,
      slow_mo: 100,
      timeout: 30000,
      screenshot_dir: './screenshots',
    },
    bb_browser: {
      auto_update: true,
      update_interval_hours: 24,
    },
    indexnow: {
      key: indexnowKey,
    },
    utm: {
      enabled: utmEnabled ?? true,
      medium: 'directory',
      campaign: 'backlink',
    },
  };
}

function isPlaceholderProduct(product = {}) {
  return product.name === 'Example Product' || product.url === 'https://example.com';
}

function isPlaceholderUrl(url) {
  return url === 'https://example.com';
}

function validateProduct(config, input = {}) {
  if (input.allowPlaceholder !== true && isPlaceholderProduct(config.product)) {
    console.error('❌ Product config is still a placeholder.');
    console.error('   Run one of these instead of editing YAML by hand:');
    console.error('   node src/cli.js init --url https://your-product.com');
    console.error('   node src/cli.js submit <site-or-url> --product-url https://your-product.com --engine bb');
    process.exit(1);
  }

  const required = ['product.name', 'product.url', 'product.description', 'product.email'];
  for (const path of required) {
    const val = path.split('.').reduce((o, k) => o?.[k], config);
    if (!val) {
      console.error(`❌ Missing required config: ${path}`);
      console.error('   Pass product details as CLI flags, for example:');
      console.error('   --product-url https://your-product.com --product-name "Your Product"');
      process.exit(1);
    }
  }
}

export function saveConfig(config, input = {}) {
  const opts = normalizeOptions(input);
  const cwd = opts.cwd || process.cwd();
  const configPath = outputConfigPath(cwd, opts.configPath || opts.config);
  writeFileSync(configPath, stringify(config), 'utf-8');
  return configPath;
}

function shouldWriteConfig(input = {}) {
  return input.write !== false && input.writeConfig !== false;
}

export async function initConfig(input = {}) {
  const opts = normalizeOptions(input);
  const cwd = opts.cwd || process.cwd();
  const existingPath = findConfigPath(cwd, opts.configPath || opts.config);
  const product = await inferProduct(opts);

  let config;
  if (existingPath && !opts.force) {
    config = parse(readFileSync(existingPath, 'utf-8')) || {};
    config = mergeRuntimeConfig(config, opts, product);
  } else {
    config = buildConfig(product, opts);
  }

  validateProduct(config, { ...opts, allowPlaceholder: false });
  const savedPath = saveConfig(config, { ...opts, configPath: opts.configPath || opts.config || existingPath || DEFAULT_CONFIG_FILE });
  return { config, path: savedPath };
}

export async function loadConfig(input = {}) {
  const opts = normalizeOptions(input);
  const cwd = opts.cwd || process.cwd();
  const requireProduct = opts.requireProduct !== false;
  const configPath = findConfigPath(cwd, opts.configPath || opts.config);
  const shouldCreate = opts.autoCreate || hasProductInput(opts);

  if (!configPath) {
    if (!requireProduct && !shouldCreate) return defaultRuntimeConfig(opts);
    if (!shouldCreate) {
      console.error('❌ No config file found.');
      console.error('   You do not need to edit YAML manually. Generate it automatically:');
      console.error('   node src/cli.js init --url https://your-product.com');
      console.error('   or pass --product-url directly on submit/awesome commands.');
      process.exit(1);
    }

    const product = await inferProduct(opts);
    const config = buildConfig(product, opts);
    validateProduct(config, opts);
    if (shouldWriteConfig(opts)) saveConfig(config, opts);
    return config;
  }

  let config = parse(readFileSync(configPath, 'utf-8')) || {};

  if (hasProductInput(opts)) {
    const product = await inferProduct(opts);
    config = mergeRuntimeConfig(config, opts, product);
    if (shouldWriteConfig(opts)) saveConfig(config, { ...opts, configPath });
  } else {
    config = mergeRuntimeConfig(config, opts);
  }

  if (requireProduct) validateProduct(config, opts);
  return config;
}

export function utmUrl(config, source) {
  const base = config.utm?.base_url || config.product.url;

  // Allow disabling UTM parameters entirely
  if (config.utm?.enabled === false) return base;

  const medium = config.utm?.medium || 'directory';
  const campaign = config.utm?.campaign || 'backlink';
  return `${base}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
}
