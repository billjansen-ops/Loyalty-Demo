/**
 * Intake Rebuild Phase 2 — Insight / wi_php (the doors, Session 143).
 *
 * The registration LINK: staff mint a registration-type code; the public
 * /register form submits against it (no login) and creates a true
 * REGISTRANT — status Registered (never Participant), an intake item on
 * the case manager's queue, referral source stamped from the link's
 * context, membership number allocated server-side. The public answer
 * never echoes a record or a number.
 *
 * Never-register-twice: an exact name+email re-submit creates NO second
 * record — an open item gets a note; a closed file quietly REACTIVATES
 * (new item, back to case-manager review, same member link). The public
 * answer is identical either way.
 *
 * Staff reactivation door: POST /v1/intake-reactivations (either intake
 * position) — refused for participants, for open items, and for logins
 * holding no intake position.
 *
 * Self-contained: throwaway logins + members; harness snapshot/restore
 * wipes everything. Personas resolved by name, never hand-entered ids.
 */
const { execSync } = require('child_process');

module.exports = {
  name: 'Insight: Intake Phase 2 (registration link -> registrant, dedup/reactivation, staff reactivation door)',

  async run(ctx) {
    const TENANT = 5;
    const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
    const sql = (q) => execSync(
      `${PSQL} -h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'} -t -A -c "${q.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }).toString().trim();

    // publicFetch — NO session cookie: proves the door is truly public.
    async function publicFetch(urlPath, options = {}) {
      const resp = await fetch(`${ctx.apiBase}${urlPath}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      let data;
      try { data = await resp.json(); } catch (e) { data = {}; }
      data._status = resp.status;
      data._ok = resp.ok;
      return data;
    }

    // ── Auth: Claude superuser (home tenant 5) ──
    const login = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    ctx.assert(login._ok, 'Claude login successful');

    // ── Staff: one Case Manager, one Medical Director (throwaway) ──
    const partners = await ctx.fetch(`/v1/partners?tenant_id=${TENANT}`);
    const programs = await ctx.fetch(`/v1/partners/${partners[0].partner_id}/programs?tenant_id=${TENANT}`);
    const stamp = Math.floor(Math.random() * 1e9);

    const cm = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `p2_cm_${stamp}`, password: 'cmpass1', display_name: 'P2 CaseManager', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(cm._ok && cm.user_id, 'Created throwaway case-manager login');
    await ctx.fetch(`/v1/users/${cm.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['CASEMAN', programs[0].program_id] }
    });
    const md = await ctx.fetch('/v1/users', {
      method: 'POST', body: { username: `p2_md_${stamp}`, password: 'mdpass1', display_name: 'P2 MedDirector', tenant_id: TENANT, role: 'csr' }
    });
    ctx.assert(md._ok && md.user_id, 'Created throwaway medical-director login');
    await ctx.fetch(`/v1/users/${md.user_id}/molecule-rows/POSITIONCLINIC`, {
      method: 'POST', body: { values: ['MEDDIR', programs[0].program_id] }
    });

    // ── Mint a REGISTRATION link (what the invite panel now does) ──
    const code = await ctx.fetch(`/v1/codes?tenant_id=${TENANT}`, {
      method: 'POST',
      body: { code_type: 'registration', context: { target: '/register', referral_type: 'Board-mandated', affiliation: 'P2 Test Board' } }
    });
    ctx.assert(code._ok && code.code, 'Minted a registration-type code');

    // The public context read the form uses: type + referral ride back.
    const codeCtx = await publicFetch(`/v1/code-context/${code.code}`);
    ctx.assert(codeCtx._ok && codeCtx.code_type === 'registration', 'code-context answers with code_type registration (no login)');
    ctx.assertEqual(codeCtx.referral_type, 'Board-mandated', 'code-context carries the minted referral type');

    // ── The front door refuses what it should (all public, no login) ──
    const badToken = await publicFetch('/v1/register', {
      method: 'POST', body: { code: 'not-a-real-token', fname: 'Nope', lname: 'Nobody', email: 'nope@test.io' }
    });
    ctx.assert(badToken._status === 404, `Bad token → generic 404 (got ${badToken._status})`);

    const referralCode = await ctx.fetch(`/v1/codes?tenant_id=${TENANT}`, {
      method: 'POST', body: { code_type: 'referral', context: { referral_type: 'Employer' } }
    });
    const wrongType = await publicFetch('/v1/register', {
      method: 'POST', body: { code: referralCode.code, fname: 'Nope', lname: 'Nobody', email: 'nope@test.io' }
    });
    ctx.assert(wrongType._status === 404, `A screening/referral code cannot open the registration door (got ${wrongType._status})`);

    const noContact = await publicFetch('/v1/register', {
      method: 'POST', body: { code: code.code, fname: 'Rita', lname: 'Registrant' }
    });
    ctx.assert(noContact._status === 400 && (noContact.error || '').includes('email address or phone'),
      `Missing contact info → plain-English 400 (got ${noContact._status})`);

    // ── Register a real person through the public door ──
    const reg = await publicFetch('/v1/register', {
      method: 'POST',
      body: { code: code.code, fname: 'Rita', lname: 'Registrant', email: 'rita.registrant@test.io', phone: '555-0142' }
    });
    ctx.assert(reg._ok && reg.success, 'Public registration accepted (no login)');
    ctx.assert(!JSON.stringify(reg).match(/\d{5,}/), 'The public answer echoes no membership number or record');

    const memberLink = sql(`SELECT link FROM member WHERE tenant_id = ${TENANT} AND fname = 'Rita' AND lname = 'Registrant'`);
    ctx.assert(memberLink, 'A member record was created for the registrant');
    const memberCount1 = sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${TENANT} AND fname = 'Rita' AND lname = 'Registrant'`);
    ctx.assertEqual(memberCount1, '1', 'Exactly one record');

    // Status = Registered (never Participant), referral = Board — read the
    // decoded truth off the queue item, and the bytes off the member side.
    const molId = sql(`SELECT molecule_id FROM molecule_def WHERE tenant_id = ${TENANT} AND molecule_key = 'INTAKE_STATUS'`);
    const statusByte = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d WHERE d.p_link = '${memberLink}' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
    const registeredId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'REGISTERED'`);
    ctx.assertEqual(statusByte, registeredId, `Registrant status byte = REGISTERED (${statusByte})`);

    const queue = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const item = (queue.items || []).find(i => i.member_name === 'Rita Registrant');
    ctx.assert(!!item, 'Registration created an intake item on the queue');
    ctx.assert(item && item.review_type === 'CM', `Item starts in case-manager review (got ${item && item.review_type})`);
    ctx.assert(item && item.stage_code === 'REGISTERED', `Queue shows stage Registered — NOT Participant (got ${item && item.stage_code})`);
    ctx.assert(item && item.referral_code === 'BOARD', `Referral source stamped from the link context (got ${item && item.referral_code})`);
    ctx.assert(item && item.assigned_to != null, 'Item has a named owner from day one');

    // A registrant is NOT on the roster (the Phase-1 separation, proven
    // against a REGISTERED status this time).
    const roster = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const rosterList = roster.members || (Array.isArray(roster) ? roster : []);
    ctx.assert(!rosterList.find(m => m.fname === 'Rita' && m.lname === 'Registrant'),
      'The registrant does NOT appear on the participant roster');

    // ── Never register twice: same name+email → no new record, note on
    //    the open item, identical public answer ──
    const dupe = await publicFetch('/v1/register', {
      method: 'POST',
      body: { code: code.code, fname: 'rita', lname: 'REGISTRANT', email: 'Rita.Registrant@test.io' }
    });
    ctx.assert(dupe._ok && dupe.success && dupe.message === reg.message, 'Duplicate submit gets the identical public answer');
    const memberCount2 = sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${TENANT} AND LOWER(fname) = 'rita' AND LOWER(lname) = 'registrant'`);
    ctx.assertEqual(memberCount2, '1', 'No duplicate record was created');
    const dupeNote = sql(`SELECT COUNT(*) FROM intake_note WHERE intake_link = ${item.link} AND note_text LIKE '%Registered again%'`);
    ctx.assertEqual(dupeNote, '1', 'The open item carries the repeat-contact note');

    // ── Close the file (MD), then the same person re-registers → the
    //    closed file REACTIVATES: new item, back to CM review, same link ──
    const mdLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_md_${stamp}`, password: 'mdpass1' } });
    ctx.assert(mdLogin._ok, 'Medical-director login successful');
    // CM must send it to MD first (stage gate) — log in as CM, send.
    const cmLogin = await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_cm_${stamp}`, password: 'cmpass1' } });
    ctx.assert(cmLogin._ok, 'Case-manager login successful');
    const sendMd = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'send_md', reason: 'P2 test — for closure' }
    });
    ctx.assert(sendMd._ok, 'CM sent the item for Medical Director review');
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_md_${stamp}`, password: 'mdpass1' } });
    const close = await ctx.fetch(`/v1/intake-items/${item.link}/actions`, {
      method: 'POST', body: { action: 'close_file', reason: 'P2 test — closing to prove reactivation' }
    });
    ctx.assert(close._ok, 'MD closed the file');
    const closedByte = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d WHERE d.p_link = '${memberLink}' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
    const closedId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'CLOSED'`);
    ctx.assertEqual(closedByte, closedId, 'Member status is Closed after close_file');

    const reReg = await publicFetch('/v1/register', {
      method: 'POST',
      body: { code: code.code, fname: 'Rita', lname: 'Registrant', email: 'rita.registrant@test.io' }
    });
    ctx.assert(reReg._ok && reReg.success, 'Re-registration after closure accepted (public)');
    const memberCount3 = sql(`SELECT COUNT(*) FROM member WHERE tenant_id = ${TENANT} AND fname = 'Rita' AND lname = 'Registrant'`);
    ctx.assertEqual(memberCount3, '1', 'Still exactly one record — reactivation, never re-registration');
    const reByte = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d WHERE d.p_link = '${memberLink}' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
    const cmReviewId = sql(`SELECT value_id FROM molecule_value_text WHERE molecule_id = ${molId} AND text_value = 'CM_REVIEW'`);
    ctx.assertEqual(reByte, cmReviewId, 'Reactivated person is back in case-manager review');
    const openItems = sql(`SELECT COUNT(*) FROM intake_item WHERE member_link = '${memberLink}' AND tenant_id = ${TENANT} AND status <> 'R'`);
    ctx.assertEqual(openItems, '1', 'Reactivation opened exactly one new intake item');
    const totalItems = sql(`SELECT COUNT(*) FROM intake_item WHERE member_link = '${memberLink}' AND tenant_id = ${TENANT}`);
    ctx.assertEqual(totalItems, '2', 'History intact: the closed item remains alongside the new one');

    // ── The staff reactivation door ──
    // Close the fresh item again so there is something to reactivate.
    const q2 = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
    const item2 = (q2.items || []).find(i => i.member_name === 'Rita Registrant');
    ctx.assert(!!item2, 'The reactivated item is on the queue');
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_cm_${stamp}`, password: 'cmpass1' } });
    await ctx.fetch(`/v1/intake-items/${item2.link}/actions`, { method: 'POST', body: { action: 'send_md', reason: 'P2 — to close again' } });
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_md_${stamp}`, password: 'mdpass1' } });
    await ctx.fetch(`/v1/intake-items/${item2.link}/actions`, { method: 'POST', body: { action: 'close_file', reason: 'P2 — closed for staff-door test' } });

    const memberNumber = sql(`SELECT membership_number FROM member WHERE link = '${memberLink}'`);

    // A login with NO intake position is refused.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    const noPosition = await ctx.fetch('/v1/intake-reactivations', {
      method: 'POST', body: { membership_number: memberNumber }
    });
    ctx.assert(noPosition._status === 403, `A login holding no intake position cannot reactivate (got ${noPosition._status})`);

    // The case manager reactivates.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_cm_${stamp}`, password: 'cmpass1' } });
    const staffReact = await ctx.fetch('/v1/intake-reactivations', {
      method: 'POST', body: { membership_number: memberNumber, note: 'Completed outside treatment — returning' }
    });
    ctx.assert(staffReact._ok && staffReact.item_link, 'Case manager reactivated the closed registrant');
    const reByte2 = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d WHERE d.p_link = '${memberLink}' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
    ctx.assertEqual(reByte2, cmReviewId, 'Staff reactivation also lands in case-manager review');
    const reactNote = sql(`SELECT COUNT(*) FROM intake_note WHERE intake_link = ${staffReact.item_link} AND note_text LIKE '%Completed outside treatment%'`);
    ctx.assertEqual(reactNote, '1', 'The reactivation note is on the new item, attributed');

    // Reactivating someone with an OPEN item is refused with guidance.
    const openRefuse = await ctx.fetch('/v1/intake-reactivations', {
      method: 'POST', body: { membership_number: memberNumber }
    });
    ctx.assert(openRefuse._status === 409 && (openRefuse.error || '').includes('open intake item'),
      `Open item → plain-English 409 (got ${openRefuse._status})`);

    // Reactivating an active PARTICIPANT is refused. The pick must EXCLUDE
    // participants with an open intake item — on a live database those
    // exist, and the open-item refusal answers first (a different, equally
    // correct 409). Deterministic order, no disk-order luck (S147 rehearsal
    // lesson — same class as the date-tiebreaker rule).
    const participant = sql(`SELECT m.membership_number FROM member m JOIN "5_data_1" d ON d.p_link = m.link AND d.molecule_id = ${molId} AND d.attaches_to = 'M' WHERE m.tenant_id = ${TENANT} AND ascii(d.c1)-1 = 11 AND m.is_active = true AND NOT EXISTS (SELECT 1 FROM intake_item i WHERE i.member_link = m.link AND i.status = 'O') ORDER BY m.link LIMIT 1`);
    if (participant) {
      const partRefuse = await ctx.fetch('/v1/intake-reactivations', {
        method: 'POST', body: { membership_number: participant }
      });
      ctx.assert(partRefuse._status === 409 && (partRefuse.error || '').includes('active participant'),
        `Active participant → plain-English 409 (got ${partRefuse._status})`);
    }

    // ═══ PARTICIPANT ACTIVATION — the one conversion moment ═══
    // A fresh registrant through the public door…
    const reg2 = await publicFetch('/v1/register', {
      method: 'POST',
      body: { code: code.code, fname: 'Paul', lname: 'Participant2b', email: 'paul.participant@test.io' }
    });
    ctx.assert(reg2._ok, 'Second registrant created through the public door');
    const paulLink = sql(`SELECT link FROM member WHERE tenant_id = ${TENANT} AND fname = 'Paul' AND lname = 'Participant2b'`);
    const paulNumber = sql(`SELECT membership_number FROM member WHERE link = '${paulLink}'`);

    // …is NOT on the roster while a registrant…
    const rosterBefore = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}`);
    const beforeList = rosterBefore.members || (Array.isArray(rosterBefore) ? rosterBefore : []);
    ctx.assert(!beforeList.find(x => x.lname === 'Participant2b'), 'Registrant absent from the roster before activation');

    // Refusals: no intake position; no clinic.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    const actNoPos = await ctx.fetch('/v1/participant-activations', {
      method: 'POST', body: { membership_number: paulNumber, program_id: programs[0].program_id }
    });
    ctx.assert(actNoPos._status === 403, `Activation refused without an intake position (got ${actNoPos._status})`);
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: `p2_cm_${stamp}`, password: 'cmpass1' } });
    const actNoClinic = await ctx.fetch('/v1/participant-activations', {
      method: 'POST', body: { membership_number: paulNumber }
    });
    ctx.assert(actNoClinic._status === 400 && (actNoClinic.error || '').includes('clinic'),
      `Activation without a clinic → plain-English 400 (got ${actNoClinic._status})`);

    // The case manager records the signed agreement.
    const act = await ctx.fetch('/v1/participant-activations', {
      method: 'POST',
      body: { membership_number: paulNumber, program_id: programs[0].program_id, note: 'Agreement signed in office.' }
    });
    ctx.assert(act._ok && act.success, 'Activation accepted (signed monitoring agreement recorded)');

    const paulByte = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d WHERE d.p_link = '${paulLink}' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
    ctx.assertEqual(paulByte, '11', 'Status is now Participant (value_id 11)');
    const paulOpen = sql(`SELECT COUNT(*) FROM intake_item WHERE member_link = '${paulLink}' AND tenant_id = ${TENANT} AND status <> 'R'`);
    ctx.assertEqual(paulOpen, '0', 'The open intake item was resolved by activation');
    const paulRes = sql(`SELECT resolution_code FROM intake_item WHERE member_link = '${paulLink}' AND tenant_id = ${TENANT} ORDER BY link DESC LIMIT 1`);
    ctx.assertEqual(paulRes, 'PARTICIPANT', 'Resolution reads Participant — the disposition IS the signature');

    // On the roster now — AND under the assigned clinic (the clinic filter
    // reads the PARTNER_PROGRAM molecule through the real path).
    const rosterAfter = await ctx.fetch(`/v1/wellness/members?tenant_id=${TENANT}&program_id=${programs[0].program_id}`);
    const afterList = rosterAfter.members || (Array.isArray(rosterAfter) ? rosterAfter : []);
    ctx.assert(!!afterList.find(x => x.lname === 'Participant2b'),
      'The new participant appears on the roster UNDER the assigned clinic');

    // Activating twice is refused.
    const actAgain = await ctx.fetch('/v1/participant-activations', {
      method: 'POST', body: { membership_number: paulNumber, program_id: programs[0].program_id }
    });
    ctx.assert(actAgain._status === 409 && (actAgain.error || '').includes('already an active participant'),
      `Second activation → plain-English 409 (got ${actAgain._status})`);

    // ═══ COLUMBIA AT INTAKE — the ONE intake→registry wire (v113) ═══
    // Run against Rita, who is a REGISTRANT (reactivated, case-manager
    // review): a positive Columbia fires SENTINEL whether or not the
    // person ever becomes a participant (spec §3).
    const surveys = await ctx.fetch(`/v1/surveys?tenant_id=${TENANT}`);
    const cssrs = surveys.find(s => s.survey_code === 'CSSRS');
    ctx.assert(!!cssrs, 'CSSRS survey exists (v113)');
    ctx.assert(cssrs && cssrs.instrument_purpose === 'screening' && cssrs.cadence_days == null,
      'CSSRS is a screening instrument, cadence NULL (MEDS-exempt)');
    ctx.assert(cssrs && cssrs.respondent_type === 'C', 'CSSRS is clinician-administered (intake staff perform it)');

    const cssrsQs = await ctx.fetch(`/v1/surveys/${cssrs.link}/questions?tenant_id=${TENANT}`);
    ctx.assert(Array.isArray(cssrsQs) && cssrsQs.length === 6, `C-SSRS has 6 items (got ${cssrsQs.length})`);
    ctx.assert(cssrsQs.every(q => (q.answers || []).length === 2), 'every item is Yes/No');
    ctx.assert(cssrsQs.some(q => q.category_code === 'CSSRS_ACT'), 'item 6 carries the behavior category');

    const activityDate = new Date().toLocaleDateString('en-CA');
    async function submitCssrs(memberNumber, answerByCategory) {
      const created = await ctx.fetch(`/v1/members/${memberNumber}/surveys`, {
        method: 'POST', body: { survey_link: cssrs.link, tenant_id: TENANT, activity_date: activityDate }
      });
      ctx.assert(created._ok, 'CSSRS member survey created');
      return await ctx.fetch(`/v1/member-surveys/${created.member_survey_link}/answers`, {
        method: 'PUT',
        body: {
          answers: cssrsQs.map(q => ({ question_link: q.question_link, answer: answerByCategory(q) })),
          submit: true, tenant_id: TENANT, activity_date: activityDate
        }
      });
    }
    async function openRegistryItems(memberNumber) {
      const resp = await ctx.fetch(`/v1/stability-registry/member/${memberNumber}?tenant_id=${TENANT}`);
      if (!resp._ok) return [];
      const items = resp.registry_items || resp.items || resp;
      return Array.isArray(items) ? items.filter(i => i.status === 'O') : [];
    }

    const ritaNumber = memberNumber; // Rita — the reactivated REGISTRANT
    const beforeItems = (await openRegistryItems(ritaNumber)).length;

    // Negative screen: all No → scored, positive=false, NO registry item.
    const negative = await submitCssrs(ritaNumber, () => 0);
    ctx.assert(negative._ok, 'Negative Columbia submit succeeds');
    ctx.assert(negative.scoring && negative.scoring.points === 0 && !(negative.scoring.signals || []).length,
      `Negative screen scores 0, raises no signal (got ${negative.scoring && negative.scoring.points})`);
    const afterNegative = (await openRegistryItems(ritaNumber)).length;
    ctx.assertEqual(String(afterNegative), String(beforeItems), 'Negative Columbia creates NO registry item');

    // Positive screen: "any thoughts of killing yourself" = Yes → SENTINEL.
    const positive = await submitCssrs(ritaNumber, q => q.category_code === 'CSSRS_IDEA' ? 1 : 0);
    ctx.assert(positive._ok, 'Positive Columbia submit succeeds');
    ctx.assert(positive.scoring && (positive.scoring.signals || []).includes('CSSRS_POSITIVE'),
      'Positive screen raises CSSRS_POSITIVE');
    const afterPositive = await openRegistryItems(ritaNumber);
    ctx.assert(afterPositive.length === beforeItems + 1,
      `A positive Columbia on a REGISTRANT fires exactly one registry item (before ${beforeItems}, after ${afterPositive.length})`);
    const sentinelItem = afterPositive
      .slice()
      .sort((a, b) => (b.link || b.registry_link || 0) - (a.link || a.registry_link || 0))[0];
    ctx.assert(sentinelItem && String(sentinelItem.urgency).toUpperCase() === 'SENTINEL',
      `The registry item is SENTINEL urgency (got ${sentinelItem && sentinelItem.urgency})`);

    // The intake surface stayed clean: Rita's open INTAKE item count did
    // not change — the SENTINEL went to the clinical surface, not the queue.
    const stillOpen = sql(`SELECT COUNT(*) FROM intake_item WHERE member_link = '${memberLink}' AND tenant_id = ${TENANT} AND status <> 'R'`);
    ctx.assertEqual(stillOpen, '1', 'The intake queue is untouched by the clinical alert (surface separation holds)');

    // ═══ BROWSER WALK — the public form, then UI activation ═══
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
      // The registration front door, exactly as an invited person hits it:
      // /p/:code redirects to /register?c= and the form pre-fills.
      await page.goto(`${origin}/p/${code.code}`);
      await new Promise(r => setTimeout(r, 2000));
      const landed = await page.evaluate(() => ({
        url: window.location.pathname + window.location.search,
        formVisible: document.getElementById('formCard')?.style.display !== 'none',
        chipsText: document.getElementById('refChips')?.innerText || '',
        selected: document.querySelector('.chip.sel')?.textContent || '',
        affNote: document.getElementById('affNote')?.textContent || ''
      }));
      ctx.assert(landed.url.startsWith('/register?c='), `Registration link lands on /register (got ${landed.url})`);
      ctx.assert(landed.formVisible, 'The registration form renders over a valid code');
      ctx.assert(landed.selected.includes('licensing board'), `Referral chip pre-selected from the link (got '${landed.selected}')`);
      ctx.assert(landed.affNote.includes('P2 Test Board'), 'Affiliation note shows');

      // Fill + submit → confirmation, and the registrant reaches the queue.
      await page.evaluate(() => {
        document.getElementById('fname').value = 'Wanda';
        document.getElementById('lname').value = 'Walkin';
        document.getElementById('email').value = 'wanda.walkin@test.io';
      });
      await page.evaluate(() => submitRegistration());
      await new Promise(r => setTimeout(r, 2000));
      const confirmed = await page.evaluate(() => ({
        done: document.getElementById('doneCard')?.classList.contains('show'),
        text: document.getElementById('doneMsg')?.textContent || ''
      }));
      ctx.assert(confirmed.done, 'Submit shows the confirmation card');
      ctx.assert(confirmed.text.includes('two business days'), 'Confirmation promises the outreach window');
      const wandaQueue = await ctx.fetch(`/v1/intake-items?tenant_id=${TENANT}`);
      const wandaItem = (wandaQueue.items || []).find(i => i.member_name === 'Wanda Walkin');
      ctx.assert(!!wandaItem && wandaItem.stage_code === 'REGISTERED',
        'The walked-in registrant reached the queue as Registered');

      // The bare /register (no code) shows the inactive card, not the form.
      await page.goto(`${origin}/register`);
      await new Promise(r => setTimeout(r, 1200));
      const bare = await page.evaluate(() => ({
        inactive: document.getElementById('inactive')?.classList.contains('show'),
        formVisible: document.getElementById('formCard')?.style.display !== 'none'
      }));
      ctx.assert(bare.inactive && !bare.formVisible, 'No code → the inactive-link card, never the form');

      // ── The queue as the case manager: activate Wanda through the UI ──
      await page.evaluate(async (u) => {
        await fetch('/v1/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ username: u, password: 'cmpass1' })
        });
      }, `p2_cm_${stamp}`);
      await page.evaluate(() => {
        sessionStorage.setItem('tenant_id', '5');
        sessionStorage.setItem('tenant_name', 'Insight Health Solutions');
      });
      await page.goto(`${origin}/verticals/workforce_monitoring/intake_queue.html`);
      await new Promise(r => setTimeout(r, 3000));

      const queueView = await page.evaluate(() => ({
        reactivateVisible: document.getElementById('reactivateBtn')?.style.display !== 'none',
      }));
      ctx.assert(queueView.reactivateVisible, 'The reactivate-a-closed-file door shows for an intake position');

      await page.evaluate((link) => openItemByLink(link), wandaItem.link);
      await new Promise(r => setTimeout(r, 1500));
      const itemModal = await page.evaluate(() => document.getElementById('detailOverlay')?.innerText || '');
      ctx.assert(itemModal.includes('Record signed agreement'), 'CM sees the record-signed-agreement action');

      await page.evaluate((num) => startActivation(num, 'Wanda Walkin'), String(wandaItem.membership_number));
      await new Promise(r => setTimeout(r, 2000));
      const actModal = await page.evaluate(() => ({
        text: document.getElementById('detailOverlay')?.innerText || '',
        partnerOptions: document.getElementById('actPartner')?.options.length || 0
      }));
      ctx.assert(actModal.text.includes('one moment a registrant becomes a participant'), 'Activation panel explains itself');
      ctx.assert(actModal.partnerOptions > 1, `Organization picker populated (${actModal.partnerOptions} options)`);

      // Pick the first real organization + program, then activate.
      await page.evaluate(async () => {
        const p = document.getElementById('actPartner');
        p.value = p.options[1].value;
        await loadActPrograms();
      });
      await new Promise(r => setTimeout(r, 1500));
      const programPicked = await page.evaluate(() => {
        const s = document.getElementById('actProgram');
        if (s.options.length < 2) return false;
        s.value = s.options[1].value;
        return true;
      });
      ctx.assert(programPicked, 'Clinic picker populated from the organization');
      await page.evaluate((num) => confirmActivation(num), String(wandaItem.membership_number));
      await new Promise(r => setTimeout(r, 2500));

      const wandaByte = sql(`SELECT ascii(d.c1)-1 FROM "5_data_1" d JOIN member m ON m.link = d.p_link WHERE m.fname = 'Wanda' AND m.lname = 'Walkin' AND d.molecule_id = ${molId} AND d.attaches_to = 'M'`);
      ctx.assertEqual(wandaByte, '11', 'UI activation made Wanda a Participant (value_id 11)');
      const wandaOpen = sql(`SELECT COUNT(*) FROM intake_item ii JOIN member m ON m.link = ii.member_link WHERE m.fname = 'Wanda' AND ii.status <> 'R'`);
      ctx.assertEqual(wandaOpen, '0', 'Her intake item resolved through the UI flow');

      // ── The invite panel's link-type chooser (refer_participant.js) ──
      // Load the shared module into the live page and drive the panel.
      await page.addScriptTag({ url: `${origin}/qrcode.min.js` });
      await page.addScriptTag({ url: `${origin}/verticals/workforce_monitoring/refer_participant.js` });
      await page.evaluate(() => ReferParticipant.open({ tenantId: 5 }));
      await new Promise(r => setTimeout(r, 800));
      const panel = await page.evaluate(() => ({
        kinds: document.getElementById('rpKinds')?.innerText || '',
        trackVisible: document.getElementById('rpTrackField')?.style.display !== 'none',
        btnLabel: document.getElementById('rpCreate')?.textContent || ''
      }));
      ctx.assert(panel.kinds.includes('Screening link') && panel.kinds.includes('Registration link'),
        'Invite panel offers both link types');
      ctx.assert(panel.trackVisible && panel.btnLabel === 'Create referral link',
        'Screening is the default (track shown, referral-link button)');

      await page.evaluate(() => {
        document.querySelector('#rpKinds .rp-chip[data-kind="registration"]').click();
      });
      const regPanel = await page.evaluate(() => ({
        trackVisible: document.getElementById('rpTrackField')?.style.display !== 'none',
        btnLabel: document.getElementById('rpCreate')?.textContent || '',
        hint: document.getElementById('rpKindHint')?.textContent || ''
      }));
      ctx.assert(!regPanel.trackVisible && regPanel.btnLabel === 'Create registration link',
        'Registration kind hides Track and relabels the button');
      ctx.assert(regPanel.hint.includes('intake queue'), 'The hint says what a registration link does');

      await page.evaluate(() => ReferParticipant._mint());
      await new Promise(r => setTimeout(r, 1500));
      const minted = await page.evaluate(() => document.getElementById('rpLink')?.textContent || '');
      ctx.assert(minted.includes('/p/'), `Panel minted a working /p/ link (got '${minted.substring(0, 40)}…')`);
      const mintedToken = minted.split('/p/')[1];
      const mintedRow = sql(`SELECT code_type || '|' || (context->>'target') FROM code WHERE code = '${mintedToken}'`);
      ctx.assertEqual(mintedRow, 'registration|/register',
        'The minted code is registration-typed and targets /register');

      ctx.assert(pageErrors.length === 0, `Zero page errors on the walk (${pageErrors.slice(0, 2).join(' | ')})`);
      const realConsoleErrors = consoleErrors.filter(t => !t.includes('favicon'));
      ctx.assert(realConsoleErrors.length === 0, `Zero console errors on the walk (${realConsoleErrors.slice(0, 2).join(' | ')})`);
    } finally {
      await page.close();
    }
  }
};
