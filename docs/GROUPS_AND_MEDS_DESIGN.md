# Groups + MEDS Platform Edition — design sketch

Designed in conversation with Bill, 2026-07-25 (Session 154 tail, the
Loom Loyalty review thread). Status: **designed, not scheduled** — lives
on docs/OUR_LIST.md; builds only on Bill's go. Nothing here is code yet.

The one-sentence pitch: **Pointers notices what didn't happen.** Bonuses
react to an event that arrived; promotions accumulate events toward a
goal; MEDS notices the event that never came. Three engines, one
criteria vocabulary, one results vocabulary — the complete grammar of
member behavior.

**v1 SIMPLIFICATION (Bill, 2026-07-25, supersedes the flavor text
below where they conflict): GROUPS ARE STATIC ONLY in v1.** Bill's
challenge — "is a dynamic group needed, or do the rules just live in
the MED?" — held up: a MED (like a bonus or promotion) carries its own
criteria; a dynamic group was only a named wrapper. Dynamic groups buy
exactly three conveniences (one named definition shared by many rules;
composition into other criteria; CSR visibility of derived
membership), none needed day one — and freeze-a-snapshot (run
criteria → freeze matches into a static group) covers the ad-hoc case.
So v1: static groups + criteria living on each rule. The MEMBER_GROUP
reference molecule simplifies to a pure row lookup (no definition
evaluation, no group-cycle guard needed). Dynamic groups remain a
documented LATER addition with a precise trigger: **the day two rules
want the same audience by name**, promote those criteria into a
dynamic group. Nothing in v1 forecloses it; it's purely additive.
(The sections below keep the dynamic-group design for that day —
read them as "later," not "v1.")

**v1 group admin flow (Bill, 2026-07-25):** create group → optional
criteria (same editor as bonus/promotion rules) → PREVIEW (count +
list, writes nothing) → go → matches written as membership rows
(audited). Criteria are kept as PROVENANCE: a re-run ADDS newly-
matching members, NEVER removes. **Criteria put members in; only a
deliberate act takes one out** — a person (CSR tab / group screen,
per-member, audited) or an engine result configured to remove.
Editing criteria never bulk-removes; hand-adds and engine-adds must
survive definition changes. Deleting a group: refused while any
rule's criteria reference it (plain-English answer naming the user);
deactivate is the retirement path. CSR page gets a Groups tab:
memberships as chips + "Add to group…" + per-member remove.

---

## 1. The concept is MEDS, and it was always general

MEDS = **Missing Event Detection System** (the expansion was never
clinical — it was implemented first in healthcare). The platform
capability comes in two editions:

