#!/usr/bin/env node
// .kbsmith/scripts/team/check-conflicts.mjs
// Manual check: node .kbsmith/scripts/team/check-conflicts.mjs   (exit 1 when conflicts or markers exist)
import { findRoot, loadConfig, conflictMarkers, unmergedFiles, operationInProgress } from './team-lib.mjs';

const root = findRoot(process.cwd());
if (!root) { console.log('not a git repo'); process.exit(0); }
const cfg = loadConfig(root);
const markers = conflictMarkers(root, cfg.allowedPaths);
const unmerged = unmergedFiles(root);
const op = operationInProgress(root);
if (!markers.length && !unmerged.length && !op) {
  console.log('no conflicts');
  process.exit(0);
}
if (op) console.log(`in progress: ${op}`);
for (const f of new Set([...markers, ...unmerged])) console.log(`conflict: ${f}`);
process.exit(1);
