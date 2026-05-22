import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { submit } from '../submit.js';
import { loadConfig } from '../config.js';
import { classifySubmissionResult } from '../scout/classifier.js';
import { DEFAULT_REGISTRY_FILE, loadRegistry } from '../targets/registry.js';
import { auditTargets } from '../targets/audit.js';
import { normalizeUrl } from '../targets/normalize.js';
import {
  assertProductReadiness,
  validateProductReadiness,
} from '../readiness/product.js';
import { extractListingCandidates } from '../verification/listing.js';
import { updateRegistryWithSubmissionResult } from '../submission/registry.js';
import {
  ensureDir,
  targetArtifactDir,
  writeArtifactJson,
} from './artifacts.js';
import { authProfileStatus, configWithAuthProfile } from '../auth/session.js';
import {
  defaultStatePath,
  isTerminalStatus,
  loadRunnerState,
  markItem,
  saveRunnerState,
} from './queue.js';

const SAFE_EXECUTION_MODES = new Set(['auto_safe']);
export const CONTROLLED_TEST_CONFIRMATION = 'CONTROLLED_TEST_ONLY';

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

function ensureJsonlFile(path) {
  ensureParent(path);
  if (!existsSync(path)) writeFileSync(path, '', 'utf-8');
}

function defaultArtifactsDir(planPath) {
  return join(dirname(planPath), 'artifacts');
}

function registryTargetMap(plan, opts = {}) {
  const registryPath = opts.registry || plan.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const targets = new Map();
  for (const target of registry.targets || []) {
    targets.set(target.id, target);
  }
  return { registryPath, targets };
}

function auditSummary(report = {}, skipped = false) {
  const normalized = report || {};
  return {
    ok: skipped ? true : Boolean(normalized.ok),
    skipped,
    blockers: normalized.summary?.blockers || 0,
    warnings: normalized.summary?.warnings || 0,
    by_code: normalized.summary?.by_code || {},
  };
}

function requestedExecutionOverrides(opts = {}) {
  const overrides = [];
  if (opts.allowAutoCandidate) {
    overrides.push({
      code: 'allow_auto_candidate',
      message: 'Allows real execution of unverified auto_candidate targets.',
    });
  }
  if (opts.skipReadinessCheck) {
    overrides.push({
      code: 'skip_readiness_check',
      message: 'Skips product readiness blockers for real execution.',
    });
  }
  if (opts.skipTargetAudit) {
    overrides.push({
      code: 'skip_target_audit',
      message: 'Skips registry target safety audit for real execution.',
    });
  }
  return overrides;
}

function assertControlledTestConfirmation(opts = {}, overrides = []) {
  const confirmation = String(opts.confirmControlledTest || '').trim();
  const required = overrides.length > 0;
  if (required && confirmation !== CONTROLLED_TEST_CONFIRMATION) {
    const codes = overrides.map(item => item.code).join(', ');
    throw new Error(
      `Dangerous execution override(s) require --confirm-controlled-test ${CONTROLLED_TEST_CONFIRMATION}: ${codes}`
    );
  }
  return {
    required,
    confirmed: required,
    provided: Boolean(confirmation),
    codes: overrides.map(item => item.code),
  };
}

function executionAuditTargets(planTargets = [], registryTargets = new Map()) {
  return planTargets
    .map(target => registryTargets.get(target.id))
    .filter(Boolean);
}

function sameNormalizedUrl(a, b) {
  const left = normalizeUrl(a);
  const right = normalizeUrl(b);
  if (!left || !right) return String(a || '') === String(b || '');
  return left.dedupeKey === right.dedupeKey;
}

function validateTargetAgainstRegistry(target, registryEntry, opts = {}) {
  if (!registryEntry) {
    return { ok: false, reason: 'target_missing_from_registry' };
  }

  const registryMode = registryEntry.submission?.mode || '';
  const registryUrl = registryEntry.submit_url || '';
  if (!sameNormalizedUrl(target.submit_url, registryUrl)) {
    return {
      ok: false,
      reason: 'target_submit_url_changed_in_registry',
      registry_submit_url: registryUrl,
    };
  }

  if (registryMode !== target.mode) {
    return {
      ok: false,
      reason: `target_mode_changed_in_registry:${target.mode || 'unknown'}->${registryMode || 'unknown'}`,
      registry_mode: registryMode,
    };
  }

  return canExecuteTarget({ ...target, mode: registryMode }, opts);
}

