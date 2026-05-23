import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { loadConfig } from '../config.js';
import {
  defaultStatePath,
  isTerminalStatus,
  loadRunnerState,
  markItem,
  saveRunnerState,
} from '../runner/queue.js';
import { scout } from './discover.js';
import { configWithAuthProfile } from '../auth/session.js';
import { updateRegistryWithScoutFailure } from './persist.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readPlan(path) {
  const raw = readFileSync(path, 'utf-8');
  return path.endsWith('.json') ? JSON.parse(raw) : parse(raw);
}

function parseMs(value, fallback = 10000) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^(\d+)(ms|s|m)?$/);
  if (!match) return fallback;
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] || 'ms';
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 's') return amount * 1000;
  return amount;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function appendJsonl(path, entry) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: 'a', encoding: 'utf-8' });
}

function shouldScoutTarget(target, opts = {}) {
  if (!opts.mode) return true;
  return target.mode === opts.mode;
}

export async function scoutPlan(planPath, opts = {}) {
  if (!planPath) throw new Error('plan path is required');

  const plan = readPlan(planPath);
  const statePath = opts.state || defaultStatePath(planPath).replace(/state\.json$/, 'scout-state.json');
  const resultsPath = opts.results || join(dirname(planPath), 'scout-results.jsonl');
  const state = loadRunnerState(statePath, plan);
  const delayMs = parseMs(opts.delay, 10000);
  const targetTimeoutMs = parseMs(opts.targetTimeout || opts.targetTimeoutMs, 120000);
  const limit = Number.parseInt(opts.limit || plan.targets?.length || 0, 10);
  const max = Number.isFinite(limit) && limit > 0 ? limit : plan.targets.length;
  const scoutFn = opts.scoutFn || scout;
  const config = opts.configObject || await loadConfig({
    ...opts,
    configPath: opts.config || opts.productConfig,
    requireProduct: false,
  });

  if (opts.engine) config._engine = opts.engine;

  const executionConfig = opts.authProfile
    ? configWithAuthProfile(config, opts.authProfile, opts)
    : config;

  const summary = {
    plan: planPath,
    state: statePath,
    results: resultsPath,
    processed: 0,
    skipped: 0,
    failed: 0,
    by_mode: {},
  };

  const selected = (plan.targets || [])
    .filter(target => shouldScoutTarget(target, opts))
    .slice(0, max);

  for (const target of selected) {
    const item = state.items.find(entry => entry.id === target.id);
    if (item && isTerminalStatus(item.status) && !opts.retry) {
      summary.skipped++;
      continue;
    }

    markItem(state, target.id, { status: 'scout_running', attempts: (item?.attempts || 0) + 1 });
    saveRunnerState(statePath, state);

    try {
      const result = await withTimeout(scoutFn(target.submit_url, {
        ...opts,
        config: executionConfig,
        targetId: target.id,
        persist: opts.persist !== false,
        updateRegistry: Boolean(opts.updateRegistry),
        deep: opts.deep !== false,
      }), targetTimeoutMs, `scout target timed out after ${targetTimeoutMs}ms`);
      const mode = result.classification?.mode || 'unknown';
      summary.by_mode[mode] = (summary.by_mode[mode] || 0) + 1;
      markItem(state, target.id, {
        status: 'scouted',
        last_error: '',
        classification_mode: mode,
      });
      appendJsonl(resultsPath, {
        target_id: target.id,
        submit_url: target.submit_url,
        status: 'scouted',
        classification: result.classification,
        at: new Date().toISOString(),
      });
      summary.processed++;
    } catch (error) {
      let registryUpdated = false;
      if (opts.updateRegistry) {
        const updated = updateRegistryWithScoutFailure(target, error, opts);
        registryUpdated = Boolean(updated);
      }
      markItem(state, target.id, { status: 'scout_failed', last_error: error.message });
      appendJsonl(resultsPath, {
        target_id: target.id,
        submit_url: target.submit_url,
        status: 'scout_failed',
        error: error.message,
        registry_updated: registryUpdated,
        at: new Date().toISOString(),
      });
      summary.failed++;
    }

    saveRunnerState(statePath, state);
    if (delayMs > 0) await sleep(delayMs);
  }

  return summary;
}
