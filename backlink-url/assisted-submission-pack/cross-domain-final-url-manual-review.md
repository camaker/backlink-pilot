# Cross-Domain Final URL Manual Review Pack

Generated: 2026-05-23T10:27:11.488Z

Policy: this pack is read-only human review support. It does not approve targets, does not write the registry, does not log in, does not submit, and does not promote anything to runnable automation.

## Inputs

- Review queue: backlink-url/assisted-submission-pack/cross-domain-final-url-review.csv
- Suggestions: backlink-url/assisted-submission-pack/cross-domain-final-url-suggestions.csv
- Evidence: backlink-url/assisted-submission-pack/cross-domain-final-url-evidence.csv

## Summary

- Rows: 7
- Controlled-write possible after manual review: 7
- Preview-only rows: 0

### Recommended Decisions

| Decision | Count |
|---|---:|
| skip | 3 |
| keep_blocked | 2 |
| rescout_target_domain | 2 |

### Manual Buckets

| Bucket | Count |
|---|---:|
| skip_candidate_after_manual_confirmation | 3 |
| keep_blocked_manual_review | 2 |
| target_domain_rescout_required | 2 |

## Review Rows

| Target ID | Domain | Classification | Recommended Review Decision | Write Allowed | Risk | Manual Bucket |
|---|---|---|---|---|---|---|
| ai-tools-for-marketing | airadar.getinference.com | platform_custom_domain_error | skip | yes | high | skip_candidate_after_manual_confirmation |
| intersys-ai | intersys.ai | domain_for_sale_or_parked | skip | yes | high | skip_candidate_after_manual_confirmation |
| aigc | aigc.cn | stale_scout_evidence_from_other_directory | rescout_target_domain | yes | high | target_domain_rescout_required |
| draeno-io | draeno.io | unrelated_external_submit_endpoint | rescout_target_domain | yes | high | target_domain_rescout_required |
| ai-aiopenminds | jinshuju.net | possible_form_provider_alias | keep_blocked | yes | high | keep_blocked_manual_review |
| prime-indies | primeindies.com | affiliate_or_unrelated_redirect | skip | yes | high | skip_candidate_after_manual_confirmation |
| supertools | supertools.therundown.ai | possible_parent_brand_submit_domain | keep_blocked | yes | medium | keep_blocked_manual_review |

## Hard Rules

1. Use this pack only to guide manual review; do not execute submissions from it.
2. `allow_external_host_after_review` and `replace_submit_url` remain preview-only and cannot be written by the controlled registry gate.
3. Only `skip`, `rescout_target_domain`, and `keep_blocked` can be written after the decision CSV passes validation with reviewer notes.
4. Any future runnable promotion still requires fresh scout evidence, registry audit, product readiness, and target audit.
5. Login, OAuth, CAPTCHA, Cloudflare, payment, reciprocal-link, file-upload, and dynamic ambiguity remain blockers.

## Files

- Manual review CSV: backlink-url/assisted-submission-pack/cross-domain-final-url-manual-review.csv
- Manual review JSON: backlink-url/assisted-submission-pack/cross-domain-final-url-manual-review.json
