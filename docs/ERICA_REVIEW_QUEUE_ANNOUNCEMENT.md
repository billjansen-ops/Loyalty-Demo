# DRAFT — Email to Erica: Registration Review Queue release (Session 129)

**Status: FINAL — approved by Bill 2026-07-02, addressed to Erica AND Tom.**
**Deployed and verified live on demo.primada.io before this draft was written (2026-07-02).**

---

Subject: WisconsinPATH update is live — registration reviews, staff roles, and referral tracking

Erica and Tom,

A significant update is live on the site. It's one connected story: **how a participant
enters WisconsinPATH** — from registration through your team's first clinical decision.
Everything below works today, and you can test all of it in about ten minutes.

## What's new

1. **Staff positions.** You can now record who your Case Managers, Medical Directors, and
   Clinicians are, per clinic. This drives everything else below.
2. **The registration review queue.** When a new participant registers, a review lands in
   the Stability Registry worklist with a 48-hour clock, and your Case Managers are
   notified automatically. They triage it and choose: advance the person into the program,
   escalate to the Medical Director, or route them to resources.
3. **Referral tracking.** Every participant now carries how they entered the program
   (self-referral / employer / board-mandated), editable on their profile — and the
   Program Dashboard has a new **"By Referral Source"** tab.
4. **Users & Roles.** Program Settings now has a live Users & Roles area where you manage
   your staff accounts and their position assignments yourself.

## Before anything else: assign positions (2 minutes — one of you should do this part)

The queue routes by position, so this step comes first — until someone holds the
Case Manager position, registration notifications have nowhere to go.

1. Log in → **⚙️ Program Settings** (top of your dashboard) → **Users & Roles**.
2. Click **Edit** next to a staff member .
3. In the **Clinic Position** box on the right: pick the position (e.g. Case Manager),
   pick the health system, then the clinic, click **+ Add**.
4. Give someone the **Medical Director** position too — escalations go to them.
   One person can hold several positions across several clinics.

## Test the queue end to end (5 minutes)

1. **Enroll a test participant** from the clinic roster, the way you normally enroll.
2. **Watch the bell** (top right) — everyone holding Case Manager gets
   "New registration awaiting review," naming the participant.
3. Open the **Stability Registry** worklist → you'll see a new **📥 Registrations** chip.
   Click it. The new registration is there with its 48-hour clock.
4. Click the item. Write a **triage note** (required — the buttons won't act without one),
   then pick a disposition:
   - **✓ Advance** — accepted into the program; the review closes with your note.
   - **➜ Route to Resources** — not right for the program; closes with your note.
   - **⚠ Escalate** — hands it to the Medical Director, who gets a notification carrying
     your note. The item shows as Assigned.
5. **The overdue clock:** if a review sits past its window, it escalates on its own —
   flags orange, assigns to the Medical Director, notifies. To see it without waiting two
   days: Program Settings → **Scheduled Jobs** → run **Registration Review SLA Check**.

## What's different on screens you already use

- **Participant profiles** have a "Referral Source" field (self / employer /
  board-mandated). It's blank for existing participants until set.
- **Program Dashboard** has the new "By Referral Source" tab in Program View, and a
  **⚙️ Program Settings** button at the top.
- **Users & Roles** shows only your program's staff — you'll see your real team there
  (you two, Joe, Mark) and can manage their accounts and reset passwords.

Notification timing, the 48-hour window, and the routing (Case-Manager-first, escalate to
Medical Director — per your answer) are all settings, not code — say the word and we tune
them.

As always: test with throwaway participants, tell me what's wrong, what's confusing, and
what's missing.

Bill

---

*Draft notes for Bill (not part of the email): the live site was verified after deploy —
version endpoint, public pages, database at v95, and the queue configuration all confirmed.
Erica's real staff on the live site: EricaL, TomJ (active; an older TomJ413 login sits
inactive), JoeD, MarkW. Positions have NOT been assigned to anyone on the live site — that's
deliberately left for Erica (or you) so her first walkthrough starts from the true beginning.*