function canExecuteTarget(target, opts = {}) {
  if (SAFE_EXECUTION_MODES.has(target.mode)) return { ok: true, reason: '' };
  if (target.mode === 'auto_candidate' && opts.allowAutoCandidate) {
    return { ok: true, reason: 'auto_candidate_allowed_explicitly' };
  }
  if (target.mode === 'assisted' && opts.assisted) {
    if (opts.engine && opts.engine !== 'playwright') {
      return {
        ok: false,
        reason: `assisted_auth_requires_playwright:${opts.engine}`,
      };
    }
    const status = authProfileStatus(opts.authProfile || target.id || 'default', opts);
    if (!status.exists) {
      return {
        ok: false,
        reason: `assisted_auth_profile_missing:${status.profile}`,
      };
    }
    return {
      ok: true,
      reason: 'assisted_allowed_explicitly',
      auth_profile: status.profile,
      auth_state_path: status.path,
    };
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
  const artifactsDir = opts.artifacts || defaultArtifactsDir(planPath);
  const state = loadRunnerState(statePath, plan);
  const execute = Boolean(opts.execute);
  const delayMs = parseMs(opts.delay, 60000);
  const limit = Number.parseInt(opts.limit || plan.targets?.length || 0, 10);
  const max = Number.isFinite(limit) && limit > 0 ? limit : plan.targets.length;
  const plannedTargets = (plan.targets || []).slice(0, max);
  const registry = registryTargetMap(plan, opts);
  const executionOverrides = execute ? requestedExecutionOverrides(opts) : [];
  const controlledTest = execute
    ? assertControlledTestConfirmation(opts, executionOverrides)
    : { required: false, confirmed: false, provided: false, codes: [] };
  const submitFn = opts.submitFn || submit;
  const config = execute
    ? opts.configObject || await loadConfig({
      ...opts,
      configPath: opts.config || opts.productConfig,
      requireProduct: true,
    })
    : null;
  if (config && opts.engine) config._engine = opts.engine;

  let readiness = null;
  if (execute && config) {
    readiness = opts.skipReadinessCheck
      ? validateProductReadiness(config, { level: opts.readinessLevel || 'automation' })
      : assertProductReadiness(config, { level: opts.readinessLevel || 'automation' });
  }

  let targetAudit = null;
  if (execute && !opts.skipTargetAudit) {
    targetAudit = auditTargets(executionAuditTargets(plannedTargets, registry.targets));
    if (!targetAudit.ok) {
      const error = new Error(`Target audit failed with ${targetAudit.summary.blockers} blocker(s). Run "targets audit" for details or use --skip-target-audit only for controlled tests.`);
      error.report = targetAudit;
      throw error;
    }
  }

  const summary = {
    plan: planPath,
    execute,
    state: statePath,
    results: resultsPath,
    artifacts: artifactsDir,
    registry: registry.registryPath,
    readiness: readiness
      ? { ok: readiness.ok, level: readiness.level, skipped: Boolean(opts.skipReadinessCheck) }
      : null,
    target_audit: execute
      ? auditSummary(targetAudit, Boolean(opts.skipTargetAudit))
      : null,
    execution_overrides: execute
      ? controlledTest
      : null,
    processed: 0,
    skipped: 0,
    submitted: 0,
    failed: 0,
  };

  if (execute) {
    ensureDir(artifactsDir);
    writeArtifactJson(join(artifactsDir, 'run-readiness.json'), {
      readiness_skipped: Boolean(opts.skipReadinessCheck),
      report: readiness,
    });
    writeArtifactJson(join(artifactsDir, 'run-target-audit.json'), {
      target_audit_skipped: Boolean(opts.skipTargetAudit),
      report: targetAudit,
    });
    writeArtifactJson(join(artifactsDir, 'run-execution-overrides.json'), {
      controlled_test: controlledTest,
      overrides: executionOverrides,
    });
  }

  saveRunnerState(statePath, state);
  ensureJsonlFile(resultsPath);

  for (const target of plannedTargets) {
    const item = state.items.find(entry => entry.id === target.id);
    if (item && isTerminalStatus(item.status) && !opts.retry) {
      summary.skipped++;
      continue;
    }

    const registryEntry = registry.targets.get(target.id);
    const executable = validateTargetAgainstRegistry(target, registryEntry, opts);
    if (!executable.ok) {
      markItem(state, target.id, { status: 'skipped', last_error: executable.reason });
      saveRunnerState(statePath, state);
      appendJsonl(resultsPath, {
        target_id: target.id,
        status: 'skipped',
        reason: executable.reason,
        registry_mode: executable.registry_mode,
        registry_submit_url: executable.registry_submit_url,
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
        registry_mode: registryEntry?.submission?.mode || '',
        registry: registry.registryPath,
        at: new Date().toISOString(),
      });
      summary.processed++;
      continue;
    }

    markItem(state, target.id, { status: 'running', attempts: (item?.attempts || 0) + 1 });
    saveRunnerState(statePath, state);

    try {
      const targetArtifacts = targetArtifactDir(artifactsDir, target);
      ensureDir(targetArtifacts);
      writeArtifactJson(join(targetArtifacts, 'target.json'), {
        plan_target: target,
        registry_target: registryEntry || null,
        execution_gate: executable,
      });
      const executionConfig = executable.auth_state_path
        ? configWithAuthProfile(config, executable.auth_profile, opts)
        : config;
      const submission = await submitFn(target.submit_url, {
        ...opts,
        config: executionConfig,
        target,
        registryTarget: registryEntry,
        artifactDir: targetArtifacts,
      });
      const classified = submission?.status
        ? { status: submission.status, reasons: submission.reasons || [] }
        : classifySubmissionResult({ confirmation: 'submitted' });
      const listingExtraction = extractListingCandidates(submission, {
        submitUrl: target.submit_url,
        target,
        registryTarget: registryEntry,
        product: executionConfig.product,
      });
      markItem(state, target.id, { status: classified.status });
      writeArtifactJson(join(targetArtifacts, 'submission-result.json'), {
        submission,
        classified,
        listing_extraction: listingExtraction,
      });
      const resultRow = {
        target_id: target.id,
        status: classified.status,
        submit_url: target.submit_url,
        confirmation: submission?.confirmation || '',
        final_url: submission?.url || '',
        listing_url: listingExtraction.best?.url || '',
        listing_url_confidence: listingExtraction.best?.confidence || 0,
        listing_url_source: listingExtraction.best?.source || '',
        listing_url_candidates: listingExtraction.candidates,
        error: submission?.error || '',
        artifact_dir: targetArtifacts,
        at: new Date().toISOString(),
      };
      appendJsonl(resultsPath, resultRow);
      const registryUpdate = updateRegistryWithSubmissionResult(resultRow, {
        registry: registry.registryPath,
      });
      writeArtifactJson(join(targetArtifacts, 'registry-submission-update.json'), registryUpdate);
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
