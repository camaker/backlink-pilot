import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { slugify } from '../targets/normalize.js';

function nowIso() {
  return new Date().toISOString();
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function targetArtifactDir(rootDir, target = {}) {
  const order = Number.isFinite(Number(target.order))
    ? String(target.order).padStart(3, '0')
    : 'target';
  const slug = slugify(target.id || target.name || target.domain || 'target');
  return join(rootDir, `${order}-${slug}`);
}

export function writeArtifactJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify({
    captured_at: nowIso(),
    ...value,
  }, null, 2), 'utf-8');
  return path;
}

export function writeArtifactText(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, String(value || ''), 'utf-8');
  return path;
}
