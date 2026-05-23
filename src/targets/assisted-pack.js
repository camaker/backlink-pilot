import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from './registry.js';
import { cleanTrackingUrl, normalizeUrl } from './normalize.js';
import { sameSite, urlDomainBlocker, urlHost } from './auth-login-safety.js';
import { parseCsv } from './importers/csv.js';

const ASSISTED_PACK_HEADERS = [
  'rank',
  'priority',
  'priority_score',
  'target_id',
  'name',
  'domain',
  'mode',
  'status',
  'pricing',
  'risk',
  'lang',
  'manual_bucket',
  'automation_after_human',
  'submission_policy',
  'safety_blockers',
  'recommended_next_step',
  'auth_profile',
  'auth_login_command',
  'auth_scout_command',
  'submit_url',
  'final_url',
  'root_url',
  'last_scouted_at',
  'last_submitted_at',
  'form_count',
  'field_count',
  'required_fields',
  'unmapped_required_fields',
  'submit_button_count',
  'source',
  'reason',
  'notes',
];

const CROSS_DOMAIN_SUGGESTION_HEADERS = [
  'target_id',
  'name',
  'domain',
  'submit_url',
  'final_url',
  'submit_host',
  'final_host',
  'classification',
  'confidence',
  'recommended_decision',
  'allowed_host_candidate',
  'automation_policy',
  'reason',
  'next_step',
];

const CROSS_DOMAIN_DECISION_HEADERS = [
  'target_id',
  'name',
  'domain',
  'submit_url',
  'final_url',
  'final_host',
  'classification',
  'confidence',
  'suggested_decision',
  'review_decision',
  'allowed_host',
  'replacement_submit_url',
  'evidence_url',
  'reviewer',
  'reviewed_at',
  'review_notes',
  'automation_policy',
];

const CROSS_DOMAIN_REVIEW_DECISIONS = new Set([
  'skip',
  'rescout_target_domain',
  'allow_external_host_after_review',
  'replace_submit_url',
  'keep_blocked',
]);

const CROSS_DOMAIN_ALLOWLIST_ELIGIBLE_CLASSIFICATIONS = new Set([
  'possible_form_provider_alias',
  'possible_parent_brand_submit_domain',
]);

