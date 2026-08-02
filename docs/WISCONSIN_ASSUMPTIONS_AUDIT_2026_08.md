# The Wisconsin-Assumptions Audit — Session 162, 2026-08-01

> **DISPOSITION (Session 163, 2026-08-02): CLOSED.** Every Tier 1, Tier 2,
> and Tier 3 finding below is fixed. S162 fixed seven as found (deployed
> S163); S163 fixed 1.3–1.7 (deployed same day), 2.1–2.5, and the Tier 3
> list (commits `a554fca`, `94d4206`, `9b9d803`, `fe0a4b2`; migrations
> v142–v144). Standing guards #3 (census v2) and #4 (encode sign guard)
> are built; #1, #2, #5, #6 are queued in ACTIVE_WORK. Two items parked
> as Bill decisions: performance_profile's snapshot; ORDER BY link as
> catalog order (needs a display_order column). The one-time SQL script's
> COALESCE(key_ref, 0) is left as history (already run everywhere).
> Details per finding: Insight Build Notes S162–S163.

**Why:** Session 161 found five bugs in one day that all had the same shape —
code that works on wi_php because Wisconsin was built first (small positive
ids, tenant 5, Central time) and silently breaks on the copied tenants
(wa_php, the sandbox) that the Washington pilot depends on. Bill approved a
dedicated audit session: read-only lenses → verified findings → Bill ranks
the fixes. This document is the deliverable.

**Method:** five parallel read-only lenses (numeric Wisconsin ids; hardcoded
tenant checks; copier manifest completeness; shared-page client
Wisconsin-isms; offset-family assumptions). Every headline claim below was
**verified by the main session** against the live local DB or by direct code
read before being written down. Items a lens reported that verification
killed are in "Cleared" at the bottom — do not re-chase them.

**Fixed this same session, before and during the audit (commits `7b6ab29`,
`5f77f47`):** protective-collapse detector matches categories by CODE; the
dead internal-HTTP signal-filing path (no threshold/pattern registry item
was created anywhere 2026-03-19 → 2026-08-01) replaced with the in-process
`processAccrual` door; same-day sitting tiebreaker (`ms.link DESC`); the
recursion guard completed (pattern signals added to `PPII_SIGNALS`); the
open-item duplicate check matches action codes resolved from live config
("never the same news twice" restored). Standing guard:
`test_pattern_triggers` part 2 proves the whole chain on the sandbox.

---

## TIER 1 — the Washington pilot hits these (fix before pilot)

### 1.1 PPII_SPIKE and PPII_TREND_UP are blind — on EVERY tenant, including Wisconsin
`verticals/workforce_monitoring/clinical/custauth.js:298` (ppiiHistory) and
`:443` (eventPrior) join `molecule_value_embedded_list` to find
SURVEY/EVENT accruals. **Verified live: that table is EMPTY for all tenants
and nothing in the codebase writes to it** (only two DELETEs in
pointers.js). ACCRUAL_TYPE's values live in `molecule_value_text`
(value_kind `internal_list`) since the ~S126 molecule-value era. So the
spike and rising-trend detectors have had no score history to read — their
`scores` array is always empty — and the events-stream prior for
dominant-driver analysis is always null. The March 2026 registry items
prove they once worked. This broke independently of the dead filing path
(fixed today) and the two failures masked each other.
**Fix shape:** rewrite both joins through the molecule box
(`moleculeCondSQL` with a value match, or the wellness streams' join
pattern) and extend the part-2 standing-guard test to force a spike and a
trend on the sandbox. This is the natural first fix — it completes today's
"the safety detectors work again" story.

### 1.2 The participant phone app is Wisconsin-only
`verticals/workforce_monitoring/poser_mobile.html:735` `SURVEY_LINK = 1`
(reset at `:835`, behavior-gated `=== 1` at `:1073` and `:1186`). The
Weekly Check-in tile — the app's primary button — requests survey 1, which
returns an EMPTY question list on wa_php/sandbox (no error: the endpoint
filters by tenant). Mini-PPSI and the distress auto-expand (answer ≥ 2 →
full 34) are dead on copied tenants. Also `:886-887`: hardcoded `/102`
normalizer + band cutoffs `34/54/74` bypass the per-tenant
`ppii_thresholds` sysparm (which is 35/55/75 — the client literals are
off-by-one even for Wisconsin). Fix pattern exists in the same file
(`showMobileBattery()` builds linkByCode from `/v1/surveys`).

