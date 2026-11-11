---
description: Hub mode - create a new project folder wired into the KB (args - name and goal)
---
Run `node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/new-project.mjs" $ARGUMENTS` (first word = name,
rest = goal in quotes). Show the output. Then plan before code: interview the human briefly
(users, scope, stack, done-criteria), research options with subagents, fill
`projects/<name>/PLAN.md` and `kb/projects/<name>.txt`, and propose milestone M0.
