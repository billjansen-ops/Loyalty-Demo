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

**Parents.** The engine is really "hang a typed value on a **link**" — member and activity (both
5-byte `CHAR(5)` links → `5_data_*`) were just the first two parent kinds. Since Sessions 128–129
a molecule declares its parent's key size (`molecule_def.parent_bytes`, default 5) and storage
routes to `{parent_bytes}_data_*` — **users** (4-byte integer link → `4_data_*`) are live, carrying
the position/clinic assignments. See [§11](#11-parents-beyond-member--activity--built-sessions-128129)
and `docs/MOLECULE_PARENT_GENERALIZATION.md`.

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

**Since Session 131 there is ONE creation routine: `createMoleculeComplete(spec, tenantId)` in
`pointers.js` (endpoint: `POST /v1/molecules/complete`).** It creates the definition, one
`molecule_value_lookup` row per column, list values with explicit per-molecule `value_id`s, and
the `{parent_bytes}_data_{pattern}` storage table if missing — all in **one transaction** — after
validating every §5 invariant with a plain-English rejection. Then it **proves the round-trip**
(§7, automated: encode → store → read bytes back → decode → compare) and **removes the whole
molecule if the proof fails**. A half-built or silently-broken molecule cannot come out of it.

- **The admin create page calls it** (one call — the old five-call sequence is gone).
- **Migrations call it directly** (`ctx`-free; it uses the server's own client). The contract:
  a change to the routine must keep every old migration replaying green — CI replays all
  migrations from scratch on every run, so a breaking change fails CI before it ships.
  Deliberately NOT frozen/versioned per migration (Session 131 decision with Bill; revisit only
  if the platform ships to environments we don't control).
- The per-type recipes below remain the reference for what a correct spec **contains** — and for
  reading/fixing molecules that predate the routine.

Everything resolves molecules by **key** (ids differ per environment). After any create,
**restart the server** so the caches reload (the routine reloads them itself), then verify (§7).

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

Flag (**first-class since Session 135**): `storage_size='0'`; a row in
`{parent_bytes}_data_0` present = true, absent = false — the mark itself is the value.
`createMoleculeComplete` accepts the pattern directly: spec is just
`{ molecule_key, label, attaches_to, storage_size: '0' }` (+ `parent_bytes` for other
parents) — no columns, no values, no composites (validation rejects them in plain
English; a 5-byte flag must name a side A/M/AM). The routine creates the presence
table if missing (PK `p_link+molecule_id+attaches_to` — idempotent set relies on it)
and proves the round-trip with presence semantics (set → confirm → clear → confirm
absent). Access is ONLY through the flag helpers (§10) — the generic row helpers
refuse zero-column molecules. The side ('A'/'M') is resolved from the **definition's**
`attaches_to`, not `molecule_value_lookup` (flags have no lookup rows; the storage-info
default would guess 'A' — the §5.2 trap, hit for real by FULL_PPSI_REQUESTED and fixed
in v102). In rules, a flag supports exactly two operators: **"is set" / "is not set"**
(member flags check the member's link, activity flags the activity's link). Member
flags have generic API doors: `GET/POST/DELETE /v1/members/:id/flags/:key`.
Exemplar + test: FOB in `tests/core/test_flag_molecules.cjs`.

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
| Flag (presence) | IS_CLINICIAN (member), IS_DELETED (AM, system) | §6.5, `tests/core/test_flag_molecules.cjs` (FOB) |

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
- `bulkGetMoleculeValues(key, pLinks, tenantId)` — getMoleculeRows for a whole LIST of links in
  one query; returns a Map of pLink → decoded rows. Use this instead of looping getMoleculeRows
  (the N+1 pattern this helper killed in findUsersByMoleculeValue and the wellness roster).
- `getActivityMoleculeValueById(activityId, moleculeId, link)` / `getAllActivityMolecules(activityId, tenantId, link)` — activity values.

**Bulk-query SQL fragments (Session 136 — flagCondSQL's counterparts for value molecules).
When a set-based query needs a molecule join or filter, build the fragment through these —
never hand-write the `5_data_*` join:**
- `moleculeJoinSQL(tenantId, key, refExpr, {left, valueExpr})` — an "attach this molecule's
  value" JOIN clause. Returns `{sql, alias, col, cols}`; put `.sql` in the FROM chain and use
  `.col` (the first value column, e.g. `md42.n1`) in the SELECT list. `valueExpr` (e.g. `'$2'`)
  adds a value-match on column 1 — the encoded value itself always rides a $ parameter, never
  the SQL string.
- `moleculeCondSQL(tenantId, key, refExpr, {negate, valueExpr})` — the EXISTS / NOT EXISTS
  presence-or-value condition (e.g. wellness Stream A excluding activities that carry
  PULSE_RESPONDENT_LINK).
- Both are synchronous and cache-only (table + molecule id resolved like flagCondSQL); they
  throw on a flag molecule — flags use `flagCondSQL`. Adopters: the member timeline, wellness
  streams, scoring_history, ml_features, custauth POST_ACCRUAL, extendedCardDetector.

**Flags (presence molecules, storage '0') — the row helpers refuse these; use only:**
- `isFlagSet(pLink, key, tenantId)` — is the mark on this link?
- `setFlag(pLink, key, tenantId)` / `clearFlag(pLink, key, tenantId)` — idempotent set/clear.
- `getFlaggedLinks(key, tenantId)` — every link carrying the flag.
- `flagCondSQL(tenantId, key, refExpr, {negate})` — a presence condition to embed in a
  set-based query (e.g. the timeline's soft-delete exclusion). An optional 4th arg on the
  first four ('A'/'M') picks the side of an 'AM' flag like IS_DELETED; single-sided flags
  resolve their own side from the definition.

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

## 11. Parents beyond member & activity — BUILT (Sessions 128–129)

**Status: built and live.** Design record: `docs/MOLECULE_PARENT_GENERALIZATION.md`. What shipped:
- **v88** — user `link` widened 2→4 bytes (`platform_user.link` + `audit_log_1..5.user_link`).
- **v89** — the engine routes storage by `molecule_def.parent_bytes` (1–5, default 5) via
  `getDetailTableName(parentBytes, storageSize)`; all pre-existing molecules stayed on `5_data_*`
  byte-for-byte.
- **v90** — shared internal lists: `molecule_value_lookup.list_source_molecule_id` lets a list
  column borrow another molecule's value list (one list, no drift; borrower writes rejected).
- **v92** — the first live user-parent molecules: POSITION (`4_data_1`) and POSITIONCLINIC
  (`4_data_12`, col 1 borrows POSITION's list), managed via the generic
  `GET/POST/DELETE /v1/users/:id/molecule-rows/:key` endpoints; round-trip proven at byte level
  (Session 129); the review queue's position routing rides on them.

The limit "a molecule attaches to a member or an activity" was convention, not a deep constraint —
the engine attaches to a **link**. The generalization lets a molecule hang on **any parent entity**,
starting with the **user** (roles/capabilities on staff logins).

**The mechanism.** Storage tables are `{parent_key_bytes}_data_{column_widths}` — the **leading
number is the parent's key size**, declared per molecule in `molecule_def.parent_bytes` and routed
by `getDetailTableName`. Member/activity = 5-byte `CHAR(5)` → `5_data_*`; a **user's link is
4 bytes** → user molecules live in **`4_data_*`** — same row shape, but **`p_link` is `integer`**,
not `character(5)`. Live example: POSITIONCLINIC = internal-list position (1 byte, borrowed list) +
key clinic (2 bytes) → **`4_data_12`**.

**No A/M for new parents.** `attaches_to` (M/A) exists *only* because member and activity collide
in the shared 5-byte tables and the rules engine must separate them. New parents get their **own
table** (the key-size prefix separates them), so leave A/M off. The `attaches_to` **column** stays
on `4_data_*` (inert, default `'A'`) for helper compatibility; nothing filters user molecules by it
— they're found by `p_link + molecule_id` in their own table. **Existing member/activity molecules
and the rules engine are untouched** — zero migration.

**The three code moves — all done:** (1) the user's `link` widened smallint → integer (v88);
(2) the machine routes by the parent's declared key size, `molecule_def.parent_bytes` (v89);
(3) table creation emits `{keysize}_data_*` (now inside `createMoleculeComplete` /
`ensureStorageTable`). The mandatory round-trip is automated in the creation routine itself —
the Tier-1 hardening landed in Session 131 (§6).

**Stays explicit, never a molecule:** tenant and the access tier (superuser/admin/csr) — they're
resolved *before* the molecule layer can run (a "tenant molecule" is circular) and they're the
security core. Only *domain* data goes in molecules.

---

*Traced and verified Session 126; §11 (parent generalization) added Session 127, marked BUILT
Session 131; §6 creation routine (`createMoleculeComplete`) added Session 131; flags made
first-class (§6.5 recipe, flag helpers in §10) Session 135. Update this file (not memory)
when the mechanism changes.*
