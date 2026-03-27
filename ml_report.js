// ML Predictive Risk — Physician Feature Report
// Uses same molecule queries as gatherMemberFeatures in pointers.js
import pg from 'pg';
const pool = new pg.Pool({ host: '127.0.0.1', user: 'billjansen', database: 'loyalty' });

const client = await pool.connect();
const TENANT_ID = 5;
// Bill epoch: days since Dec 3 1959, offset by -32768 for SMALLINT range
function dateToMoleculeInt(date) {
  const epoch = new Date(1959, 11, 3);
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor((d - epoch) / 86400000) - 32768;
}
const today = dateToMoleculeInt(new Date());

// Get molecule IDs
async function getMolId(key) {
  const r = await client.query('SELECT molecule_id FROM molecule_def WHERE tenant_id = $1 AND molecule_key = $2', [TENANT_ID, key]);
  return r.rows[0]?.molecule_id;
}

const memberPointsMolId = await getMolId('MEMBER_POINTS');
const memberSurveyLinkMolId = await getMolId('MEMBER_SURVEY_LINK');
const pulseRespondentMolId = await getMolId('PULSE_RESPONDENT_LINK');
const clinicianMolId = await getMolId('IS_CLINICIAN');

// Get physicians (exclude clinicians)
const members = await client.query(`
  SELECT m.membership_number, m.fname, m.lname, m.link
  FROM member m
  WHERE m.tenant_id = $1 AND m.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM "5_data_0" d
    WHERE d.p_link = m.link AND d.molecule_id = $2 AND d.attaches_to = 'M'
  )
  ORDER BY m.membership_number::int
`, [TENANT_ID, clinicianMolId]);

console.log('ML PREDICTIVE RISK — PHYSICIAN FEATURE REPORT');
console.log('Generated: ' + new Date().toLocaleString());
console.log('Molecule queries match gatherMemberFeatures() in pointers.js');
console.log('='.repeat(90));

