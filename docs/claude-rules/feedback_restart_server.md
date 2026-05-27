---
name: Restart the server after editing pointers.js
description: CRITICAL — after any edit to pointers.js, kill the running server and start a fresh one. Bumping SERVER_VERSION without restarting is worse than useless.
type: feedback
---

## ALWAYS restart the server after editing pointers.js

Every time `pointers.js` is modified, the running server must be restarted for the change to take effect. The Node process caches the old code — a stale PID left from a previous session will happily serve the OLD behavior for days while Bill thinks he's testing the new code.

**Signal this has happened:** Bill loads the admin page, sees a new UI column that returns empty/null data. The server is old. The HTML is new. The endpoint didn't add the field Bill expects.

**How to apply:**
1. After editing `pointers.js`, bump SERVER_VERSION + BUILD_NOTES (per feedback_server_version.md).
2. Before saying "ready to test": kill the running server and start a new one.
   - Find the PID: `lsof -i :4001 | grep LISTEN`
   - Kill: `kill <pid>` (give it a second to release the port)
   - Start: `cd /Users/billjansen/Projects/Loyalty-Demo && bootstrap/start.sh` (run in background).
   - Verify the new build is serving: `curl -s http://127.0.0.1:4001/v1/health-info` or whatever endpoint exposes SERVER_VERSION, and check it matches the value you just bumped.
3. THEN tell Bill it's ready to test. Never hand over with the old server still running.

**Why this matters:** Session 106 shipped a new Database Utilities feature (per-row DB version + Update button) but handed it to Bill with the old server still responding. Every badge was empty, everything looked broken. Zero tests actually exercised the new endpoint because the test suite ran against the old server too. Wasted Bill's time and eroded trust.

**When not to restart:** HTML/CSS/client JS edits don't need a server restart (files served from disk per request). Only pointers.js (and any imported server-side module) requires a restart.
