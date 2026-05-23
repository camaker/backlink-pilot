const TRACKING_PARAM_NAMES = new Set([
  'ref',
  'ref_src',
  'referral',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'spm',
  'yclid',
  '_hsenc',
  '_hsmi',
]);

const TRACKING_PARAM_PREFIXES = [
  'utm_',
  'mtm_',
  'pk_',
];

const DEFAULT_PORTS = {
  'http:': '80',
  'https:': '443',
};

function cleanInputUrl(value) {
  const text = String(value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');

  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^\/\//.test(text)) return `https:${text}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return `https://${text}`;
  return text;
}

function looksLikeUrlOrPath(value = '') {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ||
    /^\/[^/]/.test(text) ||
    /^[a-z0-9._~!$&'()*+,;=:@/%-]+(\?|%3f)/i.test(text);
}

function decodeComponent(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || '');
  }
}

export function stripWww(hostname = '') {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

export function isTrackingParam(name) {
  const key = String(name || '').toLowerCase();
  return TRACKING_PARAM_NAMES.has(key) ||
    TRACKING_PARAM_PREFIXES.some(prefix => key.startsWith(prefix));
}

function cleanNestedQueryValue(value = '') {
  const decoded = decodeComponent(value);
  if (!looksLikeUrlOrPath(decoded)) return value;

  let parsed;
  try {
    parsed = new URL(decoded, 'https://placeholder.local');
  } catch {
    return value;
  }

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(name)) parsed.searchParams.delete(name);
  }

  const sortedParams = [...parsed.searchParams.entries()]
    .sort(([aName, aValue], [bName, bValue]) =>
      aName.localeCompare(bName) || aValue.localeCompare(bValue)
    );
  parsed.search = '';
  for (const [name, paramValue] of sortedParams) {
    parsed.searchParams.append(name, paramValue);
  }

  let cleaned = decoded.startsWith('http://') || decoded.startsWith('https://')
    ? parsed.toString()
    : `${parsed.pathname}${parsed.search}`;
  if (cleaned.length > 1) cleaned = cleaned.replace(/\/+(?=\?|$)/, '');
  return cleaned;
}

export function cleanTrackingUrl(value) {
  const normalized = normalizeUrl(value);
  return normalized?.url || String(value || '');
}

export function normalizeUrl(value, opts = {}) {
  const input = cleanInputUrl(value);
  if (!input) return null;

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null;

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';

  if (DEFAULT_PORTS[parsed.protocol] === parsed.port) {
    parsed.port = '';
  }

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(name)) parsed.searchParams.delete(name);
  }

  const sortedParams = [...parsed.searchParams.entries()]
    .sort(([aName, aValue], [bName, bValue]) =>
      aName.localeCompare(bName) || aValue.localeCompare(bValue)
    );
  parsed.search = '';
  for (const [name, paramValue] of sortedParams) {
    parsed.searchParams.append(name, cleanNestedQueryValue(paramValue));
  }

  let pathname = parsed.pathname || '/';
  pathname = pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  parsed.pathname = pathname || '/';

  const normalized = parsed.toString();
  const url = normalized.endsWith('/') && parsed.pathname !== '/'
    ? normalized.slice(0, -1)
    : normalized;

  const domain = stripWww(parsed.hostname);
  const dedupePath = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
  const query = parsed.search ? parsed.search : '';
  const dedupeKey = `${domain}${dedupePath}${query}`.toLowerCase();

  return {
    url,
    domain,
    hostname: parsed.hostname,
    rootUrl: `${parsed.protocol}//${parsed.host}/`,
    protocol: parsed.protocol.replace(':', ''),
    path: parsed.pathname,
    query: parsed.search,
    dedupeKey: opts.domainOnly ? domain : dedupeKey,
  };
}

export function normalizePricing(value, fallback = '') {
  const raw = String(value || fallback || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) return 'unknown';
  if (/free|免费|0\s*\$|^\$?0\b/.test(lower)) return 'free';
  if (/paid|pay|pricing|price|\$|usd|subscription|付费|收费/.test(lower)) return 'paid';
  if (/freemium/.test(lower)) return 'freemium';
  return 'unknown';
}

export function slugify(value, fallback = 'target') {
  const base = String(value || fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return base || fallback;
}
