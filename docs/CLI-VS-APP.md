# Why the CLI

kbsmith works anywhere Claude Code reads its settings files: the CLI, the desktop app and the IDE
extensions all share `~/.claude/settings.json` and `.claude/settings.json`. **We recommend the
terminal**, for workflow reasons. There is no documented token-price difference between them,
so this is not a cost claim.

## 1. Many Claudes at once

The biggest reason. In a terminal you open five tabs and run five Claude Code sessions on five
parts of the work: one audits, one writes tests, one researches a library, one fixes the bug you
just found, one updates docs. Each has a small, focused context. Together they finish in the time
one would take.

kbsmith is built for this:
- The KB is the shared memory. Every session reads the same rules, status and lessons.
- The status page and todo file are the handoff. Sessions don't need each other's chat history.
- Rule 6 in `kb/AGENTS.md` (arm an auto-resume) lets a session wait for another one's build, lock or
  commit without you babysitting it.

## 2. The chat clears when you shut down, and that's a feature

It doesn't sound like a benefit. Restart the computer and the terminal sessions are gone.
After months of daily use, the author counts it as one of the best things about the CLI:

- **Less stale context and less hallucination.** A long-resumed session carries hours of old
  assumptions, superseded plans and half-true summaries from compaction. A fresh session reads
  the current KB and the current code, so it works from what is true now, not from what was true
  yesterday afternoon.
- **You stay the one who knows what's going on.** When `/resume` is right there, it's tempting to
  pick up where the AI left off without re-reading anything. When the chat is gone, you write a
  fresh prompt, which means you have to think again about where things stand. That small friction
  keeps you, the human (or the vibe coder), actually understanding the project instead of riding
  along.
- **The KB makes it free.** The usual reason to resume is "I'd lose everything". With kbsmith
  nothing important lives only in the chat. `/handoff` writes the state to the KB before you stop.
  The next session starts with a SessionStart line that points at the status page, and you're back
  in context in one prompt.

This is the author's experience, not a controlled study. But it is why kbsmith treats
"state lives in files, chat is disposable" as a core rule.

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

## When the app is the better tool

To be fair, the desktop app has things the terminal doesn't:
- **Cloud sessions** that keep running after you close the laptop.
- **Visual diff review** with inline comments, which is faster than reading terminal diffs.
- A browser preview pane, computer use, and starting tasks from your phone.

Good split: do the daily driving in terminals with kbsmith, and send a long unattended job to a
cloud session when you need to walk away. Both read the same KB.
