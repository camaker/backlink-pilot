# Cross-Domain Final URL Decisions

Generated: 2026-05-29T13:18:03.962Z

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

## Read-Only Evidence Pack

Before editing decisions, collect GET-only evidence and generate the manual review pack. These commands do not log in, submit, or write the registry:

```powershell
node src/cli.js targets cross-domain-final-url-evidence backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-review.csv --output backlink-url/assisted-submission-pack/cross-domain-final-url-evidence.csv --json-output backlink-url/assisted-submission-pack/cross-domain-final-url-evidence.json
node src/cli.js targets cross-domain-final-url-manual-pack backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-review.csv --evidence backlink-url/assisted-submission-pack/cross-domain-final-url-evidence.csv --suggestions backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-suggestions.csv --output-dir backlink-url/assisted-submission-pack
node src/cli.js targets cross-domain-final-url-decision-draft backlink-url/assisted-submission-pack/cross-domain-final-url-manual-review.csv --output-dir backlink-url/assisted-submission-pack
```

## Validation Command

```powershell
node src/cli.js targets validate-cross-domain-final-url-decisions backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-decisions.csv --fail-on-blockers
```

## Dry-Run Patch Preview

Only after validation passes, generate a registry patch preview. This command still does not write the registry and does not authorize submission:

```powershell
node src/cli.js targets apply-cross-domain-final-url-decisions backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-decisions.csv --registry resources/targets.canonical.yaml --output backlink-url/assisted-submission-pack/cross-domain-final-url-patch-preview.json
```

## Controlled Registry Write

Only `skip`, `rescout_target_domain`, and `keep_blocked` can be written by the controlled gate. `allow_external_host_after_review` and `replace_submit_url` remain preview-only until separate evidence and rescout steps pass.

```powershell
node src/cli.js targets apply-cross-domain-final-url-decisions backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-decisions.csv --registry resources/targets.canonical.yaml --write-registry --output backlink-url/assisted-submission-pack/cross-domain-final-url-write-report.json
```

## Files

- Suggestions: backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-suggestions.md
- Decision CSV: backlink-url/submission-materials/assisted-xtimer/cross-domain-final-url-decisions.csv
