import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inferTargetMode } from '../src/targets/classify.js';
import { normalizeUrl } from '../src/targets/normalize.js';
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
