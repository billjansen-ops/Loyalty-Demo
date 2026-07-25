/**
 * Document access plumbing (Session 155, v130) — the enforcement built
 * AHEAD of Erica's access rules so they land as configuration.
 *
 * What this proves, all through platform doors:
 *   1. Mode 'open' (the seeded default) = today's behavior EXACTLY — a
 *      plain staff login sees every document, before and after v130.
 *   2. Flipping to 'rules' with a rule set changes visibility per
 *      document type × audience: a no-position staff login loses the
 *      restricted type everywhere (finder, card, file — the file 404s
 *      like it never existed, no oracle); a Medical Director position
 *      holder keeps it; an admin keeps what 'admin' rules grant;
 *      unclassified documents become admin-only; superusers always pass.
 *   3. The rules door itself is admin-only, validates its input, and a
 *      full PUT (Erica's future rules) round-trips.
 *   4. Flipping back to 'open' restores everything — the flip is data.
 *
 * Self-contained: throwaway logins, tiny test documents, rules cleared
 * and mode restored at the end (harness snapshot/restore backstops).
 */
module.exports = {
  name: 'Insight: document access plumbing (mode open = today; rules mode = type × audience)',

  async run(ctx) {
    const WI = 5;
    const B64 = Buffer.from('QA document access probe').toString('base64');

    // ── Auth: Claude superuser ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
    ctx.assert(sw._ok, 'Session on Wisconsin (tenant 5)');

    // ── The seeded default is 'open' ──
    const cfg0 = await ctx.fetch('/v1/document-access');
    ctx.assert(cfg0._ok && cfg0.mode === 'open' && Array.isArray(cfg0.rules) && cfg0.rules.length === 0,
      `v130 seeds mode 'open' with zero rules (got mode ${cfg0.mode}, ${cfg0.rules?.length} rules)`);

    // ── Furniture: two typed documents + one unclassified ──
    const types = await ctx.fetch('/v1/document-types');
    const codes = (types.types || []).map(t => t.type_code);
    ctx.assert(codes.length >= 9, `Document taxonomy present (${codes.length} types)`);
    const TYPE_A = codes[0], TYPE_B = codes[1];

    const mkDoc = (title, type_code) => ctx.fetch('/v1/documents', {
      method: 'POST',
      body: { title, file_format: 'txt', file_base64: B64, ...(type_code ? { type_code } : {}) }
    });
    const docA = await mkDoc('QA Access Doc A', TYPE_A);
    const docB = await mkDoc('QA Access Doc B', TYPE_B);
    const docU = await mkDoc('QA Access Doc Unclassified', null);
    ctx.assert(docA._ok && docB._ok && docU._ok,
      `Three probe documents filed (A=${docA.document?.link}, B=${docB.document?.link}, U=${docU.document?.link})`);
    const linkA = docA.document.link, linkB = docB.document.link, linkU = docU.document.link;

    // ── Throwaway staff: one plain login, one Medical Director, one admin ──
    const stamp = Math.floor(Math.random() * 1e9);
    const mk = (name, role) => ctx.fetch('/v1/users', {
      method: 'POST', body: { username: name, password: 'qa-doc-155!', display_name: name, tenant_id: WI, role }
    });
    const plain = await mk(`qa_doc_plain_${stamp}`, 'csr');
    const mddir = await mk(`qa_doc_md_${stamp}`, 'csr');
    const admin = await mk(`qa_doc_admin_${stamp}`, 'admin');
    ctx.assert(plain._ok && mddir._ok && admin._ok, 'Three throwaway logins created');

    const partners = await ctx.fetch(`/v1/partners?tenant_id=${WI}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${WI}`);
    const grant = await ctx.fetch(`/v1/users/${mddir.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', programs[0].program_id] }
    });
    ctx.assert(grant._ok, 'Medical Director position granted to the MD login');

    const as = async (username, fn) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username, password: 'qa-doc-155!' } });
      ctx.assert(l._ok, `Logged in as ${username}`);
      const out = await fn();
      const back = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(back._ok, 'Claude re-login');
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: WI } });
      return out;
    };
    const seen = async () => {
      const r = await ctx.fetch('/v1/documents?include_superseded=1');
      return new Set((r.documents || []).map(d => d.link));
    };

    // ── 1. Mode 'open': the plain login sees everything (today's behavior) ──
    const openView = await as(`qa_doc_plain_${stamp}`, seen);
    ctx.assert(openView.has(linkA) && openView.has(linkB) && openView.has(linkU),
      "Under 'open', a plain staff login sees all three documents — today's behavior unchanged");

    // ── 2. The rules door is admin-only and validates ──
    const staffPut = await as(`qa_doc_plain_${stamp}`, () =>
      ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } }));
    ctx.assert(!staffPut._ok && staffPut._status === 403, 'A plain staff login cannot touch the rules (403)');
    const badMode = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'everything' } });
    ctx.assert(!badMode._ok && badMode._status === 400, 'Illegal mode rejected');
    const badAud = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { rules: [{ type_code: TYPE_A, audience: 'everyone!!' }] } });
    ctx.assert(!badAud._ok && badAud._status === 400, 'Illegal audience string rejected');
    const badType = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { rules: [{ type_code: 'NOPE', audience: 'admin' }] } });
    ctx.assert(!badType._ok && badType._status === 400, 'Unknown document type rejected');

    // ── 3. Enter a rule set + flip to 'rules' (the Erica move, as one PUT) ──
    const put = await ctx.fetch('/v1/document-access', {
      method: 'PUT',
      body: {
        mode: 'rules',
        rules: [
          { type_code: TYPE_A, audience: 'position:POSITIONCLINIC:MEDDIR' },
          { type_code: TYPE_A, audience: 'admin' },
          { type_code: TYPE_B, audience: 'admin' },
        ]
      }
    });
    ctx.assert(put._ok && put.mode === 'rules' && put.rules.length === 3,
      `Rules entered as data + mode flipped in one PUT (${put.rules?.length} rules)`);

    // Plain login: no positions, not admin → sees nothing restricted.
    const plainView = await as(`qa_doc_plain_${stamp}`, async () => {
      const s = await seen();
      const card = await ctx.fetch(`/v1/documents/${linkA}`);
      const file = await ctx.fetch(`/v1/documents/${linkA}/file`);
      const edit = await ctx.fetch(`/v1/documents/${linkA}`, { method: 'PATCH', body: { title: 'sneak' } });
      return { s, cardStatus: card._status, fileStatus: file._status, editStatus: edit._status };
    });
    ctx.assert(!plainView.s.has(linkA) && !plainView.s.has(linkB) && !plainView.s.has(linkU),
      'Plain staff login now sees NONE of the three (finder filtered)');
    ctx.assert(plainView.cardStatus === 404 && plainView.fileStatus === 404 && plainView.editStatus === 404,
      'Card, file, and edit all answer 404 — an invisible document looks exactly like a missing one');

    // Medical Director: sees type A (their rule), not B, not unclassified.
    const mdView = await as(`qa_doc_md_${stamp}`, async () => {
      const s = await seen();
      const card = await ctx.fetch(`/v1/documents/${linkA}`);
      return { s, cardOk: card._ok };
    });
    ctx.assert(mdView.s.has(linkA) && mdView.cardOk, 'The Medical Director position sees its permitted type');
    ctx.assert(!mdView.s.has(linkB) && !mdView.s.has(linkU), 'And nothing beyond it (no type B, no unclassified)');

    // Admin: both admin-ruled types + the unclassified queue.
    const adminView = await as(`qa_doc_admin_${stamp}`, seen);
    ctx.assert(adminView.has(linkA) && adminView.has(linkB) && adminView.has(linkU),
      "Admin sees both admin-ruled types AND the unclassified queue (someone must classify)");

    // Superuser: always passes.
    const suView = await seen();
    ctx.assert(suView.has(linkA) && suView.has(linkB) && suView.has(linkU), 'Superuser always passes (platform administration)');

    // ── 4. Flip back to 'open' — everything returns; the flip is data ──
    const back = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open', rules: [] } });
    ctx.assert(back._ok && back.mode === 'open' && back.rules.length === 0, "Mode restored to 'open', rules cleared");
    const restored = await as(`qa_doc_plain_${stamp}`, seen);
    ctx.assert(restored.has(linkA) && restored.has(linkB) && restored.has(linkU),
      "Back under 'open' the plain login sees everything again — enforcement is pure configuration");
  }
};
