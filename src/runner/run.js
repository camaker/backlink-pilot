import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { submit } from '../submit.js';
import { loadConfig } from '../config.js';
import { classifySubmissionResult } from '../scout/classifier.js';
import {
  defaultStatePath,
  isTerminalStatus,
  loadRunnerState,
  markItem,
  saveRunnerState,
} from './queue.js';

const SAFE_EXECUTION_MODES = new Set(['auto_safe']);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readPlan(path) {
  const raw = readFileSync(path, 'utf-8');
  return path.endsWith('.json') ? JSON.parse(raw) : parse(raw);
}

function parseMs(value, fallback = 60000) {
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

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function appendJsonl(path, entry) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: 'a', encoding: 'utf-8' });
}

function canExecuteTarget(target, opts = {}) {
  if (SAFE_EXECUTION_MODES.has(target.mode)) return { ok: true, reason: '' };
  if (target.mode === 'auto_candidate' && opts.allowAutoCandidate) {
    return { ok: true, reason: 'auto_candidate_allowed_explicitly' };
  }
  if (target.mode === 'assisted' && opts.assisted) {
    return { ok: true, reason: 'assisted_allowed_explicitly' };
  }
  return {
    ok: false,
    reason: `mode_${target.mode || 'unknown'}_not_executable_without_explicit_flag`,
  };
}

export async function runPlan(planPath, opts = {}) {
  if (!planPath) throw new Error('plan path is required');

  const plan = readPlan(planPath);
  const statePath = opts.state || defaultStatePath(planPath);
  const resultsPath = opts.results || join(dirname(planPath), 'results.jsonl');
  const state = loadRunnerState(statePath, plan);
  const execute = Boolean(opts.execute);
  const delayMs = parseMs(opts.delay, 60000);
  const limit = Number.parseInt(opts.limit || plan.targets?.length || 0, 10);
  const max = Number.isFinite(limit) && limit > 0 ? limit : plan.targets.length;
  const config = execute
    ? await loadConfig({
      ...opts,
      configPath: opts.config || opts.productConfig,
      requireProduct: true,
    })
    : null;

  const summary = {
    plan: planPath,
    execute,
    state: statePath,
    results: resultsPath,
    processed: 0,
    skipped: 0,
    submitted: 0,
    failed: 0,
  };

  for (const target of (plan.targets || []).slice(0, max)) {
    const item = state.items.find(entry => entry.id === target.id);
    if (item && isTerminalStatus(item.status) && !opts.retry) {
      summary.skipped++;
      continue;
    }

    const executable = canExecuteTarget(target, opts);
    if (!executable.ok) {
      markItem(state, target.id, { status: 'skipped', last_error: executable.reason });
      saveRunnerState(statePath, state);
      appendJsonl(resultsPath, {
        target_id: target.id,
        status: 'skipped',
        reason: executable.reason,
        at: new Date().toISOString(),
      });
      summary.skipped++;
      continue;
    }

    if (!execute) {
      markItem(state, target.id, { status: 'dry_run_ready' });
      saveRunnerState(statePath, state);
      appendJsonl(resultsPath, {
        target_id: target.id,
        status: 'dry_run_ready',
        submit_url: target.submit_url,
        mode: target.mode,
        at: new Date().toISOString(),
      });
      summary.processed++;
      continue;
    }

    markItem(state, target.id, { status: 'running', attempts: (item?.attempts || 0) + 1 });
    saveRunnerState(statePath, state);

    try {
      const submission = await submit(target.submit_url, {
        ...opts,
        config,
      });
      const classified = submission?.status
        ? { status: submission.status, reasons: submission.reasons || [] }
        : classifySubmissionResult({ confirmation: 'submitted' });
      markItem(state, target.id, { status: classified.status });
      appendJsonl(resultsPath, {
        target_id: target.id,
        status: classified.status,
        submit_url: target.submit_url,
        confirmation: submission?.confirmation || '',
        listing_url: submission?.url || '',
        error: submission?.error || '',
        at: new Date().toISOString(),
      });
      if (classified.status === 'failed') summary.failed++;
      else summary.submitted++;
    } catch (error) {
      markItem(state, target.id, { status: 'failed', last_error: error.message });
      appendJsonl(resultsPath, {
        target_id: target.id,
        status: 'failed',
        error: error.message,
        at: new Date().toISOString(),
      });
      summary.failed++;
    }

    saveRunnerState(statePath, state);
    summary.processed++;
    if (delayMs > 0) await sleep(delayMs);
  }

  return summary;
}
