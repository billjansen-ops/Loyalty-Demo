# Docs Guide

This folder has grown over many sessions. Start with the small canonical set,
not with whichever file happens to sound most "master-like."

## Read First

1. `../START_HERE.md`
2. `../HANDOFF.md`
3. `BEFORE_YOU_WRITE.md`
4. `LOYALTY_PLATFORM_ESSENTIALS.md`
5. `LOYALTY_PLATFORM_MASTER.md`
6. `../STATE.md`
7. `../ACTIVE_WORK.md`
8. `../WORKFLOWS.md`

## What These Are

- `BEFORE_YOU_WRITE.md`
  Repeated failure patterns and non-negotiable guardrails.
- `LOYALTY_PLATFORM_ESSENTIALS.md`
  Durable platform rules.
- `LOYALTY_PLATFORM_MASTER.md`
  Long-lived architecture and subsystem reference.
- `DOCUMENTATION_AUTHORITY_MAP.md`
  Which docs are canonical, active, historical, or legacy.

## Active Work Docs

These may be important right now, but they are not timeless platform law:

- `INSIGHT_EXTRACTION_DESIGN.md`
- `INSIGHT_TOUCH_POINTS.md`
- session-specific handoffs and retrospectives

## Design Docs

These are forward-looking design or proposal docs. Useful, but not proof that
something is shipped:

- `design/`

## Operations Docs

These are runbooks and setup guides:

- `operations/`

For historical session docs specifically, see:

- `SESSION_HISTORY_INDEX.md`

## Legacy / Secondary Docs

These exist for context, not as the first source of truth:

- `claude-rules/`
- `design/` once a design is stale or superseded
- `operations/` if a runbook stops matching the live workflow
- `history/correspondence/`
- `history/business/`
- `../learnings/`
- `../20251215/`

If any of those conflict with the canonical set or the live code, trust the
canonical set first, then verify in code.

`claude-rules/` specifically is now an archival mirror of older Claude memory,
not a current startup surface.

## Search Hygiene

Default `rg` searches now ignore the loudest archive/mirror areas through the
repo's `.rgignore` file:

- `20251215/`
- `docs/history/`
- `docs/claude-rules/`
- `learnings/process-history/`
- `learnings/session-history/`

That keeps normal implementation searches focused on the live platform surface.
When you intentionally want archive material too, use `rg -uu`.
