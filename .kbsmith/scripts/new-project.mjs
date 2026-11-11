#!/usr/bin/env node
// Hub mode only: scaffold a project wired into the hub's knowledge base.
//
//   node .kbsmith/scripts/new-project.mjs <kebab-name> "<one-line goal>"
//
// Creates projects/<name>/ from .kbsmith/project-template/ (its own git repo), the status page
// kb/projects/<name>.txt, a line in kb/02-status.txt and a line in kb/04-timeline.txt.
// Builds in a temp folder first and renames at the end, so a crash never leaves half a project.

import {
  cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { findRoot, loadConfig, today } from './lib.mjs';

export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

function fillTree(dir, vars) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) fillTree(full, vars);
    else writeFileSync(full, fill(readFileSync(full, 'utf8'), vars));
  }
}

// Replace the "- (none yet)" placeholder, or append after the last "- " line.
export function addLine(text, line) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const placeholder = lines.findIndex((l) => l.trim() === '- (none yet)');
  if (placeholder >= 0) {
    lines[placeholder] = line;
  } else {
    let last = -1;
    lines.forEach((l, i) => { if (l.startsWith('- ')) last = i; });
    lines.splice(last < 0 ? lines.length : last + 1, 0, line);
  }
  return lines.join(eol);
}

export function createProject(root, config, name, goal) {
  if (!name || !NAME_PATTERN.test(name)) throw new Error('name must be kebab-case: a-z, 0-9, single dashes');
  if (!goal || !goal.trim()) throw new Error('a one-line goal is required');
  const kb = join(root, config.kbDir);
  const projectDir = join(root, 'projects', name);
  const page = join(kb, 'projects', `${name}.txt`);
  if (existsSync(projectDir)) throw new Error(`projects/${name} already exists`);
  if (existsSync(page)) throw new Error(`${config.kbDir}/projects/${name}.txt already exists`);

  const vars = { NAME: name, GOAL: goal.trim(), DATE: today() };
  const staging = join(root, 'projects', `.staging-${name}-${Date.now()}`);
  try {
    cpSync(join(root, '.kbsmith', 'project-template'), staging, { recursive: true });
    fillTree(staging, vars);
    renameSync(staging, projectDir);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
  writeFileSync(page, fill(readFileSync(join(kb, 'projects', '_TEMPLATE.txt'), 'utf8'), vars));
  const map = join(kb, '02-status.txt');
  if (existsSync(map)) writeFileSync(map, addLine(readFileSync(map, 'utf8'), `- ${name} | idea | ${vars.DATE} | ${vars.GOAL} | projects/${name}`));
  appendFileSync(join(kb, '04-timeline.txt'), `${vars.DATE}  Project ${name} created: ${vars.GOAL}\n`);
  return { projectDir, page };
}

function main() {
  const root = findRoot(process.cwd());
  if (!root) throw new Error('no .kbsmith/config.json found above this folder');
  const config = loadConfig(root);
  if (config.mode !== 'hub') throw new Error('new-project only works in hub mode (set "mode": "hub" in .kbsmith/config.json)');
  const [name, goal] = process.argv.slice(2);
  const { projectDir } = createProject(root, config, name, goal);
  try {
    execFileSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'inherit' });
    execFileSync('git', ['add', '-A'], { cwd: projectDir, stdio: 'inherit' });
    execFileSync('git', ['commit', '-q', '-m', `chore: scaffold ${name}`], { cwd: projectDir, stdio: 'inherit' });
  } catch (err) {
    console.error(`new-project: git setup failed (${err.message}); the files are in place`);
  }
  console.log(`Created projects/${name}/ and its status page. Open it with: cd projects/${name} && claude`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (err) {
    console.error(`new-project: ${err.message}`);
    process.exitCode = 1;
  }
}
