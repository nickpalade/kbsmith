#!/usr/bin/env node
// .kbsmith/scripts/team/join.mjs
// Registers the person at this machine in people/people.json and creates people/<id>/profile.txt
// (their name, role and preferences, which Claude keeps adding to over time).
// Usage: node .kbsmith/scripts/team/join.mjs <id> "<Full Name>" ["<role>"]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { findRoot, git, exec, readPeople } from './team-lib.mjs';

export const ID_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

export function profileText(name, role, date) {
  return [
    `USER PROFILE: ${name} (learned over time; same layout as kb/08-user.txt)`,
    '',
    'NAME AND ROLE',
    `Name: ${name}`,
    `Role: ${role || '(fill in)'}`,
    'Experience: (fill in)',
    '',
    'HOW THEY LIKE TO WORK',
    '',
    'PREFERENCES (tools, style, wording)',
    '',
    'CORRECTIONS (YYYY-MM-DD | what Claude did | what they want instead)',
    '',
    'GOALS AND CONTEXT',
    '',
    `LOG`,
    `${date}  Joined the team KB.`,
    '',
  ].join('\n');
}

export function addPerson(people, id, entry) {
  const old = people[id];
  if (!old) return { ...people, [id]: entry };
  const union = (key) => [...new Set([...(old[key] || []), ...(entry[key] || [])])];
  return {
    ...people,
    [id]: {
      ...old,
      name: entry.name || old.name,
      role: entry.role || old.role, // never wipe a role with an empty one
      github: union('github'),
      git_names: union('git_names'),
      os_users: union('os_users'),
      hosts: union('hosts'),
    },
  };
}

function main() {
  const [id, name, role] = process.argv.slice(2);
  if (!id || !ID_PATTERN.test(id) || !name) {
    console.error('usage: node .kbsmith/scripts/team/join.mjs <id: lowercase, e.g. sam> "<Full Name>" ["<role>"]');
    return 1;
  }
  const root = findRoot(process.cwd());
  if (!root) { console.error('not inside a git repo'); return 1; }
  const gitName = git(['config', 'user.name'], { cwd: root }).out;
  const github = exec('gh', ['api', 'user', '--jq', '.login'], { cwd: root, timeout: 5000 }).out;
  const entry = { name, role: role || '', github: github ? [github] : [], git_names: gitName ? [gitName] : [], os_users: [], hosts: [] };
  const file = join(root, 'people', 'people.json');
  mkdirSync(join(root, 'people', id), { recursive: true });
  const next = addPerson(readPeople(root), id, entry);
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  const profile = join(root, 'people', id, 'profile.txt');
  if (!existsSync(profile)) writeFileSync(profile, profileText(name, role, new Date().toISOString().slice(0, 10)));
  console.log(`Registered ${name} (${id}) on ${hostname()}: git "${gitName || '-'}", GitHub "${github || '-'}".`);
  console.log(`Next: git add people && git commit -m "docs: add ${id}" && git push`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = main();
