# Claude Memory — Archival Mirror

These files are a committed mirror of Claude-era memory files. They are kept
for historical context and rule preservation, but they are not the live
startup path for this repo.

Current project truth lives in:

- `START_HERE.md`
- `HANDOFF.md`
- `STATE.md`
- `ACTIVE_WORK.md`
- `WORKFLOWS.md`
- `docs/BEFORE_YOU_WRITE.md`
- `docs/LOYALTY_PLATFORM_ESSENTIALS.md`
- `docs/LOYALTY_PLATFORM_MASTER.md`

The original Claude memory source lived in:

```
~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/
```

That directory was local to Bill's Mac and auto-loaded into Claude sessions.
It is **not** a git directory, so a wiped machine would have lost every rule,
feedback pattern, and project note that 90+ sessions had built up.

This folder exists so those rules and notes survive and remain visible in the
repo, but the repo's canonical docs have now replaced it as the normal
orientation path.

## How to use

- **For normal startup:** do not start here. Start from `START_HERE.md`.
- **For historical rule tracing:** use these files to understand how past
  Claude sessions were being guided.
- **For rescuing older lessons:** promote any still-valid rule into the
  canonical docs instead of treating this mirror as live truth.
- **For restoring an old Claude memory directory:** compare carefully first.
  Do not copy this folder back blindly; some files here are intentionally
  archived because they are stale snapshots rather than current state.

## When you edit a rule

Edit the canonical repo docs first. Only mirror/update this area if there is a
specific reason to preserve older Claude-memory compatibility or provenance.

The old entry point was `MEMORY.md`. It remains here as an index to the mirror,
not as the repo's preferred onboarding file.

## What's in here

| File family | Purpose |
|---|---|
| `MEMORY.md` | Historical index to the mirrored memory files |
| `BEFORE_YOU_WRITE.md` | Anti-patterns and canonical helpers (dates, fetches, saves, platform-shared files) |
| `feedback_*.md` | Working-style rules learned from past sessions (corrections + validated approaches) |
| `archive/` | Stale project-state snapshots and older opportunity notes kept for context |
| `user_communication.md` | Bill's communication style + frustration signals |

## Provenance

These files were first mirrored in Session 128 (2026-05-27) after a
near-miss with a planned Mac-wipe scenario surfaced that 90+ sessions
of accumulated rules were sitting in one local-only directory with
no backup.
