import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  authMetaPath,
  authProfileStatus,
  authStatePath,
  clearAuthProfile,
  configWithAuthProfile,
  listAuthProfiles,
  requireAuthProfile,
} from '../src/auth/session.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'backlink-pilot-auth-'));
}

describe('auth session profiles', () => {
  it('uses sanitized profile paths under the auth directory', () => {
    const path = authStatePath('SaaS Hub/Main', 'playwright/.auth');
    assert.equal(path, join('playwright/.auth', 'saas-hub-main.storage-state.json'));
  });

  it('reports, lists, requires, and clears saved profiles', () => {
    const dir = tempDir();
    try {
      const state = authStatePath('demo', dir);
      const meta = authMetaPath('demo', dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(state, JSON.stringify({ cookies: [], origins: [] }));
      writeFileSync(meta, JSON.stringify({ login_url: 'https://demo.example/login' }));

      const status = authProfileStatus('demo', { authDir: dir });
      assert.equal(status.exists, true);
      assert.equal(status.meta.login_url, 'https://demo.example/login');
      assert.equal(requireAuthProfile('demo', { authDir: dir }).exists, true);
      assert.deepEqual(listAuthProfiles({ authDir: dir }).map(profile => profile.profile), ['demo']);

      clearAuthProfile('demo', { authDir: dir });
      assert.equal(existsSync(state), false);
      assert.equal(existsSync(meta), false);
      assert.throws(() => requireAuthProfile('demo', { authDir: dir }), /Auth profile not found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('injects saved profiles as Playwright-only browser config', () => {
    const dir = tempDir();
    try {
      const state = authStatePath('demo', dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(state, JSON.stringify({ cookies: [], origins: [] }));

      const config = configWithAuthProfile(
        { browser: { engine: 'bb', headless: true } },
        'demo',
        { authDir: dir }
      );

      assert.equal(config._engine, 'playwright');
      assert.equal(config.browser.engine, 'playwright');
      assert.equal(config._authProfile, 'demo');
      assert.equal(config._authStatePath, state);
      assert.throws(
        () => configWithAuthProfile({}, 'demo', { authDir: dir, engine: 'bb' }),
        /requires Playwright/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
