import { DEFAULT_REGISTRY_FILE, filterTargets, importTargets, loadRegistry, normalizeRegistry, registryStats } from './registry.js';

function printStats(stats) {
  console.log(`Total: ${stats.total}`);
  console.log('By mode:', JSON.stringify(stats.by_mode));
  console.log('By pricing:', JSON.stringify(stats.by_pricing));
  console.log('By risk:', JSON.stringify(stats.by_risk));
  console.log('By lang:', JSON.stringify(stats.by_lang));
}

export async function importTargetsCommand(inputPath, opts = {}) {
  const registry = opts.registry || DEFAULT_REGISTRY_FILE;
  const result = importTargets(registry, inputPath, {
    source: opts.source,
    type: opts.type,
    lang: opts.lang,
    group: opts.group,
  });

  console.log(`Imported: ${result.imported}`);
  console.log(`Duplicates merged: ${result.duplicates}`);
  console.log(`Registry total: ${result.total}`);
  console.log(`Registry: ${result.path}`);
}

export async function listTargetsCommand(opts = {}) {
  const registry = loadRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  const rows = filterTargets(registry.targets, {
    free: Boolean(opts.free),
    paid: Boolean(opts.paid),
    mode: opts.mode,
    risk: opts.risk,
    lang: opts.lang,
    source: opts.source,
    runnable: Boolean(opts.runnable),
  });
  const limit = Number.parseInt(opts.limit || rows.length, 10);
  const selected = rows.slice(0, Number.isFinite(limit) && limit >= 0 ? limit : rows.length);

  if (opts.json) {
    console.log(JSON.stringify(selected, null, 2));
    return;
  }

  for (const target of selected) {
    console.log([
      target.id,
      target.submission?.mode || 'unknown',
      target.pricing || 'unknown',
      target.quality?.risk || 'unknown',
      target.submit_url,
    ].join('\t'));
  }

  if (!selected.length) console.log('No targets matched.');
}

export async function normalizeTargetsCommand(opts = {}) {
  const result = normalizeRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  console.log(`Normalized registry: ${result.path}`);
  console.log(`Targets: ${result.total}`);
  console.log(`Duplicates removed: ${result.duplicates}`);
}

export async function statsTargetsCommand(opts = {}) {
  const registry = loadRegistry(opts.registry || DEFAULT_REGISTRY_FILE);
  const stats = registryStats(registry.targets);
  if (opts.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  printStats(stats);
}
