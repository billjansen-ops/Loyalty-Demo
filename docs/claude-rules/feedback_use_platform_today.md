---
name: Use platformToday for all date handling
description: NEVER invent new ways to get "today" — use the platform's centralized date functions
type: feedback
originSessionId: f1f2d28c-f6b5-4115-98b5-a927a5f91ae2
---
## NEVER invent "today"

Do NOT write `new Date()`, `Date.now()`, `todayLocal()`, `dateToMoleculeInt(new Date())`, or `dateToBillEpoch(new Date())` to get today's date. Use the platform's centralized date functions.

The platform has three Bill epoch date/time formats:
1. **Date (2 bytes SMALLINT)** — days since Dec 3, 1959. Day precision.
2. **Time (2 bytes SMALLINT)** — 10-second blocks within a day. 00:00:00=0, 23:59:50=8639.
3. **DateTime (4 bytes INTEGER)** — date + time combined. 10-second precision. Used in audit system.

All new date code must use the existing helper functions. Do not create new date functions, do not use Unix timestamps, do not use `toISOString()` for date storage (it shifts to UTC and causes timezone bugs).

**Pending consolidation:** A `platformToday()` function needs to be created that is the ONE way to get today's date. All existing scattered "today" computations (51+ occurrences) need to be replaced with it. Also: `dateToBillEpoch` is a duplicate of `dateToMoleculeInt` — merge them.
