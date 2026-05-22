import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inferTargetMode } from '../src/targets/classify.js';
import { normalizeUrl } from '../src/targets/normalize.js';
import { auditTargets, formatAuditReport } from '../src/targets/audit.js';
import {
  applyCoverageReviewQueue,
  buildCoverageReviewEvidence,
  buildCoverageReviewBatch,
  buildCoverageReport,
  buildCoverageReviewQueue,
  buildCoverageReviewSuggestions,
  coverageCandidatesCsv,
  coverageReviewEvidenceCsv,
  coverageReviewBatchCsv,
  coverageReviewBatchMarkdown,
  coverageReviewQueueCsv,
  coverageReviewSuggestionsCsv,
  coverageReviewCsv,
  importCoverageReview,
  promoteCoverageReviewBatch,
  validateCoverageReviewBatch,
  validateCoverageReview,
  writeCoverageReviewPromotionReport,
  writeCoverageReviewEvidence,
  writeCoverageReviewSuggestions,
  writeCoverageReviewBatch,
  writeCoverageReviewQueue,
  writeCoverageCandidatesCsv,
  writeCoverageReport,
  writeCoverageReviewCsv,
} from '../src/targets/coverage.js';
import {
  dedupeRegistryIds,
  filterTargets,
  importTargets,
  loadRegistry,
  loadTargetsFromFile,
  mergeTargets,
  registryStats,
} from '../src/targets/registry.js';
import { buildSubmissionPlan } from '../src/planner/plan.js';
import { buildScoutQueuePlan } from '../src/planner/plan.js';
import { parseCsv } from '../src/targets/importers/csv.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-targets-'));
}

describe('target URL normalization', () => {
  it('strips tracking params, hashes, default ports, and normalizes trailing slashes', () => {
    const normalized = normalizeUrl('HTTPS://WWW.Example.COM:443/submit/?utm_source=x&ref=abc&b=2&a=1#top');

    assert.equal(normalized.url, 'https://www.example.com/submit?a=1&b=2');
    assert.equal(normalized.domain, 'example.com');
    assert.equal(normalized.dedupeKey, 'example.com/submit?a=1&b=2');
  });

  it('accepts bare domains and rejects non-http protocols', () => {
    assert.equal(normalizeUrl('example.com/path').url, 'https://example.com/path');
    assert.equal(normalizeUrl('mailto:test@example.com'), null);
  });
});

describe('target classification', () => {
  it('treats static auto=yes as auto_candidate, not auto_safe', () => {
    const result = inferTargetMode({
      auto: 'yes',
      type: 'form',
      domain: 'example.com',
      submit_url: 'https://example.com/submit',
    });

    assert.equal(result.mode, 'auto_candidate');
    assert.equal(result.reason, 'static_auto_yes_needs_scout');
  });

  it('keeps strategic community/review surfaces manual', () => {
    const result = inferTargetMode({
      domain: 'producthunt.com',
      submit_url: 'https://www.producthunt.com/posts/new',
    });

    assert.equal(result.mode, 'manual_strategic');
  });

  it('skips paid or dead targets', () => {
    assert.equal(inferTargetMode({ status: 'dead' }).mode, 'skip');
    assert.equal(inferTargetMode({ pricing: 'Paid' }).reason, 'paid_or_paywalled');
  });
});

