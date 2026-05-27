# Claude Memory — Mirror

These are mirrors of Claude's auto-loaded memory files. The source of
truth lives in:

```
~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/
```

That directory is local to Bill's Mac and is loaded automatically into
every Claude conversation on this project. It is **not** a git
directory, so a wiped machine loses every rule, feedback pattern, and
project note that 90+ sessions have built up.

This folder is a committed mirror so the rules survive a Mac wipe and
are visible to anyone reading the repo on GitHub.

## How to use

- **Reading the rules:** prefer the source files in `~/.claude/.../memory/`
  if you have access — those are guaranteed current.
- **Cloning fresh on a new machine:** copy `docs/claude-rules/*` back
  into `~/.claude/projects/-Users-billjansen-Projects-Loyalty-Demo/memory/`
  to restore the memory directory.
- **GitHub readers / new collaborators:** browse these files to see
  the working rules that govern Claude's behavior on this codebase
  (date handling, anti-patterns, response style, git authority, etc.).

## When you edit a rule

**Edit BOTH copies.** The source in `~/.claude/.../memory/` is what
Claude actually loads at conversation start; the mirror here is what
gets pushed to GitHub. If you only edit one, they drift.

The entry point is `MEMORY.md` — that's the index Claude loads
verbatim. Individual rule files are referenced from it by name.

## What's in here

| File family | Purpose |
|---|---|
| `MEMORY.md` | Index — list of every other memory file with a one-line hook |
| `BEFORE_YOU_WRITE.md` | Anti-patterns and canonical helpers (dates, fetches, saves, platform-shared files) |
| `feedback_*.md` | Working-style rules learned from past sessions (corrections + validated approaches) |
| `project_*.md` | Project-state notes — active work, ongoing initiatives, key contacts |
| `user_communication.md` | Bill's communication style + frustration signals |

## Provenance

These files were first mirrored in Session 128 (2026-05-27) after a
near-miss with a planned Mac-wipe scenario surfaced that 90+ sessions
of accumulated rules were sitting in one local-only directory with
no backup.
