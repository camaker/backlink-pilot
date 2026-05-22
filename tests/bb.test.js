import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { bbCommand, isBbAvailable, normalizeBbOutput } from '../src/bb.js';

describe('bb-browser availability', () => {
  it('isBbAvailable returns boolean', () => {
    const result = isBbAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('BbPage constructor throws friendly error when Chrome not running', async () => {
    // Only test if bb-browser is installed but Chrome is not running
    if (!isBbAvailable()) {
      // bb-browser not installed — skip
      return;
    }

    const { BbPage } = await import('../src/bb.js');
    // BbPage constructor calls bb('status'), which may or may not work
    // We just verify it doesn't throw an unreadable error
    try {
      new BbPage({});
    } catch (e) {
      // Should contain user-friendly message, not raw subprocess error
      assert.match(e.message, /bb-browser|Chrome|Start it|running/i);
    }
  });
});

describe('bb timeout configuration', () => {
  it('BbPage reads timeout from config.browser.timeout', async () => {
    if (!isBbAvailable()) return;

    const { BbPage } = await import('../src/bb.js');
    // Verify construction accepts config with timeout without crashing on the timeout field
    const config = { browser: { timeout: 60000 } };
    try {
      new BbPage(config);
    } catch (e) {
      // May fail due to Chrome not running, but should NOT fail due to timeout config
      assert.doesNotMatch(e.message, /timeout.*config/i);
    }
  });
});

describe('bb output normalization', () => {
  it('converts bb-browser remote null objects to an empty string', () => {
    const output = `{
  "type": "object",
  "subtype": "null",
  "value": null
}`;

    assert.equal(normalizeBbOutput(output), '');
  });

  it('converts bb-browser undefined objects to an empty string', () => {
    assert.equal(normalizeBbOutput('{ "type": "undefined" }'), '');
  });

  it('returns primitive value fields as strings', () => {
    assert.equal(normalizeBbOutput('{ "type": "number", "value": 42 }'), '42');
  });

  it('leaves ordinary text unchanged', () => {
    assert.equal(normalizeBbOutput('hello'), 'hello');
  });
});

describe('bb command execution', () => {
  it('does not route bb-browser eval through cmd.exe on Windows', () => {
    const command = bbCommand(['eval', "(() => 'a & b')()"]);

    if (process.platform === 'win32') {
      assert.notEqual(command.command.toLowerCase(), 'cmd.exe');
      assert.ok(command.args.some(arg => String(arg).endsWith('bb-browser\\dist\\cli.js') || String(arg).endsWith('bb-browser/dist/cli.js')));
    }
    assert.equal(command.args.at(-1), "(() => 'a & b')()");
  });

  it('uses a larger output buffer for bb-browser subprocesses', () => {
    const src = readFileSync('src/bb.js', 'utf-8');
    assert.match(src, /maxBuffer:\s*opts\.maxBuffer\s*\|\|\s*16\s*\*\s*1024\s*\*\s*1024/);
  });
});
