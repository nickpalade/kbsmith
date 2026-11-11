#!/usr/bin/env node
// .kbsmith/scripts/team/session-start.mjs
// SessionStart hook. Fetches, fast-forwards only when it is safe, and prints a short team status
// (who is here, what others changed, conflicts, stale files). stdout goes into Claude's context.
// Never blocks the session: always exits 0.
import { writeFileSync } from 'node:fs';
import {
  findRoot, git, loadConfig, readPeople, identify, firstLine, conflictMarkers, unmergedFiles,
  operationInProgress, staleFiles, unseenCommits,
} from './team-lib.mjs';

const say = (line) => console.log(line);

function syncPull(root, branch) {
  const counts = git(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`], { cwd: root });
  if (!counts.ok) return 'no remote branch to compare with.';
  const [ahead, behind] = counts.out.split(/\s+/).map(Number);
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], { cwd: root }).out !== '';
  if (behind === 0) return ahead ? `${ahead} local commit(s) not pushed yet.` : 'up to date.';
  if (dirty) return `${behind} new remote commit(s) NOT pulled: uncommitted local edits. Commit or stash, then git pull --rebase.`;
  if (ahead) return `diverged (${ahead} local, ${behind} remote). Not pulled automatically. Run git pull --rebase and resolve any conflict.`;
  const p = git(['pull', '--ff-only', '--quiet', 'origin', branch], { cwd: root, timeout: 60000 });
  return p.ok ? `pulled ${behind} new commit(s) (fast-forward).` : `pull failed: ${firstLine(p.err)}`;
}

function main() {
  const root = findRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!root) return say('TEAM SYNC: not a git repo, team sync skipped.');
  const cfg = loadConfig(root);
  if (!cfg.enabled) return;                       // solo mode: kb-hook.mjs covers the user line
  const people = readPeople(root);
  const me = identify(root, people);

  if (me.id) say(`TEAM USER: ${people[me.id].name ?? me.id} (${me.id}), matched by ${me.hits.join(', ')}. Profile and preferences (learned over time): people/${me.id}/profile.txt. Personal notes: people/${me.id}/.`);
  else if (me.tie) say('TEAM USER: unknown (two people match this machine). Ask who is working, then fix people/people.json.');
  else say('TEAM USER: unknown. Ask who is working, then run node .kbsmith/scripts/team/join.mjs <id> \"<Full Name>\" and commit people/.');

  const fetched = git(['fetch', '--quiet', 'origin', cfg.branch], { cwd: root, timeout: 15000 });
  if (!fetched.ok) say(`TEAM SYNC: offline or no remote (${firstLine(fetched.err)}). Using the local copy.`);

  const markers = conflictMarkers(root, cfg.allowedPaths);
  const unmerged = unmergedFiles(root);
  const op = operationInProgress(root);
  if (markers.length || unmerged.length || op) {
    const files = [...new Set([...markers, ...unmerged])].join(', ') || '(none listed)';
    say(`TEAM SYNC: CONFLICT or unfinished ${op ?? 'merge'} in ${files}. Keep both sides' facts, remove the conflict markers, git add, then commit. Do not start new edits first.`);
  } else if (fetched.ok) {
    say(`TEAM SYNC: ${syncPull(root, cfg.branch)}`);
  }

  if (fetched.ok) {
    const { head, seenFile, commits } = unseenCommits(root, cfg.branch);
    if (commits.length) {
      const byAuthor = {};
      for (const c of commits) (byAuthor[c.author] ??= []).push(c);
      say(`SINCE LAST SESSION (${commits.length} commit(s)):`);
      for (const [author, list] of Object.entries(byAuthor)) {
        say(`  ${author}: ${list.slice(0, 5).map((c) => `${c.subject} (${c.date})`).join('; ')}${list.length > 5 ? `; +${list.length - 5} more` : ''}`);
      }
    }
    if (head) writeFileSync(seenFile, `${head}\n`);
  }

  const stale = staleFiles(root, cfg.staleDirs, cfg.staleDays);
  if (stale.length) {
    const shown = stale.slice(0, 8).map((s) => `${s.file} (${s.days}d)`).join(', ');
    say(`STALE (no commit for ${cfg.staleDays}+ days): ${shown}${stale.length > 8 ? `, +${stale.length - 8} more` : ''}.`);
  }
}

try {
  main();
} catch (err) {
  say(`TEAM SYNC: skipped (${firstLine(err && err.message)}).`);
}
process.exitCode = 0;
