import { DEFAULT_REGISTRY_FILE, loadRegistry, saveRegistry } from '../targets/registry.js';

function nowIso() {
  return new Date().toISOString();
}

function backlinkSummary(result = {}) {
  if (!result.backlink) return null;
  return {
    href: result.backlink.href || '',
    rel: result.backlink.rel || [],
    link_type: result.backlink.link_type || '',
    anchor_text: result.backlink.anchor_text || '',
  };
}

function verificationStatus(result = {}) {
  if (result.status === 'backlink_verified') return 'verified';
  if (result.status === 'backlink_not_found') return 'not_found';
  if (result.status === 'skipped') return 'skipped';
  return 'failed';
}

function shouldReplaceBacklinkEvidence(target = {}, result = {}) {
  if (['backlink_verified', 'backlink_not_found'].includes(result.status)) return true;
  return !target.submission?.backlink_status;
}

export function applyVerificationResultToTarget(target = {}, result = {}) {
  const checkedAt = result.checked_at || result.at || nowIso();
  const backlink = backlinkSummary(result);
  const replaceBacklinkEvidence = shouldReplaceBacklinkEvidence(target, result);
  const existingSubmission = target.submission || {};

  return {
    ...target,
    submission: {
      ...existingSubmission,
      last_verified_at: checkedAt,
      backlink_status: replaceBacklinkEvidence
        ? verificationStatus(result)
        : existingSubmission.backlink_status,
      backlink_found: replaceBacklinkEvidence
        ? Boolean(result.backlink_found)
        : Boolean(existingSubmission.backlink_found),
      backlink_rel: replaceBacklinkEvidence
        ? backlink?.rel || []
        : existingSubmission.backlink_rel || [],
      backlink_type: replaceBacklinkEvidence
        ? backlink?.link_type || ''
        : existingSubmission.backlink_type || '',
      live_listing_url: replaceBacklinkEvidence
        ? result.listing_url || existingSubmission.live_listing_url || ''
        : existingSubmission.live_listing_url || '',
      verification_error: result.error || result.reason || '',
      verification_http_status: result.http_status || 0,
    },
    verification: {
      ...(target.verification || {}),
      checked_at: checkedAt,
      status: result.status || '',
      product_url: result.product_url || '',
      listing_url: result.listing_url || '',
      backlink,
      listing_url_source: result.listing_url_source || '',
      listing_url_confidence: result.listing_url_confidence || 0,
      error: result.error || '',
      reason: result.reason || '',
    },
    updated_at: nowIso(),
  };
}

function findTargetIndex(targets = [], result = {}) {
  return targets.findIndex(target =>
    (result.target_id && target.id === result.target_id) ||
    (result.submit_url && target.submit_url === result.submit_url) ||
    (result.registry_submit_url && target.submit_url === result.registry_submit_url)
  );
}

export function updateRegistryWithVerificationResult(result = {}, opts = {}) {
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

  registry.targets[index] = applyVerificationResultToTarget(registry.targets[index], result);
  saveRegistry(registry, registryPath);
  return {
    updated: true,
    target_id: registry.targets[index].id,
    registry: registryPath,
  };
}

export function updateRegistryWithVerificationResults(results = [], opts = {}) {
  const registryPath = opts.registry || DEFAULT_REGISTRY_FILE;
  const registry = loadRegistry(registryPath);
  const updates = [];
  let updated = 0;
  let skipped = 0;

  for (const result of results) {
    const index = findTargetIndex(registry.targets, result);
    if (index === -1) {
      skipped++;
      updates.push({
        updated: false,
        reason: 'target_not_found',
        target_id: result.target_id || '',
      });
      continue;
    }

    registry.targets[index] = applyVerificationResultToTarget(registry.targets[index], result);
    updated++;
    updates.push({
      updated: true,
      target_id: registry.targets[index].id,
      status: result.status || '',
    });
  }

  if (updated > 0) saveRegistry(registry, registryPath);

  return {
    registry: registryPath,
    updated,
    skipped,
    updates,
  };
}
