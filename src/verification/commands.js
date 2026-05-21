import { verifyBacklink } from './backlink.js';

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
