# CLAUDE.md — session bootstrap

**First action, every session, before doing anything else:**

1. Read **[START_HERE.md](START_HERE.md)** (from line 1) and follow its reading
   order exactly. That file is the single source of the startup sequence — do
   not improvise a different order, and do not start from any timestamped
   `START_CHAT_INSTRUCTIONS_*`, `HANDOFF_FROM_*`, or `SESSION_*_HANDOFF*` file.

2. `START_HERE.md` will route you through `HANDOFF.md`,
   `docs/BEFORE_YOU_WRITE.md`, the platform essentials/master docs, `STATE.md`,
   `ACTIVE_WORK.md`, and `WORKFLOWS.md`. Read them before writing any code.

That's the whole startup. There is no per-session ritual and no generated
startup file — the repo is the source of truth.

---

## Non-negotiables (the full rules live in the docs above; this is the reminder)

- Owner is **Bill Jansen**. Bill does not write code; you do. Plain English,
  never git/jargon. Yes/no questions get yes/no answers.
- **Discuss before coding.** Don't start editing until Bill says go.
- **Ask first** before pushing to GitHub (`origin/main`), pushing to Heroku
  (each a separate go), schema changes, or anything touching wi_php tenant
  data. CI green is the gate before any Heroku push.
- Editing `pointers.js` → bump `SERVER_VERSION`, update `BUILD_NOTES`, restart.
- Dates via platform helpers only; every `fetch()` checks `r.ok`; links via
  `getNextLink()`; DB changes only through `db_migrate.js`. Run
  `node tests/lint-anti-patterns.cjs` after changes — expect 0 matches.
- **"Stop!" / ALL CAPS / swearing = serious mistake.** Don't defend, don't
  re-explain what you did — answer the actual question and fix it. When asked
  a question, answer *that* question; don't substitute an easier one.
