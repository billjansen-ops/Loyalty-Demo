# BEFORE YOU WRITE — Stop and Read

Before writing new code that touches **dates**, **fetches**, **collection-save flows**, or
**platform-shared files**, check this file. These are bugs the platform has been bitten by
repeatedly across multiple sessions. Don't repeat them.

Run `node tests/lint-anti-patterns.cjs` to check for current violations.
It is a grep-style fail-on-match gate now, not just an informational report.

---

## Dates

**The canonical date functions live in `pointers.js`. Do not write your own.**

| Function | Use for |
|---|---|
| `dateToMoleculeInt(date)` | JS Date or `"YYYY-MM-DD"` string → Bill-epoch SMALLINT. Uses `Date.UTC()` arithmetic; DST-safe. |
| `moleculeIntToDate(num)` | Bill-epoch SMALLINT → local-midnight JS Date (calendar day correct in any TZ). |
| `platformToday()` | Today's date as Bill-epoch SMALLINT. |
| `platformTodayStr()` | Today's date as `"YYYY-MM-DD"` string (local). |
| `dateToBillEpochDateTime(date)` | JS Date → Bill epoch **datetime** (10-second blocks). |
| `billEpochToDate(auditTs)` | Bill epoch **datetime** → JS Date. The decoder — easy to forget it exists. |
| `platformNow()` | Current time as a Bill epoch **datetime** integer. |

Postgres-side: use the SQL functions `date_to_molecule_int(date)` and `molecule_int_to_date(integer)`.
They were already correct (Postgres date arithmetic doesn't involve DST).

### There are TWO Bill-epoch encodings — don't mix them up

This bit us for real (a "days since last survey" calc decoded a **datetime** column as if it
were Unix seconds, and a parallel copy did wall-clock millisecond math). Know which one a
column uses before you touch it.

**Bill-epoch DAY** — for *date* columns (a calendar day, no time):
- `SMALLINT`. Days since Dec 3 1959, **offset by −32768** to use the full SMALLINT range
  (so the epoch day stores as −32768). `platformToday()` returns that same offset value, which
  is why it compares directly against stored date columns.
- Helpers: `dateToMoleculeInt` / `moleculeIntToDate` / `platformToday` / `platformTodayStr`.
- Columns: molecule date fields, `member.active_through_date`, `member.enroll_date`,
  `registry_followup.scheduled_date`, `compliance_result.result_date`,
  `physician_annotation.annotation_date`.

**Bill-epoch DATETIME** — for *timestamp* columns (date + time):
- `INTEGER`. 10-second blocks since Dec 3 1959 00:00:00 UTC. **No −32768 offset** (different
  scheme). Mirrors Postgres `timestamp_to_audit_ts()` / `audit_ts_to_timestamp()`.
- Helpers: `dateToBillEpochDateTime` / `billEpochToDate` / `platformNow`.
- Columns: `member_survey.start_ts` / `end_ts` (migration **v55** converted these from Unix
  seconds), audit-change timestamps.

**Not everything is Bill-epoch.** Some columns are native Postgres `timestamptz` — e.g.
`notification.created_at` (compared in SQL with `NOW() - INTERVAL`). Rule of thumb: an
`integer`/`smallint` column holding a date or time is Bill-epoch; a `timestamp`/`timestamptz`
column is native. When unsure, `\d <table>` and look at the type.

### Days-between: compute on calendar days, never wall-clock milliseconds

To get "days since" a DATETIME column, decode it then subtract Bill-epoch **days**:

```js
const days = platformToday() - dateToMoleculeInt(billEpochToDate(row.end_ts));
```

The −32768 offsets in `platformToday()` and `dateToMoleculeInt()` cancel, so you get an exact
integer day count — no time-of-day, no DST drift. (This is how `days_enrolled` and `chronicity`
are computed in `ml_features.js`.)

### NEVER write these (Session 126 found 7 instances of #1 across the codebase):

1. `Math.floor((new Date(...) - epoch) / 86400000)` where `epoch` is a local Date.
   - **Why it's wrong:** subtracting two local-time Dates across a DST boundary gives a fractional days value (e.g. `24255.958`). `Math.floor` truncates to one day short. Affected ~8 months of the year in Central time. A flight dated 2026-05-01 stored as 2026-04-30.
   - **Right way:** local-y/m/d → `Date.UTC()` → `Math.round` (or just call `dateToMoleculeInt`).
   - **Same bug, sneakier form:** `Math.floor((Date.now() - billEpochToDate(ts).getTime()) / 86400000)`.
     Decoding is right, but using elapsed milliseconds as a day count re-introduces time-of-day
     and DST drift (same-day runs can disagree). Use the calendar-day subtraction above.
     **The anti-pattern lint MISSES this form** — its regex stops at the first `)`, so the nested
     parens hide the `86400000`. `lint = 0` does not prove this is absent. The lint is also
     case-sensitive (it missed lowercase endpoint URLs and camelCase identifiers in past
     sessions). Treat lint as necessary, not sufficient — grep the real token yourself.

2. `new Date('YYYY-MM-DD')` — parses as **UTC midnight**, which is the previous day in negative-UTC zones.
   - **Right way:** if you must construct from a string, split it and use `new Date(year, month-1, day)`.

3. `.toISOString().split('T')[0]` — returns the **UTC** calendar date, not local.
   - **Why it's wrong:** at 8 PM Central, UTC is already the next day. Used as a default-date setter, it shows tomorrow's date as today.
   - **Right way:** `.toLocaleDateString('en-CA')` — Canadian English uses ISO format, returns local YYYY-MM-DD.

---

## Fetches

**NEVER write `fetch(...)` followed by `.json()` without checking `.ok` first.**

### Bad
```js
const data = await fetch(url).then(r => r.json());
// or
const r = await fetch(url);
const data = await r.json();   // assumes 200; gets garbage on 4xx/5xx
```

### Good
```js
const r = await fetch(url);
if (!r.ok) throw new Error(`${url} → ${r.status}`);
const data = await r.json();
```

A silent fetch failure becomes a silent "Saved successfully!" alert. Session 126 found 3 admin
edit pages with this pattern in destructive save loops. Bonuses, promotions, and molecule values
could all half-save without the user noticing.

The platform rule `feedback_no_silent_failures.md` is about server-side catches; this is the
client-side equivalent. Same principle: every failure path must surface to the user or the log.

---

## Save flows for child collections

**Never destructively `DELETE` all existing rows then re-`INSERT` from scratch IF the row IDs
are referenced from somewhere else.**

### Pattern that broke (Session 126)
`admin_bonus_edit.html`'s `saveBonus()` originally did:
1. `GET /v1/bonuses/:id/results` → existing rows
2. `for each: DELETE /v1/bonuses/:id/results/:result_id`
3. `for each new: POST /v1/bonuses/:id/results`

Every save assigned every result a **new** `bonus_result_id`. But past N-type activities stored
the firing `bonus_result_id` in the `BONUS_RESULT` molecule on the parent activity for audit
display. After a re-save, those audit references pointed at IDs that no longer existed. The
CSR green block silently lost the external rows for historical flights.

### Right pattern: diff-based save

```
1. GET existing rows
2. For each existing row whose ID is NOT in the new list → DELETE it
3. For each new-list row that has an existing ID → PUT (UPDATE in place)
4. For each new-list row WITHOUT an existing ID → POST (INSERT)
```

This preserves IDs for unchanged rows. Audit references stay valid.

See `admin_bonus_edit.html`'s `saveBonus()` post-Session-126 for the canonical implementation.

### The exception
If a child collection's IDs are **never** referenced from anywhere else (joined tables,
molecule storage, audit log), delete-then-reinsert is harmless. Add a comment explaining why.
Example: bonus_criteria — the promotion/bonus engines re-read criteria fresh from cache each
time, no one stores criteria_id elsewhere.

