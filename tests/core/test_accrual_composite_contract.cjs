/**
 * Core: the accrual composite contract, enforced both ways (Session 132).
 *
 * Bill's rule: the composite is the contract for POST /accruals.
 *   1. COMPLETENESS — every required molecule must be populated, or the
 *      accrual errors (built long ago; locked in here).
 *   2. CLOSURE — any caller-sent field that is NOT a molecule in the
 *      tenant's composite errors, instead of being silently discarded
 *      (built Session 132). Carry-only pipeline context (wi_php's
 *      DOMINANT_DRIVER / DOMINANT_SUBDOMAIN / PROTOCOL_CARD, consumed in
 *      flight by createRegistryItem) must be DECLARED per tenant in
 *      sysparm 'accrual_context_keys' (db v98) to pass.
 *   3. NO SPOOFING — a client-sent value for a calculated molecule is
 *      ignored; the server's own calculation is what gets stored.
 *
 * Runs on Delta (tenant 1) for the flight composite and on Insight
 * (tenant 5) for the declared-context path. Mutates the DB (control
 * accruals) — harness snapshot/restore wipes it.
 */
module.exports = {
  name: 'Core: accrual composite contract (closure + required + no-spoof)',

  async run(ctx) {
    const MEMBER = '2153442807';
    const today = new Date().toLocaleDateString('en-CA');

    const flight = (extra = {}, omit = []) => {
      const p = {
        activity_date: today, base_points: 500,
        carrier: 'DL', origin: 'MSP', destination: 'LAX',
        fare_class: 'F', seat_type: 'A', flight_number: '123', mqd: 300,
        ...extra
      };
      for (const k of omit) delete p[k];
      return p;
    };

    // ── Delta ──
    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    // 1. Control: a clean flight still posts
    ctx.log('1: control — a composite-clean flight posts');
    const ok = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, { method: 'POST', body: flight() });
    ctx.assert(ok._status === 201 && ok.link, `clean flight accepted (${ok._status})`);

    // 2. Closure: a stray field errors and nothing is saved
    ctx.log('2: closure — unknown field rejected, not silently dropped');
    const stray = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight({ CABIN_CLASS: 'suite' })
    });
    ctx.assert(stray._status === 400 && (stray.error || '').includes('CABIN_CLASS'),
      `stray field rejected by name (${stray._status}: ${(stray.error || '').substring(0, 80)})`);
    ctx.assert(!stray.link, 'rejected accrual saved nothing');

    const strayTwo = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight({ CABIN_CLASS: 'suite', PET_NAME: 'Rex' })
    });
    ctx.assert(strayTwo._status === 400 && strayTwo.error.includes('CABIN_CLASS') && strayTwo.error.includes('PET_NAME'),
      'multiple stray fields all named in one error');

    // 3. MEMBER_POINTS can't be sent directly
    const mp = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight({ MEMBER_POINTS: 99999 })
    });
    ctx.assert(mp._status === 400 && (mp.error || '').includes('base_points'),
      `direct MEMBER_POINTS rejected with base_points guidance (${mp._status})`);

    // 4. Completeness: required molecule missing → plain-English 400
    ctx.log('4: completeness — missing required molecule rejected by name');
    const missing = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight({}, ['fare_class'])
    });
    ctx.assert(missing._status === 400 && (missing.error || '').includes('FARE_CLASS'),
      `missing required FARE_CLASS rejected by name (${missing._status}: ${(missing.error || '').substring(0, 80)})`);

    // 5. No spoofing: a client-sent calculated value is ignored — the
    // server's calculation is what gets stored. AIRCRAFT_TYPE is calculated
    // from route distance; send garbage and prove it didn't stick.
    ctx.log('5: no-spoof — client-sent calculated value ignored');
    const spoof = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight({ AIRCRAFT_TYPE: 'ZZZZZZ' })
    });
    ctx.assert(spoof._status === 201 && spoof.link,
      `calculated-field key passes closure (it IS in the composite) (${spoof._status})`);
    const full = await ctx.fetch(`/v1/activities/${encodeURIComponent(spoof.link)}/full?tenant_id=1`);
    ctx.assert(full._ok && full.AIRCRAFT_TYPE !== undefined,
      `stored activity readable with AIRCRAFT_TYPE present (${full._status})`);
    ctx.assert(String(full.AIRCRAFT_TYPE) !== 'ZZZZZZ',
      `stored AIRCRAFT_TYPE is the server's calculation, not the spoof (got '${full.AIRCRAFT_TYPE}')`);

    // ── Insight (tenant 5): declared carry-only context keys ──
    ctx.log('6: Insight — declared context keys pass, strays still fail');
    const claude = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(claude._ok, 'Claude login');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: 5 } });
    ctx.assert(sw._ok, 'session on Insight');

    const insightMember = await ctx.fetch('/v1/wellness/members');
    const im = (insightMember.members || [])[0];
    ctx.assert(!!im, 'found an Insight participant');

    // The PPII-recalc shape: composite molecules + the three declared
    // carry-only keys. This is exactly what custauth's internal self-POST
    // sends — it must keep working.
    const withContext = await ctx.fetch(`/v1/members/${im.membership_number}/accruals`, {
      method: 'POST',
      body: {
        activity_date: today, base_points: 1,
        ACCRUAL_TYPE: 'EVENT', ACTIVITY_COMMENT: 'contract test event',
        DOMINANT_DRIVER: 'COMPOSITE', DOMINANT_SUBDOMAIN: 'SLEEP', PROTOCOL_CARD: 'A1'
      }
    });
    ctx.assert(withContext._status === 201,
      `declared context keys ride through (${withContext._status}${withContext.error ? ': ' + withContext.error : ''})`);

    const insightStray = await ctx.fetch(`/v1/members/${im.membership_number}/accruals`, {
      method: 'POST',
      body: { activity_date: today, base_points: 1, ACCRUAL_TYPE: 'EVENT', FOO_BAR: 'nope' }
    });
    ctx.assert(insightStray._status === 400 && (insightStray.error || '').includes('FOO_BAR'),
      `undeclared stray still rejected on Insight (${insightStray._status})`);
  }
};
