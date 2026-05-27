---
name: CI green is the gate, not "tested locally"
description: GitHub Actions CI runs on every push to main. Before pushing to Heroku, verify the latest commit on GitHub shows a green check. "Passes on Bill's laptop" is necessary but not sufficient.
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## "Tested locally" is not enough

The `.github/workflows/ci.yml` workflow (added Session 112) runs the full test suite against a Heroku-shaped Postgres on every push to main. It catches the class of bug where code works on Bill's Mac but breaks in production — hardcoded paths, environment drift, sequence-allocation divergence, bash-only shell syntax, etc.

**Why this matters:** Session 112 shipped a v64 migration with hardcoded membership numbers that worked on Bill's laptop (where Grace Newfield is #46) and failed on Heroku (where she's #53) because Postgres sequences allocated differently. A green CI run on a fresh Heroku-shaped DB would have caught this in 2 minutes instead of mid-deploy in front of Erica.

**How to apply:**
1. After committing + pushing to origin, wait for CI to finish (~5 min) and check it's green BEFORE running `git push heroku main`.
2. Check via: `curl -s "https://api.github.com/repos/billjansen-ops/Loyalty-Demo/actions/runs?per_page=1" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['workflow_runs'][0]; print(r['status'], r.get('conclusion'))"`
3. If CI is red, fix it BEFORE deploying. Don't push to Heroku on a red commit "just to get it out."
4. If you can't read CI logs (admin auth required even for public repos), use the annotations API — `GET /repos/.../check-runs/{job_id}/annotations` is public. The workflow emits `❌ FAIL:` lines and `↳ FAIL: Test crashed:` markers as annotations for exactly this reason.

**CI environment notes** (so you don't fight them again):
- Postgres 15 in a container
- Ubuntu runner (so PG binaries at `/usr/bin/pg_dump`, not `/opt/homebrew/bin/`)
- Shell is `/bin/sh` = dash, NOT bash
- Python 3.12 with sklearn/pandas/numpy installed (ML retrain test depends on it)
- Baseline DB from `.claude/demo-baseline/demo-baseline.dump` (committed) restored before migrations run
- Annotations API caps at 10 per level — workflow filters precisely (first 10 `❌ FAIL` lines + tail-25 if no FAILs)

**When CI runs:** every push to main + every pull request. ~5 min end-to-end. Free CI minutes are abundant.
