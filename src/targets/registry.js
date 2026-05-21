import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, extname } from 'path';
import { parse, stringify } from 'yaml';
import { parseCsv } from './importers/csv.js';
import { inferTargetMode } from './classify.js';
import { normalizePricing, normalizeUrl, slugify } from './normalize.js';

export const DEFAULT_REGISTRY_FILE = 'resources/targets.canonical.yaml';

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function flattenYamlTargets(value, group = '') {
  if (Array.isArray(value)) return value.map(item => ({ ...item, group }));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => flattenYamlTargets(child, key));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function rowUrl(row) {
  return firstNonEmpty(
    row.submit_url,
    row.submission_link,
    row.target_url,
    row.url,
    row.primaryExternalUrl,
    row.href,
    row.link
  );
}

function rowTitle(row, normalized) {
  return firstNonEmpty(
    row.name,
    row.title,
    row.target_text,
    row.source_title,
    row.text,
    normalized?.domain
  );
}

function sourceMeta(row) {
  const meta = {};
  for (const key of [
    'id',
    'source_files',
    'source_locations',
    'source_article_url',
    'source_author',
    'source_date',
    'source_categories',
    'monthly_visits',
    'occurrence_count',
    'source_count',
  ]) {
    if (row[key]) meta[key] = row[key];
  }
  return meta;
}

function isOpaqueExternalId(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function isStableExplicitId(value) {
  const text = String(value || '').trim();
  if (!text || isOpaqueExternalId(text)) return false;
  if (['ai', 'id', 'url', 'target', 'unknown'].includes(text.toLowerCase())) return false;
  return /^[a-z0-9][a-z0-9-]{2,79}$/i.test(text);
}

function canonicalId(row, name, normalized) {
  if (isStableExplicitId(row.canonical_id)) return slugify(row.canonical_id);
  if (isStableExplicitId(row.id)) return slugify(row.id);

  const nameSlug = slugify(name, '');
  if (nameSlug && nameSlug.length > 2 && !['ai', 'seo', 'app'].includes(nameSlug)) {
    return nameSlug;
  }

  return slugify(normalized.domain.replace(/\./g, '-'));
}

function externalId(row) {
  if (isOpaqueExternalId(row.id)) return row.id;
  const value = firstNonEmpty(row.external_id);
  return value || undefined;
}

function pruneEmpty(value) {
  if (Array.isArray(value)) return value.map(pruneEmpty);
  if (!value || typeof value !== 'object') return value;

  const cleaned = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    cleaned[key] = pruneEmpty(child);
  }
  return cleaned;
}

