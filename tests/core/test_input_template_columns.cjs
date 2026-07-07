/**
 * Core: input-template column references (Session 134) — the entry half of
 * the molecule contract ("molecule + column, column 1 default"), closing the
 * loop the display half opened:
 *
 *   enter a bundled molecule's values by column  →  stored as ONE row
 *   →  displayed by column on the timeline.
 *
 * Proves:
 *   1. A bundled (multi-column) activity molecule created through the one
 *      create routine and wired into the A composite accepts an ARRAY
 *      payload on POST /accruals — each element encoded by its own column's
 *      rules — and the display templates then render each column.
 *   2. input_template_field.column_number round-trips through the template
 *      CRUD endpoints.
 *   3. Browser: the add-activity form renders a column-2 field as its own
 *      input and getFormData assembles the array payload.
 *
 * Mutates Delta config (molecule, composite row, templates) — the harness
 * snapshot/restore wipes all of it.
 */
module.exports = {
  name: 'Core: input template column references (enter by column → one row → display by column)',

  async run(ctx) {
    const MEMBER = '2153442807';
    const KEY = 'RT_ITC_BUNDLE';
    const today = new Date().toLocaleDateString('en-CA');

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' }
    });
    ctx.assert(login._ok, 'DeltaADMIN login');

    // ── 1. Create a bundled molecule and wire it into the A composite ──
    ctx.log('1: bundled molecule (list + numeric) created + wired into the A composite');
    const created = await ctx.fetch('/v1/molecules/complete', {
      method: 'POST',
      body: {
        // storage '22' on purpose: 5_data_22 exists in the snapshot, so this
        // test never creates a table (pg_restore can't drop tables that
        // aren't in the snapshot — see test_molecule_create's cleanup note).
        molecule_key: KEY, label: 'RT input-column bundle', molecule_type: 'D',
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

    // ── 2. POST an accrual with the array payload (enter by column) ──
    ctx.log('2: accrual accepts the bundled array payload — each element by its own column');
    const post = await ctx.fetch(`/v1/members/${MEMBER}/accruals`, {
      method: 'POST',
      body: {
        activity_date: today, base_points: 500,
        carrier: 'DL', origin: 'MSP', destination: 'LAX',
        fare_class: 'F', seat_type: 'A', flight_number: '123', mqd: 300,
        [KEY]: ['UA', 42]
      }
    });
    ctx.assert(post._status === 201 && post.link,
      `accrual with bundled array accepted (${post._status}${post.error ? ': ' + post.error : ''})`);

    // ── 3. Display templates render each column of the stored row ──
    ctx.log('3: the stored row displays by column on the timeline');
    const tpls = await ctx.fetch('/v1/display-templates');
    const tpl = (tpls || []).find(t => t.activity_type === 'A' && t.template_type === 'E' && t.is_active);
    ctx.assert(!!tpl, 'found the active Delta flight Efficient template');
    const full = await ctx.fetch(`/v1/display-templates/${tpl.template_id}`);
    const lines = full.lines.map(l => ({ line_number: l.line_number, template_string: l.template_string }));
    lines.push({ line_number: 90, template_string: `[T,"Bundle: "],[M,${KEY},1,"Code"],[T,"/"],[M,${KEY},2,"Code"]` });
    const put = await ctx.fetch(`/v1/display-templates/${tpl.template_id}`, {
      method: 'PUT',
      body: { template_name: full.template_name, template_type: 'E', activity_type: 'A', lines }
    });
    ctx.assert(put._ok, 'display template gained the two column references');

    const acts = await ctx.fetch(`/v1/member/${MEMBER}/activities?tenant_id=1&limit=100`);
    const list = acts.activities || acts || [];
    const mine = list.find(a => a.link === post.link);
    ctx.assert(!!mine, 'the new accrual is on the timeline');
    const flatLines = (mine?.magic_box_efficient || []).map(l => l.value).join(' | ').replace(/&nbsp;/g, ' ');
    ctx.assert(/Bundle:\s*UA\/42/.test(flatLines),
      `column 1 and column 2 both render from the one stored row (${flatLines.substring(0, 140)}...)`);

    // ── 4. column_number round-trips through the input-template endpoints ──
    ctx.log('4: input_template_field.column_number survives the CRUD round trip');
    const active = await ctx.fetch('/v1/input-templates/active?activity_type=A&tenant_id=1');
    ctx.assert(active._ok && Array.isArray(active.fields), 'active Delta A input template loaded');
    const inFields = active.fields.map(f => ({
      row_number: f.row_number, molecule_key: f.molecule_key, column_number: f.column_number || 1,
      start_position: f.start_position, display_width: f.display_width, field_width: f.field_width,
      enterable: f.enterable, system_generated: f.system_generated, is_required: f.is_required,
      display_label: f.display_label, sort_order: f.sort_order
    }));
    ctx.assert(inFields.every(f => f.column_number === 1), 'every existing field reads as column 1 (the default)');
    inFields.push({
      row_number: 99, molecule_key: KEY, column_number: 1, start_position: 1, display_width: 40,
      field_width: null, enterable: 'Y', system_generated: null, is_required: false,
      display_label: 'Bundle color', sort_order: 1
    });
    inFields.push({
      row_number: 99, molecule_key: KEY, column_number: 2, start_position: 45, display_width: 40,
      field_width: null, enterable: 'Y', system_generated: null, is_required: false,
      display_label: 'Bundle count', sort_order: 2
    });
    const putTpl = await ctx.fetch(`/v1/input-templates/${active.template_id}`, {
      method: 'PUT',
      body: { template_name: active.template_name, activity_type: 'A', fields: inFields }
    });
    ctx.assert(putTpl._ok, `input template saved with per-column fields (${putTpl._status}${putTpl.error ? ': ' + putTpl.error : ''})`);
    const reread = await ctx.fetch(`/v1/input-templates/${active.template_id}`);
    const colField = (reread.fields || []).find(f => f.molecule_key === KEY && f.column_number === 2);
    ctx.assert(!!colField, 'the column-2 field read back with its column number');

    // ── 5. Browser: the form renders the per-column fields and assembles the array ──
    if (ctx.hasBrowser()) {
      ctx.log('5: browser walk — the add-activity form collects the bundle by column');
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
      await page.goto(`${origin}/add_activity.html?memberId=${MEMBER}`);
      await page.waitForTimeout(3000);

      const hasCol2 = await page.evaluate(() =>
        !!document.querySelector(`input[data-molecule="RT_ITC_BUNDLE"][data-column="2"]`));
      ctx.assert(hasCol2, 'the column-2 field rendered as its own input');

      const assembled = await page.evaluate(() => {
        const col1 = document.querySelector('[data-molecule="RT_ITC_BUNDLE"][data-column="1"], select[data-molecule="RT_ITC_BUNDLE"]');
        const col2 = document.querySelector('input[data-molecule="RT_ITC_BUNDLE"][data-column="2"]');
        if (col1) col1.value = col1.tagName === 'SELECT' ? (col1.options[1] ? col1.options[1].value : 'RED') : 'RED';
        if (col2) col2.value = '7';
        return templateRenderer.getFormData()['RT_ITC_BUNDLE'];
      });
      ctx.assert(Array.isArray(assembled) && assembled.length === 2 && String(assembled[1]) === '7',
        `getFormData assembled the array payload (${JSON.stringify(assembled)})`);

      ctx.assert(errors.length === 0, `no page errors during the form walk (${errors.join('; ').substring(0, 100)})`);

      // ── 6. The template editor page: actions visible without scrolling +
      //      column picker reads "number — column name" ──
      ctx.log('6: editor page — fixed action bar + labeled column picker');
      await page.goto(`${origin}/admin_input_template_edit.html?id=${active.template_id}`);
      await page.waitForTimeout(2000);

      const saveVisible = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.fixed-actions .btn'));
        const save = btns.find(b => b.textContent.includes('Save Template'));
        if (!save) return { found: false };
        const r = save.getBoundingClientRect();
        return { found: true, inViewport: r.top >= 0 && r.bottom <= window.innerHeight };
      });
      ctx.assert(saveVisible.found && saveVisible.inViewport,
        'Save Template button is on-screen without scrolling (fixed action bar)');

      const colLabel = await page.evaluate(async () => {
        editRow(0); // open the first row in the builder modal
        await new Promise(r => setTimeout(r, 1200)); // let column labels load + re-render
        // Find the select whose label says "Column"
        const groups = Array.from(document.querySelectorAll('.field-entry .form-group'));
        const colGroup = groups.find(g => g.querySelector('label')?.textContent.trim() === 'Column');
        const colSel = colGroup?.querySelector('select');
        return colSel ? Array.from(colSel.options).map(o => o.textContent.trim()) : null;
      });
      ctx.assert(Array.isArray(colLabel) && colLabel.length >= 1 && / — /.test(colLabel[0]),
        `column picker shows "number — name" (${(colLabel || []).join(' | ').substring(0, 80)})`);

      ctx.assert(errors.length === 0, `no page errors during the editor walk (${errors.join('; ').substring(0, 100)})`);
      await page.close();
    } else {
      ctx.log('5: browser not available — form walk skipped');
    }
  }
};
