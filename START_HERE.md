# START HERE

This is the stable startup entrypoint for a new engineer or assistant.

Do not start from timestamped `START_CHAT_INSTRUCTIONS_*` files. Those are
historical process notes, not the live operating path.
Do not start from `HANDOFF_FROM_*`, `SESSION_*_HANDOFF*`, or retrospective
docs unless one of the canonical docs explicitly sends you there for context.

## Read In This Order

1. [HANDOFF.md](HANDOFF.md)
2. [docs/BEFORE_YOU_WRITE.md](docs/BEFORE_YOU_WRITE.md)
3. [docs/LOYALTY_PLATFORM_ESSENTIALS.md](docs/LOYALTY_PLATFORM_ESSENTIALS.md)
4. [docs/LOYALTY_PLATFORM_MASTER.md](docs/LOYALTY_PLATFORM_MASTER.md)
5. [STATE.md](STATE.md)
6. [ACTIVE_WORK.md](ACTIVE_WORK.md)
7. [WORKFLOWS.md](WORKFLOWS.md)

Important: `WORKFLOWS.md` contains the mandatory end-of-chat handoff rule.
When a session is getting tired or ending, the current session must update
repo state and provide a paste-ready next-chat prompt before stopping.

**Before doing ANY molecule work** — creating, editing, or reasoning about a
molecule — read **[docs/MOLECULES.md](docs/MOLECULES.md)** first. It is the
single source of truth for molecules (the storage/encoding mechanism, per-type
recipes, silent-failure invariants, verified exemplars, helper functions, and
the mandatory round-trip verification). Molecules fail silently, so this is not
optional — the essentials/master docs only point here; they no longer restate it.

If document authority is unclear after that, read:

- [docs/DOCUMENTATION_AUTHORITY_MAP.md](docs/DOCUMENTATION_AUTHORITY_MAP.md)
- [docs/README.md](docs/README.md)

## What This Replaces

This file replaces the old idea of generating a fresh timestamped startup
instruction file for each session.

The startup path should be:
- stable
- repo-based
- easy to verify against live code

Active work belongs in current state and handoff docs, not in a new startup
script every time.
