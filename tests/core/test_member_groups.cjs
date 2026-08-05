/**
 * Core: Member Groups v1 (Session 156 — docs/GROUPS_AND_MEDS_DESIGN.md, story 1)
 *
 * STATIC groups: member_group (3-byte link, criteria as provenance via the
 * shared rule/rule_criteria pair) + member_group_member (5-byte link, one row
 * per person per STAY). Removal is the GROUP_REMOVED date MOLECULE on the
 * stay row — never a column, never a DELETE. The manners: criteria put
 * members in; only a DELIBERATE act takes one out — and only a deliberate act
 * (hand-add) puts a removed member back. Engines never undo a human removal.
 *
 * Proves, all through platform doors (membership numbers + endpoints; raw SQL
 * only for byte-level verification per MOLECULES.md §7):
 *   1. Create + guards: duplicate code 409; bad code 400; no-criteria preview
 *      refused; activity-field criterion refused in plain English.
 *   2. Preview answers count + list and WRITES NOTHING.
 *   3. Run adds matches as stays; re-run adds nothing (adds-only).
 *   4. Removal stamps the GROUP_REMOVED molecule on the stay — byte-proven:
 *      right molecule, right p_link, the member_group_member REGISTRY byte
 *      (the platform's first 5-byte own-table parent), today's Bill-epoch day
 *      — and the stay row SURVIVES (history serves it).
 *   5. Manners: re-run skips the removed member; hand re-add starts a NEW
 *      stay; duplicate add 409.
 *   6. MEMBER_GROUP criteria window: a REAL bonus with "in group" criteria
 *      fires for a member in the group and not for one outside it.
 *   7. 'group' result type: the firing bonus WRITES membership to a second
 *      group; a second firing adds no duplicate; after a staff removal the
 *      engine does NOT re-add (deliberate removal beats engine adds).
 *   8. Delete refused in plain English NAMING the referencing bonus (criteria
 *      AND result); after the bonus goes, deletes succeed and leave zero
 *      stays and zero orphaned molecule rows.
 *
 * Tenant 1 (Delta). All objects created and deleted inside the test;
 * snapshot/restore wipes the accrual side-effects.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'billjansen',
  database: process.env.PGDATABASE || 'loyalty',
  // One clock (S167): pin the test's Postgres session to the MACHINE's
  // timezone so date_to_molecule_int(CURRENT_DATE) answers the same
  // "today" the platform's JS date helpers compute. Without the pin, a
  // Postgres server configured in another zone answers a different day
  // for part of every day (found in Bangalore: IST machine, Central
  // Postgres — every IST morning until 10:30 the two clocks disagreed).
  options: `-c TimeZone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
};

const G1 = 'TG_S156';
const G2 = 'TG2_S156';
const BONUS = 'TGB_S156';

module.exports = {
  name: 'Core: Member groups (static groups, removal molecule, criteria window, group results)',

  async run(ctx) {
    const db = new Client(DB_CONFIG);
    await db.connect();
    const tenantId = 1;
    let bonusId = null;

    try {
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
      await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenantId } });

      // ── 1. Create + guards ──
      ctx.log('Step 1: create the group; the doors refuse nonsense in plain English');
      const created = await ctx.fetch('/v1/groups', {
        method: 'POST',
        body: { group_code: G1, group_name: 'S156 test group', description: 'standing test' }
      });
      ctx.assert(created._ok, `group created (${created._status}${created.error ? ': ' + created.error : ''})`);

      const dup = await ctx.fetch('/v1/groups', {
        method: 'POST', body: { group_code: G1.toLowerCase(), group_name: 'dupe' }
      });
      ctx.assertEqual(dup._status, 409, `duplicate code refused case-insensitively (${dup._status})`);

      const badCode = await ctx.fetch('/v1/groups', {
        method: 'POST', body: { group_code: 'bad code!', group_name: 'x' }
      });
      ctx.assertEqual(badCode._status, 400, `URL-unsafe code refused (${badCode._status})`);

      const noCritPreview = await ctx.fetch(`/v1/groups/${G1}/preview`, { method: 'POST' });
      ctx.assert(noCritPreview._status === 400 && /criteria/i.test(noCritPreview.error || ''),
        `no-criteria preview refused with a plain-English reason (${noCritPreview.error})`);

      const actCrit = await ctx.fetch(`/v1/groups/${G1}/criteria`, {
        method: 'POST',
        body: { source: 'Activity', molecule: 'FARE_CLASS', operator: 'equals', value: 'F', label: 'Fare F' }
      });
      ctx.assert(actCrit._status === 400 && /activity field/i.test(actCrit.error || ''),
        `activity-field criterion refused in plain English (${actCrit.error})`);

      // ── 2. Criterion + preview writes nothing ──
      ctx.log('Step 2: member criterion; preview counts without writing');
      const crit = await ctx.fetch(`/v1/groups/${G1}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'MEMBER_STATE', operator: 'equals', value: 'MN', label: 'Minnesota resident' }
      });
      ctx.assert(crit._ok, `member criterion saved (${crit._status}${crit.error ? ': ' + crit.error : ''})`);

      const expected = Number((await db.query(
        `SELECT COUNT(*)::int AS n FROM member WHERE tenant_id = $1 AND is_active = true AND state = 'MN'`,
        [tenantId])).rows[0].n);
      ctx.assert(expected > 0, `precondition: Delta has active MN members (${expected})`);

      const groupLink = (await db.query(
        `SELECT link FROM member_group WHERE tenant_id = $1 AND group_code = $2`, [tenantId, G1])).rows[0].link;

      const preview = await ctx.fetch(`/v1/groups/${G1}/preview`, { method: 'POST' });
      ctx.assert(preview._ok, `preview answers (${preview._status})`);
      ctx.assert(preview.checked > 0, `preview checked the tenant's members (${preview.checked})`);
      ctx.assertEqual(preview.match_count, expected, `preview matches every active MN member (${preview.match_count}/${expected})`);
      const staysAfterPreview = Number((await db.query(
        `SELECT COUNT(*)::int AS n FROM member_group_member WHERE group_link = $1`, [groupLink])).rows[0].n);
      ctx.assertEqual(staysAfterPreview, 0, 'preview wrote NOTHING');

      // ── 3. Run adds matches; re-run adds nothing ──
      ctx.log('Step 3: run = matches become stays; adds-only on re-run');
      const run1 = await ctx.fetch(`/v1/groups/${G1}/run`, { method: 'POST' });
      ctx.assert(run1._ok, `run succeeds (${run1._status})`);
      ctx.assertEqual(run1.added, expected, `run added every match (${run1.added}/${expected})`);
      const badStays = await db.query(`
        SELECT COUNT(*)::int AS n FROM member_group_member mm
        JOIN member m ON m.link = mm.p_link
        WHERE mm.group_link = $1 AND m.state <> 'MN'`, [groupLink]);
      ctx.assertEqual(Number(badStays.rows[0].n), 0, 'every stay belongs to an MN member');

      const run2 = await ctx.fetch(`/v1/groups/${G1}/run`, { method: 'POST' });
      ctx.assertEqual(run2.added, 0, `re-run adds nothing (${run2.added})`);
      ctx.assertEqual(run2.already_in, expected, `re-run reports everyone already in (${run2.already_in})`);

      // ── 4. Removal = the GROUP_REMOVED molecule, byte-proven ──
      ctx.log('Step 4: removal stamps the molecule on the stay; the row survives');
      const members1 = await ctx.fetch(`/v1/groups/${G1}/members`);
      ctx.assert(Array.isArray(members1) && members1.length === expected, `member list serves all current (${members1.length})`);
      const target = members1[0];

      const stayRow = await db.query(`
        SELECT mm.link FROM member_group_member mm
        JOIN member m ON m.link = mm.p_link
        WHERE mm.group_link = $1 AND m.membership_number = $2`, [groupLink, target.membership_number]);
      const stayLink = stayRow.rows[0].link;

      const rem = await ctx.fetch(`/v1/groups/${G1}/members/${encodeURIComponent(target.membership_number)}`, { method: 'DELETE' });
      ctx.assert(rem._ok, `staff removal succeeds (${rem._status})`);

      // Byte-level (§7): right molecule, right parent, the REGISTRY byte, today's day
      const mol = await db.query(`
        SELECT d.n1, d.attaches_to,
               (SELECT CHR(entity_id % 127 + 1) FROM link_tank WHERE table_key = 'member_group_member' AND entity_id IS NOT NULL) AS registry_byte,
               date_to_molecule_int(CURRENT_DATE) AS today
        FROM "5_data_2" d
        JOIN molecule_def md ON md.molecule_id = d.molecule_id
        WHERE md.molecule_key = 'GROUP_REMOVED' AND md.tenant_id = $1 AND d.p_link = $2`, [tenantId, stayLink]);
      ctx.assertEqual(mol.rows.length, 1, 'exactly one GROUP_REMOVED molecule row on the stay');
      ctx.assertEqual(mol.rows[0].attaches_to, mol.rows[0].registry_byte,
        `the row carries the member_group_member REGISTRY byte (${JSON.stringify(mol.rows[0].attaches_to)}) — 5-byte own-table parent, never a borrowed A/M`);
      ctx.assertEqual(Number(mol.rows[0].n1), Number(mol.rows[0].today), 'the stored value is today as a Bill-epoch day');
      const stayStill = await db.query(`SELECT 1 FROM member_group_member WHERE link = $1`, [stayLink]);
      ctx.assertEqual(stayStill.rows.length, 1, 'the stay row SURVIVES the removal — history, not deletion');

      const members2 = await ctx.fetch(`/v1/groups/${G1}/members`);
      ctx.assert(!members2.some(m => m.membership_number === target.membership_number), 'removed member gone from the current list');
      const history = await ctx.fetch(`/v1/groups/${G1}/members?history=1`);
      const histRow = history.find(m => m.membership_number === target.membership_number);
      ctx.assert(histRow && histRow.removed_date, `history shows the ended stay with its removal date (${histRow?.removed_date})`);
      const csr1 = await ctx.fetch(`/v1/members/${encodeURIComponent(target.membership_number)}/groups`);
      ctx.assert(!csr1.some(g => g.group_code === G1), 'the CSR groups endpoint no longer lists the group');
      const remAgain = await ctx.fetch(`/v1/groups/${G1}/members/${encodeURIComponent(target.membership_number)}`, { method: 'DELETE' });
      ctx.assertEqual(remAgain._status, 409, `removing a non-member is refused (${remAgain._status})`);

      // ── 5. The manners ──
      ctx.log('Step 5: re-run respects the removal; hand re-add starts a NEW stay');
      const run3 = await ctx.fetch(`/v1/groups/${G1}/run`, { method: 'POST' });
      ctx.assert(run3.removed_stays_out >= 1, `re-run reports the removed member staying out (${run3.removed_stays_out})`);
      const members3 = await ctx.fetch(`/v1/groups/${G1}/members`);
      ctx.assert(!members3.some(m => m.membership_number === target.membership_number), 'criteria re-run did NOT undo the human removal');

      const readd = await ctx.fetch(`/v1/groups/${G1}/members`, {
        method: 'POST', body: { membership_number: target.membership_number }
      });
      ctx.assert(readd._ok, `deliberate hand re-add succeeds (${readd._status})`);
      const stays = await db.query(`
        SELECT COUNT(*)::int AS n FROM member_group_member mm
        JOIN member m ON m.link = mm.p_link
        WHERE mm.group_link = $1 AND m.membership_number = $2`, [groupLink, target.membership_number]);
      ctx.assertEqual(Number(stays.rows[0].n), 2, 'the re-add is a NEW stay — both stays exist as history');
      const dupAdd = await ctx.fetch(`/v1/groups/${G1}/members`, {
        method: 'POST', body: { membership_number: target.membership_number }
      });
      ctx.assertEqual(dupAdd._status, 409, `adding a current member is refused (${dupAdd._status})`);

      // ── 6. MEMBER_GROUP criteria window: a real bonus fires on membership ──
      ctx.log('Step 6: a bonus with "in group" criteria fires for members, not outsiders');
      const bonusResp = await ctx.fetch('/v1/bonuses', {
        method: 'POST',
        body: {
          bonus_code: BONUS, bonus_description: 'S156 group-criteria test bonus',
          bonus_type: 'fixed', bonus_amount: 100, start_date: '2026-01-01',
          is_active: true, tenant_id: tenantId
        }
      });
      bonusId = bonusResp.bonus?.bonus_id || bonusResp.bonus_id;
      ctx.assert(bonusResp._ok && bonusId, `test bonus created (${bonusResp._status})`);
      const bCrit = await ctx.fetch(`/v1/bonuses/${bonusId}/criteria`, {
        method: 'POST',
        body: { source: 'Member', molecule: 'MEMBER_GROUP', operator: 'in', value: [G1], label: `In ${G1}` }
      });
      ctx.assert(bCrit._ok, `MEMBER_GROUP criterion saved on the bonus (${bCrit._status}${bCrit.error ? ': ' + bCrit.error : ''})`);

      const outMember = (await db.query(`
        SELECT membership_number FROM member
        WHERE tenant_id = $1 AND is_active = true AND state <> 'MN' AND membership_number IS NOT NULL
        ORDER BY membership_number LIMIT 1`, [tenantId])).rows[0].membership_number;

      const flight = (num) => ctx.fetch(`/v1/members/${encodeURIComponent(num)}/accruals`, {
        method: 'POST',
        body: {
          tenant_id: tenantId, activity_date: '2026-04-07', base_points: 500,
          CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'ORD', FARE_CLASS: 'Y',
          FLIGHT_NUMBER: 700, MQD: 100, SEAT_TYPE: 'A'
        }
      });

      const inFlight = await flight(target.membership_number);
      ctx.assert(inFlight._ok, `accrual for the group member lands (${inFlight._status})`);
      const inCodes = (inFlight.bonuses || []).map(b => b.bonus_code);
      ctx.assert(inCodes.includes(BONUS), `the bonus FIRED for the member in ${G1} (${inCodes.join(', ') || 'none'})`);

      const outFlight = await flight(outMember);
      ctx.assert(outFlight._ok, `accrual for the outsider lands (${outFlight._status})`);
      const outCodes = (outFlight.bonuses || []).map(b => b.bonus_code);
      ctx.assert(!outCodes.includes(BONUS), `the bonus did NOT fire for the member outside ${G1} (${outCodes.join(', ') || 'none'})`);

      // ── 7. 'group' result: the engine writes membership, with manners ──
      ctx.log("Step 7: the bonus's 'group' result adds to a second group — once, and never after a removal");
      const g2 = await ctx.fetch('/v1/groups', {
        method: 'POST', body: { group_code: G2, group_name: 'S156 result target' }
      });
      ctx.assert(g2._ok, `second group created (${g2._status})`);
      const g2Link = (await db.query(
        `SELECT link FROM member_group WHERE tenant_id = $1 AND group_code = $2`, [tenantId, G2])).rows[0].link;

      const resAdd = await ctx.fetch(`/v1/bonuses/${bonusId}/results`, {
        method: 'POST',
        body: { tenant_id: tenantId, result_type: 'group', result_group_code: G2, sort_order: 0 }
      });
      ctx.assert(resAdd._ok, `'group' result saved on the bonus (${resAdd._status}${resAdd.error ? ': ' + resAdd.error : ''})`);

      const fire1 = await flight(target.membership_number);
      ctx.assert((fire1.bonuses || []).some(b => b.bonus_code === BONUS), 'the bonus fired again');
      const csr2 = await ctx.fetch(`/v1/members/${encodeURIComponent(target.membership_number)}/groups`);
      ctx.assert(csr2.some(g => g.group_code === G2), `the engine WROTE membership: member now in ${G2}`);

      // ── 7b. THE AUDIT TRAIL (Session 159) — a group result must leave a trace ──
      // The bug: only the 'external' branch wrote the BONUS_RESULT molecule the CSR
      // timeline reads, so a bonus could put someone in a group with NOTHING on the
      // activity to explain why. A CSR asked "why is this person in this group?" had
      // no answer. The activity that just fired is fire1's.
      const fired1Link = fire1.link;
      ctx.assert(!!fired1Link, `the firing activity has a link to inspect (${fired1Link || 'none'})`);
      const trail = await ctx.fetch(`/v1/activities/${encodeURIComponent(fired1Link)}/bonuses`);
      const trailRows = Array.isArray(trail) ? trail : (trail.bonuses || []);
      const groupRow = trailRows.find(b => b.result_type === 'group');
      ctx.assert(!!groupRow,
        `the activity carries a 'group' bonus row — the group add is VISIBLE on the timeline (${trailRows.map(b => b.result_type).join(', ') || 'nothing'})`);
      ctx.assert(!!groupRow && (groupRow.group_name || '').length > 0,
        `the row NAMES the group rather than reading as a mystery action (group_name: ${groupRow && groupRow.group_name}, label: ${groupRow && groupRow.label})`);

      // The describe endpoint must say what the bonus does, not "external action".
      const desc = await ctx.fetch(`/v1/bonuses/${bonusId}/describe?tenant_id=${tenantId}`);
      const descText = JSON.stringify(desc || {});
      ctx.assert(!/external action/i.test(descText),
        'the bonus description no longer calls a group result "external action"');
      ctx.assert(/member group/i.test(descText),
        `the bonus description names membership in a member group (${descText.slice(0, 160)})`);

      // The promotions LIST must carry what each promotion actually does. It used to
      // render from the legacy reward_* columns alone, so a promotion whose real
      // result was a group/badge/token listed as "0 pts" or "Certificate".
      const promoList = await ctx.fetch('/v1/promotions');
      const promoRows = Array.isArray(promoList) ? promoList : [];
      ctx.assert(promoRows.length > 0 && promoRows.every(p => Array.isArray(p.results)),
        `GET /v1/promotions carries a results[] summary on every row (${promoRows.length} promotions)`);

      await flight(target.membership_number); // fires again
      const g2Stays = await db.query(`
        SELECT COUNT(*)::int AS n FROM member_group_member mm
        JOIN member m ON m.link = mm.p_link
        WHERE mm.group_link = $1 AND m.membership_number = $2`, [g2Link, target.membership_number]);
      ctx.assertEqual(Number(g2Stays.rows[0].n), 1, 'a second firing added NO duplicate stay');

      const g2Rem = await ctx.fetch(`/v1/groups/${G2}/members/${encodeURIComponent(target.membership_number)}`, { method: 'DELETE' });
      ctx.assert(g2Rem._ok, 'staff removes the member from the result group');
      await flight(target.membership_number); // the bonus fires, the result must SKIP
      const csr3 = await ctx.fetch(`/v1/members/${encodeURIComponent(target.membership_number)}/groups`);
      ctx.assert(!csr3.some(g => g.group_code === G2),
        'the engine did NOT re-add after a deliberate removal — human removals beat engine adds');

      // ── 8. Delete refusals name the referencer; clean deletes leave nothing ──
      ctx.log('Step 8: delete refused naming the bonus; after the bonus goes, deletes are clean');
      const del1 = await ctx.fetch(`/v1/groups/${G1}`, { method: 'DELETE' });
      ctx.assert(del1._status === 409 && del1.error.includes(BONUS),
        `deleting ${G1} refused, naming the referencing bonus (${del1.error})`);
      const del2 = await ctx.fetch(`/v1/groups/${G2}`, { method: 'DELETE' });
      ctx.assert(del2._status === 409 && del2.error.includes(BONUS),
        `deleting ${G2} refused — a RESULT reference counts too (${del2.error})`);

      // ── 8b. The OTHER reward objects refuse deletion too (Session 159) ──
      // result_reference_id is polymorphic (tier/badge/token/action id by type)
      // so it can carry no FK. Groups have refused since v131; badge, tier,
      // token and external action had NO check — deleting one silently orphaned
      // every result row using it and the engine kept firing at a target that
      // no longer existed. Proven here on a real referenced action.
      // Build the reference this needs rather than hoping the tenant has one —
      // the first version of this test looked for an existing reference, found
      // none on delta, and silently skipped itself. Force the case.
      const tmpAct = await ctx.fetch('/v1/external-actions', {
        method: 'POST',
        body: { action_code: 'ZZ_S159_GUARD', action_name: 'S159 guard test', function_name: null, description: 'delete-guard fixture' }
      });
      ctx.assert(tmpAct._ok && tmpAct.action_id, `throwaway external action created (${tmpAct._status})`);

      const extRes = await ctx.fetch(`/v1/bonuses/${bonusId}/results`, {
        method: 'POST',
        body: { tenant_id: tenantId, result_type: 'external', result_reference_id: tmpAct.action_id, result_description: 'S159 guard ref' }
      });
      ctx.assert(extRes._ok, `the test bonus now has an 'external' result pointing at it (${extRes._status}${extRes.error ? ': ' + extRes.error : ''})`);

      const refused = await ctx.fetch(`/v1/external-actions/${tmpAct.action_id}`, { method: 'DELETE' });
      ctx.assert(refused._status === 409 && /still used by/i.test(refused.error || ''),
        `deleting the referenced action is REFUSED, not silently orphaned (${refused._status})`);
      ctx.assert((refused.error || '').includes(BONUS),
        `the refusal NAMES the bonus that uses it (${(refused.error || '').slice(0, 100)})`);
      const stillThere = await db.query(
        `SELECT COUNT(*)::int AS n FROM external_result_action WHERE action_id = $1`, [tmpAct.action_id]);
      ctx.assertEqual(Number(stillThere.rows[0].n), 1, 'the refused action was NOT deleted');

      const stayLinks = (await db.query(
        `SELECT link FROM member_group_member WHERE group_link IN ($1, $2)`, [groupLink, g2Link]))
        .rows.map(r => r.link);

      const delBonus = await ctx.fetch(`/v1/bonuses/${bonusId}?tenant_id=${tenantId}`, { method: 'DELETE' });
      ctx.assert(delBonus._ok, `test bonus deleted (${delBonus._status})`);
      bonusId = null;

      // With its last referencing result gone, the SAME action now deletes —
      // the guard blocks orphaning, it does not block ordinary housekeeping.
      const delAct = await ctx.fetch(`/v1/external-actions/${tmpAct.action_id}`, { method: 'DELETE' });
      ctx.assert(delAct._ok, `once unreferenced, the action deletes cleanly (${delAct._status})`);

      const del3 = await ctx.fetch(`/v1/groups/${G1}`, { method: 'DELETE' });
      ctx.assert(del3._ok, `unreferenced ${G1} deletes (${del3._status}${del3.error ? ': ' + del3.error : ''})`);
      const del4 = await ctx.fetch(`/v1/groups/${G2}`, { method: 'DELETE' });
      ctx.assert(del4._ok, `unreferenced ${G2} deletes (${del4._status})`);

      const leftGroups = await db.query(
        `SELECT COUNT(*)::int AS n FROM member_group WHERE group_code IN ($1, $2)`, [G1, G2]);
      ctx.assertEqual(Number(leftGroups.rows[0].n), 0, 'no group rows remain');
      const leftStays = await db.query(
        `SELECT COUNT(*)::int AS n FROM member_group_member WHERE group_link IN ($1, $2)`, [groupLink, g2Link]);
      ctx.assertEqual(Number(leftStays.rows[0].n), 0, 'no stay rows remain');
      if (stayLinks.length) {
        const leftMol = await db.query(`
          SELECT COUNT(*)::int AS n FROM "5_data_2" d
          JOIN molecule_def md ON md.molecule_id = d.molecule_id
          WHERE md.molecule_key = 'GROUP_REMOVED' AND d.p_link = ANY($1)
            AND d.attaches_to = (SELECT CHR(entity_id % 127 + 1) FROM link_tank
                                 WHERE table_key = 'member_group_member' AND entity_id IS NOT NULL)`,
          [stayLinks]);
        ctx.assertEqual(Number(leftMol.rows[0].n), 0, 'no orphaned removal molecules remain');
      }

    } finally {
      // Best-effort cleanup if an assert bailed mid-story; snapshot/restore backstops.
      try {
        if (bonusId) await ctx.fetch(`/v1/bonuses/${bonusId}?tenant_id=${tenantId}`, { method: 'DELETE' });
        await ctx.fetch(`/v1/groups/${G1}`, { method: 'DELETE' });
        await ctx.fetch(`/v1/groups/${G2}`, { method: 'DELETE' });
      } catch (_) { /* restore handles it */ }
      await db.end();
      await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
    }
  }
};
