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
});

describe('submission result classifier', () => {
  it('separates pending review from unverified submission', () => {
    assert.equal(
      classifySubmissionResult({ confirmation: 'Thanks for submitting. Pending review.' }).status,
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
