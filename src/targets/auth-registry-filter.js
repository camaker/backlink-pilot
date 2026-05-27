import { existsSync } from 'fs';
import { cleanTrackingUrl } from './normalize.js';
import { loadRegistry } from './registry.js';

function cleanUrl(value = '') {
  return value ? cleanTrackingUrl(value) : '';
}

function rowTargetId(row = {}) {
  return row.target_id || row.id || '';
}

export function loadRegistryTargetMap(registryPath = '') {
  const path = String(registryPath || '').trim();
  if (!path || !existsSync(path)) return null;
  const registry = loadRegistry(path);
  return new Map(
    (registry.targets || [])
      .map(target => [String(target.id || '').trim(), target])
      .filter(([id]) => id)
  );
}

export function registryBlockerForAuthRow(row = {}, registryTargetMap = null, opts = {}) {
  if (!registryTargetMap) return '';

  const targetId = String(rowTargetId(row) || '').trim();
  if (!targetId) return '';

  const target = registryTargetMap.get(targetId);
  if (!target) return 'registry_target_missing';

  const requiredMode = String(opts.requiredMode || 'assisted').trim();
  const currentMode = String(target.submission?.mode || '').trim() || 'unknown';
  if (requiredMode && currentMode !== requiredMode) {
    return `registry_mode_not_${requiredMode}:${currentMode}`;
  }

  if (opts.matchDomain !== false) {
    const rowDomain = String(row.domain || '').trim();
    const targetDomain = String(target.domain || '').trim();
    if (rowDomain && targetDomain && rowDomain !== targetDomain) {
      return `registry_domain_changed:${rowDomain}->${targetDomain}`;
    }
  }

  if (opts.matchSubmitUrl !== false) {
    const rowSubmitUrl = cleanUrl(row.submit_url || '');
    const targetSubmitUrl = cleanUrl(target.submit_url || '');
    if (rowSubmitUrl && targetSubmitUrl && rowSubmitUrl !== targetSubmitUrl) {
      return `registry_submit_url_changed:${rowSubmitUrl}->${targetSubmitUrl}`;
    }
  }

  return '';
}
