# LOYALTY PLATFORM ESSENTIALS

**Purpose:** Rules and patterns to prevent Claude from breaking things. Implementation details live in the code itself.

---

# 0. HOW TO USE THIS DOCUMENT

This is a durable rules document. It should explain platform guardrails that
stay true across sessions.

For startup order and current session continuity, use:
- `START_HERE.md`
- `HANDOFF.md`
- `STATE.md`
- `ACTIVE_WORK.md`
- `WORKFLOWS.md`

For architecture and subsystem reference, use `docs/LOYALTY_PLATFORM_MASTER.md`.

If this file and the master doc are long, read them in chunks. The important
part is to finish reading them, not to invent a new startup ritual.

---

# 1. CRITICAL RULES

## Database Connection
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

## NEVER Do These Things

1. **NEVER write direct SQL against molecule tables** - Always use helper functions
2. **NEVER raw JOIN to member_tier** - Always use `get_member_current_tier()` helper
3. **NEVER hardcode what should come from database**
4. **NEVER assume table/column structure** - Check schema first
5. **NEVER guess at function parameters** - Look at existing working examples
6. **NEVER start coding without reading schema**
7. **NEVER trust old SQL files as templates** - Schema evolves, verify current structure
8. **NEVER build UI without full CRUD** - Include delete with confirmation
9. **NEVER give multiple options when asked for ONE thing**
10. **NEVER over-explain simple requests** - Direct answers, not essays

## ALWAYS Do These Things

1. **ALWAYS use helper functions** for molecules, tiers, encoding
2. **ALWAYS check existing patterns** before implementing similar features
3. **ALWAYS trace working examples** (like PASSPORT for text molecules)
4. **ALWAYS verify data format** before applying transformations
5. **ALWAYS declare variables before use** in JavaScript
6. **ALWAYS read what Bill actually writes** - don't misinterpret
7. **ALWAYS put per-tenant tunable knobs in config tables, not JS constants** — `sysparm` + `sysparm_detail` for simple or grouped key/value (the canonical store), dedicated tables for structured config. See §7 Data Drives Behavior and master doc §42 TENANT CONFIGURATION TABLES.
8. **ALWAYS round PPII composite ONCE at the end** — never round per-stream inside the weighted sum. `composeFromContributions` in `scorePPII.js` uses unrounded floats inline. Per-stream rounding accumulates error and shifts band classifications at boundary inputs (Session 117 fix).

---

# 2. MOLECULE SYSTEM

Molecules are the core abstraction — tenant-specific typed values attached to activities and
members without per-tenant columns or code. They fail **silently** (a wrong molecule reads back
empty, never throws), so they are the easiest thing on the platform to get subtly wrong.

**Before you create, edit, or reason about any molecule, read [docs/MOLECULES.md](MOLECULES.md) —
the molecule authority and single source of truth.** It covers the storage/encoding mechanism, the
per-type recipes, the silent-failure invariants (member molecules need a `molecule_value_lookup`
row; internal-list value_ids are per-molecule 1–127; `value_kind`/`scalar_type` must be set), the
verified working exemplars, the helper functions, and the mandatory round-trip verification.

The non-negotiables in one line: **never touch molecule storage tables (`5_data_*`,
`molecule_value_text`, `molecule_text`) with raw SQL — always the helpers; never raw-JOIN
`member_tier` — use `get_member_current_tier()`; check the schema before you write.** Everything
else is in MOLECULES.md.

# 3. TIER LOOKUPS

**RULE:** Never raw JOIN to member_tier. A member can qualify for multiple tiers simultaneously.

**WRONG:**
```sql
LEFT JOIN member_tier mt ON mt.p_link = m.link 
  AND mt.start_date <= CURRENT_DATE
```

**RIGHT:**
```sql
LEFT JOIN LATERAL get_member_current_tier(m.link) tier ON true
```

The helper returns the highest-ranking tier for overlapping records.

---

# 4. ATOM SYSTEM - TEMPLATE VARIABLES

Atoms are dynamic variable substitution tags embedded in text strings that resolve to actual data at runtime.

## The Problem Atoms Solve

**Without atoms:** 
- error = "Member does not have enough miles" (wrong for hotels)
- error = "Member does not have enough points" (wrong for airlines)
- You'd need different messages for every industry and tenant

**With atoms:** 
- error = "Member does not have enough {{M,point_type,label,,L}}"
- Delta renders: "miles", Marriott renders: "points", Gym renders: "credits"
- Same code, different data

## Atom Syntax

```
{{source,identifier,field,length,case}}
```

