// .kbsmith/scripts/team/team-lib.mjs
// Shared helpers for the team-mode hooks. Node 18+, no dependencies.
// Every function returns plain values and never prints; the hooks decide what to show.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { join, resolve } from 'node:path';

export function exec(cmd, args, { cwd, timeout = 20000 } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    ok: r.status === 0,
    out: (r.stdout || '').replace(/\s+$/, ''),   // keep leading spaces: git status --porcelain needs them
    err: (r.stderr || (r.error && r.error.message) || '').trim(),
  };
}

// core.quotePath=false: non-ASCII file names come back as-is, not as "\303\251" escapes.
export const git = (args, opts = {}) => exec('git', ['-c', 'core.quotePath=false', ...args], opts);

export const firstLine = (s) => String(s || '').split('\n')[0] || 'unknown error';

export function findRoot(start) {
  const r = git(['rev-parse', '--show-toplevel'], { cwd: start, timeout: 5000 });
  return r.ok ? r.out : null;
}

const DEFAULTS = {
  enabled: false,             // set by: npx kbsmith team (or by hand in .kbsmith/config.json)
  branch: 'main',
  autoSync: false,            // opt-in: the Stop hook does nothing unless this is true
  allowedPaths: ['kb/', 'people/', 'docs/'],
  staleDays: 30,
  staleDirs: ['kb/'],
};

// The "team" section of .kbsmith/config.json is committed. TEAM_AUTOSYNC=1|0 overrides autoSync
// on one machine (put it in .claude/settings.local.json "env", which is git-ignored).
export function loadConfig(root) {
  const file = join(root, '.kbsmith', 'config.json');
  let user = {};
  try { user = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).team || {}) : {}; } catch { user = {}; }
  const cfg = { ...DEFAULTS, ...user };
  if (process.env.TEAM_AUTOSYNC === '1') cfg.autoSync = true;
  if (process.env.TEAM_AUTOSYNC === '0') cfg.autoSync = false;
  return cfg;
}

export function readPeople(root) {
  const file = join(root, 'people', 'people.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

function matchHits(person, s) {
  const hit = (list, value) => Boolean(value) && (list || []).some((v) => norm(v) === norm(value));
  const hits = [];
  if (hit(person.github, s.github)) hits.push('GitHub login');
  if (hit(person.git_names, s.git_name)) hits.push('git user.name');
  if (hit(person.os_users, s.os_user)) hits.push('OS user');
  if (hit(person.hosts, s.host)) hits.push('host name');
  return hits;
}

// Who is sitting at this machine? Returns { id, hits, signals }. id is null when unknown or tied.
export function identify(root, people) {
  const override = norm(process.env.TEAM_USER);
  if (override && people[override]) return { id: override, hits: ['TEAM_USER override'], signals: {} };
  let osUser = '';
  try { osUser = userInfo().username; } catch { osUser = process.env.USERNAME || process.env.USER || ''; }
  const signals = {
    git_name: git(['config', 'user.name'], { cwd: root, timeout: 4000 }).out,
    github: exec('gh', ['api', 'user', '--jq', '.login'], { cwd: root, timeout: 4000 }).out,
    os_user: osUser,
    host: hostname(),
  };
  const ranked = Object.entries(people)
    .map(([id, p]) => ({ id, hits: matchHits(p, signals) }))
    .filter((r) => r.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
  if (!ranked.length) return { id: null, hits: [], signals };
  if (ranked.length > 1 && ranked[1].hits.length === ranked[0].hits.length) return { id: null, hits: [], signals, tie: true };
  return { id: ranked[0].id, hits: ranked[0].hits, signals };
}

export function ownerOf(path) {
  const m = /^people\/([^/]+)\//.exec(path);
  return m ? m[1] : null;
}

// Never commit these, even if a path rule would allow them.
export const DENY_PATH_RE = /(^|\/)(\.env[^/]*|\.wa_session\/|inbox\/|tools\/|node_modules\/|\.venv\/|id_rsa[^/]*|id_ed25519[^/]*|credentials[^/]*)|\.(session|pem|key|p12|pfx|keystore)$/;

// Added-line patterns that look like credentials. Heuristics: a hit blocks the commit.
export const SECRET_RE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(password|passwd|secret|token|api[_-]?key)\b\s*[:=]\s*["']?[^\s"']{8,}/i,
];

// Changed (modified, added, deleted, untracked) files under the allowed paths.
export function changedFiles(root, paths) {
  // -z: raw paths, no quoting. A rename is "R  new\0old\0", so skip the old name.
  const parts = git(['status', '--porcelain', '-z', '--untracked-files=all', '--', ...paths], { cwd: root }).out.split('\0');
  const files = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    if (!entry) continue;
    files.push(entry.slice(3));
    if (entry[0] === 'R' || entry[0] === 'C') i += 1;
  }
  return files;
}

// Files with conflict markers (both sides of a failed merge/rebase left in the working tree).
export function conflictMarkers(root, paths) {
  const r = git(['grep', '-l', '-E', '^(<{7}|>{7})( |$)', '--', ...paths], { cwd: root });
  return r.ok ? r.out.split('\n').filter(Boolean) : [];
}

export function unmergedFiles(root) {
  return git(['diff', '--name-only', '--diff-filter=U'], { cwd: root }).out.split('\n').filter(Boolean);
}

// True while a merge, rebase or cherry-pick is half done. Do not commit or pull then.
export function operationInProgress(root) {
  for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
    const p = git(['rev-parse', '--git-path', marker], { cwd: root }).out;
    if (p && existsSync(resolve(root, p))) return marker;
  }
  return null;
}

// Secret-looking lines in the staged diff. Returns the file names that matched.
export function scanStagedDiff(root) {
  const diff = git(['diff', '--cached', '-U0', '--no-color'], { cwd: root }).out;
  const hits = new Set();
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) { file = line.split(' b/').pop(); continue; }
    if (line.startsWith('Binary files ')) { hits.add(file); continue; } // can't scan binaries: never auto-share them
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (SECRET_RE.some((re) => re.test(line))) hits.add(file);
  }
  return [...hits];
}

