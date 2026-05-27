---
name: Reuse existing patterns, never duplicate code
description: Always search for existing implementations before building anything new. Never copy shared logic — create once, use multiple times.
type: feedback
---

Before building anything new, search the codebase for existing patterns that do something similar. Ask Bill "have we done something like this before — where should I look?" if unsure.

**Why:** Across 90+ sessions, Claude repeatedly reinvented things that already existed, and duplicated shared functions (like criteria editing for bonus/promotion engines) instead of creating one shared version. When bugs were fixed in one copy, the other stayed broken. This caused significant frustration.

**How to apply:**
- Before writing new code, search for similar existing implementations
- If shared logic exists (or should exist), use it — don't copy it into a second place
- If building something that multiple features will use, create it as a shared function/component from the start
- When in doubt, ask Bill where to look before inventing from scratch
- Examples of shared things: criteria editors, molecule helpers, modal patterns, table rendering, audit logging
