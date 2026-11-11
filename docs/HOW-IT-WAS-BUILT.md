# How kbsmith was built

## Where it came from

kbsmith is not a framework someone designed on a whiteboard. It's the setup one person grew
over months of daily Claude Code use across very different work: a software job, a small
company's internal knowledge, a startup, university courses and personal projects. Each area got
its own plain-text knowledge base, and the same patterns kept proving themselves:

- **Numbered files plus an index** beat one giant CLAUDE.md. Claude reads the index, then one file.
- **Every fact gets a source and a date.** "per user 2026-10-13", "code: src/x.ts:42". Guesses are
  marked INFERRED, half-remembered things VERIFY. That stops the KB slowly filling with confident
  nonsense.
- **Hooks keep it honest.** A KB that isn't updated rots. The Stop hook catches it the same turn.
- **Lessons are files.** After the same fix fails twice, writing down *why Claude got it wrong*
  stopped the same mistake from coming back.
- **Plan before code.** New work starts as research, options, a decision and a todo list.
- **Chat is disposable, the KB is not.** That's why `/clear` and fresh sessions are cheap.

kbsmith is those patterns with everything personal removed, packaged so anyone can install them.

## Made with one prompt

The repo was built in a single Claude Code conversation from one long prompt describing what
the author wanted: a one-chat install, an interview, research before code, a deep audit for
existing projects, a prompting guide from real history, honest token numbers, the CLI argument,
team mode and a storyline README.

During that conversation Claude Code:
1. Ran **parallel research agents**: competitor KB tools, Claude Code settings and hooks docs,
   team sync with `gh`, plugin packaging, and analysis of the author's real prompt and usage
   history (3,123 prompts, a month of transcripts).
2. Distilled the author's existing knowledge bases into a generic template, stripping every
   project, company and person.
3. Wrote the CLI (`init`, `tune`, `doctor`, `team`), the hook scripts, slash commands and tests,
   with zero runtime dependencies.
4. Wrote these docs. All numbers come from parsed transcripts, not estimates.
5. Ran review agents for code quality, privacy leaks and README clarity.

The human steered with short follow-ups ("keep going", "the kb should learn the user's name over
time") and reviewed the result. That workflow is exactly what kbsmith is for.

## Design choices

| Choice | Why |
|---|---|
| Plain text, git | Readable by humans and models, diffable, zero infra |
| Zero dependencies, Node ≥ 18 | `npx` installs in seconds; nothing to audit but our own code |
| Never overwrite | Safe to run on any repo, any number of times |
| Dry-run by default for user settings | Changing `~/.claude/settings.json` affects every project |
| Hooks print short lines | Session context stays small; Claude reads files on demand |
| Lint in the box | Catches secrets, missing index lines and oversized rules files |
| `gh` for teams | Everyone already has GitHub; private repos are free |