// Files under dirs whose last commit is older than `days`, oldest first.
export function staleFiles(root, dirs, days) {
  // One git log pass, newest first: the first time a file appears is its last commit.
  const tracked = new Set(git(['ls-files', '--', ...dirs], { cwd: root }).out.split('\n').filter(Boolean));
  const history = git(['log', '--name-only', '--format=@%ct', '--', ...dirs], { cwd: root }).out;
  const last = new Map();
  let ts = 0;
  for (const line of history.split('\n')) {
    if (line.startsWith('@')) ts = Number(line.slice(1));
    else if (line && tracked.has(line) && !last.has(line)) last.set(line, ts);
  }
  const now = Date.now() / 1000;
  const stale = [];
  for (const [f, t] of last) {
    if (t && now - t > days * 86400) stale.push({ file: f, days: Math.floor((now - t) / 86400) });
  }
  return stale.sort((a, b) => b.days - a.days);
}

// Commits on origin/<branch> that this machine has not reported yet.
// The last reported sha lives in .git/team-last-seen, which git never tracks.
export function unseenCommits(root, branch) {
  const head = git(['rev-parse', `origin/${branch}`], { cwd: root }).out;
  if (!head) return { head: '', seenFile: '', commits: [] };
  const seenFile = resolve(root, git(['rev-parse', '--git-path', 'team-last-seen'], { cwd: root }).out);
  let last = existsSync(seenFile) ? readFileSync(seenFile, 'utf8').trim() : '';
  const fmt = '--format=%h%x09%an%x09%ad%x09%s';
  let r = last ? git(['log', fmt, '--date=short', `${last}..${head}`], { cwd: root }) : { ok: false };
  if (!r.ok) r = git(['log', '-10', fmt, '--date=short', head], { cwd: root });
  return {
    head,
    seenFile,
    commits: r.out ? r.out.split('\n').map((l) => {
      const [sha, author, date, ...subject] = l.split('\t');
      return { sha, author, date, subject: subject.join('\t') };
    }) : [],
  };
}
