#!/usr/bin/env node
// Health check for the knowledge base. Run by /kb-lint, by `kbsmith doctor`, or by hand:
//
//   node .kbsmith/scripts/kb-lint.mjs          exit 1 when an error is found
//
// Checks: every kb file is in 00-INDEX.txt and every indexed file exists; every kb/NN-*.txt
// reference in the rules, commands and agents exists; no {{PLACEHOLDER}} left; nothing that
// looks like a secret; the always-loaded rules file stays small; kb/*.xml boards are well-formed.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findRoot, loadConfig } from './lib.mjs';

export const SECRET_PATTERNS = [
  [/sk-ant-[a-zA-Z0-9_-]{10,}/, 'Anthropic API key'],
  [/sk-[a-zA-Z0-9]{32,}/, 'API key'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"'<]{8,}/i, 'credential assignment'],
];

const RULES_SOFT_LIMIT = 6000; // bytes; the rules file is loaded into every session
const XML_SOFT_LIMIT = 8000;   // bytes; a board that grows past this is carrying history

// Cheap well-formedness check for the small KB boards: matching tags, one root, escaped '&'.
// Not a full parser (no DTDs, no CDATA); enough to catch a hand edit gone wrong.
export function xmlProblem(text) {
  const body = text.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const amp = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.exec(body);
  if (amp) return `unescaped "&" near "${body.slice(amp.index, amp.index + 20).trim()}" (write &amp;)`;
  const stack = [];
  let roots = 0;
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (close) {
      const open = stack.pop();
      if (open !== name) return `</${name}> closes <${open || 'nothing'}>`;
    } else {
      if (stack.length === 0) roots += 1;
      if (!selfClose) stack.push(name);
    }
  }
  if (stack.length) return `<${stack.pop()}> is never closed`;
  if (roots !== 1) return `expected one root element, found ${roots}`;
  if (/<(?![\/A-Za-z_])/.test(body.replace(/<(\/?)[A-Za-z_][\w.-]*(?:[^>"']|"[^"]*"|'[^']*')*?\/?>/g, ''))) return 'stray "<" (write &lt;)';
  return null;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function lint(root, config) {
  const errors = [];
  const warnings = [];
  const kb = join(root, config.kbDir);
  if (!existsSync(kb)) return { errors: [`missing ${config.kbDir}/ folder`], warnings };

  const files = walk(kb).filter((f) => /\.(txt|md|xml)$/.test(f));
  const rel = (f) => relative(kb, f).split('\\').join('/');
  const indexFile = join(kb, '00-INDEX.txt');
  const index = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
  if (!index) errors.push(`missing ${config.kbDir}/00-INDEX.txt`);

  // 1. Index <-> files (top-level numbered files only; project pages are listed in 02 instead).
  const numbered = files.map(rel).filter((r) => /^\d\d-[^/]+$/.test(r) && r !== '00-INDEX.txt');
  for (const name of numbered) {
    if (!index.includes(name)) errors.push(`${name} is not listed in 00-INDEX.txt`);
  }
  for (const match of index.matchAll(/^(\d\d-[\w.-]+\.(?:txt|md|xml))/gm)) {
    if (!existsSync(join(kb, match[1]))) errors.push(`00-INDEX.txt lists ${match[1]} but the file does not exist`);
  }

  // 2. References in rules, commands and agents.
  const refSources = [join(kb, 'AGENTS.md'), ...['commands', 'agents']
    .map((d) => join(root, '.claude', d))
    .filter(existsSync)
    .flatMap((d) => walk(d))];
  for (const src of refSources.filter(existsSync)) {
    const text = readFileSync(src, 'utf8');
    for (const m of text.matchAll(/\bkb\/(\d\d-[\w.-]+\.(?:txt|md|xml))/g)) {
      if (!existsSync(join(kb, m[1]))) errors.push(`${relative(root, src)} points to kb/${m[1]}, which does not exist`);
    }
  }

  // 3. Placeholders and secrets.
  for (const f of files) {
    if (rel(f).startsWith('projects/_TEMPLATE')) continue;
    const text = readFileSync(f, 'utf8');
    const placeholder = /\{\{[A-Z_]+\}\}/.exec(text);
    if (placeholder) warnings.push(`${rel(f)} still has ${placeholder[0]}`);
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(text)) errors.push(`${rel(f)} looks like it contains a ${label}. Remove it; write "stored in <password manager>" instead`);
    }
    if (f.endsWith('.xml')) {
      const problem = xmlProblem(text);
      if (problem) errors.push(`${rel(f)} is not well-formed XML: ${problem}`);
      if (text.length > XML_SOFT_LIMIT) warnings.push(`${rel(f)} is ${text.length} bytes; drop done rows (history belongs in the .txt)`);
    }
  }

  // 4. Always-loaded file size.
  const rules = join(kb, 'AGENTS.md');
  if (existsSync(rules) && statSync(rules).size > RULES_SOFT_LIMIT) {
    warnings.push(`kb/AGENTS.md is ${statSync(rules).size} bytes; it loads every session. Move detail into kb/NN files (aim < ${RULES_SOFT_LIMIT}).`);
  }
  return { errors, warnings };
}

function main() {
  const root = findRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!root) {
    console.log('kb-lint: no .kbsmith/config.json found above this folder');
    return 1;
  }
  const { errors, warnings } = lint(root, loadConfig(root));
  warnings.forEach((w) => console.log(`WARN  ${w}`));
  errors.forEach((e) => console.log(`ERROR ${e}`));
  console.log(errors.length ? `kb-lint: ${errors.length} error(s)` : `kb-lint: ok (${warnings.length} warning(s))`);
  return errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.log(`kb-lint: error (${err.message})`);
    process.exitCode = 1;
  }
}
