# HANDOFF — read this first

This is the entry point for any new AI assistant working on this codebase.
It is short on purpose. Read it end to end before touching any file.

---

## What this is

**Pointers** — a multi-tenant loyalty / engagement platform. Built across
126+ sessions, owned by **Bill Jansen**. Bill does not write code; the AI
assistant does. Everything below exists because rules were broken in past
sessions and Bill burned days fixing the fallout.

Five tenants live in one database with `tenant_id` separation:

| Tenant   | Vertical            | What it is |
|----------|---------------------|---|
| delta    | airline             | The reference Delta SkyMiles demo |
| united   | airline             | Second airline (less depth) |
| marriott | hotel               | Hotel example |
| ferrari  | automotive          | Automotive example |
| wi_php   | workforce_monitoring | "Insight" — a healthcare workforce-monitoring app built on the platform for Wisconsin Physician Health Program. Most active development tenant. |

The platform is **temporal-first** (balances derived from events, never
stored), **molecule-driven** (tenant-specific fields go through an
abstraction layer instead of new columns), and uses **5-byte base-127
encoded link IDs** instead of integer PKs.

---

## Read these before writing any code

In this order:

1. **[docs/BEFORE_YOU_WRITE.md](docs/BEFORE_YOU_WRITE.md)** — canonical
   date helpers, fetch patterns, save-flow rules, and the
   anti-patterns the platform has been bitten by repeatedly. Not
   suggestions — rules.

2. **[docs/LOYALTY_PLATFORM_ESSENTIALS.md](docs/LOYALTY_PLATFORM_ESSENTIALS.md)**
   — the platform rules document Bill maintains. The §-numbered sections
   are referenced by name throughout the codebase.

3. **[docs/LOYALTY_PLATFORM_MASTER.md](docs/LOYALTY_PLATFORM_MASTER.md)**
   — full architecture: temporal model, molecule system, link system,
   tenant separation, audit layer.

4. **[STATE.md](STATE.md)** — what's deployed, what's pending, what's
   fragile right now.

5. **[WORKFLOWS.md](WORKFLOWS.md)** — commit/test/deploy mechanics.

After those five, the working file you'll spend the most time in is
**`pointers.js`** (~30k lines, the platform server). It has a rolling
`BUILD_NOTES` string at the top — that's a per-session narrative log,
not authoritative documentation.

---

## Rules that have been broken before (so they're rules)

If a shortcut feels tempting because it's easier, it's the same
shortcut a past session took. The rule is the rule.

- **Dates.** Use `dateToMoleculeInt` / `moleculeIntToDate` /
  `platformToday` / `platformTodayStr` from `pointers.js`. Never
  `Math.floor((local - local) / 86400000)`. Never `new Date('YYYY-MM-DD')`.
  Never `.toISOString().split('T')[0]`. See `docs/BEFORE_YOU_WRITE.md`.
- **Fetches.** Every `fetch()` must check `r.ok` before `.json()`. Silent
  failures become "Saved successfully!" alerts over broken saves.
- **Saves.** Never destructively delete-then-reinsert child rows when
  their IDs are referenced anywhere (audit, molecules, foreign keys).
  Use diff-based save (DELETE removed / PUT existing / POST new). See
  `admin_bonus_edit.html` `saveBonus()` for the canonical implementation.
- **Links.** Allocate new link IDs only via `getNextLink()`. Never raw SQL.
- **Today.** Get "today" only via platform date functions. Not
  `new Date()`, not `Date.now()`, not `toISOString()`.
- **Molecule tables.** Never run direct SQL against `member_molecule`
  or `member_molecule_history`. Use the helpers.
- **Tier joins.** Never raw-JOIN `member_tier`. Use
  `get_member_current_tier()`.
- **Schema.** All DB changes go through `db_migrate.js`. Never direct
  DDL. Migrations resolve members by **name**, not membership_number,
  because Postgres sequences diverge between local and Heroku.
- **`pointers.js` edits.** Always bump `SERVER_VERSION` (top of file),
  update `BUILD_NOTES`, and restart the server. Bumping without
  restarting means Bill tests against old code.
- **Platform-shared files.** Files at the project root are loaded by
  every tenant. They must not reference specific verticals, specific
  tenant-only molecule names, or specific tenant labels. Tenant-specific
  pages and assets live in `verticals/{vertical_key}/` or
  `verticals/{vertical_key}/tenants/{tenant_key}/`.

Run `node tests/lint-anti-patterns.cjs` after any change. The expected
result is **0 matches**. Any non-zero count means you added or
reintroduced a platform anti-pattern.

---

## Bill's working style

- **Plain English, never jargon.** "Save permanently to GitHub" beats
  "push to origin." If you find yourself reaching for vocabulary, you're
  probably about to lose him.
- **He doesn't manage git or Heroku.** The assistant commits, pushes to
  `origin/main`, and pushes to Heroku **on explicit go each time**. CI
  green is the gate before any Heroku push.
- **Yes/no questions get yes/no answers.** Don't lay out a buffet of
  options when he asked for a recommendation.
- **Discuss first, code second.** Don't start writing until he says go.
  This is in his memory file for a reason.
- **"Stop!" / ALL CAPS / swearing = serious mistake.** Don't defend, don't
  explain what went wrong — fix it.
- **"b" = scrolling, keep waiting.** Not a command.
- **"Cars are for Today" = end of session.**
- **Don't ask him things you can find in the code or DB.** Search first.

Frustration signals (real list from past sessions, watch for these):
"Stop!", "What are you doing?", "Why would you ask me that?", ALL CAPS,
profanity, repeated short questions in a row. Each one means: you've
already gone wrong; pause and figure out what before doing anything else.

---

## Authority — what to do without asking, what to ask first

**Do without asking:**
- Read files, run queries against the local DB, run tests, run the lint.
- Edit code locally and run it locally.
- Commit to your local branch.

**Ask first:**
- Pushing to GitHub (`origin/main`).
- Pushing to Heroku.
- Any `git reset --hard`, `git push --force`, branch deletion, or anything
  destructive.
- Adding new top-level dependencies.
- Schema changes (these go through `db_migrate.js`, but the design
  decision is Bill's).
- Anything that would touch the wi_php (Insight) tenant's data — Erica
  is using that data day-to-day.

Bill does not create branches. There is one branch: `main`. Don't make
worktrees. Don't make feature branches. Direct commits to `main` with
clear session-tagged commit messages are the workflow.

---

## When you're stuck

- Read the docs again. Most "I don't know how this works" questions have
  an answer in `LOYALTY_PLATFORM_ESSENTIALS.md` or `LOYALTY_PLATFORM_MASTER.md`.
- Search the codebase. The DST bug existed in 7 places because nobody
  grepped before writing a new helper.
- If a pattern feels familiar, it already exists. Find it before
  reinventing.
- If you're truly stuck, ask Bill **one** specific question. Not three.
  Not a buffet.

The single biggest failure mode of past sessions: **shipping the easy
answer when the analysis says do the harder thing.** If you catch
yourself rationalizing why a shortcut is okay, stop.
