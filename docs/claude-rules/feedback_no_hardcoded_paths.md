---
name: Never hardcode Mac-specific paths in tests or scripts
description: Tests and shell-spawning code must read PG_DUMP / PG_RESTORE / PSQL / NODE_BIN from env vars with homebrew defaults. CI (Linux) overrides them. Hardcoding /opt/homebrew/bin/ breaks CI silently.
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Use env-configurable paths, not hardcoded /opt/homebrew/bin/

Anywhere a test file or helper shells out to a system binary (psql, pg_dump, pg_restore, node, etc.), the path MUST be configurable via env var with a Mac homebrew default. CI runs on Ubuntu where those binaries live under `/usr/bin/` (or just on `$PATH`).

**Signal this has gone wrong:** Test output shows `/bin/sh: 1: /opt/homebrew/bin/psql: not found` and the test crashes during a psql call. Happened in Session 112's CI build-out — `test_ppii_history_snapshot.cjs` had `const PSQL = '/opt/homebrew/bin/psql'` hardcoded. Took an iteration to spot because the regex looking for `❌ FAIL:` markers in CI output didn't match the `↳ FAIL: Test crashed:` form the runner emits for thrown errors.

**Pattern to use:**

```javascript
// Mac homebrew defaults; CI overrides via env vars (see tests/run.cjs).
const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const PG_DUMP = process.env.PG_DUMP || '/opt/homebrew/bin/pg_dump';
const PG_RESTORE = process.env.PG_RESTORE || '/opt/homebrew/bin/pg_restore';
const NODE_BIN = process.env.NODE_BIN || '/opt/homebrew/bin/node';
const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1';
const DB_USER = process.env.DATABASE_USER || 'billjansen';
const DB_NAME = process.env.DATABASE_NAME || 'loyalty';
```

**The CI workflow already exports the Linux paths** — see `.github/workflows/ci.yml` env block. So new test files just need to read `process.env.PSQL` (etc.) and they work on both sides.

**How to apply:**
- Any time you write a test or helper that calls `execSync` with a PG binary or node, use the env-var-with-default pattern above.
- When auditing existing tests, grep for `/opt/homebrew/` — anything that matches is a future CI break.
- Don't add NEW hardcoded paths "because it's just a test." Tests run on CI.
