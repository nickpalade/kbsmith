---
description: Bring the KB up to date with what changed (git log, diff, this session)
---
Update the knowledge base from what actually changed. Use the kb-keeper agent if the diff is large.
1. `git log --oneline -15` and `git diff --stat HEAD~5..HEAD 2>/dev/null` (or since the last LOG date).
2. Update the status page: STATUS line with today's date, one dated LOG line per session, NEXT.
3. Durable facts go to the matching `kb/NN` file (decisions -> 11, lessons -> 25, new concepts -> 24,
   architecture -> 05, environment -> 03, user facts -> 08). Edit, never duplicate.
4. Notable events: one line in `kb/04-timeline.txt`. Done todos move to DONE with the date.
5. Run `node .kbsmith/scripts/kb-lint.mjs` and fix errors.
6. Commit the KB only: `git add kb && git commit -m "docs: kb update"`.
$ARGUMENTS
