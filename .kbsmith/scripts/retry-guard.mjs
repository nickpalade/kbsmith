#!/usr/bin/env node
// UserPromptSubmit hook: notices when you keep reporting that something still does not work and
// tells Claude to stop retrying blindly, find the root cause, and write the lesson into
// kb/25-mistakes-and-lessons.txt. Once the problem is solved it asks for the lesson entry.
//
//   node .kbsmith/scripts/retry-guard.mjs     reads the hook JSON ({ prompt, session_id }) on stdin
//
// Prints context on stdout and always exits 0 (a hook must never block a prompt).
// State per session lives in the OS temp folder.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { findRoot, loadConfig, readJson, readStdin } from './lib.mjs';

export const STOP_AT = 2; // this many "still broken" prompts in a session -> mandatory postmortem

const FAIL_WORDS = "(not working|doesn'?t work|does not work|isn'?t working|broken|fail(s|ed|ing)?|error|wrong|the same|crash(es|ing)?)";

export const FAILURE = new RegExp(
  [
    `\\bstill\\b[^.?!]{0,40}\\b${FAIL_WORDS}`,
    "\\b(doesn'?t|does not|didn'?t|did not|isn'?t|is not|won'?t|will not)\\s+(work|load|run|start|show|fix)",
    '\\bnot working\\b', '\\bsame (error|problem|issue|bug|result)\\b',
    '\\b(again|another) error\\b', '\\bwrong again\\b', '\\bbroken again\\b',
    '\\bnothing (changed|happens|happened)\\b', '\\bwhy (is|does) it (still|not)\\b',
    '\\bno (change|difference)\\b',
  ].join('|'),
  'i',
);

export const RESOLVED = /\b(works now|it works|working now|that fixed it|fixed now|finally works|that worked|solved it|all good now)\b/i;

// Pure decision function: given the stored count and a prompt, return the new count and the message.
// A prompt that reports a failure is a failure, even if it also contains a "resolved" phrase
// ("I fixed it but it still doesn't work").
export function decide(previous, prompt, lessonsFile) {
  const failed = FAILURE.test(prompt);
  const resolved = !failed && RESOLVED.test(prompt);
  if (resolved) {
    const text = previous > 0
      ? `KB LESSON DUE: this problem took ${previous} extra prompt(s) before it worked. Before moving on, ` +
        `add an entry to ${lessonsFile} (format at the top of that file): symptom, real root cause, why ` +
        'it was missed, the fix, and the rule that prevents it next time. Fix any wrong KB fact it exposed, then commit the KB.'
      : '';
    return { count: 0, text };
  }
  if (!failed) return { count: previous, text: '' };
  const count = previous + 1;
  if (count < STOP_AT) {
    return {
      count,
      text: 'KB: the user says something still does not work. Before another attempt: re-read the exact ' +
        `error/output, check ${lessonsFile} for a matching past lesson, and question your last assumption ` +
        'instead of repeating the same fix.',
    };
  }
  return {
    count,
    text: `KB REPEATED FAILURE (${count} times this session): STOP retrying the same approach. ` +
      `Run the postmortem in ${lessonsFile} now: 1) list every attempt so far and why each failed, ` +
      '2) find the real root cause with evidence (logs, docs, the actual code), 3) say plainly where you went wrong, ' +
      '4) write the lesson entry and correct any KB file that was wrong, 5) commit the KB, ' +
      '6) only then try the fix that follows from the root cause.',
  };
}

function stateFile(sessionId) {
  const safe = String(sessionId || 'nosession').replace(/[^a-zA-Z0-9_-]/g, '');
  return join(tmpdir(), `kbsmith-retry-${safe}.json`);
}

function main() {
  const input = readStdin();
  const root = findRoot(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!root) return;
  const config = loadConfig(root);
  if (!config.retryGuard) return;
  const file = stateFile(input.session_id);
  const state = existsSync(file) ? readJson(readFileSync(file, 'utf8'), { count: 0 }) : { count: 0 };
  const lessons = `${config.kbDir}/25-mistakes-and-lessons.txt`;
  const { count, text } = decide(state.count || 0, String(input.prompt || ''), lessons);
  writeFileSync(file, JSON.stringify({ count, updated: new Date().toISOString() }));
  if (text) console.log(text);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (err) {
    console.log(`KB: retry-guard error (${err.message}); continue normally.`);
  }
}
