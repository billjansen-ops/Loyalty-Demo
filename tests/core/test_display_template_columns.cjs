/**
 * Core: display-template column references (Session 134).
 *
 * The platform-wide molecule contract, applied to templates: a template
 * molecule reference names a molecule and optionally a column; no column
 * means column 1. Migration v100 stamped every existing reference to an
 * explicit column 1.
 *
 * Proves, against real Delta data over the live timeline endpoint:
 *   1. The stamped explicit-column-1 templates render exactly as before
 *      (regression: CARRIER/ORIGIN/etc. all still appear).
 *   2. A reference to column 2 of a BUNDLED molecule renders that column's
 *      value — MEMBER_POINTS (storage 54: bucket link + amount) is on every
 *      flight, so "Pts: [M,MEMBER_POINTS,2]" must equal the flight's points.
 *      This is the round-trip Bill asked for: the value lives in a
 *      multi-column storage table the single-cell display fetch never reads;
 *      the renderer must fetch it through the molecule helpers.
 *   3. The safety net: a reference WITHOUT a column number still renders
 *      (column 1 assumed) — old/hand-written template lines can't break.
 *
 * Mutates the Delta A/E display template via the API — the harness
 * snapshot/restore wipes it.
 */
module.exports = {
  name: 'Core: display template column references (bundled molecule renders by column)',

  async run(ctx) {
    const MEMBER = '2153442807';

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    const getFlights = async () => {
      const r = await ctx.fetch(`/v1/member/${MEMBER}/activities?tenant_id=1&limit=100`);
      const list = r.activities || r || [];
      return list.filter(a => a.activity_type === 'A' && Array.isArray(a.magic_box_efficient) && a.magic_box_efficient.length);
    };
    const flat = (a) => a.magic_box_efficient.map(l => l.value).join(' | ').replace(/&nbsp;/g, ' ');

    // ── 1. Regression: stamped explicit-column-1 templates render as before ──
    ctx.log('1: stamped [M,KEY,1,...] references render the same values');
    const before = await getFlights();
    ctx.assert(before.length > 0, `member has rendered flights (${before.length})`);
    const probe = before[0];
    const beforeLine = flat(probe);
    ctx.assert(/Carrier:\s*\S+/.test(beforeLine), `carrier renders through explicit column 1 (${beforeLine.substring(0, 60)}...)`);
    ctx.assert(beforeLine.includes('Origin:') && beforeLine.includes('Destination:'),
      'origin + destination render through explicit column 1');

    // ── 2. Column 2 of a bundled molecule renders that column's value ──
    ctx.log('2: [M,MEMBER_POINTS,2,"Code"] renders the points amount from the multi-column table');
    const tpls = await ctx.fetch('/v1/display-templates');
    const tpl = (tpls || []).find(t => t.activity_type === 'A' && t.template_type === 'E' && t.is_active);
    ctx.assert(!!tpl, 'found the active Delta flight Efficient template');

    const full = await ctx.fetch(`/v1/display-templates/${tpl.template_id}`);
    ctx.assert(Array.isArray(full.lines) && full.lines.length > 0, 'template has lines');
    const lines = full.lines.map(l => ({ line_number: l.line_number, template_string: l.template_string }));
    lines.push({ line_number: 90, template_string: '[T,"Pts: "],[M,MEMBER_POINTS,2,"Code"]' });
    lines.push({ line_number: 95, template_string: '[T,"NC: "],[M,CARRIER,"Code"]' }); // no column — safety net

    const put = await ctx.fetch(`/v1/display-templates/${tpl.template_id}`, {
      method: 'PUT',
      body: { template_name: full.template_name, template_type: 'E', activity_type: 'A', lines }
    });
    ctx.assert(put._ok, 'template updated with a column-2 reference + a no-column reference');

    const after = await getFlights();
    const same = after.find(a => a.link === probe.link) || after[0];
    const afterAll = flat(same);

    const ptsMatch = afterAll.match(/Pts:\s*(\d+)/);
    ctx.assert(!!ptsMatch, `the column-2 line rendered a number (${afterAll.substring(0, 120)}...)`);
    if (ptsMatch) {
      ctx.assertEqual(parseInt(ptsMatch[1]), Number(same.base_points),
        'column 2 of MEMBER_POINTS equals the flight\'s points');
    }

    // ── 3. Safety net: a no-column reference still renders (column 1 assumed) ──
    ctx.log('3: a reference with NO column number renders as column 1');
    const ncMatch = afterAll.match(/NC:\s*([A-Z0-9]+)/);
    ctx.assert(!!ncMatch, 'no-column CARRIER reference rendered');
    if (ncMatch) {
      ctx.assert(/^[A-Z0-9]{2}$/.test(ncMatch[1]), `no-column reference gave the carrier code (${ncMatch[1]})`);
    }

    // The pre-existing lines must be untouched by the additions
    ctx.assert(afterAll.includes('Carrier:') && afterAll.includes('Origin:'),
      'original template lines still render alongside the new ones');

    // ── 4. Browser walk: the line builder's column picker ──
    if (ctx.hasBrowser()) {
      ctx.log('4: browser walk — the line builder parses stamped lines and shows the column picker');
      const page = await ctx.openPage('/menu.html');
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));

      // Rebind the browser session to Delta (mirrors test_csr_ui_walk)
      await page.evaluate(async () => {
        await fetch('/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: 'DeltaADMIN', password: 'DeltaADMIN' })
        });
      });
      await page.evaluate(() => {
        sessionStorage.setItem('tenant_id', '1');
        sessionStorage.setItem('tenant_name', 'Delta');
      });
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/admin_activity_display_template_edit.html?id=${tpl.template_id}`);
      await page.waitForTimeout(1500);

      // Open the first line in the builder — its stamped [M,KEY,1,...] parts
      // must parse into components (no silent drop of molecule references)
      await page.click('button.btn-edit');
      await page.waitForTimeout(500);
      const compRows = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#componentsBody tr')).length);
      ctx.assert(compRows > 1, `stamped line parsed into ${compRows} components in the builder`);

      // Open the molecule form; select the bundled molecule; the column
      // dropdown must offer its columns
      await page.evaluate(() => showMoleculeForm());
      await page.evaluate(() => {
        const sel = document.getElementById('moleculeKey');
        sel.value = 'MEMBER_POINTS';
        return populateColumnOptions();
      });
      await page.waitForTimeout(700);
      const colOptions = await page.evaluate(() =>
        Array.from(document.getElementById('moleculeColumn').options).map(o => o.value));
      ctx.assert(colOptions.length === 2 && colOptions[1] === '2',
        `column picker offers the bundled molecule's columns (${colOptions.join(',')})`);

      // Single-column molecule → exactly one option
      await page.evaluate(() => {
        const sel = document.getElementById('moleculeKey');
        sel.value = 'CARRIER';
        return populateColumnOptions();
      });
      await page.waitForTimeout(400);
      const carrierCols = await page.evaluate(() =>
        Array.from(document.getElementById('moleculeColumn').options).map(o => o.value));
      ctx.assert(carrierCols.length === 1 && carrierCols[0] === '1',
        'single-column molecule pins the picker to column 1');

      ctx.assert(errors.length === 0, `no page errors during the builder walk (${errors.join('; ').substring(0, 100)})`);
      await page.close();
    } else {
      ctx.log('4: browser not available — builder walk skipped');
    }
  }
};
