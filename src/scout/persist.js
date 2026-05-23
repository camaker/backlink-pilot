import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { stringify } from 'yaml';
import { classifyScoutResult, isBrowserErrorFinalUrl } from './classifier.js';
import { slugify } from '../targets/normalize.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from '../targets/registry.js';

export const DEFAULT_SCOUT_DIR = 'resources/scout-results';

const CLASSIFICATION_RISK = {
  skip: 0,
  needs_review: 1,
  needs_scout: 1,
  assisted: 2,
  auto_candidate: 3,
  auto_safe: 4,
};

function nowIso() {
  return new Date().toISOString();
}

function truncate(value, max = 1000) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function scoutResultPath(targetId, dir = DEFAULT_SCOUT_DIR) {
  return join(dir, `${slugify(targetId, 'target')}.json`);
}

export function saveScoutResult(result, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(result, null, 2), 'utf-8');
  return path;
}

function normalizeClassification(classification = {}) {
  if (!classification || typeof classification !== 'object' || !classification.mode) return null;
  return {
    mode: String(classification.mode || ''),
    status: String(classification.status || ''),
    confidence: Number.isFinite(Number(classification.confidence))
      ? Number(classification.confidence)
      : 0,
    reasons: Array.isArray(classification.reasons)
      ? classification.reasons.map(reason => String(reason))
      : classification.reason
        ? [String(classification.reason)]
        : [],
  };
}

function classificationRisk(classification = {}) {
  return CLASSIFICATION_RISK[classification.mode] ?? CLASSIFICATION_RISK.auto_safe;
}

function classificationChanged(left = {}, right = {}) {
  return String(left.mode || '') !== String(right.mode || '') ||
    String(left.status || '') !== String(right.status || '');
}

function isExplicitBlocker(classification = {}) {
  return [
    'auth_required',
    'captcha_required',
    'paywalled',
    'asset_upload_required',
    'access_blocked',
    'reciprocal_required',
    'dead',
  ].includes(String(classification.status || ''));
}

function isWeakComputedClassification(classification = {}) {
  return [
    'no_form_detected',
    'unsupported_form',
    'scout_failed',
    'browser_error',
  ].includes(String(classification.status || ''));
}

function finalizeWeakRetryClassification(target = {}, classification = {}) {
  const retryingWeakScout = target.submission?.mode === 'needs_scout' &&
    Boolean(target.technical?.last_scouted_at) &&
    classification.mode === 'needs_scout' &&
    isWeakComputedClassification(classification);

  if (!retryingWeakScout) {
    return { classification, finalized: false };
  }

  return {
    finalized: true,
    classification: {
      ...classification,
      mode: 'needs_review',
      reasons: [
        ...(classification.reasons || []),
        'scout_retry_exhausted_manual_review',
      ],
    },
  };
}

function isRemoteNullString(value) {
  const text = String(value || '');
  return text.includes('"subtype": "null"') && text.includes('"value": null');
}

function cleanScoutString(value) {
  return isRemoteNullString(value) ? '' : value;
}

function cleanScoutField(field = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(field || {})) {
    cleaned[key] = typeof value === 'string' ? cleanScoutString(value) : value;
  }

  if (!cleaned.selector || isRemoteNullString(cleaned.selector)) {
    cleaned.selector = '';
  }

  return cleaned;
}

export function sanitizeScoutForms(forms = []) {
  if (!Array.isArray(forms)) return [];
  return forms.map(form => ({
    ...form,
    fields: Array.isArray(form.fields)
      ? form.fields.map(cleanScoutField)
      : [],
    submit_buttons: Array.isArray(form.submit_buttons)
      ? form.submit_buttons.map(cleanScoutField)
      : [],
  }));
}

export function sanitizeScoutResult(result = {}, target = {}) {
  const fallbackFinalUrl = target.submit_url || result.submit_url || '';
  return {
    ...result,
    final_url: isBrowserErrorFinalUrl(result.final_url)
      ? fallbackFinalUrl
      : result.final_url,
    forms: sanitizeScoutForms(result.forms),
  };
}

export function resolveScoutClassification(result = {}) {
  const computed = normalizeClassification(classifyScoutResult({
    ...result,
    classification: undefined,
  }));
  const provided = normalizeClassification(result.classification);
  const computedRisk = classificationRisk(computed);
  const providedRisk = classificationRisk(provided || {});
  const isScoutFailure = Boolean(result.error);
  let selected = computed;
  let source = 'computed';

  const preserveExplicitBlocker = provided &&
    isExplicitBlocker(provided) &&
    isWeakComputedClassification(computed);

  if (provided && (
    providedRisk < computedRisk ||
    (isScoutFailure && providedRisk <= computedRisk) ||
    preserveExplicitBlocker
  )) {
    selected = provided;
    source = preserveExplicitBlocker && providedRisk >= computedRisk
      ? 'provided_explicit_blocker'
      : providedRisk < computedRisk
        ? 'provided_conservative'
        : 'provided_equal';
  }

  const mismatch = Boolean(provided && classificationChanged(provided, computed));
  const reasons = [
    ...(selected.reasons || []),
    mismatch ? `classification_mismatch:${provided.mode || 'none'}->${computed.mode || 'none'}` : '',
  ].filter(Boolean);

  return {
    classification: {
      ...selected,
      reasons: [...new Set(reasons)],
    },
    computed,
    provided,
    mismatch,
    source,
  };
}

