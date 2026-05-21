import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { stringify } from 'yaml';
import { slugify } from '../targets/normalize.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from '../targets/registry.js';

export const DEFAULT_SCOUT_DIR = 'resources/scout-results';

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

export function applyScoutResultToTarget(target, result) {
  const classification = result.classification || {};
  return {
    ...target,
    technical: {
      ...(target.technical || {}),
      last_scouted_at: result.checked_at || nowIso(),
      auth: result.signals?.login_required ? 'required' : result.signals?.oauth_available ? 'oauth' : 'none',
      captcha: result.signals?.captcha ? 'required' : 'none',
      reachable: result.reachable === false ? 'no' : 'yes',
      final_url: result.final_url || target.submit_url,
      http_status: result.http_status || null,
    },
    forms: result.forms || target.forms || [],
    submission: {
      ...(target.submission || {}),
      mode: classification.mode || target.submission?.mode || 'needs_scout',
      status: classification.status || target.submission?.status || 'new',
      reason: Array.isArray(classification.reasons)
        ? classification.reasons.join('; ')
        : classification.reason || target.submission?.reason || '',
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
