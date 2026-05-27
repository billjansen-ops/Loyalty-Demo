# WORKFLOWS — how to commit, test, and deploy

The mechanics of working on this codebase. Follow these exactly.

---

## Local development

### Start the server

```bash
bash bootstrap/start.sh
```

This kills any process bound to the server port, starts `pointers.js`
locally, and waits for it to be reachable. Local URL is whatever the
script reports.

**Restart the server after every edit to `pointers.js`.** A `SERVER_VERSION`
bump without a restart means Bill tests against old code — which is how
"the fix doesn't work" arguments start.

### Database

Local Postgres, accessed as:

```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

Bill prefers SQL run through that wrapper format. If you ever need to
hand him SQL to run, paste it as a single `psql -c "..."` line he can
copy.

Notes:
- Local DB user and DB name: `billjansen`, `loyalty`.
- The DB has `tenant_id` columns everywhere — always filter by
  `tenant_id` when querying or you'll cross tenant boundaries.
- Bill epoch dates: SMALLINT days since 1959-12-03. Don't construct
  these by hand — use `dateToMoleculeInt` / `moleculeIntToDate` from
  `pointers.js`, or the SQL functions `date_to_molecule_int(date)` /
  `molecule_int_to_date(integer)`.

---

## Tests

### Full suite

```bash
node tests/run.cjs
```

What it does:
1. Verifies the local server is running.
2. Takes a `pg_dump` snapshot of the DB.
3. Sets up the Claude test user (a superuser used by the harness).
4. Runs every test in `tests/manifest.json`.
5. Restores the DB from the snapshot.

The snapshot/restore means tests are destructive but isolated — they
mutate the DB then roll it back. Don't run them against a DB whose
state you care about.

### Single test

```bash
node tests/run.cjs insight/test_ppii_weights.cjs
```

Pass the path relative to `tests/`. The path must match `tests/manifest.json`.

### Anti-pattern lint

```bash
node tests/lint-anti-patterns.cjs
```

Report-only. Baseline is **32 matches**. Run after every change. Any
count above 32 means you added a new anti-pattern — fix before
committing.

---

## Git workflow

There is one branch: **`main`**. No feature branches. No worktrees.

### Commit message format

```
Session NNN: <theme> — <specifics>

<multi-paragraph body explaining what changed and why>

<key facts at the bottom, e.g.:>
EXPECTED_DB_VERSION 78.
SERVER_VERSION 2026.05.27.0200.

Co-Authored-By: <Tool> <noreply@anthropic.com>
```

The session number comes from the chat title or Bill's instruction —
never guess.

### Use HEREDOC for commit messages

Multi-paragraph commit messages must be passed via HEREDOC to preserve
formatting:

```bash
git commit -m "$(cat <<'EOF'
Session 127: <theme> — <specifics>

<body...>