describe('target registry import and dedupe', () => {
  it('imports YAML target groups into canonical targets', () => {
    const dir = tempDir();
    try {
      const file = join(dir, 'targets.yaml');
      writeFileSync(file, `
group_one:
  - name: Example Submit
    submit_url: https://example.com/submit?utm_source=chatgpt&ref=x
    type: form
    auto: yes
    lang: en
`);

      const targets = loadTargetsFromFile(file, { source: 'test-yaml' });
      assert.equal(targets.length, 1);
      assert.equal(targets[0].submit_url, 'https://example.com/submit');
      assert.equal(targets[0].source[0], 'test-yaml');
      assert.equal(targets[0].submission.mode, 'auto_candidate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports CSV rows and maps common submission columns', () => {
    const dir = tempDir();
    try {
      const file = join(dir, 'notion.csv');
      writeFileSync(file, `"status","title","pricing","submission_link"
"free","G2","Free","https://www.g2.com/products/new?ref=abc"
`);

      const targets = loadTargetsFromFile(file, { source: 'notion' });
      assert.equal(targets.length, 1);
      assert.equal(targets[0].name, 'G2');
      assert.equal(targets[0].id, 'g2-com');
      assert.equal(targets[0].external_id, undefined);
      assert.equal(targets[0].pricing, 'free');
      assert.equal(targets[0].submit_url, 'https://www.g2.com/products/new');
      assert.equal(targets[0].submission.mode, 'manual_strategic');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps opaque external IDs out of canonical IDs', () => {
    const dir = tempDir();
    try {
      const file = join(dir, 'notion.csv');
      writeFileSync(file, `"id","title","submission_link"
"14368f41-8f50-81eb-bfda-eab66aa93110","Source Forge","https://sourceforge.net/software/vendors/new?ref=abc"
`);

      const targets = loadTargetsFromFile(file, { source: 'notion' });
      assert.equal(targets[0].id, 'source-forge-sourceforge-net');
      assert.equal(targets[0].external_id, '14368f41-8f50-81eb-bfda-eab66aa93110');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('merges duplicate normalized URLs while preserving sources', () => {
    const a = loadTargetsFromFileFromRows([
      { name: 'A', submit_url: 'https://example.com/submit?ref=one', source: 'a' },
    ]);
    const b = loadTargetsFromFileFromRows([
      { name: 'B', submit_url: 'https://www.example.com/submit?utm_source=x', source: 'b' },
    ]);

    const merged = mergeTargets(a, b);
    assert.equal(merged.targets.length, 1);
    assert.deepEqual(merged.targets[0].source.sort(), ['a', 'b']);
  });

  it('creates unique canonical IDs for same-named targets on different domains', () => {
    const targets = loadTargetsFromFileFromRows([
      { id: 'aigc', name: 'AIGC', submit_url: 'https://aigc.cn/submit', source: 'a' },
      { id: 'aigc', name: 'AIGC', submit_url: 'https://aigclist.com/submit', source: 'b' },
    ]);

    assert.deepEqual(targets.map(target => target.id), ['aigc-aigc-cn', 'aigc-aigclist-com']);
  });

  it('renames duplicate persisted target IDs without dropping existing evidence', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: github-com
    domain: github.com
    submit_url: https://github.com/org/a/issues
    normalized_key: github.com/org/a/issues
    submission:
      mode: manual_strategic
      backlink_status: verified
    source_meta:
      id: github-com
  - id: github-com
    domain: github.com
    submit_url: https://github.com/org/b/issues
    normalized_key: github.com/org/b/issues
    submission:
      mode: manual_strategic
    source_meta:
      id: github-com
`);

      const result = dedupeRegistryIds(registry);
      const loaded = loadRegistry(registry);

      assert.equal(result.renamed_ids, 1);
      assert.equal(new Set(loaded.targets.map(target => target.id)).size, 2);
      assert.equal(loaded.targets[0].submission.backlink_status, 'verified');
      assert.equal(loaded.targets[1].source_meta.previous_id, 'github-com');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports into a persisted registry and computes stats', () => {
    const dir = tempDir();
    try {
      const input = join(dir, 'targets.csv');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(input, `"title","submission_link","pricing"
"Free Directory","https://free.example/submit","Free"
"Paid Directory","https://paid.example/submit","Paid"
`);

      const result = importTargets(registry, input, { source: 'csv' });
      const loaded = loadRegistry(registry);
      const stats = registryStats(loaded.targets);

      assert.equal(result.imported, 2);
      assert.equal(loaded.targets.length, 2);
      assert.equal(stats.by_pricing.free, 1);
      assert.equal(stats.by_pricing.paid, 1);
      assert.equal(filterTargets(loaded.targets, { free: true }).length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters targets by backlink verification evidence', () => {
    const targets = [
      {
        id: 'verified',
        submission: {
          mode: 'auto_safe',
          backlink_status: 'verified',
          live_listing_url: 'https://dir.example/tools/demo',
        },
      },
      {
        id: 'not-found',
        submission: {
          mode: 'auto_safe',
          backlink_status: 'not_found',
        },
      },
      {
        id: 'unverified',
        submission: {
          mode: 'needs_scout',
        },
      },
    ];

    assert.deepEqual(filterTargets(targets, { verified: true }).map(target => target.id), ['verified']);
    assert.deepEqual(filterTargets(targets, { notFound: true }).map(target => target.id), ['not-found']);
    assert.deepEqual(filterTargets(targets, { backlinkStatus: 'not_found' }).map(target => target.id), ['not-found']);
    assert.deepEqual(filterTargets(targets, { hasLiveListing: true }).map(target => target.id), ['verified']);
  });
});

describe('target registry audit filtering', () => {
  it('filters findings by code and severity without changing blocker status', () => {
    const report = auditTargets([
      {
        id: 'duplicate',
        domain: 'dup.example',
        submit_url: 'https://dup.example/submit',
        pricing: 'free',
        submission: {
          mode: 'auto_candidate',
        },
        quality: {
          risk: 'unknown',
        },
      },
      {
        id: 'duplicate',
        domain: 'dup2.example',
        submit_url: 'https://dup2.example/submit',
        pricing: 'unknown',
        submission: {
          mode: 'auto_candidate',
        },
        quality: {
          risk: 'unknown',
        },
      },
    ], {
      code: 'auto_candidate_needs_scout',
      severity: 'warning',
    });

    assert.equal(report.ok, false);
    assert.equal(report.summary.blockers, 1);
    assert.equal(report.summary.filtered_blockers, 0);
    assert.equal(report.summary.filtered_warnings, 2);
    assert.deepEqual(report.filtered_warnings.map(item => item.code), [
      'auto_candidate_needs_scout',
      'auto_candidate_needs_scout',
    ]);
  });

  it('formats only filtered findings when audit filters are active', () => {
    const report = auditTargets([
      {
        id: 'candidate',
        domain: 'candidate.example',
        submit_url: 'https://candidate.example/submit',
        pricing: 'unknown',
        submission: {
          mode: 'auto_candidate',
        },
        quality: {
          risk: 'unknown',
        },
      },
    ], {
      code: 'auto_candidate_needs_scout',
    });

    const formatted = formatAuditReport(report, { limitFindings: 10 });

    assert.match(formatted, /Filtered warnings: 1/);
    assert.match(formatted, /auto_candidate_needs_scout/);
    assert.doesNotMatch(formatted, /runnable_unknown_pricing candidate/);
  });
});

describe('target coverage audit', () => {
  it('compares extracted URL files against the canonical registry', () => {
    const dir = tempDir();
    try {
      const inputDir = join(dir, 'backlink-url');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: exact
    domain: exact.example
    submit_url: https://exact.example/submit
    normalized_key: exact.example/submit
    submission:
      mode: needs_scout
  - id: same-domain
    domain: same.example
    submit_url: https://same.example/submit-tool
    normalized_key: same.example/submit-tool
    submission:
      mode: needs_scout
`);
      mkdirp(inputDir);
      writeFileSync(join(inputDir, 'targets.csv'), `"submission_link","title"
"https://exact.example/submit?ref=notion","Exact"
"https://same.example/submit","Same domain"
`);
      writeFileSync(join(inputDir, 'links.json'), JSON.stringify({
        results: [
          {
            articleUrl: 'https://91wink.com/source-page/',
            externalLinks: [
              { url: 'https://missing.example/add-product' },
            ],
          },
        ],
      }));
      writeFileSync(join(inputDir, 'notes.md'), [
        '# Links',
        '- https://missing.example/add-product',
        '- https://plain-missing.example',
      ].join('\n'));

      const report = buildCoverageReport(inputDir, { registry });

      assert.equal(report.summary.unique_urls_in_input, 5);
      assert.equal(report.summary.exact_in_registry, 1);
      assert.equal(report.summary.domain_in_registry_only, 1);
      assert.equal(report.summary.missing_domain, 3);
      assert.equal(report.summary.url_occurrences, 6);
      assert.deepEqual(
        report.by_file.map(file => [file.file, file.unique_urls]),
        [
          ['links.json', 2],
          ['notes.md', 2],
          ['targets.csv', 2],
        ]
      );
      assert.equal(
        report.items.find(item => item.domain === 'same.example').candidate_import_recommendation,
        'review_submit_url'
      );
      assert.equal(
        report.items.find(item => item.domain === '91wink.com').candidate_import_recommendation,
        'skip_source_page'
      );
      assert.equal(
        report.items.find(item => item.domain === 'missing.example').candidate_import_recommendation,
        'review_submit_url'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes JSON reports and candidate CSVs for manual review', () => {
    const dir = tempDir();
    try {
      const inputDir = join(dir, 'backlink-url');
      const registry = join(dir, 'registry.yaml');
      const output = join(dir, 'out', 'coverage-report.json');
      const candidates = join(dir, 'out', 'coverage-candidates.csv');
      writeFileSync(registry, 'version: 1\ntargets: []\n');
      mkdirp(inputDir);
      writeFileSync(join(inputDir, 'targets.csv'), `"submission_link","title"
"https://quote.example/submit?name=a,b","Comma"
`);

      const report = buildCoverageReport(inputDir, { registry });
      const csv = coverageCandidatesCsv(report);
      writeCoverageReport(report, output);
      writeCoverageCandidatesCsv(report, candidates);

      assert.match(csv, /classification,candidate_import_recommendation,url/);
      assert.match(csv, /https:\/\/quote.example\/submit\?name=a%2Cb/);
      assert.equal(JSON.parse(readFileSync(output, 'utf-8')).summary.unique_urls_in_input, 1);
      assert.match(readFileSync(candidates, 'utf-8'), /quote.example/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a review CSV that excludes exact matches by default', () => {
    const dir = tempDir();
    try {
      const inputDir = join(dir, 'backlink-url');
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'out', 'coverage-review.csv');
      writeFileSync(registry, `
version: 1
targets:
  - id: exact
    domain: exact.example
    submit_url: https://exact.example/submit
    normalized_key: exact.example/submit
`);
      mkdirp(inputDir);
      writeFileSync(join(inputDir, 'targets.csv'), `"submission_link"
"https://exact.example/submit"
"https://missing.example/submit"
`);

      const report = buildCoverageReport(inputDir, { registry });
      const csv = coverageReviewCsv(report);
      writeCoverageReviewCsv(report, review);

      assert.match(csv, /review_decision,review_instruction/);
      assert.doesNotMatch(csv, /exact.example/);
      assert.match(readFileSync(review, 'utf-8'), /missing.example/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports only approved coverage review rows as non-executable scout targets', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(registry, 'version: 1\ntargets: []\n');
      writeFileSync(review, [
        [
          'review_decision',
          'canonical_name',
          'reviewed_by',
          'review_notes',
          'pricing',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'source_files',
          'source_locations',
          'occurrence_count',
        ].join(','),
        [
          'approved',
          'Approved Directory',
          'qa',
          'verified simple public submit form',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://approved.example/submit',
          'approved.example',
          'coverage.csv',
          'coverage.csv:2',
          '1',
        ].join(','),
        [
          '',
          'Not Reviewed',
          '',
          '',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://not-reviewed.example/submit',
          'not-reviewed.example',
          'coverage.csv',
          'coverage.csv:3',
          '1',
        ].join(','),
      ].join('\n'));

      const result = importCoverageReview(registry, review, { source: 'coverage-test' });
      const loaded = loadRegistry(registry);

      assert.equal(result.imported, 1);
      assert.equal(result.registry_total, 0);
      assert.equal(result.resulting_total, 1);
      assert.equal(result.skipped, 1);
      assert.equal(result.blocked, 0);
      assert.equal(loaded.targets.length, 1);
      assert.equal(loaded.targets[0].name, 'Approved Directory');
      assert.equal(loaded.targets[0].submission.mode, 'needs_scout');
      assert.equal(loaded.targets[0].submission.reason, 'coverage_review_approved_needs_scout');
      assert.equal(loaded.targets[0].source_meta.coverage_review_decision, 'approved');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks approved source pages and ambiguous same-domain variants by default', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(registry, `
version: 1
targets:
  - id: existing
    domain: same.example
    submit_url: https://same.example/submit-tool
    normalized_key: same.example/submit-tool
`);
      writeFileSync(review, [
        [
          'review_decision',
          'canonical_name',
          'reviewed_by',
          'review_notes',
          'pricing',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'source_files',
          'source_locations',
          'occurrence_count',
        ].join(','),
        [
          'approved',
          'Source Page',
          'qa',
          'source page should still be blocked',
          'unknown',
          'missing_domain',
          'skip_source_page',
          'https://91wink.com/source',
          '91wink.com',
          'coverage.json',
          'coverage.json:source',
          '1',
        ].join(','),
        [
          'approved',
          'Same Domain',
          'qa',
          'same-domain generic approval should be blocked',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add',
          'same.example',
          'coverage.csv',
          'coverage.csv:2',
          '1',
        ].join(','),
      ].join('\n'));

      const result = importCoverageReview(registry, review);
      const loaded = loadRegistry(registry);

      assert.equal(result.blocked_import, true);
      assert.equal(result.imported, 0);
      assert.equal(result.registry_total, 1);
      assert.equal(result.resulting_total, 1);
      assert.deepEqual(result.blocked_rows.map(row => row.reason), [
        'source_page_not_importable',
        'domain_variant_needs_explicit_approval',
      ]);
      assert.equal(loaded.targets.length, 1);
      assert.equal(loaded.targets[0].id, 'existing');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('allows explicitly approved same-domain variants but keeps them non-executable', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(registry, `
version: 1
targets:
  - id: existing
    domain: same.example
    submit_url: https://same.example/submit-tool
    normalized_key: same.example/submit-tool
`);
      writeFileSync(review, [
        'review_decision,canonical_name,reviewed_by,review_notes,pricing,classification,candidate_import_recommendation,url,domain,source_files,source_locations,registry_submit_urls,occurrence_count',
        'approved_domain_variant,Same Domain Add,qa,verified distinct add endpoint,unknown,domain_in_registry_only,review_submit_url,https://same.example/add,same.example,coverage.csv,coverage.csv:2,https://same.example/submit-tool,1',
      ].join('\n'));

      const result = importCoverageReview(registry, review);
      const loaded = loadRegistry(registry);

      assert.equal(result.imported, 1);
      assert.equal(result.duplicates, 0);
      assert.equal(loaded.targets.length, 2);
      const imported = loaded.targets.find(target => target.submit_url === 'https://same.example/add');
      assert.equal(imported.submission.mode, 'needs_scout');
      assert.equal(imported.quality.risk, 'unknown');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates approved coverage rows before import', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(review, [
        [
          'review_decision',
          'canonical_name',
          'reviewed_by',
          'review_notes',
          'pricing',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'source_files',
          'source_locations',
          'occurrence_count',
        ].join(','),
        [
          'approved',
          'Missing Evidence',
          '',
          '',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://missing-evidence.example/submit',
          'missing-evidence.example',
          'coverage.csv',
          'coverage.csv:2',
          '1',
        ].join(','),
        [
          '',
          'Not Reviewed',
          '',
          '',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://not-reviewed.example/submit',
          'not-reviewed.example',
          'coverage.csv',
          'coverage.csv:3',
          '1',
        ].join(','),
      ].join('\n'));

      const validation = validateCoverageReview(review);

      assert.equal(validation.ok, false);
      assert.equal(validation.rows, 2);
      assert.equal(validation.approved, 1);
      assert.equal(validation.unreviewed, 1);
      assert.deepEqual(validation.blockers.map(item => item.code), [
        'approved_missing_reviewed_by',
        'approved_missing_review_notes',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks coverage review import when approved rows lack review evidence', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(registry, 'version: 1\ntargets: []\n');
      writeFileSync(review, [
        'review_decision,canonical_name,pricing,classification,candidate_import_recommendation,url,domain,source_files,source_locations,occurrence_count',
        'approved,Missing Evidence,unknown,missing_domain,review_submit_url,https://missing-evidence.example/submit,missing-evidence.example,coverage.csv,coverage.csv:2,1',
      ].join('\n'));

      const result = importCoverageReview(registry, review);
      const loaded = loadRegistry(registry);

      assert.equal(result.blocked_import, true);
      assert.equal(result.imported, 0);
      assert.equal(result.blocked, 1);
      assert.equal(result.blocked_rows[0].reason, 'approved_missing_reviewed_by');
      assert.equal(result.review_validation.ok, false);
      assert.equal(loaded.targets.length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prioritizes review queues and excludes skipped rows by default', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      const output = join(dir, 'out', 'coverage-review-queue.csv');
      writeFileSync(review, [
        [
          'review_decision',
          'canonical_name',
          'pricing',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
          'occurrence_count',
        ].join(','),
        [
          '',
          'Manual Fit',
          'unknown',
          'missing_domain',
          'needs_manual_review',
          'https://manual.example/',
          'manual.example',
          'repo-external-links.csv',
          'repo-external-links.csv:2',
          '',
          '',
          '1',
        ].join(','),
        [
          '',
          'Submit URL',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://submit.example/submit',
          'submit.example',
          'coverage-candidates.csv',
          'coverage-candidates.csv:2',
          '',
          '',
          '2',
        ].join(','),
        [
          '',
          'Same Domain',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add',
          'same.example',
          'coverage-candidates.csv',
          'coverage-candidates.csv:3',
          'same-existing',
          'https://same.example/submit',
          '1',
        ].join(','),
        [
          'reject_source_page',
          'Source Page',
          'unknown',
          'missing_domain',
          'skip_source_page',
          'https://91wink.com/source',
          '91wink.com',
          'coverage.json',
          'coverage.json:source',
          '',
          '',
          '1',
        ].join(','),
      ].join('\n'));

      const queue = buildCoverageReviewQueue(review);
      const csv = coverageReviewQueueCsv(queue);
      writeCoverageReviewQueue(queue, output);

      assert.equal(queue.total_review_rows, 4);
      assert.equal(queue.queue_rows, 3);
      assert.deepEqual(queue.priority_counts, { P0: 2, P2: 1 });
      assert.deepEqual(queue.rows.map(row => row.domain), [
        'same.example',
        'submit.example',
        'manual.example',
      ]);
      assert.equal(queue.rows[0].review_row, 4);
      assert.equal(queue.rows[0].review_decision_options, 'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required');
      assert.match(csv, /priority,priority_score,review_row,review_decision,review_decision_options,review_action/);
      assert.doesNotMatch(readFileSync(output, 'utf-8'), /91wink.com/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can include skipped rows in review queue output', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      writeFileSync(review, [
        'review_decision,classification,candidate_import_recommendation,url,domain,occurrence_count',
        'reject_source_page,missing_domain,skip_source_page,https://91wink.com/source,91wink.com,1',
      ].join('\n'));

      const queue = buildCoverageReviewQueue(review, { includeSkipped: true });

      assert.equal(queue.queue_rows, 1);
      assert.equal(queue.priority_counts.P9, 1);
      assert.equal(queue.rows[0].review_action, 'skip_rejected_or_source_page');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds focused coverage review batches from a queue', () => {
    const dir = tempDir();
    try {
      const queuePath = join(dir, 'coverage-review-queue.csv');
      const output = join(dir, 'batches', 'p0-batch.csv');
      const markdown = join(dir, 'batches', 'p0-batch.md');
      writeFileSync(queuePath, [
        [
          'priority',
          'priority_score',
          'review_row',
          'review_decision',
          'review_decision_options',
          'review_action',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'submission_url_override',
          'canonical_name',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'occurrence_count',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
        ].join(','),
        'P0,300,10,,approved | reject_not_submit,verify_submit_form_then_approve_or_reject,,,,,Submit One,unknown,unknown,missing_domain,review_submit_url,https://one.example/submit,one.example,1,coverage.csv,coverage.csv:2,,',
        'P2,25,11,,approved | reject_not_directory,verify_directory_fit_before_any_approval,,,,,Manual,unknown,unknown,missing_domain,needs_manual_review,https://manual.example/,manual.example,1,coverage.csv,coverage.csv:3,,',
        'P0,250,12,,approved_domain_variant | reject_duplicate,verify_distinct_submit_url_for_existing_domain,,,,,Same Domain,unknown,unknown,domain_in_registry_only,review_submit_url,https://same.example/add,same.example,1,coverage.csv,coverage.csv:4,same,https://same.example/submit',
      ].join('\n'));

      const batch = buildCoverageReviewBatch(queuePath, {
        priority: 'P0',
        limit: 1,
        offset: 1,
        batchId: 'test-p0',
      });
      const csv = coverageReviewBatchCsv(batch);
      const md = coverageReviewBatchMarkdown(batch);
      writeCoverageReviewBatch(batch, { output, markdown });

      assert.equal(batch.batch_id, 'test-p0');
      assert.equal(batch.matching_rows, 2);
      assert.equal(batch.batch_rows, 1);
      assert.equal(batch.remaining_after_batch, 0);
      assert.equal(batch.rows[0].url, 'https://same.example/add');
      assert.match(csv, /batch_id,batch_order,priority/);
      assert.match(md, /Coverage Review Batch: test-p0/);
      assert.match(readFileSync(output, 'utf-8'), /test-p0/);
      assert.match(readFileSync(markdown, 'utf-8'), /approved_domain_variant/);
      assert.doesNotMatch(readFileSync(output, 'utf-8'), /manual.example/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates focused coverage review batches before apply', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      writeFileSync(batch, [
        [
          'batch_id',
          'batch_order',
          'priority',
          'priority_score',
          'review_row',
          'review_decision',
          'review_decision_options',
          'review_action',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'submission_url_override',
          'canonical_name',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'occurrence_count',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
        ].join(','),
        [
          'p0-001',
          '1',
          'P0',
          '300',
          '10',
          'approved',
          'approved_domain_variant | reject_duplicate | reject_not_submit',
          'verify_distinct_submit_url_for_existing_domain',
          'use approved_domain_variant only',
          'verified distinct endpoint',
          'qa',
          '',
          'Same Domain',
          'free',
          'en',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add',
          'same.example',
          '1',
          'coverage.csv',
          'coverage.csv:2',
          'same-existing',
          'https://same.example/submit',
        ].join(','),
        [
          'p0-001',
          '2',
          'P0',
          '300',
          '10',
          'approved_domain_variant',
          'approved_domain_variant | reject_duplicate | reject_not_submit',
          'verify_distinct_submit_url_for_existing_domain',
          'use approved_domain_variant only',
          'verified distinct endpoint',
          'qa',
          '',
          'Same Domain Duplicate',
          'free',
          'en',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add-two',
          'same.example',
          '1',
          'coverage.csv',
          'coverage.csv:3',
          'same-existing',
          'https://same.example/submit',
        ].join(','),
      ].join('\n'));

      const validation = validateCoverageReviewBatch(batch);

      assert.equal(validation.ok, false);
      assert.equal(validation.rows, 2);
      assert.equal(validation.approved, 2);
      assert.deepEqual(validation.blockers.map(item => item.code), [
        'domain_variant_needs_explicit_approval',
        'batch_decision_not_allowed',
        'batch_duplicate_review_row',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('collects read-only evidence for coverage review batches', async () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const output = join(dir, 'evidence', 'batch-evidence.csv');
      const jsonOutput = join(dir, 'evidence', 'batch-evidence.json');
      writeFileSync(batch, [
        [
          'batch_id',
          'batch_order',
          'priority',
          'priority_score',
          'review_row',
          'review_decision',
          'review_decision_options',
          'review_action',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'submission_url_override',
          'canonical_name',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'occurrence_count',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
        ].join(','),
        [
          'p0-001',
          '1',
          'P0',
          '300',
          '10',
          '',
          'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required',
          'verify_distinct_submit_url_for_existing_domain',
          'verify same-domain variant',
          '',
          '',
          '',
          'Same Domain',
          'unknown',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add',
          'same.example',
          '1',
          'coverage.csv',
          'coverage.csv:2',
          'same-existing',
          'https://same.example/submit',
        ].join(','),
        [
          'p0-001',
          '2',
          'P0',
          '290',
          '11',
          '',
          'approved | reject_not_submit | reject_paid | reject_auth_required',
          'verify_submit_form_then_approve_or_reject',
          'verify submit form',
          '',
          '',
          '',
          'Paid Submit',
          'unknown',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://paid.example/submit',
          'paid.example',
          '1',
          'coverage.csv',
          'coverage.csv:3',
          '',
          '',
        ].join(','),
        [
          'p0-001',
          '3',
          'P0',
          '280',
          '12',
          '',
          'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required',
          'verify_distinct_submit_url_for_existing_domain',
          'verify duplicate',
          '',
          '',
          '',
          'Duplicate',
          'unknown',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://dup.example/submit',
          'dup.example',
          '1',
          'coverage.csv',
          'coverage.csv:4',
          'dup-existing',
          'https://dup.example/submit',
        ].join(','),
      ].join('\n'));

      const fakeFetch = async (url) => {
        const html = url.includes('paid.example')
          ? '<html><head><title>Paid Submit</title></head><body><h1>Submit your product</h1><p>Paid listing $99 checkout</p></body></html>'
          : '<html><head><title>Add Tool</title></head><body><form><input name="name" required><input name="url" required><button type="submit">Submit tool</button></form></body></html>';
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'text/html' },
          text: async () => html,
        };
      };

      const evidence = await buildCoverageReviewEvidence(batch, { fetchFn: fakeFetch });
      const csv = coverageReviewEvidenceCsv(evidence);
      writeCoverageReviewEvidence(evidence, { output, jsonOutput });
      const json = JSON.parse(readFileSync(jsonOutput, 'utf-8'));

      assert.equal(evidence.total_rows, 3);
      assert.equal(evidence.checked_rows, 3);
      assert.equal(evidence.evidence_rows[0].suggested_decision, 'review_possible_domain_variant');
      assert.equal(evidence.evidence_rows[0].form_count, 1);
      assert.equal(evidence.evidence_rows[1].suggested_decision, 'reject_paid');
      assert.equal(evidence.evidence_rows[1].payment_signal, 'yes');
      assert.equal(evidence.evidence_rows[2].suggested_decision, 'reject_duplicate');
      assert.equal(evidence.summary.payment_signals, 1);
      assert.equal(evidence.summary.duplicate_registry_urls, 1);
      assert.match(csv, /suggested_decision/);
      assert.match(readFileSync(output, 'utf-8'), /review_possible_domain_variant/);
      assert.equal(json.checked_rows, 3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates non-binding coverage review suggestions from evidence', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      const output = join(dir, 'suggestions', 'batch-suggestions.csv');
      const jsonOutput = join(dir, 'suggestions', 'batch-suggestions.json');
      writeFileSync(batch, [
        [
          'batch_id',
          'batch_order',
          'priority',
          'priority_score',
          'review_row',
          'review_decision',
          'review_decision_options',
          'review_action',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'submission_url_override',
          'canonical_name',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'occurrence_count',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
        ].join(','),
        [
          'p0-001',
          '1',
          'P0',
          '300',
          '10',
          '',
          'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required',
          'verify_distinct_submit_url_for_existing_domain',
          'verify same-domain variant',
          '',
          '',
          '',
          'Same Domain',
          'unknown',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://same.example/add',
          'same.example',
          '1',
          'coverage.csv',
          'coverage.csv:2',
          'same-existing',
          'https://same.example/submit',
        ].join(','),
        [
          'p0-001',
          '2',
          'P0',
          '290',
          '11',
          '',
          'approved | reject_not_submit | reject_paid | reject_auth_required',
          'verify_submit_form_then_approve_or_reject',
          'verify submit form',
          '',
          '',
          '',
          'Paid Submit',
          'unknown',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://paid.example/submit',
          'paid.example',
          '1',
          'coverage.csv',
          'coverage.csv:3',
          '',
          '',
        ].join(','),
        [
          'p0-001',
          '3',
          'P0',
          '280',
          '12',
          '',
          'approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required',
          'verify_distinct_submit_url_for_existing_domain',
          'verify duplicate',
          '',
          '',
          '',
          'Duplicate',
          'unknown',
          'unknown',
          'domain_in_registry_only',
          'review_submit_url',
          'https://dup.example/submit',
          'dup.example',
          '1',
          'coverage.csv',
          'coverage.csv:4',
          'dup-existing',
          'https://dup.example/submit',
        ].join(','),
      ].join('\n'));
      writeFileSync(evidence, [
        [
          'batch_id',
          'batch_order',
          'review_row',
          'review_action',
          'url',
          'domain',
          'http_status',
          'fetch_ok',
          'final_url',
          'final_domain',
          'domain_changed',
          'content_type',
          'title',
          'form_count',
          'input_count',
          'submit_button_signal',
          'submit_path_signal',
          'directory_signal',
          'auth_signal',
          'oauth_signal',
          'captcha_signal',
          'cloudflare_signal',
          'payment_signal',
          'duplicate_registry_url',
          'suggested_decision',
          'evidence_notes',
          'fetch_error',
          'checked_at',
        ].join(','),
        'p0-001,1,10,verify_distinct_submit_url_for_existing_domain,https://same.example/add,same.example,200,yes,https://same.example/add,same.example,no,text/html,Add Tool,1,2,yes,yes,yes,no,no,no,no,no,no,review_possible_domain_variant,form found,,2026-05-22T00:00:00.000Z',
        'p0-001,2,11,verify_submit_form_then_approve_or_reject,https://paid.example/submit,paid.example,200,yes,https://paid.example/submit,paid.example,no,text/html,Submit Tool,1,2,yes,yes,yes,no,no,no,no,yes,no,reject_paid,pricing found,,2026-05-22T00:00:00.000Z',
        'p0-001,3,12,verify_distinct_submit_url_for_existing_domain,https://dup.example/submit,dup.example,200,yes,https://dup.example/submit,dup.example,no,text/html,Submit,1,2,yes,yes,yes,no,no,no,no,no,yes,reject_duplicate,duplicate,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);
      const csv = coverageReviewSuggestionsCsv(suggestions);
      writeCoverageReviewSuggestions(suggestions, { output, jsonOutput });
      const json = JSON.parse(readFileSync(jsonOutput, 'utf-8'));

      assert.equal(suggestions.suggestion_rows, 3);
      assert.equal(suggestions.summary.evidence_matched, 3);
      assert.deepEqual(suggestions.rows.map(row => row.suggested_review_decision), [
        'needs_manual_check',
        'reject_paid',
        'reject_duplicate',
      ]);
      assert.equal(suggestions.rows[0].possible_approval_decision, 'approved_domain_variant');
      assert.equal(suggestions.rows[0].suggested_review_notes.includes('same-domain variant must not use generic approved'), true);
      assert.equal(suggestions.rows[1].suggested_pricing, 'paid');
      assert.equal(suggestions.rows[2].suggestion_confidence, 'high');
      assert.match(csv, /possible_approval_decision/);
      assert.match(readFileSync(output, 'utf-8'), /approved_domain_variant/);
      assert.equal(json.mode_policy, 'suggestions_are_non_binding_and_do_not_modify_review_decisions');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not turn broad payment text on generic pages into a paid rejection suggestion', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,300,10,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,verify same-domain variant,,,,GitHub,unknown,unknown,domain_in_registry_only,review_submit_url,https://github.com/,github.com,1,coverage.csv,coverage.csv:2,github-existing,https://github.com/org/repo/issues/new',
      ].join('\n'));
      writeFileSync(evidence, [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
        'p0-001,1,10,verify_distinct_submit_url_for_existing_domain,https://github.com/,github.com,200,yes,https://github.com/,github.com,no,text/html,GitHub,5,14,yes,no,yes,yes,no,yes,no,yes,no,reject_paid,payment text found,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);

      assert.notEqual(suggestions.rows[0].suggested_review_decision, 'reject_paid');
      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_auth_required');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].suggested_pricing, '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats 404 evidence as not-submit before considering page payment text', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,300,10,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,verify same-domain variant,,,,ToolPilot,unknown,unknown,domain_in_registry_only,review_submit_url,https://toolpilot.example/submit,toolpilot.example,1,coverage.csv,coverage.csv:2,toolpilot-existing,https://toolpilot.example/add-tool',
      ].join('\n'));
      writeFileSync(evidence, [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
        'p0-001,1,10,verify_distinct_submit_url_for_existing_domain,https://toolpilot.example/submit,toolpilot.example,404,no,https://toolpilot.example/submit,toolpilot.example,no,text/html,404 Not Found,4,15,yes,yes,yes,yes,no,yes,no,yes,no,review_fetch_failed,payment text found,HTTP 404,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);

      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_not_submit');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].suggested_pricing, '');
      assert.match(suggestions.rows[0].suggestion_basis, /HTTP 404/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies editable review queue decisions back to review rows', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      const queue = join(dir, 'coverage-review-queue.csv');
      const output = join(dir, 'updated-review.csv');
      writeFileSync(review, [
        [
          'review_decision',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'canonical_name',
          'submission_url_override',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
          'occurrence_count',
        ].join(','),
        [
          '',
          'verify_submit_form_before_approval',
          '',
          '',
          'Submit URL',
          '',
          'unknown',
          'unknown',
          'missing_domain',
          'review_submit_url',
          'https://submit.example/submit',
          'submit.example',
          'coverage-candidates.csv',
          'coverage-candidates.csv:2',
          '',
          '',
          '2',
        ].join(','),
      ].join('\n'));
      writeFileSync(queue, [
        [
          'priority',
          'priority_score',
          'review_row',
          'review_decision',
          'review_decision_options',
          'review_action',
          'review_instruction',
          'review_notes',
          'reviewed_by',
          'submission_url_override',
          'canonical_name',
          'pricing',
          'lang',
          'classification',
          'candidate_import_recommendation',
          'url',
          'domain',
          'occurrence_count',
          'source_files',
          'source_locations',
          'registry_target_ids',
          'registry_submit_urls',
        ].join(','),
        [
          'P0',
          '187',
          '2',
          'approved',
          'approved | reject_not_submit',
          'verify_submit_form_then_approve_or_reject',
          'verify_submit_form_before_approval',
          'verified simple form',
          'zh',
          '',
          'Submit Example',
          'free',
          'en',
          'missing_domain',
          'review_submit_url',
          'https://submit.example/submit',
          'submit.example',
          '2',
          'coverage-candidates.csv',
          'coverage-candidates.csv:2',
          '',
          '',
        ].join(','),
      ].join('\n'));

      const result = applyCoverageReviewQueue(review, queue, { output });
      const [updated] = parseCsv(readFileSync(output, 'utf-8'));

      assert.equal(result.applied_rows, 1);
      assert.equal(result.blocked_apply, false);
      assert.equal(updated.review_decision, 'approved');
      assert.equal(updated.review_notes, 'verified simple form');
      assert.equal(updated.reviewed_by, 'zh');
      assert.equal(updated.canonical_name, 'Submit Example');
      assert.equal(updated.pricing, 'free');
      assert.equal(updated.lang, 'en');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks review queue application when review row identity changed', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      const queue = join(dir, 'coverage-review-queue.csv');
      const output = join(dir, 'updated-review.csv');
      writeFileSync(review, [
        'review_decision,review_instruction,review_notes,reviewed_by,canonical_name,submission_url_override,pricing,lang,classification,candidate_import_recommendation,url,domain,source_files,source_locations,registry_target_ids,registry_submit_urls,occurrence_count',
        ',verify_submit_form_before_approval,,,,,unknown,unknown,missing_domain,review_submit_url,https://submit.example/submit,submit.example,coverage-candidates.csv,coverage-candidates.csv:2,,,2',
      ].join('\n'));
      writeFileSync(queue, [
        'priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'P0,187,2,approved,approved | reject_not_submit,verify_submit_form_then_approve_or_reject,verify_submit_form_before_approval,verified,zh,,Submit Example,free,en,missing_domain,review_submit_url,https://other.example/submit,other.example,2,coverage-candidates.csv,coverage-candidates.csv:2,,',
      ].join('\n'));

      const result = applyCoverageReviewQueue(review, queue, { output });

      assert.equal(result.blocked_apply, true);
      assert.equal(result.validation_blocked, false);
      assert.equal(result.queue_validation.ok, true);
      assert.equal(result.applied_rows, 0);
      assert.equal(result.blocked_rows, 1);
      assert.equal(result.blocked[0].reason, 'review_row_identity_mismatch');
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks review queue application when batch validation fails', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'coverage-review.csv');
      const queue = join(dir, 'coverage-review-queue.csv');
      const output = join(dir, 'updated-review.csv');
      writeFileSync(review, [
        'review_decision,review_instruction,review_notes,reviewed_by,canonical_name,submission_url_override,pricing,lang,classification,candidate_import_recommendation,url,domain,source_files,source_locations,registry_target_ids,registry_submit_urls,occurrence_count',
        ',verify same-domain variant,,,,,unknown,unknown,domain_in_registry_only,review_submit_url,https://same.example/add,same.example,coverage-candidates.csv,coverage-candidates.csv:2,same-existing,https://same.example/submit,2',
      ].join('\n'));
      writeFileSync(queue, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,187,2,approved,approved_domain_variant | reject_duplicate | reject_not_submit,verify_distinct_submit_url_for_existing_domain,verify same-domain variant,verified,qa,,Same Example,free,en,domain_in_registry_only,review_submit_url,https://same.example/add,same.example,2,coverage-candidates.csv,coverage-candidates.csv:2,same-existing,https://same.example/submit',
      ].join('\n'));

      const result = applyCoverageReviewQueue(review, queue, { output });

      assert.equal(result.blocked_apply, true);
      assert.equal(result.applied_rows, 0);
      assert.equal(result.blocked_rows, 2);
      assert.deepEqual(result.blocked.map(row => row.reason), [
        'domain_variant_needs_explicit_approval',
        'batch_decision_not_allowed',
      ]);
      assert.equal(result.queue_validation.ok, false);
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('promotes edited coverage review batches through validation and import dry-run', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const review = join(dir, 'coverage-review.csv');
      const batch = join(dir, 'coverage-review-batch.csv');
      const output = join(dir, 'coverage-review.updated.csv');
      const report = join(dir, 'promotion-report.json');
      writeFileSync(registry, 'version: 1\ntargets: []\n');
      writeFileSync(review, [
        'review_decision,review_instruction,review_notes,reviewed_by,canonical_name,submission_url_override,pricing,lang,classification,candidate_import_recommendation,url,domain,source_files,source_locations,registry_target_ids,registry_submit_urls,occurrence_count',
        ',verify submit form,,,Submit Example,,unknown,unknown,missing_domain,review_submit_url,https://submit.example/submit,submit.example,coverage-candidates.csv,coverage-candidates.csv:2,,,2',
      ].join('\n'));
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,187,2,approved,approved | reject_not_submit,verify_submit_form_then_approve_or_reject,verify submit form,verified public form,qa,,Submit Example,free,en,missing_domain,review_submit_url,https://submit.example/submit,submit.example,2,coverage-candidates.csv,coverage-candidates.csv:2,,',
      ].join('\n'));

      const dryRun = promoteCoverageReviewBatch(registry, review, batch, {
        output,
        dryRun: true,
      });
      const result = promoteCoverageReviewBatch(registry, review, batch, { output });
      writeCoverageReviewPromotionReport(result, report);
      const [updated] = parseCsv(readFileSync(output, 'utf-8'));
      const reportJson = JSON.parse(readFileSync(report, 'utf-8'));

      assert.equal(dryRun.ok, true);
      assert.equal(dryRun.wrote_output, false);
      assert.equal(result.ok, true);
      assert.equal(result.status, 'ready');
      assert.equal(result.wrote_output, true);
      assert.equal(result.apply.applied_rows, 1);
      assert.equal(result.updated_review_validation.ok, true);
      assert.equal(result.import_dry_run.blocked_import, false);
      assert.equal(result.import_dry_run.would_import, 1);
      assert.equal(updated.review_decision, 'approved');
      assert.equal(updated.reviewed_by, 'qa');
      assert.equal(updated.pricing, 'free');
      assert.equal(reportJson.mode_policy, result.mode_policy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('submission plan', () => {
  it('builds a safe plan that excludes skip/manual strategic targets by default', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: safe
    name: Safe
    domain: safe.example
    submit_url: https://safe.example/submit
    pricing: free
    submission:
      mode: auto_candidate
      reason: static_auto_yes_needs_scout
    quality:
      risk: unknown
  - id: ph
    name: Product Hunt
    domain: producthunt.com
    submit_url: https://producthunt.com/posts/new
    pricing: free
    submission:
      mode: manual_strategic
      reason: strategic_manual_surface
    quality:
      risk: medium
  - id: comments
    name: Blog Comment
    domain: blog.example
    submit_url: https://blog.example/post
    pricing: free
    submission:
      mode: skip
      reason: high_spam_risk_surface
    quality:
      risk: high
`);

      const plan = buildSubmissionPlan({ registry, freeOnly: true, limit: 10 });
      assert.deepEqual(plan.targets.map(target => target.id), ['safe']);
      assert.equal(plan.excluded.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires an explicit flag before unknown pricing can enter a free-only plan', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: unknown-price
    name: Unknown Price
    domain: unknown.example
    submit_url: https://unknown.example/submit
    pricing: unknown
    submission:
      mode: auto_candidate
      reason: static_auto_yes_needs_scout
    quality:
      risk: unknown
`);

      const strictPlan = buildSubmissionPlan({ registry, freeOnly: true, limit: 10 });
      const candidatePlan = buildSubmissionPlan({
        registry,
        freeOnly: true,
        allowUnknownPricing: true,
        limit: 10,
      });

      assert.equal(strictPlan.targets.length, 0);
      assert.deepEqual(candidatePlan.targets.map(target => target.id), ['unknown-price']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('scout queue plan', () => {
  it('queues only unscouted scoutable targets with pricing filters', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: candidate
    name: Candidate
    domain: candidate.example
    submit_url: https://candidate.example/submit
    pricing: unknown
    submission:
      mode: auto_candidate
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
  - id: scouted
    name: Scouted
    domain: scouted.example
    submit_url: https://scouted.example/submit
    pricing: free
    submission:
      mode: needs_scout
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
    quality:
      risk: unknown
  - id: paid
    name: Paid
    domain: paid.example
    submit_url: https://paid.example/submit
    pricing: paid
    submission:
      mode: needs_scout
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
`);

      const strict = buildScoutQueuePlan({ registry, freeOnly: true, limit: 10 });
      const unknownAllowed = buildScoutQueuePlan({
        registry,
        freeOnly: true,
        allowUnknownPricing: true,
        limit: 10,
      });

      assert.deepEqual(strict.targets.map(target => target.id), []);
      assert.deepEqual(unknownAllowed.targets.map(target => target.id), ['candidate']);
      assert.equal(unknownAllowed.constraints.purpose, 'scout_queue');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports explicit scout queue modes', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: needs
    submit_url: https://needs.example/submit
    pricing: free
    submission:
      mode: needs_scout
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
  - id: candidate
    submit_url: https://candidate.example/submit
    pricing: free
    submission:
      mode: auto_candidate
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
`);

      const plan = buildScoutQueuePlan({ registry, modes: 'needs_scout', limit: 10 });

      assert.deepEqual(plan.targets.map(target => target.id), ['needs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function loadTargetsFromFileFromRows(rows) {
  const dir = tempDir();
  try {
    const file = join(dir, 'rows.csv');
    const headers = Object.keys(rows[0]);
    const body = [
      headers.join(','),
      ...rows.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    writeFileSync(file, body);
    return loadTargetsFromFile(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function mkdirp(path) {
  mkdirSync(path, { recursive: true });
}
