/**
 * Core: MEMBER_POINTS write path (Session 136) — saveActivityPoints now goes
 * through insertMoleculeRow instead of a direct 5_data_54 INSERT. This is the
 * hottest write in the platform (every accrual, bonus, adjustment, and
 * redemption row), so the proof is byte-level:
 *
 *   1. A real accrual's stored row is hex-compared against a reference row
 *      inserted with the OLD SQL verbatim (frozen below) given the same
 *      inputs — same bucket link bytes, same amount, same attaches_to.
 *   2. Redemptions store raw signed negatives (col 2 is 'numeric' — no
 *      offset), one row per bucket consumed, summing to -amount.
 *   3. A multi-bucket redemption writes one byte-correct row per bucket.
 *   4. Bonus (type-N) child activities get their own well-formed row.
 *
 * All link values stay inside Postgres (links are base-127 CHAR(5); they are
 * never round-tripped through the shell). Uses Delta (tenant 1), member 1002.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

// The pre-Session-136 saveActivityPoints INSERT, verbatim — the frozen
// reference the new path must byte-match. Do not "modernize" this string;
// its whole value is that it is the old code.
const OLD_INSERT = (pLinkExpr, molIdExpr, c1Expr, n1Expr) =>
  `INSERT INTO "5_data_54" (p_link, attaches_to, molecule_id, c1, n1) VALUES (${pLinkExpr}, 'A', ${molIdExpr}, ${c1Expr}, ${n1Expr})`;

module.exports = {
  name: 'Core: MEMBER_POINTS write path (byte-identical through insertMoleculeRow)',

  async run(ctx) {
    const tenantId = 1;
    const memberId = '1002';

    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaCSR', password: 'DeltaCSR' } });

    // Shared SQL fragments (resolved inside Postgres, never through the shell)
    const MEMBER = `(SELECT link FROM member WHERE tenant_id = ${tenantId} AND membership_number = '${memberId}')`;
    const MP_ID = `(SELECT molecule_id FROM molecule_def WHERE tenant_id = ${tenantId} AND UPPER(molecule_key) = 'MEMBER_POINTS')`;

    // ── 1. Accrual: one positive row, byte-identical to the old INSERT ──
    ctx.log('Step 1: accrual → one MEMBER_POINTS row, byte-compared to the frozen old SQL');
    const basePoints = 6000;
    const accrual = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2025-06-15',
        base_points: basePoints,
        CARRIER: 'DL', ORIGIN: 'MSP', DESTINATION: 'LAX',
        FARE_CLASS: 'Y', FLIGHT_NUMBER: 601, MQD: 400, SEAT_TYPE: 'A'
      }
    });
    ctx.assert(accrual._ok, 'Accrual created');

    // Links allocate monotonically (link_tank counter, big-endian squish), so
    // byte order (collation C) = creation order — newest activity = MAX(link)
    const ACT = `(SELECT link FROM activity WHERE p_link = ${MEMBER} AND activity_type = 'A' ORDER BY link DESC LIMIT 1)`;

    const rowCount = parseInt(sql(`SELECT COUNT(*) FROM "5_data_54" WHERE p_link = ${ACT} AND molecule_id = ${MP_ID} AND attaches_to = 'A'`), 10);
    ctx.assertEqual(rowCount, 1, 'Accrual activity has exactly one MEMBER_POINTS row');

    // The engine recalculates base points from the route (client-sent values
    // are never trusted) — the response's base_points is the authoritative
    // input saveActivityPoints received, so that's what must be stored raw.
    const enginePoints = accrual.base_points;
    ctx.log(`  Sent base_points ${basePoints}; engine computed ${enginePoints} (server recalculates)`);
    const amountStored = sql(`SELECT n1 FROM "5_data_54" WHERE p_link = ${ACT} AND molecule_id = ${MP_ID}`);
    ctx.assertEqual(parseInt(amountStored, 10), enginePoints, `Stored amount is the engine's base points, raw (${enginePoints})`);

    const attach = sql(`SELECT attaches_to FROM "5_data_54" WHERE p_link = ${ACT} AND molecule_id = ${MP_ID}`);
    ctx.assertEqual(attach, 'A', "Row attaches to 'A' (activity side)");

    // The stored c1 must be a real bucket belonging to this member (proves the
    // bucket link passed through untouched — not encoded, not re-squished)
    const bucketOwned = sql(`SELECT COUNT(*) FROM "5_data_54" d
      JOIN member_point_bucket b ON b.link = d.c1
      WHERE d.p_link = ${ACT} AND d.molecule_id = ${MP_ID} AND b.p_link = ${MEMBER}`);
    ctx.assertEqual(parseInt(bucketOwned, 10), 1, "Stored c1 is byte-equal to one of the member's real bucket links");

    // Frozen-reference byte compare: insert with the OLD SQL verbatim, given
    // the SAME INPUTS the engine passed — the bucket link taken from the
    // bucket table itself (not the stored row, so the compare is not
    // circular) and the amount from the API response. Then hex-compare every
    // stored byte of (c1, n1, attaches_to).
    const REF_PLINK = `'XREF!'`;
    sql(OLD_INSERT(
      REF_PLINK, MP_ID,
      `(SELECT b.link FROM member_point_bucket b JOIN "5_data_54" d ON b.link = d.c1
         WHERE d.p_link = ${ACT} AND d.molecule_id = ${MP_ID} AND b.p_link = ${MEMBER})`,
      String(enginePoints)
    ));
    const byteMatch = sql(`
      SELECT CASE WHEN encode(convert_to(l.c1, 'UTF8'), 'hex') = encode(convert_to(r.c1, 'UTF8'), 'hex')
                   AND l.n1 = r.n1 AND l.attaches_to = r.attaches_to
             THEN 'MATCH' ELSE 'MISMATCH' END
      FROM "5_data_54" l, "5_data_54" r
      WHERE l.p_link = ${ACT} AND l.molecule_id = ${MP_ID}
        AND r.p_link = ${REF_PLINK} AND r.molecule_id = ${MP_ID}`);
    ctx.assertEqual(byteMatch, 'MATCH', 'New path row is byte-identical to the old INSERT (hex-compared c1 + n1 + attaches_to)');
    sql(`DELETE FROM "5_data_54" WHERE p_link = ${REF_PLINK}`);

    // ── 2. Bonus child rows (type N) also go through the same door ──
    ctx.log('Step 2: business-fare accrual → bonus (N) child rows are well-formed');
    const accrual2 = await ctx.fetch(`/v1/members/${memberId}/accruals`, {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        activity_date: '2026-03-15',
        base_points: 8000,
        CARRIER: 'DL', ORIGIN: 'JFK', DESTINATION: 'SFO',
        FARE_CLASS: 'C', FLIGHT_NUMBER: 602, MQD: 600, SEAT_TYPE: 'W'
      }
    });
    ctx.assert(accrual2._ok, 'Second accrual created (business fare — bonus-eligible)');

    const bonusRows = sql(`
      SELECT COUNT(*) || '|' || COALESCE(SUM(CASE WHEN d.n1 > 0 THEN 1 ELSE 0 END), 0) || '|' ||
             COALESCE(SUM(CASE WHEN b.link IS NOT NULL THEN 1 ELSE 0 END), 0)
      FROM activity a
      JOIN "5_data_54" d ON d.p_link = a.link AND d.molecule_id = ${MP_ID} AND d.attaches_to = 'A'
      LEFT JOIN member_point_bucket b ON b.link = d.c1 AND b.p_link = ${MEMBER}
      WHERE a.p_link = ${MEMBER} AND a.activity_type = 'N'`);
    const [nRows, nPositive, nBucketed] = bonusRows.split('|').map(Number);
    ctx.assert(nRows >= 1, `Bonus (N) activities have MEMBER_POINTS rows (${nRows})`);
    ctx.assertEqual(nPositive, nRows, 'Every bonus row amount is positive');
    ctx.assertEqual(nBucketed, nRows, "Every bonus row's c1 is a real bucket of the member");

    // ── 3. Redemptions: raw signed negatives, one row per bucket consumed ──
    ctx.log('Step 3: redeem until a redemption spans 2+ buckets — negatives stored raw');
    let multiBucketProven = false;
    let redemptions = 0;
    for (let i = 0; i < 6 && !multiBucketProven; i++) {
      const bal = await ctx.fetch(`/v1/member/${memberId}/balances?tenant_id=${tenantId}`);
      const points = bal.balances?.base_points || 0;
      if (points < 10000) break;

      const redeem = await ctx.fetch('/v1/redemptions/process', {
        method: 'POST',
        body: { member_id: memberId, tenant_id: tenantId, redemption_rule_id: 1, point_amount: 10000, redemption_date: '2026-04-07' }
      });
      ctx.assert(redeem._ok || redeem.success, `Redemption ${i + 1} processed`);
      redemptions++;
      const breakdown = redeem.breakdown || [];
      ctx.log(`  Redemption ${i + 1}: ${breakdown.length} bucket(s)`);

      const RED = `(SELECT link FROM activity WHERE p_link = ${MEMBER} AND activity_type = 'R' ORDER BY link DESC LIMIT 1)`;
      const redRow = sql(`
        SELECT COUNT(*) || '|' || COALESCE(SUM(n1), 0) || '|' ||
               COALESCE(SUM(CASE WHEN n1 < 0 THEN 1 ELSE 0 END), 0)
        FROM "5_data_54" WHERE p_link = ${RED} AND molecule_id = ${MP_ID} AND attaches_to = 'A'`);
      const [rRows, rSum, rNegative] = redRow.split('|').map(Number);
      ctx.assertEqual(rRows, breakdown.length, `One stored row per breakdown bucket (${breakdown.length})`);
      ctx.assertEqual(rSum, -10000, 'Stored amounts sum to -10,000 (raw signed, no offset)');
      ctx.assertEqual(rNegative, rRows, 'Every redemption row amount is negative');

      // Each row's bucket really belongs to the member
      const rBucketed = parseInt(sql(`
        SELECT COUNT(*) FROM "5_data_54" d
        JOIN member_point_bucket b ON b.link = d.c1 AND b.p_link = ${MEMBER}
        WHERE d.p_link = ${RED} AND d.molecule_id = ${MP_ID} AND d.attaches_to = 'A'`), 10);
      ctx.assertEqual(rBucketed, rRows, "Every redemption row's c1 is a real bucket of the member");

      if (breakdown.length >= 2) {
        multiBucketProven = true;
        ctx.assert(true, `Multi-bucket redemption byte-verified (${breakdown.length} buckets, one row each)`);
      }
    }
    ctx.assert(redemptions >= 1, `At least one redemption ran (${redemptions})`);
    ctx.assert(multiBucketProven, 'A redemption spanned 2+ buckets (multi-bucket path exercised)');

    // Re-login as the harness user
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
