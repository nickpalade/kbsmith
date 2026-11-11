# How to prompt with kbsmith

This guide comes from one heavy user's real history: **3,123 typed prompts across 737 sessions**,
analysed for what worked and what wasted turns. The style is not formal. 91% of the prompts start
lowercase, 93% have no closing punctuation, and the median prompt is **68 characters**.
Short prompts work when the context lives in files and not in your head.

> The core idea: **put durable context in the KB and keep the prompt for the one thing that changes.**
> "check the kb, then add the export button" beats three paragraphs of re-explaining every time.

---

## The 15 rules

1. **Front-load the request.** Goal, constraints, what "done" looks like and the files involved, all in one message. One requirement per line.
2. **Paste the evidence, not a description.** Exact error text, a screenshot, the actual message from a teammate. Distil huge pastes first (see A2).
3. **Ask for research and options when you don't know.** "research this, give me 2-3 approaches, recommend one". You keep the decision.
4. **Ask for agents by name and give each one a job.** "one agent per folder; discard each when done". Each one has a small context, so you get small bills.
5. **Make Claude the tester.** Ask for test output, logs and screenshots. Judge the result yourself.
6. **Say "add this to the kb".** Anything you'd hate to explain twice goes in a file. Next time say "check the kb first".
7. **Fence the scope.** "only touch `src/billing/`. don't change the API." Small diffs are easy to review and easy to revert.
8. **Correct with a location and a suspicion.** "no, `parseDate` ignores the timezone param, check it". Not just "wrong".
9. **After two failed fixes, stop.** Ask for the root cause, a reproduction and what was ruled out. kbsmith's retry guard does this for you.
10. **For long runs, give a stop condition and checkpoints.** "commit after each green step; stop when X passes or you hit Y".
11. **Use a plan or todo file as the handoff.** The next session reads the file, not your chat history.
12. **One task per session; `/clear` between tasks.** The KB carries what matters across.
13. **Pick a default model and effort.** Switch only for design decisions and hard bugs. Check `/usage` near your limits.
14. **Turn repeated instructions into commands.** If you type the same style rule three times, make it a `/command`.
15. **Snapshot before broad changes.** A commit or a tag. "make it nicer" without one means "revert" costs a lot.

---

## 14 techniques that showed up again and again

| # | Technique | Example | Why it works |
|---|---|---|---|
| T1 | Brain-dump with pasted source | "changes: [1] research X [2] update the config with what you found [3] …" + pasted notes | All requirements land in one turn; fewer correction rounds |
| T2 | Research, then options | "research what X means, give me 2-3 approaches that actually work. run several agents" | Turns a vague goal into a decision you make |
| T3 | Parallel fan-out with cleanup | "launch an agent per folder to write a short md of what each file does, so future sessions can read it" | Small contexts, and the summaries become cheap context later |
| T4 | Claude as tester | "take screenshots of every state and check each one" | You judge evidence, not claims |
| T5 | Durable memory | "[pasted notes] add this to kb" / "check the kb for the style rules, then change the code" | Survives `/clear` and new sessions |
| T6 | Evidence-based correction | "no, check it yourself. that function isn't passing the param, I think it's using the default" | Narrows the search to one spot |
| T7 | Symptom + hypothesis | "still doesn't fit. the box might be hitting a min height. needs padding so it scales" | Gives a direction instead of a mood |
| T8 | Autonomy with a stop | "going to sleep. keep going until M2 is done, test every edge case, commit each green step" | Claude knows when it is finished |
| T9 | Plan files as handoff | "make a very detailed todo list, then work through it" | Progress is visible, sessions are interchangeable |
| T10 | Many sessions, one project | "another session is building the test setup; draft the content now, start when the lock is free" | Parallel terminals without collisions |
| T11 | Scope fences | "only change the header. keep the diff small" | Reviewable, revertable |
| T12 | Style as commands | `/humanizer`, `/remove-em-dashes`, "use the skill" | Same quality every time, fewer tokens |
| T13 | Short chained steps | "ok now push it", "now test both", "keep going" | The context is already loaded, so short turns are fast |
| T14 | Model + effort control | `/model` for hard design, `/effort medium` by default | Match cost to difficulty |

---

## 8 anti-patterns (and what they cost)

| # | Anti-pattern | Seen | Fix |
|---|---|---|---|
| A1 | "still not working" with no new info | 4.5% of prompts | Symptom + what you tried + a hypothesis. After 2: `/postmortem` |
| A2 | Giant raw pastes (up to 49,000 characters) | a few per month | Drop raw files in `inbox/`, ask Claude to distil them into KB lines |
| A3 | Sessions that run out of context | 184 auto-compactions | `/clear` between tasks; state in files; `/handoff` |
| A4 | "keep going for hours" with no checkpoints | 57 sessions > 2 h | Stop condition + commit per green step |
| A5 | Interrupting mid-edit | 17.6% of follow-ups < 30 s | Put the stop point in the original prompt |
| A6 | Model flip-flopping under quota pressure | 129 switches | A default model; switch on purpose |
| A7 | CAPS and swearing | ~5% of prompts | One precise observation carries more signal |
| A8 | "make it nicer" with no snapshot | several reverts | Tag first; name the target state |

---

## Copy-paste templates

**Daily start**
```
/clear
check the kb. today: (1) <item> (2) <item>. test each change with <how>, tell me the result.
```

**Feature**
```
goal: <one sentence>
- <requirement>
- <requirement>
done when: <a check you can see: a test passes, a screenshot shows X>
only touch: <paths>. don't touch: <paths>.
research options first and give me 2-3, then wait.   (or: go with the simplest that works)
```

**Bug, after the second failed attempt**
```
still broken. observed: <exact error / screenshot>. expected: <behaviour>. tried: <list>.
don't edit yet. give me the 2-3 likeliest causes with evidence and how to confirm each.
then fix the likeliest and show the test output.
```
(or just `/postmortem <symptom>`)

**Research**
```
question: <question>. run 3 agents: <a>, <b>, <c>. each returns sources, a one-paragraph
answer and a confidence level. combine into a table with a recommendation. no code yet.
add the sources to the kb.
```

**End of session**
```
/handoff
```

**Overnight run**
```
goal: <milestone>. done when: <checks>. work through kb/06-todos.txt in order, commit after
each step that passes its test, keep evidence. don't touch <paths>. if blocked > 20 min, write
the blocker in the todo file and move on. stop when done or before anything destructive.
summary at the end: done / failing / next.
```

**Make something permanent**
```
/remember we deploy only from main, never from feature branches
```

---

## Why short prompts work here

Without a KB, every session starts from zero and you re-explain the project. With one, the
SessionStart hook tells Claude where the rules, the status page and the lessons are. "check the
kb" costs you three words and Claude reads only the file it needs. Your prompt carries the delta.
Everything stable already lives in git.
