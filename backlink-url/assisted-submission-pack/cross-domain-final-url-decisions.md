# Cross-Domain Final URL Decisions

Generated: 2026-05-23T09:50:24.997Z

Policy: this is an editable human decision template. It does not approve automation by itself, does not write the registry, and does not authorize real submissions.

## Allowed Review Decisions

- `skip`: mark the target as not worth pursuing unless a replacement source is found.
- `rescout_target_domain`: keep blocked and manually re-check the target-domain submit URL first.
- `allow_external_host_after_review`: only for verified form-provider aliases or parent-brand submit domains.
- `replace_submit_url`: replace the submit URL after independently verifying a current official submit surface.
- `keep_blocked`: intentionally leave the row blocked without further action.

## Hard Validation Rules

1. `review_decision`, `reviewer`, and substantive `review_notes` are required for reviewed rows.
2. `allow_external_host_after_review` requires an eligible classification, matching `allowed_host`, and an `evidence_url`.
3. Parked domains, platform errors, unrelated redirects, stale scout evidence, and affiliate redirects are not eligible for allowlisting.
4. `replace_submit_url` requires `replacement_submit_url` and `evidence_url`.
5. `automation_policy` must remain `no_execution_from_decision_file`.
6. This decision file is still not an execution plan; it only gates future registry edits.

## Validation Command

```powershell
node src/cli.js targets validate-cross-domain-final-url-decisions backlink-url/assisted-submission-pack/cross-domain-final-url-decisions.csv --fail-on-blockers
```

## Dry-Run Patch Preview

Only after validation passes, generate a registry patch preview. This command still does not write the registry and does not authorize submission:

```powershell
node src/cli.js targets apply-cross-domain-final-url-decisions backlink-url/assisted-submission-pack/cross-domain-final-url-decisions.csv --registry resources/targets.canonical.yaml --output backlink-url/assisted-submission-pack/cross-domain-final-url-patch-preview.json
```

## Files

- Suggestions: backlink-url/assisted-submission-pack/cross-domain-final-url-suggestions.md
- Decision CSV: backlink-url/assisted-submission-pack/cross-domain-final-url-decisions.csv
