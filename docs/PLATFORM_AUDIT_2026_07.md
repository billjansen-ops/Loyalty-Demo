# Platform Audit — 2026-07-10 (Session 137)

**Why:** after the link-collision defusal, Bill asked for a systematic hunt for
anything else of the same species — assumptions that hold today and break with
growth, in a system whose defining failure mode is *silence*. Five read-only
audit passes ran in parallel (growth horizons, row identity, silent defaults,
cleanup completeness, concurrency perimeter). Every load-bearing claim below
was **verified by hand against live code/schema** before being recorded; items
marked (verified) were confirmed directly, others are agent-reported with
file:line evidence.

**Verdict: nothing fundamental.** Redemption double-spend is genuinely
protected (verified). Only two silent boundaries exist platform-wide;
everything else fails loudly at its ceiling. The findings below are
guard-before-real-data work, ranked.

---

## TIER 1 — fix before real data (next session's opener)

### 1.1 The accrual path's member lock does not hold (verified)
`pointers.js:17581` — `createAccrualActivity` issues
`SELECT … FOR UPDATE` **on the pool** (`dbClient` is a `pg.Pool`), so the lock
is a single autocommit statement: acquired and released instantly. The comment
above it states the design intent ("lock member record to prevent concurrent
modifications") — the mechanism just doesn't deliver it. The route
(`POST /v1/members/:id/accruals`, ~17726) opens a real transaction but wraps
only validation + PRE_ACCRUAL; the accrual writes (bucket, activity, molecule
rows, points, bonus/promotion evaluation) all run on the pool outside it.

**Redemption (19552) and adjustment (20158) do it RIGHT** — their `FOR UPDATE`
runs on the transactional client and is held to COMMIT (verified). The fix is
to give accrual the same plumbing: lock on the route's client, and move the
writes inside the held transaction (which also makes accrual crash-atomic —
today a mid-way failure leaves earlier writes committed).

**Consequences today:** two concurrent accruals on one member can create
duplicate point buckets — `member_point_bucket` has **no unique index on
(p_link, rule_id)** (verified; `idx_member_point_bucket_rule` is non-unique) —
and can double-fire bonuses/promotions. Point *amounts* are protected by
atomic `x = x + $1` increments; derived/gating state is not.

Related hardening while in there: a unique index on
`member_point_bucket (p_link, rule_id, expire_date?)` (confirm the natural key
first) and on `member_promotion (p_link, promotion_id)` (verified absent) so
the invariants the code assumes become database-enforced.

Also documented in-code at `pointers.js:~27985`: the survey-submit path
already met a self-deadlock caused by lock-on-one-connection /
writes-on-another — same root, fixed there as a workaround.

### 1.2 ~50 "no tenant? assume Delta" defaults (verified pattern)
`req.tenantId || 1` and variants throughout pointers.js. Middleware
(`pointers.js:2407`) leaves `req.tenantId` null for a superuser with no
selected tenant; every `|| 1` then silently routes the request to tenant 1.
Reads = cross-tenant data served; writes = data misfiled into Delta
(member create 8038, partner activity 20040, adjustment 20144, member
molecules PUT 7831, profile PUT 7615, sysparm writes 5310/25533/25473, badge
5973/6026, tiers 7413/7452/7501, bonus delete 10669, tier delete 12140,
display/input template writes 18728/18852/18906/19297/19350, calc endpoints
18006/18050; read list in the audit transcript). Also `evaluateBonuses`
falls back to tenant 1 when its activity lookup returns no row
(15893/15903) — Delta's bonus rules applied to an unresolvable activity.

**Fix template already in the repo:** every workforce_monitoring module uses
`if (!tenantId) return res.status(400)`. Apply it to the write list first,
then reads. Mechanical but ~50 sites — its own focused pass.

### 1.3 membership_number trusted as unique, not enforced (verified)
No unique constraint exists on `(tenant_id, membership_number)` — only a
non-unique index. `resolveMember` (pointers.js:5244) + 67 call sites and
several inlined copies (25800/25864/25919, scoring_history.js:45/118,
exports.js:185) all take `rows[0]` on trust. Zero duplicates exist today
(verified). Fix: `UNIQUE (tenant_id, membership_number)` via db_migrate —
the trust the code already places becomes true forever.

### 1.4 Notification routing by display_name, no tenant filter (agent, code quoted)
`pointers.js:16332` and `:16345` (fireNotificationEvent) resolve the
recipient login by `display_name = …` with **no tenant filter** and LIMIT 1 —
unlike the sibling role queries which correctly scope tenant. Two logins
sharing a name (or the same name across tenants) → a clinical alert delivered
to an arbitrary/wrong login. Fix: resolve by user_id/link, tenant-scoped;
display_name is a label, not an identity.

---

## TIER 2 — real, lower urgency

- **MEDS pipeline swallows failure** — `processMedsForMember`
  (meds.js:803) returns a success-shaped object after ROLLBACK; callers
  (meds.js:110 check endpoint, :389 daily scan) report success for a failed
  compliance run. Also missed-survey registry creation (meds.js:635) and
  `calculateMedsNextDue` (meds.js:522, awaited by instruments.js
  120/168/196) log-and-continue. Compliance signals can silently not fire.
- **Check-then-act windows (no lock, no constraint):** promotion enroll
  (21987 — double-enroll possible, see 1.1 constraint), member-molecules PUT
  (7825 — per-molecule DELETE-then-INSERT, no txn; two CSRs can duplicate or
  lose a value), clinician assign (clinicians.js:45), ML score upsert
  (28887ish), badge add (5964 bare insert). Flags/aliases/link counter are
  atomically safe (verified patterns).
- **deleteAllMoleculeRowsForLink stale table list** (pointers.js:~1701) —
  misses 5_data_0/22/222/24/2242 + 4_data_1/4_data_12; lists nonexistent
  5_data_2244 (throws + swallowed every call). Only caller = alias delete.
  Fix: derive the table set from pg_class, not a literal list.
- **Error-shaped-as-data catches:** exports.js:77/164 blank the assigned-
  clinician column on error (roster reads as unattended); licensing.js:112
  returns `licensing_board: null` on DB error; registry.js:146/161
  notification fires swallowed; registry.js:280 audit diff → [].
- **ML baseline phantom zeros** — ml_features.js:209 `s[domain] || 0` folds
  missing section scores into the baseline as real zeros; exclude instead.
- **Cache reload window** — loadCaches clears then awaits while repopulating;
  a request mid-reload can read an empty map. Single process today; becomes
  per-dyno staleness if Heroku ever scales past one dyno (also
  entityCodeCache cross-process minting — revisit before scaling).

## TIER 3 — housekeeping

- 26 orphaned activity-side molecule rows (pre-soft-delete residue; junk not
  bombs — link values never reused, side filter hides them; sweep via
  migration).
- audit_entity_type 1-byte code space **wraps silently** at ~126 (at 8 now,
  slow growth; one of only two silent boundaries left — the other is the
  shared 5-byte link space, guarded since Session 137). Consider merging it
  into the entity registry someday (open question in the design doc).
- PPSI/Pulse "latest score" reads (custauth.js:107/:122) lack the
  `, a.link DESC` same-day tiebreaker their siblings have.
- member_number counters on tenants 1/3 are past INT32 — safe as BIGINT, but
  grep before ever handing them to 4-byte consumers.
- Migration seeds resolving members by first-name-only / last-name-only
  (db_migrate 405/691/3867) — pair (fname,lname) + assert single row in any
  future seed.
- proveMoleculeRoundTrip cleanup `.catch(() => {})` (13627) → log on failure.

## Confirmed healthy (for the record)

Redemption serialization + inventory locking (verified); atomic point
increments; flag door / alias uniqueness / link allocator all race-safe;
zero member/user/alias orphans; FK-protected families clean; every counter
far from its ceiling; dates good to ~2138; no sequence/column mismatches;
tenant-isolation regression tests + fail-closed vertical modules.

## Standing guards worth adding (process, not fixes)

- A lint/suite rule: any new query against `[0-9]_data_` tables must carry an
  attaches_to filter (there is no DB backstop — the side filter IS the
  safety).
- The "second kind of X is a design event" rule → BEFORE_YOU_WRITE.
- The horizon census as a standing test that reddens when any code/counter
  space passes 80% or a boundary is silent.
