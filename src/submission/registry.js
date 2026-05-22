import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from '../targets/registry.js';

const SUBMISSION_ATTEMPT_STATUSES = new Set([
  'submitted',
  'submitted_unverified',
  'pending_review',
  'accepted',
  'duplicate',
]);

function nowIso() {
  return new Date().toISOString();
}

function hasSubmissionAttempt(status = '') {
  return SUBMISSION_ATTEMPT_STATUSES.has(String(status || ''));
}

function findTargetIndex(targets = [], result = {}) {
  return targets.findIndex(target =>
    (result.target_id && target.id === result.target_id) ||
    (result.submit_url && target.submit_url === result.submit_url) ||
    (result.registry_submit_url && target.submit_url === result.registry_submit_url)
  );
}

export function applySubmissionResultToTarget(target = {}, result = {}) {
  const attempted = hasSubmissionAttempt(result.status);
  const submittedAt = result.submitted_at || result.at || nowIso();
  const existingSubmission = target.submission || {};
  const listingConfidence = Number(result.listing_url_confidence || 0);

  return {
    ...target,
    submission: {
      ...existingSubmission,
      last_submitted_at: attempted
        ? submittedAt
        : existingSubmission.last_submitted_at || null,
      last_submission_status: result.status || existingSubmission.last_submission_status || '',
      last_submission_error: result.error || result.reason || '',
      last_submission_final_url: result.final_url || existingSubmission.last_submission_final_url || '',
      last_submission_confirmation: result.confirmation || existingSubmission.last_submission_confirmation || '',
      live_listing_url: result.listing_url || existingSubmission.live_listing_url || '',
      listing_url_confidence: listingConfidence || existingSubmission.listing_url_confidence || 0,
      listing_url_source: result.listing_url_source || existingSubmission.listing_url_source || '',
    },
    updated_at: nowIso(),
  };
}

export function updateRegistryWithSubmissionResult(result = {}, opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const index = findTargetIndex(registry.targets, result);

  if (index === -1) {
    return {
      updated: false,
      reason: 'target_not_found',
      target_id: result.target_id || '',
      registry: registryPath,
    };
  }

  registry.targets[index] = applySubmissionResultToTarget(registry.targets[index], result);
  saveRegistry(registry, registryPath);
  return {
    updated: true,
    target_id: registry.targets[index].id,
    status: result.status || '',
    submitted: hasSubmissionAttempt(result.status),
    registry: registryPath,
  };
}
