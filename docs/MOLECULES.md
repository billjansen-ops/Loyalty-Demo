# MOLECULES — the operative guide

**Read this before creating, editing, or reasoning about any molecule.** It exists because
molecules are the core of the platform *and* the thing sessions get wrong most often — they
fail **silently** (a wrong molecule reads back empty, never throws), so a plausible-looking
molecule can be broken and you won't know until you prove a round-trip.

This guide is **operative**, not descriptive: it tells you what actually gets stored, how it's
encoded and read back, the exact recipe to build each type, which live molecules are verified
working exemplars, and the one verification step that makes "done" mean "proven." Every claim
here was traced against the running code and live data, not from memory.

Two rules to hold onto before anything else:
- **A molecule is not done until you have assigned a value, read it back, and confirmed the stored
  byte decodes to your value.** See [§7 Verification](#7-verification--mandatory).
- **Never read or write molecule storage tables (`5_data_*`, `molecule_value_text`, `molecule_text`)
  with raw SQL in application code — always the helper functions.** The helpers handle encoding,
  table routing, and value-type behavior; raw SQL bypasses all of it and corrupts data. See
  [§10 Helpers](#10-helpers--use-these-never-raw-sql). (Raw `SELECT` is fine for one-off
  verification/debugging — that's what §7 does — never for the code path.)

---

## 1. What a molecule is (one paragraph)

A molecule attaches one typed value to an **activity** or a **member**, without adding a column.
The value is stored right-sized and **encoded** in a shared table `{link_bytes}_data_{storage_size}`
(today `5_data_1`, `5_data_2`, `5_data_5`, `5_data_54`, …). Nothing is stored as human text in
that cell — what's stored is an **encoded pointer or code** (a squished number, an offset id, a
text_id), which is **decoded back** to the display value on read. The definition lives in
`molecule_def`; how to interpret/route it lives in `molecule_value_lookup`; predefined values (for
lists) live in `molecule_value_text`.

---

## 2. The lifecycle — the thing to understand first

Two layers. The high layer maps display value ↔ stored id; the low layer maps stored id ↔ bytes.

```
WRITE:  displayValue --encodeMolecule--> storedId --encodeValue/squish--> bytes in 5_data_N
READ:   bytes in 5_data_N --decodeValue/unsquish--> storedId --decodeMolecule--> displayValue
```

- `encodeMolecule(tenantId, KEY, value)` → the stored id (branch depends on `value_kind`, §3).
- `insertMoleculeRow` → `encodeValue(id, size, valueType)` → the actual bytes (§4).
- `getMoleculeRows` → `decodeValue(bytes, size, valueType)` → the id.
- `decodeMolecule(tenantId, KEY, id)` → the display value.

**Worked example — FARE_CLASS 'F' (First Class), a live internal list (mol 4):**
`encodeMolecule` finds the `molecule_value_text` row `text_value='F'` → returns its **value_id = 9**.
`encodeValue(9, size 1, 'code')` → `squish(9,1)` → byte **10** stored in `5_data_1.c1`.
Read: byte 10 → `unsquish` → **9** → `decodeMolecule` looks up `(molecule_id=4, value_id=9)` → **'F'**.
(You can see this yourself: `SELECT c1, ascii(c1) FROM "5_data_1" WHERE molecule_id=4`.)

The **value_id is the linchpin** for lists: it is both the stored code *and* the read-back key.
That is why it must be small (fits one byte) and per-molecule (§5.3).

---

## 3. The types — pick one, and know its exemplar

Detection is by `value_kind` (from the code): `isLookupMolecule` = {`lookup`,`external_list`};
`isListMolecule` = {`list`,`internal_list`}; `isScalarMolecule` = {`scalar`,`value`}.

| Type | value_kind | value_type | scalar_type | storage | Stored value is… | Verified exemplar |
|---|---|---|---|---|---|---|
| **Internal list** | internal_list | code | null | 1 | per-molecule `value_id` (1–127), squished | FARE_CLASS (mol 4, A), ACCRUAL_TYPE (mol 106, A), REFERRAL_SOURCE (mol 142, **M**) |
| **External list — offset** | external_list | key | null | 2/4 | external table SERIAL id, offset-encoded | ORIGIN/airports; LICENSING_BOARD (member, → `licensing_board`) |
| **External list — pass-through** | external_list | numeric | numeric | 2/4 | link_tank id, raw (no offset) | MEMBER_SURVEY_LINK |
| **Scalar numeric** | value | numeric | numeric | 2/4 | the signed number itself | MQD, flight_number (code) |
| **Date** | value | date | numeric | 2 | Bill-epoch day (see BEFORE_YOU_WRITE) | member date molecules |
| **Indexed text** | value | key | text | 4 | `text_id` into `molecule_text_pool` (dedup) | — |
| **Unindexed text** | value | key | text_direct | 4 | `text_id` into `molecule_text` | PASSPORT (member, Delta) |
| **Composite** | external_list | (per column) | — | 22/54/222… | one encoded value per column | member_points (54), badge (222) |
| **Reference (R)** | reference | — | — | none | *nothing* — queries live data via a function | member_tier_on_date |
| **Flag** | — | — | — | 0 | *nothing* — row present = true | is_deleted |

**Do NOT copy STATE (mol 127, tenant 5) as an exemplar.** State for members lives on the member
table as a 2-byte field; that molecule is vestigial. Copying it is how a past session went wrong.

---

## 4. Encoding rules (`encodeValue`/`decodeValue`) — the moving pieces

The stored bytes depend on **cell size** and **value_type**:

- **CHAR cells (size 1, 3, 5): base-127 squish.** Each byte holds `(n % 127) + 1` (bytes are
  1–127, never 0). A **1-byte cell holds 127 distinct values** (ids 1–127 map to distinct bytes).
  Exception: `valueType='link'` is stored raw (it's already a squished FK).
- **Numeric cells (size 2, 4): offset for `key`/`code`, raw for `numeric`/`date`.**
  - `key`/`code` (always-positive ids): store `value − offset` (offset **32768** for 2-byte,
    **2147483648** for 4-byte); read `stored + offset`. **Why:** a SMALLINT holds 65,536 values;
    storing a positive-only id straight wastes the negative half (max 32,767 entries). The offset
    shifts the id across the full signed range, so you get the **full 65,536** (or 4.3B for INTEGER).
  - `numeric`/`date` (already-signed or already-full-range from link_tank): store **raw**, no offset.
    Applying an offset here overflows or destroys the sign — the Session 76 bug.

**Choosing `key` vs `numeric` for a 2/4-byte reference:** look at the referenced table's PK. SERIAL
(1,2,3…) → `key` (offset). link_tank value (starts at −2147483648/−32768) → `numeric` (pass-through).

---

## 5. Invariants that MUST hold (or it silently breaks)

Each of these has bitten the platform. None throws an error when violated — the field just reads
empty or corrupts.

### 5.1 `value_kind` and `scalar_type` must be set
`encodeMolecule` branches on `value_kind`; without it (and `scalar_type` for scalar types), it
silently fails to encode. The admin UI derives them; a migration must set them explicitly.

### 5.2 A member (`attaches_to='M'`) molecule MUST have a `molecule_value_lookup` row
`getMoleculeStorageInfo` reads `context`/`attaches_to` **from `molecule_value_lookup`**, and when
the row is missing it **defaults to `activity`/`'A'`** — no error. So a member molecule with no
lookup row stores its rows as `attaches_to='A'`, and every member read (which filters
`attaches_to='M'`) comes back empty. Activity molecules survive without the row only because `'A'`
is the default. **Copy a real member molecule's lookup row** (LICENSING_BOARD, REFERRAL_SOURCE) —
`column_order=1`, `context='member'`, `attaches_to='M'`, matching `storage_size`/`value_type`/
`value_kind`.

### 5.3 Internal-list `value_id`s are per-molecule 1–127 — allocate them, never take the default
The stored code for an internal list **is the `value_id`**, squished into one byte (§2). It must be
**1–127** and numbered **per molecule** (`decodeMolecule` looks up by `(molecule_id, value_id)`).
But `molecule_value_text.value_id` **defaults to a GLOBAL sequence** (already past 127). A **raw
`INSERT` that omits `value_id` takes that global default and silently overflows the byte** — the
value saves, the read returns nothing. This is exactly what broke REFERRAL_SOURCE (Session 126).

- **Allocate via the one helper:** `allocateListValueId(moleculeId)` — first-free 1–127, reuses
  deleted slots, returns null at 127 (full). The add-value endpoint `POST /v1/molecules/:id/values`
  routes through it; the clone path preserves `value_id`.
- **In a migration**, set `value_id` explicitly (1..N, per molecule) — never let the default assign it.
- A `CHECK (value_id BETWEEN 1 AND 127)` on `molecule_value_text` now makes a bad insert fail loudly.
- Full = 127 values per list; to add another you must free one.

### 5.4 The storage table must exist before first use
`5_data_{size}` must exist. New patterns: `POST /v1/storage-tables {pattern:'22'}` (409 if present).

### 5.5 A member field only appears on the profile if it's in the M **input template**
The M **composite** authorizes a member field (PUT validates against it); the M **input template**
is the profile-form layout. `GET /v1/member/:id/molecules` returns **only input-template fields**.
So a field in the composite but not the template saves but never displays. Add it to both
(LICENSING_BOARD/v75, REFERRAL_SOURCE/v86 are the pattern).

---

## 6. Creating each type — the recipe

All DB writes go through `db_migrate.js`, resolve molecules by **key** (ids differ per environment),
and are idempotent. After any create, **restart the server** so the caches reload, then verify (§7).

### 6.1 Internal list (member example — REFERRAL_SOURCE, Session 126, the canonical member list)
1. `molecule_def`: `value_kind='internal_list'`, `value_type='code'`, `scalar_type=null`,
   `storage_size=1`, `context='member'`, `attaches_to='M'`, `molecule_type='D'`. (Omit
   `input_type`/`value_structure`/flags — the defaults `P`/`single`/… are already right.)
2. `molecule_value_lookup`: one row, `column_order=1`, `context='member'`, `attaches_to='M'`,
   `storage_size=1`, `value_type='code'`, `value_kind='internal_list'`. **(§5.2 — mandatory.)**
3. `molecule_value_text`: one row per value, **with explicit `value_id` 1..N** (§5.3). text_value =
   the stored code, display_label = the shown label.
4. If member: add to the tenant's **M composite** (`composite_detail`), and add a field to the
   **M input template** (§5.5).
For an activity internal list, drop steps for M/composite/template; `attaches_to='A'`,
`context='activity'` — and the lookup row is still recommended (harmless, explicit).

### 6.2 External list (LICENSING_BOARD — member, offset)
`molecule_def` (`value_kind='external_list'`, `value_type='key'`, `storage_size=2`) + a
`molecule_value_lookup` row naming `table_name`/`id_column`/`code_column`/`label_column` +
the lookup table itself. Encoder takes the **code_column** value; decoder returns it.

### 6.3 Text (PASSPORT — unindexed, member)
`scalar_type='text_direct'`, `storage_size=4`; text lands in `molecule_text`, the 4-byte cell holds
the `text_id`. **Trace PASSPORT before building a text molecule.** (`text_direct` skips the
double-encode in `createAccrualActivity` — raw text passes through.)

### 6.4 Composite (two-table rule)
Multi-digit `storage_size` (e.g. `22`, `54`, `222`); create the storage table first; one
`molecule_value_lookup` row **per column** (`column_order` 1..N); assign an array in column order.

### 6.5 Reference (R) and Flag (0)
Reference: `molecule_type='R'`, `value_kind='reference'`, a `ref_function_name`; stores nothing.
Flag: `storage_size=0`; row present = true, absent = false.

---

## 7. Verification — MANDATORY

A molecule is **not done** until this passes. Silent failure reads as empty, not as an error, so
looking at the endpoint alone is not proof.

1. Assign a value through the real path (`PUT /v1/member/:id/molecules` or an accrual).
2. Read it back through the API and confirm you get your value.
3. Look at the **stored bytes** and confirm they decode to your value and carry the right
   `attaches_to`:
   ```sql
   SELECT c1, ascii(c1)-1 AS decoded, attaches_to FROM "5_data_1"
   WHERE molecule_id = <id>;   -- decoded must be your value_id; attaches_to must be M for a member field
   ```
4. Best of all: add a test that assigns + reads back (see `tests/insight/test_referral_source.cjs`).

If the read is empty: check (a) member lookup row present (§5.2), (b) value_id ≤ 127 and
per-molecule (§5.3), (c) field in the input template if you're reading via the profile endpoint (§5.5).

---

## 8. The traps that have bitten us (so they're rules)

- **Member molecule with no `molecule_value_lookup` row** → stores as `attaches_to='A'`, member
  reads empty, no error. (§5.2)
- **Internal-list value seeded via raw INSERT** → takes the global sequence, `value_id > 127`,
  silently overflows the one-byte cell. Always allocate per-molecule (§5.3). (Session 126.)
- **STATE is not a molecule** for members — it's a member-table column. Don't copy mol 127.
- **`key` vs `numeric` on 2/4-byte** — offset applied to a link_tank value overflows (Session 76).
- **Composite/member field not in the input template** — saves but never shows (§5.5).
- **Editing `pointers.js`** → bump `SERVER_VERSION` + `BUILD_NOTES` + restart. **Adding a
  migration** → bump `TARGET_VERSION` and `EXPECTED_DB_VERSION`.

---

## 9. Verified working exemplars (copy these)

| Need | Copy | Where |
|---|---|---|
| Internal list, activity | FARE_CLASS (mol 4), ACCRUAL_TYPE (mol 106) | seeded correctly, value_ids 1–7 / small |
| Internal list, member | REFERRAL_SOURCE (mol 142) | `db_migrate.js` v85–v87, `tests/insight/test_referral_source.cjs` |
| External list, member | LICENSING_BOARD | `db_migrate.js` v41 |
| Unindexed text, member | PASSPORT | Delta member molecule |
| Composite | member_points (54), badge (222) | §6.4 |

**Not exemplars:** STATE (mol 127) — vestigial; EXTENDED_CARD had the value_id overflow (fixed v87).

---

## 10. Helpers — use these, never raw SQL

**Rule: application code never touches `5_data_*`, `molecule_value_text`, `molecule_text`, or
`molecule_text_pool` with hand-written SQL.** These helpers handle encoding, table routing, and
value-type behavior; raw SQL bypasses them and silently corrupts data. If no helper fits what you
need, **stop and add one** — don't work around it with raw SQL. (The lint enforces this: raw SQL
against molecule storage tables in server JS fails the build.)

**Read:**
- `getMoleculeRows(pLink, key, tenantId)` — all rows for a molecule on a link, decoded.
- `getActivityMoleculeValueById(activityId, moleculeId, link)` / `getAllActivityMolecules(activityId, tenantId, link)` — activity values.
- `bulkGetMoleculeValues(key, pLinks, tenantId, attachesTo)` / `bulkGetCompositeValues(...)` / `bulkCheckFlag(...)` — many links at once (instead of N queries or a raw JOIN).
- `getMoleculeJoinSQL(tenantId, key)` — correct table/id/column routing when you must build a bulk query.

**Write:**
- `insertMoleculeRow(pLink, key, values, tenantId)` — insert with proper encoding + `attaches_to`.
- `insertActivityMolecule(activityId, moleculeId, value, client, link)` — single activity value.
- `PUT /v1/member/:id/molecules` — the member-write path (validates against the M composite).
- `allocateListValueId(moleculeId)` — the **only** way to number a new internal-list value (§5.3).

**Encode / decode / route (usually called for you by the above):**
- `encodeMolecule` / `decodeMolecule` — display value ↔ stored id (branches on `value_kind`).
- `encodeValue` / `decodeValue` — stored id ↔ bytes (squish/offset, §4).
- `getMoleculeStorageInfo(tenantId, key)` — table, size, columns, `context`/`attaches_to`.
- `getNextLink(tenantId, tableKey)` — allocate a new link (never `MAX(link)+1`).

**The one place raw SQL is allowed:** read-only verification/debugging (§7) — inspecting stored
bytes to prove a round-trip. Never in the code path.

---

*Traced and verified Session 126. Update this file (not memory) when the mechanism changes.*
