#!/usr/bin/env node
// .kbsmith/scripts/team/whoami.mjs
// Prints this machine's identity signals as JSON, to copy into people/people.json.
// Usage: node .kbsmith/scripts/team/whoami.mjs
import { hostname, userInfo } from 'node:os';
import { findRoot, git, exec } from './team-lib.mjs';

const root = findRoot(process.cwd()) ?? process.cwd();
let osUser = '';
try { osUser = userInfo().username; } catch { osUser = process.env.USERNAME || process.env.USER || ''; }
console.log(JSON.stringify({
  git_name: git(['config', 'user.name'], { cwd: root, timeout: 4000 }).out,
  github: exec('gh', ['api', 'user', '--jq', '.login'], { cwd: root, timeout: 4000 }).out,
  os_user: osUser,
  host: hostname(),
}, null, 2));