**Parameters:**
- **source:** M = Molecule, T = Table (direct database lookup)
- **identifier:** molecule_key or table_name
- **field:** Which property to extract (label, code, value)
- **length:** Optional truncation (number or empty)
- **case:** U = UPPERCASE, L = lowercase, P = Proper Case

## Examples

```
{{M,point_type,label}}        → "Miles"
{{M,point_type,label,,L}}     → "miles"
{{M,carrier,code}}            → "DL"
{{T,members,first_name}}      → "Bill"
{{T,members,first_name,,U}}   → "BILL"
{{M,carrier,name,20}}         → "Delta Air Lines" (truncated to 20 chars)
```

## Use Cases

**Error Messages:** 
"Member does not have enough {{M,point_type,label,,L}} for this redemption"

**Personalized Greetings:** 
"Welcome back, {{T,members,first_name,,P}}!"

**Dynamic Headers:** 
"Total {{M,point_type,label,,P}} Earned" → Airlines: "Total Miles Earned", Hotels: "Total Points Earned"

**Activity Displays:** 
"{{M,carrier,code}} {{M,flight_number,value}} from {{M,origin,code}} to {{M,destination,code}}" → "DL 1234 from DFW to ATL"

## Why Atoms Matter

- **Universal Text Templates:** One template works across all tenants and industries
- **Self-Documenting:** {{M,point_type,label,,L}} is crystal clear
- **No String Concatenation:** Format and case rules in the atom, not scattered through code
- **Template Reuse:** Same templates work in error messages, emails, SMS, reports, UI labels

**Code:** `atom_resolve.js`

---

# 5. DATE HANDLING

## Three Date Systems in the Platform

### 1. PostgreSQL DATE Type
- Returned from database as JavaScript Date object or "YYYY-MM-DD" string
- Used in: member.enrollment_date, bonus.start_date, etc.

