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
 *   7. Superseded versions: the Rev 1.1 D-13 INTERSECTION — MD, CM, and
 *      any role holding S at the tier, each only where it holds V.
 *      Resolves T1 all three staff roles, T2 MD+CM, T3 MD alone,
 *      org-level MD+PA (no special case — it falls out of the rule).
 *      Both S165 wrinkle implementations are retired.
 *   8. Uploads: typed needs U at the type's default tier; UNCLASSIFIED
 *      is strictly a Tier 2 document (Rev 1.1 AC-11 — stored at 2, and
 *      reachable only through Tier 2 permissions; the any-classifying-
 *      role rule is dead).
 *   9. Rev 1.1 matrix cells: CM +S@T2 (D-11), PA +U/+H@T2, MD +S@T3
 *      (D-10), MD +H@org — each proven through a real door.
 *  10. Part 2 downloads refuse for EVERY role until the consent
 *      architecture (the S165 interim consent-document unlock is
 *      retired); the plumbing columns survive.
 *  11. The audit log is a protected surface (§7.3): document audit
 *      trails read by MD/PA only under rules (admin under open — the
 *      any-user leak is closed), and the read is itself on the trail.
 *  12. The immediate-release flag (D-3): OFF = the logged release action
 *      is the only portal path; ON = filing a release-eligible chart
 *      document auto-releases, logged the same.
 *
 * Self-contained: throwaway logins, tiny test documents, mode restored at
 * the end (harness snapshot/restore backstops).
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty'
};

