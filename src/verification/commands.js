import { verifyBacklink } from './backlink.js';
import { verifyResults } from './results.js';

export async function verifyBacklinkCommand(listingUrl, opts = {}) {
  if (!opts.productUrl) {
    throw new Error('--product-url is required');
  }

  const result = await verifyBacklink(listingUrl, opts.productUrl, opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`Listing: ${result.listing_url}`);
  console.log(`Product: ${result.product_url}`);
  console.log(`HTTP: ${result.http_status}`);
  console.log(`Status: ${result.status}`);
  console.log(`Backlink found: ${result.backlink_found ? 'yes' : 'no'}`);
  if (result.backlink) {
    console.log(`Href: ${result.backlink.href}`);
    console.log(`Rel: ${result.backlink.rel.join(' ') || '(none)'}`);
    console.log(`Type: ${result.backlink.link_type}`);
    console.log(`Anchor: ${result.backlink.anchor_text}`);
  }
  if (result.error) console.log(`Error: ${result.error}`);
  return result;
}

export async function verifyResultsCommand(resultsPath, opts = {}) {
  const summary = await verifyResults(resultsPath, opts);
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  console.log(`Results: ${summary.results}`);
  console.log(`Output: ${summary.output}`);
  console.log(`Checked: ${summary.checked}`);
  console.log(`Verified: ${summary.verified}`);
  console.log(`Not found: ${summary.not_found}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Failed: ${summary.failed}`);
  return summary;
}
