#!/usr/bin/env node
// Keeps the knowledge base in step with the code.
//
//   node .kbsmith/scripts/kb-hook.mjs session   SessionStart: print KB status (stdout becomes context)
//   node .kbsmith/scripts/kb-hook.mjs stop      Stop: if code changed after the status page, exit 2 once
//                                               so Claude updates the KB before finishing the turn
//   node .kbsmith/scripts/kb-hook.mjs status    same as session, for humans
//
// Project mode: status page = kb/02-status.txt, code = everything outside kb/.
// Hub mode:     status page = kb/projects/<name>.txt, code = projects/<name>/.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  findRoot, loadConfig, readStdin, newestMtime, mtimeOf, fmt, GRACE_MS, toNativePath,
} from './lib.mjs';

export function statusPagePath(root, config, project) {
  return project
    ? join(root, config.kbDir, 'projects', `${project}.txt`)
    : join(root, config.kbDir, '02-status.txt');
}

// Which hub project a folder belongs to (first segment under projects/), or null.
export function hubProjectFor(root, dir) {
  if (!dir) return null;
  const full = resolve(toNativePath(dir));
  const rel = relative(join(root, 'projects'), full);
  if (!rel || rel.startsWith('..') || resolve(rel) === rel) return null;
  return rel.split(sep)[0] || null;
}

export function listHubProjects(root) {
  const dir = join(root, 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

export function projectState(root, config, project) {
  const codeDir = project ? join(root, 'projects', project) : root;
  const extraIgnored = project ? [] : [config.kbDir, 'projects', ...config.ignore];
  const page = statusPagePath(root, config, project);
  const newest = newestMtime(codeDir, extraIgnored);
  const pageTime = mtimeOf(page);
  const stale = pageTime === 0 || newest.time > pageTime + GRACE_MS;
  return { name: project || 'this repo', codeDir, page, pageTime, newest, stale };
}

function describe(root, state) {
  const changed = state.newest.file ? relative(state.codeDir, state.newest.file) : '-';
  return `${state.name}: status page ${relative(root, state.page)} updated ${fmt(state.pageTime)}, ` +
    `code changed ${fmt(state.newest.time)} (${changed}) -> ${state.stale ? 'STALE' : 'ok'}`;
}

// Reads "Name:" from the user profile so Claude knows who it works with from turn one.
export function userLine(root, config) {
  if (config.team && config.team.enabled) return null; // team/session-start.mjs prints TEAM USER instead
  const file = join(root, config.kbDir, '08-user.txt');
  if (!existsSync(file)) return null;
  const match = readFileSync(file, 'utf8').match(/^Name:\s*(.+)$/m);
  const name = match ? match[1].trim() : '';
  if (!name || name.startsWith('(')) return `KB USER: name unknown; ask once and record it in ${config.kbDir}/08-user.txt.`;
  return `KB USER: ${name} (profile + preferences: ${config.kbDir}/08-user.txt).`;
}

export function sessionLines(root, config, cwd) {
  const lines = [`KB: rules ${config.kbDir}/AGENTS.md, index ${config.kbDir}/00-INDEX.txt, lessons ${config.kbDir}/25-mistakes-and-lessons.txt`];
  const user = userLine(root, config);
  if (user) lines.push(user);
  if (config.mode === 'hub') {
    const current = hubProjectFor(root, cwd);
    const states = current ? [projectState(root, config, current)] : listHubProjects(root).map((p) => projectState(root, config, p));
    if (states.length === 0) lines.push('KB PROJECTS: none yet (/new-project <name> "<goal>").');
    states.forEach((s) => lines.push(`KB PROJECT: ${describe(root, s)}`));
    if (states.some((s) => s.stale)) lines.push('A status page is stale: run /kb-update before other work.');
  } else {
    const state = projectState(root, config, null);
    lines.push(`KB STATUS: ${describe(root, state)}`);
    if (state.stale) lines.push('Status page is stale: run /kb-update before other work.');
  }
  return lines;
}

export function stopMessage(root, config, input) {
  if (config.stopHook === 'off' || input.stop_hook_active) return null; // never loop
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const project = config.mode === 'hub' ? hubProjectFor(root, cwd) : null;
  if (config.mode === 'hub' && !project) return null;
  const state = projectState(root, config, project);
  if (!state.stale) return null;
  return `Code changed after the KB status page (${describe(root, state)}).\n` +
    `Before finishing: update ${relative(root, state.page)} (STATUS line, one dated LOG line, NEXT). ` +
    `Put durable lessons in the matching ${config.kbDir}/NN file. Then commit only the KB: ` +
    `git add ${config.kbDir} && git commit -m "docs: kb status". ` +
    'If nothing durable changed, a one-line LOG entry is enough.\n';
}

function main() {
  const mode = process.argv[2] || 'status';
  const start = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const root = findRoot(start);
  if (!root) {
    if (mode !== 'stop') console.log('KB: no .kbsmith/config.json found above this folder (run kbsmith init).');
    return 0;
  }
  const config = loadConfig(root);
  if (mode === 'stop') {
    const text = stopMessage(root, config, readStdin());
    if (!text) return 0;
    process.stderr.write(text);
    return 2; // exit 2 = block the stop once; stderr goes back to Claude
  }
  console.log(sessionLines(root, config, start).join('\n'));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.log(`KB: hook error (${err.message}); run node .kbsmith/scripts/kb-hook.mjs status`);
    process.exitCode = 0;
  }
}
