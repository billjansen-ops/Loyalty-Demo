# BEFORE YOU WRITE — Stop and Read

Before writing new code that touches **dates**, **fetches**, **collection-save flows**, or
**platform-shared files**, check this file. These are bugs the platform has been bitten by
repeatedly across multiple sessions. Don't repeat them.

Run `node tests/lint-anti-patterns.cjs` to see what's currently in the codebase that matches
these patterns — it's a grep-style report that surfaces violations.

---

## Dates

**The canonical date functions live in `pointers.js`. Do not write your own.**

| Function | Use for |
|---|---|
| `dateToMoleculeInt(date)` | JS Date or `"YYYY-MM-DD"` string → Bill-epoch SMALLINT. Uses `Date.UTC()` arithmetic; DST-safe. |
| `moleculeIntToDate(num)` | Bill-epoch SMALLINT → local-midnight JS Date (calendar day correct in any TZ). |
| `platformToday()` | Today's date as Bill-epoch SMALLINT. |
| `platformTodayStr()` | Today's date as `"YYYY-MM-DD"` string (local). |
| `dateToBillEpochDateTime(date)` | JS Date → Bill epoch datetime (10-second blocks). |

Postgres-side: use the SQL functions `date_to_molecule_int(date)` and `molecule_int_to_date(integer)`.
They were already correct (Postgres date arithmetic doesn't involve DST).

### NEVER write these (Session 126 found 7 instances of #1 across the codebase):

1. `Math.floor((new Date(...) - epoch) / 86400000)` where `epoch` is a local Date.
   - **Why it's wrong:** subtracting two local-time Dates across a DST boundary gives a fractional days value (e.g. `24255.958`). `Math.floor` truncates to one day short. Affected ~8 months of the year in Central time. A flight dated 2026-05-01 stored as 2026-04-30.
   - **Right way:** local-y/m/d → `Date.UTC()` → `Math.round` (or just call `dateToMoleculeInt`).

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

## When in doubt

- Read `docs/LOYALTY_PLATFORM_ESSENTIALS.md` and `docs/LOYALTY_PLATFORM_MASTER.md` first.
- If a pattern feels familiar — **search before you write it**. Chances are it already exists.
- If you're about to copy-paste code from a similar admin page, **read it critically first**.
  Patterns propagate by copy. The bonus edit destructive save spread to promotion edit and
  molecule edit the same way.

The structural reason these bugs accumulated: session amnesia. Each Claude session is fresh.
Without this file, the next session re-invents helpers, re-introduces patterns, re-copies bugs.
This file is the structural fix for that. Update it when you find a new pattern worth preserving.
