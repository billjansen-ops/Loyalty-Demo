/**
 * Document access — STORY 1 OF THE ACCESS-RULES BUILD (Session 165, v146).
 * Erica's PI2_Document_Access_Rules spec is the contract. This test proves
 * the tier × role permission matrix (spec §4), the type default tiers
 * (§5), and the lifecycle overlay (§6.1) — all through platform doors.
 *
 * What this proves:
 *   1. v146 seeded the type default tiers per spec §5, identically on all
 *      three workforce tenants (the two-tenant rule, extended).
 *   2. Mode 'open' (the live default) = pre-v146 behavior EXACTLY.
 *   3. Mode 'rules' = the matrix, with NO rule rows needed: deny by
 *      default; MD/CM/PA resolved from the role_map DATA; V/D/C/S/H/U
 *      enforced per tier; invisible documents 404 like they don't exist
 *      (no oracle); a visible-but-not-permitted action 403s.
 *   4. Unclassified documents ride Tier 2 until classified; classification
 *      stamps the type's default tier.
 *   5. Tier changes: raise = any classifier; lowering below the type
 *      default = Medical Director only.
 *   6. Multi-role sessions get the UNION of their roles' permissions.
 *   7. Superseded versions: MD/CM only — except PA keeps superseded
 *      ORG-LEVEL documents (spec wrinkle (a)).
 *   8. Uploads: typed needs U at the type's default tier (wrinkle (b));
 *      unclassified needs any mapped role; no role = no upload.
 *
 * Self-contained: throwaway logins, tiny test documents, mode restored at
 * the end (harness snapshot/restore backstops).
 */
