# Why the CLI

kbsmith works anywhere Claude Code reads its settings files. The CLI, the desktop app and the IDE
extensions all share `~/.claude/settings.json` and `.claude/settings.json`. I still recommend the
terminal, for workflow reasons. As far as I know there's no token price difference between them,
so this isn't about cost.

## 1. Many Claudes at once

This is the main reason. In a terminal you can open five tabs and run five Claude Code sessions on
five parts of the work: one audits, one writes tests, one researches a library, one fixes the bug
you just found, one updates the docs. Each one keeps a small, focused context, and together they
finish in about the time one session would take on its own.

kbsmith is built for working this way. The KB is the shared memory, so every session reads the same
rules, status and lessons. The status page and todo file are the handoff, so sessions don't need
each other's chat history. And the background-watcher rule in `kb/AGENTS.md` lets one session wait
for another's build, lock or commit without you babysitting it.

## 2. The chat is gone when you shut down (I like that)

Restart the computer and your terminal sessions are gone. That sounds like a downside. After months
of daily use, I count it as one of the best things about the CLI.

A session you keep resuming carries hours of old assumptions, plans you already dropped, and
half-true summaries from compaction. A fresh one reads the current KB and the current code, so it
works from what's true now instead of what was true yesterday afternoon. In my experience that
means less stale context and fewer made-up answers.

It also keeps you in charge. When `/resume` is right there, it's tempting to pick up where the AI
left off without re-reading anything. When the chat is gone, you have to write a new prompt, and
that means thinking about where things actually stand. It's a small bit of friction, and it's what
keeps you (or the vibe coder) actually understanding the project instead of just riding along.

The KB is what makes this cheap. People resume because they're afraid of losing everything. With
kbsmith nothing important lives only in the chat. `/handoff` writes the state to the KB before you
stop, the next session's start line points at the status page, and one prompt gets you back in
context.

This is my experience, not a controlled study. It's still the reason kbsmith treats "state lives in
files, chat is disposable" as a core rule.

## 3. Everything is scriptable

| Capability | CLI | Desktop app |
|---|---|---|
| Many parallel sessions in tabs / tmux | yes | yes, per window |
| Fresh context on every restart (see above) | default | sessions persist |
| Hooks (kbsmith's SessionStart / Stop / retry guard) | yes | reads the same settings files (VERIFY per version) |
| Statusline (context size always visible) | yes | VERIFY |
| `/config` settings UI | yes | no (edit files) |
| `dontAsk` permission mode for unattended runs | yes | no |
| Headless `claude -p "..."` for scripts and CI | yes | no |
| Shift+Tab to cycle permission modes | yes | no |

## Where the app is better

The desktop app does have things the terminal doesn't. Cloud sessions keep running after you close
the laptop. Diff review is visual, with inline comments, which beats reading diffs in a terminal.
It also has a browser preview pane and computer use, and you can start tasks from your phone.

What works for me: do the daily driving in terminals with kbsmith, and hand a long unattended job
to a cloud session when I need to walk away. Both read the same KB.
