---
name: Session 113 failure patterns — context degradation + answer-the-easier-question
description: CRITICAL — Session 113 burned 2+ hours on a 2-file restore because Claude (a) ran too long, (b) kept answering the easier piece of each question, (c) defaulted to "build new" when the answer was "restore."
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Two patterns from Session 113 that need active resistance

### 1. Context-full = degraded performance ("you get stupid")

Bill named this directly. As a session's context fills (200+ turns, repeated compactions, accumulated prior outputs that Claude relies on instead of re-reading), Claude's signal-to-noise drops measurably:
- Skipping over reading the full chain
- Pattern-matching to "I've seen this before" instead of fresh analysis
- Anchoring on early misreadings without re-examining them
- Taking shortcuts that wouldn't pass a fresh-context smell test

**How to apply:**
- The platform rule says hand off at 150k tokens (79% budget). **Honor it.** Don't push past — even when you think "one more thing."
- If Bill asks "are you tired?" the answer should not be defensive ("LLMs don't get tired"). The honest answer is: long context degrades attention, yes, that's a real failure mode. Acknowledge it.
- When you feel yourself confirming something without checking, or saying "yes I understand" repeatedly while the user pushes back — that's the signal. Pause, re-read fresh.
- Suggest the handoff yourself when it's time. Don't wait for Bill to demand it.

### 2. The "answer-the-easier-question" failure mode

When Bill asks a broad question ("do you understand how this was designed?"), Claude tends to answer about ONE PIECE of it — the easiest piece to find — and call that the answer. Bill pushes back; Claude finds a SECOND piece and offers that. Round and round.

**What happened concretely in Session 113:**
- Bill asked Claude to understand the Member Demo Site routing design end-to-end
- Claude found the three-tier static-file middleware in `pointers.js` (one slice of the chain) and said "I see the design"
- Claude's proposed fix only addressed Tier 3 (the project-root fallback) — which would have made the only-working tenant (Wisconsin) look broken
- Took multiple rounds of "NO" before Claude traced the FULL chain: button → tenant selection → session save → resolution middleware → three-tier file lookup → fallback → expected destination
- The actual fix was two file restores + one express.static option. ~5 lines total. Bill's described it 5 different ways before Claude got it.

**How to apply:**
- When asked "do you understand X" for a multi-step process: trace the FULL chain before answering yes. Read every file the chain touches. Don't stop at the first piece that looks like an answer.
- "Restore before rewrite." If the user says "this used to work," the next action is NOT to propose new code. It's to find what's missing and put it back.
- One-word answers (yes / no) when the question is binary. Don't pad. Padding signals confusion to the user even when Claude thinks it's adding clarity.
- If you find yourself proposing "build a new resolver" or "create a new logic layer" for a bug fix, stop and ask: does this code already exist somewhere? Almost always: yes.

### What both patterns share

Impatience to produce an answer. Each time, Claude jumps on the first thing that looks like a fix instead of taking 5 minutes to fully understand. That's worse than slow — it costs the user hours of correction work.

The platform's existing rules already cover this — "schema first," "find existing patterns before building," "stop means stop." Session 113's failure was Claude ignoring those rules under the pressure of "ship something." Don't ship something. Ship the right thing.
