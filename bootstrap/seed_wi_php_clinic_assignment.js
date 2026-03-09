/**
 * seed_wi_php_clinic_assignment.js
 *
 * 1. Creates PARTNER_PROGRAM molecule for tenant 5 (attaches_to='M')
 * 2. Sets molecule_value_lookup config so encoder can resolve program_id
 * 3. Wires physicians 34-41 to Lakeview Specialty Hospital (program_id=13)
 *
 * Run: node bootstrap/seed_wi_php_clinic_assignment.js
 */

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4001';
const TENANT_ID = 5;
const LAKEVIEW_PROGRAM_ID = 13;
const PHYSICIAN_MEMBER_NUMBERS = [34, 35, 36, 37, 38, 39, 40, 41];

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json();
}

async function createMolecule() {
  console.log('\n[Step 1] Creating PARTNER_PROGRAM molecule for tenant 5...');

  try {
    const existing = await get(`/v1/molecules?tenant_id=${TENANT_ID}`);
    if (Array.isArray(existing)) {
      const found = existing.find(m => m.molecule_key === 'PARTNER_PROGRAM');
      if (found) {
        console.log('  Already exists molecule_id=' + found.molecule_id + ' -- skipping creation');
        return found.molecule_id;
      }
    }
  } catch (e) {}

  const result = await api('POST', '/v1/molecules', {
    tenant_id:           TENANT_ID,
    molecule_key:        'PARTNER_PROGRAM',
    label:               'Clinic Assignment',
    context:             'member',
    attaches_to:         'M',
    value_kind:          'external_list',
    lookup_table_key:    'partner_program',
    parent_molecule_key: 'partner',
    parent_fk_field:     'partner_id',
    description:         'Clinic (partner program) this physician is assigned to',
    is_static:           false,
    is_permanent:        false,
    is_required:         false,
    display_order:       50,
    storage_size:        2,
    value_structure:     'single',
    molecule_type:       'D',
    input_type:          'P',
    value_type:          'key',
  });

  if (result.status !== 201) {
    throw new Error('Molecule creation failed: ' + JSON.stringify(result.data));
  }

  const moleculeId = result.data.molecule_id;
  console.log('  Created molecule_id=' + moleculeId);
  return moleculeId;
}

async function setLookupConfig(moleculeId) {
  console.log('\n[Step 2] Setting lookup config for molecule_id=' + moleculeId + '...');

  const result = await api('PUT', '/v1/molecules/' + moleculeId + '/lookup-config', {
    tenant_id:          TENANT_ID,
    table_name:         'partner_program',
    id_column:          'program_id',
    code_column:        'program_code',
    label_column:       'program_name',
    is_tenant_specific: false,
  });

  if (result.status !== 200) {
    throw new Error('Lookup config failed: ' + JSON.stringify(result.data));
  }
  console.log('  Lookup config set (partner_program -> program_id)');
}

async function assignPhysicians() {
  console.log('\n[Step 3] Assigning physicians to Lakeview (program_id=' + LAKEVIEW_PROGRAM_ID + ')...');
  let ok = 0, fail = 0;

  for (const num of PHYSICIAN_MEMBER_NUMBERS) {
    const result = await api('PUT', '/v1/member/' + num + '/molecules', {
      molecules: { PARTNER_PROGRAM: LAKEVIEW_PROGRAM_ID },
      tenant_id: TENANT_ID
    });

    if (result.status !== 200) {
      console.log('  FAIL member ' + num + ': ' + JSON.stringify(result.data));
      fail++;
    } else {
      console.log('  OK member ' + num + ' -> Lakeview');
      ok++;
    }
  }

  console.log('\nDone. ' + ok + ' assigned, ' + fail + ' failed.');
}

async function main() {
  console.log('\n=== Wisconsin PHP Clinic Assignment Seeder ===');
  console.log('Target: ' + BASE_URL);

  try {
    await get('/v1/version');
    console.log('Server: OK');
  } catch (e) {
    console.error('Cannot reach server at ' + BASE_URL);
    process.exit(1);
  }

  const moleculeId = await createMolecule();
  await setLookupConfig(moleculeId);
  await assignPhysicians();
}

main().catch(console.error);
