#!/usr/bin/env node
// .kbsmith/scripts/team/stop-sync.mjs
// Stop hook, OPT-IN (.kbsmith/config.json team.autoSync: true, or TEAM_AUTOSYNC=1 on one machine).
// Commits only the shared files this person changed, then rebases onto origin and pushes.
// It never force-pushes, never uses `git add -A` on the whole repo, and never blocks the session
// (always exits 0). On any doubt it stops and leaves the work uncommitted or committed-but-unpushed.
import {
  findRoot, git, loadConfig, readPeople, identify, firstLine, changedFiles, ownerOf, DENY_PATH_RE,
  conflictMarkers, unmergedFiles, operationInProgress, scanStagedDiff,
} from './team-lib.mjs';

const log = (msg) => console.error(`[team-sync] ${msg}`);

function main() {
  const root = findRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!root) return;
  const cfg = loadConfig(root);
  if (!cfg.enabled || !cfg.autoSync) return;                      // opt-in: silent when off

  const markers = conflictMarkers(root, cfg.allowedPaths);
  if (markers.length || unmergedFiles(root).length) return log(`conflict in ${markers.join(', ') || 'unmerged files'}. Not syncing. Resolve first.`);
  const op = operationInProgress(root);
  if (op) return log(`${op} in progress. Not syncing.`);
  const branch = git(['symbolic-ref', '--short', 'HEAD'], { cwd: root }).out;
  if (branch !== cfg.branch) return log(`on branch "${branch || 'detached'}", not ${cfg.branch}. Not syncing.`);

  // 1. Pick only this person's allowed files. Identity (may call gh) is only looked up when needed.
  let myId;
  const whoAmI = () => (myId ??= identify(root, readPeople(root)).id);
  const files = [];
  for (const f of changedFiles(root, cfg.allowedPaths)) {
    if (DENY_PATH_RE.test(f)) { log(`skip, never shared: ${f}`); continue; }
    const owner = ownerOf(f);
    if (owner && owner !== whoAmI()) { log(`skip, belongs to ${owner}: ${f}`); continue; }
    files.push(f);
  }

  // 2. Commit those files (if any), as this machine's git identity.
  if (files.length) {
    const staged = git(['diff', '--cached', '--name-only'], { cwd: root }).out.split('\n').filter(Boolean);
    const foreign = staged.filter((f) => !files.includes(f));
    if (foreign.length) return log(`you have other staged files (${foreign.join(', ')}). Not syncing.`);
    git(['add', '-A', '--', ...files], { cwd: root });
    const leaks = scanStagedDiff(root);
    if (leaks.length) {
      git(['reset', '-q', '--', ...files], { cwd: root });
      return log(`possible secret in ${leaks.join(', ')}. Unstaged, nothing committed. Remove it and retry.`);
    }
    const names = files.map((f) => f.split('/').pop());
    const msg = `docs: auto-sync ${files.length} file(s): ${names.slice(0, 4).join(', ')}${names.length > 4 ? ', ...' : ''}`;
    const c = git(['commit', '-q', '-m', msg], { cwd: root });
    if (!c.ok) return log(`commit failed: ${firstLine(c.err)}`);
  }

  // 3. Push local commits that origin does not have yet (covers earlier failed pushes too).
  if (!files.length) {
    // Nothing new to share: check locally first so an idle turn makes no network call.
    const pending = Number(git(['rev-list', '--count', `origin/${cfg.branch}..HEAD`], { cwd: root }).out || 0);
    if (pending === 0) return;
  }
  const f = git(['fetch', '--quiet', 'origin', cfg.branch], { cwd: root, timeout: 30000 });
  if (!f.ok) return log(`push skipped, offline (${firstLine(f.err)}). Next sync will retry.`);
  // Only push commits that touch shared KB paths. Anything else is the person's own work: hands off.
  const outgoing = git(['diff', '--name-only', `origin/${cfg.branch}..HEAD`], { cwd: root }).out.split('\n').filter(Boolean);
  const outside = outgoing.filter((p) => DENY_PATH_RE.test(p) || !cfg.allowedPaths.some((a) => p.startsWith(a)));
  if (outside.length) return log(`unpushed commits touch files outside the shared KB (${outside.slice(0, 3).join(', ')}). Push those yourself.`);
  const ahead = Number(git(['rev-list', '--count', `origin/${cfg.branch}..HEAD`], { cwd: root }).out || 0);
  const behind = Number(git(['rev-list', '--count', `HEAD..origin/${cfg.branch}`], { cwd: root }).out || 0);
  if (behind > 0) {
    // Rebase our commits onto origin. On conflict, abort: our commits stay as they were, unpushed.
    // No --autostash: a failed stash pop would leave conflict markers in the working tree.
    const r = git(['pull', '--rebase', '--quiet', 'origin', cfg.branch], { cwd: root, timeout: 60000 });
    if (!r.ok) {
      if (operationInProgress(root)) {
        git(['rebase', '--abort'], { cwd: root });
        return log(`rebase onto origin/${cfg.branch} hit a conflict. Your ${ahead} commit(s) are kept locally. Resolve with: git pull --rebase`);
      }
      return log(`pull failed (${firstLine(r.err)}). Often uncommitted changes in the same files: commit or stash them, then git pull --rebase.`);
    }
  }
  if (ahead === 0 && files.length === 0) return;
  const p = git(['push', '--quiet', 'origin', `HEAD:${cfg.branch}`], { cwd: root, timeout: 60000 });
  if (!p.ok) return log(`push failed (${firstLine(p.err)}). Next sync will retry.`);
  log(`synced to origin/${cfg.branch}.`);
}

try {
  main();
} catch (err) {
  log(`skipped (${firstLine(err && err.message)}).`);
}
process.exitCode = 0;
