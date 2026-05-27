import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inferTargetMode } from '../src/targets/classify.js';
import { normalizeUrl } from '../src/targets/normalize.js';
import { auditTargets, formatAuditReport } from '../src/targets/audit.js';
import {
  applyCrossDomainFinalUrlDecisionPatch,
  assistedSubmissionPackCsv,
  buildCrossDomainFinalUrlDecisionDraft,
  buildCrossDomainFinalUrlEvidence,
  buildCrossDomainFinalUrlDecisionPatch,
  buildCrossDomainFinalUrlManualPack,
  buildAssistedSubmissionPack,
  crossDomainFinalUrlDecisionDraftCsv,
  crossDomainFinalUrlEvidenceCsv,
  crossDomainFinalUrlDecisionsCsv,
  crossDomainFinalUrlManualPackCsv,
  crossDomainFinalUrlSuggestionsCsv,
  validateCrossDomainFinalUrlDecisions,
  writeAssistedSubmissionPack,
  writeCrossDomainFinalUrlDecisionDraft,
  writeCrossDomainFinalUrlManualPack,
} from '../src/targets/assisted-pack.js';
import {
  buildAuthLoginPlan,
  authLoginPlanCsv,
  buildAuthLoginPlanBatches,
  writeAuthLoginPlan,
  writeAuthLoginPlanBatches,
} from '../src/targets/auth-login-plan.js';
import {
  buildAuthLoginAudit,
  authLoginAuditCsv,
  writeAuthLoginAudit,
} from '../src/targets/auth-login-audit.js';
import {
  buildAuthLoginTriage,
  writeAuthLoginTriage,
} from '../src/targets/auth-login-triage.js';
import {
  authResidualShrinkCsv,
  authResidualSurfaceEvidenceCsv,
  buildAuthResidualShrink,
  writeAuthResidualShrink,
} from '../src/targets/auth-residual-shrink.js';
import {
  buildAuthResidualResolve,
  writeAuthResidualResolve,
} from '../src/targets/auth-residual-resolve.js';
import {
  authLoginNextCsv,
  buildAuthLoginNext,
  authLoginStatusCsv,
  buildAuthLoginStatus,
  writeAuthLoginNext,
  writeAuthLoginStatus,
} from '../src/targets/auth-login-status.js';
import {
  buildAuthLoginOperatorPack,
  writeAuthLoginOperatorPack,
} from '../src/targets/auth-login-operator-pack.js';
import {
  buildAuthRescoutPlan,
  writeAuthRescoutPlan,
} from '../src/targets/auth-rescout-plan.js';
import {
  buildAuthWorkflowRefresh,
  writeAuthWorkflowRefresh,
} from '../src/targets/auth-workflow-refresh.js';
import {
  buildBacklogLanes,
  writeBacklogLanes,
} from '../src/targets/backlog-lanes.js';
import {
  applyPricingReviewDecisionPatch,
  buildPricingReviewDecisionBatch,
  buildPricingReviewDecisionBatchMerge,
  buildPricingReviewEvidence,
  buildPricingReviewDecisionDraft,
  buildPricingReviewManualPack,
  buildPricingReviewManualStatus,
  buildPricingReviewQueue,
  buildPricingReviewPostApplyGate,
  buildPricingReviewSuggestions,
  pricingReviewDecisionBatchCsv,
  pricingReviewDecisionDraftCsv,
  pricingReviewDecisionBatchMarkdown,
  pricingReviewManualPackCsv,
  pricingReviewEvidenceCsv,
  pricingReviewQueueCsv,
  pricingReviewSuggestionsCsv,
  validatePricingReviewDecisions,
  writePricingReviewDecisionBatch,
  writePricingReviewDecisionBatchMerge,
  writePricingReviewDecisionDraft,
  writePricingReviewEvidence,
  writePricingReviewManualPack,
  writePricingReviewManualStatusReport,
  writePricingReviewPostApplyGateReport,
  writePricingReviewQueue,
  writePricingReviewSuggestions,
} from '../src/targets/pricing-review.js';
import {
  applyCoverageReviewQueue,
  buildCoverageReviewEvidence,
  buildCoverageReviewBatch,
  buildCoverageReviewDraft,
  buildCoverageReviewManualPack,
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
  writeCoverageReviewDraft,
  writeCoverageReviewManualPack,
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
import { authLoginDomainBlocker, urlDomainBlocker } from '../src/targets/auth-login-safety.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-targets-'));
}

describe('auth login safety', () => {
  it('allows sibling subdomains only when the target root domain confirms the same site', () => {
    const blocker = authLoginDomainBlocker({
      domain: 'example.com',
      login_url: 'https://accounts.example.com/login',
      submit_url: 'https://www.example.com/submit',
    });

    assert.equal(blocker, '');
  });

  it('does not treat public-suffix sibling domains as the same site', () => {
    const blocker = authLoginDomainBlocker({
      domain: 'example.co.uk',
      login_url: 'https://other.co.uk/login',
      submit_url: 'https://example.co.uk/submit',
    });

    assert.equal(blocker, 'login_domain_mismatch:other.co.uk->example.co.uk');
  });

  it('blocks external login hosts when the target domain is known', () => {
    const blocker = authLoginDomainBlocker({
      domain: 'directory.example',
      login_url: 'https://forms.gle/abc',
      submit_url: 'https://forms.gle/abc',
    });

    assert.equal(blocker, 'login_domain_mismatch:forms.gle->directory.example');
  });

  it('allows a final URL on an explicit external submit host', () => {
    const blocker = urlDomainBlocker({
      url: 'https://docs.google.com/forms/d/e/abc/viewform',
      domain: 'directory.example',
      allowed_urls: ['https://docs.google.com/forms/d/e/abc/viewform'],
      code: 'final_url_domain_mismatch',
    });

    assert.equal(blocker, '');
  });
});

