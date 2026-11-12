# kbsmith

Plain-text memory for Claude Code. It's a folder of numbered text files in your repo that Claude
reads, keeps up to date and learns from. There's nothing else to install or host.

Install it in one chat. Claude asks what you're building, researches the tools, and writes the
whole knowledge base before it touches any code.

You need Node 18+ and git. Open Claude Code in your project folder and paste this:

```
Set up kbsmith in this folder: run `npx -y github:nickpalade/kbsmith init`,
then read .kbsmith/SETUP.md and follow it.
```

That's the whole install.

---

## The problem

Every Claude Code session starts from zero. You explain the project again, the stack again, the
thing it broke last Tuesday again. CLAUDE.md helps until it turns into a 900-line wall that eats
context on every turn and still doesn't say what you decided yesterday.

So people do one of two things. They keep huge sessions alive with `/resume` and compaction until
the context is full of stale plans. Or they write longer and longer prompts. Both get expensive,
and Claude gets worse as the context fills up with old stuff.

## What kbsmith does instead

It gives your project a small knowledge base that lives next to the code:

```
kb/
  AGENTS.md            the rules, always loaded (kept under 6 KB)
  00-INDEX.txt         map: which file answers which question
  01-about.txt         what this is and who it's for
  02-status.txt        where things stand right now
  05-architecture.txt  how the code fits together, with file:line evidence
  06-todos.txt         what's next
  08-user.txt          you: name, how you like to work, corrections you've made
  11-decisions.txt     what was decided, when, and why
  25-mistakes-and-lessons.txt   why things failed, so they don't fail twice
  ...
```

Claude reads the index, then only the file it needs. Every fact has a source and a date
("per user YYYY-MM-DD", "code: src/api.ts:42"). Guesses are marked INFERRED so they can't quietly
turn into facts.

It's all plain text, with one exception. If something is really a table, like a task board that
several sessions update or a plan with dependencies, it can go in a small `.xml` file next to the
`.txt`, one line per task. The text file keeps the reasoning and points to it. Most projects never
need one.

Three hooks run alongside it:

- At session start Claude gets three or four short lines: where the KB is, whether the status page
  is stale, and your name.
- When a turn ends and code changed but the status page didn't, the Stop hook asks Claude
  to update it. It blocks at most once per turn, so it can't get stuck in a loop.
- When you type "still not working" for the second time, the retry guard tells Claude to stop
  guessing, find the root cause, and write the lesson down before trying again.

It learns who you are over time, too. Your name, how much explanation you want, the thing you
corrected it on last week. All in `kb/08-user.txt`, which you can read and edit.

## Setup takes one conversation

After `init`, Claude follows [SETUP.md](SETUP.md):

1. One message of questions. Name, what you're building, the stack, how you like to work, what
   it may run, what's sensitive, solo or team.
2. New project? Three research agents compare tools and approaches. You get 2-3 options and a
   recommendation, then the architecture, todos and decisions get written down. No code yet.
3. Existing project? It tags a baseline, then four or five agents map the code in parallel:
   structure, main flows, data, quality, history. The findings go into the KB with file:line
   evidence, and Claude spot-checks three of its own claims before trusting them. Then it offers a
   guided `/tour` of any system you want to understand.
4. Tuning. It applies settings that cut token use and asks which permission profile you want.
5. Handover. A short summary and "restart Claude Code".

Other ways to install:

```bash
# as a plugin
/plugin marketplace add nickpalade/kbsmith
/plugin install kbsmith@kbsmith
/kbsmith:setup

# or by hand
npx -y github:nickpalade/kbsmith init            # one project
npx -y github:nickpalade/kbsmith init --mode hub # one KB for many projects
```

Zero dependencies. `gh` is only needed for team mode.

## Real numbers

I got these by parsing a month of transcripts from one real project on the $20 Pro plan. That's
one person and one project, so treat it as an example rather than a benchmark.

| | |
|---|---:|
| Sessions | 75 |
| Prompts typed | 530 |
| Active hours | 71.9 |
| API calls per prompt | ~24 |
| Share of active time that was Claude working | 82% |
| Longest unattended run | 47.9 min |
| Value at API list prices | $874 (about 44x the plan) |

A typical prompt was 68 characters, something like "check the kb, do the next todo". That
works because the context lives in files, not in the prompt.

Two caveats. The same month hit the usage cap 85 times, so this doesn't make a plan
unlimited. And the efficiency got better as the KB filled up (26% fewer uncached
tokens per prompt by the end), but there was no controlled before/after test. Full breakdown,
caveats and every setting explained: [docs/TOKENS.md](docs/TOKENS.md).

