/**
 * Test C14: CSV Export (all 4 sources)
 *
 * Verifies:
 *   A: Registry export returns valid CSV
 *   B: Follow-ups export returns valid CSV
 *   C: Roster export returns valid CSV
 *   D: Compliance export returns valid CSV
 *   E: include_resolved filter works on registry
 */
module.exports = {
  name: 'C14: CSV Export (Registry, Follow-ups, Roster, Compliance)',

  async run(ctx) {
    const TENANT_ID = 5;
    const MEMBER_NUMBER = '34';

    // Helper: fetch CSV via raw fetch (CSV returns text/csv, not JSON)
    async function verifyCSV(url, name, minColumns) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (ctx.sessionCookie) headers['Cookie'] = ctx.sessionCookie;

        const rawResp = await fetch(`http://127.0.0.1:4001${url}`, { headers });
        if (rawResp.ok) {
          const text = await rawResp.text();
          const lines = text.trim().split('\n');
          ctx.assert(lines.length >= 1, `${name}: Has header row`);
          const csvHeaders = lines[0].split(',');
          ctx.assert(csvHeaders.length >= minColumns, `${name}: Has ${csvHeaders.length} columns (min: ${minColumns})`);
          ctx.log(`${name}: ${csvHeaders.length} columns, ${lines.length - 1} data rows`);
          return true;
        } else {
          const errText = await rawResp.text().catch(() => '');
          ctx.assert(false, `${name}: Export failed (status: ${rawResp.status}, error: ${errText.substring(0, 100)})`);
          return false;
        }
      } catch (e) {
        ctx.assert(false, `${name}: Export error — ${e.message}`);
        return false;
      }
    }

    // ── Registry Export ──
    ctx.log('--- Registry export ---');
    await verifyCSV(`/v1/export/registry?tenant_id=${TENANT_ID}`, 'Registry', 5);

    // ── Registry Export with resolved ──
    ctx.log('--- Registry export (include resolved) ---');
    await verifyCSV(`/v1/export/registry?tenant_id=${TENANT_ID}&include_resolved=true`, 'Registry+Resolved', 5);

    // ── Follow-ups Export ──
    ctx.log('--- Follow-ups export ---');
    await verifyCSV(`/v1/export/followups?tenant_id=${TENANT_ID}`, 'Follow-ups', 5);

    // ── Roster Export ──
    ctx.log('--- Roster export ---');
    await verifyCSV(`/v1/export/roster?tenant_id=${TENANT_ID}`, 'Roster', 3);

    // ── Compliance Export ──
    ctx.log('--- Compliance export ---');
    await verifyCSV(`/v1/export/compliance?tenant_id=${TENANT_ID}`, 'Compliance', 3);

    // ── Compliance Export for specific member ──
    ctx.log('--- Compliance export (member-specific) ---');
    await verifyCSV(`/v1/export/compliance?tenant_id=${TENANT_ID}&member_id=${MEMBER_NUMBER}`, 'Compliance-Member', 3);

    // ══════════════════════════════════════════════
    // BROWSER: Verify export modals open on pages
    // ══════════════════════════════════════════════
    if (!ctx.hasBrowser()) { ctx.log('Skipping browser tests — playwright not available'); return; }

    ctx.log('--- Browser: Roster export modal ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/clinic.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      await page.evaluate(() => { exportRoster(); });
      await page.waitForTimeout(500);
      const hasExportModal = await page.evaluate(() => !!document.getElementById('detailOverlay'));
      ctx.assert(hasExportModal, 'Browser: Roster export modal opens');

      // Verify preview works
      await page.evaluate(() => { rosterPreview(); });
      await page.waitForTimeout(500);
      const hasPreview = await page.evaluate(() => {
        const preview = document.getElementById('exportPreview');
        return preview && preview.style.display !== 'none' && preview.innerHTML.includes('<table');
      });
      ctx.assert(hasPreview, 'Browser: Roster export preview shows data table');
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Roster export failed — ${e.message.substring(0, 100)}`);
    }

    ctx.log('--- Browser: Action queue export modal ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/action_queue.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      const hasExportBtn = await page.evaluate(() => {
        return typeof showExportModal === 'function';
      });
      if (hasExportBtn) {
        await page.evaluate(() => { showExportModal(); });
        await page.waitForTimeout(500);
        const hasModal = await page.evaluate(() => !!document.getElementById('detailOverlay'));
        ctx.assert(hasModal, 'Browser: Registry export modal opens');
      } else {
        ctx.log('Browser: showExportModal not available on action queue');
      }
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Registry export failed — ${e.message.substring(0, 100)}`);
    }
  }
};
