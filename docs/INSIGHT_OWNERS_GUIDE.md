# The Insight Owner's Guide

Started Session 150 (July 21, 2026) — the tutorial session. This is Bill's
plain-English map of the Insight platform. It grows a little every time we
tour a part of the system. No jargon; where a technical term is unavoidable
it gets explained the first time it appears.

**Operating note (July 21, 2026):** on this machine the app is always
opened at `http://127.0.0.1:4001` — never "localhost". They look like
the same address, but the browser treats them as two different sites,
and the sign-in only holds on the 127.0.0.1 one.

---

## Part 1 — The one idea everything else hangs on

**There are two populations of people, not one.**

- People being **considered** for the program are *registrants*. They live
  in the **Intake Queue**.
- People actually being **monitored** are *participants*. They live on the
  **roster** and have a chart.

Nobody is ever in both. A person crosses from registrant to participant at
exactly one moment: when a staff member records that they signed the
monitoring agreement. Instruments, MEDS checks, risk scores, compliance
items, and the Stability Registry only apply after that crossing. As of
Session 149, compliance items start automatically on the day someone
becomes a participant — a registrant carries zero.

### How the platform tells them apart (one byte)

There is no separate registrant table and no flag. One field — the
**INTAKE_STATUS** molecule — holds one of eleven values:

1. Registered
2. Case manager review
3. Medical director review
4. Routed to resources
5. In screening
6. In evaluation
7. In treatment
8. Pending reactivation
9. Declined
10. Closed
11. **Participant**

Values 1–10 mean registrant; 11 means participant. The roster asks "is the
status Participant?"; the Intake Queue asks for the other ten. That is why
a person appears in exactly one place with no bookkeeping to sync. A
separate "is a participant" checkbox was explicitly rejected (Session 141):
two facts about the same person can drift; one field cannot disagree with
itself.

It is stored as a **molecule** — the platform's mechanism for attaching a
tenant-specific fact to a record without changing the shared tables. The
`member` table itself holds only universals (name, address, membership
number, dates). Wisconsin and Washington each carry their own copy of the
definition.

### The intake work item

Each *trip* through intake is its own work item, with:

- **Whose desk it's on** — case manager review or medical director review.
  This flips back and forth within one trip (the director can send an item
  back down with a reason, the case manager can send it up again).
- **An SLA clock** — 2 business days by default, shown as on time /
  due soon / overdue. The queue is prioritized by this outreach clock,
  NEVER by clinical tier — nobody in intake has been clinically assessed.
- **Notes** — every action writes its own note, stamped with author and
  time. The action label is part of the text (e.g. "[Send back to case
  manager] need more information"), so the reason and the action can never
  drift apart. Reactivations write their own first note automatically.

A **new** item is created only when a closed person re-enters (a
*reactivation*). The person's full history — every prior trip with its
notes and outcomes — now shows on the item detail and on the chart's
Intake history card (Session 149; Erica's "lost notes" were never lost,
only hidden).

Real example on the rehearsal copy (refreshed from live the evening of
July 21): Jane Doe has one trip — the one Erica herself worked on the
live site that evening (outreach recorded → sent for Medical Director
review → sent back with a reason → sent up again), sitting open on the
Medical Director's desk with all six of her notes visible on it. An
earlier copy showed Jane with four trips; those were local test trips
that never existed on the live site — the fresh copy shows only what
Erica's site really holds.

### The two front doors

The **Invite** panel (dashboard, clinic, intake queue) mints links:

- **Screening link** — the anonymous front door. No record is created.
  Safe for posters and newsletters.
- **Registration link** — collects demographics and creates a real person
  (a registrant) plus an intake item for case-manager review.

The link's code carries its context (program, referral type, affiliation)
server-side; the QR and URL are just an opaque token. Opening or
refreshing a link does not burn its single use — only submitting does.

The other way in is staff-side **Enroll**, which reserves the next
membership number the moment the form opens (two staff can't collide;
cancelled forms leave harmless number gaps).

---

## Part 2 — Tour chapters not yet taken

Planned for future sessions; each becomes a Part of this guide when walked:

- **The monitoring engine** — instruments and cadences, the daily MEDS
  check, what a missed instrument causes, and how a survey answer becomes
  a score → tier → alert → a bell that rings for a specific person.