### 1.3 Compliance Rules screen reads AND WRITES Wisconsin by default
`verticals/workforce_monitoring/compliance_rules.html:152`
`TENANT_ID = params.get('tenant_id') || '5'` — URL param only, ignores the
session; linked from `admin_settings.html:67` with no query string, so
every arrival is tenant 5. For a superuser (the role that runs standup and
demos — Bill) the param IS honored server-side: opening Compliance Rules
from a Washington context shows and **edits Wisconsin's live compliance
items**. Normal wa_php staff are saved by the session middleware by
accident.

### 1.4 The scoring-weight admin screens default to the wrong tenant, and saves land there
`admin_ppsi_section_weights.html:214` → `|| '5'` (Wisconsin);
`admin_ppii_weights.html:270` → `|| '1'` (Delta!). Tenant rides the URL
path (`/v1/tenants/${tenantId}/ppsi-section-weights`);
`server/scoring_admin.js:26-32` lets a superuser edit ANY tenant, and the
GET routes (`:40-45`, `:460`) have no read confinement at all. A superuser
in a fresh tab silently loads Wisconsin's weights and Save writes a new
current weight set ONTO WISCONSIN. Enabler to fix alongside: confine the
GETs.

### 1.5 The `|| 5` fallback family — 14 shared clinical screens
`clinic.html:189`, `dashboard.html:368`, `action_queue.html:182`,
`physician_detail.html:375`, `physician_portal.html:228`,
`intake_queue.html:138`, `compliance_member.html:111`,
`documents.html:104`, `registry_history.html:102`,
`notification_queue.html:158`, `affiliations.html:130`,
`admin_credentials.html:81`, `admin_settings.html:41`,
`admin_ppsi_section_weights.html:214`. sessionStorage is per-tab: any
bookmark/new tab/middle-click starts without tenant_id and the page
becomes Wisconsin — label/branding fetches go to tenant-5 paths even for
normal users; for superusers the whole page is Wisconsin data under WA
chrome. **The correct fix already exists in poser_mobile.html:723-733**
(redirect to login; its comment names this exact hazard) — it was applied
to one file and never propagated. Root-level files have ~60 `|| 1`
cousins (Delta) — same disease, lower priority (9.3).

### 1.6 Central time hardcoded where Washington is Pacific
- `clinical/custauth.js:505` — signal accruals stamped with
  `America/Chicago` dates in the SHARED clinical engine: a WA signal filed
  22:00–24:00 Pacific carries tomorrow's date into trends and the registry
  timeline.
- `pointers.js:19734` + `:29982` — notification delivery window defaults:
  a tenant with no `notification_delivery_config` row gets 07:00–21:00
  CENTRAL = 05:00–19:00 Pacific (no evening notifications, 5am pings
  possible). `tenant_standup.js:539` also defaults the copied tenant's
  timezone to Central when the caller omits it.
- `pointers.js:7391` — `program_tz = "America/Chicago"` literal returned
  by the buckets endpoint to every tenant.
Timezones are tenant data (the per-tenant source exists); these are
constants.

### 1.7 The sandbox has NO document types (verified: wi_php 9, wa_php 9, sandbox 0)
`document_type` was seeded per-tenant by migration v121, which ran before
the sandbox existed; the copier doesn't carry it. Uploads on the sandbox
cannot be classified — **the Aug 13 exploration party hits this if they
touch documents.** Same class: `document_access_rule` (v130 seeds
wi_php/wa_php by name). Fix: copier parts + a small backfill migration for
the sandbox (two-tenant rule does not apply — wa_php already has its 9).

---

## TIER 2 — copier and platform correctness (before the NEXT tenant, not necessarily before pilot)

### 2.1 The copier mis-remaps reward references and never copies their targets
`tenant_standup.js:445`: a tier/badge/token bonus result's
`result_reference_id` is looked up in the EXTERNAL ACTIONS map → miss →
written NULL (silent reward loss). `:488-490`/`:514-516`: promotion/MED
results copy the id RAW → cross-tenant pointer into Wisconsin's id space.
Legacy columns `bonus.required_tier_id` (`:437`) and
`promotion.reward_tier_id` (`:464`) copy verbatim. And the three target
tables (`tier_definition`, `badge`, `adjustment`) aren't copied at all —
not in the manifest, not in the deliberately-not-copied list. Workforce
blast radius today: low (the vertical computes its own color bands; no
badge/token results configured) — but this corrupts any future tenant with
real rewards.

