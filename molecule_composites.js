/**
 * molecule_composites.js — the ONE place a molecule gets wired into composites.
 *
 * Why this is its own module (Session 133): a stored (type='D') molecule is only
 * usable once it's in the right composite —
 *   - member:   PUT /v1/member/:id/molecules validates against the M composite;
 *   - activity: an accrual REJECTS any field not in that activity type's composite
 *               (the Session 132 composite-closure rule).
 * Adding the composite row used to be a separate manual step after creation (every
 * migration hand-wrote it — v85 REFERRAL_SOURCE, v99 EVALUATOR), which is the
 * documented silent-failure trap: the molecule exists but is unusable, no error.
 *
 * This routine is deliberately PURE SQL + getNextLink — no server internals — so
 * the exact same code runs from two callers with the same parameters:
 *   - the online maintenance page, via createMoleculeComplete in pointers.js
 *     (called inside its creation transaction, before the round-trip proof);
 *   - a db_migrate.js migration, called directly with the migration's client.
 * Both pass the same spec fields (below). See docs/MOLECULE_COMPOSITE_AUTOWIRE_DESIGN.md.
 *
 * It does NOT touch the input template — placing a field on a form is an admin's
 * layout choice, made later on the maintenance page (Bill's decision).
 *
 * Spec fields consumed (all optional; absent = no composite change):
 *   spec.member_composite    = { required: bool }                 // → M composite
 *   spec.activity_composites = [ { activity_type, required }, … ] // one row per type
 *
 * activity_type is the composite_type char (A accrual, P partner, J adjustment,
 * R redemption, …). A member molecule uses member_composite; an activity molecule
 * uses activity_composites. Nothing stops both, but that is not a normal shape.
 */

import { getNextLink } from './get_next_link.js';

/**
 * Add one composite_detail row for `moleculeId` into a composite, idempotently.
 * Returns { added, existed, missing } for one target.
 */
async function addToComposite(client, tenantId, moleculeId, compositeType, required) {
  const comp = await client.query(
    `SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = $2`,
    [tenantId, compositeType]
  );
  if (!comp.rows.length) {
    // Mirror the existing "composite not found" guard — skip, don't fail.
    return { compositeType, missing: true };
  }
  const pLink = comp.rows[0].link;

  // Idempotent: a (p_link, molecule_id) row is UNIQUE. If it already exists we
  // leave it as-is (never clobber an admin's later is_required edit or a prior
  // migration's row) — this makes the routine re-runnable, like every migration.
  const existing = await client.query(
    `SELECT link FROM composite_detail WHERE p_link = $1 AND molecule_id = $2`,
    [pLink, moleculeId]
  );
  if (existing.rows.length) return { compositeType, existed: true };

  const nextSort = await client.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM composite_detail WHERE p_link = $1`,
    [pLink]
  );
  const detailLink = await getNextLink(client, tenantId, 'composite_detail');
  await client.query(
    `INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, sort_order)
     VALUES ($1, $2, $3, $4, false, $5)`,
    [detailLink, pLink, moleculeId, !!required, nextSort.rows[0].n]
  );
  return { compositeType, added: true, required: !!required };
}

/**
 * wireMoleculeToComposites — add `moleculeId` to the M composite and/or the
 * per-activity-type composites named in the spec. Caller supplies the txn client
 * so this is atomic with the rest of molecule creation (a later failure — e.g. the
 * round-trip proof — rolls the composite rows back too).
 *
 * @returns {Promise<{added: object[], warnings: string[]}>}
 */
export async function wireMoleculeToComposites(client, tenantId, moleculeId, spec = {}) {
  const added = [];
  const warnings = [];

  // Only stored molecules belong in a composite. Reference/flag molecules store
  // nothing; a caller should never pass composite fields for them, but guard anyway.
  if ((spec.molecule_type || 'D') !== 'D') {
    if (spec.member_composite || (spec.activity_composites && spec.activity_composites.length)) {
      warnings.push('Composite wiring ignored — only stored (D) molecules go in a composite');
    }
    return { added, warnings };
  }

  // ── Member ──
  if (spec.member_composite) {
    const r = await addToComposite(client, tenantId, moleculeId, 'M', spec.member_composite.required);
    if (r.missing) warnings.push('Member (M) composite not found for this tenant — member wiring skipped');
    else if (r.added) added.push({ composite_type: 'M', required: r.required });
  }

  // ── Activity (per type) ──
  if (Array.isArray(spec.activity_composites)) {
    const seen = new Set();
    for (const entry of spec.activity_composites) {
      const type = (entry.activity_type || '').trim().toUpperCase();
      if (!type) { warnings.push('An activity composite entry has no activity_type — skipped'); continue; }
      if (type === 'M') { warnings.push("Use member_composite for the member (M) composite, not activity_composites"); continue; }
      if (seen.has(type)) { warnings.push(`Activity type '${type}' listed twice — later entry ignored`); continue; }
      seen.add(type);
      const r = await addToComposite(client, tenantId, moleculeId, type, entry.required);
      if (r.missing) warnings.push(`Activity composite '${type}' not found for this tenant — skipped`);
      else if (r.added) added.push({ composite_type: type, required: r.required });
    }
  }

  return { added, warnings };
}

export default { wireMoleculeToComposites };
