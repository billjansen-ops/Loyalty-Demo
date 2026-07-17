/**
 * standup_parts.js — the workforce-monitoring vertical's contribution to
 * tenant stand-up (Session 145).
 *
 * The platform's tenant_standup.js copies platform parts and knows nothing
 * about clinical scoring — that layering is the rule (root files never name
 * vertical concepts). This file is the vertical's half: the manifest
 * entries and the copy logic for the clinical scoring configuration.
 *
 * Contract: export PARTS (manifest entries — same shape as the platform's
 * REQUIRED_PARTS) and copy(client, SRC, TGT, ctx). ctx carries { note }.
 */

export const PARTS = [
  { part: 'PPII streams',              table: 'ppii_stream' },
  { part: 'PPII weight set (current)', table: 'ppii_weight_set',           where: 'is_current = true' },
  { part: 'PPSI subdomains',           table: 'ppsi_subdomain' },
  { part: 'PPSI weight set (current)', table: 'ppsi_subdomain_weight_set', where: 'is_current = true' },
];

export async function copy(client, SRC, TGT, ctx) {
  const note = ctx?.note || 'Tenant stand-up';

  // PPII streams + the current weight set (values key by stream CODE — no
  // id remapping needed).
  await client.query(
    `INSERT INTO ppii_stream (tenant_id, code, label, max_value, source_function, is_active, sort_order, added_in_phase)
     SELECT $1, code, label, max_value, source_function, is_active, sort_order, added_in_phase
     FROM ppii_stream WHERE tenant_id = $2`, [TGT, SRC]);
  for (const ws of (await client.query(
    `SELECT * FROM ppii_weight_set WHERE tenant_id = $1 AND is_current = true`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO ppii_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current)
       VALUES ($1, $2, NULL, $3, true) RETURNING weight_set_id`, [TGT, ws.effective_from, note]);
    await client.query(
      `INSERT INTO ppii_weight_set_value (weight_set_id, stream_code, weight)
       SELECT $1, stream_code, weight FROM ppii_weight_set_value WHERE weight_set_id = $2`,
      [ins.rows[0].weight_set_id, ws.weight_set_id]);
  }

  // PPSI subdomains + current/factory weight sets (values key by subdomain
  // CODE).
  await client.query(
    `INSERT INTO ppsi_subdomain (tenant_id, code, label, question_count, max_value, sort_order, is_active)
     SELECT $1, code, label, question_count, max_value, sort_order, is_active
     FROM ppsi_subdomain WHERE tenant_id = $2`, [TGT, SRC]);
  for (const ws of (await client.query(
    `SELECT * FROM ppsi_subdomain_weight_set WHERE tenant_id = $1 AND (is_current = true OR is_factory_default = true)`, [SRC])).rows) {
    const ins = await client.query(
      `INSERT INTO ppsi_subdomain_weight_set (tenant_id, effective_from, changed_by_user, change_note, is_current, is_factory_default)
       VALUES ($1, $2, NULL, $3, $4, $5) RETURNING weight_set_id`,
      [TGT, ws.effective_from, note, ws.is_current, ws.is_factory_default]);
    await client.query(
      `INSERT INTO ppsi_subdomain_weight_set_value (weight_set_id, subdomain_code, weight)
       SELECT $1, subdomain_code, weight FROM ppsi_subdomain_weight_set_value WHERE weight_set_id = $2`,
      [ins.rows[0].weight_set_id, ws.weight_set_id]);
  }
}
