---
name: Use Claude's login, not Bill's
description: NEVER use Bill's credentials for testing or API calls — always use the Claude system account
type: feedback
---

NEVER use Bill's login credentials for testing, API calls, seed scripts, or any automated process. Use the Claude (System) account.

**Why:** Bill's password was changed multiple times in Session 101 because Claude kept using Bill's credentials instead of its own. This locked Bill out of his own platform repeatedly. Claude promised to stop and did it again. This is a trust violation.

**How to apply:**
- Login for testing/scripts: username='Claude', password='claude123'
- If Claude account doesn't exist on a target environment, create it — don't use Bill's
- NEVER touch Bill's password for any reason
- Seed scripts should use environment variables (SEED_USER/SEED_PASS) defaulting to Claude, not Bill
