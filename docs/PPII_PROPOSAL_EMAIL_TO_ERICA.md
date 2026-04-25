# Email to Erica — PPII weights proposal + PPSI follow-up

**Status:** Draft for Bill to review/edit/send.
**Context:** Erica replied April 25 to the original PPII weights design email
(`docs/PPII_WEIGHTS_UI_DESIGN.md` § Appendix) saying yes to all four areas. Three
of the four (audit, history, access) need a concrete proposal she can react to;
PPSI subdomain weights (the second half of Q1) needs three clinical answers
before we can build it.

This email is intentionally one round trip rather than two — Erica context-switches
better in one focused session than spread across multiple medium-depth threads.

---

## Email body

**Subject:** PPII weights — proposal on history & audit, plus a few PPSI specifics

Hi Erica,

Thanks for the thoughtful response. Your yes-to-both, the clinical-defensibility concern on history, and the audit log all landed clearly. Let me lay out what we're proposing on the history piece, confirm a couple of mechanical things, and ask the few specifics we need to also do the PPSI subdomain editor.

### 1. History & audit — the meaty one

You raised the right concern: if a staff member acts on Sarah's PPII of 65, and a later weight change makes her current PPII display as 58, that staff member's decision can look like a misread when it wasn't.

Here's what we want to build:

- **Every time the system calculates PPII for a member, we store a snapshot.** Each snapshot keeps: the member, the composite score, the individual stream values that produced it (Pulse=32, PPSI=45, etc.), the weight set version that was active, a timestamp, and what triggered the calculation (routine, tier change, registry item, etc.).
- **On any chart or view that displays PPII, we show the current score AND — when the most recent snapshot under the prior weight set differs — the previous score with its date and the weight version that produced it.** Something like:
  > Current PPII: 58 (weight set v2 — April 25)
  > Previous: 65 (weight set v1 — through April 24)
  
  That directly answers what you wrote: "show an updated number with a previous calculation below as an audit trail with a time stamp." A staff decision made under v1 stays defensible under v2 because the v1 number is right there on the chart.
- **Storing the components (not just the final score) is the bit that makes your other wish trivial.** When weights change, the system can recompute every member's score under the new weights using the stored components — no need to re-query source data. Your "I'd like recalculations for everyone" becomes a button on the weights page rather than a Claude session.
- **The change log itself** — who adjusted weights, what they changed, when, and (optionally) why — appears on the admin page as a "Recent Changes" section, with newest at the top.

Your fourth option — *"we could just communicate the change to all users and ask they recheck predictive scores"* — stays available alongside this. The system can automatically notify users on a weight change asking them to re-evaluate active monitoring decisions. The audit gives you the paper trail; the notification gives you the workflow nudge. Both, not either-or.

**Does this feel right?** Any pieces you'd change before we build?

### 2. Streams will be config-driven (heads-up, not a decision)

Worth flagging because it shifts what's possible later. Today the platform has the four PPII streams baked into code — adding Stream D (Operational Strain), Stream E (Wearables), or Stream F (Monthly Stability Pulse) requires engineering. We're refactoring this so streams are config-driven: when you eventually add wearables, you add a row in a config table and the editor auto-renders a new slider for it. No engineering, no Claude session, no rebuild.

Not a question for you — just want you to know that "I want to add a stream later" stops being a roadmap item and becomes an admin action.

### 3. Access — Erica only

Confirmed. We'll scope this page to your user account specifically. When real role-based access controls ship (separate effort, on the roadmap), we'll move it to a "clinical model owner" role you can grant to others if you ever want to.

### 4. PPSI subdomain weights — three specifics we need

You said yes to also editing PPSI subdomain weights, which is great. One thing worth knowing: the platform today doesn't apply section weighting at all — the PPSI score is just the raw sum of all 34 question values across the 8 sections. So building the editor means introducing weighting where there is none. That's a clinical decision, not a technical one. Three things we need from you:

**a. Section keys.** Just confirming the eight sections from the build notes are what you want shown:
1. Sleep Stability
2. Emotional Exhaustion / Burnout
3. Work Sustainability
4. Isolation + Support
5. Cognitive Load
6. Recovery / Routine Stability
7. Meaning + Purpose
8. Global Stability Check

Any changes to names or any sections to add/remove?

**b. The weighting math.** Two reasonable approaches, and they produce meaningfully different scores:

- **Option A — normalize first, then weight.** Each section's raw sum is divided by its max (so each section becomes a 0–1 fraction), then multiplied by your weight. Sections contribute proportionally regardless of how many questions they have. Section 8 (1 question, max 3) and Section 1 (5 questions, max 15) contribute on equal footing if weighted equally.
- **Option B — multiply raw, then sum.** Each section's raw sum is multiplied directly by your weight. Sections with more questions naturally contribute more even at equal weight, because the raw values are bigger.

Which matches your clinical intent?

**c. Default starting values.** Post-pilot you'll tune these based on real data, but we need a starting point. Equal weights across the 8 sections, or a starting set you have in mind today?

### Bottom line

If you confirm the §1 approach, we'll start building the audit and history pieces. The PPSI editor needs your §4 answers before we can ship that half — but the **streams editor that's already working can ship right now**, so you'll see partial progress immediately and the PPSI piece lands as soon as we have your specifics.

Take your time. The streams editor stands on its own; nothing's blocked.

Bill
