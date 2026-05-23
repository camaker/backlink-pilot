import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { DEFAULT_REGISTRY_FILE, loadRegistry } from './registry.js';
import { cleanTrackingUrl } from './normalize.js';
import { urlDomainBlocker } from './auth-login-safety.js';

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
