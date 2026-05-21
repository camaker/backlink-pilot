// campaign.js — High-level backlink campaign runner for agent/Feishu entrypoints

import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import { loadConfig } from './config.js';
import { submit } from './submit.js';

const TARGETS_FILE = 'targets.yaml';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function flattenTargets(value, group = '') {
  if (Array.isArray(value)) {
    return value.map(item => ({ ...item, group }));
  }

  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => flattenTargets(child, key));
}

export function loadCampaignTargets(path = TARGETS_FILE) {
  if (!existsSync(path)) {
    throw new Error(`${path} not found`);
  }

  const raw = parse(readFileSync(path, 'utf-8')) || {};
  return flattenTargets(raw).filter(target => target?.submit_url);
}

export function isAutoTarget(target) {
  const auto = String(target.auto || '').toLowerCase();
  const status = String(target.status || '').toLowerCase();
  const type = String(target.type || '').toLowerCase();

  return (
    target.submit_url &&
    auto === 'yes' &&
    type !== 'github' &&
    !['dead', 'paid', 'manual', 'no'].includes(status)
  );
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveRequestedTargets(allTargets, requested) {
  if (!requested) return null;

  return String(requested)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      if (/^https?:\/\//i.test(item)) {
        return { name: item, submit_url: item, type: 'form', auto: 'yes', group: 'custom' };
      }

      const key = normalizeKey(item);
      return allTargets.find(target =>
        normalizeKey(target.name) === key ||
        normalizeKey(target.submit_url) === key
      );
    })
    .filter(Boolean);
}

export function selectCampaignTargets(allTargets, opts = {}) {
  const requested = resolveRequestedTargets(allTargets, opts.targets);
  const candidates = requested || allTargets.filter(isAutoTarget);
  const limit = Number.parseInt(opts.limit || 3, 10);
  return candidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 3);
}

export async function runCampaign(productUrl, opts = {}) {
  if (!productUrl) throw new Error('product URL is required');

  const config = await loadConfig({
    ...opts,
    productUrl: opts.productUrl || productUrl,
  });
  if (opts.engine) config._engine = opts.engine;

  const allTargets = loadCampaignTargets(opts.targetsFile || TARGETS_FILE);
  const targets = selectCampaignTargets(allTargets, opts);

  if (!targets.length) {
    console.log('No eligible auto-submit targets found.');
    return;
  }

  const intervalSeconds = Number.parseInt(opts.interval || 90, 10);
  const dryRun = Boolean(opts.dryRun);

  console.log(`\n🎯 Backlink campaign for ${config.product.url}`);
  console.log(`Product: ${config.product.name}`);
  console.log(`Targets: ${targets.length}${dryRun ? ' [DRY RUN]' : ''}\n`);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${target.name} — ${target.submit_url}`);

    await submit(target.submit_url, {
      ...opts,
      config,
      dryRun,
    });

    if (!dryRun && i < targets.length - 1 && intervalSeconds > 0) {
      console.log(`Waiting ${intervalSeconds}s before next target...`);
      await sleep(intervalSeconds * 1000);
    }
  }

  console.log('\nCampaign finished.');
}
