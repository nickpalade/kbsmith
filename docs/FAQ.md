# FAQ

**Is this a database, vector store or MCP server?**
No. It's plain `.txt` and `.md` files in your repo, a few Node scripts that Claude Code hooks run,
and some slash commands. You can open all of it in any editor, and git keeps the history.

**Why `.txt` and not Obsidian or a wiki?**
Claude reads text files natively, and it's cheap. With numbered files and an index it has a map,
so it opens one file instead of a whole vault. There's nothing to install and nothing to sync
except git.

**Why are some files `.xml`?**
Only for things that really are tables, like a task board several sessions update by id, or a
phased plan with dependencies. Each task is one element with its fields as attributes, so Claude
can flip one status without rewriting a paragraph. Everything else stays `.txt`, because XML
costs more tokens for prose. `kb-lint` checks that every `.xml` file is listed in the index and is
well-formed.

**Does it work with an existing project?**
Yes. Setup tags a baseline (`kbsmith-baseline-YYYY-MM-DD`) and then sends agents through the code
in parallel: structure, main flows, data, quality, history. What they find goes into the KB with
file:line evidence, and Claude spot-checks three of the claims before trusting them. Setup never
edits your code.

**Will it overwrite my CLAUDE.md or settings?**
No. `init` never overwrites a file. It adds one `@kb/AGENTS.md` import line to CLAUDE.md and merges
its hooks into `.claude/settings.json`. `tune` is a dry run until you pass `--yes`, and it backs up
`~/.claude/settings.json` before writing.

**Is bypassPermissions safe?**
On your own code and your own machine, I've used it every day for months and trust it. The
`trusted` profile also adds a deny list for the obvious disasters (`rm -rf`, force-push, reading
`.env`). But a deny list only stops accidents. It won't stop a determined model or a malicious
repo. For client data, production credentials, regulated data or code you didn't write, use
`careful`.

**How much does it cost?**
Nothing. kbsmith runs on the Claude plan you already have. The license is Apache 2.0 with the
Commons Clause: you can use it, change it and share it, at work too, but you can't sell it or sell
a service built on it. [TOKENS.md](TOKENS.md) has real usage numbers from a $20 Pro plan.

**Does it work in the desktop app or VS Code?**
Mostly, since they share the hooks and settings files. I'd still use the terminal, and
[CLI-VS-APP.md](CLI-VS-APP.md) explains why.

**What does the Stop hook do? It blocked my turn.**
If code changed after `kb/02-status.txt` was last updated, it blocks the end of the turn once and
asks Claude to update the status page. It can't loop. To turn it off, set `"stopHook": "off"` in
`.kbsmith/config.json`.

**What is the retry guard?**
It watches your prompts for "still not working" and similar phrases. The second time in a row, it
tells Claude to stop retrying and do a postmortem: find the root cause, write the lesson into
`kb/25-mistakes-and-lessons.txt`, then fix it. Turn it off with `"retryGuard": false`.

**How does it learn my name?**
Through `kb/08-user.txt`. Claude asks your name once, then records the preferences and corrections
you give it, each with a date. Anything it guesses stays marked INFERRED until you confirm it.
Session start prints `KB USER: <name>`. In team mode each person gets `people/<id>/profile.txt`
instead.

**Can I have one KB for many projects?**
Yes, with `init --mode hub`. Projects live in `projects/<name>/`, each with a page in
`kb/projects/`. `/new-project <name> <goal>` creates one and plans it before any code.

**Can I uninstall it?**
Delete `kb/`, `.kbsmith/`, whichever `.claude/commands/` files you don't want, the import line in
CLAUDE.md and the kbsmith hooks in `.claude/settings.json`. To undo `tune`, restore the
`settings.json.kbsmith-backup-*` file.

**Does it send data anywhere?**
No. The scripts make no network calls. In team mode `git` and `gh` talk to GitHub, same as with any
repo. The `no-telemetry` tune extra also switches off Claude Code's non-essential traffic.

**Something's wrong.**
Run `npx -y github:nickpalade/kbsmith doctor`. It checks node, git, gh, the config, hooks, the
import line, lint, your permission mode and the deny list.
