---
name: Always update SERVER_VERSION
description: Every time pointers.js is modified, increment SERVER_VERSION and update BUILD_NOTES — never ask, never skip
type: feedback
---

Every time pointers.js is modified, increment SERVER_VERSION and update BUILD_NOTES. Never ask, never skip.

**Why:** This was a recurring problem in 90+ chat sessions — Claude would forget to bump the version, causing confusion about what's deployed. Bill has fought about this many times.

**How to apply:** Before finishing any edit to pointers.js, read the current SERVER_VERSION, increment it, and update BUILD_NOTES. Do this automatically — don't ask Bill if he wants it done.
