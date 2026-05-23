export function urlHost(value = '') {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeHost(value = '') {
  return String(value || '').toLowerCase().replace(/^www\./, '');
}

export function sameSite(left = '', right = '') {
  const a = normalizeHost(left);
  const b = normalizeHost(right);
  if (!a || !b) return true;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export function urlDomainBlocker(opts = {}) {
  const sourceHost = urlHost(opts.url || '');
  const allowedHosts = [
    normalizeHost(opts.domain || ''),
    ...(Array.isArray(opts.allowed_urls) ? opts.allowed_urls : [])
      .map(url => urlHost(url))
      .filter(Boolean),
  ].filter(Boolean);
  const code = opts.code || 'url_domain_mismatch';

  if (!sourceHost || !allowedHosts.length) return '';
  if (allowedHosts.some(host => sameSite(sourceHost, host))) return '';
  return `${code}:${sourceHost}->${allowedHosts[0] || 'unknown'}`;
}

export function authLoginDomainBlocker(row = {}) {
  const loginHost = urlHost(row.login_url || '');
  const submitHost = urlHost(row.submit_url || '');
  const targetDomain = normalizeHost(row.domain || '');
  const comparisonHost = targetDomain || submitHost;
  if (!loginHost || (!comparisonHost && !submitHost)) return '';
  const loginMatchesComparison = sameSite(loginHost, comparisonHost);
  const submitMatchesTarget = !targetDomain || !submitHost || sameSite(submitHost, targetDomain);
  const loginMatchesSubmit = targetDomain ? true : sameSite(loginHost, submitHost);
  if (!loginMatchesComparison || !submitMatchesTarget || !loginMatchesSubmit) {
    return `login_domain_mismatch:${loginHost}->${comparisonHost || submitHost || 'unknown'}`;
  }
  return '';
}
