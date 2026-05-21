import { normalizePricing } from './normalize.js';

const MANUAL_DOMAINS = new Set([
  'producthunt.com',
  'news.ycombinator.com',
  'reddit.com',
  'g2.com',
  'capterra.com',
  'trustradius.com',
  'indiehackers.com',
  'github.com',
]);

const HIGH_RISK_TYPES = new Set([
  'blog_comment',
  'comment',
  'forum',
  'bookmark',
]);

function textIncludes(value, pattern) {
  return pattern.test(String(value || '').toLowerCase());
}

export function inferTargetMode(target = {}) {
  const auto = String(target.auto || '').toLowerCase();
  const status = String(target.status || '').toLowerCase();
  const type = String(target.type || '').toLowerCase();
  const notes = `${target.notes || ''} ${target.description || ''}`;
  const domain = String(target.domain || '').replace(/^www\./, '').toLowerCase();
  const pricing = normalizePricing(target.pricing, target.price_text || target.status);

  if (status === 'dead' || textIncludes(notes, /\b404\b|dead|not found|下线|失效/)) {
    return {
      mode: 'skip',
      reason: 'dead_or_unreachable',
      pricing,
      risk: 'low',
    };
  }

  if (status === 'paid' || pricing === 'paid' || textIncludes(notes, /paid|\$|payment|pricing|付费|收费/)) {
    return {
      mode: 'skip',
      reason: 'paid_or_paywalled',
      pricing: pricing === 'unknown' ? 'paid' : pricing,
      risk: 'medium',
    };
  }

  if (MANUAL_DOMAINS.has(domain) || [...MANUAL_DOMAINS].some(manual => domain.endsWith(`.${manual}`))) {
    return {
      mode: 'manual_strategic',
      reason: 'strategic_manual_surface',
      pricing,
      risk: 'medium',
    };
  }

  if (HIGH_RISK_TYPES.has(type)) {
    return {
      mode: 'skip',
      reason: 'high_spam_risk_surface',
      pricing,
      risk: 'high',
    };
  }

  if (
    auto === 'manual' ||
    status === 'manual' ||
    textIncludes(target.submit_url, /login|sign-?in|register|oauth/) ||
    textIncludes(notes, /login|account|oauth|captcha|manual|requires|需要登录|人工/)
  ) {
    return {
      mode: 'assisted',
      reason: 'auth_or_manual_signal',
      pricing,
      risk: 'medium',
    };
  }

  if (auto === 'yes' && type !== 'github') {
    return {
      mode: 'auto_candidate',
      reason: 'static_auto_yes_needs_scout',
      pricing,
      risk: 'unknown',
    };
  }

  if (type === 'form' || target.submit_url) {
    return {
      mode: 'needs_scout',
      reason: 'unverified_form',
      pricing,
      risk: 'unknown',
    };
  }

  return {
    mode: 'needs_review',
    reason: 'insufficient_metadata',
    pricing,
    risk: 'unknown',
  };
}

export function isRunnableMode(mode) {
  return ['auto_safe', 'auto_candidate', 'assisted'].includes(String(mode || ''));
}