Co-Authored-By: <Tool> <noreply@anthropic.com>
EOF
)"
```

Single-quoted heredoc (`<<'EOF'`) prevents shell expansion. Important
because commit bodies contain `$` and backticks.

### Staging

Prefer explicit paths over `git add -A` or `git add .`. The repo
accumulates untracked PDFs, `.docx` files, Python caches, and IDE
scratch directories that shouldn't be committed.

Pattern:

```bash
git add -u                              # stage modifications + deletions to tracked files
git add path/to/new/file1 path/to/new/file2  # explicit list of new files
git diff --cached --stat                # verify what's staged before commit
```

### What never to commit

- `ml/__pycache__/` (Python bytecode)
- `.claude/test-snapshots/` (assistant scratch)
- `.claude/launch.json`, `.claude/settings.json` (assistant config)
- `*.docx`, `*.xlsx`, `*.pdf` in tenant directories (Bill's working
  documents)
- Anything in `Bill/` at the repo root (Bill's drop folder)

### What is fair to commit

- Code changes
- Migrations
- `*.md` documentation in `docs/` or tenant `verticals/.../tenants/.../`
  build-notes
- Build notes updates (always update Insight Build Notes after
  Insight work)

---

## Deploy

**CI green is the gate.** Don't push to Heroku until CI passes on the
commit you're about to deploy.

### Step 1 — push to GitHub

```bash
git push origin main
```

### Step 2 — wait for CI

```bash
gh run list --branch main --limit 1
gh run watch <run-id> --exit-status
```

If CI fails, **fix the failure before doing anything else**. Don't
push to Heroku with red CI. The rule exists because tests catch real
problems — see Session 126 hotfix for the canonical example.

### Step 3 — push to Heroku (only on Bill's explicit go)

```bash
git push heroku main
```

The Heroku build runs `npm install` and then the deploy is "released."

### Step 4 — run migrations on Heroku

If `EXPECTED_DB_VERSION` in the new code is ahead of the Heroku DB,
the dyno will hard-fail at boot. You **must** run migrations after the
push:

```bash
heroku run --app hdwhf "node db_migrate.js"
```

This applies any unapplied migrations in order. The script is idempotent
— it skips already-applied versions.

### Step 5 — restart and verify

```bash
heroku restart --app hdwhf
sleep 10
heroku ps --app hdwhf
```

The dyno should be `up`. Then check the version endpoint:

```bash
curl -s https://hdwhf-6e6c604bb3f3.herokuapp.com/v1/version
```

Confirm `version` matches the `SERVER_VERSION` you just shipped.

### Step 6 — spot-check

Open the relevant page in a browser and click through the feature you
shipped. Heroku is dev/demo, but it's still a real deployment — silent
breakage there gets caught by Bill (who is the user), not by tests.

---

## Migrations

All DB changes go through `db_migrate.js`. Never run direct DDL.

### Pattern

Each migration is a numbered block in `db_migrate.js` with:
- Version number (sequential, no gaps).
- One-line description (used by the runner for logging).
- An async function that takes a `client` and runs the statements.

The runner records applied versions in a `schema_version` table.

### Rules

- **Append-only.** Never edit a previously-applied migration. If you
  need to fix a past migration, write a new one that corrects the
  state.
- **Idempotent where possible.** `IF NOT EXISTS`, `ON CONFLICT DO
  NOTHING`, etc.
- **Resolve members by name, not ID.** Postgres sequences diverge
  between local and Heroku. A member with `id = 46` locally might be
  `id = 53` on Heroku. Use `SELECT id FROM member WHERE name = '...' AND
  tenant_id = ...`.
- **Bump `EXPECTED_DB_VERSION` in `pointers.js` whenever you add a
  migration.** The boot check will hard-fail any environment whose DB
  is behind.

---

## Useful one-liners

```bash
# What's currently on Heroku
heroku releases --app hdwhf --num 3
heroku run --app hdwhf "node -e 'console.log(process.env.EXPECTED_DB_VERSION || \"unknown\")'"

# What's currently in DB version locally vs Heroku
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT MAX(version) FROM schema_version"
heroku pg:psql --app hdwhf -c "SELECT MAX(version) FROM schema_version"

# Tail Heroku logs
heroku logs --app hdwhf --tail

# What changed in a recent commit
git show HEAD --stat
git show <commit-sha> -- path/to/file.html

# Find usages before writing a new helper
grep -rn "functionName\|patternFragment" --include="*.js" --include="*.html"
```

---

## When CI fails

1. Read the failed log: `gh run view <run-id> --log-failed | tail -100`.
2. Identify the failing test by name.
3. Run that single test locally to reproduce:
   `node tests/run.cjs <path/to/test.cjs>`.
4. Fix either the test or the source. **Be honest about which is wrong.**
   Sometimes the test is out of date (file moves, renames). Sometimes
   the source is wrong. Don't update a test just to make it green if
   the source is actually broken.
5. Commit the fix with a "Session NNN hotfix: ..." subject.
6. Push, wait for CI green, then continue with the original deploy.
