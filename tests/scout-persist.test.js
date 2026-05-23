import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import { mapField, mapFormFields } from '../src/scout/field-mapper.js';
import { productValueForField } from '../src/scout/field-mapper.js';
import {
  applyScoutFailureToTarget,
  applyScoutResultToTarget,
  resolveScoutClassification,
  saveScoutResult,
  scoutFailureResult,
  sanitizeScoutForms,
  scoutResultPath,
  updateRegistryWithScoutFailure,
  updateRegistryWithScoutResult,
} from '../src/scout/persist.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-scout-'));
}

describe('scout field mapper', () => {
  it('maps common product submission fields', () => {
    assert.equal(mapField({ name: 'tool_name' }), 'product.name');
    assert.equal(mapField({ placeholder: 'Website URL' }), 'product.url');
    assert.equal(mapField({ aria_label: 'Contact email' }), 'product.email');
    assert.equal(mapField({ name: 'short_description' }), 'product.description');
    assert.equal(mapField({ name: 'category' }), 'product.category');
  });

  it('adds mapped_to to form fields without overwriting explicit mappings', () => {
    const forms = mapFormFields([
      {
        fields: [
          { name: 'tool_name' },
          { name: 'custom', mapped_to: 'product.tags' },
        ],
      },
    ]);

    assert.equal(forms[0].fields[0].mapped_to, 'product.name');
    assert.equal(forms[0].fields[1].mapped_to, 'product.tags');
  });

  it('resolves product values for mapped fields', () => {
    const product = {
      name: 'Demo',
      url: 'https://demo.example',
      utm_url: 'https://demo.example?utm_source=x',
      email: 'hello@demo.example',
      long_description: 'Long description',
      categories: ['AI'],
      features: ['fast', 'private'],
      pricing: 'free',
    };

    assert.equal(productValueForField(product, 'product.name'), 'Demo');
    assert.equal(productValueForField(product, 'product.url'), 'https://demo.example?utm_source=x');
    assert.equal(productValueForField(product, 'product.description'), 'Long description');
    assert.equal(productValueForField(product, 'product.category'), 'AI');
    assert.equal(productValueForField(product, 'product.tags'), 'fast, private');
    assert.equal(productValueForField(product, 'product.pricing'), 'free');
  });
});

