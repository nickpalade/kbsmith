# Team mode: one KB, the whole team

For small teams and startups. Everyone's Claude Code reads and writes the same knowledge base.
The KB lives in a **private GitHub repo** and is synced with plain `git` and `gh`. There is no
server, no database and no paid service.

## What you get

- **Shared memory.** A decision one person makes on Monday is in everyone's context on Tuesday.
- **"Since last session".** At session start Claude prints what teammates changed since you last
  worked, grouped by person.
- **Who's who.** `people/people.json` maps git names and GitHub logins to people. Each person has
  `people/<id>/profile.txt`, which Claude learns over time (name, role, how they like to work).
- **Stale-file warnings.** Files nobody touched in `staleDays` (default 30) are flagged.
- **Decisions with names.** `decide.mjs` appends to `kb/11-decisions.txt` with "decided by".
- **Optional auto-sync** at the end of each turn (opt-in, per person).

## Founder: set it up (once)

```bash
npx -y github:nickpalade/kbsmith init          # if not done yet
npx -y github:nickpalade/kbsmith team enable --owner <org-or-user> --repo <team-kb>
```

`team enable` changes local files only: config, `.gitattributes`, team hooks and an empty
`people/people.json`. It then **prints** the `gh` commands. It never runs them. Run them yourself
(or tell Claude "yes, run them"):

```bash
gh repo create <org-or-user>/<team-kb> --private --source . --push
gh api -X PUT repos/<org-or-user>/<team-kb>/collaborators/<teammate-login> -f permission=push
```

Then register yourself:
```bash
npx -y github:nickpalade/kbsmith team join <your-id> "<Your Name>" "<role>"
```

## Teammate: join (2 minutes)

```bash
gh auth login                                   # once per machine
gh repo clone <org-or-user>/<team-kb>
cd <team-kb>
npx -y github:nickpalade/kbsmith team join sam "Sam Lee" "backend"   # id: lowercase
claude
```
Claude greets you by name from then on. If it doesn't recognise you (a new laptop or another git
name), the session-start line tells you to run `team join` again. It merges, never duplicates.

## How syncing works

| When | What happens | Safety |
|---|---|---|
| Session start | `git pull --ff-only` | Never merges or rewrites. If it can't fast-forward it says so and stops |
| End of turn (only if auto-sync is on) | stages **allowed paths only**, scans for secrets, `pull --rebase`, push | Aborts on any conflict, never force-pushes, never touches `inbox/` or `.env*` |
| Any time | You commit and push like any repo | Normal git |

Turn on auto-sync for yourself only, in `.claude/settings.local.json` (not shared):
```json
{ "env": { "TEAM_AUTOSYNC": "1" } }
```
Or for everyone: `"autoSync": true` in `.kbsmith/config.json` (`team enable --auto-sync`).

## Conflicts

| Situation | What kbsmith does | What you do |
|---|---|---|
| Two people append to the timeline, decisions or lessons | `merge=union` in `.gitattributes`: both lines kept | Nothing |
| Two people edit the same line of another file | Sync stops, nothing is pushed | Ask Claude: "resolve the kb merge conflict, keep both meanings" |
| Someone edits your `people/<you>/` folder | Flagged in "since last session" | Check it |
| Secret-looking text in a staged change | Push refused, file named | Remove it, store it in a password manager |
| Rebase already in progress | Sync skipped | Finish or abort it by hand |

## Privacy rules

- `people/<id>/profile.txt` holds **work** facts only: name, role, how they like to work. No
  addresses, health, salary or anything a person wouldn't put on a team wiki. Claude asks before
  recording anything personal.
- Everyone can read everyone's profile. Tell your team that up front.
- Never commit passwords, keys or tokens. `kb-lint` and the sync secret scan catch the common
  shapes, not all of them.
- `inbox/` (raw dumps) is git-ignored and never synced.

## Never change org-wide settings

kbsmith and its setup instructions never change GitHub **organisation** permissions, base roles,
branch protection or member lists. They only add collaborators to the one KB repo, and only after
you say yes. If you need org changes, an org owner makes them by hand.

## Team + parallel terminals

Each teammate can run several Claude sessions. The rules in `kb/AGENTS.md` still apply: claim a
todo before working on it, write state into files, `/handoff` before you stop. The KB is the
coordination layer for people and sessions alike.
