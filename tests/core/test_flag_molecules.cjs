/**
 * Core: FLAG molecules (Session 135) — the third molecule type. A flag stores
 * NO value: a row in {parent_bytes}_data_0 present = true, absent = false.
 * One creation door (createMoleculeComplete, pattern '0'), one access door
 * (setFlag/clearFlag/isFlagSet, surfaced for members as
 * GET/POST/DELETE /v1/members/:id/flags/:key), and two rule operators
 * ("is set" / "is not set").
 *
 * The acceptance scenario is Bill's FOB example: a "Friend of Bill" member
 * flag plus a percent-100 bonus with criterion "FOB is set" = double points
 * on every flight while the flag is on, normal points when it's off.
 *
 * Proves, on Delta:
 *   1. Create: /v1/molecules/complete accepts storage '0' (round-trip proven
 *      with presence semantics); rejects a flag with values / with no side.
 *   2. Flag doors: member flag GET/POST/DELETE round-trip; idempotent set;
 *      a non-flag molecule key is refused in plain English.
 *   3. Rules: percent-100 bonus with "FOB is set" — no flag → normal points,
 *      flag on → double, flag off again → normal. "is not set" inverts.
 *   4. Test rig evaluates member flags without a saved activity.
 *   5. Browser: create page shows the Flag form (no columns/values/reference);
 *      criteria editor offers ONLY is set / is not set for a flag and hides
 *      the value box; the member profile's Flags area lists FOB and its tick
 *      really sets/clears the flag (system flags like IS_DELETED excluded).
 *
 * Mutates Delta config + accruals — harness snapshot/restore wipes it.
 */