### 2. Bill Epoch (2-byte SMALLINT)
**Epoch: December 3, 1959 (Bill's birthday)**

- SMALLINT range: -32,768 to 32,767 (65,536 values)
- Date mapping: Dec 3, 1959 = 0
- Coverage: ~1870 to ~2138 (179 years)
- Used in: activity.activity_date, point bucket expiration dates

**Why this epoch:**
- Loyalty programs began 1980s, no need for dates before 1959
- Forward coverage through 2138 (113 years)
- 2 bytes instead of 8 bytes = 75% storage savings

**Conversion Functions (the canonical pair — `dateToActivityInt`/`activityIntToDate`
were consolidated away and no longer exist):**
```javascript
dateToMoleculeInt(date)    // JS Date or "YYYY-MM-DD" → SMALLINT (days since 1959-12-03)
moleculeIntToDate(num)     // SMALLINT → JS Date (local-midnight, calendar-day correct)
```

**PostgreSQL functions:**
```sql
date_to_molecule_int(date)   -- DATE → INTEGER
molecule_int_to_date(integer) -- INTEGER → DATE
```

**Example:**
- 2025-12-06 → 24108 (stored as SMALLINT)
- 24108 → 2025-12-06 (decoded back)

### 3. JavaScript Date Timezone Bug

**The Problem:**
```javascript
// WRONG - interprets as UTC midnight, displays as previous day in Central Time
new Date("2025-12-03")  // Shows as Dec 2 in CST!

// RIGHT - forces local time interpretation
new Date("2025-12-03T00:00:00")  // Shows as Dec 3
```

**CRITICAL: Check data format BEFORE applying fix:**
- If it's already a Date object → don't add T00:00:00
- If it's a full timestamp string → don't add T00:00:00  
- If it's a 10-character "YYYY-MM-DD" string → add T00:00:00
- If it's a Bill epoch integer → use moleculeIntToDate(), don't manipulate directly

**Safe Pattern:**
```javascript
function safeDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return moleculeIntToDate(input);
  if (typeof input === 'string' && input.length === 10) {
    return new Date(input + 'T00:00:00');
  }
  return new Date(input);
}
```

## Time Storage - 10-Second Blocks

For timestamps, time-of-day stored as SMALLINT in 10-second blocks:
- 00:00:00 = 0
- 12:00:00 = 4,320
- 23:59:50 = 8,639

Combined with date: 4 bytes total instead of 8 bytes for TIMESTAMP.

## NEVER Invent "Today"

Do NOT create new ways to get today's date. The platform has centralized date functions — use them. Do not write `new Date()`, `Date.now()`, or `toISOString()` to compute today.

**Banned patterns:**
```javascript
// WRONG — all of these invent "today" in different ways
new Date()                          // raw JS Date, timezone varies
Date.now()                          // Unix milliseconds (OK for elapsed time measurement, NOT for dates)
dateToMoleculeInt(new Date())       // works but should use the centralized function
dateToBillEpoch(new Date())         // duplicate of dateToMoleculeInt — don't use
new Date().toISOString().slice(0,10) // UTC shift bug — shows wrong date near midnight
Math.floor(Date.now() / 1000)      // Unix seconds — NOT a platform date format
```

**Correct:** Use the platform's centralized helpers — `platformToday()` for the Bill-epoch
integer, `platformTodayStr()` for the local `"YYYY-MM-DD"` string. Both live in
`pointers.js` (the consolidation is DONE — do not use workarounds).

**Three Bill epoch formats:**
1. **Date** — 2 bytes SMALLINT, days since Dec 3, 1959. Day precision.
2. **Time** — 2 bytes SMALLINT, 10-second blocks within a day. 00:00:00=0, 23:59:50=8639.
3. **DateTime** — 4 bytes INTEGER, date+time combined. 10-second precision. Used in audit system. Encode/decode via `timestamp_to_audit_ts()` / `audit_ts_to_timestamp()`.

**No Unix timestamps.** The `member_survey.start_ts` / `end_ts` columns were the last
violation — migration **v55** converted them to Bill epoch DateTime (format #3). Nothing
in the platform stores Unix time today; don't reintroduce it.

---

# 6. LINK TANK

Primary key generation using base-127 encoding (no null bytes).

```javascript
const link = await getNextLink('member');     // Returns 5-byte CHAR
const link = await getNextLink('activity');   // Returns 5-byte CHAR
```

Storage sizes:
- 1 byte: 127 values (fare_class)
- 2 bytes: 65K values (carrier, airport)
- 5 bytes: 1T+ values (member, activity)
- 8 bytes: Raw BIGINT (membership numbers)

---

# 7. ARCHITECTURE PRINCIPLES

## Temporal-First Design
- Point balances derived from transaction history, never stored
- Activities reflect world state when they occurred
- "What was balance on date X?" is a simple query
- Tiers are derived from points, not stored as status fields

## Multi-Tenant Isolation
- `tenant_id` on every table
- `app_current_tenant_id()` for session-based filtering
- RLS enabled on member table

## Data Drives Behavior
- Business rules in database, not code
- Molecule values configure behavior
- No hardcoded logic that should be configurable
- **Per-tenant tunable knobs live in config tables** (added Sessions 116–120):
  - `sysparm` + `sysparm_detail` — the canonical tenant-config store; one `sysparm` row per logical group, multiple detail rows per group. Today: `ppii_thresholds` (3 band cutoffs), `pattern_triggers` (3 detection thresholds), `event_severity` (threshold + signal name). v73 consolidated these out of the short-lived `admin_settings` table — don't recreate `admin_settings`.
  - `followup_schedule` — registry follow-up cadence per urgency or extended-card override; `scheduleFollowups()` reads from this table
  - `external_result_action.urgency` + `sla_hours` — per-action urgency band and SLA; `createRegistryItem` reads from here, no hardcoded urgencyMap
- Pattern: code reads from the table with a try/catch fallback to a sensible default. Don't remove the fallback — it preserves behavior when the table or key is missing for a tenant.
- Adding a new state should be SQL INSERTs into these tables, **never** a code change to per-tenant JS files. Full reference: master doc §42 TENANT CONFIGURATION TABLES.
- **Bonus vs promotion:** single-activity fire-once trigger = bonus; multi-activity accumulator = promotion. Don't reach for promotions for alert-style triggers (history: the 25 wi_php alert promotions were converted to bonuses in v67/Session 115 once the Bonus Result Engine made external dispatch possible from bonuses).

## Zero Batch Processing
- Calculate on-demand, don't precompute
- No nightly jobs, data is never stale
- Point balance = query, not stored value

## Everything Is Pointers
- Store IDs that reference shared data, never duplicate text
- Right-sized data types (CHAR(2) for states, not VARCHAR(255))
- Cache-friendly, memory-efficient

## Verticals Folder Architecture (Session 94)

Three-level file serving for industry-specific pages:

```
loyalty-demo/              (core platform — admin, CSR, shared JS/CSS)
  verticals/
    workforce_monitoring/  (shared pages for all workforce monitoring tenants)
      clinic.html
      dashboard.html
      physician_portal.html
      action_queue.html
      ...
      clinical/            (shared clinical engine — Session 144: scorers,
        custauth.js         custauth, PPII, dominant driver, protocol cards.
        scorePPSI.js        The PI² product code; per-state differences are
        scorePPII.js        DB config, never code copies)
        ...
      tenants/
        wi_php/            (Wisconsin PHP-specific data/docs; no code — the
                            clinical engine moved up to clinical/ in S144)
        wa_php/            (Washington — the second state)
    airline/
      tenants/
        delta/
        united/
    hotel/
      tenants/
        marriott/
```

**File serving fallback order:**
1. `verticals/{vertical_key}/tenants/{tenant_key}/` — tenant-specific override
2. `verticals/{vertical_key}/` — shared vertical pages
3. Project root — core platform

**Tenant table:** `vertical_key` column (renamed from `industry`) maps tenant to vertical folder. Values: `workforce_monitoring`, `airline`, `hotel`, `automotive`.

**Login routing:** After login, tenant users route to `verticals/{vertical_key}/dashboard.html`. Superusers go to `menu.html`.

**Scoring/custauth loading:** Tenant folder `verticals/{vertical}/tenants/{tenant}/` overrides; then the vertical's shared `verticals/{vertical}/clinical/`; then legacy `tenants/{tenant}/`. Every workforce tenant gets the shared clinical engine unless it ships its own override file.

**Key rule:** Shared pages in the vertical folder use `sessionStorage.getItem('tenant_id')` for tenant_id — never hardcode. All shared JS (auth.js, lp-header.js) use absolute paths (`/login.html`, `/auth.js`) so they work from any subfolder depth.

---

# 8. SYSTEM CONCEPTS

These describe WHAT systems are and WHY they exist. Look at actual code for HOW they work.

## Activity Types

Every activity has a single-character `activity_type`. Understanding these is essential.

| Type | Name | Point Sign | Description |
|------|------|------------|-------------|
| A | Accrual/Flight | + | Earning activity (flights, stays, purchases) |
| N | Bonus | + | Child activity created when bonus rule matches parent |
| J | Adjustment | +/- | Manual CSR correction (positive or negative) |
| R | Redemption | - | Points spent for awards (always negative) |
| P | Partner | + | Earnings from partners (Marriott, Hertz, etc.) |
| M | Promotion | + | Reward when member completes promotion goal |

**Key Relationships:**
- Type 'N' (Bonus) activities are children of type 'A' activities
- The parent activity stores `bonus_activity_link` molecules pointing to its bonus children
- When querying member activities, often exclude 'N': `WHERE activity_type != 'N'`

## Display Template Syntax

Templates use bracket notation to render activity data in the UI.

**Molecule Component:** `[M,molecule_key,"format",maxLength]`
```
[M,carrier,"Code"]           → "DL"
[M,carrier,"Description"]    → "Delta Air Lines"
[M,carrier,"Both"]           → "DL Delta Air Lines"
[M,carrier,"Description",20] → truncated to 20 chars
```

**Text Component:** `[T,"literal text"]`
```
[T," - "]       → " - "
[T," → "]       → " → "
[T,"Flight "]   → "Flight "
```

**Complete Line Example:**
```
[M,carrier,"Code"][M,flight_number,"Code"][T," from "][M,origin,"Code"][T," to "][M,destination,"Code"]
```
Renders as: "DL1234 from MSP to LAX"

**Template Types:**
- **Efficient (E):** Compact single-line format
- **Verbose (V):** Detailed multi-line format

**Note:** This bracket syntax `[M,...]` is different from Atom syntax `{{M,...}}`. Brackets are for display templates. Double-braces are for text substitution in strings.

## Link vs ID Pattern

The platform uses `link` and `p_link` instead of `id` and `parent_id`.

**Why:**
- Links are optimized 5-byte values (base-127 encoded)
- Support for 1 trillion records vs 2 billion with INTEGER
- Self-describing size (odd bytes = CHAR with squish encoding)

**Pattern:**
```sql
-- Parent table
member (
  link CHAR(5) PRIMARY KEY,  -- The member's identifier
  ...
)

-- Child table
activity (
  link CHAR(5) PRIMARY KEY,  -- The activity's identifier
  p_link CHAR(5) REFERENCES member(link),  -- Points to parent member
  ...
)

-- Grandchild (bonus activities)
activity (
  link CHAR(5) PRIMARY KEY,
  p_link CHAR(5) REFERENCES member(link),  -- Still points to member, NOT parent activity
  ...
)
```

**Important:** `p_link` always points to the member, even for bonus activities. Use `bonus_activity_link` molecule to link parent activity to bonus children.

## Point Flow

How points move through the system:

```
Activity Created (type='A', flight)
    ↓
Bonus Rules Evaluated
    ↓
Base Points + Bonus Points Calculated
    ↓
Point Bucket Found or Created
    (member + bonus_rule_id + expire_date)
    ↓
member_point_bucket.accrued Updated
    ↓
member_points Molecule Saved on Activity
    (links activity to bucket + amount)
    ↓
Balance = SUM(all bucket accrued) - SUM(all bucket redeemed)
```

**Never store current balance.** Always derive from buckets.

**Redemption Flow (negative points):**
```
Redemption Request
    ↓
FIFO: Find Oldest Expiring Buckets First
    ↓
Consume from Buckets (update .redeemed)
    ↓
Create Activity (type='R', negative point_amount)
    ↓
member_points Molecules (negative, one per bucket used)
```

## Criteria Operators

Used in bonus and promotion rule evaluation:

| Operator | Meaning | Example |
|----------|---------|---------|
| = | Equals | carrier = 'DL' |
| != | Not equals | fare_class != 'Y' |
| > | Greater than | miles > 1000 |
| >= | Greater or equal | tier_ranking >= 3 |
| < | Less than | segment_count < 5 |
| <= | Less or equal | mqd <= 10000 |
| IN | In list | origin IN ('MSP','DTW','ATL') |
| NOT IN | Not in list | destination NOT IN ('XYZ') |
| BETWEEN | Range inclusive | activity_date BETWEEN '2025-01-01' AND '2025-12-31' |
| LIKE | Pattern match | route LIKE 'MSP%' |

## Joiner Logic (AND/OR)

Rules combine multiple criteria using joiner logic:

**Rule with AND joiner:**
```
Criterion 1: carrier = 'DL'
  AND
Criterion 2: fare_class IN ('F','J')
  AND
Criterion 3: origin = 'MSP'
```
ALL must match for bonus to apply.

**Rule with OR joiner:**
```
Criterion 1: destination = 'HNL'
  OR
Criterion 2: destination = 'OGG'
```
ANY match triggers bonus.

**Complex Rules:** Use multiple rules with different joiners, linked via `bonus_rule` table.

## Calculated Fields

In composites, molecules can be marked `is_calculated = true` with a `calc_function`.

**How it works:**
1. Composite defines: `is_calculated=true, calc_function='calculateFlightMiles'`
2. Input template renders field as **readonly** (yellow background, 🔄 icon)
3. Client-side: Function runs when dependent fields change
4. Server-side: Same function runs during activity creation (authoritative)

**Example:** Aircraft type calculated from origin/destination distance:
- Client: `selectAircraftType(miles)` updates readonly field
- Server: Recalculates regardless of what client sent

**Never trust client-calculated values.** Server always recalculates.

## Reference Molecules (Type 'R')

Reference molecules don't store data - they query live data on demand.

**Configuration in molecule_def:**
```
molecule_type = 'R'
value_kind = 'reference'
ref_function_name = 'get_member_tier_on_date'
```

**How they work:**
1. Bonus evaluation needs member's tier
2. Calls `getMoleculeValue(tenantId, 'member_tier_on_date', {member_id}, activityDate)`
3. System sees it's reference type, calls the PostgreSQL function
4. Returns live data, nothing stored

**Common Reference Molecules:**
- `member_fname` - Member's first name from member table
- `member_state` - Member's state from member table
- `member_tier_on_date` - Tier on specific date (temporal!)

**Why reference molecules matter:**
- Rule can check "member lives in MN" without storing state on every activity
- Temporal queries: "What tier was member on activity date?" 
- Always current: Name changes reflect immediately

## System Summaries

Brief "what/why" for each major system:

**Bonus System:** Rules awarding extra points when activity meets criteria. Airlines give 2x for first class, 500 for Hawaii, etc. Code: `evaluateBonuses` in pointers.js

**Promotion System (v56 multi-counter):** Goal-based rewards. Each promotion has 1-N *counters* (e.g. "fly 3 flights" is one counter; "fly 3 flights OR earn 5,000 miles" is two counters joined by OR). Counters live on `promo_wt_count`; per-enrollment progress lives on `member_promo_wt_count`. The `promotion` table carries `counter_joiner` (AND/OR) — AND requires every counter to hit its goal, OR requires any one. Legacy columns `count_type`, `goal_amount`, `counter_molecule_id`, `counter_token_adjustment_id` are GONE from `promotion`; `progress_counter` and `goal_amount` are GONE from `member_promotion`. Enrollment-type counters auto-seed to goal at enrollment time (act of enrolling IS the event). Grandfather rule: goals snapshot to member at enrollment — admin cannot edit the counter set on a promo that already has enrollments (returns 409). Code: search "evaluatePromotions", "createMemberPromotionEnrollment", "evaluatePromoQualifiedByJoiner".

**Composite System:** Defines which molecules make up each activity type per tenant. Delta flights need carrier/origin/destination; hotels need different fields. Code: `activity_composite_detail`

**Display Templates:** Define how activities appear in UI. Show "DL 1234 MSP→LAX" not raw fields. Code: `renderMagicBox`

**Input Templates:** Define data entry forms. Configure which fields, what order, for each activity type. Code: `template-form-renderer.js`

**Point Buckets:** Where points live, tracked by rule and expiration. Balance = SUM(accrued) - SUM(redeemed). Never store current balance. Code: `findOrCreatePointBucket`

**Redemptions:** Spending points for awards. FIFO consumption from oldest buckets. Code: search "redemption" endpoints

**Adjustments:** Manual CSR corrections. Fixed or variable amounts, optional comments. Code: search "adjustment" endpoints

**Partners:** External companies earning/burning points. Marriott, Hertz, Amex. Code: search "partner" endpoints

**Aliases:** Alternate account numbers resolving to members. Partner numbers, legacy systems. Code: search "alias" endpoints

**External Action System (Session 83b):** When a promotion qualifies with reward_type='external', the engine looks up the result_reference_id in `external_result_action` table and dispatches through the shared `externalActionHandlers` registry when `function_name` is populated. If `function_name` is null, the action still records in the audit path but runs no server-side handler. Table: `external_result_action`. Admin: `admin_external_actions.html`. Code: `processPromotionResult()` + the registry populated at boot by vertical/server modules.

**Signal System (Session 83b):** General purpose SIGNAL molecule (id=119, storage_size=2, value_type=key) backed by `signal_type` lookup table. Scoring functions hang a signal value on an accrual. Promotions evaluate against signal values. Unlimited signals per tenant — just add rows to signal_type. No new molecules needed per signal. Admin: `admin_signal_types.html`.

**Stability Registry (Session 83b, Insight-specific):** Central table for physician status lifecycle. Every condition needing clinical attention creates an item. Physician color = most severe open item. Lifecycle: Open → Assigned → Resolved. SLA tracking, audit trail. Table: `stability_registry` (link INTEGER PK from link_tank). Dominant Driver columns (Session 95): `dominant_driver` (PPSI/PULSE/COMPLIANCE/EVENTS), `dominant_subdomain` (8 PPSI sections), `protocol_card` (A1-A8/P1-P5/C/D/S1). Fed by external action handlers via promotion engine. API: `/v1/stability-registry`, `/v1/stability-registry/audit-history`, `/v1/stability-registry/member/:membershipNumber`. UI: `verticals/workforce_monitoring/action_queue.html`.

**Outcome Tracking (Session 95):** Auto-scheduled follow-up checks on registry items. Table: `registry_followup` (followup_id SERIAL PK, registry_link FK, tenant_id, followup_type 48h/weekly/2wk/4wk/8wk/compliance_period, scheduled_date SMALLINT Bill epoch, outcome improving/stable/declining/escalated, pathway_answers JSONB, completed_by FK). Schedule varies by urgency: Yellow/Orange 2/4/8wk, Red weekly×4 then 4/8wk, Sentinel 48h then weekly×3. Auto-created when registry item has dominant driver. API: `GET /v1/registry-followups`, `GET /v1/registry-followups/summary`, `POST /v1/registry-followups`, `PATCH /v1/registry-followups/:id`. UI: Follow-ups tab on `action_queue.html`.

**Pattern-Based Triggers (Session 95):** Three pattern detections in POST_ACCRUAL custauth hook: PPII_TREND_UP (N consecutive rising periods, default 3), PPII_SPIKE (delta ≥ threshold, default 15), PROTECTIVE_COLLAPSE (Isolation+Recovery+Purpose sections all worsening over N consecutive surveys, default 2). Configurable via `sysparm` (key=`pattern_triggers`, detail rows category=`threshold`, code=`trend_periods`/`spike_delta`/`protective_periods`). Creates Yellow-urgency registry items through promotion engine (signal → rule → promotion → SR_YELLOW external action → createRegistryItem). Code: `custauth.js` POST_ACCRUAL hook.

**Notification System (Session 95, Core Pointer):** Platform-wide notification engine. Table: `notification` (notification_id SERIAL PK, tenant_id, recipient_user_id, severity critical/warning/info, title, body, source, source_link, source_page, is_read, read_at, created_at, expires_at). API: `GET /v1/notifications`, `POST /v1/notifications`, `PATCH /v1/notifications/:id/read`, `PATCH /v1/notifications/read-all`. UI: bell icon with unread badge. Rules route by role or **by position** (recipient_type 'position', v95). The delivery framework is BUILT (`notification_delivery` + `notification_delivery_config`: per-channel email/SMS/push records, tenant delivery windows, critical-bypasses-window, held/digest states, retry budget) — only the external provider send (Twilio/SendGrid) is still a stub pending provider selection.

**Survey System:** Define surveys with sections, questions, scale types. Wisconsin PHP now carries a 10-instrument catalog: PPSI (34 items, self-report, weekly) and Provider Pulse (14 items, clinician-completed, monthly) plus six anchor instruments (PROMIS-8a, Stanford PFI, Mini-Z, UCLA-3, CFQ-8, CGI-S) and two public-domain screeners (PHQ-9, GAD-7 — cadence NULL, one-time use). Surveys carry catalog metadata (`instrument_purpose` monitoring/screening, `license_status`). Per-participant assignment lives in `member_instrument` (v97): who takes what, on what schedule. Survey take modal, scoring functions, respondent tracking, and mark-in-error flow are all wired. Code: search "survey" endpoints, `score*.js` in the wi_php tenant folder, `instruments.js`.

**Compliance System (Session 82):** 6 compliance items with weighted scoring, categorical results, sentinel detection. Queue-based model — expected events minus completed events. Table: `compliance_item`, `compliance_item_status`, `member_compliance`, `compliance_result`. API: `/v1/compliance/member/:id`, `/v1/compliance/entry`. UI: `verticals/workforce_monitoring/compliance_member.html`.

**Database Migration System (Session 94):** `db_migrate.js` manages schema and data changes across all environments (local, Heroku, future). One cumulative script with versioned blocks. Each block runs in a transaction — success commits and bumps version, failure rolls back. Safe to run multiple times. Version stored in `sysparm` (tenant_id=0, key='db_version'). `pointers.js` checks database version on startup as the FIRST operation after DB connect — refuses to start on mismatch. Run `node db_migrate.js` to bring any database to current. To add a migration: add a block to the migrations array, bump TARGET_VERSION in db_migrate.js, bump EXPECTED_DB_VERSION in pointers.js.

---

# 9. UI STANDARDS (LONGORIA)

When Bill says "LONGORIA this page" - apply these standards for consistent, modern UI.

## Core Principles
- **Tenant Branding**: All styling flows from tenant configuration (logo, colors, tier badges)
- **Compact & Dense**: Maximize data visibility, minimize chrome
- **Consistent Patterns**: Same card/header/button patterns across all pages

## Tenant Branding System

### CSS Variables (set by brand-loader.js)
```css
--primary        /* Tenant's primary color (nav, buttons, active states) */
--primary-dark   /* Auto-derived darker shade */
--primary-light  /* Auto-derived lighter shade */
--accent         /* Secondary accent color */
--accent-dark
--accent-light
```

### Branding Files
- `brand-loader.js` - Loads tenant branding, sets CSS variables
- `lp-header.js` - Top nav with logo display
- Database: `sysparm_detail` stores branding JSON, `tier_definition` stores tier styling

## Page Structure

### Global Layout
```css
html, body { height: 100%; margin: 0; overflow: hidden; }
.app-layout { height: calc(100vh - 48px) !important; min-height: auto !important; margin-top: 48px; }
.main-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
```

### Top Nav Bar (48px, fixed)
- Dark background using `var(--primary)`
- Left: App switcher | Logo (or company name) | Area label
- Right: Member name + ID | Tier badge | Points balance
- Files: `lp-header.js`, `member-header.js`

## CSR Page Patterns

### List View Pattern (tables, activity list)
```css
/* Card */
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* Card header - compact */
.card-header-light {
  background: #f8fafc;
  padding: 8px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.card-header-light h2 { font-size: 14px; font-weight: 600; margin: 0; }

/* Table - tight rows */
.activity-table td { padding: 6px 10px; }
.activity-table th { 
  padding: 8px 10px;
  font-size: 11px; 
  text-transform: uppercase;
  color: #64748b;
  background: #f8fafc;
}

/* Scroll area extends to viewport bottom */
.table-scroll-wrapper { max-height: calc(100vh - 165px); overflow-y: auto; }
```

### Type Badges (colored by activity type)
```css
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.type-badge.flight { background: #dbeafe; color: #1e40af; }
.type-badge.adjustment { background: #ede9fe; color: #5b21b6; }
.type-badge.redemption { background: #fee2e2; color: #991b1b; }
.type-badge.promotion { background: #fef3c7; color: #92400e; }
.type-badge.partner { background: #d1fae5; color: #065f46; }
```

### Form Page Pattern (add/edit pages)
```css
/* Card header - slightly larger for forms */
.card-header-light { padding: 12px 16px; }
.page-title { font-size: 18px; font-weight: 600; margin: 0; }
.page-subtitle { font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0; }

/* Card body */
.card-body { padding: 16px; }

/* Form inputs */
.form-input { padding: 6px 8px; font-size: 14px; border-radius: 4px; }
.form-label { font-size: 13px; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Actions */
.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
```

### Button Sizes
```css
.btn { padding: 8px 16px; font-size: 14px; }      /* Standard */
.btn-sm { padding: 5px 12px; font-size: 13px; }   /* Compact (card headers) */
```

### Toggle Buttons (Efficient/Verbose)
```css
.view-toggle-btn { padding: 4px 10px; font-size: 12px; }
```

## Tier Badge Styling
Tier badges pull from `tier_definition` table:
- `badge_color` - Background color (e.g., #e01933 for Diamond)
- `text_color` - Text color (e.g., #ffffff)
- `icon` - Emoji or short text (e.g., 💎)

Rendered as pill badges in nav and member displays.

## Files to Include
Every CSR page should include:
```html
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="buttons.css">
<script src="brand-loader.js"></script>
<script src="lp-header.js"></script>
<script src="member-header.js"></script>
```

## Execution Efficiency
LONGORIA should be fast (7-10 tool calls max):
1. Read files completely first
2. Plan all changes in one pass
3. Use sed/awk for repetitive replacements
4. Batch related changes
5. Verify once at end

---

# 10. CODING PATTERNS

## Version Updates (AUTOMATIC - NEVER ASK)
When modifying pointers.js, ALWAYS update SERVER_VERSION and BUILD_NOTES:
```javascript
const SERVER_VERSION = '2025.12.19.1430';  // TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
const BUILD_NOTES = 'Fixed member search tier lookup';
```
Never ask permission. Just do it.

## Dual-Mode Pages (Create + Edit)
- Declare ALL variables at top before either code path
- All functions available to both paths
- "Load existing data" conditionally skipped in create mode

## JavaScript
- Use `let`/`const` declarations before use (not hoisted like `var`)
- Handle async properly
- Check for null/undefined before operations

## Complete Work
- Always provide complete files
- Never ask Bill to manually edit code
- Test with curl before UI

---

# 11. WHEN BILL SIGNALS PROBLEMS

- **"stop!"** - Pause immediately, listen
- **"NO!"** - Fundamental misunderstanding, reconsider approach
- **"why?"** - Explain your reasoning
- **"why are you asking?"** - Answer should be obvious from data, check schema
- **"shouldn't this come from molecule?"** - You're hardcoding, read from database
- **ALL CAPS / Swearing** - Serious mistake, don't defend, fix immediately
- **"b"** - Just scrolling, keep waiting

## {Variable} Notation
When Bill uses `{Miles}` or `{Points}` in messages, curly braces = dynamic value, NOT literal text.

**Example:** Bill says "Show {Miles} in header" → Use pointLabel variable, NOT literal "{Miles}"

# 12. BEFORE WRITING CODE

1. Read the schema
2. Find existing similar patterns
3. Identify which helper functions to use
4. Trace through a working example
5. THEN write code

---

# 13. TERMINAL COMMANDS (COPY/PASTE READY)

## Database Connection
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

## Run SQL Script (from Bill's project root)
```bash
cd ~/Projects/Loyalty-Demo
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql
```

## Run Inline SQL
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM table_name LIMIT 5;"
```

## Check Table Structure
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\d table_name"
```

## Multi-Line SQL (use heredoc)
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty << 'EOF'
SELECT m.member_id, m.fname, m.lname
FROM member m
WHERE m.tenant_id = 1
LIMIT 10;
EOF
```

## Start Server
```bash
cd ~/Projects/Loyalty-Demo
bash bootstrap/start.sh
```

## Get Current Timestamp (Central Time)
```bash
TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
```

## Run Database Migration
```bash
cd ~/Projects/Loyalty-Demo
node db_migrate.js
```

---

# 14. SESSION CONTINUITY

- Put unfinished work in `ACTIVE_WORK.md`, not a new timestamped handoff file.
- Put durable rules learned during a session back into this document or `docs/BEFORE_YOU_WRITE.md`.
- Use `WORKFLOWS.md` for the current start/test/commit/push/deploy mechanics.
- Do not let temporary process ritual drift back into this file.

---

# 15. WHEN IN DOUBT

1. Check the schema first
2. Use molecule helpers, not direct SQL
3. Follow existing patterns in the codebase
4. Trace a working example before implementing
5. Ask Bill rather than assume
6. One thing at a time
