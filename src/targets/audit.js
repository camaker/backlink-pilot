import { isRunnableMode } from './classify.js';
import { normalizeUrl } from './normalize.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry, registryStats } from './registry.js';
import { urlDomainBlocker } from './auth-login-safety.js';

const REQUIRED_MAPPED_FIELDS = ['product.name', 'product.url', 'product.description'];

const MANUAL_STRATEGIC_DOMAINS = new Set([
  'producthunt.com',
  'news.ycombinator.com',
  'reddit.com',
  'g2.com',
  'capterra.com',
  'trustradius.com',
  'indiehackers.com',
  'github.com',
]);

function normalizedDomain(value = '') {
  return String(value || '').replace(/^www\./, '').toLowerCase();
}

function isManualStrategicDomain(domain = '') {
  const normalized = normalizedDomain(domain);
  return MANUAL_STRATEGIC_DOMAINS.has(normalized) ||
    [...MANUAL_STRATEGIC_DOMAINS].some(manual => normalized.endsWith(`.${manual}`));
}

function targetRef(target = {}) {
  return {
    target_id: target.id || '',
    name: target.name || '',
    domain: target.domain || '',
    submit_url: target.submit_url || '',
    mode: target.submission?.mode || '',
  };
}

function finding(severity, code, target, message, remediation = '') {
  return {
    severity,
    code,
    ...targetRef(target),
    message,
    remediation,
  };
}

function mappedFieldSet(target = {}) {
  return new Set(
    (target.forms || [])
      .flatMap(form => form.fields || [])
      .map(field => field.mapped_to)
      .filter(Boolean)
  );
}

function missingRequiredMappings(target = {}) {
  const mapped = mappedFieldSet(target);
  return REQUIRED_MAPPED_FIELDS.filter(field => !mapped.has(field));
}

function hasSubmitButton(target = {}) {
  return (target.forms || []).some(form =>
    Array.isArray(form.submit_buttons) && form.submit_buttons.length > 0
  );
}

function hasScoutEvidence(target = {}) {
  return Boolean(target.technical?.last_scouted_at);
}

function countBy(items = [], keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function asFilterSet(value) {
  if (!value) return null;
  const items = String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return items.length ? new Set(items) : null;
}

function filterFindings(findings = [], opts = {}) {
  const codes = asFilterSet(opts.code || opts.codes);
  const severities = asFilterSet(opts.severity || opts.severities);
  return findings.filter(item => {
    if (codes && !codes.has(item.code)) return false;
    if (severities && !severities.has(item.severity)) return false;
    return true;
  });
}

function auditDuplicateIds(targets = []) {
  const findings = [];
  const seen = new Map();
  for (const target of targets) {
    if (!target.id) continue;
    if (!seen.has(target.id)) {
      seen.set(target.id, target);
      continue;
    }
    findings.push(finding(
      'blocker',
      'duplicate_target_id',
      target,
      `Duplicate target id "${target.id}" makes runner state and registry writeback ambiguous.`,
      'Normalize or rename duplicate target IDs before planning or executing submissions.'
    ));
  }
  return findings;
}

function auditDuplicateSubmitUrls(targets = []) {
  const findings = [];
  const seen = new Map();
  for (const target of targets) {
    const normalized = normalizeUrl(target.submit_url);
    if (!normalized) continue;
    const key = normalized.dedupeKey;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, target);
      continue;
    }

    const severity = isRunnableMode(target.submission?.mode) || isRunnableMode(existing.submission?.mode)
      ? 'blocker'
      : 'warning';
    findings.push(finding(
      severity,
      'duplicate_submit_url',
      target,
      `Duplicate submit URL already used by target "${existing.id}".`,
      'Deduplicate targets before batch execution to avoid repeated submissions to the same form.'
    ));
  }
  return findings;
}

