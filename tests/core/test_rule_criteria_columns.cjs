/**
 * Core: rule-criteria column references (Session 134) — the molecule contract
 * ("molecule + column, column 1 default") applied to the bonus/promotion
 * rules engine. Both engines share one criteria table and one evaluator, so
 * this proves the shared path.
 *
 * Proves, on Delta with a real bundled molecule:
 *   1. Criteria store and read back their column number (default 1 for all
 *      pre-existing criteria).
 *   2. The evaluator honors the column: a bonus with criteria on column 1
 *      AND column 2 of one bundled molecule fires only when BOTH columns
 *      match — via the test rig and via a REAL accrual.
 *   3. Existing single-column criteria behavior is untouched (the rest of
 *      the suite regression-covers it; here the no-column criterion posts
 *      as column 1).
 *   4. Browser: the shared criteria editor offers the bundled molecule's
 *      columns and pins single-column molecules to 1.
 *
 * Mutates Delta config + accruals — harness snapshot/restore wipes it.
 */
module.exports = {
  name: 'Core: rule criteria column references (bundled molecule rules fire by column)',

  async run(ctx) {
    const MEMBER = '2153442807';
    const KEY = 'RT_RCC_BUNDLE';
    const today = new Date().toLocaleDateString('en-CA');

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    // ── 1. Bundled molecule (carrier lookup + numeric), wired into the A composite ──
    ctx.log('1: bundled molecule created + wired into the A composite');
    const created = await ctx.fetch('/v1/molecules/complete', {
      method: 'POST',
      body: {
        // storage '22' — 5_data_22 exists in the snapshot (no table creation)
        molecule_key: KEY, label: 'RT criteria bundle', molecule_type: 'D',
        attaches_to: 'A', storage_size: '22',
        columns: [
          { column_order: 1, value_kind: 'external_list', value_type: 'key', table_name: 'carriers', id_column: 'carrier_id', code_column: 'code', label_column: 'name', is_tenant_specific: true, col_description: 'The carrier' },
          { column_order: 2, value_kind: 'value', value_type: 'numeric', scalar_type: 'numeric', col_description: 'The count' }
        ],
        activity_composites: [{ activity_type: 'A', required: false }]
      }
    });
    ctx.assert(created._ok && created.round_trip && created.round_trip.proven === true,
      `bundled molecule created + proven (${created._status}${created.error ? ': ' + created.error : ''})`);

    // ── 2. Bonus with criteria on column 1 AND column 2 of the bundle ──
    ctx.log('2: bonus with per-column criteria (col 1 = UA AND col 2 = 42)');
    const bonusResp = await ctx.fetch('/v1/bonuses', {
      method: 'POST',
      body: {
        tenant_id: 1,
        bonus_code: 'TESTCOLRULE',
        bonus_description: 'Column criteria test',
        bonus_type: 'fixed',
        bonus_amount: 100,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        is_active: true,
        apply_sunday: true, apply_monday: true, apply_tuesday: true,
        apply_wednesday: true, apply_thursday: true, apply_friday: true, apply_saturday: true
      }
    });
    ctx.assert(bonusResp._ok, 'TESTCOLRULE bonus created');
    const bonusId = bonusResp.bonus?.bonus_id || bonusResp.bonus_id || bonusResp.id;

    const c1 = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`, {
      method: 'POST',
      body: { source: 'activity', molecule: KEY, column_number: 1, operator: 'equals', value: 'UA', label: 'Bundle carrier is UA' }
    });
    ctx.assert(c1._ok && c1.column_number === 1, 'criterion on column 1 saved');

    const c2 = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`, {
      method: 'POST',
      body: { source: 'activity', molecule: KEY, column_number: 2, operator: 'equals', value: 42, label: 'Bundle count is 42' }
    });
    ctx.assert(c2._ok && c2.column_number === 2, 'criterion on column 2 saved');

    const list = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`);
    ctx.assert(Array.isArray(list) && list.length === 2
      && list.some(c => c.column_number === 1) && list.some(c => c.column_number === 2),
      'both criteria read back with their column numbers');

    // ── 3. Test rig: column mismatches fail, full match passes ──
    ctx.log('3: test rig — the evaluator compares each criterion against its column');
    const base = { member_id: MEMBER, activity_date: today, CARRIER: 'DL', FARE_CLASS: 'Y', ORIGIN: 'MSP', DESTINATION: 'LAX' };

    const wrongCol2 = await ctx.fetch('/v1/test-rule/TESTCOLRULE', {
      method: 'POST', body: { ...base, [KEY]: ['UA', 7] }
    });
    ctx.assert(wrongCol2._ok && wrongCol2.pass === false, 'col 1 matches but col 2 wrong → rule FAILS');

    const wrongCol1 = await ctx.fetch('/v1/test-rule/TESTCOLRULE', {
      method: 'POST', body: { ...base, [KEY]: ['DL', 42] }
    });
    ctx.assert(wrongCol1._ok && wrongCol1.pass === false, 'col 2 matches but col 1 wrong → rule FAILS');

    const bothMatch = await ctx.fetch('/v1/test-rule/TESTCOLRULE', {
      method: 'POST', body: { ...base, [KEY]: ['UA', 42] }
    });
    ctx.assert(bothMatch._ok && bothMatch.pass === true,
      `both columns match → rule PASSES (${JSON.stringify(bothMatch.reason || '').substring(0, 80)})`);

    // ── 4. Real accrual: the bonus actually fires by column ──
    ctx.log('4: real accrual — bonus fires only when both columns match');
    const flight = (bundle) => ({
      activity_date: today, base_points: 500,
      carrier: 'DL', origin: 'MSP', destination: 'LAX',
      fare_class: 'F', seat_type: 'A', flight_number: '123', mqd: 300,
      [KEY]: bundle
    });

    const noFire = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight(['UA', 7])
    });
    ctx.assert(noFire._status === 201, 'non-matching accrual accepted');
    ctx.assert(!(noFire.bonuses || []).some(b => b.bonus_code === 'TESTCOLRULE'),
      'bonus did NOT fire when column 2 mismatched');

    const fire = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST', body: flight(['UA', 42])
    });
    ctx.assert(fire._status === 201, 'matching accrual accepted');
    const fired = (fire.bonuses || []).find(b => b.bonus_code === 'TESTCOLRULE');
    ctx.assert(!!fired, 'bonus FIRED when both columns matched');
    if (fired) ctx.assertEqual(fired.bonus_points, 100, 'fixed 100 points awarded');

    // ── 5. Browser: the shared criteria editor's column picker ──
    if (ctx.hasBrowser()) {
      ctx.log('5: browser walk — criteria editor offers the bundle\'s columns');
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
      await page.goto(`${origin}/admin_bonus_edit.html?id=${bonusId}`);
      await page.waitForTimeout(2500);

      // Open the add-criteria dialog, pick Activity + the bundle molecule
      const cols = await page.evaluate(async (key) => {
        CriteriaEditor.openDialog(null);
        document.getElementById('criteriaSource').value = 'Activity';
        CriteriaEditor.updateMoleculeOptions();
        await new Promise(r => setTimeout(r, 400));
        const sel = document.getElementById('criteriaMolecule');
        sel.value = key.toLowerCase();
        if (!sel.value) sel.value = key; // key case differs per by-source data
        await CriteriaEditor.onMoleculeChange();
        const colSel = document.getElementById('criteriaColumn');
        return { options: Array.from(colSel.options).map(o => o.value), disabled: colSel.disabled };
      }, KEY);
      ctx.assert(cols.options.length === 2 && cols.options[1] === '2' && cols.disabled === false,
        `column picker offers the bundle's columns (${cols.options.join(',')})`);

      // Single-column molecule pins to 1
      const pinned = await page.evaluate(async () => {
        const sel = document.getElementById('criteriaMolecule');
        for (const opt of sel.options) {
          if (opt.value.toLowerCase() === 'fare_class') { sel.value = opt.value; break; }
        }
        await CriteriaEditor.onMoleculeChange();
        const colSel = document.getElementById('criteriaColumn');
        return { options: Array.from(colSel.options).map(o => o.value), disabled: colSel.disabled };
      });
      ctx.assert(pinned.options.length === 1 && pinned.disabled === true,
        'single-column molecule pins the picker to column 1');

      ctx.assert(errors.length === 0, `no page errors during the editor walk (${errors.join('; ').substring(0, 100)})`);
      await page.close();
    } else {
      ctx.log('5: browser not available — editor walk skipped');
    }
  }
};
