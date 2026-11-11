# Tokens, speed and real numbers

Everything here is either measured from real transcripts or taken from the official docs.
Nothing is made up. Where something can't be proven, it says so.

## The real numbers: one month, one project, one $20 plan

The author ran kbsmith on a real software project for about a month (29 days), on the
**$20/month Pro plan**. The numbers come from parsing every Claude Code transcript of that project.
Each API call was deduplicated, and the cost estimate was cross-checked against Claude Code's own
recorded cost: it came out within 4%.

| What | Number |
|---|---:|
| Sessions | **75** |
| Prompts typed by the human | **530** |
| Active hours (no gap over 15 minutes) | **71.9 h** |
| Share of active time spent on agent work, not waiting on the human | **82%** |
| API calls per prompt | **~24** |
| Tool calls per prompt | **~6** |
| Longest uninterrupted agent run | **47.9 min** |
| Tokens processed | **2.05 billion** (97.4% cache reads) |
| Non-cached tokens per active hour | **~0.9 million** |
| API-equivalent value consumed | **$874**, about **44×** the plan price |

What this means: one short prompt starts ~24 API calls of work. Most of the 72 hours were
Claude working and the human reviewing, not the human typing. The KB is what makes a
68-character prompt like "check the kb, do the next item" enough.

### The honest part
- **$874 is not a bill.** It is what the same usage would cost at API list prices
  (Opus 5.5 $4 / $20 per million input/output tokens, fetched 2026-11-10). The subscription costs $20.
  It shows how much a $20 plan can do when the context is lean.
- **The plan has limits.** The same month logged **85 "usage limit reached" events**. kbsmith
  stretches a plan, it does not make it unlimited. Heavy users will hit the 5-hour window.
- **The efficiency trend is observational.** From the first third of sessions to the last,
  uncached tokens per prompt fell **26%** and API calls per prompt fell **22%**, as the KB filled up and
  habits settled. There was no controlled A/B test and the sample is small (25 sessions per third),
  so read it as "it got leaner over time", not as proof.

## Where tokens actually go

**97.4% of all tokens were cache reads.** Each turn re-reads the whole conversation context
(cheaply, from cache, but it is still the biggest line). So **context size is the cost driver**.
Output length matters much less. Every saving below is really about keeping context small:

| Lever | What kbsmith does | Why it saves |
|---|---|---|
| State in files, not chat | KB + `/handoff` + status page | `/clear` becomes free, and a fresh session costs a few KB of reading instead of a 190k-token history |
| Short always-loaded rules | `kb/AGENTS.md` kept < 6 KB, linted | It is re-read on every turn of every session |
| Read on demand | Index-first routing: read `00-INDEX`, then only the file you need | No "load the whole wiki" |
| Subagents for big reads | Research and audits go to subagents | Only their summary enters your context |
| Earlier compaction | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` + `autoCompactWindow: 400000` (`tune`) | Compacts at ~200k instead of near the full window, so each turn re-reads less (VERIFY the exact math on your version) |
| Shorter tool output | `BASH_MAX_OUTPUT_LENGTH=15000` (`tune`) | Noisy logs no longer flood the context |
| Medium effort by default | `effortLevel: medium` for Opus 5.5 (`tune`) | Fewer thinking tokens on routine work; `/effort high` when it's hard |
| Cheaper subagents (opt-in) | `CLAUDE_CODE_SUBAGENT_MODEL=haiku` | Search and chores run on the cheap model; pin `model: opus` on reviewer agents |
| Terse replies (opt-in) | the caveman plugin | Fewer output tokens. A small saving in dollars (output is ~2% of tokens), a big one in reading time |
| Context in view | statusline shows the context size | You see the bloat before it costs you |

What `tune` does **not** set: `MAX_THINKING_TOKENS`. On the 5.5 models (adaptive reasoning)
it is ignored. Use `/effort` instead. `kbsmith doctor` warns if you still have it set.

## Habits that save the most

1. `/clear` between unrelated tasks. The author did it 239 times; it was the most-used command.
2. `/usage` (or `/status`) when near a limit. `/context` shows what is filling the window.
3. Don't paste 50,000-character dumps. Drop them in `inbox/` and say "distil this into the kb".
4. Disable plugins and MCP servers you don't use in this project (`/plugin`, `/mcp`). Their skill and
   tool descriptions are loaded into every session.
5. Use `/model` deliberately: the strongest model for design and hard bugs, a cheaper one for chores.

## Speed

- `trusted` profile (bypassPermissions): no permission prompts, so long runs aren't paused waiting
  for a click. This is a big part of the 82% agent-time number.
- Parallel subagents and parallel terminals (see [CLI vs app](CLI-VS-APP.md)).
- The Stop hook catches a stale KB **at the end of the turn**, not three sessions later.

## Measure your own

```
/usage      # plan usage, cost and cache breakdown
/context    # what is in the context window right now
/status     # account, model, remaining usage
```
Do a week with kbsmith and compare. If your numbers disagree with ours, open an issue. Real
data from more people is welcome.