module.exports = {
  name: 'Core: FLAG molecules (create, set/clear, "is set" rules — FOB double points)',

  async run(ctx) {
    const MEMBER = '2153442807';
    // RT_-prefixed like the other test molecules — Bill's real FOB flag lives
    // in Delta config now, and the test must never collide with real config.
    const KEY = 'RT_FOB';
    const today = new Date().toLocaleDateString('en-CA');

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    // ── 1. Create the FOB member flag through the one routine ──
    ctx.log('1: create the FOB member flag (storage pattern 0)');
    const created = await ctx.fetch('/v1/molecules/complete', {
      method: 'POST',
      body: { molecule_key: KEY, label: 'RT Friend of Bill', molecule_type: 'D', attaches_to: 'M', storage_size: '0' }
    });
    ctx.assert(created._ok, `FOB flag created (${created._status}${created.error ? ': ' + created.error : ''})`);
    ctx.assert(created.round_trip && created.round_trip.proven === true,
      'round-trip proven with presence semantics (set → confirm → clear → confirm absent)');

    const badValues = await ctx.fetch('/v1/molecules/complete', {
      method: 'POST',
      body: { molecule_key: 'RT_FOB_BAD1', label: 'x', attaches_to: 'M', storage_size: '0', values: [{ value: 'A' }] }
    });
    ctx.assert(badValues._status === 400 && /stores nothing/.test(badValues.error || ''),
      'a flag with list values is rejected in plain English');

    const badNoSide = await ctx.fetch('/v1/molecules/complete', {
      method: 'POST',
      body: { molecule_key: 'RT_FOB_BAD2', label: 'x', storage_size: '0' }
    });
    ctx.assert(badNoSide._status === 400 && /needs a side/.test(badNoSide.error || ''),
      'a 5-byte flag with no side is rejected in plain English');

    // ── 2. The member flag doors ──
    ctx.log('2: member flag ask/set/clear doors');
    const before = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`);
    ctx.assert(before._ok && before.set === false, 'flag reads as not set before anything happens');

    const setResp = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'POST' });
    ctx.assert(setResp._ok && setResp.set === true, 'flag set');

    const setAgain = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'POST' });
    ctx.assert(setAgain._ok, 'setting an already-set flag is a harmless no-op');

    const afterSet = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`);
    ctx.assert(afterSet._ok && afterSet.set === true, 'flag reads back as set');

    const notAFlag = await ctx.fetch(`/v1/members/${MEMBER}/flags/FARE_CLASS`, { method: 'POST' });
    ctx.assert(notAFlag._status === 400 && /not a flag/.test(notAFlag.error || ''),
      'a non-flag molecule key is refused in plain English');

    const flagList = await ctx.fetch(`/v1/members/${MEMBER}/flags`);
    const fobRow = (flagList.flags || []).find(f => f.key === KEY);
    ctx.assert(flagList._ok && !!fobRow && fobRow.set === true,
      'the member flag list includes FOB with its current state');
    ctx.assert(!(flagList.flags || []).some(f => f.key === 'IS_DELETED'),
      'system flags (IS_DELETED) are not offered as profile flags');

    const clearResp = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'DELETE' });
    ctx.assert(clearResp._ok && clearResp.was_set === true, 'flag cleared (and it had been set)');
    const afterClear = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`);
    ctx.assert(afterClear._ok && afterClear.set === false, 'flag reads as not set after clearing');

    // ── 3. FOB double points — percent-100 bonus gated on "FOB is set" ──
    ctx.log('3: FOBDOUBLE percent-100 bonus with criterion "FOB is set"');
    const bonusResp = await ctx.fetch('/v1/bonuses', {
      method: 'POST',
      body: {
        tenant_id: 1,
        bonus_code: 'FOBDOUBLE',
        bonus_description: 'Friend of Bill — double points',
        bonus_type: 'percent',
        bonus_amount: 100,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        is_active: true,
        apply_sunday: true, apply_monday: true, apply_tuesday: true,
        apply_wednesday: true, apply_thursday: true, apply_friday: true, apply_saturday: true
      }
    });
    ctx.assert(bonusResp._ok, 'FOBDOUBLE bonus created');
    const bonusId = bonusResp.bonus?.bonus_id || bonusResp.bonus_id || bonusResp.id;

    const crit = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`, {
      method: 'POST',
      body: { source: 'Member', molecule: KEY, operator: 'IS SET', label: 'RT Friend of Bill' }
    });
    ctx.assert(crit._ok, `"FOB is set" criterion saved with no value (${crit._status}${crit.error ? ': ' + crit.error : ''})`);

    const critList = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`);
    ctx.assert(Array.isArray(critList) && critList.length === 1 && critList[0].operator === 'IS SET',
      'criterion reads back with the presence operator');

    const flight = { activity_date: today, base_points: 500, carrier: 'DL', origin: 'MSP', destination: 'LAX', fare_class: 'F', seat_type: 'A', flight_number: '123', mqd: 300 };

    // Flag off → no FOB bonus
    const offAccrual = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, { method: 'POST', body: flight });
    ctx.assert(offAccrual._status === 201, 'flight without the flag accepted');
    ctx.assert(!(offAccrual.bonuses || []).some(b => b.bonus_code === 'FOBDOUBLE'),
      'FOBDOUBLE did NOT fire while the flag is off');

    // Flag on → double. Delta computes base miles from the route (the request's
    // base_points is ignored), so "double" = bonus equals the computed base.
    await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'POST' });
    const onAccrual = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, { method: 'POST', body: flight });
    ctx.assert(onAccrual._status === 201, 'flight with the flag accepted');
    const fired = (onAccrual.bonuses || []).find(b => b.bonus_code === 'FOBDOUBLE');
    ctx.assert(!!fired, 'FOBDOUBLE FIRED while the flag is on');
    if (fired) ctx.assertEqual(Number(fired.bonus_points), Number(onAccrual.base_points),
      '100% of the computed base = the base again (double total)');

    // Flag off again → back to normal
    await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'DELETE' });
    const offAgain = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, { method: 'POST', body: flight });
    ctx.assert(offAgain._status === 201 && !(offAgain.bonuses || []).some(b => b.bonus_code === 'FOBDOUBLE'),
      'clearing the flag stops the bonus again');

    // ── 4. Test rig + "is not set" ──
    ctx.log('4: test rig sees member flags; "is not set" inverts');
    const rigOff = await ctx.fetch('/v1/test-rule/FOBDOUBLE', {
      method: 'POST', body: { member_id: MEMBER, activity_date: today, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' }
    });
    ctx.assert(rigOff._ok && rigOff.pass === false, 'test rig: flag off → rule fails');

    await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'POST' });
    const rigOn = await ctx.fetch('/v1/test-rule/FOBDOUBLE', {
      method: 'POST', body: { member_id: MEMBER, activity_date: today, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' }
    });
    ctx.assert(rigOn._ok && rigOn.pass === true, 'test rig: flag on → rule passes');

    // Flip the criterion to IS NOT SET — the same states invert
    const critId = critList[0].id;
    const flip = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria/${critId}`, {
      method: 'PUT',
      body: { source: 'Member', molecule: KEY, operator: 'IS NOT SET', label: 'Not a friend of Bill' }
    });
    ctx.assert(flip._ok, '"is not set" criterion saved via PUT with no value');

    const rigInverted = await ctx.fetch('/v1/test-rule/FOBDOUBLE', {
      method: 'POST', body: { member_id: MEMBER, activity_date: today, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' }
    });
    ctx.assert(rigInverted._ok && rigInverted.pass === false, '"is not set" with the flag on → rule fails (inverted)');

    await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`, { method: 'DELETE' });
    const rigInverted2 = await ctx.fetch('/v1/test-rule/FOBDOUBLE', {
      method: 'POST', body: { member_id: MEMBER, activity_date: today, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' }
    });
    ctx.assert(rigInverted2._ok && rigInverted2.pass === true, '"is not set" with the flag off → rule passes');

    // ── 5. Browser walks ──
    if (ctx.hasBrowser()) {
      ctx.log('5: browser — create page Flag form + criteria editor presence operators');
      const page = await ctx.openPage('/menu.html');
      const errors = [];
      page.on('pageerror', e => errors.push(String(e.message || e)));
      await page.evaluate(async () => {
        await fetch('/v1/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: 'DeltaADMIN', password: 'DeltaADMIN' })
        });
      });
      await page.evaluate(() => {
        sessionStorage.setItem('tenant_id', '1');
        sessionStorage.setItem('tenant_name', 'Delta');
      });
      const origin = new URL(page.url()).origin;

      // Create page: picking Flag shows the flag form and hides everything else
      await page.goto(`${origin}/admin_molecule_edit.html`);
      await page.waitForTimeout(1500);
      const createForm = await page.evaluate(() => {
        const sel = document.getElementById('moleculeType');
        sel.value = 'flag';
        sel.dispatchEvent(new Event('change'));
        return {
          hasFlagOption: Array.from(sel.options).some(o => o.value === 'flag'),
          flagVisible: !document.getElementById('flagSection').classList.contains('hidden'),
          columnsHidden: document.getElementById('columnDefsSection').classList.contains('hidden'),
          referenceHidden: document.getElementById('referenceConfig').classList.contains('hidden'),
          valuesHidden: document.getElementById('listValuesSection').classList.contains('hidden')
        };
      });
      ctx.assert(createForm.hasFlagOption, 'create page offers the Flag type');
      ctx.assert(createForm.flagVisible && createForm.columnsHidden && createForm.referenceHidden && createForm.valuesHidden,
        'Flag mode shows the flag form and hides columns/reference/values');

      // Criteria editor: a flag molecule offers ONLY is set / is not set, no value box
      await page.goto(`${origin}/admin_bonus_edit.html?id=${bonusId}`);
      await page.waitForTimeout(2500);
      const editor = await page.evaluate(async (key) => {
        CriteriaEditor.openDialog(null);
        document.getElementById('criteriaSource').value = 'Member';
        CriteriaEditor.updateMoleculeOptions();
        await new Promise(r => setTimeout(r, 400));
        const sel = document.getElementById('criteriaMolecule');
        sel.value = key;
        if (!sel.value) sel.value = key.toLowerCase();
        await CriteriaEditor.onMoleculeChange();
        const ops = Array.from(document.getElementById('criteriaOperator').options).map(o => o.value);
        const valueHidden = document.getElementById('valueContainer').style.display === 'none';
        return { ops, valueHidden };
      }, KEY);
      ctx.assert(editor.ops.length === 2 && editor.ops.includes('IS SET') && editor.ops.includes('IS NOT SET'),
        `flag molecule offers only the presence operators (${editor.ops.join(',')})`);
      ctx.assert(editor.valueHidden, 'the value box is hidden for a flag criterion');

      // A normal molecule still gets the standard operators
      const standard = await page.evaluate(async () => {
        const sel = document.getElementById('criteriaMolecule');
        for (const opt of sel.options) {
          if (opt.value.toLowerCase() === 'tier') { sel.value = opt.value; break; }
        }
        await CriteriaEditor.onMoleculeChange();
        return Array.from(document.getElementById('criteriaOperator').options).map(o => o.value);
      });
      ctx.assert(standard.length > 2 && standard.includes('equals') && !standard.includes('IS SET'),
        'a non-flag molecule keeps the standard operator list');

      // Member profile: the Flags area shows FOB and a tick actually flips it
      await page.goto(`${origin}/csr_member.html?memberId=${MEMBER}`);
      await page.waitForTimeout(2000);
      await page.evaluate(() => switchTab('profile'));
      await page.waitForTimeout(2000);
      const flagsArea = await page.evaluate((key) => {
        const section = document.getElementById('flagsSection');
        const tick = document.querySelector(`.member-flag-tick[data-flag-key="${key}"]`);
        return {
          visible: section && section.style.display !== 'none',
          hasTick: !!tick,
          checked: tick ? tick.checked : null
        };
      }, KEY);
      ctx.assert(flagsArea.visible && flagsArea.hasTick, 'the profile shows a Flags area with the FOB tick');
      ctx.assert(flagsArea.checked === false, 'the tick reflects the current state (off)');

      await page.evaluate((key) => {
        const tick = document.querySelector(`.member-flag-tick[data-flag-key="${key}"]`);
        tick.click();
      }, KEY);
      await page.waitForTimeout(1200);
      const afterTick = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`);
      ctx.assert(afterTick._ok && afterTick.set === true, 'ticking the box on the profile really set the flag');

      await page.evaluate((key) => {
        document.querySelector(`.member-flag-tick[data-flag-key="${key}"]`).click();
      }, KEY);
      await page.waitForTimeout(1200);
      const afterUntick = await ctx.fetch(`/v1/members/${MEMBER}/flags/${KEY}`);
      ctx.assert(afterUntick._ok && afterUntick.set === false, 'unticking it really cleared the flag');

      ctx.assert(errors.length === 0, `no page errors during the walks (${errors.join('; ').substring(0, 100)})`);
      await page.close();
    } else {
      ctx.log('5: browser not available — UI walks skipped');
    }
  }
};
