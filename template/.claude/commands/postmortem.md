---
description: Stop retrying. Find why the current problem keeps failing and write the lesson down
---
Stop retrying the current fix. Follow the POSTMORTEM PROCEDURE in `kb/25-mistakes-and-lessons.txt`:
1. List every attempt in this session and why each failed, with evidence (output, logs).
2. Check `kb/25` for a matching past lesson first.
3. Prove the real root cause (read code, logs, docs, `--help`). Mark unproven parts INFERRED.
4. Say plainly where you went wrong (wrong assumption, skipped check, stale fact).
5. Write the entry in `kb/25`, fix any KB file that was wrong, commit the KB.
6. Only then propose (or apply) the fix that follows from the root cause.
Problem: $ARGUMENTS
