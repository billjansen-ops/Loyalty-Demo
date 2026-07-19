/**
 * Document Repository Phase A (v121, Session 146 — Erica's spec 0.1).
 *
 * The filing cabinet: card + taxonomy + storage black box. Proves the
 * whole life of a document — upload, find, classify, link to a record,
 * file, supersede — plus the protections that make it a REPOSITORY and
 * not a folder: nothing deletable, superseded versions frozen, integrity
 * checksum verified on every read (tamper-evidence proven by actually
 * tampering), size cap honored from tenant config, refusals in plain
 * English, every download audited.
 *
 * S137 suite rules: own member, own documents; harness restore wipes all.
 */
const { execSync } = require('child_process');

const PSQL = process.env.PSQL || '/opt/homebrew/bin/psql';
const CONN = `-h ${process.env.PGHOST || '127.0.0.1'} -U ${process.env.PGUSER || 'billjansen'} -d ${process.env.PGDATABASE || 'loyalty'}`;

function sql(query) {
  return execSync(`${PSQL} ${CONN} -t -A -c "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

const b64 = (s) => Buffer.from(s).toString('base64');

module.exports = {
  name: 'Document Repository: card + black box + lifecycle + tamper-evidence (v121)',

  async run(ctx) {
    const TENANT = 5;

    const login = await ctx.fetch('/v1/auth/login', {
      method: 'POST', body: { username: 'Claude', password: 'claude123' }
    });
    ctx.assert(login._ok, 'Claude login');
    const sw = await ctx.fetch('/v1/auth/tenant', { method: 'POST', body: { tenant_id: TENANT } });
    ctx.assert(sw._ok, 'session on Insight');

    // ── Taxonomy seeded from the migration ──
    const types = await ctx.fetch('/v1/document-types');
    ctx.assert(types._ok && types.types.length >= 9, `taxonomy present (${types.types?.length} types)`);
    ctx.assert(types.types.some(t => t.type_code === 'CONSENT'), 'CONSENT type exists');

    // ── Own person to attach documents to ──
    const num = (await ctx.fetch('/v1/member/next-number')).membership_number;
    const created = await ctx.fetch('/v1/member', {
      method: 'POST', body: { membership_number: num, fname: 'Doc', lname: 'RepoTest' }
    });
    ctx.assert(created._ok, `created person ${num}`);

    // ── Upload ──
    const CONTENT = `Signed consent for Doc RepoTest — repository lifecycle test ${Date.now ? '' : ''}v1`;
    const up = await ctx.fetch('/v1/documents', {
      method: 'POST',
      body: { title: 'Consent — lifecycle test', file_base64: b64(CONTENT), file_format: 'txt',
              member_number: num, type_code: 'CONSENT', document_date: '2026-07-15' }
    });
    ctx.assert(up._ok && up.document, `upload accepted (${up._status}${up.error ? ': ' + up.error : ''})`);
    const doc = up.document;
    ctx.assert(doc.status === 'R' && doc.version === 1, `new document is Received v1 (${doc.status} v${doc.version})`);
    ctx.assert(doc.member_name === 'Doc RepoTest' && doc.type_code === 'CONSENT', 'card carries owner + type');
    ctx.assert(/^[0-9a-f]{64}$/.test(doc.checksum), 'card carries a real checksum');

    // ── Byte-perfect round trip (raw fetch — ctx.fetch parses JSON, so this
    //    path mints its own session cookie; Claude's home program is 5) ──
    const rawLogin = await fetch(`${ctx.apiBase}/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Claude', password: 'claude123' })
    });
    const rawCookie = (rawLogin.headers.get('set-cookie') || '').split(';')[0];
    const fileResp = await fetch(`${ctx.apiBase}/v1/documents/${doc.link}/file`, {
      headers: { Cookie: rawCookie }
    }).catch(() => null);
    let roundTrip = null;
    if (fileResp && fileResp.ok) roundTrip = await fileResp.text();
    ctx.assert(roundTrip === CONTENT, `downloaded bytes match the upload exactly (got ${roundTrip === null ? `no bytes (${fileResp?.status})` : roundTrip.length + ' bytes'})`);

    // ── Refusals in plain English ──
    const badFmt = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'x', file_base64: b64('x'), file_format: 'exe' }
    });
    ctx.assert(badFmt._status === 400, `unknown file format refused (${badFmt._status})`);
    const badType = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'x', file_base64: b64('x'), file_format: 'txt', type_code: 'NOPE' }
    });
    ctx.assert(badType._status === 400, `unknown document type refused (${badType._status})`);
    const badMember = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'x', file_base64: b64('x'), file_format: 'txt', member_number: 'ZZZ' }
    });
    ctx.assert(badMember._status === 404, `unknown person refused (${badMember._status})`);
    const badLink = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'x', file_base64: b64('x'), file_format: 'txt', linked_table: 'no_such_table', linked_link: '1' }
    });
    ctx.assert(badLink._status === 400, `unknown linked record type refused (${badLink._status})`);

    // ── Classify + link to a real record (the enroll's own intake item) ──
    const itemLink = sql(`SELECT i.link FROM intake_item i JOIN member m ON m.link = i.member_link
      WHERE m.tenant_id = ${TENANT} AND m.membership_number = '${num}'`);
    ctx.assert(itemLink !== '', `an intake item exists to link to (${itemLink})`);
    const patched = await ctx.fetch(`/v1/documents/${doc.link}`, {
      method: 'PATCH', body: { status: 'I', linked_table: 'intake_item', linked_link: itemLink }
    });
    ctx.assert(patched._ok && patched.document.status === 'I', 'moved to In review with a linked record');
    ctx.assert(patched.document.linked_table === 'intake_item' && String(patched.document.linked_link) === String(itemLink),
      'the typed record pointer stored');
    const filed = await ctx.fetch(`/v1/documents/${doc.link}`, { method: 'PATCH', body: { status: 'F' } });
    ctx.assert(filed._ok && filed.document.status === 'F', 'filed');

    // ── Replacement supersedes, never deletes ──
    const rep = await ctx.fetch(`/v1/documents/${doc.link}/replace`, {
      method: 'POST', body: { file_base64: b64('CORRECTED scan v2'), file_format: 'txt' }
    });
    ctx.assert(rep._ok && rep.document.version === 2 && rep.document.supersedes_link === doc.link,
      `replacement is v2 chained to v1 (v${rep.document?.version})`);
    const v1Frozen = await ctx.fetch(`/v1/documents/${doc.link}`, { method: 'PATCH', body: { title: 'edit history' } });
    ctx.assert(v1Frozen._status === 403, `superseded version is frozen (${v1Frozen._status})`);
    const defaultList = await ctx.fetch(`/v1/documents?member=${num}`);
    ctx.assert(defaultList._ok && defaultList.documents.length === 1 && defaultList.documents[0].version === 2,
      `default list shows only the current version (${defaultList.documents?.length})`);
    const fullList = await ctx.fetch(`/v1/documents?member=${num}&include_superseded=1`);
    ctx.assert(fullList._ok && fullList.documents.length === 2, `history view shows the whole chain (${fullList.documents?.length})`);

    // ── Unassigned queue (a fax-shaped arrival: no owner, no type yet) ──
    const fax = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'Unclassified arrival', file_base64: b64('fax bytes'), file_format: 'txt', source_channel: 'fax' }
    });
    ctx.assert(fax._ok, 'ownerless, typeless document accepted');
    const unassigned = await ctx.fetch('/v1/documents?unassigned=1');
    ctx.assert(unassigned._ok && unassigned.documents.some(d => d.link === fax.document.link),
      'it appears in the unassigned queue');

    // ── Tamper-evidence: corrupt the stored bytes, the read must REFUSE ──
    const locator = sql(`SELECT storage_locator FROM document WHERE link = ${rep.document.link}`);
    ctx.assert(locator.startsWith('db:'), `locator uses the db backend (${locator})`);
    sql(`UPDATE document_file SET bytes = 'tampered'::bytea WHERE file_id = ${locator.slice(3)}`);
    const tampered = await ctx.fetch(`/v1/documents/${rep.document.link}/file`);
    ctx.assert(tampered._status === 500 && String(tampered.error || '').includes('integrity'),
      `tampered bytes refused loudly (${tampered._status}: ${String(tampered.error).slice(0, 60)})`);

    // ── Size cap honored from tenant config ──
    const capExisted = sql(`SELECT COUNT(*) FROM sysparm WHERE tenant_id = ${TENANT} AND sysparm_key = 'document_storage'`) !== '0';
    sql(`INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
         VALUES (${TENANT}, 'document_storage', 'numeric', 'doc repo test cap')
         ON CONFLICT (tenant_id, sysparm_key) DO NOTHING`);
    sql(`INSERT INTO sysparm_detail (sysparm_id, category, code, value)
         SELECT sysparm_id, 'limit', 'max_mb', '0' FROM sysparm
         WHERE tenant_id = ${TENANT} AND sysparm_key = 'document_storage'`);
    const capped = await ctx.fetch('/v1/documents', {
      method: 'POST', body: { title: 'too big', file_base64: b64('any bytes at all'), file_format: 'txt' }
    });
    ctx.assert(capped._status === 400 && String(capped.error || '').includes('limit'),
      `size cap from config refused the upload (${capped._status})`);
    // In-run cleanup (the harness restores only at suite END; the wa_php
    // parity tests compare wi_php's sysparm groups later in the SAME run —
    // the S145 weight-residue lesson). Remove what we planted.
    sql(`DELETE FROM sysparm_detail WHERE category = 'limit' AND code = 'max_mb' AND value = '0'
         AND sysparm_id IN (SELECT sysparm_id FROM sysparm WHERE tenant_id = ${TENANT} AND sysparm_key = 'document_storage')`);
    if (!capExisted) {
      sql(`DELETE FROM sysparm WHERE tenant_id = ${TENANT} AND sysparm_key = 'document_storage'`);
    }

    // ── Every download audited ──
    const vCount = Number(sql(`SELECT COUNT(*) FROM audit_log_4 a
      JOIN audit_entity_type t ON t.link = a.p_link
      WHERE t.table_name = 'document' AND a.action = 'V'`));
    ctx.assert(vCount >= 1, `downloads leave audit rows (${vCount})`);
  }
};
