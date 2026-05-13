# Session 113 Handoff

**For the next session.** Read this before doing anything.

## 0. Platform context (before anything else)

This is the **Pointer loyalty platform** (`~/Projects/Loyalty-Demo`). Multi-tenant. Tenants include Wisconsin PHP (`wi_php`, workforce monitoring / clinical), Delta (airline), Marriott (hotel), etc. Bill (the user) is the owner. Bill does NOT write code — Claude writes all code.

**Before doing anything else:**
1. **Invoke the loyalty-platform skill** (`anthropic-skills:loyalty-platform`) — carries the critical rules (molecules, helper functions, no direct SQL, db_migrate-only for DB changes, etc.). The system reminder triggers it automatically when you touch any platform file, but invoking it explicitly at session start makes the rules active in context immediately.
2. **Read `docs/LOYALTY_PLATFORM_ESSENTIALS.md`** — the canonical rules doc. Especially the molecule system, helper functions, and "NEVER do these" / "ALWAYS do these" sections.
3. **Read the memory files** at `~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/` — they auto-load each session but skim them so you know the patterns. Especially: `feedback_session113_failure_pattern.md` (lessons from this session — context-degradation + "answer the easier question").
4. **Read `project_current_work.md`** in the memory folder — current deploy/pending state.
5. **Read this handoff**.

Critical platform rules (subset of the skill):
- NEVER write SQL directly against molecule storage tables — always use helpers
- NEVER allocate links with raw SQL — always use `getNextLink()`
- NEVER raw JOIN to `member_tier` — use `get_member_current_tier()`
- NEVER invent new ways to get "today" — use `platformToday()` / `platformTodayStr()` / `dateToMoleculeInt()`
- ALL DB changes go through `db_migrate.js` as a new version step — no direct SQL for schema or seed data
- When modifying `pointers.js` always bump `SERVER_VERSION` and `EXPECTED_DB_VERSION` (latter only if DB version changed)
- Test locally; CI green is the gate before any `git push heroku main`
- Bill's password (local: `ferrari308`) — NEVER touch. Use Claude account (`Claude` / `claude123`) for testing.

## ⚠️ How the prior session ended

The prior Claude (me) was instructed to investigate a routing bug, and instead:
- Claimed to understand the design multiple times when he didn't
- Found ONE slice of the design (the static-file middleware) and called that "the design"
- Proposed restoring just the root fallback page — which would have made the ONE working tenant (Wisconsin) look broken
- Over-explained every confirmation instead of just answering
- Triggered Bill to type STOP, NO, and "fuck you" repeatedly before declaring the session worthless

Do not repeat this. When Bill says "do you understand the design," **trace the full chain end-to-end before claiming anything**. When he says "look at your code," look at all of it — not the first piece that seems relevant.

---

## What's deployed and working — DO NOT REDO

Erica's feedback (round 2) is fully shipped:
- Heroku **v71**, DB **v65**
- Profile Update Log moved off the activity timeline → now on the profile page (csr_member.html) via new `/v1/member/:id/profile-log` endpoint
- "Edit Profile" button on participant chart (physician_detail.html)
- "Previous PPSI" sub-line under Last PPSI card + dashed purple cutover marker on trend chart (mirrors Previous PPII)
- "Notes" filter renamed to "With Notes"
- Recalculate Member Scores returns drill-down `members[]` with old → new → Δ, sorted by largest |Δ| first
- Sliders removed from PPII + PPSI weights pages (number input + read-only bar)
- "PPSI Question Score 3" renamed to "PPSI Severe Item Response" (v65 migration)
- CI green on commit `9b83d9a` (latest is `9b83d9a` — verify before push)
- Full suite: 41 tests / 863 assertions

**Email reply to Erica** is drafted at `docs/ERICA_FEEDBACK_REPLY_SESSION_113_ROUND2.md` but **NOT YET SENT**. Bill is going to send it when he's ready.

---

## Member Demo Site routing — FIX APPLIED LOCALLY, not committed/pushed/deployed

### Design (verified by reading the code, end-to-end)

When a superuser logs into menu.html and selects a tenant, then clicks "Open Member Demo Site," the platform is supposed to serve **that tenant's member-facing demo page** — or an "Under Construction" default if the tenant hasn't built one yet.

The mechanism uses the existing three-tier static-file middleware in `pointers.js` (around line 7200). For a request to `/index.html`, the middleware walks:

1. **Tenant-specific**: `verticals/{vertical_key}/tenants/{tenant_key}/index.html`
2. **Vertical-shared**: `verticals/{vertical_key}/index.html`
3. **Project root**: `/index.html` (the "Under Construction" default for everyone else)