- **The safety net** — the Stability Registry, urgencies and SLA clocks,
  follow-ups, notification rules (including the v125 fixes: unassigned
  registrants made visible; the dead bells repointed).
- **The newer wings** — Document Repository and the no-real-files gate,
  credentials, the two-program chooser, what Washington adds.
- **Where it's going** — Erica's ranking as the build order, what is
  blocked on her, open design questions (multi-case-manager routing, the
  lifecycle views).

---

## Findings log — Session 150 (July 21, 2026)

The session's purpose changed mid-flight: instead of a five-chapter tour,
it became a hard look at whether the screens actually work. Everything
below was found on a throwaway copy of Erica's live data. **None of the
defects are on Erica's live site** — they are all in the Session 149 batch,
which is committed locally and NOT deployed. The batch is HELD until these
are fixed and the screens are walked.

### Bill's drift points / surprises

1. **Intake status is a molecule, not a member column** — and it is an
   internal-list molecule (one byte, eleven values).
2. **"CM Review" vs history** — the desk an item sits on flips within one
   trip; the history only grows on reactivation. Two different questions.
3. **Notes are NOT molecules** — and Bill's position is they should have
   been considered as molecules. See "architecture drift" below.

### Architecture drift (the session's biggest find)

**Human-written text has routed around the molecule system for the entire
life of the platform.** A census found ten places storing people-notes in
purpose-built columns/tables (registry reason + resolution notes,
compliance result notes, intake notes, chart annotations, follow-up notes,
intake resolution notes, survey note reviews, and two weight-set change
notes), created from migration v9 through v111. The `intake_item` table
sits in the entity registry with an EMPTY entity code — the one step that
would have let molecules attach to it was skipped, and a table was built
instead. Additionally the ACTIVITY_COMMENT molecule (Wisconsin) has no
lookup row — a half-built definition that can't reliably store anything.

Bill's ruling (now in permanent memory): molecules are the platform's one
attach-anything door; before any new text column or notes table, the
molecule route must be considered and the choice brought to Bill. The
narrow exception: text explaining a config version (why weights changed)
stays with the version record.

Consolidating the ten existing places is a REAL DECISION for a future
session — live data, every screen that reads them — not a cleanup task.

### Confirmed defects — ALL SIX FIXED same session (Bill's go), each fix
### verified by pressing the button in the browser. Kept for the record:

