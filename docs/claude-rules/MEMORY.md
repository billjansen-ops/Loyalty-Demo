# Loyalty Platform (Pointer) - Memory

This file is a historical mirror of Claude-era startup memory. It is not the
preferred startup path anymore.

For current repo truth, use:
- `START_HERE.md`
- `HANDOFF.md`
- `STATE.md`
- `ACTIVE_WORK.md`
- `WORKFLOWS.md`
- `docs/BEFORE_YOU_WRITE.md`
- `docs/LOYALTY_PLATFORM_ESSENTIALS.md`
- `docs/LOYALTY_PLATFORM_MASTER.md`

## Project Owner
Bill Jansen. Does not write code — Claude writes all code. 90+ sessions built this platform.

## Key Rules (see docs/LOYALTY_PLATFORM_ESSENTIALS.md for full details)
- NEVER direct SQL against molecule tables — use helpers
- NEVER allocate links with raw SQL — always use getNextLink()
- NEVER raw JOIN member_tier — use `get_member_current_tier()`
- ALWAYS check schema before writing code
- NEVER invent new ways to get "today" — use platform date functions (Bill epoch), not new Date()/Date.now()/toISOString()
- ALWAYS update SERVER_VERSION + BUILD_NOTES when modifying pointers.js (never ask)
- SQL for Bill: always psql wrapper format
- Dates: 2-byte Bill epoch SMALLINT (days since Dec 3, 1959)
- {Variable} in Bill's messages = dynamic DB value, not literal
- "b" = scrolling, keep waiting
- ALL CAPS / swearing = serious mistake, fix immediately, don't defend

## Server File
`pointers.js`

## Architecture
- Temporal-first: balances derived, never stored
- Multi-tenant: tenant_id everywhere, RLS on member
- Molecules: abstraction layer for tenant-specific data (Dynamic/Reference types)
- Link system: 5-byte base-127 encoded PKs
- Verticals: workforce_monitoring, airline, hotel, automotive

## File Locations
- Tenant pages → `tenants/{tenant_key}/` or `verticals/{vertical_key}/tenants/{tenant_key}/`
- Vertical shared pages → `verticals/{vertical_key}/`
- SQL scripts → `SQL/`
- Server → `pointers.js`

## Claude Code Differences from Chat Sessions
- No tar files needed — direct file access
- Direct file edits instead of giving Bill files to place
- Git integration for commits/branches/PRs
- Older session-start ritual has been retired in favor of `START_HERE.md`,
  `STATE.md`, `ACTIVE_WORK.md`, and `WORKFLOWS.md`

## Key Docs (moved March 17, 2026)
- Platform rules: `docs/LOYALTY_PLATFORM_ESSENTIALS.md`
- Platform architecture: `docs/LOYALTY_PLATFORM_MASTER.md`
- Build notes: `verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md`
- Release notes: `verticals/workforce_monitoring/tenants/wi_php/Release_Notes.md`

## Platform Name
"Pointers" — always reference by name

