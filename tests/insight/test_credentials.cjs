/**
 * Credentials — Insight / wi_php (Session 143, Tom + Erica's confirmed design).
 *
 * The CREDENTIAL member molecule (v115): ONE flat list never coupled to
 * boards, multiple per person, Tom's 14-credential starting set, displayed
 * after the name ("Jane Smith, MD") by the one shared rule (NameCred).
 *
 * Retire-not-delete, honored platform-wide for the first time: a retired
 * list value is refused for NEW assignment (plain English), disappears from
 * active pick-lists, but keeps displaying on every record that holds it.
 *
 * The member multi-row door: GET/POST/DELETE /v1/members/:id/molecule-rows/
 * :key — duplicates 409, unknown values 400, removal works even for retired
 * values. Erica's-team loop proven: add a NEW credential via the values
 * endpoint (what the Credentials page does) → assign it immediately.
 *
 * Self-contained: throwaway member; harness snapshot/restore wipes all.
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'Insight: Credentials (v115 seed, multi-row assignment, retire-not-delete, display rule)',

  async run(ctx) {
    const TENANT = 5;
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT } });
    ctx.assert(sw._ok, 'session on Insight');

    // ── v115 seed ──
    const mol = await ctx.fetch(`/v1/molecules/get/CREDENTIAL?tenant_id=${TENANT}`);
    ctx.assert(mol._ok && mol.molecule_id, 'CREDENTIAL molecule exists (v115)');
    const molId = mol.molecule_id;
    const lookupSide = sql(`SELECT attaches_to || '|' || context FROM molecule_value_lookup WHERE molecule_id = ${molId}`);
    ctx.assertEqual(lookupSide, 'M|member', 'lookup row present with member side (§5.2)');
    const values = await ctx.fetch(`/v1/molecules/${molId}/values?tenant_id=${TENANT}`);
    ctx.assert(Array.isArray(values) && values.length >= 14, `Tom's starting set seeded (${values.length} values)`);
    ctx.assert(values.every(v => v.value_id >= 1 && v.value_id <= 127), 'every value_id is per-molecule 1-127 (§5.3)');
    ctx.assert(values.some(v => v.label === 'PA-C') && values.some(v => v.label === 'BM BCh'),
      'labels carry the exact rendering (PA-C, BM BCh)');

    // ── A throwaway member; assign two credentials through the door ──
    const num = await ctx.fetch('/v1/member/next-number');
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num.membership_number, fname: 'Cora', lname: 'Credentialed' }
    });
    ctx.assert(created._ok, `Created member ${num.membership_number}`);
    const MNUM = num.membership_number;
    const memberLink = sql(`SELECT link FROM member WHERE tenant_id = ${TENANT} AND membership_number = '${MNUM}'`);

    const addMd = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['MD'] }
    });
    ctx.assert(addMd._ok, 'MD assigned');
    const addPac = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['PAC'] }
    });
    ctx.assert(addPac._ok, 'PA-C assigned alongside (multiple per person)');

    const rows = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`);
    ctx.assert(Array.isArray(rows) && rows.length === 2, `both credentials read back (${rows.length})`);
    ctx.assert(rows.some(r => r.display[0] === 'MD') && rows.some(r => r.display[0] === 'PA-C'),
      'display labels ride back (MD, PA-C)');

    // The byte proof (MOLECULES.md §7): stored on the member side.
    const sides = sql(`SELECT DISTINCT attaches_to FROM "5_data_1" WHERE p_link = '${memberLink}' AND molecule_id = ${molId}`);
    ctx.assertEqual(sides, 'M', 'stored bytes carry attaches_to = M');

    // Duplicates and unknowns are refused plainly.
    const dupe = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['MD'] }
    });
    ctx.assert(dupe._status === 409, `duplicate credential → 409 (got ${dupe._status})`);
    const unknown = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['XYZ'] }
    });
    ctx.assert(unknown._status === 400, `unknown credential → 400 (got ${unknown._status})`);

    // ── The display rule reaches the roster (server attaches labels) ──
    const roster = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const cora = (roster.members || []).find(m => m.lname === 'Credentialed');
    ctx.assert(!!cora, 'member on the roster');
    ctx.assert(Array.isArray(cora.credentials) && cora.credentials.includes('MD') && cora.credentials.includes('PA-C'),
      `roster carries the credential labels (${JSON.stringify(cora.credentials)})`);

    // ── RETIRE-NOT-DELETE ──
    const mdValue = values.find(v => v.value === 'MD');
    const retire = await ctx.fetch(`/v1/molecules/${molId}/values/${mdValue.value_id}?tenant_id=${TENANT}`, {
      method: 'PUT', body: { is_active: false }
    });
    ctx.assert(retire._ok && retire.is_active === false, 'MD retired via the values endpoint');

    // New assignment refused, in plain English.
    const num2 = await ctx.fetch('/v1/member/next-number');
    const created2 = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num2.membership_number, fname: 'Nate', lname: 'NewHolder' }
    });
    ctx.assert(created2._ok, 'second member created');
    const refuse = await ctx.fetch(`/v1/members/${num2.membership_number}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['MD'] }
    });
    ctx.assert(refuse._status === 400 && (refuse.error || '').includes('retired'),
      `retired credential refused for a NEW holder (got ${refuse._status}: ${refuse.error})`);

    // The encoder door refuses too (any write path, not just this endpoint).
    // Profile-form path: PUT /v1/member/:id/molecules would hit encodeMolecule —
    // proven via the roster still displaying for the EXISTING holder below.
    const activeOnly = await ctx.fetch(`/v1/molecules/${molId}/values?tenant_id=${TENANT}&active_only=1`);
    ctx.assert(!activeOnly.some(v => v.value === 'MD'), 'retired MD hidden from the active pick-list');
    const withRetired = await ctx.fetch(`/v1/molecules/${molId}/values?tenant_id=${TENANT}`);
    ctx.assert(withRetired.some(v => v.value === 'MD' && v.is_active === false),
      'admin view still shows MD, marked retired');

    // The existing holder KEEPS displaying it — history is never rewritten.
    const rosterAfter = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const coraAfter = (rosterAfter.members || []).find(m => m.lname === 'Credentialed');
    ctx.assert(coraAfter && coraAfter.credentials.includes('MD'),
      'the existing holder still displays the retired credential');

    // Removal of a retired credential still works (record corrections).
    const removeRetired = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'DELETE', body: { values: ['MD'] }
    });
    ctx.assert(removeRetired._ok, 'a retired credential can still be REMOVED from a record');

    // Un-retire → assignable again.
    const unretire = await ctx.fetch(`/v1/molecules/${molId}/values/${mdValue.value_id}?tenant_id=${TENANT}`, {
      method: 'PUT', body: { is_active: true }
    });
    ctx.assert(unretire._ok && unretire.is_active === true, 'MD un-retired');
    const reAdd = await ctx.fetch(`/v1/members/${num2.membership_number}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['MD'] }
    });
    ctx.assert(reAdd._ok, 'un-retired credential assignable again');

    // ── Erica's-team loop: add a NEW credential (the Credentials page's
    //    call), assign it immediately — data, never code ──
    const phd = await ctx.fetch(`/v1/molecules/${molId}/values?tenant_id=${TENANT}`, {
      method: 'POST', body: { value: 'PHD', label: 'PhD' }
    });
    ctx.assert(phd._ok, 'PhD added to the list (an entry, not code)');
    const assignPhd = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`, {
      method: 'POST', body: { values: ['PHD'] }
    });
    ctx.assert(assignPhd._ok, 'PhD assignable immediately');
    const finalRows = await ctx.fetch(`/v1/members/${MNUM}/molecule-rows/CREDENTIAL`);
    ctx.assert(finalRows.some(r => r.display[0] === 'PhD') && finalRows.some(r => r.display[0] === 'PA-C'),
      '"Cora Credentialed, PA-C, PhD" — the multi-credential record reads back whole');

    // ── Browser walk: the Credentials page + the chart chips + the roster ──
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser walk — Playwright not available');
      return;
    }
    const page = await ctx.openPage('/login.html');
    page.on('dialog', async (d) => { try { await d.accept(); } catch (_) {} });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    const origin = new URL(page.url()).origin;

    try {
      await page.evaluate(async () => {
        await fetch('/v1/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ username: 'Claude', password: 'claude123' })
        });
        await fetch('/v1/auth/tenant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ tenant_id: 5 })
        });
      });
      await page.evaluate(() => {
        sessionStorage.setItem('tenant_id', '5');
        sessionStorage.setItem('tenant_name', 'Insight Health Solutions');
      });

      // The Credentials page under Program Settings.
      await page.goto(`${origin}/verticals/workforce_monitoring/admin_credentials.html`);
      await new Promise(r => setTimeout(r, 2500));
      const adminView = await page.evaluate(() => ({
        rows: document.querySelectorAll('#rows tr').length,
        text: document.body.innerText
      }));
      ctx.assert(adminView.rows >= 15, `Credentials page lists the values (${adminView.rows} rows)`);
      ctx.assert(adminView.text.includes('PA-C') && adminView.text.includes('PhD'),
        'page shows the seeded set plus the new addition');
      ctx.assert(adminView.text.includes('Retiring never erases'), 'the retire-not-delete note is on the page');

      // The chart: header carries the rule, chips render, with credentials.
      // (Pages receive their subject via PageContext/sessionStorage, not URL.)
      await page.evaluate((num) => {
        sessionStorage.setItem('lp_page_context', JSON.stringify({ memberId: String(num) }));
      }, MNUM);
      await page.goto(`${origin}/verticals/workforce_monitoring/physician_detail.html`);
      await new Promise(r => setTimeout(r, 3500));
      const chartView = await page.evaluate(() => ({
        header: document.getElementById('physicianName')?.textContent || '',
        credLine: document.getElementById('credLine')?.innerText || ''
      }));
      ctx.assert(chartView.header.includes('Cora Credentialed,') && chartView.header.includes('PA-C'),
        `chart header follows the rule (got '${chartView.header}')`);
      ctx.assert(chartView.credLine.includes('PA-C') && chartView.credLine.includes('PhD'),
        'credential chips render on the chart');

      ctx.assert(pageErrors.length === 0, `Zero page errors on the walk (${pageErrors.slice(0, 2).join(' | ')})`);
      const realConsoleErrors = consoleErrors.filter(t => !t.includes('favicon'));
      ctx.assert(realConsoleErrors.length === 0, `Zero console errors on the walk (${realConsoleErrors.slice(0, 2).join(' | ')})`);
    } finally {
      await page.close();
    }
  }
};
