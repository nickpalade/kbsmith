#!/usr/bin/env node
// kbsmith: plain-text project memory + a tuned Claude Code setup.
//   kbsmith init [dir] [--mode project|hub] [--name <name>]
//   kbsmith tune [--profile trusted|balanced|careful] [--extras subagent-haiku,no-telemetry,statusline] [--yes]
//   kbsmith doctor [dir]
//   kbsmith team enable [--owner X --repo Y] [--auto-sync] | team join <id> "<Full Name>" ["<role>"]
import { parseArgs } from '../src/fsutil.mjs';
import { init } from '../src/init.mjs';
import { tune } from '../src/tune.mjs';
import { doctor } from '../src/doctor.mjs';
import { team } from '../src/team.mjs';

const HELP = `kbsmith: plain-text memory for Claude Code

  init [dir] [--mode project|hub]   install the KB, hooks and commands (never overwrites files)
  tune [--profile trusted|balanced|careful] [--extras a,b] [--yes]
                                    token + speed settings and a permission profile in ~/.claude
                                    (dry run unless --yes; always backs up first)
  doctor [dir]                      check the install
  team enable | team join           share the KB with a team through a private GitHub repo

Start: npx -y github:nickpalade/kbsmith init, then tell Claude Code "set up kbsmith".`;

async function main(argv) {
  const [command, ...rest] = argv;
  const { flags, positional } = parseArgs(rest);
  switch (command) {
    case 'init': return init(positional[0], flags);
    case 'tune': return tune(flags);
    case 'doctor': return doctor(positional[0]);
    case 'team': return team(positional[0], positional.slice(1), flags);
    case undefined: case 'help': case '--help': case '-h': console.log(HELP); return 0;
    default: console.error(`unknown command "${command}"\n\n${HELP}`); return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((err) => { console.error(`kbsmith: ${err.message}`); process.exitCode = 1; });
