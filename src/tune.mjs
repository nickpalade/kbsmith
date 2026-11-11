// kbsmith tune: merges a permission profile + token tuning into the USER settings file.
// bypassPermissions only works from user settings (project files ignore it), so this is the
// one place kbsmith writes outside the project. It always shows a diff and backs up first.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PROFILES_DIR, TEMPLATE_DIR, readJsonFile, writeJsonFile, mergeSettings, diffSettings } from './fsutil.mjs';

export const PROFILES = ['trusted', 'balanced', 'careful'];
export const EXTRAS = ['subagent-haiku', 'no-telemetry', 'statusline'];

export const userSettingsDir = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

// Pure: build the patch for a profile plus extras.
export function buildPatch(profile, extras, statuslineCommand) {
  if (!PROFILES.includes(profile)) throw new Error(`unknown profile "${profile}" (use ${PROFILES.join(', ')})`);
  const unknown = extras.filter((e) => !EXTRAS.includes(e));
  if (unknown.length) throw new Error(`unknown extra(s): ${unknown.join(', ')} (use ${EXTRAS.join(', ')})`);
  let patch = mergeSettings(readJsonFile(join(PROFILES_DIR, 'base.json'), {}), readJsonFile(join(PROFILES_DIR, `${profile}.json`), {}));
  const extraDefs = readJsonFile(join(PROFILES_DIR, 'extras.json'), {});
  for (const extra of extras) {
    if (extra === 'statusline') patch = mergeSettings(patch, { statusLine: { type: 'command', command: statuslineCommand } });
    else patch = mergeSettings(patch, extraDefs[extra]);
  }
  return patch;
}

// Pure: apply patch; a stricter profile replaces defaultMode, never leaves bypass behind silently.
export function applyPatch(current, patch, profile) {
  const merged = mergeSettings(current, patch);
  if (profile !== 'trusted' && merged.skipDangerousModePermissionPrompt) {
    const { skipDangerousModePermissionPrompt, ...rest } = merged;
    return rest;
  }
  return merged;
}

export function tune(flags = {}) {
  const profile = flags.profile || 'trusted';
  const extras = typeof flags.extras === 'string' ? flags.extras.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const dir = userSettingsDir();
  const file = join(dir, 'settings.json');
  const statuslineDest = join(dir, 'kbsmith-statusline.mjs');
  const patch = buildPatch(profile, extras, `node "${statuslineDest.split('\\').join('/')}"`);
  const before = readJsonFile(file, {});
  const after = applyPatch(before, patch, profile);
  const changes = diffSettings(before, after);
  if (before.skipDangerousModePermissionPrompt && !after.skipDangerousModePermissionPrompt) changes.push('- skipDangerousModePermissionPrompt (removed: not in trusted mode)');

  console.log(`kbsmith tune: profile "${profile}"${extras.length ? ` + ${extras.join(', ')}` : ''} -> ${file}`);
  if (!changes.length) { console.log('  already up to date, nothing to change.'); return 0; }
  changes.forEach((line) => console.log(`  ${line}`));
  if (profile === 'trusted') {
    console.log('\n  NOTE: trusted = bypassPermissions. No prompts; only the deny list above stops accidents.');
    console.log('  Use it for your own code on your own machine. For client data, prod or secrets: --profile careful.');
  }
  if (!flags.yes) { console.log('\nDry run. Re-run with --yes to write (a backup is made first).'); return 0; }

  mkdirSync(dir, { recursive: true });
  if (existsSync(file)) {
    const backup = `${file}.kbsmith-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    copyFileSync(file, backup);
    console.log(`\n  backup: ${backup}`);
  }
  if (extras.includes('statusline')) copyFileSync(join(TEMPLATE_DIR, '.kbsmith', 'scripts', 'statusline.mjs'), statuslineDest);
  writeJsonFile(file, after);
  console.log('  written. Restart Claude Code (or run /config) for the new mode to apply.');
  return 0;
}
