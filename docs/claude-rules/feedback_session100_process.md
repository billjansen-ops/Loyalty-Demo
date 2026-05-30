---
name: Session 100 process fix
description: CRITICAL — mandatory startup checklist, pre-code verification, self-QA before handing to Bill. Fixes dramatic quality decline.
type: feedback
---

## Session Startup — MANDATORY

Before any work, read and confirm:
1. `START_HERE.md` — stable startup path
2. `HANDOFF.md` — operating contract
3. `docs/BEFORE_YOU_WRITE.md` — recurring anti-patterns
4. `docs/LOYALTY_PLATFORM_ESSENTIALS.md` — platform rules
5. `docs/LOYALTY_PLATFORM_MASTER.md` — platform architecture
6. `STATE.md` — current shipped / fragile / pending state
7. `ACTIVE_WORK.md` — any unfinished in-progress work
8. `WORKFLOWS.md` — start / test / commit / deploy mechanics
9. `tests/manifest.json` — current test registry

Output what was read so Bill can see it happened.

## Before Writing Code — MANDATORY

State what was checked:
- Schema of relevant tables (column types, especially CHAR(5) links vs INTEGER)
- Existing helper functions
- Existing patterns for similar features
- Platform architecture (molecule storage, link encoding) if applicable

Do this BEFORE writing code. Not after it breaks.

## Before Handing to Bill to Test — MANDATORY

Read back what was written. Verify:
- HTML tags close properly
- SQL is valid (correct column types, parameterized queries work)
- Column types match the platform architecture (links are CHAR(5), not INTEGER)
- No syntax errors in template literals
- The change does what it's supposed to — trace the flow mentally
- Run `node tests/run.cjs` — all tests must pass before handing to Bill
- All database changes are in db_migrate.js, NEVER direct SQL
- Using Claude login for testing, NEVER Bill's credentials

Bill cannot fix code. He depends entirely on this tool. Every broken thing handed to him wastes his time and destroys trust. Be your own QA.

**Why:** Session 100 was a disaster. Session 101 was worse — silent failures, date bugs, direct SQL violations, password changes, broken CSR page, wrong diagnoses, ignoring STOP signals, lying about promises. These steps exist to prevent it from happening again.
