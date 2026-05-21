import { extractLinks } from './backlink.js';
import { normalizeUrl, slugify, stripWww } from '../targets/normalize.js';

const DEFAULT_MIN_CONFIDENCE = 0.75;
const SOURCE_PRIORITY = {
  explicit_listing_url: 4,
  page_link: 3,
  final_url: 2,
  text_url: 1,
  unknown: 0,
};
const BAD_PATH_RE = /(?:^|\/)(?:submit|add|new|create|edit|login|signin|sign-in|signup|sign-up|register|checkout|payment|pricing|contact|thank-you|thankyou|thanks|success|confirmation|dashboard|account|admin|settings)(?:\/|$)/i;
const LISTING_PATH_RE = /(?:^|\/)(?:listing|listings|product|products|tool|tools|app|apps|startup|startups|software|profile|project|projects|item|sites?|directory|p)(?:\/|$)/i;
const LISTING_ANCHOR_RE = /view|open|see|visit|live|listing|profile|product page|tool page|published/i;
const TRAILING_PUNCTUATION_RE = /[),.;!?]+$/;

function asUrl(value, baseUrl = '') {
  if (!value) return null;
  try {
    return new URL(String(value).trim(), baseUrl || undefined);
  } catch {
    return null;
  }
}

function normalizedKey(value) {
  return normalizeUrl(value)?.dedupeKey || '';
}

function sameNormalizedUrl(a, b) {
  const left = normalizedKey(a);
  const right = normalizedKey(b);
  return Boolean(left && right && left === right);
}

function hostRoot(value) {
  const url = asUrl(value);
  if (!url) return '';
  const parts = stripWww(url.hostname).split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : parts.join('.');
}

function sameRootHost(a, b) {
  const left = hostRoot(a);
  const right = hostRoot(b);
  return Boolean(left && right && left === right);
}

function pathSegments(url) {
  return url.pathname.split('/').filter(Boolean);
}

function meaningfulProductTokens(product = {}) {
  const values = [
    product.name,
    product.url ? asUrl(product.url)?.hostname.split('.')[0] : '',
  ];

  return [...new Set(values
    .flatMap(value => slugify(value || '', '').split('-'))
    .map(token => token.trim())
    .filter(token => token.length >= 3))];
}

function productMatch(url, product = {}) {
  const path = `${url.pathname} ${url.search}`.toLowerCase();
  const nameSlug = slugify(product.name || '', '');
  if (nameSlug && path.includes(nameSlug)) return true;

  const tokens = meaningfulProductTokens(product);
  if (!tokens.length) return false;
  return tokens.every(token => path.includes(token));
}

function hasLikelyId(url) {
  return pathSegments(url).some(segment =>
    /[a-z]/i.test(segment) && /\d/.test(segment) ||
    /^[a-f0-9]{8,}$/i.test(segment) ||
    /^[a-z0-9-]{12,}$/i.test(segment)
  );
}

function sourceBaseConfidence(source) {
  if (source === 'explicit_listing_url') return 0.9;
  if (source === 'final_url') return 0.62;
  if (source === 'page_link') return 0.5;
  if (source === 'text_url') return 0.42;
  return 0.4;
}

function cleanTextUrl(value) {
  return String(value || '').trim().replace(TRAILING_PUNCTUATION_RE, '');
}

