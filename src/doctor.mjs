// kbsmith doctor: checks the install and prints one line per check with a fix.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJsonFile } from './fsutil.mjs';
import { SOLO_HOOKS, TEAM_HOOKS } from './hooks.mjs';
import { userSettingsDir } from './tune.mjs';

const ok = (name, detail) => ({ status: 'ok', name, detail });
const warn = (name, detail) => ({ status: 'warn', name, detail });
const fail = (name, detail) => ({ status: 'FAIL', name, detail });

const has = (cmd, args = ['--version']) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true }).status === 0;

const hookCommands = (settings) =>
  Object.values(settings.hooks || {}).flat().flatMap((entry) => (entry.hooks || []).map((h) => h.command));

export async function checks(target) {
  const results = [];
  const major = Number(process.versions.node.split('.')[0]);
  results.push(major >= 18 ? ok('node', process.versions.node) : fail('node', `${process.versions.node}: need 18+`));
  results.push(has('git') ? ok('git', 'found') : fail('git', 'install git'));
  results.push(has('gh') ? ok('gh', 'found (team mode ready)') : warn('gh', 'not found: only needed for team mode (https://cli.github.com)'));

  const configFile = join(target, '.kbsmith', 'config.json');
  if (!existsSync(configFile)) return [...results, fail('config', 'no .kbsmith/config.json: run npx kbsmith init')];
  const config = readJsonFile(configFile, {});
  results.push(ok('config', `${config.mode || 'project'} mode${config.team && config.team.enabled ? ', team on' : ''}`));

  const commands = hookCommands(readJsonFile(join(target, '.claude', 'settings.json'), {}));
  const missing = Object.values(SOLO_HOOKS).filter((c) => !commands.includes(c));
  results.push(missing.length ? fail('hooks', `missing ${missing.length}: re-run npx kbsmith init`) : ok('hooks', 'SessionStart, UserPromptSubmit, Stop'));
  if (config.team && config.team.enabled) {
    const teamMissing = Object.values(TEAM_HOOKS).filter((c) => !commands.includes(c));
    results.push(teamMissing.length ? fail('team hooks', 'run npx kbsmith team enable') : ok('team hooks', 'installed'));
  }

  const claudeMd = join(target, 'CLAUDE.md');
  const imported = existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').includes('@kb/AGENTS.md');
  results.push(imported ? ok('CLAUDE.md', 'imports kb/AGENTS.md') : fail('CLAUDE.md', 'add the line @kb/AGENTS.md'));

  const { lint } = await import(pathToFileURL(join(target, '.kbsmith', 'scripts', 'kb-lint.mjs')).href);
  const { errors, warnings } = lint(target, config);
  results.push(errors.length ? fail('kb-lint', errors.slice(0, 3).join(' | ')) : ok('kb-lint', `0 errors, ${warnings.length} warning(s)`));

  const user = readJsonFile(join(userSettingsDir(), 'settings.json'), {});
  const perms = user.permissions || {};
  results.push(perms.defaultMode ? ok('permission mode', perms.defaultMode) : warn('permission mode', 'not set: npx kbsmith tune --profile <trusted|balanced|careful>'));
  results.push((perms.deny || []).length ? ok('deny list', `${perms.deny.length} rules`) : warn('deny list', 'empty: npx kbsmith tune adds one'));
  if (process.env.MAX_THINKING_TOKENS || (user.env || {}).MAX_THINKING_TOKENS) {
    results.push(warn('MAX_THINKING_TOKENS', 'ignored by adaptive-reasoning models; use /effort instead'));
  }
  return results;
}

export async function doctor(targetArg) {
  const target = resolve(targetArg || process.cwd());
  const results = await checks(target);
  for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(16)} ${r.detail}`);
  return results.some((r) => r.status === 'FAIL') ? 1 : 0;
}
