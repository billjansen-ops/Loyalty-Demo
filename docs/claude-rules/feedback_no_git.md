---
name: Git rules
description: Claude handles commits and pushes to main. NEVER create branches or worktrees. Bill does NOT manage git.
type: feedback
---

Bill does NOT write code and does NOT manage git. Claude handles commits and pushes to main. This has always been the case.

**What to do:** `git add`, `git commit`, `git push origin main`, `git push heroku main` — these are Claude's job.

**What NEVER to do:** `git branch`, `git worktree`, `git checkout -b`, or any operation that creates branches or worktrees. Work on main only.

**Why:** Worktrees and branches caused catastrophic session failures. Work gets done in one branch and lost in another. Worktree directories get deleted and kill sessions.

**How to apply:** Commit to main. Push to origin and heroku when deploying. Never create a branch. Never create a worktree.