---

## Platform-shared (root-level) files

**Files at the project root are platform-shared. They are loaded by every tenant.**

These files must NOT reference:

- **Specific tenant verticals** (`verticals/workforce_monitoring/...`). Vertical pages can
  reference root files; the reverse breaks the layering. If you need vertical-specific routing
  from a platform page, drive it from data (e.g. `enroll_context.return_to` URL) — not hardcoded.
- **Specific tenant-only molecule names** (`LICENSING_BOARD`, `PPII`, `PPSI`, etc.). Handle
  these via the molecule system + input templates (per-tenant); the platform code is generic.
- **Specific tenant labels as defaults** ("Clinician", "Physician"). Use generic defaults
  ("Staff", "Member"); let the tenant's sysparm config override.
- **Specific tenant page names** (`physician_detail.html`, `clinic.html`). Use `PageContext` or
  generic mechanisms; don't `if (page.includes('physician_detail'))`.

If you find yourself wanting to hardcode tenant logic in a root-level file, the right move is:
- Move the logic into the vertical, OR
- Make the root file molecule/template/sysparm-driven so each tenant configures it.

---

## Molecules — read `docs/MOLECULES.md` first

**Before you create, edit, or reason about any molecule, read [docs/MOLECULES.md](MOLECULES.md).**
It's the operative guide — the storage mechanism, the per-type recipes, the verified exemplars,
and the mandatory round-trip verification. Molecules fail **silently** (a wrong one reads back
empty, never throws), so a plausible-looking molecule can be broken and you won't know until you
prove a round-trip. The two traps that cost whole sessions:

- **A member (`attaches_to='M'`) molecule MUST have a `molecule_value_lookup` row.**
  `getMoleculeStorageInfo` reads `context`/`attaches_to` from that row and **silently defaults to
  `activity`/`'A'`** when it's missing — so the field stores as an activity row and every member
  read (which filters `attaches_to='M'`) comes back empty, no error. Activity molecules survive
  without the row only because `'A'` is the default. Copy a real **member** molecule's lookup row
  (`REFERRAL_SOURCE` mol 142, or `LICENSING_BOARD`) — **not** `STATE` (mol 127 is vestigial) and
  **not** `ACCRUAL_TYPE` (activity — its missing lookup row is the bug, not the template).

- **Internal-list values store a per-molecule `value_id` (1–127), squished into one byte.**
  `molecule_value_text.value_id` **defaults to a global sequence** (now past 127), so a raw
  `INSERT` that omits `value_id` silently overflows the byte — the value saves, the read returns
  nothing. Allocate per-molecule via `allocateListValueId()` / set `value_id` explicitly 1..N in a
  migration; a `CHECK (value_id BETWEEN 1 AND 127)` now guards it. (Session 126.)

**Verification is mandatory:** a molecule isn't done until you've assigned a value, read it back,
and confirmed the stored byte decodes to your value with the right `attaches_to`. See MOLECULES.md §7.

---

## When in doubt

- Read `docs/LOYALTY_PLATFORM_ESSENTIALS.md` and `docs/LOYALTY_PLATFORM_MASTER.md` first.
- If a pattern feels familiar — **search before you write it**. Chances are it already exists.
- If you're about to copy-paste code from a similar admin page, **read it critically first**.
  Patterns propagate by copy. The bonus edit destructive save spread to promotion edit and
  molecule edit the same way.

The structural reason these bugs accumulated: session amnesia. Each Claude session is fresh.
Without this file, the next session re-invents helpers, re-introduces patterns, re-copies bugs.
This file is the structural fix for that. Update it when you find a new pattern worth preserving.
