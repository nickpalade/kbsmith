// Shared helpers for the kbsmith hook scripts. Node built-ins only, Windows + macOS + Linux.
// A hook must never break a session: every caller wraps its work in try/catch and exits 0.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONFIG_FILE = join('.kbsmith', 'config.json');

export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  mode: 'project', // "project" = one repo with its own kb/; "hub" = kb/ + projects/<name>/
  kbDir: 'kb',
  stopHook: 'block-once', // "block-once" | "remind" | "off"
  retryGuard: true,
  team: { enabled: false },
  ignore: [],
});

export const IGNORED_DIRS = new Set([
  '.git', '.kbsmith', '.claude', 'people', 'node_modules', '.venv', 'venv', 'env', '__pycache__',
  '.pytest_cache', '.mypy_cache', '.ruff_cache', '.ipynb_checkpoints', '.tox', 'dist', 'build',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', 'cache', 'out', 'target', 'coverage',
  'test-results', 'playwright-report', 'worktrees', '.idea', '.vscode', 'vendor', 'Pods',
  'DerivedData', '.gradle', 'inbox',
]);

export const IGNORED_FILES = new Set([
  'settings.local.json', '.DS_Store', 'Thumbs.db', 'desktop.ini',
]);

export const MAX_FILES = 20000;
export const GRACE_MS = 2000; // a status page written in the same second as the last edit counts as fresh

// Git Bash / MSYS hand out "/c/Users/..."; Node on Windows needs "C:/Users/...".
export function toNativePath(dir) {
  const msys = /^\/([a-zA-Z])(\/|$)(.*)$/.exec(dir || '');
  return process.platform === 'win32' && msys ? `${msys[1].toUpperCase()}:/${msys[3]}` : dir;
}

// Walk up from `start` until a folder holding .kbsmith/config.json is found.
export function findRoot(start) {
  let dir = resolve(toNativePath(start || process.cwd()));
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function loadConfig(root) {
  const raw = readJson(readFileSync(join(root, CONFIG_FILE), 'utf8'), {});
  return { ...DEFAULT_CONFIG, ...raw };
}

export function readStdin() {
  try {
    return readJson(readFileSync(0, 'utf8') || '{}', {});
  } catch {
    return {};
  }
}

// Newest modification time below `dir`, skipping build output, dependencies and the KB itself.
export function newestMtime(dir, extraIgnored = []) {
  const skip = new Set([...IGNORED_DIRS, ...extraIgnored]);
  let newest = { time: 0, file: null };
  let seen = 0;
  const stack = [dir];
  while (stack.length && seen < MAX_FILES) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) stack.push(full);
        continue;
      }
      if (IGNORED_FILES.has(entry.name)) continue;
      seen += 1;
      try {
        const time = statSync(full).mtimeMs;
        if (time > newest.time) newest = { time, file: full };
      } catch {
        // file vanished mid-walk; ignore
      }
    }
  }
  return newest;
}

export function mtimeOf(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

export const fmt = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : 'never');

export const today = () => new Date().toISOString().slice(0, 10);
