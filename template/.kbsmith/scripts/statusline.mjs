#!/usr/bin/env node
// Optional status line: model | context used | branch.  Seeing the context size is the single
// best habit for saving tokens: every turn re-reads the whole context, so a fat context is what
// burns your plan, not long answers.
//
// Wire it in ~/.claude/settings.json (kbsmith tune does this when you opt in):
//   "statusLine": { "type": "command", "command": "node ~/.claude/kbsmith-statusline.mjs" }
//
// Reads the status-line JSON on stdin. Context size comes from the last assistant message in the
// transcript (input + cache tokens). Any failure prints a plain fallback; it never throws.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TAIL_BYTES = 200_000;

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function contextTokens(transcriptText) {
  const lines = transcriptText.split('\n').filter(Boolean).reverse();
  for (const line of lines) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const u = msg?.message?.usage;
    if (msg?.type === 'assistant' && u) {
      return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
  }
  return 0;
}

function tail(file) {
  try {
    const text = readFileSync(file, 'utf8');
    return text.length > TAIL_BYTES ? text.slice(-TAIL_BYTES) : text;
  } catch {
    return '';
  }
}

function branch(cwd) {
  try {
    return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function main() {
  const input = readInput();
  const model = input?.model?.display_name || 'Claude';
  const cwd = input?.workspace?.current_dir || input?.cwd || process.cwd();
  const tokens = input.transcript_path ? contextTokens(tail(input.transcript_path)) : 0;
  const ctx = tokens ? `ctx ${Math.round(tokens / 1000)}k${tokens > 150_000 ? ' (consider /clear or /compact)' : ''}` : 'ctx -';
  const br = branch(cwd);
  console.log([model, ctx, br && `git:${br}`].filter(Boolean).join(' | '));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  try {
    main();
  } catch {
    console.log('Claude');
  }
}
