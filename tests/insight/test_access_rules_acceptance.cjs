/**
 * ACCESS-RULES ACCEPTANCE — the Story 4 exit (Session 166).
 * Erica's PI2_Document_Access_Rules spec §9: "The standing gate releases
 * when every Blocking criterion passes. Each criterion is a testable
 * behavior; the build team demonstrates each against a test program
 * before real documents enter the repository."
 *
 * This test IS that demonstration, run against the WPHP Exploration
 * sandbox (tenant 7 — a copied tenant, so it also proves nothing here is
 * Wisconsin-only). Every Blocking criterion AC-1..AC-8 is walked end to
 * end, including Story 4's break-glass procedure (spec §7.1 / D-5):
 *
 *   AC-1  No permission → no content and no metadata, server-side.
 *   AC-2  Program scoping holds for every role incl. IHS Technical Staff.
 *   AC-3  Portal-visibility gates (release plumbing — no portal exists
 *         yet; the released_date gate and its one-way logged action are
 *         the criterion's enforceable core today).
 *   AC-4  Registrant boundary + explicit promotion.
 *   AC-5  Audit-before-serve: failed audit write blocks content.
 *   AC-6  Tier 2 never bulk-exports; export events written.
 *   AC-7  Legal hold: no deletion path, H-restricted, reason recorded.
 *   AC-8  IHS lockout + break-glass: grant recorded IN ADVANCE by the
 *         MEDICAL DIRECTOR AND BY NO OTHER ROLE (Rev 1.1 D-12), covers
 *         content AND metadata incl. the audit log, notification fired
 *         (counts only — no titles), scoped unlock, distinct audit
 *         events, 24-hour expiry, revocable by either notified role.
 *   AC-10 (Blocking since Rev 1.1) a superseded document stays
 *         retrievable, version history intact, by exactly the §6.1
 *         intersection roles — walked here at Tier 3; the full per-tier
 *         resolution is proven in test_document_access.cjs.
 *   AC-11 (Rev 1.1) no tier-less state: an unclassified upload IS a
 *         Tier 2 document — stored, read, and enforced.
 *   AC-12 (Rev 1.1) lifecycle status only narrows matrix access, never
 *         expands it.
 *
 * (AC-9 tier-change logging is Standard priority — proven in
 * test_document_access.cjs.)
 *
 * Self-contained: throwaway logins, probe documents, mode restored; the
 * harness snapshot/restore backstops everything.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): every test-owned Client carries the machine-zone
  // pin. Standing rule applied across the suite in S168 after the
  // unpinned test_manual_meds Client went red in the IST-morning window.
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

module.exports = {
  name: 'Insight: access-rules acceptance (AC-1..AC-8 incl. break-glass — story 4)',

  async run(ctx) {
    const SB = 7;   // the test program: WPHP Exploration sandbox
    const WI = 5;   // the other program, for the AC-2 cross-program probe
    const B64 = Buffer.from('acceptance probe file').toString('base64');
    const stamp = Math.floor(Math.random() * 1e9);
    const PW = 'qa-ac-166!';

    const asClaude = async (tenant) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(l._ok, 'Claude login');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant } });
      ctx.assert(sw._ok, `Claude on tenant ${tenant}`);
    };
    const as = async (username, fn) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username, password: PW } });
      ctx.assert(l._ok, `Logged in as ${username}`);
      const out = await fn();
      await asClaude(SB);
      return out;
    };
    const mkDoc = (title, type_code, member_number) => ctx.fetch('/v1/documents', {
      method: 'POST',
      body: { title, file_format: 'txt', file_base64: B64,
              ...(type_code ? { type_code } : {}), ...(member_number ? { member_number } : {}) }
    });

    const db = new Client(DB_CONFIG);
    await db.connect();
    try {
      // ════════════════ PHASE A — furniture, under mode 'open' ════════════════
      await asClaude(SB);
      const cfg0 = await ctx.fetch('/v1/document-access');
      ctx.assert(cfg0._ok && cfg0.mode === 'open', `Sandbox starts in mode 'open' (got ${cfg0.mode})`);

      const dStd = await mkDoc(`AC Std ${stamp}`, 'CONSENT');
      const dLab = await mkDoc(`AC Lab ${stamp}`, 'LAB');
      const dOrg = await mkDoc(`AC Org ${stamp}`, 'CONTRACT');
      const dU = await mkDoc(`AC Unclassified ${stamp}`, null);
      ctx.assert(dStd._ok && dLab._ok && dOrg._ok && dU._ok, 'Four probe documents filed on the test program');
      const linkStd = dStd.document.link, linkLab = dLab.document.link,
            linkOrg = dOrg.document.link, linkU = dU.document.link;

      // The OTHER program's document, for AC-2.
      await asClaude(WI);
      const dWi = await mkDoc(`AC CrossProgram ${stamp}`, 'CONSENT');
      ctx.assert(dWi._ok, 'A document filed in the OTHER program (Wisconsin)');
      const linkWi = dWi.document.link;
      await asClaude(SB);

      // Throwaway staff on the sandbox: plain, MD, CM, PA — and the IHS
      // technical person (a superuser login, the break-glass grantee).
      const mk = (name, role) => ctx.fetch('/v1/users', {
        method: 'POST', body: { username: name, password: PW, display_name: name, tenant_id: SB, role }
      });
      const uPlain = await mk(`qa_ac_plain_${stamp}`, 'csr');
      const uMd = await mk(`qa_ac_md_${stamp}`, 'csr');
      const uCm = await mk(`qa_ac_cm_${stamp}`, 'csr');
      const uPa = await mk(`qa_ac_pa_${stamp}`, 'admin');
      const uIhs = await mk(`qa_ac_ihs_${stamp}`, 'superuser');
      ctx.assert(uPlain._ok && uMd._ok && uCm._ok && uPa._ok && uIhs._ok,
        'Five throwaway logins created (incl. the IHS superuser)');

      const partners = await ctx.fetch(`/v1/partners?tenant_id=${SB}`);
      const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${SB}`);
      const gMd = await ctx.fetch(`/v1/users/${uMd.user_id}/molecule-rows/POSITIONCLINIC`, {
        method: 'POST', body: { values: ['MEDDIR', programs[0].program_id] } });
      const gCm = await ctx.fetch(`/v1/users/${uCm.user_id}/molecule-rows/POSITIONCLINIC`, {
        method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] } });
      ctx.assert(gMd._ok && gCm._ok, 'Positions granted (MEDDIR, CASEMAN)');

      // A true registrant through the real public door (AC-4 furniture).
      const regCode = await ctx.fetch(`/v1/codes?tenant_id=${SB}`, {
        method: 'POST', body: { code_type: 'registration', context: { target: '/register', referral_type: 'Self-referral' } }
      });
      ctx.assert(regCode._ok && regCode.code, 'Minted a registration code on the sandbox');
      const rawPost = async (p, body, cookie) => {
        const r = await fetch(`${ctx.apiBase}${p}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
          body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        data._status = r.status; data._ok = r.ok;
        return data;
      };
      const REG_FNAME = `Accept${stamp}`;
      const reg = await rawPost('/v1/register', {
        code: regCode.code, fname: REG_FNAME, lname: 'Criteria', email: `ac${stamp}@qa.test`
      });
      ctx.assert(reg._ok, 'Public registration created a registrant on the test program');
      const regRow = (await db.query(
        `SELECT membership_number FROM member WHERE tenant_id = $1 AND fname = $2 AND lname = 'Criteria'`,
        [SB, REG_FNAME])).rows[0];
      ctx.assert(!!regRow, `Registrant has a member record (#${regRow?.membership_number})`);
      const RNUM = regRow.membership_number;

      // The registrant's lab report — marked at birth (AC-4).
      const dReg = await mkDoc(`AC Registrant Lab ${stamp}`, 'LAB', RNUM);
      ctx.assert(dReg._ok && dReg.document.registrant_doc === true,
        'AC-4: a document uploaded for a registrant is marked registrant AT BIRTH');
      const linkReg = dReg.document.link;
      const fileReg = await ctx.fetch(`/v1/documents/${linkReg}`, { method: 'PATCH', body: { status: 'F' } });
      ctx.assert(fileReg._ok, 'The registrant document files normally (administrative work continues)');

      // Audit coordinates (the sandbox's document audit table).
      const ks = (await db.query(
        `SELECT key_size FROM audit_entity_type WHERE tenant_id = $1 AND table_name = 'document'`, [SB])).rows[0].key_size;
      const auditTable = `audit_log_${ks}`;
      const auditCount = async (action) =>
        parseInt((await db.query(`SELECT COUNT(*) FROM ${auditTable} WHERE action = $1`, [action])).rows[0].count);

      // ════════════════ PHASE B — mode 'rules': the criteria ════════════════
      const flip = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } });
      ctx.assert(flip._ok && flip.mode === 'rules', "Test program flipped to 'rules'");

      // ── AC-1: no permission → no content AND no metadata, server-side ──
      const plain = await as(`qa_ac_plain_${stamp}`, async () => {
        const list = await ctx.fetch('/v1/documents');
        const card = await ctx.fetch(`/v1/documents/${linkLab}`);
        const file = await ctx.fetch(`/v1/documents/${linkLab}/file`);
        const edit = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { title: 'sneak' } });
        const up = await mkDoc(`AC plain up ${stamp}`, null);
        return { n: (list.documents || []).length, card: card._status, file: file._status, edit: edit._status, up: up._status };
      });
      ctx.assert(plain.n === 0, 'AC-1: a role without permission gets an EMPTY list — no metadata');
      ctx.assert(plain.card === 404 && plain.file === 404 && plain.edit === 404,
        'AC-1: card/file/edit all 404 — enforcement is server-side, indistinguishable from not-found');
      ctx.assert(plain.up === 403, 'AC-1: and no upload');

      // ── AC-2: program scoping, every role incl. IHS ──
      const md2 = await as(`qa_ac_md_${stamp}`, async () => {
        const other = await ctx.fetch(`/v1/documents/${linkWi}`);
        const own = await ctx.fetch(`/v1/documents/${linkStd}`);
        return { other: other._status, own: own._status };
      });
      ctx.assert(md2.other === 404 && md2.own === 200,
        "AC-2: the other program's document 404s for the MD; the own program's serves");

      // ── AC-4: the registrant boundary under rules ──
      const cm4 = await as(`qa_ac_cm_${stamp}`, async () => {
        const chart = await ctx.fetch(`/v1/documents?member=${RNUM}`);
        const cabinet = await ctx.fetch(`/v1/documents?member=${RNUM}&include_registrant=1`);
        return {
          chartHas: (chart.documents || []).some(d => d.link === linkReg),
          cabinetHas: (cabinet.documents || []).some(d => d.link === linkReg)
        };
      });
      ctx.assert(!cm4.chartHas, 'AC-4: the chart (clinical surface) NEVER shows the registrant document');
      ctx.assert(cm4.cabinetHas, 'AC-4: the filing cabinet (administrative, asks explicitly) shows it');

      const act = await as(`qa_ac_md_${stamp}`, () => ctx.fetch('/v1/participant-activations', {
        method: 'POST', body: { membership_number: RNUM, program_id: programs[0].program_id } }));
      ctx.assert(act._ok && act.registrant_document_count === 1,
        `AC-4: activation moved NOTHING and counted the waiting document (got ${act.registrant_document_count})`);
      const mBefore = await auditCount('M');
      const promote = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkReg}/promote`, { method: 'POST', body: {} }));
      ctx.assert(promote._ok && promote.document.registrant_doc === false,
        'AC-4: the explicit review action promotes it to the chart');
      ctx.assert((await auditCount('M')) === mBefore + 1, "AC-4: promotion wrote its distinct audit event ('M')");

      // Post-activation, a new upload is an ordinary chart document — the
      // Tier-1 contrast row for the AC-6 export.
      const corr = await as(`qa_ac_cm_${stamp}`, async () => {
        const up = await mkDoc(`AC Member Corr ${stamp}`, 'CORR', RNUM);
        const filed = up._ok ? await ctx.fetch(`/v1/documents/${up.document.link}`, { method: 'PATCH', body: { status: 'F' } }) : { _ok: false };
        return { up, filed };
      });
      ctx.assert(corr.up._ok && corr.up.document.registrant_doc === false && corr.filed._ok,
        'AC-4: a post-activation upload is an ordinary chart document (no registrant mark) — filed');

      // ── AC-3: the release gate (the portal's future read) ──
      const paRel = await as(`qa_ac_pa_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkReg}/release`, { method: 'POST', body: {} }));
      ctx.assert(paRel._status === 403, 'AC-3: PA cannot release (MD/CM only)');
      const rBefore = await auditCount('R');
      const rel = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkReg}/release`, { method: 'POST', body: {} }));
      ctx.assert(rel._ok && rel.document.released === true,
        'AC-3: the MD release action stamps the document participant-visible');
      ctx.assert((await auditCount('R')) === rBefore + 1, "AC-3: release wrote its distinct audit event ('R')");
      const reRel = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkReg}/release`, { method: 'POST', body: {} }));
      ctx.assert(reRel._status === 409, 'AC-3: a release is recorded ONCE (second refuses)');

      // Raw fetches with their own cookie (CSV bodies, non-JSON answers).
      let rawCookie = null;
      const rawLogin = async (username, password) => {
        const r = await fetch(`${ctx.apiBase}/v1/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const sc = r.headers.get('set-cookie');
        if (sc) rawCookie = sc.split(';')[0];
        return r.ok;
      };
      const rawGet = async (p) => {
        const r = await fetch(`${ctx.apiBase}${p}`, { headers: rawCookie ? { Cookie: rawCookie } : {} });
        return { status: r.status, text: await r.text() };
      };

      // ── AC-7: legal hold — no deletion path, H-restricted, reason required ──
      await rawLogin(`qa_ac_md_${stamp}`, PW);
      const delTry = await fetch(`${ctx.apiBase}/v1/documents/${linkStd}`, {
        method: 'DELETE', headers: { Cookie: rawCookie } });
      ctx.assert(delTry.status === 404, 'AC-7: there is NO document delete door at all (route does not exist, even authenticated)');
      const cmHold = await as(`qa_ac_cm_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'no' } }));
      ctx.assert(cmHold._status === 403, 'AC-7: CM cannot place a hold (H = MD + PA)');
      const noReason = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true } }));
      ctx.assert(noReason._status === 400, 'AC-7: a hold without a reason refuses (§7.2: reason recorded)');
      const hold = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'Board inquiry — QA acceptance walk' } }));
      ctx.assert(hold._ok && hold.document.legal_hold === true && hold.document.hold_reason === 'Board inquiry — QA acceptance walk',
        'AC-7: MD places the hold with its reason recorded on the document');

      // ════════════════ AC-8 — the IHS lockout and break-glass ════════════════
      const IHS = `qa_ac_ihs_${stamp}`;
      const ihsLocked = await as(IHS, async () => {
        const list = await ctx.fetch('/v1/documents');
        const card = await ctx.fetch(`/v1/documents/${linkLab}`);
        const file = await ctx.fetch(`/v1/documents/${linkLab}/file`);
        const up = await mkDoc(`AC ihs up ${stamp}`, null);
        const selfGrant = await ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: IHS, document_links: [linkLab], reason: 'self', approval_reference: 'self' } });
        const grants = await ctx.fetch('/v1/break-glass');
        return { n: (list.documents || []).length, card: card._status, file: file._status,
                 up: up._status, selfGrant: selfGrant._status, myGrants: (grants.grants || []).length };
      });
      ctx.assert(ihsLocked.n === 0, 'AC-8: IHS Technical Staff (superuser) sees NO documents under rules');
      ctx.assert(ihsLocked.card === 404 && ihsLocked.file === 404,
        'AC-8: card and file 404 for the superuser — no content, no metadata, no oracle');
      ctx.assert(ihsLocked.up === 403, 'AC-8: the superuser cannot upload either');
      ctx.assert(ihsLocked.selfGrant === 403,
        'AC-8: a superuser CANNOT record their own grant — the program opens the door');
      ctx.assert(ihsLocked.myGrants === 0, 'AC-8: and holds no grants yet');

      // A plain staff login cannot administer grants either.
      const plainGrant = await as(`qa_ac_plain_${stamp}`, () =>
        ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: IHS, document_links: [linkLab], reason: 'x', approval_reference: 'x' } }));
      ctx.assert(plainGrant._status === 403, 'AC-8: plain staff cannot record a grant (403)');

      // Rev 1.1 D-12: the Medical Director ALONE records a grant — the
      // Program Administrator cannot ("an operations role should not be
      // able to open it alone"), though the PA revokes freely (proven
      // below). The grant-list door tells each screen which it may do.
      const paGrant = await as(`qa_ac_pa_${stamp}`, async () => {
        const rec = await ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: IHS, document_links: [linkLab], reason: 'x', approval_reference: 'x' } });
        const list = await ctx.fetch('/v1/break-glass');
        return { rec: rec._status, err: rec.error || '', can_record: list.can_record, can_revoke: list.can_revoke };
      });
      ctx.assert(paGrant.rec === 403 && paGrant.err.includes('Medical Director alone'),
        'AC-8 (D-12): the PA CANNOT record a grant — MD alone, said in plain English');
      ctx.assert(paGrant.can_record === false && paGrant.can_revoke === true,
        'AC-8 (D-12): the grant door tells the PA screen: no record form, revoke allowed');
      const mdCaps = await as(`qa_ac_md_${stamp}`, () => ctx.fetch('/v1/break-glass'));
      ctx.assert(mdCaps.can_record === true && mdCaps.can_revoke === true,
        'AC-8 (D-12): and tells the MD screen: record and revoke both');

      // The MD records the grant — scoped to ONE named document.
      const nBefore = parseInt((await db.query(
        `SELECT COUNT(*) FROM notification WHERE tenant_id = $1 AND event_type = 'BREAK_GLASS_GRANT'`, [SB])).rows[0].count);
      const badDoc = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: IHS, document_links: [999999999], reason: 'x', approval_reference: 'x' } }));
      ctx.assert(badDoc._status === 404, 'AC-8: a grant naming a nonexistent document refuses');
      const notSu = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: `qa_ac_plain_${stamp}`, document_links: [linkLab], reason: 'x', approval_reference: 'x' } }));
      ctx.assert(notSu._status === 400, 'AC-8: the grantee must be an IHS (superuser) login');
      const grant = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch('/v1/break-glass', {
          method: 'POST', body: { grantee_username: IHS, document_links: [linkLab],
            reason: 'Support incident: verifying upload corruption', approval_reference: `Approved by program MD, ticket QA-${stamp}` } }));
      ctx.assert(grant._ok && grant.grant.state === 'active' && grant.grant.documents.length === 1,
        'AC-8: the program (MD) records a grant scoped to ONE named document');
      const grantLink = grant.grant.link;

      // The automatic notification reached the program's MD AND PA.
      const nRows = await db.query(
        `SELECT recipient_user_id, body FROM notification WHERE tenant_id = $1 AND event_type = 'BREAK_GLASS_GRANT' ORDER BY notification_id`, [SB]);
      ctx.assert(nRows.rows.length > nBefore, `AC-8: the grant fired notifications (${nBefore} → ${nRows.rows.length})`);
      const recip = new Set(nRows.rows.map(r => r.recipient_user_id));
      ctx.assert(recip.has(uMd.user_id) && recip.has(uPa.user_id),
        'AC-8: both the Medical Director (position) and Program Administrator (admin) were notified');
      // The notification content rule (Erica, 2026-08-04): counts only —
      // no document titles, no reason text; a title can name a substance
      // or a result. The full grant lives on the Emergency Access screen.
      const nBody = nRows.rows[nRows.rows.length - 1].body || '';
      ctx.assert(!nBody.includes(`AC Lab ${stamp}`) && nBody.includes('1 document'),
        'AC-8: the notification carries a COUNT, never a document title');

      // The grant unlocks EXACTLY the named document — view + download only.
      const bBefore = await auditCount('B'), gBefore = await auditCount('G');
      const ihsGranted = await as(IHS, async () => {
        const list = await ctx.fetch('/v1/documents');
        const card = await ctx.fetch(`/v1/documents/${linkLab}`);
        const file = await ctx.fetch(`/v1/documents/${linkLab}/file`);
        const other = await ctx.fetch(`/v1/documents/${linkStd}`);
        const cross = await ctx.fetch(`/v1/documents/${linkWi}`);
        const edit = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { title: 'sneak' } });
        const grants = await ctx.fetch('/v1/break-glass');
        return { links: (list.documents || []).map(d => d.link), card: card._status, file: file._status,
                 other: other._status, cross: cross._status, edit: edit._status, myGrants: (grants.grants || []).length };
      });
      ctx.assert(ihsGranted.links.length === 1 && ihsGranted.links[0] === linkLab,
        'AC-8: the finder lists the superuser EXACTLY the granted document — nothing else');
      ctx.assert(ihsGranted.card === 200 && ihsGranted.file === 200,
        'AC-8: the granted document opens (view + download)');
      ctx.assert(ihsGranted.other === 404, 'AC-8: an UN-named document in the same program still 404s');
      ctx.assert(ihsGranted.cross === 404, "AC-2/AC-8: the other program's document still 404s even under grant");
      ctx.assert(ihsGranted.edit === 403, 'AC-8: break-glass is view and download ONLY — edit refuses');
      ctx.assert(ihsGranted.myGrants === 1, 'AC-8: the superuser sees their own active grant');
      ctx.assert((await auditCount('B')) === bBefore + 1 && (await auditCount('G')) === gBefore + 1,
        "AC-8: every break-glass open wrote its DISTINCT audit event ('B' view, 'G' download)");

      // Expiry: 24 hours, checked at read time — simulate the clock.
      await db.query(`UPDATE break_glass_grant SET expires_ts = expires_ts - 8641 WHERE link = $1`, [grantLink]);
      const ihsExpired = await as(IHS, async () => {
        const card = await ctx.fetch(`/v1/documents/${linkLab}`);
        const list = await ctx.fetch('/v1/documents');
        return { card: card._status, n: (list.documents || []).length };
      });
      ctx.assert(ihsExpired.card === 404 && ihsExpired.n === 0,
        'AC-8: at hour 25 the door is simply shut — expiry is a read-time comparison, no timer to break');
      await db.query(`UPDATE break_glass_grant SET expires_ts = expires_ts + 8641 WHERE link = $1`, [grantLink]);

      // Revoke: the program shuts the door early; a revoked grant stays
      // shut. Rev 1.1: revocation is deliberately LESS restricted than
      // granting — the PA (who cannot record) revokes freely, and the
      // revocation writes its own audit event on the grant.
      const bgKs = (await db.query(
        `SELECT key_size FROM audit_entity_type WHERE tenant_id = $1 AND table_name = 'break_glass_grant'`, [SB])).rows[0].key_size;
      const bgRevBefore = parseInt((await db.query(
        `SELECT COUNT(*) FROM audit_log_${bgKs} a JOIN audit_entity_type t ON t.link = a.p_link
         WHERE t.tenant_id = $1 AND t.table_name = 'break_glass_grant' AND a.action = 'E'`, [SB])).rows[0].count);
      const revoke = await as(`qa_ac_pa_${stamp}`, () =>
        ctx.fetch(`/v1/break-glass/${grantLink}/revoke`, { method: 'POST' }));
      ctx.assert(revoke._ok && revoke.grant.state === 'revoked',
        'AC-8 (D-12): the PA revokes the grant — revocation is deliberately less restricted than granting');
      const bgRevAfter = parseInt((await db.query(
        `SELECT COUNT(*) FROM audit_log_${bgKs} a JOIN audit_entity_type t ON t.link = a.p_link
         WHERE t.tenant_id = $1 AND t.table_name = 'break_glass_grant' AND a.action = 'E'`, [SB])).rows[0].count);
      ctx.assert(bgRevAfter === bgRevBefore + 1,
        `AC-8 (§7.2): the revocation wrote its own audit event on the grant (${bgRevBefore} → ${bgRevAfter})`);
      const ihsRevoked = await as(IHS, () => ctx.fetch(`/v1/documents/${linkLab}`));
      ctx.assert(ihsRevoked._status === 404, 'AC-8: after revoke the document is gone again');
      const reRevoke = await as(`qa_ac_pa_${stamp}`, () =>
        ctx.fetch(`/v1/break-glass/${grantLink}/revoke`, { method: 'POST' }));
      ctx.assert(reRevoke._status === 409, 'AC-8: a second revoke refuses (already revoked)');

      // ── §7.3 (Rev 1.1): the audit log is itself a protected surface ──
      const tBefore = await auditCount('T');
      const ihsLog = await as(IHS, async () => {
        const log = await ctx.fetch('/v1/audit/document-log');
        const trail = await ctx.fetch(`/v1/audit/document/${linkLab}`);
        return { log: log._status, trail: trail._status };
      });
      ctx.assert(ihsLog.log === 403 && ihsLog.trail === 403,
        'AC-8/§7.3: IHS Technical Staff have NO read path to the audit log — break-glass covers the log too');
      const cmLog = await as(`qa_ac_cm_${stamp}`, () => ctx.fetch('/v1/audit/document-log'));
      ctx.assert(cmLog._status === 403,
        '§7.3: the Case Manager cannot read the log — MD and PA only');
      const mdLog = await as(`qa_ac_md_${stamp}`, () => ctx.fetch('/v1/audit/document-log'));
      ctx.assert(mdLog._ok && mdLog.events.length > 0,
        `§7.3: the Medical Director reads the program's document log (${(mdLog.events || []).length} events)`);
      ctx.assert(mdLog.events.some(e => e.action === 'B') && mdLog.events.some(e => e.action === 'G'),
        "§7.3: the emergency-access opens ('B' view, 'G' download) are ON the reviewable log");
      ctx.assert((await auditCount('T')) === tBefore + 1,
        "§7.3: reading the log wrote its own 'T' event — review of the trail is itself on the trail");

      // The grant record: officers see the history; plain staff see nothing.
      const mdRecord = await as(`qa_ac_md_${stamp}`, () => ctx.fetch('/v1/break-glass'));
      ctx.assert(mdRecord._ok && mdRecord.grants.length >= 1 && mdRecord.grants[0].state === 'revoked',
        'AC-8: the program officers see the standing grant record');
      const plainRecord = await as(`qa_ac_plain_${stamp}`, () => ctx.fetch('/v1/break-glass'));
      ctx.assert(plainRecord._status === 403, 'AC-8: plain staff cannot read the grant record');

      // ── AC-11 (Rev 1.1, Blocking): no tier-less state ──
      ctx.assert(dU.document.confidentiality === 2,
        'AC-11: an unclassified upload is STORED at Tier 2 — not merely read that way');
      const tierless = parseInt((await db.query(
        `SELECT COUNT(*) FROM document WHERE tenant_id = $1 AND type_id IS NULL AND confidentiality <> 2`,
        [SB])).rows[0].count);
      ctx.assert(tierless === 0,
        `AC-11: no tier-less state exists in the data model (${tierless} unclassified rows off Tier 2)`);

      // ── AC-10 (Blocking) + AC-12 (Blocking): superseded retrievability
      //    by exactly the §6.1 intersection, and lifecycle-never-expands —
      //    walked at Tier 2 and Tier 3 (the full per-tier resolution is in
      //    test_document_access.cjs). ──
      const repl2 = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkLab}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
      ctx.assert(repl2._ok, 'MD supersedes the Tier 2 lab report (S at Tier 2)');
      const linkLab2 = repl2.document.link;
      const paSup2 = await as(`qa_ac_pa_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab}`));
      ctx.assert(paSup2._status === 404,
        'AC-12: the PA holds V at Tier 2 but SUPERSEDED narrows it away (no S, not MD/CM) — 404, no oracle');
      const cmSup2 = await as(`qa_ac_cm_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab}`));
      ctx.assert(cmSup2._status === 200 && cmSup2.document.status === 'S',
        'AC-10: the Case Manager retrieves the superseded Tier 2 version (the §6.1 intersection)');

      const raise3 = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkLab2}`, { method: 'PATCH', body: { confidentiality: 3 } }));
      ctx.assert(raise3._ok && raise3.document.confidentiality === 3, 'The replacement raised to Tier 3 (Restricted)');
      const cmT3 = await as(`qa_ac_cm_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab2}`));
      ctx.assert(cmT3._status === 404,
        'AC-12: no lifecycle status returns a Tier 3 document to the CM (no permission at the tier = nothing, ever)');
      const repl3 = await as(`qa_ac_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${linkLab2}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
      ctx.assert(repl3._ok,
        'AC-10 (D-10): the MD supersedes a RESTRICTED document — before Rev 1.1 nobody held S at Tier 3');
      const paT3Sup = await as(`qa_ac_pa_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab2}`));
      ctx.assert(paT3Sup._status === 404,
        'AC-10/AC-12: superseded Tier 3 is the MD ALONE — the PA (V at Tier 3) gets 404');
      const mdT3Sup = await as(`qa_ac_md_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab2}`));
      ctx.assert(mdT3Sup._status === 200 && mdT3Sup.document.status === 'S' && mdT3Sup.document.version >= 1,
        'AC-10: the MD retrieves the superseded Restricted version, history intact (version + status carried)');

      // ── AC-5: audit-before-serve, proven by breaking the audit table ──
      await db.query(`ALTER TABLE ${auditTable} RENAME TO ${auditTable}_qa_broken`);
      let ac5;
      try {
        ac5 = await as(`qa_ac_md_${stamp}`, async () => {
          const card = await ctx.fetch(`/v1/documents/${linkStd}`);
          const file = await ctx.fetch(`/v1/documents/${linkStd}/file`);
          const list = await ctx.fetch('/v1/documents');
          return { card: card._status, file: file._status, list: list._status,
                   noMeta: !card.document, noList: !list.documents };
        });
      } finally {
        await db.query(`ALTER TABLE ${auditTable}_qa_broken RENAME TO ${auditTable}`);
      }
      ctx.assert(ac5.card === 500 && ac5.noMeta, 'AC-5: audit write fails → the card refuses, no metadata served');
      ctx.assert(ac5.file === 500, 'AC-5: audit write fails → the file refuses, no bytes served');
      ctx.assert(ac5.list === 500 && ac5.noList, 'AC-5: audit write fails → even browsing refuses');
      const healed = await as(`qa_ac_md_${stamp}`, () => ctx.fetch(`/v1/documents/${linkStd}`));
      ctx.assert(healed._ok, 'AC-5: audit table restored → serving resumes');

      // ── AC-6: Tier 2 never bulk-exports; each exported row audited ──
      const xBefore = await auditCount('X');
      await rawLogin(`qa_ac_md_${stamp}`, PW);
      const expMd = await rawGet(`/v1/export/participant/${RNUM}?format=csv&sections=documents`);
      ctx.assert(expMd.status === 200 && expMd.text.includes(`AC Member Corr ${stamp}`),
        'AC-6: the MD export carries the Tier-1 member document');
      ctx.assert(!expMd.text.includes(`AC Registrant Lab ${stamp}`),
        'AC-6: the Tier-2 (Sensitive) lab report NEVER bulk-exports — released or not');
      ctx.assert((await auditCount('X')) > xBefore, 'AC-6: each exported row wrote its export audit event');
      await rawLogin(IHS, PW);
      const expIhs = await rawGet(`/v1/export/participant/${RNUM}?format=csv&sections=documents`);
      ctx.assert(expIhs.status === 200 && !expIhs.text.includes(`AC Member Corr ${stamp}`),
        'AC-6/AC-8: the superuser export documents section is EMPTY under rules (no X anywhere)');

      // ════════════════ PHASE C — restore ════════════════
      await asClaude(SB);
      const back = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open' } });
      ctx.assert(back._ok && back.mode === 'open', "Test program restored to mode 'open'");
    } finally {
      await db.end();
    }
  }
};
