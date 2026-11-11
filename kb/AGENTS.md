# kbsmith: agent rules

Loaded into every Claude Code session (via `@kb/AGENTS.md` in CLAUDE.md). Keep this file short:
rules and routing only. Detail lives in the numbered `kb/NN-*.txt` files, read on demand.

Goal: Ship kbsmith: a zero-dependency installer that gives any Claude Code project a plain-text, git-tracked knowledge base with hooks, a one-chat setup, tuning profiles and team sync.

## 0. Consult before answering
1. Read `kb/00-INDEX.txt` to find the right file. Read only what the task needs.
2. Answer from the KB and cite the file (`kb/11-decisions.txt`). If the KB lacks it, say so,
   then check the code or the official docs. Never invent facts about this project.
3. Before retrying a failed fix, read `kb/25-mistakes-and-lessons.txt` for a matching lesson.

## 0b. Know the user (learned over time)
Read `kb/08-user.txt` at the start of a task: use their name, match their style.
When the user states a fact about themselves (name, role, preference) or corrects you,
add one dated line there (`per user YYYY-MM-DD`). Don't know their name yet? Ask once.
Work-relevant facts only; ask before storing anything personal.
Team mode: the `TEAM USER:` line names the person; their file is `people/<id>/profile.txt`.

## 1. The human owns the work
Claude researches, drafts, tests and does chores. The human decides and ships.
- Design choices: offer 2-3 options with trade-offs, recommend one, let the human pick.
  Record the choice in `kb/11-decisions.txt`.
- Every draft comes with a short walkthrough: what it does, how it fits, what is risky.
- Never ship (push, deploy, publish, message someone) without the human's go.

## 2. Change only what is needed
Touch only what the request needs. No drive-by refactors, renames or reformatting.
Snapshot (commit or tag) before broad changes so they can be reverted cheaply.

## 3. Evidence before "done"
Run the real check (tests, build, a run, a screenshot) and show the result. Say what was
not verified. Plan first for anything over ~3 files: list the steps, then do them.

## 4. Self-correcting (lessons)
When a fix fails twice, or the human says "still not working" twice, STOP retrying.
Run `/postmortem`: list attempts, prove the root cause, write the lesson into
`kb/25-mistakes-and-lessons.txt`, fix any KB fact that was wrong, commit, then fix.

## 5. Keep the KB current (it is memory, not a copy of the code)
- After work: update `kb/02-status.txt` (STATUS, a dated LOG line, NEXT). The Stop hook
  reminds you once if code changed after the status page.
- New durable fact: edit the matching `kb/NN` file; never create a duplicate.
- Notable event: one dated line in `kb/04-timeline.txt`. Done todos move to DONE with a date.
- Tag every fact with a source and date: `per <person> YYYY-MM-DD`, `docs YYYY-MM-DD`,
  `code: path:line`. Guesses are marked INFERRED; facts from memory are marked VERIFY.
- New topic: next free number, plus one line in `kb/00-INDEX.txt`.
- Records with fixed fields that you filter or update by id (task board, phased plan, API
  contract) may go in a companion `kb/NN-name.xml`, sparingly. One element per record, fields
  as attributes: `<task id="T1" status="open|doing|blocked|done" owner="" deps="">Title</task>`.
  The .txt keeps context and points to it; never copy items between them. Prose stays .txt.
- Commit the KB alone: `git add kb && git commit -m "docs: <what changed>"`.

## 6. Waiting on something: start a background watcher
Never end a turn with "waiting for X, tell me when". If blocked on something that changes
by itself (a build, a server, a lock), start a background command that exits when the
condition is true (with a timeout), say in one line what you wait for, and continue when it fires.

## 7. Context hygiene (saves tokens)
- Durable state goes in files (KB, todo, plan), never only in chat. Then `/clear` is free.
- Big searches and research go to subagents; only their summary enters this context.
- Distil large pastes (logs, chats, exports) into short KB lines; raw drops go in `inbox/`
  (git-ignored).

## 8. Privacy and safety
Never store passwords, API keys, tokens, cookies or recovery codes: write
"stored in <password manager / .env>". Other people's private data stays out.
Destructive or outward-facing actions (delete, force-push, deploy, send) need the human's OK.

## 9. Project-specific rules
- template/ is what users get. Changes to kbsmith's own KB go in kb/, never in template/kb/.
- SETUP.md and template/.kbsmith/SETUP.md must stay identical (a test checks it).
- Zero runtime dependencies. Node >= 18 built-ins only.
- init never overwrites a user's file. tune is a dry run unless --yes.
- Public repo: no real people, projects, companies, emails or local paths in any file.
- Numbers in docs come from measured data with caveats, never estimates.