export function applyScoutResultToTarget(target, result) {
  const sanitized = sanitizeScoutResult(result, target);
  const resolved = resolveScoutClassification({
    ...sanitized,
    final_url: result.final_url,
  });
  const finalized = finalizeWeakRetryClassification(target, resolved.classification || {});
  const classification = finalized.classification || {};
  const auth = sanitized.signals?.login_required
    ? 'required'
    : sanitized.signals?.oauth_available
      ? 'oauth'
      : classification.status === 'auth_required'
        ? 'required'
        : 'none';
  const captcha = sanitized.signals?.captcha || classification.status === 'captcha_required'
    ? 'required'
    : 'none';
  const reachable = sanitized.reachable === false || classification.status === 'dead'
    ? 'no'
    : sanitized.reachable === true
      ? 'yes'
      : 'unknown';
  const scoutError = truncate(sanitized.error);

  return {
    ...target,
    technical: {
      ...(target.technical || {}),
      last_scouted_at: sanitized.checked_at || nowIso(),
      auth,
      captcha,
      reachable,
      final_url: sanitized.final_url || target.submit_url,
      http_status: sanitized.http_status || null,
      ...(scoutError ? { last_scout_error: scoutError } : {}),
    },
    forms: sanitized.forms || target.forms || [],
    submission: {
      ...(target.submission || {}),
      mode: classification.mode || target.submission?.mode || 'needs_scout',
      status: classification.status || target.submission?.status || 'new',
      reason: Array.isArray(classification.reasons)
        ? classification.reasons.join('; ')
        : classification.reason || target.submission?.reason || '',
    },
    source_meta: {
      ...(target.source_meta || {}),
      scout_classification_source: resolved.source,
      scout_classification_mismatch: resolved.mismatch,
      scout_classification_provided: resolved.provided,
      scout_classification_computed: resolved.computed,
      ...(finalized.finalized ? { scout_retry_finalized: true } : {}),
      ...(scoutError ? { scout_failure_error: scoutError } : {}),
    },
    updated_at: nowIso(),
  };
}

function infrastructureScoutFailure(errorText = '') {
  return /browserType\.launch|executable doesn't exist|please run.*playwright install|bb-browser|auth storage state|cannot find module|module not found/i
    .test(errorText);
}

function targetFailureClassification(errorText = '') {
  if (infrastructureScoutFailure(errorText)) return null;

  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo/i.test(errorText)) {
    return {
      reachable: false,
      classification: {
        mode: 'skip',
        status: 'dead',
        confidence: 0.9,
        reasons: ['scout_failed_dns'],
      },
    };
  }

  if (/ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT|ERR_TIMED_OUT|ERR_CERT|SSL|TLS|scout target timed out|Timeout .*navigat|page\.goto: Timeout/i.test(errorText)) {
    return {
      classification: {
        mode: 'needs_review',
        status: 'scout_failed',
        confidence: 0.55,
        reasons: ['scout_failed_network'],
      },
    };
  }

  if (/page\.goto: net::ERR_/i.test(errorText)) {
    return {
      classification: {
        mode: 'needs_review',
        status: 'scout_failed',
        confidence: 0.55,
        reasons: ['scout_failed_network'],
      },
    };
  }

  return null;
}

export function scoutFailureResult(target = {}, error) {
  const errorText = truncate(error?.message || error);
  const failure = targetFailureClassification(errorText);
  if (!failure) return null;

  return {
    target_id: target.id,
    checked_at: nowIso(),
    submit_url: target.submit_url,
    final_url: target.submit_url,
    reachable: failure.reachable,
    http_status: null,
    signals: {
      login_required: false,
      oauth_available: false,
      captcha: false,
      payment: false,
    },
    forms: [],
    error: errorText,
    classification: failure.classification,
  };
}

export function applyScoutFailureToTarget(target = {}, error) {
  const result = scoutFailureResult(target, error);
  if (!result) return null;
  return applyScoutResultToTarget(target, result);
}

export function updateRegistryWithScoutResult(result, opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const targetId = result.target_id || result.id;
  const targetUrl = result.submit_url || result.url;

  const index = registry.targets.findIndex(target =>
    (targetId && target.id === targetId) ||
    (targetUrl && target.submit_url === targetUrl)
  );

  if (index === -1) {
    throw new Error(`Target not found in registry: ${targetId || targetUrl || '(unknown)'}`);
  }

  registry.targets[index] = applyScoutResultToTarget(registry.targets[index], result);
  saveRegistry(registry, registryPath);
  return registry.targets[index];
}

export function updateRegistryWithScoutFailure(target, error, opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const targetId = target.id || target.target_id;
  const targetUrl = target.submit_url || target.url;

  const index = registry.targets.findIndex(entry =>
    (targetId && entry.id === targetId) ||
    (targetUrl && entry.submit_url === targetUrl)
  );

  if (index === -1) {
    throw new Error(`Target not found in registry: ${targetId || targetUrl || '(unknown)'}`);
  }

  const updated = applyScoutFailureToTarget(registry.targets[index], error);
  if (!updated) return null;

  registry.targets[index] = updated;
  saveRegistry(registry, registryPath);
  return registry.targets[index];
}

export function formatScoutSummary(result) {
  return stringify({
    target_id: result.target_id,
    final_url: result.final_url,
    reachable: result.reachable,
    signals: result.signals,
    forms: (result.forms || []).map(form => ({
      field_count: form.fields?.length || 0,
      required_count: (form.fields || []).filter(field => field.required).length,
      mapped: (form.fields || [])
        .filter(field => field.mapped_to)
        .map(field => `${field.mapped_to}:${field.name || field.label || field.placeholder || field.type}`),
      submit_buttons: form.submit_buttons || [],
    })),
    classification: result.classification,
  });
}
