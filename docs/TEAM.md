# Team mode: one KB, the whole team

This is for small teams and startups. Everyone's Claude Code reads and writes the same knowledge
base, which lives in a private GitHub repo and syncs with plain `git` and `gh`. You don't need a
server or a paid service.

## What you get

A decision someone makes on Monday is in everyone's context on Tuesday. At session start, Claude
prints what your teammates changed since you last worked, grouped by person.

Claude also knows who it's talking to. `people/people.json` maps git names and GitHub logins to
people, and each person has a `people/<id>/profile.txt` that Claude fills in over time (name, role,
how they like to work).

A few smaller things:
- Files nobody has touched in `staleDays` (default 30) get flagged.
- `decide.mjs` appends to `kb/11-decisions.txt` and records who decided.
- Auto-sync at the end of each turn is available, but it's opt-in and per person.

## Founder: set it up (once)

```bash
npx -y github:nickpalade/kbsmith init          # if not done yet
npx -y github:nickpalade/kbsmith team enable --owner <org-or-user> --repo <team-kb>
```

`team enable` only changes local files: the config, `.gitattributes`, team hooks and an empty
`people/people.json`. Then it prints the `gh` commands without running them. Run them yourself, or
tell Claude "yes, run them":

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
From then on Claude greets you by name. If it doesn't recognise you (new laptop, different git
name), the session-start line tells you to run `team join` again. Running it twice merges; it won't
create a duplicate.

## How syncing works

| When | What happens | Safety |
|---|---|---|
| Session start | `git pull --ff-only` | Never merges or rewrites. If it can't fast-forward it says so and stops |
| End of turn (only if auto-sync is on) | stages allowed paths only, scans for secrets, `pull --rebase`, push | Aborts on any conflict, never force-pushes, never touches `inbox/` or `.env*` |
| Any time | You commit and push like any repo | Normal git |

To turn on auto-sync just for yourself, put this in `.claude/settings.local.json` (not shared):
```json
{ "env": { "TEAM_AUTOSYNC": "1" } }
```
For everyone, set `"autoSync": true` in `.kbsmith/config.json` (or use `team enable --auto-sync`).

## Conflicts

| Situation | What kbsmith does | What you do |
|---|---|---|
| Two people append to the timeline, decisions or lessons | `merge=union` in `.gitattributes` keeps both lines | Nothing |
| Two people edit the same line of another file | Sync stops, nothing is pushed | Ask Claude: "resolve the kb merge conflict, keep both meanings" |
| Someone edits your `people/<you>/` folder | Flagged in "since last session" | Check it |
| Secret-looking text in a staged change | Push refused, file named | Remove it and store it in a password manager |
| Rebase already in progress | Sync skipped | Finish or abort it by hand |

## Privacy

Profiles hold work facts only: name, role, how someone likes to work. Nothing a person wouldn't put
on a team wiki, so no addresses, health or salary. Claude asks before recording anything personal.
Everyone can read everyone's profile, and it's worth telling your team that up front.

Never commit passwords, keys or tokens. `kb-lint` and the sync secret scan catch the common shapes,
but not all of them. `inbox/`, where raw dumps go, is git-ignored and never synced.

## Org-wide settings stay untouched

kbsmith and its setup instructions never change GitHub organisation permissions, base roles, branch
protection or member lists. The only thing they do is add collaborators to the one KB repo, and only
after you say yes. Any org changes are for an org owner to make by hand.

## Team + parallel terminals

Each teammate can run several Claude sessions at once. The rules in `kb/AGENTS.md` still apply:
claim a todo before you work on it, write state into files, and `/handoff` before you stop. The KB
coordinates people and sessions the same way.