function auditRunnableTarget(target = {}) {
  const findings = [];
  const mode = target.submission?.mode || '';
  if (!isRunnableMode(mode)) return findings;

  const normalized = normalizeUrl(target.submit_url);
  if (!normalized) {
    findings.push(finding(
      'blocker',
      'runnable_invalid_submit_url',
      target,
      'Runnable target has an invalid or missing HTTP(S) submit URL.',
      'Fix submit_url or move the target to needs_scout/skip before execution.'
    ));
  }

  if (target.pricing === 'paid') {
    findings.push(finding(
      'blocker',
      'runnable_paid_target',
      target,
      'Runnable target is marked as paid.',
      'Keep paid or paywalled directories in skip/manual mode unless explicitly handled outside automation.'
    ));
  }

  if (target.quality?.risk === 'high') {
    findings.push(finding(
      'blocker',
      'runnable_high_risk_target',
      target,
      'Runnable target is marked high risk.',
      'Do not automate high-risk surfaces such as blog comments, bookmarks, or spam-prone forums.'
    ));
  }

  if (isManualStrategicDomain(target.domain)) {
    findings.push(finding(
      'blocker',
      'runnable_manual_strategic_domain',
      target,
      'Runnable target is a strategic manual/community/review surface.',
      'Keep Product Hunt, HN, Reddit, G2/Capterra, GitHub, and similar surfaces manual or assisted.'
    ));
  }

  if (target.pricing === 'unknown') {
    findings.push(finding(
      'warning',
      'runnable_unknown_pricing',
      target,
      'Runnable target has unknown pricing.',
      'Scout or manually verify pricing before real execution.'
    ));
  }

  const finalUrlBlocker = urlDomainBlocker({
    url: target.technical?.final_url || '',
    domain: target.domain || '',
    allowed_urls: [target.submit_url || ''],
    code: 'final_url_domain_mismatch',
  });
  if (finalUrlBlocker) {
    findings.push(finding(
      'blocker',
      'runnable_final_url_domain_mismatch',
      target,
      `Runnable target scout final_url is outside the target or submit domain: ${finalUrlBlocker}.`,
      'Fix stale scout evidence, correct submit_url/domain, or rescout the intended target before login, assisted execution, or auto_safe promotion.'
    ));
  }

  return findings;
}

function auditAutoSafeTarget(target = {}) {
  const findings = [];
  if (target.submission?.mode !== 'auto_safe') return findings;

  if (!hasScoutEvidence(target)) {
    findings.push(finding(
      'blocker',
      'auto_safe_missing_scout_evidence',
      target,
      'auto_safe target has no persisted scout timestamp.',
      'Run scout with --persist --update-registry before allowing unattended submission.'
    ));
  }

  if (target.submission?.status !== 'mapped') {
    findings.push(finding(
      'blocker',
      'auto_safe_not_mapped',
      target,
      `auto_safe target status is "${target.submission?.status || 'unknown'}" instead of "mapped".`,
      'Only mark targets auto_safe after scout confirms a mapped form.'
    ));
  }

  if (target.technical?.auth !== 'none') {
    findings.push(finding(
      'blocker',
      'auto_safe_auth_not_none',
      target,
      `auto_safe target auth state is "${target.technical?.auth || 'unknown'}".`,
      'Authenticated or OAuth targets must be assisted and require a saved auth profile.'
    ));
  }

  if (target.technical?.captcha !== 'none') {
    findings.push(finding(
      'blocker',
      'auto_safe_captcha_not_none',
      target,
      `auto_safe target captcha state is "${target.technical?.captcha || 'unknown'}".`,
      'Do not automate targets with CAPTCHA, Turnstile, Cloudflare, or human verification.'
    ));
  }

  if (target.technical?.reachable !== 'yes') {
    findings.push(finding(
      'blocker',
      'auto_safe_reachable_not_yes',
      target,
      `auto_safe target reachability is "${target.technical?.reachable || 'unknown'}".`,
      'Scout the target and only allow auto_safe when the submit page is reachable.'
    ));
  }

  if (!Array.isArray(target.forms) || !target.forms.length) {
    findings.push(finding(
      'blocker',
      'auto_safe_missing_forms',
      target,
      'auto_safe target has no persisted form evidence.',
      'Persist scout form metadata before unattended execution.'
    ));
  }

  const missing = missingRequiredMappings(target);
  if (missing.length) {
    findings.push(finding(
      'blocker',
      'auto_safe_missing_required_mappings',
      target,
      `auto_safe target is missing required mapped fields: ${missing.join(', ')}.`,
      'Persist selectors for product.name, product.url, and product.description before execution.'
    ));
  }

  if (!hasSubmitButton(target)) {
    findings.push(finding(
      'blocker',
      'auto_safe_missing_submit_button',
      target,
      'auto_safe target has no persisted submit button evidence.',
      'Persist a submit button selector from scout before unattended execution.'
    ));
  }

  return findings;
}