module.exports = {
  name: 'Insight: document access matrix (story 1 — tier × role × lifecycle per the spec)',

  async run(ctx) {
    const WI = 5;
    const SPEC_DEFAULTS = {
      CONTRACT: 4, CONSENT: 1, CORR: 1,
      FAX: 2, ASSESS: 2, EVALNOTE: 2, LAB: 2, RX_DOC: 2, OTHER: 2,
    };
    const B64 = Buffer.from('QA document matrix probe').toString('base64');

    // ── Auth: Claude superuser on Wisconsin ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');
    const asClaude = async (tenant) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      ctx.assert(l._ok, 'Claude re-login');
      const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant } });
      ctx.assert(sw._ok, `Session on tenant ${tenant}`);
    };
    await asClaude(WI);

    // ── 1. The v146 seeds: type defaults per spec §5, on all three tenants ──
    for (const tenant of [WI, 6, 7]) {
      await asClaude(tenant);
      const types = await ctx.fetch('/v1/document-types');
      const got = Object.fromEntries((types.types || []).map(t => [t.type_code, t.default_confidentiality]));
      const wrong = Object.entries(SPEC_DEFAULTS).filter(([c, tier]) => got[c] !== tier);
      ctx.assert(types._ok && wrong.length === 0,
        `Tenant ${tenant}: all 9 type default tiers match spec §5 (${wrong.map(([c]) => c).join(',') || 'none wrong'})`);
    }
    await asClaude(WI);

    // ── Mode is 'open' (the live default — nothing user-visible shipped) ──
    const cfg0 = await ctx.fetch('/v1/document-access');
    ctx.assert(cfg0._ok && cfg0.mode === 'open', `Mode starts 'open' (got ${cfg0.mode})`);

    // ── Furniture: four documents (tier 1 / tier 2 / org-level / untyped) ──
    const mkDoc = (title, type_code) => ctx.fetch('/v1/documents', {
      method: 'POST',
      body: { title, file_format: 'txt', file_base64: B64, ...(type_code ? { type_code } : {}) }
    });
    const docStd = await mkDoc('QA Matrix Standard (consent)', 'CONSENT');
    const docLab = await mkDoc('QA Matrix Sensitive (lab)', 'LAB');
    const docOrg = await mkDoc('QA Matrix Org (contract)', 'CONTRACT');
    const docU = await mkDoc('QA Matrix Unclassified', null);
    ctx.assert(docStd._ok && docLab._ok && docOrg._ok && docU._ok, 'Four probe documents filed');
    const linkStd = docStd.document.link, linkLab = docLab.document.link,
          linkOrg = docOrg.document.link, linkU = docU.document.link;

    // Upload stamps the type's default tier (spec §5), in EVERY mode.
    ctx.assert(docStd.document.confidentiality === 1 && docLab.document.confidentiality === 2
      && docOrg.document.confidentiality === 4,
      `Typed uploads born at their type's default tier (got ${docStd.document.confidentiality}/${docLab.document.confidentiality}/${docOrg.document.confidentiality})`);
    ctx.assert(docU.document.tier_label === 'Sensitive',
      `Unclassified document reads as Tier 2 / Sensitive until classified (got ${docU.document.tier_label})`);

    // ── Throwaway staff: no-role, MD, CM, PA(admin), and PA+CM (union) ──
    const stamp = Math.floor(Math.random() * 1e9);
    const PW = 'qa-doc-165!';
    const mk = (name, role) => ctx.fetch('/v1/users', {
      method: 'POST', body: { username: name, password: PW, display_name: name, tenant_id: WI, role }
    });
    const uPlain = await mk(`qa_m_plain_${stamp}`, 'csr');
    const uMd = await mk(`qa_m_md_${stamp}`, 'csr');
    const uCm = await mk(`qa_m_cm_${stamp}`, 'csr');
    const uPa = await mk(`qa_m_pa_${stamp}`, 'admin');
    const uDual = await mk(`qa_m_dual_${stamp}`, 'admin');   // admin role + CM position = PA ∪ CM
    ctx.assert(uPlain._ok && uMd._ok && uCm._ok && uPa._ok && uDual._ok, 'Five throwaway logins created');

    const partners = await ctx.fetch(`/v1/partners?tenant_id=${WI}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${WI}`);
    const posGrant = (userId, code) => ctx.fetch(`/v1/users/${userId}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: [code, programs[0].program_id] }
    });
    const gMd = await posGrant(uMd.user_id, 'MEDDIR');
    const gCm = await posGrant(uCm.user_id, 'CASEMAN');
    const gDual = await posGrant(uDual.user_id, 'CASEMAN');
    ctx.assert(gMd._ok && gCm._ok && gDual._ok, 'Positions granted (MD, CM, and CM on the dual admin)');

    const as = async (username, fn) => {
      const l = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username, password: PW } });
      ctx.assert(l._ok, `Logged in as ${username}`);
      const out = await fn();
      await asClaude(WI);
      return out;
    };
    const seen = async () => {
      const r = await ctx.fetch('/v1/documents?include_superseded=1');
      return new Set((r.documents || []).map(d => d.link));
    };

    // ── 2. Mode 'open': a plain login sees everything — today's behavior ──
    const openView = await as(`qa_m_plain_${stamp}`, seen);
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => openView.has(l)),
      "Under 'open', a plain staff login sees all four — pre-v146 behavior unchanged");

    // ── 3. Flip to 'rules' — the matrix needs NO rule rows ──
    const staffPut = await as(`qa_m_plain_${stamp}`, () =>
      ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } }));
    ctx.assert(!staffPut._ok && staffPut._status === 403, 'The mode door stays admin-only (403 for staff)');
    const badMode = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'everything' } });
    ctx.assert(!badMode._ok && badMode._status === 400, 'Illegal mode still rejected');
    const flip = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } });
    ctx.assert(flip._ok && flip.mode === 'rules', "Mode flipped to 'rules' — the matrix is live, zero rule rows");

    // ── 4. Deny by default: no mapped role = nothing, no oracle ──
    const plainView = await as(`qa_m_plain_${stamp}`, async () => {
      const s = await seen();
      const card = await ctx.fetch(`/v1/documents/${linkLab}`);
      const file = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const edit = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { title: 'sneak' } });
      const up = await mkDoc('QA plain upload', null);
      return { s, card: card._status, file: file._status, edit: edit._status, up: up._status };
    });
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => !plainView.s.has(l)),
      'A login with NO mapped role sees NOTHING (deny by default)');
    ctx.assert(plainView.card === 404 && plainView.file === 404 && plainView.edit === 404,
      'Card, file, and edit all 404 — an invisible document looks exactly like a missing one');
    ctx.assert(plainView.up === 403, 'And no role = no upload (403)');

    // ── 5. Medical Director: full clinical access; org-level is view/download only ──
    const mdView = await as(`qa_m_md_${stamp}`, async () => {
      const s = await seen();
      const fileLab = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const fileOrg = await ctx.fetch(`/v1/documents/${linkOrg}/file`);
      const editOrg = await ctx.fetch(`/v1/documents/${linkOrg}`, { method: 'PATCH', body: { title: 'MD renames org doc' } });
      const replOrg = await ctx.fetch(`/v1/documents/${linkOrg}/replace`, {
        method: 'POST', body: { file_base64: B64, file_format: 'txt' } });
      return { s, fileLab: fileLab._status, fileOrg: fileOrg._status, editOrg: editOrg._status, replOrg: replOrg._status };
    });
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => mdView.s.has(l)),
      'MD sees all four tiers (V on 1, 2, org + the Tier-2 unclassified queue)');
    ctx.assert(mdView.fileLab === 200, 'MD downloads Tier 2 (D)');
    ctx.assert(mdView.fileOrg === 200, 'MD downloads org-level (spec: MD may view)');
    ctx.assert(mdView.editOrg === 403 && mdView.replOrg === 403,
      'But MD cannot edit or replace org-level (V D only — PA manages)');

    // ── 6. Case Manager: working access to tiers 1-2; org-level invisible ──
    const cmView = await as(`qa_m_cm_${stamp}`, async () => {
      const s = await seen();
      const cardOrg = await ctx.fetch(`/v1/documents/${linkOrg}`);
      const fileLab = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const hold = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true } });
      return { s, cardOrg: cardOrg._status, fileLab: fileLab._status, hold: hold._status };
    });
    ctx.assert(cmView.s.has(linkStd) && cmView.s.has(linkLab) && cmView.s.has(linkU),
      'CM sees tiers 1-2 + the unclassified queue');
    ctx.assert(!cmView.s.has(linkOrg) && cmView.cardOrg === 404,
      'Org-level is INVISIBLE to CM — 404, no oracle');
    ctx.assert(cmView.fileLab === 200, 'CM downloads Tier 2 (D)');
    ctx.assert(cmView.hold === 403, 'CM cannot touch legal hold (H is MD + PA)');

    // ── 7. Program Administrator: classify-everything, but Tier 2 is view-only ──
    const paView = await as(`qa_m_pa_${stamp}`, async () => {
      const s = await seen();
      const cardLab = await ctx.fetch(`/v1/documents/${linkLab}`);
      const fileLab = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const fileStd = await ctx.fetch(`/v1/documents/${linkStd}/file`);
      const holdStdOn = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true } });
      const holdStdOff = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: false } });
      const holdLab = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { legal_hold: true } });
      const upLab = await mkDoc('QA PA tries a lab upload', 'LAB');
      const upNone = await mkDoc('QA PA unclassified upload', null);
      const upOrg = await mkDoc('QA PA org upload', 'CONTRACT');
      return { s, cardLab: cardLab._status, fileLab: fileLab._status, fileStd: fileStd._status,
               holdStdOn: holdStdOn._status, holdStdOff: holdStdOff._status, holdLab: holdLab._status,
               upLab: upLab._status, upNone, upOrg };
    });
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => paView.s.has(l)),
      'PA sees all four (V everywhere incl. Tier 2 to classify)');
    ctx.assert(paView.cardLab === 200 && paView.fileLab === 403,
      'PA views Tier 2 but CANNOT download it (view-to-classify-only) — a visible refusal is 403, not 404');
    ctx.assert(paView.fileStd === 200, 'PA downloads Tier 1 (D)');
    ctx.assert(paView.holdStdOn === 200 && paView.holdStdOff === 200,
      'PA places and releases legal hold on Tier 1 (H)');
    ctx.assert(paView.holdLab === 403, 'PA cannot legal-hold Tier 2 (no H there)');
    ctx.assert(paView.upLab === 403,
      'PA cannot upload a TYPED Tier-2 document (U at the type default tier — wrinkle (b))');
    ctx.assert(paView.upNone._ok && paView.upOrg._ok,
      'PA uploads unclassified (any mapped role) and org-level (U) fine');
    const linkPaU = paView.upNone.document.link;

    // CM CAN upload a typed Tier-2 document (U on tier 2) — wrinkle (b)'s positive side.
    const cmUp = await as(`qa_m_cm_${stamp}`, () => mkDoc('QA CM lab upload', 'LAB'));
    ctx.assert(cmUp._ok, 'CM uploads a typed LAB document (U at tier 2)');

    // ── 8. Classification stamps the type default; tier needs a type first ──
    const paClassify = await as(`qa_m_pa_${stamp}`, async () => {
      const noType = await ctx.fetch(`/v1/documents/${linkPaU}`, { method: 'PATCH', body: { confidentiality: 3 } });
      const classify = await ctx.fetch(`/v1/documents/${linkU}`, { method: 'PATCH', body: { type_code: 'CONSENT' } });
      return { noType: noType._status, classify };
    });
    ctx.assert(paClassify.noType === 400, 'Setting a tier on an unclassified document is refused — classify first');
    ctx.assert(paClassify.classify._ok && paClassify.classify.document.confidentiality === 1
      && paClassify.classify.document.tier_label === 'Standard',
      "Classifying to CONSENT stamps the type's default tier (Sensitive-until-classified → Standard)");

    // ── 9. Tier changes: raise = any classifier; lower-below-default = MD only ──
    const cmLower = await as(`qa_m_cm_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 1 } }));
    ctx.assert(cmLower._status === 403, "CM cannot lower a LAB below its default tier (MD only)");
    const cmRaise = await as(`qa_m_cm_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 3 } }));
    ctx.assert(cmRaise._ok && cmRaise.document.confidentiality === 3, 'CM raises a Tier 2 to Restricted (raise = any classifier)');
    const cmAfterRaise = await as(`qa_m_cm_${stamp}`, () => ctx.fetch(`/v1/documents/${linkLab}`));
    ctx.assert(cmAfterRaise._status === 404,
      'And the raised document immediately vanishes from CM (Tier 3 = no CM access) — 404, no oracle');
    const mdTier = await as(`qa_m_md_${stamp}`, async () => {
      const card = await ctx.fetch(`/v1/documents/${linkLab}`);
      const lower = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 1 } });
      const restore = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 2 } });
      return { card: card._status, lower, restore: restore._ok };
    });
    ctx.assert(mdTier.card === 200, 'MD still sees the Restricted document (V on Tier 3)');
    ctx.assert(mdTier.lower._ok && mdTier.lower.document.confidentiality === 1 && mdTier.restore,
      'MD lowers below the type default (his call alone), then restores to the default');
    const badTier = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 9 } });
    ctx.assert(badTier._status === 400, 'An unknown tier number is rejected');

    // ── 10. Union: admin role + CM position = PA ∪ CM permissions ──
    const dualView = await as(`qa_m_dual_${stamp}`, async () => {
      const fileLab = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const hold = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true } });
      const release = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: false } });
      return { fileLab: fileLab._status, hold: hold._status, release: release._status };
    });
    ctx.assert(dualView.fileLab === 200,
      "UNION works: admin+CASEMAN downloads Tier 2 (CM's D — PA alone can't)");
    ctx.assert(dualView.hold === 200 && dualView.release === 200,
      "and holds Tier 1 (PA's H — CM alone can't)");

    // ── 11. Superseded: MD/CM only, except PA keeps org-level (wrinkle (a)) ──
    const mdRepl = await as(`qa_m_md_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkStd}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
    ctx.assert(mdRepl._ok, 'MD replaces the Tier 1 document (S)');
    const paRepl = await as(`qa_m_pa_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkOrg}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
    ctx.assert(paRepl._ok, 'PA replaces the org-level document (S — PA manages org lifecycle)');
    const cmSup = await as(`qa_m_cm_${stamp}`, () => ctx.fetch(`/v1/documents/${linkStd}`));
    ctx.assert(cmSup._status === 200, 'CM sees the superseded Tier 1 prior version (§6.1: MD/CM)');
    const paSup = await as(`qa_m_pa_${stamp}`, async () => {
      const std = await ctx.fetch(`/v1/documents/${linkStd}`);
      const org = await ctx.fetch(`/v1/documents/${linkOrg}`);
      return { std: std._status, org: org._status };
    });
    ctx.assert(paSup.std === 404, 'PA does NOT see the superseded Tier 1 version (§6.1)');
    ctx.assert(paSup.org === 200, 'But PA keeps the superseded ORG-LEVEL version it manages (wrinkle (a))');

    // ── 12. Superuser always passes; flip back to 'open' restores today ──
    const suView = await seen();
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => suView.has(l)), 'Superuser always passes');
    const back = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open', rules: [] } });
    ctx.assert(back._ok && back.mode === 'open', "Mode restored to 'open'");
    const restored = await as(`qa_m_plain_${stamp}`, seen);
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => restored.has(l)),
      "Back under 'open' the plain login sees everything again — enforcement is data, the flip is reversible");
  }
};