- **Clinical MEDS** (exists, live on Erica's site): watches
  *obligations* — prescribed, per-member expectations (instrument
  cadences, compliance schedules). A miss is a safety/compliance event:
  a human MUST see it (bell + YELLOW worklist item + SLA + escalation
  at 3+ consecutive misses + auto-heal on exit).
- **Marketing MEDS** (this design): watches *opportunities* —
  population-level expectations ("a Gold member flies every 60 days").
  A miss harms no one; the system acts alone (offer, message, enroll);
  the unforgivable failure is NAGGING, so it has cooldowns where
  clinical has SLAs.

**Obligation vs opportunity is the whole difference.** The detection is
identical; what a miss *means* and *deserves* differs. Therefore the
consequence machinery is deliberately never merged — a safety miss must
never be configurable with a cooldown instead of an SLA.

Inside each vertical nobody says the qualifier (Erica's screens say
MEDS; Delta's screens say MEDS). The edition names exist for the
platform story.

## 2. Groups — the WHO

One object: a **member group** (member = the storage noun; each tenant's
label renders — participants for Insight, members for Delta). Always
tenant-scoped: no platform-level or cross-tenant groups, ever (the
isolation wall applied to a new object).

- **Static** — a kept membership list. Hand-picked, imported, or FROZEN
  from a dynamic evaluation ("snapshot the 214 matches as of today").
- **Dynamic** — a stored *definition* (criteria rows); membership
  computed at the moment of asking. Never stale, nothing maintained;
  "who was in it on March 1" derives free (temporal thesis).

**One membership door:** everything asks "is member M in group G?" and
never cares which flavor answers.

**Criteria both ways:** groups are BUILT with the existing criteria
editor, and groups are USABLE as criteria ("member IN group X" /
"NOT IN group Y" — suppression/do-not-contact lists fall out free).
Bonuses and promotions get group targeting the day groups exist, before
any scanner is built. Guard: group-references-group cycles are refused
loudly at save time.

**The "how" (Bill, 2026-07-25): a MEMBER_GROUP REFERENCE molecule** —
reference flavor, deliberately NOT a storing molecule (stored
membership = a second copy of the group system's truth; two copies
drift). Its ref function asks the one membership door ("is this member
in group X right now?" — static = row lookup, dynamic = evaluate the
definition; the molecule doesn't care which). Criteria then use the
operators that already exist: MEMBER_GROUP IN (...)/NOT IN (...). The
criteria engine changes NOT AT ALL — groups arrive in every engine as
one molecule definition. Evaluation timing comes free: "in the group"
always means at the moment the rule fires, never a snapshot. Build
notes: MOLECULES.md first (reference molecules still fail silently on
bad def rows; round-trip proven before done); the save-time cycle
guard covers dynamic groups whose own criteria use MEMBER_GROUP.

**CSR surface:** a Groups tab on the member page. Dynamic memberships
render as derived facts (computed on load, no edit affordance — you
can't hand-add someone to a rule); static memberships render as
editable chips (remove + "Add to group…"), each change audited.
Declared things are editable, derived things are displayed — same
ethos as the balance. Second door: the group's own screen lists members
with add-by-search. Both doors, one truth. Reads never write: browsing
an audience burns nothing.

**New vocabulary needed:** a few member-level reference molecules
("days since last activity" and friends). These need the platform date
discipline (Bill epoch, canonical helpers) — the one place real
engineering care concentrates.

## 3. MEDS definition — the WHAT

A **MED** is: WHO (a group, or criteria directly) + the **expectation**
(the genuinely new clause: which event type, within what window,
anchored how) + mode + manners + results.

Bill's canonical example: *"This MED is: a Gold member who has not
flown in 60 days. Send them an email; enroll them in a restricted
promotion; message them: fly in the next 30 days and we make you
Diamond."* Everything downstream of the segment already exists:
restricted enrollment (enrollment_type R), the personal 30-day window
(virtual duration, duration_days), the tier reward (reward_type
'tier', temporal member_tier rows), atoms for the message template.
The offer is CONFIGURATION; only the noticing is new.

**The 2×2 (Bill's compression):**

- Groups: **static / dynamic**
- MEDS: **automatic / manual**

All four combinations are real: automatic+dynamic = the standing
win-back watcher; automatic+static = stand watch over a VIP list;
manual+dynamic = one-shot blast on whoever matches now;
manual+static = act once on a chosen list (the stranded-flight apology).
Manual mode's workflow: define → **preview the audience + count** →
adjust → go. Nobody fires blind.

## 4. Detection — the machinery (the part that moves to core platform)

Identical skeleton to clinical MEDS (read from meds.js 2026-07-25):

- **Next-due index**: one precomputed earliest-due date per member;
  the scan only touches members whose date arrived. No row = nothing
  expected. This is how it stays cheap at scale.
- **Edge-triggered, never level-triggered**: the action hangs on the
  member ENTERING the missed state, not on the state persisting.
  "Still quiet" is never news twice.
- **Identification record** (written when the member matches, per
  Bill): which MED, which member, when, the **episode anchor** (e.g.
  last-flight date at firing — the dupe-killer: same anchor tomorrow =
  same spell = skip; a new spell has a new anchor), and pointers to
  what it created. Deliberately NOT stored: outcomes — whether they
  came back derives from the temporal record (which is how
  effectiveness reporting is free: fired 214, 63 flew within window).
- **One transaction per member**: identification + all actions commit
  or roll back together. A failed action = no record = loud retry next
  scan. Never "marked handled but got nothing" (the silent-failure
  class), never double-fired.
- **Cooldown** (config per MED): "never re-fire for the same member
  within N months, even across episodes" — the anti-yo-yo guard.
- **0 results is legal**: a watch-only MED builds identification
  history and an audience view, nothing else.

## 5. Results — 0–n, exactly like promotions

MEDS becomes the third engine carrying result rows, after bonuses and
promotions: points, tier grant, enroll-in-promotion, external action
via the existing dispatch registry, message/notification (atoms
templates). Reuses the result-row editing patterns and audit whole.
Real outbound email/SMS still gates on the provider decision (parked
since S95) — in-app works today.

**Group membership is a result type too (Bill, 2026-07-25):**
"add member to static group" (+ inverse remove) joins the shared
results vocabulary — so EVERY engine gets it at once: a bonus,
promotion, or MED can write group membership. Combined with groups
already being criteria for every engine, the full symmetry is: **any
engine reads groups as criteria; any engine writes STATIC groups as a
result.** Results never touch dynamic groups — derived membership is
never hand-edited, by engines or by anyone (the declared-vs-derived
line). Engines thus compose through groups as the shared medium
(promotion result → group → MED watches it → result enrolls the next
promotion), every link audited. Guard, same family as the group-cycle
check: a MED whose result writes to the very group it watches is
refused loudly at save time.

## 6. Architecture: move the skeleton, leave the flesh

Three pieces (Bill's cut): **criteria / detection / results.**

- **Detection** → core platform. It is already domain-neutral in shape.
- **Criteria** → two owners forever: marketing = groups + expectation
  defs (platform data); clinical = instrument/compliance walks
  (vertical code).
- **Results** → two owners forever: marketing = configurable result
  rows (platform); clinical = bell + worklist + SLA + heal (vertical
  code, untouchable by marketing config).

**Sequencing (the reverse-compatible path):** build the platform
engine with the marketing edition as its FIRST client — new code, zero
clinical exposure. Clinical MEDS keeps running untouched (it is live
safety machinery carrying three sessions of scar tissue: instant-miss,
heal-vs-throttle, notification flood). When the shared engine has
earned trust, migrating clinical onto it is its own later decision —
a small swap of the scan loop, keeping clinical criteria + results
word-for-word, gated by the existing clinical MEDS test asserts going
green on the shared engine + dress rehearsal. Same shape as S144's
shared clinical engine: shared machinery, differences are data.

Standing guard note: this knowingly creates a second scan-and-fire
mechanism beside clinical MEDS for a while — a deliberate, temporary
design decision with the convergence path designed in (recorded here
so no future session flags it as accidental drift).

## 7. Build order (bite-size, each ships alone)

1. **Groups** — object + membership door + criteria integration both
   ways + CSR tab + group screen. Immediately useful, zero scanning.
2. **Manual MEDS** — definition + preview + run-once + identification
   records + results. (The one-shot "flare".)
3. **Automatic MEDS** — the standing watch: scheduler job, next-due
   index, episodes, cooldowns.
4. **(Someday, its own decision)** clinical MEDS migrates onto the
   shared detection engine.

## 8. Open items

- **Names:** "Spark"/"flare" retired as system names (Bill). Editions:
  Clinical MEDS / Marketing MEDS (working labels; "marketing" final
  wording open). Groups is settled ("groups", not "lists" — a list
  promises stored enumeration, wrong model for dynamic membership).
- Inside Insight, MEDS-the-acronym will someday sit near the
  Medication Registry (Erica's #4) — a naming moment to handle when it
  arrives.
- Exit actions ("member left the group → close/celebrate") — possible
  future scope, deliberately NOT in the first builds.
- Where marketing MEDS admin lives (screens, nav) — design at build
  time.
