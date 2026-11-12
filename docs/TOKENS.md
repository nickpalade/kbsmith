# Tokens, speed and real numbers

Everything on this page was either measured from real transcripts or taken from the official docs.
Where I couldn't prove something, I say so.

## One month, one project, one $20 plan

I ran kbsmith on a real software project for about a month (29 days) on the $20/month Pro plan,
then parsed every Claude Code transcript from that project. API calls were deduplicated, and I
checked my cost estimate against the cost Claude Code records itself. They were within 4% of each
other.

| What | Number |
|---|---:|
| Sessions | 75 |
| Prompts I typed | 530 |
| Active hours (no gap over 15 minutes) | 71.9 h |
| Share of active time that was agent work, not waiting on me | 82% |
| API calls per prompt | ~24 |
| Tool calls per prompt | ~6 |
| Longest uninterrupted agent run | 47.9 min |
| Tokens processed | 2.05 billion (97.4% cache reads) |
| Non-cached tokens per active hour | ~0.9 million |
| API-equivalent value | $874, about 44× the plan price |

So one short prompt kicked off around 24 API calls of work, and most of those 72 hours were Claude
working while I reviewed. The KB is why a 68-character prompt like "check the kb, do the next
item" was enough.

### Caveats

- $874 is not what I paid. It's what the same usage would cost at API list prices (Opus 5.5 at
  $4 / $20 per million input/output tokens, checked 2026-11-10). I paid $20. The number is there to
  show how far a $20 plan goes when the context stays lean.
- The plan still has limits. That same month logged 85 "usage limit reached" events. kbsmith
  stretches a plan but doesn't make it unlimited, and heavy users will hit the 5-hour window.
- The efficiency trend is only an observation. From the first third of sessions to the last,
  uncached tokens per prompt fell 26% and API calls per prompt fell 22%, as the KB filled up and my
  habits settled. I never ran a controlled A/B test, and each third is only 25 sessions, so read it
  as "it got leaner over time" and nothing stronger.

## Where tokens actually go

97.4% of all tokens were cache reads. Every turn re-reads the whole conversation from cache. That's
cheap per token, but it's still the biggest line by far, which makes context size the real cost
driver. Output length barely matters by comparison. Nearly every saving below comes down to keeping
the context small:

| Lever | What kbsmith does | Why it saves |
|---|---|---|
| State in files, not chat | KB + `/handoff` + status page | `/clear` costs nothing, and a fresh session reads a few KB instead of a 190k-token history |
| Short always-loaded rules | `kb/AGENTS.md` kept < 6 KB, linted | It's re-read on every turn of every session |
| Read on demand | Read `00-INDEX`, then only the file you need | No loading the whole wiki |
| Subagents for big reads | Research and audits go to subagents | Only their summary enters your context |
| Earlier compaction | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` + `autoCompactWindow: 400000` (`tune`) | Compacts around 200k instead of near the full window, so each turn re-reads less (VERIFY the exact math on your version) |
| Shorter tool output | `BASH_MAX_OUTPUT_LENGTH=15000` (`tune`) | Noisy logs stop flooding the context |
| Medium effort by default | `effortLevel: medium` for Opus 5.5 (`tune`) | Fewer thinking tokens on routine work; `/effort high` for the hard stuff |
| Cheaper subagents (opt-in) | `CLAUDE_CODE_SUBAGENT_MODEL=haiku` | Search and chores run on the cheap model; pin `model: opus` on reviewer agents |
| Terse replies (opt-in) | the caveman plugin | Fewer output tokens. Small saving in dollars (output is ~2% of tokens), big saving in reading time |
| Context in view | statusline shows context size | You notice the bloat before it costs you |

One thing `tune` leaves alone is `MAX_THINKING_TOKENS`. The 5.5 models use adaptive reasoning and
ignore it, so use `/effort` instead. `kbsmith doctor` warns you if it's still set.

## Habits that save the most

1. `/clear` between unrelated tasks. I ran it 239 times that month, more than any other command.
2. `/usage` (or `/status`) when you're close to a limit, and `/context` to see what's filling the
   window.
3. Don't paste 50,000-character dumps. Drop them in `inbox/` and say "distil this into the kb".
4. Disable plugins and MCP servers this project doesn't use (`/plugin`, `/mcp`). Their skill and
   tool descriptions load into every session.
5. Pick your `/model` on purpose: the strongest one for design and hard bugs, a cheaper one for
   chores.

## Speed

- The `trusted` profile (bypassPermissions) means no permission prompts, so long runs don't stall
  waiting for a click. That's a big part of the 82% agent-time number.
- Parallel subagents and parallel terminals help a lot (see [CLI vs app](CLI-VS-APP.md)).
- The Stop hook catches a stale KB at the end of the turn, instead of three sessions later.

## Measure your own

```
/usage      # plan usage, cost and cache breakdown
/context    # what is in the context window right now
/status     # account, model, remaining usage
```
Try a week with kbsmith and compare. If your numbers look different from mine, open an issue. I'd
like to see data from more people than just me.
