---
name: Read what the task needs, not the whole checklist
description: When called out for skipping reads, don't overcorrect into reading everything. Read the specific surface the task actually touches.
type: feedback
originSessionId: 98f75b1d-3bfa-485c-919a-3711263874a8
---
When called out for missing a doc, do not respond by re-reading every file the startup checklist names. Read what the specific task actually requires.

**Why:** Session 109 — I skipped some startup reads, asked Bill questions whose answers were in the docs, got correctly called out. I overcorrected by reading the full Master outline (95k tokens), Build Notes outline (49k tokens), TEST_PLAN, manifest, and every memory file referenced from MEMORY.md — most of which had no bearing on the PPII streams refactor. Bill's reaction: "I think you need all of this to understand where we are at?" Burned context that mattered later in the session.

**How to apply:**
1. The startup checklist (per `feedback_session100_process.md`) is calibrated for **fresh starts on unfamiliar work**. When the handoff is sharp and the work is well-scoped, the checklist is overkill.
2. For a focused task, read: the handoff, the immediate code surface (the files you'll edit + their direct dependencies), the platform rules you'll invoke (e.g. db_migrate, server_version, restart_server), and any memory file the task domain touches.
3. If a doc doesn't bear on the specific task, skip it — even if the checklist names it. Bill prefers context spent on the work over context spent on reads.
4. When called out for missing a read, fix the specific gap, don't re-read the world. Ask "what specifically did I miss?" — the answer is usually one or two files, not twelve.
5. Master doc and Build Notes are too large to read in full anyway (95k / 49k tokens). Grep them for the specific terms you need.
