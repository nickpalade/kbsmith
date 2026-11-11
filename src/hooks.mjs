// Adds kbsmith hook entries to an existing .claude/settings.json without touching other hooks.
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from './fsutil.mjs';

export const SOLO_HOOKS = {
  SessionStart: 'node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/kb-hook.mjs" session',
  UserPromptSubmit: 'node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/retry-guard.mjs"',
  Stop: 'node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/kb-hook.mjs" stop',
};

export const TEAM_HOOKS = {
  SessionStart: 'node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/team/session-start.mjs"',
  Stop: 'node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/team/stop-sync.mjs"',
};

const hasCommand = (entries, command) =>
  (entries || []).some((entry) => (entry.hooks || []).some((h) => h.command === command));

// Pure: returns a new settings object with the hooks added (existing ones kept as they are).
export function withHooks(settings, hookMap, timeout = 15) {
  const hooks = { ...(settings.hooks || {}) };
  for (const [event, command] of Object.entries(hookMap)) {
    const entries = hooks[event] || [];
    hooks[event] = hasCommand(entries, command)
      ? entries
      : [...entries, { hooks: [{ type: 'command', command, timeout }] }];
  }
  return { ...settings, hooks };
}

export function installHooks(projectDir, hookMap, timeout = 15) {
  const file = join(projectDir, '.claude', 'settings.json');
  const before = readJsonFile(file, {});
  if (!before || typeof before !== 'object' || Array.isArray(before)) {
    throw new Error(`${file} is not a JSON object. Fix it by hand first; nothing was changed.`);
  }
  const after = withHooks(before, hookMap, timeout);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) writeJsonFile(file, after);
  return changed;
}