for (const m of members.rows) {
  // PPSI scores from activity molecules (same query as gatherMemberFeatures line 26131)
  const ppsiScores = await client.query(`
    SELECT COALESCE(d54.n1, 0) AS score
    FROM activity a
    JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
    LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
    WHERE a.p_link = $3 AND a.activity_type = 'A'
    ORDER BY a.activity_date DESC LIMIT 5
  `, [memberSurveyLinkMolId, memberPointsMolId, m.link]);
  const ppsiVals = ppsiScores.rows.map(r => r.score);
  const ppsiCurrent = ppsiVals.length > 0 ? ppsiVals[0] : null;
  const ppsiTrend = ppsiVals.length >= 2 ? ppsiVals[0] - ppsiVals[ppsiVals.length - 1] : 0;
  let ppsiVol = 0;
  if (ppsiVals.length >= 3) {
    const mean = ppsiVals.reduce((a, b) => a + b, 0) / ppsiVals.length;
    ppsiVol = Math.sqrt(ppsiVals.reduce((a, v) => a + (v - mean) ** 2, 0) / ppsiVals.length);
  }

  // Pulse scores from activity molecules (same query as gatherMemberFeatures line 26239)
  const pulseScores = await client.query(`
    SELECT COALESCE(d54.n1, 0) AS score
    FROM activity a
    JOIN "5_data_4" d4 ON d4.p_link = a.link AND d4.molecule_id = $1
    LEFT JOIN "5_data_54" d54 ON d54.p_link = a.link AND d54.molecule_id = $2
    WHERE a.p_link = $3 AND a.activity_type = 'A'
    ORDER BY a.activity_date DESC LIMIT 5
  `, [pulseRespondentMolId, memberPointsMolId, m.link]);
  const pulseVals = pulseScores.rows.map(r => r.score);
  const pulseCurrent = pulseVals.length > 0 ? pulseVals[0] : null;
  const pulseTrend = pulseVals.length >= 2 ? pulseVals[0] - pulseVals[pulseVals.length - 1] : 0;

  // Compliance
  const comp = await client.query(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN cr.link IS NOT NULL THEN 1 END) as completed
    FROM member_compliance mc
    LEFT JOIN compliance_result cr ON cr.member_compliance_id = mc.member_compliance_id
    WHERE mc.member_link = $1 AND mc.tenant_id = $2
  `, [m.link, TENANT_ID]);
  const compTotal = parseInt(comp.rows[0].total);
  const compCompleted = parseInt(comp.rows[0].completed);
  const compRate = compTotal > 0 ? compCompleted / compTotal : 1.0;

  // Registry (status = 'O' for open)
  const reg = await client.query(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN urgency IN ('RED','SENTINEL') THEN 1 END) as red_count
    FROM stability_registry
    WHERE member_link = $1 AND tenant_id = $2 AND status = 'O'
  `, [m.link, TENANT_ID]);

  // Days enrolled
  const mem = await client.query('SELECT enroll_date FROM member WHERE link = $1', [m.link]);
  const daysEnrolled = mem.rows[0]?.enroll_date ? today - mem.rows[0].enroll_date : 0;

  // Days since last PPSI — uses member_survey.end_ts (Unix seconds), same as server
  const lastPpsi = await client.query(`
    SELECT MAX(ms.end_ts) as last_ts FROM member_survey ms
    JOIN survey s ON ms.survey_link = s.link
    WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.survey_code = 'PPSI' AND ms.end_ts IS NOT NULL
  `, [m.link, TENANT_ID]);
  let daysSincePpsi = null;
  if (lastPpsi.rows[0]?.last_ts) {
    const lastDate = new Date(lastPpsi.rows[0].last_ts * 1000);
    daysSincePpsi = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }

  // Days since last Pulse — uses member_survey.end_ts (Unix seconds), same as server
  const lastPulse = await client.query(`
    SELECT MAX(ms.end_ts) as last_ts FROM member_survey ms
    JOIN survey s ON ms.survey_link = s.link
    WHERE ms.member_link = $1 AND s.tenant_id = $2 AND s.survey_code = 'PROVPULSE' AND ms.end_ts IS NOT NULL
  `, [m.link, TENANT_ID]);
  let daysSincePulse = null;
  if (lastPulse.rows[0]?.last_ts) {
    const lastDate = new Date(lastPulse.rows[0].last_ts * 1000);
    daysSincePulse = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }

  const features = {
    ppsi_current: ppsiCurrent,
    ppsi_trend: ppsiTrend,
    ppsi_volatility: Math.round(ppsiVol * 10) / 10,
    pulse_current: pulseCurrent,
    pulse_trend: pulseTrend,
    compliance_rate: Math.round(compRate * 100) / 100,
    compliance_misses_30d: compTotal - compCompleted,
    survey_completion_rate: ppsiVals.length > 0 ? 1.0 : 0,
    consecutive_misses: 0,
    days_since_last_ppsi: daysSincePpsi,
    days_since_last_pulse: daysSincePulse,
    meds_flags_30d: 0,
    registry_open_count: parseInt(reg.rows[0].total),
    registry_red_count: parseInt(reg.rows[0].red_count),
    days_enrolled: daysEnrolled,
    ppii_current: ppsiCurrent
  };

  // Call ML service
  let prediction = null;
  try {
    const resp = await fetch('http://127.0.0.1:5050/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...features, member_link: m.membership_number })
    });
    prediction = await resp.json();
  } catch (e) {}

  console.log(`\n#${m.membership_number} ${m.fname} ${m.lname}`);
  console.log('-'.repeat(60));
  console.log(`  PPSI scores: ${ppsiVals.length > 0 ? ppsiVals.join(', ') : '(none)'}`);
  console.log(`  Pulse scores: ${pulseVals.length > 0 ? pulseVals.join(', ') : '(none)'}`);
  console.log(`  Compliance: ${compCompleted}/${compTotal}`);
  console.log(`  Registry: ${reg.rows[0].total} open, ${reg.rows[0].red_count} RED/SENTINEL`);
  console.log('');
  console.log('  FEATURES:');
  for (const [k, v] of Object.entries(features)) {
    const flag = v === null ? '  ⚠ NULL' : '';
    console.log(`    ${k.padEnd(25)} ${String(v === null ? 'null' : v).padStart(8)}${flag}`);
  }
  console.log('');
  if (prediction) {
    console.log(`  ► PREDICTION: ${prediction.risk_score} (${prediction.risk_label})  prob=${prediction.probability}`);
    if (prediction.confidence) console.log(`    Confidence: ${prediction.confidence.note}`);
  } else {
    console.log('  ► PREDICTION: (ML service unavailable)');
  }
}

console.log('\n' + '='.repeat(90));
client.release();
await pool.end();
