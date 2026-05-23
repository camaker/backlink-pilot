const LOGIN_RE = /sign\s?in|log\s?in|login|create account|register|oauth|continue with google|continue with github|登录|注册/i;
const CAPTCHA_RE = /captcha|recaptcha|hcaptcha|turnstile|cloudflare|verify you are human|robot|验证码|人机验证/i;
const PAYMENT_RE = /stripe|checkout|payment|pricing|buy now|\$\s?\d+|paid listing|付费|付款|购买/i;
const SUCCESS_RE = /thank you|thanks for submitting|submitted|pending review|we received|审核|提交成功|成功提交|已经成功提交|站点已经成功提交|已提交|感谢您的支持/i;
const BROWSER_ERROR_FINAL_URL_RE = /^(about:blank|chrome-error:\/\/chromewebdata\/?)/i;

const PRODUCT_FIELD_KEYS = new Set([
  'product.name',
  'product.url',
  'product.description',
  'product.email',
]);

const REQUIRED_AUTO_SAFE_FIELD_KEYS = new Set([
  'product.name',
  'product.url',
  'product.description',
]);

const PRODUCT_OPTIONAL_FIELD_KEYS = new Set([
  'product.category',
  'product.tags',
  'product.pricing',
  'product.logo',
  'product.screenshot',
  'product.video_url',
]);

function text(value) {
  return String(value || '');
}

export function isBrowserErrorFinalUrl(value = '') {
  return BROWSER_ERROR_FINAL_URL_RE.test(String(value || '').trim());
}

function fieldText(field = {}) {
  return [
    field.type,
    field.name,
    field.id,
    field.placeholder,
    field.aria_label,
    field.label,
  ].filter(Boolean).join(' ');
}

function isInfrastructureField(field = {}) {
  const type = String(field.type || '').toLowerCase();
  const text = fieldText(field);
  if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(type)) return true;
  return /csrf|nonce|token|captcha|hash|honeypot|_wp_http_referer|action|limit|agree|terms|search/i.test(text);
}

function isFileUploadField(field = {}) {
  return String(field.type || '').toLowerCase() === 'file';
}

function requiredFields(forms = []) {
  return forms.flatMap(form =>
    (form.fields || []).filter(field => field.required && !isInfrastructureField(field))
  );
}

function mappedRequiredFields(forms = []) {
  return requiredFields(forms).filter(field =>
    PRODUCT_FIELD_KEYS.has(field.mapped_to) || PRODUCT_OPTIONAL_FIELD_KEYS.has(field.mapped_to)
  );
}

function mappedFieldSet(forms = []) {
  return new Set(
    forms
      .flatMap(form => form.fields || [])
      .map(field => field.mapped_to)
      .filter(Boolean)
  );
}

function missingAutoSafeFields(forms = []) {
  const mapped = mappedFieldSet(forms);
  return [...REQUIRED_AUTO_SAFE_FIELD_KEYS].filter(key => !mapped.has(key));
}

function hasFileUploadRequirement(forms = []) {
  return requiredFields(forms).some(isFileUploadField);
}

function hasCaptchaField(forms = []) {
  return forms.some(form =>
    (form.fields || []).some(field => CAPTCHA_RE.test(fieldText(field)))
  );
}

function hasReciprocalRequirement(forms = []) {
  return forms.some(form =>
    (form.fields || []).some(field => /recipr|recpr|reciprocal|back[-_\s]?link|link[-_\s]?back|return[-_\s]?link|交换链接|反向链接|友情链接/i.test(fieldText(field)))
  );
}

function hasSubmitButton(forms = []) {
  return forms.some(form => Array.isArray(form.submit_buttons) && form.submit_buttons.length > 0);
}

