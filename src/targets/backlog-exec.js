const BACKLOG_EXEC_ALLOWED_PREFIXES = [
  ['node', 'src/cli.js', 'targets', 'validate-coverage-review-batch'],
  ['node', 'src/cli.js', 'targets', 'promote-coverage-review-batch'],
  ['node', 'src/cli.js', 'targets', 'validate-pricing-review-decisions'],
  ['node', 'src/cli.js', 'targets', 'merge-pricing-review-decision-batch'],
  ['node', 'src/cli.js', 'targets', 'auth-workflow-refresh'],
  ['node', 'src/cli.js', 'targets', 'backlog-lane'],
  ['node', 'src/cli.js', 'targets', 'backlog-worker'],
];

const BACKLOG_EXEC_BLOCKED_PREFIXES = [
  ['node', 'src/cli.js', 'auth', 'login'],
  ['node', 'src/cli.js', 'scout'],
  ['node', 'src/cli.js', 'submit'],
  ['node', 'src/cli.js', 'pipeline', '--execute'],
  ['node', 'src/cli.js', 'run-plan', '--execute'],
];

function countBy(items = [], keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function parseBacklogStepKinds(value) {
  if (Array.isArray(value)) return value.flatMap(item => parseBacklogStepKinds(item));
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function shellSplit(command = '') {
  const input = String(command || '').trim();
  if (!input) return [];
  const tokens = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = index > 0 ? input[index - 1] : '';
    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = '';
      } else if (char === '\\' && quote === '"' && input[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if ((char === '"' || char === '\'') && previous !== '\\') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (quote) {
    throw new Error(`unclosed quote in command: ${command}`);
  }
  if (current) tokens.push(current);
  return tokens;
}

function startsWithSequence(parts = [], prefix = []) {
  if (parts.length < prefix.length) return false;
  return prefix.every((value, index) => parts[index] === value);
}

export function isBacklogCommandBlocked(parts = []) {
  return BACKLOG_EXEC_BLOCKED_PREFIXES.some(prefix =>
    startsWithSequence(parts, prefix)
      || prefix.some(flag => flag.startsWith('--') && parts.includes(flag))
  );
}

export function classifyBacklogCommandParts(parts = [], step = {}) {
  if (!parts.length) {
    return {
      allowed: false,
      reason: 'empty_command',
      policy: 'blocked',
      writes_network: false,
      writes_registry: false,
      requires_human_browser: false,
    };
  }
  if (isBacklogCommandBlocked(parts)) {
    return {
      allowed: false,
      reason: 'blocked_prefix_or_flag',
      policy: 'blocked',
      writes_network: true,
      writes_registry: parts.includes('--update-registry') || parts.includes('--write-registry'),
      requires_human_browser: true,
    };
  }
  const matchedPrefix = BACKLOG_EXEC_ALLOWED_PREFIXES.find(prefix => startsWithSequence(parts, prefix));
  if (!matchedPrefix) {
    return {
      allowed: false,
      reason: 'command_not_allowlisted',
      policy: 'blocked',
      writes_network: false,
      writes_registry: false,
      requires_human_browser: false,
    };
  }

  const kind = String(step.step_kind || '').trim();
  const writesRegistry = parts.includes('--update-registry') || parts.includes('--write-registry');
  const writesNetwork = false;
  const requiresHumanBrowser = kind === 'open';

  if (writesRegistry) {
    return {
      allowed: false,
      reason: 'registry_write_not_allowed',
      policy: 'blocked',
      writes_network: writesNetwork,
      writes_registry: true,
      requires_human_browser: requiresHumanBrowser,
    };
  }

  if (matchedPrefix[3] === 'promote-coverage-review-batch' && !parts.includes('--dry-run')) {
    return {
      allowed: false,
      reason: 'coverage_promotion_requires_dry_run',
      policy: 'blocked',
      writes_network: false,
      writes_registry: false,
      requires_human_browser: false,
    };
  }

  return {
    allowed: true,
    reason: '',
    policy: matchedPrefix[3] === 'auth-workflow-refresh' || matchedPrefix[3] === 'merge-pricing-review-decision-batch'
      ? 'allowlisted_local_artifact_write'
      : 'allowlisted_local_safe',
    writes_network: writesNetwork,
    writes_registry: false,
    requires_human_browser: requiresHumanBrowser,
  };
}

export function planBacklogStep(step = {}) {
  const command = String(step.command || '').trim();
  const parts = shellSplit(command);
  const classification = classifyBacklogCommandParts(parts, step);
  return {
    step_id: step.step_id || '',
    step_kind: step.step_kind || '',
    title: step.title || '',
    command,
    command_parts: parts,
    default_selected: Boolean(step.default_selected),
    depends_on_step_ids: Array.isArray(step.depends_on_step_ids) ? step.depends_on_step_ids.filter(Boolean) : [],
    ...classification,
  };
}

export function selectBacklogSteps(steps = [], selectedKinds = []) {
  const kindFilter = new Set(parseBacklogStepKinds(selectedKinds));
  return steps.filter(step => {
    if (!step?.command) return false;
    if (kindFilter.size > 0) return kindFilter.has(step.step_kind);
    return Boolean(step.default_selected);
  });
}

function dependencySatisfied(result = {}, dryRun = false) {
  if (!result) return false;
  if (dryRun) return result.status === 'dry_run' || result.status === 'executed';
  return result.status === 'executed';
}

function blockedResult(stepPlan = {}, opts = {}, reason = 'blocked', extra = {}) {
  return {
    ...stepPlan,
    dry_run: Boolean(opts.dryRun),
    executed: false,
    status: 'blocked',
    exit_code: null,
    stdout: '',
    stderr: '',
    reason,
    ...extra,
  };
}

function dryRunResult(stepPlan = {}) {
  return {
    ...stepPlan,
    dry_run: true,
    executed: false,
    status: 'dry_run',
    exit_code: null,
    stdout: '',
    stderr: '',
  };
}

function dependencyBlockersFor(stepPlan = {}, resultByStepId = new Map(), opts = {}) {
  const blockers = [];
  for (const dependencyId of stepPlan.depends_on_step_ids || []) {
    const dependencyResult = resultByStepId.get(dependencyId);
    if (!dependencyResult) {
      blockers.push({
        step_id: dependencyId,
        reason: 'dependency_not_selected',
      });
      continue;
    }
    if (!dependencySatisfied(dependencyResult, Boolean(opts.dryRun))) {
      blockers.push({
        step_id: dependencyId,
        reason: dependencyResult.reason || dependencyResult.status || 'dependency_not_satisfied',
      });
    }
  }
  return blockers;
}

export function runBacklogStepPlans(stepPlans = [], opts = {}) {
  const resultByStepId = new Map();
  const results = [];

  for (const stepPlan of stepPlans) {
    let result;
    if (!stepPlan.allowed) {
      result = blockedResult(stepPlan, opts, stepPlan.reason || 'blocked');
    } else {
      const dependencyBlockers = dependencyBlockersFor(stepPlan, resultByStepId, opts);
      if (dependencyBlockers.length) {
        result = blockedResult(stepPlan, opts, 'blocked_dependency', {
          dependency_blockers: dependencyBlockers,
        });
      } else if (opts.dryRun) {
        result = dryRunResult(stepPlan);
      } else {
        if (typeof opts.executeAllowedStep !== 'function') {
          throw new Error('executeAllowedStep callback is required when dryRun is false');
        }
        result = {
          ...stepPlan,
          ...opts.executeAllowedStep(stepPlan, opts),
        };
      }
    }
    results.push(result);
    if (stepPlan.step_id) {
      resultByStepId.set(stepPlan.step_id, result);
    }
  }

  return results;
}

export function summarizeBacklogExecutionResults(results = []) {
  return {
    total_steps: results.length,
    allowed_steps: results.filter(item => item.allowed).length,
    runnable_steps: results.filter(item => item.status === 'dry_run' || item.status === 'executed').length,
    blocked_steps: results.filter(item => item.status === 'blocked').length,
    blocked_dependency_steps: results.filter(item => item.reason === 'blocked_dependency').length,
    dry_run_steps: results.filter(item => item.status === 'dry_run').length,
    executed_steps: results.filter(item => item.status === 'executed').length,
    failed_steps: results.filter(item => item.status === 'failed').length,
  };
}

export function buildBacklogOperatorSummary(items = []) {
  const blockedItems = items.filter(item => item.status === 'blocked' || (!('status' in item) && !item.allowed));
  const runnableItems = items.filter(item =>
    item.status === 'dry_run' || item.status === 'executed' || (!('status' in item) && item.allowed)
  );
  const failedItems = items.filter(item => item.status === 'failed');
  const disposition = items.length === 0
    ? 'manual_only'
    : failedItems.length > 0
      ? (runnableItems.length > 0 ? 'mixed' : 'failed')
      : runnableItems.length > 0
        ? (blockedItems.length > 0 ? 'mixed' : 'safe_local_exec')
        : (blockedItems.length > 0 ? 'blocked' : 'manual_only');

  return {
    disposition,
    selected_steps: items.length,
    runnable_steps: runnableItems.length,
    blocked_steps: blockedItems.length,
    failed_steps: failedItems.length,
    local_safe_steps: items.filter(item => item.policy === 'allowlisted_local_safe').length,
    local_artifact_write_steps: items.filter(item => item.policy === 'allowlisted_local_artifact_write').length,
    requires_human_browser_steps: items.filter(item => item.requires_human_browser).length,
    writes_network_steps: items.filter(item => item.writes_network).length,
    writes_registry_steps: items.filter(item => item.writes_registry).length,
    by_step_kind: countBy(items, item => item.step_kind || 'unknown'),
    blocked_reasons: countBy(blockedItems, item => item.reason || 'blocked'),
  };
}

export function backlogDispositionRank(disposition = '') {
  const normalized = String(disposition || '').trim();
  if (normalized === 'safe_local_exec') return 0;
  if (normalized === 'failed') return 1;
  if (normalized === 'mixed') return 2;
  if (normalized === 'manual_only') return 3;
  if (normalized === 'blocked') return 4;
  return 9;
}
