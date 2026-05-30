# Email to Erica — Session 113 round 2

**Status:** Draft for Bill to review/send after CI green + Heroku deploy.

---

**Subject:** Your follow-ups are all built — Profile Update Log + Previous PPSI + cutover marker

Hi Erica,

All the items from your last note are done. Walking through them so you know what to look for:

**1. Profile Update Log — moved to the profile page.** I'd misread your first email and put profile changes on the activity timeline, which made it noisy. Reworked. The participant chart now has an "Edit Profile" button next to Compliance / Event / Pulse / Export / Full PPSI. Clicking it takes you to the existing profile page, where you'll see all the account details you already had, plus a new "Profile Update Log" section at the bottom showing every prior edit with the field-level old → new values and who made the change.

**2. PPSI retroactive recompute — option (A) with a cutover marker.** Pre-change scores stay where they are. New PPSI submissions use the new weights. On the trend chart, a vertical dashed purple line marks the date the weights changed, labeled "weights changed." So if a score drops or jumps right around that point, you'll see immediately whether it's a real clinical signal or the weights change.

**3. Previous PPSI sub-line.** Mirrors the Previous PPII pattern. Under the "Last PPSI" card on a participant's chart, when their most recent PPSI submission predates the most recent weight change, you'll see "Previous: \[score\] — pre-\[date\]" so the prior-weights score stays visible for audit reasons. Once they submit a new PPSI under the new weights, the sub-line drops off naturally.

**4. Notes filter renamed.** The "Notes" tab on the activity timeline is now "With Notes" with a tooltip clarifying it shows Surveys, Pulses, and Events that have a comment attached — not freeform staff/participant notes (those live under Notes and Outreach as you mentioned).

**On the Work Site Monitor + Caduceus GPS direction:**

This is a great direction and the platform is built for exactly this. Each of those is a new data stream alongside Pulse, PPSI, Compliance, and Events. The plumbing for adding a stream is already in place — when Affinity or Ohio sends through the actual form/data, we can:

- Wire the WSM submission as its own activity type (analogous to how a Provider Pulse comes in)
- Add a "wsm" row to the PPII streams config — the PPII weights editor picks it up automatically and you can decide what fraction it should contribute to the composite
- The Caduceus GPS attendance log fits as a compliance-style stream (or a sub-item under Compliance, depending on how Ohio's form is structured)

So: no engineering blockage. When you have the Ohio form, send it over and I can map it to fields in a day or two.

Take a look when you have a minute. No rush.

Bill
