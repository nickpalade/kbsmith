// kbsmith team: turns a KB into a shared team KB (private GitHub repo, synced by hooks).
// It changes local files only. Creating the repo and inviting people are printed as gh commands,
// because they are outward-facing: Claude runs them only after the human says yes.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readJsonFile, writeJsonFile } from './fsutil.mjs';
import { installHooks, TEAM_HOOKS } from './hooks.mjs';

// Append-only logs: with merge=union two people appending at once both survive a merge.
export const UNION_FILES = ['kb/04-timeline.txt', 'kb/11-decisions.txt', 'kb/25-mistakes-and-lessons.txt'];

export function withAttributes(existing) {
  const lines = existing.split(/\r?\n/);
  const missing = UNION_FILES.map((f) => `${f} merge=union`).filter((l) => !lines.includes(l));
  if (!missing.length) return existing;
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  return `${existing}${sep}${missing.join('\n')}\n`;
}

export function enableTeam(config, autoSync) {
  const team = { branch: 'main', allowedPaths: ['kb/', 'people/', 'docs/'], staleDays: 30, staleDirs: ['kb/'], ...(config.team || {}) };
  return { ...config, team: { ...team, enabled: true, autoSync: Boolean(autoSync) } };
}

function enable(target, flags) {
  const configFile = join(target, '.kbsmith', 'config.json');
  if (!existsSync(configFile)) throw new Error('no .kbsmith/config.json here: run npx kbsmith init first');
  writeJsonFile(configFile, enableTeam(readJsonFile(configFile, {}), flags['auto-sync']));
  const attrFile = join(target, '.gitattributes');
  const before = existsSync(attrFile) ? readFileSync(attrFile, 'utf8') : '';
  const after = withAttributes(before);
  if (after !== before) writeFileSync(attrFile, after);
  installHooks(target, TEAM_HOOKS, 120); // network work: pull/push need more than 15 s
  const peopleFile = join(target, 'people', 'people.json');
  if (!existsSync(peopleFile)) writeJsonFile(peopleFile, {});

  const owner = flags.owner || '<owner>';
  const repo = flags.repo || '<repo>';
  const log = (s) => console.log(s);
  log('kbsmith team: enabled (config, .gitattributes, team hooks, people/people.json).');
  log(`  auto-sync on Stop: ${flags['auto-sync'] ? 'ON for everyone' : 'off (per person: .claude/settings.local.json {"env":{"TEAM_AUTOSYNC":"1"}})'}`);
  log('');
  log('Register yourself:  node .kbsmith/scripts/team/join.mjs <id> "<Full Name>" "<role>"');
  log('Commit:             git add -A && git commit -m "docs: team KB"   (check git status first)');
  log(`Create the repo:    gh repo create ${owner}/${repo} --private --source . --remote origin --push`);
  log(`Invite a teammate:  gh api -X PUT repos/${owner}/${repo}/collaborators/<login> -f permission=push`);
  log('Teammate:           gh repo clone <owner>/<repo>, then the join command above. Full guide: docs/TEAM.md');
  return 0;
}

function join_(target, positional) {
  const script = join(target, '.kbsmith', 'scripts', 'team', 'join.mjs');
  const r = spawnSync(process.execPath, [script, ...positional], { cwd: target, stdio: 'inherit' });
  return r.status ?? 1;
}

export function team(sub, positional, flags) {
  const target = resolve(flags.dir || process.cwd());
  if (sub === 'enable') return enable(target, flags);
  if (sub === 'join') return join_(target, positional);
  console.error('usage: kbsmith team enable [--owner X --repo Y] [--auto-sync]\n       kbsmith team join <id> "<Full Name>" ["<role>"]');
  return 1;
}
