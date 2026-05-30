# ACTIVE WORK

Status: no active unfinished work recorded right now.

Use this file only when a session ends with work still in progress.
Overwrite it with the current state; do not create another versioned
`HANDOFF_FROM_*` file for routine continuity.

## Template For Real Active Work

When there is unfinished work, replace the placeholder above with:

```md
# ACTIVE WORK

Status: active
Date: YYYY-MM-DD HH:MM Central
Commit: <sha or "uncommitted">

## What Finished
- Concrete items completed this session

## What Is Still Active
- The unfinished work
- What is blocked / what is not yet verified

## Next Step
- The single next action to take first

## Files In Play
- path/to/file
- path/to/file

## Verification State
- Tests run
- What passed
- What failed
- Whether any failure is pre-existing

## Risks / Traps
- Known gotchas
- Shortcuts to avoid
```

When the unfinished work is fully resolved, collapse this file back to the
placeholder state instead of leaving stale active notes behind.
