/**
 * Workforce Monitoring (Insight) — Network Directory Phase 2 part 1
 * (Session 155): the PARTICIPANT-SCOPED selection partition.
 *
 * Erica's spec §7.1 is the contract, and it is an ACCESS-CONTROL rule,
 * not a notification setting:
 *
 *   "The selection is stored in a partition that only the participant
 *    can read. Monitoring program staff cannot see it. Employers cannot
 *    see it. It does not appear in any administrative screen, report,
 *    export, dashboard, or support tool available to a program. ...
 *    If a program role can read the selection, the selection has been
 *    disclosed, regardless of whether a message was sent."
 *
 * THE WALL, concretely:
 *   - participant_selection (v129) is read and written ONLY through the
 *     functions in this file. No other server code may query it.
 *   - This module registers NO routes. There is deliberately no staff
 *     endpoint, and no participant endpoint yet either — participants
 *     have no logins today; the participant door arrives with the
 *     consent architecture / participant-identity work, and it will be
 *     built HERE, authenticated as the participant.
 *   - Selection activity writes NOTHING a staff surface reads: no
 *     notification, no audit row in staff-visible trails, no activity.
 *   - test_participant_selections.cjs stands guard: it plants a real
 *     selection, attacks every staff door, and runs a code census that
 *     REDDENS THE SUITE if any file outside this one (plus the
 *     migration and the test) ever references the table.
 *
 * Spec §7.1 escalation rule, verbatim intent: any proposed change that
 * would let a program role read participant selections is a change to
 * the CONSENT MODEL, not a change to a screen. Escalate to Bill and
 * Erica. Never implement it, however convenient the ask.
 *
 * What a selection stores (mirrors what a §7.2 release would disclose —
 * the entity, the category of service, the date): entity_name and
 * type_name are SNAPSHOTS taken at selection time, so the participant's
 * record stays true even if the directory entity is later renamed or
 * deleted (entity_id goes NULL via ON DELETE SET NULL; the snapshot
 * survives). Deleting a directory entity is therefore never blocked by,
 * and never behaves observably differently because of, selections — no
 * existence oracle through any staff door.
 *
 * NOT here (waits on the consent architecture + Erica's document access
 * rules): the §7.2 release flow, Consent Layer 3 filing, and any
 * participant-facing surface.
 */

// A selection may target only an entity the participant's own directory
// actually shows (their program's list, or the IHS pool, per the
// program's three-way visibility setting) — the same rule the public
// detail endpoint enforces.
import { readVisibility } from './network_directory.js';

// The participant-facing row shape. Nothing here is ever serialized into
// a staff response — there is no staff caller.
const SELECTION_FIELDS = `selection_id, entity_id, entity_name, type_name,
                          selected_date, is_active`;

async function resolveMember(dbClient, memberLink) {
  const r = await dbClient.query(
    `SELECT link, tenant_id FROM member WHERE link = $1`, [memberLink]
  );
  if (!r.rows.length) throw new Error(`participant_selections: no member record for link "${memberLink}"`);
  return r.rows[0];
}

/**
 * Record a selection for a participant. The caller must have already
 * authenticated the PARTICIPANT'S OWN identity — never a staff session
 * acting on their behalf.
 */
export async function addSelection(dbClient, { memberLink, entityId }) {
  const member = await resolveMember(dbClient, memberLink);
  const visibility = await readVisibility(dbClient, member.tenant_id);
  const showProgram = visibility === 'program' || visibility === 'both';
  const showIhs = visibility === 'ihs' || visibility === 'both';

  // Same visibility rule as the public directory: the entity must be on
  // the participant's program list (if that section shows) or in the IHS
  // pool (if that section shows). Anything else — another program's
  // private entity, a hidden section — answers not-selectable.
  const ent = await dbClient.query(
    `SELECT e.entity_id, e.entity_name, t.type_name, e.ihs_status,
            EXISTS (SELECT 1 FROM program_network_entry pe
                    WHERE pe.entity_id = e.entity_id AND pe.tenant_id = $2
                      AND pe.is_active = true) AS on_program_list
     FROM network_entity e
     JOIN network_entity_type t ON t.entity_type_id = e.entity_type_id
     WHERE e.entity_id = $1 AND e.is_active = true`,
    [entityId, member.tenant_id]
  );
  const row = ent.rows[0];
  const selectable = row && (
    (showProgram && row.on_program_list) ||
    (showIhs && row.ihs_status !== null)
  );
  if (!selectable) {
    return { ok: false, error: 'That listing is not available in your directory' };
  }

  // Reactivate-not-duplicate: selecting an entity again after withdrawing
  // revives the same row (and re-dates it — the selection date is the
  // participant's latest act of choosing).
  const revived = await dbClient.query(
    `UPDATE participant_selection
     SET is_active = true, selected_date = date_to_molecule_int(CURRENT_DATE),
         entity_name = $3, type_name = $4
     WHERE member_link = $1 AND entity_id = $2 AND is_active = false
     RETURNING ${SELECTION_FIELDS}`,
    [memberLink, entityId, row.entity_name, row.type_name]
  );
  if (revived.rows.length) return { ok: true, selection: revived.rows[0] };

  try {
    const ins = await dbClient.query(
      `INSERT INTO participant_selection
         (tenant_id, member_link, entity_id, entity_name, type_name, selected_date)
       VALUES ($1, $2, $3, $4, $5, date_to_molecule_int(CURRENT_DATE))
       RETURNING ${SELECTION_FIELDS}`,
      [member.tenant_id, memberLink, entityId, row.entity_name, row.type_name]
    );
    return { ok: true, selection: ins.rows[0] };
  } catch (e) {
    if (e.code === '23505') return { ok: false, error: 'You have already selected this listing' };
    throw e;
  }
}

/**
 * The participant's own selections — active ones plus withdrawn/orphaned
 * history when includeInactive is set. memberLink IS the scope: there is
 * no cross-participant, per-program, or all-rows read, by design.
 */
export async function listSelections(dbClient, { memberLink, includeInactive = false }) {
  const r = await dbClient.query(
    `SELECT ${SELECTION_FIELDS} FROM participant_selection
     WHERE member_link = $1 ${includeInactive ? '' : 'AND is_active = true'}
     ORDER BY selected_date DESC, selection_id DESC`,
    [memberLink]
  );
  return r.rows;
}

/**
 * Withdraw a selection (participant's own only — a selectionId belonging
 * to another participant answers not-found, never touched). An unshared,
 * withdrawn selection simply ceases; nobody is notified, per spec.
 */
export async function withdrawSelection(dbClient, { memberLink, selectionId }) {
  const r = await dbClient.query(
    `UPDATE participant_selection SET is_active = false
     WHERE selection_id = $1 AND member_link = $2 AND is_active = true
     RETURNING selection_id`,
    [selectionId, memberLink]
  );
  return { ok: r.rows.length > 0 };
}

/**
 * Hard-delete a selection row (participant's own only). Exists for the
 * participant's right to erase an unshared selection, and for test
 * cleanup. A selection that has been SHARED via an executed release is a
 * different story — the release artifact in the Document Repository has
 * its own retention rules; deleting the selection never deletes a release.
 */
export async function deleteSelection(dbClient, { memberLink, selectionId }) {
  const r = await dbClient.query(
    `DELETE FROM participant_selection
     WHERE selection_id = $1 AND member_link = $2
     RETURNING selection_id`,
    [selectionId, memberLink]
  );
  return { ok: r.rows.length > 0 };
}

// No register(app, ctx). No routes. That is the point — see the header.
export default { addSelection, listSelections, withdrawSelection, deleteSelection };
