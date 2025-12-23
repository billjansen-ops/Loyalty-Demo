import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Version info - update this when making significant changes
const SERVER_VERSION = "2025.11.07.1205"; // Format: YYYY.MM.DD.HHMM
const BUILD_NOTES = "Fixed to use getMolecule helper and activity_type_label";

let pg = null;
try { pg = await import("pg"); } catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const USE_DB = !!(pg && (process.env.DATABASE_URL || process.env.PGHOST));

let dbClient = null;
if (USE_DB) {
  const { Client } = pg;
  const cfg = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || "127.0.0.1",
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "",
        database: process.env.PGDATABASE || "postgres",
      };
  dbClient = new Client(cfg);
  dbClient.connect().catch(err => {
    console.error("DB connect failed, falling back to mock:", err.message);
    dbClient = null;
  });
}

function rowsToMagicBox(a) {
  const box = [];
  if (Array.isArray(a.attrs)) {
    for (const kv of a.attrs) {
      const k = String(kv.key || "").trim();
      const v = String(kv.value ?? "").trim();
      if (!k || !v) continue;
      box.push({ label: k, value: v });
    }
  } else {
    if (a.origin)        box.push({ label: "Origin",      value: a.origin });
    if (a.destination)   box.push({ label: "Destination", value: a.destination });
    if (a.carrier || a.carrier_code)
                         box.push({ label: "Carrier",     value: a.carrier || a.carrier_code });
    if (a.flight_no || a.flight_number)
                         box.push({ label: "Flight",      value: a.flight_no || a.flight_number });
    if (a.fare_class || a.class)
                         box.push({ label: "Fare/Class",  value: a.fare_class || a.class });
    if (a.cabin)         box.push({ label: "Cabin",       value: a.cabin });
  }
  return box.length ? box : undefined;
}

const MOCK = {
  balances(memberId) {
    return { ok: true, balances: { base_miles: 3740, tier_credits: 0 } };
  },
  activities(memberId) {
    return {
      ok: true,
      activities: [
        { activity_date: "2025-10-25T05:00:00.000Z", title: "Activity 1,200", miles_total: 1200,
          origin: "MSP", destination: "BOS", carrier_code: "BJ", flight_no: "BJ123", fare_class: "Y" },
        { activity_date: "2025-08-22T05:00:00.000Z", title: "Activity 1,250", miles_total: 1250,
          origin: "BOS", destination: "MSP", carrier_code: "BJ", flight_no: "BJ124", fare_class: "M" },
        { activity_date: "2025-05-19T05:00:00.000Z", title: "Activity 870", miles_total: 870,
          origin: "MSP", destination: "DEN", carrier_code: "BJ", flight_no: "BJ210", fare_class: "K" },
        { activity_date: "2025-03-02T06:00:00.000Z", title: "Activity 420", miles_total: 420,
          origin: "DEN", destination: "MSP", carrier_code: "BJ", flight_no: "BJ211", fare_class: "T" },
      ]
    };
  },
  buckets(memberId) {
    return {
      ok: true,
      member_id: String(memberId),
      point_type: "base_miles",
      program_tz: "America/Chicago",
      today: new Date().toISOString().slice(0,10),
      buckets: [
        { expiry_date: "2026-03-31", accrued: 12000, redeemed: 3000 },
        { expiry_date: "2025-12-31", accrued: 8000,  redeemed: 5000 },
        { expiry_date: "2025-08-31", accrued: 2000,  redeemed: 1500 },
        { expiry_date: "9999-12-31", accrued: 4000,  redeemed: 0 }
      ]
    };
  }
};

// ============================================================================
// MOLECULE HELPER FUNCTION
// Black box encapsulation for all molecule table access
// ============================================================================

/**
 * Get a molecule definition and its value(s)
 * @param {string} moleculeKey - The molecule key (e.g., "currency_label_singular")
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<Object>} Molecule definition with value(s)
 */
