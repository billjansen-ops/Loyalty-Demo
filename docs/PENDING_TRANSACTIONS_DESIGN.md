# PENDING TRANSACTIONS — the settled design

**Status: DESIGNED, NOT BUILT.** Nothing in this document exists in code yet
except its foundation (see §7). This is the contract to build to when a client
needs it. Bill's design, settled 2026-08-05 in the BI Worldwide stream.

**Why it exists:** it is Ryan Douglas's (BI Worldwide CTO) requirement — a
points account has to be able to show a member something that is *coming* but
has not happened yet, and then reconcile it honestly when the real event lands.

---

## 1. What a pending transaction is

Something the program expects to happen, shown to the member before it does.

A hotel stay booked for next month. An airline segment ticketed but not flown.
A rebate approved but not yet funded. In every case the member should be able
to see it — *"5,000 points, expected"* — while everyone understands it has not
actually happened.

Two rules make the whole thing simple, and both are deliberate:

- **Pending points are not in the balance.** Not in the balance, not in the
  point buckets, not spendable, not counted anywhere a number is totalled.
- **Therefore there is nothing to net, ever.** No reversal entry, no negative
  correction, no reconciliation arithmetic. A pending row is a *statement about
  the future*, not a transaction. This is the ruling that keeps the design
  small; everything below follows from it.

---

## 2. The shape: a pending event is an activity that carries nothing

A pending transaction is a **normal activity with zero points**, carrying one
molecule that holds what is pending.

| | |
|---|---|
| Activity | ordinary row, **zero points**, the usual member/date/type machinery |
| Molecule | storage pattern **`44`** — two 4-byte columns |
| column 1 | the pending points (4-byte numeric) |
| column 2 | **the moment it stops being applicable** (4-byte `bigdate`) |

It is an activity — not a new table, not a status column on something else —
because activities are already the thing the platform lists, permissions,
audits, and displays. A pending event needs every one of those, and inventing a
parallel object would mean building all of it twice.

Storage pattern `44` does not exist in the database yet; the molecule creation
routine makes the table on first use.

---

## 3. When the real event lands: a SECOND activity, not an edit

**The pending activity is never modified and never deleted.**

When the real thing happens:

1. The real activity is created normally — full points, the ordinary path,
   every engine sees it exactly as it would any other event.
2. The **real** activity gets a molecule pointing **back** to the pending one.
3. The **pending** activity gets a molecule pointing **forward** to the real one.

Both are 5-byte activity links (`value_type 'link'`, storage pattern `5`) — the
same shape the platform already uses to tie a flight to the bonus activities it
produced.

### Why not convert the activity in place

An earlier version of this design said "convert it in place." That was wrong,
and it is worth recording why so nobody re-proposes it:

- **It rewrites history.** Once converted, the fact that anything was ever
  pending is gone. The platform is temporal-first everywhere else — a balance is
  derived from events that are never edited — and this would have been the one
  place a record got quietly rewritten.
- **It loses the interesting difference.** The whole value of the record is
  being able to say *we expected 5,000 on the 3rd and 4,200 actually landed on
  the 7th.* An in-place edit destroys exactly the pair of facts anyone would ask
  about.
- **It makes the audit trail explain a mutation** instead of two clean
  creations.

Two rows with pointers costs one extra activity and gives a complete history.

---

## 4. The display rule — derived, never stored

> **A pending activity appears in the list only if nothing points forward from
> it, and its moment has not passed.**

That is the entire rule. Note what is *not* here: there is no status field, no
"converted" flag, no "expired" flag. Nothing to set, nothing to forget to set,
nothing to drift out of sync — the same reason the platform derives balances
instead of storing them.

The real activity always shows, like any other activity.

---

## 5. Expiry — checked when read, never swept

The moment in column 2 answers *when does this stop being a believable
prediction?* Past it, the pending row stops showing.

**There is no sweep job.** The comparison happens when the list is read. A
pending event that never converts simply stops appearing on its own, and its
record survives for anyone who goes looking.

---

## 6. Decisions taken, so they are not re-litigated

**Both pointers are kept, and they do different jobs.** The forward pointer
(pending → real) is *machinery* — the display rule reads it. The back pointer
(real → pending) is *provenance* — it answers "what was this expected to be?"
for someone looking at the real transaction. Either could technically be derived
from the other, but only by scanning, and at ten-million-member scale the
platform does not scan. Do not "simplify" one away.

**One-to-one for the first version, but nothing may forbid many.** A single
pending closed out by two real events, or one real event closing two pendings,
is a real business case that we are not building yet. A molecule already allows
several rows on the same link, so leaving the door open costs nothing today —
just never write a guard that assumes exactly one.

**The pointer molecules are plumbing, not vocabulary.** Their definitions carry
`attaches_to: ''` so they never appear as a rules criterion (MOLECULES.md
§5.35). Six molecules shipped with copied letters they had not earned before
that rule was written down; these must not be the seventh and eighth.

**Nothing about pending touches the buckets.** Restated because it is the
assumption every other simplification rests on.

---

## 7. What already exists (built 2026-08-05)

The foundation is in and proven — **the 4-byte `bigdate`**, a molecule column
that carries a *moment* rather than a calendar day, at 10-second precision.
Before it, a molecule could hold a date but not a time, so column 2 above had
nowhere to live.

Also landed in the same work, because pending depends on it being trustworthy:
date molecules now **translate inside the molecule engine** in both directions —
you hand it a real date, you read back a real date, and a bare epoch number is
refused rather than guessed at. See MOLECULES.md §4.1 and the standing guard
`tests/core/test_date_molecules.cjs`.

**Still to build, when a client needs it:** the pending molecule itself, the two
pointer molecules, the write path, the display rule in the activity list, and
the tests.

---

## 8. How to describe this out loud

Plain-English version, for a meeting:

> A pending transaction is an activity worth zero points that carries a note
> saying what is expected and when that expectation runs out. It never touches
> the balance, so there is nothing to reverse or net later.
>
> When the real event happens we write the real activity and link the two
> together — the pending one points forward, the real one points back. We never
> edit or delete the pending record, so the history keeps both facts: what was
> expected, and what actually happened.
>
> The member's list shows a pending item only while nothing has replaced it and
> it hasn't run out. That's derived from the links themselves, so there's no
> status flag anywhere to get out of step.

The honest caveat if asked: **this is designed and not yet built.** The piece it
depends on — a molecule that can carry a moment in time — was built and proven
on 2026-08-05.

---

*Design settled with Bill 2026-08-05 (BI Worldwide stream). The two-activity
cross-pointer shape replaces the earlier "convert in place" note in ACTIVE_WORK.*
