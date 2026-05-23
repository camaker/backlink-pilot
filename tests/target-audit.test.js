import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { auditRegistry, auditTargets, formatAuditReport } from '../src/targets/audit.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-target-audit-'));
}

function safeAutoTarget(overrides = {}) {
  return {
    id: 'safe',
    name: 'Safe Directory',
    domain: 'safe.example',
    submit_url: 'https://safe.example/submit',
    pricing: 'free',
    quality: { risk: 'low' },
    technical: {
      last_scouted_at: '2026-05-22T00:00:00.000Z',
      auth: 'none',
      captcha: 'none',
      reachable: 'yes',
    },
    forms: [
      {
        fields: [
          { mapped_to: 'product.name', selector: 'input[name="name"]', required: true },
          { mapped_to: 'product.url', selector: 'input[name="url"]', required: true },
          { mapped_to: 'product.description', selector: 'textarea[name="description"]', required: true },
        ],
        submit_buttons: [{ selector: 'button[type="submit"]' }],
      },
    ],
    submission: {
      mode: 'auto_safe',
      status: 'mapped',
      reason: 'form_mapped_no_auth_no_captcha',
    },
    ...overrides,
  };
}

describe('target registry audit', () => {
  it('passes a fully evidenced auto_safe target', () => {
    const report = auditTargets([safeAutoTarget()]);

    assert.equal(report.ok, true);
    assert.equal(report.blockers.length, 0);
    assert.equal(report.warnings.length, 0);
  });

  it('blocks auto_safe targets without scout and form evidence', () => {
    const report = auditTargets([
      safeAutoTarget({
        technical: { auth: 'unknown', captcha: 'unknown', reachable: 'unknown' },
        forms: [],
        submission: { mode: 'auto_safe', status: 'new' },
      }),
    ]);
    const codes = report.blockers.map(item => item.code);

    assert.equal(report.ok, false);
    assert.ok(codes.includes('auto_safe_missing_scout_evidence'));
    assert.ok(codes.includes('auto_safe_not_mapped'));
    assert.ok(codes.includes('auto_safe_auth_not_none'));
    assert.ok(codes.includes('auto_safe_captcha_not_none'));
    assert.ok(codes.includes('auto_safe_reachable_not_yes'));
    assert.ok(codes.includes('auto_safe_missing_forms'));
    assert.ok(codes.includes('auto_safe_missing_required_mappings'));
    assert.ok(codes.includes('auto_safe_missing_submit_button'));
  });

  it('blocks runnable paid, high-risk, and strategic manual domains', () => {
    const report = auditTargets([
      safeAutoTarget({ id: 'paid', pricing: 'paid' }),
      safeAutoTarget({ id: 'risk', quality: { risk: 'high' } }),
      safeAutoTarget({ id: 'ph', domain: 'producthunt.com', submit_url: 'https://www.producthunt.com/posts/new' }),
    ]);
    const codes = report.blockers.map(item => item.code);

    assert.ok(codes.includes('runnable_paid_target'));
    assert.ok(codes.includes('runnable_high_risk_target'));
    assert.ok(codes.includes('runnable_manual_strategic_domain'));
  });

  it('blocks runnable targets when persisted scout final_url crosses target and submit domains', () => {
    const report = auditTargets([
      safeAutoTarget({
        id: 'cross',
        domain: 'target.example',
        submit_url: 'https://target.example/submit',
        technical: {
          last_scouted_at: '2026-05-22T00:00:00.000Z',
          auth: 'required',
          captcha: 'none',
          reachable: 'yes',
          final_url: 'https://other.example/login',
        },
        submission: {
          mode: 'assisted',
          status: 'auth_required',
          reason: 'auth_signal',
        },
      }),
    ]);

    assert.equal(report.ok, false);
    assert.ok(report.blockers.some(item =>
      item.code === 'runnable_final_url_domain_mismatch' &&
      /final_url_domain_mismatch:other\.example->target\.example/.test(item.message)
    ));
  });

  it('warns for unscouted auto candidates and blocks duplicate runnable submit URLs', () => {
    const report = auditTargets([
      {
        id: 'candidate',
        domain: 'candidate.example',
        submit_url: 'https://candidate.example/submit',
        submission: { mode: 'auto_candidate' },
        technical: { last_scouted_at: null },
      },
      safeAutoTarget({ id: 'a', submit_url: 'https://dup.example/submit?ref=one' }),
      safeAutoTarget({ id: 'b', submit_url: 'https://www.dup.example/submit?utm_source=x' }),
    ]);

    assert.ok(report.warnings.some(item => item.code === 'auto_candidate_needs_scout'));
    assert.ok(report.blockers.some(item => item.code === 'duplicate_submit_url'));
  });

  it('loads and formats an audit report from a registry file', () => {
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
    submission:
      mode: auto_candidate
    technical:
      last_scouted_at: null
`);

      const report = auditRegistry(registry);
      const formatted = formatAuditReport(report);

      assert.equal(report.registry, registry);
      assert.equal(report.warnings.length, 1);
      assert.match(formatted, /Target audit: ready/);
      assert.match(formatted, /auto_candidate_needs_scout/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
