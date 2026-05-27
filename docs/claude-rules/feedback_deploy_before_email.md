---
name: Deploy before emailing users about fixes
description: CRITICAL — never tell a user "fixes are live" before the deploy has actually completed. The email is gated on the deploy, not the other way around.
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Deploy → THEN email. Always.

When Bill is about to send Erica (or anyone) an email saying "your bugs are fixed", the deploy to Heroku MUST be done first. Drafting the email is fine — sending it without a verified-live deploy is a trust violation waiting to happen.

**Signal this has gone wrong:** Bill yells "what the fuck? we sent the email to Erica and not deployed?????" — exactly what happened in Session 112. Erica got an email saying things were fixed; the code was still only on Bill's laptop. We got lucky that night because she didn't log in until after we scrambled to push, but luck is not a strategy.

**How to apply:**
1. Before drafting any user-facing "it's fixed" message, run `git log origin/main..HEAD` and `git status` to see what's still unpushed.
2. If there's unpushed work OR uncommitted changes that include the user-facing fixes, STOP. Push to Heroku first. Verify the version is live (curl `/v1/version` or hit a relevant endpoint).
3. ONLY THEN draft the email and propose it for sending.
4. If the user types-and-sends before deploy is done (because they got eager), recognize the risk immediately and either (a) deploy right now or (b) tell them clearly "deploy isn't done — should I do it now before they log in?"
5. The user almost never wants you to draft-and-send without deploy. They want both done in the right order.

**Heroku auth caveat:** Bill's `.netrc` token sometimes expires. If `heroku auth:whoami` fails, ASK Bill to run `heroku login` — don't try to fudge it with embedded creds. The auth flow takes 30 seconds and the failure mode (sending the email anyway because "auth is broken right now") is far worse than the small delay.

**Verification after deploy:** Once Heroku reports "deployed to Heroku" + "verifying deploy... done", spot-check at least ONE of the user's reported fixes via curl before saying "it's live." Don't just trust the build pipe.
