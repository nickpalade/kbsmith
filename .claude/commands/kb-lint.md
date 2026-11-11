---
description: Check the KB for broken links, missing index lines, placeholders and leaked secrets
---
Run `node "$CLAUDE_PROJECT_DIR/.kbsmith/scripts/kb-lint.mjs"`. Fix every error (missing index
lines, dead `kb/NN` references, anything that looks like a secret). List warnings and ask
before filling placeholders that need the human's input.
