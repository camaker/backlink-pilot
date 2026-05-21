import { normalizeUrl } from '../targets/normalize.js';

function normalizeHref(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function cleanComparableUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  return `${normalized.domain}${normalized.path === '/' ? '/' : normalized.path}`.toLowerCase();
}

export function extractLinks(html = '', baseUrl = '') {
  const links = [];
  const anchorRe = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRe.exec(String(html || ''))) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    links.push({
      href: normalizeHref(hrefMatch[1], baseUrl),
      rel: relMatch ? relMatch[1].split(/\s+/).filter(Boolean).map(item => item.toLowerCase()) : [],
      anchor_text: text,
    });
  }

  return links;
}

export function classifyRel(rel = []) {
  const values = new Set(rel.map(item => String(item).toLowerCase()));
  if (values.has('sponsored')) return 'sponsored';
  if (values.has('ugc')) return 'ugc';
  if (values.has('nofollow')) return 'nofollow';
  return 'dofollow_candidate';
}

export function findBacklink(html, listingUrl, productUrl) {
  const target = cleanComparableUrl(productUrl);
  if (!target) return null;

  for (const link of extractLinks(html, listingUrl)) {
    const href = cleanComparableUrl(link.href);
    if (href === target) {
      return {
        ...link,
        link_type: classifyRel(link.rel),
      };
    }
  }

  return null;
}

export async function verifyBacklink(listingUrl, productUrl, opts = {}) {
  const checkedAt = new Date().toISOString();
  let response;

  try {
    response = await fetch(listingUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(opts.timeout || 15000),
      headers: {
        'user-agent': opts.userAgent || 'BacklinkPilot/2.1 backlink-verifier',
      },
    });
  } catch (error) {
    return {
      listing_url: listingUrl,
      product_url: productUrl,
      checked_at: checkedAt,
      http_status: 0,
      backlink_found: false,
      status: 'fetch_failed',
      error: error.message,
    };
  }

  const html = await response.text();
  const backlink = findBacklink(html, response.url || listingUrl, productUrl);

  return {
    listing_url: response.url || listingUrl,
    product_url: productUrl,
    checked_at: checkedAt,
    http_status: response.status,
    backlink_found: Boolean(backlink),
    status: backlink ? 'backlink_verified' : 'backlink_not_found',
    backlink: backlink || null,
  };
}