async function getMolecule(moleculeKey, tenantId) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Step 1: Get molecule definition
  const defQuery = `
    SELECT 
      molecule_id,
      molecule_key,
      label,
      context,
      value_kind,
      scalar_type,
      lookup_table_key,
      is_static,
      is_permanent,
      is_required,
      is_active,
      description
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const molecule = defResult.rows[0];
  
  // Step 2: Get value(s) based on type
  if (molecule.value_kind === 'scalar' && molecule.is_static) {
    // Get scalar value from appropriate table
    let valueQuery;
    
    switch (molecule.scalar_type) {
      case 'text':
        valueQuery = 'SELECT text_value as value FROM molecule_value_text WHERE molecule_id = $1';
        break;
      case 'numeric':
        valueQuery = 'SELECT numeric_value as value FROM molecule_value_numeric WHERE molecule_id = $1';
        break;
      case 'date':
        valueQuery = 'SELECT date_value as value FROM molecule_value_date WHERE molecule_id = $1';
        break;
      case 'boolean':
        valueQuery = 'SELECT bool_value as value FROM molecule_value_boolean WHERE molecule_id = $1';
        break;
      default:
        throw new Error(`Unknown scalar_type: ${molecule.scalar_type}`);
    }
    
    const valueResult = await dbClient.query(valueQuery, [molecule.molecule_id]);
    molecule.value = valueResult.rows.length > 0 ? valueResult.rows[0].value : null;
    
  } else if (molecule.value_kind === 'list') {
    // Get list of values
    const listQuery = `
      SELECT 
        value_id,
        text_value as value,
        display_label as label,
        sort_order
      FROM molecule_value_text
      WHERE molecule_id = $1
      ORDER BY sort_order, text_value
    `;
    
    const listResult = await dbClient.query(listQuery, [molecule.molecule_id]);
    molecule.values = listResult.rows;
    
  } else if (molecule.value_kind === 'lookup') {
    // For lookup types, just include the lookup_table_key
    // The caller will need to query that table separately
    molecule.value = null;
    molecule.values = null;
  }
  
  return molecule;
}

// GET - Test endpoint for molecule retrieval
app.get('/v1/molecules/get/:key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { key } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    const molecule = await getMolecule(key, tenant_id);
    res.json(molecule);
  } catch (error) {
    console.error('Error getting molecule:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET - List all active tenants
app.get('/v1/tenants', async (req, res) => {
  if (!dbClient) {
    return res.json([
      { tenant_id: 1, tenant_key: 'delta', name: 'Delta Air Lines', industry: 'airline' }
    ]);
  }

  try {
    const query = `
      SELECT tenant_id, tenant_key, name, industry, is_active
      FROM tenant
      WHERE is_active = true
      ORDER BY name
    `;
    const result = await dbClient.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get display labels for a tenant
// Returns simple key/value pairs for UI rendering
app.get('/v1/tenants/:id/labels', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    
    // Get all static tenant-context AND program-context molecules with their values
    const query = `
      SELECT 
        md.molecule_key,
        CASE 
          WHEN md.scalar_type = 'text' THEN mvt.text_value
          WHEN md.scalar_type = 'numeric' THEN mvn.numeric_value::text
          WHEN md.scalar_type = 'date' THEN mvd.date_value::text
          WHEN md.scalar_type = 'boolean' THEN mvb.bool_value::text
          ELSE NULL
        END as value
      FROM molecule_def md
      LEFT JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
      LEFT JOIN molecule_value_numeric mvn ON md.molecule_id = mvn.molecule_id
      LEFT JOIN molecule_value_date mvd ON md.molecule_id = mvd.molecule_id
      LEFT JOIN molecule_value_boolean mvb ON md.molecule_id = mvb.molecule_id
      WHERE md.tenant_id = $1
        AND md.context IN ('tenant', 'program')
        AND md.is_static = true
        AND md.is_active = true
        AND md.value_kind = 'scalar'
    `;
    
    const result = await dbClient.query(query, [id]);
    
    // Convert to simple key/value object
    const labels = {};
    result.rows.forEach(row => {
      if (row.molecule_key && row.value !== null) {
        labels[row.molecule_key] = row.value;
      }
    });
    
    res.json(labels);
  } catch (error) {
    console.error('Error fetching tenant labels:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List carriers for a tenant
app.get('/v1/carriers', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    const query = `
      SELECT 
        carrier_id,
        code,
        name,
        alliance,
        country,
        is_active
      FROM carriers
      WHERE tenant_id = $1
      ORDER BY name
    `;
    
    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching carriers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List airports for a tenant
// Member Info
app.get("/v1/member/:id/info", async (req, res) => {
  const memberId = req.params.id;
  
  if (!dbClient) {
    return res.json({
      member_id: memberId,
      name: 'Mock Member',
      tier: 'Silver',
      available_miles: 0
    });
  }
  
  try {
    // Get member basic info
    const memberQuery = `
      SELECT 
        member_id,
        name
      FROM member
      WHERE member_id = $1
    `;
    
    const memberResult = await dbClient.query(memberQuery, [memberId]);
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    const member = memberResult.rows[0];
    
    // Get current tier using database function
    const tierQuery = `SELECT * FROM get_member_tier_on_date($1, CURRENT_DATE)`;
    const tierResult = await dbClient.query(tierQuery, [memberId]);
    
    if (tierResult.rows.length > 0) {
      member.tier = tierResult.rows[0].tier_code;
      member.tier_description = tierResult.rows[0].tier_description;
    }
    
    // Get available miles
    const today = new Date().toISOString().slice(0, 10);
    const milesQuery = `
      SELECT COALESCE(SUM(accrued - redeemed), 0) as available_miles
      FROM point_lot
      WHERE member_id = $1
        AND (expire_date IS NULL OR expire_date >= $2)
    `;
    
    const milesResult = await dbClient.query(milesQuery, [memberId, today]);
    member.available_miles = Number(milesResult.rows[0]?.available_miles || 0);
    
    return res.json(member);
    
  } catch (e) {
    console.error("member info error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// Balances
app.get("/v1/member/:id/balances", async (req, res) => {
  const memberId = req.params.id;
  if (!dbClient) return res.json(MOCK.balances(memberId));
  
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Query available points from point_lot (unexpired only)
    const query = `
      SELECT 
        point_type,
        COALESCE(SUM(accrued - redeemed), 0) as balance
      FROM point_lot
      WHERE member_id = $1
        AND (expire_date IS NULL OR expire_date >= $2)
      GROUP BY point_type
    `;
    
    const result = await dbClient.query(query, [memberId, today]);
    
    const balances = {};
    for (const row of result.rows) {
      balances[row.point_type || 'miles'] = Number(row.balance) || 0;
    }
    
    // Ensure at least base_miles exists
    if (!balances.miles && !balances.base_miles) {
      balances.base_miles = 0;
    }
    
    return res.json({ ok: true, balances: balances });
    
  } catch (e) {
    console.error("balances error:", e);
    return res.json(MOCK.balances(memberId));
  }
});

// Activities with decoded molecules
app.get("/v1/member/:id/activities", async (req, res) => {
  const memberId = req.params.id;
  const tenantId = req.query.tenant_id || 1; // TODO: Get from session
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

  if (!dbClient) {
    const mock = MOCK.activities(memberId);
    for (const a of mock.activities) a.magic_box = rowsToMagicBox(a);
    return res.json(mock);
  }
  
  try {
    // Step 1: Get activities
    const activitiesQuery = `
      SELECT 
        activity_id, 
        member_id, 
        activity_date,
        post_date,
        activity_type,
        point_amount as base_miles
      FROM activity
      WHERE member_id = $1
      ORDER BY activity_date DESC
      LIMIT $2
    `;
    
    const activitiesResult = await dbClient.query(activitiesQuery, [memberId, limit]);
    
    if (activitiesResult.rows.length === 0) {
      return res.json({ ok: true, activities: [] });
    }
    
    // Step 2: Get all activity_detail records WITH molecule_key via JOIN
    const activityIds = activitiesResult.rows.map(r => r.activity_id);
    const detailsQuery = `
      SELECT 
        ad.activity_id, 
        ad.molecule_id,
        ad.v_ref_id,
        md.molecule_key
      FROM activity_detail ad
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id
      WHERE ad.activity_id = ANY($1)
      ORDER BY ad.activity_id, md.molecule_key
    `;
    
    const detailsResult = await dbClient.query(detailsQuery, [activityIds]);
    
    // Group details by activity_id
    const detailsByActivity = {};
    for (const detail of detailsResult.rows) {
      if (!detailsByActivity[detail.activity_id]) {
        detailsByActivity[detail.activity_id] = [];
      }
      detailsByActivity[detail.activity_id].push(detail);
    }
    
    // Step 3: Decode molecules for each activity
    const activities = await Promise.all(activitiesResult.rows.map(async (activity) => {
      const baseMiles = Number(activity.base_miles || 0);
      const details = detailsByActivity[activity.activity_id] || [];
      
      // Decode each molecule
      const decodedValues = {};
      for (const detail of details) {
        try {
          decodedValues[detail.molecule_key] = await decodeMolecule(tenantId, detail.molecule_key, detail.v_ref_id);
        } catch (error) {
          console.error(`Error decoding ${detail.molecule_key}:`, error);
          decodedValues[detail.molecule_key] = `[decode error]`;
        }
      }
      
      // Build activity object
      const result = {
        activity_id: activity.activity_id,
        member_id: activity.member_id,
        activity_date: (activity.activity_date && activity.activity_date.toISOString) 
          ? activity.activity_date.toISOString() 
          : (activity.activity_date || ""),
        activity_type: activity.activity_type || 'A',
        base_miles: baseMiles,
        miles_total: baseMiles,
        point_type: 'miles',
        title: `Activity ${baseMiles.toLocaleString()}`
      };
      
      // Add decoded molecule values to result
      if (decodedValues.carrier) result.carrier_code = decodedValues.carrier;
      if (decodedValues.origin) result.origin = decodedValues.origin;
      if (decodedValues.destination) result.destination = decodedValues.destination;
      if (decodedValues.fare_class) result.fare_class = decodedValues.fare_class;
      if (decodedValues.flight_number) result.flight_no = decodedValues.flight_number;
      
      // Build magic_box from decoded molecules
      result.magic_box = [];
      if (decodedValues.origin) {
        result.magic_box.push({ label: 'Origin', value: decodedValues.origin });
      }
      if (decodedValues.destination) {
        result.magic_box.push({ label: 'Destination', value: decodedValues.destination });
      }
      if (decodedValues.carrier) {
        const flightDisplay = decodedValues.flight_number 
          ? `${decodedValues.carrier}${decodedValues.flight_number}` 
          : decodedValues.carrier;
        result.magic_box.push({ label: 'Carrier', value: flightDisplay });
      }
      if (decodedValues.fare_class) {
        result.magic_box.push({ label: 'Class', value: decodedValues.fare_class });
      }
      
      return result;
    }));
    
    return res.json({ ok: true, activities });
    
  } catch (e) {
    console.error("activities error:", e);
    const mock = MOCK.activities(memberId);
    for (const a of mock.activities) a.magic_box = rowsToMagicBox(a);
    return res.json(mock);
  }
});

// NEW: Point buckets for Mile Summary
app.get("/v1/member/:id/buckets", async (req, res) => {
  const memberId = req.params.id;
  const today = new Date().toISOString().slice(0,10);
  const program_tz = "America/Chicago";

  if (!dbClient) return res.json(MOCK.buckets(memberId));

  try {
    // Query point_lot table with new schema
    const q = await dbClient.query(
      `SELECT 
        lot_id,
        COALESCE(expire_date, DATE '9999-12-31') AS expiry_date,
        COALESCE(accrued, 0) AS accrued,
        COALESCE(redeemed, 0) AS redeemed,
        (COALESCE(accrued, 0) - COALESCE(redeemed, 0)) AS net_balance
       FROM point_lot
       WHERE member_id = $1
       ORDER BY expire_date NULLS LAST`,
      [memberId]
    );
    
    const buckets = (q?.rows || []).map(r => ({
      lot_id: r.lot_id,
      expiry_date: r.expiry_date?.toISOString?.() ? r.expiry_date.toISOString().slice(0,10) : String(r.expiry_date),
      accrued: Number(r.accrued || 0),
      redeemed: Number(r.redeemed || 0),
      net_balance: Number(r.net_balance || 0)
    }));
    
    // Calculate total available (unexpired only)
    const totalAvailable = buckets
      .filter(b => b.expiry_date >= today)
      .reduce((sum, b) => sum + b.net_balance, 0);
    
    return res.json({
      ok: true,
      member_id: String(memberId),
      point_type: "base_miles",
      program_tz,
      today,
      total_available: totalAvailable,
      buckets: buckets
    });
    
  } catch (e) {
    console.error("buckets error:", e);
    return res.json({
      ok: true,
      member_id: String(memberId),
      point_type: "base_miles",
      program_tz,
      today,
      total_available: 0,
      buckets: []
    });
  }
});

// FIXED: CSR Member Search - now on correct endpoint /v1/member/search
app.get("/v1/member/search", async (req, res) => {
  const q = ((req.query.q || req.query.query || "") + "").trim();
  console.log(`🔍 Member search called with q="${q}"`);
  
  if (!q) {
    console.log('  → Empty query, returning []');
    return res.json([]);
  }
  
  if (!dbClient) {
    console.log('  → No database, returning []');
    return res.json([]);
  }

  try {
    const r = await dbClient.query(
      `SELECT member_id, name
         FROM public.member
        WHERE member_id::text ILIKE '%' || $1 || '%'
           OR name ILIKE '%' || $1 || '%'
        ORDER BY member_id
        LIMIT 50`,
      [q]
    );
    console.log(`  → Found ${r.rows.length} results`);
    if (r.rows.length > 0) {
      console.log(`  → First result: ${JSON.stringify(r.rows[0])}`);
    }
    return res.json(r.rows || []);
  } catch (e) {
    console.error("  ❌ Search error:", e.message);
    return res.status(500).json({ error: "query_failed" });
  }
});

// Member Tier History
app.get("/v1/member/:id/tiers", async (req, res) => {
  const memberId = req.params.id;

  if (!dbClient) {
    // Mock tier data
    return res.json({
      ok: true,
      member_id: memberId,
      tiers: [
        { tier_code: "B", tier_description: "Basic", tier_ranking: 1, start_date: "2023-01-01", end_date: "2023-12-31" },
        { tier_code: "S", tier_description: "Silver", tier_ranking: 3, start_date: "2024-01-01", end_date: "2024-06-30" },
        { tier_code: "G", tier_description: "Gold", tier_ranking: 5, start_date: "2024-07-01", end_date: null }
      ]
    });
  }

  try {
    const q = await dbClient.query(
      `SELECT 
         mt.member_tier_id,
         mt.member_id,
         td.tier_code,
         td.tier_description,
         td.tier_ranking,
         mt.start_date::date AS start_date,
         mt.end_date::date AS end_date
       FROM member_tier mt
       JOIN tier_definition td ON mt.tier_id = td.tier_id
       WHERE mt.member_id = $1
       ORDER BY mt.start_date DESC`,
      [memberId]
    );

    const tiers = q.rows.map(r => ({
      member_tier_id: r.member_tier_id,
      tier_code: r.tier_code,
      tier_description: r.tier_description,
      tier_ranking: Number(r.tier_ranking || 0),
      start_date: r.start_date?.toISOString?.() ? r.start_date.toISOString().slice(0, 10) : String(r.start_date || ''),
      end_date: r.end_date?.toISOString?.() ? r.end_date.toISOString().slice(0, 10) : (r.end_date || null)
    }));

    return res.json({ ok: true, member_id: memberId, tiers });
  } catch (e) {
    console.error("tiers error:", e);
    // Fallback to mock
    return res.json({
      ok: true,
      member_id: memberId,
      tiers: [
        { tier_code: "B", tier_description: "Basic", tier_ranking: 1, start_date: "2023-01-01", end_date: "2023-12-31" },
        { tier_code: "S", tier_description: "Silver", tier_ranking: 3, start_date: "2024-01-01", end_date: "2024-06-30" },
        { tier_code: "G", tier_description: "Gold", tier_ranking: 5, start_date: "2024-07-01", end_date: null }
      ]
    });
  }
});

app.use(express.static(__dirname));

// ADD THESE ENDPOINTS TO YOUR server_db_api.js FILE

// ============================================
// MEMBER TIER CRUD ENDPOINTS
// ============================================

// POST - Add new tier assignment to member
app.post('/v1/member/:id/tiers', async (req, res) => {
  const memberId = req.params.id;
  const { tier_id, start_date, end_date } = req.body;

  try {
    const query = `
      INSERT INTO member_tier (member_id, tier_id, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        member_tier_id,
        member_id,
        tier_id,
        start_date,
        end_date
    `;

    const result = await pool.query(query, [
      memberId,
      tier_id,
      start_date,
      end_date || null
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update existing tier assignment
app.put('/v1/member/:id/tiers/:tierId', async (req, res) => {
  const { id: memberId, tierId } = req.params;
  const { tier_id, start_date, end_date } = req.body;

  try {
    const query = `
      UPDATE member_tier
      SET 
        tier_id = $1,
        start_date = $2,
        end_date = $3
      WHERE member_tier_id = $4
        AND member_id = $5
      RETURNING 
        member_tier_id,
        member_id,
        tier_id,
        start_date,
        end_date
    `;

    const result = await pool.query(query, [
      tier_id,
      start_date,
      end_date || null,
      tierId,
      memberId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier assignment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remove tier assignment
app.delete('/v1/member/:id/tiers/:tierId', async (req, res) => {
  const { id: memberId, tierId } = req.params;

  try {
    const query = `
      DELETE FROM member_tier
      WHERE member_tier_id = $1
        AND member_id = $2
      RETURNING member_tier_id
    `;

    const result = await pool.query(query, [tierId, memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier assignment not found' });
    }

    res.json({ success: true, deleted_id: tierId });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Look up tier on specific date (Party Trick!)
app.get('/v1/member/:id/tiers/on-date', async (req, res) => {
  const memberId = req.params.id;
  const { date } = req.query;

  try {
    const query = `
      SELECT * FROM get_member_tier_on_date($1, $2)
    `;

    const result = await pool.query(query, [memberId, date]);

    if (result.rows.length === 0 || !result.rows[0].tier_id) {
      // No tier on that date
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error looking up tier on date:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List all tier definitions (for dropdown)
app.get('/v1/tiers', async (req, res) => {
  if (!dbClient) {
    return res.json([
      { tier_id: 1, tier_code: 'B', tier_description: 'Basic', tier_ranking: 1, is_active: true },
      { tier_id: 2, tier_code: 'S', tier_description: 'Silver', tier_ranking: 3, is_active: true },
      { tier_id: 3, tier_code: 'G', tier_description: 'Gold', tier_ranking: 5, is_active: true }
    ]);
  }
  
  try {
    const query = `
      SELECT 
        tier_id,
        tier_code,
        tier_description,
        tier_ranking,
        is_active
      FROM tier_definition
      WHERE is_active = true
      ORDER BY tier_ranking DESC
    `;

    const result = await dbClient.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List all airports
app.get('/v1/airports', async (req, res) => {
  if (!dbClient) {
    return res.json([
      { airport_id: 1, code: 'MSP', name: 'Minneapolis-St. Paul International Airport', city: 'Minneapolis', country: 'USA', is_active: true },
      { airport_id: 2, code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'USA', is_active: true },
      { airport_id: 3, code: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'USA', is_active: true }
    ]);
  }
  
  try {
    const query = `
      SELECT 
        airport_id,
        code,
        name,
        city,
        country,
        is_active
      FROM airports
      ORDER BY code ASC
    `;

    const result = await dbClient.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching airports:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Test bonus rule against activity data (header checks only for now)
app.post('/v1/test-rule/:bonusCode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const bonusCode = req.params.bonusCode;
    const activityData = req.body;

    console.log(`\n🧪 Testing rule for bonus: ${bonusCode}`);
    console.log('   Activity data:', activityData);

    // Step 1: Look up bonus by code
    const bonusQuery = `
      SELECT bonus_id, bonus_code, bonus_description, bonus_type, bonus_amount,
             start_date, end_date, is_active, rule_id
      FROM bonus
      WHERE bonus_code = $1
    `;
    const bonusResult = await dbClient.query(bonusQuery, [bonusCode]);

    if (bonusResult.rows.length === 0) {
      console.log(`   ❌ Bonus not found: ${bonusCode}`);
      return res.status(404).json({ 
        error: `Bonus '${bonusCode}' not found` 
      });
    }

    const bonus = bonusResult.rows[0];
    console.log(`   ✓ Bonus found: ${bonus.bonus_description}`);

    // Step 2: Check if bonus is active
    if (!bonus.is_active) {
      console.log(`   ❌ FAIL: Bonus is not active`);
      return res.json({
        pass: false,
        reason: 'Bonus Not Active'
      });
    }
    console.log(`   ✓ Bonus is active`);

    // Step 3: Check date range
    const activityDate = new Date(activityData.activity_date);
    const startDate = new Date(bonus.start_date);
    const endDate = new Date(bonus.end_date);

    if (activityDate < startDate || activityDate > endDate) {
      console.log(`   ❌ FAIL: Activity date ${activityData.activity_date} outside range ${bonus.start_date} to ${bonus.end_date}`);
      return res.json({
        pass: false,
        reason: 'Date Range'
      });
    }
    console.log(`   ✓ Activity date within range`);

    // Step 4: Load rule criteria (if rule_id exists)
    if (!bonus.rule_id) {
      console.log(`   ✓ No criteria defined - PASS by default`);
      return res.json({ pass: true });
    }

    console.log(`   → Evaluating criteria for rule_id: ${bonus.rule_id}`);

    const criteriaQuery = `
      SELECT criteria_id, molecule_key, operator, value, label, joiner
      FROM rule_criteria
      WHERE rule_id = $1
      ORDER BY sort_order
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [bonus.rule_id]);

    if (criteriaResult.rows.length === 0) {
      console.log(`   ✓ No criteria found - PASS by default`);
      return res.json({ pass: true });
    }

    console.log(`   → Found ${criteriaResult.rows.length} criteria to evaluate`);

    // Step 5: Evaluate each criterion
    const failures = []; // Collect failures for OR logic
    let hasAnyPass = false;
    let hasOrJoiner = false; // Track if ANY criterion has OR joiner

    for (const criterion of criteriaResult.rows) {
      console.log(`   → Checking: ${criterion.label}`);

      // Check if this criterion has OR joiner
      if (criterion.joiner === 'OR') {
        hasOrJoiner = true;
      }

      // Get molecule definition
      const molDefQuery = `
        SELECT value_kind, scalar_type, lookup_table_key
        FROM molecule_def
        WHERE molecule_key = $1
      `;
      const molDefResult = await dbClient.query(molDefQuery, [criterion.molecule_key]);

      if (molDefResult.rows.length === 0) {
        console.log(`   ⚠ Molecule not found: ${criterion.molecule_key} - skipping`);
        continue;
      }

      const moleculeDef = molDefResult.rows[0];
      const criterionValue = criterion.value; // Already parsed from JSONB
      let criterionPassed = false;

      // Handle different molecule types
      if (moleculeDef.value_kind === 'lookup') {
        // LOOKUP TYPE: uses external table configuration
        console.log(`   → Lookup molecule: ${criterion.molecule_key}`);

        // Get lookup configuration from molecule_value_lookup
        const lookupConfigQuery = `
          SELECT 
            mvl.table_name,
            mvl.id_column,
            mvl.code_column,
            mvl.label_column
          FROM molecule_value_lookup mvl
          JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
          WHERE md.molecule_key = $1
        `;
        const lookupConfigResult = await dbClient.query(lookupConfigQuery, [criterion.molecule_key]);
        
        if (lookupConfigResult.rows.length === 0) {
          console.log(`   ⚠ Lookup config not found for molecule: ${criterion.molecule_key} - skipping`);
          failures.push(`${criterion.label} - Failed (config missing)`);
          continue;
        }
        
        const lookupConfig = lookupConfigResult.rows[0];
        const codeValue = criterionValue; // Already a string from JSONB
        
        console.log(`   → Looking up "${codeValue}" in ${lookupConfig.table_name} table`);
        
        // Build dynamic query using config
        const lookupQuery = `
          SELECT ${lookupConfig.id_column} as lookup_id
          FROM ${lookupConfig.table_name}
          WHERE ${lookupConfig.code_column} = $1
        `;
        
        const lookupResult = await dbClient.query(lookupQuery, [codeValue]);

        if (lookupResult.rows.length === 0) {
          console.log(`   ⚠ Code "${codeValue}" not found in ${lookupConfig.table_name}`);
          failures.push(`${criterion.label} - Failed`);
          continue;
        }

        const expectedId = lookupResult.rows[0].lookup_id;
        console.log(`   → Code "${codeValue}" = ID ${expectedId}`);

        const activityValue = activityData[criterion.molecule_key];
        console.log(`   → Activity has ${criterion.molecule_key}: "${activityValue}"`);
        
        // Simple comparison (assuming activityData has codes, not IDs)
        if (activityValue !== codeValue) {
          console.log(`   ❌ Criterion failed: ${criterion.label}`);
          failures.push(`${criterion.label} - Failed`);
        } else {
          console.log(`   ✓ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        }

      } else if (moleculeDef.value_kind === 'scalar') {
        // SCALAR TYPE: direct comparison
        console.log(`   → Scalar molecule: ${criterion.molecule_key}`);
        const criterionVal = criterionValue; // Already parsed from JSONB
        const activityVal = activityData[criterion.molecule_key];

        if (criterion.operator === 'equals' || criterion.operator === '=') {
          if (activityVal !== criterionVal) {
            console.log(`   ❌ Criterion failed: ${criterion.label}`);
            failures.push(`${criterion.label} - Failed`);
          } else {
            console.log(`   ✓ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          }
        }
        // TODO: Add other operators (>, <, >=, <=, etc.)

      } else if (moleculeDef.value_kind === 'list') {
        // LIST TYPE: check against valid options
        console.log(`   → List molecule: ${criterion.molecule_key}`);
        const criterionVal = criterionValue; // Already parsed from JSONB
        const activityVal = activityData[criterion.molecule_key];

        if (activityVal !== criterionVal) {
          console.log(`   ❌ Criterion failed: ${criterion.label}`);
          failures.push(`${criterion.label} - Failed`);
        } else {
          console.log(`   ✓ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        }
      }

      // Track failures for both AND and OR logic
      // We'll check at the end of the loop
      
      // For OR logic: continue evaluating all criteria
    }

    // After evaluating all criteria - check final result
    if (hasOrJoiner) {
      // OR logic: need at least one to pass
      if (hasAnyPass) {
        console.log(`   ✅ PASS: At least one criterion passed (OR logic)`);
        return res.json({ pass: true });
      } else {
        // All failed - return multi-line reason
        console.log(`   ❌ FAIL: All criteria failed (OR logic)`);
        const formattedFailures = failures.map((f, index) => {
          // Replace " - Failed" with ": Failed" and add indentation for subsequent lines
          const formatted = f.replace(' - Failed', ': Failed');
          return index === 0 ? formatted : `        ${formatted}`;
        });
        const reason = formattedFailures.join('\n');
        return res.json({
          pass: false,
          reason: reason
        });
      }
    } else {
      // AND logic (or no joiner): ALL must pass
      if (failures.length > 0) {
        console.log(`   ❌ FAIL: ${failures.length} criteria failed (AND logic)`);
        // Return ALL failures for better diagnostics
        const formattedFailures = failures.map((f, index) => {
          const formatted = f.replace(' - Failed', ': Failed');
          return index === 0 ? formatted : `        ${formatted}`;
        });
        const reason = formattedFailures.join('\n');
        return res.json({
          pass: false,
          reason: reason
        });
      }
    }

    // Step 6: All checks passed!
    console.log(`   ✅ PASS: All criteria passed!`);
    
    return res.json({
      pass: true
    });

  } catch (error) {
    console.error('Error in test-rule endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List all bonuses
app.get('/v1/bonuses', async (req, res) => {
  const tenantId = req.query.tenant_id;
  
  if (!dbClient) {
    return res.json([
      { bonus_id: 1, bonus_code: 'GOLD_10', bonus_description: 'Gold Tier 10% Uplift', bonus_type: 'percent', bonus_amount: 10, start_date: '2025-01-01', end_date: null, is_active: true },
      { bonus_id: 2, bonus_code: 'DBL_TUES', bonus_description: 'Double Miles Tuesday', bonus_type: 'percent', bonus_amount: 100, start_date: '2025-01-01', end_date: '2025-12-31', is_active: true },
      { bonus_id: 3, bonus_code: 'WELCOME', bonus_description: 'Welcome Bonus', bonus_type: 'fixed', bonus_amount: 500, start_date: '2025-01-01', end_date: '2025-03-31', is_active: true }
    ]);
  }
  
  try {
    let query = `
      SELECT 
        bonus_id,
        bonus_code,
        bonus_description,
        bonus_type,
        bonus_amount,
        start_date,
        end_date,
        is_active
      FROM bonus
    `;
    
    const params = [];
    
    // Filter by tenant_id if provided
    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }
    
    query += ` ORDER BY bonus_code ASC`;

    const result = await dbClient.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bonuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update bonus
app.post('/v1/bonuses', async (req, res) => {
  console.log('=== POST /v1/bonuses called ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected - cannot save bonuses' });
  }
  
  try {
    const { bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active, tenant_id } = req.body;
    console.log('Extracted values:', { bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active, tenant_id });
    
    // Validation
    if (!bonus_code || !bonus_description || !bonus_type || !bonus_amount || !start_date) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!tenant_id) {
      console.log('Validation failed - missing tenant_id');
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    console.log('Validation passed, checking if bonus exists...');
    
    // Check if bonus already exists
    const checkQuery = 'SELECT bonus_id FROM bonus WHERE bonus_code = $1';
    const existing = await dbClient.query(checkQuery, [bonus_code]);
    console.log('Existing bonus check result:', existing.rows.length > 0 ? 'FOUND - will UPDATE' : 'NOT FOUND - will INSERT');
    
    if (existing.rows.length > 0) {
      // UPDATE existing bonus
      console.log('Updating existing bonus:', bonus_code);
      const updateQuery = `
        UPDATE bonus 
        SET bonus_description = $1,
            bonus_type = $2,
            bonus_amount = $3,
            start_date = $4,
            end_date = $5,
            is_active = $6,
            tenant_id = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE bonus_code = $8
        RETURNING *
      `;
      const updateParams = [
        bonus_description,
        bonus_type,
        bonus_amount,
        start_date,
        end_date || null,
        is_active !== false,
        tenant_id,
        bonus_code
      ];
      console.log('Update params:', updateParams);
      const result = await dbClient.query(updateQuery, updateParams);
      console.log('Update successful, rows returned:', result.rows.length);
      res.json({ message: 'Bonus updated', bonus: result.rows[0] });
    } else {
      // INSERT new bonus
      console.log('Inserting new bonus:', bonus_code);
      const insertQuery = `
        INSERT INTO bonus (bonus_code, bonus_description, bonus_type, bonus_amount, start_date, end_date, is_active, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const insertParams = [
        bonus_code,
        bonus_description,
        bonus_type,
        bonus_amount,
        start_date,
        end_date || null,
        is_active !== false,
        tenant_id
      ];
      console.log('Insert params:', insertParams);
      const result = await dbClient.query(insertQuery, insertParams);
      console.log('Insert successful, rows returned:', result.rows.length);
      console.log('New bonus:', result.rows[0]);
      res.json({ message: 'Bonus created', bonus: result.rows[0] });
    }
  } catch (error) {
    console.error('=== ERROR in POST /v1/bonuses ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete bonus
app.delete('/v1/bonuses/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const bonusId = parseInt(req.params.id);
    const query = 'DELETE FROM bonus WHERE bonus_id = $1';
    await dbClient.query(query, [bonusId]);
    res.json({ message: 'Bonus deleted' });
  } catch (error) {
    console.error('Error deleting bonus:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CRITERIA ENDPOINTS
// ============================================================

// GET - Get all criteria for a bonus
app.get('/v1/bonuses/:bonusId/criteria', async (req, res) => {
  if (!dbClient) {
    return res.json([]);
  }
  
  try {
    const bonusId = parseInt(req.params.bonusId);
    
    // Get the rule_id for this bonus
    const bonusQuery = 'SELECT rule_id FROM bonus WHERE bonus_id = $1';
    const bonusResult = await dbClient.query(bonusQuery, [bonusId]);
    
    if (bonusResult.rows.length === 0 || !bonusResult.rows[0].rule_id) {
      return res.json([]);
    }
    
    const ruleId = bonusResult.rows[0].rule_id;
    
    // Get all criteria for this rule
    const criteriaQuery = `
      SELECT 
        rc.criteria_id,
        rc.rule_id,
        rc.molecule_key,
        rc.operator,
        rc.value,
        rc.label,
        rc.joiner,
        rc.sort_order,
        md.value_kind,
        md.lookup_table_key
      FROM rule_criteria rc
      LEFT JOIN molecule_def md ON rc.molecule_key = md.molecule_key
      WHERE rc.rule_id = $1
      ORDER BY rc.sort_order
    `;
    
    const result = await dbClient.query(criteriaQuery, [ruleId]);
    
    // Transform to include source (Activity or Member)
    const criteria = result.rows.map(row => {
      // Determine source based on molecule
      const activityMolecules = ['carrier', 'origin', 'destination', 'fare_class', 'flight_number'];
      const source = activityMolecules.includes(row.molecule_key.toLowerCase()) ? 'Activity' : 'Member';
      
      // Capitalize molecule for display
      const molecule = row.molecule_key.charAt(0).toUpperCase() + row.molecule_key.slice(1);
      
      return {
        id: row.criteria_id,
        source,
        molecule,
        molecule_key: row.molecule_key,
        operator: row.operator,
        value: row.value,
        label: row.label,
        joiner: row.joiner,
        sort_order: row.sort_order
      };
    });
    
    res.json(criteria);
  } catch (error) {
    console.error('Error fetching criteria:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Add new criterion to a bonus
app.post('/v1/bonuses/:bonusId/criteria', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const bonusId = parseInt(req.params.bonusId);
    const { source, molecule, operator, value, label } = req.body;
    
    // Validation
    if (!source || !molecule || !operator || !value || !label) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Convert molecule to molecule_key (lowercase with underscores)
    const molecule_key = molecule.toLowerCase().replace(/\s+/g, '_');
    
    // Get or create rule for this bonus
    const bonusQuery = 'SELECT rule_id FROM bonus WHERE bonus_id = $1';
    const bonusResult = await dbClient.query(bonusQuery, [bonusId]);
    
    if (bonusResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bonus not found' });
    }
    
    let ruleId = bonusResult.rows[0].rule_id;
    
    // If no rule exists, create one
    if (!ruleId) {
      const createRuleQuery = `
        INSERT INTO rule DEFAULT VALUES
        RETURNING rule_id
      `;
      const ruleResult = await dbClient.query(createRuleQuery);
      ruleId = ruleResult.rows[0].rule_id;
      
      // Link rule to bonus
      const updateBonusQuery = 'UPDATE bonus SET rule_id = $1 WHERE bonus_id = $2';
      await dbClient.query(updateBonusQuery, [ruleId, bonusId]);
    }
    
    // Get current max sort_order
    const maxSortQuery = 'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM rule_criteria WHERE rule_id = $1';
    const maxSortResult = await dbClient.query(maxSortQuery, [ruleId]);
    const nextSortOrder = maxSortResult.rows[0].max_sort + 1;
    
    // Update previous last criterion to have joiner = 'AND' (if exists)
    if (nextSortOrder > 1) {
      const updateJoinerQuery = `
        UPDATE rule_criteria 
        SET joiner = 'AND' 
        WHERE rule_id = $1 
        AND sort_order = $2
        AND joiner IS NULL
      `;
      await dbClient.query(updateJoinerQuery, [ruleId, nextSortOrder - 1]);
    }
    
    // Insert new criterion
    const insertQuery = `
      INSERT INTO rule_criteria (rule_id, molecule_key, operator, value, label, joiner, sort_order)
      VALUES ($1, $2, $3, $4::jsonb, $5, NULL, $6)
      RETURNING criteria_id
    `;
    
    const result = await dbClient.query(insertQuery, [
      ruleId,
      molecule_key,
      operator,
      JSON.stringify(value),
      label,
      nextSortOrder
    ]);
    
    res.json({ 
      message: 'Criterion added',
      criteria_id: result.rows[0].criteria_id,
      id: result.rows[0].criteria_id,
      source,
      molecule,
      molecule_key,
      operator,
      value,
      label,
      joiner: null,
      sort_order: nextSortOrder
    });
  } catch (error) {
    console.error('Error adding criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update existing criterion
app.put('/v1/bonuses/:bonusId/criteria/:criteriaId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const criteriaId = parseInt(req.params.criteriaId);
    const { source, molecule, operator, value, label } = req.body;
    
    // Validation
    if (!source || !molecule || !operator || !value || !label) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Convert molecule to molecule_key
    const molecule_key = molecule.toLowerCase().replace(/\s+/g, '_');
    
    // Update criterion
    const updateQuery = `
      UPDATE rule_criteria
      SET molecule_key = $1,
          operator = $2,
          value = $3::jsonb,
          label = $4
      WHERE criteria_id = $5
      RETURNING *
    `;
    
    const result = await dbClient.query(updateQuery, [
      molecule_key,
      operator,
      JSON.stringify(value),
      label,
      criteriaId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Criterion not found' });
    }
    
    res.json({ 
      message: 'Criterion updated',
      id: criteriaId,
      source,
      molecule,
      molecule_key,
      operator,
      value,
      label
    });
  } catch (error) {
    console.error('Error updating criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update joiner for a criterion
app.put('/v1/bonuses/:bonusId/criteria/:criteriaId/joiner', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const criteriaId = parseInt(req.params.criteriaId);
    const { joiner } = req.body;
    
    if (!['AND', 'OR'].includes(joiner)) {
      return res.status(400).json({ error: 'Joiner must be AND or OR' });
    }
    
    const updateQuery = 'UPDATE rule_criteria SET joiner = $1 WHERE criteria_id = $2';
    await dbClient.query(updateQuery, [joiner, criteriaId]);
    
    res.json({ message: 'Joiner updated' });
  } catch (error) {
    console.error('Error updating joiner:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete criterion
app.delete('/v1/bonuses/:bonusId/criteria/:criteriaId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const bonusId = parseInt(req.params.bonusId);
    const criteriaId = parseInt(req.params.criteriaId);
    
    // Get rule_id for this bonus
    const bonusQuery = 'SELECT rule_id FROM bonus WHERE bonus_id = $1';
    const bonusResult = await dbClient.query(bonusQuery, [bonusId]);
    
    if (bonusResult.rows.length === 0 || !bonusResult.rows[0].rule_id) {
      return res.status(404).json({ error: 'Bonus or rule not found' });
    }
    
    const ruleId = bonusResult.rows[0].rule_id;
    
    // Delete the criterion
    const deleteQuery = 'DELETE FROM rule_criteria WHERE criteria_id = $1 AND rule_id = $2';
    await dbClient.query(deleteQuery, [criteriaId, ruleId]);
    
    // Get remaining criteria
    const remainingQuery = `
      SELECT criteria_id 
      FROM rule_criteria 
      WHERE rule_id = $1 
      ORDER BY sort_order DESC 
      LIMIT 1
    `;
    const remainingResult = await dbClient.query(remainingQuery, [ruleId]);
    
    // Update last criterion to have NULL joiner
    if (remainingResult.rows.length > 0) {
      const updateJoinerQuery = 'UPDATE rule_criteria SET joiner = NULL WHERE criteria_id = $1';
      await dbClient.query(updateJoinerQuery, [remainingResult.rows[0].criteria_id]);
    }
    
    res.json({ message: 'Criterion deleted' });
  } catch (error) {
    console.error('Error deleting criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update tier
app.post('/v1/tiers', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected - cannot save tiers' });
  }
  
  try {
    const { tier_code, tier_description, tier_ranking, is_active } = req.body;
    
    // Validation
    if (!tier_code || !tier_description || !tier_ranking) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if tier already exists
    const checkQuery = 'SELECT tier_id FROM tier_definition WHERE tier_code = $1';
    const existing = await dbClient.query(checkQuery, [tier_code]);
    
    if (existing.rows.length > 0) {
      // UPDATE existing tier
      const updateQuery = `
        UPDATE tier_definition 
        SET tier_description = $1,
            tier_ranking = $2,
            is_active = $3
        WHERE tier_code = $4
        RETURNING *
      `;
      const result = await dbClient.query(updateQuery, [
        tier_description,
        tier_ranking,
        is_active !== false,
        tier_code
      ]);
      res.json({ message: 'Tier updated', tier: result.rows[0] });
    } else {
      // INSERT new tier
      const insertQuery = `
        INSERT INTO tier_definition (tier_code, tier_description, tier_ranking, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await dbClient.query(insertQuery, [
        tier_code,
        tier_description,
        tier_ranking,
        is_active !== false
      ]);
      res.json({ message: 'Tier created', tier: result.rows[0] });
    }
  } catch (error) {
    console.error('Error saving tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete tier
app.delete('/v1/tiers/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const tierId = parseInt(req.params.id);
    const query = 'DELETE FROM tier_definition WHERE tier_id = $1';
    await dbClient.query(query, [tierId]);
    res.json({ message: 'Tier deleted' });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update airport
app.post('/v1/airports', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected - cannot save airports' });
  }
  
  try {
    const { code, name, city, country, is_active } = req.body;
    
    // Validation
    if (!code || !name || !city || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (code.length !== 3) {
      return res.status(400).json({ error: 'Airport code must be exactly 3 characters' });
    }
    
    // Check if airport already exists
    const checkQuery = 'SELECT airport_id FROM airports WHERE code = $1';
    const existing = await dbClient.query(checkQuery, [code]);
    
    if (existing.rows.length > 0) {
      // UPDATE existing airport
      const updateQuery = `
        UPDATE airports 
        SET name = $1,
            city = $2,
            country = $3,
            is_active = $4
        WHERE code = $5
        RETURNING *
      `;
      const result = await dbClient.query(updateQuery, [
        name,
        city,
        country,
        is_active !== false,
        code
      ]);
      res.json({ message: 'Airport updated', airport: result.rows[0] });
    } else {
      // INSERT new airport
      const insertQuery = `
        INSERT INTO airports (code, name, city, country, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await dbClient.query(insertQuery, [
        code,
        name,
        city,
        country,
        is_active !== false
      ]);
      res.json({ message: 'Airport created', airport: result.rows[0] });
    }
  } catch (error) {
    console.error('Error saving airport:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete airport
app.delete('/v1/airports/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const airportId = parseInt(req.params.id);
    const query = 'DELETE FROM airports WHERE airport_id = $1';
    await dbClient.query(query, [airportId]);
    res.json({ message: 'Airport deleted' });
  } catch (error) {
    console.error('Error deleting airport:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MOLECULES - Program Configuration System
// ============================================================================

// GET - List all molecules for a tenant
app.get('/v1/molecules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id, context } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    let query = `
      SELECT 
        molecule_id,
        tenant_id,
        molecule_key,
        label,
        context,
        value_kind,
        scalar_type,
        lookup_table_key,
        is_static,
        is_permanent,
        is_required,
        description,
        display_order
      FROM molecule_def
      WHERE tenant_id = $1
    `;
    
    const params = [tenant_id];
    
    // Optional context filter
    if (context) {
      query += ' AND context = $2';
      params.push(context);
    }
    
    query += ' ORDER BY display_order, molecule_key';
    
    const result = await dbClient.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching molecules:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MOLECULE ENCODE/DECODE FUNCTIONS
// ============================================================================
// Universal abstraction layer for molecule value transformation
// Handles: lookup, list, scalar (text/numeric/date/boolean)
// ============================================================================

/**
 * encodeMolecule - Convert human value to storage integer
 * @param {number} tenantId - Tenant ID
 * @param {string} moleculeKey - Molecule key (e.g., 'origin', 'fare_class')
 * @param {any} value - Human value (e.g., 'MSP', 'C', 1247)
 * @returns {Promise<number>} - Integer ID to store in child record
 */
async function encodeMolecule(tenantId, moleculeKey, value) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }

  // 1. Look up molecule definition
  const molQuery = `
    SELECT 
      molecule_id,
      value_kind,
      scalar_type,
      lookup_table_key,
      decimal_places
    FROM molecule_def
    WHERE tenant_id = $1 AND molecule_key = $2
  `;
  
  const molResult = await dbClient.query(molQuery, [tenantId, moleculeKey]);
  
  if (molResult.rows.length === 0) {
    throw new Error(`Molecule '${moleculeKey}' not found for tenant ${tenantId}`);
  }
  
  const mol = molResult.rows[0];
  
  // 2. Handle based on value_kind
  
  // LOOKUP - Query foreign table using metadata from molecule_value_lookup
  if (mol.value_kind === 'lookup') {
    // Read metadata from molecule_value_lookup (data-driven approach)
    const metadataQuery = `
      SELECT table_name, id_column, code_column, is_tenant_specific
      FROM molecule_value_lookup
      WHERE molecule_id = $1
    `;
    
    const metadataResult = await dbClient.query(metadataQuery, [mol.molecule_id]);
    
    if (metadataResult.rows.length === 0) {
      throw new Error(`No lookup metadata found for molecule '${moleculeKey}'`);
    }
    
    const metadata = metadataResult.rows[0];
    
    // Dynamically query the lookup table using metadata
    // Only filter by tenant_id if table is tenant-specific
    let lookupQuery, queryParams;
    
    if (metadata.is_tenant_specific) {
      lookupQuery = `
        SELECT ${metadata.id_column} as id
        FROM ${metadata.table_name}
        WHERE ${metadata.code_column} = $1 AND tenant_id = $2
      `;
      queryParams = [value, tenantId];
    } else {
      lookupQuery = `
        SELECT ${metadata.id_column} as id
        FROM ${metadata.table_name}
        WHERE ${metadata.code_column} = $1
      `;
      queryParams = [value];
    }
    
    const lookupResult = await dbClient.query(lookupQuery, queryParams);
    
    if (lookupResult.rows.length === 0) {
      throw new Error(`Value '${value}' not found in ${metadata.table_name}`);
    }
    
    return lookupResult.rows[0].id;
  }
  
  // LIST - Query molecule_value_text
  if (mol.value_kind === 'list') {
    const listQuery = `
      SELECT value_id
      FROM molecule_value_text
      WHERE molecule_id = $1 AND text_value = $2
    `;
    
    const listResult = await dbClient.query(listQuery, [mol.molecule_id, value]);
    
    if (listResult.rows.length === 0) {
      throw new Error(`Value '${value}' not found in list for molecule '${moleculeKey}'`);
    }
    
    return listResult.rows[0].value_id;
  }
  
  // SCALAR - Handle by scalar_type
  if (mol.value_kind === 'scalar') {
    
    // SCALAR TEXT - Use text pool with deduplication
    if (mol.scalar_type === 'text') {
      // Check if text already exists
      const checkQuery = `
        SELECT text_id
        FROM molecule_text_pool
        WHERE text_value = $1
      `;
      
      const checkResult = await dbClient.query(checkQuery, [value]);
      
      if (checkResult.rows.length > 0) {
        // Text exists - increment usage count
        const textId = checkResult.rows[0].text_id;
        
        await dbClient.query(`
          UPDATE molecule_text_pool
          SET usage_count = usage_count + 1
          WHERE text_id = $1
        `, [textId]);
        
        return textId;
      } else {
        // Text doesn't exist - insert new
        const insertQuery = `
          INSERT INTO molecule_text_pool (text_value, usage_count)
          VALUES ($1, 1)
          RETURNING text_id
        `;
        
        const insertResult = await dbClient.query(insertQuery, [value]);
        return insertResult.rows[0].text_id;
      }
    }
    
    // SCALAR NUMERIC - Return as-is (it's already a number)
    if (mol.scalar_type === 'numeric') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Value '${value}' is not a valid number for molecule '${moleculeKey}'`);
      }
      return numValue;
    }
    
    // SCALAR DATE - Not implemented yet
    if (mol.scalar_type === 'date') {
      throw new Error(`Date encoding not yet implemented for molecule '${moleculeKey}'`);
    }
    
    // SCALAR BOOLEAN - Not implemented yet
    if (mol.scalar_type === 'boolean') {
      throw new Error(`Boolean encoding not yet implemented for molecule '${moleculeKey}'`);
    }
    
    throw new Error(`Unknown scalar_type '${mol.scalar_type}' for molecule '${moleculeKey}'`);
  }
  
  throw new Error(`Unknown value_kind '${mol.value_kind}' for molecule '${moleculeKey}'`);
}

/**
 * decodeMolecule - Convert storage integer to human value
 * @param {number} tenantId - Tenant ID
 * @param {string} moleculeKey - Molecule key (e.g., 'origin', 'fare_class')
 * @param {number} id - Integer ID from child record
 * @returns {Promise<string|number>} - Human-readable value
 */
async function decodeMolecule(tenantId, moleculeKey, id) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }

  // 1. Look up molecule definition
  const molQuery = `
    SELECT 
      molecule_id,
      value_kind,
      scalar_type,
      lookup_table_key,
      decimal_places
    FROM molecule_def
    WHERE tenant_id = $1 AND molecule_key = $2
  `;
  
  const molResult = await dbClient.query(molQuery, [tenantId, moleculeKey]);
  
  if (molResult.rows.length === 0) {
    throw new Error(`Molecule '${moleculeKey}' not found for tenant ${tenantId}`);
  }
  
  const mol = molResult.rows[0];
  
  // 2. Handle based on value_kind
  
  // LOOKUP - Query foreign table using metadata from molecule_value_lookup
  if (mol.value_kind === 'lookup') {
    // Read metadata from molecule_value_lookup (data-driven approach)
    const metadataQuery = `
      SELECT table_name, id_column, code_column, is_tenant_specific
      FROM molecule_value_lookup
      WHERE molecule_id = $1
    `;
    
    const metadataResult = await dbClient.query(metadataQuery, [mol.molecule_id]);
    
    if (metadataResult.rows.length === 0) {
      throw new Error(`No lookup metadata found for molecule '${moleculeKey}'`);
    }
    
    const metadata = metadataResult.rows[0];
    
    // Dynamically query the lookup table using metadata
    // Only filter by tenant_id if table is tenant-specific
    let lookupQuery, queryParams;
    
    if (metadata.is_tenant_specific) {
      lookupQuery = `
        SELECT ${metadata.code_column} as code
        FROM ${metadata.table_name}
        WHERE ${metadata.id_column} = $1 AND tenant_id = $2
      `;
      queryParams = [id, tenantId];
    } else {
      lookupQuery = `
        SELECT ${metadata.code_column} as code
        FROM ${metadata.table_name}
        WHERE ${metadata.id_column} = $1
      `;
      queryParams = [id];
    }
    
    const lookupResult = await dbClient.query(lookupQuery, queryParams);
    
    if (lookupResult.rows.length === 0) {
      throw new Error(`ID ${id} not found in ${metadata.table_name}`);
    }
    
    return lookupResult.rows[0].code;
  }
  
  // LIST - Query molecule_value_text
  if (mol.value_kind === 'list') {
    const listQuery = `
      SELECT text_value
      FROM molecule_value_text
      WHERE molecule_id = $1 AND value_id = $2
    `;
    
    const listResult = await dbClient.query(listQuery, [mol.molecule_id, id]);
    
    if (listResult.rows.length === 0) {
      throw new Error(`Value ID ${id} not found in list for molecule '${moleculeKey}'`);
    }
    
    return listResult.rows[0].text_value;
  }
  
  // SCALAR - Handle by scalar_type
  if (mol.value_kind === 'scalar') {
    
    // SCALAR TEXT - Query text pool
    if (mol.scalar_type === 'text') {
      const textQuery = `
        SELECT text_value
        FROM molecule_text_pool
        WHERE text_id = $1
      `;
      
      const textResult = await dbClient.query(textQuery, [id]);
      
      if (textResult.rows.length === 0) {
        throw new Error(`Text ID ${id} not found in text pool`);
      }
      
      return textResult.rows[0].text_value;
    }
    
    // SCALAR NUMERIC - Return as-is (it's already stored as a number)
    if (mol.scalar_type === 'numeric') {
      return id; // The ID IS the value for numeric scalars
    }
    
    // SCALAR DATE - Not implemented yet
    if (mol.scalar_type === 'date') {
      throw new Error(`Date decoding not yet implemented for molecule '${moleculeKey}'`);
    }
    
    // SCALAR BOOLEAN - Not implemented yet
    if (mol.scalar_type === 'boolean') {
      throw new Error(`Boolean decoding not yet implemented for molecule '${moleculeKey}'`);
    }
    
    throw new Error(`Unknown scalar_type '${mol.scalar_type}' for molecule '${moleculeKey}'`);
  }
  
  throw new Error(`Unknown value_kind '${mol.value_kind}' for molecule '${moleculeKey}'`);
}

// ============================================================================
// TEST ENDPOINTS
// ============================================================================

// GET /v1/molecules/encode - Test encode function
app.get('/v1/molecules/encode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id, key, value } = req.query;
    
    if (!tenant_id || !key || value === undefined) {
      return res.status(400).json({ 
        error: 'tenant_id, key, and value are required',
        example: '/v1/molecules/encode?tenant_id=1&key=origin&value=MSP'
      });
    }
    
    const id = await encodeMolecule(Number(tenant_id), key, value);
    
    res.json({ 
      molecule_key: key,
      input_value: value,
      encoded_id: id
    });
    
  } catch (error) {
    console.error('Error encoding molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/molecules/decode - Test decode function
app.get('/v1/molecules/decode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id, key, id } = req.query;
    
    if (!tenant_id || !key || id === undefined) {
      return res.status(400).json({ 
        error: 'tenant_id, key, and id are required',
        example: '/v1/molecules/decode?tenant_id=1&key=origin&id=17'
      });
    }
    
    const value = await decodeMolecule(Number(tenant_id), key, Number(id));
    
    res.json({ 
      molecule_key: key,
      input_id: Number(id),
      decoded_value: value
    });
    
  } catch (error) {
    console.error('Error decoding molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get molecule by ID
app.get('/v1/molecules/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        molecule_id,
        tenant_id,
        molecule_key,
        label,
        context,
        value_kind,
        scalar_type,
        lookup_table_key,
        is_static,
        is_permanent,
        is_required,
        description,
        display_order
      FROM molecule_def
      WHERE molecule_id = $1
    `;
    
    const result = await dbClient.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new molecule
app.post('/v1/molecules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { 
      molecule_key, 
      label, 
      context, 
      value_kind, 
      scalar_type, 
      lookup_table_key,
      description,
      sample_code,
      sample_description,
      is_static, 
      is_permanent,
      is_required,
      display_order,
      tenant_id 
    } = req.body;
    
    // Validate required fields
    if (!molecule_key || !label || !context || !value_kind || !tenant_id) {
      return res.status(400).json({ error: 'Missing required fields: molecule_key, label, context, value_kind, tenant_id' });
    }
    
    // Check if molecule_key already exists for this tenant
    const checkQuery = `
      SELECT molecule_id 
      FROM molecule_def 
      WHERE molecule_key = $1 AND tenant_id = $2
    `;
    const checkResult = await dbClient.query(checkQuery, [molecule_key, tenant_id]);
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: `Molecule key '${molecule_key}' already exists for this tenant` });
    }
    
    // Insert new molecule
    const insertQuery = `
      INSERT INTO molecule_def (
        molecule_key,
        label,
        context,
        value_kind,
        scalar_type,
        lookup_table_key,
        description,
        sample_code,
        sample_description,
        is_static,
        is_permanent,
        is_required,
        display_order,
        tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const result = await dbClient.query(insertQuery, [
      molecule_key,
      label,
      context,
      value_kind,
      scalar_type || null,
      lookup_table_key || null,
      description || null,
      sample_code || null,
      sample_description || null,
      is_static || false,
      is_permanent || false,
      is_required || false,
      display_order || 0,
      tenant_id
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update molecule definition
app.put('/v1/molecules/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { molecule_key, label, context, value_kind, scalar_type, is_static, is_permanent, description, sample_code, sample_description } = req.body;
    
    // Build update query for editable fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (molecule_key !== undefined) {
      updates.push(`molecule_key = $${paramCount++}`);
      values.push(molecule_key);
    }
    
    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    
    if (context !== undefined) {
      updates.push(`context = $${paramCount++}`);
      values.push(context);
    }
    
    if (value_kind !== undefined) {
      updates.push(`value_kind = $${paramCount++}`);
      values.push(value_kind);
    }
    
    if (scalar_type !== undefined) {
      updates.push(`scalar_type = $${paramCount++}`);
      values.push(scalar_type);
    }
    
    if (is_static !== undefined) {
      updates.push(`is_static = $${paramCount++}`);
      values.push(is_static);
    }
    
    if (is_permanent !== undefined) {
      updates.push(`is_permanent = $${paramCount++}`);
      values.push(is_permanent);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (sample_code !== undefined) {
      updates.push(`sample_code = $${paramCount++}`);
      values.push(sample_code);
    }
    
    if (sample_description !== undefined) {
      updates.push(`sample_description = $${paramCount++}`);
      values.push(sample_description);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const query = `
      UPDATE molecule_def 
      SET ${updates.join(', ')}
      WHERE molecule_id = $${paramCount}
      RETURNING *
    `;
    
    const result = await dbClient.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get molecule value (for static molecules)
app.get('/v1/molecules/:id/value', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // First get the molecule definition
    const defQuery = `
      SELECT molecule_id, value_kind, scalar_type, is_static
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const molecule = defResult.rows[0];
    
    if (!molecule.is_static) {
      return res.status(400).json({ error: 'Only static molecules have stored values' });
    }
    
    if (molecule.value_kind !== 'scalar') {
      return res.status(400).json({ error: 'Use /values endpoint for list molecules' });
    }
    
    // Get the value from the appropriate table
    // Note: value tables don't have tenant_id - tenant isolation is via molecule_def
    let valueQuery;
    let valueField;
    
    switch (molecule.scalar_type) {
      case 'text':
        valueQuery = 'SELECT text_value as value FROM molecule_value_text WHERE molecule_id = $1';
        break;
      case 'numeric':
        valueQuery = 'SELECT numeric_value as value FROM molecule_value_numeric WHERE molecule_id = $1';
        break;
      case 'date':
        valueQuery = 'SELECT date_value as value FROM molecule_value_date WHERE molecule_id = $1';
        break;
      case 'boolean':
        valueQuery = 'SELECT bool_value as value FROM molecule_value_boolean WHERE molecule_id = $1';
        break;
      default:
        return res.status(400).json({ error: 'Invalid scalar type' });
    }
    
    const valueResult = await dbClient.query(valueQuery, [id]);
    
    if (valueResult.rows.length === 0) {
      return res.json({ value: null });
    }
    
    res.json({ value: valueResult.rows[0].value });
  } catch (error) {
    console.error('Error fetching molecule value:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update molecule value (for static scalar molecules)
app.put('/v1/molecules/:id/value', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id, value } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value required' });
    }
    
    // First get the molecule definition
    const defQuery = `
      SELECT molecule_id, value_kind, scalar_type, is_static
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const molecule = defResult.rows[0];
    
    if (!molecule.is_static) {
      return res.status(400).json({ error: 'Only static molecules have stored values' });
    }
    
    if (molecule.value_kind !== 'scalar') {
      return res.status(400).json({ error: 'Use /values endpoint for list molecules' });
    }
    
    // Update the value in the appropriate table
    // Note: value tables don't have tenant_id - tenant isolation is via molecule_def
    let updateQuery;
    let checkQuery;
    let insertQuery;
    
    switch (molecule.scalar_type) {
      case 'text':
        checkQuery = 'SELECT 1 FROM molecule_value_text WHERE molecule_id = $1';
        insertQuery = 'INSERT INTO molecule_value_text (molecule_id, text_value) VALUES ($1, $2)';
        updateQuery = 'UPDATE molecule_value_text SET text_value = $2 WHERE molecule_id = $1';
        break;
      case 'numeric':
        checkQuery = 'SELECT 1 FROM molecule_value_numeric WHERE molecule_id = $1';
        insertQuery = 'INSERT INTO molecule_value_numeric (molecule_id, numeric_value) VALUES ($1, $2)';
        updateQuery = 'UPDATE molecule_value_numeric SET numeric_value = $2 WHERE molecule_id = $1';
        break;
      case 'date':
        checkQuery = 'SELECT 1 FROM molecule_value_date WHERE molecule_id = $1';
        insertQuery = 'INSERT INTO molecule_value_date (molecule_id, date_value) VALUES ($1, $2)';
        updateQuery = 'UPDATE molecule_value_date SET date_value = $2 WHERE molecule_id = $1';
        break;
      case 'boolean':
        checkQuery = 'SELECT 1 FROM molecule_value_boolean WHERE molecule_id = $1';
        insertQuery = 'INSERT INTO molecule_value_boolean (molecule_id, bool_value) VALUES ($1, $2)';
        updateQuery = 'UPDATE molecule_value_boolean SET bool_value = $2 WHERE molecule_id = $1';
        break;
      default:
        return res.status(400).json({ error: 'Invalid scalar type' });
    }
    
    // Check if value exists
    const checkResult = await dbClient.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      // Insert new value
      await dbClient.query(insertQuery, [id, value]);
    } else {
      // Update existing value
      await dbClient.query(updateQuery, [id, value]);
    }
    
    res.json({ success: true, value });
  } catch (error) {
    console.error('Error updating molecule value:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get list values for a list-type molecule
app.get('/v1/molecules/:id/values', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // First verify this is a list molecule
    const defQuery = `
      SELECT value_kind, scalar_type
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'list') {
      return res.status(400).json({ error: 'This endpoint is only for list molecules' });
    }
    
    // Get the list values
    // Note: value tables don't have tenant_id - tenant isolation is via molecule_def
    const valueQuery = `
      SELECT 
        value_id,
        text_value as value,
        display_label as label,
        sort_order
      FROM molecule_value_text
      WHERE molecule_id = $1
      ORDER BY sort_order, text_value
    `;
    
    const result = await dbClient.query(valueQuery, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching list values:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get lookup configuration for a lookup-type molecule
app.get('/v1/molecules/:id/lookup-config', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // First verify this is a lookup molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'lookup') {
      return res.status(400).json({ error: 'This endpoint is only for lookup molecules' });
    }
    
    // Get the lookup configuration
    const configQuery = `
      SELECT 
        table_name,
        id_column,
        code_column,
        label_column,
        maintenance_page,
        maintenance_description,
        is_tenant_specific
      FROM molecule_value_lookup
      WHERE molecule_id = $1
    `;
    
    const result = await dbClient.query(configQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lookup configuration not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lookup config:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update molecule lookup configuration
app.put('/v1/molecules/:id/lookup-config', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id, is_tenant_specific } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    if (is_tenant_specific === undefined) {
      return res.status(400).json({ error: 'is_tenant_specific required' });
    }
    
    // First verify this is a lookup molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'lookup') {
      return res.status(400).json({ error: 'This endpoint is only for lookup molecules' });
    }
    
    // Update the lookup configuration
    const updateQuery = `
      UPDATE molecule_value_lookup
      SET is_tenant_specific = $1,
          updated_at = now()
      WHERE molecule_id = $2
      RETURNING *
    `;
    
    const result = await dbClient.query(updateQuery, [is_tenant_specific, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lookup configuration not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Lookup configuration updated',
      config: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating lookup config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get values from external table for a lookup molecule
// CRITICAL: This is core infrastructure that makes molecules truly flexible
// Allows any lookup molecule to work without custom endpoints
app.get('/v1/lookup-values/:molecule_key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { molecule_key } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Get molecule definition and lookup configuration
    const configQuery = `
      SELECT 
        md.molecule_id,
        md.value_kind,
        mvl.table_name,
        mvl.id_column,
        mvl.code_column,
        mvl.label_column
      FROM molecule_def md
      LEFT JOIN molecule_value_lookup mvl ON md.molecule_id = mvl.molecule_id
      WHERE md.molecule_key = $1 AND md.tenant_id = $2
    `;
    
    const configResult = await dbClient.query(configQuery, [molecule_key, tenant_id]);
    
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const config = configResult.rows[0];
    
    // Verify it's a lookup molecule
    if (config.value_kind !== 'lookup') {
      return res.status(400).json({ 
        error: 'This endpoint is only for lookup molecules',
        hint: 'Use GET /v1/molecules/:id/values for list molecules'
      });
    }
    
    // Verify lookup config exists
    if (!config.table_name || !config.code_column || !config.label_column) {
      return res.status(500).json({ 
        error: 'Lookup configuration incomplete',
        hint: 'Add configuration to molecule_value_lookup table'
      });
    }
    
    // Validate table exists (security check)
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as table_exists
    `;
    const tableCheck = await dbClient.query(tableCheckQuery, [config.table_name]);
    
    if (!tableCheck.rows[0].table_exists) {
      return res.status(500).json({ 
        error: `Table '${config.table_name}' does not exist`,
        hint: 'Check molecule_value_lookup configuration'
      });
    }
    
    // Build dynamic query using configuration
    // NOTE: Table/column names from trusted source (molecule_value_lookup)
    // Still using parameterized query for WHERE clause
    const valuesQuery = `
      SELECT 
        ${config.id_column} as id,
        ${config.code_column} as code,
        ${config.label_column} as name
      FROM ${config.table_name}
      WHERE is_active = true
      ORDER BY ${config.code_column}
      LIMIT 1000
    `;
    
    console.log(`[lookup-values] Loading ${molecule_key} from ${config.table_name}`);
    const result = await dbClient.query(valuesQuery);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lookup values:', error);
    res.status(500).json({ 
      error: error.message,
      hint: 'Check server logs for details'
    });
  }
});

// POST - Add a new list value
app.post('/v1/molecules/:id/values', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id, value, label } = req.body;
    
    if (!tenant_id || !value) {
      return res.status(400).json({ error: 'tenant_id and value required' });
    }
    
    // Verify this is a list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'list') {
      return res.status(400).json({ error: 'This endpoint is only for list molecules' });
    }
    
    // Get next sort_order
    const maxSortQuery = `
      SELECT COALESCE(MAX(sort_order), 0) as max_sort 
      FROM molecule_value_text 
      WHERE molecule_id = $1
    `;
    const maxSortResult = await dbClient.query(maxSortQuery, [id]);
    const nextSort = maxSortResult.rows[0].max_sort + 1;
    
    // Insert new value
    const insertQuery = `
      INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING value_id, text_value as value, display_label as label, sort_order
    `;
    
    const result = await dbClient.query(insertQuery, [id, value, label || value, nextSort]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding list value:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update a list value
app.put('/v1/molecules/:id/values/:valueId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id, valueId } = req.params;
    const { tenant_id, value, label, sort_order } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Verify this is a list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'list') {
      return res.status(400).json({ error: 'This endpoint is only for list molecules' });
    }
    
    // Update the value
    const updateQuery = `
      UPDATE molecule_value_text
      SET text_value = COALESCE($1, text_value),
          display_label = COALESCE($2, display_label),
          sort_order = COALESCE($3, sort_order)
      WHERE value_id = $4 AND molecule_id = $5
      RETURNING value_id, text_value as value, display_label as label, sort_order
    `;
    
    const result = await dbClient.query(updateQuery, [value, label, sort_order, valueId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating list value:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete a list value
app.delete('/v1/molecules/:id/values/:valueId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id, valueId } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Verify this is a list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'list') {
      return res.status(400).json({ error: 'This endpoint is only for list molecules' });
    }
    
    // Delete the value
    const deleteQuery = `
      DELETE FROM molecule_value_text
      WHERE value_id = $1 AND molecule_id = $2
      RETURNING value_id
    `;
    
    const result = await dbClient.query(deleteQuery, [valueId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }
    
    res.json({ message: 'Value deleted', value_id: valueId });
  } catch (error) {
    console.error('Error deleting list value:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BONUS ENGINE - The Secret Sauce!
// ============================================================================

/**
 * Evaluates all active bonuses for a given activity and creates activity_bonus records
 * @param {number} activityId - The activity ID to evaluate
 * @param {string} activityDate - The activity date (YYYY-MM-DD)
 * @param {number} basePoints - The base points earned
 * @returns {Promise<Array>} Array of activity bonuses created
 */
async function evaluateBonuses(activityId, activityDate, basePoints) {
  if (!dbClient) {
    console.log('No database connection - skipping bonus evaluation');
    return [];
  }

  try {
    console.log(`\n🎁 BONUS ENGINE: Evaluating bonuses for activity ${activityId}`);
    console.log(`   Activity Date: ${activityDate}, Base Points: ${basePoints}`);

    // Query ALL ACTIVE bonuses only
    const bonusQuery = `
      SELECT 
        bonus_id,
        bonus_code,
        bonus_description,
        bonus_type,
        bonus_amount,
        start_date,
        end_date
      FROM bonus
      WHERE is_active = true
      ORDER BY bonus_code
    `;

    const bonusResult = await dbClient.query(bonusQuery);
    const activeBonuses = bonusResult.rows;

    console.log(`   Found ${activeBonuses.length} ACTIVE bonuses to evaluate`);

    const bonuses = [];

    // Walk through each active bonus
    for (const bonus of activeBonuses) {
      console.log(`\n   → Checking bonus: ${bonus.bonus_code} (${bonus.bonus_description})`);
      console.log(`      Type: ${bonus.bonus_type}, Amount: ${bonus.bonus_amount}`);
      console.log(`      Date Range: ${bonus.start_date} to ${bonus.end_date || 'ongoing'}`);

      // Check if activity date falls within bonus date range
      const actDate = new Date(activityDate);
      const startDate = new Date(bonus.start_date);
      const endDate = bonus.end_date ? new Date(bonus.end_date) : null;

      const isInDateRange = actDate >= startDate && (!endDate || actDate <= endDate);

      if (!isInDateRange) {
        console.log(`      ❌ SKIP - Activity date outside bonus range`);
        continue;
      }

      console.log(`      ✅ PASS - Activity date within range!`);

      // Check criteria if rule_id exists
      if (bonus.rule_id) {
        console.log(`      → Checking criteria for rule_id: ${bonus.rule_id}`);
        
        // Get activity data from activity_detail
        const activityDetailQuery = `
          SELECT k, raw
          FROM activity_detail
          WHERE activity_id = $1
        `;
        const detailResult = await dbClient.query(activityDetailQuery, [activityId]);
        
        // Build activityData object
        const activityData = { activity_date: activityDate };
        for (const row of detailResult.rows) {
          activityData[row.k] = row.raw;
        }
        
        console.log(`      → Activity data:`, activityData);
        
        // Load and evaluate criteria (same logic as test-rule)
        const criteriaQuery = `
          SELECT criteria_id, molecule_key, operator, value, label, joiner
          FROM rule_criteria
          WHERE rule_id = $1
          ORDER BY sort_order
        `;
        const criteriaResult = await dbClient.query(criteriaQuery, [bonus.rule_id]);
        
        if (criteriaResult.rows.length > 0) {
          console.log(`      → Found ${criteriaResult.rows.length} criteria to check`);
          
          const failures = [];
          let hasAnyPass = false;
          let hasOrJoiner = false;
          
          for (const criterion of criteriaResult.rows) {
            if (criterion.joiner === 'OR') {
              hasOrJoiner = true;
            }
            
            // Get molecule definition
            const molDefQuery = `
              SELECT value_kind, scalar_type, lookup_table_key
              FROM molecule_def
              WHERE molecule_key = $1
            `;
            const molDefResult = await dbClient.query(molDefQuery, [criterion.molecule_key]);
            
            if (molDefResult.rows.length === 0) {
              continue;
            }
            
            const moleculeDef = molDefResult.rows[0];
            const criterionValue = criterion.value;
            let criterionPassed = false;
            
            // Check criterion based on type
            if (moleculeDef.value_kind === 'lookup') {
              const lookupTable = moleculeDef.lookup_table_key;
              const codeValue = criterionValue;
              const activityValue = activityData[criterion.molecule_key];
              
              if (activityValue !== codeValue) {
                failures.push(criterion.label);
              } else {
                criterionPassed = true;
                hasAnyPass = true;
              }
              
            } else if (moleculeDef.value_kind === 'scalar') {
              const activityVal = activityData[criterion.molecule_key];
              
              if (criterion.operator === 'equals' || criterion.operator === '=') {
                if (activityVal !== criterionValue) {
                  failures.push(criterion.label);
                } else {
                  criterionPassed = true;
                  hasAnyPass = true;
                }
              }
              
            } else if (moleculeDef.value_kind === 'list') {
              const activityVal = activityData[criterion.molecule_key];
              
              if (activityVal !== criterionValue) {
                failures.push(criterion.label);
              } else {
                criterionPassed = true;
                hasAnyPass = true;
              }
            }
          }
          
          // Determine if criteria passed
          let criteriaPassed = false;
          if (hasOrJoiner) {
            // OR logic: at least one must pass
            criteriaPassed = hasAnyPass;
          } else {
            // AND logic: all must pass (no failures)
            criteriaPassed = failures.length === 0;
          }
          
          if (!criteriaPassed) {
            console.log(`      ❌ SKIP - Criteria failed: ${failures.join(', ')}`);
            continue; // Skip this bonus, move to next
          }
          
          console.log(`      ✅ PASS - All criteria matched!`);
        }
      }

      // Calculate bonus points based on type
      let bonusPoints = 0;
      if (bonus.bonus_type === 'percent') {
        bonusPoints = Math.floor(basePoints * (bonus.bonus_amount / 100));
        console.log(`      💰 Calculating: ${basePoints} × ${bonus.bonus_amount}% = ${bonusPoints} points`);
      } else if (bonus.bonus_type === 'fixed') {
        bonusPoints = bonus.bonus_amount;
        console.log(`      💰 Fixed bonus: ${bonusPoints} points`);
      }

      // Create activity_bonus record
      const bonusQuery = `
        INSERT INTO activity_bonus (activity_id, bonus_id, bonus_points)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

      const bonusResult = await dbClient.query(bonusQuery, [
        activityId,
        bonus.bonus_id,
        bonusPoints
      ]);

      console.log(`      ✨ AWARDED: ${bonusPoints} bonus points!`);

      // Update point_lot to add bonus points to accrued
      if (bonusPoints > 0) {
        // Get the lot_id from the activity
        const lotQuery = `SELECT lot_id FROM activity WHERE activity_id = $1`;
        const lotResult = await dbClient.query(lotQuery, [activityId]);
        
        if (lotResult.rows.length > 0 && lotResult.rows[0].lot_id) {
          const lotId = lotResult.rows[0].lot_id;
          await dbClient.query(
            `UPDATE point_lot SET accrued = accrued + $1 WHERE lot_id = $2`,
            [bonusPoints, lotId]
          );
          console.log(`      💰 Added ${bonusPoints} bonus points to lot_id=${lotId}`);
        }
      }

      bonuses.push({
        bonus_code: bonus.bonus_code,
        bonus_description: bonus.bonus_description,
        bonus_points: bonusPoints,
        activity_bonus_id: bonusResult.rows[0].activity_bonus_id
      });

      // Removed: "Update member's point bucket" comment - now implemented above
    }

    console.log(`\n🎁 BONUS ENGINE: Complete! Awarded ${bonuses.length} bonuses\n`);
    return bonuses;

  } catch (error) {
    console.error('Error evaluating bonuses:', error);
    return [];
  }
}

// POST - Manually trigger bonus evaluation for an activity (for testing)
app.post('/v1/activities/:activityId/evaluate-bonuses', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);

    // Get activity details
    const activityQuery = `
      SELECT activity_date, point_amount as base_miles
      FROM activity
      WHERE activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activity = activityResult.rows[0];
    const activityDate = activity.activity_date;
    const basePoints = activity.base_miles || 0;

    // Run bonus engine
    const bonuses = await evaluateBonuses(activityId, activityDate, basePoints);

    res.json({
      message: 'Bonus evaluation complete',
      activity_id: activityId,
      activity_date: activityDate,
      base_points: basePoints,
      bonuses_awarded: bonuses.length,
      bonuses: bonuses
    });

  } catch (error) {
    console.error('Error in bonus evaluation endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get molecule_id from molecule_key
async function getMoleculeId(tenantId, moleculeKey) {
  const query = `
    SELECT molecule_id 
    FROM molecule_def 
    WHERE tenant_id = $1 AND molecule_key = $2
  `;
  const result = await dbClient.query(query, [tenantId, moleculeKey]);
  if (result.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey}`);
  }
  return result.rows[0].molecule_id;
}

// Helper: Find expiration rule for a given activity date
async function findExpirationRule(activityDate) {
  const query = `
    SELECT rule_key, expiration_date, description
    FROM point_expiration_rule 
    WHERE $1 >= start_date AND $1 <= end_date
    ORDER BY rule_key DESC
    LIMIT 1
  `;
  const result = await dbClient.query(query, [activityDate]);
  
  if (result.rows.length > 0) {
    return {
      ruleKey: result.rows[0].rule_key,
      expireDate: result.rows[0].expiration_date,
      description: result.rows[0].description
    };
  }
  
  // No rule found - return null to trigger error
  return {
    ruleKey: null,
    expireDate: null,
    description: null
  };
}

// Helper: Get molecule value by key (searches across all contexts)
async function getMoleculeValue(tenantId, moleculeKey) {
  const query = `
    SELECT 
      md.value_kind,
      md.scalar_type,
      mvt.text_value,
      mvn.numeric_value
    FROM molecule_def md
    LEFT JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
    LEFT JOIN molecule_value_numeric mvn ON md.molecule_id = mvn.molecule_id
    WHERE md.tenant_id = $1 
      AND md.molecule_key = $2
      AND md.is_active = true
    ORDER BY 
      CASE md.context
        WHEN 'program' THEN 1
        WHEN 'tenant' THEN 2
        WHEN 'system' THEN 3
        ELSE 4
      END
    LIMIT 1
  `;
  const result = await dbClient.query(query, [tenantId, moleculeKey]);
  
  if (result.rows.length > 0) {
    const row = result.rows[0];
    // Return text_value if it exists, otherwise numeric_value
    if (row.text_value !== null) {
      return row.text_value;
    } else if (row.numeric_value !== null) {
      return String(row.numeric_value);
    }
  }
  
  return null; // Not found
}

// Legacy alias - for backwards compatibility
const getProgramLabel = getMoleculeValue;

// Helper: Get error message from system molecule by error code
async function getErrorMessage(tenantId, errorCode) {
  const query = `
    SELECT mvt.text_value, mvt.display_label
    FROM molecule_def md
    JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id
    WHERE md.tenant_id = $1
      AND md.context = 'system'
      AND md.molecule_key = 'error_messages'
      AND mvt.text_value = $2
    LIMIT 1
  `;
  const result = await dbClient.query(query, [tenantId, errorCode]);
  
  if (result.rows.length > 0) {
    // Return display_label which contains the actual error message
    return result.rows[0].display_label || errorCode;
  }
  
  // Not found - return code itself as reminder to add it
  return errorCode;
}

// POST - Create new flight activity with molecules
app.post('/v1/members/:memberId/activities/flight', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const memberId = req.params.memberId;
    const tenantId = req.body.tenant_id || 1; // TODO: Get from session
    const { activity_date, carrier, origin, destination, fare_class, flight_number } = req.body;
    const base_miles = Number(req.body.base_miles); // Ensure it's a number

    // Validate required fields
    if (!activity_date || !carrier || !origin || !destination || !base_miles) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate retro date limit
    console.log(`\n🔍 Checking retro date limit...`);
    let retroDaysAllowed;
    try {
      retroDaysAllowed = await getProgramLabel(tenantId, 'retro_days_allowed');
      console.log(`   getProgramLabel returned: ${JSON.stringify(retroDaysAllowed)}`);
    } catch (e) {
      console.log(`   Error getting retro_days_allowed: ${e.message}`);
    }
    
    if (retroDaysAllowed) {
      const retroDays = Number(retroDaysAllowed);
      console.log(`   Parsed retro days: ${retroDays}`);
      
      if (!isNaN(retroDays) && retroDays > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - retroDays);
        
        const activityDateObj = new Date(activity_date + 'T00:00:00');
        
        console.log(`   Today: ${today.toISOString().split('T')[0]}`);
        console.log(`   Cutoff (${retroDays} days ago): ${cutoffDate.toISOString().split('T')[0]}`);
        console.log(`   Activity date: ${activity_date}`);
        console.log(`   Is too old? ${activityDateObj < cutoffDate}`);
        
        if (activityDateObj < cutoffDate) {
          const errorMsg = await getErrorMessage(tenantId, 'E001');
          console.log(`   ❌ REJECTED: Activity date exceeds retro limit`);
          return res.status(400).json({ error: errorMsg });
        }
        
        console.log(`   ✅ PASSED: Activity date within retro limit`);
      } else {
        console.log(`   ⚠️  Invalid retro days value: ${retroDays}`);
      }
    } else {
      console.log(`   ℹ️  No retro_days_allowed molecule found - skipping check`);
    }

    console.log(`\n📝 Creating flight activity for member ${memberId}:`, {
      activity_date,
      carrier,
      origin,
      destination,
      fare_class,
      flight_number,
      base_miles
    });

    // Step 1: Encode all molecules
    const encodedMolecules = {};
    const moleculeIds = {};
    
    // Carrier (lookup)
    encodedMolecules.carrier = await encodeMolecule(tenantId, 'carrier', carrier);
    moleculeIds.carrier = await getMoleculeId(tenantId, 'carrier');
    console.log(`   ✓ Carrier ${carrier} → value_id ${encodedMolecules.carrier}, molecule_id ${moleculeIds.carrier}`);
    
    // Origin (lookup)
    encodedMolecules.origin = await encodeMolecule(tenantId, 'origin', origin);
    moleculeIds.origin = await getMoleculeId(tenantId, 'origin');
    console.log(`   ✓ Origin ${origin} → value_id ${encodedMolecules.origin}, molecule_id ${moleculeIds.origin}`);
    
    // Destination (lookup)
    encodedMolecules.destination = await encodeMolecule(tenantId, 'destination', destination);
    moleculeIds.destination = await getMoleculeId(tenantId, 'destination');
    console.log(`   ✓ Destination ${destination} → value_id ${encodedMolecules.destination}, molecule_id ${moleculeIds.destination}`);
    
    // Fare Class (list) - optional
    if (fare_class) {
      encodedMolecules.fare_class = await encodeMolecule(tenantId, 'fare_class', fare_class);
      moleculeIds.fare_class = await getMoleculeId(tenantId, 'fare_class');
      console.log(`   ✓ Fare Class ${fare_class} → value_id ${encodedMolecules.fare_class}, molecule_id ${moleculeIds.fare_class}`);
    }
    
    // Flight Number (scalar numeric) - optional
    if (flight_number) {
      encodedMolecules.flight_number = await encodeMolecule(tenantId, 'flight_number', flight_number);
      moleculeIds.flight_number = await getMoleculeId(tenantId, 'flight_number');
      console.log(`   ✓ Flight Number ${flight_number} → value_id ${encodedMolecules.flight_number}, molecule_id ${moleculeIds.flight_number}`);
    }

    // Step 2: Find expiration rule for this activity
    console.log(`\n💰 Finding expiration rule for activity date ${activity_date}...`);
    const expirationRule = await findExpirationRule(activity_date);
    
    // Check if rule was found - error if not
    if (!expirationRule.ruleKey) {
      const errorMsg = await getErrorMessage(tenantId, 'E002');
      console.log(`   ❌ No expiration rule found for activity date ${activity_date}`);
      return res.status(400).json({ error: errorMsg });
    }
    
    console.log(`   ✓ Rule: ${expirationRule.ruleKey} - expires ${expirationRule.expireDate}`);
    
    // Step 3: Upsert point_lot (bucket)
    // Find existing bucket with same expiration date
    const findBucket = `
      SELECT lot_id, accrued
      FROM point_lot
      WHERE member_id = $1 
        AND expire_date = $2
      LIMIT 1
    `;
    const existing = await dbClient.query(findBucket, [memberId, expirationRule.expireDate]);
    
    let lotId;
    if (existing.rows.length > 0) {
      // UPDATE existing bucket - add to accrued
      lotId = existing.rows[0].lot_id;
      const oldAccrued = Number(existing.rows[0].accrued);
      const newAccrued = oldAccrued + base_miles;
      
      await dbClient.query(
        `UPDATE point_lot SET accrued = $1 WHERE lot_id = $2`,
        [newAccrued, lotId]
      );
      console.log(`   ✓ Bucket updated: lot_id=${lotId}, added ${base_miles}, total accrued=${newAccrued}`);
    } else {
      // INSERT new bucket
      const insertResult = await dbClient.query(
        `INSERT INTO point_lot (member_id, point_type, accrued, redeemed, expire_date)
         VALUES ($1, 'miles', $2, 0, $3)
         RETURNING lot_id`,
        [memberId, base_miles, expirationRule.expireDate]
      );
      lotId = insertResult.rows[0].lot_id;
      console.log(`   ✓ Bucket created: lot_id=${lotId}, accrued=${base_miles}, expires=${expirationRule.expireDate}`);
    }

    // Step 4: Insert activity (parent record) WITH lot_id
    const postDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD
    const activityQuery = `
      INSERT INTO activity (
        member_id,
        activity_date,
        post_date,
        activity_type,
        point_amount,
        lot_id
      )
      VALUES ($1, $2, $3, 'A', $4, $5)
      RETURNING activity_id, activity_date, point_amount, lot_id
    `;

    const activityResult = await dbClient.query(activityQuery, [
      memberId,
      activity_date,
      postDate,
      base_miles,
      lotId
    ]);

    const newActivity = activityResult.rows[0];
    const activityId = newActivity.activity_id;
    console.log(`   ✓ Activity created: activity_id=${activityId}, branded with lot_id=${lotId}`);

    // Step 5: Insert activity_detail rows (molecules) using molecule_id
    for (const moleculeKey of Object.keys(encodedMolecules)) {
      const detailQuery = `
        INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
        VALUES ($1, $2, $3)
      `;
      await dbClient.query(detailQuery, [
        activityId, 
        moleculeIds[moleculeKey], 
        encodedMolecules[moleculeKey]
      ]);
      console.log(`   ✓ Molecule stored: molecule_id=${moleculeIds[moleculeKey]}, v_ref_id=${encodedMolecules[moleculeKey]}`);
    }

    // Step 6: Evaluate bonuses
    console.log(`\n🎁 Evaluating bonuses for activity ${activityId}...`);
    const bonuses = await evaluateBonuses(activityId, activity_date, base_miles);

    console.log(`✅ Activity ${activityId} created successfully with ${bonuses.length} bonuses\n`);

    res.status(201).json({
      message: 'Flight activity created successfully',
      activity_id: activityId,
      activity_date: newActivity.activity_date,
      base_miles: newActivity.point_amount,
      lot_id: lotId,
      expire_date: expirationRule.expireDate,
      bonuses_awarded: bonuses.length,
      bonuses: bonuses
    });

  } catch (error) {
    console.error('Error creating flight activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get bonuses for an activity
app.get('/v1/activities/:activityId/bonuses', async (req, res) => {
  if (!dbClient) {
    return res.json([]);
  }

  try {
    const activityId = parseInt(req.params.activityId);

    const query = `
      SELECT 
        ab.activity_bonus_id,
        ab.bonus_points,
        ab.created_at,
        b.bonus_code,
        b.bonus_description,
        b.bonus_type,
        b.bonus_amount
      FROM activity_bonus ab
      JOIN bonus b ON ab.bonus_id = b.bonus_id
      WHERE ab.activity_id = $1
      ORDER BY ab.created_at
    `;

    const result = await dbClient.query(query, [activityId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching activity bonuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remove activity and adjust point balance
app.delete('/v1/activities/:activityId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);
    
    console.log(`\n🗑️  Deleting activity ${activityId}...`);

    // Step 1: Get activity info (lot_id, point_amount) before deleting
    const activityQuery = `
      SELECT lot_id, point_amount, member_id
      FROM activity
      WHERE activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);
    
    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const { lot_id, point_amount, member_id } = activityResult.rows[0];
    console.log(`   Activity: lot_id=${lot_id}, point_amount=${point_amount}, member_id=${member_id}`);

    // Step 2: Delete activity_detail records
    const deleteDetailsResult = await dbClient.query(
      'DELETE FROM activity_detail WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted ${deleteDetailsResult.rowCount} activity_detail record(s)`);

    // Step 3: Delete activity_bonus records
    const deleteBonusResult = await dbClient.query(
      'DELETE FROM activity_bonus WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted ${deleteBonusResult.rowCount} activity_bonus record(s)`);

    // Step 4: Delete the activity record
    await dbClient.query(
      'DELETE FROM activity WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted activity record`);

    // Step 5: Update point_lot - subtract points from accrued
    if (lot_id && point_amount) {
      const updateLotQuery = `
        UPDATE point_lot
        SET accrued = accrued - $1
        WHERE lot_id = $2
        RETURNING accrued
      `;
      const updateResult = await dbClient.query(updateLotQuery, [point_amount, lot_id]);
      
      if (updateResult.rows.length > 0) {
        console.log(`   ✓ Updated point_lot ${lot_id}: subtracted ${point_amount}, new accrued=${updateResult.rows[0].accrued}`);
      }
    }

    console.log(`✅ Activity ${activityId} deleted successfully\n`);

    res.json({
      success: true,
      message: 'Activity deleted successfully',
      activity_id: activityId,
      points_adjusted: point_amount
    });

  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// DISPLAY TEMPLATES ENDPOINTS
// ========================================

// GET - List all display templates for tenant
app.get('/v1/display-templates', async (req, res) => {
  if (!dbClient) {
    return res.json([]);
  }

  try {
    const tenantId = req.query.tenant_id || 1;

    const query = `
      SELECT 
        dt.template_id,
        dt.template_name,
        dt.template_type,
        dt.is_active,
        dt.created_at,
        COUNT(dtl.line_id) as line_count
      FROM display_template dt
      LEFT JOIN display_template_line dtl ON dt.template_id = dtl.template_id
      WHERE dt.tenant_id = $1
      GROUP BY dt.template_id, dt.template_name, dt.template_type, dt.is_active, dt.created_at
      ORDER BY dt.template_type, dt.is_active DESC, dt.template_name
    `;

    const result = await dbClient.query(query, [tenantId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching display templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Activate a template (sets others of same type to inactive)
app.post('/v1/display-templates/:id/activate', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);
    const tenantId = req.body.tenant_id || 1;

    // Get template type
    const getTemplateQuery = `
      SELECT template_type 
      FROM display_template 
      WHERE template_id = $1 AND tenant_id = $2
    `;
    const templateResult = await dbClient.query(getTemplateQuery, [templateId, tenantId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const templateType = templateResult.rows[0].template_type;

    // Deactivate all templates of this type for this tenant
    const deactivateQuery = `
      UPDATE display_template
      SET is_active = FALSE
      WHERE tenant_id = $1 AND template_type = $2
    `;
    await dbClient.query(deactivateQuery, [tenantId, templateType]);

    // Activate the specified template
    const activateQuery = `
      UPDATE display_template
      SET is_active = TRUE
      WHERE template_id = $1
      RETURNING *
    `;
    const result = await dbClient.query(activateQuery, [templateId]);

    console.log(`✓ Activated ${templateType === 'V' ? 'Verbose' : 'Efficient'} template: ${result.rows[0].template_name}`);

    res.json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    console.error('Error activating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete a template (only if not active)
app.delete('/v1/display-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);

    // Check if template is active
    const checkQuery = `
      SELECT template_name, is_active 
      FROM display_template 
      WHERE template_id = $1
    `;
    const checkResult = await dbClient.query(checkQuery, [templateId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (checkResult.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot delete active template. Activate another template first.' });
    }

    // Delete template (cascade will delete lines)
    const deleteQuery = `
      DELETE FROM display_template 
      WHERE template_id = $1
    `;
    await dbClient.query(deleteQuery, [templateId]);

    console.log(`✓ Deleted template: ${checkResult.rows[0].template_name}`);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get first value label from a list molecule (helper for UI labels)
app.get('/v1/molecules/:key/first-label', async (req, res) => {
  if (!dbClient) {
    return res.json({ label: 'Activity' });
  }
  
  try {
    const { key } = req.params;
    const tenantId = req.query.tenant_id || 1;
    
    // Use getMolecule helper function
    const molecule = await getMolecule(key, tenantId);
    
    if (molecule.value_kind === 'list' && molecule.values && molecule.values.length > 0) {
      return res.json({ label: molecule.values[0].label });
    }
    
    res.json({ label: 'Activity' });
    
  } catch (error) {
    console.error('Error getting first label:', error);
    res.json({ label: 'Activity' });
  }
});


// Version endpoint
app.get('/version', (req, res) => {
  res.json({
    version: SERVER_VERSION,
    build_notes: BUILD_NOTES,
    database: dbClient ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, () => {
  const startTime = new Date().toLocaleString();
  console.log(`\n===========================================`);
  console.log(`Loyalty Platform API Server`);
  console.log(`Version: ${SERVER_VERSION}`);
  console.log(`Build: ${BUILD_NOTES}`);
  console.log(`===========================================`);
  console.log(`Server started: ${startTime}`);
  console.log(`Listening on: http://127.0.0.1:${PORT}`);
  console.log(`Database: ${dbClient ? 'CONNECTED' : 'NOT CONNECTED - using mock data'}`);
  console.log(`===========================================\n`);
});
