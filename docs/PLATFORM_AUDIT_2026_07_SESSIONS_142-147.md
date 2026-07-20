# Platform Audit — 2026-07-19 (Session 147)

> **STATUS: OPEN.** Scope = everything built Sessions 142–147 (intake
> rebuild, all-or-nothing startup, credentials, Washington + tenant
> chooser, login→person bridge, Document Repository, staff-record fix) —
> none of which existed when the July audit (Session 137) was scoped.
> Six read-only lenses ran in parallel; every load-bearing finding was
> **verified by hand against live code** before being recorded here.
>
> **UPDATE 2026-07-19 evening: the six Tier-1 fixes below are DEPLOYED and
> live-verified on Heroku (2026.07.19.2131 / DB v123). v123 was
> dress-rehearsed on a fresh copy of her live data first (applied clean, 0
> violating rows). The XSS-fix assets were confirmed served on the live
> site.**

**Why:** after the biggest release the platform has shipped went live to
Erica, Bill asked for an adversarial second look at six sessions of work
that had only ever seen their own tests. Weighted toward security because
the Document Repository is the most PHI-shaped surface the platform holds
and Washington's definitive agreement will ask about security posture.

**Verdict: the foundations are sound.** Tenant isolation holds with no
exploitable cross-tenant hole; document tamper-evidence works; the intake
permission gate is genuinely server-side; SQL-injection surface is clean;
dates are correct; molecule integrity is solid with retire-not-delete
honored on every write path. The real findings cluster in ONE place:
authorization and abuse-resistance on the newest outward-facing surfaces
(the public registration door and the document store). Nothing was on
fire at audit time — Erica had just received the site, registration links
are staff-distributed, no hostile users exist, and the standing "test
files only" rule keeps real PHI out of the document store.

---

## Tier 1 — the sharp edges (fix batch, Session 147)

### 1. HIGH — Stored XSS in the Intake Queue (verified)
`verticals/workforce_monitoring/intake_queue.html` builds each row's HTML
by template string and injects the registrant's name with **no escaping**
anywhere in the chain: `NameCred.withCreds` (`name_format.js`) does not
escape, the page has no `esc()` helper, and the server's `clean()`
(`server/intake.js:335`) only trims/truncates — it does not strip HTML.
A person registering through a public link with `fname` =
`<img src=x onerror=…>` gets their script run inside a case manager's or
medical director's authenticated session when they open the queue. The
ONLY finding an unauthenticated outsider can trigger that lands in a
privileged session. Same page, same defect: `note_text`/`author_name`
(triage notes), `member_name` re-emitted through an `onclick` in
`startActivation`, and `resolution_notes`/`assigned_to_name`/etc.
**Fix: add an escape helper + escape every DB/user field on the page.**

