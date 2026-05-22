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
  let selected = computed;
  let source = 'computed';

  if (provided && classificationRisk(provided) < classificationRisk(computed)) {
    selected = provided;
    source = 'provided_conservative';
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
  const classification = resolved.classification || {};
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
    : 'yes';

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
    },
    updated_at: nowIso(),
  };
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
