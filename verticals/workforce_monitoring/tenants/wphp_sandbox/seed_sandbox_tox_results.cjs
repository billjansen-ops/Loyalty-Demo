/**
 * seed_sandbox_tox_results.cjs — toxicology results seeding for the WPHP
 * Exploration sandbox (Session 169, Bill's call: part of the story-4
 * release — Erica's first look at the Testing tab should be a populated
 * screen, not an empty card). Companion to seed_sandbox_people.cjs, which
 * built the roster these results belong to.
 *
 * EVERYTHING goes through real platform doors over HTTP — never SQL — so
 * every stage row, compliance filing, registry item, and notification is a
 * genuine artifact of the same workflows Erica will explore. A dozen
 * results across the roster, telling stories, not volume:
 *
 *   - Four routine NEGATIVE dispositions across four people (history depth)
 *   - Priya Sharma CONFIRMED_POSITIVE — her rising-risk story continues:
 *     the sentinel files the compliance event AND rings the safety
 *     machinery (registry item), the scoring seam visibly working
 *   - David Lindqvist DILUTE — a special result filing under the
 *     DRUG_TEST_EXCEPTION item (weight 0.00 until Erica sets values)
 *   - One at each mid-review stage (screen non-negative, lab confirmed,
 *     MRO review) so the queue has life and the legal-moves dropdown has
 *     something to offer
 *   - One fresh arrival today, auto-anchored to a for-cause selection
 *     created through the door (the reconciliation the lab path will use)
 *   - One VOIDED record (a mark with a reason, still visible with
 *     include-voided)
 *   - One UNMATCHED lab result for Antoine Dubois — the overdue/silent
 *     participant getting a result nobody ordered
 *
 * Driven AS the Claude system account (mode 'open') — DELIBERATELY not as
 * the sandbox staff: logging in as them would mean resetting the passwords
 * Bill handed out in Session 161.
 *
 * Run locally:   node verticals/workforce_monitoring/tenants/wphp_sandbox/seed_sandbox_tox_results.cjs
 * Run on Heroku: SEED_API=https://hdwhf-6e6c604bb3f3.herokuapp.com node ...
 *
 * Idempotent by refusal: if the sandbox already has ANY toxicology
 * results, the script reports and exits (FORCE=1 seeds anyway).
 */

const API = process.env.SEED_API || 'http://127.0.0.1:4001';
const SUPER_USER = process.env.SEED_USER || 'Claude';
const SUPER_PASS = process.env.SEED_PASS || 'claude123';
const TENANT_KEY = 'wphp_sandbox';

