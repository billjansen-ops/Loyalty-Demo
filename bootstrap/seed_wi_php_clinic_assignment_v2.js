/**
 * seed_wi_php_clinic_assignment_v2.js
 *
 * Replaces the single-column PARTNER_PROGRAM molecule (storage_size=2) with a
 * composite molecule (storage_size=22): column 1 = partner, column 2 = program.
 *
 * 1. Deletes existing molecule_id=112 and its member data (if present)
 * 2. Creates new PARTNER_PROGRAM molecule with storage_size=22
 * 3. Sets two column-definitions (partner + program)
 * 4. Wires physicians 34-41 to HealthPartners / Lakeview Specialty Hospital
 *
 * Run: node bootstrap/seed_wi_php_clinic_assignment_v2.js
 */

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4001';
const TENANT_ID = 5;
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

// Step 1: Delete existing PARTNER_PROGRAM molecule if present
async function deleteExistingMolecule() {
  console.log('\n[Step 1] Checking for existing PARTNER_PROGRAM molecule...');
  try {
    const existing = await get(`/v1/molecules?tenant_id=${TENANT_ID}`);
    if (Array.isArray(existing)) {
      const found = existing.find(m => m.molecule_key === 'PARTNER_PROGRAM');
      if (found) {
        console.log('  Found molecule_id=' + found.molecule_id + ' -- deleting...');
        const result = await api('DELETE', '/v1/molecules/' + found.molecule_id + '?tenant_id=' + TENANT_ID, {});
        console.log('  Delete status: ' + result.status);
      } else {
        console.log('  None found -- nothing to delete');
      }
    }
  } catch (e) {
    console.log('  Could not check existing molecules: ' + e.message);
  }
}

// Step 2: Create composite PARTNER_PROGRAM molecule (storage_size=22)
async function createMolecule() {
  console.log('\n[Step 2] Creating composite PARTNER_PROGRAM molecule (storage_size=22)...');

  const result = await api('POST', '/v1/molecules', {
    tenant_id:    TENANT_ID,
    molecule_key: 'PARTNER_PROGRAM',
    label:        'Clinic Assignment',
    context:      'member',
    attaches_to:  'M',
    value_kind:   'external_list',
    description:  'Health system and clinic this physician is assigned to',
    is_static:    false,
    is_permanent: false,
    is_required:  false,
    display_order: 50,
    storage_size:  22,
    value_structure: 'composite',
    molecule_type: 'D',
    input_type:    'P',
    value_type:    'key',
  });

  if (result.status !== 201) {
    throw new Error('Molecule creation failed: ' + JSON.stringify(result.data));
  }

  const moleculeId = result.data.molecule_id;
  console.log('  Created molecule_id=' + moleculeId);
  return moleculeId;
}

// Step 3: Set two column-definitions
async function setColumnDefinitions(moleculeId) {
  console.log('\n[Step 3] Setting column definitions for molecule_id=' + moleculeId + '...');

  const result = await api('PUT', '/v1/molecules/' + moleculeId + '/column-definitions', {
    tenant_id: TENANT_ID,
    columns: [
      {
        column_order:       1,
        value_type:         'key',
        context:            'member',
        attaches_to:        'M',
        value_kind:         'external_list',
        table_name:         'partner',
        id_column:          'partner_id',
        code_column:        'partner_code',
        label_column:       'partner_name',
        is_tenant_specific: true,
        storage_size:       2,
        description:        'Health system (partner)',
      },
      {
        column_order:       2,
        value_type:         'key',
        context:            'member',
        attaches_to:        'M',
        value_kind:         'external_list',
        table_name:         'partner_program',
        id_column:          'program_id',
        code_column:        'program_code',
        label_column:       'program_name',
        is_tenant_specific: false,
        storage_size:       2,
        description:        'Clinic (partner program)',
      }
    ]
  });

  if (result.status !== 200) {
    throw new Error('Column definitions failed: ' + JSON.stringify(result.data));
  }
  console.log('  Two column definitions set (partner + program)');
}

// Step 4: Wire each physician to HealthPartners / Lakeview
async function assignPhysicians() {
  console.log('\n[Step 4] Assigning physicians to HealthPartners / Lakeview...');
  let ok = 0, fail = 0;

  for (const num of PHYSICIAN_MEMBER_NUMBERS) {
    const result = await api('PUT', '/v1/member/' + num + '/molecules', {
      molecules: { PARTNER_PROGRAM: ['HLTHPTNRS', 'HP-LAKEVIEW'] },
      tenant_id: TENANT_ID
    });

    if (result.status !== 200) {
      console.log('  FAIL member ' + num + ': ' + JSON.stringify(result.data));
      fail++;
    } else {
      console.log('  OK member ' + num + ' -> HealthPartners / Lakeview');
      ok++;
    }
  }

  console.log('\nDone. ' + ok + ' assigned, ' + fail + ' failed.');
}

async function main() {
  console.log('\n=== Wisconsin PHP Clinic Assignment Seeder v2 (Composite) ===');
  console.log('Target: ' + BASE_URL);

  try {
    await get('/v1/version');
    console.log('Server: OK');
  } catch (e) {
    console.error('Cannot reach server at ' + BASE_URL);
    process.exit(1);
  }

  await deleteExistingMolecule();
  const moleculeId = await createMolecule();
  await setColumnDefinitions(moleculeId);
  await assignPhysicians();
}

main().catch(console.error);
