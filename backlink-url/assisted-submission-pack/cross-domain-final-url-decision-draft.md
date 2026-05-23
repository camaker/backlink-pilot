# Cross-Domain Final URL Decision Draft

Generated: 2026-05-23T10:36:41.917Z

Policy: this is an editable human decision draft. It does not approve targets, does not write the registry, does not log in, does not submit, and intentionally leaves `review_decision` blank.

## Inputs

- Manual review CSV: backlink-url/assisted-submission-pack/cross-domain-final-url-manual-review.csv

## Summary

- Rows: 7
- Rows requiring human review: 7
- Controlled-write possible after manual review: 7
- Preview-only rows: 0

### Suggested Decisions

| Decision | Count |
|---|---:|
| skip | 3 |
| keep_blocked | 2 |
| rescout_target_domain | 2 |

## Draft Rows

| Target ID | Domain | Classification | Suggested Decision | Review Decision | Write Allowed | Risk |
|---|---|---|---|---|---|---|
| ai-tools-for-marketing | airadar.getinference.com | platform_custom_domain_error | skip | (blank) | yes | high |
| intersys-ai | intersys.ai | domain_for_sale_or_parked | skip | (blank) | yes | high |
| aigc | aigc.cn | stale_scout_evidence_from_other_directory | rescout_target_domain | (blank) | yes | high |
| draeno-io | draeno.io | unrelated_external_submit_endpoint | rescout_target_domain | (blank) | yes | high |
| ai-aiopenminds | jinshuju.net | possible_form_provider_alias | keep_blocked | (blank) | yes | high |
| prime-indies | primeindies.com | affiliate_or_unrelated_redirect | skip | (blank) | yes | high |
| supertools | supertools.therundown.ai | possible_parent_brand_submit_domain | keep_blocked | (blank) | yes | medium |

## Human Fill Requirements

1. Open each target manually in a normal browser before editing `review_decision`.
2. Fill `review_decision`, `reviewer`, `reviewed_at`, and substantive `review_notes` before validation can pass.
3. Do not copy suggested decisions blindly; they are evidence-guided hints, not approval.
4. `allow_external_host_after_review` and `replace_submit_url` remain preview-only for registry writes.
5. After any safe downgrade write, rerun registry audit and rescout before any future runnable promotion.

## Validation

This draft should fail strict validation until a human fills the review fields:

```powershell
node src/cli.js targets validate-cross-domain-final-url-decisions backlink-url/assisted-submission-pack/cross-domain-final-url-decision-draft.csv --fail-on-blockers
```

## Files

- Draft CSV: backlink-url/assisted-submission-pack/cross-domain-final-url-decision-draft.csv
- Draft JSON: backlink-url/assisted-submission-pack/cross-domain-final-url-decision-draft.json
