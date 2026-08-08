# BI Worldwide Demo Script

**Meeting:** Tuesday 2026-08-11, afternoon. Ryan Douglas (CTO) + Gary Hansen.
**Runs on:** the local machine (localhost:4001), Bill driving.
**The one-sentence argument:** every program on this screen is the same engine;
the industry, the vocabulary, and the rules are data.
**Deck handoff:** the deck pauses after "All atop the same engine" (slide 24);
the screen switches to the platform. The demo IS slides 25's claims, live.

This is v1. Iterate freely; keep the beat order intact unless Bill reorders it.

---

## Pre-demo checklist (do these Monday, then again Tuesday morning)

1. Server up: `bash bootstrap/start.sh`, then confirm the version page loads.
2. **Extend Bill's Delta record** (member 2153442807): Profile tab, Extend
   button. Without this the header shows "Inactive since 04/21/2026" in red,
   and that line is a question magnet.
3. Walk the whole script once. Nothing below should be seen for the first
   time in the room.
4. Close every browser tab except one. Sign in fresh (the program switcher on
   the menu works from whatever the dropdown shows — fixed S170).
5. Optional polish if configured by Tuesday: Ferrari branding (logo, colors,
   point label — today it reads generic "Loyalty Platform" and "MILES").

---

## Beat 1 — Delta: a living program (3 min)

**Click path:** menu → pick Delta Air Lines → CSR → member 2153442807.
Land on the Activity tab.

**Show:** flights with the green bonus blocks hanging off them (Diamond 50%,
Regional Carrier, Middle Seat), the SkyMiles balance, the tier badge.

**Say:** this is a running loyalty program — the thing BI operates for its
clients today. Everything you're about to see is why none of it is code.

## Beat 2 — The composite: an activity's shape is data (3 min)

**Click path:** menu → Client Admin → Composites (same tenant, Delta).

**Show:** Flight Entry — carrier, origin, destination, fare class, flight
number, points. Walk each field.

**Say:** this page defines what a "flight" IS for this program. There is no
flight table. There is no airline schema. This list of rows is the industry.

## Beat 3 — Molecules: where each field gets its meaning (4 min)

**Click path:** Client Admin → Molecules. Open these four in turn:

- ORIGIN / DESTINATION — backed by the IATA airport table
- CARRIER — a different lookup table
- FARE_CLASS — an internal list (the values live right here)
- FLIGHT_NUMBER — just a number

**Say:** four kinds of field, one mechanism. A new field for a client program
is a row on this screen, not a schema migration. (Deck slide 12's axis —
schema-bound vs configuration-first — this screen is that sentence.)

## Beat 4 — Rules: bonuses and promotions are data too (4 min)

**Click path:** back to the member's Activity tab — point at a green bonus
line. Then Client Admin → Bonuses → open that bonus → Add Criteria.

**Show:** the criteria picker offers exactly the vocabulary from Beat 3 —
carrier, origin, destination, fare class... the molecules ARE the rules
language.

**Say:** marketing configures this; nobody deploys anything.

## Beat 5 — The live change (2 min, rehearse until boring)

**Click path:** in the bonus editor, change one bonus amount (pick the bonus
in rehearsal and stick with it). Save. Back to the member: Add Activity,
post a flight that qualifies. The green block shows the new amount.

**Say:** that change went from idea to firing in under a minute, on a live
program, with no release. That is the operating model.

## Beat 6 — The Marriott flip (2 min)

**Click path:** menu → pick Marriott Hotels → Client Admin → Composites.
Then CSR → any member with stays.

**Show:** the SAME composite page now says Stay Entry: brand, property,
nights, eligible spend. The same CSR page shows hotel stays.

**Say:** same screens, same engine, different rows. This is what "a new
vertical is a sales conversation, not a feasibility study" looks like.

## Beat 7 — Ferrari: a program being born (3 min)

**Click path:** menu → pick Ferrari → Client Admin → Composites. Then CSR →
member 2 (Isabella Chen).

**Show:** Service & Purchase Entry — model, service type, dealer, amount.
Isabella bought a Purosangue at Ferrari Scottsdale ($398,500 → 50,000
points) and came back for detailing. Balance derived, never stored.

**Say:** this program did not exist last week. It was stood up through the
same admin doors you just watched — vocabulary, composite, entry form,
display, members — no code, no schema. BI's onboarding economics: every
new client program is THIS, not a project.

## Close (1 min)

Back to the deck (the schema-that-re-calcifies close, slides 35-36). Then
the talking list — said out loud, never printed:

- what "multiple currencies" means for BI (points-by-program vs financial)
- whether the third state transfer type is taxable
- in-flight / reserved transactions — the one piece we would define together

Framed as: "here is what we'd settle together in a first phase."

---

## Total: ~22 minutes plus questions

## Known rough edges (fix or avoid)

- Ferrari branding is unconfigured (generic header, "MILES" label).
- Ferrari amounts render unformatted ($398500). Cosmetic; display templates
  can carry formatting later.
- Do NOT demo the Stability Registry live (it's a deck screenshot; the live
  screen has the overflow-number row — S170 known bug, on the fix list).
