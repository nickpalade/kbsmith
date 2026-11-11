// kbsmith init: copies the KB template into a project without overwriting anything.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { TEMPLATE_DIR, listFiles, copyIfMissing, readJsonFile, writeJsonFile, today } from './fsutil.mjs';
import { installHooks, SOLO_HOOKS } from './hooks.mjs';

const MODES = new Set(['project', 'hub']);
const IMPORT_LINE = '@kb/AGENTS.md';
const HUB_ONLY = [/^kb\/projects\//, /^\.kbsmith\/project-template\//];
const HANDLED_SEPARATELY = new Set(['gitignore.kbsmith']);

export function planCopy(files, mode) {
  return files.filter((f) => !HANDLED_SEPARATELY.has(f) && (mode === 'hub' || !HUB_ONLY.some((re) => re.test(f))));
}

// Pure: CLAUDE.md text with the KB import added once.
export function withImport(existing) {
  if (existing.includes(IMPORT_LINE)) return existing;
  const block = `## Knowledge base\nRules, memory and routing for this project: ${IMPORT_LINE}\n`;
  return existing.trim() ? `${existing.replace(/\s*$/, '')}\n\n${block}` : `${block}`;
}

// Pure: .gitignore text with the kbsmith lines that are missing.
export function withIgnores(existing, snippet) {
  const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = snippet.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#') && !have.has(l.trim()));
  if (!missing.length) return existing;
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  return `${existing}${sep}\n# kbsmith\n${missing.join('\n')}\n`;
}

export function init(targetArg, flags = {}) {
  const target = resolve(targetArg || process.cwd());
  const mode = flags.mode || 'project';
  if (!MODES.has(mode)) throw new Error(`--mode must be "project" or "hub", got "${mode}"`);
  mkdirSync(target, { recursive: true });

  const values = { DATE: today(), PROJECT: flags.name || basename(target) };
  const report = { created: [], skipped: [] };
  for (const file of planCopy(listFiles(TEMPLATE_DIR), mode)) {
    const result = copyIfMissing(join(TEMPLATE_DIR, file), join(target, file), values);
    report[result].push(file);
  }

  const configFile = join(target, '.kbsmith', 'config.json');
  const config = readJsonFile(configFile, {});
  if (config.mode !== mode && report.created.includes('.kbsmith/config.json')) writeJsonFile(configFile, { ...config, mode });
  if (mode === 'hub') mkdirSync(join(target, 'projects'), { recursive: true });

  const claudeMd = join(target, 'CLAUDE.md');
  const before = existsSync(claudeMd) ? readFileSync(claudeMd, 'utf8') : '';
  const after = withImport(before);
  if (after !== before) writeFileSync(claudeMd, after);

  const gitignore = join(target, '.gitignore');
  const ignoreBefore = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
  const ignoreAfter = withIgnores(ignoreBefore, readFileSync(join(TEMPLATE_DIR, 'gitignore.kbsmith'), 'utf8'));
  if (ignoreAfter !== ignoreBefore) writeFileSync(gitignore, ignoreAfter);

  const hooksChanged = installHooks(target, SOLO_HOOKS);
  const gitInit = insideGitRepo(target) ? 'existing repo' : gitInitRepo(target);
  printReport(target, mode, report, { claudeMd: after !== before, hooksChanged, gitInit });
  return 0;
}

function insideGitRepo(target) {
  const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: target, encoding: 'utf8', windowsHide: true });
  return r.status === 0 && r.stdout.trim() === 'true';
}

function gitInitRepo(target) {
  const r = spawnSync('git', ['init', '-q'], { cwd: target, encoding: 'utf8' });
  return r.status === 0 ? 'git init' : 'git not found (install git, then run git init)';
}

function printReport(target, mode, report, extra) {
  const log = (s) => console.log(s);
  log(`kbsmith: installed into ${target} (${mode} mode)`);
  log(`  created ${report.created.length} files, kept ${report.skipped.length} existing files untouched`);
  if (report.skipped.length) log(`  kept: ${report.skipped.slice(0, 8).join(', ')}${report.skipped.length > 8 ? ', ...' : ''}`);
  log(`  CLAUDE.md: ${extra.claudeMd ? 'added @kb/AGENTS.md import' : 'import already present'}`);
  log(`  hooks: ${extra.hooksChanged ? 'added to .claude/settings.json' : 'already present'}`);
  log(`  git: ${extra.gitInit}`);
  log('');
  log('NEXT (for Claude Code): read .kbsmith/SETUP.md and follow it step by step.');
  log('NEXT (for a human):     open Claude Code here and say "set up kbsmith".');
}
