import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parse, stringify } from 'yaml';
import { DEFAULT_REGISTRY_FILE, filterTargets, loadRegistry } from '../targets/registry.js';

function nowIso() {
  return new Date().toISOString();
}

function parseLimit(value, fallback = 30) {
  const limit = Number.parseInt(value || fallback, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : fallback;
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

export function buildSubmissionPlan(opts = {}) {
  const registry = loadRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  const mode = opts.mode || '';
  const limit = parseLimit(opts.limit, 30);
  const excludedModes = new Set(['skip', 'manual_strategic']);
  const candidates = filterTargets(registry.targets, {
    free: Boolean(opts.freeOnly) && !opts.allowUnknownPricing,
    mode: mode && mode !== 'runnable' ? mode : '',
    runnable: mode === 'runnable' || !mode,
    lang: opts.lang,
    source: opts.source,
  })
    .filter(target => {
      if (!opts.freeOnly || opts.allowUnknownPricing) return true;
      return target.pricing === 'free';
    })
    .filter(target => {
      if (!opts.allowUnknownPricing) return true;
      return target.pricing === 'free' || target.pricing === 'unknown';
    })
    .filter(target => !excludedModes.has(target.submission?.mode))
    .filter(target => opts.includeRisk || target.quality?.risk !== 'high')
    .slice(0, limit);

  const excluded = registry.targets
    .filter(target => !candidates.includes(target))
    .filter(target => excludedModes.has(target.submission?.mode) || target.quality?.risk === 'high')
    .map(target => ({
      id: target.id,
      name: target.name,
      submit_url: target.submit_url,
      mode: target.submission?.mode,
      reason: target.submission?.reason,
      risk: target.quality?.risk,
    }));

  return {
    version: 1,
    created_at: nowIso(),
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    product: loadProductIdentity(opts.productConfig),
    constraints: {
      free_only: Boolean(opts.freeOnly),
      mode: mode || 'runnable',
      limit,
      lang: opts.lang || '',
      source: opts.source || '',
      include_risk: Boolean(opts.includeRisk),
      allow_unknown_pricing: Boolean(opts.allowUnknownPricing),
    },
    targets: candidates.map((target, index) => ({
      order: index + 1,
      id: target.id,
      name: target.name,
      domain: target.domain,
      submit_url: target.submit_url,
      mode: target.submission?.mode,
      reason: target.submission?.reason,
      pricing: target.pricing,
      risk: target.quality?.risk,
      status: 'queued',
    })),
    excluded,
  };
}

export function saveSubmissionPlan(plan, path) {
  mkdirSync(dirname(path), { recursive: true });
  const body = path.endsWith('.json')
    ? JSON.stringify(plan, null, 2)
    : stringify(plan);
  writeFileSync(path, body, 'utf-8');
  return path;
}
