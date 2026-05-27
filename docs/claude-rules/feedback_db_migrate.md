---
name: Database changes go through db_migrate.js
description: All schema/DB changes must go through db_migrate.js — never run DDL directly. Pointers.js checks migration version on startup and won't start if out of sync.
type: feedback
---

ALL database changes — schema (CREATE, ALTER, DROP) AND data (INSERT, UPDATE, DELETE) — must go through db_migrate.js. Never run any SQL that modifies the database directly. No exceptions, no matter how small the change seems.

**Why:** Heroku is always behind local. Direct SQL only fixes local and won't apply on deploy. db_migrate ensures every change is reproducible and applies everywhere.

**How to apply:** When adding a migration:
1. Add the migration step to db_migrate.js with the next version number
2. Bump `TARGET_VERSION` in db_migrate.js
3. Bump `EXPECTED_DB_VERSION` in pointers.js (these two MUST stay in sync)

Even a one-row UPDATE gets a migration. The migration runs automatically on deploy.

**Deploying to Heroku:** Push to both remotes (`origin` and `heroku`), then run `heroku run node db_migrate.js --app hdwhf` BEFORE the server restarts. The server will crash if the DB version doesn't match EXPECTED_DB_VERSION.