module.exports = {
  name: 'Insight: document access matrix (stories 1+2 — tiers, matrix, audit-before-serve, export exclusion, Part 2)',

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
    ctx.assert(docU.document.tier_label === 'Sensitive' && docU.document.confidentiality === 2,
      `Unclassified document IS Tier 2 — stored AND read (AC-11: no tier-less state; got ${docU.document.tier_label}/${docU.document.confidentiality})`);

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
      const holdOrgOn = await ctx.fetch(`/v1/documents/${linkOrg}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'QA: MD holds org (Rev 1.1)' } });
      const holdOrgOff = await ctx.fetch(`/v1/documents/${linkOrg}`, { method: 'PATCH', body: { legal_hold: false, hold_reason: 'QA: MD releases org hold' } });
      return { s, fileLab: fileLab._status, fileOrg: fileOrg._status, editOrg: editOrg._status, replOrg: replOrg._status,
               holdOrgOn: holdOrgOn._status, holdOrgOff: holdOrgOff._status };
    });
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => mdView.s.has(l)),
      'MD sees all four tiers (V on 1, 2, org + the Tier-2 unclassified queue)');
    ctx.assert(mdView.fileLab === 200, 'MD downloads Tier 2 (D)');
    ctx.assert(mdView.fileOrg === 200, 'MD downloads org-level (spec: MD may view and download)');
    ctx.assert(mdView.editOrg === 403 && mdView.replOrg === 403,
      'But MD cannot edit or replace org-level (no C/S — PA manages)');
    ctx.assert(mdView.holdOrgOn === 200 && mdView.holdOrgOff === 200,
      'Rev 1.1: MD places and releases legal hold on org-level (+H — a hold on an executed agreement must not depend on an operations role)');

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
      // Under 'rules' a hold change requires a reason (spec §7.2, Story 4).
      const holdNoReason = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true } });
      const holdStdOn = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'QA: board inquiry pending' } });
      const holdStdOff = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: false, hold_reason: 'QA: inquiry closed' } });
      const holdLabOn = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'QA: PA holds Tier 2 (Rev 1.1)' } });
      const holdLabOff = await ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { legal_hold: false, hold_reason: 'QA: released again' } });
      const upLab = await mkDoc('QA PA lab upload', 'LAB');
      const upNone = await mkDoc('QA PA unclassified upload', null);
      const upOrg = await mkDoc('QA PA org upload', 'CONTRACT');
      return { s, cardLab: cardLab._status, fileLab: fileLab._status, fileStd: fileStd._status,
               holdNoReason: holdNoReason._status,
               holdStdOn: holdStdOn._status, holdStdOff: holdStdOff._status,
               holdLabOn: holdLabOn._status, holdLabOff: holdLabOff._status,
               upLab, upNone, upOrg };
    });
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => paView.s.has(l)),
      'PA sees all four (V everywhere incl. Tier 2 to classify)');
    ctx.assert(paView.cardLab === 200 && paView.fileLab === 403,
      'PA views Tier 2 but CANNOT download it (view-to-classify-only) — a visible refusal is 403, not 404');
    ctx.assert(paView.fileStd === 200, 'PA downloads Tier 1 (D)');
    ctx.assert(paView.holdNoReason === 400,
      'A hold change under rules REFUSES without a reason (spec §7.2, Story 4)');
    ctx.assert(paView.holdStdOn === 200 && paView.holdStdOff === 200,
      'PA places and releases legal hold on Tier 1 (H) — reason recorded');
    ctx.assert(paView.holdLabOn === 200 && paView.holdLabOff === 200,
      'Rev 1.1: PA legal-holds Tier 2 (+H — the role owns legal hold where it matters most)');
    ctx.assert(paView.upLab._ok,
      'Rev 1.1: PA uploads a TYPED Tier-2 document (+U — the role owns ingestion; fax intake works through the matrix)');
    ctx.assert(paView.upNone._ok && paView.upOrg._ok,
      'PA uploads unclassified (its Tier 2 U — AC-11: reached only through Tier 2 permissions) and org-level (U) fine');
    const linkPaU = paView.upNone.document.link;

    // CM uploads a typed Tier-2 document (U on tier 2) — and Rev 1.1
    // D-11: CM SUPERSEDES at Tier 2, so a corrected clinical document
    // links as a version instead of filing as an unversioned duplicate.
    const cmUp = await as(`qa_m_cm_${stamp}`, async () => {
      const up = await mkDoc('QA CM lab upload', 'LAB');
      const repl = up._ok ? await ctx.fetch(`/v1/documents/${up.document.link}/replace`, {
        method: 'POST', body: { file_base64: B64, file_format: 'txt' } }) : { _ok: false };
      return { up, repl };
    });
    ctx.assert(cmUp.up._ok, 'CM uploads a typed LAB document (U at tier 2)');
    ctx.assert(cmUp.repl._ok && cmUp.repl.document.version === 2,
      'Rev 1.1 (D-11): CM supersedes at Tier 2 — the correction is version 2, linked, never a duplicate');

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
    // As the MD, not Claude: under 'rules' a superuser is locked out
    // entirely (Story 4), so the validation answer must come from a role.
    const badTier = await as(`qa_m_md_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkLab}`, { method: 'PATCH', body: { confidentiality: 9 } }));
    ctx.assert(badTier._status === 400, 'An unknown tier number is rejected');

    // ── 10. Union: admin role + CM position = PA ∪ CM permissions ──
    const dualView = await as(`qa_m_dual_${stamp}`, async () => {
      const fileLab = await ctx.fetch(`/v1/documents/${linkLab}/file`);
      const hold = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: true, hold_reason: 'QA: dual hold' } });
      const release = await ctx.fetch(`/v1/documents/${linkStd}`, { method: 'PATCH', body: { legal_hold: false, hold_reason: 'QA: dual release' } });
      return { fileLab: fileLab._status, hold: hold._status, release: release._status };
    });
    ctx.assert(dualView.fileLab === 200,
      "UNION works: admin+CASEMAN downloads Tier 2 (CM's D — PA alone can't)");
    ctx.assert(dualView.hold === 200 && dualView.release === 200,
      "and holds Tier 1 (PA's H — CM alone can't)");

    // ── 11. Superseded: the Rev 1.1 D-13 INTERSECTION (AC-10 Blocking,
    //        AC-12) — visible to MD, CM, and any role holding S at the
    //        tier, each only where that role holds V. Resolves: T1 all
    //        three staff roles, T2 MD+CM, T3 MD alone, org MD+PA. Both
    //        S165 wrinkle implementations are retired; org falls out of
    //        the rule, no special case. ──
    const mdRepl = await as(`qa_m_md_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkStd}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
    ctx.assert(mdRepl._ok, 'MD replaces the Tier 1 document (S)');
    const paRepl = await as(`qa_m_pa_${stamp}`, () =>
      ctx.fetch(`/v1/documents/${linkOrg}/replace`, { method: 'POST', body: { file_base64: B64, file_format: 'txt' } }));
    ctx.assert(paRepl._ok, 'PA replaces the org-level document (S — PA manages org lifecycle)');
    const cmSup = await as(`qa_m_cm_${stamp}`, () => ctx.fetch(`/v1/documents/${linkStd}`));
    ctx.assert(cmSup._status === 200, 'CM sees the superseded Tier 1 prior version (V + the MD/CM arm of D-13)');
    const paSup = await as(`qa_m_pa_${stamp}`, async () => {
      const std = await ctx.fetch(`/v1/documents/${linkStd}`);
      const org = await ctx.fetch(`/v1/documents/${linkOrg}`);
      const finder = await ctx.fetch('/v1/documents?include_superseded=1');
      return { std: std._status, org: org._status,
               finderLinks: new Set((finder.documents || []).map(d => d.link)) };
    });
    ctx.assert(paSup.std === 200,
      'Rev 1.1 (D-13): PA SEES the superseded Tier 1 version — it holds S at Tier 1, the intersection includes it (the S165 rule hid it)');
    ctx.assert(paSup.org === 200,
      'PA sees the superseded ORG-LEVEL version — no special case, it falls out of the rule (S + V at org)');
    ctx.assert(paSup.finderLinks.has(linkStd) && paSup.finderLinks.has(linkOrg),
      'And the finder agrees with the single-document doors (same rule, both dialects)');
    // The T2 arm (PA excluded) and T3 arm (MD alone) of D-13 are walked
    // in test_access_rules_acceptance.cjs — AC-10/AC-12 Blocking.

    // ── 12. Superusers are LOCKED OUT under 'rules' (Story 4: the IHS
    //        Technical Staff column) — and 'open' restores platform
    //        administration. The break-glass path itself is proven end to
    //        end in test_access_rules_acceptance.cjs. ──
    const suView = await seen();
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => !suView.has(l)),
      "Under 'rules' the superuser sees NOTHING — IHS Technical Staff column (Story 4)");
    const suCard = await ctx.fetch(`/v1/documents/${linkLab}`);
    ctx.assert(suCard._status === 404, 'Superuser card fetch 404s like the document does not exist (no oracle)');
    const back = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open', rules: [] } });
    ctx.assert(back._ok && back.mode === 'open', "Mode restored to 'open'");
    const suOpen = await seen();
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => suOpen.has(l)),
      "Under 'open' the superuser passes again (platform administration)");
    const restored = await as(`qa_m_plain_${stamp}`, seen);
    ctx.assert([linkStd, linkLab, linkOrg, linkU].every(l => restored.has(l)),
      "Back under 'open' the plain login sees everything again — enforcement is data, the flip is reversible");

    // ════════════════════════════════════════════════════════════════
    // STORY 2 — audit-before-serve (AC-5), the Tier-2 bulk-export
    // exclusion (AC-6), and the 42 CFR Part 2 flag plumbing.
    // ════════════════════════════════════════════════════════════════
    const db = new Client(DB_CONFIG);
    await db.connect();
    try {
      // Raw fetches with their own cookie — CSV bodies and response
      // headers need more than the harness's JSON fetch exposes.
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
        return { status: r.status, text: await r.text(), headers: r.headers };
      };

      // Audit plumbing coordinates: which audit table serves 'document'.
      // The audit table for documents: key_size registered per tenant in
      // audit_entity_type (story 1's own audits guarantee the row exists).
      const ks = (await db.query(
        `SELECT key_size FROM audit_entity_type WHERE tenant_id = $1 AND table_name = 'document'`, [WI])).rows[0].key_size;
      const auditTable = `audit_log_${ks}`;
      const auditCount = async (action) =>
        parseInt((await db.query(`SELECT COUNT(*) FROM ${auditTable} WHERE action = $1`, [action])).rows[0].count);

      // A real person to hang chart documents on.
      const memberRow = (await db.query(
        `SELECT membership_number FROM member WHERE tenant_id = $1 ORDER BY membership_number LIMIT 1`, [WI])).rows[0];
      ctx.assert(!!memberRow, `Found a Wisconsin member for the chart export (${memberRow?.membership_number})`);
      const MNUM = memberRow.membership_number;

      // Three member-linked documents, FILED: two exportable (tier 1),
      // one Sensitive that must never bulk-export.
      const mkMemberDoc = async (title, type_code) => {
        const d = await ctx.fetch('/v1/documents', {
          method: 'POST',
          body: { title, file_format: 'txt', file_base64: B64, type_code, member_number: MNUM }
        });
        ctx.assert(d._ok, `Filed member document '${title}'`);
        const f = await ctx.fetch(`/v1/documents/${d.document.link}`, { method: 'PATCH', body: { status: 'F' } });
        ctx.assert(f._ok, `'${title}' moved to Filed`);
        return d.document.link;
      };
      const CORR_TITLE = `QA Export Corr ${stamp}`, LAB_TITLE = `QA Export Lab ${stamp}`, CONSENT_TITLE = `QA Export Consent ${stamp}`;
      const linkCorr2 = await mkMemberDoc(CORR_TITLE, 'CORR');
      const linkLab2 = await mkMemberDoc(LAB_TITLE, 'LAB');
      const linkConsent2 = await mkMemberDoc(CONSENT_TITLE, 'CONSENT');

      // ── AC-6, mode 'open': Tier 2 excluded from bulk export absolutely ──
      const xBefore = await auditCount('X');
      await rawLogin('Claude', 'claude123');
      await fetch(`${ctx.apiBase}/v1/auth/tenant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: rawCookie },
        body: JSON.stringify({ tenant_id: WI })
      });
      const exp1 = await rawGet(`/v1/export/participant/${MNUM}?format=csv&sections=documents`);
      ctx.assert(exp1.status === 200, 'Chart export (documents section) serves');
      ctx.assert(exp1.text.includes(CORR_TITLE) && exp1.text.includes(CONSENT_TITLE),
        'Tier 1 documents export (correspondence + consent present)');
      ctx.assert(!exp1.text.includes(LAB_TITLE),
        'The Sensitive lab report is EXCLUDED from bulk export — even in open mode, even for a superuser (AC-6)');
      const xAfter = await auditCount('X');
      ctx.assert(xAfter === xBefore + 2,
        `Each exported row wrote its Export audit event (X: ${xBefore} → ${xAfter})`);

      // ── Part 2 (Rev 1.1): no consent ARTIFACT can exist until the
      //    consent architecture builds — so a flagged document is not
      //    downloadable by ANY role, in this phase, full stop. Erica's
      //    words: "This is the intended behavior, not a defect." The
      //    S165 interim rule (a Filed consent DOCUMENT unlocks the
      //    download) is RETIRED — proven here by linking one and being
      //    refused anyway. The plumbing columns survive (D-14). ──
      const flag = await ctx.fetch(`/v1/documents/${linkLab2}`, { method: 'PATCH', body: { part2_flag: true } });
      ctx.assert(flag._ok && flag.document.part2_flag === true, 'Lab report flagged under 42 CFR Part 2');
      const dlBlocked = await rawGet(`/v1/documents/${linkLab2}/file`);
      ctx.assert(dlBlocked.status === 403 && dlBlocked.text.includes('42 CFR Part 2'),
        'A flagged document cannot be downloaded (plain-English refusal names the law and the reason)');
      const badConsent = await ctx.fetch(`/v1/documents/${linkLab2}`, { method: 'PATCH', body: { part2_consent_link: linkU } });
      ctx.assert(badConsent._status === 400,
        'The consent-link plumbing still validates (a non-Filed consent refuses to link)');
      const goodConsent = await ctx.fetch(`/v1/documents/${linkLab2}`, { method: 'PATCH', body: { part2_consent_link: linkConsent2 } });
      ctx.assert(goodConsent._ok, "The person's own Filed consent still LINKS (plumbing intact for the real artifact)");
      const pBefore = await auditCount('P');
      const dlStillBlocked = await rawGet(`/v1/documents/${linkLab2}/file`);
      ctx.assert(dlStillBlocked.status === 403,
        'Rev 1.1: the download refuses EVEN WITH a linked consent document — a document is not the consent object; the refusal lifts with the consent architecture, not before');
      ctx.assert((await auditCount('P')) === pBefore,
        "And no Part 2 disclosure event exists ('P' returns with the consent architecture — no permitted disclosure, no event)");

      // ── AC-5: a failed audit write BLOCKS content — proven for real ──
      await db.query(`ALTER TABLE ${auditTable} RENAME TO ${auditTable}_qa_broken`);
      let cardBroken, fileBroken, listBroken;
      try {
        cardBroken = await ctx.fetch(`/v1/documents/${linkCorr2}`);
        fileBroken = await rawGet(`/v1/documents/${linkCorr2}/file`);
        listBroken = await ctx.fetch('/v1/documents');
      } finally {
        await db.query(`ALTER TABLE ${auditTable}_qa_broken RENAME TO ${auditTable}`);
      }
      ctx.assert(cardBroken._status === 500 && !cardBroken.document,
        'Audit table gone → the card refuses and serves NO metadata (AC-5)');
      ctx.assert(fileBroken.status === 500 && !fileBroken.text.includes('QA document matrix probe'),
        'Audit table gone → the download refuses and serves NO bytes (AC-5)');
      ctx.assert(listBroken._status === 500 && !listBroken.documents,
        'Audit table gone → the finder refuses too (browsing is a served event)');
      const cardHealed = await ctx.fetch(`/v1/documents/${linkCorr2}`);
      ctx.assert(cardHealed._ok, 'Audit table restored → the card serves again');

      // ── AC-6 under 'rules': the X column of the matrix decides per tier ──
      const flip2 = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } });
      ctx.assert(flip2._ok, "Mode flipped to 'rules' for the export matrix check");
      await rawLogin(`qa_m_md_${stamp}`, PW);
      const expMd = await rawGet(`/v1/export/participant/${MNUM}?format=csv&sections=documents`);
      ctx.assert(expMd.status === 200 && expMd.text.includes(CORR_TITLE) && !expMd.text.includes(LAB_TITLE),
        'MD exports Tier 1 rows (X on tier 1), never the Sensitive one');
      await rawLogin(`qa_m_cm_${stamp}`, PW);
      const expCm = await rawGet(`/v1/export/participant/${MNUM}?format=csv&sections=documents`);
      ctx.assert(expCm.status === 200 && !expCm.text.includes(CORR_TITLE) && !expCm.text.includes(LAB_TITLE),
        'CM holds no X anywhere — the documents section exports EMPTY for CM');

      // Restore: mode back to 'open'.
      const back2 = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open' } });
      ctx.assert(back2._ok && back2.mode === 'open', "Mode restored to 'open' (story 2 wrap)");

      // ════════════════════════════════════════════════════════════════
      // STORY 3 — the registrant boundary (§6.2/AC-4), promotion at
      // activation, and the participant release action (§5/D-3).
      // ════════════════════════════════════════════════════════════════
      const publicFetch = async (p, body) => {
        const r = await fetch(`${ctx.apiBase}${p}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        data._status = r.status; data._ok = r.ok;
        return data;
      };

      // A true REGISTRANT through the real public door (staff enroll
      // stamps Participant since v122 — only registration makes registrants).
      const regCode = await ctx.fetch(`/v1/codes?tenant_id=${WI}`, {
        method: 'POST', body: { code_type: 'registration', context: { target: '/register', referral_type: 'Self-referral' } }
      });
      ctx.assert(regCode._ok && regCode.code, 'Minted a registration code');
      const REG_FNAME = `Reggie${stamp}`;
      const reg = await publicFetch('/v1/register', {
        code: regCode.code, fname: REG_FNAME, lname: 'Boundary', email: `reg${stamp}@qa.test`
      });
      ctx.assert(reg._ok, 'Public registration created a registrant');
      const regRow = (await db.query(
        `SELECT membership_number FROM member WHERE tenant_id = $1 AND fname = $2 AND lname = 'Boundary'`,
        [WI, REG_FNAME])).rows[0];
      ctx.assert(!!regRow, `Registrant has a member record (#${regRow?.membership_number})`);
      const RNUM = regRow.membership_number;

      // Upload for the registrant: the boundary stamps at birth.
      const rDoc = await ctx.fetch('/v1/documents', {
        method: 'POST',
        body: { title: `QA Registrant Lab ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'LAB', member_number: RNUM }
      });
      ctx.assert(rDoc._ok && rDoc.document.registrant_doc === true,
        'A document uploaded for a registrant is MARKED registrant at birth');
      const rLink = rDoc.document.link;

      // Rev 1.1 §6.2: a registrant document carries the Tier 2
      // until-classified treatment — even one classified to a TIER 1
      // type reads at Tier 2 (floor; stricter tiers keep theirs). There
      // is no separate, looser access model for intake material.
      const rCorr = await ctx.fetch('/v1/documents', {
        method: 'POST',
        body: { title: `QA Registrant Corr ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'CORR', member_number: RNUM }
      });
      ctx.assert(rCorr._ok && rCorr.document.confidentiality === 1 && rCorr.document.tier_label === 'Sensitive',
        `Rev 1.1 §6.2: a registrant document classified to a Tier 1 type READS at Tier 2 (floor) — got ${rCorr.document.tier_label}`);

      // The chart-style query never sees it; the filing cabinet asks and does.
      const chartQ = await ctx.fetch(`/v1/documents?member=${RNUM}`);
      ctx.assert(chartQ._ok && !(chartQ.documents || []).some(d => d.link === rLink),
        'The chart (member-scoped) query EXCLUDES the registrant document server-side (AC-4)');
      const cabinetQ = await ctx.fetch(`/v1/documents?member=${RNUM}&include_registrant=1`);
      ctx.assert(cabinetQ._ok && (cabinetQ.documents || []).some(d => d.link === rLink),
        'The filing cabinet (include_registrant=1) sees it — administratively visible only');

      // Pre-activation: promotion refuses; release refuses registrant docs.
      const earlyPromote = await ctx.fetch(`/v1/documents/${rLink}/promote`, { method: 'POST', body: {} });
      ctx.assert(earlyPromote._status === 409 && (earlyPromote.error || '').includes('monitoring agreement'),
        'Promote before activation is refused in plain English');
      const fileIt = await ctx.fetch(`/v1/documents/${rLink}`, { method: 'PATCH', body: { status: 'F' } });
      ctx.assert(fileIt._ok, 'The registrant document files normally (administrative work continues)');
      const earlyRelease = await ctx.fetch(`/v1/documents/${rLink}/release`, { method: 'POST', body: {} });
      ctx.assert(earlyRelease._status === 409 && (earlyRelease.error || '').includes('registrant'),
        'Release refuses a registrant document (promote first)');

      // Activation — as the Medical Director; it moves NOTHING but counts
      // what awaits the review.
      const activation = await as(`qa_m_md_${stamp}`, () =>
        ctx.fetch('/v1/participant-activations', {
          method: 'POST', body: { membership_number: RNUM, program_id: programs[0].program_id }
        }));
      ctx.assert(activation._ok, 'The registrant activated (signed the monitoring agreement)');
      ctx.assert(activation.registrant_document_count === 2 && (activation.message || '').includes('await review'),
        `Activation counted BOTH waiting documents (the lab + the Rev 1.1 floor probe) and said so (got ${activation.registrant_document_count})`);
      const chartQ2 = await ctx.fetch(`/v1/documents?member=${RNUM}`);
      ctx.assert(chartQ2._ok && !(chartQ2.documents || []).some(d => d.link === rLink),
        'AFTER activation the document is STILL off the chart — nothing migrates automatically');

      // The explicit review: promote → on the chart, logged distinctly.
      const mBefore = await auditCount('M');
      const promote = await ctx.fetch(`/v1/documents/${rLink}/promote`, { method: 'POST', body: {} });
      ctx.assert(promote._ok && promote.document.registrant_doc === false, 'Promote clears the registrant mark');
      ctx.assert((await auditCount('M')) === mBefore + 1, "Promotion wrote its own distinct audit event ('M')");
      const rePromote = await ctx.fetch(`/v1/documents/${rLink}/promote`, { method: 'POST', body: {} });
      ctx.assert(rePromote._status === 409, 'A second promote refuses — the document is already on the chart');
      const chartQ3 = await ctx.fetch(`/v1/documents?member=${RNUM}`);
      ctx.assert(chartQ3._ok && (chartQ3.documents || []).some(d => d.link === rLink),
        'Promoted, the document appears on the chart query');

      // The release action: one-way, logged, type-gated by DATA.
      const rBefore = await auditCount('R');
      const release = await ctx.fetch(`/v1/documents/${rLink}/release`, { method: 'POST', body: {} });
      ctx.assert(release._ok && release.document.released === true && release.document.released_date,
        'The Filed lab report releases to the participant (stamped who + when)');
      ctx.assert((await auditCount('R')) === rBefore + 1, "Release wrote its own distinct audit event ('R')");
      const reRelease = await ctx.fetch(`/v1/documents/${rLink}/release`, { method: 'POST', body: {} });
      ctx.assert(reRelease._status === 409, 'A second release refuses — a release is recorded once');

      // Type eligibility is data: correspondence does not release.
      const corrDoc = await ctx.fetch('/v1/documents', {
        method: 'POST', body: { title: `QA Corr NoRelease ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'CORR', member_number: RNUM }
      });
      await ctx.fetch(`/v1/documents/${corrDoc.document.link}`, { method: 'PATCH', body: { status: 'F' } });
      const corrRelease = await ctx.fetch(`/v1/documents/${corrDoc.document.link}/release`, { method: 'POST', body: {} });
      ctx.assert(corrRelease._status === 400 && (corrRelease.error || '').includes('LAB'),
        'A non-eligible type refuses release, naming the eligible types (data, not code)');

      // Only Filed documents release.
      const lab2 = await ctx.fetch('/v1/documents', {
        method: 'POST', body: { title: `QA Lab2 ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'LAB', member_number: RNUM }
      });
      const unfiledRelease = await ctx.fetch(`/v1/documents/${lab2.document.link}/release`, { method: 'POST', body: {} });
      ctx.assert(unfiledRelease._status === 409 && (unfiledRelease.error || '').includes('Filed'),
        'An unfiled document refuses release');

      // Under 'rules': release belongs to MD/CM — the PA cannot.
      await ctx.fetch(`/v1/documents/${lab2.document.link}`, { method: 'PATCH', body: { status: 'F' } });
      const flip3 = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'rules' } });
      ctx.assert(flip3._ok, "Mode flipped to 'rules' for the release role check");
      const paRelease = await as(`qa_m_pa_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${lab2.document.link}/release`, { method: 'POST', body: {} }));
      ctx.assert(paRelease._status === 403 && (paRelease.error || '').includes('Medical Director'),
        'PA cannot release (MD/CM only under rules)');
      const mdRelease = await as(`qa_m_md_${stamp}`, () =>
        ctx.fetch(`/v1/documents/${lab2.document.link}/release`, { method: 'POST', body: {} }));
      ctx.assert(mdRelease._ok, 'The Medical Director releases under rules');
      const back3 = await ctx.fetch('/v1/document-access', { method: 'PUT', body: { mode: 'open' } });
      ctx.assert(back3._ok && back3.mode === 'open', "Mode restored to 'open' (story 3 wrap)");

      // A corrected file re-reviews AND re-releases: replace carries the
      // release NOWHERE (new content), but does carry the boundary state.
      const replRel = await ctx.fetch(`/v1/documents/${rLink}/replace`, {
        method: 'POST', body: { file_base64: B64, file_format: 'txt' } });
      ctx.assert(replRel._ok && replRel.document.released === false && replRel.document.registrant_doc === false,
        'A replacement of a released document is NOT released (re-review, re-release) and stays a chart document');

      // ════════════════════════════════════════════════════════════════
      // REV 1.1 §7.3 — the audit log is a protected surface, in EVERY
      // mode. Before S167 ANY logged-in user could read any document's
      // audit trail (the leak check found it). Under 'open' the reader
      // is the tenant admin; the rules-mode MD/PA gate + the no-IHS-path
      // rule are walked in test_access_rules_acceptance.cjs.
      // ════════════════════════════════════════════════════════════════
      const plainTrail = await as(`qa_m_plain_${stamp}`, async () => {
        const trail = await ctx.fetch(`/v1/audit/document/${linkCorr2}`);
        const log = await ctx.fetch('/v1/audit/document-log');
        const report = await ctx.fetch(`/v1/audit/user-report?user_id=${uMd.user_id}`);
        return { trail: trail._status, log: log._status, report: report._status };
      });
      ctx.assert(plainTrail.trail === 403,
        "§7.3: a plain staff login can no longer read a document's audit trail (the S167 leak, closed)");
      ctx.assert(plainTrail.log === 403, '§7.3: nor the program document log');
      ctx.assert(plainTrail.report === 403, '§7.3: nor the whole-user audit report (admin surface)');
      const tOpenBefore = await auditCount('T');
      const adminTrail = await ctx.fetch(`/v1/audit/document/${linkCorr2}`);
      ctx.assert(adminTrail._ok,
        "Under 'open' the admin/superuser reads the trail (platform administration)");
      ctx.assert((await auditCount('T')) === tOpenBefore + 1,
        "And the trail read wrote its own 'T' event — review of the trail is on the trail");
      const fabricate = await ctx.fetch('/v1/audit/test', {
        method: 'POST', body: { table_name: 'document', entity_key: linkCorr2, action: 'W' } });
      ctx.assert(fabricate._status === 403,
        '§7.3: the dev audit door can NEVER fabricate document-layer events — those come only from the real doors');

      // ════════════════════════════════════════════════════════════════
      // REV 1.1 D-3 — the immediate-release-on-filing flag: present and
      // OFF (v156). Off = the logged release action is the only portal
      // path (proven all through story 3 above). ON = filing a
      // release-eligible chart document IS the release, logged the same.
      // ════════════════════════════════════════════════════════════════
      const flagRow = await db.query(
        `SELECT sd.detail_id, sd.value FROM sysparm s
         JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
         WHERE s.tenant_id = $1 AND s.sysparm_key = 'document_access'
           AND sd.category = 'config' AND sd.code = 'immediate_release'`, [WI]);
      ctx.assert(flagRow.rows.length === 1 && flagRow.rows[0].value === '0',
        "D-3 (v156): the immediate_release flag exists and ships OFF ('0')");
      const cfgFlags = await db.query(
        `SELECT sd.code FROM sysparm s JOIN sysparm_detail sd ON sd.sysparm_id = s.sysparm_id
         WHERE s.tenant_id = $1 AND s.sysparm_key = 'document_access' AND sd.category = 'config'
           AND sd.code IN ('caseload_only', 'prescriber_portal') AND sd.value = '0'`, [WI]);
      ctx.assert(cfgFlags.rows.length === 2,
        'D-2/D-9 (v156): caseload_only + prescriber_portal flags present and OFF too');
      await db.query(`UPDATE sysparm_detail SET value = '1' WHERE detail_id = $1`, [flagRow.rows[0].detail_id]);
      try {
        const rBefore2 = await auditCount('R');
        const autoLab = await ctx.fetch('/v1/documents', {
          method: 'POST', body: { title: `QA AutoRelease Lab ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'LAB', member_number: RNUM }
        });
        ctx.assert(autoLab._ok, 'A fresh lab report filed for the participant (flag ON)');
        const autoFiled = await ctx.fetch(`/v1/documents/${autoLab.document.link}`, { method: 'PATCH', body: { status: 'F' } });
        ctx.assert(autoFiled._ok && autoFiled.document.released === true && autoFiled.document.released_date,
          'D-3 flag ON: FILING the lab report released it — no separate action needed');
        ctx.assert((await auditCount('R')) === rBefore2 + 1,
          "And the auto-release wrote the SAME distinct 'R' event the manual door writes");
      } finally {
        await db.query(`UPDATE sysparm_detail SET value = '0' WHERE detail_id = $1`, [flagRow.rows[0].detail_id]);
      }
      const offLab = await ctx.fetch('/v1/documents', {
        method: 'POST', body: { title: `QA NoAutoRelease Lab ${stamp}`, file_format: 'txt', file_base64: B64, type_code: 'LAB', member_number: RNUM }
      });
      const offFiled = await ctx.fetch(`/v1/documents/${offLab.document.link}`, { method: 'PATCH', body: { status: 'F' } });
      ctx.assert(offFiled._ok && offFiled.document.released === false,
        'D-3 flag back OFF: filing does NOT release — the logged release action is again the only path');
    } finally {
      await db.end();
    }
  }
};