## Use the terminal

kbsmith works in the desktop app and IDE extensions too, since they all read the same settings
files. But I'd recommend the CLI, for two reasons.

You can run several Claude sessions in separate terminal tabs, each on its own part of the work,
all reading the same KB. For me that was the biggest speedup, though that's my experience, not a
controlled test.

And when you restart the computer, your terminals are gone. You could `/resume`, but the default
is a fresh start, and I've come to like that. You don't drag yesterday's stale assumptions into
today, and writing a new prompt makes you think about where things actually stand. The KB makes
this painless because nothing important lived only in the chat. More in [docs/CLI-VS-APP.md](docs/CLI-VS-APP.md), including where the app is genuinely better.

## Permissions

`kbsmith tune` offers three profiles for `~/.claude/settings.json`. It shows a diff first and
backs up your file before changing anything.

| Profile | Mode | For |
|---|---|---|
| `trusted` | bypassPermissions + deny list | your own code on your own machine (the default I use) |
| `balanced` | acceptEdits + allow list | when you want to approve commands |
| `careful` | ask for everything | client data, production secrets, code you don't trust |

I've used bypass mode every day for months without a problem. The deny list blocks the
obvious accidents like `rm -rf` and force-push. It won't stop a determined model or a
malicious repo, so use `careful` around sensitive data.

Every profile also sets earlier auto-compaction and shorter tool output, plus medium effort for
Opus 5.5. What each setting does and why: [docs/TOKENS.md](docs/TOKENS.md).

## Teams

For startups and small teams: one KB in a private GitHub repo, shared through plain `git` and `gh`.

```bash
npx -y github:nickpalade/kbsmith team enable --owner your-org --repo team-kb   # founder, once
npx -y github:nickpalade/kbsmith team join sam "Sam Lee" "backend"            # each person, once
```

Each session starts with a fast-forward pull and a "since last session" summary grouped by person.
Claude knows who you are from `people/people.json`. Appends to the timeline and decision log merge
without conflicts. Auto-push at the end of a turn is opt-in, scans for secrets first, and never
force-pushes. It never changes org-wide GitHub settings either. Details in [docs/TEAM.md](docs/TEAM.md).

## Commands

| Command | Does |
|---|---|
| `/kb-status` | what's stale |
| `/kb-update` | bring the KB up to date with recent changes |
| `/remember <fact>` | file a fact in the right KB file |
| `/handoff` | write the state down before you stop |
| `/postmortem` | stop retrying, find the root cause, record the lesson |
| `/tour <system>` | guided read-only walkthrough of part of the codebase |
| `/new-project` | create a new project folder and KB page (hub mode) |
| `/kb-lint` | check for secrets, missing index lines, oversized rules |

Plus `kbsmith doctor` in the terminal when something seems off.

## Compared to other approaches

| | kbsmith | One big CLAUDE.md | Notes app / vault | Memory MCP server |
|---|---|---|---|---|
| Lives in your repo, in git | yes | yes | usually not | no |
| Claude reads only what it needs | yes (index) | no, all of it every turn | depends on plugin | yes |
| Facts carry a source and date | yes | rarely | rarely | no |
| Hooks that catch a stale KB | yes | no | no | no |
| Readable without any tool | yes | yes | yes | no |
| Shared with a team | git + gh | git | sync service | depends |
| Semantic / fuzzy search | no | no | with plugins | often |
| Works with zero setup | no, one install chat | yes | no | no |

## How to prompt with it

I went through 3,123 of my own prompts to see what actually worked. The short version: put the
stable context in the KB and keep the prompt for the one thing that changes. Rules, templates and
the mistakes I kept making: [docs/PROMPTING.md](docs/PROMPTING.md).

## Made with one prompt

This repo came out of one long Claude Code conversation, started from a single prompt describing
what I wanted, using the same workflow it packages. The patterns themselves come from months of
running separate plain-text KBs for very different kinds of work.
The story: [docs/HOW-IT-WAS-BUILT.md](docs/HOW-IT-WAS-BUILT.md). Questions: [docs/FAQ.md](docs/FAQ.md).

## License

Apache 2.0 with the Commons Clause, copyright Nick Palade. Anyone can use it, change it and
share it, including at work. Nobody can sell it, or sell a product or service that's mostly kbsmith.
Details in [LICENSE](LICENSE) and [NOTICE](NOTICE).
