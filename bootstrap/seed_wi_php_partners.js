/**
 * seed_wi_php_partners.js
 * Seeds 12 real Wisconsin health system partners and their clinic programs
 * into tenant 5 (wi_php).
 *
 * HealthPartners is the demo partner — Lakeview Specialty Hospital is the
 * live demo clinic. All others are enrolled but inactive for demo purposes.
 *
 * Run: node bootstrap/seed_wi_php_partners.js
 */

const API_BASE = 'http://127.0.0.1:4001';
const TENANT_ID = 5;

// ============================================================================
// PARTNER DATA
// HealthPartners has full programs (demo). All others have one placeholder program.
// ============================================================================
const partners = [
  {
    partner_code: 'HLTHPTNRS',
    partner_name: 'HealthPartners',
    is_demo: true,
    programs: [
      { program_code: 'HP-LAKEVIEW',  program_name: 'Lakeview Specialty Hospital',        is_demo: true  },
      { program_code: 'HP-MADISON',   program_name: 'HealthPartners Clinic — Madison',     is_demo: false },
      { program_code: 'HP-EAUCLAIRE', program_name: 'HealthPartners Clinic — Eau Claire',  is_demo: false },
      { program_code: 'HP-PARKNIC',   program_name: 'Park Nicollet Medical Center',        is_demo: false },
      { program_code: 'HP-REGIONS',   program_name: 'Regions Hospital Physicians Group',   is_demo: false },
      { program_code: 'HP-HUDSON',    program_name: 'HealthPartners Medical Group — Hudson', is_demo: false },
    ]
  },
  {
    partner_code: 'FROEDTERT',
    partner_name: 'Froedtert ThedaCare',
    programs: [
      { program_code: 'FT-MAIN', program_name: 'Froedtert ThedaCare — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'UWHEALTH',
    partner_name: 'UW Health',
    programs: [
      { program_code: 'UW-MAIN', program_name: 'UW Health — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'AURORA',
    partner_name: 'Advocate Aurora Health',
    programs: [
      { program_code: 'AU-MAIN', program_name: 'Advocate Aurora — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'ASCENSION',
    partner_name: 'Ascension Wisconsin',
    programs: [
      { program_code: 'AS-MAIN', program_name: 'Ascension Wisconsin — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'MARSHFLD',
    partner_name: 'Marshfield Clinic Health System',
    programs: [
      { program_code: 'MC-MAIN', program_name: 'Marshfield Clinic — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'GUNDERSEN',
    partner_name: 'Gundersen Health System',
    programs: [
      { program_code: 'GH-MAIN', program_name: 'Gundersen Health — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'ASPIRUS',
    partner_name: 'Aspirus Health',
    programs: [
      { program_code: 'AP-MAIN', program_name: 'Aspirus Health — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'SSMHEALTH',
    partner_name: 'SSM Health Wisconsin',
    programs: [
      { program_code: 'SS-MAIN', program_name: 'SSM Health Wisconsin — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'BELLIN',
    partner_name: 'Bellin Health',
    programs: [
      { program_code: 'BH-MAIN', program_name: 'Bellin Health — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'PROHEALTH',
    partner_name: 'ProHealth Care',
    programs: [
      { program_code: 'PH-MAIN', program_name: 'ProHealth Care — Enrollment Pending' }
    ]
  },
  {
    partner_code: 'HSHS',
    partner_name: 'HSHS Wisconsin',
    programs: [
      { program_code: 'HS-MAIN', program_name: 'HSHS Wisconsin — Enrollment Pending' }
    ]
  }
];

// ============================================================================
// SEED
// ============================================================================
async function seed() {
  console.log(`Seeding ${partners.length} Wisconsin PHP partners into tenant ${TENANT_ID}...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const partner of partners) {
    const payload = {
      tenant_id: TENANT_ID,
      partner_code: partner.partner_code,
      partner_name: partner.partner_name,
      is_active: true,
      programs: partner.programs.map(p => ({
        program_code: p.program_code,
        program_name: p.program_name,
        earning_type: 'V',      // Variable — clinics don't issue loyalty points
        fixed_points: null,
        is_active: true
      }))
    };

    try {
      const res = await fetch(`${API_BASE}/v1/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');

      console.log(`✓ ${partner.partner_name} (partner_id=${data.partner_id}) — ${partner.programs.length} program(s)`);
      successCount++;
    } catch (err) {
      console.error(`✗ ${partner.partner_name}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nDone. ${successCount} partners seeded, ${errorCount} errors.`);
  console.log('\nReminder: Lakeview Specialty Hospital (HP-LAKEVIEW) is the live demo clinic.');
  console.log('Wire tenant 5 members to that partner_program to complete the hierarchy.');
}

seed().catch(console.error);
