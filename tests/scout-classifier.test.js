import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyScoutResult, classifySubmissionResult } from '../src/scout/classifier.js';

describe('scout classifier', () => {
  it('upgrades mapped simple forms to auto_safe only when auth/captcha/payment signals are absent', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      title: 'Submit your tool',
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
    });

    assert.equal(result.mode, 'auto_safe');
    assert.equal(result.status, 'mapped');
  });

  it('classifies captcha, auth, payment, and dead pages conservatively', () => {
    assert.equal(classifyScoutResult({ body_text: 'protected by reCAPTCHA' }).mode, 'assisted');
    assert.equal(classifyScoutResult({ final_url: '/login', body_text: 'Sign in' }).status, 'auth_required');
    assert.equal(classifyScoutResult({ body_text: 'Paid listing $29' }).status, 'paywalled');
    assert.equal(classifyScoutResult({ reachable: false }).status, 'dead');
  });

  it('does not trust browser error pages as discovered forms', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      final_url: 'chrome-error://chromewebdata/',
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
    });

    assert.equal(result.mode, 'needs_scout');
    assert.equal(result.status, 'browser_error');
  });

  it('does not auto-submit when required fields are unmapped', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { required: true, mapped_to: 'product.name' },
            { required: true, mapped_to: '' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'needs_scout');
    assert.match(result.reasons[0], /required_fields_unmapped/);
  });

  it('does not auto-submit newsletter-only forms without product submission fields', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'email', name: 'email-address', required: true, mapped_to: 'product.email' },
          ],
          submit_buttons: [{ text: 'Subscribe' }],
        },
      ],
    });

    assert.equal(result.mode, 'needs_scout');
    assert.equal(result.status, 'unsupported_form');
    assert.ok(result.reasons.some(reason => reason.startsWith('auto_safe_fields_missing:')));
  });

  it('allows optional required fields when the core product submission fields are mapped', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'text', name: 'name', required: true, mapped_to: 'product.name' },
            { type: 'url', name: 'url', required: true, mapped_to: 'product.url' },
            { type: 'textarea', name: 'description', required: true, mapped_to: 'product.description' },
            { type: 'email', name: 'email', required: true, mapped_to: 'product.email' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'auto_safe');
  });

  it('ignores infrastructure fields when deciding whether a form is auto safe', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'hidden', name: '_wpnonce', required: true, mapped_to: '' },
            { type: 'checkbox', name: 'terms', required: true, mapped_to: '' },
            { type: 'submit', name: 'submit', required: true, mapped_to: '' },
            { type: 'text', name: 'name', required: false, mapped_to: 'product.name' },
            { type: 'url', name: 'url', required: false, mapped_to: 'product.url' },
            { type: 'textarea', name: 'description', required: false, mapped_to: 'product.description' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'auto_safe');
    assert.equal(result.status, 'mapped');
  });

  it('keeps required file uploads assisted', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'text', name: 'name', required: true, mapped_to: 'product.name' },
            { type: 'url', name: 'url', required: true, mapped_to: 'product.url' },
            { type: 'textarea', name: 'description', required: true, mapped_to: 'product.description' },
            { type: 'file', name: 'logo', required: true, mapped_to: 'product.logo' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'assisted');
    assert.equal(result.status, 'asset_upload_required');
  });

  it('does not auto-submit access-blocked pages', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 403,
      forms: [],
    });

    assert.equal(result.mode, 'needs_review');
    assert.equal(result.status, 'access_blocked');
    assert.deepEqual(result.reasons, ['http_403']);
  });

  it('keeps captcha fields assisted even when they are not marked required', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'text', name: 'title', mapped_to: 'product.name' },
            { type: 'url', name: 'url', mapped_to: 'product.url' },
            { type: 'textarea', name: 'description', mapped_to: 'product.description' },
            { type: 'text', name: 'CAPTCHA', mapped_to: '' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'assisted');
    assert.equal(result.status, 'captcha_required');
  });

  it('keeps reciprocal link requirements assisted and non-automatic', () => {
    const result = classifyScoutResult({
      reachable: true,
      http_status: 200,
      forms: [
        {
          fields: [
            { type: 'text', name: 'TITLE', mapped_to: 'product.name' },
            { type: 'url', name: 'URL', mapped_to: 'product.url' },
            { type: 'textarea', name: 'DESCRIPTION', mapped_to: 'product.description' },
            { type: 'text', name: 'RECPR_URL', mapped_to: '' },
          ],
          submit_buttons: [{ text: 'Submit' }],
        },
      ],
    });

    assert.equal(result.mode, 'assisted');
    assert.equal(result.status, 'reciprocal_required');
  });
});

describe('submission result classifier', () => {
  it('separates pending review from unverified submission', () => {
    assert.equal(
      classifySubmissionResult({ confirmation: 'Thanks for submitting. Pending review.' }).status,
      'pending_review'
    );
    assert.equal(
      classifySubmissionResult({ body_text: '恭喜！您的站点已经成功提交，感谢您的支持。' }).status,
      'pending_review'
    );
    assert.equal(classifySubmissionResult({ confirmation: 'Clicked submit' }).status, 'submitted_unverified');
  });

  it('detects duplicate and post-submit auth/captcha signals', () => {
    assert.equal(classifySubmissionResult({ body_text: 'Already submitted' }).status, 'duplicate');
    assert.equal(classifySubmissionResult({ body_text: 'Please login' }).status, 'auth_required');
    assert.equal(classifySubmissionResult({ body_text: 'captcha required' }).status, 'captcha_required');
  });
});
