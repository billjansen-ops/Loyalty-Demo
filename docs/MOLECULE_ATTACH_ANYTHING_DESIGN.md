# Molecules Attach to Anything — the entity-type registry design

**Status: DESIGNED, not built.** Decisions made by Bill in Session 136
(2026-07-09, in-chat). Build in a fresh session on Bill's explicit go.
**Step 0 (the defusal) is urgent and separable — see the fuse math below.**

---

## 1. The problem (two halves)

### 1a. The A/M/L enum doesn't generalize

Every molecule row carries `attaches_to CHAR(1)` — "what kind of thing is my
`p_link`?" Today it's a hardcoded three-letter enum scattered through the code
(`'A'` activity, `'M'` member, `'L'` member_alias):

```js
attachesTo = context === 'activity' ? 'A' : (context === 'alias' ? 'L' : 'M');
```

The platform already outgrew two letters once — 'L' was added when partner
aliases needed molecules (exactly one live row exists: a CARRIER molecule on a
Delta alias). Session 128 added 4-byte user-parent molecules (`4_data_*`), and
more parents are coming (clinics, codes, partner programs…). Every new
attachable thing today means hand-editing another letter into every helper.
That does not scale, and it isn't data-driven — which is the platform's whole
philosophy.

### 1b. The collision time bomb — with a measured fuse

Member and activity mint links from **separate counters in the same 5-byte
value space**. Measured 2026-07-09 (local):

- member links occupy values ~0–304 (counter at 305)
- activity links occupy values ~337–1832

**When the member counter reaches 337 — about 32 more member enrollments —
new member links start landing on values that existing activity links already
hold.** Same 5 bytes, two different owners. (member_alias's counter is at 3 in
the same space; same eventual fate.)

That's *by design* — `attaches_to` exists precisely to disambiguate. But the
generic value-read helpers don't use it:

- `getMoleculeRows` → `WHERE p_link = $1 AND molecule_id = $2` — no side filter
- `bulkGetMoleculeValues` → same (Session 136)
- `findMoleculeRow` → same

