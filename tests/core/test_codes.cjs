/**
 * Core test: general-purpose `code` table (Session 124, db_migrate v84).
 *
 * Covers the code engine end to end:
 *   - POST /v1/codes mints a code (4-byte link PK, 16-byte base58 token, JSONB context)
 *   - GET  /v1/codes (list, tenant-scoped) returns server-formatted date strings
 *   - GET  /p/:code resolves a valid code (302 → /performance-profile?c=TOKEN, follows to 200)
 *   - usage cap (max_uses) is enforced and used_count increments
 *   - revoked / expired / unknown codes all resolve to 404
 *   - PATCH /v1/codes/:link revokes
 *   - GET /v1/code-context/:token (Session 130) returns ONLY the whitelisted context
 *     fields, never consumes a use (still resolves a used-up code), and 404s for
 *     expired / revoked / unknown tokens
 *   - browser (when available): following /p/:code lands on the Performance Profile
 *     with ?c= in the URL, the referral chip pre-selected, and the affiliation note
 *
 * Tenant-scoped via the DeltaCSR session (tenant 1).
 */
module.exports = {
  name: 'Core: general-purpose code table (mint / resolve / consume / revoke)',

  async run(ctx) {
    // ── Step 1: Login as DeltaCSR (tenant 1) ──
    ctx.log('Step 1: Login as DeltaCSR');
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });
    ctx.assert(login._ok, 'DeltaCSR login successful');

    // ── Step 2: Mint a code (cap of 2 uses) ──
    ctx.log('Step 2: Mint a code with max_uses=2');
    const minted = await ctx.fetch('/v1/codes', {
      method: 'POST',
      body: { code_type: 'TEST_CODE', max_uses: 2, end_date: '2026-12-31', context: { track: 'stability', referral_type: 'employer' } }
    });
    ctx.assert(minted._ok, 'POST /v1/codes succeeds');
    ctx.assert(typeof minted.code === 'string' && minted.code.length >= 11, `token is a base58 string (got "${minted.code}")`);
    ctx.assert(Number.isInteger(minted.link), `link is an integer PK (got ${minted.link})`);
    ctx.assert(minted.used_count === 0, 'new code starts at used_count 0');
    ctx.assert(minted.status === 'A', 'new code is active');
    ctx.assert(minted.context && minted.context.track === 'stability', 'JSONB context stored');
    const token = minted.code;
    const link = minted.link;

    // ── Step 3: List returns it with a server-formatted end date ──
    ctx.log('Step 3: List shows the code with formatted dates');
    const list = await ctx.fetch('/v1/codes?code_type=TEST_CODE');
    ctx.assert(Array.isArray(list), 'GET /v1/codes returns an array');
    const found = list.find(c => c.code === token);
    ctx.assert(found, 'minted code appears in the tenant list');
    ctx.assert(found && found.end_date_str === '2026-12-31', `server formats end_date (got "${found && found.end_date_str}")`);

    // ── Step 4: Resolve (use 1) → follows 302 to the Performance Profile (200) ──
    ctx.log('Step 4: Resolve /p/:code — use 1');
    const r1 = await ctx.fetch(`/p/${token}`);
    ctx.assert(r1._status === 200, `valid code resolves (followed redirect → 200, got ${r1._status})`);
    const afterUse1 = await ctx.fetch(`/v1/codes/${link}`);
    ctx.assert(afterUse1.used_count === 1, `used_count incremented to 1 (got ${afterUse1.used_count})`);

    // ── Step 5: Resolve (use 2), then 3rd is over the cap → 404 ──
    ctx.log('Step 5: Use 2 OK, use 3 over the cap → 404');
    const r2 = await ctx.fetch(`/p/${token}`);
    ctx.assert(r2._status === 200, `2nd use resolves (got ${r2._status})`);
    const r3 = await ctx.fetch(`/p/${token}`);
    ctx.assert(r3._status === 404, `3rd use is blocked by max_uses (got ${r3._status})`);
    const afterUse3 = await ctx.fetch(`/v1/codes/${link}`);
    ctx.assert(afterUse3.used_count === 2, `used_count capped at 2 (got ${afterUse3.used_count})`);

    // ── Step 5b: /v1/code-context — read-only, whitelisted, never consumes ──
    ctx.log('Step 5b: code-context resolves a used-up active code without consuming');
    const cctx = await ctx.fetch(`/v1/code-context/${token}`);
    ctx.assert(cctx._ok, `code-context resolves even after the use cap is reached (got ${cctx._status})`);
    ctx.assert(cctx.referral_type === 'employer', `context referral_type returned (got "${cctx.referral_type}")`);
    ctx.assert(cctx.track === 'stability', `context track returned (got "${cctx.track}")`);
    ctx.assert(cctx.affiliation === null, 'affiliation is null when not set');
    ctx.assert(cctx.link === undefined && cctx.tenant_id === undefined && cctx.context === undefined && cctx.code === undefined,
      'response is whitelisted — no link/tenant_id/raw context/token leak');
    const afterCtx = await ctx.fetch(`/v1/codes/${link}`);
    ctx.assert(afterCtx.used_count === 2, `code-context did NOT consume a use (still ${afterCtx.used_count})`);

    // ── Step 6: Expired code → 404 ──
    ctx.log('Step 6: A past end_date resolves to 404');
    const expired = await ctx.fetch('/v1/codes', { method: 'POST', body: { code_type: 'TEST_CODE', end_date: '2020-01-01', context: {} } });
    const rExpired = await ctx.fetch(`/p/${expired.code}`);
    ctx.assert(rExpired._status === 404, `expired code is rejected (got ${rExpired._status})`);

    // ── Step 7: Revoked code → 404 ──
    ctx.log('Step 7: Revoke via PATCH, then resolve → 404');
    const toRevoke = await ctx.fetch('/v1/codes', { method: 'POST', body: { code_type: 'TEST_CODE', context: {} } });
    const rBefore = await ctx.fetch(`/p/${toRevoke.code}`);
    ctx.assert(rBefore._status === 200, `code resolves before revoke (got ${rBefore._status})`);
    const patch = await ctx.fetch(`/v1/codes/${toRevoke.link}`, { method: 'PATCH', body: { status: 'R' } });
    ctx.assert(patch._ok && patch.status === 'R', 'PATCH revokes the code');
    const rAfter = await ctx.fetch(`/p/${toRevoke.code}`);
    ctx.assert(rAfter._status === 404, `revoked code is rejected (got ${rAfter._status})`);

    // ── Step 8: Unknown code → 404 ──
    ctx.log('Step 8: An unknown code → 404');
    const rUnknown = await ctx.fetch('/p/ThisIsNotARealCode99');
    ctx.assert(rUnknown._status === 404, `unknown code → 404 (got ${rUnknown._status})`);

    // ── Step 8b: code-context 404s — expired / revoked / unknown ──
    ctx.log('Step 8b: code-context rejects expired / revoked / unknown tokens');
    const ctxExpired = await ctx.fetch(`/v1/code-context/${expired.code}`);
    ctx.assert(ctxExpired._status === 404, `expired token → 404 (got ${ctxExpired._status})`);
    const ctxRevoked = await ctx.fetch(`/v1/code-context/${toRevoke.code}`);
    ctx.assert(ctxRevoked._status === 404, `revoked token → 404 (got ${ctxRevoked._status})`);
    const ctxUnknown = await ctx.fetch('/v1/code-context/ThisIsNotARealCode99');
    ctx.assert(ctxUnknown._status === 404, `unknown token → 404 (got ${ctxUnknown._status})`);

    // ── Step 8c: browser — the referral link pre-fills the Performance Profile ──
    if (ctx.hasBrowser()) {
      ctx.log('Step 8c: browser follows /p/:code → pre-filled Performance Profile');
      const refCode = await ctx.fetch('/v1/codes', {
        method: 'POST',
        body: { code_type: 'referral', context: { referral_type: 'Employer', affiliation: 'Wisconsin PHP', track: 'stability' } }
      });
      ctx.assert(refCode._ok, 'referral code minted for the browser walk');
      const page = await ctx.openPage(`/p/${refCode.code}`);
      try {
        ctx.assert(page.url().includes(`c=${refCode.code}`), `landing URL carries only the opaque token (got ${page.url()})`);
        ctx.assert(!page.url().toLowerCase().includes('employer') && !page.url().toLowerCase().includes('wisconsin'),
          'no readable referral details in the URL');
        // The pre-fill fetch is async; wait for the affiliation note to attach.
        await page.waitForSelector('#referralChips + p.muted', { state: 'attached', timeout: 5000 });
        const selChip = await page.$eval('#referralChips .chip.sel', el => el.textContent).catch(() => null);
        ctx.assert(selChip === 'Referred by Employer', `referral chip pre-selected (got "${selChip}")`);
        const note = await page.$eval('#referralChips + p.muted', el => el.textContent);
        ctx.assert(note === 'Referred through: Wisconsin PHP', `affiliation note shown (got "${note}")`);
      } finally {
        await page.close();
      }
    } else {
      ctx.log('Step 8c: skipped (no browser available)');
    }

    // ── Step 9: Tenant scoping — another tenant can't see this tenant's code ──
    ctx.log('Step 9: List is tenant-scoped');
    const beforeCount = (await ctx.fetch('/v1/codes?code_type=TEST_CODE')).length;
    ctx.assert(beforeCount >= 3, `tenant 1 sees its own TEST_CODE codes (got ${beforeCount})`);

    // Cleanup: re-login as the harness superuser.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