let cookie = null;
async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const resp = await fetch(`${API}${path}`, {
    ...options, headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try { data = await resp.json(); } catch { /* some doors return no body */ }
  if (!resp.ok) {
    const err = new Error(`${options.method || 'GET'} ${path} → ${resp.status}${data && data.error ? ': ' + data.error : ''}`);
    err.status = resp.status; err.data = data;
    throw err;
  }
  return data;
}
async function login(username, password) {
  cookie = null;
  return call('/v1/auth/login', { method: 'POST', body: { username, password } });
}

// Local calendar day N days back, as YYYY-MM-DD (the en-CA form the
// platform blesses for local date strings — seed_sandbox_people precedent).
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

// ── The stories. member = "Fname Lname" from the people-seed roster. ──
// walk: stages beyond RECEIVED. disposition implies the full walk first.
const RESULTS = [
  { member: 'Marcus Webb',      collectedDaysAgo: 6,  disposition: 'NEGATIVE',
    note: 'routine clean' },
  { member: 'Elena Vasquez',    collectedDaysAgo: 4,  disposition: 'NEGATIVE',
    note: 'routine clean' },
  { member: 'James Okafor',     collectedDaysAgo: 9,  disposition: 'NEGATIVE',
    note: 'for-cause, came back clean' },
  { member: 'Rachel Kim',       collectedDaysAgo: 12, disposition: 'NEGATIVE',
    note: 'routine clean (history depth)' },
  { member: 'Priya Sharma',     collectedDaysAgo: 3,  disposition: 'CONFIRMED_POSITIVE',
    note: 'her rising story — sentinel, scoring seam, registry item' },
  { member: 'David Lindqvist',  collectedDaysAgo: 5,  disposition: 'DILUTE',
    note: 'special result → DRUG_TEST_EXCEPTION filing' },
  { member: 'Sofia Petrov',     collectedDaysAgo: 1,  walk: ['SCREEN'],
    note: 'screen non-negative — awaiting confirmation (attention flag fires)' },
  { member: 'Rachel Kim',       collectedDaysAgo: 2,  walk: ['SCREEN', 'LAB_CONFIRMED'],
    note: 'lab confirmed — awaiting MRO' },
  { member: 'James Okafor',     collectedDaysAgo: 2,  walk: ['SCREEN', 'LAB_CONFIRMED', 'MRO_REVIEW'],
    note: 'sitting in the MRO queue' },
  { member: 'Marcus Webb',      collectedDaysAgo: 0,  anchorToday: true,
    note: 'fresh arrival, auto-anchored to a for-cause selection made today' },
  { member: 'Elena Vasquez',    collectedDaysAgo: 3,  void: 'Recorded in error — duplicate of the Aug entry',
    note: 'the voided story (a mark, never a deletion)' },
  { member: 'Antoine Dubois',   collectedDaysAgo: 1,  unmatched: true,
    note: 'a lab result nobody ordered — the UNMATCHED reconciliation' },
];

async function main() {
  console.log(`\n🧪 WPHP Exploration sandbox — toxicology results seeding (${API})\n`);

  // ── 0. Superuser session bound to the sandbox tenant ──
  await login(SUPER_USER, SUPER_PASS);
  const tenants = await call('/v1/tenants');
  const tenant = (tenants.tenants || tenants).find(t => t.tenant_key === TENANT_KEY);
  if (!tenant) throw new Error(`Tenant ${TENANT_KEY} not found`);
  await call('/v1/auth/tenant', { method: 'POST', body: { tenant_id: tenant.tenant_id } });

  // ── 1. Idempotency: an already-populated screen is left alone ──
  const existing = await call('/v1/tox-results?include_voided=1');
  const existingCount = (existing.results || []).length;
  if (existingCount > 0 && !process.env.FORCE) {
    console.log(`  ⏭️  The sandbox already has ${existingCount} toxicology result(s) — nothing seeded.`);
    console.log('      (FORCE=1 to add this set anyway.)\n');
    return;
  }

  // ── 2. Resolve the cast by name through the search door ──
  const cast = {};
  for (const name of [...new Set(RESULTS.map(r => r.member))]) {
    const [fname, lname] = name.split(' ');
    const found = await call(`/v1/member/search?lname=${encodeURIComponent(lname)}`);
    const rows = found.members || found.results || found;
    const m = (Array.isArray(rows) ? rows : []).find(x => x.fname === fname && x.lname === lname);
    if (!m) throw new Error(`${name} not on the sandbox roster — run seed_sandbox_people.cjs first`);
    cast[name] = m.membership_number;
    console.log(`  👤 ${name} → #${m.membership_number}`);
  }

  // ── 3. The results ──
  let made = 0, disposed = 0;
  for (const r of RESULTS) {
    const num = cast[r.member];
    const body = { member_number: num, collection_date: daysAgo(r.collectedDaysAgo) };

    if (r.anchorToday) {
      // A for-cause selection made today through the door; the result
      // then auto-anchors to it (no reason needed) — the same
      // reconciliation the lab-integration path will use.
      await call('/v1/monitoring/selections', { method: 'POST',
        body: { member_number: num, reason: 'For-cause order (exploration seed)' } });
    } else if (r.unmatched) {
      body.reconcile_reason_code = 'UNMATCHED';
    } else {
      body.reconcile_reason_code = 'FOR_CAUSE';
    }

    const mk = await call('/v1/tox-results', { method: 'POST', body });
    const link = mk.result.link;
    made++;

    const stages = r.disposition
      ? ['SCREEN', 'LAB_CONFIRMED', 'MRO_REVIEW']
      : (r.walk || []);
    for (const s of stages) {
      await call(`/v1/tox-results/${link}/stage`, { method: 'POST', body: { to_stage: s } });
    }
    if (r.disposition) {
      await call(`/v1/tox-results/${link}/stage`, { method: 'POST',
        body: { to_stage: 'DISPOSITION', disposition_code: r.disposition } });
      disposed++;
    }
    if (r.void) {
      await call(`/v1/tox-results/${link}/void`, { method: 'POST', body: { reason: r.void } });
    }

    const state = r.void ? 'VOIDED' : (r.disposition || (stages[stages.length - 1] || 'RECEIVED'));
    console.log(`  ✅ ${r.member.padEnd(16)} ${state.padEnd(19)} — ${r.note}`);
  }

  console.log(`\n  🏁 ${made} results seeded (${disposed} disposed — each filed its compliance`);
  console.log('     event through the scoring seam; Priya\'s sentinel rang the registry).');
  console.log('     Open the sandbox clinic → Testing tab → Toxicology Results.\n');
}

main().catch(e => { console.error(`\n❌ Seeding failed: ${e.message}\n`); process.exit(1); });
