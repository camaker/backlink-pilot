# Cross-Domain Final URL Review Suggestions

Generated: 2026-05-23T10:23:11.819Z

Policy: this file is read-only guidance for human review. It does not approve targets, does not allowlist external hosts, does not log in, and does not authorize real submissions.

Rows: 7

| Target ID | Domain | Final Host | Classification | Confidence | Recommended Decision |
|---|---|---|---|---|---|
| ai-tools-for-marketing | airadar.getinference.com | bubble.io | platform_custom_domain_error | high | skip_until_directory_domain_recovers |
| intersys-ai | intersys.ai | afternic.com | domain_for_sale_or_parked | high | skip_or_replace_source |
| aigc | aigc.cn | ainavpro.com | stale_scout_evidence_from_other_directory | high | manual_rescout_target_domain_first |
| draeno-io | draeno.io | free-alan.com | unrelated_external_submit_endpoint | medium | manual_rescout_target_domain_first |
| ai-aiopenminds | jinshuju.net | jsj.top | possible_form_provider_alias | medium | manual_verify_then_allowlist_if_owner_confirmed |
| prime-indies | primeindies.com | banggood.com | affiliate_or_unrelated_redirect | high | skip_or_replace_source |
| supertools | supertools.therundown.ai | rundown.ai | possible_parent_brand_submit_domain | medium | manual_verify_then_allowlist_if_owner_confirmed |

## Required Manual Checks

1. Confirm the directory still exists and is a genuine fit for the product.
2. Confirm the final URL belongs to the same directory owner or an intentionally used form provider.
3. Confirm there is no CAPTCHA, OAuth, paywall, file upload, reciprocal-link requirement, or dynamic ambiguity before any automation promotion.
4. Add an explicit allowed host only after human review; never infer it from host similarity alone.
5. Skip parked domains, platform error pages, affiliate redirects, and unrelated submit endpoints.

## Files

- Source review queue: backlink-url/assisted-submission-pack/cross-domain-final-url-review.csv
- Suggestions CSV: backlink-url/assisted-submission-pack/cross-domain-final-url-suggestions.csv
