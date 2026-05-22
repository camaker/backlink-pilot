import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

function nowIso() {
  return new Date().toISOString();
}

export function defaultStateForPlan(plan = {}) {
  return {
    version: 1,
    plan_id: plan.plan_id || plan.created_at || nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
    items: (plan.targets || []).map(target => ({
      id: target.id,
      status: target.status || 'queued',
      attempts: 0,
      last_error: '',
      updated_at: nowIso(),
    })),
  };
}

export function loadRunnerState(path, plan) {
  if (!path || !existsSync(path)) return defaultStateForPlan(plan);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function saveRunnerState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...state, updated_at: nowIso() }, null, 2), 'utf-8');
}

export function defaultStatePath(planPath) {
  if (!planPath) return join('runs', 'state.json');
  return join(dirname(planPath), 'state.json');
}

export function getItemState(state, targetId) {
  let item = state.items.find(entry => entry.id === targetId);
  if (!item) {
    item = { id: targetId, status: 'queued', attempts: 0, last_error: '', updated_at: nowIso() };
    state.items.push(item);
  }
  return item;
}

export function markItem(state, targetId, updates) {
  const item = getItemState(state, targetId);
  Object.assign(item, updates, { updated_at: nowIso() });
  return item;
}

export function isTerminalStatus(status) {
  return [
    'submitted',
    'submitted_unverified',
    'pending_review',
    'accepted',
    'duplicate',
    'scouted',
    'scout_failed',
    'skipped',
    'failed',
    'terminal_failed',
  ].includes(String(status || ''));
}
