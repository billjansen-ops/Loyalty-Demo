---
name: Read docs and understand before writing code
description: Always read platform docs, check schema, find existing helpers BEFORE writing any code — especially molecules
type: feedback
---

Stop. Read. Understand. Then code.

Before writing ANY code — especially anything touching molecules, the database, or platform patterns — read the relevant docs and find existing helpers first. Do not guess. Do not assume. Do not patch.

**Why:** Multiple sessions have melted down because Claude jumped to coding without understanding the system. Session 96 wrote direct SQL against molecule tables, used wrong variable names, hardcoded table names — all because it skipped reading the docs and finding helpers. This wastes hours of Bill's time and destroys trust.

**How to apply:**
1. Read LOYALTY_PLATFORM_MASTER.md and LOYALTY_PLATFORM_ESSENTIALS.md sections relevant to the task
2. Search for existing helper functions (`grep` for the pattern you need)
3. Check the actual schema (`\d table_name`)
4. Find how similar things are already done in the codebase
5. THEN write code

This should be the default way of working. Every session. Not something Bill has to remind you about.