It serves whichever exists first. **No new server logic needed** — the routing already works.

### Chain trace (read-only verification done)

| Step | Where | Status |
|---|---|---|
| 1. Button | `menu.html` line ~110: `<a href="index.html">Open Member Demo Site</a>` | ✅ exists |
| 2. Tenant selection | `Auth.setTenant()` in `auth.js` line 144 → POST `/v1/auth/tenant` | ✅ works |
| 3. Server stores tenant | `pointers.js` line 25154: `req.session.tenantId = tenantId` | ✅ works |
| 4. Request arrives | `GET /index.html` | — |
| 5. Tenant resolution | `pointers.js` line 1661: `req.tenantId = req.session?.tenantId \|\| ...` | ✅ works |
| 6. Three-tier lookup | `pointers.js` line 7205 middleware | ✅ logic intact |
| 7. **Files at each tier** | | ❌ **all three missing** |

```
Tier 1: verticals/workforce_monitoring/tenants/wi_php/index.html  — MISSING
Tier 2: verticals/workforce_monitoring/index.html                 — MISSING
Tier 3: /index.html                                               — MISSING
```

### The bug, plainly

The routing chain works. **The files those tiers serve don't exist.** Was the issue — now resolved locally.

### Fix applied locally (3 changes — NOT committed/pushed/deployed)

1. **New file**: `verticals/workforce_monitoring/tenants/wi_php/index.html` — Wisconsin's Tier 1 override. Contains a meta-refresh + JS redirect to `verticals/workforce_monitoring/dashboard.html` (same destination Erica's login routes to).
2. **New file**: `index.html` at the project root — the generic "🚧 Under Construction" page with a Back-to-Menu link. Tier 3 fallback for tenants without their own.
3. **One-line edit** in `pointers.js` line ~7231: `app.use(express.static(__dirname, { index: false }));` — the `{ index: false }` option prevents `express.static` from auto-serving the root `index.html` on `/` directory requests (which would have hijacked the existing `app.get('/')` → `/login.html` redirect for the root URL).

Verified locally via curl:
- Wisconsin session → `GET /index.html` serves Wisconsin's Tier 1 redirect file → browser auto-redirects to dashboard
- Delta (or any non-wi_php) session → `GET /index.html` falls through to Tier 3 → "Under Construction" page
- `GET /` → 302 redirect to `/login.html` (original behavior preserved)

### What the new session needs to do

1. Confirm the fix is what you want (read the 3 files, walk through the chain once mentally)
2. Optionally add a test for the routing (none exists yet)
3. Commit + push to GitHub
4. Wait for CI green
5. Push to Heroku **only on Bill's explicit go-ahead** (this is a hard rule — see `feedback_deploy_before_email.md`)
6. Smoke-test on Heroku

### What NOT to do

- Do NOT rewrite the fix from scratch. It's working locally. Validate it; don't redesign it.
- Do NOT spelunk git history. The design is in the current code (the trace above).
- Do NOT propose new routing logic — the middleware already does it.
- Do NOT conflate Erica's CSR dashboard (`verticals/workforce_monitoring/dashboard.html`) with the Member Demo Site button destination. They converge on the same URL via two access paths.
- Do NOT touch passwords or auth.
- Do NOT deploy without explicit go-ahead from Bill.

---

## Working rules for Bill (loyalty-platform)

- **Stop means stop.** When Bill says STOP, NO, or swears, fully halt and acknowledge — don't keep moving
- **Don't claim understanding before tracing the full chain.** Saying "yes I understand" then producing a partial fix is worse than slow
- **Restore before rewrite.** If something used to work, find the prior version, don't recreate from scratch
- **No db_migrate needed for this bug** — it's file-restore, no schema
- **Don't deploy without explicit go-ahead.** "Deploy before email" is a hard rule; "deploy without permission" is a different hard rule on the opposite side
- **CI green is the gate before `git push heroku main`**
- Bill's password (local: `ferrari308`) — NEVER touch it. Use Claude account (`Claude` / `claude123`) for testing

---

## Suggested first actions for next session

1. Read this file
2. Read `LOYALTY_PLATFORM_ESSENTIALS.md` and the relevant memory feedback files at `~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/`
3. Confirm with Bill the order of work — likely: (a) restore the two missing index.html files, (b) verify on Heroku, (c) then move to anything else
4. Do not propose, summarize, or "set the stage" — Bill wants action, not narration

End of handoff.