### 2. MEDIUM — XSS in credential-label rendering (verified same class)
`physician_detail.html:815-816` and `admin_credentials.html:105` inject a
CREDENTIAL molecule label raw into text, a `title=` attribute, and an
`onclick=` arg. Admin-entered (lower reach than #1) but propagates to
every name-with-creds surface. The rest of `physician_detail.html`
correctly uses `escDoc()` — this block was missed.

### 3. HIGH — Cross-tenant clinic assignment in participant activation (verified)
`server/intake.js:847` resolves the caller-supplied `program_id` with
`SELECT … FROM partner_program WHERE program_id=$1 AND is_active` — no
join to `partner`, no tenant filter (`partner_program` has no `tenant_id`
of its own; it is tenant-scoped only through `partner.tenant_id`). A case
manager in tenant 5 can POST another tenant's `program_id` and assign
their participant to another program's clinic. **Fix: `JOIN partner p …
WHERE p.tenant_id = $1`.**

### 4. MEDIUM — v122 creation-flags accept ANY member-side flag (verified)
`pointers.js` POST `/v1/member` validates creation flags only via
`resolveFlagInfo(tenantId, key, 'M')` — "exists + is a flag + has an M
side" — NOT an allowlist. For tenant 5 that admits `IS_DELETED` (soft-
delete on creation) and `IS_CLINICIAN`, not just the intended clinician
flag. Needs an authenticated staff login to abuse. **Fix: a tenant-safe
allowlist of creation flags.**

### 5. HIGH — No abuse-resistance on the public registration + login doors (verified)
No rate limiting anywhere in the platform (`grep` clean). `POST /v1/register`
can be scripted to flood the wi_php intake queue with junk registrants
(dedup only collapses exact name+email). `POST /v1/auth/login` has no
brute-force lockout. Separately, `/v1/register` calls `resolveCode`
(read-only) but never `consumeCode`, so a "single-use" registration link
is NOT capped on the door that writes data. **Fix: per-IP rate limiting on
both doors; make register consume the code so `max_uses` gates the write.**

### 6. MEDIUM — `/replace` bypasses the per-tenant size cap (verified)
`pointers.js` document `/replace` checks only that the buffer is non-empty
— it omits the `maxMb` check the upload path enforces. Bounded by the
15 MB express-json ceiling. **Fix: copy the maxMb check into replace.**

### 7. LOW (known, 2-minute) — notification_rule CHECK too narrow
The `assigned_clinician` recipient type is unreachable config because the
`notification_rule` CHECK constraint was never widened (found S146).
**Fix: one-line migration widening the CHECK.**

---

## Tier 2 — real, narrower

### 8. HIGH-class but low-odds — Intake dispositions are check-then-act with no lock (verified)
`server/intake.js` action/activation/reactivation handlers read an item
on the autocommit pool, guard on its status, then UPDATE — no
`SELECT … FOR UPDATE`, no transaction. Two staff acting on one item at
once can lose a disposition or double-create (same class the Session 145
audit closed for the four member-write windows). Low odds with few staff,
but this surface's whole purpose is trustworthy clinical dispositions.
**Fix: wrap each handler in a member/item-row-locked transaction.**

---

## Tier 3 — hardening, latent, not exploitable today (tracked second batch)

- **Login username enumeration** — timing (bcrypt only runs for real
  users) + the distinct "Account is deactivated" message confirm a
  username exists. Fix: dummy-hash unknown users; generic message.
- **CORS reflects any origin in prod** (`origin: true` when `DATABASE_URL`
  set) with `credentials:true`, and the session cookie sets no explicit
  `SameSite`. Fix: pin prod origin; set `SameSite=Lax`.
- **`req.tenantId || req.query/body.tenant_id` fallback** across ~a dozen
  vertical endpoints — dead for authenticated non-superusers today (the
  wall middleware forces the client param to null), but leans on a data
  invariant no schema constraint enforces. Fix: drop the fallbacks, or add
  a constraint that every non-superuser has a home tenant.
- **Document index is enumerable, unaudited** — `GET /v1/documents`
  search/list returns titles + member names for the whole tenant and
  writes no audit row (only card-open and download audit). Card-view and
  download both log action 'V' (indistinguishable). Fix: audit the list;
  split view vs download actions.
- **File bytes served `inline` without `X-Content-Type-Options: nosniff`**
  — mitigated by explicit Content-Type + svg/html exclusion; add nosniff
  and prefer `attachment` for a PHI store.
- **Cross-tenant existence oracle** — `resolveDocumentRefs` link-probe has
  no tenant filter; a 404-vs-success difference confirms which `link`
  values exist in any registered table. No content leaks.
- **Internal error detail leaked** — document handlers return
  `error.message` (incl. storage locator) to the client. Fix: generic
  client message, detail to the log.
- **Unused hard-delete door bypasses retire-not-delete** —
  `DELETE /v1/molecules/:id/values/:valueId` hard-deletes a
  `molecule_value_text` row with no in-use guard; the UI never calls it,
  but it undermines the invariant. Fix: refuse when the value is
  referenced / route to retire.
- **v113 seeds survey links via `MAX(link)+1`** instead of `getNextLink`
  — safe today (disjoint numeric ranges) but the forbidden two-allocator
  pattern.
- **Client/server upload cap mismatch** — client rejects at 14 MB, server
  default 10 MB. Cosmetic.

---

## Tier 2b — DEFERRED BY DESIGN, PINNED TO A GATE

### Document Repository role-based access control
`pointers.js` document read/download paths gate on login + tenant only —
**no role check, no object-level scoping.** Any authenticated user in a
program can read every consent, lab report, and evaluation in it. The
`confidentiality` column exists but is never populated on insert and never
read on any path (decorative). This is a gap against Erica's spec, which
asked for role-based access.

**This is deferred deliberately** because it needs the role model
decided — and **DECIDED (Bill, 2026-07-20): the role model is ERICA's to
define** (she wrote the spec; what a case manager vs. medical director
vs. admin sees, whether a participant sees their own). Ask her alongside
her release walk + ranking. It pairs with the Phase B storage + BAA work.

**THE GATE (forcing function so this cannot silently vanish):**
**No real (non-test) document may be uploaded to any live tenant until
role-based document access is built.** This is enforceable today because
the standing rule is already "test files only until production storage +
BAAs exist" — the two unlock together. When Phase B is scoped, RBAC is a
required part of it, not an add-on.

---

## What was verified SAFE (checked, not a problem)

- Tenant isolation / the S121 wall: session-authoritative scoping; the
  switch re-checks authorization every call; grants additive; person
  bridge + Washington grants confined; no tenant-admin → superuser
  escalation; roles never trusted from the client session cache.
- Document tamper-evidence: checksum re-verified on every byte read; no
  path returns bytes without verifying.
- Document tenant confinement on every endpoint; SQL-injection surface
  clean (linked_table validated against link_tank; all values parameterized).
- Intake ROLE gate genuinely server-side: a positionless `csr` gets 403 on
  every action; client buttons are render-only.
- v122 sweep join correct (attaches_to='M', per-tenant molecule_id,
  tenant-scoped items; does not restamp member status).
- Retire-not-delete honored on every WRITE path; value_id overflow
  defended (explicit 1..N + CHECK 1..127); member-molecule lookup rows
  present; v119 ML echo sweep self-verifies with a throw.
- All migrations v111–v122 idempotent and resolve-by-name/key.
- Dates in the new screens clean (local-midnight parse / en-CA today); the
  new Documents screens escape all DB text; every fetch checks `.ok`; no
  silent catches; `document_storage.js` is tenant-generic.

---

## Disposition

- **Tier 1 #1, #2, #3, #4, #6, #7: FIXED Session 147** (SERVER_VERSION
  2026.07.19.2131, DB v123). XSS closed on the Intake Queue + credential
  labels (browser-proven with a live `<img onerror>` payload — never
  fired, rendered as inert text on all three sink paths); cross-tenant
  clinic assignment closed (partner join + tenant filter); v122
  creation-flags reject `system_required` flags; `/replace` honors the
  size cap (shared helper); v123 widens the notification_rule CHECK.
  Tests grew: intake rebuild 74→76, document repo 40→41; both green
  targeted + phase-2 activation re-proven.
- **Tier 1 #5 (registration abuse-resistance): BUILT Session 147** (after
  Bill's decisions — hand-built, thresholds in settings). A per-IP
  fixed-window rate limiter (no dependency) on `/v1/auth/login` +
  `/v1/register`, thresholds in sysparm (tenant 0, `rate_limits`, v124 —
  login 15/10min, register 10/10min), bypassed in test/CI via
  RATE_LIMIT_DISABLED (the suite drives many logins/registers from one IP);
  proven to fire manually. Single-use links now enforce at the WRITE:
  consumeCode gained a peek mode, `/p/:code` peeks registration codes
  (opening/refreshing no longer burns the use) while other code types still
  consume at the landing, and `/v1/register` atomically consumes a capped
  registration code — closing the direct-POST reuse hole. Proven:
  intake_phase2 +6 asserts (landing doesn't burn, write consumes, reuse
  blocked), test_codes still green (referral consumes at landing).
  ORIGINAL NOTE (kept for context): DEFERRED — needs a decision, NOT rushed. Two parts, each with a real choice: (a) rate
  limiting needs either a new dependency (express-rate-limit) or a
  hand-rolled per-IP limiter AND threshold numbers — and it throttles
  Erica's LIVE login, so wrong thresholds lock her out; (b) making a
  single-use link actually single-use requires deciding WHERE the use is
  counted — today `/p/:code` (the landing) consumes it but `/v1/register`
  (the write) does not, so naive "register also consumes" double-counts
  and breaks the legit flow. Both touch the live public door and deserve
  Bill's call. Lower urgency than it sounds: links are staff-distributed
  today. **Recommended next: pick the rate-limit approach + thresholds,
  and move the use-count to the register write (landing stops consuming).**
- **Tier 2 (#8) concurrency locking: scheduled** as a near-term follow-up.
- **Tier 3: tracked here** as a second hardening batch, lower priority.
- **Tier 2b document RBAC: pinned to the "no real documents until RBAC"
  gate above,** unlocking with Phase B.
