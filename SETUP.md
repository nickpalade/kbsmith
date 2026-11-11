# kbsmith setup (instructions for Claude Code)

You are setting up kbsmith for the user in this chat. They should have to type very little:
one message of answers, a few yes/no replies. You do the rest. Follow the steps in order.

Ground rules for this setup:
- Never overwrite the user's files. `kbsmith init` already skips existing files; do the same.
- Show a short diff or summary before every change outside `kb/`, `.kbsmith/` and `.claude/`.
- Outward-facing actions (creating GitHub repos, inviting people, pushing) need an explicit yes.
- Heavy reading and research go to parallel subagents; only their summaries come back here.
- Every fact you write into the KB gets a source and date (`per user YYYY-MM-DD`, `code: src/app.ts:12`,
  `docs YYYY-MM-DD`). Guesses are marked INFERRED.
- Keep the user informed in one line per step ("Step 3/8: researching the stack with 3 agents").

## Step 1. Install the files
If `.kbsmith/config.json` does not exist in the project root:
```
npx -y github:nickpalade/kbsmith init
```
Add `--mode hub` if the user wants one workspace that holds many small projects
(`projects/<name>/`, one KB page each). Default: project mode (one repo, one KB).
Then run `npx -y github:nickpalade/kbsmith doctor` and fix any FAIL line.

## Step 2. Interview (one message, the user answers in one go)
Ask all of these in ONE numbered message. Say "short answers are fine, skip any you like":
1. Your name, and your role (e.g. solo founder, student, backend dev).
2. New project or existing code? One sentence on what it is and who it is for.
3. What does "done" look like for the first milestone?
4. Stack: any preferences, or should I research and recommend?
5. How do you want to work with me: should I write whole first drafts, or explain and review
   while you write? Anything you want to learn along the way?
6. What may I run on my own (tests, builds, local servers), and what must you check yourself?
7. Anything sensitive here (client data, production access, secrets)? Anything I must never touch?
8. Solo, or a team that should share this knowledge base?
9. Docs, links or files I should read first? (Drop raw files into `inbox/`; it is git-ignored.)

Write the answers straight into the KB: name, role and working style into `kb/08-user.txt`,
goal/users/scope/done into `kb/01-about.txt`, sensitive areas into `kb/10-security.txt`,
what Claude may run into `kb/14-testing.txt`.

## Step 3A. New project: plan before code
Launch 3 research subagents in parallel (one message, three Agent calls):
- Stack and building blocks: proven libraries, starter templates, open-source projects that solve
  80% of it (GitHub search, package registries, official docs). Versions and dates.
- Prior art: similar products or projects, what they got right and wrong.
- Risks and tooling: security pitfalls for this kind of project, test tools, deploy options, costs.
Then present 2-3 options with trade-offs and ONE recommendation. Let the user pick.
Write the result: `kb/03-environment.txt` (stack, commands), `kb/05-architecture.txt` (planned parts,
data flow), `kb/06-todos.txt` (milestones M0..M3 with done-criteria), `kb/11-decisions.txt` (D-2..),
`kb/19-sources.txt` (links read), `kb/12-open-questions.txt`.
Do not write product code in this chat unless the user asks. Offer M0 (skeleton runs, one test passes)
as the next session's first task.

## Step 3B. Existing code: understand it completely, change nothing
1. Snapshot: `git tag kbsmith-baseline-YYYY-MM-DD` (local tag, so every later change is traceable).
2. Launch 4-5 read-only Explore subagents in parallel, each with a clear brief:
   - structure: folders, entry points, how it starts, build system
   - core flows: trace the 2-3 most important user flows end to end, with `path:line`
   - data: models, storage, external APIs, auth, secrets handling (names only, never values)
   - quality: tests (how to run, what is covered), lint, CI, obvious tech debt and risks
   - history: `git log` shape, hot files, recent work (no personal data about contributors)
3. Merge their reports into the KB: `kb/05-architecture.txt` (overview, where things live, where-to-change
   map, do-not-touch list), `kb/03-environment.txt` (install, run, test, deploy commands, verified by
   actually running the safe ones), `kb/14-testing.txt`, `kb/10-security.txt`, `kb/24-learning-notes.txt`
   (glossary of project terms), `kb/12-open-questions.txt` (what the code does not answer).
4. Spot-check 3 claims yourself against the code before calling it done. Wrong facts in the KB are
   worse than missing ones.
5. Offer `/tour <system>` for any part the user wants to understand deeply.

## Step 4. Fill the rules
In `kb/AGENTS.md`: replace `{{GOAL}}` with one line, and `{{DOMAIN_RULES}}` with 3-8 short rules from
the interview (authorship, what Claude may run, never-touch areas, style). Keep the file under 6 KB.
Fill `kb/02-status.txt`: STATUS, NEXT (3 concrete items), one LOG line.

## Step 5. Tune Claude Code (asks once)
Ask which permission profile to use, with this recommendation:
- `trusted` (recommended for your own code on your own machine): bypassPermissions, no prompts,
  plus a deny list that still blocks `rm -rf`, force-push, hard reset and reading `.env`/SSH keys.
- `balanced`: edits run freely, other shell commands ask.
- `careful` (use with client data, production or secrets nearby): asks before everything.
Also offer extras: `subagent-haiku` (cheaper subagents), `statusline` (shows context size).
Run the dry run, show it, then apply after the user says yes:
```
npx -y github:nickpalade/kbsmith tune --profile <profile> --extras statusline,subagent-haiku
npx -y github:nickpalade/kbsmith tune --profile <profile> --extras statusline,subagent-haiku --yes
```
Optional, tell the user they can type these themselves: `/plugin marketplace add JuliusBrussee/caveman`
then `/plugin install caveman@caveman` (terser replies, fewer output tokens).
If the user wants to disable unused plugins or MCP servers, point them at `/plugin` and `/mcp`.

## Step 6. Team (only if they said team)
```
npx -y github:nickpalade/kbsmith team enable --owner <github-user-or-org> --repo <name>
node .kbsmith/scripts/team/join.mjs <id> "<Full Name>" "<role>"
```
Then, after an explicit yes: commit, `gh repo create <owner>/<repo> --private --source . --remote origin --push`,
and invite each teammate (`gh api -X PUT repos/<owner>/<repo>/collaborators/<login> -f permission=push`).
Never change organisation-wide permissions. Guide for teammates: `docs/TEAM.md` in the kbsmith repo.

## Step 7. Check and commit
1. `node .kbsmith/scripts/kb-lint.mjs` (0 errors) and `npx -y github:nickpalade/kbsmith doctor`.
2. Commit only the kbsmith files: `git add kb .kbsmith .claude CLAUDE.md .gitignore` (plus `people`
   and `.gitattributes` in team mode), message `docs: install kbsmith knowledge base`.

## Step 8. Hand over (max 12 lines)
- What was set up and where the KB is.
- The 3 things to know: say "add this to the kb" to make anything permanent; `/clear` between tasks
  (the KB means nothing is lost); `/handoff` before you stop for the day.
- Commands: `/kb-status`, `/kb-update`, `/remember`, `/postmortem`, `/tour`, `/handoff`.
- Restart Claude Code once so the new hooks and permission mode load (approve the hooks if asked).
- The first task for the next session (from `kb/02-status.txt` NEXT).
