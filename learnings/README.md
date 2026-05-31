# Learnings Archive

This directory is historical working material from earlier sessions.

It is **not** the primary source of truth for the current platform.

Use the canonical startup and reference path first:

1. `../START_HERE.md`
2. `../HANDOFF.md`
3. `../STATE.md`
4. `../WORKFLOWS.md`
5. `../docs/BEFORE_YOU_WRITE.md`
6. `../docs/LOYALTY_PLATFORM_ESSENTIALS.md`
7. `../docs/LOYALTY_PLATFORM_MASTER.md`
8. `../docs/DOCUMENTATION_AUTHORITY_MAP.md`

## What Is In Here

- topical technical notes and experiments at the root
- `process-history/` for old startup/workflow/secret-sauce/handoff process notes
- `session-history/` for older session summary material
- exploratory reference material
- older handoff helpers

## How To Use It

- Use it for historical context, not current operating truth.
- If a file here conflicts with canonical docs or live code, the canonical docs
  and code win.
- If a durable lesson still matters, promote it into the canonical docs instead
  of relying on people to rediscover it here.
- A duplicated dated mirror of this archive previously lived under
  `20251215/learnings/`; it was removed because it added noise without unique value.

The repo's default `rg` search still sees top-level technical notes here, but
ignores the noisier `process-history/` and `session-history/` buckets. Use
`rg -uu` when you intentionally want those historical layers too.
