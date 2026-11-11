#!/usr/bin/env node
// .kbsmith/scripts/team/decide.mjs
// Append one entry to kb/11-decisions.txt with the next D-n number.
// Usage: node .kbsmith/scripts/team/decide.mjs "Use Postgres for the pilot" --why "team knows it" --who "Alice" --source "call 2026-11-03"
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findRoot, firstLine } from './team-lib.mjs';

const args = process.argv.slice(2);
const text = args[0];
if (!text || text.startsWith('--')) {
  console.error('usage: node .kbsmith/scripts/team/decide.mjs "<decision>" [--why ..] [--who ..] [--source ..]');
  process.exit(1);
}
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : '-'; };

const root = findRoot(process.cwd());
if (!root) { console.error('not a git repo'); process.exit(1); }
const file = join(root, 'kb', '11-decisions.txt');
mkdirSync(dirname(file), { recursive: true });
const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
if (!body) writeFileSync(file, 'DECISIONS\nFormat: D-<n> YYYY-MM-DD | decision | why | decided by | source\nAppend only. Revisit by a new entry, do not edit old ones.\n\n');
const ids = [...body.matchAll(/^D-(\d+)\s/gm)].map((m) => Number(m[1]));
const next = (ids.length ? Math.max(...ids) : 0) + 1;
const today = new Date().toISOString().slice(0, 10);
const line = `D-${next} ${today} | ${text} | ${opt('why')} | decided by ${opt('who')} | ${opt('source')}`;
const prefix = body && !body.endsWith('\n') ? '\n' : '';
appendFileSync(file, `${prefix}${line}\n`);
console.log(firstLine(line));
