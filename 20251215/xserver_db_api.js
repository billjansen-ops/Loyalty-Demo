import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { resolveAtom, resolveAtoms } from "./atom_resolve.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

// Version derived from file modification time - automatic, no human involved
const __filename_local = fileURLToPath(import.meta.url);
const SERVER_VERSION = (() => {
  const stats = fs.statSync(__filename_local);
  const mtime = stats.mtime;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${mtime.getFullYear()}.${pad(mtime.getMonth() + 1)}.${pad(mtime.getDate())}.${pad(mtime.getHours())}${pad(mtime.getMinutes())}`;
})();
const BUILD_NOTES = "Data loader and stress test both multi-threaded server-side";

// Global debug flag - loaded from database at startup
let DEBUG_ENABLED = true; // Default to true until loaded from DB

// Smart debug logging - only executes if DEBUG_ENABLED is true
// Usage: debugLog(() => `Expensive operation: ${JSON.stringify(largeObject)}`);
function debugLog(messageFn) {
  if (DEBUG_ENABLED) {
    const message = typeof messageFn === 'function' ? messageFn() : messageFn;
    console.log(message);
  }
}

// Helper: Get a single value from sysparm embedded list
async function getSysparmValue(tenantId, category, code) {
  if (!dbClient) return null;
  try {
    const result = await dbClient.query(`
      SELECT mvl.description as value
      FROM molecule_value_embedded_list mvl
      JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
      WHERE md.molecule_key = 'sysparm'
        AND md.tenant_id = $1
        AND mvl.category = $2
        AND mvl.code = $3
        AND mvl.is_active = true
      LIMIT 1
    `, [tenantId, category, code]);
    
    return result.rows.length > 0 ? result.rows[0].value : null;
  } catch (error) {
    console.error(`Error getting sysparm ${category}.${code}:`, error.message);
    return null;
  }
}

// Helper: Set a sysparm value
async function setSysparmValue(tenantId, category, code, value) {
  if (!dbClient) return false;
  try {
    await dbClient.query(`
      UPDATE molecule_value_embedded_list mvl
      SET description = $4
      FROM molecule_def md
      WHERE mvl.molecule_id = md.molecule_id
        AND md.molecule_key = 'sysparm'
        AND md.tenant_id = $1
        AND mvl.category = $2
        AND mvl.code = $3
    `, [tenantId, category, code, value]);
    return true;
  } catch (error) {
    console.error(`Error setting sysparm ${category}.${code}:`, error.message);
    return false;
  }
}

// Load debug setting from database at startup
let pg = null;
try { pg = await import("pg"); } catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const USE_DB = !!(pg && (process.env.DATABASE_URL || process.env.PGHOST));

// Extract Client and connection config at module level for database switching
let Client = null;
let DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE;

let dbClient = null;
let currentDatabaseName = null; // Track current database for logging
if (USE_DB) {
  Client = pg.Client;
  
  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL if provided
    const cfg = { connectionString: process.env.DATABASE_URL };
    dbClient = new Client(cfg);
  } else {
    // Use individual env vars
    DB_HOST = process.env.PGHOST || "127.0.0.1";
    DB_PORT = Number(process.env.PGPORT || 5432);
    DB_USER = process.env.PGUSER || "postgres";
    DB_PASSWORD = process.env.PGPASSWORD || "";
    DB_DATABASE = process.env.PGDATABASE || "postgres";
    
    dbClient = new Client({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE
    });
    currentDatabaseName = DB_DATABASE;
  }
  
  dbClient.connect()
    .then(() => {
      loadDebugSetting(); // Load debug setting after successful connection
    })
    .catch(err => {
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
async function getMolecule(moleculeKey, tenantId, category = null) {
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
      display_width,
      is_static,
      is_permanent,
      is_required,
      is_active,
      description,
      sample_code,
      sample_description
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
    
  } else if (molecule.value_kind === 'embedded_list') {
    // Get embedded list values for specific category or all categories
    if (category) {
      // Return values for specific category
      const embeddedQuery = `
        SELECT 
          code as value,
          description as label,
          sort_order
        FROM molecule_value_embedded_list
        WHERE molecule_id = $1 
          AND tenant_id = $2
          AND category = $3
          AND is_active = true
        ORDER BY sort_order, code
      `;
      
      const embeddedResult = await dbClient.query(embeddedQuery, [molecule.molecule_id, tenantId, category]);
      molecule.values = embeddedResult.rows;
      molecule.category = category;
    } else {
      // Return all categories with their values
      const categoriesQuery = `
        SELECT 
          category,
          code as value,
          description as label,
          sort_order
        FROM molecule_value_embedded_list
        WHERE molecule_id = $1 
          AND tenant_id = $2
          AND is_active = true
        ORDER BY category, sort_order, code
      `;
      
      const categoriesResult = await dbClient.query(categoriesQuery, [molecule.molecule_id, tenantId]);
      
      // Group by category
      const categories = {};
      categoriesResult.rows.forEach(row => {
        if (!categories[row.category]) {
          categories[row.category] = [];
        }
        categories[row.category].push({
          value: row.value,
          label: row.label,
          sort_order: row.sort_order
        });
      });
      
      molecule.categories = categories;
      molecule.values = null;
    }
    
  } else if (molecule.value_kind === 'lookup') {
    // For lookup types, load values from the configured lookup table
    const lookupConfigQuery = `
      SELECT 
        table_name,
        id_column,
        code_column,
        label_column,
        is_tenant_specific
      FROM molecule_value_lookup
      WHERE molecule_id = $1
    `;
    
    const lookupConfigResult = await dbClient.query(lookupConfigQuery, [molecule.molecule_id]);
    
    if (lookupConfigResult.rows.length > 0) {
      const config = lookupConfigResult.rows[0];
      
      // Build query to get values from lookup table
      let valuesQuery = `
        SELECT 
          ${config.id_column} as id,
          ${config.code_column} as code,
          ${config.label_column} as label
        FROM ${config.table_name}
      `;
      
      // Add tenant filter if table is tenant-specific
      const queryParams = [];
      if (config.is_tenant_specific) {
        valuesQuery += ` WHERE tenant_id = $1`;
        queryParams.push(tenantId);
      }
      
      valuesQuery += ` ORDER BY ${config.label_column}`;
      
      const valuesResult = await dbClient.query(valuesQuery, queryParams);
      molecule.values = valuesResult.rows;
      
      console.log(`[getMolecule] Loaded ${valuesResult.rows.length} values for lookup molecule '${moleculeKey}'`);
    } else {
      console.warn(`[getMolecule] No lookup configuration found for molecule '${moleculeKey}'`);
      molecule.value = null;
      molecule.values = null;
    }
  }
  
  return molecule;
}

/**
 * Get error message by error code
 * @param {string} errorCode - The error code (e.g., "E003")
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string|null>} Error message text with atoms resolved, or null if not found
 */
async function getErrorMessage(errorCode, tenantId) {
  try {
    const errorMolecule = await getMolecule('error_messages', tenantId);
    const errorEntry = errorMolecule.values.find(v => v.value === errorCode);
    
    if (errorEntry) {
      const messageTemplate = errorEntry.label;
      console.log(`[getErrorMessage] Template: ${messageTemplate}`);
      
      // Resolve any atoms in the error message
      const context = {
        tenantId: tenantId,
        getMolecule: getMolecule,
        dbClient: dbClient
      };
      
      const resolvedMessage = await resolveAtoms(messageTemplate, context);
      console.log(`[getErrorMessage] Resolved: ${resolvedMessage}`);
      return `${errorCode}: ${resolvedMessage}`;
    }
    
    return null; // Error code not found
  } catch (error) {
    console.error(`Error fetching error message for ${errorCode}:`, error);
    return null;
  }
}

// GET - Server version endpoint
app.get('/v1/version', (req, res) => {
  res.json({ 
    version: SERVER_VERSION, 
    notes: BUILD_NOTES 
  });
});

// GET - Test endpoint for molecule retrieval
app.get('/v1/molecules/get/:key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { key } = req.params;
    const { tenant_id, return_type, category } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    const molecule = await getMolecule(key, tenant_id, category);
    
    // If only samples requested, return minimal payload
    if (return_type === 'with_samples') {
      return res.json({
        molecule_key: molecule.molecule_key,
        label: molecule.label,
        sample_code: molecule.sample_code,
        sample_description: molecule.sample_description
      });
    }
    
    // Otherwise return full molecule
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
    
    // Get current tier
    const tierResult = await getMemberTierOnDate(memberId, new Date().toISOString().slice(0, 10));
    
    if (tierResult) {
      member.tier = tierResult.tier_code;
      member.tier_description = tierResult.tier_description;
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
    
    // Step 3: Load label molecules for this tenant
    let pointTypeMolecule = { value: 'miles' };
    
    try {
      pointTypeMolecule = await getMolecule('currency_label', tenantId);
    } catch (e) {
      console.log('currency_label molecule not found, using default "miles"');
    }
    
    // Load activity_type_label for 'A' activities
    const activityTypeMolecule = await getMolecule('activity_type_label', tenantId);
    
    const originMolecule = await getMolecule('origin', tenantId);
    const destinationMolecule = await getMolecule('destination', tenantId);
    const carrierMolecule = await getMolecule('carrier', tenantId);
    const fareClassMolecule = await getMolecule('fare_class', tenantId);
    
    // Templates are now fetched per-activity (see below in activity loop)
    
    // Step 4: Decode molecules for each activity
    const activities = await Promise.all(activitiesResult.rows.map(async (activity) => {
      const baseMiles = Number(activity.base_miles || 0);
      const details = detailsByActivity[activity.activity_id] || [];
      
      // Fetch templates for THIS activity's type
      let efficientTemplate = null;
      let verboseTemplate = null;
      
      try {
        const efficientQuery = `
          SELECT dt.template_id, dt.template_name, dtl.line_number, dtl.template_string
          FROM display_template dt
          JOIN display_template_line dtl ON dt.template_id = dtl.template_id
          WHERE dt.tenant_id = $1 AND dt.template_type = 'E' AND dt.activity_type = $2 AND dt.is_active = true
          ORDER BY dtl.line_number
        `;
        const efficientResult = await dbClient.query(efficientQuery, [tenantId, activity.activity_type]);
        if (efficientResult.rows.length > 0) {
          efficientTemplate = efficientResult.rows.map(row => row.template_string);
          console.log(`Activity ${activity.activity_id}: Loaded Efficient template for type=${activity.activity_type}`);
        }
      } catch (e) {
        console.log(`Activity ${activity.activity_id}: No Efficient template for type=${activity.activity_type}`);
      }
      
      try {
        const verboseQuery = `
          SELECT dt.template_id, dt.template_name, dtl.line_number, dtl.template_string
          FROM display_template dt
          JOIN display_template_line dtl ON dt.template_id = dtl.template_id
          WHERE dt.tenant_id = $1 AND dt.template_type = 'V' AND dt.activity_type = $2 AND dt.is_active = true
          ORDER BY dtl.line_number
        `;
        const verboseResult = await dbClient.query(verboseQuery, [tenantId, activity.activity_type]);
        if (verboseResult.rows.length > 0) {
          verboseTemplate = verboseResult.rows.map(row => row.template_string);
          console.log(`Activity ${activity.activity_id}: Loaded Verbose template for type=${activity.activity_type}`);
        }
      } catch (e) {
        console.log(`Activity ${activity.activity_id}: No Verbose template for type=${activity.activity_type}`);
      }
      
      // Decode each molecule
      const decodedValues = {};
      const decodedDescriptions = {}; // For lookup molecule descriptions
      
      for (const detail of details) {
        try {
          // Always get the code
          const moleculeKey = detail.molecule_key;
          decodedValues[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id);
          
          // For lookup molecules, also get description
          try {
            const molDef = await getMolecule(moleculeKey, tenantId);
            if (molDef.value_kind === 'lookup') {
              // Query molecule_value_lookup to get the code_column
              const lookupQuery = `
                SELECT code_column 
                FROM molecule_value_lookup 
                WHERE molecule_id = $1
              `;
              const lookupResult = await dbClient.query(lookupQuery, [molDef.molecule_id]);
              
              if (lookupResult.rows.length > 0) {
                const codeColumn = lookupResult.rows[0].code_column;
                // Derive description column: "redemption_code" -> "redemption_description"
                const descColumn = codeColumn.replace('_code', '_description');
                
                console.log(`Decoding ${moleculeKey}: code=${codeColumn}, desc=${descColumn}`);
                
                decodedDescriptions[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id, descColumn);
              }
            }
          } catch (e) {
            console.error(`Error getting description for ${moleculeKey}:`, e.message);
            // Not a lookup or error getting description - skip
          }
          
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
        point_type: pointTypeMolecule.value || 'miles'
      };
      
      // Get display config from activity_display molecule for this activity type
      try {
        const displayMolecule = await getMolecule('activity_display', tenantId, activity.activity_type);
        
        // Convert embedded_list rows to config object
        const displayConfig = {};
        if (displayMolecule.values) {
          displayMolecule.values.forEach(row => {
            displayConfig[row.value] = row.label; // value=code, label=description
          });
        }
        
        // Apply display properties
        result.activity_icon = displayConfig.icon || '📋';
        result.activity_color = displayConfig.color || '#059669';
        result.activity_bg_color = displayConfig.bg_color || '#f0fdf4';
        result.activity_border_color = displayConfig.border_color || '#059669';
        result.activity_show_bonuses = displayConfig.show_bonuses === 'true';
        result.activity_action_verb = displayConfig.action_verb || 'Added';
        
        // Get label: 'A' from activity_type_label molecule, others from display config
        if (activity.activity_type === 'A') {
          result.activity_type_label = activityTypeMolecule.value || 'Activity';
        } else {
          result.activity_type_label = displayConfig.label || 'Activity';
        }
      } catch (error) {
        console.error('Error loading display config:', error);
        // Fallback
        result.activity_icon = '📋';
        result.activity_type_label = 'Activity';
      }
      
      result.title = `Activity ${baseMiles.toLocaleString()}`;
      
      // Add decoded molecule values to result
      if (decodedValues.carrier) result.carrier_code = decodedValues.carrier;
      if (decodedValues.origin) result.origin = decodedValues.origin;
      if (decodedValues.destination) result.destination = decodedValues.destination;
      if (decodedValues.fare_class) result.fare_class = decodedValues.fare_class;
      if (decodedValues.flight_number) result.flight_no = decodedValues.flight_number;
      
      // Helper function to render a template
      const renderTemplate = (template) => {
        const rendered = [];
        template.forEach((templateString, index) => {
          let line = templateString;
          
          // Replace [M,key,"format",maxLength] with decoded values
          line = line.replace(/\[M,(\w+),"(Code|Description|Both)"(?:,(\d+))?\]/g, (match, key, format, maxLength) => {
            const code = decodedValues[key];
            const description = decodedDescriptions[key];
            
            if (!code) return '';
            
            let output = '';
            if (format === 'Code') {
              output = code;
            } else if (format === 'Description') {
              output = description || code; // Fallback to code if no description
            } else if (format === 'Both') {
              // Show "CODE Description" if we have description, otherwise just code
              output = description ? `${code} ${description}` : code;
            }
            
            // Apply max length if specified
            if (maxLength && output.length > parseInt(maxLength)) {
              output = output.substring(0, parseInt(maxLength));
            }
            
            return output;
          });
          
          // Replace [T,"text"] with literal text
          line = line.replace(/\[T,"([^"]+)"\]/g, (match, text) => {
            // Convert spaces to &nbsp; to preserve them in HTML rendering
            return text.replace(/ /g, '&nbsp;');
          });
          
          // Remove structural commas
          line = line.replace(/,/g, '');
          
          if (line.trim()) {
            rendered.push({ label: `Line ${index + 1}`, value: line.trim() });
          }
        });
        return rendered;
      };
      
      // Build magic_box for both Efficient and Verbose templates
      if (efficientTemplate && efficientTemplate.length > 0) {
        result.magic_box_efficient = renderTemplate(efficientTemplate);
      } else {
        // Fallback efficient format
        result.magic_box_efficient = [];
        if (decodedValues.origin) {
          result.magic_box_efficient.push({ label: 'Origin', value: decodedValues.origin });
        }
        if (decodedValues.destination) {
          result.magic_box_efficient.push({ label: 'Destination', value: decodedValues.destination });
        }
        if (decodedValues.carrier) {
          const flightDisplay = decodedValues.flight_number 
            ? `${decodedValues.carrier}${decodedValues.flight_number}` 
            : decodedValues.carrier;
          result.magic_box_efficient.push({ label: 'Carrier', value: flightDisplay });
        }
        if (decodedValues.fare_class) {
          result.magic_box_efficient.push({ label: 'Class', value: decodedValues.fare_class });
        }
      }
      
      if (verboseTemplate && verboseTemplate.length > 0) {
        result.magic_box_verbose = renderTemplate(verboseTemplate);
      } else {
        // Fallback verbose format (same as efficient for now)
        result.magic_box_verbose = result.magic_box_efficient;
      }
      
      // Keep legacy magic_box as efficient for backwards compatibility
      result.magic_box = result.magic_box_efficient;
      
      // Special handling for partner activities (activity_type='P')
      if (activity.activity_type === 'P') {
        // Build simple format: "Partner: [partner_code] [program_code]"
        const partnerCode = decodedValues.partner || '';
        const programCode = decodedValues.partner_program || '';
        
        result.magic_box = [{
          label: 'Partner',
          value: `${partnerCode} ${programCode}`.trim()
        }];
        result.magic_box_efficient = result.magic_box;
        result.magic_box_verbose = result.magic_box;
      }
      
      // Special handling for adjustment activities (activity_type='J')
      if (activity.activity_type === 'J') {
        // Build simple format: "Adjustment: [adjustment_code]"
        const adjustmentCode = decodedValues.adjustment || '';
        
        result.magic_box = [{
          label: 'Adjustment',
          value: adjustmentCode
        }];
        result.magic_box_efficient = result.magic_box;
        result.magic_box_verbose = result.magic_box;
      }
      
      // Special handling for promotion reward activities (activity_type='M')
      if (activity.activity_type === 'M') {
        // Build format: "Qualified Promotion: [promotion_code] [promotion_name]"
        const promotionCode = decodedValues.promotion || '';
        const promotionName = decodedDescriptions.promotion || '';
        
        result.magic_box = [{
          label: 'Qualified Promotion',
          value: promotionName ? `${promotionCode} ${promotionName}` : promotionCode
        }];
        result.magic_box_efficient = result.magic_box;
        result.magic_box_verbose = result.magic_box;
      }
      
      // Special handling for redemptions (activity_type='R')
      // Decode redemption molecule from activity_detail
      if (activity.activity_type === 'R' && decodedValues.redemption) {
        try {
          // decodeMolecule returns code by default
          result.redemption_code = decodedValues.redemption;
          
          // Get description by decoding again with specific column
          const redemptionDetail = details.find(d => d.molecule_key === 'redemption');
          if (redemptionDetail) {
            result.redemption_description = await decodeMolecule(
              tenantId, 
              'redemption', 
              redemptionDetail.v_ref_id, 
              'redemption_description'
            );
          }
          
          // Get redemption aging breakdown
          const agingQuery = `
            SELECT 
              pl.expire_date,
              rd.points_used
            FROM redemption_detail rd
            JOIN point_lot pl ON rd.lot_id = pl.lot_id
            WHERE rd.activity_id = $1
            ORDER BY pl.expire_date
          `;
          const agingResult = await dbClient.query(agingQuery, [activity.activity_id]);
          
          // Group by expire_date and sum points
          const agingMap = new Map();
          agingResult.rows.forEach(row => {
            const dateKey = row.expire_date.toISOString().slice(0, 10);
            agingMap.set(dateKey, (agingMap.get(dateKey) || 0) + Number(row.points_used));
          });
          
          // Convert to array for frontend
          result.redemption_aging = Array.from(agingMap.entries()).map(([date, points]) => ({
            expire_date: date,
            points_used: points
          }));
          
        } catch (error) {
          console.error('Error loading redemption details:', error);
        }
      }
      
      // Special handling for promotions (activity_type='M')
      if (activity.activity_type === 'M') {
        try {
          console.log(`   Fetching promotion details for activity ${activity.activity_id}`);
          // Get promotion info from member_promotion_detail
          const promoQuery = `
            SELECT p.promotion_code, p.promotion_name
            FROM member_promotion_detail mpd
            JOIN member_promotion mp ON mpd.member_promotion_id = mp.member_promotion_id
            JOIN promotion p ON mp.promotion_id = p.promotion_id
            WHERE mpd.activity_id = $1
          `;
          const promoResult = await dbClient.query(promoQuery, [activity.activity_id]);
          console.log(`   Promotion query returned ${promoResult.rows.length} rows`);
          
          if (promoResult.rows.length > 0) {
            const promo = promoResult.rows[0];
            console.log(`   Promotion: ${promo.promotion_code} - ${promo.promotion_name}`);
            result.promotion_code = promo.promotion_code;
            result.promotion_name = promo.promotion_name;
            
            result.magic_box = [{
              label: 'Qualified Promotion',
              value: `${promo.promotion_code} ${promo.promotion_name}`
            }];
            result.magic_box_efficient = result.magic_box;
            result.magic_box_verbose = result.magic_box;
          } else {
            console.log(`   ⚠️  No promotion detail found for activity ${activity.activity_id}`);
          }
        } catch (error) {
          console.error('Error loading promotion details:', error);
        }
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

    const result = await dbClient.query(query, [
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

    const result = await dbClient.query(query, [
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

    const result = await dbClient.query(query, [tierId, memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier assignment not found' });
    }

    res.json({ success: true, deleted_id: tierId });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Member profile information
app.get('/v1/member/:id/profile', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const memberId = req.params.id;

  try {
    // Get member profile with all fields
    const memberQuery = `
      SELECT 
        m.member_id,
        m.membership_number,
        m.tenant_id,
        m.fname,
        m.lname,
        m.middle_initial,
        m.email,
        m.phone,
        m.address1,
        m.address2,
        m.city,
        m.state,
        m.zip,
        m.zip_plus4,
        m.is_active
      FROM member m
      WHERE m.member_id = $1
    `;
    
    const memberResult = await dbClient.query(memberQuery, [memberId]);
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    const member = memberResult.rows[0];
    
    // Get current tier
    const today = new Date().toISOString().slice(0, 10);
    const tierResult = await getMemberTierOnDate(memberId, today);
    const currentTier = tierResult ? tierResult.tier_description : null;
    
    // Get available miles from point_lot
    const milesQuery = `
      SELECT COALESCE(SUM(accrued - redeemed), 0) as available_miles
      FROM point_lot
      WHERE member_id = $1::BIGINT
        AND (expire_date IS NULL OR expire_date >= $2)
    `;
    const milesResult = await dbClient.query(milesQuery, [memberId, today]);
    const availableMiles = Number(milesResult.rows[0]?.available_miles || 0);
    
    // Build profile response
    const profile = {
      member_id: member.member_id,
      membership_number: member.membership_number,
      fname: member.fname,
      lname: member.lname,
      middle_initial: member.middle_initial,
      email: member.email,
      phone: member.phone,
      address1: member.address1,
      address2: member.address2,
      city: member.city,
      state: member.state,
      postal_code: member.zip,
      country: null,  // Not in schema yet
      is_active: member.is_active !== false,
      current_tier: currentTier,
      available_miles: availableMiles
    };
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching member profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update member profile
app.put('/v1/member/:id/profile', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const memberId = req.params.id;
  const {
    membership_number,
    fname,
    lname,
    middle_initial,
    email,
    phone,
    address1,
    address2,
    city,
    state,
    zip,
    zip_plus4,
    is_active
  } = req.body;

  // Validation
  if (!fname || !lname) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  try {
    const updateQuery = `
      UPDATE member
      SET
        membership_number = $1,
        fname = $2,
        lname = $3,
        middle_initial = $4,
        email = $5,
        phone = $6,
        address1 = $7,
        address2 = $8,
        city = $9,
        state = $10,
        zip = $11,
        zip_plus4 = $12,
        is_active = $13
      WHERE member_id = $14
      RETURNING *
    `;

    const result = await dbClient.query(updateQuery, [
      membership_number,
      fname,
      lname,
      middle_initial,
      email,
      phone,
      address1,
      address2,
      city,
      state,
      zip,
      zip_plus4,
      is_active !== false,
      memberId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating member profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Search members by ID, email, name, or phone
app.get('/v1/member/search', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.json([]);
  }

  const searchTerm = q.trim();
  console.log(`🔍 Member search for: "${searchTerm}"`);

  try {
    // Search by membership_number, email, fname, lname, or phone
    const searchQuery = `
      SELECT 
        m.member_id,
        m.membership_number,
        m.fname,
        m.lname,
        m.middle_initial,
        m.email,
        m.phone,
        m.is_active
      FROM member m
      WHERE 
        m.membership_number ILIKE $1
        OR m.email ILIKE $1
        OR m.fname ILIKE $1
        OR m.lname ILIKE $1
        OR m.phone ILIKE $1
        OR CONCAT(m.fname, ' ', m.lname) ILIKE $1
      LIMIT 50
    `;
    
    const result = await dbClient.query(searchQuery, [`%${searchTerm}%`]);
    console.log(`  ✅ Found ${result.rows.length} members`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('  ❌ Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/admin/databases/current/members - Get members for stress testing
app.get('/v1/admin/databases/current/members', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await dbClient.query(`
      SELECT member_id, membership_number, fname, lname
      FROM member
      WHERE is_active = true
      ORDER BY member_id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json({ members: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching members:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET - Look up tier on specific date
app.get('/v1/member/:id/tiers/on-date', async (req, res) => {
  const memberId = req.params.id;
  const { date } = req.query;

  try {
    const tier = await getMemberTierOnDate(memberId, date);
    res.json(tier);
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
    const tenantId = req.query.tenant_id || '1';
    
    const query = `
      SELECT 
        tier_id,
        tier_code,
        tier_description,
        tier_ranking,
        is_active
      FROM tier_definition
      WHERE is_active = true
        AND tenant_id = $1
      ORDER BY tier_ranking DESC
    `;

    const result = await dbClient.query(query, [tenantId]);
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
    const tenantId = req.body.tenant_id || 1; // Get from request or default to 1

    console.log(`\n🧪 Testing rule for bonus: ${bonusCode}`);
    console.log('   Activity data:', activityData);
    console.log('   Tenant ID:', tenantId);

    // Step 1: Look up bonus by code
    const bonusQuery = `
      SELECT bonus_id, bonus_code, bonus_description, bonus_type, bonus_amount,
             start_date, end_date, is_active, rule_id,
             apply_sunday, apply_monday, apply_tuesday, apply_wednesday,
             apply_thursday, apply_friday, apply_saturday
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

    // Collect all failures instead of returning early
    const allFailures = [];

    // Step 2: Check if bonus is active
    if (!bonus.is_active) {
      console.log(`   ❌ FAIL: Bonus is not active`);
      allFailures.push('Bonus is not active');
    } else {
      console.log(`   ✓ Bonus is active`);
    }

    // Step 3: Check date range (compare dates only, ignore time)
    const activityDate = new Date(activityData.activity_date);
    const startDate = new Date(bonus.start_date);
    const endDate = new Date(bonus.end_date);
    
    // Normalize to date-only comparison (set all to midnight UTC)
    activityDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    if (activityDate < startDate || activityDate > endDate) {
      console.log(`   ❌ FAIL: Activity date ${activityData.activity_date} outside range ${bonus.start_date} to ${bonus.end_date}`);
      allFailures.push(`Activity date ${activityData.activity_date} is outside bonus date range (${bonus.start_date} to ${bonus.end_date})`);
    } else {
      console.log(`   ✓ Activity date within range`);
    }

    // Step 3.5: Check day of week
    const dayOfWeek = activityDate.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    const dayColumns = ['apply_sunday', 'apply_monday', 'apply_tuesday', 'apply_wednesday', 
                        'apply_thursday', 'apply_friday', 'apply_saturday'];
    const dayColumn = dayColumns[dayOfWeek];
    
    if (!bonus[dayColumn]) {
      console.log(`   ❌ FAIL: Activity is on ${dayName} but bonus does not apply on this day`);
      allFailures.push(`Activity is on ${dayName} but bonus only applies on selected days`);
    } else {
      console.log(`   ✓ Day of week matches (${dayName})`);
    }

    // Step 4: Load rule criteria (if rule_id exists)
    if (!bonus.rule_id) {
      console.log(`   ✓ No criteria defined`);
      // Check if there were any header failures
      if (allFailures.length > 0) {
        return res.json({
          pass: false,
          reason: allFailures.join('\n        ')
        });
      }
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
      console.log(`   ✓ No criteria found`);
      // Check if there were any header failures
      if (allFailures.length > 0) {
        return res.json({
          pass: false,
          reason: allFailures.join('\n        ')
        });
      }
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

      } else if (moleculeDef.value_kind === 'reference') {
        // REFERENCE TYPE: resolve from target table
        console.log(`   → Reference molecule: ${criterion.molecule_key}`);
        
        // For test-rule, we need member_id - but this is a test endpoint with sample data
        // So we'll need to get it from the request body if provided
        const memberId = req.body.member_id || null;
        
        if (!memberId) {
          console.log(`   ⚠ No member_id provided for reference molecule - skipping`);
          failures.push(`${criterion.label} - Failed (no member context)`);
          continue;
        }
        
        const refContext = { member_id: memberId };
        const activityDate = activityData.activity_date || null;
        const resolvedValue = await getMoleculeValue(tenantId, criterion.molecule_key, refContext, activityDate);
        
        console.log(`   → Resolved reference value: "${resolvedValue}"`);
        console.log(`   → Criterion expects: "${criterionValue}"`);
        
        if (criterion.operator === 'equals' || criterion.operator === '=') {
          if (resolvedValue !== criterionValue) {
            console.log(`   ❌ Criterion failed: ${criterion.label}`);
            failures.push(`${criterion.label} - Failed`);
          } else {
            console.log(`   ✓ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          }
        } else if (criterion.operator === 'contains') {
          const resolved = String(resolvedValue || '').toLowerCase();
          const target = String(criterionValue || '').toLowerCase();
          if (!resolved.includes(target)) {
            console.log(`   ❌ Criterion failed: "${resolved}" does not contain "${target}"`);
            failures.push(`${criterion.label} - Failed`);
          } else {
            console.log(`   ✓ Criterion passed: "${resolved}" contains "${target}"`);
            criterionPassed = true;
            hasAnyPass = true;
          }
        }

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
        // Still check if there were header failures
        if (allFailures.length > 0) {
          return res.json({ 
            pass: false, 
            reason: allFailures.join('\n        ')
          });
        }
        return res.json({ pass: true });
      } else {
        // All criteria failed - combine with header failures
        console.log(`   ❌ FAIL: All criteria failed (OR logic)`);
        allFailures.push(...failures);
        const formattedFailures = allFailures.map((f, index) => {
          return index === 0 ? f : `        ${f}`;
        });
        return res.json({
          pass: false,
          reason: formattedFailures.join('\n')
        });
      }
    } else {
      // AND logic (or no joiner): ALL must pass
      if (failures.length > 0 || allFailures.length > 0) {
        console.log(`   ❌ FAIL: Criteria or header checks failed (AND logic)`);
        // Combine header failures with criteria failures
        const combinedFailures = [...allFailures, ...failures];
        const formattedFailures = combinedFailures.map((f, index) => {
          return index === 0 ? f : `        ${f}`;
        });
        return res.json({
          pass: false,
          reason: formattedFailures.join('\n')
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

// ===== PROMOTION BLACK BOX =====
// Reusable function to check if an activity qualifies for a promotion
// Follows the same pattern as evaluateBonuses()
// testMode = false: Production mode (fail-fast with early return)
// testMode = true: Test mode (collect all failures for UI display)
async function checkPromotionQualification(activityId, activityDate, promotionCode, memberId, testMode = false) {
  console.log(`\n🎯 Checking promotion qualification: ${promotionCode}`);
  console.log(`   Activity ID: ${activityId}, Member ID: ${memberId}`);
  console.log(`   Activity Date: ${activityDate}`);
  console.log(`   Test Mode: ${testMode ? 'YES (full validation)' : 'NO (fail-fast)'}`);

  const failures = []; // Track failures in test mode

  try {
    // Step 1: Look up promotion by code
    const promotionQuery = `
      SELECT promotion_id, promotion_code, promotion_name, promotion_description,
             count_type, goal_amount, reward_type, reward_amount,
             start_date, end_date, is_active, enrollment_type, rule_id
      FROM promotion
      WHERE promotion_code = $1
    `;
    const promotionResult = await dbClient.query(promotionQuery, [promotionCode]);

    if (promotionResult.rows.length === 0) {
      console.log(`   ❌ Promotion not found: ${promotionCode}`);
      return { pass: false, reason: `Promotion '${promotionCode}' not found` };
    }

    const promotion = promotionResult.rows[0];
    console.log(`   ✓ Promotion found: ${promotion.promotion_name}`);
    
    const isRestricted = promotion.enrollment_type === 'R';

    // Step 2: Check if promotion is active
    if (!promotion.is_active) {
      console.log(`   ❌ SKIP - Promotion is not active`);
      const failureMsg = 'Promotion is not active';
      
      if (testMode) {
        failures.push(failureMsg);
      } else {
        return { pass: false, reason: failureMsg };
      }
    } else {
      console.log(`   ✅ PASS - Promotion is active`);
    }

    // Step 3: Check date range
    const actDate = new Date(activityDate);
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);
    
    // Normalize to date-only comparison
    actDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    const isInDateRange = actDate >= startDate && actDate <= endDate;

    if (!isInDateRange) {
      console.log(`   ❌ SKIP - Activity date outside promotion range`);
      const failureMsg = `Activity date ${activityDate} is outside promotion range (${promotion.start_date} to ${promotion.end_date})`;
      
      if (testMode) {
        failures.push(failureMsg);
      } else {
        return { pass: false, reason: failureMsg };
      }
    } else {
      console.log(`   ✅ PASS - Activity date within range`);
    }

    // Step 4: Check if member is enrolled (for restricted promotions)
    if (isRestricted) {
      console.log(`   → Checking enrollment for restricted promotion...`);
      const enrollmentQuery = `
        SELECT member_promotion_id
        FROM member_promotion
        WHERE member_id = $1 AND promotion_id = $2
      `;
      const enrollmentResult = await dbClient.query(enrollmentQuery, [memberId, promotion.promotion_id]);
      
      if (enrollmentResult.rows.length === 0) {
        console.log(`   ❌ SKIP - Member not enrolled in restricted promotion`);
        const failureMsg = 'Member not enrolled in this promotion';
        
        if (testMode) {
          failures.push(failureMsg);
        } else {
          return { pass: false, reason: failureMsg };
        }
      } else {
        console.log(`   ✅ PASS - Member is enrolled`);
      }
    } else {
      console.log(`   ✓ Promotion is not restricted`);
    }

    // Step 5: Check rule criteria (if rule_id exists)
    if (!promotion.rule_id) {
      console.log(`   ✓ No criteria defined`);
      
      // Check if we had any header failures
      if (testMode && failures.length > 0) {
        return { pass: false, reason: failures.join('; ') };
      }
      
      if (failures.length > 0) {
        return { pass: false, reason: failures.join('; ') };
      }
      
      return { pass: true, promotion_id: promotion.promotion_id };
    }

    console.log(`   → Checking criteria for rule_id: ${promotion.rule_id}`);

    // Get tenant_id from member
    const memberQuery = `SELECT tenant_id FROM member WHERE member_id = $1`;
    const memberResult = await dbClient.query(memberQuery, [memberId]);
    const tenantId = memberResult.rows[0]?.tenant_id || 1;
    
    console.log(`   → Tenant ID: ${tenantId}`);

    // Get activity data from activity_detail
    const activityDetailQuery = `
      SELECT 
        md.molecule_key,
        ad.v_ref_id
      FROM activity_detail ad
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id
      WHERE ad.activity_id = $1
    `;
    const detailResult = await dbClient.query(activityDetailQuery, [activityId]);
    
    console.log(`   → Found ${detailResult.rows.length} activity detail rows`);

    // Build activityData object using decodeMolecule
    const activityData = { activity_date: activityDate };
    for (const row of detailResult.rows) {
      try {
        activityData[row.molecule_key] = await decodeMolecule(tenantId, row.molecule_key, row.v_ref_id);
      } catch (error) {
        console.error(`Error decoding ${row.molecule_key}:`, error.message);
        activityData[row.molecule_key] = `[decode error]`;
      }
    }
    
    console.log(`   → Activity data:`, activityData);

    // Load criteria for this rule
    const criteriaQuery = `
      SELECT criteria_id, molecule_key, operator, value, label, joiner
      FROM rule_criteria
      WHERE rule_id = $1
      ORDER BY sort_order
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [promotion.rule_id]);
    
    console.log(`   → Found ${criteriaResult.rows.length} criteria to check`);

    if (criteriaResult.rows.length === 0) {
      console.log(`   ⚠️  SKIP - Rule has no criteria defined`);
      const failureMsg = 'Rule has no criteria defined';
      
      if (testMode) {
        failures.push(failureMsg);
      } else {
        return { pass: false, reason: failureMsg };
      }
    }

    // Evaluate each criterion
    let hasAnyPass = false;
    let hasOrJoiner = false;

    for (const criterion of criteriaResult.rows) {
      if (criterion.joiner === 'OR') {
        hasOrJoiner = true;
      }

      console.log(`\n   Evaluating: ${criterion.label}`);
      console.log(`   → Molecule: ${criterion.molecule_key}`);
      console.log(`   → Operator: ${criterion.operator}`);

      // Get molecule definition
      const molDefQuery = `
        SELECT value_kind, scalar_type, lookup_table_key
        FROM molecule_def
        WHERE molecule_key = $1
      `;
      const molDefResult = await dbClient.query(molDefQuery, [criterion.molecule_key]);

      if (molDefResult.rows.length === 0) {
        console.log(`   ⚠️  Molecule not found: ${criterion.molecule_key}`);
        const failureMsg = `Molecule ${criterion.molecule_key} not found`;
        
        if (testMode) {
          failures.push(failureMsg);
          continue;
        } else {
          return { pass: false, reason: failureMsg };
        }
      }

      const moleculeDef = molDefResult.rows[0];
      const criterionValue = criterion.value;
      const activityValue = activityData[criterion.molecule_key];

      console.log(`   → Expected: ${JSON.stringify(criterionValue)}`);
      console.log(`   → Activity has: ${JSON.stringify(activityValue)}`);

      let criterionPassed = false;

      if (moleculeDef.value_kind === 'lookup') {
        // LOOKUP TYPE: compare codes
        if (activityValue === criterionValue) {
          console.log(`   ✅ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        } else {
          console.log(`   ❌ Criterion failed: ${criterion.label}`);
          const failureMsg = `${criterion.label} - Failed (expected: ${criterionValue}, got: ${activityValue})`;
          
          if (testMode) {
            failures.push(failureMsg);
          } else {
            // Fail-fast in production mode
            return { pass: false, reason: failureMsg };
          }
        }
      } else if (moleculeDef.value_kind === 'scalar') {
        // SCALAR TYPE: direct comparison
        if (criterion.operator === 'equals' || criterion.operator === '=') {
          if (activityValue === criterionValue) {
            console.log(`   ✅ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          } else {
            console.log(`   ❌ Criterion failed: ${criterion.label}`);
            const failureMsg = `${criterion.label} - Failed (not equal to ${criterionValue})`;
            
            if (testMode) {
              failures.push(failureMsg);
            } else {
              return { pass: false, reason: failureMsg };
            }
          }
        } else if (criterion.operator === 'greater_than' || criterion.operator === '>') {
          if (activityValue > criterionValue) {
            console.log(`   ✅ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          } else {
            console.log(`   ❌ Criterion failed: ${criterion.label}`);
            const failureMsg = `${criterion.label} - Failed (not greater than ${criterionValue})`;
            
            if (testMode) {
              failures.push(failureMsg);
            } else {
              return { pass: false, reason: failureMsg };
            }
          }
        }
      }
    }

    // Final determination based on joiner logic
    if (hasOrJoiner) {
      // OR logic: at least one criterion must pass
      if (!hasAnyPass) {
        console.log(`\n   ❌ FINAL RESULT: FAIL (OR logic - no criteria passed)`);
        return { 
          pass: false, 
          reason: failures.length > 0 ? failures.join('; ') : 'No criteria matched (OR logic)' 
        };
      }
    } else {
      // AND logic: all criteria must pass (no failures)
      if (failures.length > 0) {
        console.log(`\n   ❌ FINAL RESULT: FAIL (AND logic - some criteria failed)`);
        return { pass: false, reason: failures.join('; ') };
      }
    }

    console.log(`\n   ✅ FINAL RESULT: PASS`);
    return { 
      pass: true, 
      promotion_id: promotion.promotion_id 
    };

  } catch (error) {
    console.error('Error in checkPromotionQualification:', error);
    return { pass: false, reason: error.message };
  }
}

// ===== PROMOTION EVALUATION ENGINE =====
// Main function to evaluate all active promotions for an activity
// Called during activity processing to update member progress
async function evaluatePromotions(activityId, activityDate, memberId, tenantId) {
  if (!dbClient) {
    console.log('No database connection - skipping promotion evaluation');
    return [];
  }

  try {
    console.log(`\n🎯 PROMOTION ENGINE: Evaluating promotions for activity ${activityId}`);
    console.log(`   Member ID: ${memberId}, Activity Date: ${activityDate}`);

    // Query ALL ACTIVE promotions (both automatic and restricted)
    const promotionQuery = `
      SELECT 
        p.promotion_id,
        p.promotion_code,
        p.promotion_name,
        p.enrollment_type,
        p.count_type,
        p.counter_molecule_id,
        p.goal_amount,
        p.reward_type,
        p.reward_amount,
        p.reward_tier_id,
        p.reward_promotion_id
      FROM promotion p
      WHERE p.is_active = true
      ORDER BY p.promotion_code
    `;

    const promotionResult = await dbClient.query(promotionQuery);
    const activePromotions = promotionResult.rows;

    console.log(`   Found ${activePromotions.length} ACTIVE promotions to evaluate`);

    const updatedPromotions = [];

    // Walk through each active promotion
    for (const promotion of activePromotions) {
      console.log(`\n   → Checking promotion: ${promotion.promotion_code} (${promotion.promotion_name})`);
      
      // Use the black box to check qualification (testMode=false for fail-fast)
      const qualificationResult = await checkPromotionQualification(
        activityId, 
        activityDate, 
        promotion.promotion_code, 
        memberId, 
        false  // Production mode - fail fast
      );

      if (!qualificationResult.pass) {
        console.log(`      ❌ SKIP - ${qualificationResult.reason}`);
        continue;
      }

      console.log(`      ✅ PASS - Activity qualifies for this promotion!`);

      // Activity qualifies - update member progress
      try {
        // Find or create member_promotion record
        const memberPromotionQuery = `
          SELECT member_promotion_id, progress_counter, goal_amount, qualify_date
          FROM member_promotion
          WHERE member_id = $1 AND promotion_id = $2
        `;
        const memberPromotionResult = await dbClient.query(memberPromotionQuery, [memberId, promotion.promotion_id]);

        let memberPromotion;
        let isNewEnrollment = false;

        if (memberPromotionResult.rows.length === 0) {
          // Create new member_promotion record
          console.log(`      → Creating new member_promotion record`);
          
          const insertQuery = `
            INSERT INTO member_promotion (
              member_id, 
              promotion_id,
              tenant_id, 
              enrolled_date, 
              progress_counter, 
              goal_amount
            )
            VALUES ($1, $2, $3, CURRENT_DATE, 0, $4)
            RETURNING member_promotion_id, progress_counter, goal_amount, qualify_date
          `;
          const insertResult = await dbClient.query(insertQuery, [memberId, promotion.promotion_id, tenantId, promotion.goal_amount]);
          memberPromotion = insertResult.rows[0];
          isNewEnrollment = true;
        } else {
          memberPromotion = memberPromotionResult.rows[0];
          
          // Check if already qualified
          if (memberPromotion.qualify_date) {
            console.log(`      ⚠️  SKIP - Member already qualified on ${memberPromotion.qualify_date}`);
            continue;  // Just skip this promotion, don't rollback the transaction!
          }
        }

        // Determine increment amount based on count_type
        let incrementAmount = 0;
        if (promotion.count_type === 'flights') {
          incrementAmount = 1; // One flight
        } else if (promotion.count_type === 'miles') {
          // Get point_amount from activity
          const activityQuery = `SELECT point_amount FROM activity WHERE activity_id = $1`;
          const activityResult = await dbClient.query(activityQuery, [activityId]);
          incrementAmount = Number(activityResult.rows[0]?.point_amount || 0);
        } else if (promotion.count_type === 'molecules' && promotion.counter_molecule_id) {
          // Molecule-based counting - get value from activity_detail
          const moleculeId = promotion.counter_molecule_id;
          const moleculeQuery = `
            SELECT v_ref_id FROM activity_detail 
            WHERE activity_id = $1 AND molecule_id = $2
          `;
          const moleculeResult = await dbClient.query(moleculeQuery, [activityId, moleculeId]);
          if (moleculeResult.rows.length > 0) {
            incrementAmount = Number(moleculeResult.rows[0].v_ref_id || 0);
          }
          console.log(`      → Molecule ${moleculeId} value: ${incrementAmount}`);
        }

        console.log(`      → Increment: ${incrementAmount} (count_type: ${promotion.count_type})`);

        // Update progress counter (convert to number to avoid string concatenation)
        const currentProgress = Number(memberPromotion.progress_counter);
        const newProgress = currentProgress + incrementAmount;
        console.log(`      → Progress: ${currentProgress} + ${incrementAmount} = ${newProgress} / ${memberPromotion.goal_amount}`);

        const updateQuery = `
          UPDATE member_promotion
          SET progress_counter = $1
          WHERE member_promotion_id = $2
        `;
        await dbClient.query(updateQuery, [newProgress, memberPromotion.member_promotion_id]);

        // Track this activity's contribution to the promotion
        const detailInsert = `
          INSERT INTO member_promotion_detail (member_promotion_id, activity_id, contribution_amount)
          VALUES ($1, $2, $3)
        `;
        await dbClient.query(detailInsert, [memberPromotion.member_promotion_id, activityId, incrementAmount]);
        console.log(`      ✓ Logged contribution: activity ${activityId} contributed ${incrementAmount} to promotion`);

        // Check if goal reached (convert to numbers for proper comparison)
        const goalAmount = Number(memberPromotion.goal_amount);
        if (newProgress >= goalAmount) {
          console.log(`      🎉 GOAL REACHED! Qualifying member...`);
          
          const qualifyQuery = `
            UPDATE member_promotion
            SET qualify_date = CURRENT_DATE
            WHERE member_promotion_id = $1
          `;
          await dbClient.query(qualifyQuery, [memberPromotion.member_promotion_id]);

          // Award reward
          console.log(`      → Reward: ${promotion.reward_type} (amount: ${promotion.reward_amount})`);
          
          if (promotion.reward_type === 'points' && promotion.reward_amount > 0) {
            const rewardPoints = Number(promotion.reward_amount);
            
            // Add points to lot (handles expiration automatically)
            const lotResult = await addPointsToLot(memberId, activityDate, rewardPoints);
            
            // Create promotion reward activity
            const activityQuery = `
              INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount, lot_id)
              VALUES ($1, $2, CURRENT_DATE, 'M', $3, $4)
              RETURNING activity_id
            `;
            const activityResult = await dbClient.query(activityQuery, [
              memberId,
              activityDate,
              rewardPoints,
              lotResult.lot_id
            ]);
            const rewardActivityId = activityResult.rows[0].activity_id;
            
            // Get molecule IDs for linking
            const memberPromotionMoleculeId = await getMoleculeId(tenantId, 'member_promotion');
            const promotionMoleculeId = await getMoleculeId(tenantId, 'promotion');

            // Link activity to member_promotion (enrollment instance)
            await dbClient.query(
              'INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [rewardActivityId, memberPromotionMoleculeId, memberPromotion.member_promotion_id]
            );

            // Link activity to promotion (for code and description)
            await dbClient.query(
              'INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [rewardActivityId, promotionMoleculeId, promotion.promotion_id]
            );
            
            console.log(`      ✅ Created promotion reward activity ${rewardActivityId}: ${rewardPoints} points, expires ${lotResult.expire_date}`);
          }
          
          // CARRYOVER LOGIC: Handle repeatable promotions
          // If promotion allows repeats and activity exceeded goal, carry overflow to new instance
          const overflow = newProgress - goalAmount;
          const canRepeat = promotion.process_limit_count === null || promotion.process_limit_count > 1;
          
          if (overflow > 0 && canRepeat) {
            console.log(`      🔄 CARRYOVER: Activity exceeded goal by ${overflow}, creating new enrollment instance...`);
            
            // Check if promotion has repeats remaining (if limited)
            if (promotion.process_limit_count !== null) {
              // Count how many times member has qualified
              const countQuery = `
                SELECT COUNT(*) as completion_count
                FROM member_promotion
                WHERE member_id = $1 AND promotion_id = $2 AND qualify_date IS NOT NULL
              `;
              const countResult = await dbClient.query(countQuery, [memberId, promotion.promotion_id]);
              const completionCount = Number(countResult.rows[0].completion_count);
              
              if (completionCount >= promotion.process_limit_count) {
                console.log(`      ⚠️  CARRYOVER SKIPPED: Member reached process_limit_count (${promotion.process_limit_count})`);
                continue;
              }
            }
            
            // Create new enrollment instance with overflow as starting progress
            const newEnrollmentQuery = `
              INSERT INTO member_promotion (
                member_id, 
                promotion_id,
                tenant_id, 
                enrolled_date, 
                progress_counter, 
                goal_amount
              )
              VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
              RETURNING member_promotion_id
            `;
            const newEnrollmentResult = await dbClient.query(newEnrollmentQuery, [
              memberId, 
              promotion.promotion_id, 
              tenantId, 
              overflow,  // Start new instance with overflow amount
              promotion.goal_amount
            ]);
            const newMemberPromotionId = newEnrollmentResult.rows[0].member_promotion_id;
            
            // Create SECOND member_promotion_detail record for same activity
            // This activity contributes to BOTH the completed instance AND the new instance
            await dbClient.query(detailInsert, [newMemberPromotionId, activityId, overflow]);
            
            console.log(`      ✓ Created new enrollment instance ${newMemberPromotionId} with ${overflow} starting progress`);
            console.log(`      ✓ Activity ${activityId} now contributes to TWO instances of this promotion`);
          }
        }

        updatedPromotions.push({
          promotion_code: promotion.promotion_code,
          promotion_name: promotion.promotion_name,
          new_enrollment: isNewEnrollment,
          progress: newProgress,
          goal: memberPromotion.goal_amount,
          qualified: newProgress >= memberPromotion.goal_amount
        });

      } catch (error) {
        console.error(`      ❌ Error updating promotion progress:`, error);
        throw error; // Re-throw so outer transaction can rollback
      }
    }

    console.log(`\n   ✅ Promotion evaluation complete - updated ${updatedPromotions.length} promotions`);
    return updatedPromotions;

  } catch (error) {
    console.error('Error in evaluatePromotions:', error);
    return [];
  }
}

// POST /v1/test-promotion/:promotionCode - Test if activity qualifies for promotion
app.post('/v1/test-promotion/:promotionCode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const promotionCode = req.params.promotionCode;
    const activityId = req.body.activity_id;
    const activityDate = req.body.activity_date;
    const memberId = req.body.member_id || req.body.memberId;

    if (!activityId) {
      return res.status(400).json({ error: 'activity_id is required' });
    }
    
    if (!memberId) {
      return res.status(400).json({ error: 'member_id is required' });
    }

    console.log(`\n🧪 UI Testing promotion: ${promotionCode} for activity ${activityId}`);

    // Use the black box with testMode=true to get ALL failures
    const result = await checkPromotionQualification(activityId, activityDate, promotionCode, memberId, true);

    if (result.pass) {
      return res.json({
        pass: true,
        message: 'Activity qualifies for this promotion'
      });
    } else {
      return res.json({
        pass: false,
        reason: result.reason
      });
    }

  } catch (error) {
    console.error('Error in test-promotion endpoint:', error);
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
        is_active,
        apply_sunday,
        apply_monday,
        apply_tuesday,
        apply_wednesday,
        apply_thursday,
        apply_friday,
        apply_saturday
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
    const { 
      bonus_code, 
      bonus_description, 
      bonus_type, 
      bonus_amount, 
      start_date, 
      end_date, 
      is_active, 
      tenant_id,
      apply_sunday,
      apply_monday,
      apply_tuesday,
      apply_wednesday,
      apply_thursday,
      apply_friday,
      apply_saturday
    } = req.body;
    console.log('Extracted values:', { 
      bonus_code, 
      bonus_description, 
      bonus_type, 
      bonus_amount, 
      start_date, 
      end_date, 
      is_active, 
      tenant_id,
      apply_sunday,
      apply_monday,
      apply_tuesday,
      apply_wednesday,
      apply_thursday,
      apply_friday,
      apply_saturday
    });
    
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
            apply_sunday = $8,
            apply_monday = $9,
            apply_tuesday = $10,
            apply_wednesday = $11,
            apply_thursday = $12,
            apply_friday = $13,
            apply_saturday = $14
        WHERE bonus_code = $15
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
        apply_sunday !== false,
        apply_monday !== false,
        apply_tuesday !== false,
        apply_wednesday !== false,
        apply_thursday !== false,
        apply_friday !== false,
        apply_saturday !== false,
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
        INSERT INTO bonus (
          bonus_code, 
          bonus_description, 
          bonus_type, 
          bonus_amount, 
          start_date, 
          end_date, 
          is_active, 
          tenant_id,
          apply_sunday,
          apply_monday,
          apply_tuesday,
          apply_wednesday,
          apply_thursday,
          apply_friday,
          apply_saturday
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        tenant_id,
        apply_sunday !== false,
        apply_monday !== false,
        apply_tuesday !== false,
        apply_wednesday !== false,
        apply_thursday !== false,
        apply_friday !== false,
        apply_saturday !== false
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
        md.lookup_table_key,
        md.context
      FROM rule_criteria rc
      LEFT JOIN molecule_def md ON rc.molecule_key = md.molecule_key
      WHERE rc.rule_id = $1
      ORDER BY rc.sort_order
    `;
    
    const result = await dbClient.query(criteriaQuery, [ruleId]);
    
    // Transform to include source (Activity or Member) based on molecule context
    const criteria = result.rows.map(row => {
      // Use context from molecule_def, fallback to activity-based guess
      let source = 'Member'; // Default
      if (row.context === 'activity') {
        source = 'Activity';
      } else if (row.context === 'member') {
        source = 'Member';
      }
      
      return {
        id: row.criteria_id,
        source,
        molecule_key: row.molecule_key,
        molecule: row.molecule_key,  // Frontend expects 'molecule' field
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

// ========================================
// REDEMPTION ENDPOINTS
// ========================================

// GET - List all redemptions for tenant
app.get('/v1/redemptions', async (req, res) => {
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
        redemption_id,
        redemption_code,
        redemption_description,
        redemption_type,
        points_required,
        start_date,
        end_date,
        status
      FROM redemption_rule
      WHERE tenant_id = $1
      ORDER BY redemption_code
    `;
    
    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get single redemption
app.get('/v1/redemptions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    const query = `
      SELECT 
        redemption_id,
        redemption_code,
        redemption_description,
        redemption_type,
        points_required,
        start_date,
        end_date,
        status
      FROM redemption_rule
      WHERE redemption_id = $1 AND tenant_id = $2
    `;
    
    const result = await dbClient.query(query, [id, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Redemption not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching redemption:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create redemption
app.post('/v1/redemptions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id } = req.query;
    const { redemption_code, description, redemption_type, points_required, start_date, end_date, status } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Validation
    if (!redemption_code) {
      return res.status(400).json({ error: 'redemption_code is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (!redemption_type || !['F', 'V'].includes(redemption_type)) {
      return res.status(400).json({ error: 'redemption_type must be F or V' });
    }
    if (redemption_type === 'F' && !points_required) {
      return res.status(400).json({ error: 'points_required is required for fixed redemptions' });
    }
    if (!status || !['A', 'I'].includes(status)) {
      return res.status(400).json({ error: 'status must be A or I' });
    }
    
    const query = `
      INSERT INTO redemption_rule (
        tenant_id,
        redemption_code,
        redemption_description,
        redemption_type,
        points_required,
        start_date,
        end_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await dbClient.query(query, [
      tenant_id,
      redemption_code,
      description,
      redemption_type,
      redemption_type === 'F' ? points_required : null,
      start_date || null,
      end_date || null,
      status
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating redemption:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Redemption code already exists for this tenant' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update redemption
app.put('/v1/redemptions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    const { redemption_code, description, redemption_type, points_required, start_date, end_date, status } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Validation
    if (!redemption_code) {
      return res.status(400).json({ error: 'redemption_code is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (!redemption_type || !['F', 'V'].includes(redemption_type)) {
      return res.status(400).json({ error: 'redemption_type must be F or V' });
    }
    if (redemption_type === 'F' && !points_required) {
      return res.status(400).json({ error: 'points_required is required for fixed redemptions' });
    }
    if (!status || !['A', 'I'].includes(status)) {
      return res.status(400).json({ error: 'status must be A or I' });
    }
    
    const query = `
      UPDATE redemption_rule
      SET 
        redemption_code = $1,
        redemption_description = $2,
        redemption_type = $3,
        points_required = $4,
        start_date = $5,
        end_date = $6,
        status = $7
      WHERE redemption_id = $8 AND tenant_id = $9
      RETURNING *
    `;
    
    const result = await dbClient.query(query, [
      redemption_code,
      description,
      redemption_type,
      redemption_type === 'F' ? points_required : null,
      start_date || null,
      end_date || null,
      status,
      id,
      tenant_id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Redemption not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating redemption:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Redemption code already exists for this tenant' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete redemption
app.delete('/v1/redemptions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    const query = 'DELETE FROM redemption_rule WHERE redemption_id = $1 AND tenant_id = $2 RETURNING *';
    const result = await dbClient.query(query, [id, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Redemption not found' });
    }
    
    res.json({ message: 'Redemption deleted successfully' });
  } catch (error) {
    console.error('Error deleting redemption:', error);
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
        is_active,
        description,
        display_order,
        display_width,
        sample_code,
        sample_description,
        decimal_places,
        can_be_promotion_counter
      FROM molecule_def
      WHERE tenant_id = $1 AND is_active = true
    `;
    
    const params = [tenant_id];
    
    // Optional context filter
    if (context) {
      query += ' AND LOWER(context) = LOWER($2)';
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

// GET - List molecules by context/source (Activity, Member, etc.)
app.get('/v1/molecules/by-source/:source', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const source = req.params.source; // Activity, Member, etc.
    const tenantId = req.query.tenant_id || '1';
    
    console.log(`Fetching molecules for context: ${source}, tenant: ${tenantId}`);
    
    const query = `
      SELECT 
        molecule_id,
        molecule_key,
        label,
        context,
        value_kind,
        scalar_type,
        lookup_table_key,
        display_width,
        description
      FROM molecule_def
      WHERE tenant_id = $1 
        AND LOWER(context) = LOWER($2)
        AND is_active = true
        AND value_kind != 'embedded_list'
      ORDER BY display_order, molecule_key
    `;
    
    const result = await dbClient.query(query, [tenantId, source]);
    
    console.log(`Found ${result.rows.length} molecules for context ${source}`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching molecules by source:', error);
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
async function decodeMolecule(tenantId, moleculeKey, id, columnOrCategory = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Safety check for bad legacy data - check for any invalid ID
  // This catches: undefined, null, NaN, non-numeric strings, etc.
  const numericId = Number(id);
  if (!id || isNaN(numericId) || !Number.isFinite(numericId)) {
    console.warn(`⚠️  Bad v_ref_id value "${id}" found for molecule ${moleculeKey} - skipping decode`);
    return `[${moleculeKey}]`;
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
  
  // EMBEDDED_LIST - Query molecule_value_embedded_list by category and code
  if (mol.value_kind === 'embedded_list') {
    const category = columnOrCategory;
    if (!category) {
      throw new Error(`Category required for embedded_list molecule '${moleculeKey}'`);
    }
    
    const embeddedQuery = `
      SELECT code, description
      FROM molecule_value_embedded_list
      WHERE molecule_id = $1 
        AND tenant_id = $2 
        AND category = $3 
        AND code = $4
        AND is_active = true
    `;
    
    // For embedded lists, id is the code (e.g., 'F', 'V')
    const embeddedResult = await dbClient.query(embeddedQuery, [mol.molecule_id, tenantId, category, id]);
    
    if (embeddedResult.rows.length === 0) {
      throw new Error(`Code '${id}' not found in category '${category}' for molecule '${moleculeKey}'`);
    }
    
    return embeddedResult.rows[0].description;
  }
  
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
    
    // Determine which column to return
    // If columnOrCategory specified, return that column; otherwise return code_column
    const returnColumn = columnOrCategory || metadata.code_column;
    
    // Dynamically query the lookup table using metadata
    // Only filter by tenant_id if table is tenant-specific
    let lookupQuery, queryParams;
    
    if (metadata.is_tenant_specific) {
      lookupQuery = `
        SELECT ${returnColumn} as value
        FROM ${metadata.table_name}
        WHERE ${metadata.id_column} = $1 AND tenant_id = $2
      `;
      queryParams = [numericId, tenantId];
    } else {
      lookupQuery = `
        SELECT ${returnColumn} as value
        FROM ${metadata.table_name}
        WHERE ${metadata.id_column} = $1
      `;
      queryParams = [numericId];
    }
    
    const lookupResult = await dbClient.query(lookupQuery, queryParams);
    
    if (lookupResult.rows.length === 0) {
      throw new Error(`ID ${numericId} not found in ${metadata.table_name}`);
    }
    
    return lookupResult.rows[0].value;
  }
  
  // LIST - Query molecule_value_text
  if (mol.value_kind === 'list') {
    const listQuery = `
      SELECT text_value
      FROM molecule_value_text
      WHERE molecule_id = $1 AND value_id = $2
    `;
    
    const listResult = await dbClient.query(listQuery, [mol.molecule_id, numericId]);
    
    if (listResult.rows.length === 0) {
      throw new Error(`Value ID ${numericId} not found in list for molecule '${moleculeKey}'`);
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
      
      const textResult = await dbClient.query(textQuery, [numericId]);
      
      if (textResult.rows.length === 0) {
        throw new Error(`Text ID ${numericId} not found in text pool`);
      }
      
      return textResult.rows[0].text_value;
    }
    
    // SCALAR NUMERIC - Return as-is (it's already stored as a number)
    if (mol.scalar_type === 'numeric') {
      return numericId; // The ID IS the value for numeric scalars
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
    const { tenant_id, key, value, return_text } = req.query;
    
    if (!tenant_id || !key || value === undefined) {
      return res.status(400).json({ 
        error: 'tenant_id, key, and value are required',
        example: '/v1/molecules/encode?tenant_id=1&key=state&value=Minnesota&return_text=true'
      });
    }
    
    const returnTextValue = return_text === 'true';
    const result = await encodeMolecule(Number(tenant_id), key, value, returnTextValue);
    
    res.json({ 
      molecule_key: key,
      input_value: value,
      encoded_id: result
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
    const { tenant_id, key, id, return_display } = req.query;
    
    if (!tenant_id || !key || id === undefined) {
      return res.status(400).json({ 
        error: 'tenant_id, key, and id are required',
        example: '/v1/molecules/decode?tenant_id=1&key=state&id=MN&return_display=true'
      });
    }
    
    const returnDisplayLabel = return_display === 'true';
    // If returnDisplayLabel is true, id might be a text_value (string), otherwise it's a number
    const inputValue = returnDisplayLabel ? id : Number(id);
    const value = await decodeMolecule(Number(tenant_id), key, inputValue, returnDisplayLabel);
    
    res.json({ 
      molecule_key: key,
      input_id: id,
      decoded_value: value
    });
    
  } catch (error) {
    console.error('Error decoding molecule:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/molecules/evaluate - Test getMoleculeValue function
app.get('/v1/molecules/evaluate', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { tenant_id, key, member_id, date } = req.query;
    
    if (!tenant_id || !key) {
      return res.status(400).json({ 
        error: 'tenant_id and key are required',
        example: '/v1/molecules/evaluate?tenant_id=1&key=member_fname&member_id=2153442807&date=2025-06-15'
      });
    }
    
    // Build context object
    const context = {};
    if (member_id) {
      context.member_id = member_id;
    }
    
    // Call getMoleculeValue with optional date
    const value = await getMoleculeValue(
      Number(tenant_id), 
      key, 
      context,
      date || null
    );
    
    res.json({ 
      molecule_key: key,
      context: context,
      date: date || null,
      resolved_value: value
    });
    
  } catch (error) {
    console.error('Error evaluating molecule:', error);
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
        ref_table_name,
        ref_field_name,
        ref_function_name,
        is_static,
        is_permanent,
        is_required,
        is_active,
        description,
        display_order,
        display_width,
        sample_code,
        sample_description,
        decimal_places,
        can_be_promotion_counter
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
      ref_table_name,
      ref_field_name,
      ref_function_name,
      description,
      sample_code,
      sample_description,
      is_static, 
      is_permanent,
      is_required,
      display_order,
      display_width,
      decimal_places,
      can_be_promotion_counter,
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
        ref_table_name,
        ref_field_name,
        ref_function_name,
        description,
        sample_code,
        sample_description,
        is_static,
        is_permanent,
        is_required,
        display_order,
        display_width,
        decimal_places,
        can_be_promotion_counter,
        tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;
    
    const result = await dbClient.query(insertQuery, [
      molecule_key,
      label,
      context,
      value_kind,
      scalar_type || null,
      lookup_table_key || null,
      ref_table_name || null,
      ref_field_name || null,
      ref_function_name || null,
      description || null,
      sample_code || null,
      sample_description || null,
      is_static || false,
      is_permanent || false,
      is_required || false,
      display_order || 0,
      display_width || null,
      decimal_places || 0,
      can_be_promotion_counter || false,
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
    const { 
      molecule_key, 
      label, 
      context, 
      value_kind, 
      scalar_type, 
      lookup_table_key,
      ref_table_name,
      ref_field_name,
      ref_function_name,
      is_static, 
      is_permanent, 
      description, 
      sample_code, 
      sample_description,
      display_width,
      decimal_places,
      can_be_promotion_counter
    } = req.body;
    
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
    
    if (lookup_table_key !== undefined) {
      updates.push(`lookup_table_key = $${paramCount++}`);
      values.push(lookup_table_key);
    }
    
    if (ref_table_name !== undefined) {
      updates.push(`ref_table_name = $${paramCount++}`);
      values.push(ref_table_name);
    }
    
    if (ref_field_name !== undefined) {
      updates.push(`ref_field_name = $${paramCount++}`);
      values.push(ref_field_name);
    }
    
    if (ref_function_name !== undefined) {
      updates.push(`ref_function_name = $${paramCount++}`);
      values.push(ref_function_name);
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
    
    if (display_width !== undefined) {
      updates.push(`display_width = $${paramCount++}`);
      values.push(display_width);
    }
    
    if (decimal_places !== undefined) {
      updates.push(`decimal_places = $${paramCount++}`);
      values.push(decimal_places);
    }
    
    if (can_be_promotion_counter !== undefined) {
      updates.push(`can_be_promotion_counter = $${paramCount++}`);
      values.push(can_be_promotion_counter);
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
      SET is_tenant_specific = $1
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

// ========================================
// EMBEDDED LIST VALUE ENDPOINTS
// ========================================

// GET - Get all categories for an embedded list molecule
app.get('/v1/molecules/:id/embedded-categories', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Verify this is an embedded_list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'embedded_list') {
      return res.status(400).json({ error: 'This endpoint is only for embedded_list molecules' });
    }
    
    // Get distinct categories
    const categoryQuery = `
      SELECT DISTINCT category
      FROM molecule_value_embedded_list
      WHERE molecule_id = $1 AND tenant_id = $2
      ORDER BY category
    `;
    
    const result = await dbClient.query(categoryQuery, [id, tenant_id]);
    
    res.json(result.rows.map(r => r.category));
  } catch (error) {
    console.error('Error fetching embedded list categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get all values for a specific category
app.get('/v1/molecules/:id/embedded-values', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id, category } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    if (!category) {
      return res.status(400).json({ error: 'category required' });
    }
    
    // Verify this is an embedded_list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'embedded_list') {
      return res.status(400).json({ error: 'This endpoint is only for embedded_list molecules' });
    }
    
    // Get values for the category
    const valueQuery = `
      SELECT 
        embedded_value_id,
        code,
        description,
        sort_order
      FROM molecule_value_embedded_list
      WHERE molecule_id = $1 AND tenant_id = $2 AND category = $3
      ORDER BY sort_order, code
    `;
    
    const result = await dbClient.query(valueQuery, [id, tenant_id, category]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching embedded list values:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Add value to embedded list category
app.post('/v1/molecules/:id/embedded-values', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    const { category, code, description, sort_order } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Validation
    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    
    // Verify this is an embedded_list molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    if (defResult.rows[0].value_kind !== 'embedded_list') {
      return res.status(400).json({ error: 'This endpoint is only for embedded_list molecules' });
    }
    
    // Insert the value
    const insertQuery = `
      INSERT INTO molecule_value_embedded_list (
        molecule_id, 
        tenant_id, 
        category, 
        code, 
        description, 
        sort_order,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `;
    
    const result = await dbClient.query(insertQuery, [
      id,
      tenant_id,
      category,
      code,
      description,
      sort_order || 10
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding embedded list value:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Value code already exists in this category' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update embedded list value
app.put('/v1/molecules/:id/embedded-values/:code', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id, code } = req.params;
    const { tenant_id } = req.query;
    const { category, new_code, description, sort_order } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }
    
    // Validation
    const codeToUse = new_code || code;
    if (!codeToUse) {
      return res.status(400).json({ error: 'code is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    
    // Update the value
    const updateQuery = `
      UPDATE molecule_value_embedded_list
      SET 
        code = $1,
        description = $2,
        sort_order = $3
      WHERE molecule_id = $4 
        AND tenant_id = $5 
        AND category = $6
        AND code = $7
      RETURNING *
    `;
    
    const result = await dbClient.query(updateQuery, [
      codeToUse,
      description,
      sort_order || 10,
      id,
      tenant_id,
      category,
      code
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating embedded list value:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Value code already exists in this category' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete embedded list value
app.delete('/v1/molecules/:id/embedded-values/:code', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id, code } = req.params;
    const { tenant_id, category } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    if (!category) {
      return res.status(400).json({ error: 'category required' });
    }
    
    // Delete the value
    const deleteQuery = `
      DELETE FROM molecule_value_embedded_list
      WHERE molecule_id = $1 
        AND tenant_id = $2 
        AND category = $3
        AND code = $4
      RETURNING code
    `;
    
    const result = await dbClient.query(deleteQuery, [id, tenant_id, category, code]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }
    
    res.json({ message: 'Value deleted', code: code });
  } catch (error) {
    console.error('Error deleting embedded list value:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete entire category from embedded list
app.delete('/v1/molecules/:id/categories/:category', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id, category } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Delete all values in this category
    const deleteQuery = `
      DELETE FROM molecule_value_embedded_list
      WHERE molecule_id = $1 
        AND tenant_id = $2 
        AND category = $3
      RETURNING code
    `;
    
    const result = await dbClient.query(deleteQuery, [id, tenant_id, category]);
    
    res.json({ 
      message: 'Category deleted', 
      category: category,
      deleted_count: result.rows.length 
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// BONUS ENGINE - The Secret Sauce!
// ============================================================================

/**
 * Apply a bonus to an activity - SHARED FUNCTION
 * Used by both automatic bonus evaluation and manual CSR application
 * 
 * @param {number} activityId - The activity ID
 * @param {number} bonusId - The bonus ID to apply
 * @param {string} bonusCode - The bonus code (for logging)
 * @param {string} bonusType - 'fixed' or 'percent'
 * @param {number} bonusAmount - The bonus amount (percentage or fixed points)
 * @param {number} basePoints - The base points from the activity
 * @returns {Promise<Object>} The created activity_bonus record with calculated points
 */
async function applyBonusToActivity(activityId, bonusId, bonusCode, bonusType, bonusAmount, basePoints) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }

  try {
    console.log(`\n💰 APPLYING BONUS: ${bonusCode} to activity ${activityId}`);
    
    // 1. Calculate bonus points based on type
    let bonusPoints = 0;
    if (bonusType === 'percent') {
      bonusPoints = Math.floor(basePoints * (bonusAmount / 100));
      console.log(`   → Calculating: ${basePoints} × ${bonusAmount}% = ${bonusPoints} points`);
    } else if (bonusType === 'fixed') {
      bonusPoints = bonusAmount;
      console.log(`   → Fixed bonus: ${bonusPoints} points`);
    }

    // 2. Create activity_bonus record
    const bonusQuery = `
      INSERT INTO activity_bonus (activity_id, bonus_id, bonus_points)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const bonusResult = await dbClient.query(bonusQuery, [activityId, bonusId, bonusPoints]);
    console.log(`   ✨ Created activity_bonus record: ${bonusPoints} points`);

    // 3. Update point_lot to add bonus points to accrued
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
        console.log(`   💰 Added ${bonusPoints} bonus points to lot_id=${lotId}`);
      } else {
        console.log(`   ⚠️  Warning: No lot_id found for activity ${activityId}`);
      }
    }

    console.log(`   ✅ Bonus application complete!\n`);
    
    return {
      activity_bonus_id: bonusResult.rows[0].activity_bonus_id,
      bonus_points: bonusPoints,
      bonus_code: bonusCode
    };

  } catch (error) {
    console.error(`Error applying bonus ${bonusCode}:`, error);
    throw error;
  }
}

/**
 * Evaluates all active bonuses for a given activity and creates activity_bonus records
 * @param {number} activityId - The activity ID to evaluate
 * @param {string} activityDate - The activity date (YYYY-MM-DD)
 * @param {number} basePoints - The base points earned
 * @returns {Promise<Array>} Array of activity bonuses created
 */
/**
 * Evaluate bonuses for an activity
 * @param {number} activityId - The activity ID to evaluate
 * @param {string} activityDate - The activity date
 * @param {number} basePoints - Base points for the activity
 * @param {boolean} testMode - If true, collect ALL failures (test mode). If false, fail-fast (production mode).
 * @returns {Array|Object} In production mode: array of bonuses. In test mode: { bonuses: [], validationResults: [] }
 */
async function evaluateBonuses(activityId, activityDate, basePoints, testMode = false) {
  if (!dbClient) {
    console.log('No database connection - skipping bonus evaluation');
    return testMode ? { bonuses: [], validationResults: [] } : [];
  }

  try {
    console.log(`\n🎁 BONUS ENGINE: Evaluating bonuses for activity ${activityId}`);
    console.log(`   Activity Date: ${activityDate}, Base Points: ${basePoints}`);
    console.log(`   Test Mode: ${testMode ? 'YES (full validation)' : 'NO (fail-fast)'}`);


    // Query ALL ACTIVE bonuses only
    const bonusQuery = `
      SELECT 
        bonus_id,
        bonus_code,
        bonus_description,
        bonus_type,
        bonus_amount,
        start_date,
        end_date,
        rule_id,
        apply_sunday,
        apply_monday,
        apply_tuesday,
        apply_wednesday,
        apply_thursday,
        apply_friday,
        apply_saturday
      FROM bonus
      WHERE is_active = true
      ORDER BY bonus_code
    `;

    const bonusResult = await dbClient.query(bonusQuery);
    const activeBonuses = bonusResult.rows;

    console.log(`   Found ${activeBonuses.length} ACTIVE bonuses to evaluate`);

    const bonuses = [];
    const validationResults = []; // Track all validation results in test mode

    // Walk through each active bonus
    for (const bonus of activeBonuses) {
      console.log(`\n   → Checking bonus: ${bonus.bonus_code} (${bonus.bonus_description})`);
      console.log(`      Type: ${bonus.bonus_type}, Amount: ${bonus.bonus_amount}`);
      console.log(`      Date Range: ${bonus.start_date} to ${bonus.end_date || 'ongoing'}`);
      console.log(`      Rule ID: ${bonus.rule_id || 'NONE (no criteria)'}`);

      // Check if activity date falls within bonus date range
      const actDate = new Date(activityDate);
      const startDate = new Date(bonus.start_date);
      const endDate = bonus.end_date ? new Date(bonus.end_date) : null;
      
      // Normalize to date-only comparison (set all to midnight UTC)
      actDate.setUTCHours(0, 0, 0, 0);
      startDate.setUTCHours(0, 0, 0, 0);
      if (endDate) {
        endDate.setUTCHours(0, 0, 0, 0);
      }

      const isInDateRange = actDate >= startDate && (!endDate || actDate <= endDate);
      
      const currentBonusFailures = []; // Track failures for THIS bonus

      if (!isInDateRange) {
        console.log(`      ❌ SKIP - Activity date outside bonus range`);
        const failureMsg = `Activity date ${activityDate} is outside bonus date range (${bonus.start_date} to ${bonus.end_date || 'ongoing'})`;
        
        if (testMode) {
          // In test mode, collect failure but keep checking
          currentBonusFailures.push(failureMsg);
        } else {
          // Production mode: fail-fast
          continue;
        }
      } else {
        console.log(`      ✅ PASS - Activity date within range!`);
      }

      // Check day of week
      const dayOfWeek = actDate.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];
      const dayColumns = ['apply_sunday', 'apply_monday', 'apply_tuesday', 'apply_wednesday', 
                          'apply_thursday', 'apply_friday', 'apply_saturday'];
      const dayColumn = dayColumns[dayOfWeek];
      
      if (!bonus[dayColumn]) {
        console.log(`      ❌ SKIP - Activity is on ${dayName} but bonus does not apply on this day`);
        const failureMsg = `Activity is on ${dayName} but bonus does not apply on this day`;
        
        if (testMode) {
          // In test mode, collect failure but keep checking
          currentBonusFailures.push(failureMsg);
        } else {
          // Production mode: fail-fast
          continue;
        }
      } else {
        console.log(`      ✅ PASS - Day of week matches (${dayName})`);
      }

      // Check criteria if rule_id exists
      if (bonus.rule_id) {
        console.log(`      → Checking criteria for rule_id: ${bonus.rule_id}`);
        
        // Get activity and member info to get tenant_id
        const activityInfoQuery = `
          SELECT a.member_id, m.tenant_id
          FROM activity a
          JOIN member m ON a.member_id = m.member_id
          WHERE a.activity_id = $1
        `;
        const activityInfoResult = await dbClient.query(activityInfoQuery, [activityId]);
        const tenantId = activityInfoResult.rows[0]?.tenant_id || 1;
        
        console.log(`      → Tenant ID: ${tenantId}`);
        
        // Get activity data from activity_detail
        const activityDetailQuery = `
          SELECT 
            md.molecule_key,
            ad.v_ref_id
          FROM activity_detail ad
          JOIN molecule_def md ON ad.molecule_id = md.molecule_id
          WHERE ad.activity_id = $1
        `;
        const detailResult = await dbClient.query(activityDetailQuery, [activityId]);
        
        console.log(`      → Found ${detailResult.rows.length} activity detail rows`);
        
        // Build activityData object using decodeMolecule
        const activityData = { activity_date: activityDate };
        for (const row of detailResult.rows) {
          try {
            activityData[row.molecule_key] = await decodeMolecule(tenantId, row.molecule_key, row.v_ref_id);
          } catch (error) {
            console.error(`Error decoding ${row.molecule_key}:`, error.message);
            activityData[row.molecule_key] = `[decode error]`;
          }
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
        
        console.log(`      → Found ${criteriaResult.rows.length} criteria to check`);
        
        // If rule_id exists but no criteria found, skip this bonus
        if (criteriaResult.rows.length === 0) {
          console.log(`      ⚠️  SKIP - Rule has no criteria defined`);
          
          if (testMode) {
            currentBonusFailures.push('Rule has no criteria defined');
          } else {
            continue;
          }
        }
        
        if (criteriaResult.rows.length > 0) {
          
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
              
            } else if (moleculeDef.value_kind === 'reference') {
              // Reference molecule - resolve it with member context and activity date
              console.log(`         → Resolving reference molecule: ${criterion.molecule_key}`);
              
              const memberId = activityInfoResult.rows[0]?.member_id;
              const refContext = { member_id: memberId };
              
              const resolvedValue = await getMoleculeValue(tenantId, criterion.molecule_key, refContext, activityDate);
              console.log(`         → Resolved value: ${resolvedValue}`);
              
              // Compare resolved value with criterion value
              if (criterion.operator === 'equals' || criterion.operator === '=') {
                if (resolvedValue !== criterionValue) {
                  failures.push(criterion.label);
                  console.log(`         ❌ FAIL: ${resolvedValue} !== ${criterionValue}`);
                } else {
                  criterionPassed = true;
                  hasAnyPass = true;
                  console.log(`         ✅ PASS: ${resolvedValue} === ${criterionValue}`);
                }
              } else if (criterion.operator === 'contains') {
                const resolved = String(resolvedValue || '').toLowerCase();
                const target = String(criterionValue || '').toLowerCase();
                if (!resolved.includes(target)) {
                  failures.push(criterion.label);
                  console.log(`         ❌ FAIL: "${resolved}" does not contain "${target}"`);
                } else {
                  criterionPassed = true;
                  hasAnyPass = true;
                  console.log(`         ✅ PASS: "${resolved}" contains "${target}"`);
                }
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
            
            if (testMode) {
              // In test mode, collect criteria failures
              currentBonusFailures.push(...failures);
            } else {
              // Production mode: fail-fast
              continue;
            }
          } else {
            console.log(`      ✅ PASS - All criteria matched!`);
          }
        }
      }
      
      // In test mode, record validation result for this bonus
      if (testMode) {
        validationResults.push({
          bonus_code: bonus.bonus_code,
          bonus_description: bonus.bonus_description,
          passed: currentBonusFailures.length === 0,
          failures: currentBonusFailures
        });
        
        // If there were any failures, don't apply the bonus
        if (currentBonusFailures.length > 0) {
          continue;
        }
      }

      // Apply the bonus using shared function
      const bonusResult = await applyBonusToActivity(
        activityId,
        bonus.bonus_id,
        bonus.bonus_code,
        bonus.bonus_type,
        bonus.bonus_amount,
        basePoints
      );

      bonuses.push({
        bonus_code: bonus.bonus_code,
        bonus_description: bonus.bonus_description,
        bonus_points: bonusResult.bonus_points,
        activity_bonus_id: bonusResult.activity_bonus_id
      });
    }

    console.log(`\n🎁 BONUS ENGINE: Complete! Awarded ${bonuses.length} bonuses\n`);
    
    if (testMode) {
      return {
        bonuses,
        validationResults
      };
    }
    
    return bonuses;

  } catch (error) {
    console.error('Error evaluating bonuses:', error);
    return testMode ? { bonuses: [], validationResults: [] } : [];
  }
}

// ============================================================================
// PROMOTION ENGINE
// ============================================================================

/**
 * Evaluate promotions for an activity
 * @param {number} activityId - The activity ID to evaluate
 * @param {string} activityDate - The activity date
 * @param {number} pointAmount - Points earned from the activity
 * @param {boolean} testMode - If true, collect ALL failures (test mode). If false, fail-fast (production mode).
 * @returns {Array|Object} In production mode: array of promotions. In test mode: { promotions: [], validationResults: [] }
 */

async function qualifyPromotion(memberPromotionId, promotion, memberId, tenantId, activityDate) {
  try {
    console.log(`      → Qualifying member_promotion_id: ${memberPromotionId}`);
    
    await dbClient.query('BEGIN');

    // Update to qualified status
    await dbClient.query(
      `UPDATE member_promotion 
       SET qualify_date = $1, status = 'qualified'
       WHERE member_promotion_id = $2`,
      [activityDate, memberPromotionId]
    );

    // Process reward based on reward_type
    if (promotion.reward_type === 'points') {
      console.log(`      → Awarding ${promotion.reward_amount} points (activity type M)`);
      
      // Create activity type 'M'
      const activityQuery = `
        INSERT INTO activity (
          member_id, activity_date, post_date, activity_type, point_amount
        ) VALUES (
          $1, $2, $2, 'M', $3
        )
        RETURNING activity_id
      `;
      
      const activityResult = await dbClient.query(activityQuery, [
        memberId, activityDate, promotion.reward_amount
      ]);
      const rewardActivityId = activityResult.rows[0].activity_id;

      // Link to promotion via activity_detail
      const detailQuery = `
        INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
        SELECT $1, molecule_id, $2
        FROM molecule_def
        WHERE molecule_key = 'promotion' AND tenant_id = $3
      `;
      
      await dbClient.query(detailQuery, [rewardActivityId, memberPromotionId, tenantId]);

      // Set process_date (instant for points)
      await dbClient.query(
        `UPDATE member_promotion 
         SET process_date = $1, status = 'processed'
         WHERE member_promotion_id = $2`,
        [activityDate, memberPromotionId]
      );

      console.log(`      ✅ Points activity created: activity_id=${rewardActivityId}`);

    } else if (promotion.reward_type === 'tier') {
      console.log(`      → Awarding tier: ${promotion.reward_tier_id}`);
      
      // Calculate end date for THIS tier award
      let endDate;
      if (promotion.duration_type === 'calendar') {
        endDate = promotion.duration_end_date;
      } else if (promotion.duration_type === 'virtual') {
        // Calculate virtual end date
        const endDateQuery = await dbClient.query(
          `SELECT ($1::date + $2::integer) as end_date`,
          [activityDate, promotion.duration_days]
        );
        endDate = endDateQuery.rows[0].end_date;
      }

      // Create member_tier record (the actual tier award)
      await dbClient.query(
        `INSERT INTO member_tier (member_id, tier_id, start_date, end_date)
         VALUES ($1, $2, $3, $4)`,
        [memberId, promotion.reward_tier_id, activityDate, endDate]
      );
      
      console.log(`      ✅ Tier awarded: tier_id=${promotion.reward_tier_id}, end_date=${endDate}`);

      // Cascade: Auto-qualify parallel tier pathways with same or shorter duration
      // This prevents duplicate tier cards/kits from being sent
      console.log(`      🔄 Checking for parallel tier pathways to cascade...`);
      
      const cascadeQuery = `
        UPDATE member_promotion mp
        SET 
          qualify_date = $1,
          process_date = $1,
          status = 'processed',
          qualified_by_promotion_id = $4
        FROM promotion p
        WHERE mp.promotion_id = p.promotion_id
          AND mp.member_id = $2
          AND mp.status = 'enrolled'
          AND mp.qualify_date IS NULL
          AND p.reward_type = 'tier'
          AND p.reward_tier_id = $3
          AND p.promotion_id != $4
          AND (
            -- Calendar type: end date must be <= this tier's end date
            (p.duration_type = 'calendar' AND p.duration_end_date <= $5)
            OR
            -- Virtual type: duration must be <= this tier's duration
            (p.duration_type = 'virtual' AND p.duration_days <= $6)
          )
      `;
      
      const cascadeResult = await dbClient.query(cascadeQuery, [
        activityDate,                      // $1 - qualify_date, process_date
        memberId,                          // $2 - member_id
        promotion.reward_tier_id,          // $3 - same tier only
        promotion.promotion_id,            // $4 - qualified_by_promotion_id
        endDate,                           // $5 - for calendar comparison
        promotion.duration_days || 0       // $6 - for virtual comparison
      ]);
      
      if (cascadeResult.rowCount > 0) {
        console.log(`      ✅ Cascaded to ${cascadeResult.rowCount} parallel promotion(s)`);
        console.log(`         These promotions marked qualified by promotion_id=${promotion.promotion_id}`);
        console.log(`         No duplicate tier cards will be sent`);
      } else {
        console.log(`      → No parallel pathways found to cascade`);
      }


    } else if (promotion.reward_type === 'enroll_promotion') {
      console.log(`      → Enrolling in promotion: ${promotion.reward_promotion_id}`);
      
      // Enroll member in target promotion
      if (promotion.reward_promotion_id) {
        await dbClient.query(
          `INSERT INTO member_promotion (
             member_id, promotion_id, tenant_id, enrolled_date,
             progress_counter, status
           )
           SELECT $1, $2, $3, $4, 0, 'enrolled'
           WHERE NOT EXISTS (
             SELECT 1 FROM member_promotion 
             WHERE member_id = $1 AND promotion_id = $2
           )`,
          [memberId, promotion.reward_promotion_id, tenantId, activityDate]
        );

        // Set process_date
        await dbClient.query(
          `UPDATE member_promotion 
           SET process_date = $1, status = 'processed'
           WHERE member_promotion_id = $2`,
          [activityDate, memberPromotionId]
        );

        console.log(`      ✅ Enrolled in next promotion`);
      }

    } else if (promotion.reward_type === 'external') {
      console.log(`      → External reward - awaiting manual fulfillment`);
      // process_date stays NULL until manual fulfillment
    }

    await dbClient.query('COMMIT');
    console.log(`      ✅ Qualification complete`);

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('      ❌ Error qualifying promotion:', error);
    throw error;
  }
}

async function checkActivityAgainstRule(activityId, ruleId, tenantId) {
  try {
    // Get rule criteria
    const criteriaQuery = `
      SELECT molecule_key, operator, value, joiner
      FROM rule_criteria
      WHERE rule_id = $1
      ORDER BY sort_order
    `;
    
    const criteriaResult = await dbClient.query(criteriaQuery, [ruleId]);
    const criteriaList = criteriaResult.rows;

    if (criteriaList.length === 0) {
      return true; // No criteria = matches all
    }

    // Get activity data
    const activityDetailQuery = `
      SELECT 
        md.molecule_key,
        ad.v_ref_id
      FROM activity_detail ad
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id
      WHERE ad.activity_id = $1
    `;
    
    const activityDetailResult = await dbClient.query(activityDetailQuery, [activityId]);
    const activityData = {};
    
    activityDetailResult.rows.forEach(row => {
      activityData[row.molecule_key] = row.v_ref_id;
    });

    // Evaluate criteria with AND/OR logic
    let currentResult = null;
    let currentJoiner = null;

    for (const criteria of criteriaList) {
      const moleculeKey = criteria.molecule_key;
      const operator = criteria.operator;
      const expectedValue = criteria.value;
      const actualValue = activityData[moleculeKey];

      let criteriaMatches = false;

      // Simple operator evaluation
      switch (operator) {
        case 'equals':
          criteriaMatches = actualValue === expectedValue;
          break;
        case 'not_equals':
          criteriaMatches = actualValue !== expectedValue;
          break;
        case 'contains':
          criteriaMatches = actualValue && actualValue.includes(expectedValue);
          break;
        default:
          criteriaMatches = false;
      }

      // Apply joiner logic
      if (currentResult === null) {
        currentResult = criteriaMatches;
      } else {
        if (currentJoiner === 'AND') {
          currentResult = currentResult && criteriaMatches;
        } else if (currentJoiner === 'OR') {
          currentResult = currentResult || criteriaMatches;
        }
      }

      currentJoiner = criteria.joiner;
    }

    return currentResult;

  } catch (error) {
    console.error('Error checking activity against rule:', error);
    return false;
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

// POST /v1/activities/:activityId/evaluate-promotions - Evaluate activity against all active promotions
app.post('/v1/activities/:activityId/evaluate-promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);

    // Get activity details including member_id
    const activityQuery = `
      SELECT a.activity_date, a.member_id, m.tenant_id
      FROM activity a
      JOIN member m ON a.member_id = m.member_id
      WHERE a.activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activity = activityResult.rows[0];
    const activityDate = activity.activity_date;
    const memberId = activity.member_id;
    const tenantId = activity.tenant_id;

    // Run promotion engine
    const promotions = await evaluatePromotions(activityId, activityDate, memberId, tenantId);

    res.json({
      message: 'Promotion evaluation complete',
      activity_id: activityId,
      activity_date: activityDate,
      member_id: memberId,
      promotions_updated: promotions.length,
      promotions: promotions
    });

  } catch (error) {
    console.error('Error in promotion evaluation endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST - Manually apply a bonus to an activity (CSR function)
app.post('/v1/activities/:activityId/apply-bonus/:bonusCode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);
    const bonusCode = req.params.bonusCode;

    console.log(`\n🎯 CSR MANUAL BONUS APPLICATION`);
    console.log(`   Activity: ${activityId}, Bonus: ${bonusCode}`);

    // Get activity details
    const activityQuery = `
      SELECT activity_id, point_amount as base_points
      FROM activity
      WHERE activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);

    if (activityResult.rows.length === 0) {
      console.log(`   ❌ Activity not found`);
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activity = activityResult.rows[0];
    const basePoints = activity.base_points || 0;

    // Get bonus details
    const bonusQuery = `
      SELECT bonus_id, bonus_code, bonus_type, bonus_amount
      FROM bonus
      WHERE bonus_code = $1 AND is_active = true
    `;
    const bonusResult = await dbClient.query(bonusQuery, [bonusCode]);

    if (bonusResult.rows.length === 0) {
      console.log(`   ❌ Bonus not found or inactive`);
      return res.status(404).json({ error: 'Bonus not found or inactive' });
    }

    const bonus = bonusResult.rows[0];

    // Check if bonus already applied
    const checkQuery = `
      SELECT activity_bonus_id 
      FROM activity_bonus 
      WHERE activity_id = $1 AND bonus_id = $2
    `;
    const checkResult = await dbClient.query(checkQuery, [activityId, bonus.bonus_id]);

    if (checkResult.rows.length > 0) {
      console.log(`   ❌ Bonus already applied`);
      return res.status(400).json({ error: 'Bonus already applied to this activity' });
    }

    console.log(`   ✅ All checks passed, applying bonus...`);

    // Apply the bonus using shared function
    const result = await applyBonusToActivity(
      activityId,
      bonus.bonus_id,
      bonus.bonus_code,
      bonus.bonus_type,
      bonus.bonus_amount,
      basePoints
    );

    console.log(`   🎉 Bonus application complete!\n`);

    res.json({
      message: 'Bonus applied successfully',
      activity_id: activityId,
      bonus_code: bonus.bonus_code,
      bonus_points: result.bonus_points,
      activity_bonus_id: result.activity_bonus_id
    });

  } catch (error) {
    console.error('Error in manual bonus application:', error);
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
// Helper: Get member tier on a specific date
async function getMemberTierOnDate(memberId, date) {
  const query = `
    SELECT 
      td.tier_id,
      td.tier_code,
      td.tier_description,
      td.tier_ranking
    FROM member_tier mt
    JOIN tier_definition td ON mt.tier_id = td.tier_id
    WHERE mt.member_id = $1::BIGINT
      AND mt.start_date <= $2::DATE
      AND (mt.end_date IS NULL OR mt.end_date >= $2::DATE)
    ORDER BY td.tier_ranking DESC
    LIMIT 1
  `;
  
  const result = await dbClient.query(query, [memberId, date]);
  
  if (result.rows.length === 0) {
    return null; // No tier on that date
  }
  
  return result.rows[0];
}

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

// Helper: Add points to member's point lot with expiration tracking
async function addPointsToLot(memberId, activityDate, pointAmount) {
  // Step 1: Find expiration rule
  const expirationRule = await findExpirationRule(activityDate);
  
  if (!expirationRule.ruleKey) {
    throw new Error('No expiration rule found for activity date');
  }
  
  debugLog(() => `   ✓ Expiration rule: ${expirationRule.ruleKey} - expires ${expirationRule.expireDate}`);
  
  // Step 2: Find existing lot with same expiration date
  const findBucket = `
    SELECT lot_id, accrued
    FROM point_lot
    WHERE member_id = $1 AND expire_date = $2
    LIMIT 1
  `;
  const existing = await dbClient.query(findBucket, [memberId, expirationRule.expireDate]);
  
  let lotId;
  if (existing.rows.length > 0) {
    // UPDATE existing bucket
    lotId = existing.rows[0].lot_id;
    const oldAccrued = Number(existing.rows[0].accrued);
    const newAccrued = oldAccrued + pointAmount;
    
    await dbClient.query(
      `UPDATE point_lot SET accrued = $1 WHERE lot_id = $2`,
      [newAccrued, lotId]
    );
    debugLog(() => `   ✓ Updated lot ${lotId}: added ${pointAmount}, total accrued=${newAccrued}`);
  } else {
    // INSERT new bucket
    const insertResult = await dbClient.query(
      `INSERT INTO point_lot (member_id, point_type, accrued, redeemed, expire_date)
       VALUES ($1, 'miles', $2, 0, $3)
       RETURNING lot_id`,
      [memberId, pointAmount, expirationRule.expireDate]
    );
    lotId = insertResult.rows[0].lot_id;
    debugLog(() => `   ✓ Created lot ${lotId}: accrued=${pointAmount}, expires ${expirationRule.expireDate}`);
  }
  
  return {
    lot_id: lotId,
    expire_date: expirationRule.expireDate,
    rule_key: expirationRule.ruleKey
  };
}

// Helper: Get molecule value by key (searches across all contexts)
async function getMoleculeValue(tenantId, moleculeKey, context = {}, date = null) {
  const query = `
    SELECT 
      md.molecule_id,
      md.value_kind,
      md.scalar_type,
      md.ref_table_name,
      md.ref_field_name,
      md.ref_function_name,
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
  
  if (result.rows.length === 0) {
    return null; // Not found
  }
  
  const row = result.rows[0];
  
  // Handle Reference molecules
  if (row.value_kind === 'reference') {
    // Direct Field reference
    if (row.ref_table_name && row.ref_field_name) {
      const tableName = row.ref_table_name;
      const fieldName = row.ref_field_name;
      
      // For member table references, use member_id from context
      if (tableName === 'member' && context.member_id) {
        const refQuery = `SELECT ${fieldName} FROM ${tableName} WHERE member_id = $1`;
        const refResult = await dbClient.query(refQuery, [context.member_id]);
        
        if (refResult.rows.length > 0) {
          return refResult.rows[0][fieldName];
        }
      }
      
      // TODO: Handle other table references with appropriate context keys
      return null;
    }
    
    // Function reference
    if (row.ref_function_name) {
      const functionName = row.ref_function_name;
      
      // Special case: tier lookup function
      if (functionName === 'get_member_tier_on_date' && context.member_id && date) {
        try {
          const tierResult = await getMemberTierOnDate(context.member_id, date);
          return tierResult ? tierResult.tier_code : null;
        } catch (error) {
          console.error(`Error getting member tier:`, error.message);
          return null;
        }
      }
      
      // TODO: Handle other function types if needed in the future
      
      return null;
    }
    
    return null;
  }
  
  // Handle Scalar molecules (original behavior)
  if (row.text_value !== null) {
    return row.text_value;
  } else if (row.numeric_value !== null) {
    return String(row.numeric_value);
  }
  
  return null;
}

// Legacy alias - for backwards compatibility
const getProgramLabel = getMoleculeValue;

// Helper: Get embedded list value from sysparm or other embedded list molecules
// Returns the description field (which holds the actual value)
async function getEmbeddedListValue(moleculeKey, category, code, tenantId) {
  const query = `
    SELECT mvl.description
    FROM molecule_def md
    JOIN molecule_value_embedded_list mvl ON md.molecule_id = mvl.molecule_id
    WHERE md.molecule_key = $1
      AND md.tenant_id = $2
      AND mvl.tenant_id = $2
      AND mvl.category = $3
      AND mvl.code = $4
      AND mvl.is_active = true
    LIMIT 1
  `;
  
  const result = await dbClient.query(query, [moleculeKey, tenantId, category, code]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0].description;
}

// Helper: Set embedded list value (updates description field)
async function setEmbeddedListValue(moleculeKey, category, code, value, tenantId) {
  const query = `
    UPDATE molecule_value_embedded_list mvl
    SET description = $1
    FROM molecule_def md
    WHERE mvl.molecule_id = md.molecule_id
      AND md.molecule_key = $2
      AND md.tenant_id = $3
      AND mvl.tenant_id = $3
      AND mvl.category = $4
      AND mvl.code = $5
  `;
  
  const result = await dbClient.query(query, [value, moleculeKey, tenantId, category, code]);
  return result.rowCount > 0;
}

// Load debug setting from database at startup
async function loadDebugSetting() {
  if (!dbClient) return;
  try {
    const debugValue = await getEmbeddedListValue('sysparm', 'debug', 'enabled', 1);
    if (debugValue) {
      DEBUG_ENABLED = (debugValue === 'Y');
      console.log(`Debug logging loaded from sysparm: ${DEBUG_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    }
  } catch (error) {
    console.log('Failed to load debug setting, using default (true):', error.message);
  }
}

// Helper: Get error message from system molecule by error code

// POST - Create new accrual activity with molecules
app.post('/v1/members/:memberId/accruals', async (req, res) => {
  const startTime = process.hrtime.bigint(); // Capture start time with nanosecond precision
  
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    await dbClient.query('BEGIN');
    
    const memberId = req.params.memberId;
    const tenantId = req.body.tenant_id || 1; // TODO: Get from session
    const { activity_date, carrier, origin, destination, fare_class, flight_number, mqd } = req.body;
    const base_miles = Number(req.body.base_miles); // Ensure it's a number

    // Validate required fields
    if (!activity_date || !carrier || !origin || !destination || !base_miles) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate retro date limit
    debugLog('🔍 Checking retro date limit...');
    let retroDaysAllowed;
    try {
      const retroValue = await getSysparmValue(tenantId, 'retro', 'days_allowed');
      retroDaysAllowed = retroValue ? Number(retroValue) : null;
      debugLog(() => `   Retro days allowed from sysparm: ${retroDaysAllowed}`);
    } catch (e) {
      debugLog(() => `   Error getting retro days_allowed: ${e.message}`);
    }
    
    if (retroDaysAllowed) {
      const retroDays = Number(retroDaysAllowed);
      debugLog(() => `   Parsed retro days: ${retroDays}`);
      
      if (!isNaN(retroDays) && retroDays > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - retroDays);
        
        const activityDateObj = new Date(activity_date + 'T00:00:00');
        
        debugLog(() => `   Today: ${today.toISOString().split('T')[0]}`);
        debugLog(() => `   Cutoff (${retroDays} days ago): ${cutoffDate.toISOString().split('T')[0]}`);
        debugLog(() => `   Activity date: ${activity_date}`);
        debugLog(() => `   Is too old? ${activityDateObj < cutoffDate}`);
        
        if (activityDateObj < cutoffDate) {
          const errorMsg = await getErrorMessage('E001', tenantId);
          debugLog('   ❌ REJECTED: Activity date exceeds retro limit');
          await dbClient.query('ROLLBACK');
          return res.status(400).json({ error: errorMsg });
        }
        
        debugLog('   ✅ PASSED: Activity date within retro limit');
      } else {
        debugLog(() => `   ⚠️  Invalid retro days value: ${retroDays}`);
      }
    } else {
      debugLog('   ℹ️  No retro days_allowed in sysparm - skipping check');
    }

    // Validate that activity date is not in the future
    debugLog('\n🔍 Checking future date...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activityDateObj = new Date(activity_date + 'T00:00:00');
    activityDateObj.setHours(0, 0, 0, 0);
    
    debugLog(() => `   Today: ${today.toISOString().split('T')[0]}`);
    debugLog(() => `   Activity date: ${activity_date}`);
    debugLog(() => `   Is in future? ${activityDateObj > today}`);
    
    if (activityDateObj > today) {
      const errorMsg = await getErrorMessage('E004', tenantId);
      debugLog('   ❌ REJECTED: Activity date cannot be in the future');
      debugLog(() => `   Error message retrieved: ${errorMsg}`);
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ 
        error: errorMsg || 'E004: Activity date cannot be in the future' 
      });
    }
    
    debugLog(`   ✅ PASSED: Activity date is not in future`);

    debugLog(() => `\n📝 Creating accrual activity for member ${memberId}: activity_date=${activity_date}, carrier=${carrier}, origin=${origin}, destination=${destination}, fare_class=${fare_class}, flight_number=${flight_number}, base_miles=${base_miles}`);

    // Step 1: Encode all molecules
    const encodedMolecules = {};
    const moleculeIds = {};
    
    // Carrier (lookup)
    encodedMolecules.carrier = await encodeMolecule(tenantId, 'carrier', carrier);
    moleculeIds.carrier = await getMoleculeId(tenantId, 'carrier');
    debugLog(() => `   ✓ Carrier ${carrier} → value_id ${encodedMolecules.carrier}, molecule_id ${moleculeIds.carrier}`);
    
    // Origin (lookup)
    encodedMolecules.origin = await encodeMolecule(tenantId, 'origin', origin);
    moleculeIds.origin = await getMoleculeId(tenantId, 'origin');
    debugLog(() => `   ✓ Origin ${origin} → value_id ${encodedMolecules.origin}, molecule_id ${moleculeIds.origin}`);
    
    // Destination (lookup)
    encodedMolecules.destination = await encodeMolecule(tenantId, 'destination', destination);
    moleculeIds.destination = await getMoleculeId(tenantId, 'destination');
    debugLog(() => `   ✓ Destination ${destination} → value_id ${encodedMolecules.destination}, molecule_id ${moleculeIds.destination}`);
    
    // Fare Class (list) - optional
    if (fare_class) {
      encodedMolecules.fare_class = await encodeMolecule(tenantId, 'fare_class', fare_class);
      moleculeIds.fare_class = await getMoleculeId(tenantId, 'fare_class');
      debugLog(() => `   ✓ Fare Class ${fare_class} → value_id ${encodedMolecules.fare_class}, molecule_id ${moleculeIds.fare_class}`);
    }
    
    // Flight Number (scalar numeric) - optional
    if (flight_number) {
      encodedMolecules.flight_number = await encodeMolecule(tenantId, 'flight_number', flight_number);
      moleculeIds.flight_number = await getMoleculeId(tenantId, 'flight_number');
      debugLog(() => `   ✓ Flight Number ${flight_number} → value_id ${encodedMolecules.flight_number}, molecule_id ${moleculeIds.flight_number}`);
    }
    
    // MQD (scalar numeric) - optional
    if (mqd) {
      encodedMolecules.mqd = await encodeMolecule(tenantId, 'mqd', mqd);
      moleculeIds.mqd = await getMoleculeId(tenantId, 'mqd');
      debugLog(() => `   ✓ MQD ${mqd} → value_id ${encodedMolecules.mqd}, molecule_id ${moleculeIds.mqd}`);
    }

    // Step 2: Add points to lot (handles expiration, upsert, etc.)
    debugLog(() => `\n💰 Adding ${base_miles} points to lot...`);
    let lotResult;
    try {
      lotResult = await addPointsToLot(memberId, activity_date, base_miles);
    } catch (error) {
      const errorMsg = await getErrorMessage('E002', tenantId);
      debugLog(() => `   ❌ Failed to add points to lot: ${error.message}`);
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: errorMsg });
    }

    const lotId = lotResult.lot_id;

    // Step 3: Insert activity (parent record) WITH lot_id
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
    debugLog(() => `   ✓ Activity created: activity_id=${activityId}, branded with lot_id=${lotId}`);

    // Step 4: Insert activity_detail rows (molecules) using molecule_id
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
      debugLog(() => `   ✓ Molecule stored: molecule_id=${moleculeIds[moleculeKey]}, v_ref_id=${encodedMolecules[moleculeKey]}`);
    }

    // Step 5: Evaluate bonuses
    debugLog(() => `\n🎁 Evaluating bonuses for activity ${activityId}...`);
    const bonuses = await evaluateBonuses(activityId, activity_date, base_miles);

    // Step 6: Evaluate promotions
    debugLog(() => `\n🎯 Evaluating promotions for activity ${activityId}...`);
    const promotions = await evaluatePromotions(activityId, activity_date, memberId, tenantId);

    debugLog(() => `✅ Activity ${activityId} created successfully with ${bonuses.length} bonuses and ${promotions.length} promotions\n`);

    // Calculate elapsed time
    const endTime = process.hrtime.bigint();
    const elapsedNanos = endTime - startTime;
    const elapsedMs = Number(elapsedNanos) / 1_000_000; // Convert to milliseconds
    
    debugLog(`⏱️  Total processing time: ${elapsedMs.toFixed(2)}ms`);

    await dbClient.query('COMMIT');

    // Get activity type label for response message
    let activityTypeLabel = 'Accrual activity';
    try {
      const activityTypeMolecule = await getMolecule('activity_type_label', tenantId);
      if (activityTypeMolecule && activityTypeMolecule.value) {
        activityTypeLabel = activityTypeMolecule.value;
      }
    } catch (e) {
      // Use default if molecule not found
    }

    res.status(201).json({
      message: `${activityTypeLabel} created successfully`,
      activity_id: activityId,
      activity_date: newActivity.activity_date,
      base_miles: newActivity.point_amount,
      lot_id: lotId,
      expire_date: lotResult.expire_date,
      bonuses_awarded: bonuses.length,
      bonuses: bonuses,
      promotions_processed: promotions.length,
      promotions: promotions,
      processing_time_ms: DEBUG_ENABLED ? elapsedMs.toFixed(2) : undefined
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creating accrual activity:', error);
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
    
    if (isNaN(activityId)) {
      console.error(`Invalid activity ID: ${req.params.activityId}`);
      return res.status(400).json({ error: 'Invalid activity ID' });
    }

    const query = `
      SELECT 
        ab.activity_bonus_id,
        ab.bonus_points,
        b.bonus_code,
        b.bonus_description,
        b.bonus_type,
        b.bonus_amount
      FROM activity_bonus ab
      JOIN bonus b ON ab.bonus_id = b.bonus_id
      WHERE ab.activity_id = $1
      ORDER BY ab.activity_bonus_id
    `;

    const result = await dbClient.query(query, [activityId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching activity bonuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/activities/:activityId/promotions - Get promotion contributions for activity
app.get('/v1/activities/:activityId/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);
    const tenantId = req.query.tenant_id || 1;

    if (isNaN(activityId)) {
      return res.status(400).json({ error: 'Invalid activity ID' });
    }

    // Query promotion contributions from member_promotion_detail
    const query = `
      SELECT 
        mpd.detail_id,
        mpd.contribution_amount,
        mp.member_promotion_id,
        mp.progress_counter,
        mp.goal_amount,
        p.promotion_id,
        p.promotion_code,
        p.promotion_name,
        p.count_type
      FROM member_promotion_detail mpd
      JOIN member_promotion mp ON mpd.member_promotion_id = mp.member_promotion_id
      JOIN promotion p ON mp.promotion_id = p.promotion_id
      WHERE mpd.activity_id = $1
        AND mp.tenant_id = $2
      ORDER BY p.promotion_code
    `;

    console.log(`Querying promotion contributions for activity ${activityId}, tenant ${tenantId}`);
    const result = await dbClient.query(query, [activityId, tenantId]);
    console.log(`Found ${result.rows.length} promotion contributions`);
    
    res.json({ 
      ok: true, 
      activity_id: activityId,
      contributions: result.rows 
    });

  } catch (error) {
    console.error('Error fetching activity promotions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/member-promotions/:id/activities - Get activities that contributed to a promotion
app.get('/v1/member-promotions/:id/activities', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const memberPromotionId = parseInt(req.params.id);
    const tenantId = req.query.tenant_id || 1;

    if (isNaN(memberPromotionId)) {
      return res.status(400).json({ error: 'Invalid member promotion ID' });
    }

    // Query activities that contributed to this promotion
    const query = `
      SELECT 
        a.activity_id,
        a.activity_date,
        a.activity_type,
        a.point_amount,
        mpd.contribution_amount
      FROM member_promotion_detail mpd
      JOIN activity a ON mpd.activity_id = a.activity_id
      WHERE mpd.member_promotion_id = $1
      ORDER BY a.activity_date DESC
    `;

    const result = await dbClient.query(query, [memberPromotionId]);
    
    // For each activity, get its display template rendering
    const activities = await Promise.all(result.rows.map(async (activity) => {
      // Get activity details (molecules)
      const detailsQuery = `
        SELECT 
          ad.molecule_id,
          ad.v_ref_id,
          md.molecule_key
        FROM activity_detail ad
        JOIN molecule_def md ON ad.molecule_id = md.molecule_id
        WHERE ad.activity_id = $1
      `;
      
      const detailsResult = await dbClient.query(detailsQuery, [activity.activity_id]);
      
      // Load Efficient display template for this activity type
      let efficientTemplate = [];
      try {
        const efficientQuery = `
          SELECT dtl.template_string
          FROM display_template dt
          JOIN display_template_line dtl ON dt.template_id = dtl.template_id
          WHERE dt.tenant_id = $1 AND dt.template_type = 'E' AND dt.activity_type = $2 AND dt.is_active = true
          ORDER BY dtl.line_number
        `;
        const efficientResult = await dbClient.query(efficientQuery, [tenantId, activity.activity_type]);
        if (efficientResult.rows.length > 0) {
          efficientTemplate = efficientResult.rows.map(row => row.template_string);
        }
      } catch (e) {
        console.log(`No Efficient template for activity type=${activity.activity_type}`);
      }
      
      // Decode molecules
      const decodedValues = {};
      const decodedDescriptions = {};
      
      for (const detail of detailsResult.rows) {
        try {
          const moleculeKey = detail.molecule_key;
          decodedValues[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id);
          
          // For lookup molecules, also get description
          try {
            const molDef = await getMolecule(moleculeKey, tenantId);
            if (molDef.value_kind === 'lookup') {
              const lookupQuery = `
                SELECT code_column 
                FROM molecule_value_lookup 
                WHERE molecule_id = $1
              `;
              const lookupResult = await dbClient.query(lookupQuery, [molDef.molecule_id]);
              
              if (lookupResult.rows.length > 0) {
                const codeColumn = lookupResult.rows[0].code_column;
                const descColumn = codeColumn.replace('_code', '_description');
                decodedDescriptions[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id, descColumn);
              }
            }
          } catch (e) {
            // Skip description errors
          }
        } catch (error) {
          console.error(`Error decoding ${detail.molecule_key}:`, error);
          decodedValues[detail.molecule_key] = `[decode error]`;
        }
      }
      
      // Render template (same logic as activity list)
      const renderTemplate = (template) => {
        const rendered = [];
        template.forEach((templateString) => {
          let line = templateString;
          
          // Replace [M,key,"format",maxLength] with decoded values
          line = line.replace(/\[M,(\w+),"(Code|Description|Both)"(?:,(\d+))?\]/g, (match, key, format, maxLength) => {
            const code = decodedValues[key];
            const description = decodedDescriptions[key];
            
            if (!code) return '';
            
            let output = '';
            if (format === 'Code') {
              output = code;
            } else if (format === 'Description') {
              output = description || code;
            } else if (format === 'Both') {
              output = description ? `${code} ${description}` : code;
            }
            
            // Apply max length if specified
            if (maxLength && output.length > parseInt(maxLength)) {
              output = output.substring(0, parseInt(maxLength));
            }
            
            return output;
          });
          
          // Replace [T,"text"] with literal text
          line = line.replace(/\[T,"([^"]+)"\]/g, (match, text) => {
            return text.replace(/ /g, '&nbsp;');
          });
          
          // Remove structural commas
          line = line.replace(/,/g, '');
          
          if (line.trim()) {
            rendered.push({ label: '', value: line.trim() });
          }
        });
        return rendered;
      };
      
      // Build display string from template
      let displayString = '';
      if (efficientTemplate && efficientTemplate.length > 0) {
        const rendered = renderTemplate(efficientTemplate);
        // Join all lines with space
        displayString = rendered.map(r => r.value).join(' ').replace(/&nbsp;/g, ' ');
      } else {
        // Fallback for activities without templates
        if (decodedValues.carrier && decodedValues.flight_number) {
          displayString = `${decodedValues.carrier}${decodedValues.flight_number}`;
          if (decodedValues.origin && decodedValues.destination) {
            displayString += ` ${decodedValues.origin}→${decodedValues.destination}`;
          }
        } else if (decodedValues.partner && decodedValues.partner_program) {
          displayString = `${decodedValues.partner} ${decodedValues.partner_program}`;
        } else if (decodedValues.adjustment) {
          displayString = decodedValues.adjustment;
        } else {
          displayString = `Activity #${activity.activity_id}`;
        }
      }
      
      return {
        activity_id: activity.activity_id,
        activity_date: activity.activity_date,
        point_amount: activity.point_amount,
        contribution_amount: activity.contribution_amount,
        magic_box_efficient: displayString
      };
    }));

    res.json({ 
      ok: true, 
      member_promotion_id: memberPromotionId,
      activities: activities
    });

  } catch (error) {
    console.error('Error fetching promotion activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get full activity data for bonus testing
app.get('/v1/activities/:activityId/full', async (req, res) => {
  console.log('=== GET /v1/activities/:activityId/full called ===');
  console.log('Activity ID:', req.params.activityId);
  
  if (!dbClient) {
    console.log('ERROR: Database not connected');
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityId = parseInt(req.params.activityId);
    
    if (isNaN(activityId)) {
      console.log('ERROR: Invalid activity ID');
      return res.status(400).json({ error: 'Invalid activity ID' });
    }

    console.log('Fetching activity header...');
    // Get activity header
    const activityQuery = `
      SELECT activity_id, member_id, activity_date, activity_type, point_amount
      FROM activity
      WHERE activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);
    
    if (activityResult.rows.length === 0) {
      console.log('ERROR: Activity not found');
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const activity = activityResult.rows[0];
    console.log('Activity header:', activity);
    
    // Get tenant_id from member
    const memberQuery = `SELECT tenant_id FROM member WHERE member_id = $1`;
    const memberResult = await dbClient.query(memberQuery, [activity.member_id]);
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const tenantId = memberResult.rows[0].tenant_id;
    
    console.log('Fetching activity details with molecules...');
    // Get activity details
    const detailsQuery = `
      SELECT 
        md.molecule_key,
        ad.v_ref_id
      FROM activity_detail ad
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id
      WHERE ad.activity_id = $1
    `;
    const detailsResult = await dbClient.query(detailsQuery, [activityId]);
    console.log(`Found ${detailsResult.rows.length} detail rows`);
    
    // Build activity data object for testing
    const activityData = {
      activity_id: activity.activity_id,
      member_id: activity.member_id,
      activity_date: activity.activity_date,
      activity_type: activity.activity_type,
      base_miles: activity.point_amount
    };
    
    // Decode each molecule using the helper function
    for (const detail of detailsResult.rows) {
      try {
        const value = await decodeMolecule(tenantId, detail.molecule_key, detail.v_ref_id);
        activityData[detail.molecule_key] = value;
      } catch (error) {
        console.error(`Error decoding ${detail.molecule_key}:`, error.message);
        activityData[detail.molecule_key] = `[decode error]`;
      }
    }
    
    console.log('Returning activity data:', activityData);
    res.json(activityData);

  } catch (error) {
    console.error('ERROR in GET /v1/activities/:activityId/full:', error);
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

    // Step 1: Get activity info before deleting
    const activityQuery = `
      SELECT lot_id, point_amount, member_id, activity_type
      FROM activity
      WHERE activity_id = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityId]);
    
    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const { lot_id, point_amount, member_id, activity_type } = activityResult.rows[0];
    console.log(`   Activity: type=${activity_type}, lot_id=${lot_id}, point_amount=${point_amount}, member_id=${member_id}`);

    // Step 2: Delete activity_detail records
    const deleteDetailsResult = await dbClient.query(
      'DELETE FROM activity_detail WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted ${deleteDetailsResult.rowCount} activity_detail record(s)`);

    // Step 3: Delete activity_bonus records and subtract bonus points from lot
    const getBonusesQuery = `
      SELECT bonus_points, lot_id
      FROM activity_bonus
      WHERE activity_id = $1
    `;
    const bonusesResult = await dbClient.query(getBonusesQuery, [activityId]);
    
    // Subtract each bonus from its lot
    for (const bonus of bonusesResult.rows) {
      if (bonus.lot_id && bonus.bonus_points) {
        const updateLotQuery = `
          UPDATE point_lot
          SET accrued = accrued - $1
          WHERE lot_id = $2
        `;
        await dbClient.query(updateLotQuery, [bonus.bonus_points, bonus.lot_id]);
        console.log(`   ✓ Subtracted ${bonus.bonus_points} bonus points from lot ${bonus.lot_id}`);
      }
    }
    
    const deleteBonusResult = await dbClient.query(
      'DELETE FROM activity_bonus WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted ${deleteBonusResult.rowCount} activity_bonus record(s)`);

    // Step 3.5: Delete member_promotion_detail records and roll back promotion progress
    const getPromotionDetailsQuery = `
      SELECT mpd.member_promotion_id, mpd.contribution_amount
      FROM member_promotion_detail mpd
      WHERE mpd.activity_id = $1
    `;
    const promotionDetails = await dbClient.query(getPromotionDetailsQuery, [activityId]);
    
    // Roll back progress for each affected promotion
    for (const detail of promotionDetails.rows) {
      if (detail.contribution_amount) {
        await dbClient.query(
          'UPDATE member_promotion SET progress_counter = progress_counter - $1 WHERE member_promotion_id = $2',
          [detail.contribution_amount, detail.member_promotion_id]
        );
        console.log(`   ✓ Rolled back ${detail.contribution_amount} from promotion ${detail.member_promotion_id}`);
      }
    }
    
    const deletePromotionDetailResult = await dbClient.query(
      'DELETE FROM member_promotion_detail WHERE activity_id = $1',
      [activityId]
    );
    if (deletePromotionDetailResult.rowCount > 0) {
      console.log(`   ✓ Deleted ${deletePromotionDetailResult.rowCount} member_promotion_detail record(s)`);
    }

    // Step 4: Handle redemption-specific cleanup
    if (activity_type === 'R') {
      // Get redemption details to know which lots to credit back
      const redemptionDetailsQuery = `
        SELECT lot_id, points_used
        FROM redemption_detail
        WHERE activity_id = $1
      `;
      const redemptionDetails = await dbClient.query(redemptionDetailsQuery, [activityId]);
      
      console.log(`   Found ${redemptionDetails.rows.length} redemption_detail record(s)`);
      
      // Credit points back to each lot
      for (const detail of redemptionDetails.rows) {
        const updateLotQuery = `
          UPDATE point_lot
          SET redeemed = redeemed - $1
          WHERE lot_id = $2
          RETURNING lot_id, redeemed
        `;
        const updateResult = await dbClient.query(updateLotQuery, [detail.points_used, detail.lot_id]);
        
        if (updateResult.rows.length > 0) {
          console.log(`   ✓ Updated point_lot ${detail.lot_id}: subtracted ${detail.points_used} from redeemed, new redeemed=${updateResult.rows[0].redeemed}`);
        }
      }
      
      // Delete redemption_detail records
      const deleteRedemptionDetails = await dbClient.query(
        'DELETE FROM redemption_detail WHERE activity_id = $1',
        [activityId]
      );
      console.log(`   ✓ Deleted ${deleteRedemptionDetails.rowCount} redemption_detail record(s)`);
    }

    // Step 5: Delete the activity record
    await dbClient.query(
      'DELETE FROM activity WHERE activity_id = $1',
      [activityId]
    );
    console.log(`   ✓ Deleted activity record`);

    // Step 6: Update point_lot for accrual activities - subtract points from accrued
    if (['A', 'P', 'J', 'M'].includes(activity_type) && lot_id && point_amount) {
      const updateLotQuery = `
        UPDATE point_lot
        SET accrued = accrued - $1
        WHERE lot_id = $2
        RETURNING accrued
      `;
      const updateResult = await dbClient.query(updateLotQuery, [point_amount, lot_id]);
      
      if (updateResult.rows.length > 0) {
        console.log(`   ✓ Updated point_lot ${lot_id}: subtracted ${point_amount} from accrued, new accrued=${updateResult.rows[0].accrued}`);
      }
    }

    console.log(`✅ Activity ${activityId} deleted successfully\n`);

    res.json({
      success: true,
      message: 'Activity deleted successfully',
      activity_id: activityId,
      activity_type: activity_type,
      points_adjusted: Math.abs(point_amount)
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
        dt.activity_type,
        dt.is_active,
        COUNT(dtl.line_id) as line_count
      FROM display_template dt
      LEFT JOIN display_template_line dtl ON dt.template_id = dtl.template_id
      WHERE dt.tenant_id = $1
      GROUP BY dt.template_id, dt.template_name, dt.template_type, dt.activity_type, dt.is_active
      ORDER BY dt.activity_type, dt.template_type, dt.is_active DESC, dt.template_name
    `;

    const result = await dbClient.query(query, [tenantId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching display templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get a single display template with lines
app.get('/v1/display-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(404).json({ error: 'Template not found' });
  }

  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Get template info
    const templateQuery = `
      SELECT 
        template_id,
        tenant_id,
        template_name,
        template_type,
        activity_type,
        is_active
      FROM display_template
      WHERE template_id = $1
    `;

    const templateResult = await dbClient.query(templateQuery, [templateId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Get template lines
    const linesQuery = `
      SELECT 
        line_id,
        line_number,
        template_string
      FROM display_template_line
      WHERE template_id = $1
      ORDER BY line_number
    `;

    const linesResult = await dbClient.query(linesQuery, [templateId]);

    template.lines = linesResult.rows;

    res.json(template);

  } catch (error) {
    console.error('Error fetching display template:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get active display template for specific activity type and template type
app.get('/v1/display-templates/active', async (req, res) => {
  if (!dbClient) {
    return res.status(404).json({ error: 'No active template found' });
  }

  try {
    const { tenant_id, activity_type, template_type } = req.query;
    
    if (!tenant_id || !activity_type || !template_type) {
      return res.status(400).json({ error: 'tenant_id, activity_type, and template_type are required' });
    }

    // Get active template for this combination
    const templateQuery = `
      SELECT 
        dt.template_id,
        dt.tenant_id,
        dt.template_name,
        dt.template_type,
        dt.activity_type,
        dt.is_active
      FROM display_template dt
      WHERE dt.tenant_id = $1 
        AND dt.activity_type = $2 
        AND dt.template_type = $3
        AND dt.is_active = true
    `;

    const templateResult = await dbClient.query(templateQuery, [tenant_id, activity_type, template_type]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active template found' });
    }

    const template = templateResult.rows[0];

    // Get template lines
    const linesQuery = `
      SELECT 
        line_id,
        line_number,
        template_string
      FROM display_template_line
      WHERE template_id = $1
      ORDER BY line_number
    `;

    const linesResult = await dbClient.query(linesQuery, [template.template_id]);
    template.lines = linesResult.rows;

    res.json(template);

  } catch (error) {
    console.error('Error fetching active template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new display template
app.post('/v1/display-templates', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, template_name, template_type, activity_type, lines } = req.body;
    
    console.log('=== POST /v1/display-templates ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    if (!template_name || !template_type || !activity_type) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'template_name, template_type, and activity_type are required' });
    }

    if (!lines || lines.length === 0) {
      console.log('No lines provided');
      return res.status(400).json({ error: 'At least one line is required' });
    }

    // Insert template
    const templateQuery = `
      INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
      VALUES ($1, $2, $3, $4, false)
      RETURNING template_id, template_name, template_type, activity_type, is_active
    `;
    
    console.log('Inserting template with params:', [tenant_id || 1, template_name, template_type, activity_type]);

    const templateResult = await dbClient.query(templateQuery, [
      tenant_id || 1,
      template_name,
      template_type,
      activity_type
    ]);

    const template = templateResult.rows[0];
    console.log('Template created:', template);

    // Insert lines
    for (const line of lines) {
      const lineQuery = `
        INSERT INTO display_template_line (template_id, line_number, template_string)
        VALUES ($1, $2, $3)
      `;
      console.log('Inserting line:', { template_id: template.template_id, line_number: line.line_number, template_string: line.template_string });
      await dbClient.query(lineQuery, [
        template.template_id,
        line.line_number,
        line.template_string
      ]);
    }

    console.log('Template saved successfully, template_id:', template.template_id);

    res.status(201).json({
      message: 'Template created successfully',
      template_id: template.template_id
    });

  } catch (error) {
    console.error('Error creating display template:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update existing display template
app.put('/v1/display-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);
    const { template_name, template_type, activity_type, lines } = req.body;
    
    console.log('=== PUT /v1/display-templates/:id ===');
    console.log('Template ID:', templateId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    if (isNaN(templateId)) {
      console.log('Invalid template ID');
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    if (!template_name || !template_type || !activity_type) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'template_name, template_type, and activity_type are required' });
    }

    if (!lines || lines.length === 0) {
      console.log('No lines provided');
      return res.status(400).json({ error: 'At least one line is required' });
    }

    // Update template
    const templateQuery = `
      UPDATE display_template
      SET template_name = $1, template_type = $2, activity_type = $3
      WHERE template_id = $4
      RETURNING template_id, template_name, template_type, activity_type, is_active
    `;

    console.log('Updating template with params:', [template_name, template_type, activity_type, templateId]);

    const templateResult = await dbClient.query(templateQuery, [
      template_name,
      template_type,
      activity_type,
      templateId
    ]);

    if (templateResult.rows.length === 0) {
      console.log('Template not found');
      return res.status(404).json({ error: 'Template not found' });
    }

    console.log('Template updated:', templateResult.rows[0]);

    // Delete old lines
    console.log('Deleting old lines');
    await dbClient.query('DELETE FROM display_template_line WHERE template_id = $1', [templateId]);

    // Insert new lines
    for (const line of lines) {
      const lineQuery = `
        INSERT INTO display_template_line (template_id, line_number, template_string)
        VALUES ($1, $2, $3)
      `;
      console.log('Inserting line:', { template_id: templateId, line_number: line.line_number, template_string: line.template_string });
      await dbClient.query(lineQuery, [
        templateId,
        line.line_number,
        line.template_string
      ]);
    }

    console.log('Template updated successfully, template_id:', templateId);

    res.json({
      message: 'Template updated successfully',
      template_id: templateId
    });

  } catch (error) {
    console.error('Error updating display template:', error);
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

    // Get template type and activity type
    const getTemplateQuery = `
      SELECT template_type, activity_type
      FROM display_template 
      WHERE template_id = $1 AND tenant_id = $2
    `;
    const templateResult = await dbClient.query(getTemplateQuery, [templateId, tenantId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { template_type: templateType, activity_type: activityType } = templateResult.rows[0];

    // Deactivate all templates of this type AND activity type for this tenant
    const deactivateQuery = `
      UPDATE display_template
      SET is_active = FALSE
      WHERE tenant_id = $1 AND template_type = $2 AND activity_type = $3
    `;
    await dbClient.query(deactivateQuery, [tenantId, templateType, activityType]);

    // Activate the specified template
    const activateQuery = `
      UPDATE display_template
      SET is_active = TRUE
      WHERE template_id = $1
      RETURNING *
    `;
    const result = await dbClient.query(activateQuery, [templateId]);

    console.log(`✓ Activated ${activityType} ${templateType === 'V' ? 'Verbose' : 'Efficient'} template: ${result.rows[0].template_name}`);

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

// =============================================================================
// INPUT TEMPLATES - Dynamic activity entry forms
// =============================================================================

// GET - List all input templates for tenant
app.get('/v1/input-templates', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const tenantId = req.query.tenant_id || 1;

    const query = `
      SELECT 
        it.template_id,
        it.template_name,
        it.activity_type,
        it.is_active,
        COUNT(itl.line_id) as line_count
      FROM input_template it
      LEFT JOIN input_template_line itl ON it.template_id = itl.template_id
      WHERE it.tenant_id = $1
      GROUP BY it.template_id, it.template_name, it.activity_type, it.is_active
      ORDER BY it.activity_type, it.is_active DESC, it.template_name
    `;

    const result = await dbClient.query(query, [tenantId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching input templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get active input template for activity type (primary endpoint for form building)
app.get('/v1/input-templates/active', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, activity_type } = req.query;

    if (!tenant_id || !activity_type) {
      return res.status(400).json({ error: 'tenant_id and activity_type are required' });
    }

    // Get active template
    const templateQuery = `
      SELECT 
        it.template_id,
        it.tenant_id,
        it.template_name,
        it.activity_type,
        it.is_active
      FROM input_template it
      WHERE it.tenant_id = $1 
        AND it.activity_type = $2 
        AND it.is_active = true
      LIMIT 1
    `;

    const templateResult = await dbClient.query(templateQuery, [tenant_id, activity_type]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active input template found for this activity type' });
    }

    const template = templateResult.rows[0];

    // Get template lines
    const linesQuery = `
      SELECT line_id, line_number, template_string
      FROM input_template_line
      WHERE template_id = $1
      ORDER BY line_number
    `;

    const linesResult = await dbClient.query(linesQuery, [template.template_id]);
    template.lines = linesResult.rows;

    // Parse template lines and enrich with molecule metadata
    template.parsed_fields = [];
    
    for (const line of template.lines) {
      const fields = parseInputTemplateLine(line.template_string);
      
      for (const field of fields) {
        if (field.type === 'M') {
          // Get molecule metadata
          const molecule = await getMolecule(field.molecule_key, tenant_id);
          if (molecule) {
            field.molecule = molecule;
            field.label = molecule.label || field.molecule_key;
            field.value_kind = molecule.value_kind;
            field.scalar_type = molecule.scalar_type;
            
            // Get dropdown values for lookup/list types
            if (molecule.value_kind === 'lookup' || molecule.value_kind === 'list') {
              field.options = molecule.values || [];
            }
          }
        }
        field.row_number = line.line_number;
        template.parsed_fields.push(field);
      }
    }

    res.json(template);

  } catch (error) {
    console.error('Error fetching active input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get single input template with lines
app.get('/v1/input-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const templateQuery = `
      SELECT template_id, tenant_id, template_name, activity_type, is_active
      FROM input_template
      WHERE template_id = $1
    `;

    const templateResult = await dbClient.query(templateQuery, [templateId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    const linesQuery = `
      SELECT line_id, line_number, template_string
      FROM input_template_line
      WHERE template_id = $1
      ORDER BY line_number
    `;

    const linesResult = await dbClient.query(linesQuery, [templateId]);
    template.lines = linesResult.rows;

    res.json(template);

  } catch (error) {
    console.error('Error fetching input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new input template
app.post('/v1/input-templates', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, template_name, activity_type, lines } = req.body;

    if (!tenant_id || !template_name || !activity_type) {
      return res.status(400).json({ error: 'tenant_id, template_name, and activity_type are required' });
    }

    // Insert template
    const templateQuery = `
      INSERT INTO input_template (tenant_id, template_name, activity_type, is_active)
      VALUES ($1, $2, $3, false)
      RETURNING template_id
    `;

    const templateResult = await dbClient.query(templateQuery, [tenant_id, template_name, activity_type]);
    const templateId = templateResult.rows[0].template_id;

    // Insert lines
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineQuery = `
          INSERT INTO input_template_line (template_id, line_number, template_string)
          VALUES ($1, $2, $3)
        `;
        await dbClient.query(lineQuery, [templateId, line.line_number, line.template_string]);
      }
    }

    console.log(`✓ Created input template: ${template_name} (${activity_type})`);

    res.status(201).json({
      message: 'Template created successfully',
      template_id: templateId
    });

  } catch (error) {
    console.error('Error creating input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update input template
app.put('/v1/input-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);
    const { template_name, activity_type, lines } = req.body;

    // Update template
    const templateQuery = `
      UPDATE input_template
      SET template_name = $1, activity_type = $2
      WHERE template_id = $3
      RETURNING *
    `;

    const templateResult = await dbClient.query(templateQuery, [template_name, activity_type, templateId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete old lines and insert new
    await dbClient.query('DELETE FROM input_template_line WHERE template_id = $1', [templateId]);

    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineQuery = `
          INSERT INTO input_template_line (template_id, line_number, template_string)
          VALUES ($1, $2, $3)
        `;
        await dbClient.query(lineQuery, [templateId, line.line_number, line.template_string]);
      }
    }

    console.log(`✓ Updated input template: ${template_name}`);

    res.json({
      message: 'Template updated successfully',
      template_id: templateId
    });

  } catch (error) {
    console.error('Error updating input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Activate input template
app.post('/v1/input-templates/:id/activate', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);
    const tenantId = req.body.tenant_id || 1;

    // Get template's activity type
    const getQuery = `
      SELECT activity_type FROM input_template 
      WHERE template_id = $1 AND tenant_id = $2
    `;
    const getResult = await dbClient.query(getQuery, [templateId, tenantId]);

    if (getResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const activityType = getResult.rows[0].activity_type;

    // Deactivate all templates for this activity type
    const deactivateQuery = `
      UPDATE input_template
      SET is_active = FALSE
      WHERE tenant_id = $1 AND activity_type = $2
    `;
    await dbClient.query(deactivateQuery, [tenantId, activityType]);

    // Activate this template
    const activateQuery = `
      UPDATE input_template
      SET is_active = TRUE
      WHERE template_id = $1
      RETURNING *
    `;
    const result = await dbClient.query(activateQuery, [templateId]);

    console.log(`✓ Activated input template for ${activityType}: ${result.rows[0].template_name}`);

    res.json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    console.error('Error activating input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete input template (only if not active)
app.delete('/v1/input-templates/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const templateId = parseInt(req.params.id);

    const checkQuery = `
      SELECT template_name, is_active 
      FROM input_template 
      WHERE template_id = $1
    `;
    const checkResult = await dbClient.query(checkQuery, [templateId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (checkResult.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot delete active template. Activate another template first.' });
    }

    await dbClient.query('DELETE FROM input_template WHERE template_id = $1', [templateId]);

    console.log(`✓ Deleted input template: ${checkResult.rows[0].template_name}`);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting input template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to parse input template line
function parseInputTemplateLine(templateString) {
  const fields = [];
  
  // Match [M,key,"width",R/O] or [M,key,"width",R/O,filter_key] or [T,"text"]
  const regex = /\[([MT]),([^\]]+)\]/g;
  let match;
  
  while ((match = regex.exec(templateString)) !== null) {
    const type = match[1];
    const params = match[2];
    
    if (type === 'M') {
      // Parse molecule field: key,"width",R/O[,filter_key]
      const parts = params.split(',').map(p => p.replace(/"/g, '').trim());
      fields.push({
        type: 'M',
        molecule_key: parts[0],
        width: parts[1] || 'auto',
        required: parts[2] === 'R',
        filter_by: parts[3] || null
      });
    } else if (type === 'T') {
      // Parse text/label: "text"
      const text = params.replace(/"/g, '').trim();
      fields.push({
        type: 'T',
        text: text
      });
    }
  }
  
  return fields;
}

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
    
    // Handle list type molecules
    if (molecule.value_kind === 'list' && molecule.values && molecule.values.length > 0) {
      return res.json({ label: molecule.values[0].label });
    }
    
    // Handle scalar type molecules (like currency_label)
    if (molecule.value_kind === 'scalar' && molecule.value) {
      return res.json({ label: molecule.value });
    }
    
    res.json({ label: 'Activity' });
    
  } catch (error) {
    console.error('Error getting first label:', error);
    res.json({ label: 'Activity' });
  }
});

// Get error message by code
app.get('/v1/errors/:code', async (req, res) => {
  if (!dbClient) {
    return res.json({ error: 'Database not connected' });
  }
  
  try {
    const { code } = req.params;
    const tenantId = req.query.tenant_id || 1;
    
    // Use getErrorMessage helper function
    const message = await getErrorMessage(code, tenantId);
    
    if (message) {
      return res.json({ 
        code: code,
        message: message 
      });
    }
    
    // Error code not found
    res.status(404).json({ error: `Error code ${code} not found` });
    
  } catch (error) {
    console.error('Error getting error code:', error);
    res.status(500).json({ error: 'Failed to retrieve error message' });
  }
});


// ============================================================================
// REDEMPTION PROCESSING
// ============================================================================

// Process a member redemption (POST)
app.post('/v1/redemptions/process', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  const { member_id, tenant_id, redemption_rule_id, point_amount, redemption_date } = req.body;
  
  // Validate input
  if (!member_id || !tenant_id || !redemption_rule_id || !point_amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (point_amount < 1) {
    return res.status(400).json({ error: 'Point amount must be positive' });
  }
  
  // Use provided redemption date or default to today
  const activityDate = redemption_date || new Date().toISOString().slice(0, 10);
  
  try {
    // Start transaction
    await dbClient.query('BEGIN');
    
    // Step 1: Lock member record
    const lockQuery = `SELECT member_id FROM member WHERE member_id = $1 FOR UPDATE`;
    await dbClient.query(lockQuery, [member_id]);
    
    // Step 2: Get available lots (FIFO by expiration date)
    const lotsQuery = `
      SELECT 
        lot_id,
        expire_date,
        accrued,
        redeemed,
        (accrued - redeemed) as available
      FROM point_lot
      WHERE member_id = $1
        AND expire_date > CURRENT_DATE
        AND (accrued - redeemed) > 0
      ORDER BY expire_date ASC
    `;
    
    const lotsResult = await dbClient.query(lotsQuery, [member_id]);
    
    if (lotsResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'No available points found' });
    }
    
    // Step 3: Calculate breakdown (FIFO)
    const breakdown = [];
    let remaining = point_amount;
    let totalAvailable = 0;
    
    for (const lot of lotsResult.rows) {
      totalAvailable += lot.available;
    }
    
    if (totalAvailable < point_amount) {
      await dbClient.query('ROLLBACK');
      
      // Get E003 error message using helper function
      const errorMessage = await getErrorMessage('E003', tenant_id);
      
      if (errorMessage) {
        return res.status(400).json({ error: errorMessage });
      }
      
      // E003 not found in molecule system
      return res.status(500).json({ error: 'System configuration error: E003 not found' });
    }
    
    for (const lot of lotsResult.rows) {
      if (remaining <= 0) break;
      
      const takeFromThis = Math.min(remaining, lot.available);
      breakdown.push({
        lot_id: lot.lot_id,
        points_used: takeFromThis
      });
      
      remaining -= takeFromThis;
    }
    
    // Step 4: Create redemption activity record
    const activityQuery = `
      INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount)
      VALUES ($1, $2, $2, 'R', $3)
      RETURNING activity_id
    `;
    
    const activityResult = await dbClient.query(activityQuery, [member_id, activityDate, -point_amount]);
    const activityId = activityResult.rows[0].activity_id;
    
    // Step 4.5: Store redemption type as activity_detail (molecule way)
    const redemptionMoleculeId = await getMoleculeId(tenant_id, 'redemption');
    const addRedemptionDetailQuery = `
      INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
      VALUES ($1, $2, $3)
    `;
    await dbClient.query(addRedemptionDetailQuery, [activityId, redemptionMoleculeId, redemption_rule_id]);
    
    // Step 5: Create redemption_detail records
    for (const item of breakdown) {
      const detailQuery = `
        INSERT INTO redemption_detail (activity_id, lot_id, points_used)
        VALUES ($1, $2, $3)
      `;
      await dbClient.query(detailQuery, [activityId, item.lot_id, item.points_used]);
    }
    
    // Step 6: Update point_lot redeemed amounts
    for (const item of breakdown) {
      const updateLotQuery = `
        UPDATE point_lot
        SET redeemed = redeemed + $1
        WHERE lot_id = $2
      `;
      await dbClient.query(updateLotQuery, [item.points_used, item.lot_id]);
    }
    
    // Commit transaction (releases lock)
    await dbClient.query('COMMIT');
    
    console.log(`✓ Processed redemption for member ${member_id}: ${point_amount} points from ${breakdown.length} lot(s)`);
    
    res.json({
      success: true,
      activity_id: activityId,
      points_redeemed: point_amount,
      lots_used: breakdown.length,
      breakdown: breakdown
    });
    
  } catch (error) {
    // Rollback on any error
    await dbClient.query('ROLLBACK');
    console.error('Error processing redemption:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// PARTNER ENDPOINTS
// ========================================

// GET - List all partners for tenant
app.get('/v1/partners', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        p.partner_id,
        p.tenant_id,
        p.partner_code,
        p.partner_name,
        p.is_active,
        COUNT(pp.program_id) as program_count
      FROM partner p
      LEFT JOIN partner_program pp ON p.partner_id = pp.partner_id
      WHERE p.tenant_id = $1
      GROUP BY p.partner_id
      ORDER BY p.partner_name
    `;

    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error loading partners:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get single partner by ID
app.get('/v1/partners/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        partner_id,
        tenant_id,
        partner_code,
        partner_name,
        is_active
      FROM partner
      WHERE partner_id = $1 AND tenant_id = $2
    `;

    const result = await dbClient.query(query, [id, tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error loading partner:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get programs for a partner
app.get('/v1/partners/:id/programs', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        program_id,
        partner_id,
        tenant_id,
        program_code,
        program_name,
        earning_type,
        fixed_points,
        is_active
      FROM partner_program
      WHERE partner_id = $1 AND tenant_id = $2
      ORDER BY program_name
    `;

    const result = await dbClient.query(query, [id, tenant_id]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error loading programs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new partner with programs
app.post('/v1/partners', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, partner_code, partner_name, is_active, programs } = req.body;

    if (!tenant_id || !partner_code || !partner_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start transaction
    await dbClient.query('BEGIN');

    // Insert partner
    const partnerQuery = `
      INSERT INTO partner (tenant_id, partner_code, partner_name, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING partner_id
    `;
    const partnerResult = await dbClient.query(partnerQuery, [
      tenant_id,
      partner_code,
      partner_name,
      is_active !== false
    ]);

    const partnerId = partnerResult.rows[0].partner_id;

    // Insert programs if any
    if (programs && programs.length > 0) {
      for (const program of programs) {
        const programQuery = `
          INSERT INTO partner_program (
            partner_id, tenant_id, program_code, program_name,
            earning_type, fixed_points, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await dbClient.query(programQuery, [
          partnerId,
          tenant_id,
          program.program_code,
          program.program_name,
          program.earning_type,
          program.fixed_points,
          program.is_active !== false
        ]);
      }
    }

    await dbClient.query('COMMIT');

    res.json({
      success: true,
      partner_id: partnerId
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creating partner:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update partner and programs
app.put('/v1/partners/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id, partner_code, partner_name, is_active, programs } = req.body;

    if (!tenant_id || !partner_code || !partner_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start transaction
    await dbClient.query('BEGIN');

    // Update partner
    const partnerQuery = `
      UPDATE partner
      SET partner_code = $1,
          partner_name = $2,
          is_active = $3
      WHERE partner_id = $4 AND tenant_id = $5
    `;
    await dbClient.query(partnerQuery, [
      partner_code,
      partner_name,
      is_active !== false,
      id,
      tenant_id
    ]);

    // Delete existing programs
    await dbClient.query(
      'DELETE FROM partner_program WHERE partner_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    // Insert programs
    if (programs && programs.length > 0) {
      for (const program of programs) {
        const programQuery = `
          INSERT INTO partner_program (
            partner_id, tenant_id, program_code, program_name,
            earning_type, fixed_points, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await dbClient.query(programQuery, [
          id,
          tenant_id,
          program.program_code,
          program.program_name,
          program.earning_type,
          program.fixed_points,
          program.is_active !== false
        ]);
      }
    }

    await dbClient.query('COMMIT');

    res.json({ success: true });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error updating partner:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete partner and its programs
app.delete('/v1/partners/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Start transaction
    await dbClient.query('BEGIN');

    // Delete programs first (foreign key)
    await dbClient.query(
      'DELETE FROM partner_program WHERE partner_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    // Delete partner
    const result = await dbClient.query(
      'DELETE FROM partner WHERE partner_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    await dbClient.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({ success: true });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error deleting partner:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST - Create partner activity
app.post('/v1/members/:memberId/activities/partner', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const memberId = req.params.memberId;
    const { activity_date, partner_id, program_id, point_amount } = req.body;
    
    // Get tenant_id from member
    const memberQuery = `SELECT tenant_id FROM member WHERE member_id = $1`;
    const memberResult = await dbClient.query(memberQuery, [memberId]);
    const tenantId = memberResult.rows[0]?.tenant_id;

    if (!tenantId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Validate required fields
    if (!activity_date || !partner_id || !program_id || !point_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`\n📝 Creating partner activity for member ${memberId}:`, {
      activity_date,
      partner_id,
      program_id,
      point_amount
    });

    // Encode molecules
    const moleculeIds = {};
    moleculeIds.partner = await getMoleculeId(tenantId, 'partner');
    moleculeIds.partner_program = await getMoleculeId(tenantId, 'partner_program');

    // Add points to lot (handles expiration, upsert, etc.)
    console.log(`\n💰 Adding ${point_amount} points to lot...`);
    let lotResult;
    try {
      lotResult = await addPointsToLot(memberId, activity_date, point_amount);
    } catch (error) {
      const errorMsg = await getErrorMessage('E002', tenantId);
      console.log(`   ❌ Failed to add points to lot: ${error.message}`);
      return res.status(400).json({ error: errorMsg });
    }

    const lotId = lotResult.lot_id;

    // Create activity record
    const insertActivity = `
      INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount, lot_id)
      VALUES ($1, $2, CURRENT_DATE, 'P', $3, $4)
      RETURNING activity_id
    `;
    const activityResult = await dbClient.query(insertActivity, [
      memberId,
      activity_date,
      point_amount,
      lotId
    ]);
    const activityId = activityResult.rows[0].activity_id;
    console.log(`   ✓ Created activity ${activityId}`);

    // Create activity_detail records
    const insertDetail = `
      INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
      VALUES ($1, $2, $3)
    `;
    
    // Partner detail
    await dbClient.query(insertDetail, [activityId, moleculeIds.partner, partner_id]);
    console.log(`   ✓ Added partner detail (partner_id: ${partner_id})`);
    
    // Partner program detail
    await dbClient.query(insertDetail, [activityId, moleculeIds.partner_program, program_id]);
    console.log(`   ✓ Added partner_program detail (program_id: ${program_id})`);

    // Evaluate promotions
    console.log(`\n🎯 Evaluating promotions for partner activity ${activityId}...`);
    const promotions = await evaluatePromotions(activityId, activity_date, memberId, tenantId);

    res.json({
      success: true,
      activity_id: activityId,
      points_earned: point_amount,
      lot_id: lotId,
      expire_date: lotResult.expire_date,
      promotions_processed: promotions.length,
      promotions: promotions
    });

  } catch (error) {
    console.error('Error creating partner activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create adjustment activity
app.post('/v1/members/:memberId/activities/adjustment', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const memberId = req.params.memberId;
    const { activity_date, adjustment_id, point_amount } = req.body;
    
    // Get tenant_id from member
    const memberQuery = `SELECT tenant_id FROM member WHERE member_id = $1`;
    const memberResult = await dbClient.query(memberQuery, [memberId]);
    const tenantId = memberResult.rows[0]?.tenant_id;

    if (!tenantId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Validate required fields
    if (!activity_date || !adjustment_id || !point_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`\n📝 Creating adjustment for member ${memberId}:`, {
      activity_date,
      adjustment_id,
      point_amount
    });

    // Get adjustment molecule ID
    const adjustmentMoleculeId = await getMoleculeId(tenantId, 'adjustment');

    // Add points to lot (handles expiration, upsert, etc.)
    console.log(`\n💰 Adding ${point_amount} points to lot...`);
    let lotResult;
    try {
      lotResult = await addPointsToLot(memberId, activity_date, point_amount);
    } catch (error) {
      const errorMsg = await getErrorMessage('E002', tenantId);
      console.log(`   ❌ Failed to add points to lot: ${error.message}`);
      return res.status(400).json({ error: errorMsg });
    }

    const lotId = lotResult.lot_id;

    // Create activity record
    const insertActivity = `
      INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount, lot_id)
      VALUES ($1, $2, CURRENT_DATE, 'J', $3, $4)
      RETURNING activity_id
    `;
    const activityResult = await dbClient.query(insertActivity, [
      memberId,
      activity_date,
      point_amount,
      lotId
    ]);
    const activityId = activityResult.rows[0].activity_id;
    console.log(`   ✓ Created activity ${activityId}`);

    // Create activity_detail record for adjustment
    const insertDetail = `
      INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id)
      VALUES ($1, $2, $3)
    `;
    await dbClient.query(insertDetail, [activityId, adjustmentMoleculeId, adjustment_id]);
    console.log(`   ✓ Added adjustment detail (adjustment_id: ${adjustment_id})`);

    // Evaluate promotions
    console.log(`\n🎯 Evaluating promotions for adjustment activity ${activityId}...`);
    const promotions = await evaluatePromotions(activityId, activity_date, memberId, tenantId);

    res.json({
      success: true,
      activity_id: activityId,
      points_earned: point_amount,
      lot_id: lotId,
      expire_date: lotResult.expire_date,
      promotions_processed: promotions.length,
      promotions: promotions
    });

  } catch (error) {
    console.error('Error creating adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// ADJUSTMENT ENDPOINTS
// ========================================

// GET - List all adjustments for tenant
app.get('/v1/adjustments', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        adjustment_id,
        tenant_id,
        adjustment_code,
        adjustment_name,
        adjustment_type,
        fixed_points,
        is_active
      FROM adjustment
      WHERE tenant_id = $1
      ORDER BY adjustment_name
    `;

    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error loading adjustments:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get single adjustment by ID
app.get('/v1/adjustments/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        adjustment_id,
        tenant_id,
        adjustment_code,
        adjustment_name,
        adjustment_type,
        fixed_points,
        is_active
      FROM adjustment
      WHERE adjustment_id = $1 AND tenant_id = $2
    `;

    const result = await dbClient.query(query, [id, tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error loading adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new adjustment
app.post('/v1/adjustments', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active } = req.body;

    if (!tenant_id || !adjustment_code || !adjustment_name || !adjustment_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate adjustment_type
    if (!['F', 'V'].includes(adjustment_type)) {
      return res.status(400).json({ error: 'adjustment_type must be F or V' });
    }

    // Validate fixed_points based on type
    if (adjustment_type === 'F' && (!fixed_points || fixed_points <= 0)) {
      return res.status(400).json({ error: 'fixed_points required for Fixed type' });
    }

    const query = `
      INSERT INTO adjustment (tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING adjustment_id
    `;
    
    const result = await dbClient.query(query, [
      tenant_id,
      adjustment_code,
      adjustment_name,
      adjustment_type,
      adjustment_type === 'F' ? fixed_points : null,
      is_active !== false
    ]);

    res.json({
      success: true,
      adjustment_id: result.rows[0].adjustment_id
    });

  } catch (error) {
    console.error('Error creating adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update adjustment
app.put('/v1/adjustments/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, is_active } = req.body;

    if (!tenant_id || !adjustment_code || !adjustment_name || !adjustment_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate adjustment_type
    if (!['F', 'V'].includes(adjustment_type)) {
      return res.status(400).json({ error: 'adjustment_type must be F or V' });
    }

    // Validate fixed_points based on type
    if (adjustment_type === 'F' && (!fixed_points || fixed_points <= 0)) {
      return res.status(400).json({ error: 'fixed_points required for Fixed type' });
    }

    const query = `
      UPDATE adjustment
      SET adjustment_code = $1,
          adjustment_name = $2,
          adjustment_type = $3,
          fixed_points = $4,
          is_active = $5
      WHERE adjustment_id = $6 AND tenant_id = $7
    `;
    
    await dbClient.query(query, [
      adjustment_code,
      adjustment_name,
      adjustment_type,
      adjustment_type === 'F' ? fixed_points : null,
      is_active !== false,
      id,
      tenant_id
    ]);

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete adjustment
app.delete('/v1/adjustments/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const result = await dbClient.query(
      'DELETE FROM adjustment WHERE adjustment_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PROMOTION ENDPOINTS
// ============================================================================

// GET /v1/promotions - List all promotions for tenant
app.get('/v1/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        p.promotion_id,
        p.tenant_id,
        p.promotion_code,
        p.promotion_name,
        p.promotion_description,
        p.start_date,
        p.end_date,
        p.is_active,
        p.enrollment_type,
        p.allow_member_enrollment,
        p.rule_id,
        p.count_type,
        p.goal_amount,
        p.reward_type,
        p.reward_amount,
        p.reward_tier_id,
        p.reward_promotion_id,
        p.process_limit_count,
        p.duration_type,
        p.duration_end_date,
        p.duration_days,
        p.counter_molecule_id,
        td.tier_code as reward_tier_code,
        td.tier_description as reward_tier_name
      FROM promotion p
      LEFT JOIN tier_definition td ON p.reward_tier_id = td.tier_id
      WHERE p.tenant_id = $1
      ORDER BY p.start_date DESC, p.promotion_name
    `;

    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/promotions/:id - Get single promotion with details
app.get('/v1/promotions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      SELECT 
        p.promotion_id,
        p.tenant_id,
        p.promotion_code,
        p.promotion_name,
        p.promotion_description,
        p.start_date,
        p.end_date,
        p.is_active,
        p.enrollment_type,
        p.allow_member_enrollment,
        p.rule_id,
        p.count_type,
        p.goal_amount,
        p.reward_type,
        p.reward_amount,
        p.reward_tier_id,
        p.reward_promotion_id,
        p.process_limit_count,
        p.duration_type,
        p.duration_end_date,
        p.duration_days,
        p.counter_molecule_id,
        td.tier_code as reward_tier_code,
        td.tier_description as reward_tier_name,
        rp.promotion_code as reward_promotion_code,
        rp.promotion_name as reward_promotion_name
      FROM promotion p
      LEFT JOIN tier_definition td ON p.reward_tier_id = td.tier_id
      LEFT JOIN promotion rp ON p.reward_promotion_id = rp.promotion_id
      WHERE p.promotion_id = $1 AND p.tenant_id = $2
    `;

    const result = await dbClient.query(query, [id, tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/promotions - Create new promotion
app.post('/v1/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const {
      tenant_id,
      promotion_code,
      promotion_name,
      promotion_description,
      start_date,
      end_date,
      is_active = true,
      enrollment_type,
      allow_member_enrollment = false,
      rule_id,
      count_type,
      goal_amount,
      reward_type,
      reward_amount,
      reward_tier_id,
      reward_promotion_id,
      process_limit_count,
      duration_type,
      duration_end_date,
      duration_days,
      counter_molecule_id
    } = req.body;

    // Validation
    if (!tenant_id || !promotion_code || !promotion_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!enrollment_type || !['A', 'R'].includes(enrollment_type)) {
      return res.status(400).json({ error: 'enrollment_type must be A or R' });
    }

    if (!count_type || !['flights', 'miles', 'enrollments', 'molecules'].includes(count_type)) {
      return res.status(400).json({ error: 'Invalid count_type' });
    }

    if (!reward_type || !['points', 'tier', 'external', 'enroll_promotion'].includes(reward_type)) {
      return res.status(400).json({ error: 'Invalid reward_type' });
    }

    const query = `
      INSERT INTO promotion (
        tenant_id, promotion_code, promotion_name, promotion_description,
        start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
        rule_id, count_type, goal_amount, reward_type, reward_amount,
        reward_tier_id, reward_promotion_id, process_limit_count,
        duration_type, duration_end_date, duration_days, counter_molecule_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
    `;

    const values = [
      tenant_id, promotion_code, promotion_name, promotion_description,
      start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
      rule_id, count_type, goal_amount, reward_type, reward_amount,
      reward_tier_id, reward_promotion_id, process_limit_count,
      duration_type, duration_end_date, duration_days, counter_molecule_id
    ];

    const result = await dbClient.query(query, values);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creating promotion:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Promotion code already exists for this tenant' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// PUT /v1/promotions/:id - Update promotion
app.put('/v1/promotions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const {
      tenant_id,
      promotion_code,
      promotion_name,
      promotion_description,
      start_date,
      end_date,
      is_active,
      enrollment_type,
      allow_member_enrollment,
      rule_id,
      count_type,
      goal_amount,
      reward_type,
      reward_amount,
      reward_tier_id,
      reward_promotion_id,
      process_limit_count,
      duration_type,
      duration_end_date,
      duration_days,
      counter_molecule_id
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const query = `
      UPDATE promotion SET
        promotion_code = $2,
        promotion_name = $3,
        promotion_description = $4,
        start_date = $5,
        end_date = $6,
        is_active = $7,
        enrollment_type = $8,
        allow_member_enrollment = $9,
        rule_id = $10,
        count_type = $11,
        goal_amount = $12,
        reward_type = $13,
        reward_amount = $14,
        reward_tier_id = $15,
        reward_promotion_id = $16,
        process_limit_count = $17,
        duration_type = $18,
        duration_end_date = $19,
        duration_days = $20,
        counter_molecule_id = $21
      WHERE promotion_id = $1 AND tenant_id = $22
      RETURNING *
    `;

    const values = [
      id, promotion_code, promotion_name, promotion_description,
      start_date, end_date, is_active, enrollment_type, allow_member_enrollment,
      rule_id, count_type, goal_amount, reward_type, reward_amount,
      reward_tier_id, reward_promotion_id, process_limit_count,
      duration_type, duration_end_date, duration_days, counter_molecule_id, tenant_id
    ];

    const result = await dbClient.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /v1/promotions/:id - Delete promotion
app.delete('/v1/promotions/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Check if promotion has enrolled members
    const enrollmentCheck = await dbClient.query(
      'SELECT COUNT(*) as count FROM member_promotion WHERE promotion_id = $1',
      [id]
    );

    if (parseInt(enrollmentCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete promotion with enrolled members. Deactivate instead.' 
      });
    }

    const result = await dbClient.query(
      'DELETE FROM promotion WHERE promotion_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/members/:memberId/promotions - Get member's enrolled promotions with progress
app.get('/v1/members/:memberId/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { memberId } = req.params;

    const query = `
      SELECT 
        mp.member_promotion_id,
        mp.member_id,
        mp.promotion_id,
        mp.enrolled_date,
        mp.qualify_date,
        mp.process_date,
        mp.progress_counter,
        mp.goal_amount,
        p.promotion_code,
        p.promotion_name,
        p.promotion_description,
        p.count_type,
        p.reward_type,
        p.reward_amount,
        p.start_date,
        p.end_date,
        CASE 
          WHEN mp.progress_counter >= mp.goal_amount THEN 100
          ELSE ROUND((mp.progress_counter / mp.goal_amount * 100)::numeric, 1)
        END as progress_percentage
      FROM member_promotion mp
      JOIN promotion p ON mp.promotion_id = p.promotion_id
      WHERE mp.member_id = $1
      ORDER BY mp.enrolled_date DESC
    `;

    const result = await dbClient.query(query, [memberId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching member promotions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/members/:memberId/promotions/:promotionId/enroll - Manual enrollment
app.post('/v1/members/:memberId/promotions/:promotionId/enroll', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { memberId, promotionId } = req.params;
    const { tenant_id, enrolled_by_user_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Check if promotion exists and is active
    const promoCheck = await dbClient.query(
      'SELECT * FROM promotion WHERE promotion_id = $1 AND tenant_id = $2',
      [promotionId, tenant_id]
    );

    if (promoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    const promotion = promoCheck.rows[0];

    // Check if already enrolled
    const enrollmentCheck = await dbClient.query(
      'SELECT * FROM member_promotion WHERE member_id = $1 AND promotion_id = $2 AND status IN ($3, $4)',
      [memberId, promotionId, 'enrolled', 'qualified']
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Member already enrolled in this promotion' });
    }

    // Create enrollment
    const insertQuery = `
      INSERT INTO member_promotion (
        member_id, promotion_id, tenant_id, enrolled_date,
        progress_counter, status, enrolled_by_user_id
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 0, 'enrolled', $4
      )
      RETURNING *
    `;

    const result = await dbClient.query(insertQuery, [memberId, promotionId, tenant_id, enrolled_by_user_id]);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error enrolling member in promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/members/:memberId/promotions/:promotionId/qualify - Manual qualification
app.post('/v1/members/:memberId/promotions/:promotionId/qualify', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { memberId, promotionId } = req.params;
    const { tenant_id, qualified_by_user_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Get member_promotion record
    const mpQuery = await dbClient.query(
      'SELECT * FROM member_promotion WHERE member_id = $1 AND promotion_id = $2 AND status = $3',
      [memberId, promotionId, 'enrolled']
    );

    if (mpQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Member not enrolled in this promotion or already qualified' });
    }

    const memberPromotion = mpQuery.rows[0];

    // Get promotion details
    const promoQuery = await dbClient.query(
      'SELECT * FROM promotion WHERE promotion_id = $1 AND tenant_id = $2',
      [promotionId, tenant_id]
    );

    if (promoQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    const promotion = promoQuery.rows[0];

    // Begin transaction for reward processing
    await dbClient.query('BEGIN');

    try {
      // Update member_promotion to qualified
      const updateQuery = `
        UPDATE member_promotion SET
          qualify_date = CURRENT_DATE,
          status = 'qualified',
          qualified_by_user_id = $1
        WHERE member_promotion_id = $2
        RETURNING *
      `;

      const updateResult = await dbClient.query(updateQuery, [qualified_by_user_id, memberPromotion.member_promotion_id]);
      const qualifiedPromotion = updateResult.rows[0];

      // Process reward based on reward_type
      if (promotion.reward_type === 'points') {
        // Add points to lot (handles expiration, upsert, etc.)
        const lotResult = await addPointsToLot(memberId, new Date(), promotion.reward_amount);
        const lotId = lotResult.lot_id;

        // Create activity type 'M' with points
        const activityQuery = `
          INSERT INTO activity (
            member_id, activity_date, post_date, activity_type, point_amount, lot_id
          ) VALUES (
            $1, CURRENT_DATE, CURRENT_DATE, 'M', $2, $3
          )
          RETURNING activity_id
        `;
        
        const activityResult = await dbClient.query(activityQuery, [memberId, promotion.reward_amount, lotId]);
        const activityId = activityResult.rows[0].activity_id;

        // Get molecule IDs for linking
        const memberPromotionMoleculeId = await getMoleculeId(tenant_id, 'member_promotion');
        const promotionMoleculeId = await getMoleculeId(tenant_id, 'promotion');

        // Link activity to member_promotion (enrollment instance)
        await dbClient.query(
          'INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
          [activityId, memberPromotionMoleculeId, memberPromotion.member_promotion_id]
        );

        // Link activity to promotion (for code and description)
        await dbClient.query(
          'INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
          [activityId, promotionMoleculeId, promotion.promotion_id]
        );

        // Set process_date since points reward is instant
        await dbClient.query(
          'UPDATE member_promotion SET process_date = CURRENT_DATE, status = $1 WHERE member_promotion_id = $2',
          ['processed', memberPromotion.member_promotion_id]
        );
      } else if (promotion.reward_type === 'tier') {
        // Calculate end date for tier award
        let endDate;
        let endDateValue;
        
        if (promotion.duration_type === 'calendar') {
          endDate = promotion.duration_end_date;
          endDateValue = promotion.duration_end_date;
        } else if (promotion.duration_type === 'virtual') {
          // Add duration_days to current date
          const endDateQuery = await dbClient.query(
            `SELECT (CURRENT_DATE + $1::integer) as end_date`,
            [promotion.duration_days]
          );
          endDateValue = endDateQuery.rows[0].end_date;
          endDate = endDateValue;
        }

        // Create member_tier record
        const tierQuery = `
          INSERT INTO member_tier (
            member_id, tier_id, start_date, end_date
          ) VALUES (
            $1, $2, CURRENT_DATE, $3
          )
        `;
        
        await dbClient.query(tierQuery, [memberId, promotion.reward_tier_id, endDateValue]);

        // Cascade: Auto-qualify parallel tier pathways with same or shorter duration
        console.log(`      🔄 Checking for parallel tier pathways to cascade...`);
        
        const cascadeQuery = `
          UPDATE member_promotion mp
          SET 
            qualify_date = CURRENT_DATE,
            process_date = CURRENT_DATE,
            status = 'processed',
            qualified_by_user_id = $1,
            qualified_by_promotion_id = $5
          FROM promotion p
          WHERE mp.promotion_id = p.promotion_id
            AND mp.member_id = $2
            AND mp.status = 'enrolled'
            AND mp.qualify_date IS NULL
            AND p.reward_type = 'tier'
            AND p.reward_tier_id = $3
            AND p.promotion_id != $4
            AND (
              -- Calendar type: end date must be <= this tier's end date
              (p.duration_type = 'calendar' AND p.duration_end_date <= $6)
              OR
              -- Virtual type: duration must be <= this tier's duration
              (p.duration_type = 'virtual' AND p.duration_days <= $7)
            )
        `;
        
        const cascadeResult = await dbClient.query(cascadeQuery, [
          qualified_by_user_id,              // $1 - qualified_by_user_id (CSR)
          memberId,                          // $2 - member_id
          promotion.reward_tier_id,          // $3 - same tier only
          promotionId,                       // $4 - exclude this promotion
          promotionId,                       // $5 - qualified_by_promotion_id
          endDateValue,                      // $6 - for calendar comparison
          promotion.duration_days || 0       // $7 - for virtual comparison
        ]);
        
        if (cascadeResult.rowCount > 0) {
          console.log(`      ✅ Cascaded to ${cascadeResult.rowCount} parallel promotion(s)`);
        }

        // process_date stays NULL until kit is shipped (manual fulfillment)
      } else if (promotion.reward_type === 'enroll_promotion') {
        // Enroll member in target promotion
        if (promotion.reward_promotion_id) {
          const enrollQuery = `
            INSERT INTO member_promotion (
              member_id, promotion_id, tenant_id, enrolled_date,
              progress_counter, status
            )
            SELECT $1, $2, $3, CURRENT_DATE, 0, 'enrolled'
            WHERE NOT EXISTS (
              SELECT 1 FROM member_promotion 
              WHERE member_id = $1 AND promotion_id = $2
            )
          `;
          
          await dbClient.query(enrollQuery, [memberId, promotion.reward_promotion_id, tenant_id]);
        }

        // Set process_date for enroll_promotion type
        await dbClient.query(
          'UPDATE member_promotion SET process_date = CURRENT_DATE, status = $1 WHERE member_promotion_id = $2',
          ['processed', memberPromotion.member_promotion_id]
        );
      } else if (promotion.reward_type === 'external') {
        // External rewards: process_date stays NULL until manual fulfillment
        // Status stays 'qualified' until processed
      }

      await dbClient.query('COMMIT');
      res.json(qualifiedPromotion);

    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error qualifying member promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PROMOTION ENGINE - Evaluate and track promotion progress for activities
// ============================================================================

// ============================================================================
// SYSTEM CONSOLE - Debug toggle, database stats, vacuum control
// ============================================================================

// Get current debug state
app.get('/v1/system/debug', (req, res) => {
  res.json({ debug_enabled: DEBUG_ENABLED });
});

// Get current database name
app.get('/v1/system/database', (req, res) => {
  res.json({ database: currentDatabaseName });
});

// Toggle debug state (updates both memory and database)
app.put('/v1/system/debug', async (req, res) => {
  if (!dbClient) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    
    // Update sysparm value
    const value = enabled ? 'Y' : 'N';
    const success = await setEmbeddedListValue('sysparm', 'debug', 'enabled', value, 1);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update debug setting' });
    }
    
    // Update memory variable
    DEBUG_ENABLED = enabled;
    
    console.log(`Debug logging ${enabled ? 'ENABLED' : 'DISABLED'} via System Console`);
    
    res.json({ 
      debug_enabled: DEBUG_ENABLED,
      message: `Debug logging ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error toggling debug:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get database statistics
app.get('/v1/system/stats', async (req, res) => {
  if (!dbClient) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    // Get table statistics
    const statsQuery = `
      SELECT 
        schemaname,
        relname as tablename,
        n_live_tup::bigint as row_count,
        n_dead_tup::bigint as dead_tuples,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_relation_size(relid)) as table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as indexes_size,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(relid) DESC
    `;
    
    const statsResult = await dbClient.query(statsQuery);
    
    // Get database size
    const dbSizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `;
    const dbSizeResult = await dbClient.query(dbSizeQuery);
    
    // Categorize tables
    const categories = {
      core: ['member', 'activity', 'activity_detail', 'activity_bonus', 'point_lot'],
      promotions: ['promotion', 'member_promotion', 'member_promotion_detail'],
      bonuses: ['bonus'],
      config: ['rule', 'rule_criteria', 'molecule_def', 'molecule_value_text', 
               'molecule_value_numeric', 'molecule_value_boolean', 'molecule_value_date',
               'molecule_value_embedded_list', 'molecule_value_lookup', 'molecule_value_ref'],
      partners: ['partner', 'partner_program'],
      redemptions: ['redemption_rule', 'redemption_detail'],
      adjustments: ['adjustment'],
      tiers: ['tier_definition', 'member_tier'],
      lookups: ['carriers', 'airports'],
      templates: ['display_template', 'display_template_line'],
      other: []
    };
    
    // Categorize each table
    const categorizedTables = {};
    for (const [category, tables] of Object.entries(categories)) {
      categorizedTables[category] = [];
    }
    
    statsResult.rows.forEach(row => {
      let found = false;
      for (const [category, tables] of Object.entries(categories)) {
        if (tables.includes(row.tablename)) {
          categorizedTables[category].push(row);
          found = true;
          break;
        }
      }
      if (!found) {
        categorizedTables.other.push(row);
      }
    });
    
    res.json({
      database_size: dbSizeResult.rows[0].database_size,
      tables: categorizedTables,
      all_tables: statsResult.rows
    });
    
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run VACUUM on table(s)
app.post('/v1/system/vacuum', async (req, res) => {
  if (!dbClient) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const { table, analyze } = req.body;
    const startTime = Date.now();
    
    let query;
    let description;
    
    if (table && table !== 'all') {
      // Vacuum specific table
      // Validate table name to prevent SQL injection
      const validTableResult = await dbClient.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [table]
      );
      
      if (validTableResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid table name' });
      }
      
      query = `VACUUM ${analyze ? 'ANALYZE' : ''} ${table}`;
      description = `${table}`;
    } else {
      // Vacuum entire database
      query = `VACUUM ${analyze ? 'ANALYZE' : ''}`;
      description = 'all tables';
    }
    
    await dbClient.query(query);
    
    const duration = Date.now() - startTime;
    
    console.log(`VACUUM completed on ${description} in ${duration}ms`);
    
    res.json({
      success: true,
      message: `VACUUM ${analyze ? 'ANALYZE ' : ''}completed on ${description}`,
      duration_ms: duration
    });
    
  } catch (error) {
    console.error('Error running VACUUM:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== DATABASE ADMIN ENDPOINTS =====

// GET /v1/admin/databases - List all databases
app.get('/v1/admin/databases', async (req, res) => {
  try {
    // Get current database name - this is where we'll return to
    const originalDbName = currentDatabaseName;
    
    // System databases to exclude from display
    const excludedDatabases = ['postgres', 'billjansen', 'template0', 'template1'];
    
    // Query all databases with sizes (excluding system DBs)
    const dbResult = await dbClient.query(`
      SELECT 
        datname as name,
        pg_size_pretty(pg_database_size(datname)) as size
      FROM pg_database
      WHERE datistemplate = false
        AND datname NOT IN ('postgres', 'billjansen')
      ORDER BY datname
    `);
    
    // Build results array with member counts
    const databases = [];
    
    for (const db of dbResult.rows) {
      let memberCount = null;
      let tableCount = null;
      
      if (db.name === originalDbName) {
        // Current database - query directly
        try {
          const tableResult = await dbClient.query(`
            SELECT count(*)::int as count
            FROM information_schema.tables 
            WHERE table_catalog = $1 AND table_schema = 'public'
          `, [db.name]);
          tableCount = tableResult.rows[0].count;
          
          const memberResult = await dbClient.query(`
            SELECT count(*)::int as count FROM member
          `);
          memberCount = memberResult.rows[0].count;
        } catch (e) {
          // member table might not exist
          memberCount = null;
        }
      } else {
        // Other database - need to connect temporarily
        let tempClient = null;
        try {
          tempClient = new Client({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: db.name,
            port: DB_PORT
          });
          await tempClient.connect();
          
          // Get table count
          const tableResult = await tempClient.query(`
            SELECT count(*)::int as count
            FROM information_schema.tables 
            WHERE table_catalog = $1 AND table_schema = 'public'
          `, [db.name]);
          tableCount = tableResult.rows[0].count;
          
          // Get member count
          const memberResult = await tempClient.query(`
            SELECT count(*)::int as count FROM member
          `);
          memberCount = memberResult.rows[0].count;
          
        } catch (e) {
          // Database might not have member table or connection failed
          memberCount = null;
        } finally {
          if (tempClient) {
            try { await tempClient.end(); } catch (e) { /* ignore */ }
          }
        }
      }
      
      databases.push({
        name: db.name,
        size: db.size,
        tables: tableCount,
        members: memberCount
      });
    }
    
    res.json({
      ok: true,
      current: originalDbName,
      databases: databases
    });
    
  } catch (error) {
    console.error('Error listing databases:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/admin/database/switch - Switch to different database
app.post('/v1/admin/database/switch', async (req, res) => {
  try {
    const { database } = req.body;
    
    if (!database) {
      return res.status(400).json({ error: 'Database name is required' });
    }
    
    // Save original database name for fallback
    const originalDatabase = dbClient ? dbClient.database : DB_DATABASE;
    
    // Verify database exists
    const checkQuery = await dbClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [database]
    );
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ error: `Database '${database}' not found` });
    }
    
    console.log(`\n🔄 Switching database from '${dbClient.database}' to '${database}'...`);
    
    // Close current connection
    await dbClient.end();
    console.log('   ✓ Closed connection to old database');
    
    // Create new connection
    dbClient = new Client({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: database,
      port: DB_PORT
    });
    
    // Connect to new database
    await dbClient.connect();
    currentDatabaseName = database;
    console.log(`Database: ${dbClient ? `CONNECTED to ${currentDatabaseName}` : 'NOT CONNECTED - using mock data'}`);
    
    res.json({
      ok: true,
      message: `Successfully switched to database: ${database}`,
      database: database
    });
    
  } catch (error) {
    console.error('Error switching database:', error);
    
    // Try to reconnect to original database if switch failed
    try {
      dbClient = new Client({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: originalDatabase, // Use saved original database
        port: DB_PORT
      });
      await dbClient.connect();
      currentDatabaseName = originalDatabase;
      console.log(`   ⚠️  Reconnected to original database (${originalDatabase})`);
    } catch (reconnectError) {
      console.error('   ❌ Failed to reconnect:', reconnectError);
    }
    
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/admin/database/clone - Clone a database
app.post('/v1/admin/database/clone', async (req, res) => {
  try {
    const { source, target, type } = req.body;
    
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target database names are required' });
    }
    
    // Validate target name
    if (!/^[a-z][a-z0-9_]*$/.test(target)) {
      return res.status(400).json({ 
        error: 'Database name must start with a letter and contain only lowercase letters, numbers, and underscores' 
      });
    }
    
    // Check if target already exists
    const existsQuery = await dbClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [target]
    );
    
    if (existsQuery.rows.length > 0) {
      return res.status(409).json({ error: `Database '${target}' already exists` });
    }
    
    console.log(`\n📋 Cloning database '${source}' → '${target}' (${type})...`);
    
    if (type === 'full') {
      // Full copy with data using template
      await dbClient.query(`CREATE DATABASE ${target} WITH TEMPLATE ${source}`);
      console.log(`   ✓ Created full copy with data`);
      
    } else {
      // Schema only - use pg_dump and pg_restore
      try {
        // Create empty target database first
        await dbClient.query(`CREATE DATABASE ${target}`);
        console.log(`   ✓ Created empty database`);
        
        // Build pg_dump command for schema only
        const dumpCmd = `pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${source} --schema-only --no-owner --no-acl`;
        const restoreCmd = `psql -h ${DB_HOST} -U ${DB_USER} -d ${target}`;
        
        console.log(`   → Copying schema using pg_dump | psql...`);
        
        // Execute: pg_dump source | psql target
        await execAsync(`${dumpCmd} | ${restoreCmd}`);
        
        console.log(`   ✓ Schema copied successfully`);
        
      } catch (pgError) {
        console.error(`   ⚠️  pg_dump failed:`, pgError.message);
        console.log(`   ℹ️  Database created but schema not copied. You may need to configure PostgreSQL authentication.`);
      }
    }
    
    res.json({
      ok: true,
      message: `Successfully cloned ${source} → ${target}`,
      source: source,
      target: target,
      type: type
    });
    
  } catch (error) {
    console.error('Error cloning database:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/admin/database/delete - Delete a database
app.post('/v1/admin/database/delete', async (req, res) => {
  try {
    const { database } = req.body;
    
    if (!database) {
      return res.status(400).json({ error: 'Database name is required' });
    }
    
    // Prevent deletion of system databases
    const protectedDbs = ['postgres', 'template0', 'template1'];
    if (protectedDbs.includes(database)) {
      return res.status(403).json({ error: 'Cannot delete system database' });
    }
    
    // Prevent deletion of currently connected database
    if (dbClient && dbClient.database === database) {
      return res.status(403).json({ error: 'Cannot delete currently connected database. Switch to another database first.' });
    }
    
    console.log(`\n🗑️  Deleting database '${database}'...`);
    
    // Terminate connections to target database
    await dbClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [database]);
    
    console.log(`   ✓ Terminated connections`);
    
    // Drop database
    await dbClient.query(`DROP DATABASE ${database}`);
    console.log(`   ✓ Database deleted`);
    
    res.json({
      ok: true,
      message: `Successfully deleted database: ${database}`,
      database: database
    });
    
  } catch (error) {
    console.error('Error deleting database:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== DATA LOADER API =====

// In-memory job tracker
const dataLoadJobs = new Map();
const stressTestJobs = new Map();

// POST /v1/admin/data-loader/start - Start data loading job
app.post('/v1/admin/data-loader/start', async (req, res) => {
  try {
    const config = req.body;
    
    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job tracking
    const job = {
      jobId: jobId,
      database: config.database,
      config: config,
      status: 'running',
      startTime: Date.now(),
      membersCreated: 0,
      currentMembershipNumber: null, // Will be set when job actually starts
      activitiesPosted: 0,
      partnerActivities: 0,
      bonusesApplied: 0,
      promotionsEnrolled: 0,
      promotionDetails: 0,
      totalMembers: config.memberCount,
      errors: []
    };
    
    dataLoadJobs.set(jobId, job);
    
    console.log(`\n🚀 Starting data load job ${jobId} for database ${config.database}`);
    console.log(`   Members: ${config.memberCount.toLocaleString()}`);
    console.log(`   Activities/member: ${config.activitiesPerMember}`);
    console.log(`   Promotions/member: ${config.promotionsPerMember}`);
    
    // Start the background job
    runDataLoadJob(jobId).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      job.status = 'error';
      job.errors.push(error.message);
    });
    
    res.json({
      ok: true,
      jobId: jobId,
      message: 'Data load job started'
    });
    
  } catch (error) {
    console.error('Error starting data load:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/admin/data-loader/progress/:jobId - Get job progress
app.get('/v1/admin/data-loader/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = dataLoadJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const elapsed = (Date.now() - job.startTime) / 1000; // seconds
  const percentage = job.totalMembers > 0 ? (job.membersCreated / job.totalMembers * 100) : 0;
  const rate = elapsed > 0 ? job.activitiesPosted / elapsed : 0;
  const remaining = job.totalMembers - job.membersCreated;
  const eta = rate > 0 && remaining > 0 ? (remaining * job.config.activitiesPerMember) / rate : 0;
  
  res.json({
    jobId: job.jobId,
    status: job.status,
    percentage: percentage,
    membersCreated: job.membersCreated,
    currentMembershipNumber: job.currentMembershipNumber,
    activitiesPosted: job.activitiesPosted,
    partnerActivities: job.partnerActivities,
    bonusesApplied: job.bonusesApplied,
    promotionsEnrolled: job.promotionsEnrolled,
    promotionDetails: job.promotionDetails,
    totalMembers: job.totalMembers,
    rate: rate,
    elapsedSeconds: elapsed,
    etaSeconds: eta,
    errors: job.errors
  });
});

// POST /v1/admin/data-loader/stop/:jobId - Stop a running job
app.post('/v1/admin/data-loader/stop/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = dataLoadJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  job.status = 'stopped';
  console.log(`\n⏹ Stopped data load job ${jobId}`);
  
  res.json({
    ok: true,
    message: 'Job stopped'
  });
});

// Background job runner
async function runDataLoadJob(jobId) {
  const job = dataLoadJobs.get(jobId);
  if (!job) {
    return;
  }
  
  const { config } = job;
  
  try {
    // Get tenant_id
    const tenantResult = await dbClient.query('SELECT tenant_id FROM tenant LIMIT 1');
    if (tenantResult.rows.length === 0) {
      throw new Error('No tenant found in database');
    }
    const tenantId = tenantResult.rows[0].tenant_id;
    
    // Get the last membership_number to start from
    const maxMembershipResult = await dbClient.query("SELECT MAX(membership_number::bigint) as max_num FROM member WHERE membership_number IS NOT NULL AND membership_number != ''");
    const startingNumber = parseInt(maxMembershipResult.rows[0]?.max_num || 0, 10) + 1;
    console.log(`📊 Starting membership_number: ${startingNumber}`);
    
    // Get ID ranges for random selection
    const carrierRange = await dbClient.query('SELECT MIN(carrier_id) as min, MAX(carrier_id) as max FROM carriers WHERE tenant_id = $1', [tenantId]);
    const carrierMin = carrierRange.rows[0]?.min || 1;
    const carrierMax = carrierRange.rows[0]?.max || 10;
    
    const airportRange = await dbClient.query('SELECT MIN(airport_id) as min, MAX(airport_id) as max FROM airports');
    const airportMin = airportRange.rows[0]?.min || 1;
    const airportMax = airportRange.rows[0]?.max || 15;
    
    const bonusRange = await dbClient.query('SELECT MIN(bonus_id) as min, MAX(bonus_id) as max FROM bonus WHERE tenant_id = $1', [tenantId]);
    const bonusMin = bonusRange.rows[0]?.min || 1;
    const bonusMax = bonusRange.rows[0]?.max || 3;
    
    // Get promotions for enrollment
    const promoResult = await dbClient.query('SELECT promotion_id, goal_amount FROM promotion WHERE tenant_id = $1 AND enrollment_type = $2 LIMIT 20', [tenantId, 'A']);
    const promotions = promoResult.rows;
    
    // Get molecule IDs
    const getMoleculeId = async (key) => {
      const result = await dbClient.query('SELECT molecule_id FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2', [key, tenantId]);
      return result.rows[0]?.molecule_id;
    };
    
    const carrierMoleculeId = await getMoleculeId('carrier');
    const originMoleculeId = await getMoleculeId('origin');
    const destinationMoleculeId = await getMoleculeId('destination');
    const fareClassMoleculeId = await getMoleculeId('fare_class');
    const flightNumberMoleculeId = await getMoleculeId('flight_number');
    const mqdMoleculeId = await getMoleculeId('mqd');
    
    // Get fare class value_ids
    let fareClassValueIds = [];
    if (fareClassMoleculeId) {
      const fareResult = await dbClient.query(
        'SELECT value_id FROM molecule_value_text WHERE molecule_id = $1',
        [fareClassMoleculeId]
      );
      fareClassValueIds = fareResult.rows.map(r => r.value_id);
    }
    
    const randomId = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const BATCH_SIZE = config.batchSize || 1000;
    
    // Name/address data
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 
                       'William', 'Patricia', 'Richard', 'Jennifer', 'Charles', 'Linda', 'Thomas', 'Elizabeth',
                       'Christopher', 'Susan', 'Daniel', 'Jessica', 'Matthew', 'Karen', 'Anthony', 'Nancy'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 
                      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
                      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'White', 'Harris', 'Clark'];
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Pine Rd', 'Cedar Ln', 'Elm St', 'Park Ave', 
                    'Washington St', 'Lake Dr', 'Hill Rd', 'Forest Ave', 'River Rd', 'Sunset Blvd'];
    const cities = [
      {city: 'Minneapolis', state: 'MN', zip: '55401'},
      {city: 'Chicago', state: 'IL', zip: '60601'},
      {city: 'New York', state: 'NY', zip: '10001'},
      {city: 'Los Angeles', state: 'CA', zip: '90001'},
      {city: 'Houston', state: 'TX', zip: '77001'},
      {city: 'Phoenix', state: 'AZ', zip: '85001'},
      {city: 'Philadelphia', state: 'PA', zip: '19019'},
      {city: 'San Antonio', state: 'TX', zip: '78201'},
      {city: 'San Diego', state: 'CA', zip: '92101'},
      {city: 'Dallas', state: 'TX', zip: '75201'},
      {city: 'Austin', state: 'TX', zip: '78701'},
      {city: 'Seattle', state: 'WA', zip: '98101'},
      {city: 'Denver', state: 'CO', zip: '80201'},
      {city: 'Boston', state: 'MA', zip: '02101'},
      {city: 'Atlanta', state: 'GA', zip: '30301'}
    ];
    
    // Create worker connections
    const numWorkers = config.concurrency || 1;
    const workers = [];
    const targetDatabase = currentDatabaseName;
    
    console.log(`   Creating ${numWorkers} worker connections to ${targetDatabase}`);
    
    for (let w = 0; w < numWorkers; w++) {
      const workerClient = new Client({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: targetDatabase,
        port: DB_PORT
      });
      await workerClient.connect();
      workers.push(workerClient);
    }
    
    console.log(`   Created ${numWorkers} worker connections`);
    
    // Shared counter - workers grab next member number
    let nextMemberNumber = startingNumber;
    const getNextMemberNumber = () => {
      if (nextMemberNumber >= startingNumber + config.memberCount) return null;
      return nextMemberNumber++;
    };
    
    // Worker function - grabs work from shared counter
    const workerFn = async (workerClient, workerId) => {
      let batchCount = 0;
      
      while (job.status === 'running') {
        const memberNum = getNextMemberNumber();
        if (memberNum === null) break;
        
        try {
          // Start transaction at batch boundaries
          if (batchCount % BATCH_SIZE === 0) {
            await workerClient.query('BEGIN');
          }
          
          const firstName = config.varyNames ? firstNames[Math.floor(Math.random() * firstNames.length)] : 'Test';
          const lastName = config.varyNames ? lastNames[Math.floor(Math.random() * lastNames.length)] : 'User';
          const streetNum = Math.floor(Math.random() * 9000) + 1000;
          const street = streets[Math.floor(Math.random() * streets.length)];
          const location = cities[Math.floor(Math.random() * cities.length)];
          const address = `${streetNum} ${street}`;
          const areaCode = Math.floor(Math.random() * 700) + 200;
          const exchange = Math.floor(Math.random() * 800) + 200;
          const lineNum = Math.floor(Math.random() * 9000) + 1000;
          const phone = `${areaCode}-${exchange}-${lineNum}`;
          
          // Create member
          const memberResult = await workerClient.query(`
            INSERT INTO member (
              member_id, tenant_id, fname, lname, middle_initial, email, is_active, membership_number,
              address1, address2, city, state, zip, zip_plus4, phone
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING member_id
          `, [
            memberNum,
            tenantId, firstName, lastName, 
            firstName.charAt(0),
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}${memberNum}@test.com`,
            memberNum.toString(),
            address,
            Math.random() > 0.7 ? `Apt ${Math.floor(Math.random() * 900) + 100}` : null,
            location.city,
            location.state,
            location.zip,
            Math.floor(Math.random() * 9000) + 1000,
            phone
          ]);
          
          const memberId = memberResult.rows[0].member_id;
          job.membersCreated++;
          job.currentMembershipNumber = memberNum;
          
          // Enroll member in promotions
          const numPromos = config.promotionsPerMember > 0 ? Math.floor(config.promotionsPerMember * (0.8 + Math.random() * 0.4)) : 0;
          const memberPromotions = [];
          
          for (let p = 0; p < numPromos && promotions.length > 0; p++) {
            const promo = promotions[Math.floor(Math.random() * promotions.length)];
            const mpResult = await workerClient.query(`
              INSERT INTO member_promotion (member_id, promotion_id, tenant_id, enrolled_date, progress_counter, goal_amount)
              VALUES ($1, $2, $3, CURRENT_DATE, 0, $4)
              RETURNING member_promotion_id
            `, [memberId, promo.promotion_id, tenantId, promo.goal_amount]);
            
            memberPromotions.push({
              member_promotion_id: mpResult.rows[0].member_promotion_id,
              activities_contributed: 0,
              target: Math.floor(config.activitiesPerPromotion * (0.8 + Math.random() * 0.4))
            });
            
            job.promotionsEnrolled++;
          }
          
          // Generate activities for this member
          const numActivities = Math.floor(config.activitiesPerMember * (0.8 + Math.random() * 0.4));
          const numPartner = config.includePartner ? Math.floor(numActivities * 0.2) : 0;
          
          for (let a = 0; a < numActivities && job.status === 'running'; a++) {
            const daysAgo = Math.floor(Math.random() * (config.dateRangeMonths * 30));
            const activityDate = new Date();
            activityDate.setDate(activityDate.getDate() - daysAgo);
            const activityDateStr = activityDate.toISOString().split('T')[0];
            
            const isPartner = a < numPartner;
            const miles = 500 + Math.floor(Math.random() * 1000);
            
            // Insert activity
            const activityResult = await workerClient.query(`
              INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount)
              VALUES ($1, $2, $2, $3, $4)
              RETURNING activity_id
            `, [memberId, activityDateStr, isPartner ? 'P' : 'A', miles]);
            
            const activityId = activityResult.rows[0].activity_id;
            job.activitiesPosted++;
            if (isPartner) job.partnerActivities++;
            
            // Insert molecules
            if (carrierMoleculeId) {
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, carrierMoleculeId, randomId(carrierMin, carrierMax)]);
            }
            if (originMoleculeId) {
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, originMoleculeId, randomId(airportMin, airportMax)]);
            }
            if (destinationMoleculeId) {
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, destinationMoleculeId, randomId(airportMin, airportMax)]);
            }
            if (fareClassMoleculeId && fareClassValueIds.length > 0) {
              const randomFareClassId = fareClassValueIds[Math.floor(Math.random() * fareClassValueIds.length)];
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, fareClassMoleculeId, randomFareClassId]);
            }
            if (flightNumberMoleculeId) {
              const randomFlightNumber = Math.floor(Math.random() * 9900) + 100;
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, flightNumberMoleculeId, randomFlightNumber]);
            }
            if (mqdMoleculeId) {
              const randomMqd = Math.floor(Math.random() * 1301) + 200;
              await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
                [activityId, mqdMoleculeId, randomMqd]);
            }
            
            // Point lot - find or create with expiration 2 years from activity
            const expireDate = new Date(activityDate);
            expireDate.setFullYear(expireDate.getFullYear() + 2);
            const expireDateStr = expireDate.toISOString().split('T')[0];
            
            const existingLot = await workerClient.query(
              'SELECT lot_id, accrued FROM point_lot WHERE member_id = $1 AND expire_date = $2 LIMIT 1',
              [memberId, expireDateStr]
            );
            
            let lotId;
            if (existingLot.rows.length > 0) {
              lotId = existingLot.rows[0].lot_id;
              const newAccrued = Number(existingLot.rows[0].accrued) + miles;
              await workerClient.query('UPDATE point_lot SET accrued = $1 WHERE lot_id = $2', [newAccrued, lotId]);
            } else {
              const lotResult = await workerClient.query(
                `INSERT INTO point_lot (member_id, point_type, accrued, redeemed, expire_date)
                 VALUES ($1, 'miles', $2, 0, $3) RETURNING lot_id`,
                [memberId, miles, expireDateStr]
              );
              lotId = lotResult.rows[0].lot_id;
            }
            
            await workerClient.query('UPDATE activity SET lot_id = $1 WHERE activity_id = $2', [lotId, activityId]);
            
            // Bonuses
            if (config.includeBonuses) {
              const numBonuses = Math.floor(Math.random() * 4);
              for (let b = 0; b < numBonuses; b++) {
                const bonusPoints = Math.floor(Math.random() * 500) + 100;
                await workerClient.query(`
                  INSERT INTO activity_bonus (activity_id, bonus_id, bonus_points, lot_id)
                  VALUES ($1, $2, $3, $4)
                `, [activityId, randomId(bonusMin, bonusMax), bonusPoints, lotId]);
                job.bonusesApplied++;
              }
            }
            
            // Link to promotions
            for (const mp of memberPromotions) {
              if (mp.activities_contributed < mp.target && Math.random() < 0.5) {
                await workerClient.query(`
                  INSERT INTO member_promotion_detail (member_promotion_id, activity_id, contribution_amount)
                  VALUES ($1, $2, $3)
                `, [mp.member_promotion_id, activityId, miles]);
                mp.activities_contributed++;
                job.promotionDetails++;
              }
            }
          }
          
          batchCount++;
          
          // Commit at batch boundaries
          if (batchCount % BATCH_SIZE === 0) {
            await workerClient.query('COMMIT');
          }
          
        } catch (memberError) {
          try { await workerClient.query('ROLLBACK'); } catch (e) { /* ignore */ }
          console.error(`[Worker ${workerId}, Member ${memberNum}] ${memberError.message}`);
          job.errors.push(`Member ${memberNum}: ${memberError.message}`);
          try { await workerClient.query('BEGIN'); } catch (e) { /* ignore */ }
        }
      }
      
      // Final commit for this worker
      try { await workerClient.query('COMMIT'); } catch (e) { /* ignore */ }
    };
    
    // Reset start time before launching workers
    job.startTime = Date.now();
    
    // Launch all workers
    const workerPromises = workers.map((client, idx) => workerFn(client, idx));
    await Promise.all(workerPromises);
    
    // Close worker connections
    for (const workerClient of workers) {
      try { await workerClient.end(); } catch (e) { /* ignore */ }
    }
    
    if (job.status === 'running') {
      job.status = 'complete';
    }
    
    console.log(`\n✅ Data load ${jobId} complete: ${job.membersCreated} members, ${job.activitiesPosted} activities`);
    
  } catch (error) {
    console.error(`[ERROR] Job ${jobId} failed:`, error);
    job.status = 'error';
    job.errors.push(`FATAL: ${error.message}`);
  }
}

// ===== STRESS TEST API =====

// POST /v1/admin/stress-test/start - Start stress test job
app.post('/v1/admin/stress-test/start', async (req, res) => {
  try {
    const config = req.body;
    
    // Generate job ID
    const jobId = `stress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job tracking
    const job = {
      jobId: jobId,
      config: config,
      status: 'running',
      startTime: Date.now(),
      total: config.accrualCount,
      completed: 0,
      success: 0,
      failures: 0,
      inFlight: 0,
      errors: []
    };
    
    stressTestJobs.set(jobId, job);
    
    console.log(`\n🔥 Starting stress test job ${jobId}`);
    console.log(`   Accruals: ${config.accrualCount.toLocaleString()}`);
    console.log(`   Concurrency: ${config.concurrency}`);
    
    // Start the background job
    runStressTestJob(jobId).catch(error => {
      console.error(`Stress test ${jobId} failed:`, error);
      job.status = 'error';
      job.errors.push(error.message);
    });
    
    res.json({
      ok: true,
      jobId: jobId,
      message: 'Stress test started'
    });
    
  } catch (error) {
    console.error('Error starting stress test:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/admin/stress-test/progress/:jobId - Get job progress
app.get('/v1/admin/stress-test/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = stressTestJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const elapsed = (Date.now() - job.startTime) / 1000;
  const percentage = job.total > 0 ? (job.completed / job.total * 100) : 0;
  const rate = elapsed > 0 ? job.completed / elapsed : 0;
  const remaining = job.total - job.completed;
  const eta = rate > 0 && remaining > 0 ? remaining / rate : 0;
  
  res.json({
    jobId: job.jobId,
    status: job.status,
    percentage: percentage,
    total: job.total,
    completed: job.completed,
    success: job.success,
    failures: job.failures,
    inFlight: job.inFlight,
    rate: rate,
    elapsedSeconds: elapsed,
    etaSeconds: eta,
    errors: job.errors
  });
});

// POST /v1/admin/stress-test/stop/:jobId - Stop a running job
app.post('/v1/admin/stress-test/stop/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = stressTestJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  job.status = 'stopped';
  console.log(`\n⏹ Stopped stress test job ${jobId}`);
  
  res.json({
    ok: true,
    message: 'Job stopped'
  });
});

// Stress test background job runner
async function runStressTestJob(jobId) {
  const job = stressTestJobs.get(jobId);
  if (!job) return;
  
  const { config } = job;
  const tenantId = 1; // Default tenant
  
  try {
    // Get actual member IDs (not just range - there may be gaps)
    const memberResult = await dbClient.query('SELECT member_id FROM member WHERE tenant_id = $1', [tenantId]);
    const memberIds = memberResult.rows.map(r => r.member_id);
    if (memberIds.length === 0) {
      throw new Error('No members found in database');
    }
    console.log(`   Loaded ${memberIds.length} member IDs`);
    
    const carrierRange = await dbClient.query('SELECT MIN(carrier_id) as min, MAX(carrier_id) as max FROM carriers WHERE tenant_id = $1', [tenantId]);
    const carrierMin = carrierRange.rows[0]?.min || 1;
    const carrierMax = carrierRange.rows[0]?.max || 10;
    
    const airportRange = await dbClient.query('SELECT MIN(airport_id) as min, MAX(airport_id) as max FROM airports');
    const airportMin = airportRange.rows[0]?.min || 1;
    const airportMax = airportRange.rows[0]?.max || 15;
    
    // Get molecule IDs
    const getMoleculeId = async (key) => {
      const result = await dbClient.query('SELECT molecule_id FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2', [key, tenantId]);
      return result.rows[0]?.molecule_id;
    };
    
    const carrierMoleculeId = await getMoleculeId('carrier');
    const originMoleculeId = await getMoleculeId('origin');
    const destinationMoleculeId = await getMoleculeId('destination');
    const fareClassMoleculeId = await getMoleculeId('fare_class');
    const flightNumberMoleculeId = await getMoleculeId('flight_number');
    const mqdMoleculeId = await getMoleculeId('mqd');
    
    // Get fare class value_ids
    let fareClassValueIds = [];
    if (fareClassMoleculeId) {
      const fareResult = await dbClient.query(
        'SELECT value_id FROM molecule_value_text WHERE molecule_id = $1',
        [fareClassMoleculeId]
      );
      fareClassValueIds = fareResult.rows.map(r => r.value_id);
    }
    
    const randomId = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Create worker connections
    const numWorkers = config.concurrency || 4;
    const workers = [];
    const targetDatabase = currentDatabaseName;
    
    console.log(`   Creating ${numWorkers} worker connections to ${targetDatabase}`);
    
    for (let w = 0; w < numWorkers; w++) {
      const workerClient = new Client({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: targetDatabase,
        port: DB_PORT
      });
      await workerClient.connect();
      workers.push(workerClient);
    }
    
    console.log(`   Created ${numWorkers} worker connections`);
    
    // Shared work counter
    let nextWork = 0;
    const getNextWork = () => {
      if (nextWork >= config.accrualCount) return null;
      return nextWork++;
    };
    
    // Worker function
    const workerFn = async (workerClient, workerId) => {
      while (job.status === 'running') {
        const workIndex = getNextWork();
        if (workIndex === null) break;
        
        job.inFlight++;
        
        try {
          // Random member from loaded array
          const memberId = memberIds[Math.floor(Math.random() * memberIds.length)];
          
          // Random date within last 30 days
          const daysAgo = Math.floor(Math.random() * 30);
          const activityDate = new Date();
          activityDate.setDate(activityDate.getDate() - daysAgo);
          const dateStr = activityDate.toISOString().split('T')[0];
          
          // Random miles
          const miles = randomId(config.milesMin || 500, config.milesMax || 1500);
          
          // Insert activity
          const activityResult = await workerClient.query(`
            INSERT INTO activity (member_id, activity_date, post_date, activity_type, point_amount)
            VALUES ($1, $2, $2, 'A', $3)
            RETURNING activity_id
          `, [memberId, dateStr, miles]);
          
          const activityId = activityResult.rows[0].activity_id;
          
          // Insert molecules
          if (carrierMoleculeId) {
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, carrierMoleculeId, randomId(carrierMin, carrierMax)]);
          }
          if (originMoleculeId) {
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, originMoleculeId, randomId(airportMin, airportMax)]);
          }
          if (destinationMoleculeId) {
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, destinationMoleculeId, randomId(airportMin, airportMax)]);
          }
          if (fareClassMoleculeId && fareClassValueIds.length > 0) {
            const randomFareClassId = fareClassValueIds[Math.floor(Math.random() * fareClassValueIds.length)];
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, fareClassMoleculeId, randomFareClassId]);
          }
          if (flightNumberMoleculeId) {
            const randomFlightNumber = randomId(100, 9999);
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, flightNumberMoleculeId, randomFlightNumber]);
          }
          if (mqdMoleculeId) {
            const randomMqd = randomId(200, 1500);
            await workerClient.query('INSERT INTO activity_detail (activity_id, molecule_id, v_ref_id) VALUES ($1, $2, $3)',
              [activityId, mqdMoleculeId, randomMqd]);
          }
          
          // Update point lot using worker's connection (inline to use workerClient)
          // Find or create lot with expiration 2 years from activity date
          const expireDate = new Date(activityDate);
          expireDate.setFullYear(expireDate.getFullYear() + 2);
          const expireDateStr = expireDate.toISOString().split('T')[0];
          
          const existingLot = await workerClient.query(
            'SELECT lot_id, accrued FROM point_lot WHERE member_id = $1 AND expire_date = $2 LIMIT 1',
            [memberId, expireDateStr]
          );
          
          if (existingLot.rows.length > 0) {
            const lotId = existingLot.rows[0].lot_id;
            const newAccrued = Number(existingLot.rows[0].accrued) + miles;
            await workerClient.query('UPDATE point_lot SET accrued = $1 WHERE lot_id = $2', [newAccrued, lotId]);
            await workerClient.query('UPDATE activity SET lot_id = $1 WHERE activity_id = $2', [lotId, activityId]);
          } else {
            const lotResult = await workerClient.query(
              `INSERT INTO point_lot (member_id, point_type, accrued, redeemed, expire_date)
               VALUES ($1, 'miles', $2, 0, $3) RETURNING lot_id`,
              [memberId, miles, expireDateStr]
            );
            const lotId = lotResult.rows[0].lot_id;
            await workerClient.query('UPDATE activity SET lot_id = $1 WHERE activity_id = $2', [lotId, activityId]);
          }
          
          job.success++;
        } catch (error) {
          job.failures++;
          if (job.errors.length < 10) {
            job.errors.push(error.message);
          }
          console.error(`   Worker ${workerId} error:`, error.message);
        }
        
        job.completed++;
        job.inFlight--;
      }
    };
    
    // Launch all workers - reset start time so setup isn't counted
    job.startTime = Date.now();
    const workerPromises = workers.map((client, idx) => workerFn(client, idx));
    await Promise.all(workerPromises);
    
    // Close worker connections
    for (const workerClient of workers) {
      try { await workerClient.end(); } catch (e) { /* ignore */ }
    }
    
    if (job.status === 'running') {
      job.status = 'complete';
    }
    
    console.log(`\n✅ Stress test ${jobId} complete: ${job.success} success, ${job.failures} failures`);
    
  } catch (error) {
    console.error(`[ERROR] Stress test ${jobId} failed:`, error);
    job.status = 'error';
    job.errors.push(`FATAL: ${error.message}`);
  }
}

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
  console.log(`Database: ${dbClient ? `CONNECTED to ${currentDatabaseName}` : 'NOT CONNECTED - using mock data'}`);
  console.log(`===========================================\n`);
});
