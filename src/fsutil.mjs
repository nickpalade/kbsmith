// Small file helpers shared by the kbsmith CLI. Node 18+, no dependencies.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_DIR = join(PKG_ROOT, 'template');
export const PROFILES_DIR = join(PKG_ROOT, 'profiles');

export const today = () => new Date().toISOString().slice(0, 10);

export function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Fix it by hand first; nothing was changed.`);
  }
}

export function writeJsonFile(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// Every file below dir, as paths relative to dir (forward slashes).
export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

export function fillPlaceholders(text, values) {
  return Object.entries(values).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(value), text);
}

const TEXT_EXT = /\.(txt|md|json|mjs|js)$/;

// Copies src -> dest without overwriting. Returns 'created' | 'skipped'.
export function copyIfMissing(src, dest, values) {
  if (existsSync(dest)) return 'skipped';
  mkdirSync(dirname(dest), { recursive: true });
  if (values && TEXT_EXT.test(src)) writeFileSync(dest, fillPlaceholders(readFileSync(src, 'utf8'), values));
  else copyFileSync(src, dest);
  return 'created';
}

// Deep merge for settings: objects merge, arrays union (order kept), scalars from `patch` win.
export function mergeSettings(base, patch) {
  if (Array.isArray(base) && Array.isArray(patch)) return [...new Set([...base, ...patch])];
  if (isObject(base) && isObject(patch)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (key === '_comment') continue;
      out[key] = key in base ? mergeSettings(base[key], value) : stripComments(value);
    }
    return out;
  }
  return stripComments(patch);
}

function stripComments(value) {
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '_comment').map(([k, v]) => [k, stripComments(v)]));
}

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Flat "a.b.c = value" lines for the parts of `after` that differ from `before`.
export function diffSettings(before, after, prefix = '') {
  const lines = [];
  for (const [key, value] of Object.entries(after)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const old = before ? before[key] : undefined;
    if (isObject(value) && isObject(old)) lines.push(...diffSettings(old, value, path));
    else if (Array.isArray(value) && Array.isArray(old)) {
      value.filter((v) => !old.includes(v)).forEach((v) => lines.push(`+ ${path}: ${JSON.stringify(v)}`));
    } else if (JSON.stringify(old) !== JSON.stringify(value)) {
      lines.push(`${old === undefined ? '+' : '~'} ${path} = ${JSON.stringify(value)}${old === undefined ? '' : ` (was ${JSON.stringify(old)})`}`);
    }
  }
  return lines;
}

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const [key, inline] = arg.slice(2).split('=');
    if (inline !== undefined) flags[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { flags[key] = argv[i + 1]; i += 1; }
    else flags[key] = true;
  }
  return { flags, positional };
}
