import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, utimesSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, withImport, withIgnores, planCopy } from '../src/init.mjs';
import { mergeSettings, diffSettings, parseArgs, fillPlaceholders } from '../src/fsutil.mjs';
import { buildPatch, applyPatch } from '../src/tune.mjs';
import { withHooks, SOLO_HOOKS } from '../src/hooks.mjs';
import { withAttributes, enableTeam } from '../src/team.mjs';
import { lint } from '../template/.kbsmith/scripts/kb-lint.mjs';
import { sessionLines, stopMessage, userLine } from '../template/.kbsmith/scripts/kb-hook.mjs';
import { loadConfig } from '../template/.kbsmith/scripts/lib.mjs';

const quiet = (fn) => {
  const log = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = log; }
};
const fresh = (flags = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'kbsmith-test-'));
  quiet(() => init(dir, flags));
  return dir;
};

test('init installs the KB, hooks and CLAUDE.md import', () => {
  const dir = fresh();
  for (const f of ['kb/AGENTS.md', 'kb/00-INDEX.txt', 'kb/08-user.txt', '.kbsmith/config.json', '.kbsmith/SETUP.md', '.claude/commands/remember.md']) {
    assert.ok(existsSync(join(dir, f)), f);
  }
  assert.ok(!existsSync(join(dir, 'kb/projects')), 'hub-only files are skipped in project mode');
  assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /@kb\/AGENTS\.md/);
  const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.hooks.Stop.length, 1);
  assert.doesNotMatch(readFileSync(join(dir, 'kb/04-timeline.txt'), 'utf8'), /\{\{DATE\}\}/);
});

test('init never overwrites and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kbsmith-test-'));
  mkdirSync(join(dir, 'kb'));
  writeFileSync(join(dir, 'kb/01-about.txt'), 'MINE');
  writeFileSync(join(dir, 'CLAUDE.md'), '# My project\n');
  quiet(() => init(dir));
  quiet(() => init(dir));
  assert.equal(readFileSync(join(dir, 'kb/01-about.txt'), 'utf8'), 'MINE');
  const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.equal(claude.match(/@kb\/AGENTS\.md/g).length, 1);
  assert.ok(claude.startsWith('# My project'));
  const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.hooks.SessionStart.length, 1);
});

test('hub mode copies the project template', () => {
  const dir = fresh({ mode: 'hub' });
  assert.ok(existsSync(join(dir, 'kb/projects/_TEMPLATE.txt')));
  assert.equal(JSON.parse(readFileSync(join(dir, '.kbsmith/config.json'), 'utf8')).mode, 'hub');
});

test('fresh install lints with zero errors', () => {
  const dir = fresh();
  const { errors } = lint(dir, loadConfig(dir));
  assert.deepEqual(errors, []);
});

test('kb-lint catches a secret and a missing index line', () => {
  const dir = fresh();
  writeFileSync(join(dir, 'kb/40-notes.txt'), 'api_key = sk-abcdefghijklmnopqrstuvwxyz123456\n');
  const { errors } = lint(dir, loadConfig(dir));
  assert.ok(errors.some((e) => /looks like it contains/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /40-notes/.test(e)), errors.join('\n'));
});

test('stop hook blocks once when code is newer than the status page', () => {
  const dir = fresh();
  const config = loadConfig(dir);
  const old = new Date(Date.now() - 3600_000);
  utimesSync(join(dir, 'kb/02-status.txt'), old, old);
  writeFileSync(join(dir, 'app.js'), 'console.log(1)\n');
  assert.match(stopMessage(dir, config, { cwd: dir }), /update kb.02-status\.txt/);
  assert.equal(stopMessage(dir, config, { cwd: dir, stop_hook_active: true }), null);
  assert.equal(stopMessage(dir, { ...config, stopHook: 'off' }, { cwd: dir }), null);
});

test('user line asks for the name until it is learned', () => {
  const dir = fresh();
  const config = loadConfig(dir);
  assert.match(userLine(dir, config), /name unknown/);
  const file = join(dir, 'kb/08-user.txt');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^Name:.*$/m, 'Name: Sam (per user 2026-01-01)'));
  assert.match(userLine(dir, config), /KB USER: Sam/);
  assert.ok(sessionLines(dir, config, dir).some((l) => l.startsWith('KB USER: Sam')));
  assert.equal(userLine(dir, { ...config, team: { enabled: true } }), null);
});

test('settings merge unions arrays and diff lists only changes', () => {
  const merged = mergeSettings({ permissions: { deny: ['a'] }, model: 'x' }, { permissions: { deny: ['a', 'b'] }, _comment: 'drop' });
  assert.deepEqual(merged, { permissions: { deny: ['a', 'b'] }, model: 'x' });
  assert.deepEqual(diffSettings({ permissions: { deny: ['a'] } }, merged), ['+ permissions.deny: "b"', '+ model = "x"']);
});

test('tune profiles: trusted bypasses with a deny list, careful removes the bypass flag', () => {
  const trusted = buildPatch('trusted', [], 'x');
  assert.equal(trusted.permissions.defaultMode, 'bypassPermissions');
  assert.ok(trusted.permissions.deny.includes('Bash(rm -rf *)'));
  const careful = applyPatch({ ...trusted }, buildPatch('careful', [], 'x'), 'careful');
  assert.equal(careful.permissions.defaultMode, 'default');
  assert.equal(careful.skipDangerousModePermissionPrompt, undefined);
  assert.throws(() => buildPatch('yolo', [], 'x'), /unknown profile/);
  assert.equal(buildPatch('balanced', ['subagent-haiku'], 'x').env.CLAUDE_CODE_SUBAGENT_MODEL, 'haiku');
});

test('pure helpers', () => {
  assert.equal(withImport('@kb/AGENTS.md\n'), '@kb/AGENTS.md\n');
  assert.match(withIgnores('node_modules\n', '# c\ninbox/*\nnode_modules\n'), /# kbsmith\ninbox\/\*\n$/);
  assert.deepEqual(planCopy(['kb/a.txt', 'kb/projects/_TEMPLATE.txt', 'gitignore.kbsmith'], 'project'), ['kb/a.txt']);
  const once = withHooks({}, SOLO_HOOKS);
  assert.deepEqual(withHooks(once, SOLO_HOOKS), once);
  assert.equal(withAttributes(withAttributes('')).split('\n').filter(Boolean).length, 3);
  assert.equal(enableTeam({ team: { enabled: false, staleDays: 7 } }, false).team.staleDays, 7);
  assert.deepEqual(parseArgs(['x', '--mode', 'hub', '--yes', '--extras=a,b']), { positional: ['x'], flags: { mode: 'hub', yes: true, extras: 'a,b' } });
  assert.equal(fillPlaceholders('{{A}}-{{A}}', { A: '1' }), '1-1');
});

test('SETUP.md in the template matches the root copy', () => {
  const root = new URL('../SETUP.md', import.meta.url);
  const copy = new URL('../template/.kbsmith/SETUP.md', import.meta.url);
  assert.equal(readFileSync(copy, 'utf8'), readFileSync(root, 'utf8'));
});
