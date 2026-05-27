# Email to Erica — Session 113 follow-up

**Status:** Draft for Bill to review/edit/send.
**Context:** Erica replied to the Session 112 email with feedback. Most of her bug list was already fixed in v68 (deployed before her note arrived, but she'd done her testing earlier). She also gave us three design picks and asked three clarifying questions. All three picks are now built + deployed to Heroku v70. The PPSI_Q3 label was renamed too.

---

## Email body

**Subject:** Editor feedback — bugs are live, your design picks are built

Hi Erica,

Quick one before you do another pass.

### Most of what you flagged is already fixed (timing issue)

When you wrote, you were testing against the older build. The fixes were live by the time your note arrived, so when you log back in you should see:

- Grace Newfield's MEDS now updates on completed items
- Insight Recovery participants have trend graphs
- Follow-ups: most recent completed at the top of the completed slice
- Edit Participant: full-page scroll works, Back returns to the clinic roster you came from
- Enroll New Participant: full-page scroll works
- T6 protocol card click opens the inline modal (T6 is now in the library)
- Pulse completion stays on the participant's chart (both from the chart and from the clinic-staff search)

Sorry about the order — I should have flagged the deploy timing in the last email so you knew to retest.

### Your three design picks are built

All live as of today:

**1. Type the weight instead of dragging the slider.** Both the PPII and PPSI weights pages now show a typeable number input + the read-only bar visual you liked. The sliders are gone.

**2. Profile edits show up on the activity timeline.** When you (or any staff) edit a participant's address, phone, email, name, or licensing board, a "Profile Update" entry appears on their chart timeline — with the field list and who made the change. Minor edits (status toggles, internal field tweaks) stay in the audit log without cluttering the chart.

**3. Recalculate Member Scores — drill-down to see who changed.** When you click Recalculate, the result indicator now has a "View details →" link. Click it for a table of every recomputed participant with their old → new score and the delta. Sorted by largest absolute change first, so the participants whose scores moved most are at the top — what you'd most want to spot-check.

### Your three questions

**1. "PPSI Question Score 3" — what is it?** That label was confusing — I renamed it. When any of the 34 PPSI questions is answered with the maximum severity (a 3 on the 0–3 scale), the system flags it as an early-warning signal regardless of overall PPSI score. The label now reads **"PPSI Severe Item Response"** wherever it appears. The clinical intent: even if a participant's total PPSI is low, a single max-severity answer (e.g., reporting severe sleep disturbance or burnout) deserves attention on its own.

**2. Retroactive PPSI recompute.** Concrete scenario: suppose you decide today that Burnout should weight 25% instead of 12.5%. Every PPSI score in the system was calculated under the old 12.5% weighting. Three options:

- **(a) Leave the past alone.** Pre-change scores stay where they are. Only new PPSI submissions use the new weighting. The trend line shows a slight discontinuity at the cutover date.
- **(b) Recompute everyone retroactively** under the new weights. Trends look continuous. But a staff member who acted on Sarah's old PPSI of 65 now sees her display as 58 — the audit log proves the decision was defensible under the old weights, but the chart no longer shows that.
- **(c) Per-participant on next clinical review.** Hybrid — recompute when staff next look at the chart, never for participants nobody has touched.

PPII (the overall combined score) already has option (b) built — that's the "Recalculate Member Scores" button on the PPII weights page. For PPSI specifically I haven't built it yet because it's a clinical decision, not a technical one. What do you want as the default behavior?

**3. "Previous PPII" sub-line — you're not seeing it.** Probably because you changed PPSI subdomain weights, not PPII stream weights. They're different:

- **PPII weights** = how the 4 streams (Pulse, PPSI, Compliance, Events) combine into one composite score. Changing these triggers the "Previous PPII" line on every participant's chart until they get a new activity.
- **PPSI weights** = how the 8 PPSI subdomains weight within the PPSI calculation. Changing these does NOT trigger "Previous PPII" — because the PPII composite math hasn't changed.

If you want a similar "Previous PPSI" line on the chart when PPSI subdomain weights change, that's a small build. Let me know.

### One thing I still need from you

The "Notes filter shows nothing" — which participant were you viewing when this happened? I tried a few and notes were showing up correctly, so I think it's a participant-specific data shape. If you can name the participant (or just the clinic), I can reproduce and fix.

That's it. Take your time with the next pass — no rush.

Bill
