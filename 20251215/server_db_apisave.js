import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

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
    
    // Get all static tenant-context molecules with their values
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
        AND md.context = 'tenant'
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
app.get('/v1/airports', async (req, res) => {
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
        airport_id,
        code,
        name,
        city,
        country,
        is_active
      FROM airports
      ORDER BY code
    `;
    
    const result = await dbClient.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching airports:', error);
    res.status(500).json({ error: error.message });
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
        COALESCE(SUM(qty), 0) as balance
      FROM point_lot
      WHERE member_id = $1
        AND (expires_at IS NULL OR expires_at >= $2)
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

// Activities with magic_box
app.get("/v1/member/:id/activities", async (req, res) => {
  const memberId = req.params.id;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

  if (!dbClient) {
    const mock = MOCK.activities(memberId);
    for (const a of mock.activities) a.magic_box = rowsToMagicBox(a);
    return res.json(mock);
  }
  try {
    // Query activities with Program Molecules
    const q = await dbClient.query(
      `SELECT 
         a.activity_id, 
         a.member_id, 
         a.activity_date,
         a.kind,
         a.point_amount as base_miles,
         a.point_type,
         -- Carrier molecule
         carrier_detail.v_ref_id as carrier_id,
         carrier_detail.raw as carrier_code,
         carrier.name as carrier_name,
         -- Origin molecule
         origin_detail.v_ref_id as origin_id,
         origin_detail.raw as origin_code,
         origin.name as origin_name,
         origin.city as origin_city,
         -- Destination molecule  
         dest_detail.v_ref_id as destination_id,
         dest_detail.raw as destination_code,
         dest.name as destination_name,
         dest.city as destination_city,
         -- Flight number molecule
         flight_detail.v_text as flight_no,
         -- Fare class molecule
         fare_detail.v_text as fare_class
       FROM activity a
       LEFT JOIN activity_detail carrier_detail ON a.activity_id = carrier_detail.activity_id AND carrier_detail.k = 'carrier'
       LEFT JOIN carriers carrier ON carrier_detail.v_ref_id = carrier.carrier_id
       LEFT JOIN activity_detail origin_detail ON a.activity_id = origin_detail.activity_id AND origin_detail.k = 'origin'
       LEFT JOIN airports origin ON origin_detail.v_ref_id = origin.airport_id
       LEFT JOIN activity_detail dest_detail ON a.activity_id = dest_detail.activity_id AND dest_detail.k = 'destination'
       LEFT JOIN airports dest ON dest_detail.v_ref_id = dest.airport_id
       LEFT JOIN activity_detail flight_detail ON a.activity_id = flight_detail.activity_id AND flight_detail.k = 'flight_number'
       LEFT JOIN activity_detail fare_detail ON a.activity_id = fare_detail.activity_id AND fare_detail.k = 'fare_class'
       WHERE a.member_id = $1
       ORDER BY a.activity_date DESC
       LIMIT $2`,
      [memberId, limit]
    );

    const rows = (q?.rows || []).map(r => {
      const baseMiles = Number(r.base_miles || 0);
      const a = {
        activity_id: r.activity_id,
        member_id: r.member_id,
        activity_date: (r.activity_date && r.activity_date.toISOString) ? r.activity_date.toISOString() : (r.activity_date || ""),
        kind: r.kind || 'accrual',
        base_miles: baseMiles,
        miles_total: baseMiles, // Will be updated with bonuses
        point_type: r.point_type || 'miles',
        origin: r.origin_code || undefined,
        origin_name: r.origin_name || undefined,
        origin_city: r.origin_city || undefined,
        destination: r.destination_code || undefined,
        destination_name: r.destination_name || undefined,
        destination_city: r.destination_city || undefined,
        carrier_code: r.carrier_code || undefined,
        carrier_name: r.carrier_name || undefined,
        flight_no: r.flight_no || undefined,
        fare_class: r.fare_class || undefined,
        title: `Activity ${baseMiles.toLocaleString()}`
      };
      
      // Build magic_box from available molecules
      a.magic_box = [];
      if (r.origin_code) a.magic_box.push({ label: 'Origin', value: r.origin_code });
      if (r.destination_code) a.magic_box.push({ label: 'Destination', value: r.destination_code });
      if (r.carrier_code) a.magic_box.push({ label: 'Carrier', value: r.carrier_code });
      if (r.flight_no) a.magic_box.push({ label: 'Flight', value: r.carrier_code + r.flight_no });
      if (r.fare_class) a.magic_box.push({ label: 'Fare/Class', value: r.fare_class });
      
      return a;
    });
    
    return res.json({ ok: true, activities: rows });
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
    // Query point_lot table
    const q = await dbClient.query(
      `SELECT 
        COALESCE(expires_at, DATE '9999-12-31') AS expiry_date,
        COALESCE(qty, 0) AS accrued,
        0 AS redeemed
       FROM point_lot
       WHERE member_id = $1
       ORDER BY expires_at NULLS LAST`,
      [memberId]
    );
    
    const buckets = (q?.rows || []).map(r => ({
      expiry_date: r.expiry_date?.toISOString?.() ? r.expiry_date.toISOString().slice(0,10) : String(r.expiry_date),
      accrued: Number(r.accrued || 0),
      redeemed: Number(r.redeemed || 0)
    }));
    
    return res.json({
      ok: true,
      member_id: String(memberId),
      point_type: "base_miles",
      program_tz,
      today,
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
      WHERE is_active = true
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

// PUT - Update molecule definition
app.put('/v1/molecules/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { molecule_key, label, context, value_kind, is_static, is_permanent, description } = req.body;
    
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
        maintenance_description
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
        ON CONFLICT (activity_id, bonus_id) DO UPDATE
          SET bonus_points = $3
        RETURNING *
      `;

      const bonusResult = await dbClient.query(bonusQuery, [
        activityId,
        bonus.bonus_id,
        bonusPoints
      ]);

      console.log(`      ✨ AWARDED: ${bonusPoints} bonus points!`);

      bonuses.push({
        bonus_code: bonus.bonus_code,
        bonus_description: bonus.bonus_description,
        bonus_points: bonusPoints,
        activity_bonus_id: bonusResult.rows[0].activity_bonus_id
      });

      // Update member's point bucket
      // (This would happen in a real implementation)
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

// POST - Create new flight activity with molecules
app.post('/v1/members/:memberId/activities/flight', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const memberId = req.params.memberId;
    const { activity_date, carrier, origin, destination, base_miles } = req.body;

    // Validate required fields
    if (!activity_date || !carrier || !origin || !destination || !base_miles) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`\n📝 Creating flight activity for member ${memberId}:`, {
      activity_date,
      carrier,
      origin,
      destination,
      base_miles
    });

    // Step 1: Lookup carrier_id
    const carrierQuery = `SELECT carrier_id FROM carriers WHERE code = $1`;
    const carrierResult = await dbClient.query(carrierQuery, [carrier.toUpperCase()]);
    
    if (carrierResult.rows.length === 0) {
      return res.status(400).json({ error: `Carrier code '${carrier}' not found` });
    }
    const carrierId = carrierResult.rows[0].carrier_id;
    console.log(`   ✓ Carrier ${carrier} → ID ${carrierId}`);

    // Step 2: Lookup origin airport_id
    const originQuery = `SELECT airport_id FROM airports WHERE code = $1`;
    const originResult = await dbClient.query(originQuery, [origin.toUpperCase()]);
    
    if (originResult.rows.length === 0) {
      return res.status(400).json({ error: `Origin airport '${origin}' not found` });
    }
    const originId = originResult.rows[0].airport_id;
    console.log(`   ✓ Origin ${origin} → ID ${originId}`);

    // Step 3: Lookup destination airport_id
    const destQuery = `SELECT airport_id FROM airports WHERE code = $1`;
    const destResult = await dbClient.query(destQuery, [destination.toUpperCase()]);
    
    if (destResult.rows.length === 0) {
      return res.status(400).json({ error: `Destination airport '${destination}' not found` });
    }
    const destId = destResult.rows[0].airport_id;
    console.log(`   ✓ Destination ${destination} → ID ${destId}`);

    // Step 4: Insert activity (main record)
    const activityQuery = `
      INSERT INTO activity (
        member_id,
        activity_date,
        kind,
        point_amount,
        point_type,
        created_at
      )
      VALUES ($1, $2, 'accrual', $3, 'miles', NOW())
      RETURNING activity_id, activity_date, point_amount
    `;

    const activityResult = await dbClient.query(activityQuery, [
      memberId,
      activity_date,
      base_miles
    ]);

    const newActivity = activityResult.rows[0];
    const activityId = newActivity.activity_id;
    console.log(`   ✓ Activity created with ID: ${activityId}`);

    // Step 5: Insert activity_detail rows (molecules)
    const detailInserts = [
      { k: 'carrier', v_ref_id: carrierId, raw: carrier.toUpperCase() },
      { k: 'origin', v_ref_id: originId, raw: origin.toUpperCase() },
      { k: 'destination', v_ref_id: destId, raw: destination.toUpperCase() }
    ];

    for (const detail of detailInserts) {
      const detailQuery = `
        INSERT INTO activity_detail (activity_id, k, v_ref_id, raw)
        VALUES ($1, $2, $3, $4)
      `;
      await dbClient.query(detailQuery, [activityId, detail.k, detail.v_ref_id, detail.raw]);
      console.log(`   ✓ Molecule added: ${detail.k} = ${detail.raw}`);
    }

    // Step 5.5: UPSERT point_lot (point bucket)
    console.log(`\n💰 Processing point bucket for activity ${activityId}...`);
    
    // Look up expiration rule based on activity_date
    const ruleQuery = `
      SELECT rule_key, expiration_date 
      FROM point_expiration_rule 
      WHERE $1 >= start_date AND $1 <= end_date
      ORDER BY rule_key DESC
      LIMIT 1
    `;
    const ruleResult = await dbClient.query(ruleQuery, [activity_date]);
    
    let expiresAt = null;
    if (ruleResult.rows.length > 0) {
      expiresAt = ruleResult.rows[0].expiration_date;
      console.log(`   ✓ Expiration rule found: ${ruleResult.rows[0].rule_key}, expires ${expiresAt}`);
    } else {
      expiresAt = '9999-12-31';
      console.log(`   ⚠ No expiration rule found - using never expires`);
    }
    
    // Check if bucket exists for this member + expiry date
    const findBucket = `
      SELECT lot_id, qty
      FROM point_lot
      WHERE member_id = $1 AND expires_at = $2
      LIMIT 1
    `;
    const existing = await dbClient.query(findBucket, [memberId, expiresAt]);
    
    let lotId;
    if (existing.rows.length > 0) {
      // UPDATE existing bucket
      lotId = existing.rows[0].lot_id;
      const oldQty = existing.rows[0].qty;
      const newQty = oldQty + base_miles;
      
      await dbClient.query(
        `UPDATE point_lot SET qty = $1, earned_at = $2 WHERE lot_id = $3`,
        [newQty, activity_date, lotId]
      );
      console.log(`   ✓ Bucket updated: lot_id=${lotId}, added ${base_miles}, total=${newQty}`);
    } else {
      // INSERT new bucket
      const insertResult = await dbClient.query(
        `INSERT INTO point_lot (member_id, point_type, qty, earned_at, expires_at, source)
         VALUES ($1, 'miles', $2, $3, $4, $5)
         RETURNING lot_id`,
        [memberId, base_miles, activity_date, expiresAt, `activity_${activityId}`]
      );
      lotId = insertResult.rows[0].lot_id;
      console.log(`   ✓ Bucket created: lot_id=${lotId}, qty=${base_miles}`);
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


app.listen(PORT, () => {
  const startTime = new Date().toLocaleString();
  console.log(`\n===========================================`);
  console.log(`Server started: ${startTime}`);
  console.log(`Listening on: http://127.0.0.1:${PORT}`);
  console.log(`Database: ${dbClient ? 'CONNECTED' : 'NOT CONNECTED - using mock data'}`);
  console.log(`===========================================\n`);
});
