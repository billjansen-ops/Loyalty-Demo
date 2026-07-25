# OUR LIST — Bill's platform list

**What this is:** the canonical list of platform-side ideas, enhancements,
and future builds — the loyalty/platform sibling of Erica's master list.
When Bill says **"add this to our list," it goes HERE** — one entry, this
file, nowhere else. (Erica's list is a separate thing with its own
process: `verticals/workforce_monitoring/tenants/wi_php/project_status/`,
dated .docx editions emailed to her, she ranks. Insight-facing work goes
there; platform-side work goes here. When in doubt, ask Bill which list.)

**Rules of the file:**
- One entry per idea. An entry names the idea, one paragraph of what it
  is, its status, and a pointer to any design doc.
- Items live here ONCE — never duplicated into ACTIVE_WORK, STATE, or
  session notes. Those may point here; the truth is here.
- Bill owns the ordering and the go. Nothing on this list builds without
  his word. Erica's ranking and Washington outrank this list by default.
- When something ships, move it to Recently completed with the session
  number. Append; don't rewrite history.

---

## Large (buildable, Bill orders them)

### 1. Groups + MEDS platform edition ("Marketing MEDS")
The full design: **docs/GROUPS_AND_MEDS_DESIGN.md** (Session 154-tail
design conversation, 2026-07-25). One sentence: member **groups**
(static/dynamic, built with the criteria editor, usable as criteria,
CSR Groups tab) + **MEDS generalized to the platform layer** (automatic/
manual, expectation = event + window + anchor, episode memory, cooldown,
0–n results reusing the promotion result machinery). Detection engine
moves to core platform; clinical MEDS stays untouched and migrates onto
the shared engine later, gated by its own tests. Ships as bite-size
stories: groups → manual MEDS → automatic MEDS → (someday) clinical
migration. Status: **designed, not scheduled.**

### 2. Program economics / points-liability reporting
The "margin visibility" gap from the Loom Loyalty review (2026-07-25):
no financial view exists — points liability, cost of program, member
value ranking. Washington's wish-list analysis also flags reporting as
a true gap. Natural adjunct: MEDS effectiveness reporting (fired N,
returned M within window) derives free from identification records once
Groups+MEDS exists. Status: **idea, unscoped.**

### 3. Signals in / recognition out (integration surface)
Also from the Loom review: a generic inbound event API (external
systems land events without a screen) and outbound webhooks (platform
events notify external systems). The outbound half has hook points
already (external action registry; notification delivery framework).
Related standing decision: the email/SMS provider pick
(Twilio/SendGrid — parked since Session 95) that unlocks real message
delivery. Status: **idea, unscoped.**

## Small

(none yet)

## Someday / parked (moved from ACTIVE_WORK 2026-07-25 — one home now)

- **Config-table index tidy-up (v10x candidate).** ~29 provably-redundant
  indexes on small config tables (~0.5 MB total — low ROI). Shape-based,
  expression-safe detection REQUIRED: a naive column-list match falsely
  flags expression indexes (`member (tenant_id, lower(lname))` and
  `molecule_def (tenant_id, lower(molecule_key))` MUST be kept); exclude
  any index whose `indkey` contains 0, plus partial and unique/primary
  indexes. The refined detector query lives in the Session 136 chat.
- **Usage-based index audit — BLOCKED on real traffic.** Dropping
  truly-unused indexes needs production query stats; local/Heroku carry
  only test/demo traffic. Not meaningful until a real-load environment
  exists.

## Recently completed

(nothing yet — this file was born 2026-07-25, Session 154 tail)