export function canonicalTargetFromRow(row = {}, opts = {}) {
  const submitUrl = rowUrl(row);
  const normalized = normalizeUrl(submitUrl);
  if (!normalized) return null;

  const name = rowTitle(row, normalized);
  const pricing = normalizePricing(row.pricing, row.price_text || row.status);
  const source = opts.source || row.source || row.group || 'import';
  const type = firstNonEmpty(row.type, opts.type, 'form');
  const base = {
    id: canonicalId(row, name, normalized),
    external_id: externalId(row),
    name,
    domain: normalized.domain,
    root_url: normalized.rootUrl,
    submit_url: normalized.url,
    normalized_key: normalized.dedupeKey,
    type,
    lang: firstNonEmpty(row.lang, opts.lang, 'unknown'),
    group: firstNonEmpty(row.group, opts.group),
    pricing,
    price_text: firstNonEmpty(row.price_text),
    status: firstNonEmpty(row.status),
    original_auto: firstNonEmpty(row.auto),
    auto: firstNonEmpty(row.auto, row.original_auto),
    notes: firstNonEmpty(row.notes, row.source_excerpt, row.description),
    source: [source],
    source_meta: sourceMeta(row),
    technical: {
      last_scouted_at: null,
      auth: 'unknown',
      captcha: 'unknown',
      reachable: 'unknown',
    },
    submission: {
      mode: 'needs_scout',
      status: 'new',
      reason: '',
      last_submitted_at: null,
      last_verified_at: null,
    },
    quality: {
      risk: 'unknown',
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const classification = inferTargetMode(base);
  base.submission.mode = classification.mode;
  base.submission.reason = classification.reason;
  base.quality.risk = classification.risk;
  base.pricing = classification.pricing || pricing;

  return pruneEmpty(base);
}

export function loadTargetsFromFile(path, opts = {}) {
  const text = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();
  let rows;

  if (ext === '.csv') {
    rows = parseCsv(text);
  } else if (ext === '.json') {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) rows = parsed;
    else if (Array.isArray(parsed.results)) {
      rows = parsed.results.flatMap(result => {
        if (Array.isArray(result.externalLinks) && result.externalLinks.length) {
          return result.externalLinks.map(link => ({
            ...link,
            target_url: link.url,
            target_text: link.text,
            source_title: result.title || result.archiveTitle,
            source_article_url: result.articleUrl,
            source_author: result.author,
            source_date: result.date,
            source_categories: Array.isArray(result.categories) ? result.categories.join(', ') : '',
            source_excerpt: result.excerpt,
          }));
        }
        return result.primaryExternalUrl ? [{
          ...result,
          target_url: result.primaryExternalUrl,
          target_text: result.title,
        }] : [];
      });
    } else if (Array.isArray(parsed.targets)) rows = parsed.targets;
    else rows = [];
  } else {
    const parsed = parse(text) || {};
    rows = Array.isArray(parsed) ? parsed : flattenYamlTargets(parsed);
  }

  return rows
    .map(row => canonicalTargetFromRow(row, opts))
    .filter(Boolean);
}

export function emptyRegistry() {
  return {
    version: 1,
    generated_at: nowIso(),
    targets: [],
  };
}

export function loadRegistry(path = DEFAULT_REGISTRY_FILE) {
  if (!existsSync(path)) return emptyRegistry();
  const parsed = parse(readFileSync(path, 'utf-8')) || {};
  return {
    version: parsed.version || 1,
    generated_at: parsed.generated_at || nowIso(),
    targets: Array.isArray(parsed.targets) ? parsed.targets : [],
  };
}

export function saveRegistry(registry, path = DEFAULT_REGISTRY_FILE) {
  mkdirSync(dirname(path), { recursive: true });
  const data = {
    version: registry.version || 1,
    generated_at: registry.generated_at || nowIso(),
    updated_at: nowIso(),
    targets: registry.targets || [],
  };
  writeFileSync(path, stringify(data), 'utf-8');
  return data;
}

function mergeTarget(existing, incoming) {
  const merged = {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    created_at: existing.created_at || incoming.created_at || nowIso(),
    updated_at: nowIso(),
    source: unique([
      ...asArray(existing.source),
      ...asArray(incoming.source),
    ]),
    source_meta: {
      ...(existing.source_meta || {}),
      ...(incoming.source_meta || {}),
    },
    technical: {
      ...(incoming.technical || {}),
      ...(existing.technical || {}),
    },
    submission: {
      ...(incoming.submission || {}),
      ...(existing.submission || {}),
    },
    quality: {
      ...(incoming.quality || {}),
      ...(existing.quality || {}),
    },
  };

  if (!existing.notes && incoming.notes) merged.notes = incoming.notes;
  if (!existing.group && incoming.group) merged.group = incoming.group;
  if (!existing.lang || existing.lang === 'unknown') merged.lang = incoming.lang;
  if (!existing.price_text && incoming.price_text) merged.price_text = incoming.price_text;

  return merged;
}

export function mergeTargets(existingTargets = [], incomingTargets = []) {
  const byKey = new Map();
  const duplicateKeys = [];

  for (const target of existingTargets) {
    if (!target?.normalized_key) continue;
    byKey.set(target.normalized_key, target);
  }

  for (const target of incomingTargets) {
    if (!target?.normalized_key) continue;
    const existing = byKey.get(target.normalized_key);
    if (existing) {
      duplicateKeys.push(target.normalized_key);
      byKey.set(target.normalized_key, mergeTarget(existing, target));
    } else {
      byKey.set(target.normalized_key, target);
    }
  }

  return {
    targets: [...byKey.values()].sort((a, b) =>
      String(a.domain).localeCompare(String(b.domain)) ||
      String(a.submit_url).localeCompare(String(b.submit_url))
    ),
    imported: incomingTargets.length,
    duplicates: duplicateKeys.length,
  };
}

export function importTargets(registryPath, inputPath, opts = {}) {
  const registry = loadRegistry(registryPath);
  const incoming = loadTargetsFromFile(inputPath, opts);
  const merged = mergeTargets(registry.targets, incoming);
  const saved = saveRegistry({ ...registry, targets: merged.targets }, registryPath);
  return {
    ...merged,
    total: saved.targets.length,
    path: registryPath,
  };
}

export function filterTargets(targets = [], filters = {}) {
  return targets.filter(target => {
    if (filters.free && target.pricing !== 'free') return false;
    if (filters.paid && target.pricing !== 'paid') return false;
    if (filters.mode && target.submission?.mode !== filters.mode) return false;
    if (filters.risk && target.quality?.risk !== filters.risk) return false;
    if (filters.lang && target.lang !== filters.lang) return false;
    if (filters.source && !asArray(target.source).includes(filters.source)) return false;
    if (filters.runnable && !['auto_safe', 'auto_candidate', 'assisted'].includes(target.submission?.mode)) {
      return false;
    }
    return true;
  });
}

export function registryStats(targets = []) {
  const stats = {
    total: targets.length,
    by_mode: {},
    by_pricing: {},
    by_risk: {},
    by_lang: {},
  };

  for (const target of targets) {
    const mode = target.submission?.mode || 'unknown';
    const pricing = target.pricing || 'unknown';
    const risk = target.quality?.risk || 'unknown';
    const lang = target.lang || 'unknown';
    stats.by_mode[mode] = (stats.by_mode[mode] || 0) + 1;
    stats.by_pricing[pricing] = (stats.by_pricing[pricing] || 0) + 1;
    stats.by_risk[risk] = (stats.by_risk[risk] || 0) + 1;
    stats.by_lang[lang] = (stats.by_lang[lang] || 0) + 1;
  }

  return stats;
}

export function normalizeRegistry(registryPath = DEFAULT_REGISTRY_FILE) {
  const registry = loadRegistry(registryPath);
  const normalized = registry.targets
    .map(target => canonicalTargetFromRow({
      ...target,
      submit_url: target.submit_url,
      auto: target.original_auto || target.auto,
    }, { source: Array.isArray(target.source) ? target.source[0] : target.source || 'registry' }))
    .filter(Boolean);
  const merged = mergeTargets([], normalized);
  saveRegistry({ ...registry, targets: merged.targets }, registryPath);
  return {
    total: merged.targets.length,
    duplicates: merged.duplicates,
    path: registryPath,
  };
}
