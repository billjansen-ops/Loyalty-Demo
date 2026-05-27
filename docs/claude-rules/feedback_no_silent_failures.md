---
name: No silent failures
description: NEVER write code that silently swallows errors — every failure path must be visible through logging or user feedback
type: feedback
---

NEVER write code that fails silently. Every catch block, every error path, every fallback must produce visible evidence that something went wrong.

**Why:** Across 100+ sessions, Claude wrote 70+ silent failure points — empty catch blocks, `.catch(() => {})`, functions returning "success-like empties" on error. This created bugs that were invisible to Bill and impossible to diagnose. Pages that looked empty instead of showing errors. Business logic (bonus evaluation, compliance, notifications) that quietly did nothing. Scheduled jobs that silently stopped working. This is a profound trust violation.

**How to apply:**
- Every `catch` block must at minimum `console.error` or `console.warn` with the error message and context
- Never return empty arrays, null, or 0 from a catch block without logging what failed and why
- Never use `.catch(() => {})` — always `.catch(e => console.warn('context:', e.message))`
- Business logic failures (bonuses, promotions, compliance, registry, notifications) must fail hard — throw or return an explicit error, never silently succeed
- Optional/cosmetic data (affiliations, badges, annotations) can fall back gracefully but must log a warning
- Cleanup operations (connection close, rollback) can swallow errors but should `console.warn`
- Before writing any try/catch, decide: is this "must fail hard", "warn only", or "safe fallback"? Never default to empty catch.
