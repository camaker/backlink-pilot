import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'rebrowser-playwright';
import { slugify } from '../targets/normalize.js';

export const DEFAULT_AUTH_DIR = 'playwright/.auth';

function nowIso() {
  return new Date().toISOString();
}

function safeProfile(profile = 'default') {
  return slugify(profile || 'default', 'default');
}

export function authStatePath(profile = 'default', authDir = DEFAULT_AUTH_DIR) {
  return join(authDir, `${safeProfile(profile)}.storage-state.json`);
}

export function authMetaPath(profile = 'default', authDir = DEFAULT_AUTH_DIR) {
  return join(authDir, `${safeProfile(profile)}.meta.json`);
}

export function authProfileStatus(profile = 'default', opts = {}) {
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const statePath = authStatePath(profile, authDir);
  const metaPath = authMetaPath(profile, authDir);
  const exists = existsSync(statePath);
  const stat = exists ? statSync(statePath) : null;
  let meta = {};
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    } catch {
      meta = {};
    }
  }

  return {
    profile: safeProfile(profile),
    exists,
    path: statePath,
    meta_path: metaPath,
    updated_at: stat ? stat.mtime.toISOString() : '',
    size_bytes: stat ? stat.size : 0,
    meta,
  };
}

export function requireAuthProfile(profile = 'default', opts = {}) {
  const status = authProfileStatus(profile, opts);
  if (!status.exists) {
    throw new Error(`Auth profile not found: ${status.profile}. Run: node src/cli.js auth login --profile ${status.profile} --url <login-url>`);
  }
  return status;
}

export function configWithAuthProfile(config = {}, profile = 'default', opts = {}) {
  if (opts.engine && opts.engine !== 'playwright') {
    throw new Error(`Auth profile storageState requires Playwright. Received engine: ${opts.engine}`);
  }

  const status = requireAuthProfile(profile, opts);
  return {
    ...config,
    _engine: 'playwright',
    _authProfile: status.profile,
    _authStatePath: status.path,
    browser: {
      ...(config.browser || {}),
      engine: 'playwright',
    },
  };
}

export function listAuthProfiles(opts = {}) {
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  if (!existsSync(authDir)) return [];
  return readdirSync(authDir)
    .filter(file => file.endsWith('.storage-state.json'))
    .sort()
    .map(file => file.replace(/\.storage-state\.json$/, ''))
    .map(profile => authProfileStatus(profile, { authDir }));
}

export function clearAuthProfile(profile = 'default', opts = {}) {
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const status = authProfileStatus(profile, { authDir });
  for (const path of [status.path, status.meta_path]) {
    if (existsSync(path)) rmSync(path, { force: true });
  }
  return { ...status, cleared: true };
}

export async function loginAuthProfile(opts = {}) {
  if (!opts.url) throw new Error('login URL is required');

  const profile = safeProfile(opts.profile || 'default');
  const authDir = opts.authDir || DEFAULT_AUTH_DIR;
  const statePath = authStatePath(profile, authDir);
  const metaPath = authMetaPath(profile, authDir);
  mkdirSync(dirname(statePath), { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  const page = await context.newPage();

  try {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: Number(opts.timeout || 60000) });
    console.log('Manual login required in the opened browser window.');
    console.log('Complete login, 2FA, or CAPTCHA yourself. This tool will not bypass them.');
    console.log(`After login, return here and press Enter to save profile "${profile}".`);
    await waitForEnter(opts.input || process.stdin);
    await context.storageState({ path: statePath });
    const meta = {
      profile,
      login_url: opts.url,
      storage_state_path: statePath,
      browser_engine: 'playwright',
      saved_at: nowIso(),
      note: 'Created after manual browser login. No CAPTCHA, 2FA, or paywall bypass was attempted.',
    };
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    return authProfileStatus(profile, { authDir });
  } finally {
    await browser.close();
  }
}

function waitForEnter(input) {
  if (!input || typeof input.once !== 'function' || input.isTTY === false) {
    throw new Error('Interactive stdin is required. Run auth login in a terminal, complete manual login, then press Enter.');
  }

  return new Promise(resolve => {
    input.resume?.();
    input.once('data', () => resolve());
  });
}