const CROSS_DOMAIN_WRITE_ALLOWED_DECISIONS = new Set([
  'skip',
  'rescout_target_domain',
  'keep_blocked',
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function splitItems(value, fallback = []) {
  if (Array.isArray(value)) return value.flatMap(item => splitItems(item));
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.split(',').map(item => item.trim()).filter(Boolean);
}

function numericValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function incrementCount(counts, key) {
  const normalized = String(key || 'unknown');
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function loadProductIdentity(configPath) {
  if (!configPath) return {};
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = raw.trim().startsWith('{') ? JSON.parse(raw) : parse(raw);
    return parsed?.product || {};
  } catch {
    return {};
  }
}

function safeProfileName(target = {}) {
  return String(target.id || target.domain || 'target')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'target';
}

function allFields(target = {}) {
  return asArray(target.forms).flatMap(form => asArray(form.fields));
}

function allSubmitButtons(target = {}) {
  return asArray(target.forms).flatMap(form => asArray(form.submit_buttons));
}

function requiredFieldStats(target = {}) {
  const fields = allFields(target);
  const required = fields.filter(field => Boolean(field?.required));
  const unmapped = required.filter(field => !String(field?.mapped_to || '').trim());
  return {
    field_count: fields.length,
    required_fields: required.length,
    unmapped_required_fields: unmapped.length,
    submit_button_count: allSubmitButtons(target).length,
  };
}

function reasonText(target = {}) {
  return String(target.submission?.reason || target.reason || '').trim();
}

function statusText(target = {}) {
  return String(target.submission?.status || target.status || '').trim();
}

function hasReason(target, pattern) {
  return pattern.test(`${reasonText(target)} ${statusText(target)} ${target.notes || ''}`);
}

function hasAuthSignal(target = {}) {
  return /login|sign-?in|register|oauth|account|needs account|requires account|需要登录/i.test([
    target.submit_url,
    target.technical?.final_url,
    target.notes,
    reasonText(target),
    statusText(target),
  ].join(' '));
}

function finalUrlDomainBlocker(target = {}) {
  return urlDomainBlocker({
    url: target.technical?.final_url || '',
    domain: target.domain || '',
    allowed_urls: [target.submit_url || ''],
    code: 'final_url_domain_mismatch',
  });
}

function hasManualSurfaceSignal(target = {}) {
  const type = String(target.type || '').toLowerCase();
  const auto = String(target.auto || target.original_auto || '').toLowerCase();
  return auto === 'manual' ||
    ['article', 'community', 'forum', 'profile', 'discussion'].includes(type) ||
    /manual|community|article|discussion|forum|post/i.test(`${reasonText(target)} ${target.notes || ''}`);
}

function targetBlockers(target = {}) {
  const blockers = [];
  const technical = target.technical || {};
  const submission = target.submission || {};
  const stats = requiredFieldStats(target);
  const mode = submission.mode || '';
  const status = statusText(target);
  const pricing = target.pricing || 'unknown';
  const risk = target.quality?.risk || 'unknown';

  if (submission.last_submitted_at) blockers.push('already_submitted_verify_before_resubmission');
  if (finalUrlDomainBlocker(target)) blockers.push('final_url_domain_mismatch');
  if (mode === 'needs_review') blockers.push('manual_review_required_before_any_execution');
  if (risk === 'high') blockers.push('high_risk_target');
  if (pricing === 'paid') blockers.push('paid_or_paywalled');
  if (pricing === 'unknown') blockers.push('pricing_unknown_verify_free_path');
  if (technical.auth === 'required' || technical.auth === 'oauth' || status === 'auth_required' || hasAuthSignal(target)) {
    blockers.push('auth_or_oauth_required');
  }
  if (hasManualSurfaceSignal(target)) blockers.push('manual_surface_review_required');
  if (technical.captcha === 'required' || status === 'captcha_required' || hasReason(target, /captcha|recaptcha|turnstile/i)) {
    blockers.push('captcha_or_turnstile_required');
  }
  if (status === 'reciprocal_required' || hasReason(target, /reciprocal|return[_ -]?link|backlink_required/i)) {
    blockers.push('reciprocal_link_required');
  }
  if (status === 'file_upload_required' || hasReason(target, /file_upload|required_file|upload/i)) {
    blockers.push('asset_upload_required');
  }
  if (status === 'access_blocked' || hasReason(target, /access_blocked|http_?(401|403|429)|rate[_ -]?limited/i)) {
    blockers.push('access_blocked_or_rate_limited');
  }
  if (['browser_error', 'scout_failed'].includes(status) || hasReason(target, /browser_error|scout_failed|network/i)) {
    blockers.push('scout_or_browser_failure');
  }
  if (status === 'unsupported_form' || hasReason(target, /unsupported_form|dynamic_form/i)) {
    blockers.push('unsupported_or_dynamic_form');
  }
  if (status === 'no_form_detected' || hasReason(target, /no_form_detected/)) {
    blockers.push('no_submit_form_detected');
  }
  if (asArray(target.forms).length === 0) blockers.push('no_persisted_form_evidence');
  if (stats.submit_button_count === 0 && asArray(target.forms).length > 0) blockers.push('submit_button_missing');
  if (stats.unmapped_required_fields > 0) blockers.push('required_fields_unmapped');

  return [...new Set(blockers)];
}

function manualBucket(blockers = [], target = {}) {
  const mode = target.submission?.mode || '';
  if (blockers.includes('already_submitted_verify_before_resubmission')) return 'already_submitted_verify_only';
  if (blockers.includes('final_url_domain_mismatch')) return 'fix_cross_domain_final_url';
  if (blockers.includes('paid_or_paywalled')) return 'paid_path_or_pricing_review';
  if (blockers.includes('high_risk_target')) return 'high_risk_manual_review';
  if (blockers.includes('captcha_or_turnstile_required')) return 'manual_submit_only_captcha';
  if (blockers.includes('reciprocal_link_required')) return 'reciprocal_policy_review';
  if (blockers.includes('auth_or_oauth_required')) return 'manual_login_then_rescout';
  if (mode === 'needs_review') return 'manual_review_first';
  if (blockers.includes('manual_surface_review_required')) return 'manual_surface_review';
  if (
    blockers.includes('required_fields_unmapped') ||
    blockers.includes('unsupported_or_dynamic_form') ||
    blockers.includes('submit_button_missing')
  ) {
    return 'form_mapping_or_dynamic_form_review';
  }
  if (blockers.includes('scout_or_browser_failure') || blockers.includes('no_submit_form_detected')) {
    return 'browser_manual_verification';
  }
  return 'assisted_manual_confirmation';
}

function automationAfterHuman(blockers = [], target = {}) {
  if (target.submission?.last_submitted_at) return 'no_verify_existing_submission_first';
  if (blockers.includes('final_url_domain_mismatch')) return 'no_fix_cross_domain_final_url_first';
  if (target.submission?.mode === 'needs_review') return 'no_manual_review_required_first';
  if (blockers.includes('paid_or_paywalled')) return 'no_paid_or_paywalled';
  if (blockers.includes('high_risk_target')) return 'no_high_risk';
  if (blockers.includes('captcha_or_turnstile_required')) return 'no_captcha_manual_only';
  if (blockers.includes('reciprocal_link_required')) return 'no_reciprocal_policy_required';
  if (blockers.includes('auth_or_oauth_required')) return 'rescout_after_saved_login_profile';
  if (blockers.includes('manual_surface_review_required')) return 'no_manual_surface_review_required_first';
  if (blockers.includes('required_fields_unmapped')) return 'no_unmapped_required_fields';
  if (blockers.includes('unsupported_or_dynamic_form')) return 'no_dynamic_form_manual_only';
  return 'manual_confirmation_then_dry_run_only';
}

function recommendedNextStep(blockers = [], target = {}) {
  const profile = safeProfileName(target);
  if (blockers.includes('already_submitted_verify_before_resubmission')) {
    return 'Verify whether a live listing/backlink exists; do not resubmit unless explicitly approved.';
  }
  if (blockers.includes('final_url_domain_mismatch')) {
    return 'Fix the target URL/scout evidence first: final_url resolves outside the target or submit domain, so login and rescout commands are intentionally suppressed.';
  }
  if (blockers.includes('paid_or_paywalled')) {
    return 'Confirm a free submission path exists; skip sponsored-only or paid-only listings.';
  }
  if (blockers.includes('high_risk_target')) {
    return 'Escalate for senior/manual review before any submission attempt.';
  }
  if (blockers.includes('captcha_or_turnstile_required')) {
    return 'Submit manually in a normal browser if worthwhile; do not automate CAPTCHA or Turnstile.';
  }
  if (blockers.includes('reciprocal_link_required')) {
    return 'Decide whether a reciprocal link is acceptable; do not auto-submit reciprocal-link forms.';
  }
  if (blockers.includes('auth_or_oauth_required')) {
    return `Create/login manually, save auth profile "${profile}", then re-scout with that profile before any execution.`;
  }
  if (blockers.includes('manual_surface_review_required')) {
    return 'Review platform/community rules and confirm this is a valid product submission surface; do not automate posts, articles, or community submissions.';
  }
  if (target.submission?.mode === 'needs_review') {
    return 'Open manually or collect fresh scout evidence; only promote after visible free submit path and blockers are clear.';
  }
  if (blockers.includes('required_fields_unmapped') || blockers.includes('submit_button_missing')) {
    return 'Inspect the form and add explicit field mappings/selectors before any assisted dry-run.';
  }
  if (blockers.includes('scout_or_browser_failure') || blockers.includes('no_submit_form_detected')) {
    return 'Retry in a normal browser; do not reject or submit based only on weak scout failure.';
  }
  return 'Manually confirm target fit and run only a dry-run first; real execution still requires readiness and target audit.';
}

function scoreTarget(target = {}, blockers = []) {
  let score = target.submission?.mode === 'assisted' ? 200 : 100;
  if (target.pricing === 'free') score += 40;
  else if (target.pricing === 'unknown') score += 15;
  else if (target.pricing === 'paid') score -= 120;

  if (target.quality?.risk === 'low') score += 30;
  else if (target.quality?.risk === 'unknown') score += 10;
  else if (target.quality?.risk === 'high') score -= 120;

  if (target.technical?.last_scouted_at) score += 20;
  if (asArray(target.forms).length > 0) score += 20;
  if (requiredFieldStats(target).unmapped_required_fields === 0) score += 15;
  if (target.lang === 'en' || target.lang === 'zh') score += 5;

  if (blockers.includes('auth_or_oauth_required')) score += 10;
  if (blockers.includes('manual_surface_review_required')) score -= 35;
  if (blockers.includes('captcha_or_turnstile_required')) score -= 60;
  if (blockers.includes('reciprocal_link_required')) score -= 45;
  if (blockers.includes('required_fields_unmapped')) score -= 25;
  if (blockers.includes('unsupported_or_dynamic_form')) score -= 25;
  if (blockers.includes('scout_or_browser_failure')) score -= 30;
  if (blockers.includes('no_persisted_form_evidence')) score -= 20;
  if (blockers.includes('already_submitted_verify_before_resubmission')) score -= 200;
  if (blockers.includes('final_url_domain_mismatch')) score -= 200;
  return score;
}

function priorityFromScore(score, target = {}, blockers = []) {
  if (target.submission?.last_submitted_at || blockers.includes('paid_or_paywalled') || blockers.includes('high_risk_target')) {
    return 'P3';
  }
  if (score >= 235 && target.submission?.mode === 'assisted' && !blockers.includes('captcha_or_turnstile_required')) return 'P0';
  if (score >= 180) return 'P1';
  if (score >= 120) return 'P2';
  return 'P3';
}

function commandQuote(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function targetRow(target, context = {}) {
  const blockers = targetBlockers(target);
  const score = scoreTarget(target, blockers);
  const requiresAuth = blockers.includes('auth_or_oauth_required') && !blockers.includes('final_url_domain_mismatch');
  const profile = requiresAuth ? safeProfileName(target) : '';
  const loginUrl = cleanUrl(target.technical?.final_url || target.submit_url || target.root_url || '');
  const scoutUrl = cleanUrl(target.submit_url || target.technical?.final_url || target.root_url || '');
  const stats = requiredFieldStats(target);
  const registryArg = ` --registry ${commandQuote(context.registry || DEFAULT_REGISTRY_FILE)}`;

  return {
    priority: priorityFromScore(score, target, blockers),
    priority_score: String(score),
    target_id: target.id || '',
    name: target.name || '',
    domain: target.domain || '',
    mode: target.submission?.mode || '',
    status: statusText(target),
    pricing: target.pricing || 'unknown',
    risk: target.quality?.risk || 'unknown',
    lang: target.lang || 'unknown',
    manual_bucket: manualBucket(blockers, target),
    automation_after_human: automationAfterHuman(blockers, target),
    submission_policy: 'no_real_submission_from_pack; human_review_and_scout_required_before_execution',
    safety_blockers: blockers.join('; '),
    recommended_next_step: recommendedNextStep(blockers, target),
    auth_profile: profile,
    auth_login_command: requiresAuth
      ? `node src/cli.js auth login --profile ${commandQuote(profile)} --url ${commandQuote(loginUrl)}`
      : '',
    auth_scout_command: requiresAuth
      ? `node src/cli.js scout ${commandQuote(scoutUrl)} --auth-profile ${commandQuote(profile)} --target-id ${commandQuote(target.id || '')}${registryArg} --persist --scout-dir "resources/scout-results" --update-registry --engine playwright`
      : '',
    submit_url: cleanUrl(target.submit_url || ''),
    final_url: cleanUrl(target.technical?.final_url || ''),
    root_url: cleanUrl(target.root_url || ''),
    last_scouted_at: target.technical?.last_scouted_at || '',
    last_submitted_at: target.submission?.last_submitted_at || '',
    form_count: String(asArray(target.forms).length),
    field_count: String(stats.field_count),
    required_fields: String(stats.required_fields),
    unmapped_required_fields: String(stats.unmapped_required_fields),
    submit_button_count: String(stats.submit_button_count),
    source: asArray(target.source).join('; '),
    reason: reasonText(target),
    notes: target.notes || '',
  };
}

function rowSort(a, b) {
  return Number(b.priority_score) - Number(a.priority_score) ||
    String(a.priority).localeCompare(String(b.priority)) ||
    String(a.domain).localeCompare(String(b.domain)) ||
    String(a.target_id).localeCompare(String(b.target_id));
}

function exclusionReason(target = {}, opts = {}) {
  if (!opts.includeSubmitted && target.submission?.last_submitted_at) return 'already_submitted';
  if (!opts.includePaid && target.pricing === 'paid') return 'paid_excluded_by_default';
  if (!opts.includeHighRisk && target.quality?.risk === 'high') return 'high_risk_excluded_by_default';
  return '';
}

function summarizeRows(rows, excluded, contextStatus) {
  const summary = {
    generated_at: nowIso(),
    policy: 'manual_assisted_pack_only_no_registry_changes_no_real_submissions',
    total_rows: rows.length,
    excluded_rows: excluded.length,
    product_context_present: contextStatus.some(item => item.exists),
    product_context_paths: contextStatus,
    by_priority: {},
    by_mode: {},
    by_status: {},
    by_manual_bucket: {},
    by_automation_after_human: {},
    by_exclusion_reason: {},
  };

  for (const row of rows) {
    incrementCount(summary.by_priority, row.priority);
    incrementCount(summary.by_mode, row.mode);
    incrementCount(summary.by_status, row.status);
    incrementCount(summary.by_manual_bucket, row.manual_bucket);
    incrementCount(summary.by_automation_after_human, row.automation_after_human);
  }
  for (const row of excluded) {
    incrementCount(summary.by_exclusion_reason, row.exclusion_reason);
  }
  return summary;
}

function productContextStatus(opts = {}) {
  const paths = splitItems(opts.productContextPaths, [
    '.agents/product-marketing.md',
    '.claude/product-marketing.md',
    'product-marketing-context.md',
  ]);
  return paths.map(path => ({
    path,
    exists: false,
  }));
}

function hydrateProductContextStatus(statusRows) {
  return statusRows.map(row => {
    try {
      readFileSync(row.path, 'utf-8');
      return { ...row, exists: true };
    } catch {
      return row;
    }
  });
}

export function buildAssistedSubmissionPack(opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const modes = new Set(splitItems(opts.modes, ['assisted', 'needs_review']));
  const offset = numericValue(opts.offset, 0);
  const limit = Math.max(1, numericValue(opts.limit, 100));
  const context = {
    registry: registryPath,
    productConfig: opts.productConfig || '',
  };

  const candidateTargets = registry.targets
    .filter(target => modes.has(target.submission?.mode || ''));

  const excluded = [];
  const rows = [];
  for (const target of candidateTargets) {
    const reason = exclusionReason(target, opts);
    if (reason) {
      excluded.push({
        target_id: target.id || '',
        name: target.name || '',
        domain: target.domain || '',
        submit_url: target.submit_url || '',
        mode: target.submission?.mode || '',
        status: statusText(target),
        pricing: target.pricing || 'unknown',
        risk: target.quality?.risk || 'unknown',
        exclusion_reason: reason,
      });
      continue;
    }
    rows.push(targetRow(target, context));
  }

  rows.sort(rowSort);
  rows.forEach((row, index) => {
    row.rank = String(index + 1);
  });

  const nextRows = rows.slice(offset, offset + limit);
  const contextStatus = hydrateProductContextStatus(productContextStatus(opts));
  const summary = summarizeRows(rows, excluded, contextStatus);

  return {
    generated_at: summary.generated_at,
    registry: registryPath,
    product_config: opts.productConfig || '',
    product: loadProductIdentity(opts.productConfig),
    constraints: {
      modes: [...modes],
      offset,
      limit,
      include_paid: Boolean(opts.includePaid),
      include_high_risk: Boolean(opts.includeHighRisk),
      include_submitted: Boolean(opts.includeSubmitted),
    },
    rows,
    next_rows: nextRows,
    excluded,
    summary: {
      ...summary,
      next_rows: nextRows.length,
      offset,
      limit,
    },
  };
}

export function assistedSubmissionPackCsv(rows = []) {
  return [
    ASSISTED_PACK_HEADERS.join(','),
    ...rows.map(row => ASSISTED_PACK_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function crossDomainSuggestion(row = {}) {
  const submitHost = urlHost(row.submit_url || '');
  const finalHost = urlHost(row.final_url || '');
  const finalUrl = String(row.final_url || '').toLowerCase();
  const targetId = String(row.target_id || '');
  const domain = String(row.domain || '').toLowerCase();
  let suggestion = {
    classification: 'unknown_cross_domain',
    confidence: 'low',
    recommended_decision: 'manual_review_before_any_execution',
    allowed_host_candidate: '',
    automation_policy: 'no_execution_from_suggestion',
    reason: 'Final URL host differs from target and submit hosts without a known safe relationship.',
    next_step: 'Manually verify the target owner, current submit path, pricing, auth, and form behavior before changing registry evidence.',
  };

  if (finalHost === 'bubble.io' && finalUrl.includes('/domain_not_supported')) {
    suggestion = {
      classification: 'platform_custom_domain_error',
      confidence: 'high',
      recommended_decision: 'skip_until_directory_domain_recovers',
      allowed_host_candidate: '',
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The target appears to resolve to Bubble domain_not_supported, which is not a valid directory submission form.',
      next_step: 'Verify the directory root manually; if it still shows a platform domain error, mark the target skipped or replace it with a working submit URL.',
    };
  } else if (finalHost === 'afternic.com') {
    suggestion = {
      classification: 'domain_for_sale_or_parked',
      confidence: 'high',
      recommended_decision: 'skip_or_replace_source',
      allowed_host_candidate: '',
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The final URL is a domain-sale or parking page, not a directory submission surface.',
      next_step: 'Mark the target skipped unless a current owned directory URL can be independently verified.',
    };
  } else if (finalHost === 'banggood.com') {
    suggestion = {
      classification: 'affiliate_or_unrelated_redirect',
      confidence: 'high',
      recommended_decision: 'skip_or_replace_source',
      allowed_host_candidate: '',
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The final URL is an unrelated commerce or affiliate destination.',
      next_step: 'Do not submit; mark skipped unless the directory has a verified current submit surface.',
    };
  } else if (targetId === 'aigc' && finalHost === 'ainavpro.com') {
    suggestion = {
      classification: 'stale_scout_evidence_from_other_directory',
      confidence: 'high',
      recommended_decision: 'manual_rescout_target_domain_first',
      allowed_host_candidate: '',
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The final URL belongs to a different directory already represented separately.',
      next_step: 'Manually inspect the intended aigc.cn submit path and update or skip the target before it can enter login or rescout workflows.',
    };
  } else if (finalHost === 'free-alan.com') {
    suggestion = {
      classification: 'unrelated_external_submit_endpoint',
      confidence: 'medium',
      recommended_decision: 'manual_rescout_target_domain_first',
      allowed_host_candidate: '',
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The final URL is a different site submit endpoint, not an obvious owned alias of the target domain.',
      next_step: 'Verify whether the target was misidentified; otherwise update the target to the actual directory or mark the current row skipped.',
    };
  } else if (submitHost === 'jinshuju.net' && finalHost === 'jsj.top') {
    suggestion = {
      classification: 'possible_form_provider_alias',
      confidence: 'medium',
      recommended_decision: 'manual_verify_then_allowlist_if_owner_confirmed',
      allowed_host_candidate: finalHost,
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The submit URL and final URL look like a possible form-provider alias pair, but ownership and target fit are not proven by host matching alone.',
      next_step: 'Open the form manually, confirm it belongs to the intended directory, then add an explicit allowed final host only after review.',
    };
  } else if (domain.endsWith('therundown.ai') && finalHost === 'rundown.ai') {
    suggestion = {
      classification: 'possible_parent_brand_submit_domain',
      confidence: 'medium',
      recommended_decision: 'manual_verify_then_allowlist_if_owner_confirmed',
      allowed_host_candidate: finalHost,
      automation_policy: 'no_execution_from_suggestion',
      reason: 'The final URL appears to be on a parent or brand domain, but cross-host ownership still requires explicit review.',
      next_step: 'Confirm the parent-domain form is the official submit surface for the target directory before allowing this host.',
    };
  }

  return {
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    submit_url: row.submit_url || '',
    final_url: row.final_url || '',
    submit_host: submitHost,
    final_host: finalHost,
    ...suggestion,
  };
}

export function crossDomainFinalUrlSuggestions(rows = []) {
  return rows
    .filter(row => row.manual_bucket === 'fix_cross_domain_final_url')
    .map(row => crossDomainSuggestion(row));
}

export function crossDomainFinalUrlSuggestionsCsv(rows = []) {
  const suggestions = crossDomainFinalUrlSuggestions(rows);
  return [
    CROSS_DOMAIN_SUGGESTION_HEADERS.join(','),
    ...suggestions.map(row => CROSS_DOMAIN_SUGGESTION_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function decisionFromSuggestion(row = {}) {
  if (['skip_until_directory_domain_recovers', 'skip_or_replace_source'].includes(row.recommended_decision)) {
    return 'skip';
  }
  if (row.recommended_decision === 'manual_rescout_target_domain_first') return 'rescout_target_domain';
  if (row.recommended_decision === 'manual_verify_then_allowlist_if_owner_confirmed') {
    return 'allow_external_host_after_review';
  }
  return 'keep_blocked';
}

export function crossDomainFinalUrlDecisionRows(rows = []) {
  return crossDomainFinalUrlSuggestions(rows).map(row => ({
    target_id: row.target_id || '',
    name: row.name || '',
    domain: row.domain || '',
    submit_url: row.submit_url || '',
    final_url: row.final_url || '',
    final_host: row.final_host || '',
    classification: row.classification || '',
    confidence: row.confidence || '',
    suggested_decision: decisionFromSuggestion(row),
    review_decision: '',
    allowed_host: row.allowed_host_candidate || '',
    replacement_submit_url: '',
    evidence_url: '',
    reviewer: '',
    reviewed_at: '',
    review_notes: '',
    automation_policy: 'no_execution_from_decision_file',
  }));
}

export function crossDomainFinalUrlDecisionsCsv(rows = []) {
  const decisions = crossDomainFinalUrlDecisionRows(rows);
  return [
    CROSS_DOMAIN_DECISION_HEADERS.join(','),
    ...decisions.map(row => CROSS_DOMAIN_DECISION_HEADERS.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
}

function isHttpUrl(value = '') {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hostFromHostOrUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return urlHost(text) || text.toLowerCase().replace(/^www\./, '');
}

function addDecisionFinding(list, severity, code, row, line, message) {
  list.push({
    severity,
    code,
    line,
    target_id: row.target_id || '',
    domain: row.domain || '',
    final_host: row.final_host || '',
    review_decision: row.review_decision || '',
    message,
  });
}

function validateCrossDomainDecisionRow(row = {}, line, opts = {}) {
  const blockers = [];
  const warnings = [];
  const decision = String(row.review_decision || '').trim();
  const classification = String(row.classification || '').trim();
  const finalHost = hostFromHostOrUrl(row.final_host || row.final_url || '');
  const allowedHost = hostFromHostOrUrl(row.allowed_host || '');
  const notes = String(row.review_notes || '').trim();
  const reviewer = String(row.reviewer || '').trim();
  const evidenceUrl = String(row.evidence_url || '').trim();
  const replacementSubmitUrl = String(row.replacement_submit_url || '').trim();
  const automationPolicy = String(row.automation_policy || '').trim();

  for (const field of ['target_id', 'domain', 'submit_url', 'final_url', 'classification', 'automation_policy']) {
    if (!String(row[field] || '').trim()) {
      addDecisionFinding(blockers, 'blocker', `missing_${field}`, row, line, `Missing required field: ${field}.`);
    }
  }
  if (automationPolicy && automationPolicy !== 'no_execution_from_decision_file') {
    addDecisionFinding(
      blockers,
      'blocker',
      'automation_policy_must_not_execute',
      row,
      line,
      'automation_policy must remain no_execution_from_decision_file.'
    );
  }
  if (row.submit_url && !isHttpUrl(row.submit_url)) {
    addDecisionFinding(blockers, 'blocker', 'submit_url_invalid', row, line, 'submit_url must be an http(s) URL.');
  }
  if (row.final_url && !isHttpUrl(row.final_url)) {
    addDecisionFinding(blockers, 'blocker', 'final_url_invalid', row, line, 'final_url must be an http(s) URL.');
  }

  if (!decision) {
    const severity = opts.allowUnreviewed ? 'warning' : 'blocker';
    addDecisionFinding(
      severity === 'blocker' ? blockers : warnings,
      severity,
      'review_decision_missing',
      row,
      line,
      'review_decision must be filled before this row can affect registry data.'
    );
    return { blockers, warnings };
  }

  if (!CROSS_DOMAIN_REVIEW_DECISIONS.has(decision)) {
    addDecisionFinding(blockers, 'blocker', 'review_decision_unknown', row, line, `Unknown review_decision: ${decision}.`);
  }

  if (opts.requireReviewer !== false && !reviewer) {
    addDecisionFinding(blockers, 'blocker', 'reviewer_missing', row, line, 'reviewer is required for reviewed rows.');
  }
  if (opts.requireReviewNotes !== false && notes.length < 20) {
    addDecisionFinding(blockers, 'blocker', 'review_notes_too_short', row, line, 'review_notes must document the human evidence and rationale.');
  }

  if (decision === 'allow_external_host_after_review') {
    if (!CROSS_DOMAIN_ALLOWLIST_ELIGIBLE_CLASSIFICATIONS.has(classification)) {
      addDecisionFinding(
        blockers,
        'blocker',
        'allowlist_classification_not_eligible',
        row,
        line,
        `Classification ${classification || 'unknown'} is not eligible for external-host allowlisting.`
      );
    }
    if (!allowedHost) {
      addDecisionFinding(blockers, 'blocker', 'allowed_host_missing', row, line, 'allowed_host is required for allowlist decisions.');
    } else if (finalHost && allowedHost !== finalHost) {
      addDecisionFinding(
        blockers,
        'blocker',
        'allowed_host_must_match_final_host',
        row,
        line,
        `allowed_host must match final_host (${finalHost}) for this controlled decision file.`
      );
    }
    if (!isHttpUrl(evidenceUrl)) {
      addDecisionFinding(
        blockers,
        'blocker',
        'allowlist_evidence_url_required',
        row,
        line,
        'allow_external_host_after_review requires an http(s) evidence_url.'
      );
    }
  }

  if (decision === 'replace_submit_url') {
    if (!isHttpUrl(replacementSubmitUrl)) {
      addDecisionFinding(blockers, 'blocker', 'replacement_submit_url_required', row, line, 'replace_submit_url requires an http(s) replacement_submit_url.');
    }
    if (!isHttpUrl(evidenceUrl)) {
      addDecisionFinding(blockers, 'blocker', 'replacement_evidence_url_required', row, line, 'replace_submit_url requires an http(s) evidence_url.');
    }
  }

  if (['skip', 'rescout_target_domain', 'keep_blocked'].includes(decision) && allowedHost) {
    addDecisionFinding(warnings, 'warning', 'allowed_host_ignored_for_decision', row, line, 'allowed_host is ignored unless review_decision is allow_external_host_after_review.');
  }

  return { blockers, warnings };
}

export function validateCrossDomainFinalUrlDecisions(filePath, opts = {}) {
  const rows = parseCsv(readFileSync(filePath, 'utf-8'));
  const blockers = [];
  const warnings = [];
  const byDecision = {};

  rows.forEach((row, index) => {
    const decision = String(row.review_decision || '').trim() || 'unreviewed';
    incrementCount(byDecision, decision);
    const result = validateCrossDomainDecisionRow(row, index + 2, opts);
    blockers.push(...result.blockers);
    warnings.push(...result.warnings);
  });

  return {
    file: normalizePath(filePath),
    ok: blockers.length === 0,
    rows: rows.length,
    blockers,
    warnings,
    blockers_count: blockers.length,
    warnings_count: warnings.length,
    by_decision: byDecision,
    constraints: {
      read_only: true,
      no_registry_writes: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      allowed_review_decisions: [...CROSS_DOMAIN_REVIEW_DECISIONS],
    },
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function compactTargetSummary(target = {}) {
  return {
    id: target.id || '',
    name: target.name || '',
    domain: target.domain || '',
    root_url: target.root_url || '',
    submit_url: target.submit_url || '',
    normalized_key: target.normalized_key || '',
    technical: {
      final_url: target.technical?.final_url || '',
      allowed_final_hosts: Array.isArray(target.technical?.allowed_final_hosts)
        ? target.technical.allowed_final_hosts
        : [],
    },
    submission: {
      mode: target.submission?.mode || '',
      status: target.submission?.status || '',
      reason: target.submission?.reason || '',
      last_submitted_at: target.submission?.last_submitted_at || '',
    },
    quality: {
      risk: target.quality?.risk || '',
    },
    source_meta: {
      cross_domain_final_url_decision: target.source_meta?.cross_domain_final_url_decision || null,
    },
  };
}

function setNestedValue(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function getNestedValue(target, path) {
  return path.split('.').reduce((cursor, part) => cursor?.[part], target);
}

function proposeChange(changes, target, path, value) {
  const from = getNestedValue(target, path);
  if (JSON.stringify(from ?? '') === JSON.stringify(value ?? '')) return;
  changes[path] = { from: from ?? '', to: value ?? '' };
  setNestedValue(target, path, value);
}

function decisionMetadata(row = {}) {
  return {
    review_decision: row.review_decision || '',
    suggested_decision: row.suggested_decision || '',
    classification: row.classification || '',
    confidence: row.confidence || '',
    original_submit_url: row.submit_url || '',
    final_url: row.final_url || '',
    final_host: row.final_host || '',
    allowed_host: row.allowed_host || '',
    replacement_submit_url: row.replacement_submit_url || '',
    evidence_url: row.evidence_url || '',
    reviewer: row.reviewer || '',
    reviewed_at: row.reviewed_at || '',
    review_notes: row.review_notes || '',
    automation_policy: 'no_execution_from_decision_file',
  };
}

function normalizeComparableUrl(value = '') {
  return cleanTrackingUrl(value).replace(/\/+$/, '');
}

function addPatchBlocker(list, code, row, line, message, extra = {}) {
  list.push({
    severity: 'blocker',
    code,
    line,
    target_id: row.target_id || '',
    domain: row.domain || '',
    review_decision: row.review_decision || '',
    message,
    ...extra,
  });
}

function assertDecisionTargetIdentity(row = {}, target = null, line, blockers) {
  if (!target) {
    addPatchBlocker(blockers, 'target_not_found', row, line, 'Decision row target_id was not found in the registry.');
    return false;
  }

  const rowDomain = String(row.domain || '').toLowerCase();
  const targetDomain = String(target.domain || '').toLowerCase();
  if (rowDomain && targetDomain && rowDomain !== targetDomain) {
    addPatchBlocker(blockers, 'target_domain_mismatch', row, line, 'Decision row domain no longer matches the registry target.', {
      registry_domain: target.domain || '',
    });
  }

  const rowSubmitUrl = normalizeComparableUrl(row.submit_url || '');
  const targetSubmitUrl = normalizeComparableUrl(target.submit_url || '');
  if (rowSubmitUrl && targetSubmitUrl && rowSubmitUrl !== targetSubmitUrl) {
    addPatchBlocker(blockers, 'target_submit_url_mismatch', row, line, 'Decision row submit_url no longer matches the registry target.', {
      registry_submit_url: target.submit_url || '',
    });
  }

  const rowFinalUrl = normalizeComparableUrl(row.final_url || '');
  const targetFinalUrl = normalizeComparableUrl(target.technical?.final_url || '');
  if (rowFinalUrl && targetFinalUrl && rowFinalUrl !== targetFinalUrl) {
    addPatchBlocker(blockers, 'target_final_url_mismatch', row, line, 'Decision row final_url no longer matches persisted scout evidence.', {
      registry_final_url: target.technical?.final_url || '',
    });
  }

  if (target.submission?.last_submitted_at) {
    addPatchBlocker(blockers, 'target_already_submitted', row, line, 'Already-submitted targets require backlink verification, not cross-domain decision patching.', {
      last_submitted_at: target.submission.last_submitted_at,
    });
  }

  return blockers.length === 0;
}

function applyReviewedBlockedState(changes, nextTarget, row, reason, status = 'cross_domain_reviewed_blocked') {
  proposeChange(changes, nextTarget, 'submission.mode', 'needs_review');
  proposeChange(changes, nextTarget, 'submission.status', status);
  proposeChange(changes, nextTarget, 'submission.reason', reason);
  proposeChange(changes, nextTarget, 'source_meta.cross_domain_final_url_decision', decisionMetadata(row));
}

function proposalFromDecisionRow(row = {}, target = {}, line, blockers) {
  const decision = String(row.review_decision || '').trim();
  const nextTarget = cloneJson(target);
  const changes = {};
  let action = 'keep_blocked';

  if (decision === 'skip') {
    action = 'mark_skip';
    proposeChange(changes, nextTarget, 'submission.mode', 'skip');
    proposeChange(changes, nextTarget, 'submission.status', 'skipped');
    proposeChange(changes, nextTarget, 'submission.reason', 'cross_domain_final_url_review_skip');
    proposeChange(changes, nextTarget, 'source_meta.cross_domain_final_url_decision', decisionMetadata(row));
  } else if (decision === 'rescout_target_domain') {
    action = 'keep_blocked_for_target_domain_rescout';
    applyReviewedBlockedState(changes, nextTarget, row, 'cross_domain_final_url_rescout_target_domain_required', 'needs_rescout');
  } else if (decision === 'keep_blocked') {
    action = 'keep_blocked_after_review';
    applyReviewedBlockedState(changes, nextTarget, row, 'cross_domain_final_url_review_keep_blocked');
  } else if (decision === 'allow_external_host_after_review') {
    action = 'record_allowed_final_host_but_keep_blocked';
    const allowedHost = hostFromHostOrUrl(row.allowed_host || '');
    const allowedHosts = new Set([
      ...(Array.isArray(nextTarget.technical?.allowed_final_hosts) ? nextTarget.technical.allowed_final_hosts : []),
      allowedHost,
    ].filter(Boolean));
    applyReviewedBlockedState(changes, nextTarget, row, 'cross_domain_allowed_final_host_requires_rescout', 'external_host_reviewed');
    proposeChange(changes, nextTarget, 'technical.allowed_final_hosts', [...allowedHosts].sort());
  } else if (decision === 'replace_submit_url') {
    action = 'replace_submit_url_but_keep_blocked';
    const replacement = normalizeUrl(row.replacement_submit_url || '');
    const targetDomain = String(target.domain || row.domain || '').toLowerCase();
    if (!replacement) {
      addPatchBlocker(blockers, 'replacement_submit_url_invalid', row, line, 'replacement_submit_url could not be normalized.');
      return null;
    }
    if (targetDomain && !sameSite(replacement.domain, targetDomain)) {
      addPatchBlocker(blockers, 'replacement_submit_url_domain_mismatch', row, line, 'replacement_submit_url must stay on the reviewed target domain for this dry-run patch.', {
        replacement_domain: replacement.domain,
      });
      return null;
    }
    applyReviewedBlockedState(changes, nextTarget, row, 'cross_domain_submit_url_replaced_requires_rescout', 'submit_url_replaced_needs_rescout');
    proposeChange(changes, nextTarget, 'submit_url', replacement.url);
    proposeChange(changes, nextTarget, 'domain', replacement.domain);
    proposeChange(changes, nextTarget, 'root_url', replacement.rootUrl);
    proposeChange(changes, nextTarget, 'normalized_key', replacement.dedupeKey);
  }

  if (['auto_safe', 'auto_candidate', 'assisted'].includes(nextTarget.submission?.mode || '')) {
    addPatchBlocker(blockers, 'patch_would_leave_target_runnable', row, line, 'Decision patch must not leave the target in a runnable mode.');
    return null;
  }

  return {
    line,
    target_id: target.id || row.target_id || '',
    name: target.name || row.name || '',
    decision,
    action,
    dry_run_only: true,
    changes,
    before: compactTargetSummary(target),
    after: compactTargetSummary(nextTarget),
    required_after_any_future_write: [
      'run target registry audit',
      'manual rescout before runnable promotion',
      'do not execute from this decision file',
    ],
  };
}

export function buildCrossDomainFinalUrlDecisionPatch(registryPath, decisionFilePath, opts = {}) {
  const validation = validateCrossDomainFinalUrlDecisions(decisionFilePath, {
    requireReviewer: opts.requireReviewer !== false,
    requireReviewNotes: opts.requireReviewNotes !== false,
  });
  const rows = parseCsv(readFileSync(decisionFilePath, 'utf-8'));
  const registry = loadRegistry(registryPath || DEFAULT_REGISTRY_FILE);
  const targetsById = new Map((registry.targets || []).map(target => [target.id, target]));
  const blockers = [];
  const proposals = [];
  const skipped = [];

  if (!validation.ok) {
    return {
      generated_at: nowIso(),
      ok: false,
      status: 'blocked_decision_validation',
      registry: normalizePath(registryPath || DEFAULT_REGISTRY_FILE),
      decision_file: normalizePath(decisionFilePath),
      dry_run: true,
      wrote_registry: false,
      patch_policy: 'dry_run_only_no_registry_writes_no_mode_promotion_no_submission',
      constraints: {
        no_registry_writes: true,
        no_network: true,
        no_login: true,
        no_submission: true,
        no_auto_safe_promotion: true,
      },
      validation,
      rows: rows.length,
      proposals_count: 0,
      skipped_rows: 0,
      blockers_count: validation.blockers_count,
      blockers: validation.blockers,
      proposals: [],
      skipped: [],
    };
  }

  rows.forEach((row, index) => {
    const line = index + 2;
    const target = targetsById.get(row.target_id);
    const rowBlockers = [];
    assertDecisionTargetIdentity(row, target, line, rowBlockers);
    if (rowBlockers.length) {
      blockers.push(...rowBlockers);
      return;
    }

    const proposal = proposalFromDecisionRow(row, target, line, rowBlockers);
    if (rowBlockers.length) {
      blockers.push(...rowBlockers);
      return;
    }
    if (!proposal || !Object.keys(proposal.changes || {}).length) {
      skipped.push({
        line,
        target_id: row.target_id || '',
        reason: 'no_registry_changes_proposed',
      });
      return;
    }
    proposals.push(proposal);
  });

  const ok = blockers.length === 0;
  return {
    generated_at: nowIso(),
    ok,
    status: ok ? 'dry_run_patch_ready' : 'blocked_registry_patch_preview',
    registry: normalizePath(registryPath || DEFAULT_REGISTRY_FILE),
    decision_file: normalizePath(decisionFilePath),
    dry_run: true,
    wrote_registry: false,
    patch_policy: 'dry_run_only_no_registry_writes_no_mode_promotion_no_submission',
    constraints: {
      no_registry_writes: true,
      no_network: true,
      no_login: true,
      no_submission: true,
      no_auto_safe_promotion: true,
    },
    validation,
    rows: rows.length,
    proposals_count: ok ? proposals.length : 0,
    skipped_rows: skipped.length,
    blockers_count: blockers.length,
    blockers,
    proposals: ok ? proposals : [],
    skipped,
  };
}

function writeGateBlockers(proposals = []) {
  const blockers = [];
  for (const proposal of proposals) {
    if (!CROSS_DOMAIN_WRITE_ALLOWED_DECISIONS.has(proposal.decision)) {
      blockers.push({
        severity: 'blocker',
        code: 'write_decision_preview_only',
        line: proposal.line,
        target_id: proposal.target_id,
        domain: proposal.before?.domain || '',
        review_decision: proposal.decision,
        message: 'This review_decision is preview-only and cannot be written by the controlled registry write gate.',
      });
    }
    if (['auto_safe', 'auto_candidate', 'assisted'].includes(proposal.after?.submission?.mode || '')) {
      blockers.push({
        severity: 'blocker',
        code: 'write_would_leave_target_runnable',
        line: proposal.line,
        target_id: proposal.target_id,
        domain: proposal.before?.domain || '',
        review_decision: proposal.decision,
        message: 'Controlled registry writes must not leave changed targets in runnable modes.',
      });
    }
  }
  return blockers;
}

function applyProposalChangesToTargets(targets = [], proposals = []) {
  const proposalById = new Map(proposals.map(proposal => [proposal.target_id, proposal]));
  let applied = 0;
  const nextTargets = targets.map(target => {
    const proposal = proposalById.get(target.id);
    if (!proposal) return target;
    const nextTarget = cloneJson(target);
    for (const [path, change] of Object.entries(proposal.changes || {})) {
      setNestedValue(nextTarget, path, change.to);
    }
    applied++;
    return nextTarget;
  });
  return { targets: nextTargets, applied };
}

export function applyCrossDomainFinalUrlDecisionPatch(registryPath, decisionFilePath, opts = {}) {
  const writeRegistry = Boolean(opts.writeRegistry);
  const preview = buildCrossDomainFinalUrlDecisionPatch(registryPath, decisionFilePath, opts);
  if (!writeRegistry) return preview;

  if (!preview.ok) {
    return {
      ...preview,
      status: preview.status === 'blocked_decision_validation'
        ? 'blocked_decision_validation'
        : 'blocked_registry_patch_preview',
      write_requested: true,
      dry_run: false,
      wrote_registry: false,
    };
  }

  const writeBlockers = writeGateBlockers(preview.proposals);
  if (writeBlockers.length) {
    return {
      ...preview,
      ok: false,
      status: 'blocked_write_gate',
      write_requested: true,
      dry_run: false,
      wrote_registry: false,
      blockers: writeBlockers,
      blockers_count: writeBlockers.length,
      proposals_count: 0,
      proposals: [],
      write_policy: 'only_skip_rescout_target_domain_keep_blocked_can_write_no_runnable_promotion',
    };
  }

  const registry = loadRegistry(registryPath || DEFAULT_REGISTRY_FILE);
  const updated = applyProposalChangesToTargets(registry.targets || [], preview.proposals);
  const saved = saveRegistry({
    ...registry,
    targets: updated.targets,
  }, registryPath || DEFAULT_REGISTRY_FILE);

  return {
    ...preview,
    ok: true,
    status: 'registry_written_requires_audit_and_rescout',
    write_requested: true,
    dry_run: false,
    wrote_registry: true,
    written_targets: updated.applied,
    registry_total: saved.targets.length,
    write_policy: 'only_skip_rescout_target_domain_keep_blocked_can_write_no_runnable_promotion',
    required_next_steps: [
      'run target registry audit',
      'manual rescout before any runnable promotion',
      'do not execute from this decision file',
    ],
  };
}

export function writeCrossDomainFinalUrlDecisionPatchReport(report, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return normalizePath(filePath);
}

function markdownEscape(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function countsTable(counts) {
  const entries = Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) return '| none | 0 |';
  return entries.map(([key, value]) => `| ${markdownEscape(key)} | ${value} |`).join('\n');
}

function topRowsTable(rows) {
  if (!rows.length) return '| - | - | - | - | - | - |';
  return rows.slice(0, 30).map(row => [
    row.rank,
    row.priority,
    row.domain,
    row.manual_bucket,
    row.automation_after_human,
    row.submit_url,
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

function crossDomainSuggestionsTable(rows = []) {
  const suggestions = crossDomainFinalUrlSuggestions(rows);
  if (!suggestions.length) return '| - | - | - | - | - | - |';
  return suggestions.map(row => [
    row.target_id,
    row.domain,
    row.final_host,
    row.classification,
    row.confidence,
    row.recommended_decision,
  ].map(markdownEscape).join(' | ')).map(line => `| ${line} |`).join('\n');
}

function crossDomainSuggestionsMarkdown(pack, files = {}) {
  const suggestions = crossDomainFinalUrlSuggestions(pack.rows);
  return [
    '# Cross-Domain Final URL Review Suggestions',
    '',
    `Generated: ${pack.generated_at}`,
    '',
    'Policy: this file is read-only guidance for human review. It does not approve targets, does not allowlist external hosts, does not log in, and does not authorize real submissions.',
    '',
    `Rows: ${suggestions.length}`,
    '',
    '| Target ID | Domain | Final Host | Classification | Confidence | Recommended Decision |',
    '|---|---|---|---|---|---|',
    crossDomainSuggestionsTable(pack.rows),
    '',
    '## Required Manual Checks',
    '',
    '1. Confirm the directory still exists and is a genuine fit for the product.',
    '2. Confirm the final URL belongs to the same directory owner or an intentionally used form provider.',
    '3. Confirm there is no CAPTCHA, OAuth, paywall, file upload, reciprocal-link requirement, or dynamic ambiguity before any automation promotion.',
    '4. Add an explicit allowed host only after human review; never infer it from host similarity alone.',
    '5. Skip parked domains, platform error pages, affiliate redirects, and unrelated submit endpoints.',
    '',
    '## Files',
    '',
    `- Source review queue: ${files.cross_domain_final_url_csv || 'cross-domain-final-url-review.csv'}`,
    `- Suggestions CSV: ${files.cross_domain_final_url_suggestions_csv || 'cross-domain-final-url-suggestions.csv'}`,
    '',
  ].join('\n');
}

function crossDomainDecisionsMarkdown(pack, files = {}) {
  return [
    '# Cross-Domain Final URL Decisions',
    '',
    `Generated: ${pack.generated_at}`,
    '',
    'Policy: this is an editable human decision template. It does not approve automation by itself, does not write the registry, and does not authorize real submissions.',
    '',
    '## Allowed Review Decisions',
    '',
    '- `skip`: mark the target as not worth pursuing unless a replacement source is found.',
    '- `rescout_target_domain`: keep blocked and manually re-check the target-domain submit URL first.',
    '- `allow_external_host_after_review`: only for verified form-provider aliases or parent-brand submit domains.',
    '- `replace_submit_url`: replace the submit URL after independently verifying a current official submit surface.',
    '- `keep_blocked`: intentionally leave the row blocked without further action.',
    '',
    '## Hard Validation Rules',
    '',
    '1. `review_decision`, `reviewer`, and substantive `review_notes` are required for reviewed rows.',
    '2. `allow_external_host_after_review` requires an eligible classification, matching `allowed_host`, and an `evidence_url`.',
    '3. Parked domains, platform errors, unrelated redirects, stale scout evidence, and affiliate redirects are not eligible for allowlisting.',
    '4. `replace_submit_url` requires `replacement_submit_url` and `evidence_url`.',
    '5. `automation_policy` must remain `no_execution_from_decision_file`.',
    '6. This decision file is still not an execution plan; it only gates future registry edits.',
    '',
    '## Validation Command',
    '',
    '```powershell',
    `node src/cli.js targets validate-cross-domain-final-url-decisions ${files.cross_domain_final_url_decisions_csv || 'cross-domain-final-url-decisions.csv'} --fail-on-blockers`,
    '```',
    '',
    '## Dry-Run Patch Preview',
    '',
    'Only after validation passes, generate a registry patch preview. This command still does not write the registry and does not authorize submission:',
    '',
    '```powershell',
    `node src/cli.js targets apply-cross-domain-final-url-decisions ${files.cross_domain_final_url_decisions_csv || 'cross-domain-final-url-decisions.csv'} --registry resources/targets.canonical.yaml --output backlink-url/assisted-submission-pack/cross-domain-final-url-patch-preview.json`,
    '```',
    '',
    '## Controlled Registry Write',
    '',
    'Only `skip`, `rescout_target_domain`, and `keep_blocked` can be written by the controlled gate. `allow_external_host_after_review` and `replace_submit_url` remain preview-only until separate evidence and rescout steps pass.',
    '',
    '```powershell',
    `node src/cli.js targets apply-cross-domain-final-url-decisions ${files.cross_domain_final_url_decisions_csv || 'cross-domain-final-url-decisions.csv'} --registry resources/targets.canonical.yaml --write-registry --output backlink-url/assisted-submission-pack/cross-domain-final-url-write-report.json`,
    '```',
    '',
    '## Files',
    '',
    `- Suggestions: ${files.cross_domain_final_url_suggestions_md || 'cross-domain-final-url-suggestions.md'}`,
    `- Decision CSV: ${files.cross_domain_final_url_decisions_csv || 'cross-domain-final-url-decisions.csv'}`,
    '',
  ].join('\n');
}

function assistedPackMarkdown(pack, files = {}) {
  return [
    '# Assisted Submission Pack',
    '',
    `Generated: ${pack.generated_at}`,
    '',
    '## Scope',
    '',
    `- Registry: ${pack.registry}`,
    `- Product config: ${pack.product_config || 'not provided'}`,
    `- Product: ${pack.product?.name || 'unknown'}`,
    `- Product URL: ${pack.product?.url || 'unknown'}`,
    `- Modes: ${pack.constraints.modes.join(', ')}`,
    `- Total included rows: ${pack.summary.total_rows}`,
    `- Next slice rows: ${pack.summary.next_rows}`,
    `- Excluded rows: ${pack.summary.excluded_rows}`,
    '',
    'Policy: this pack is manual/assisted preparation only. It does not approve targets, does not change the registry, and does not authorize real submissions.',
    '',
    '## By Priority',
    '',
    '| Priority | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_priority),
    '',
    '## By Manual Bucket',
    '',
    '| Bucket | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_manual_bucket),
    '',
    '## By Automation After Human',
    '',
    '| Status | Count |',
    '|---|---:|',
    countsTable(pack.summary.by_automation_after_human),
    '',
    '## Top Next Rows',
    '',
    '| Rank | Priority | Domain | Manual Bucket | Automation After Human | Submit URL |',
    '|---:|---|---|---|---|---|',
    topRowsTable(pack.next_rows),
    '',
    '## Human-In-The-Loop Rules',
    '',
    '1. Do not run real submissions from this pack alone.',
    '2. Login/OAuth targets require a manually saved auth profile and a fresh authenticated scout pass.',
    '3. CAPTCHA, Turnstile, Cloudflare, payment, reciprocal-link, and file-upload targets remain manual-only unless separately reviewed.',
    '4. A target may become `auto_safe` only after scout evidence proves reachability, no auth/CAPTCHA/payment blocker, complete required field mapping, and a submit button.',
    '5. Previously submitted targets must be verified for live listing/backlink before any resubmission.',
    '',
    '## Files',
    '',
    `- Full CSV: ${files.full_csv || 'assisted-submission-pack.csv'}`,
    `- Next CSV: ${files.next_csv || `next-${pack.summary.limit}-assisted-submission-pack.csv`}`,
    `- Auth login/rescout queue: ${files.auth_login_rescout_csv || 'auth-login-rescout-queue.csv'}`,
    `- Manual surface review queue: ${files.manual_surface_review_csv || 'manual-surface-review.csv'}`,
    `- Manual review-first queue: ${files.manual_review_first_csv || 'manual-review-first.csv'}`,
    `- Cross-domain final URL review queue: ${files.cross_domain_final_url_csv || 'cross-domain-final-url-review.csv'}`,
    `- Cross-domain final URL suggestions: ${files.cross_domain_final_url_suggestions_md || 'cross-domain-final-url-suggestions.md'}`,
    `- Cross-domain final URL decisions: ${files.cross_domain_final_url_decisions_md || 'cross-domain-final-url-decisions.md'}`,
    `- Summary JSON: ${files.summary_json || 'assisted-submission-summary.json'}`,
    '',
    '## Safe Next Commands',
    '',
    'Use the per-row `auth_login_command` first for auth/OAuth rows. After manual login, run the per-row `auth_scout_command` and review the registry diff before any execution.',
    '',
  ].join('\n');
}

export function writeAssistedSubmissionPack(pack, opts = {}) {
  const outputDir = opts.outputDir || 'backlink-url/assisted-submission-pack';
  mkdirSync(outputDir, { recursive: true });
  const files = {
    full_csv: join(outputDir, 'assisted-submission-pack.csv'),
    next_csv: join(outputDir, `next-${pack.summary.limit}-assisted-submission-pack.csv`),
    summary_json: join(outputDir, 'assisted-submission-summary.json'),
    summary_md: join(outputDir, 'assisted-submission-summary.md'),
    auth_login_rescout_csv: join(outputDir, 'auth-login-rescout-queue.csv'),
    manual_surface_review_csv: join(outputDir, 'manual-surface-review.csv'),
    manual_review_first_csv: join(outputDir, 'manual-review-first.csv'),
    cross_domain_final_url_csv: join(outputDir, 'cross-domain-final-url-review.csv'),
    cross_domain_final_url_suggestions_csv: join(outputDir, 'cross-domain-final-url-suggestions.csv'),
    cross_domain_final_url_suggestions_md: join(outputDir, 'cross-domain-final-url-suggestions.md'),
    cross_domain_final_url_decisions_csv: join(outputDir, 'cross-domain-final-url-decisions.csv'),
    cross_domain_final_url_decisions_md: join(outputDir, 'cross-domain-final-url-decisions.md'),
  };
  const publicFiles = Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, normalizePath(value)])
  );

  ensureParent(files.full_csv);
  writeFileSync(files.full_csv, assistedSubmissionPackCsv(pack.rows), 'utf-8');
  writeFileSync(files.next_csv, assistedSubmissionPackCsv(pack.next_rows), 'utf-8');
  writeFileSync(
    files.auth_login_rescout_csv,
    assistedSubmissionPackCsv(pack.rows.filter(row => row.automation_after_human === 'rescout_after_saved_login_profile')),
    'utf-8'
  );
  writeFileSync(
    files.manual_surface_review_csv,
    assistedSubmissionPackCsv(pack.rows.filter(row => row.manual_bucket === 'manual_surface_review')),
    'utf-8'
  );
  writeFileSync(
    files.manual_review_first_csv,
    assistedSubmissionPackCsv(pack.rows.filter(row => row.manual_bucket === 'manual_review_first')),
    'utf-8'
  );
  writeFileSync(
    files.cross_domain_final_url_csv,
    assistedSubmissionPackCsv(pack.rows.filter(row => row.manual_bucket === 'fix_cross_domain_final_url')),
    'utf-8'
  );
  writeFileSync(
    files.cross_domain_final_url_suggestions_csv,
    crossDomainFinalUrlSuggestionsCsv(pack.rows),
    'utf-8'
  );
  writeFileSync(
    files.cross_domain_final_url_suggestions_md,
    crossDomainSuggestionsMarkdown(pack, publicFiles),
    'utf-8'
  );
  writeFileSync(
    files.cross_domain_final_url_decisions_csv,
    crossDomainFinalUrlDecisionsCsv(pack.rows),
    'utf-8'
  );
  writeFileSync(
    files.cross_domain_final_url_decisions_md,
    crossDomainDecisionsMarkdown(pack, publicFiles),
    'utf-8'
  );
  writeFileSync(files.summary_json, JSON.stringify({
    ...pack.summary,
    files: publicFiles,
  }, null, 2) + '\n', 'utf-8');
  writeFileSync(files.summary_md, assistedPackMarkdown(pack, publicFiles), 'utf-8');

  return {
    output_dir: normalizePath(outputDir),
    files: publicFiles,
  };
}
