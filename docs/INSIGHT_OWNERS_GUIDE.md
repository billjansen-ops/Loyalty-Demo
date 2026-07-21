# The Insight Owner's Guide

Started Session 150 (July 21, 2026) — the tutorial session. This is Bill's
plain-English map of the Insight platform. It grows a little every time we
tour a part of the system. No jargon; where a technical term is unavoidable
it gets explained the first time it appears.

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

Real example on the rehearsal copy: Jane Doe has four trips — an MD
review resolved to evaluation (July 13), two July 20 trips (one routed to
resources "not interested currently"; one that ping-ponged CM → MD →
back for more information → up again → back "done" → routed to resources
"Go to therapy"), and one open item on a case manager's desk.

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

### Friction (works, but shouldn't work like this)

1. **Queue rows don't look clickable** — no visual affordance; keep the
   whole-row target but add a chevron/View hint and a stronger hover.
   (Check roster + registry rows for the same pattern.)
2. **Invite and Enroll sit side by side and look identical** — two very
   different actions (mint a link vs open the enroll form); easy to hit
   the wrong one and not notice.
3. **Deep links to context pages dead-end** — clinic.html and
   physician_detail.html opened without session context show a bare
   error line with no header and no way back; the chart ignores a
   ?memberId= URL parameter entirely (context comes only from the
   session). Bookmarks to a chart don't work.

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

### Open questions parked today

- The two pre-S149 dead buttons (clinic compliance close, export
  toggles) are almost certainly on Erica's live site today — the fixes
  ride the next release; its note to her should mention them.
- The Session 149 batch deploy still follows the normal sequence in a
  development session: full suite → GitHub → CI green → Heroku on Bill's
  explicit go → note to Erica.