## Memories
- [feedback_server_version.md](feedback_server_version.md) - Always bump SERVER_VERSION when editing pointers.js
- [feedback_db_migrate.md](feedback_db_migrate.md) - All DB changes go through db_migrate.js, never direct DDL
- [feedback_reuse_patterns.md](feedback_reuse_patterns.md) - Always search for existing patterns before building; never duplicate shared code
- [user_communication.md](user_communication.md) - Bill's frustration signals: Stop!, What are you doing?, ALL CAPS, swearing
- [archive/project_current_work.md](archive/project_current_work.md) - Historical snapshot of Claude-era "current work" notes; superseded by `STATE.md` and `ACTIVE_WORK.md`
- [archive/project_erica_tracking.md](archive/project_erica_tracking.md) - Historical snapshot of Erica tracking; not current operating truth
- [feedback_worktree.md](feedback_worktree.md) - NEVER work in a worktree; always edit main repo files directly
- [feedback_stop_spiraling.md](feedback_stop_spiraling.md) - When a fix fails, stop and diagnose root cause instead of trying more fixes
- [feedback_dont_jump_to_code.md](feedback_dont_jump_to_code.md) - Discuss first, code later — don't start coding until Bill says go
- [feedback_session_numbers.md](feedback_session_numbers.md) - Session number comes from chat title, never guess
- [feedback_no_git.md](feedback_no_git.md) - Bill does NOT manage git — Claude handles commits/pushes to main. NEVER create branches or worktrees.
- [feedback_read_before_code.md](feedback_read_before_code.md) - ALWAYS read docs, check schema, find helpers BEFORE writing code
- [feedback_build_notes.md](feedback_build_notes.md) - Update Insight Build Notes EVERY session. File: verticals/workforce_monitoring/tenants/wi_php/Insight_Build_Notes.md
- [archive/project_washington_state.md](archive/project_washington_state.md) - Historical Washington State opportunity note
- [feedback_session97_lessons.md](feedback_session97_lessons.md) - CRITICAL: 34 stops in one session. Verify before speaking. Stop means stop. Don't guess schemas. Don't explain what went wrong — answer why.
- [feedback_use_getnextlink.md](feedback_use_getnextlink.md) - NEVER allocate links with raw SQL — always use getNextLink()
- [feedback_use_platform_today.md](feedback_use_platform_today.md) - NEVER invent new ways to get "today" — use platform date functions
- [feedback_session99_lessons.md](feedback_session99_lessons.md) - NEVER say "I don't know" without searching first. Search build notes, memory, codebase BEFORE speaking.
- [feedback_session100_process.md](feedback_session100_process.md) - CRITICAL: Mandatory startup checklist, pre-code verification, self-QA before handing to Bill. Verify your own work.
- [feedback_no_silent_failures.md](feedback_no_silent_failures.md) - CRITICAL: NEVER write code that silently fails. Every catch block must log. 70+ silent failures found in Session 101 audit.
- [feedback_use_own_login.md](feedback_use_own_login.md) - NEVER use Bill's credentials. Always use Claude system account. Never touch Bill's password.
- [feedback_restart_server.md](feedback_restart_server.md) - ALWAYS restart the server after editing pointers.js. Bumping SERVER_VERSION without restarting means Bill tests against old code.
- [feedback_targeted_reads.md](feedback_targeted_reads.md) - When called out for missing a read, don't overcorrect by reading everything. Read what the specific task needs.
- [feedback_deploy_before_email.md](feedback_deploy_before_email.md) - CRITICAL: Deploy to Heroku BEFORE emailing users about fixes. Session 112 nearly burned Bill — email went out before deploy. Got lucky.
- [feedback_ci_is_the_gate.md](feedback_ci_is_the_gate.md) - "Tested locally" is not enough. CI green is the gate before `git push heroku main`. Annotations API readable without admin auth.
- [feedback_no_hardcoded_paths.md](feedback_no_hardcoded_paths.md) - Never hardcode `/opt/homebrew/bin/` in tests. Use `process.env.PSQL || '/opt/homebrew/bin/psql'` pattern — CI overrides for Linux.
- [feedback_no_bash_isms.md](feedback_no_bash_isms.md) - CI runs `/bin/sh` (dash), not bash. Avoid `$'\t'`, `[[...]]`, process substitution. Use POSIX-portable syntax.
- [feedback_migrations_resolve_by_name.md](feedback_migrations_resolve_by_name.md) - Migrations resolve members by NAME, not membership_number. Postgres sequences diverge across environments — Grace is #46 local, #53 Heroku.
- [feedback_session113_failure_pattern.md](feedback_session113_failure_pattern.md) - CRITICAL: Two patterns to actively resist — (1) long sessions degrade attention, hand off at 150k tokens; (2) "answer the easier question" — when asked about a multi-step design, trace the FULL chain before saying you understand. Session 113 burned 2 hours on a 2-file restore because of these.
- [BEFORE_YOU_WRITE.md](BEFORE_YOU_WRITE.md) - **READ THIS BEFORE WRITING CODE.** Canonical date helpers + anti-patterns the platform has been bitten by repeatedly (DST date bug across 7 files, silent fetch failures, destructive child-collection saves that broke audit IDs, healthcare-isms leaking into platform-shared files). Run `node tests/lint-anti-patterns.cjs` to surface current violations.
