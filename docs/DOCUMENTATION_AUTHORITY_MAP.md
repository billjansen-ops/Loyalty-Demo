# DOCUMENTATION AUTHORITY MAP

Purpose: define which documents are source of truth, which are temporary,
and which should be treated as historical or archive candidates.

This is a documentation-operations map, not platform architecture.

---

# 1. Read Order for a New Session

Read these first, in this order:

1. `START_HERE.md`
2. `HANDOFF.md`
3. `docs/BEFORE_YOU_WRITE.md`
4. `docs/LOYALTY_PLATFORM_ESSENTIALS.md`
5. `docs/LOYALTY_PLATFORM_MASTER.md`
6. `STATE.md`
7. `ACTIVE_WORK.md`
8. `WORKFLOWS.md`

That set is the current onboarding spine for a new engineer or assistant.

---

# 2. Documentation Lanes

## Lane A — Entry / Operating Contract

These explain what the platform is, how Bill works, what needs approval, and
what order to read things in.

- `HANDOFF.md`
- `START_HERE.md`

Authority rule:
- `START_HERE.md` is the stable startup pointer.
- Keep this short.
- `HANDOFF.md` is the first substantial project-orientation file a new session should read.
- Do not turn this into a second architecture manual.

## Lane B — Current State / Live Operations

These describe what is currently shipped, what is fragile, and how to run the
project right now.

- `ACTIVE_WORK.md`
- `STATE.md`
- `WORKFLOWS.md`

Authority rule:
- `ACTIVE_WORK.md` is the single home for unfinished in-progress work.
- `STATE.md` is the live status board.
- `WORKFLOWS.md` owns startup, test, commit, push, deploy, and migration mechanics.
- If these contradict a historical note, trust these first, then verify in code.

## Lane C — Canonical Rules

These are durable platform guardrails and repeated anti-pattern prevention.

- `docs/BEFORE_YOU_WRITE.md`
- `docs/LOYALTY_PLATFORM_ESSENTIALS.md`

Authority rule:
- Add only rules that should remain true across sessions.
- Do not bury temporary handoff notes or model-specific ritual here.
- If a recurring mistake matters enough to repeat, it belongs here or in tests.

## Lane D — Architecture / Reference

This is the long-lived explanation of how the platform works.

- `docs/LOYALTY_PLATFORM_MASTER.md`

Authority rule:
- Keep architecture, subsystem behavior, and design rationale here.
- Do not mix in chat-budget handling, tar packaging, or session-specific mechanics.

## Lane E — Design Proposals

These are substantial design or proposal documents that may guide future work,
but they are not evidence that code shipped.

- `docs/design/`

Authority rule:
- Good for design intent, tradeoffs, and future implementation planning.
- Must not be confused with current behavior.
- If a design ships, update Lane B/C/D docs to reflect the built reality.

## Lane F — Operations / Runbooks

These are operational setup or procedure docs.

- `docs/operations/`

Authority rule:
- These may be the source of truth for a repeatable operational process.
- Keep them concrete and current.
- If they drift from the actual workflow, fix them quickly because they are
  likely to be followed literally.

## Lane G — Active Work

These are in-progress design or extraction documents that matter right now but
should not be mistaken for timeless platform law.

- `docs/INSIGHT_EXTRACTION_DESIGN.md`
- `docs/INSIGHT_TOUCH_POINTS.md`
- `ACTIVE_WORK.md`

Authority rule:
- Useful while the related work is active.
- When the work finishes, either fold the durable parts into canonical docs or archive them.

## Lane H — Historical Narrative

These explain what happened in a session or why a decision was made, but they
are not the first place to learn how the system works today.

- `docs/SESSION_HISTORY_INDEX.md`
- `docs/history/SESSION_130_RETROSPECTIVE.md`
- `docs/history/HANDOFF_FROM_127.md`, `docs/history/HANDOFF_FROM_128.md`, `docs/history/HANDOFF_FROM_129.md`, `docs/history/HANDOFF_FROM_130.md`
- `docs/history/SESSION_*_HANDOFF*.md`
- `docs/history/correspondence/`
- `docs/history/business/`
- older session handoffs and retrospective notes
- most files under `learnings/`

Authority rule:
- Good for context, lessons, and postmortems.
- Never rely on these alone for current truth.

## Lane I — Mirror / Legacy / Archive Candidates

These currently create ambiguity or duplication and should be treated with caution.

- `docs/claude-rules/`
- `docs/history/reference/`
- `docs/history/process/`
- `20251215/`
- duplicated files mirrored under `learnings/`, `Bill/`, and `20251215/...`

Authority rule:
- These are not safe to treat as primary truth without verification.
- Prefer canonical docs first.
- Archive, merge, or clearly label them before asking future engineers to rely on them.
- `docs/claude-rules/` is an archival mirror of older Claude memory, not a live startup lane.
- The `20251215/` tree is best treated as a dated mirror/snapshot, not a second
  active documentation system.

---

# 3. Source-of-Truth Rules

1. The repo must be the source of truth.
2. A mirrored copy outside the repo is not canonical unless the repo says so explicitly.
3. A historical doc may explain why something happened, but it does not override current code, `STATE.md`, or `WORKFLOWS.md`.
4. If a durable rule is learned during a session, promote it into Lane C or Lane D. Do not leave it stranded in a handoff.
5. If a doc claims something shipped, the claim must match the current committed code and deploy state.

---

# 4. Immediate Cleanup Priorities

High priority:
- Keep `STATE.md` accurate.
- Keep `WORKFLOWS.md` current.
- Keep `docs/BEFORE_YOU_WRITE.md`, `docs/LOYALTY_PLATFORM_ESSENTIALS.md`, and `docs/LOYALTY_PLATFORM_MASTER.md` free of session ritual and stale startup instructions.

Medium priority:
- Decide whether `docs/claude-rules/` is canonical, mirrored, or archival. It should not be ambiguously all three.
- Keep `docs/design/` and `docs/history/` clearly separated so proposals do not masquerade as shipped behavior.
- Continue curating which historical session docs deserve long-term retention.

Lower priority:
- Large historical cleanup in `20251215/`
- Deduplication of mirrored narrative documents under `learnings/`

---

# 5. Current Status

The core reorganization is now in place:
- startup/current-state docs are separated from history
- older handoffs and process docs live under `docs/history/`
- `learnings/` and `20251215/` are labeled as historical/archive material

What remains is curation, not first-pass structure:
- trim duplicate archive material
- keep canonical docs aligned with live code
- continue shrinking ambiguous mirror/legacy surfaces
