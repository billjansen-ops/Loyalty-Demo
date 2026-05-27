---
name: Session numbers from chat title
description: Get session number from the chat title, never guess or track internally
type: feedback
---

Session numbers come from the chat title (e.g., "Loyalty Chat 94"). Never guess, increment, or track session numbers internally — they've been wrong every time.

**Why:** Claude's internal session counting diverged from Bill's actual count, leading to wrong labels in commits and BUILD_NOTES.

**How to apply:** When labeling commits or BUILD_NOTES with a session number, pull it from the chat title. If the title doesn't have one, ask Bill.
