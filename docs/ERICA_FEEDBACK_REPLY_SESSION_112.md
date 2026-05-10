# Email to Erica — Session 112 fix-up + open questions

**Status:** Draft for Bill to review/edit/send.
**Context:** Erica's post-rollout feedback batch on the PPSI editor cut. Seven code bugs identified and fixed; six items need her input (three explanations, two design questions, one clarification). One round trip rather than two — same approach as the April PPII proposal email.

---

## Email body

**Subject:** PPSI editor — bug fixes are in, plus a few questions back to you

Hi Erica,

Thanks for going through it carefully and sending the list — that's exactly the kind of round-trip we needed. Here's where everything landed.

### What's fixed

All seven bugs you flagged are coded and tested. Going down your list:

- **MEDS status not advancing.** Grace Newfield's case was a real bug — the MEDS lookup was comparing membership numbers as strings against an internal ID column, so completions never matched. Fixed; her record now shows the completed survey correctly. Added a regression test so the same class of bug can't recur silently.
- **Insight Recovery — no trend graphs.** Recovery participants had no engineered history; only Insight Health had been seeded. We backfilled 90 days of PPSI activity for the 10 Recovery personas (40 surveys, all under the new Option A math) tuned to match each persona's registry tier. Their charts now render with realistic trend lines.
- **Follow-ups — completed ones in the wrong order.** Pending items still appear first; within the completed slice, most recent now appears at the top. Added an ordering assertion so this can't slip again.
- **Edit Participant — scroll cut off + Back button stranding.** Both fixed. Save is now reachable on small viewports, and Back returns you to the clinic roster you came from instead of the "no clinic selected" error.
- **Enroll New Participant — scroll cut off.** Same fix; same page.
- **Pulse completion bouncing to the roster.** Fixed for all three entry paths — from a participant's chart, from the search flow, and from the roster row. After completing a pulse (and the optional CGI-S), you'll now land on that participant's chart so you can act on the result. Added a regression test that would fail loudly if a future change reroutes you to the roster.
- **T6 protocol card click going nowhere.** This was an embarrassing one — the system has been creating T6 ("Repeated Moderate") badges since last fall, but T6 was never actually added to the card library. Fixed. The library now has the same library-completeness check that would have caught it on day one — any future card the detection engine creates without a library entry will now fail testing immediately.

Full automated test suite is at 39 tests / 795 assertions, all passing.

### Questions back to you

A few things I want your read on before we move further.

**1. The "Notes filter shows nothing" report — could you tell me which participant you were viewing?** I tried to reproduce on a few different charts and the notes filter is showing notes correctly for me. If you remember the participant (or even just the clinic), I can try to repro from the same starting point. Could be a participant with a specific data shape we didn't seed.

**2. "PPSI Question Score 3" — naming.** That label is confusing and I want to fix it. Here's what's actually happening: when a participant scores **any single PPSI item at 3** (the highest severity on a 0–3 scale), regardless of which question, the system fires a signal called `PPSI_Q3`. It's a "single severe response" early-warning, not anything to do with "question number 3." The label rendered on the chart is just the internal signal name leaking through.

Better label candidates — your pick:
- **"Severe single-item response"**
- **"PPSI item ≥3"**
- **"Single question at maximum severity"**
- Something else?

I'll wire whichever you prefer once you tell me.

**3. "Previous PPII" sub-line — when does it appear?** You'll see it on a participant chart only when the participant's most recent PPII snapshot was calculated under a different weight set than the current one. In practice that means: **after you change PPII weights, every participant who had a PPII calculated under the prior weights will show a "Previous: X (weight set v[N], date)" line** until their next survey/pulse/event re-snapshots them under the new weights.

The intent is exactly what you asked for in April: a staff member acting on Sarah's old PPII of 65 stays defensible after a weight change drops her current display to 58 — the v1 number is right there on her chart. Once she gets a new activity, the system writes a fresh snapshot under the new weights and the "Previous" line goes away.

Is that the trigger condition you'd want? Two alternatives if not:
- **Always show the prior snapshot** (so staff can always see one-step trend regardless of weight changes)
- **Only show during a configurable cooldown window** (e.g., "show Previous for 30 days after a weight change, then hide")

**4. Retroactive recompute — clinical decision needed.** Two related questions, and I want to be careful not to confuse them because they have different answers.

*PPII weights changes (composite: pulse/PPSI/compliance/events).* The platform already supports retroactive recompute — there's a "Recalculate Member Scores" button on the admin weights page. It recomputes everyone who has a prior PPII snapshot using the new weights and writes a fresh history row tagged WEIGHT_CHANGE_RECOMPUTE. The components stay the same; only the weighting is re-applied. This is safe because the underlying numbers haven't changed, only how they combine.

*PPSI section weights / math changes.* This is the one I want your call on. When you change PPSI section weights, every existing PPSI score in the system was computed under the prior weighting. Three options:

- **(a) Don't recompute.** Pre-change scores stay as they were. New surveys get the new weights. Charts show a mix; we tag each score with its math version so it's clear.
- **(b) Recompute everyone retroactively.** Every PPSI score gets recalculated under the new weights. Trends look continuous. Cost: a staff decision made under the old weights is now defensible only via the audit log, not the chart.
- **(c) Recompute on a per-participant basis** (e.g., on next clinical review, or via a button in the participant chart).

There's a separate consideration on the Option A cutover specifically — pre-cutover scores were the raw 0–102 sum, post-cutover are 0–100 weighted. Those are different math, not just different weights, so we've explicitly **not** recomputed across that boundary. But for routine weight-tuning within Option A, your call.

What's the right clinical default?

**5. Profile edits in the activity timeline — yes or no?** Right now, when staff edit a participant's address, phone, licensing board, etc., those changes don't appear on the activity timeline. The timeline is reserved for clinical signals (surveys, events, compliance, pulses).

Two design intents in tension here:
- **Clinical-only timeline** (current). Keeps the chart focused on what drives PPII; admin housekeeping doesn't add noise.
- **Full audit timeline.** Every change to the record shows up. Useful when staff are second-guessing whether a contact change was made and by whom.

I'd default to keeping the timeline clinical-only but adding a separate "Profile change history" view accessible from the Edit Participant page. Sound right, or do you want it inline on the main timeline?

**6. "Recalculate Member Scores" — drill-down.** Smaller polish item. After you click that button, the result indicator says "X members recalculated." For pilot scale that's fine, but for larger programs you'll probably want to see the list of who got recomputed. We'd add a drill-down link → table of {member, old score → new score, snapshot timestamp}. Worth doing now or wait?

### Bottom line

Bugs are fixed. The clinical decisions in #4 and the naming in #2 are the only things on the critical path — everything else can iterate. Take your time.

Bill