describe('target URL normalization', () => {
  it('strips tracking params, hashes, default ports, and normalizes trailing slashes', () => {
    const normalized = normalizeUrl('HTTPS://WWW.Example.COM:443/submit/?utm_source=x&ref=abc&b=2&a=1#top');

    assert.equal(normalized.url, 'https://www.example.com/submit?a=1&b=2');
    assert.equal(normalized.domain, 'example.com');
    assert.equal(normalized.dedupeKey, 'example.com/submit?a=1&b=2');
  });

  it('strips tracking params from nested encoded redirect URLs', () => {
    const normalized = normalizeUrl('https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories&utm_source=x');

    assert.equal(normalized.url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
    assert.equal(normalized.dedupeKey, 'toolai.io/login?returnurl=%2fen%2fsubmit');
  });

  it('accepts bare domains and rejects non-http protocols', () => {
    assert.equal(normalizeUrl('example.com/path').url, 'https://example.com/path');
    assert.equal(normalizeUrl('mailto:test@example.com'), null);
  });
});

describe('backlog lanes', () => {
  it('builds worker-balanced lanes from pricing, auth, and coverage artifacts', () => {
    const dir = tempDir();
    try {
      const registryPath = join(dir, 'registry.yaml');
      writeFileSync(registryPath, `targets:
  - id: alpha
    name: Alpha
    submit_url: https://alpha.example/submit
    pricing: unknown
    submission:
      mode: assisted
  - id: beta
    name: Beta
    submit_url: https://beta.example/submit
    pricing: free
    submission:
      mode: needs_review
  - id: gamma
    name: Gamma
    submit_url: https://gamma.example/submit
    pricing: unknown
    submission:
      mode: manual_strategic
  - id: delta
    name: Delta
    submit_url: https://delta.example/submit
    pricing: paid
    submission:
      mode: skip
`, 'utf-8');

      const pricingManual = join(dir, 'pricing-manual.csv');
      writeFileSync(pricingManual, `batch_id,batch_order,queue_order,target_id,name,domain,mode,submit_url,review_decision
pricing-001,1,1,alpha,Alpha,alpha.example,assisted,https://alpha.example/submit,
pricing-001,2,2,beta,Beta,beta.example,assisted,https://beta.example/submit,
pricing-001,3,3,gamma,Gamma,gamma.example,assisted,https://gamma.example/submit,mark_paid
`, 'utf-8');

      const pricingStatus = join(dir, 'pricing-status.json');
      writeFileSync(pricingStatus, JSON.stringify({
        manual: pricingManual.replace(/\\/g, '/'),
        draft: 'draft.csv',
      }, null, 2), 'utf-8');

      const authBatchCsv = join(dir, 'auth-login-status-batch-001.csv');
      writeFileSync(authBatchCsv, `order,priority,target_id,name,domain,status,next_action,login_url,submit_url,auth_login_command
1,P0,alpha,Alpha,alpha.example,manual_login_required,run_auth_login_command,https://alpha.example/login,https://alpha.example/submit,cmd alpha
2,P0,beta,Beta,beta.example,manual_login_required,run_auth_login_command,https://beta.example/login,https://beta.example/submit,cmd beta
3,P1,gamma,Gamma,gamma.example,ready_for_auth_rescout,run_auth_scout_command,https://gamma.example/login,https://gamma.example/submit,cmd gamma
`, 'utf-8');

      const authSummary = join(dir, 'auth-summary.json');
      writeFileSync(authSummary, JSON.stringify({
        files: {
          status_reports: [
            { csv_output: authBatchCsv.replace(/\\/g, '/') },
          ],
        },
      }, null, 2), 'utf-8');

      const coverageManual = join(dir, 'coverage-manual.csv');
      writeFileSync(coverageManual, `manual_rank,priority,review_row,review_decision,target_id,domain,url
1,P0,11,,alpha,alpha.example,https://alpha.example/submit
2,P2,12,,beta,beta.example,https://beta.example/submit
3,P2,13,reject_not_submit,gamma,gamma.example,https://gamma.example/submit
`, 'utf-8');

      const coverageSummary = join(dir, 'coverage-summary.json');
      writeFileSync(coverageSummary, JSON.stringify({
        files: {
          remaining_manual_review_csv: coverageManual.replace(/\\/g, '/'),
        },
      }, null, 2), 'utf-8');

      const plan = buildBacklogLanes({
        registry: registryPath,
        outputDir: join(dir, 'lanes-out'),
        workers: 3,
        pricingStatus,
        pricingLaneSize: 1,
        authSummary,
        authLaneSize: 1,
        coverageSummary,
        coverageReview: join(dir, 'coverage-review.csv'),
        coverageLaneSize: 1,
        coverageP0LaneSize: 1,
      });

      assert.equal(plan.registry_backlog.total_targets, 4);
      assert.equal(plan.registry_backlog.non_skip_targets, 3);
      assert.equal(plan.workflow_backlog.pricing_manual_rows, 2);
      assert.equal(plan.workflow_backlog.auth_manual_login_rows, 2);
      assert.equal(plan.workflow_backlog.coverage_manual_review_rows, 2);
      assert.equal(plan.lanes.length, 6);
      assert.equal(plan.workers.length, 3);
      assert.equal(plan.lanes_summary.by_type.pricing_review_manual, 2);
      assert.equal(plan.lanes_summary.by_type.auth_manual_login, 2);
      assert.equal(plan.lanes_summary.by_type.coverage_manual_review_p0, 1);
      assert.equal(plan.lanes_summary.by_type.coverage_manual_review_p2, 1);

      const files = writeBacklogLanes(plan, { outputDir: join(dir, 'lanes-out') });
      assert.equal(existsSync(join(dir, 'lanes-out', 'backlog-lanes.json')), true);
      assert.equal(existsSync(join(dir, 'lanes-out', 'backlog-lanes.md')), true);
      assert.equal(files.lanes.length, 6);
      assert.equal(files.workers.length, 3);

      const workerDoc = readFileSync(join(dir, 'lanes-out', 'workers', 'worker-01.md'), 'utf-8');
      assert.match(workerDoc, /worker-01/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

describe('pricing review', () => {
  it('builds a read-only queue for runnable targets with unknown pricing', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: auto-safe-unknown
    name: Auto Safe Unknown
    domain: auto.example
    submit_url: https://auto.example/submit
    pricing: unknown
    forms:
      - fields: []
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
    submission:
      mode: auto_safe
      status: mapped
  - id: assisted-unknown
    name: Assisted Unknown
    domain: assisted.example
    submit_url: https://assisted.example/submit
    pricing: unknown
    submission:
      mode: assisted
      status: needs_auth
  - id: assisted-free
    name: Assisted Free
    domain: free.example
    submit_url: https://free.example/submit
    pricing: free
    submission:
      mode: assisted
  - id: review-unknown
    name: Review Unknown
    domain: review.example
    submit_url: https://review.example/submit
    pricing: unknown
    submission:
      mode: needs_review
`);

      const queue = buildPricingReviewQueue({ registry });
      assert.equal(queue.constraints.no_network, true);
      assert.equal(queue.constraints.no_registry_writes, true);
      assert.equal(queue.total_candidates, 2);
      assert.equal(queue.summary.rows, 2);
      assert.deepEqual(queue.rows.map(row => row.target_id), ['auto-safe-unknown', 'assisted-unknown']);
      assert.equal(queue.rows.every(row => row.review_decision === ''), true);

      const csv = pricingReviewQueueCsv(queue);
      assert.match(csv, /review_decision_options/);
      assert.match(csv, /mark_free \| mark_freemium \| mark_paid \| keep_unknown/);

      const written = writePricingReviewQueue(queue, { outputDir: join(dir, 'pricing-review') });
      assert.equal(existsSync(written.files.queue_csv), true);
      assert.equal(existsSync(written.files.queue_json), true);
      assert.equal(existsSync(written.files.queue_md), true);

      const after = loadRegistry(registry);
      assert.equal(after.targets.find(target => target.id === 'auto-safe-unknown').pricing, 'unknown');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can restrict pricing review queue rows with a target file', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const targetFile = join(dir, 'pricing-subset.csv');
      writeFileSync(registry, `
version: 1
targets:
  - id: keep-me
    name: Keep Me
    domain: keep.example
    submit_url: https://keep.example/submit
    pricing: unknown
    submission:
      mode: assisted
      status: auth_required
    quality:
      risk: low
  - id: skip-me
    name: Skip Me
    domain: skip.example
    submit_url: https://skip.example/submit
    pricing: unknown
    submission:
      mode: assisted
      status: auth_required
    quality:
      risk: low
`);
      writeFileSync(targetFile, [
        'target_id',
        'keep-me',
      ].join('\n') + '\n');

      const queue = buildPricingReviewQueue({
        registry,
        targetFile,
      });

      assert.equal(queue.summary.rows, 1);
      assert.equal(queue.rows[0].target_id, 'keep-me');
      assert.equal(queue.target_file, targetFile.replace(/\\/g, '/'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('collects GET-only pricing evidence and creates non-binding suggestions', async () => {
    const dir = tempDir();
    try {
      const queuePath = join(dir, 'pricing-review-queue.csv');
      writeFileSync(queuePath, [
        'queue_order,priority,priority_score,target_id,name,domain,mode,submission_status,pricing,risk,lang,submit_url,final_url,last_scouted_at,auth,captcha,form_count,last_submitted_at,review_decision,review_decision_options,review_notes,reviewed_by',
        '1,P1,240,paid-target,Paid Target,paid.example,assisted,mapped,unknown,unknown,en,https://paid.example/submit,,,,none,none,1,,,,',
        '2,P1,240,free-target,Free Target,free.example,assisted,mapped,unknown,unknown,en,https://free.example/submit,,,,none,none,1,,,,',
        '3,P1,240,freemium-target,Freemium Target,freemium.example,assisted,mapped,unknown,unknown,en,https://freemium.example/submit,,,,none,none,1,,,,',
      ].join('\n') + '\n');

      const htmlByHost = {
        'paid.example': '<html><title>Submit listing</title><form><input name="url"><button type="submit">Submit</button></form><p>Paid listing. Submission fee $49.</p></html>',
        'free.example': '<html><title>Submit tool</title><form><input name="url"><button type="submit">Submit</button></form><p>Submit your tool for free with a free listing.</p></html>',
        'freemium.example': '<html><title>List product</title><form><input name="url"><button type="submit">List</button></form><p>Free basic listing. Premium listing upgrade available.</p></html>',
      };
      const fakeFetch = async (url) => {
        const host = new URL(url).hostname;
        return {
          status: 200,
          ok: true,
          url,
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => htmlByHost[host],
        };
      };

      const evidence = await buildPricingReviewEvidence(queuePath, { fetchFn: fakeFetch });
      assert.equal(evidence.constraints.get_only, true);
      assert.equal(evidence.constraints.no_submission, true);
      assert.equal(evidence.checked_rows, 3);
      assert.equal(evidence.summary.payment_signals, 1);
      assert.equal(evidence.summary.free_signals, 2);
      assert.equal(evidence.summary.by_suggested_pricing_signal.paid, 1);
      assert.equal(evidence.summary.by_suggested_pricing_signal.free, 1);
      assert.equal(evidence.summary.by_suggested_pricing_signal.freemium, 1);

      const evidenceCsv = join(dir, 'pricing-review-evidence.csv');
      const evidenceJson = join(dir, 'pricing-review-evidence.json');
      writePricingReviewEvidence(evidence, { output: evidenceCsv, jsonOutput: evidenceJson });
      assert.equal(existsSync(evidenceCsv), true);
      assert.equal(existsSync(evidenceJson), true);
      assert.match(pricingReviewEvidenceCsv(evidence), /suggested_pricing_signal/);

      const suggestions = buildPricingReviewSuggestions(queuePath, evidenceCsv);
      assert.equal(suggestions.constraints.non_binding, true);
      assert.equal(suggestions.summary.by_suggested_pricing.paid, 1);
      assert.equal(suggestions.summary.by_suggested_pricing.free, 1);
      assert.equal(suggestions.summary.by_suggested_pricing.freemium, 1);
      assert.equal(suggestions.rows.every(row => row.automation_policy === 'non_binding_suggestion_no_registry_write_no_submission'), true);

      const suggestionsCsv = pricingReviewSuggestionsCsv(suggestions);
      assert.match(suggestionsCsv, /mark_paid/);
      assert.match(suggestionsCsv, /mark_free/);
      assert.match(suggestionsCsv, /mark_freemium/);

      const written = writePricingReviewSuggestions(suggestions, {
        output: join(dir, 'pricing-review-suggestions.csv'),
        jsonOutput: join(dir, 'pricing-review-suggestions.json'),
        markdownOutput: join(dir, 'pricing-review-suggestions.md'),
      });
      assert.equal(existsSync(written.files.suggestions_csv), true);
      assert.equal(existsSync(written.files.suggestions_json), true);
      assert.equal(existsSync(written.files.suggestions_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a pricing decision draft that remains blocked until human review', () => {
    const dir = tempDir();
    try {
      const suggestionsPath = join(dir, 'pricing-review-suggestions.csv');
      writeFileSync(suggestionsPath, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,reviewer_action,suggested_review_notes,suggestion_basis,evidence_matched,http_status,fetch_ok,final_url,final_domain,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,free_signal,freemium_signal,pricing_page_signal,checked_at,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,confirm,evidence free,basis free,yes,200,yes,https://free.example/submit,free.example,yes,yes,yes,no,no,no,no,no,yes,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '2,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,confirm,evidence paid,basis paid,yes,200,yes,https://paid.example/submit,paid.example,yes,yes,yes,no,no,no,no,yes,no,no,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
      ].join('\n') + '\n');

      const draft = buildPricingReviewDecisionDraft(suggestionsPath);
      assert.equal(draft.constraints.review_decision_left_blank, true);
      assert.equal(draft.summary.rows, 2);
      assert.equal(draft.summary.rows_requiring_human_review, 2);
      assert.equal(draft.rows.every(row => row.review_decision === ''), true);
      assert.equal(draft.rows[0].suggested_review_decision, 'mark_free');
      assert.equal(draft.rows[1].suggested_review_decision, 'mark_paid');

      const csv = pricingReviewDecisionDraftCsv(draft);
      assert.match(csv, /pricing_decision_draft_no_registry_write_no_submission/);
      assert.match(csv, /reviewed_pricing/);

      const draftCsv = join(dir, 'pricing-review-decision-draft.csv');
      writeFileSync(draftCsv, csv);
      const validation = validatePricingReviewDecisions(draftCsv);
      assert.equal(validation.ok, false);
      assert.equal(validation.blockers.filter(item => item.code === 'review_decision_missing').length, 2);

      const written = writePricingReviewDecisionDraft(draft, { outputDir: join(dir, 'pricing-review') });
      assert.equal(existsSync(written.files.decision_csv), true);
      assert.equal(existsSync(written.files.decision_json), true);
      assert.equal(existsSync(written.files.decision_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates focused pricing decision batches that still fail closed until reviewed', () => {
    const dir = tempDir();
    try {
      const suggestionsPath = join(dir, 'pricing-review-suggestions.csv');
      writeFileSync(suggestionsPath, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,reviewer_action,suggested_review_notes,suggestion_basis,evidence_matched,http_status,fetch_ok,final_url,final_domain,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,free_signal,freemium_signal,pricing_page_signal,checked_at,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,confirm,evidence free,basis free,yes,200,yes,https://free.example/submit,free.example,yes,yes,yes,no,no,no,no,no,yes,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '2,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,confirm,evidence paid,basis paid,yes,200,yes,https://paid.example/submit,paid.example,yes,yes,yes,no,no,no,no,yes,no,no,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '3,freemium-target,Freemium Target,freemium.example,assisted,https://freemium.example/submit,unknown,freemium,mark_freemium,medium,confirm,evidence freemium,basis freemium,yes,200,yes,https://freemium.example/submit,freemium.example,yes,yes,yes,no,no,no,no,yes,yes,yes,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '4,unknown-target,Unknown Target,unknown.example,assisted,https://unknown.example/submit,unknown,unknown,keep_unknown,low,review,evidence weak,basis weak,no,200,yes,https://unknown.example/submit,unknown.example,no,no,yes,no,no,no,no,no,no,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
      ].join('\n') + '\n');

      const draft = buildPricingReviewDecisionDraft(suggestionsPath);
      const draftCsv = join(dir, 'pricing-review-decision-draft.csv');
      writeFileSync(draftCsv, pricingReviewDecisionDraftCsv(draft));

      const batch = buildPricingReviewDecisionBatch(draftCsv, {
        batchId: 'pricing-potential-free-001',
        suggestedDecision: 'mark_free,mark_freemium',
        limit: 10,
      });
      assert.equal(batch.batch_id, 'pricing-potential-free-001');
      assert.equal(batch.total_draft_rows, 4);
      assert.equal(batch.matching_rows, 2);
      assert.equal(batch.summary.rows, 2);
      assert.equal(batch.remaining_after_batch, 0);
      assert.deepEqual(batch.rows.map(row => row.target_id), ['free-target', 'freemium-target']);
      assert.equal(batch.rows.every(row => row.batch_id === 'pricing-potential-free-001'), true);
      assert.equal(batch.rows.every(row => row.review_decision === ''), true);

      const csv = pricingReviewDecisionBatchCsv(batch);
      assert.match(csv, /^batch_id,batch_order,queue_order,target_id/);
      assert.match(csv, /pricing_decision_draft_no_registry_write_no_submission/);
      assert.match(pricingReviewDecisionBatchMarkdown(batch), /validate-pricing-review-decisions/);

      const batchCsv = join(dir, 'pricing-potential-free-001.csv');
      writeFileSync(batchCsv, csv);
      const validation = validatePricingReviewDecisions(batchCsv);
      assert.equal(validation.ok, false);
      assert.equal(validation.blockers.filter(item => item.code === 'review_decision_missing').length, 2);

      const written = writePricingReviewDecisionBatch(batch, { outputDir: join(dir, 'decision-batches') });
      assert.equal(existsSync(written.files.batch_csv), true);
      assert.equal(existsSync(written.files.batch_json), true);
      assert.equal(existsSync(written.files.batch_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a manual pricing review pack without making decisions or registry writes', () => {
    const dir = tempDir();
    try {
      const suggestionsPath = join(dir, 'pricing-review-suggestions.csv');
      writeFileSync(suggestionsPath, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,reviewer_action,suggested_review_notes,suggestion_basis,evidence_matched,http_status,fetch_ok,final_url,final_domain,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,free_signal,freemium_signal,pricing_page_signal,checked_at,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,confirm,evidence free,basis free,yes,200,yes,https://free.example/submit,free.example,yes,yes,yes,no,no,no,no,no,yes,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '2,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,confirm,evidence paid,basis paid,yes,200,yes,https://paid.example/submit,paid.example,yes,yes,yes,no,no,no,no,yes,no,no,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
      ].join('\n') + '\n');
      const draft = buildPricingReviewDecisionDraft(suggestionsPath);
      const draftCsv = join(dir, 'pricing-review-decision-draft.csv');
      writeFileSync(draftCsv, pricingReviewDecisionDraftCsv(draft));

      const batch = buildPricingReviewDecisionBatch(draftCsv, {
        batchId: 'pricing-free-001',
        suggestedDecision: 'mark_free',
        limit: 10,
      });
      const batchCsv = join(dir, 'pricing-free-001.csv');
      writeFileSync(batchCsv, pricingReviewDecisionBatchCsv(batch));

      const pack = buildPricingReviewManualPack(draftCsv, { batchPath: batchCsv });
      assert.equal(pack.ok, true);
      assert.equal(pack.status, 'manual_pack_ready');
      assert.equal(pack.constraints.no_auto_decisions, true);
      assert.equal(pack.constraints.no_registry_writes, true);
      assert.equal(pack.source.kind, 'batch');
      assert.equal(pack.summary.rows, 1);
      assert.equal(pack.summary.unreviewed_rows, 1);
      assert.equal(pack.summary.strict_validation_ok, false);
      assert.equal(pack.summary.strict_validation_blockers, 1);
      assert.equal(pack.rows[0].review_decision, '');
      assert.equal(pack.rows[0].manual_review_url, 'https://free.example/submit');
      assert.match(pack.rows[0].review_notes_template, /Manual browser review checked/);

      const csv = pricingReviewManualPackCsv(pack);
      assert.match(csv, /^batch_id,batch_order,queue_order,target_id/);
      assert.match(csv, /manual_review_checklist/);
      assert.match(csv, /allowed_review_decisions/);

      const written = writePricingReviewManualPack(pack, { outputDir: join(dir, 'manual-review') });
      assert.equal(existsSync(written.files.manual_csv), true);
      assert.equal(existsSync(written.files.manual_json), true);
      assert.equal(existsSync(written.files.manual_md), true);
      assert.match(readFileSync(written.files.manual_md, 'utf-8'), /merge-pricing-review-decision-batch/);

      const changedIdentity = {
        ...batch,
        rows: batch.rows.map(row => ({ ...row, submit_url: 'https://changed.example/submit' })),
      };
      const changedIdentityCsv = join(dir, 'pricing-free-001.changed.csv');
      writeFileSync(changedIdentityCsv, pricingReviewDecisionBatchCsv(changedIdentity));
      const blockedPack = buildPricingReviewManualPack(draftCsv, { batchPath: changedIdentityCsv });
      assert.equal(blockedPack.ok, false);
      assert.equal(blockedPack.blockers.some(item => item.code === 'decision_batch_identity_changed'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports manual pricing review status and merge readiness without writes', () => {
    const dir = tempDir();
    try {
      const suggestionsPath = join(dir, 'pricing-review-suggestions.csv');
      writeFileSync(suggestionsPath, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,reviewer_action,suggested_review_notes,suggestion_basis,evidence_matched,http_status,fetch_ok,final_url,final_domain,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,free_signal,freemium_signal,pricing_page_signal,checked_at,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,confirm,evidence free,basis free,yes,200,yes,https://free.example/submit,free.example,yes,yes,yes,no,no,no,no,no,yes,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '2,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,confirm,evidence paid,basis paid,yes,200,yes,https://paid.example/submit,paid.example,yes,yes,yes,no,no,no,no,yes,no,no,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
      ].join('\n') + '\n');
      const draft = buildPricingReviewDecisionDraft(suggestionsPath);
      const draftCsv = join(dir, 'pricing-review-decision-draft.csv');
      writeFileSync(draftCsv, pricingReviewDecisionDraftCsv(draft));

      const batch = buildPricingReviewDecisionBatch(draftCsv, {
        batchId: 'pricing-free-001',
        suggestedDecision: 'mark_free',
        limit: 10,
      });
      const batchCsv = join(dir, 'pricing-free-001.csv');
      writeFileSync(batchCsv, pricingReviewDecisionBatchCsv(batch));

      const blocked = buildPricingReviewManualStatus(batchCsv, { draftPath: draftCsv });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.status, 'blocked_review_required');
      assert.equal(blocked.summary.unreviewed_rows, 1);
      assert.equal(blocked.summary.validation_blockers, 1);
      assert.equal(blocked.summary.merge_preview_status, 'blocked_batch_validation');
      assert.equal(blocked.next_rows[0].target_id, 'free-target');

      const reviewedBatch = {
        ...batch,
        rows: batch.rows.map(row => ({
          ...row,
          review_decision: 'mark_free',
          reviewed_pricing: 'free',
          reviewer: 'tester',
          reviewed_at: '2026-05-23T00:00:00.000Z',
          review_notes: 'Manual browser review confirmed a free submission path.',
        })),
      };
      const reviewedBatchCsv = join(dir, 'pricing-free-001.reviewed.csv');
      writeFileSync(reviewedBatchCsv, pricingReviewDecisionBatchCsv(reviewedBatch));
      const ready = buildPricingReviewManualStatus(reviewedBatchCsv, { draftPath: draftCsv });
      assert.equal(ready.ok, true);
      assert.equal(ready.status, 'ready_for_next_gate');
      assert.equal(ready.summary.reviewed_rows, 1);
      assert.equal(ready.summary.merge_preview_ok, true);
      assert.equal(ready.summary.merge_proposals, 1);
      assert.deepEqual(ready.next_rows, []);

      const jsonOutput = join(dir, 'manual-status.json');
      const markdownOutput = join(dir, 'manual-status.md');
      const written = writePricingReviewManualStatusReport(blocked, { jsonOutput, markdownOutput });
      assert.equal(existsSync(written.files.status_json), true);
      assert.equal(existsSync(written.files.status_md), true);
      assert.match(readFileSync(markdownOutput, 'utf-8'), /Pricing Review Manual Status/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('merges reviewed pricing decision batches into a new draft without registry writes', () => {
    const dir = tempDir();
    try {
      const suggestionsPath = join(dir, 'pricing-review-suggestions.csv');
      writeFileSync(suggestionsPath, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,reviewer_action,suggested_review_notes,suggestion_basis,evidence_matched,http_status,fetch_ok,final_url,final_domain,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,free_signal,freemium_signal,pricing_page_signal,checked_at,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,confirm,evidence free,basis free,yes,200,yes,https://free.example/submit,free.example,yes,yes,yes,no,no,no,no,no,yes,no,no,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
        '2,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,confirm,evidence paid,basis paid,yes,200,yes,https://paid.example/submit,paid.example,yes,yes,yes,no,no,no,no,yes,no,no,yes,2026-05-23T00:00:00.000Z,non_binding_suggestion_no_registry_write_no_submission',
      ].join('\n') + '\n');
      const draft = buildPricingReviewDecisionDraft(suggestionsPath);
      const draftCsv = join(dir, 'pricing-review-decision-draft.csv');
      writeFileSync(draftCsv, pricingReviewDecisionDraftCsv(draft));

      const blankBatch = buildPricingReviewDecisionBatch(draftCsv, {
        batchId: 'pricing-free-001',
        suggestedDecision: 'mark_free',
        limit: 10,
      });
      const blankBatchCsv = join(dir, 'pricing-free-001.blank.csv');
      writeFileSync(blankBatchCsv, pricingReviewDecisionBatchCsv(blankBatch));
      const blocked = buildPricingReviewDecisionBatchMerge(draftCsv, blankBatchCsv);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.status, 'blocked_batch_validation');
      assert.equal(blocked.blockers.some(item => item.code === 'review_decision_missing'), true);

      const reviewedBatch = {
        ...blankBatch,
        rows: blankBatch.rows.map(row => ({
          ...row,
          review_decision: 'mark_free',
          reviewed_pricing: 'free',
          reviewer: 'tester',
          reviewed_at: '2026-05-23T00:00:00.000Z',
          review_notes: 'Manual browser review confirmed a free submission path.',
        })),
      };
      const reviewedBatchCsv = join(dir, 'pricing-free-001.reviewed.csv');
      writeFileSync(reviewedBatchCsv, pricingReviewDecisionBatchCsv(reviewedBatch));

      const preview = buildPricingReviewDecisionBatchMerge(draftCsv, reviewedBatchCsv);
      assert.equal(preview.ok, true);
      assert.equal(preview.status, 'merge_preview_ready');
      assert.equal(preview.proposals_count, 1);
      assert.equal(preview.updated_summary.reviewed_rows, 1);
      assert.equal(parseCsv(readFileSync(draftCsv, 'utf-8'))[0].review_decision, '');

      const output = join(dir, 'pricing-review-decision-draft.updated.csv');
      const jsonOutput = join(dir, 'pricing-review-decision-batch-merge.json');
      const written = writePricingReviewDecisionBatchMerge(preview, { output, jsonOutput });
      assert.equal(existsSync(written.files.updated_draft_csv), true);
      assert.equal(existsSync(written.files.merge_report_json), true);
      const mergedRows = parseCsv(readFileSync(output, 'utf-8'));
      assert.equal(mergedRows[0].review_decision, 'mark_free');
      assert.equal(mergedRows[1].review_decision, '');

      const changedIdentity = {
        ...reviewedBatch,
        rows: reviewedBatch.rows.map(row => ({ ...row, domain: 'changed.example' })),
      };
      const changedIdentityCsv = join(dir, 'pricing-free-001.changed.csv');
      writeFileSync(changedIdentityCsv, pricingReviewDecisionBatchCsv(changedIdentity));
      const identityBlocked = buildPricingReviewDecisionBatchMerge(draftCsv, changedIdentityCsv);
      assert.equal(identityBlocked.ok, false);
      assert.equal(identityBlocked.blockers.some(item => item.code === 'decision_batch_identity_changed'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies reviewed pricing decisions only through an explicit write gate', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const decisions = join(dir, 'pricing-review-decisions.csv');
      writeFileSync(registry, `
version: 1
targets:
  - id: free-target
    name: Free Target
    domain: free.example
    submit_url: https://free.example/submit
    pricing: unknown
    submission:
      mode: auto_safe
      status: mapped
      reason: mapped_form
    technical:
      auth: none
      captcha: none
      reachable: yes
      last_scouted_at: 2026-05-22T00:00:00.000Z
    forms:
      - fields:
          - mapped_to: product.name
          - mapped_to: product.url
          - mapped_to: product.description
        submit_buttons:
          - selector: button[type="submit"]
  - id: freemium-target
    name: Freemium Target
    domain: freemium.example
    submit_url: https://freemium.example/submit
    pricing: unknown
    submission:
      mode: assisted
      reason: auth_or_manual_signal
  - id: paid-target
    name: Paid Target
    domain: paid.example
    submit_url: https://paid.example/submit
    pricing: unknown
    submission:
      mode: assisted
      reason: auth_or_manual_signal
`);
      writeFileSync(decisions, [
        'queue_order,target_id,name,domain,mode,submit_url,current_pricing,suggested_pricing,suggested_review_decision,suggestion_confidence,review_decision,reviewed_pricing,reviewer,reviewed_at,review_notes,evidence_url,evidence_matched,http_status,fetch_ok,payment_signal,free_signal,freemium_signal,captcha_signal,cloudflare_signal,suggestion_basis,automation_policy',
        '1,free-target,Free Target,free.example,auto_safe,https://free.example/submit,unknown,free,mark_free,high,mark_free,free,tester,2026-05-23T00:00:00.000Z,Manual review confirmed a free submission path.,https://free.example/submit,yes,200,yes,no,yes,no,no,no,free signal,pricing_decision_draft_no_registry_write_no_submission',
        '2,freemium-target,Freemium Target,freemium.example,assisted,https://freemium.example/submit,unknown,freemium,mark_freemium,medium,mark_freemium,freemium,tester,2026-05-23T00:00:00.000Z,Manual review confirmed free basic plus paid featured options.,https://freemium.example/submit,yes,200,yes,yes,yes,yes,no,no,freemium signal,pricing_decision_draft_no_registry_write_no_submission',
        '3,paid-target,Paid Target,paid.example,assisted,https://paid.example/submit,unknown,paid,mark_paid,high,mark_paid,paid,tester,2026-05-23T00:00:00.000Z,Manual review confirmed only paid listing submissions are available.,https://paid.example/submit,yes,200,yes,yes,no,no,no,no,paid signal,pricing_decision_draft_no_registry_write_no_submission',
      ].join('\n') + '\n');

      const validation = validatePricingReviewDecisions(decisions);
      assert.equal(validation.ok, true);

      const preview = applyPricingReviewDecisionPatch(registry, decisions);
      assert.equal(preview.ok, true);
      assert.equal(preview.wrote_registry, false);
      assert.equal(preview.proposals_count, 3);
      assert.equal(preview.proposals.find(row => row.target_id === 'paid-target').next_mode, 'skip');

      let loaded = loadRegistry(registry);
      assert.equal(loaded.targets.find(target => target.id === 'free-target').pricing, 'unknown');

      const written = applyPricingReviewDecisionPatch(registry, decisions, { writeRegistry: true });
      assert.equal(written.wrote_registry, true);
      assert.equal(written.status, 'registry_written_requires_audit_before_execution');

      loaded = loadRegistry(registry);
      assert.equal(loaded.targets.find(target => target.id === 'free-target').pricing, 'free');
      assert.equal(loaded.targets.find(target => target.id === 'free-target').submission.mode, 'auto_safe');
      assert.equal(loaded.targets.find(target => target.id === 'freemium-target').pricing, 'freemium');
      assert.equal(loaded.targets.find(target => target.id === 'paid-target').pricing, 'paid');
      assert.equal(loaded.targets.find(target => target.id === 'paid-target').submission.mode, 'skip');
      assert.equal(loaded.targets.find(target => target.id === 'paid-target').submission.reason, 'pricing_review_paid_confirmed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires a post-apply pricing gate and blocks newly opened auto_safe plans by default', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const reportPath = join(dir, 'pricing-review-post-apply-gate.json');
      writeFileSync(registry, `
version: 1
targets:
  - id: safe-free-target
    name: Safe Free Target
    domain: safe.example
    submit_url: https://safe.example/submit
    pricing: free
    quality:
      risk: low
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
      auth: none
      captcha: none
      reachable: yes
    forms:
      - fields:
          - mapped_to: product.name
            selector: input[name="name"]
            required: true
          - mapped_to: product.url
            selector: input[name="url"]
            required: true
          - mapped_to: product.description
            selector: textarea[name="description"]
            required: true
        submit_buttons:
          - selector: button[type="submit"]
    submission:
      mode: auto_safe
      status: mapped
      reason: form_mapped_no_auth_no_captcha
`);

      const blocked = buildPricingReviewPostApplyGate({ registry });
      assert.equal(blocked.audit_summary.ok, true);
      assert.equal(blocked.plan_summary.targets, 1);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.blockers[0].code, 'post_apply_auto_safe_plan_not_empty');
      assert.equal(blocked.constraints.no_submission, true);

      const allowed = buildPricingReviewPostApplyGate({ registry, allowPlanTargets: true });
      assert.equal(allowed.ok, true);
      assert.equal(allowed.plan_summary.targets, 1);

      const written = writePricingReviewPostApplyGateReport(blocked, reportPath);
      assert.equal(written.endsWith('pricing-review-post-apply-gate.json'), true);
      assert.equal(existsSync(reportPath), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
      writeFileSync(join(inputDir, 'coverage-review-queue.csv'), '"url"\n"https://ignored.example/submit"\n');
      mkdirp(join(inputDir, 'manual-review'));
      writeFileSync(join(inputDir, 'manual-review', 'remaining.csv'), '"url"\n"https://ignored-manual.example/submit"\n');

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

  it('preserves nested CSV source provenance and skips documentation placeholders', () => {
    const dir = tempDir();
    try {
      const inputDir = join(dir, 'backlink-url');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, 'version: 1\ntargets: []\n');
      mkdirp(inputDir);
      writeFileSync(join(inputDir, 'repo-external-links.csv'), [
        '"url","source_files","source_locations"',
        '"https://any-site.com/submit","README.md; docs/guide.md","README.md:54; docs/guide.md:201"',
      ].join('\n'));

      const report = buildCoverageReport(inputDir, { registry });
      const item = report.items.find(row => row.domain === 'any-site.com');
      const reviewCsv = coverageReviewCsv(report);

      assert.deepEqual(item.source_files, ['README.md', 'docs/guide.md']);
      assert.deepEqual(item.source_locations, ['README.md:54', 'docs/guide.md:201']);
      assert.equal(item.occurrence_count, 2);
      assert.equal(item.candidate_import_recommendation, 'skip_placeholder_url');
      assert.match(reviewCsv, /reject_not_submit,do_not_import_placeholder_url/);
      assert.match(reviewCsv, /coverage_placeholder_filter/);
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
      assert.equal(queue.rows[2].review_decision_options, 'approved | reject_not_directory | reject_not_submit | reject_paid | reject_auth_required');
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
      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_not_submit');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].suggested_pricing, '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prioritizes non-submit same-domain root URLs over broad auth or pricing signals', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,300,10,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,verify same-domain variant,,,,Directory Root,unknown,unknown,domain_in_registry_only,review_submit_url,https://root.example/,root.example,1,coverage.csv,coverage.csv:2,root-existing,https://root.example/submit',
      ].join('\n'));
      writeFileSync(evidence, [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
        'p0-001,1,10,verify_distinct_submit_url_for_existing_domain,https://root.example/,root.example,200,yes,https://root.example/,root.example,no,text/html,Root Directory,3,5,yes,no,yes,yes,no,no,no,yes,no,reject_paid,login and payment text found,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);

      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_not_submit');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].reviewer_action, 'reject_unless_manual_review_finds_a_distinct_submit_endpoint_at_this_exact_url');
      assert.match(suggestions.rows[0].suggestion_basis, /does not contain an explicit submission path/);
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

  it('classifies obvious P2 content pages as not-directory before broad auth or pricing signals', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p2-001,1,P2,50,10,,approved | reject_not_directory | reject_not_submit | reject_paid | reject_auth_required,verify_directory_fit_before_any_approval,verify directory fit,,,,Blog Article,unknown,unknown,missing_domain,needs_manual_review,https://blog.example.com/2025/02/10/productivity-tips.html,blog.example.com,1,coverage.csv,coverage.csv:2,,',
      ].join('\n'));
      writeFileSync(evidence, [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
        'p2-001,1,10,verify_directory_fit_before_any_approval,https://blog.example.com/2025/02/10/productivity-tips.html,blog.example.com,200,yes,https://blog.example.com/2025/02/10/productivity-tips.html,blog.example.com,no,text/html,Productivity Tips,3,12,yes,no,yes,yes,no,yes,no,yes,no,reject_paid,login and payment text found,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);

      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_not_directory');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].reviewer_action, 'reject_non_directory_source_page');
      assert.match(suggestions.rows[0].suggestion_basis, /source article/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects non-production placeholder domains before manual browser review', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const evidence = join(dir, 'coverage-review-evidence.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,300,10,,approved | reject_not_submit | reject_paid | reject_auth_required,verify_submit_form_then_approve_or_reject,verify submit form,,,,Example,unknown,unknown,missing_domain,review_submit_url,https://a.example/submit,a.example,1,tests/campaign.test.js,tests/campaign.test.js:8,,',
      ].join('\n'));
      writeFileSync(evidence, [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
      ].join('\n'));

      const suggestions = buildCoverageReviewSuggestions(batch, evidence);

      assert.equal(suggestions.rows[0].suggested_review_decision, 'reject_not_submit');
      assert.equal(suggestions.rows[0].suggestion_confidence, 'high');
      assert.equal(suggestions.rows[0].reviewer_action, 'reject_non_production_placeholder_url');
      assert.match(suggestions.rows[0].suggestion_basis, /reserved\/example domain/);
      assert.equal(suggestions.summary.high_confidence_rejections, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('drafts only high-confidence rejection suggestions into editable batches', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const suggestions = join(dir, 'coverage-review-suggestions.csv');
      const output = join(dir, 'drafts', 'p0-draft.csv');
      const jsonOutput = join(dir, 'drafts', 'p0-draft.json');
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
        'p0-001,1,P0,300,10,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,verify duplicate,,,,Duplicate,unknown,unknown,domain_in_registry_only,review_submit_url,https://dup.example/submit,dup.example,1,coverage.csv,coverage.csv:2,dup-existing,https://dup.example/submit',
        'p0-001,2,P0,290,11,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,manual check,,,,Manual,unknown,unknown,domain_in_registry_only,review_submit_url,https://manual.example/submit,manual.example,1,coverage.csv,coverage.csv:3,manual-existing,https://manual.example/add',
        'p0-001,3,P0,280,12,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,low confidence,,,,Low,unknown,unknown,domain_in_registry_only,review_submit_url,https://low.example/submit,low.example,1,coverage.csv,coverage.csv:4,low-existing,https://low.example/add',
        'p0-001,4,P0,270,13,reject_not_submit,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,already reviewed,old note,qa,,Reviewed,unknown,unknown,domain_in_registry_only,review_submit_url,https://reviewed.example/submit,reviewed.example,1,coverage.csv,coverage.csv:5,reviewed-existing,https://reviewed.example/add',
        'p0-001,5,P2,260,14,,approved | reject_not_directory | reject_not_submit | reject_paid | reject_auth_required,verify_directory_fit_before_any_approval,not directory,,,,Article,unknown,unknown,missing_domain,needs_manual_review,https://article.example/post,article.example,1,coverage.csv,coverage.csv:6,,',
      ].join('\n'));
      writeFileSync(suggestions, [
        [
          'batch_id',
          'batch_order',
          'review_row',
          'priority',
          'review_action',
          'url',
          'domain',
          'current_review_decision',
          'review_decision_options',
          'evidence_suggested_decision',
          'suggested_review_decision',
          'suggestion_confidence',
          'possible_approval_decision',
          'reviewer_action',
          'suggested_review_notes',
          'suggested_pricing',
          'suggestion_basis',
          'evidence_matched',
          'evidence_match_key',
          'http_status',
          'fetch_ok',
          'final_url',
          'final_domain',
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
          'fetch_error',
          'checked_at',
        ].join(','),
        'p0-001,1,10,P0,verify_distinct_submit_url_for_existing_domain,https://dup.example/submit,dup.example,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,reject_duplicate,reject_duplicate,high,,reject_if_registry_url_is_the_same_submission_endpoint,duplicate evidence,,duplicate,yes,review_row:10,200,yes,https://dup.example/submit,dup.example,1,2,yes,yes,yes,no,no,no,no,no,yes,,2026-05-22T00:00:00.000Z',
        'p0-001,2,11,P0,verify_distinct_submit_url_for_existing_domain,https://manual.example/submit,manual.example,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,review_possible_domain_variant,needs_manual_check,medium,approved_domain_variant,manual_confirm_public_free_submit_form_before_approval,possible form,,form evidence,yes,review_row:11,200,yes,https://manual.example/submit,manual.example,1,2,yes,yes,yes,no,no,no,no,no,no,,2026-05-22T00:00:00.000Z',
        'p0-001,3,12,P0,verify_distinct_submit_url_for_existing_domain,https://low.example/submit,low.example,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,review_fetch_failed,needs_manual_check,low,,manual_browser_check_required_before_decision,fetch failed,,fetch failed,yes,review_row:12,,no,,,0,0,no,yes,unknown,unknown,unknown,unknown,unknown,unknown,unknown,fetch failed,2026-05-22T00:00:00.000Z',
        'p0-001,4,13,P0,verify_distinct_submit_url_for_existing_domain,https://reviewed.example/submit,reviewed.example,reject_not_submit,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,reject_auth_required,reject_auth_required,high,,reject_or_route_to_assisted_manual_flow,auth evidence,,auth,yes,review_row:13,200,yes,https://reviewed.example/submit,reviewed.example,1,2,yes,no,yes,yes,no,no,no,no,no,,2026-05-22T00:00:00.000Z',
        'p0-001,5,14,P2,verify_directory_fit_before_any_approval,https://article.example/post,article.example,,approved | reject_not_directory | reject_not_submit | reject_paid | reject_auth_required,reject_not_directory,reject_not_directory,high,,reject_non_directory_source_page,not directory evidence,,not directory,yes,review_row:14,200,yes,https://article.example/post,article.example,1,2,yes,no,yes,no,no,no,no,no,no,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      const draft = buildCoverageReviewDraft(batch, suggestions, { reviewedBy: 'evidence-bot' });
      writeCoverageReviewDraft(draft, { output, jsonOutput });
      const rows = parseCsv(readFileSync(output, 'utf-8'));
      const report = JSON.parse(readFileSync(jsonOutput, 'utf-8'));

      assert.equal(draft.drafted_rows, 2);
      assert.equal(draft.skipped_rows, 3);
      assert.equal(draft.blocked_rows, 0);
      assert.equal(rows[0].review_decision, 'reject_duplicate');
      assert.equal(rows[0].reviewed_by, 'evidence-bot');
      assert.match(rows[0].review_notes, /drafted from read-only evidence suggestion/);
      assert.equal(rows[1].review_decision, '');
      assert.equal(rows[2].review_decision, '');
      assert.equal(rows[3].review_decision, 'reject_not_submit');
      assert.equal(rows[3].review_notes, 'old note');
      assert.equal(rows[4].review_decision, 'reject_not_directory');
      assert.equal(rows[4].reviewed_by, 'evidence-bot');
      assert.equal(report.mode_policy, 'drafts_rejections_only_no_approvals_no_registry_changes');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on invalid coverage review draft confidence thresholds', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'coverage-review-batch.csv');
      const suggestions = join(dir, 'coverage-review-suggestions.csv');
      writeFileSync(batch, [
        'batch_id,batch_order,priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'p0-001,1,P0,300,10,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,verify_distinct_submit_url_for_existing_domain,verify duplicate,,,,Duplicate,unknown,unknown,domain_in_registry_only,review_submit_url,https://dup.example/submit,dup.example,1,coverage.csv,coverage.csv:2,dup-existing,https://dup.example/submit',
      ].join('\n'));
      writeFileSync(suggestions, [
        'batch_id,batch_order,review_row,priority,review_action,url,domain,current_review_decision,review_decision_options,evidence_suggested_decision,suggested_review_decision,suggestion_confidence,possible_approval_decision,reviewer_action,suggested_review_notes,suggested_pricing,suggestion_basis,evidence_matched,evidence_match_key,http_status,fetch_ok,final_url,final_domain,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,fetch_error,checked_at',
        'p0-001,1,10,P0,verify_distinct_submit_url_for_existing_domain,https://dup.example/submit,dup.example,,approved_domain_variant | reject_duplicate | reject_not_submit | reject_paid | reject_auth_required,reject_duplicate,reject_duplicate,high,,reject_if_registry_url_is_the_same_submission_endpoint,duplicate evidence,,duplicate,yes,review_row:10,200,yes,https://dup.example/submit,dup.example,1,2,yes,yes,yes,no,no,no,no,no,yes,,2026-05-22T00:00:00.000Z',
      ].join('\n'));

      assert.throws(
        () => buildCoverageReviewDraft(batch, suggestions, { minConfidence: 'certain' }),
        /Invalid min confidence/
      );
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

  it('builds a manual review pack from queue rows and prior evidence', () => {
    const dir = tempDir();
    try {
      const batchDir = join(dir, 'review-batches');
      const outputDir = join(dir, 'manual-review');
      const queue = join(dir, 'coverage-review-queue.csv');
      mkdirSync(batchDir, { recursive: true });
      writeFileSync(queue, [
        'priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'P0,187,2,,approved | reject_not_submit,verify_submit_form_then_approve_or_reject,verify submit form,,,,Submit Example,unknown,unknown,missing_domain,review_submit_url,https://submit.example/submit,submit.example,2,coverage-candidates.csv,coverage-candidates.csv:2,,',
        'P2,80,3,,approved | reject_not_submit,verify_directory_fit_before_any_approval,verify fit,,,,Blog Example,unknown,unknown,missing_domain,review_submit_url,https://blog.example/post,blog.example,1,coverage-candidates.csv,coverage-candidates.csv:3,,',
        'P2,60,4,,approved | reject_not_submit,verify_directory_fit_before_any_approval,verify fit,,,,Unknown Example,unknown,unknown,missing_domain,review_submit_url,https://unknown.example/,unknown.example,1,coverage-candidates.csv,coverage-candidates.csv:4,,',
      ].join('\n'));
      writeFileSync(join(batchDir, 'b1-evidence.csv'), [
        'batch_id,batch_order,review_row,review_action,url,domain,http_status,fetch_ok,final_url,final_domain,domain_changed,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,suggested_decision,evidence_notes,fetch_error,checked_at',
        'b1,1,2,verify_submit_form_then_approve_or_reject,https://submit.example/submit,submit.example,200,yes,https://submit.example/submit,submit.example,no,text/html,Submit,1,3,yes,yes,yes,no,no,no,no,no,no,review_possible_submit_form,form and directory signals,,2026-01-01T00:00:00.000Z',
        'b1,2,3,verify_directory_fit_before_any_approval,https://blog.example/post,blog.example,200,yes,https://blog.example/post,blog.example,no,text/html,Blog,1,2,no,no,no,yes,no,no,no,no,no,reject_auth_required,login signal,,2026-01-01T00:00:01.000Z',
      ].join('\n'));
      writeFileSync(join(batchDir, 'b1-suggestions.csv'), [
        'batch_id,batch_order,review_row,priority,review_action,url,domain,current_review_decision,review_decision_options,evidence_suggested_decision,suggested_review_decision,suggestion_confidence,possible_approval_decision,reviewer_action,suggested_review_notes,suggested_pricing,suggestion_basis,evidence_matched,evidence_match_key,http_status,fetch_ok,final_url,final_domain,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,fetch_error,checked_at',
        'b1,1,2,P0,verify_submit_form_then_approve_or_reject,https://submit.example/submit,submit.example,,approved | reject_not_submit,review_possible_submit_form,needs_manual_check,low,approved,manual_confirm_submit_form_and_blockers,manual confirmation required,,form signal,yes,review_row:2,200,yes,https://submit.example/submit,submit.example,1,3,yes,yes,yes,no,no,no,no,no,no,,2026-01-01T00:00:00.000Z',
        'b1,2,3,P2,verify_directory_fit_before_any_approval,https://blog.example/post,blog.example,,approved | reject_not_submit,reject_auth_required,reject_auth_required,high,,reject_or_route_to_assisted_manual_flow,login signal,,login,yes,review_row:3,200,yes,https://blog.example/post,blog.example,1,2,no,no,no,yes,no,no,no,no,no,,2026-01-01T00:00:01.000Z',
      ].join('\n'));
      writeFileSync(join(batchDir, 'b1-draft-report.json'), JSON.stringify({
        generated_at: '2026-01-01T00:00:02.000Z',
        batch_id: 'b1',
        blocked: [{
          review_row: '3',
          url: 'https://blog.example/post',
          reason: 'suggested_decision_not_allowed_for_batch_row',
          suggested_review_decision: 'reject_auth_required',
        }],
      }, null, 2));

      const pack = buildCoverageReviewManualPack(queue, {
        batchDir,
        nextLimit: 2,
        productContextPaths: [join(dir, 'product-marketing.md')],
      });
      const written = writeCoverageReviewManualPack(pack, { outputDir });
      const remainingRows = parseCsv(readFileSync(written.files.remaining_manual_review_csv, 'utf-8'));
      const nextRows = parseCsv(readFileSync(written.files.next_manual_review_csv, 'utf-8'));
      const summary = JSON.parse(readFileSync(written.files.summary_json, 'utf-8'));

      assert.equal(pack.rows.length, 3);
      assert.equal(pack.p0_rows.length, 1);
      assert.equal(pack.next_rows.length, 2);
      assert.equal(remainingRows.length, 3);
      assert.equal(nextRows.length, 2);
      assert.equal(remainingRows[0].review_decision_options, 'approved | reject_not_submit');
      assert.equal(remainingRows[0].review_instruction, 'verify submit form');
      assert.equal(pack.rows[0].manual_bucket, 'manual_submit_form_confirmation_required');
      assert.equal(pack.rows[1].manual_bucket, 'safety_gate_blocked_auto_rejection');
      assert.equal(pack.rows[2].manual_bucket, 'no_read_only_evidence_yet');
      assert.equal(summary.evidence_coverage.rows_with_safety_gate_block, 1);
      assert.equal(summary.evidence_coverage.possible_approval_after_manual_confirmation, 1);
      assert.equal(summary.product_context_present, false);
      assert.equal(validateCoverageReviewBatch(written.files.p0_manual_review_csv).ok, true);
      assert.equal(existsSync(written.files.summary_md), true);
      assert.equal(existsSync(written.files.readiness_blockers_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not carry stale draft safety blockers after decision options are expanded', () => {
    const dir = tempDir();
    try {
      const batchDir = join(dir, 'review-batches');
      const queue = join(dir, 'coverage-review-queue.csv');
      mkdirSync(batchDir, { recursive: true });
      writeFileSync(queue, [
        'priority,priority_score,review_row,review_decision,review_decision_options,review_action,review_instruction,review_notes,reviewed_by,submission_url_override,canonical_name,pricing,lang,classification,candidate_import_recommendation,url,domain,occurrence_count,source_files,source_locations,registry_target_ids,registry_submit_urls',
        'P2,80,3,,approved | reject_not_submit | reject_auth_required,verify_directory_fit_before_any_approval,verify fit,,,,Blog Example,unknown,unknown,missing_domain,review_submit_url,https://blog.example/post,blog.example,1,coverage-candidates.csv,coverage-candidates.csv:3,,',
      ].join('\n'));
      writeFileSync(join(batchDir, 'b1-suggestions.csv'), [
        'batch_id,batch_order,review_row,priority,review_action,url,domain,current_review_decision,review_decision_options,evidence_suggested_decision,suggested_review_decision,suggestion_confidence,possible_approval_decision,reviewer_action,suggested_review_notes,suggested_pricing,suggestion_basis,evidence_matched,evidence_match_key,http_status,fetch_ok,final_url,final_domain,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,duplicate_registry_url,fetch_error,checked_at',
        'b1,1,3,P2,verify_directory_fit_before_any_approval,https://blog.example/post,blog.example,,approved | reject_not_submit,reject_auth_required,reject_auth_required,high,,reject_or_route_to_assisted_manual_flow,login signal,,login,yes,review_row:3,200,yes,https://blog.example/post,blog.example,1,2,no,no,no,yes,no,no,no,no,no,,2026-01-01T00:00:01.000Z',
      ].join('\n'));
      writeFileSync(join(batchDir, 'b1-draft-report.json'), JSON.stringify({
        generated_at: '2026-01-01T00:00:02.000Z',
        batch_id: 'b1',
        blocked: [{
          review_row: '3',
          url: 'https://blog.example/post',
          reason: 'suggested_decision_not_allowed_for_batch_row',
          suggested_review_decision: 'reject_auth_required',
        }],
      }, null, 2));

      const pack = buildCoverageReviewManualPack(queue, {
        batchDir,
        productContextPaths: [join(dir, 'product-marketing.md')],
      });

      assert.equal(pack.rows[0].manual_bucket, 'directory_fit_requires_human_confirmation');
      assert.equal(pack.rows[0].safety_gate_reason, '');
      assert.equal(pack.summary.evidence_coverage.rows_with_safety_gate_block, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('assisted submission pack', () => {
  it('builds a manual assisted pack without approving or submitting targets', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      const outputDir = join(dir, 'assisted-pack');
      writeFileSync(registry, `
version: 1
targets:
  - id: auth-target
    name: Auth Target
    domain: auth.example
    root_url: https://auth.example
    submit_url: https://auth.example/submit
    pricing: free
    lang: en
    source:
      - test
    technical:
      last_scouted_at: 2026-01-01T00:00:00.000Z
      auth: required
      captcha: none
      reachable: yes
      final_url: https://auth.example/login
    submission:
      mode: assisted
      status: auth_required
      reason: auth_signal
    quality:
      risk: low
    forms:
      - index: 0
        fields:
          - name: url
            required: true
            mapped_to: product.url
        submit_buttons:
          - text: Submit
  - id: captcha-target
    name: Captcha Target
    domain: captcha.example
    root_url: https://captcha.example
    submit_url: https://captcha.example/submit
    pricing: unknown
    technical:
      last_scouted_at: 2026-01-01T00:00:00.000Z
      auth: none
      captcha: required
      reachable: yes
    submission:
      mode: assisted
      status: captcha_required
      reason: captcha_signal
    quality:
      risk: unknown
  - id: cross-final-url
    name: Cross Final URL
    domain: cross.example
    root_url: https://cross.example
    submit_url: https://cross.example/submit
    pricing: free
    technical:
      last_scouted_at: 2026-01-01T00:00:00.000Z
      auth: required
      captcha: none
      reachable: yes
      final_url: https://other.example/login
    submission:
      mode: assisted
      status: auth_required
      reason: auth_signal
    quality:
      risk: low
  - id: review-target
    name: Review Target
    domain: review.example
    root_url: https://review.example
    submit_url: https://review.example/submit
    pricing: unknown
    technical:
      auth: none
      captcha: none
      reachable: unknown
    submission:
      mode: needs_review
      status: scout_failed
      reason: scout_failed_network
    quality:
      risk: unknown
  - id: manual-target
    name: Manual Target
    domain: manual.example
    root_url: https://manual.example
    submit_url: https://manual.example/post
    pricing: free
    auto: manual
    type: article
    technical:
      auth: unknown
      captcha: unknown
      reachable: unknown
    submission:
      mode: assisted
      status: new
      reason: auth_or_manual_signal
    quality:
      risk: medium
  - id: paid-target
    name: Paid Target
    domain: paid.example
    submit_url: https://paid.example/submit
    pricing: paid
    submission:
      mode: assisted
      status: paywalled
    quality:
      risk: unknown
  - id: submitted-target
    name: Submitted Target
    domain: submitted.example
    submit_url: https://submitted.example/submit
    pricing: free
    submission:
      mode: assisted
      status: auth_required
      last_submitted_at: 2026-01-02T00:00:00.000Z
    quality:
      risk: low
`);

      const pack = buildAssistedSubmissionPack({
        registry,
        productConfig: join(dir, 'missing-product.yaml'),
        limit: 2,
        productContextPaths: [join(dir, 'product-marketing.md')],
      });
      const written = writeAssistedSubmissionPack(pack, { outputDir });
      const fullRows = parseCsv(readFileSync(written.files.full_csv, 'utf-8'));
      const nextRows = parseCsv(readFileSync(written.files.next_csv, 'utf-8'));
      const authRows = parseCsv(readFileSync(written.files.auth_login_rescout_csv, 'utf-8'));
      const manualSurfaceRows = parseCsv(readFileSync(written.files.manual_surface_review_csv, 'utf-8'));
      const manualReviewRows = parseCsv(readFileSync(written.files.manual_review_first_csv, 'utf-8'));
      const crossDomainRows = parseCsv(readFileSync(written.files.cross_domain_final_url_csv, 'utf-8'));
      const crossDomainSuggestionRows = parseCsv(readFileSync(written.files.cross_domain_final_url_suggestions_csv, 'utf-8'));
      const crossDomainDecisionRows = parseCsv(readFileSync(written.files.cross_domain_final_url_decisions_csv, 'utf-8'));
      const summary = JSON.parse(readFileSync(written.files.summary_json, 'utf-8'));

      assert.equal(pack.rows.length, 5);
      assert.equal(pack.excluded.length, 2);
      assert.equal(pack.rows[0].target_id, 'auth-target');
      assert.equal(pack.rows[0].manual_bucket, 'manual_login_then_rescout');
      assert.equal(pack.rows[0].automation_after_human, 'rescout_after_saved_login_profile');
      assert.match(pack.rows[0].auth_login_command, /auth login --profile "auth-target"/);
      assert.match(pack.rows[0].auth_scout_command, /--update-registry --engine playwright/);
      assert.match(pack.rows[0].auth_scout_command, /--persist --scout-dir "resources\/scout-results"/);
      assert.equal(pack.rows.find(row => row.target_id === 'manual-target').manual_bucket, 'manual_surface_review');
      assert.equal(pack.rows.find(row => row.target_id === 'manual-target').automation_after_human, 'no_manual_surface_review_required_first');
      assert.equal(pack.rows.find(row => row.target_id === 'manual-target').auth_login_command, '');
      assert.equal(pack.rows.find(row => row.target_id === 'cross-final-url').manual_bucket, 'fix_cross_domain_final_url');
      assert.equal(pack.rows.find(row => row.target_id === 'cross-final-url').automation_after_human, 'no_fix_cross_domain_final_url_first');
      assert.match(pack.rows.find(row => row.target_id === 'cross-final-url').safety_blockers, /final_url_domain_mismatch/);
      assert.equal(pack.rows.find(row => row.target_id === 'cross-final-url').auth_login_command, '');
      assert.equal(pack.rows.find(row => row.target_id === 'cross-final-url').auth_scout_command, '');
      assert.equal(pack.rows.find(row => row.target_id === 'captcha-target').automation_after_human, 'no_captcha_manual_only');
      assert.equal(pack.rows.find(row => row.target_id === 'captcha-target').auth_login_command, '');
      assert.equal(pack.rows.find(row => row.target_id === 'review-target').auth_scout_command, '');
      assert.equal(pack.rows.find(row => row.target_id === 'review-target').automation_after_human, 'no_manual_review_required_first');
      assert.equal(nextRows.length, 2);
      assert.equal(fullRows.length, 5);
      assert.equal(authRows.length, 1);
      assert.equal(authRows[0].target_id, 'auth-target');
      assert.equal(manualSurfaceRows.length, 1);
      assert.equal(manualSurfaceRows[0].target_id, 'manual-target');
      assert.equal(manualReviewRows.length, 1);
      assert.equal(manualReviewRows[0].target_id, 'review-target');
      assert.equal(crossDomainRows.length, 1);
      assert.equal(crossDomainRows[0].target_id, 'cross-final-url');
      assert.equal(crossDomainSuggestionRows.length, 1);
      assert.equal(crossDomainSuggestionRows[0].target_id, 'cross-final-url');
      assert.equal(crossDomainSuggestionRows[0].classification, 'unknown_cross_domain');
      assert.equal(crossDomainSuggestionRows[0].automation_policy, 'no_execution_from_suggestion');
      assert.equal(crossDomainDecisionRows.length, 1);
      assert.equal(crossDomainDecisionRows[0].target_id, 'cross-final-url');
      assert.equal(crossDomainDecisionRows[0].review_decision, '');
      assert.equal(crossDomainDecisionRows[0].automation_policy, 'no_execution_from_decision_file');
      assert.equal(summary.policy, 'manual_assisted_pack_only_no_registry_changes_no_real_submissions');
      assert.equal(summary.by_exclusion_reason.paid_excluded_by_default, 1);
      assert.equal(summary.by_exclusion_reason.already_submitted, 1);
      assert.equal(existsSync(written.files.summary_md), true);
      assert.equal(existsSync(written.files.auth_login_rescout_csv), true);
      assert.equal(existsSync(written.files.manual_surface_review_csv), true);
      assert.equal(existsSync(written.files.manual_review_first_csv), true);
      assert.equal(existsSync(written.files.cross_domain_final_url_csv), true);
      assert.equal(existsSync(written.files.cross_domain_final_url_suggestions_csv), true);
      assert.equal(existsSync(written.files.cross_domain_final_url_suggestions_md), true);
      assert.equal(existsSync(written.files.cross_domain_final_url_decisions_csv), true);
      assert.equal(existsSync(written.files.cross_domain_final_url_decisions_md), true);
      assert.equal(summary.files.cross_domain_final_url_csv.endsWith('cross-domain-final-url-review.csv'), true);
      assert.equal(summary.files.cross_domain_final_url_suggestions_csv.endsWith('cross-domain-final-url-suggestions.csv'), true);
      assert.equal(summary.files.cross_domain_final_url_decisions_csv.endsWith('cross-domain-final-url-decisions.csv'), true);
      assert.match(crossDomainFinalUrlSuggestionsCsv(pack.rows), /unknown_cross_domain/);
      assert.match(crossDomainFinalUrlDecisionsCsv(pack.rows), /no_execution_from_decision_file/);
      assert.match(assistedSubmissionPackCsv(pack.rows), /no_real_submission_from_pack/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('collects read-only cross-domain final URL evidence without submitting', async () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'cross-domain-final-url-review.csv');
      writeFileSync(review, [
        'rank,target_id,name,domain,submit_url,final_url,root_url',
        '1,alias-target,Alias Target,jinshuju.net,https://jinshuju.net/f/abc?ref=partner,https://jsj.top/f/abc,https://jinshuju.net/',
      ].join('\n') + '\n');

      const calls = [];
      const fetchFn = async (url, options) => {
        calls.push({ url, options });
        const html = url.includes('jsj.top')
          ? '<html><title>Submit AI Tool</title><form><input name="url"><button type="submit">Submit</button></form></html>'
          : '<html><title>AI Directory</title><p>Submit your AI tool to this directory.</p></html>';
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => html,
        };
      };

      const evidence = await buildCrossDomainFinalUrlEvidence(review, { fetchFn });
      assert.equal(evidence.constraints.read_only_http_get, true);
      assert.equal(evidence.constraints.no_registry_writes, true);
      assert.equal(evidence.constraints.no_submission, true);
      assert.equal(evidence.total_targets, 1);
      assert.equal(evidence.total_checks, 3);
      assert.equal(evidence.checked_urls, 3);
      assert.equal(calls.length, 3);
      assert.equal(calls.every(call => call.options.method === 'GET'), true);
      assert.equal(calls.every(call => call.options.body === undefined), true);
      assert.equal(evidence.evidence_rows.some(row => row.check_url.includes('ref=')), false);

      const finalRow = evidence.evidence_rows.find(row => row.check_type === 'final_url');
      assert.equal(finalRow.evidence_classification, 'possible_submit_form');
      assert.equal(finalRow.form_count, 1);
      assert.equal(finalRow.submit_button_signal, 'yes');
      assert.match(crossDomainFinalUrlEvidenceCsv(evidence), /possible_submit_form/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a cross-domain manual review pack without allowing preview-only registry writes', () => {
    const dir = tempDir();
    try {
      const review = join(dir, 'cross-domain-final-url-review.csv');
      writeFileSync(review, [
        'rank,target_id,name,domain,submit_url,final_url,root_url',
        '1,alias-target,Alias Target,jinshuju.net,https://jinshuju.net/f/abc,https://jsj.top/f/abc,https://jinshuju.net/',
        '2,parked-target,Parked Target,parked.example,https://parked.example/submit,https://www.afternic.com/forsale/parked.example,https://parked.example/',
      ].join('\n') + '\n');

      const evidence = join(dir, 'cross-domain-final-url-evidence.csv');
      writeFileSync(evidence, [
        'target_id,name,domain,source_rank,check_type,check_url,check_host,expected_host,expected_relation,classification,suggested_decision,http_status,fetch_ok,final_url,final_host,domain_changed,same_as_target_domain,same_as_submit_domain,content_type,title,form_count,input_count,submit_button_signal,submit_path_signal,directory_signal,auth_signal,oauth_signal,captcha_signal,cloudflare_signal,payment_signal,platform_error_signal,domain_for_sale_signal,commerce_or_affiliate_signal,evidence_classification,evidence_notes,fetch_error,checked_at',
        'alias-target,Alias Target,jinshuju.net,1,final_url,https://jsj.top/f/abc,jsj.top,jsj.top,persisted_scout_final_url,possible_form_provider_alias,allow_external_host_after_review,200,yes,https://jsj.top/f/abc,jsj.top,no,no,no,text/html,Submit AI Tool,1,1,yes,yes,yes,no,no,no,no,no,no,no,no,possible_submit_form,form evidence,,2026-05-23T00:00:00.000Z',
        'parked-target,Parked Target,parked.example,2,final_url,https://www.afternic.com/forsale/parked.example,afternic.com,afternic.com,persisted_scout_final_url,domain_for_sale_or_parked,skip,200,yes,https://www.afternic.com/forsale/parked.example,afternic.com,no,no,no,text/html,Domain For Sale,0,0,no,no,no,no,no,no,no,no,no,yes,no,domain_for_sale_or_parked,domain for sale evidence,,2026-05-23T00:00:00.000Z',
      ].join('\n') + '\n');

      const pack = buildCrossDomainFinalUrlManualPack(review, { evidencePath: evidence });
      const alias = pack.rows.find(row => row.target_id === 'alias-target');
      const parked = pack.rows.find(row => row.target_id === 'parked-target');
      assert.equal(pack.constraints.no_registry_writes, true);
      assert.equal(pack.constraints.no_submission, true);
      assert.equal(alias.recommended_review_decision, 'allow_external_host_after_review');
      assert.equal(alias.registry_write_allowed_if_reviewed, 'no');
      assert.equal(alias.write_gate_policy, 'preview_only_no_registry_write');
      assert.equal(parked.recommended_review_decision, 'skip');
      assert.equal(parked.registry_write_allowed_if_reviewed, 'yes');
      assert.equal(pack.summary.preview_only_rows, 1);
      assert.equal(pack.summary.controlled_write_possible_after_review, 1);
      assert.match(crossDomainFinalUrlManualPackCsv(pack), /manual_review_pack_only_no_login_no_submission_no_registry_write/);

      const written = writeCrossDomainFinalUrlManualPack(pack, { outputDir: join(dir, 'manual-pack') });
      assert.equal(existsSync(written.files.manual_csv), true);
      assert.equal(existsSync(written.files.manual_json), true);
      assert.equal(existsSync(written.files.manual_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a cross-domain decision draft that remains blocked until human review', () => {
    const dir = tempDir();
    try {
      const manualReview = join(dir, 'cross-domain-final-url-manual-review.csv');
      writeFileSync(manualReview, [
        'target_id,name,domain,submit_url,root_url,persisted_final_url,final_host,classification,confidence,suggested_decision,recommended_review_decision,registry_write_allowed_if_reviewed,write_gate_policy,manual_bucket,risk_level,safety_findings,submit_fetch_ok,submit_http_status,submit_final_url,final_fetch_ok,final_http_status,final_observed_url,root_fetch_ok,root_http_status,root_observed_url,forms_detected,auth_or_oauth_signal,captcha_or_cloudflare_signal,payment_signal,human_evidence_url_candidate,recommended_next_step,reviewer_action,automation_policy',
        'skip-target,Skip Target,skip.example,https://skip.example/submit,https://skip.example/,https://external.example/form,external.example,unrelated_external_submit_endpoint,high,skip,skip,yes,controlled_write_allowed_after_validation_no_runnable_promotion,skip_candidate_after_manual_confirmation,high,fetch_not_ok_or_failed,no,404,https://external.example/form,no,404,https://external.example/form,no,404,https://external.example/,0,no,no,no,https://skip.example/submit,Open manually before review,edit decisions manually,manual_review_pack_only_no_login_no_submission_no_registry_write',
        'alias-target,Alias Target,jinshuju.net,https://jinshuju.net/f/abc,https://jinshuju.net/,https://jsj.top/f/abc,jsj.top,possible_form_provider_alias,medium,allow_external_host_after_review,allow_external_host_after_review,no,preview_only_no_registry_write,preview_only_external_host_candidate,medium,,yes,200,https://jsj.top/f/abc,yes,200,https://jsj.top/f/abc,yes,200,https://jinshuju.net/,1,no,no,no,https://jsj.top/f/abc,Confirm ownership manually,edit decisions manually,manual_review_pack_only_no_login_no_submission_no_registry_write',
      ].join('\n') + '\n');

      const draft = buildCrossDomainFinalUrlDecisionDraft(manualReview);
      assert.equal(draft.constraints.review_decision_left_blank, true);
      assert.equal(draft.summary.rows, 2);
      assert.equal(draft.summary.rows_requiring_human_review, 2);
      assert.equal(draft.summary.controlled_write_possible_after_review, 1);
      assert.equal(draft.summary.preview_only_rows, 1);
      assert.equal(draft.rows.every(row => row.review_decision === ''), true);
      assert.equal(draft.rows.every(row => row.reviewer === ''), true);
      assert.equal(draft.rows.every(row => row.automation_policy === 'no_execution_from_decision_file'), true);

      const csv = crossDomainFinalUrlDecisionDraftCsv(draft);
      assert.match(csv, /human_must_fill_review_decision/);
      assert.match(csv, /allow_external_host_after_review/);

      const draftCsv = join(dir, 'draft.csv');
      writeFileSync(draftCsv, csv);
      const validation = validateCrossDomainFinalUrlDecisions(draftCsv);
      assert.equal(validation.ok, false);
      assert.equal(validation.blockers.filter(item => item.code === 'review_decision_missing').length, 2);

      const written = writeCrossDomainFinalUrlDecisionDraft(draft, { outputDir: join(dir, 'draft-pack') });
      assert.equal(existsSync(written.files.draft_csv), true);
      assert.equal(existsSync(written.files.draft_json), true);
      assert.equal(existsSync(written.files.draft_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates edited cross-domain final URL decisions fail-closed', () => {
    const dir = tempDir();
    try {
      const blocked = join(dir, 'blocked-decisions.csv');
      writeFileSync(blocked, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'parked,Parked,parked.example,https://parked.example/submit,https://afternic.com/forsale/parked.example,afternic.com,domain_for_sale_or_parked,high,skip,allow_external_host_after_review,afternic.com,,https://evidence.example/review,qa,2026-05-23T00:00:00.000Z,Verified the page and this attempted allowlist must be blocked,execute_from_decision_file',
        'blank,Blank,blank.example,https://blank.example/submit,https://other.example/form,other.example,unknown_cross_domain,low,keep_blocked,,,,,,,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const blockedReport = validateCrossDomainFinalUrlDecisions(blocked);
      assert.equal(blockedReport.ok, false);
      assert.ok(blockedReport.blockers.some(item => item.code === 'allowlist_classification_not_eligible'));
      assert.ok(blockedReport.blockers.some(item => item.code === 'automation_policy_must_not_execute'));
      assert.ok(blockedReport.blockers.some(item => item.code === 'review_decision_missing'));

      const valid = join(dir, 'valid-decisions.csv');
      writeFileSync(valid, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'form-provider,Form Provider,jinshuju.net,https://jinshuju.net/f/abc,https://jsj.top/f/abc,jsj.top,possible_form_provider_alias,medium,allow_external_host_after_review,allow_external_host_after_review,jsj.top,,https://evidence.example/form-owner,qa,2026-05-23T00:00:00.000Z,Verified the provider alias and owner by manual browser review,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const validReport = validateCrossDomainFinalUrlDecisions(valid);
      assert.equal(validReport.ok, true);
      assert.equal(validReport.blockers_count, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a dry-run registry patch preview from reviewed cross-domain final URL decisions', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, [
        'version: 1',
        'targets:',
        '  - id: skip-target',
        '    name: Skip Target',
        '    domain: skip.example',
        '    root_url: https://skip.example/',
        '    submit_url: https://skip.example/submit',
        '    normalized_key: skip.example/submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
        '  - id: alias-target',
        '    name: Alias Target',
        '    domain: jinshuju.net',
        '    root_url: https://jinshuju.net/',
        '    submit_url: https://jinshuju.net/f/abc',
        '    normalized_key: jinshuju.net/f/abc',
        '    pricing: free',
        '    technical:',
        '      final_url: https://jsj.top/f/abc',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
      ].join('\n') + '\n');

      const decisions = join(dir, 'decisions.csv');
      writeFileSync(decisions, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'skip-target,Skip Target,skip.example,https://skip.example/submit,https://external.example/form,external.example,unrelated_external_submit_endpoint,high,skip,skip,,,https://evidence.example/skip,qa,2026-05-23T00:00:00.000Z,Verified manually that this external endpoint is unrelated and must be skipped,no_execution_from_decision_file',
        'alias-target,Alias Target,jinshuju.net,https://jinshuju.net/f/abc,https://jsj.top/f/abc,jsj.top,possible_form_provider_alias,medium,allow_external_host_after_review,allow_external_host_after_review,jsj.top,,https://evidence.example/alias,qa,2026-05-23T00:00:00.000Z,Verified manually that the provider alias belongs to this submit form,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const report = buildCrossDomainFinalUrlDecisionPatch(registry, decisions);
      assert.equal(report.ok, true);
      assert.equal(report.dry_run, true);
      assert.equal(report.wrote_registry, false);
      assert.equal(report.proposals_count, 2);
      assert.equal(report.proposals.every(item => !['auto_safe', 'auto_candidate', 'assisted'].includes(item.after.submission.mode)), true);
      assert.equal(report.proposals.find(item => item.target_id === 'skip-target').after.submission.mode, 'skip');
      assert.equal(report.proposals.find(item => item.target_id === 'alias-target').after.submission.mode, 'needs_review');
      assert.deepEqual(report.proposals.find(item => item.target_id === 'alias-target').after.technical.allowed_final_hosts, ['jsj.top']);
      assert.equal(existsSync(registry), true);
      assert.match(readFileSync(registry, 'utf-8'), /mode: assisted/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks cross-domain decision patch previews when registry identity or replacement host is unsafe', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, [
        'version: 1',
        'targets:',
        '  - id: replace-target',
        '    name: Replace Target',
        '    domain: replace.example',
        '    root_url: https://replace.example/',
        '    submit_url: https://replace.example/old-submit',
        '    normalized_key: replace.example/old-submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/old-form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
      ].join('\n') + '\n');

      const decisions = join(dir, 'decisions.csv');
      writeFileSync(decisions, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'replace-target,Replace Target,replace.example,https://replace.example/old-submit,https://external.example/old-form,external.example,unknown_cross_domain,medium,keep_blocked,replace_submit_url,,https://other.example/new-submit,https://evidence.example/replace,qa,2026-05-23T00:00:00.000Z,Verified manually but replacement host must still be blocked by dry-run preview,no_execution_from_decision_file',
        'missing-target,Missing Target,missing.example,https://missing.example/submit,https://external.example/form,external.example,unknown_cross_domain,medium,keep_blocked,keep_blocked,,,https://evidence.example/missing,qa,2026-05-23T00:00:00.000Z,Verified manually but registry identity is missing and must be blocked,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const report = buildCrossDomainFinalUrlDecisionPatch(registry, decisions);
      assert.equal(report.ok, false);
      assert.equal(report.proposals_count, 0);
      assert.ok(report.blockers.some(item => item.code === 'replacement_submit_url_domain_mismatch'));
      assert.ok(report.blockers.some(item => item.code === 'target_not_found'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes only safe cross-domain downgrade decisions when explicitly requested', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, [
        'version: 1',
        'targets:',
        '  - id: skip-target',
        '    name: Skip Target',
        '    domain: skip.example',
        '    root_url: https://skip.example/',
        '    submit_url: https://skip.example/submit',
        '    normalized_key: skip.example/submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
        '  - id: rescout-target',
        '    name: Rescout Target',
        '    domain: rescout.example',
        '    root_url: https://rescout.example/',
        '    submit_url: https://rescout.example/submit',
        '    normalized_key: rescout.example/submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
        '  - id: blocked-target',
        '    name: Blocked Target',
        '    domain: blocked.example',
        '    root_url: https://blocked.example/',
        '    submit_url: https://blocked.example/submit',
        '    normalized_key: blocked.example/submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
      ].join('\n') + '\n');

      const decisions = join(dir, 'decisions.csv');
      writeFileSync(decisions, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'skip-target,Skip Target,skip.example,https://skip.example/submit,https://external.example/form,external.example,unrelated_external_submit_endpoint,high,skip,skip,,,https://evidence.example/skip,qa,2026-05-23T00:00:00.000Z,Verified manually that this target should be skipped after cross-domain review,no_execution_from_decision_file',
        'rescout-target,Rescout Target,rescout.example,https://rescout.example/submit,https://external.example/form,external.example,unknown_cross_domain,medium,rescout_target_domain,rescout_target_domain,,,https://evidence.example/rescout,qa,2026-05-23T00:00:00.000Z,Verified manually that the target domain must be rescouter before any automation,no_execution_from_decision_file',
        'blocked-target,Blocked Target,blocked.example,https://blocked.example/submit,https://external.example/form,external.example,unknown_cross_domain,medium,keep_blocked,keep_blocked,,,https://evidence.example/blocked,qa,2026-05-23T00:00:00.000Z,Verified manually that this target should remain blocked after review,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const report = applyCrossDomainFinalUrlDecisionPatch(registry, decisions, { writeRegistry: true });
      assert.equal(report.ok, true);
      assert.equal(report.write_requested, true);
      assert.equal(report.dry_run, false);
      assert.equal(report.wrote_registry, true);
      assert.equal(report.written_targets, 3);

      const loaded = loadRegistry(registry);
      const skip = loaded.targets.find(target => target.id === 'skip-target');
      const rescout = loaded.targets.find(target => target.id === 'rescout-target');
      const blocked = loaded.targets.find(target => target.id === 'blocked-target');
      assert.equal(skip.submission.mode, 'skip');
      assert.equal(skip.submission.status, 'skipped');
      assert.equal(rescout.submission.mode, 'needs_review');
      assert.equal(rescout.submission.status, 'needs_rescout');
      assert.equal(blocked.submission.mode, 'needs_review');
      assert.equal(blocked.submission.status, 'cross_domain_reviewed_blocked');
      assert.equal(loaded.targets.some(target => ['auto_safe', 'auto_candidate', 'assisted'].includes(target.submission?.mode)), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks controlled registry writes for allowlist and replacement decisions', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, [
        'version: 1',
        'targets:',
        '  - id: alias-target',
        '    name: Alias Target',
        '    domain: jinshuju.net',
        '    root_url: https://jinshuju.net/',
        '    submit_url: https://jinshuju.net/f/abc',
        '    normalized_key: jinshuju.net/f/abc',
        '    pricing: free',
        '    technical:',
        '      final_url: https://jsj.top/f/abc',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
        '  - id: replace-target',
        '    name: Replace Target',
        '    domain: replace.example',
        '    root_url: https://replace.example/',
        '    submit_url: https://replace.example/old-submit',
        '    normalized_key: replace.example/old-submit',
        '    pricing: free',
        '    technical:',
        '      final_url: https://external.example/old-form',
        '    submission:',
        '      mode: assisted',
        '      status: new',
        '      reason: ""',
        '      last_submitted_at: null',
        '    quality:',
        '      risk: low',
      ].join('\n') + '\n');

      const decisions = join(dir, 'decisions.csv');
      writeFileSync(decisions, [
        'target_id,name,domain,submit_url,final_url,final_host,classification,confidence,suggested_decision,review_decision,allowed_host,replacement_submit_url,evidence_url,reviewer,reviewed_at,review_notes,automation_policy',
        'alias-target,Alias Target,jinshuju.net,https://jinshuju.net/f/abc,https://jsj.top/f/abc,jsj.top,possible_form_provider_alias,medium,allow_external_host_after_review,allow_external_host_after_review,jsj.top,,https://evidence.example/alias,qa,2026-05-23T00:00:00.000Z,Verified manually that the alias still needs preview-only handling,no_execution_from_decision_file',
        'replace-target,Replace Target,replace.example,https://replace.example/old-submit,https://external.example/old-form,external.example,unknown_cross_domain,medium,replace_submit_url,replace_submit_url,,https://replace.example/new-submit,https://evidence.example/replace,qa,2026-05-23T00:00:00.000Z,Verified manually that replacement still needs preview-only handling,no_execution_from_decision_file',
      ].join('\n') + '\n');

      const preview = buildCrossDomainFinalUrlDecisionPatch(registry, decisions);
      assert.equal(preview.ok, true);
      assert.equal(preview.proposals_count, 2);

      const report = applyCrossDomainFinalUrlDecisionPatch(registry, decisions, { writeRegistry: true });
      assert.equal(report.ok, false);
      assert.equal(report.status, 'blocked_write_gate');
      assert.equal(report.wrote_registry, false);
      assert.equal(report.blockers.filter(item => item.code === 'write_decision_preview_only').length, 2);

      const loaded = loadRegistry(registry);
      assert.equal(loaded.targets.find(target => target.id === 'alias-target').submission.mode, 'assisted');
      assert.equal(loaded.targets.find(target => target.id === 'replace-target').submit_url, 'https://replace.example/old-submit');
      assert.equal(loaded.targets.find(target => target.id === 'alias-target').technical.allowed_final_hosts, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can include paid, high-risk, and submitted rows only when explicitly requested', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: paid
    name: Paid
    domain: paid.example
    submit_url: https://paid.example/submit
    pricing: paid
    submission:
      mode: assisted
      status: paywalled
    quality:
      risk: high
  - id: submitted
    name: Submitted
    domain: submitted.example
    submit_url: https://submitted.example/submit
    pricing: free
    submission:
      mode: assisted
      status: auth_required
      last_submitted_at: 2026-01-01T00:00:00.000Z
    quality:
      risk: low
`);

      const defaultPack = buildAssistedSubmissionPack({ registry });
      const explicitPack = buildAssistedSubmissionPack({
        registry,
        includePaid: true,
        includeHighRisk: true,
        includeSubmitted: true,
      });

      assert.equal(defaultPack.rows.length, 0);
      assert.equal(defaultPack.excluded.length, 2);
      assert.equal(explicitPack.rows.length, 2);
      assert.equal(explicitPack.rows.find(row => row.target_id === 'paid').automation_after_human, 'no_paid_or_paywalled');
      assert.equal(explicitPack.rows.find(row => row.target_id === 'submitted').automation_after_human, 'no_verify_existing_submission_first');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth rescout plan', () => {
  it('queues only assisted auth rows with saved Playwright profiles', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const authDir = join(dir, 'auth');
      const output = join(dir, 'auth-rescout-plan.json');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'auth-target.storage-state.json'), JSON.stringify({
        cookies: [],
        origins: [],
      }));
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,auth-target,Auth Target,auth.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,auth-target,login,scout,https://auth.example/submit,https://auth.example/login,https://auth.example,,,,,,,,test,auth_signal,',
        '2,P0,260,missing-auth,Missing Auth,missing.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,missing-auth,login,scout,https://missing.example/submit,https://missing.example/login,https://missing.example,,,,,,,,test,auth_signal,',
        '3,P2,120,captcha,Captcha,captcha.example,assisted,captcha_required,free,low,en,manual_submit_only_captcha,no_captcha_manual_only,no_real_submission_from_pack,captcha_or_turnstile_required,captcha,,,,https://captcha.example/submit,,https://captcha.example,,,,,,,,test,captcha_signal,',
      ].join('\n'));

      const plan = buildAuthRescoutPlan(queue, {
        authDir,
        registry: join(dir, 'registry.yaml'),
        limit: 10,
      });
      const written = writeAuthRescoutPlan(plan, output);
      const parsed = JSON.parse(readFileSync(output, 'utf-8'));

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].id, 'auth-target');
      assert.equal(plan.targets[0].auth_profile, 'auth-target');
      assert.match(plan.targets[0].auth_state_path, /auth-target\.storage-state\.json$/);
      assert.equal(plan.excluded.length, 2);
      assert.equal(plan.summary.auth_profiles_found, 1);
      assert.equal(plan.summary.auth_profiles_missing, 1);
      assert.equal(plan.summary.by_exclusion_reason.auth_profile_missing, 1);
      assert.equal(plan.summary.by_exclusion_reason.not_auth_rescout_row, 1);
      assert.equal(parsed.constraints.no_real_submission, true);
      assert.equal(parsed.constraints.requires_saved_playwright_auth_profile, true);
      assert.equal(written.endsWith('auth-rescout-plan.json'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies auth rescout plan limits after checking saved profiles', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const authDir = join(dir, 'auth');
      mkdirSync(authDir, { recursive: true });
      for (const profile of ['a', 'b']) {
        writeFileSync(join(authDir, `${profile}.storage-state.json`), JSON.stringify({ cookies: [], origins: [] }));
      }
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,a,A,a.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,a,login,scout,https://a.example/submit,,https://a.example,,,,,,,,test,auth_signal,',
        '2,P0,260,b,B,b.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,b,login,scout,https://b.example/submit,,https://b.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthRescoutPlan(queue, { authDir, limit: 1 });

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].id, 'a');
      assert.equal(plan.excluded.length, 1);
      assert.equal(plan.excluded[0].target_id, 'b');
      assert.equal(plan.excluded[0].exclusion_reason, 'over_limit');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cleans tracking params from queued and excluded auth rescout rows', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const authDir = join(dir, 'auth');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'saved.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P1,180,saved,Tool AI,toolai.io,assisted,auth_required,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,saved,"node src/cli.js auth login --profile ""saved"" --url ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories""",scout,https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories,,https://toolai.io,,,,,,,,test,auth_signal,',
        '2,P1,170,missing,Missing,toolai.io,assisted,auth_required,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,missing,"node src/cli.js auth login --profile ""missing"" --url ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories""",scout,https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories,,https://toolai.io,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthRescoutPlan(queue, { authDir });

      assert.equal(plan.targets[0].submit_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.equal(plan.excluded[0].submit_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.doesNotMatch(plan.excluded[0].auth_login_command, /ref/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth login plan', () => {
  it('queues missing auth profiles and marks existing profiles completed', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const authDir = join(dir, 'auth');
      const output = join(dir, 'auth-login-plan.json');
      const csvOutput = join(dir, 'auth-login-plan.csv');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'done.storage-state.json'), JSON.stringify({
        cookies: [],
        origins: [],
      }));
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,needs-login,Needs Login,login.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,needs-login,node src/cli.js auth login --profile "needs-login" --url "https://login.example/sign-in",node src/cli.js scout "https://login.example/submit" --auth-profile "needs-login",https://login.example/submit,https://login.example/sign-in,https://login.example,,,,,,,,test,auth_signal,',
        '2,P0,260,done,Done,done.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,done,node src/cli.js auth login --profile "done" --url "https://done.example/login",node src/cli.js scout "https://done.example/submit" --auth-profile "done",https://done.example/submit,https://done.example/login,https://done.example,,,,,,,,test,auth_signal,',
        '3,P2,120,captcha,Captcha,captcha.example,assisted,captcha_required,free,low,en,manual_submit_only_captcha,no_captcha_manual_only,no_real_submission_from_pack,captcha_or_turnstile_required,captcha,,,,https://captcha.example/submit,,https://captcha.example,,,,,,,,test,captcha_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir,
        registry: join(dir, 'registry.yaml'),
        limit: 10,
      });
      const written = writeAuthLoginPlan(plan, { output, csvOutput });
      const parsed = JSON.parse(readFileSync(output, 'utf-8'));
      const csvRows = parseCsv(readFileSync(csvOutput, 'utf-8'));

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].target_id, 'needs-login');
      assert.equal(plan.targets[0].status, 'manual_login_required');
      assert.equal(plan.targets[0].login_url, 'https://login.example/sign-in');
      assert.match(plan.targets[0].auth_status_command, /auth status --profile "needs-login"/);
      assert.match(plan.targets[0].manual_login_safety_policy, /Do not bypass CAPTCHA/);
      assert.equal(plan.completed.length, 1);
      assert.equal(plan.completed[0].target_id, 'done');
      assert.equal(plan.excluded.length, 1);
      assert.equal(plan.excluded[0].target_id, 'captcha');
      assert.equal(plan.excluded[0].exclusion_reason, 'not_auth_login_row');
      assert.equal(plan.summary.pending_rows, 1);
      assert.equal(plan.summary.auth_profiles_missing, 1);
      assert.equal(plan.summary.auth_profiles_found, 1);
      assert.equal(parsed.constraints.no_real_submission, true);
      assert.equal(parsed.constraints.no_automated_login, true);
      assert.equal(csvRows.length, 1);
      assert.equal(csvRows[0].target_id, 'needs-login');
      assert.equal(csvRows[0].status, 'manual_login_required');
      assert.equal(written.output.endsWith('auth-login-plan.json'), true);
      assert.equal(written.csv_output.endsWith('auth-login-plan.csv'), true);
      assert.match(authLoginPlanCsv(plan.targets), /manual_login_required/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('limits manual login queue without hiding total missing profiles', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,a,A,a.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,a,node src/cli.js auth login --profile "a" --url "https://a.example/login",scout,https://a.example/submit,,https://a.example,,,,,,,,test,auth_signal,',
        '2,P0,260,b,B,b.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,b,node src/cli.js auth login --profile "b" --url "https://b.example/login",scout,https://b.example/submit,,https://b.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir: join(dir, 'auth'),
        limit: 1,
      });

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].target_id, 'a');
      assert.equal(plan.summary.pending_rows, 2);
      assert.equal(plan.summary.auth_profiles_missing, 2);
      assert.equal(plan.excluded.length, 1);
      assert.equal(plan.excluded[0].target_id, 'b');
      assert.equal(plan.excluded[0].exclusion_reason, 'after_batch_limit');
      assert.equal(plan.summary.current_batch_start, 1);
      assert.equal(plan.summary.current_batch_end, 1);
      assert.equal(plan.summary.remaining_after_batch, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cleans tracking params from generated login and scout commands', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P1,180,tool-ai,Tool AI,toolai.io,assisted,auth_required,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,tool-ai,"node src/cli.js auth login --profile ""tool-ai"" --url ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories""","node src/cli.js scout ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories"" --auth-profile ""tool-ai""",https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories,,https://toolai.io,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir: join(dir, 'auth'),
        limit: 1,
      });

      assert.equal(plan.targets[0].login_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.equal(plan.targets[0].submit_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.match(plan.targets[0].auth_login_command, /ReturnUrl=%2Fen%2Fsubmit"/);
      assert.doesNotMatch(plan.targets[0].auth_login_command, /ref/i);
      assert.doesNotMatch(plan.targets[0].auth_scout_command, /ref/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks manual login rows when the login domain does not match the target domain', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,cross,Cross,target.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,cross,node src/cli.js auth login --profile "cross" --url "https://other.example/login",node src/cli.js scout "https://target.example/submit" --auth-profile "cross",https://target.example/submit,https://other.example/login,https://target.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir: join(dir, 'auth'),
        limit: 1,
      });

      assert.equal(plan.targets.length, 0);
      assert.equal(plan.summary.pending_rows, 0);
      assert.equal(plan.summary.auth_profiles_missing, 0);
      assert.equal(plan.excluded.length, 1);
      assert.equal(plan.excluded[0].target_id, 'cross');
      assert.equal(plan.excluded[0].exclusion_reason, 'login_domain_mismatch:other.example->target.example');
      assert.equal(plan.excluded[0].safety_blocker, 'login_domain_mismatch:other.example->target.example');
      assert.equal(plan.excluded[0].auth_login_command, '');
      assert.equal(plan.excluded[0].auth_scout_command, '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports rolling manual login batches with offset', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,a,A,a.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,a,node src/cli.js auth login --profile "a" --url "https://a.example/login",scout,https://a.example/submit,,https://a.example,,,,,,,,test,auth_signal,',
        '2,P0,260,b,B,b.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,b,node src/cli.js auth login --profile "b" --url "https://b.example/login",scout,https://b.example/submit,,https://b.example,,,,,,,,test,auth_signal,',
        '3,P0,250,c,C,c.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,c,node src/cli.js auth login --profile "c" --url "https://c.example/login",scout,https://c.example/submit,,https://c.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir: join(dir, 'auth'),
        offset: 1,
        limit: 1,
      });

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].target_id, 'b');
      assert.equal(plan.targets[0].order, 2);
      assert.equal(plan.summary.pending_rows, 3);
      assert.equal(plan.summary.offset, 1);
      assert.equal(plan.summary.current_batch_start, 2);
      assert.equal(plan.summary.current_batch_end, 2);
      assert.equal(plan.summary.remaining_after_batch, 1);
      assert.equal(plan.summary.by_exclusion_reason.before_offset, 1);
      assert.equal(plan.summary.by_exclusion_reason.after_batch_limit, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters stale auth login rows whose registry mode is no longer assisted', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: active
    name: Active
    domain: active.example
    submit_url: https://active.example/submit
    pricing: free
    submission:
      mode: assisted
  - id: stale-skip
    name: Stale Skip
    domain: stale.example
    submit_url: https://stale.example/submit
    pricing: paid
    submission:
      mode: skip
`);
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,active,Active,active.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,active,node src/cli.js auth login --profile "active" --url "https://active.example/login",scout,https://active.example/submit,https://active.example/login,https://active.example,,,,,,,,test,auth_signal,',
        '2,P0,260,stale-skip,Stale Skip,stale.example,assisted,auth_required,paid,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,stale-skip,node src/cli.js auth login --profile "stale-skip" --url "https://stale.example/login",scout,https://stale.example/submit,https://stale.example/login,https://stale.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const plan = buildAuthLoginPlan(queue, {
        authDir: join(dir, 'auth'),
        registry,
        registryFilter: true,
        limit: 10,
      });

      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].target_id, 'active');
      assert.equal(plan.summary.pending_rows, 1);
      assert.equal(plan.excluded.length, 1);
      assert.equal(plan.excluded[0].target_id, 'stale-skip');
      assert.equal(plan.excluded[0].exclusion_reason, 'registry_mode_not_assisted:skip');
      assert.equal(plan.summary.by_exclusion_reason['registry_mode_not_assisted:skip'], 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds and writes rolling auth login batch artifacts from the current queue', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const outputDir = join(dir, 'out');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,a,A,a.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,a,node src/cli.js auth login --profile "a" --url "https://a.example/login",scout,https://a.example/submit,,https://a.example,,,,,,,,test,auth_signal,',
        '2,P0,260,b,B,b.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,b,node src/cli.js auth login --profile "b" --url "https://b.example/login",scout,https://b.example/submit,,https://b.example,,,,,,,,test,auth_signal,',
        '3,P0,250,c,C,c.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,c,node src/cli.js auth login --profile "c" --url "https://c.example/login",scout,https://c.example/submit,,https://c.example,,,,,,,,test,auth_signal,',
      ].join('\n'));

      const report = buildAuthLoginPlanBatches(queue, {
        authDir: join(dir, 'auth'),
        batchSize: 2,
      });
      const written = writeAuthLoginPlanBatches(report, {
        outputDir,
        namePrefix: 'auth-login-plan-batch',
        summaryName: 'auth-login-plan-batches-summary',
      });
      const summary = JSON.parse(readFileSync(written.summary, 'utf-8'));
      const batchOne = JSON.parse(readFileSync(join(outputDir, 'auth-login-plan-batch-001.json'), 'utf-8'));
      const batchTwo = JSON.parse(readFileSync(join(outputDir, 'auth-login-plan-batch-002.json'), 'utf-8'));

      assert.equal(report.summary.pending_rows, 3);
      assert.equal(report.summary.batch_count, 2);
      assert.equal(report.summary.generated_target_rows, 3);
      assert.equal(report.batches.length, 2);
      assert.equal(report.batches[0].plan.targets.length, 2);
      assert.equal(report.batches[1].plan.targets.length, 1);
      assert.equal(batchOne.targets.length, 2);
      assert.equal(batchTwo.targets.length, 1);
      assert.equal(summary.summary.batch_count, 2);
      assert.equal(summary.files.batches.length, 2);
      assert.equal(existsSync(join(outputDir, 'auth-login-plan-batch-001.csv')), true);
      assert.equal(existsSync(join(outputDir, 'auth-login-plan-batch-002.csv')), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth login audit', () => {
  it('finds duplicate domains, pricing unknown rows, and shared form hosts without mutating the queue', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const outputDir = join(dir, 'out');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,beta-list,Beta List,betalist.com,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,beta-list,login,scout,https://betalist.com/submissions/new,https://betalist.com/sign_in,https://betalist.com,,,,,,,,notion,auth_signal,',
        '2,P0,260,betalist-com,https://betalist.com,betalist.com,assisted,auth_required,unknown,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,pricing_unknown_verify_free_path; auth_or_oauth_required,login,betalist-com,login,scout,https://betalist.com/,https://betalist.com/sign_in,https://betalist.com,,,,,,,,91wink,auth_signal,',
        '3,P0,250,ai-infinity,AI Infinity,forms.gle,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; no_persisted_form_evidence,login,ai-infinity,login,scout,https://forms.gle/a,https://forms.gle/a,https://forms.gle,,,,,,,,notion,auth_signal,',
        '4,P0,240,gpt-forge,GPT Forge,forms.gle,assisted,new,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; no_persisted_form_evidence,login,gpt-forge,login,scout,https://forms.gle/b,https://forms.gle/b,https://forms.gle,,,,,,,,notion,auth_signal; classification_mismatch:assisted->needs_scout,',
      ].join('\n'));

      const report = buildAuthLoginAudit(queue);
      const written = writeAuthLoginAudit(report, { outputDir, name: 'auth-login-audit' });
      const parsed = JSON.parse(readFileSync(written.audit_json, 'utf-8'));

      assert.equal(report.summary.rows, 4);
      assert.equal(report.summary.duplicate_domain_groups, 1);
      assert.equal(report.summary.shared_form_host_groups, 1);
      assert.equal(report.summary.pricing_unknown_rows, 1);
      assert.equal(report.summary.classification_mismatch_rows, 1);
      assert.equal(report.summary.by_suggested_pre_login_action.dedupe_same_site_before_login, 2);
      assert.equal(report.summary.by_suggested_pre_login_action.manual_login_then_rescout, 1);
      assert.equal(report.summary.by_suggested_pre_login_action.registry_recheck_before_login, 1);
      assert.equal(report.rows[0].suggested_pre_login_action, 'dedupe_same_site_before_login');
      assert.equal(report.rows[1].duplicate_group_size, '2');
      assert.equal(report.rows[2].audit_flags.includes('shared_form_host'), true);
      assert.equal(report.rows[2].audit_flags.includes('duplicate_domain_candidate'), false);
      assert.equal(report.rows[3].suggested_pre_login_action, 'registry_recheck_before_login');
      assert.equal(parsed.summary.duplicate_domain_groups, 1);
      assert.equal(existsSync(written.audit_csv), true);
      assert.equal(existsSync(written.audit_json), true);
      assert.equal(existsSync(written.audit_md), true);
      assert.match(authLoginAuditCsv(report.rows), /suggested_pre_login_action/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth login triage', () => {
  it('splits auth login rows into pricing, dedupe, registry recheck, surface review, and direct login queues', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const outputDir = join(dir, 'out');
      writeFileSync(queue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,270,beta-list,Beta List,betalist.com,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,beta-list,login,scout,https://betalist.com/submissions/new,https://betalist.com/sign_in,https://betalist.com,,,,,,,,notion,auth_signal,',
        '2,P0,260,betalist-com,https://betalist.com,betalist.com,assisted,auth_required,unknown,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,pricing_unknown_verify_free_path; auth_or_oauth_required,login,betalist-com,login,scout,https://betalist.com/,https://betalist.com/sign_in,https://betalist.com,,,,,,,,91wink,auth_signal,',
        '3,P0,250,asr,ASR,activesearchresults.com,assisted,auth_required,unknown,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,pricing_unknown_verify_free_path; auth_or_oauth_required,login,asr,login,scout,https://www.activesearchresults.com/addwebsite.php,https://www.activesearchresults.com/addwebsite.php,https://www.activesearchresults.com,,,,,,,,targets.yaml,auth_signal,',
        '4,P0,245,mergeek,Mergeek,mergeek.com,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; required_fields_unmapped,login,mergeek,login,scout,https://mergeek.com/publish_project,https://mergeek.com/publish_project,https://mergeek.com,,,,,,,,targets.yaml,auth_signal; classification_mismatch:assisted->needs_scout,',
        '5,P1,240,orbic-ai,Orbic AI,orbic.ai,assisted,new,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,login,orbic-ai,login,scout,https://orbic.ai/login?callbackUrl=https%3A%2F%2Forbic.ai%2Fsubmit%2Ftools,,https://orbic.ai,,,,,,,,notion,auth_or_manual_signal,',
        '6,P0,230,chatgptdemo,ChatGPT demo,chatgptdemo.com,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,chatgptdemo,login,scout,https://chatgptdemo.com/submit-new-ai-tool,https://chatgptdemo.com/submit-new-ai-tool,https://chatgptdemo.com,,,,,,,,targets.yaml,auth_signal,',
      ].join('\n'));

      const report = buildAuthLoginTriage(queue, { auditPath: join(dir, 'auth-login-audit.json') });
      const written = writeAuthLoginTriage(report, { outputDir, name: 'auth-login-triage' });
      const parsed = JSON.parse(readFileSync(written.triage_json, 'utf-8'));
      const pricingRows = parseCsv(readFileSync(written.pricing_review_queue_csv, 'utf-8'));
      const dedupeRows = parseCsv(readFileSync(written.dedupe_queue_csv, 'utf-8'));
      const registryRows = parseCsv(readFileSync(written.registry_recheck_queue_csv, 'utf-8'));
      const manualSurfaceRows = parseCsv(readFileSync(written.manual_surface_review_queue_csv, 'utf-8'));
      const directRows = parseCsv(readFileSync(written.direct_login_queue_csv, 'utf-8'));

      assert.equal(report.summary.rows, 6);
      assert.equal(report.summary.pricing_review_rows, 1);
      assert.equal(report.summary.dedupe_rows, 2);
      assert.equal(report.summary.registry_recheck_rows, 1);
      assert.equal(report.summary.manual_surface_review_rows, 1);
      assert.equal(report.summary.direct_login_rows, 1);
      assert.equal(report.queues.pricing_review[0].target_id, 'asr');
      assert.equal(report.queues.direct_login[0].target_id, 'chatgptdemo');
      assert.equal(pricingRows.length, 1);
      assert.equal(pricingRows[0].target_id, 'asr');
      assert.equal(dedupeRows.length, 2);
      assert.equal(registryRows[0].target_id, 'mergeek');
      assert.equal(manualSurfaceRows[0].target_id, 'orbic-ai');
      assert.equal(directRows.length, 1);
      assert.equal(directRows[0].target_id, 'chatgptdemo');
      assert.equal(parsed.summary.by_suggested_pre_login_action.dedupe_same_site_before_login, 2);
      assert.equal(existsSync(written.triage_md), true);
      assert.equal(existsSync(written.pricing_review_queue_csv), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth residual shrink', () => {
  it('builds read-only shrink decisions for dedupe, registry recheck, and manual surface review rows', async () => {
    const dir = tempDir();
    try {
      const triagePath = join(dir, 'auth-login-triage.json');
      const dedupeQueue = join(dir, 'auth-login-dedupe-before-login.csv');
      const registryQueue = join(dir, 'auth-login-registry-recheck-before-login.csv');
      const manualQueue = join(dir, 'auth-login-manual-surface-review-before-login.csv');
      const scoutDir = join(dir, 'scout-results');
      const registry = join(dir, 'registry.yaml');
      const outputDir = join(dir, 'out');
      mkdirSync(scoutDir, { recursive: true });

      writeFileSync(triagePath, JSON.stringify({
        source_queue: 'queue.csv',
        files: {
          dedupe_queue_csv: dedupeQueue.replace(/\\/g, '/'),
          registry_recheck_queue_csv: registryQueue.replace(/\\/g, '/'),
          manual_surface_review_queue_csv: manualQueue.replace(/\\/g, '/'),
        },
      }, null, 2));

      writeFileSync(dedupeQueue, [
        'triage_order,suggested_pre_login_action,priority,target_id,name,domain,pricing,risk,status,source,submit_url,final_url,audit_flags,safety_blockers,reason,duplicate_group_key,duplicate_group_size,related_target_ids,notes',
        '1,dedupe_same_site_before_login,P0,beta-list,Beta List,betalist.com,free,unknown,auth_required,notion,https://betalist.com/submissions/new,https://betalist.com/sign_in,duplicate_domain_candidate,auth_or_oauth_required,auth_signal,betalist.com,3,betalist-com; betalist,',
        '2,dedupe_same_site_before_login,P0,betalist-com,https://betalist.com,betalist.com,unknown,unknown,auth_required,91wink,https://betalist.com/,https://betalist.com/sign_in,duplicate_domain_candidate,auth_or_oauth_required,auth_signal,betalist.com,3,beta-list; betalist,',
        '3,dedupe_same_site_before_login,P1,betalist,Betalist,betalist.com,unknown,medium,new,targets.yaml,https://betalist.com/users/sign_in,,duplicate_domain_candidate,auth_or_oauth_required,auth_or_manual_signal,betalist.com,3,beta-list; betalist-com,',
      ].join('\n'));

      writeFileSync(registryQueue, [
        'triage_order,suggested_pre_login_action,priority,target_id,name,domain,pricing,risk,status,source,submit_url,final_url,audit_flags,safety_blockers,reason,duplicate_group_key,duplicate_group_size,related_target_ids,notes',
        '1,registry_recheck_before_login,P0,mergeek,Mergeek,mergeek.com,free,unknown,auth_required,targets.yaml,https://mergeek.com/publish_project,https://mergeek.com/publish_project,classification_mismatch; required_fields_unmapped,auth_or_oauth_required; required_fields_unmapped,auth_signal; classification_mismatch:assisted->needs_scout,,,,',
        '2,registry_recheck_before_login,P0,top-best-alternatives,Top Best Alternatives,topbestalternatives.com,freemium,unknown,auth_required,targets.yaml,https://www.topbestalternatives.com/,https://www.topbestalternatives.com/,classification_mismatch,auth_or_oauth_required,auth_signal; classification_mismatch:assisted->assisted,,,,',
      ].join('\n'));

      writeFileSync(manualQueue, [
        'triage_order,suggested_pre_login_action,priority,target_id,name,domain,pricing,risk,status,source,submit_url,final_url,audit_flags,safety_blockers,reason,duplicate_group_key,duplicate_group_size,related_target_ids,notes',
        '1,manual_surface_review_before_login,P1,orbic-ai,Orbic AI,orbic.ai,free,medium,new,notion,https://orbic.ai/login?callbackUrl=https%3A%2F%2Forbic.ai%2Fsubmit%2Ftools,,status_new; no_persisted_form_evidence; manual_surface_review_required,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,auth_or_manual_signal,,,,',
        '2,manual_surface_review_before_login,P1,promoteproject,PromoteProject,promoteproject.com,free,medium,new,notion,https://www.promoteproject.com/login,,status_new; no_persisted_form_evidence; manual_surface_review_required,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,auth_or_manual_signal,,,,',
        '3,manual_surface_review_before_login,P1,tool-ai,Tool AI,toolai.io,free,medium,new,notion,https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit,,status_new; no_persisted_form_evidence; manual_surface_review_required,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,auth_or_manual_signal,,,,',
      ].join('\n'));

      writeFileSync(join(scoutDir, 'beta-list.json'), JSON.stringify({
        target_id: 'beta-list',
        submit_url: 'https://betalist.com/submissions/new',
        final_url: 'https://betalist.com/sign_in',
        http_status: 200,
        submit_links: [{ text: 'Submit Startup', href: 'https://betalist.com/sign_in' }],
        signals: { login_required: true, oauth_available: true, captcha: false, payment: false },
        forms: [{ fields: [{ required: false, mapped_to: 'product.email' }], submit_buttons: [{ text: 'Sign in with email' }] }],
      }, null, 2));
      writeFileSync(join(scoutDir, 'betalist-com.json'), JSON.stringify({
        target_id: 'betalist-com',
        submit_url: 'https://betalist.com/',
        final_url: 'https://betalist.com/sign_in',
        http_status: 200,
        submit_links: [{ text: 'Submit startup', href: 'https://betalist.com/submit' }],
        signals: { login_required: true, oauth_available: true, captcha: false, payment: false },
        forms: [{ fields: [{ required: false, mapped_to: 'product.email' }], submit_buttons: [{ text: 'Sign in with email' }] }],
      }, null, 2));
      writeFileSync(join(scoutDir, 'mergeek.json'), JSON.stringify({
        target_id: 'mergeek',
        submit_url: 'https://mergeek.com/publish_project',
        final_url: 'https://mergeek.com/publish_project',
        http_status: 200,
        submit_links: [],
        signals: { login_required: false, oauth_available: false, captcha: false, payment: false },
        forms: [{
          fields: [
            { required: true, mapped_to: 'product.name' },
            { required: true, mapped_to: 'product.url' },
            { required: true, mapped_to: '' },
            { required: true, mapped_to: 'product.email' },
          ],
          submit_buttons: [{ text: '提交产品，开启首发之旅' }],
        }],
      }, null, 2));
      writeFileSync(join(scoutDir, 'top-best-alternatives.json'), JSON.stringify({
        target_id: 'top-best-alternatives',
        submit_url: 'https://www.topbestalternatives.com/',
        final_url: 'https://www.topbestalternatives.com/',
        http_status: 200,
        submit_links: [],
        signals: { login_required: false, oauth_available: true, captcha: false, payment: false },
        forms: [{
          fields: [{ name: 's', placeholder: 'Find alternatives to...', required: false, mapped_to: '' }],
          submit_buttons: [{ text: 'Search' }],
        }],
      }, null, 2));

      writeFileSync(registry, `
version: 1
targets:
  - id: mergeek
    domain: mergeek.com
    submit_url: https://mergeek.com/publish_project
    source_meta:
      scout_classification_mismatch: true
  - id: top-best-alternatives
    domain: topbestalternatives.com
    submit_url: https://www.topbestalternatives.com/
    source_meta:
      scout_classification_mismatch: true
`, 'utf-8');

      const fetchMap = new Map([
        ['https://www.promoteproject.com/login', {
          ok: true,
          status: 200,
          url: 'https://www.promoteproject.com/login',
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><head><title>Login</title></head><body>Log in to submit startup</body></html>',
        }],
        ['https://www.promoteproject.com/', {
          ok: true,
          status: 200,
          url: 'https://www.promoteproject.com/',
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><head><title>PromoteProject</title></head><body>Startup growth platform</body></html>',
        }],
        ['https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit', {
          ok: true,
          status: 200,
          url: 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit',
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><head><title>Login</title></head><body>Login to continue</body></html>',
        }],
        ['https://toolai.io/en/submit', {
          ok: true,
          status: 200,
          url: 'https://toolai.io/en/submit',
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><head><title>Submit</title></head><body>Submit your AI tool</body></html>',
        }],
        ['https://toolai.io/', {
          ok: true,
          status: 200,
          url: 'https://toolai.io/',
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><body>AI tools</body></html>',
        }],
      ]);
      const fetchFn = async (url) => {
        const response = fetchMap.get(url);
        if (!response) throw new Error(`unexpected_url:${url}`);
        return {
          ok: response.ok,
          status: response.status,
          url: response.url,
          headers: { get: (key) => response.headers.get(String(key).toLowerCase()) || response.headers.get(key) || '' },
          text: response.text,
        };
      };

      const report = await buildAuthResidualShrink(triagePath, {
        registry,
        scoutDir,
        fetchFn,
      });
      const written = writeAuthResidualShrink(report, {
        outputDir,
        name: 'auth-residual-shrink',
      });
      const parsed = JSON.parse(readFileSync(written.residual_json, 'utf-8'));
      const residualRows = parseCsv(readFileSync(written.residual_csv, 'utf-8'));
      const evidenceRows = parseCsv(readFileSync(written.manual_surface_evidence_csv, 'utf-8'));

      assert.equal(report.summary.rows, 8);
      assert.equal(report.summary.dedupe_rows, 3);
      assert.equal(report.summary.registry_recheck_rows, 2);
      assert.equal(report.summary.manual_surface_review_rows, 3);
      assert.equal(report.summary.manual_surface_checked_urls, 8);
      assert.equal(report.summary.by_suggested_resolution.keep_primary_auth_candidate, 1);
      assert.equal(report.summary.by_suggested_resolution.drop_duplicate_before_login, 2);
      assert.equal(report.summary.by_suggested_resolution.move_out_of_auth_to_needs_scout, 1);
      assert.equal(report.summary.by_suggested_resolution.move_out_of_auth_to_manual_surface_review, 1);
      assert.equal(report.summary.by_suggested_resolution.keep_in_auth_queue_after_surface_review, 2);
      assert.equal(report.summary.by_suggested_resolution.manual_surface_review_required_continue, 1);
      assert.equal(report.rows.find(row => row.target_id === 'beta-list').suggested_resolution, 'keep_primary_auth_candidate');
      assert.equal(report.rows.find(row => row.target_id === 'betalist-com').suggested_resolution, 'drop_duplicate_before_login');
      assert.equal(report.rows.find(row => row.target_id === 'mergeek').suggested_resolution, 'move_out_of_auth_to_needs_scout');
      assert.equal(report.rows.find(row => row.target_id === 'top-best-alternatives').suggested_resolution, 'move_out_of_auth_to_manual_surface_review');
      assert.equal(report.rows.find(row => row.target_id === 'orbic-ai').suggested_resolution, 'manual_surface_review_required_continue');
      assert.equal(report.rows.find(row => row.target_id === 'promoteproject').suggested_resolution, 'keep_in_auth_queue_after_surface_review');
      assert.equal(report.rows.find(row => row.target_id === 'tool-ai').suggested_resolution, 'keep_in_auth_queue_after_surface_review');
      assert.equal(parsed.summary.rows, 8);
      assert.equal(residualRows.length, 8);
      assert.equal(evidenceRows.length, 8);
      assert.equal(existsSync(written.residual_md), true);
      assert.match(authResidualShrinkCsv(report), /suggested_resolution/);
      assert.match(authResidualSurfaceEvidenceCsv(report.manual_surface_evidence_rows), /url_kind/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth residual resolve', () => {
  it('rebuilds a resolved direct-login queue from triage direct-login rows plus residual keep-auth rows', () => {
    const dir = tempDir();
    try {
      const sourceQueue = join(dir, 'auth-login-rescout-queue.csv');
      const triagePath = join(dir, 'auth-login-triage.json');
      const residualPath = join(dir, 'auth-residual-shrink.json');
      const outputDir = join(dir, 'out');

      writeFileSync(sourceQueue, [
        'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes',
        '1,P0,315,beta-list,Beta List,betalist.com,assisted,auth_required,free,unknown,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,beta-list,node src/cli.js auth login --profile "beta-list" --url "https://betalist.com/sign_in",node src/cli.js scout "https://betalist.com/submissions/new" --auth-profile "beta-list",https://betalist.com/submissions/new,https://betalist.com/sign_in,https://betalist.com/,2026-05-22T14:54:22.927Z,,2,5,0,0,2,notion,auth_signal,',
        '2,P0,315,betalist-com,https://betalist.com,betalist.com,assisted,auth_required,unknown,unknown,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,pricing_unknown_verify_free_path; auth_or_oauth_required,login,betalist-com,node src/cli.js auth login --profile "betalist-com" --url "https://betalist.com/sign_in",node src/cli.js scout "https://betalist.com/" --auth-profile "betalist-com",https://betalist.com/,https://betalist.com/sign_in,https://betalist.com/,2026-05-22T14:54:22.927Z,,2,5,0,0,2,91wink,auth_signal,',
        '3,P0,315,chatgptdemo,ChatGPT demo,chatgptdemo.com,assisted,auth_required,free,unknown,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,chatgptdemo,node src/cli.js auth login --profile "chatgptdemo" --url "https://chatgptdemo.com/submit-new-ai-tool",node src/cli.js scout "https://chatgptdemo.com/submit-new-ai-tool" --auth-profile "chatgptdemo",https://chatgptdemo.com/submit-new-ai-tool,https://chatgptdemo.com/submit-new-ai-tool,https://chatgptdemo.com/,2026-05-22T15:01:30.932Z,,3,9,0,0,3,targets.yaml,auth_signal,',
        '4,P0,315,promptzone,Promptzone,promptzone.com,assisted,auth_required,free,unknown,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,promptzone,node src/cli.js auth login --profile "promptzone" --url "https://www.promptzone.com/new",node src/cli.js scout "https://www.promptzone.com/new" --auth-profile "promptzone",https://www.promptzone.com/new,https://www.promptzone.com/new,https://www.promptzone.com/,2026-05-22T17:22:54.870Z,,4,12,0,0,4,notion,auth_signal,',
        '5,P0,280,mergeek,Mergeek,mergeek.com,assisted,auth_required,free,unknown,zh,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; required_fields_unmapped,login,mergeek,node src/cli.js auth login --profile "mergeek" --url "https://mergeek.com/publish_project",node src/cli.js scout "https://mergeek.com/publish_project" --auth-profile "mergeek",https://mergeek.com/publish_project,https://mergeek.com/publish_project,https://mergeek.com/,2026-05-23T03:38:04.478Z,,1,5,4,1,1,targets.yaml,auth_signal; classification_mismatch:assisted->needs_scout,',
        '6,P0,280,top-best-alternatives,Top Best Alternatives,topbestalternatives.com,assisted,auth_required,freemium,unknown,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,top-best-alternatives,node src/cli.js auth login --profile "top-best-alternatives" --url "https://www.topbestalternatives.com/",node src/cli.js scout "https://www.topbestalternatives.com/" --auth-profile "top-best-alternatives",https://www.topbestalternatives.com/,https://www.topbestalternatives.com/,https://www.topbestalternatives.com/,2026-05-23T02:23:36.763Z,,1,2,0,0,1,targets.yaml,auth_signal; classification_mismatch:assisted->assisted,',
        '7,P1,210,orbic-ai,Orbic AI,orbic.ai,assisted,new,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,login,orbic-ai,node src/cli.js auth login --profile "orbic-ai" --url "https://orbic.ai/login?callbackUrl=https%3A%2F%2Forbic.ai%2Fsubmit%2Ftools",node src/cli.js scout "https://orbic.ai/login?callbackUrl=https%3A%2F%2Forbic.ai%2Fsubmit%2Ftools" --auth-profile "orbic-ai",https://orbic.ai/login?callbackUrl=https%3A%2F%2Forbic.ai%2Fsubmit%2Ftools,,https://orbic.ai/,,,0,0,0,0,0,notion,auth_or_manual_signal,',
        '8,P1,210,promoteproject,PromoteProject,promoteproject.com,assisted,new,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,login,promoteproject,node src/cli.js auth login --profile "promoteproject" --url "https://www.promoteproject.com/login",node src/cli.js scout "https://www.promoteproject.com/login" --auth-profile "promoteproject",https://www.promoteproject.com/login,,https://www.promoteproject.com/,,,0,0,0,0,0,notion,auth_or_manual_signal,',
        '9,P1,210,tool-ai,Tool AI,toolai.io,assisted,new,free,medium,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required; manual_surface_review_required; no_persisted_form_evidence,login,tool-ai,node src/cli.js auth login --profile "tool-ai" --url "https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit",node src/cli.js scout "https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit" --auth-profile "tool-ai",https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit,,https://toolai.io/,,,0,0,0,0,0,notion,auth_or_manual_signal,',
      ].join('\n'));

      writeFileSync(triagePath, JSON.stringify({
        source_queue: sourceQueue.replace(/\\/g, '/'),
        queues: {
          direct_login: [
            { target_id: 'chatgptdemo' },
            { target_id: 'promptzone' },
          ],
        },
      }, null, 2));

      writeFileSync(residualPath, JSON.stringify({
        source_triage: triagePath.replace(/\\/g, '/'),
        source_queue: sourceQueue.replace(/\\/g, '/'),
        rows: [
          { review_type: 'dedupe', target_id: 'beta-list', suggested_resolution: 'keep_primary_auth_candidate', resolution_bucket: 'keep_auth', notes: 'keep canonical' },
          { review_type: 'dedupe', target_id: 'betalist-com', suggested_resolution: 'drop_duplicate_before_login', resolution_bucket: 'shrink_auth_queue', notes: 'drop dup' },
          { review_type: 'registry_recheck', target_id: 'mergeek', suggested_resolution: 'move_out_of_auth_to_needs_scout', resolution_bucket: 'shrink_auth_queue', notes: 'needs scout' },
          { review_type: 'registry_recheck', target_id: 'top-best-alternatives', suggested_resolution: 'move_out_of_auth_to_manual_surface_review', resolution_bucket: 'shrink_auth_queue', notes: 'manual review' },
          { review_type: 'manual_surface_review', target_id: 'orbic-ai', suggested_resolution: 'manual_surface_review_required_continue', resolution_bucket: 'needs_manual_review', notes: 'fetch failed' },
          { review_type: 'manual_surface_review', target_id: 'promoteproject', suggested_resolution: 'keep_in_auth_queue_after_surface_review', resolution_bucket: 'keep_auth', notes: 'auth confirmed' },
          { review_type: 'manual_surface_review', target_id: 'tool-ai', suggested_resolution: 'keep_in_auth_queue_after_surface_review', resolution_bucket: 'keep_auth', notes: 'auth confirmed' },
        ],
      }, null, 2));

      const report = buildAuthResidualResolve(triagePath, residualPath);
      const written = writeAuthResidualResolve(report, {
        outputDir,
        name: 'auth-residual-resolve',
      });
      const summary = JSON.parse(readFileSync(written.summary_json, 'utf-8'));
      const directRows = parseCsv(readFileSync(written.direct_login_queue_csv, 'utf-8'));
      const needsScoutRows = parseCsv(readFileSync(written.needs_scout_queue_csv, 'utf-8'));
      const manualRows = parseCsv(readFileSync(written.manual_review_queue_csv, 'utf-8'));
      const droppedRows = parseCsv(readFileSync(written.dropped_queue_csv, 'utf-8'));

      assert.equal(report.summary.triage_direct_login_rows, 2);
      assert.equal(report.summary.residual_keep_auth_rows, 3);
      assert.equal(report.summary.resolved_direct_login_rows, 5);
      assert.equal(report.summary.resolved_needs_scout_rows, 1);
      assert.equal(report.summary.resolved_manual_review_rows, 2);
      assert.equal(report.summary.resolved_dropped_rows, 1);
      assert.equal(report.summary.unresolved_manual_review_rows, 1);
      assert.equal(report.summary.direct_login_delta_vs_triage, 3);
      assert.equal(report.summary.by_lane.direct_login, 3);
      assert.equal(report.summary.by_lane.needs_scout, 1);
      assert.equal(report.summary.by_lane.manual_review, 2);
      assert.equal(report.summary.by_lane.dropped, 1);
      assert.deepEqual(directRows.map(row => row.target_id), ['beta-list', 'chatgptdemo', 'promptzone', 'promoteproject', 'tool-ai']);
      assert.deepEqual(needsScoutRows.map(row => row.target_id), ['mergeek']);
      assert.deepEqual(manualRows.map(row => row.target_id), ['top-best-alternatives', 'orbic-ai']);
      assert.deepEqual(droppedRows.map(row => row.target_id), ['betalist-com']);
      assert.equal(summary.summary.resolved_direct_login_rows, 5);
      assert.equal(existsSync(written.summary_md), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth login status', () => {
  it('checks saved and missing auth profiles from a login batch CSV', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'auth-login-batch.csv');
      const authDir = join(dir, 'auth');
      const output = join(dir, 'auth-login-status.json');
      const csvOutput = join(dir, 'auth-login-status.csv');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'saved.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(batch, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P0,saved,Saved,saved.example,free,low,saved,auth/saved.storage-state.json,manual_login_required,https://saved.example/login,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",status,node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,manual',
        '2,P0,missing,Missing,missing.example,free,low,missing,auth/missing.storage-state.json,manual_login_required,https://missing.example/login,node src/cli.js auth login --profile "missing" --url "https://missing.example/login",status,node src/cli.js scout "https://missing.example/submit" --auth-profile "missing",https://missing.example/submit,manual',
      ].join('\n'));

      const report = buildAuthLoginStatus(batch, { authDir });
      const written = writeAuthLoginStatus(report, { output, csvOutput });
      const parsed = JSON.parse(readFileSync(output, 'utf-8'));
      const csvRows = parseCsv(readFileSync(csvOutput, 'utf-8'));

      assert.equal(report.rows.length, 2);
      assert.equal(report.rows[0].target_id, 'saved');
      assert.equal(report.rows[0].status, 'auth_profile_saved');
      assert.equal(report.rows[0].ready_for_auth_rescout, 'yes');
      assert.equal(report.rows[0].next_action, 'run_auth_scout_command');
      assert.equal(report.rows[1].target_id, 'missing');
      assert.equal(report.rows[1].status, 'manual_login_required');
      assert.equal(report.rows[1].ready_for_auth_rescout, 'no');
      assert.equal(report.rows[1].next_action, 'run_auth_login_command');
      assert.equal(report.summary.auth_profiles_found, 1);
      assert.equal(report.summary.auth_profiles_missing, 1);
      assert.equal(report.summary.ready_for_auth_rescout_rows, 1);
      assert.equal(report.constraints.no_real_submission, true);
      assert.equal(report.constraints.no_browser_launch, true);
      assert.equal(report.constraints.no_network_access_required, true);
      assert.equal(parsed.summary.source_rows, 2);
      assert.equal(csvRows.length, 2);
      assert.equal(csvRows[0].status, 'auth_profile_saved');
      assert.equal(written.output.endsWith('auth-login-status.json'), true);
      assert.equal(written.csv_output.endsWith('auth-login-status.csv'), true);
      assert.match(authLoginStatusCsv(report.rows), /ready_for_auth_rescout/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cleans tracking params from status rows and commands', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'auth-login-batch.csv');
      writeFileSync(batch, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P1,tool-ai,Tool AI,toolai.io,free,medium,tool-ai,auth/tool-ai.storage-state.json,manual_login_required,https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories,"node src/cli.js auth login --profile ""tool-ai"" --url ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories""",status,"node src/cli.js scout ""https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories"" --auth-profile ""tool-ai""",https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit%3Fref%3Daidirectories,manual',
      ].join('\n'));

      const report = buildAuthLoginStatus(batch, { authDir: join(dir, 'auth') });

      assert.equal(report.rows[0].login_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.equal(report.rows[0].submit_url, 'https://toolai.io/Login?ReturnUrl=%2Fen%2Fsubmit');
      assert.doesNotMatch(report.rows[0].auth_login_command, /ref/i);
      assert.doesNotMatch(report.rows[0].auth_scout_command, /ref/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks next-login selection when the login domain does not match the target domain', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'auth-login-batch.csv');
      writeFileSync(batch, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P0,cross,Cross,target.example,free,low,cross,auth/cross.storage-state.json,manual_login_required,https://other.example/login,node src/cli.js auth login --profile "cross" --url "https://other.example/login",status,node src/cli.js scout "https://target.example/submit" --auth-profile "cross",https://target.example/submit,manual',
        '2,P0,next,Next,next.example,free,low,next,auth/next.storage-state.json,manual_login_required,https://next.example/login,node src/cli.js auth login --profile "next" --url "https://next.example/login",status,node src/cli.js scout "https://next.example/submit" --auth-profile "next",https://next.example/submit,manual',
      ].join('\n'));

      const status = buildAuthLoginStatus(batch, { authDir: join(dir, 'auth') });
      const next = buildAuthLoginNext([batch], {
        authDir: join(dir, 'auth'),
        limit: 1,
      });

      assert.equal(status.rows[0].status, 'blocked_login_domain_mismatch');
      assert.equal(status.rows[0].next_action, 'fix_login_domain_mismatch');
      assert.equal(status.rows[0].safety_blocker, 'login_domain_mismatch:other.example->target.example');
      assert.equal(status.rows[0].auth_login_command, '');
      assert.equal(status.rows[0].auth_status_command, '');
      assert.equal(status.rows[0].auth_scout_command, '');
      assert.equal(status.summary.safety_blocked_rows, 1);
      assert.equal(status.summary.auth_profiles_missing, 1);
      assert.equal(next.summary.actionable_rows, 1);
      assert.equal(next.tasks.length, 1);
      assert.equal(next.tasks[0].target_id, 'next');
      assert.equal(next.excluded.some(row => row.exclusion_reason === 'fix_login_domain_mismatch'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts JSON login plans, falls back to target IDs, and blocks rows without identity', () => {
    const dir = tempDir();
    try {
      const batch = join(dir, 'auth-login-plan.json');
      writeFileSync(batch, JSON.stringify({
        targets: [
          {
            order: 1,
            target_id: 'needs-profile',
            name: 'Needs Profile',
            auth_profile: '',
            login_url: 'https://example.com/login',
            submit_url: 'https://example.com/submit',
          },
          {
            order: 2,
            name: 'No Identity',
            auth_profile: '',
            login_url: 'https://no-identity.example/login',
            submit_url: 'https://no-identity.example/submit',
          },
        ],
      }));

      const report = buildAuthLoginStatus(batch, { authDir: join(dir, 'auth') });

      assert.equal(report.source_type, 'plan_targets');
      assert.equal(report.rows.length, 2);
      assert.equal(report.rows[0].auth_profile, 'needs-profile');
      assert.equal(report.rows[0].status, 'manual_login_required');
      assert.equal(report.rows[0].next_action, 'manual_login_command_missing');
      assert.equal(report.rows[1].status, 'blocked_missing_auth_profile');
      assert.equal(report.rows[1].next_action, 'fix_batch_auth_profile');
      assert.equal(report.rows[1].auth_meta_path, '');
      assert.equal(report.summary.missing_auth_profile_rows, 1);
      assert.equal(report.summary.auth_profiles_found, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('selects next manual login tasks from multiple batches without executing commands', () => {
    const dir = tempDir();
    try {
      const batchOne = join(dir, 'auth-login-batch-001.csv');
      const batchTwo = join(dir, 'auth-login-batch-002.csv');
      const authDir = join(dir, 'auth');
      const output = join(dir, 'auth-login-next.json');
      const csvOutput = join(dir, 'auth-login-next.csv');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'saved.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(batchOne, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P0,saved,Saved,saved.example,free,low,saved,auth/saved.storage-state.json,manual_login_required,https://saved.example/login,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",status,node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,manual',
        '2,P0,a,A,a.example,free,low,a,auth/a.storage-state.json,manual_login_required,https://a.example/login,node src/cli.js auth login --profile "a" --url "https://a.example/login",status,node src/cli.js scout "https://a.example/submit" --auth-profile "a",https://a.example/submit,manual',
      ].join('\n'));
      writeFileSync(batchTwo, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '3,P1,b,B,b.example,free,low,b,auth/b.storage-state.json,manual_login_required,https://b.example/login,node src/cli.js auth login --profile "b" --url "https://b.example/login",status,node src/cli.js scout "https://b.example/submit" --auth-profile "b",https://b.example/submit,manual',
        '4,P1,c,C,c.example,free,low,c,auth/c.storage-state.json,manual_login_required,https://c.example/login,node src/cli.js auth login --profile "c" --url "https://c.example/login",status,node src/cli.js scout "https://c.example/submit" --auth-profile "c",https://c.example/submit,manual',
      ].join('\n'));

      const report = buildAuthLoginNext([batchOne, batchTwo], {
        authDir,
        offset: 1,
        limit: 1,
      });
      const written = writeAuthLoginNext(report, { output, csvOutput });
      const parsed = JSON.parse(readFileSync(output, 'utf-8'));
      const csvRows = parseCsv(readFileSync(csvOutput, 'utf-8'));

      assert.equal(report.constraints.no_real_submission, true);
      assert.equal(report.constraints.no_browser_launch, true);
      assert.equal(report.constraints.no_network_access_required, true);
      assert.equal(report.constraints.no_command_execution, true);
      assert.equal(report.summary.actionable_rows, 3);
      assert.equal(report.summary.task_rows, 1);
      assert.equal(report.summary.current_batch_start, 2);
      assert.equal(report.summary.current_batch_end, 2);
      assert.equal(report.summary.remaining_after_batch, 1);
      assert.equal(report.summary.by_exclusion_reason.auth_profile_saved, 1);
      assert.equal(report.summary.by_exclusion_reason.before_offset, 1);
      assert.equal(report.summary.by_exclusion_reason.after_batch_limit, 1);
      assert.equal(report.tasks[0].target_id, 'b');
      assert.equal(report.tasks[0].task_order, '1');
      assert.equal(report.tasks[0].batch_order, '3');
      assert.match(report.tasks[0].manual_login_safety_policy, /no_real_submission/);
      assert.match(authLoginNextCsv(report.tasks), /manual_login_safety_policy/);
      assert.equal(parsed.summary.task_rows, 1);
      assert.equal(csvRows.length, 1);
      assert.equal(csvRows[0].target_id, 'b');
      assert.equal(written.output.endsWith('auth-login-next.json'), true);
      assert.equal(written.csv_output.endsWith('auth-login-next.csv'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth login operator pack', () => {
  it('generates a human-only login runbook and helper without submit, scout, or execute commands', () => {
    const dir = tempDir();
    try {
      const input = join(dir, 'auth-login-next.json');
      const outputDir = join(dir, 'out');
      writeFileSync(input, JSON.stringify({
        version: 1,
        tasks: [
          {
            task_order: '1',
            priority: 'P0',
            target_id: 'needs-login',
            name: 'Needs Login',
            domain: 'login.example',
            pricing: 'free',
            risk: 'low',
            auth_profile: 'needs-login',
            status: 'manual_login_required',
            login_url: 'https://login.example/sign-in',
            submit_url: 'https://login.example/submit',
            auth_scout_command: 'node src/cli.js scout "https://login.example/submit" --auth-profile "needs-login"',
          },
          {
            task_order: '2',
            priority: 'P0',
            target_id: 'cross-domain',
            name: 'Cross Domain',
            domain: 'target.example',
            pricing: 'free',
            risk: 'low',
            auth_profile: 'cross-domain',
            login_url: 'https://other.example/login',
            submit_url: 'https://target.example/submit',
          },
          {
            task_order: '3',
            priority: 'P1',
            target_id: 'blocked',
            name: 'Blocked',
            domain: 'blocked.example',
            pricing: 'unknown',
            risk: 'unknown',
            auth_profile: '',
            login_url: '',
          },
        ],
      }));

      const pack = buildAuthLoginOperatorPack(input, {
        refreshCommand: 'node src/cli.js targets auth-workflow-refresh queue.csv batch.json',
      });
      const written = writeAuthLoginOperatorPack(pack, {
        outputDir,
        name: 'operator-test',
      });
      const markdown = readFileSync(written.markdown, 'utf-8');
      const powershell = readFileSync(written.powershell, 'utf-8');
      const summary = JSON.parse(readFileSync(written.summary, 'utf-8'));

      assert.equal(pack.constraints.generation_no_real_submission, true);
      assert.equal(pack.constraints.generation_no_browser_launch, true);
      assert.equal(pack.constraints.generated_script_requires_human_confirmation_per_target, true);
      assert.equal(pack.constraints.generated_script_no_submit_command, true);
      assert.equal(pack.constraints.generated_script_no_scout_command, true);
      assert.equal(pack.constraints.generated_script_no_run_plan_execute, true);
      assert.equal(pack.summary.task_rows, 3);
      assert.equal(pack.summary.runnable_manual_login_rows, 1);
      assert.equal(pack.summary.blocked_rows, 2);
      assert.equal(pack.tasks[1].blocker, 'login_domain_mismatch:other.example->target.example');
      assert.match(markdown, /Human-only login collection/);
      assert.match(markdown, /node src\/cli\.js auth login --profile "needs-login"/);
      assert.match(markdown, /login_domain_mismatch:other\.example-&gt;target\.example|login_domain_mismatch:other\.example->target\.example/);
      assert.match(markdown, /auth-workflow-refresh queue\.csv batch\.json/);
      assert.match(powershell, /Type LOGIN to open manual login browser/);
      assert.match(powershell, /auth login --profile/);
      assert.match(powershell, /Blocked cross-domain: login_domain_mismatch:other\.example->target\.example/);
      assert.doesNotMatch(powershell, /src\/cli\.js scout/);
      assert.doesNotMatch(powershell, /src\/cli\.js run-plan/);
      assert.doesNotMatch(powershell, /--execute/);
      assert.equal(summary.files.markdown.endsWith('operator-test.md'), true);
      assert.equal(existsSync(written.markdown), true);
      assert.equal(existsSync(written.powershell), true);
      assert.equal(existsSync(written.summary), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('auth workflow refresh', () => {
  it('refreshes status, next-login tasks, and auth-rescout plan without executing commands', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const batch = join(dir, 'auth-login-batch-001.csv');
      const authDir = join(dir, 'auth');
      const outputDir = join(dir, 'out');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'saved.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      const headers = 'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes';
      const savedRow = '1,P0,270,saved,Saved,saved.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,saved,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,https://saved.example/login,https://saved.example,,,,,,,,test,auth_signal,';
      const missingRow = '2,P0,260,missing,Missing,missing.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,missing,node src/cli.js auth login --profile "missing" --url "https://missing.example/login",node src/cli.js scout "https://missing.example/submit" --auth-profile "missing",https://missing.example/submit,https://missing.example/login,https://missing.example,,,,,,,,test,auth_signal,';
      writeFileSync(queue, [headers, savedRow, missingRow].join('\n'));
      writeFileSync(batch, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P0,saved,Saved,saved.example,free,low,saved,auth/saved.storage-state.json,manual_login_required,https://saved.example/login,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",status,node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,manual',
        '2,P0,missing,Missing,missing.example,free,low,missing,auth/missing.storage-state.json,manual_login_required,https://missing.example/login,node src/cli.js auth login --profile "missing" --url "https://missing.example/login",status,node src/cli.js scout "https://missing.example/submit" --auth-profile "missing",https://missing.example/submit,manual',
      ].join('\n'));

      const report = buildAuthWorkflowRefresh(queue, [batch], {
        authDir,
        nextLimit: 1,
        rescoutLimit: 5,
      });
      const written = writeAuthWorkflowRefresh(report, {
        outputDir,
        nextName: 'auth-login-next-test',
        summaryName: 'auth-workflow-refresh-test',
      });
      const summary = JSON.parse(readFileSync(written.summary, 'utf-8'));

      assert.equal(report.constraints.no_real_submission, true);
      assert.equal(report.constraints.no_browser_launch, true);
      assert.equal(report.constraints.no_network_access_required, true);
      assert.equal(report.constraints.no_command_execution, true);
      assert.equal(report.summary.status.source_rows, 2);
      assert.equal(report.summary.status.auth_profiles_found, 1);
      assert.equal(report.summary.status.auth_profiles_missing, 1);
      assert.equal(report.summary.next_login.task_rows, 1);
      assert.equal(report.next_login.tasks[0].target_id, 'missing');
      assert.equal(report.summary.auth_rescout.queued_rows, 1);
      assert.equal(report.auth_rescout.targets[0].id, 'saved');
      assert.equal(existsSync(join(outputDir, 'auth-login-status-batch-001.json')), true);
      assert.equal(existsSync(join(outputDir, 'auth-login-status-batch-001.csv')), true);
      assert.equal(existsSync(written.next_login.output), true);
      assert.equal(existsSync(written.next_login.csv_output), true);
      assert.equal(existsSync(written.auth_rescout), true);
      assert.equal(summary.summary.status.auth_profiles_found, 1);
      assert.equal(summary.files.next_login.csv_output.endsWith('auth-login-next-test.csv'), true);
      assert.equal(summary.files.summary.endsWith('auth-workflow-refresh-test.json'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters stale auth workflow targets whose registry mode is no longer assisted', () => {
    const dir = tempDir();
    try {
      const queue = join(dir, 'auth-login-rescout-queue.csv');
      const batch = join(dir, 'auth-login-batch-001.csv');
      const registry = join(dir, 'registry.yaml');
      const authDir = join(dir, 'auth');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, 'saved.storage-state.json'), JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(registry, `
version: 1
targets:
  - id: saved
    name: Saved
    domain: saved.example
    submit_url: https://saved.example/submit
    pricing: free
    submission:
      mode: assisted
  - id: stale-skip
    name: Stale Skip
    domain: stale.example
    submit_url: https://stale.example/submit
    pricing: paid
    submission:
      mode: skip
`);
      const headers = 'rank,priority,priority_score,target_id,name,domain,mode,status,pricing,risk,lang,manual_bucket,automation_after_human,submission_policy,safety_blockers,recommended_next_step,auth_profile,auth_login_command,auth_scout_command,submit_url,final_url,root_url,last_scouted_at,last_submitted_at,form_count,field_count,required_fields,unmapped_required_fields,submit_button_count,source,reason,notes';
      const savedRow = '1,P0,270,saved,Saved,saved.example,assisted,auth_required,free,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,saved,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,https://saved.example/login,https://saved.example,,,,,,,,test,auth_signal,';
      const staleRow = '2,P0,260,stale-skip,Stale Skip,stale.example,assisted,auth_required,paid,low,en,manual_login_then_rescout,rescout_after_saved_login_profile,no_real_submission_from_pack,auth_or_oauth_required,login,stale-skip,node src/cli.js auth login --profile "stale-skip" --url "https://stale.example/login",node src/cli.js scout "https://stale.example/submit" --auth-profile "stale-skip",https://stale.example/submit,https://stale.example/login,https://stale.example,,,,,,,,test,auth_signal,';
      writeFileSync(queue, [headers, savedRow, staleRow].join('\n'));
      writeFileSync(batch, [
        'order,priority,target_id,name,domain,pricing,risk,auth_profile,auth_state_path,status,login_url,auth_login_command,auth_status_command,auth_scout_command,submit_url,manual_login_safety_policy',
        '1,P0,saved,Saved,saved.example,free,low,saved,auth/saved.storage-state.json,manual_login_required,https://saved.example/login,node src/cli.js auth login --profile "saved" --url "https://saved.example/login",status,node src/cli.js scout "https://saved.example/submit" --auth-profile "saved",https://saved.example/submit,manual',
        '2,P0,stale-skip,Stale Skip,stale.example,paid,low,stale-skip,auth/stale-skip.storage-state.json,manual_login_required,https://stale.example/login,node src/cli.js auth login --profile "stale-skip" --url "https://stale.example/login",status,node src/cli.js scout "https://stale.example/submit" --auth-profile "stale-skip",https://stale.example/submit,manual',
      ].join('\n'));

      const report = buildAuthWorkflowRefresh(queue, [batch], {
        registry,
        registryFilter: true,
        authDir,
        nextLimit: 10,
        rescoutLimit: 10,
      });

      assert.equal(report.next_login.tasks.length, 0);
      assert.equal(report.next_login.excluded.some(row => row.target_id === 'stale-skip' && row.exclusion_reason === 'drop_non_assisted_registry_target'), true);
      assert.equal(report.auth_rescout.targets.length, 1);
      assert.equal(report.auth_rescout.targets[0].id, 'saved');
      assert.equal(report.auth_rescout.excluded.some(row => row.target_id === 'stale-skip' && row.exclusion_reason === 'registry_mode_not_assisted:skip'), true);
      assert.equal(report.summary.by_batch[0].by_status.blocked_registry_filtered, 1);
      assert.equal(report.summary.auth_rescout.by_exclusion_reason['registry_mode_not_assisted:skip'], 1);
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

  it('excludes previously submitted targets unless explicitly included', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: submitted
    name: Submitted
    domain: submitted.example
    submit_url: https://submitted.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
      last_submitted_at: 2026-05-22T00:00:00.000Z
    quality:
      risk: low
  - id: fresh
    name: Fresh
    domain: fresh.example
    submit_url: https://fresh.example/submit
    pricing: free
    submission:
      mode: auto_safe
      status: mapped
      last_submitted_at: null
    quality:
      risk: low
`);

      const defaultPlan = buildSubmissionPlan({ registry, freeOnly: true, mode: 'auto_safe', limit: 10 });
      const includeSubmittedPlan = buildSubmissionPlan({
        registry,
        freeOnly: true,
        mode: 'auto_safe',
        includeSubmitted: true,
        limit: 10,
      });

      assert.deepEqual(defaultPlan.targets.map(target => target.id), ['fresh']);
      assert.deepEqual(includeSubmittedPlan.targets.map(target => target.id), ['submitted', 'fresh']);
      assert.equal(defaultPlan.excluded.find(target => target.id === 'submitted').last_submitted_at, '2026-05-22T00:00:00.000Z');
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

  it('can explicitly include already scouted targets for retry passes', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: retry
    submit_url: https://retry.example/submit
    pricing: free
    submission:
      mode: needs_scout
      status: retry_after_browser_fix
    technical:
      last_scouted_at: 2026-05-22T00:00:00.000Z
    quality:
      risk: unknown
  - id: fresh
    submit_url: https://fresh.example/submit
    pricing: free
    submission:
      mode: needs_scout
    technical:
      last_scouted_at: null
    quality:
      risk: unknown
`);

      const strict = buildScoutQueuePlan({ registry, modes: 'needs_scout', limit: 10 });
      const retry = buildScoutQueuePlan({
        registry,
        modes: 'needs_scout',
        includeScouted: true,
        limit: 10,
      });

      assert.deepEqual(strict.targets.map(target => target.id), ['fresh']);
      assert.deepEqual(retry.targets.map(target => target.id), ['retry', 'fresh']);
      assert.equal(retry.constraints.include_scouted, true);
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
