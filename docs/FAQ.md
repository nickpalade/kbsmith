# FAQ

**Is this a database, vector store or MCP server?**
No. It is plain `.txt` and `.md` files in your repo, a few Node scripts run by Claude Code hooks,
and some slash commands. You can read and edit all of it in any editor. Git is the history.

**Why `.txt` and not Obsidian or a wiki?**
Claude reads text files natively and cheaply. Numbered files plus an index give it a map, so it
reads one file instead of a whole vault. Nothing to install, nothing to sync except git.

**Why are some files `.xml`?**
Only for things that are really tables: a task board that several sessions update by id, or a
phased plan with dependencies. One element per task, fields as attributes, so Claude can change one
status without rewriting a paragraph. Everything else stays `.txt`, because XML costs more tokens
for prose. `kb-lint` checks every `.xml` file is listed in the index and well-formed.

**Does it work with an existing project?**
Yes. Setup tags a baseline (`kbsmith-baseline-YYYY-MM-DD`), then parallel agents map the code:
structure, main flows, data, quality, history. The findings go into the KB with file:line
evidence, and Claude spot-checks three claims before trusting them. It never edits your code
during setup.

**Will it overwrite my CLAUDE.md or settings?**
No. `init` never overwrites files. It appends one `@kb/AGENTS.md` import line to CLAUDE.md and
merges hooks into `.claude/settings.json`. `tune` is a dry run until you pass `--yes`, and it
backs up `~/.claude/settings.json` first.

**Is bypassPermissions safe?**
For your own code on your own machine, the author has used it daily for months and finds it
trustworthy, and the `trusted` profile adds a deny list for the obvious disasters (`rm -rf`,
force-push, reading `.env`). Be clear about what a deny list is: it stops **accidents**, not a
determined model or a malicious repo. Use `careful` for client data, production credentials,
regulated data, or code you didn't write and don't trust.

**How much does it cost?**
kbsmith is free and MIT-licensed. It runs on your existing Claude plan. See
[TOKENS.md](TOKENS.md) for real usage numbers on a $20 Pro plan.

**Does it work in the desktop app or VS Code?**
The hooks and settings files are shared, so mostly yes. We recommend the terminal: see
[CLI-VS-APP.md](CLI-VS-APP.md).

**What does the Stop hook do? It blocked my turn.**
If code changed after `kb/02-status.txt` was last updated, it blocks the end of the turn **once**
and asks Claude to update the status page. It never loops. Turn it off with `"stopHook": "off"`
in `.kbsmith/config.json`.

**What is the retry guard?**
It watches your prompts for "still not working" and similar. At the second one in a row it tells
Claude to stop retrying and do a postmortem: find the root cause, write the lesson into
`kb/25-mistakes-and-lessons.txt`, then fix. Turn it off with `"retryGuard": false`.

**How does it learn my name?**
`kb/08-user.txt`. Claude asks your name once and records preferences and corrections you state,
each with a date. Anything it guesses is marked INFERRED until you confirm. Session start prints
`KB USER: <name>`. In team mode each person has `people/<id>/profile.txt` instead.

**Can I have one KB for many projects?**
Yes, `init --mode hub`. Projects live in `projects/<name>/` with one page each in
`kb/projects/`. `/new-project <name> <goal>` creates one, planning first.

**Can I uninstall it?**
Delete `kb/`, `.kbsmith/`, `.claude/commands/` files you don't want, the import line in CLAUDE.md
and the kbsmith hooks in `.claude/settings.json`. To undo `tune`, restore the
`settings.json.kbsmith-backup-*` file.

**Does it send data anywhere?**
No. The scripts make no network calls. In team mode, `git` and `gh` talk to GitHub, the same as
any repo. The `no-telemetry` tune extra also turns off Claude Code's non-essential traffic.

**Something's wrong.**
`npx -y github:nickpalade/kbsmith doctor` checks node, git, gh, config, hooks, the import line,
lint, your permission mode and the deny list.
