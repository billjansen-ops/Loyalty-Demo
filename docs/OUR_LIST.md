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
Design contract: **docs/GROUPS_AND_MEDS_DESIGN.md**. Member **groups**
(static, built with the criteria editor, usable as criteria, CSR Groups
tab) + **MEDS generalized to the platform layer** (manual/automatic,
episode memory, cooldown, lifetime cap, 0–n results reusing the promotion
result machinery).

**Status: stories 1–3 BUILT AND DEPLOYED — this item is essentially done.**
- ✅ Story 1, Groups v1 — v131, Session 156
- ✅ Story 2, Manual MEDS — v132/v133, Session 157 (proven at 10M scale on
  loyaltybig: preview warned 364,291 would fire, the run tagged exactly
  364,291, a re-run fired nobody)
- ✅ Story 3, Automatic MEDS — v137, Session 158 (MED_SCAN, daily, every
  tenant; Bill's ruling: DAILY for all, no per-MED cadence field)
- ⏸️ Story 4, migrating **clinical** MEDS onto the shared engine — NOT
  started and possibly never. The design doc records that as a legitimate
  outcome: the two watchmen coexist fine (job codes MEDS vs MED_SCAN) and
  neither borrows the other's consequences. Needs Bill's word to start.

Platform reference for all of it now lives in LOYALTY_PLATFORM_MASTER §43
(Groups) and §44 (MEDS) — written Session 159.

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
Status: **idea, unscoped.**

### 4. ⏳ THE OUTBOUND MESSAGING PROVIDER PICK — the one decision holding real delivery
**This is a DECISION, not a build, and it is Bill's.** The whole messaging
foundation shipped in v138 (Session 158): sendMemberMessage / notifyMember,
one member_message row per send as queue AND history, consent gate,
do-not-contact, self-healing bounce history, the MSG_QUEUE drain job, and a
secret-locked provider callback door. Contract: **docs/MESSAGING_DESIGN.md**;
platform reference: MASTER §45.

Nothing leaves the building until a provider is wired into
`messagingProviderFor()` **and** `MESSAGING_LIVE=1` is set. Until then MED
sms/email results save honestly and no-op loudly. What the decision needs:
the vendor (Twilio/SendGrid or equivalent), the money, and a **BAA** —
healthcare tenants make that non-optional. Parked as a provider question
since Session 95; now the only thing between built machinery and real
messages.

*(Note: for Insight tenants there is a SECOND gate behind this one — the
consent architecture, which is Erica's and her legal team's. Even with a
provider live, no Insight participant can be messaged until that opens.
The loyalty side has no such gate.)*

## Small

(none yet)

## Ruled OUT (asked and answered — do not re-raise without new circumstances)

- **Programs admin screen** — a create/edit page for tenants/programs.
  **Bill, Session 159: NO for now** — Claude stands up new tenants by hand
  (`tenant_standup.js` is the door; MASTER §46 and docs/TENANT_STANDUP.md).
  `admin_branding.html` continues to cover a program's appearance only.
- **SQL fast-path for MED/group preview at 10M scale** — a second, faster
  evaluator beside the proven batched walk. **Bill, Session 159: NO, "it is
  fine as it is."** It would have needed a mandatory parity guard proving
  both evaluators always agree; the walk is honest and proven at 10M.

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

- **Groups v1** — Session 156, v131. Static member groups; removal is a
  molecule on the stay row; MEMBER_GROUP criteria window in every engine;
  'group' result type in all four dispatchers; admin pages + CSR Groups tab.
- **Manual MEDS** — Session 157, v132/v133. Episodes, cooldown, lifetime
  cap; preview that writes nothing; proven at 10M on loyaltybig.
- **Automatic MEDS** — Session 158, v137. MED_SCAN daily on every tenant,
  sharing ONE run function with the manual button.
- **Outbound messaging foundation** — Session 158, v138. Built and waiting
  on the provider decision (now Large #4 above).
- **The universal molecule set gets one seeding door** — Session 158,
  `seedUniversalMolecules`; closes the "tenant born after the seeding
  migration silently misses vocabulary" gap.
- **Session 159 defect sweep** (all found by reading, none reported by a
  user — the enumeration-drift class from Groups/MEDS/messaging):
  the tenant copier never copied promotion_result rows and dropped
  result_group_link (wa_php's REG_REVIEW is that artifact — conversion is on
  the WA kickoff checklist); a group bonus result left NO trace on the
  activity; four surfaces misdescribed group results; reward-object deletes
  (badge/tier/token/external action) silently orphaned result rows — the
  guard's first test refused deleting SR_SENTINEL, naming twelve safety
  rules; manual qualify read only the legacy reward columns; the promotion
  editor blanked token/badge references on save.
- **Core docs truth pass** — Session 159. MASTER's first pass since S132:
  corrected the actively-wrong parts and added §43–46 (Groups, MEDS,
  Messaging, Scheduled Jobs — the job system had never been documented).
