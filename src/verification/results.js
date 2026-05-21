import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { verifyBacklink } from './backlink.js';

const DEFAULT_MIN_LISTING_CONFIDENCE = 0.75;

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function appendJsonl(path, entry) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: 'a', encoding: 'utf-8' });
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

export async function verifyResults(resultsPath, opts = {}) {
  if (!resultsPath) throw new Error('results path is required');
  if (!opts.productUrl) throw new Error('product URL is required');

  const rows = readJsonl(resultsPath);
  const output = opts.output || join(dirname(resultsPath), 'verification-results.jsonl');
  const limit = Number.parseInt(opts.limit || rows.length, 10);
  const max = Number.isFinite(limit) && limit > 0 ? limit : rows.length;
  const verifyFn = opts.verifyFn || verifyBacklink;
  const minConfidence = Number(opts.minListingConfidence || DEFAULT_MIN_LISTING_CONFIDENCE);
  const summary = {
    results: resultsPath,
    output,
    checked: 0,
    skipped: 0,
    verified: 0,
    not_found: 0,
    failed: 0,
  };

  for (const row of rows.slice(0, max)) {
    const candidates = Array.isArray(row.listing_url_candidates) ? row.listing_url_candidates : [];
    const candidate = candidates.find(item => Number(item.confidence || 0) >= minConfidence);
    const listingUrl = row.listing_url || candidate?.url || '';
    if (!listingUrl) {
      appendJsonl(output, {
        target_id: row.target_id,
        status: 'skipped',
        reason: candidates.length ? 'no_high_confidence_listing_url' : 'missing_listing_url',
        listing_url_candidates: candidates,
        min_listing_confidence: minConfidence,
        at: new Date().toISOString(),
      });
      summary.skipped++;
      continue;
    }

    const result = await verifyFn(listingUrl, opts.productUrl, opts);
    appendJsonl(output, {
      target_id: row.target_id,
      submission_status: row.status,
      listing_url_source: row.listing_url ? 'result_listing_url' : candidate?.source || '',
      listing_url_confidence: row.listing_url ? row.listing_url_confidence || 1 : candidate?.confidence || 0,
      ...result,
    });

    summary.checked++;
    if (result.status === 'backlink_verified') summary.verified++;
    else if (result.status === 'backlink_not_found') summary.not_found++;
    else summary.failed++;
  }

  return summary;
}