describe('scout persistence', () => {
  it('writes structured scout results to disk', () => {
    const dir = tempDir();
    try {
      const path = scoutResultPath('Example Target', dir);
      saveScoutResult({ target_id: 'Example Target', classification: { mode: 'auto_safe' } }, path);
      assert.equal(existsSync(path), true);
      assert.equal(JSON.parse(readFileSync(path, 'utf-8')).classification.mode, 'auto_safe');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies scout classification to a target record', () => {
    const target = {
      id: 'example',
      submit_url: 'https://example.com/submit',
      technical: { auth: 'unknown' },
      submission: { mode: 'auto_candidate', status: 'new' },
    };
    const updated = applyScoutResultToTarget(target, {
      checked_at: '2026-05-21T00:00:00.000Z',
      final_url: 'https://example.com/submit',
      reachable: true,
      signals: { login_required: false, oauth_available: false, captcha: false },
      forms: [
        {
          fields: [
            { required: true, mapped_to: 'product.name' },
            { required: true, mapped_to: 'product.url' },
            { required: true, mapped_to: 'product.description' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
      classification: {
        mode: 'auto_safe',
        status: 'mapped',
        reasons: ['form_mapped_no_auth_no_captcha'],
      },
    });

    assert.equal(updated.technical.auth, 'none');
    assert.equal(updated.technical.captcha, 'none');
    assert.equal(updated.submission.mode, 'auto_safe');
    assert.equal(updated.submission.status, 'mapped');
  });

  it('keeps non-required fields non-required after bb-browser scout persistence', () => {
    const updated = applyScoutResultToTarget({
      id: 'example',
      submit_url: 'https://example.com/submit',
      technical: { auth: 'unknown' },
      submission: { mode: 'auto_candidate', status: 'new' },
    }, {
      checked_at: '2026-05-21T00:00:00.000Z',
      final_url: 'https://example.com/submit',
      reachable: true,
      signals: { login_required: false, oauth_available: false, captcha: false },
      forms: [
        {
          fields: [
            { type: 'text', name: 'name', required: false, mapped_to: 'product.name' },
            { type: 'url', name: 'url', required: false, mapped_to: 'product.url' },
            { type: 'textarea', name: 'description', required: false, mapped_to: 'product.description' },
          ],
          submit_buttons: [{ text: 'Submit', selector: 'button[type="submit"]' }],
        },
      ],
      classification: {
        mode: 'auto_safe',
        status: 'mapped',
        reasons: ['form_mapped_no_auth_no_captcha'],
      },
    });

    assert.equal(updated.submission.mode, 'auto_safe');
    assert.equal(updated.forms[0].fields.some(field => field.required), false);
  });

  it('recomputes scout classification before applying registry updates', () => {
    const target = {
      id: 'example',
      submit_url: 'https://example.com/submit',
      technical: { auth: 'unknown', captcha: 'unknown', reachable: 'unknown' },
      submission: { mode: 'needs_scout', status: 'new' },
    };

    const updated = applyScoutResultToTarget(target, {
      checked_at: '2026-05-21T00:00:00.000Z',
      final_url: 'https://example.com/submit',
      reachable: true,
      signals: { login_required: false, oauth_available: false, captcha: true },
      forms: [
        {
          fields: [
            { required: true, mapped_to: 'product.name' },
            { required: true, mapped_to: 'product.url' },
            { required: true, mapped_to: 'product.description' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
      classification: {
        mode: 'auto_safe',
        status: 'mapped',
        reasons: ['provided_untrusted'],
      },
    });

    assert.equal(updated.submission.mode, 'assisted');
    assert.equal(updated.submission.status, 'captcha_required');
    assert.equal(updated.technical.captcha, 'required');
    assert.equal(updated.source_meta.scout_classification_mismatch, true);
    assert.equal(updated.source_meta.scout_classification_provided.mode, 'auto_safe');
    assert.equal(updated.source_meta.scout_classification_computed.mode, 'assisted');
    assert.match(updated.submission.reason, /classification_mismatch:auto_safe->assisted/);
  });

  it('allows a provided scout classification to be more conservative than computed evidence', () => {
    const resolved = resolveScoutClassification({
      reachable: true,
      http_status: 200,
      signals: { login_required: false, oauth_available: false, captcha: false },
      forms: [
        {
          fields: [
            { required: true, mapped_to: 'product.name' },
            { required: true, mapped_to: 'product.url' },
            { required: true, mapped_to: 'product.description' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
      classification: {
        mode: 'assisted',
        status: 'manual_review_requested',
        reasons: ['reviewer_kept_manual'],
      },
    });

    assert.equal(resolved.classification.mode, 'assisted');
    assert.equal(resolved.source, 'provided_conservative');
    assert.equal(resolved.mismatch, true);
    assert.match(resolved.classification.reasons.join('; '), /classification_mismatch:assisted->auto_safe/);
  });

  it('preserves explicit blocker classifications when recomputation only sees missing forms', () => {
    const resolved = resolveScoutClassification({
      reachable: true,
      http_status: 200,
      signals: { login_required: false, oauth_available: false, captcha: false },
      forms: [],
      classification: {
        mode: 'assisted',
        status: 'captcha_required',
        confidence: 0.85,
        reasons: ['captcha_signal'],
      },
    });

    assert.equal(resolved.classification.mode, 'assisted');
    assert.equal(resolved.classification.status, 'captcha_required');
    assert.equal(resolved.source, 'provided_explicit_blocker');
    assert.match(resolved.classification.reasons.join('; '), /classification_mismatch:assisted->needs_review/);
  });

  it('sanitizes bb-browser remote null field values before registry persistence', () => {
    const remoteNull = `{
  "type": "object",
  "subtype": "null",
  "value": null
}`;
    const forms = sanitizeScoutForms([
      {
        fields: [
          {
            tag: 'textarea',
            type: remoteNull,
            name: 'description',
            id: remoteNull,
            placeholder: remoteNull,
            aria_label: remoteNull,
            selector: `textarea[id="${remoteNull}"]`,
          },
        ],
        submit_buttons: [
          {
            tag: 'input',
            type: 'submit',
            name: remoteNull,
            selector: `input[id="${remoteNull}"]`,
          },
        ],
      },
    ]);

    assert.equal(forms[0].fields[0].type, '');
    assert.equal(forms[0].fields[0].id, '');
    assert.equal(forms[0].fields[0].placeholder, '');
    assert.equal(forms[0].fields[0].selector, '');
    assert.equal(forms[0].submit_buttons[0].name, '');
    assert.equal(forms[0].submit_buttons[0].selector, '');
  });

  it('updates a persisted registry by target id', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: example
    submit_url: https://example.com/submit
    technical:
      auth: unknown
      captcha: unknown
      reachable: unknown
    submission:
      mode: auto_candidate
      status: new
`);

      updateRegistryWithScoutResult({
        target_id: 'example',
        checked_at: '2026-05-21T00:00:00.000Z',
        final_url: 'https://example.com/submit',
        reachable: true,
        signals: { login_required: false, oauth_available: false, captcha: false },
        forms: [
          {
            fields: [
              { required: true, mapped_to: 'product.name' },
              { required: true, mapped_to: 'product.url' },
              { required: true, mapped_to: 'product.description' },
            ],
            submit_buttons: [{ text: 'Submit' }],
          },
        ],
        classification: { mode: 'auto_safe', status: 'mapped', reasons: ['ok'] },
      }, { registry });

      const parsed = parse(readFileSync(registry, 'utf-8'));
      assert.equal(parsed.targets[0].submission.mode, 'auto_safe');
      assert.equal(parsed.targets[0].technical.reachable, 'yes');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('conservatively records target-level scout failures without making them executable', () => {
    const updated = applyScoutFailureToTarget({
      id: 'dead',
      submit_url: 'https://dead.example/submit',
      technical: { auth: 'unknown', captcha: 'unknown', reachable: 'unknown' },
      submission: { mode: 'auto_candidate', status: 'new' },
    }, new Error('page.goto: net::ERR_NAME_NOT_RESOLVED at https://dead.example/submit'));

    assert.equal(updated.submission.mode, 'skip');
    assert.equal(updated.submission.status, 'dead');
    assert.equal(updated.technical.reachable, 'no');
    assert.match(updated.submission.reason, /scout_failed_dns/);
  });

  it('does not convert infrastructure scout failures into target registry evidence', () => {
    const result = scoutFailureResult({
      id: 'example',
      submit_url: 'https://example.com/submit',
    }, new Error("browserType.launch: Executable doesn't exist. Please run npx playwright install"));

    assert.equal(result, null);
  });

  it('updates a persisted registry with target-level scout failures', () => {
    const dir = tempDir();
    try {
      const registry = join(dir, 'registry.yaml');
      writeFileSync(registry, `
version: 1
targets:
  - id: timeout
    submit_url: https://timeout.example/submit
    technical:
      auth: unknown
      captcha: unknown
      reachable: unknown
    submission:
      mode: auto_candidate
      status: new
`);

      const updated = updateRegistryWithScoutFailure({
        id: 'timeout',
        submit_url: 'https://timeout.example/submit',
      }, new Error('page.goto: net::ERR_CONNECTION_TIMED_OUT'), { registry });

      const parsed = parse(readFileSync(registry, 'utf-8'));
      assert.equal(updated.submission.mode, 'needs_review');
      assert.equal(parsed.targets[0].submission.status, 'scout_failed');
      assert.equal(parsed.targets[0].technical.last_scouted_at.length > 0, true);
      assert.match(parsed.targets[0].technical.last_scout_error, /ERR_CONNECTION_TIMED_OUT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