function auditScoutQueueTarget(target = {}) {
  if (target.submission?.mode !== 'auto_candidate') return [];
  if (hasScoutEvidence(target)) return [];
  return [finding(
    'warning',
    'auto_candidate_needs_scout',
    target,
    'auto_candidate target is based on static metadata and has not been scouted.',
    'Run scout-plan with --update-registry; do not execute without explicit --allow-auto-candidate.'
  )];
}

function auditTarget(target = {}) {
  return [
    ...auditRunnableTarget(target),
    ...auditAutoSafeTarget(target),
    ...auditScoutQueueTarget(target),
  ];
}

export function auditTargets(targets = [], opts = {}) {
  const findings = [
    ...auditDuplicateIds(targets),
    ...auditDuplicateSubmitUrls(targets),
    ...targets.flatMap(auditTarget),
  ];
  const blockers = findings.filter(item => item.severity === 'blocker');
  const warnings = findings.filter(item => item.severity === 'warning');
  const filteredFindings = filterFindings(findings, opts);
  const filteredBlockers = filteredFindings.filter(item => item.severity === 'blocker');
  const filteredWarnings = filteredFindings.filter(item => item.severity === 'warning');

  return {
    ok: blockers.length === 0,
    level: opts.level || 'automation',
    total_targets: targets.length,
    stats: registryStats(targets),
    blockers,
    warnings,
    filtered_blockers: filteredBlockers,
    filtered_warnings: filteredWarnings,
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      by_severity: countBy(findings, item => item.severity),
      by_code: countBy(findings, item => item.code),
      filtered_blockers: filteredBlockers.length,
      filtered_warnings: filteredWarnings.length,
      filtered_by_severity: countBy(filteredFindings, item => item.severity),
      filtered_by_code: countBy(filteredFindings, item => item.code),
    },
    filters: {
      code: opts.code || opts.codes || '',
      severity: opts.severity || opts.severities || '',
      active: Boolean((opts.code || opts.codes || opts.severity || opts.severities)),
    },
  };
}

export function auditRegistry(registryPath = DEFAULT_REGISTRY_FILE, opts = {}) {
  const registry = loadRegistry(registryPath);
  return {
    registry: registryPath,
    ...auditTargets(registry.targets || [], opts),
  };
}

function formatFinding(item) {
  const target = item.target_id || item.submit_url || '(unknown target)';
  return `${item.severity.toUpperCase()} ${item.code} ${target}: ${item.message}`;
}

export function formatAuditReport(report = {}, opts = {}) {
  const limit = Number.parseInt(opts.limitFindings || 50, 10);
  const max = Number.isFinite(limit) && limit >= 0 ? limit : 50;
  const filtersActive = Boolean(report.filters?.active);
  const blockers = filtersActive ? report.filtered_blockers || [] : report.blockers || [];
  const warnings = filtersActive ? report.filtered_warnings || [] : report.warnings || [];
  const lines = [
    `Target audit: ${report.ok ? 'ready' : 'blocked'}`,
    `Registry: ${report.registry || '(memory)'}`,
    `Targets: ${report.total_targets || 0}`,
    `Blockers: ${report.summary?.blockers || 0}`,
    `Warnings: ${report.summary?.warnings || 0}`,
    `Finding codes: ${JSON.stringify(report.summary?.by_code || {})}`,
  ];

  if (filtersActive) {
    lines.push(`Filtered blockers: ${report.summary?.filtered_blockers || 0}`);
    lines.push(`Filtered warnings: ${report.summary?.filtered_warnings || 0}`);
    lines.push(`Filtered codes: ${JSON.stringify(report.summary?.filtered_by_code || {})}`);
  }

  if (blockers.length) {
    lines.push('', `Blockers (showing ${Math.min(max, blockers.length)} of ${blockers.length})`);
    for (const item of blockers.slice(0, max)) lines.push(`- ${formatFinding(item)}`);
  }

  if (warnings.length) {
    lines.push('', `Warnings (showing ${Math.min(max, warnings.length)} of ${warnings.length})`);
    for (const item of warnings.slice(0, max)) lines.push(`- ${formatFinding(item)}`);
  }

  return lines.join('\n');
}