export function extractTextUrls(text = '') {
  return [...String(text || '').matchAll(/https?:\/\/[^\s"'<>]+/gi)]
    .map(match => cleanTextUrl(match[0]))
    .filter(Boolean);
}

export function scoreListingCandidate(input = {}, context = {}) {
  const url = asUrl(input.url, input.baseUrl || context.submitUrl || context.target?.submit_url || '');
  if (!url || !['http:', 'https:'].includes(url.protocol)) return null;

  const candidateUrl = url.toString();
  const submitUrl = context.submitUrl || context.target?.submit_url || context.registryTarget?.submit_url || '';
  const productUrl = context.product?.url || '';
  const source = input.source || 'unknown';
  const reasons = [];

  if (productUrl && sameNormalizedUrl(candidateUrl, productUrl)) {
    return null;
  }
  if (submitUrl && sameNormalizedUrl(candidateUrl, submitUrl)) {
    return null;
  }
  if (BAD_PATH_RE.test(url.pathname)) {
    return null;
  }
  if (submitUrl && !sameRootHost(candidateUrl, submitUrl)) {
    return null;
  }
  if (url.pathname === '/' && !url.search) {
    return null;
  }

  let confidence = sourceBaseConfidence(source);
  const depth = pathSegments(url).length;
  const text = input.anchorText || input.text || '';
  const matchesProduct = productMatch(url, context.product);
  const listingPath = LISTING_PATH_RE.test(url.pathname);
  const listingAnchor = LISTING_ANCHOR_RE.test(text);

  if (source === 'explicit_listing_url') reasons.push('explicit_listing_url');
  if (source === 'final_url') reasons.push('post_submit_final_url');
  if (source === 'page_link') reasons.push('confirmation_page_link');
  if (source === 'text_url') reasons.push('url_mentioned_in_confirmation_text');

  if (matchesProduct) {
    confidence += 0.25;
    reasons.push('product_slug_match');
  }
  if (listingPath) {
    confidence += 0.16;
    reasons.push('listing_path_signal');
  }
  if (listingAnchor) {
    confidence += 0.2;
    reasons.push('listing_anchor_signal');
  }
  if (submitUrl && sameRootHost(candidateUrl, submitUrl)) {
    confidence += 0.08;
    reasons.push('same_directory_host');
  }
  if (depth >= 2 || hasLikelyId(url)) {
    confidence += 0.08;
    reasons.push('specific_path');
  }

  if (!matchesProduct && depth < 2 && !hasLikelyId(url)) {
    confidence = Math.min(confidence, 0.55);
    reasons.push('generic_directory_path_cap');
  }

  confidence = Math.min(0.99, Number(confidence.toFixed(2)));
  return {
    url: candidateUrl,
    confidence,
    source,
    anchor_text: text,
    reasons,
  };
}

function pushCandidate(candidates, input, context) {
  const candidate = scoreListingCandidate(input, context);
  if (candidate) candidates.push(candidate);
}

function betterCandidate(candidate, existing) {
  if (!existing) return true;
  if (candidate.confidence !== existing.confidence) return candidate.confidence > existing.confidence;
  return (SOURCE_PRIORITY[candidate.source] || 0) > (SOURCE_PRIORITY[existing.source] || 0);
}

function rawSubmission(submission = {}) {
  return submission.raw || submission.adapter_result || {};
}

function normalizeContext(context = {}) {
  return {
    ...context,
    submitUrl: context.submitUrl || context.target?.submit_url || context.registryTarget?.submit_url || '',
    product: context.product || {},
  };
}

function collectRawLinks(raw = {}, baseUrl = '') {
  const links = [];
  for (const link of raw.links || []) {
    const href = link.href || link.url;
    if (!href) continue;
    links.push({
      href,
      anchor_text: link.anchor_text || link.text || '',
    });
  }
  if (raw.html) {
    links.push(...extractLinks(raw.html, baseUrl));
  }
  return links;
}

export function extractListingCandidates(submission = {}, context = {}, opts = {}) {
  const normalizedContext = normalizeContext(context);
  const raw = rawSubmission(submission);
  const candidates = [];
  const baseUrl = raw.url || submission.url || normalizedContext.submitUrl;

  pushCandidate(candidates, {
    url: submission.listing_url || raw.listing_url,
    source: 'explicit_listing_url',
  }, normalizedContext);

  pushCandidate(candidates, {
    url: raw.url || submission.url,
    source: 'final_url',
  }, normalizedContext);

  for (const link of collectRawLinks(raw, baseUrl)) {
    pushCandidate(candidates, {
      url: link.href,
      baseUrl,
      source: 'page_link',
      anchorText: link.anchor_text,
    }, normalizedContext);
  }

  const bodyText = `${submission.body_text || ''}\n${raw.body_text || ''}`;
  for (const url of extractTextUrls(bodyText)) {
    pushCandidate(candidates, {
      url,
      source: 'text_url',
    }, normalizedContext);
  }

  const byKey = new Map();
  for (const candidate of candidates) {
    const key = normalizedKey(candidate.url);
    if (!key) continue;
    const existing = byKey.get(key);
    if (betterCandidate(candidate, existing)) {
      byKey.set(key, candidate);
    }
  }

  const sorted = [...byKey.values()]
    .sort((a, b) => b.confidence - a.confidence || a.url.localeCompare(b.url));
  const minConfidence = Number(opts.minConfidence || DEFAULT_MIN_CONFIDENCE);
  const best = sorted.find(candidate => candidate.confidence >= minConfidence) || null;

  return {
    best,
    candidates: sorted,
    min_confidence: minConfidence,
  };
}
