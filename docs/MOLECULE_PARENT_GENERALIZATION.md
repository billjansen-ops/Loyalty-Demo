# Molecules Beyond Member & Activity — Parent Generalization (Design)

**Status: DESIGNED, NOT YET BUILT. Session 127.** Captured before any code, per the
"discuss first" rule. The operative molecule guide is `docs/MOLECULES.md`; this is the
plan for extending it. Read `docs/MOLECULES.md` first.

---

## The idea (one paragraph)

Today a molecule can attach to exactly two kinds of parent: a **member** or an **activity**.
This lifts that limit so a molecule can attach to **(almost) any parent entity**. The first new
parent is the **user** (staff login) — so we can hang roles/capabilities on users the same way
we hang fields on members. The important realisation: the molecule engine was *never* really
about members or activities. It's a generic "hang a typed, encoded value on a **link**" engine
that got *restricted* to two parents by convention. Lifting the limit is mostly removing a
hardcode, not a rewrite.

## Why — the driving use case

The WisconsinPATH review queue (Stage 1) needs **roles on people**: Medical Director / Case
Manager, potentially per-clinic. That opened the deeper model:

- **"A person is a person."** One human population (members). A **login/user** is a separate,
  deliberately-dumb *keycard* that points at a person — it stays separate because auth runs
  *before* we know who someone is (a value→person lookup that must fail loud). Everything that
  *describes* a person is attached; the login is just how they unlock being them.
- **Two kinds of "role."** Access tier (superuser/admin/csr) = *what you can do in the software*,
  resolved on the earliest auth path → stays an **explicit field**, near tenant. Domain capability
  (case manager, medical director) = *what you are in a program* → a **molecule on the user**.
- **Domain roles as a `(role, clinic)` multi-row molecule** on the user. One user can hold many
  rows — Director@A, Director@B, CaseManager@C — and (via a member-link molecule) also *be* a
  monitored member. Clinic optional (blank = program-wide).

## How it works — the mechanism that makes it cheap

Molecule storage tables are named **`{parent_key_bytes}_data_{column_widths}`**:
- the **leading number is the parent's key size in bytes**;
- each following digit is one column's byte width.

Today it's *always* `5_…` because both existing parents (member, activity) use a **5-byte
`CHAR(5)` link** — and the code **hardcodes the "5"** (`getDetailTableName` returns
`"5_data_…"`; the admin page displays `5_data_${pattern}`).

A **user's key is 4 bytes**, so user molecules live in **`4_data_*`** — identical row shape
(`p_link`, `molecule_id`, value columns, `attaches_to`) except **`p_link` is `integer`**, not
`character(5)`.

Worked example — a `(role, clinic)` molecule on a user:
`role` = internal list (1 byte) + `clinic` = key (2 bytes) → **`4_data_12`**.

## Key decisions (Session 127)

1. **User identity: widen `link` smallint → integer (4-byte).** The 2-byte `link` has a latent
   ceiling (~32–65K users, a *global* pool across all tenants; observers could push it). The
   ceiling lives in `link` + the audit `user_link` columns, independent of molecules. Widening is
   trivial *now* (a handful of users) and expensive later. Bounded column set: `platform_user.link`,
   `audit_log_1..5.user_link`, `activity.user_link` (inventory before doing).
2. **Molecules hang on the user's 4-byte `link`** — the link-native identity, already the audit id.
   `user_id` stays as the relational PK (8 FKs + session). We keep both ids (both 4-byte, distinct
   roles) because collapsing either is a real migration not worth the squeeze:
   dropping `user_id` = migrate 8 FKs + ~91 refs; dropping `link` = rewrite audit history.
3. **No A/M for user molecules.** `attaches_to` (M/A) exists only because member and activity
   *collide* in the shared 5-byte tables and the rules engine must tell them apart. New parents get
   their **own table** (the key-size prefix separates them), so there's nothing to disambiguate —
   leave A/M off. The `attaches_to` *column* stays on `4_data_*` (inert, default `'A'`) so the
   generic insert/read helpers keep working; nothing filters user molecules by it (they're found by
   `p_link + molecule_id` in their own table). Existing member/activity molecules and the rules
   engine are **untouched** — zero migration, zero risk to Delta/bonuses/promotions.
4. **Composites/classification unchanged.** We considered deriving "member vs activity" from
   composite membership; we **rejected** it as unnecessary blast radius. Keep the model exactly as
   is; new parents simply opt out of the A/M concept.

## The work — three moves + checkpoints

1. **User cleanup** — widen `link` (+ the mirrored `user_link` columns) smallint → integer, via
   `db_migrate.js`. Now the user has a real 4-byte link to hang molecules on; ceiling gone.
2. **Molecule machine** — teach it to route by the **parent's key size** instead of assuming 5.
   Same fix in two places: the server table-name function (`getDetailTableName`, hardcoded
   `"5_data_"`) and the admin page's display/create logic. **The substance:** a molecule (or its
   context) must *declare its parent key size* (4 = user, 5 = member/activity) so the machine picks
   the right table — because we are NOT using A/M for the new parents.
3. **Auto-create-table** — the "build a new table" feature in the molecule admin page must generate
   `{keysize}_data_*` (e.g. `4_data_12`), not just `5_data_*`.

**Prove it (not new work, definition of done):**
- **Round-trip a user molecule** — assign, read back, inspect the stored bytes (the mandatory
  molecule discipline; molecules fail silently).
- **Check the audit path handles a 4-byte parent** — `audit_log.p_link` is `character` today; a
  user-molecule change must audit cleanly. Possible gotcha.
- **Decide whether Tier-1 molecule hardening rides along** — validate-at-creation + auto
  round-trip self-test. We flagged it "moves up" when the fragile layer is extended. Bill's call
  whether it's part of this pass or a separate one.

## UI changes needed (molecule admin page)

Yes. Today `admin_molecule_edit.html` has exactly two checkboxes — **Activity** and **Member** —
and requires at least one. To attach a molecule to a user (or any new parent):

- **A parent-type control beyond member/activity** — a "User" option (and, generically, a way to
  pick the parent entity / its key size). This replaces the hard requirement of "member or activity."
- **The storage-table-name display must follow the parent** — show `4_data_${pattern}` for a user
  molecule, not the hardcoded `5_data_${pattern}`.
- **The create-table call must pass the parent key size** so it builds `4_data_*`.

Downstream (separate feature work, not this enablement): a **user-profile surface** to show/edit
user molecules — the analog of the member profile's M input template. Needed to actually *use*
user molecules in the product, but not part of making the machine parent-agnostic.

## Open / to-confirm

- **Which parent-key-size store the definition uses** to declare "I attach to a 4-byte user" —
  the exact schema change to `molecule_def`/`molecule_value_lookup` (a parent-type / key-size field).
- **Audit of user-molecule changes** — see checkpoint above.
- **Tenant + superuser stay explicit fields**, not molecules (isolation boundary / resolved before
  the molecule layer / circular). Only *domain* data goes in molecules.
