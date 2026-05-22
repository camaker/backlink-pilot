// bb.js — bb-browser execution layer
// Wraps bb-browser CLI as subprocess calls, exposes Playwright-like page API

import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

let _bbTimeout = 30000;
let _resolvedBbCommand = null;

function setBbTimeout(ms) {
  if (ms && ms > 0) _bbTimeout = ms;
}

function globalBbCliPath() {
  try {
    const npmRoot = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    const cli = join(npmRoot, 'bb-browser', 'dist', 'cli.js');
    return existsSync(cli) ? cli : '';
  } catch {
    return '';
  }
}

function pathBbCliPath() {
  try {
    const where = execFileSync('where', ['bb-browser'], {
      encoding: 'utf-8',
      timeout: 10000,
    })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .find(path => !path.toLowerCase().endsWith('.cmd') && !path.toLowerCase().endsWith('.ps1'));

    if (!where) return '';
    const cli = join(dirname(where), 'node_modules', 'bb-browser', 'dist', 'cli.js');
    return existsSync(cli) ? cli : '';
  } catch {
    return '';
  }
}

function resolveBbCommand() {
  if (_resolvedBbCommand) return _resolvedBbCommand;
  if (process.platform === 'win32') {
    const cli = globalBbCliPath() || pathBbCliPath();
    if (cli) {
      _resolvedBbCommand = { command: process.execPath, prefixArgs: [cli] };
      return _resolvedBbCommand;
    }
  }
  _resolvedBbCommand = { command: 'bb-browser', prefixArgs: [] };
  return _resolvedBbCommand;
}

export function bbCommand(args = []) {
  const resolved = resolveBbCommand();
  return {
    command: resolved.command,
    args: [...resolved.prefixArgs, ...args],
  };
}

export function execBb(args = [], opts = {}) {
  const command = bbCommand(args);
  return execFileSync(command.command, command.args, {
    encoding: 'utf-8',
    timeout: opts.timeout || _bbTimeout,
    maxBuffer: opts.maxBuffer || 16 * 1024 * 1024,
  });
}

export function normalizeBbOutput(raw) {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return text;

  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.type === 'undefined') return '';
    if (parsed && parsed.subtype === 'null' && parsed.value === null) return '';
    if (Object.prototype.hasOwnProperty.call(parsed || {}, 'value')) {
      return parsed.value === null || parsed.value === undefined
        ? ''
        : String(parsed.value);
    }
  } catch {
    // Non-JSON page content can legitimately begin/end with braces.
  }

  return text;
}

function bb(...args) {
  try {
    const output = execBb(args);
    return args[0] === 'eval' ? normalizeBbOutput(output) : output.trim();
  } catch (e) {
    const msg = e.stderr?.trim() || e.message;
    if (msg.includes('ECONNREFUSED') || msg.includes('No page target') || msg.includes('connect')) {
      throw new Error(
        `bb-browser cannot connect to Chrome. Make sure it is running:\n` +
        `  1. Run: bb-browser status\n` +
        `  2. If no Chrome is running: bb-browser open about:blank\n` +
        `  3. Try again`
      );
    }
    if (msg.includes('超时') || msg.includes('timeout') || msg.includes('ETIMEDOUT') || e.killed) {
      throw new Error(
        `bb-browser command timed out (${args.join(' ')}). Chrome may be unresponsive.\n` +
        `  Try: kill the Chrome process and restart with bb-browser open about:blank`
      );
    }
    throw new Error(`bb-browser ${args[0]}: ${msg}`);
  }
}

function tabSuffix(tabId = '') {
  const text = String(tabId || '').trim();
  return text.length > 4 ? text.slice(-4).toLowerCase() : text;
}

