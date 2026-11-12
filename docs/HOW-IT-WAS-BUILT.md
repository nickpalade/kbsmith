# How kbsmith was built

## Where it came from

I didn't design kbsmith up front. It's the setup I grew over months of using Claude Code every
day, across very different kinds of work: code, business docs, studying, side projects. Each area
got its own plain-text knowledge base, and the same few patterns kept working everywhere.

Numbered files with an index beat one giant CLAUDE.md, because Claude reads the index and then
opens one file. Every fact gets a source and a date ("per user YYYY-MM-DD", "code: src/x.ts:42"),
guesses are marked INFERRED and half-remembered things VERIFY. Without that, a KB slowly fills up
with confident nonsense.

A KB nobody updates goes stale fast, so the Stop hook catches it in the same turn. Lessons get
their own file too. Once a fix had failed twice, writing down why Claude got it wrong was what
finally stopped the same mistake from coming back.

New work starts as research, then options, a decision and a todo list, before any code. And the
chat is disposable while the KB isn't, which is why `/clear` and fresh sessions cost so little.

kbsmith is those patterns with everything personal taken out, packaged so anyone can install them.

## Made with one prompt

The repo came out of a single Claude Code conversation. I started it with one long prompt
describing what I wanted: a one-chat install with an interview, research before code, a deep audit
for existing projects, a prompting guide based on real history, honest token numbers, the case for
the CLI, team mode, and a README that tells a story.

During that conversation Claude Code:
1. Ran research agents in parallel on competing KB tools, the Claude Code settings and hooks docs,
   team sync with `gh`, plugin packaging, and my own prompt and usage history (3,123 prompts, a
   month of transcripts).
2. Turned my existing knowledge bases into a generic template, stripping every project, company
   and person.
3. Wrote the CLI (`init`, `tune`, `doctor`, `team`), the hook scripts, the slash commands and the
   tests, with zero runtime dependencies.
4. Wrote these docs. The numbers come from parsed transcripts, not estimates.
5. Ran review agents for code quality, privacy leaks and how clear the README was.

I steered with short follow-ups ("keep going", "the kb should learn the user's name over time")
and reviewed what came out. Which is pretty much the workflow kbsmith is meant to support.

## Design choices

| Choice | Why |
|---|---|
| Plain text, git | Humans and models can both read it, it diffs, no infrastructure |
| Zero dependencies, Node ≥ 18 | `npx` installs in seconds, and the only code to audit is ours |
| Never overwrite | Safe to run on any repo, as many times as you like |
| Dry run by default for user settings | `~/.claude/settings.json` affects every project |
| Hooks print short lines | Session context stays small; Claude reads files when it needs them |
| Lint included | Catches secrets, missing index lines and an oversized rules file |
| `gh` for teams | Everyone already has GitHub, and private repos are free |