1. **Intake Queue — Invite panel shows "(QR generator not loaded)"** —
   the page never loads /qrcode.min.js, which the shared invite panel
   requires (dashboard and clinic load it; the queue page doesn't).
   Verified live: QR renders on the dashboard, not on the queue.
2. **Intake Queue — Enroll button's Back goes to member search** — the
   queue never records "where I came from" (enroll_context), so the
   enroll page's Back falls to its generic default instead of returning
   to the queue.
3. **Chart — Edit Profile's Back is broken the same way** — it writes its
   return address to the wrong place (lp_page_context, not
   enroll_context) AND in a form the reader would reject. Back from a
   profile edit does not return to the chart.
4. **Clinic page — the Compliance modal cannot be closed and its "+ Add
   Entry" button is dead** — both call closeCompItemModal(), which is
   defined nowhere. Add Entry throws before doing anything. (Predates
   S149; needs checking on live.)
5. **Registry (action queue) — Export column checkboxes are dead** — they
   call updatePreview(), which does not exist on that page (stale name;
   the page's real functions are runPreview/runDownload). (Predates S149;
   needs checking on live.)
6. **Intake Queue — item panel action buttons sit inside the scroll
   region** — on a person with real history the buttons scroll out of
   sight. Same defect in four modals on the registry page (item detail,
   follow-up, create, export). The fix pattern (pin the action bar
   outside the scroller) already exists on clinic.html and the S135
   layout sweep.

### Friction — ALL FIXED same session (the "friction batch", walked)

1. ~~Queue rows don't look clickable~~ — visible hover + chevron on both
   queues. (Roster rows still worth a look next sweep.)
2. ~~Invite and Enroll look identical~~ — Invite is filled green
   ("Invite — send a link"), Enroll outlined ("Enroll directly"),
   hover titles explain each.
3. ~~Context pages dead-end~~ — clinic + chart no-context errors now
   say what happened and offer a Go-to-the-dashboard button. (The chart
   still ignores ?memberId= by design — context rides the session; a
   bookmarkable chart URL is a design question if Bill ever wants it.)
4. ~~/p/ routing~~ — registration-TYPE codes land on /register even
   without a carried target (server routes by code type first).

### Process ruling (the reason the day went sideways)

**"Tested" had been meaning "the server endpoints are proven and the
words appear on the page" — not "someone pressed the button."** Three of
today's defects (QR, Back, dead buttons) are invisible to that kind of
testing and instant to find by clicking. Standing changes:

- A button is DONE when pressing it produces its outcome — including that
  the page it lands on works. Wired-but-unclicked is reported as
  "wired, not clicked", never "tested".
- Any release that touches a screen gets its screens WALKED (clicked
  through, by Claude, in the browser) before it ships to Erica.
- The geometry test (pixel-measures that action buttons are reachable)
  covers 25 admin/edit pages but NONE of the healthcare screens — extend
  it to the screens Erica uses.
- The next "did anyone open this" risk is the deployed-but-unused
  surfaces: Document Repository screens, credentials, the tenant
  chooser, wa_php. Walk them before Erica does.

### Fix session (same day, Bill's go)

All six defects fixed and browser-walked: QR renders on the queue's
Invite panel; Enroll's Back returns to the queue; the chart's Edit
Profile Back returns to the chart with the person loaded (goBackFromMember
learned to re-inject member_id); action bars pinned outside the scroller
on all seven modals (queue item/activation/reactivation, registry
item/follow-up/create/export); the clinic compliance modal closes and its
+ Add Entry opens the entry picker; the export column toggles refresh a
visible preview. Lint 0. Server code untouched (screens only).

### The afternoon sweep (walked by Claude, alone, after the fix session)

Screens walked clean: Documents (detail/download/close), Program Settings
hub (all links resolve; Clinic management + Clinician assignments are
DELIBERATE "coming soon" placeholders), Licensing Boards, PPII weights,
Notification Queue (870 tracked, simulated mode — no provider wired,
by design), Registry History (79 entries, filters, reopen), Protocol
Cards (search, card modal open/close).

Fixed during the sweep (fix 9): **the Credentials page was trapped in
the sidebar column** — the platform shell is a 240px-sidebar grid; this
page has no sidebar, so its whole content rendered inside the 240px
track with every Rename/Retire button clipped. Its sibling admin pages
all neutralize the grid with display:block; Credentials was the one
that missed it. One property, walked at desktop width.

Two findings that are DECISIONS, not defects:

1. **bouncer.js is a placeholder.** Every clinical page's access gate
   returns true with a "Phase 1: everyone gets in" comment. The API
   layer enforces login (data is safe); the gate was always meant to be
   Phase 2 (RBAC). Known-by-design, but nobody had written it down
   where Bill would see it.
2. **The protocol card library is PUBLIC on Erica's live site.**
   /v1/protocol-cards carries a deliberate auth exemption ("static
   reference data — no PHI"), verified anonymously readable on live.
   No PHI is true — but the content is Erica's authored clinical
   protocol IP (248 cards). Whether that stays public is Bill's call
   (and possibly Erica's). One-line change + version bump if closed.

Second leg of the sweep (same session): Compliance Rules (6 rules,
renders), Affiliations (renders; the copy has none defined — empty state
honest), Platform Overview (public, renders), and THE PUBLIC
REGISTRATION DOOR PROVEN END TO END — minted a registration link,
opened it as an anonymous visitor, form carried the code's context
(referral type + affiliation), submitted, and Sweep Registrant #108
exists on the copy with an open CM intake item. The whole Chapter 1
front door works.

Two more findings from the second leg (both decisions/design, no code
changed):

3. **Logged-out clinical pages wear Delta branding.** brand-loader.js
   defaults to tenant 1 when no one is logged in, and since the page
   gate is a placeholder, an expired session + bookmark renders a
   Wisconsin clinical page as "Delta SkyMiles". Violates the
   platform-shared-files layering rule (no tenant-specific defaults).
   Fix wants a neutral fallback brand — small design choice for Bill.
4. **/p/ landing routes by carried context, not code type.** A
   registration-TYPE code without context.target lands on the screening
   page (the fallback). The only real minting door always sets target,
   so no user-facing break — but the server knows the code type and
   could route by it. Hardening note.

Not yet walked: compliance_member deep pass, poser_mobile, CSV export
downloads, the wa_php tenant's screens, and the tenant chooser. Next
sweep starts there.

### Fix 10 — the MEDS self-heal was unreachable (found live, Bill driving)

The day's best find, made by USING the platform: Bill had Jane Doe take
her overdue GAD-7 (scored 18 — severe; no alert by design, GAD-7
severity thresholds await Erica's clinical word). Her stale YELLOW
"Missed survey" item then FAILED to close. Diagnosis: the v125
self-heal lived only inside the MEDS processing routine, but both of
its triggers — the chart-load check and the daily scan — skip
processing when the member's next-due is in the future, which is
exactly the state completing an instrument creates. The heal was
unreachable for the very people it was built for; stale items would
only clear at the NEXT cadence date, weeks later. The v125 test proved
the healing block worked but never proved it was reachable — the same
lesson as the buttons, one layer down.

Fix (SERVER_VERSION 2026.07.21.1425): the auto-resolve is now its own
routine, called from the processing path, from the check's not-due
early exit, and from a new daily-scan second pass over not-due members
still carrying open MEDS items. Proven three ways on the copy: Jane's
chart check healed her item; the scan healed the copy's five stale
carriers (all AUTO_CURRENT) while correctly leaving open the one item
whose member is genuinely still due. Erica's live site heals on the
first scan after the next deploy.

## Findings log — the lessons-as-lenses sweep (July 21, 2026 evening, before Chapter 3)

Each recent lesson was used as a lens to hunt for remaining instances.
Checking and listing only — no code changed.

**Lens: "proved it works, but is it reachable?" (Session 151's lesson).
ALL CLEAN.** The self-heal only ever touches missed-instrument items
(missed compliance events never file registry items, so the heal can't
wrongly close one); the intake SLA job works (flagged an overdue item
July 20; zero overdue-unnotified items today); the F1 escalation job's
"nothing to do" is honest (all eight declining/escalated follow-up
outcomes already carry their F1 items); the delivery queue has no stuck
work (its pending rows are today's, waiting on the delivery window).
**One design question surfaced:** a missed compliance event — even 19
consecutive missed drug tests (David Nguyen, live data) — rings bells
but NEVER lands on the Stability Registry worklist. If nobody acts on
the bell, there is no work item anywhere. Bill/Erica call whether that
is right.

**Lens: "bells routed to nobody," the linked-person variant. NO LIVE
IMPACT.** Position-routed bells attach to logins directly, and tonight's
live deliveries prove them working. The login→person pointer matters
only for the assigned-clinician branch — which no active rule uses yet.
Config hygiene for later: only EricaL is linked; TomJ / JoeD / MarkW
have no person records linked.

**Lens: deactivated people. EXACTLY TWO open items, both Erica Kind's**
— her stale YELLOW, and a RED "PHQ-9 item 9 positive" that is now
OVERDUE and will never be processed because the scan skips inactive
members. The parked what-happens-on-deactivation question now has a
safety-shaped example. No orphaned follow-ups or intake items.

**Lens: the hardcoded-address habit (tonight's lesson). ~10 live files**
(auth.js, lp-nav.js, member-header.js, the workforce dashboard,
poser_mobile, shared renderers) hardcode 127.0.0.1:4001 as the local
API base. Production is safe (off-localhost they use the page's own
address). Dev-only wrinkle; the cleanup is to use the page's own
address everywhere — a development-session item.

**Lens: walk the deployed-but-unused surfaces (Session 150's ruling).**
- **The two-program chooser WORKS** — walked with a throwaway login
  ("TourDemo", created on the copy; superusers bypass the chooser BY
  DESIGN, so the Claude account can never show it; Erica's real login is
  off-limits for demos). "Choose a program" appears at sign-in; the
  header switcher round-trips Washington ↔ Wisconsin.
- **Washington PHP dashboard** renders with correct branding and honest
  zeros (no people yet, by design).
- **Documents page** renders — and holds a DISCOVERY: **Erica filed a
  consent form on her live site July 20** (on test person Erica Kind,
  PDF, Filed). She has started using the repository. The
  no-real-documents gate still holds (it's a test person), but she's
  moving.
- **Compliance page** renders fully (blocks, history, scores, actions).
- **Mobile surface (poser_mobile)** renders inside its phone frame.
  Two nits on this demo surface: the avatar initials read "JM"
  regardless of the person shown, and the stability circle shows "—"
  while the badge says "Stable".
- **CSV export downloads for real** (registry export, all 62 open items
  including tonight's). Nit: the Created column writes raw JavaScript
  date text ("Wed Jul 22 2026 01:18:34 GMT-0500...") — ugly in Excel.

**Small nits from the walk (cosmetic, listed not fixed):** the About
box's Tenant row shows "—" for the Claude login; after arriving via the
chooser or switcher the header breadcrumb reads "Tenant" instead of the
program name; from a bell-opened chart the back button correctly
returns to the Stability Registry but is still labeled "← Roster".

### Open questions parked today

- Registry items on DEACTIVATED members neither process nor heal (the
  scan skips inactive people) — Erica Kind's open item on the copy is
  the example. What should happen to open items when a member
  deactivates? Small design question.

- The two pre-S149 dead buttons (clinic compliance close, export
  toggles) are almost certainly on Erica's live site today — the fixes
  ride the next release; its note to her should mention them.
- The Session 149 batch deploy still follows the normal sequence in a
  development session: full suite → GitHub → CI green → Heroku on Bill's
  explicit go → note to Erica.

## Findings log — Session 152, the screens-hold-up session (July 22, 2026)

The three agenda items all ran: the pixel standard reached Erica's
screens as a standing test, the not-yet-walked surfaces got walked, and
Chapter 3 was prep-walked alone. Walked on the LOCAL database (not a
fresh pull of live) — live was untouched all session.

### The geometry test now covers her screens (agenda item 1)

`tests/insight/test_insight_page_geometry.cjs` — the 89th test, 54
asserts. Every one of her seven daily screens (dashboard, intake queue,
registry, chart, clinic, documents, portal) measured at 1280x720:
primary action buttons inside the viewport, and all seven S150-pinned
modal action bars checked structurally (the bar must be a SIBLING of
the scroller, never a child) and in pixels — with the intake item
detail deliberately grown past the fold with eight triage notes, so
the test fails the way S150's screens actually failed. The portal is
measured as what it is: a clipped-shell page where off-frame means
unreachable.

### Fixed this session, each walked after (screens + one export)

1. **Registry CSV exports wrote raw JS date text** in Created/Resolved
   ("Tue Jul 21 2026 06:12:19 GMT-0500 (…)") — the tour-setup walk's
   known nit. Fixed at the query site; the program export and both
   participant-report formats now write "2026-07-21 06:12".
2. **compliance_member rendered a null cadence as "nulld"** — event-
   driven items (Drug Test Results, Program Status Change) now read
   "as ordered", the chart's own phrasing.
3. **The mobile emulator's avatar read "JM" for everyone** — the
   profile callback updated the name but never the avatar. Now follows
   the person (GS for Dr. Steadman).
4. **The mobile emulator's stability ring was static markup** — "—"
   and "Stable" no matter who loaded, while its own Trends tab proved
   the data loadable. Now wired to the member's real tier + PPII from
   /v1/wellness/members (the portal and clinic's source); shows 17/Red
   for Steadman, matching the clinic exactly.
5. **The registry's safety-note banner list was invisible** (Chapter 3
   prep-walk find, the exact S150 class): the banner said "3 PPSI
   Safety Note(s) Pending Review" but the list rendered EMPTY — the
   entry renderer threw `PARTNER_ID is not defined` (a clinic.html
   variable that never existed on action_queue.html) after the count
   was already set, and the catch swallowed it to a console.warn. On a
   SAFETY surface: pending self-harm-adjacent note reviews announced
   with no reachable Review door. Fixed (navigate with memberId +
   programId); walked — all 3 notes render, Review lands on the chart.

### Chapter 3 prep-walk — the safety net HOLDS (Bill's tour can resume)

- **Registry worklist**: renders 118 open items urgency-sorted
  (sentinels first), urgency chips, caseload filter (David Chen's chip
  filters 118 → 71), export (clean dates now), History door.
- **The showpiece modal**: Steadman's sentinel carries the whole story
  in one screen — dominant driver analysis (stream / sub-domain /
  protocol card D2 — Compound Events), the four auto-generated
  follow-ups with their overdue states, resolution notes, resolve door.
  The protocol card opens from inside the item with Erica's full
  clinical content.
- **Follow-ups tab**: pending/overdue/completed chips, typed checks
  (48hr/weekly/2wk...), detail modal with the four outcome buttons and
  registry context, new-follow-up dialog.
- **History**: 351-entry audit trail, filters, reopen doors, full
  field-level diffs.
- **Bells**: all v125 repointed rules verified in data — every
  registry/drug-test/follow-up rule routes by POSITION (MEDDIR/
  CASEMAN); no rule routes to a role no login holds (test #88 guards
  this in CI). The bell area renders; today's MEDS scan produced fresh
  notifications on schedule.

### Listed for Bill — found walking, NOT fixed (decision-shaped)

1. **Follow-ups chips disagree with the queue on the same screen**:
   the summary endpoint counts only follow-ups whose registry item is
   still open (`sr.status != 'R'`: pending 134 / completed 7); the
   list endpoint has no such filter (179 pending / 11 completed) — 45
   pending follow-ups belong to RESOLVED registry items. Which
   population is right is a clinical design call: does outcome
   tracking continue after an item resolves (then the summary's filter
   is wrong), or does resolving moot the checks (then the list should
   filter, or resolution should cancel them)? Sits beside the parked
   deactivated-members question.
2. **The mobile emulator's launcher doors are orphans**: chart
   `launchMobile()` and clinic `launchPoser()` are defined but no
   button calls either — the only wired door is the portal's card.
   Where should the mobile demo be reachable from?
3. **The mobile emulator hardcodes its assessment battery** (a fixed
   5-instrument array with hand-entered survey links) — the same
   missed-adopter-of-the-v97-assignment-model class S141 fixed on the
   portal. Demo surface, so listed not fixed; adopting the real
   expected-instrument set is a small build if Bill wants it.
4. **Mobile demo dead cards**: Get Support ("Confidential resources"),
   the Home/Me tabs, the streak card, and "Next appointment: Mar 12 —
   Dr. Sarah Chen" are decorative (no handler; no appointment
   machinery exists on the platform). Fine for a demo frame; worth
   knowing before showing it.
5. **Registry item modal says "View Participant"** while S149 renamed
   the intake queue's button to "View chart" per Erica — same action,
   two labels. One-word change if consistency is wanted.
6. **The registry count label ignores the caseload filter** ("118 open
   items" while the filtered list shows 71).
7. **Washington's clinic door dead-ends wordlessly**: wa_php has zero
   partner/program rows locally (almost certainly by design — WA gets
   its real health systems at kickoff, not Wisconsin's), but the
   picker opens as an empty modal with no explanation. Wants an honest
   "No health systems configured yet" empty state; also a kickoff-
   checklist reminder.
8. Confirmed known nits locally: the header breadcrumb reads "Tenant"
   after a program switch; superuser About box Tenant row "—".

### The rest of the walks (agenda item 2) — clean

- **compliance_member deep pass**: full entry flow pressed end to end
  (picker → result → confirm → submit → block updates + history row
  with the note), cadence editor (modes/types/days), export modal
  (preview refreshes on column toggles, CSV downloads for real, clean
  dates), manage-items modal, Back returns to the clinic. The screen's
  refresh after submit is async — it DID refresh (an early read raced
  it).
- **Mobile emulator**: reached through its real door (the portal
  card); check-in opens with real questions (1 of 8), event report
  form full, trends renders real history, exit works.
- **CSV exports**: registry (119 lines) and follow-ups (191 lines)
  download for real server-side; compliance export builds client-side
  with working column toggles.
- **wa_php screens**: dashboard (honest zeros, WA branding), intake
  queue, registry, documents (9-type taxonomy seeded), portal — all
  render honest empty states, zero console errors. Clinic: see listed
  item 7.