function tryBb(...args) {
  try {
    return bb(...args);
  } catch {
    return null;
  }
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/**
 * Check if bb-browser is available on the system
 */
export function isBbAvailable() {
  try {
    execBb(['--version'], { timeout: 10000 });
    return true;
  } catch { return false; }
}

export function ensureBbRunning() {
  if (!isBbAvailable()) return false;
  if (tryBb('tab', 'list') !== null) return true; // health check uses bb('tab', 'list')

  try {
    execBb(['daemon', 'start']);
  } catch {
    try {
      execBb(['open', 'about:blank']);
    } catch {
      return false;
    }
  }

  return tryBb('tab', 'list') !== null;
}

/**
 * Playwright-like page wrapper around bb-browser CLI
 */
export class BbPage {
  constructor(config = {}) {
    this._config = config;
    this._tabId = null;
    this._closeTabIds = [];
    this._openedTabs = []; // track tabs for cleanup

    // Apply timeout from config
    if (config.browser?.timeout) setBbTimeout(config.browser.timeout);

    // Verify Chrome is reachable — use 'tab list' instead of 'status'
    // because 'status' can return "running" even when commands timeout
    if (!ensureBbRunning()) {
      throw new Error(
        `bb-browser Chrome is not running and could not be auto-started.\n` +
        `  Try manually: bb-browser daemon start\n` +
        `  Or: bb-browser open about:blank`
      );
    }
  }

  async goto(url, _opts = {}) {
    const result = bb('open', url, '--tab');
    // Extract tabId from output like "Tab ID: XXXX"
    const tabMatch = result.match(/Tab ID:\s*(\S+)/);
    if (tabMatch) {
      this._tabId = tabMatch[1];
      this._closeTabIds.push(tabSuffix(this._tabId));
      this._openedTabs.push(this._tabId);
    }
    await this._waitForNavigation(url, _opts);
  }

  _tabArgs(args = []) {
    return this._tabId ? [...args, '--tab', this._tabId] : args;
  }

  _bb(...args) {
    return bb(...this._tabArgs(args));
  }

  _eval(script) {
    return this._bb('eval', script);
  }

  async _waitForNavigation(targetUrl, opts = {}) {
    const timeout = Number(opts.timeout || this._config.browser?.timeout || 15000);
    const start = Date.now();
    let lastUrl = '';

    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 500));
      try {
        lastUrl = this.url();
        if (lastUrl && lastUrl !== 'about:blank') return;
      } catch {}
    }

    // Keep going with the loaded tab. Callers classify about:blank/chrome-error conservatively.
    if (!lastUrl || lastUrl === 'about:blank') {
      console.warn(`⚠️  bb-browser navigation did not settle for ${targetUrl}`);
    }
  }

  /**
   * Close all tabs opened during this session
   */
  async cleanup() {
    for (const tabId of [...this._closeTabIds].reverse()) {
      try { bb('tab', 'close', tabId); } catch {}
    }
    this._openedTabs = [];
    this._closeTabIds = [];
  }

  async fill(selectorOrRef, value) {
    if (selectorOrRef.startsWith('@')) {
      this._bb('fill', selectorOrRef, value);
    } else {
      // CSS selector — fill directly via DOM events for scout-persisted selectors.
      const exists = this._eval(
        `!!document.querySelector('${escapeJs(selectorOrRef)}')`);
      if (exists !== 'true') throw new Error(`Element not found: ${selectorOrRef}`);
      await this.evalFill(selectorOrRef, value);
    }
  }

  async click(selectorOrRef) {
    if (selectorOrRef.startsWith('@')) {
      this._bb('click', selectorOrRef);
    } else {
      // CSS selector — use evalClick with full user-event simulation
      // This dispatches mousedown/mouseup/click to work with React/Vue components
      await this.evalClickReal(selectorOrRef);
    }
  }

  async type(selectorOrRef, text, _opts = {}) {
    // bb-browser fill handles typing in real browser
    await this.fill(selectorOrRef, text);
  }

  async textContent(selector) {
    return this._eval(`document.querySelector('${escapeJs(selector)}')?.textContent || ''`);
  }

  async content() {
    return this._eval('document.documentElement.outerHTML');
  }

  url() {
    return this._eval('window.location.href');
  }

  async screenshot(path) {
    if (path) this._bb('screenshot', path);
    else this._bb('screenshot');
  }

  /**
   * Get interactive snapshot — returns parsed accessibility tree text
   */
  async snapshot() {
    return this._bb('snapshot', '-i');
  }

  /**
   * Playwright-compatible $(selector) — returns BbElementHandle or null
   */
  async $(selector) {
    // Handle Playwright-specific :has-text() selector
    if (selector.includes(':has-text(')) {
      return this._queryHasText(selector);
    }
    const exists = this._eval(
      `!!document.querySelector('${escapeJs(selector)}')`);
    if (exists === 'true') return new BbElementHandle(this, selector);
    return null;
  }

  /**
   * Playwright-compatible locator(selector)
   */
  locator(selector) {
    return new BbLocator(this, selector);
  }

  // --- Internal helpers ---

  async _queryHasText(selector) {
    // Parse "button:has-text("Submit")" → tag=button, text=Submit
    const match = selector.match(/^(\w+):has-text\(["'](.+?)["']\)$/);
    if (!match) return null;
    const [, tag, text] = match;
    const exists = this._eval(
      `!!Array.from(document.querySelectorAll('${tag}')).find(el => el.textContent.includes('${escapeJs(text)}'))`);
    if (exists === 'true') return new BbElementHandle(this, selector, { tag, text });
    return null;
  }

  /**
   * Execute JS directly in page and fill/click by CSS selector
   */
  async evalFill(selector, value) {
    this._eval(`(() => {
      const el = document.querySelector('${escapeJs(selector)}');
      if (!el) return;
      el.focus();
      el.value = '${escapeJs(value)}';
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
    })()`);
  }

  async evalClick(selector) {
    this._eval(`document.querySelector('${escapeJs(selector)}')?.click()`);
  }

  /**
   * Click with full user-event simulation (mousedown → mouseup → click)
   * Required for React/Vue components that don't respond to .click()
   */
  async evalClickReal(selector) {
    this._eval(`(() => {
      const el = document.querySelector('${escapeJs(selector)}');
      if (!el) return;
      el.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true}));
      el.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true}));
      el.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
      if (el.type === 'radio' || el.type === 'checkbox') {
        el.checked = el.type === 'radio' ? true : !el.checked;
        el.dispatchEvent(new Event('change', {bubbles:true}));
        el.dispatchEvent(new Event('input', {bubbles:true}));
      }
    })()`);
  }

  async evalClickByText(tag, text) {
    this._eval(`Array.from(document.querySelectorAll('${tag}')).find(el => el.textContent.includes('${escapeJs(text)}'))?.click()`);
  }
}

/**
 * Element handle wrapping bb-browser eval calls
 */
export class BbElementHandle {
  constructor(page, selector, opts = {}) {
    this._page = page;
    this._selector = selector;
    this._tag = opts.tag;
    this._text = opts.text;
    this._expression = opts.expression;
  }

  _elementExpression() {
    if (this._expression) return this._expression;
    return `document.querySelector('${escapeJs(this._selector)}')`;
  }

  locator(selector) {
    return new BbLocator(this._page, selector, {
      rootExpression: this._elementExpression(),
    });
  }

  async isVisible() {
    if (this._tag && this._text) {
      const result = this._page._config;
      return this._page._eval(
        `(() => {
          const el = Array.from(document.querySelectorAll('${this._tag}')).find(e => e.textContent.includes('${escapeJs(this._text)}'));
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })()`
      ) === 'true';
    }
    return this._page._eval(
      `(() => {
        const el = ${this._elementExpression()};
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })()`
    ) === 'true';
  }

  async textContent() {
    if (this._tag && this._text) {
      return this._page._eval(
        `Array.from(document.querySelectorAll('${this._tag}')).find(e => e.textContent.includes('${escapeJs(this._text)}'))?.textContent || ''`);
    }
    return this._page._eval(
      `(${this._elementExpression()})?.textContent || ''`);
  }

  async getAttribute(attr) {
    return this._page._eval(
      `(${this._elementExpression()})?.getAttribute('${escapeJs(attr)}') || null`);
  }

  async click() {
    if (this._tag && this._text) {
      await this._page.evalClickByText(this._tag, this._text);
    } else if (this._expression) {
      this._page._eval(`(() => {
        const el = ${this._elementExpression()};
        if (!el) return;
        el.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true}));
        el.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true}));
        el.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
        if (el.type === 'radio' || el.type === 'checkbox') {
          el.checked = el.type === 'radio' ? true : !el.checked;
          el.dispatchEvent(new Event('change', {bubbles:true}));
          el.dispatchEvent(new Event('input', {bubbles:true}));
        }
      })()`);
    } else {
      await this._page.evalClickReal(this._selector);
    }
  }

  async fill(value) {
    if (this._expression) {
      this._page._eval(`(() => {
        const el = ${this._elementExpression()};
        if (!el) return;
        el.focus();
        el.value = '${escapeJs(value)}';
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
      })()`);
      return;
    }
    await this._page.evalFill(this._selector, value);
  }

  async evaluate(fn) {
    // Simple evaluate — runs fn as string with el as argument
    return this._page._eval(
      `(${fn.toString()})(${this._elementExpression()})`);
  }
}

/**
 * Locator wrapping bb-browser eval calls
 */
export class BbLocator {
  constructor(page, selector, opts = {}) {
    this._page = page;
    this._selector = selector;
    this._rootExpression = opts.rootExpression || 'document';
  }

  _queryExpression() {
    return `${this._rootExpression}.querySelector('${escapeJs(this._selector)}')`;
  }

  _queryAllExpression() {
    return `${this._rootExpression}.querySelectorAll('${escapeJs(this._selector)}')`;
  }

  first() {
    return new BbElementHandle(this._page, this._selector, {
      expression: this._queryExpression(),
    });
  }

  async all() {
    const countStr = this._page._eval(
      `${this._queryAllExpression()}.length`);
    const count = parseInt(countStr, 10) || 0;
    return Array.from({ length: count }, (_, i) =>
      new BbElementHandle(this._page, this._selector, {
        expression: `${this._queryAllExpression()}[${i}]`,
      })
    );
  }

  async isVisible() {
    return this._page._eval(
      `(() => {
        const el = ${this._queryExpression()};
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })()`
    ) === 'true';
  }

  async fill(value) {
    await this.first().fill(value);
  }

  async click() {
    await this.first().click();
  }
}