export function classifyScoutResult(result = {}) {
  const body = `${text(result.title)} ${text(result.body_text)} ${text(result.final_url)}`;
  const signals = result.signals || {};
  const forms = result.forms || [];
  const reasons = [];

  if (result.reachable === false || [404, 410].includes(Number(result.http_status))) {
    return { mode: 'skip', status: 'dead', confidence: 1, reasons: ['unreachable_or_404'] };
  }

  if ([401, 403, 429].includes(Number(result.http_status))) {
    return { mode: 'needs_review', status: 'access_blocked', confidence: 0.7, reasons: [`http_${result.http_status}`] };
  }

  if (Number(result.http_status) >= 500) {
    return { mode: 'skip', status: 'dead', confidence: 0.9, reasons: [`http_${result.http_status}`] };
  }

  if (isBrowserErrorFinalUrl(result.final_url)) {
    return {
      mode: 'needs_scout',
      status: 'browser_error',
      confidence: 0.5,
      reasons: ['browser_error_final_url'],
    };
  }

  if (signals.payment || PAYMENT_RE.test(body)) {
    return { mode: 'skip', status: 'paywalled', confidence: 0.8, reasons: ['payment_signal'] };
  }

  if (signals.captcha || CAPTCHA_RE.test(body)) {
    return { mode: 'assisted', status: 'captcha_required', confidence: 0.85, reasons: ['captcha_signal'] };
  }

  if (hasCaptchaField(forms)) {
    return { mode: 'assisted', status: 'captcha_required', confidence: 0.85, reasons: ['captcha_field'] };
  }

  if (signals.login_required || signals.oauth_available || LOGIN_RE.test(body)) {
    return { mode: 'assisted', status: 'auth_required', confidence: 0.8, reasons: ['auth_signal'] };
  }

  if (!forms.length) {
    return { mode: 'needs_review', status: 'no_form_detected', confidence: 0.55, reasons: ['no_form_detected'] };
  }

  if (hasFileUploadRequirement(forms)) {
    return {
      mode: 'assisted',
      status: 'asset_upload_required',
      confidence: 0.75,
      reasons: ['file_upload_required'],
    };
  }

  if (hasReciprocalRequirement(forms)) {
    return {
      mode: 'assisted',
      status: 'reciprocal_required',
      confidence: 0.75,
      reasons: ['reciprocal_field'],
    };
  }

  const required = requiredFields(forms);
  const mapped = mappedRequiredFields(forms);
  if (required.length && mapped.length < required.length) {
    reasons.push(`required_fields_unmapped:${required.length - mapped.length}`);
  }

  if (!hasSubmitButton(forms)) {
    reasons.push('submit_button_missing');
  }

  const missingAutoSafe = missingAutoSafeFields(forms);
  if (missingAutoSafe.length) {
    reasons.push(`auto_safe_fields_missing:${missingAutoSafe.join(',')}`);
  }

  if (!reasons.length) {
    return {
      mode: 'auto_safe',
      status: 'mapped',
      confidence: required.length ? 0.9 : 0.75,
      reasons: ['form_mapped_no_auth_no_captcha'],
    };
  }

  return {
    mode: 'needs_scout',
    status: 'unsupported_form',
    confidence: 0.6,
    reasons,
  };
}

export function classifySubmissionResult(result = {}) {
  const body = `${text(result.final_url)} ${text(result.confirmation)} ${text(result.body_text)}`;

  if (result.error) return { status: 'retryable_failed', reasons: [result.error] };
  if (/already submitted|duplicate|already exists|已存在|重复/i.test(body)) {
    return { status: 'duplicate', reasons: ['duplicate_signal'] };
  }
  if (LOGIN_RE.test(body)) return { status: 'auth_required', reasons: ['auth_signal_after_submit'] };
  if (CAPTCHA_RE.test(body)) return { status: 'captcha_required', reasons: ['captcha_signal_after_submit'] };
  if (SUCCESS_RE.test(body)) return { status: 'pending_review', reasons: ['success_confirmation_detected'] };

  return { status: 'submitted_unverified', reasons: ['no_confirmation_detected'] };
}