### 2.2 Copier manifest structural gaps (the survey_question_answer class)
Verified state in parentheses:
- `molecule_group` + `molecule_group_member` — tenant-less children of
  molecule_def; back the IN GROUP / NOT IN GROUP criteria operators; the
  platform's own molecule-clone routine copies them, the tenant copier
  does not. (Verified: NO IN GROUP criteria exist on wi_php today — real
  gap, zero current blast radius.)
- `molecule_value_numeric`/`_date`/`_boolean` — the non-text static
  constant values; copier carries only `molecule_value_text`. (Verified:
  no static numeric/date/boolean molecule_defs on tenants 5/6/7 today —
  structural gap only.)
- `partner` + `partner_program` — v139 hand-wrote the sandbox's clinics
  instead of fixing the manifest; belongs as a content part so the
  verifier reports 0 loudly.
- `evaluator`, `network_entity`, `program_network_entry`,
  `redemption_rule` (+ tenant-less `redemption_point_type`),
  `alias_composite` (+ tenant-less `alias_composite_detail`) — per-tenant
  config with no manifest entry and no recorded not-copied decision.
- `survey_question_category` + `survey_question_list` — COPIED but not
  manifest parts, so `verifyTenantSetup` never counts them; a regression
  in either loop passes the standup gate green. (Directly load-bearing:
  today's protective-collapse fix joins categories by code.)
- Structural: the completeness gate counts only `REQUIRED_PARTS` — every
  gap above passes it green. The header contract ("every per-tenant table
  is in the manifest or the not-copied list") is violated by ~14 tables.

### 2.3 The encode door still cannot refuse the SURVEY_LINK mistake
`pointers.js:914-936` (`encodeValue`): a 'key'/'code' molecule handed a
negative (link_tank) id silently produces smallint overflow → bare 500.
`squish()` on a negative emits NUL bytes — the exact thing base-127
exists to prevent. A plain-English refusal (`value < 0` for offset
regimes → named error) turns the next v140-class bug into a first-write
refusal. The molecule-creation validator (`:16517`) could also probe the
referenced table's id origin and refuse at definition time.

### 2.4 The offset-regime census has blind spots — SURVEY_LINK's own shape slips it
`tests/core/test_tenant_standup_module.cjs:181-204` filters
`value_kind IN ('lookup','external_list')`, definition-level value_type,
column 1 only. It cannot see: value_kind `'value'` link-holders
(MEMBER_SURVEY_LINK's class), composite columns 2..N (PARTNER_PROGRAM col
2), or lookup rows with no table_name (dropped silently). (Verified live:
SURVEY_LINK, MEMBER_SURVEY_LINK, PULSE_RESPONDENT_LINK, COMP_RESULT are
all `numeric` on all three workforce tenants today — no live offender —
this is about the guard, not a live bug.)

### 2.5 Seeders and tools still carrying Wisconsin
- `bootstrap/seed_physicians.js:53` — `survey_link: 1` (the un-fixed
  sibling of the v140 family; resolve by code).
- `bootstrap/seed_pulse_events.js:16-18` — tenant 5 + Pulse link 2 +
  positional wi_php question links; no tenant argument.
- `verticals/workforce_monitoring/ml_report.js:14` — `TENANT_ID = 5` in
  the shared vertical folder; "the ML report" can only ever describe
  Wisconsin, silently.
- `pointers.js:27004-27025` — data-loader tier patterns hardcode Delta
  tier ids but run against any operator-selected tenant.

---

## TIER 3 — hardening, hygiene, latent landmines

- **`startPPSI()` dead door** — `survey-take-modal.js:126`
  `PPSI_SURVEY_LINK = 1`, exported, zero callers; the obviously-named API
  the next page will reach for. Delete it or make it delegate to
  `startByCode('PPSI')`.
- **Hand-rolled offset copies** — `pointers.js:20512-20542`
  (`getMemberBadgeOnDate`: raw 5_data SQL + second copy of the +32768
  rule); `db_migrate.js:2739-2741` (partner/program encode; safe, note
  only); `pointers.js:1776-1807` (`updateMoleculeRowByTable`: dead helper
  that would write 'key' columns RAW — a pre-built regime mismatch, no
  callers; delete or fix before adoption).
- **Truthiness as link-existence** — `physician_detail.html:1135,1141`,
  `pointers.js:32425`, `COALESCE(key_ref, 0)` in
  `SQL/alter_member_alias_add_key_molecule.sql` — 0 is a legal link_tank
  value; "if (link)" is the wi_php habit. Low urgency (2-byte tables are
  32k allocations away from 0).
- **Ascending link as curated order** — `server/meds.js:111,124`,
  `server/instruments.js:54` `ORDER BY link`: on wi_php that's the
  instrument catalog order; on copied tenants it's copier walk order.
  Portable version is a display_order or code-driven sort.
- **`performance_profile.html:333-336`** — public no-login page scores on
  a hardcoded snapshot of wi_php's weights/bands (admitted in its own
  comment). Demo-contained; tenant-blind by design — Bill's call.
- **Cosmetics** — poser_mobile greets "James Mitchell" without context
  (`:742-743`); `affiliations.html:106` placeholder "e.g. UW Health";
  `dashboard.html:180` evaluator-directory link 400s from a fresh tab
  (empty `t=`), and uses tenant_id where the sibling uses tenant_key.
- **`GET /v1/tenants/:id/ppii-weights` + `/ppsi-section-weights`** — no
  read confinement (any authenticated user reads any tenant's clinical
  weights). Fix with 1.4.
- **Platform `debug` sysparm stored under tenant 1** (`pointers.js:20875`,
  `:25864`) — platform config elsewhere lives in tenant 0. Consistency
  nit.

## STANDING GUARDS THE AUDIT RECOMMENDS (the "make it a build failure" list)

1. Lint rule: numeric literal assigned to a `*_link` / `*_id` name outside
   db_migrate.js → fail. Would have caught all five of the S160-162
   family at write time.
2. Lint rule: `tenant_id`-ish expression `|| <literal>` in client pages →
   fail (the poser_mobile redirect is the blessed pattern).
3. Census upgrade (2.4): cover value_kind 'value', columns 2..N, report
   un-auditable rows loudly.
4. Encode-door sign guard (2.3): offset regime + negative value = named,
   plain-English refusal.
5. One parameterized UI-test run of the daily clinical screens against the
   SANDBOX tenant (every current UI test pins tenant 5; none can catch a
   copied-tenant regression). Lens B lists the exact tests.
6. Manifest contract check: a test that diffs `REQUIRED_PARTS` + the
   not-copied list against actual per-tenant tables in the schema, so a
   new table cannot be silently absent from both (the survey_question_answer
   signature, structurally).

## CLEARED — verified non-findings (do not re-chase)

- `5_data_*` table names — the digit is parent link byte width, not
  tenant 5.
- `MEMBER_SURVEY_LINK` / `PULSE_RESPONDENT_LINK` / `COMP_RESULT` /
  `SURVEY_LINK` regimes — all `numeric` on all three workforce tenants
  (verified live).
- All migration-created 'key' molecules (BAD_EMAIL/BAD_PHONE,
  LICENSING_BOARD, BONUS_RESULT, EVALUATOR) are SERIAL-backed — correct.
- `tenant_id = 0` in network directory / IHS surfaces — deliberate shared
  pool, not a Wisconsin-ism.
- Clinical scale constants (102/100 PPSI math, Provider Pulse 42, PROMIS
  table) — instrument properties, not ids.
- Static file serving, custauth/clinical module loading, evaluators `?t=`
  resolution, meds.js/instruments.js survey_code lookups — all data-driven.
- wi_php mentions in comments/build notes — no branching.
- No IN GROUP criteria configured on wi_php; no static numeric/date/boolean
  molecules on tenants 5/6/7 (so 2.2's first two gaps have zero CURRENT
  blast radius).
- `audit_entity_type` not copied — self-heals on demand (`pointers.js:1962`).

---

*Lens transcripts (full detail beyond this summary) are session artifacts;
this document is the durable record. Next step: Bill ranks; the
recommended first fix is 1.1 (it completes the Session 162 story and its
standing guard is already half-built).*
