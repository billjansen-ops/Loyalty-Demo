---
name: Never work in a worktree
description: Always edit files in the main repo, never in .claude/worktrees — worktrees break path resolution and sendFile
type: feedback
---

NEVER edit files in a git worktree (.claude/worktrees/*). Always work directly on the main codebase at /Users/billjansen/Projects/Loyalty-Demo/.

**Why:** Sessions 97 and 98 both had catastrophic failures caused by worktrees. Edits go to the wrong place, the server doesn't see changes, then panic fixes make it worse. This has happened repeatedly and cost hours.

**How to apply:**
1. At session start, check if CWD contains `.claude/worktrees/`. If so, IMMEDIATELY use absolute paths to `/Users/billjansen/Projects/Loyalty-Demo/` for ALL file operations. Do not ask Bill — just do it.
2. Start the server with `bootstrap/start.sh` from `/Users/billjansen/Projects/Loyalty-Demo/`. Never from a worktree.
3. If worktrees exist, clean them up: `cd /Users/billjansen/Projects/Loyalty-Demo && git worktree remove --force .claude/worktrees/<name>` for each one. They accumulate and cause confusion.
4. Claude Code may auto-create worktrees. There is no setting to disable this. The workaround is to ignore the worktree and work from the main repo path.
