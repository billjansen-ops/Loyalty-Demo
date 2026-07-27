# Outbound Messaging (SMS + Email) — design contract

Designed in conversation with Bill, 2026-07-27 morning (Session 158).
Status: **designed, build on Bill's go** — the intended next build while
Erica's WA ranking is awaited. Bill's decisions are the contract;
implementation conforms to them, never renegotiates from code wrinkles.

The one-sentence pitch: **callers are finished forever.** Anything that
needs to reach a member calls a black box and never cares what happens
next. The provider — not yet chosen, deliberately — wires in INSIDE the
box later; no caller (MEDS included) ever changes.

---

## 1. The black boxes (Bill's core design)

Three helpers, layered:

1. **The SMS helper** and **the Email helper** — send this message on
   this channel. The ONE place in the platform that will ever talk to a
   provider. Until a provider is chosen, the handoff line inside is a
   LOUD stub (exactly the MED sms/email result pattern today) — but the
   queue record, history, and everything around it is real and final.
2. **The routing helper** — "this member must hear this, you pick the
   channel." Consults the member's channel preference (a new member
   value; goes through the molecule conversation per standing rule) and
   calls box 1 or 2.

Callers pass:
- **Urgency**: `now` (password reset — attempt immediately, bypass the
  queue wait and the delivery window) or `queued` (the MED win-back —
  a wake-up drains it). EITHER path writes the same history record.
- **Message class**: `operational` or `marketing` (Bill asked; still
  legally load-bearing). Operational (resets, receipts, statements)
  skips the opt-out check by design — an unsubscribed member still gets
  their password reset. Marketing gets the full rulebook: opt-out
  group, consent-to-text, unsubscribe. Insight's participant-facing
  messages are a third lane gated by the consent architecture
  (tenant-level gate INSIDE the box — a config mistake cannot leak
  past it).

The pre-flight checks live INSIDE the boxes — callers never think about
them: opt-out (do-not-contact member group — the suppression-list win
from the Groups design), invalid-address history (§3), consent gates,
per-tenant channel enablement.

## 2. The queue table (build now; provider later)

One row per send attempt — the history Bill asked for, written for BOTH
urgent and queued sends:

- recipient (member link), channel, class, urgency, message content,
  status (pending → sent / failed / suppressed-with-reason)
- **provider receipts** (Bill: "store this as part of the queue
  record"): the provider's message id at handoff, and the final verdict
  (delivered / bounced / rejected) when the callback arrives
- attempt count + robust retry with backoff; when the retry budget is
  exhausted the failure lands in a VISIBLE failed pile on a screen —
  never a silent grave (no-silent-failures applied to messaging)

**Scale manners (the 364k lesson):** a giant MED run enqueues fast and
drains in PACED batches (providers have rate limits); the wake-up
processes oldest-first within urgency; the table needs a retention
plan (marketing history at 10M scale does not grow forever unexamined).

**Wake-up:** a scheduled job on the shared platform scheduler (the same
clock that runs MED_SCAN and clinical MEDS — job rows are data).
Urgent sends attempt inline at call time; the job is the queue's
heartbeat and the retry engine.

## 3. Non-deliverables — the molecule history (Bill's design)

Providers report dead addresses two ways: instant rejection at handoff,
and the **callback** — a small inbound door WE host, which the provider
calls with verdicts (delivered / hard bounce / number out of service /
spam complaint). The door authenticates that reports really came from
the provider and stamps the queue record.

A hard verdict also writes a **member molecule**: one row per event
carrying **the address that died and the date we heard** (multi-column,
member-attached, unlimited rows — "if a member has a number of these,
who cares"). This is the platform's temporal thesis applied to a dead
mailbox:

- Nothing is ever cleared. The pre-flight check derives current truth:
  "does the member's CURRENT address match a recorded bad one?" A
  changed address stops matching and is sendable again automatically.
- The rows ARE the history: every address a member ever burned, dated.
- Suppressing known-dead addresses is what protects sender reputation
  (bounce rates poison deliverability for ALL our mail).

## 4. Sender identity (multi-tenant)

Delta's messages come from Delta; Insight's from Insight. From-address
and from-number are per-tenant config (sysparm). Email requires DNS
proof (SPF/DKIM records — touches the domain owner when a provider is
chosen; primada.io DNS is at Squarespace via Mark). US application SMS
requires carrier registration (days-to-weeks of lead time + monthly
fee) — start that paperwork when a real use appears.

## 5. The test-safety catch

From day one: an environment off-switch, ON everywhere except
production, that makes the boxes physically unable to hand anything to
a real provider. The suite, local demos, and dress rehearsals must
never text a human. (The stub era is safe by construction; the switch
exists BEFORE the first provider credential does.)

## 6. Architecture note — what already exists, and the one open point

The platform already runs a staff-notification delivery pipeline
(S95): `notification_delivery` (+config) with pending/held/sent/failed
states, retry budget, per-tenant delivery windows, digest batching, and
the NOTIFY_DELIVER 5-minute job — stopped at the same provider stub.
Its recipients are PLATFORM USERS (staff logins, NOT NULL). Member
messaging is a different population with a different legal rulebook,
different scale (a 364k blast), and different retention.

**Recommendation (flagged for Bill's ruling at build time):** the
black-box send helpers are the ONE shared provider door — when a
provider lands, the staff pipeline's stub calls the same helpers, so
the platform still has exactly one place that talks to providers. The
QUEUES stay per-population: staff bells keep their table and job
untouched (live machinery on Erica's site — this build must not
destabilize it); member messaging gets its own right-sized queue table
and drain job on the shared scheduler. Same pattern as clinical MEDS
vs automatic MEDS: share the clock (and now the provider door), nothing
else.

## 7. What this build finishes retroactively

- MED sms/email results stop being loud no-ops and become real
  enqueues — MEDS is DONE, per Bill: "processes like MEDS don't have
  to be changed" when the provider arrives.
- The OUR_LIST provider decision stays open but shrinks to: pick
  vendor(s), sign what needs signing (BAA for anything Insight), put
  credentials in config, fill in the handoff line, wire the callback
  door's provider adapter.

## 8. Deliberately NOT in this build

- The provider pick itself (money + BAA + Bill's call).
- Participant-facing Insight messaging (gated on Erica's consent
  architecture — the tenant gate ships OFF for workforce tenants).
- Inbound anything beyond the delivery-verdict callback (no two-way
  messaging; that is consent-architecture territory).
- Push notifications (channel exists in the staff pipeline; member
  push has no device story yet).