They work today **only because the ranges haven't crossed yet.** The
detonation scenario: SEAT_TYPE is an 'AM' molecule on Delta (member side =
preferred seat, activity side = the flight's seat). Member #337 sets a
preferred seat; activity #337 is someone's old flight. `getMoleculeRows`
returns **both rows**; whichever comes back first wins. No error, no log —
wrong data that depends on which member happened to get which link value.
Random, unreproducible, data-dependent. A time bomb.

(The flag door — `setFlag`/`isFlagSet`/`flagCondSQL` — and `insertMoleculeRow`
already carry the side correctly. It's specifically the generic value READS
that are exposed.)

---

## 2. Decisions (Bill, Session 136)

1. **`attaches_to` becomes a 1-byte entity-type id** minted from and resolved
   through **link_tank** — the registry of "things a molecule can attach to."
   A molecule can then hang off *anything* with a row-identifying key.

2. **link_tank de-tenants.** Link spaces are global — `member.link` is
   `PRIMARY KEY (link)` with no tenant, so two members can never share a link
   across tenants. Per-tenant counters for the same table would eventually
   collide; the current single-row-per-table reality (parked under mixed
   tenant_ids 0/1) already reflects the global truth. PK changes
   `(tenant_id, table_key)` → `(table_key)`.

3. **membership_number is NOT an exception** (Bill overruled it, correctly):
   nothing enforces its uniqueness today (no unique constraint at all), and
   nothing connects data by it — the link is the connective tissue; the number
   is a per-tenant display/lookup attribute. Its three per-tenant counter rows
   (tenants 1/3/5) merge to one global counter seeded at the max of the three.
   If a tenant ever wants its own number format, that's a display concern.

4. **Self-registering helper — never think about it again.**
   `resolveEntityTypeId(tableKey)`: cached lookup of the table's entity id;
   on first-ever use, mints the next id via `getNextLink('link_tank')` — the
   registry minting from **its own row** (precedent: `audit_entity_type`
   already does exactly this pattern) — inserts the registry entry, returns
   the id. **Guard:** verify the table exists in the schema before minting
   (a typo must fail loud in plain English, not register a phantom entity).

5. **Tables that don't use the link system still work** — they just get an
   "artificial" link_tank row for the registry entry (no counter use). By
   design the entity-id column is populated lazily: a table gets an id the
   first time a molecule is hung on it. No census of the ~100 tables; being a
   link counter ≠ being attachable, and vice versa.

6. **Terminology/mechanics unchanged elsewhere:** parent_bytes still routes
   which `{n}_data_*` table (that's the KEY SIZE of the parent); the entity id
   says which TABLE the parent is. Two independent axes. Storage patterns,
   encode/decode, the column contract — all untouched.

---

## 3. The zero-rewrite migration trick (recommended path)

`attaches_to` stays `CHAR(1)`; the byte is reinterpreted as a **squished
entity id** (`squish(id,1)` = `chr(id%127+1)`, the platform's standard 1-byte
encoding). The trick: **assign the legacy entities the ids their letters
already encode**:

| entity | existing byte | as squished id |
|---|---|---|
| activity | 'A' (65) | **64** |
| alias (member_alias) | 'L' (76) | **75** |
| member | 'M' (77) | **76** |

With activity=64, alias=75, member=76 in the registry, **every existing
molecule row is already correct — zero rewrite of the storage tables.** The
migration touches link_tank and code only. New entity types get the next free
id from the link_tank self-counter (seed it past 76, or skip {64,75,76} on
allocation). Capacity: 127 entity types in one byte — plenty; if ever
exceeded, that's a widen-the-column migration for another decade.

Alternative (rejected as unnecessary): renumber cleanly 1/2/3 and rewrite
every `attaches_to` byte in every `N_data_*` table — millions of rows touched
for aesthetic ids.

`storage_size=0` flag tables have `attaches_to` in their PRIMARY KEY — the
zero-rewrite path leaves those intact too.

---

## 4. Build plan (fresh session, Bill's go)

### Step 0 — DEFUSE THE BOMB (urgent, separable, small)
Make the generic value reads filter the side, exactly as `insertMoleculeRow`
stamps it: `getMoleculeRows`, `bulkGetMoleculeValues`, `findMoleculeRow` (+
any other `WHERE p_link = … AND molecule_id = …` read without a side filter)
gain `AND attaches_to = $n`, side resolved from the definition/context the
same way the write path does. 'AM' molecules take the caller's context (the
flag door's `resolveFlagInfo` is the pattern — it already rejects a side the
molecule doesn't have). **This closes the wrong-data window with today's
letters, no schema change, and must land before member #337.** Prove with a
test that plants a deliberate cross-side collision (same p_link value, rows
on both sides) and shows each read returns only its side.

### Step 1 — registry plumbing
- db_migrate vNNN: de-tenant link_tank (PK → table_key; collapse the
  member_number rows to one, counter = max; collapse tenant 0/1 duplicates);
  add `entity_id SMALLINT UNIQUE` (nullable — lazily populated); seed
  activity=64, alias=75, member=76; add link_tank's own self-counter row.
- `resolveEntityTypeId(tableKey)` helper + cache + schema-existence guard.
- `getNextLink` callers audit: nothing else assumes (tenant_id, table_key).

### Step 2 — the doors speak entity ids
- `resolveFlagInfo` / `insertMoleculeRow` / reads / `flagCondSQL` /
  `moleculeJoinSQL` / `moleculeCondSQL` / timeline queries: `attaches_to`
  comparisons go through squish(entity_id) instead of letter literals; the
  A/M/L ternaries collapse into `resolveEntityTypeId`.
- `molecule_def.attaches_to` ('A'/'M'/'AM' definition-side) needs its own
  mapping decision: definition says which entity types a molecule MAY attach
  to — likely becomes a small list keyed by entity id. Design detail for the
  build session.

### Step 3 — prove it
- Round-trip a molecule on a NEW entity type (e.g. partner_program) end to
  end through the helpers — the first molecule ever attached to something
  that isn't member/activity/alias/user.
- The collision test from Step 0 re-run under entity ids.
- Full suite; CI from-scratch replay guards the migration.

### Open question for the build session
`audit_entity_type` (link_tank 1-byte counter, at 8) is a PARALLEL entity-type
registry the audit system already built for itself. One registry should
probably serve both — decide merge-or-coexist when building, not before.

---

## 5. Why this is a MUST, not a nice-to-have

Bill, 2026-07-09: *"we have to do this. otherwise it's a time bomb. at some
point wrong data will start to randomly show up."* The fuse is ~32 members
long on the demo. Step 0 defuses; the registry makes the platform's
"everything is pointers" story complete — the pointer that says what kind of
thing a pointer points at is itself a pointer, minted by link_tank from its
own row.
