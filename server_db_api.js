import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { resolveAtom, resolveAtoms } from "./atom_resolve.js";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

// Activity function registry - loaded dynamically from functions directory
const activityFunctions = {};

// Load activity functions from functions directory
async function loadActivityFunctions() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const functionsDir = path.join(__dirname, 'functions');
  
  if (!fs.existsSync(functionsDir)) {
    debugLog('Functions directory not found - no custom functions loaded');
    return;
  }
  
  const files = fs.readdirSync(functionsDir).filter(f => f.endsWith('.js'));
  
  for (const file of files) {
    const funcName = path.basename(file, '.js');
    try {
      const module = await import(`./functions/${file}`);
      activityFunctions[funcName] = module.default;
      debugLog(() => `Loaded activity function: ${funcName}`);
    } catch (e) {
      console.error(`Failed to load function ${funcName}:`, e.message);
    }
  }
}

// Call an activity function by name
async function callActivityFunction(funcName, activityData, context) {
  if (!funcName || funcName.trim() === '') {
    return { success: true, data: activityData }; // No function configured, pass through
  }
  
  const func = activityFunctions[funcName];
  if (!func) {
    console.warn(`Activity function not found: ${funcName}`);
    return { success: true, data: activityData }; // Function not found, pass through
  }
  
  try {
    return await func(activityData, context);
  } catch (e) {
    console.error(`Error in activity function ${funcName}:`, e.message);
    return { success: false, error: 'FUNCTION_ERROR', message: e.message };
  }
}

// Version derived from file modification time - automatic, no human involved
const __filename_local = fileURLToPath(import.meta.url);
const SERVER_VERSION = "2025.12.21.1350";
const BUILD_NOTES = "Tier styling: badge_color, text_color, icon columns";

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

// Value kind helper functions - support both old and new naming
function isLookupMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'lookup' || vk === 'external_list';
}

function isListMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'list' || vk === 'internal_list';
}

function isScalarMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'scalar' || vk === 'value';
}

// ============================================================================
// SHARED CRITERIA EVALUATION
// ============================================================================
// Used by both bonus and promotion engines to evaluate rule criteria
// Returns { pass: boolean, failures: string[] }
async function evaluateCriteria(ruleId, activityData, memberLink, tenantId, activityDate) {
  const failures = [];
  let hasAnyPass = false;
  let hasOrJoiner = false;

  // Fetch criteria for this rule
  const criteriaQuery = `
    SELECT criteria_id, molecule_key, operator, value, label, joiner
    FROM rule_criteria
    WHERE rule_id = $1
    ORDER BY sort_order
  `;
  const criteriaResult = await dbClient.query(criteriaQuery, [ruleId]);

  if (criteriaResult.rows.length === 0) {
    debugLog(() => `   ✓ No criteria defined`);
    return { pass: true, failures: [] };
  }

  debugLog(() => `   → Found ${criteriaResult.rows.length} criteria to evaluate`);

  for (const criterion of criteriaResult.rows) {
    debugLog(() => `   → Checking: ${criterion.label}`);

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
      debugLog(() => `   ⚠ Molecule not found: ${criterion.molecule_key} - skipping`);
      continue;
    }

    const moleculeDef = molDefResult.rows[0];
    const criterionValue = criterion.value;
    let criterionPassed = false;

    // Handle different molecule types
    if (isLookupMolecule(moleculeDef)) {
      // LOOKUP TYPE
      debugLog(() => `   → Lookup molecule: ${criterion.molecule_key}`);

      const lookupConfigQuery = `
        SELECT mvl.table_name, mvl.id_column, mvl.code_column, mvl.label_column
        FROM molecule_value_lookup mvl
        JOIN molecule_def md ON mvl.molecule_id = md.molecule_id
        WHERE md.molecule_key = $1
      `;
      const lookupConfigResult = await dbClient.query(lookupConfigQuery, [criterion.molecule_key]);
      
      if (lookupConfigResult.rows.length === 0) {
        debugLog(() => `   ⚠ Lookup config not found for: ${criterion.molecule_key}`);
        failures.push(`${criterion.label} - Failed (config missing)`);
        continue;
      }

      const activityValue = activityData[criterion.molecule_key];
      debugLog(() => `   → Activity has ${criterion.molecule_key}: "${activityValue}", expects: "${criterionValue}"`);
      
      if (activityValue !== criterionValue) {
        debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
        failures.push(`${criterion.label} - Failed`);
      } else {
        debugLog(() => `   ✓ Criterion passed`);
        criterionPassed = true;
        hasAnyPass = true;
      }

    } else if (isScalarMolecule(moleculeDef)) {
      // SCALAR TYPE
      debugLog(() => `   → Scalar molecule: ${criterion.molecule_key}`);
      const activityVal = activityData[criterion.molecule_key];

      if (criterion.operator === 'equals' || criterion.operator === '=') {
        if (activityVal !== criterionValue) {
          debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
          failures.push(`${criterion.label} - Failed`);
        } else {
          debugLog(() => `   ✓ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        }
      } else if (criterion.operator === '>') {
        if (!(Number(activityVal) > Number(criterionValue))) {
          failures.push(`${criterion.label} - Failed`);
        } else {
          criterionPassed = true;
          hasAnyPass = true;
        }
      } else if (criterion.operator === '>=') {
        if (!(Number(activityVal) >= Number(criterionValue))) {
          failures.push(`${criterion.label} - Failed`);
        } else {
          criterionPassed = true;
          hasAnyPass = true;
        }
      } else if (criterion.operator === '<') {
        if (!(Number(activityVal) < Number(criterionValue))) {
          failures.push(`${criterion.label} - Failed`);
        } else {
          criterionPassed = true;
          hasAnyPass = true;
        }
      } else if (criterion.operator === '<=') {
        if (!(Number(activityVal) <= Number(criterionValue))) {
          failures.push(`${criterion.label} - Failed`);
        } else {
          criterionPassed = true;
          hasAnyPass = true;
        }
      }

    } else if (moleculeDef.value_kind === 'reference') {
      // REFERENCE TYPE (e.g., member_tier_on_date)
      debugLog(() => `   → Reference molecule: ${criterion.molecule_key}`);
      
      if (!memberLink) {
        debugLog(() => `   ⚠ No member context for reference molecule`);
        failures.push(`${criterion.label} - Failed (no member context)`);
        continue;
      }
      
      const refContext = { member_link: memberLink };
      const resolvedValue = await getMoleculeValue(tenantId, criterion.molecule_key, refContext, activityDate);
      
      debugLog(() => `   → Resolved value: "${resolvedValue}", expects: "${criterionValue}"`);
      
      if (criterion.operator === 'equals' || criterion.operator === '=') {
        if (resolvedValue !== criterionValue) {
          debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
          failures.push(`${criterion.label} - Failed`);
        } else {
          debugLog(() => `   ✓ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        }
      } else if (criterion.operator === 'contains') {
        const resolved = String(resolvedValue || '').toLowerCase();
        const target = String(criterionValue || '').toLowerCase();
        if (!resolved.includes(target)) {
          debugLog(() => `   ❌ Criterion failed: "${resolved}" does not contain "${target}"`);
          failures.push(`${criterion.label} - Failed`);
        } else {
          debugLog(() => `   ✓ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        }
      }

    } else if (isListMolecule(moleculeDef)) {
      // LIST TYPE
      debugLog(() => `   → List molecule: ${criterion.molecule_key}`);
      const activityVal = activityData[criterion.molecule_key];

      if (activityVal !== criterionValue) {
        debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
        failures.push(`${criterion.label} - Failed`);
      } else {
        debugLog(() => `   ✓ Criterion passed`);
        criterionPassed = true;
        hasAnyPass = true;
      }
    }
  }

  // Determine final result based on AND/OR logic
  if (hasOrJoiner) {
    // OR logic: need at least one to pass
    if (hasAnyPass) {
      debugLog(() => `   ✅ Criteria PASS (OR logic - at least one passed)`);
      return { pass: true, failures: [] };
    } else {
      debugLog(() => `   ❌ Criteria FAIL (OR logic - none passed)`);
      return { pass: false, failures };
    }
  } else {
    // AND logic: all must pass (no failures)
    if (failures.length > 0) {
      debugLog(() => `   ❌ Criteria FAIL (AND logic)`);
      return { pass: false, failures };
    } else {
      debugLog(() => `   ✅ Criteria PASS (AND logic)`);
      return { pass: true, failures: [] };
    }
  }
}

// ============================================================================
// Link Tank & Base-127 Encoding
// ============================================================================
// Base-127 encoding stores numbers in CHARACTER fields without null bytes.
// Each byte position holds values 1-127 (never 0, never 128+).
// Big-endian: MSB first, so strings sort in numeric order.

/**
 * squish - Convert number to base-127 encoded string
 * @param {number} value - Number to encode
 * @param {number} bytes - Output length (1-5)
 * @returns {string} - CHARACTER string of specified length
 */
function squish(value, bytes) {
  const chars = [];
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    chars.unshift(String.fromCharCode((remaining % 127) + 1));
    remaining = Math.floor(remaining / 127);
  }
  return chars.join('');
}

/**
 * unsquish - Convert base-127 encoded string back to number
 * @param {string} buffer - CHARACTER string to decode
 * @returns {number} - Decoded number
 */
function unsquish(buffer) {
  let value = 0;
  for (let i = 0; i < buffer.length; i++) {
    value = value * 127 + (buffer.charCodeAt(i) - 1);
  }
  return value;
}

/**
 * encodeValue - Convert application value to storage format
 * @param {number} value - Value to encode
 * @param {number} size - Storage size (1, 2, 3, 4, or 5)
 * @param {string} valueType - Value type: 'link', 'key', 'code', 'numeric', 'date', 'bigdate'
 * @returns {string|number} - Squished string for 1,3,5; number for 2,4
 * 
 * Encoding rules:
 * - 1,3,5 bytes: Base-127 squish to CHAR
 * - 2,4 bytes with link/key/code: Offset (extends positive range)
 * - 2,4 bytes with numeric/date: Raw (supports signed values)
 */
function encodeValue(value, size, valueType = null) {
  // 1,3,5 bytes: always squish to CHAR
  if (size === 1 || size === 3 || size === 5) {
    return squish(value, size);
  }
  // 2,4 bytes: offset for link/key/code, raw for numeric/date
  if (size === 2) {
    if (valueType === 'link' || valueType === 'key' || valueType === 'code') {
      return value - 32768;
    }
    return value; // numeric, date: raw
  }
  if (size === 4) {
    if (valueType === 'link' || valueType === 'key' || valueType === 'code') {
      return value - 2147483648;
    }
    return value; // numeric: raw
  }
  return value;
}

/**
 * decodeValue - Convert storage format to application value
 * @param {string|number} stored - Stored value
 * @param {number} size - Storage size (1, 2, 3, 4, or 5)
 * @param {string} valueType - Value type: 'link', 'key', 'code', 'numeric', 'date', 'bigdate'
 * @returns {number} - Decoded number
 * 
 * Decoding rules:
 * - 1,3,5 bytes: Unsquish from CHAR
 * - 2,4 bytes with link/key/code: Add offset back
 * - 2,4 bytes with numeric/date: Raw
 */
function decodeValue(stored, size, valueType = null) {
  // For link type CHAR columns (1,3,5 bytes), return raw value - these are foreign key references
  if ((size === 1 || size === 3 || size === 5) && valueType === 'link') {
    return stored;  // Keep as raw CHAR string for FK lookups
  }
  // 1,3,5 bytes: unsquish from CHAR (for key/code/numeric types)
  if (size === 1 || size === 3 || size === 5) {
    return unsquish(stored);
  }
  // 2,4 bytes: offset for link/key/code, raw for numeric/date
  if (size === 2) {
    if (valueType === 'link' || valueType === 'key' || valueType === 'code') {
      return Number(stored) + 32768;
    }
    return Number(stored); // numeric, date: raw
  }
  if (size === 4) {
    if (valueType === 'link' || valueType === 'key' || valueType === 'code') {
      return Number(stored) + 2147483648;
    }
    return Number(stored); // numeric: raw
  }
  return Number(stored);
}

// ============================================
// Generic Molecule Storage Helpers
// ============================================

/**
 * parseStoragePattern - Parse storage pattern string into column definitions
 * @param {string} pattern - Storage pattern (e.g., "2", "54", "2244")
 * @returns {Array<{name: string, type: string, size: number, isChar: boolean}>}
 * 
 * Convention:
 *   Odd digits (1,3,5) → CHAR columns → C1, C2, C3...
 *   Even digits (2,4) → Numeric columns → N1, N2, N3...
 */
function parseStoragePattern(pattern) {
  const columns = [];
  let charCount = 0, numCount = 0;
  
  for (const digit of String(pattern)) {
    const size = parseInt(digit);
    if (size === 1 || size === 3 || size === 5) {
      charCount++;
      columns.push({ 
        name: `C${charCount}`, 
        type: `character(${size})`, 
        size, 
        isChar: true 
      });
    } else if (size === 2 || size === 4) {
      numCount++;
      columns.push({ 
        name: `N${numCount}`, 
        type: size === 2 ? 'smallint' : 'integer', 
        size, 
        isChar: false 
      });
    }
  }
  return columns;
}

/**
 * getDetailTableName - Derive detail table name from storage pattern
 * @param {string} context - 'activity' or 'member' (now ignored, kept for compatibility)
 * @param {string} storageSize - Storage pattern (e.g., "2", "54", "2244")
 * @returns {string} Table name (e.g., "5_data_2", "5_data_2244")
 */
function getDetailTableName(context, storageSize) {
  return `"5_data_${storageSize}"`;
}

/**
 * getMoleculeStorageInfo - Get storage info for a molecule from molecule_def
 * @param {number} tenantId - Tenant ID
 * @param {string} moleculeKey - Molecule key (e.g., "carrier", "member_point_bucket")
 * @returns {Promise<{moleculeId, context, storageSize, tableName, columns}>}
 */
async function getMoleculeStorageInfo(tenantId, moleculeKey) {
  const result = await dbClient.query(`
    SELECT molecule_id, context, storage_size, value_type
    FROM molecule_def
    WHERE molecule_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    ORDER BY tenant_id DESC NULLS LAST
    LIMIT 1
  `, [moleculeKey, tenantId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Molecule ${moleculeKey} not found for tenant ${tenantId}`);
  }
  
  const { molecule_id, context, storage_size, value_type } = result.rows[0];
  const tableName = getDetailTableName(context, storage_size);
  const columns = parseStoragePattern(storage_size);
  
  // Get per-column encoding from molecule_column_def (column_type: key, ref, numeric, date)
  const colDefsResult = await dbClient.query(`
    SELECT column_name, column_type FROM molecule_column_def
    WHERE molecule_id = $1
    ORDER BY column_order
  `, [molecule_id]);
  
  // Map column_type to valueType for encoding
  // key, ref, code, date → offset encoding (always positive values)
  // link → raw pass-through (CHAR FK references)
  // numeric → no offset (can be negative, e.g., point adjustments)
  for (let i = 0; i < columns.length; i++) {
    const colDef = colDefsResult.rows[i];
    if (colDef) {
      const ct = colDef.column_type;
      if (ct === 'link') {
        columns[i].valueType = 'link'; // raw pass-through for FK lookups
      } else if (ct === 'key' || ct === 'ref' || ct === 'code' || ct === 'date') {
        columns[i].valueType = 'key'; // offset encoding
      } else {
        columns[i].valueType = 'numeric'; // no offset
      }
    } else {
      // Fallback to molecule_def value_type for backwards compatibility
      columns[i].valueType = value_type || null;
    }
  }
  
  return { moleculeId: molecule_id, context, storageSize: storage_size, valueType: value_type, tableName, columns };
}

/**
 * insertMoleculeRow - Insert a row into the appropriate detail table
 * @param {string} pLink - Parent link (activity or member link)
 * @param {string} moleculeKey - Molecule key
 * @param {Array<number>} values - Values in column order (will be encoded)
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<number|null>} detail_id if table has one, null otherwise
 */
async function insertMoleculeRow(pLink, moleculeKey, values, tenantId, attachesOverride = null, clientOverride = null) {
  const info = await getMoleculeStorageInfo(tenantId, moleculeKey);
  const queryClient = clientOverride || dbClient;
  
  if (values.length !== info.columns.length) {
    throw new Error(`Expected ${info.columns.length} values for ${moleculeKey}, got ${values.length}`);
  }
  
  // Determine attaches_to from context, or use override (for 'L' alias context)
  const attachesTo = attachesOverride || (info.context === 'activity' ? 'A' : 'M');
  
  // Build column names and encoded values (include attaches_to)
  const colNames = ['p_link', 'attaches_to', 'molecule_id', ...info.columns.map(c => c.name)];
  const encodedValues = [pLink, attachesTo, info.moleculeId];
  
  for (let i = 0; i < values.length; i++) {
    const col = info.columns[i];
    // Use encodeValue with per-column valueType for proper encoding
    encodedValues.push(encodeValue(values[i], col.size, col.valueType));
  }
  
  const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
  
  // Check if table has detail_id (only member context composite tables have it)
  const hasDetailId = info.context === 'member' && String(info.storageSize).length > 1;
  const returning = hasDetailId ? 'RETURNING detail_id' : '';
  
  const sql = `INSERT INTO ${info.tableName} (${colNames.join(', ')}) VALUES (${placeholders}) ${returning}`;
  const result = await queryClient.query(sql, encodedValues);
  
  return hasDetailId ? result.rows[0]?.detail_id : null;
}

/**
 * getMoleculeRows - Read rows from detail table for a given link and molecule
 * @param {string} pLink - Parent link
 * @param {string} moleculeKey - Molecule key
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array<Object>>} Rows with decoded values {N1, N2, C1, detail_id, ...}
 */
async function getMoleculeRows(pLink, moleculeKey, tenantId) {
  const info = await getMoleculeStorageInfo(tenantId, moleculeKey);
  
  const colNames = info.columns.map(c => c.name);
  const hasDetailId = info.context === 'member' && String(info.storageSize).length > 1;
  const selectCols = hasDetailId ? [...colNames, 'detail_id'] : colNames;
  
  const sql = `
    SELECT ${selectCols.join(', ')}
    FROM ${info.tableName}
    WHERE p_link = $1 AND molecule_id = $2
  `;
  const result = await dbClient.query(sql, [pLink, info.moleculeId]);
  
  
  // Decode values using decodeValue with per-column valueType
  return result.rows.map(row => {
    const decoded = {};
    for (let i = 0; i < info.columns.length; i++) {
      const col = info.columns[i];
      const raw = row[col.name.toLowerCase()];
      decoded[col.name] = decodeValue(raw, col.size, col.valueType);
    }
    if (hasDetailId) {
      decoded.detail_id = Number(row.detail_id);
    }
    return decoded;
  });
}

/**
 * findMoleculeRow - Find a row matching specific key values
 * @param {string} pLink - Parent link
 * @param {string} moleculeKey - Molecule key
 * @param {Object} keyValues - Object with column names and values to match (e.g., {N1: ruleId, N2: expireDate})
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object|null>} Matching row with decoded values, or null
 */
async function findMoleculeRow(pLink, moleculeKey, keyValues, tenantId) {
  const info = await getMoleculeStorageInfo(tenantId, moleculeKey);
  
  const colNames = info.columns.map(c => c.name);
  const hasDetailId = info.context === 'member' && String(info.storageSize).length > 1;
  const selectCols = hasDetailId ? [...colNames, 'detail_id'] : colNames;
  
  // Build WHERE clause for key values
  const whereParts = ['p_link = $1', 'molecule_id = $2'];
  const params = [pLink, info.moleculeId];
  let paramIdx = 3;
  
  for (const [colName, value] of Object.entries(keyValues)) {
    const col = info.columns.find(c => c.name === colName);
    if (!col) {
      throw new Error(`Unknown column ${colName} for molecule ${moleculeKey}`);
    }
    // Use encodeValue with per-column valueType
    const encodedValue = encodeValue(value, col.size, col.valueType);
    whereParts.push(`${colName} = $${paramIdx}`);
    params.push(encodedValue);
    paramIdx++;
  }
  
  const sql = `
    SELECT ${selectCols.join(', ')}
    FROM ${info.tableName}
    WHERE ${whereParts.join(' AND ')}
    LIMIT 1
  `;
  const result = await dbClient.query(sql, params);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  // Decode values using decodeValue with per-column valueType
  const row = result.rows[0];
  const decoded = {};
  for (const col of info.columns) {
    const raw = row[col.name.toLowerCase()];
    decoded[col.name] = decodeValue(raw, col.size, col.valueType);
  }
  if (hasDetailId) {
    decoded.detail_id = Number(row.detail_id);
  }
  return decoded;
}

/**
 * updateMoleculeRow - Update specific columns in a molecule row
 * @param {string} tableName - Table name (derived from molecule)
 * @param {Object} updates - Object with column names and new values {N3: newValue}
 * @param {Object} where - Object with WHERE conditions {detail_id: 123}
 * @param {Array<Object>} columns - Column definitions from parseStoragePattern
 * @returns {Promise<void>}
 */
async function updateMoleculeRowByTable(tableName, updates, where, columns) {
  // Build SET clause
  const setParts = [];
  const params = [];
  let paramIdx = 1;
  
  for (const [colName, value] of Object.entries(updates)) {
    const col = columns.find(c => c.name === colName);
    if (col) {
      const encodedValue = col.isChar ? squish(value, col.size) : value;
      setParts.push(`${colName} = $${paramIdx}`);
      params.push(encodedValue);
      paramIdx++;
    } else if (colName === 'detail_id') {
      // Allow updating detail_id directly (rare but possible)
      setParts.push(`${colName} = $${paramIdx}`);
      params.push(value);
      paramIdx++;
    }
  }
  
  // Build WHERE clause
  const whereParts = [];
  for (const [colName, value] of Object.entries(where)) {
    whereParts.push(`${colName} = $${paramIdx}`);
    params.push(value);
    paramIdx++;
  }
  
  const sql = `UPDATE ${tableName} SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`;
  await dbClient.query(sql, params);
}

/**
 * deleteMoleculeRows - Delete all molecule rows for a given link from a detail table
 * @param {string} pLink - Parent link
 * @param {string} tableName - Table name
 * @returns {Promise<void>}
 */
async function deleteMoleculeRowsFromTable(pLink, tableName) {
  await dbClient.query(`DELETE FROM ${tableName} WHERE p_link = $1`, [pLink]);
}

/**
 * deleteAllMoleculeRowsForLink - Delete from ALL detail tables for a given link
 * @param {string} pLink - Parent link
 * @param {string} context - 'activity' or 'member' (maps to attaches_to 'A' or 'M')
 * @returns {Promise<void>}
 */
async function deleteAllMoleculeRowsForLink(pLink, context, clientOverride = null) {
  // Support direct attaches_to values ('A', 'M', 'L') or context strings ('activity', 'member', 'alias')
  let attachesTo;
  if (context === 'A' || context === 'M' || context === 'L') {
    attachesTo = context;
  } else {
    attachesTo = context === 'activity' ? 'A' : (context === 'alias' ? 'L' : 'M');
  }
  
  const queryClient = clientOverride || dbClient;
  const tables = [
    '"5_data_1"',
    '"5_data_2"',
    '"5_data_3"',
    '"5_data_4"',
    '"5_data_5"',
    '"5_data_54"',
    '"5_data_2244"',
  ];
  
  for (const table of tables) {
    try {
      await queryClient.query(`DELETE FROM ${table} WHERE p_link = $1 AND attaches_to = $2`, [pLink, attachesTo]);
    } catch (e) {
      // Table might not exist, ignore
    }
  }
}

/**
 * getNextDetailId - Get next detail_id for a composite table (if needed)
 * Note: Most composite tables use SERIAL/IDENTITY for detail_id
 * This is a fallback for manual ID generation
 */
async function getNextDetailId(tableName) {
  const result = await dbClient.query(`
    SELECT COALESCE(MAX(detail_id), 0) + 1 as next_id FROM ${tableName}
  `);
  return result.rows[0].next_id;
}

/**
 * incrementMoleculeColumn - Increment a numeric column in a molecule row
 * @param {string} moleculeKey - Molecule key
 * @param {string} colName - Column name to increment (e.g., "N3")
 * @param {number} amount - Amount to add (can be negative)
 * @param {Object} where - WHERE conditions {detail_id: 123} or {p_link: x, N1: y}
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
async function incrementMoleculeColumn(moleculeKey, colName, amount, where, tenantId) {
  const info = await getMoleculeStorageInfo(tenantId, moleculeKey);
  
  // Verify column exists and is numeric
  const col = info.columns.find(c => c.name === colName);
  if (!col) {
    throw new Error(`Unknown column ${colName} for molecule ${moleculeKey}`);
  }
  if (col.isChar) {
    throw new Error(`Cannot increment character column ${colName}`);
  }
  
  // Build WHERE clause
  const whereParts = [];
  const params = [amount];
  let paramIdx = 2;
  
  for (const [key, value] of Object.entries(where)) {
    whereParts.push(`${key} = $${paramIdx}`);
    params.push(value);
    paramIdx++;
  }
  
  const sql = `UPDATE ${info.tableName} SET ${colName} = ${colName} + $1 WHERE ${whereParts.join(' AND ')}`;
  await dbClient.query(sql, params);
}

/**
 * getNextLink - Get next link value for a table (atomic, self-maintaining)
 * @param {number} tenantId - Tenant ID
 * @param {string} tableKey - Table name (e.g., 'member', 'activity')
 * @returns {Promise<string>} - Squished link value
 * 
 * On first call for a tenant/table:
 *   1. Queries information_schema for link column length
 *   2. Inserts row into link_tank with next_link = 1
 * 
 * Every call:
 *   1. SELECT FOR UPDATE (locks row)
 *   2. Gets current value, increments counter
 *   3. Returns squished value
 */
async function getNextLink(tenantId, tableKey) {
  // Try atomic increment first
  let result = await dbClient.query(`
    UPDATE link_tank 
    SET next_link = next_link + 1 
    WHERE tenant_id = $1 AND table_key = $2
    RETURNING next_link - 1 as current_link, link_bytes
  `, [tenantId, tableKey]);
  
  if (result.rows.length === 0) {
    // First time for this tenant/table - discover link column type/length
    const schemaResult = await dbClient.query(`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'link'
    `, [tableKey]);
    
    if (schemaResult.rows.length === 0) {
      throw new Error(`Table ${tableKey} has no link column`);
    }
    
    const { data_type, character_maximum_length } = schemaResult.rows[0];
    let linkBytes;
    
    if (data_type === 'smallint') {
      linkBytes = 2;
    } else if (data_type === 'integer') {
      linkBytes = 4;
    } else if (data_type === 'character') {
      linkBytes = character_maximum_length;
    } else {
      throw new Error(`Unsupported link column type: ${data_type}`);
    }
    
    // Insert new row with proper initial value based on link type
    // For 2/4 byte numeric: prime with offset so first link is the minimum value
    // For 1/3/5 byte CHAR: start at 1
    let initialNextLink, firstLink;
    
    if (linkBytes === 2) {
      // SMALLINT: first link is -32768, next_link starts at -32767
      initialNextLink = -32767;
      firstLink = -32768;
    } else if (linkBytes === 4) {
      // INTEGER: first link is -2147483648, next_link starts at -2147483647
      initialNextLink = -2147483647;
      firstLink = -2147483648;
    } else if (linkBytes === 8) {
      // BIGINT: raw counter starting at 1
      initialNextLink = 2;
      firstLink = 1;
    } else {
      // CHAR(1,3,5): squished, start at 1
      initialNextLink = 2;
      firstLink = 1;
    }
    
    try {
      await dbClient.query(`
        INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
        VALUES ($1, $2, $3, $4)
      `, [tenantId, tableKey, linkBytes, initialNextLink]);
      
      // Return first link value
      if (linkBytes === 8) return firstLink;
      if (linkBytes === 2 || linkBytes === 4) return firstLink;
      return squish(firstLink, linkBytes);
      
    } catch (insertErr) {
      // Race condition - another caller inserted, retry the update
      result = await dbClient.query(`
        UPDATE link_tank 
        SET next_link = next_link + 1 
        WHERE tenant_id = $1 AND table_key = $2
        RETURNING next_link - 1 as current_link, link_bytes
      `, [tenantId, tableKey]);
    }
  }
  
  const { current_link, link_bytes } = result.rows[0];
  
  // Return value based on link_bytes
  if (link_bytes === 8) {
    return current_link;  // Raw BIGINT counter
  }
  if (link_bytes === 2 || link_bytes === 4) {
    return current_link;  // Return raw number
  }
  return squish(current_link, link_bytes);
}

/**
 * insertActivity - Insert activity with proper link and p_link
 * @param {number} tenantId - Tenant ID (for link generation)
 * @param {string} memberLink - Member's link (5-byte CHAR)
 * @param {string|Date} activityDate - Activity date
 * @param {string} activityType - Activity type code
 * @param {Object} client - Optional database client (for transactions)
 * @returns {Promise<{link: string}>}
 */
async function insertActivity(tenantId, memberLink, activityDate, activityType, client = null) {
  const db = client || dbClient;
  
  // Get next link for this activity
  const link = await getNextLink(tenantId, 'activity');
  
  // Convert date to storage format (pass string directly for proper local parsing)
  const activityDateInt = activityDateToStorage(activityDate);
  
  // Insert activity
  await db.query(`
    INSERT INTO activity (activity_date, activity_type, link, p_link)
    VALUES ($1, $2, $3, $4)
  `, [activityDateInt, activityType, link, memberLink]);
  
  return {
    link: link
  };
}

/**
 * calculateLuhnCheckDigit - Calculate Luhn (mod10) check digit
 * @param {string} number - Base number (digits only)
 * @returns {string} - Single check digit
 */
function calculateLuhnCheckDigit(number) {
  const digits = number.split('').map(d => parseInt(d, 10));
  let sum = 0;
  
  // Process from right to left, doubling every second digit
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    // Double every second digit (from the right, starting with first)
    if ((digits.length - i) % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  // Check digit is what makes sum divisible by 10
  return String((10 - (sum % 10)) % 10);
}

/**
 * getNextMembershipNumber - Get next membership number with check digit
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<string>} - Formatted membership number with check digit
 * 
 * Uses:
 *   - link_tank.member_number - counter (atomic increment)
 *   - sysparm.membership_number_offset - added to counter
 *   - sysparm.check_digit_algorithm - 'luhn', 'mod10', or 'none'
 *   - sysparm.member_number_length - optional, pads with leading zeros
 */
async function getNextMembershipNumber(tenantId) {
  // Get next counter from link_tank (atomic increment)
  const counter = Number(await getNextLink(tenantId, 'member_number'));
  
  // Get offset from sysparm
  const offset = Number(await getSysparmByKey(tenantId, 'membership_number_offset')) || 0;
  
  // Membership number = offset + counter
  const nextNumber = offset + counter;
  
  // Get check digit algorithm
  const algorithm = await getSysparmByKey(tenantId, 'check_digit_algorithm') || 'none';
  
  // Get number length for padding
  const lengthStr = await getSysparmByKey(tenantId, 'member_number_length');
  const numberLength = lengthStr ? parseInt(lengthStr, 10) : 0;
  
  // Format base number with padding
  let baseNumber = String(nextNumber);
  if (numberLength > 0) {
    baseNumber = baseNumber.padStart(numberLength, '0');
  }
  
  // Calculate check digit
  let checkDigit = '';
  if (algorithm === 'luhn' || algorithm === 'mod10') {
    checkDigit = calculateLuhnCheckDigit(baseNumber);
  }
  // 'none' = no check digit
  
  return baseNumber + checkDigit;
}

// Helper: Get a single value from sysparm embedded list
/**
 * getSysparmValue - Get a sysparm value (cached)
 * Supports both old format: (tenantId, category, code) with implicit 'sysparm' key
 * And new format: (tenantId, key, category, code)
 */
async function getSysparmValue(tenantId, keyOrCategory, categoryOrCode = null, codeOrClient = null, client = null) {
  // Detect old vs new signature
  // Old: getSysparmValue(tenantId, category, code) - codeOrClient is a string or null, no client
  // New: getSysparmValue(tenantId, key, category, code, client)
  let key, category, code;
  
  if (codeOrClient === null || typeof codeOrClient === 'object') {
    // Old signature: (tenantId, category, code) - use 'sysparm' as default key
    key = 'sysparm';
    category = keyOrCategory;
    code = categoryOrCode;
  } else {
    // New signature: (tenantId, key, category, code)
    key = keyOrCategory;
    category = categoryOrCode;
    code = codeOrClient;
  }
  
  // Check cache first
  const cacheKey = `${tenantId}:${key}:${category || ''}:${code || ''}`;
  const cached = caches.sysparm.get(cacheKey);
  if (cached !== undefined) {
    let value = cached.value;
    // Type coercion
    if (cached.value_type === 'numeric') {
      value = parseFloat(value);
    } else if (cached.value_type === 'boolean') {
      value = value === 'true' || value === '1';
    }
    return value;
  }
  
  // CACHE MISS - log this (shouldn't happen after loadCaches)
  debugLog(() => `⚠️ SYSPARM CACHE MISS: ${cacheKey} (cache size: ${caches.sysparm.size})`);
  
  // Fallback to database if not in cache (shouldn't happen after loadCaches)
  const db = client || (typeof codeOrClient === 'object' ? codeOrClient : null) || dbClient;
  if (!db) return null;
  
  try {
    const result = await db.query(
      `SELECT sd.value, s.value_type
       FROM sysparm s
       JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
       WHERE s.sysparm_key = $1 AND s.tenant_id = $2
         AND (sd.category = $3 OR ($3 IS NULL AND sd.category IS NULL))
         AND (sd.code = $4 OR ($4 IS NULL AND sd.code IS NULL))
       LIMIT 1`,
      [key, tenantId, category, code]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    let value = row.value;
    
    // Type coercion
    if (row.value_type === 'numeric') {
      value = parseFloat(value);
    } else if (row.value_type === 'boolean') {
      value = value === 'true' || value === '1';
    }
    
    return value;
  } catch (error) {
    console.error(`Error getting sysparm ${key}/${category}/${code}:`, error.message);
    return null;
  }
}

/**
 * getSysparmByKey - Simple sysparm lookup by key only (no category/code)
 * Use for simple settings like 'retro_days_allowed', 'currency_label', etc.
 */
async function getSysparmByKey(tenantId, key, client = null) {
  const db = client || dbClient;
  if (!db) return null;
  
  try {
    const result = await db.query(
      `SELECT sd.value, s.value_type
       FROM sysparm s
       JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
       WHERE s.sysparm_key = $1 AND s.tenant_id = $2
         AND sd.category IS NULL AND sd.code IS NULL
       LIMIT 1`,
      [key, tenantId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    let value = row.value;
    
    // Type coercion
    if (row.value_type === 'numeric') {
      value = parseFloat(value);
    } else if (row.value_type === 'boolean') {
      value = value === 'true' || value === '1';
    }
    
    return value;
  } catch (error) {
    console.error(`Error getting sysparm by key ${key}:`, error.message);
    return null;
  }
}

/**
 * getSysparmDetails - Get all details for a sysparm
 * @param {number} tenantId - Tenant ID
 * @param {string} key - Sysparm key
 * @param {Object} client - Optional database client
 * @returns {Promise<Array>} - Array of detail rows
 */
async function getSysparmDetails(tenantId, key, client = null) {
  const db = client || dbClient;
  if (!db) return [];
  
  try {
    const result = await db.query(
      `SELECT sd.detail_id, sd.category, sd.code, sd.value, sd.sort_order, s.value_type
       FROM sysparm s
       JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
       WHERE s.sysparm_key = $1 AND s.tenant_id = $2
       ORDER BY sd.sort_order, sd.category, sd.code`,
      [key, tenantId]
    );
    
    return result.rows.map(row => {
      let value = row.value;
      if (row.value_type === 'numeric') {
        value = parseFloat(value);
      } else if (row.value_type === 'boolean') {
        value = value === 'true' || value === '1';
      }
      return { ...row, value };
    });
  } catch (error) {
    console.error(`Error getting sysparm details ${key}:`, error.message);
    return [];
  }
}

/**
 * setSysparmValue - Set a sysparm value (upsert)
 * @param {number} tenantId - Tenant ID
 * @param {string} key - Sysparm key
 * @param {string} value_type - 'text', 'numeric', 'boolean', 'date'
 * @param {any} value - Value to store
 * @param {string} category - Optional category
 * @param {string} code - Optional code
 * @param {Object} client - Optional database client
 * @returns {Promise<boolean>} - Success
 */
async function setSysparmValue(tenantId, key, value_type, value, category = null, code = null, client = null) {
  const db = client || dbClient;
  if (!db) return false;
  
  try {
    // Get or create sysparm
    let sysparmResult = await db.query(
      `SELECT sysparm_id FROM sysparm WHERE sysparm_key = $1 AND tenant_id = $2`,
      [key, tenantId]
    );
    
    let sysparmId;
    if (sysparmResult.rows.length === 0) {
      const insertResult = await db.query(
        `INSERT INTO sysparm (tenant_id, sysparm_key, value_type) VALUES ($1, $2, $3) RETURNING sysparm_id`,
        [tenantId, key, value_type]
      );
      sysparmId = insertResult.rows[0].sysparm_id;
    } else {
      sysparmId = sysparmResult.rows[0].sysparm_id;
    }
    
    // Check if detail exists
    const existingDetail = await db.query(
      `SELECT detail_id FROM sysparm_detail 
       WHERE sysparm_id = $1 AND category = $2 AND code = $3`,
      [sysparmId, category, code]
    );
    
    if (existingDetail.rows.length > 0) {
      // Update existing
      await db.query(
        `UPDATE sysparm_detail SET value = $1 WHERE detail_id = $2`,
        [String(value), existingDetail.rows[0].detail_id]
      );
    } else {
      // Insert new
      await db.query(
        `INSERT INTO sysparm_detail (sysparm_id, category, code, value)
         VALUES ($1, $2, $3, $4)`,
        [sysparmId, category, code, String(value)]
      );
    }
    
    // Update cache
    const cacheKey = `${tenantId}:${key}:${category || ''}:${code || ''}`;
    caches.sysparm.set(cacheKey, { value: String(value), value_type });
    
    return true;
  } catch (error) {
    console.error(`Error setting sysparm ${key}:`, error.message);
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

// ============ REFERENCE DATA CACHES ============
// These small tables are loaded once at startup to avoid repeated DB queries
const caches = {
  moleculeDef: new Map(),        // key: "tenantId:moleculeKey" → molecule row
  moleculeDefById: new Map(),    // key: moleculeId → molecule row (for decode)
  moleculeValueLookup: new Map(), // key: moleculeId → lookup config
  moleculeValueText: new Map(),   // key: moleculeId → array of text values
  airports: new Map(),            // key: code → airport row
  airportsById: new Map(),        // key: airport_id → airport row (for decode)
  carriers: new Map(),            // key: "tenantId:code" → carrier row
  carriersById: new Map(),        // key: carrier_id → carrier row (for decode)
  bonuses: new Map(),             // key: tenantId → array of active bonuses with rules
  promotions: new Map(),          // key: tenantId → array of active promotions
  ruleCriteria: new Map(),        // key: rule_id → array of criteria
  expirationRules: [],            // array of expiration rules sorted by date
  sysparm: new Map(),             // key: "tenantId:key:category:code" → {value, value_type}
  composites: new Map(),          // key: "tenantId:compositeType" → composite with details array
  initialized: false
};

// Load all reference caches
async function loadCaches() {
  if (!dbClient) return;
  
  try {
    debugLog('📦 Loading reference data caches...');
    
    // molecule_def cache (by key and by id)
    const molDefResult = await dbClient.query('SELECT * FROM molecule_def WHERE is_active = true');
    caches.moleculeDef.clear();
    caches.moleculeDefById.clear();
    for (const row of molDefResult.rows) {
      caches.moleculeDef.set(`${row.tenant_id}:${row.molecule_key}`, row);
      caches.moleculeDefById.set(row.molecule_id, row);
    }
    debugLog(`   ✓ molecule_def: ${molDefResult.rows.length} entries`);
    debugLog(`     Keys: ${Array.from(caches.moleculeDef.keys()).join(', ')}`);
    
    // molecule_value_lookup cache
    const lookupResult = await dbClient.query('SELECT * FROM molecule_value_lookup');
    caches.moleculeValueLookup.clear();
    for (const row of lookupResult.rows) {
      caches.moleculeValueLookup.set(row.molecule_id, row);
    }
    debugLog(`   ✓ molecule_value_lookup: ${lookupResult.rows.length} entries`);
    
    // molecule_value_text cache (for list molecules like fare_class)
    const textResult = await dbClient.query('SELECT * FROM molecule_value_text ORDER BY molecule_id, sort_order');
    caches.moleculeValueText.clear();
    for (const row of textResult.rows) {
      if (!caches.moleculeValueText.has(row.molecule_id)) {
        caches.moleculeValueText.set(row.molecule_id, []);
      }
      caches.moleculeValueText.get(row.molecule_id).push(row);
    }
    debugLog(`   ✓ molecule_value_text: ${textResult.rows.length} entries`);
    
    // airports cache (by code and by id)
    const airportResult = await dbClient.query('SELECT * FROM airports');
    caches.airports.clear();
    caches.airportsById.clear();
    for (const row of airportResult.rows) {
      caches.airports.set(row.code, row);
      caches.airportsById.set(row.airport_id, row);
    }
    debugLog(`   ✓ airports: ${airportResult.rows.length} entries`);
    
    // carriers cache (by code and by id)
    const carrierResult = await dbClient.query('SELECT * FROM carriers');
    caches.carriers.clear();
    caches.carriersById.clear();
    for (const row of carrierResult.rows) {
      caches.carriers.set(`${row.tenant_id}:${row.code}`, row);
      caches.carriersById.set(row.carrier_id, row);
    }
    debugLog(`   ✓ carriers: ${carrierResult.rows.length} entries`);
    
    // bonuses cache - active bonuses with their rules
    const bonusResult = await dbClient.query(`
      SELECT b.*, r.rule_id
      FROM bonus b
      LEFT JOIN rule r ON b.rule_id = r.rule_id
      WHERE b.is_active = true
    `);
    caches.bonuses.clear();
    for (const row of bonusResult.rows) {
      const tenantId = row.tenant_id;
      if (!caches.bonuses.has(tenantId)) {
        caches.bonuses.set(tenantId, []);
      }
      caches.bonuses.get(tenantId).push(row);
    }
    debugLog(`   ✓ bonuses: ${bonusResult.rows.length} entries`);
    
    // promotions cache - active promotions
    const promoResult = await dbClient.query(`
      SELECT p.*, r.rule_id as filter_rule_id
      FROM promotion p
      LEFT JOIN rule r ON p.rule_id = r.rule_id
      WHERE p.is_active = true
    `);
    caches.promotions.clear();
    for (const row of promoResult.rows) {
      const tenantId = row.tenant_id;
      if (!caches.promotions.has(tenantId)) {
        caches.promotions.set(tenantId, []);
      }
      caches.promotions.get(tenantId).push(row);
    }
    debugLog(`   ✓ promotions: ${promoResult.rows.length} entries`);
    
    // rule_criteria cache - just load criteria, molecule info comes from moleculeDef cache
    const criteriaResult = await dbClient.query(`
      SELECT * FROM rule_criteria ORDER BY rule_id, sort_order
    `);
    caches.ruleCriteria.clear();
    for (const row of criteriaResult.rows) {
      const ruleId = row.rule_id;
      if (!caches.ruleCriteria.has(ruleId)) {
        caches.ruleCriteria.set(ruleId, []);
      }
      caches.ruleCriteria.get(ruleId).push(row);
    }
    debugLog(`   ✓ rule_criteria: ${criteriaResult.rows.length} entries`);
    
    // expiration rules cache (load all for now, filter by tenant when needed)
    const expirationResult = await dbClient.query(`
      SELECT rule_id, rule_key, start_date, end_date, expiration_date, description, tenant_id
      FROM point_expiration_rule
      ORDER BY tenant_id, start_date DESC
    `);
    caches.expirationRules = expirationResult.rows;
    debugLog(`   ✓ expiration_rules: ${expirationResult.rows.length} entries`);
    
    // sysparm cache - load all sysparm values
    const sysparmResult = await dbClient.query(`
      SELECT s.tenant_id, s.sysparm_key, s.value_type, sd.category, sd.code, sd.value
      FROM sysparm s
      JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
    `);
    caches.sysparm.clear();
    for (const row of sysparmResult.rows) {
      const cacheKey = `${row.tenant_id}:${row.sysparm_key}:${row.category || ''}:${row.code || ''}`;
      caches.sysparm.set(cacheKey, { value: row.value, value_type: row.value_type });
    }
    debugLog(`   ✓ sysparm: ${sysparmResult.rows.length} entries`);
    // Log first few cache keys for debugging
    const sampleKeys = Array.from(caches.sysparm.keys()).slice(0, 5);
    debugLog(`   Sample sysparm cache keys: ${sampleKeys.join(', ')}`);
    
    // composites cache - composite with details for each tenant + activity type
    const compositeResult = await dbClient.query(`
      SELECT 
        c.link, c.tenant_id, c.composite_type, c.description, c.validate_function,
        cd.link as detail_link, cd.molecule_id, cd.is_required, cd.is_calculated, 
        cd.calc_function, cd.sort_order,
        md.molecule_key, md.storage_size, md.value_type, md.value_kind
      FROM composite c
      LEFT JOIN composite_detail cd ON cd.p_link = c.link
      LEFT JOIN molecule_def md ON cd.molecule_id = md.molecule_id
      ORDER BY c.tenant_id, c.composite_type, cd.sort_order
    `);
    caches.composites.clear();
    for (const row of compositeResult.rows) {
      const cacheKey = `${row.tenant_id}:${row.composite_type}`;
      if (!caches.composites.has(cacheKey)) {
        caches.composites.set(cacheKey, {
          link: row.link,
          tenant_id: row.tenant_id,
          composite_type: row.composite_type,
          description: row.description,
          validate_function: row.validate_function,
          details: []
        });
      }
      if (row.detail_link) {
        caches.composites.get(cacheKey).details.push({
          link: row.detail_link,
          molecule_id: row.molecule_id,
          molecule_key: row.molecule_key,
          storage_size: row.storage_size,
          value_type: row.value_type,
          value_kind: row.value_kind,
          is_required: row.is_required,
          is_calculated: row.is_calculated,
          calc_function: row.calc_function,
          sort_order: row.sort_order
        });
      }
    }
    debugLog(`   ✓ composites: ${caches.composites.size} entries`);
    
    caches.initialized = true;
    debugLog('📦 Reference data caches loaded!\n');
    
  } catch (error) {
    console.error('Error loading caches:', error.message);
  }
}

// Centralized cached molecule lookup - ALL molecule_def lookups should use this
function getCachedMoleculeDef(tenantId, moleculeKey) {
  return caches.moleculeDef.get(`${tenantId}:${moleculeKey}`) || null;
}

function getCachedMoleculeDefById(moleculeId) {
  return caches.moleculeDefById.get(moleculeId) || null;
}

// Get composite from cache by tenant and activity type
function getCachedComposite(tenantId, compositeType) {
  return caches.composites.get(`${tenantId}:${compositeType}`) || null;
}

// Invalidate and reload composite cache for a specific tenant/type
async function invalidateCompositeCache(tenantId, compositeType) {
  const cacheKey = `${tenantId}:${compositeType}`;
  caches.composites.delete(cacheKey);
  
  // Reload just this composite
  const result = await dbClient.query(`
    SELECT 
      c.link, c.tenant_id, c.composite_type, c.description, c.validate_function,
      cd.link as detail_link, cd.molecule_id, cd.is_required, cd.is_calculated, 
      cd.calc_function, cd.sort_order,
      md.molecule_key, md.storage_size, md.value_type, md.value_kind
    FROM composite c
    LEFT JOIN composite_detail cd ON cd.p_link = c.link
    LEFT JOIN molecule_def md ON cd.molecule_id = md.molecule_id
    WHERE c.tenant_id = $1 AND c.composite_type = $2
    ORDER BY cd.sort_order
  `, [tenantId, compositeType]);
  
  if (result.rows.length > 0) {
    const firstRow = result.rows[0];
    const composite = {
      link: firstRow.link,
      tenant_id: firstRow.tenant_id,
      composite_type: firstRow.composite_type,
      description: firstRow.description,
      validate_function: firstRow.validate_function,
      details: []
    };
    for (const row of result.rows) {
      if (row.detail_link) {
        composite.details.push({
          link: row.detail_link,
          molecule_id: row.molecule_id,
          molecule_key: row.molecule_key,
          storage_size: row.storage_size,
          value_type: row.value_type,
          value_kind: row.value_kind,
          is_required: row.is_required,
          is_calculated: row.is_calculated,
          calc_function: row.calc_function,
          sort_order: row.sort_order
        });
      }
    }
    caches.composites.set(cacheKey, composite);
  }
  
  debugLog(`   ✓ Composite cache invalidated and reloaded: ${cacheKey}`);
}

// ============ END CACHES ============

if (USE_DB) {
  Client = pg.Client;
  
  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL if provided
    dbClient = new pg.Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 20  // Connection pool size
    });
  } else {
    // Use individual env vars
    DB_HOST = process.env.PGHOST || "127.0.0.1";
    DB_PORT = Number(process.env.PGPORT || 5432);
    DB_USER = process.env.PGUSER || "postgres";
    DB_PASSWORD = process.env.PGPASSWORD || "";
    DB_DATABASE = process.env.PGDATABASE || "postgres";
    
    dbClient = new pg.Pool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      max: 20  // Connection pool size
    });
    currentDatabaseName = DB_DATABASE;
  }
  
  // Pool is ready immediately - test connection and load caches
  dbClient.query('SELECT 1')
    .then(async () => {
      loadDebugSetting(); // Load debug setting after successful connection
      await loadCaches(); // Load reference data caches - WAIT for it
      await loadActivityFunctions(); // Load custom activity functions
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
    return { ok: true, balances: { base_points: 3740, tier_credits: 0 } };
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
      point_type: "base_points",
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
  
  // Check cache first
  const cached = getCachedMoleculeDef(tenantId, moleculeKey);
  if (cached) {
    return cached;
  }
  
  // Step 1: Get molecule definition
  const defQuery = `
    SELECT 
      molecule_id,
      molecule_key,
      label,
      context,
      value_kind,
      value_structure,
      scalar_type,
      lookup_table_key,
      display_width,
      is_static,
      is_permanent,
      is_required,
      is_active,
      description,
      sample_code,
      sample_description,
      input_type
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const molecule = defResult.rows[0];
  
  // Step 2: Get value(s) based on type
  // Support both old and new value_kind names
  if (isScalarMolecule(molecule) && molecule.is_static) {
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
    
  } else if (isListMolecule(molecule)) {
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
    
  } else if (molecule.value_kind === 'embedded_list' || molecule.value_structure === 'embedded') {
    // Get embedded list values for specific category or all categories
    if (category) {
      // Return values for specific category
      const embeddedQuery = `
        SELECT 
          link as value,
          code,
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
          link as value,
          code,
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
    
  } else if (isLookupMolecule(molecule)) {
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
      
      debugLog(() => `[getMolecule] Lookup config for ${moleculeKey}: ${JSON.stringify(config)}`);
      debugLog(() => `[getMolecule] is_tenant_specific value: '${config.is_tenant_specific}' (type: ${typeof config.is_tenant_specific})`);
      
      // Build query to get values from lookup table
      let valuesQuery = `
        SELECT 
          ${config.id_column} as id,
          ${config.code_column} as code,
          ${config.label_column} as label
        FROM ${config.table_name}
      `;
      
      // Add tenant filter if table is tenant-specific
      // Explicitly check for true boolean, not just truthy
      const queryParams = [];
      if (config.is_tenant_specific === true) {
        valuesQuery += ` WHERE tenant_id = $1`;
        queryParams.push(tenantId);
      }
      
      valuesQuery += ` ORDER BY ${config.label_column}`;
      
      const valuesResult = await dbClient.query(valuesQuery, queryParams);
      molecule.values = valuesResult.rows;
      
      debugLog(() => `[getMolecule] Loaded ${valuesResult.rows.length} values for lookup molecule '${moleculeKey}'`);
    } else {
      console.warn(`[getMolecule] No lookup configuration found for molecule '${moleculeKey}'`);
      molecule.value = null;
      molecule.values = null;
    }
  }
  
  return molecule;
}

/**
 * Get column definitions for a molecule
 * Maps v1-v6 to meaningful field names
 * @param {number} moleculeId - The molecule ID
 * @returns {Promise<Array>} Column definitions with column_name, column_type, description
 */
async function getMoleculeColumnDefs(moleculeId) {
  // Check cache first
  const cacheKey = `coldef:${moleculeId}`;
  if (caches.moleculeColumnDefs && caches.moleculeColumnDefs.has(cacheKey)) {
    return caches.moleculeColumnDefs.get(cacheKey);
  }
  
  const query = `
    SELECT column_name, column_type, description
    FROM molecule_column_def
    WHERE molecule_id = $1
    ORDER BY column_order
  `;
  const result = await dbClient.query(query, [moleculeId]);
  
  // Cache the result
  if (!caches.moleculeColumnDefs) {
    caches.moleculeColumnDefs = new Map();
  }
  caches.moleculeColumnDefs.set(cacheKey, result.rows);
  
  return result.rows;
}

/**
 * Extract field name from description
 * e.g., "rule_id (point_rule)" → "rule_id"
 * e.g., "accrued" → "accrued"
 * @param {string} description - Column description
 * @returns {string} Field name
 */
function extractFieldName(description) {
  if (!description) return null;
  const match = description.match(/^(\w+)/);
  return match ? match[1] : description;
}

/**
 * Date conversion: JavaScript Date to molecule integer
 * Epoch: December 3, 1959 = day 0
 */
function dateToMoleculeInt(date) {
  const epoch = new Date(1959, 11, 3); // Dec 3, 1959 (local)
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = date.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(date);
  }
  const diff = d - epoch;
  const daysSinceEpoch = Math.floor(diff / (1000 * 60 * 60 * 24));
  // Offset by -32768 to use full SMALLINT range (-32768 to +32767)
  // This gives us ~179 years coverage (1959-2138) instead of ~89 years
  return daysSinceEpoch - 32768;
}

/**
 * Date conversion: molecule integer to JavaScript Date
 * Epoch: December 3, 1959 = day 0 (stored as -32768)
 * Stored value = days_since_epoch - 32768
 */
function moleculeIntToDate(num) {
  const epoch = new Date(1959, 11, 3);
  // Add 32768 to convert from stored value back to days since epoch
  const daysSinceEpoch = num + 32768;
  return new Date(epoch.getTime() + (daysSinceEpoch * 24 * 60 * 60 * 1000));
}

/**
 * Format date as YYYY-MM-DD string without timezone conversion
 * Use this instead of toISOString().slice(0,10) to avoid UTC shift
 */
function formatDateLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert any date input to YYYY-MM-DD string for comparison
 * Handles: Date objects, ISO strings, YYYY-MM-DD strings
 */
function toDateStr(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10); // Already a string, take first 10 chars
  // It's a Date object - use local date components
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Activity date wrappers - isolate 2-byte storage from downstream code
 * All code below these wrappers works with Date objects
 */

// Convert Date to storage format (for INSERT/UPDATE)
// Pre-migration: returns Date object for DATE column
// Post-migration: returns int for SMALLINT column
// Set this flag to true after running convert_activity_date_to_smallint.sql
const ACTIVITY_DATE_MIGRATED = true;

function activityDateToStorage(date) {
  if (ACTIVITY_DATE_MIGRATED) {
    return dateToMoleculeInt(date);
  }
  // Pre-migration: just return the date for DATE column
  return date instanceof Date ? date : new Date(date);
}

// Convert storage int to Date (for SELECT results)
function activityDateFromStorage(intValue) {
  return moleculeIntToDate(intValue);
}

// Hydrate activity row(s) - convert activity_date int to Date object
// Handles both pre-migration (DATE type) and post-migration (SMALLINT type)
function hydrateActivityDates(rows) {
  if (!rows) return rows;
  const arr = Array.isArray(rows) ? rows : [rows];
  arr.forEach(row => {
    if (row.activity_date !== undefined && row.activity_date !== null) {
      // Only convert if it's a number (post-migration SMALLINT storage)
      // If already a Date (pre-migration DATE type), leave it alone
      if (typeof row.activity_date === 'number') {
        row.activity_date = activityDateFromStorage(row.activity_date);
      }
    }
  });
  return Array.isArray(rows) ? arr : arr[0];
}

/**
 * Get member molecule rows from molecule_value_list
 * Returns rows with named fields based on column definitions
 * @param {number} memberId - The member ID
 * @param {string} moleculeKey - The molecule key (e.g., "member_point_bucket")
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<Array>} Rows with named fields, grouped by row_num
 */
async function getMemberMoleculeRows(memberId, moleculeKey, tenantId) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition
  const defQuery = `
    SELECT molecule_id
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const moleculeId = defResult.rows[0].molecule_id;
  
  // Get column definitions
  const columnDefs = await getMoleculeColumnDefs(moleculeId);
  
  // Build field name map: v1 -> rule_id, v3 -> accrued, etc.
  const fieldMap = {};
  for (const def of columnDefs) {
    fieldMap[def.column_name] = extractFieldName(def.description);
  }
  
  // Get raw rows from molecule_value_list
  const dataQuery = `
    SELECT row_num, col, value
    FROM molecule_value_list
    WHERE context_id = $1 AND molecule_id = $2
    ORDER BY row_num, col
  `;
  const dataResult = await dbClient.query(dataQuery, [memberId, moleculeId]);
  
  // Group by row_num and map to named fields
  const rowsMap = new Map();
  for (const row of dataResult.rows) {
    if (!rowsMap.has(row.row_num)) {
      rowsMap.set(row.row_num, { row_num: row.row_num });
    }
    const fieldName = fieldMap[row.col];
    if (fieldName) {
      rowsMap.get(row.row_num)[fieldName] = row.value;
    }
  }
  
  return Array.from(rowsMap.values());
}

/**
 * Get activity molecule value by molecule_id
 * Reads from new storage tables based on storage_size
 * @param {number} activityId - The activity ID
 * @param {number} moleculeId - The molecule ID
 * @returns {Promise<number|null>} The decoded value or null if not found
 */
async function getActivityMoleculeValueById(activityId, moleculeId, link = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition from cache
  const mol = getCachedMoleculeDefById(moleculeId);
  if (!mol) {
    return null;
  }
  
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink && activityId) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  if (!activityLink) {
    return null;
  }
  
  // If no storage_size, molecule can't be stored
  if (!mol.storage_size) {
    return null;
  }
  
  // Derive table name and column name from storage pattern
  const tableName = getDetailTableName(mol.context, mol.storage_size);
  const columns = parseStoragePattern(mol.storage_size);
  
  // For single-value molecules, get the first (and only) column
  const colName = columns[0]?.name || 'C1';
  const colSize = columns[0]?.size || parseInt(mol.storage_size);
  const isChar = columns[0]?.isChar ?? (colSize === 1 || colSize === 3 || colSize === 5);
  
  const dataResult = await dbClient.query(`
    SELECT ${colName} as raw_value
    FROM ${tableName}
    WHERE p_link = $1 AND molecule_id = $2
  `, [activityLink, moleculeId]);
  
  if (dataResult.rows.length === 0) {
    return null;
  }
  
  // Decode based on storage_size and value_type
  // Exception: if value_type is 'link', return raw bytes (for use as lookup key)
  const rawValue = dataResult.rows[0].raw_value;
  if (mol.value_type === 'link') {
    return rawValue; // Already squished bytes, return as-is for queries
  }
  return decodeValue(rawValue, colSize, mol.value_type);
}

/**
 * Get ALL activity molecule values by molecule_id (for multi-row molecules like bonus_activity_link)
 * Reads from new storage tables based on storage_size
 * @param {number} activityId - The activity ID
 * @param {number} moleculeId - The molecule ID
 * @param {string} link - Optional activity link (skips lookup)
 * @returns {Promise<Array>} Array of decoded values
 */
async function getAllActivityMoleculeValuesById(activityId, moleculeId, link = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition from cache
  const mol = getCachedMoleculeDefById(moleculeId);
  if (!mol) {
    return [];
  }
  
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink && activityId) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  if (!activityLink) {
    return [];
  }
  
  // If no storage_size, molecule can't be stored
  if (!mol.storage_size) {
    return [];
  }
  
  // Derive table name and column name from storage pattern
  const tableName = getDetailTableName(mol.context, mol.storage_size);
  const columns = parseStoragePattern(mol.storage_size);
  
  // For single-value molecules, get the first (and only) column
  const colName = columns[0]?.name || 'C1';
  const colSize = columns[0]?.size || parseInt(mol.storage_size);
  
  const dataResult = await dbClient.query(`
    SELECT ${colName} as raw_value
    FROM ${tableName}
    WHERE p_link = $1 AND molecule_id = $2
  `, [activityLink, moleculeId]);
  
  if (dataResult.rows.length === 0) {
    return [];
  }
  
  // Decode all values
  return dataResult.rows.map(row => {
    const rawValue = row.raw_value;
    if (mol.value_type === 'link') {
      return rawValue; // Already squished bytes, return as-is for queries
    }
    return decodeValue(rawValue, colSize, mol.value_type);
  });
}

/**
 * Get all activity molecules as decoded key-value pairs
 * Reads from new storage tables, decodes values
 * @param {number} activityId - The activity ID
 * @param {number} tenantId - The tenant ID
 * @param {string} link - Optional activity link (skips lookup if provided)
 * @returns {Promise<Object>} Object with molecule_key -> decoded_value
 */
async function getAllActivityMolecules(activityId, tenantId, link = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  if (!activityLink) {
    return {};
  }
  
  // Query all storage tables and union results - read raw values
  // Column names: C1 for char types (1,3,5 bytes), N1 for numeric types (2,4 bytes)
  const detailsQuery = `
    WITH activity_link AS (
      SELECT $1::char(5) as p_link
    )
    SELECT md.molecule_key, ad.C1 as raw_value, 1 as storage_size, md.value_type
    FROM activity_link al
    JOIN "5_data_1" ad ON ad.p_link = al.p_link
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id 
      AND md.tenant_id = $2 AND md.context IN ('activity', 'system')
    
    UNION ALL
    
    SELECT md.molecule_key, ad.N1::text as raw_value, 2 as storage_size, md.value_type
    FROM activity_link al
    JOIN "5_data_2" ad ON ad.p_link = al.p_link
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id 
      AND md.tenant_id = $2 AND md.context IN ('activity', 'system')
    
    UNION ALL
    
    SELECT md.molecule_key, ad.C1 as raw_value, 3 as storage_size, md.value_type
    FROM activity_link al
    JOIN "5_data_3" ad ON ad.p_link = al.p_link
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id 
      AND md.tenant_id = $2 AND md.context IN ('activity', 'system')
    
    UNION ALL
    
    SELECT md.molecule_key, ad.N1::text as raw_value, 4 as storage_size, md.value_type
    FROM activity_link al
    JOIN "5_data_4" ad ON ad.p_link = al.p_link
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id 
      AND md.tenant_id = $2 AND md.context IN ('activity', 'system')
    
    UNION ALL
    
    SELECT md.molecule_key, ad.C1 as raw_value, 5 as storage_size, md.value_type
    FROM activity_link al
    JOIN "5_data_5" ad ON ad.p_link = al.p_link
    JOIN molecule_def md ON ad.molecule_id = md.molecule_id 
      AND md.tenant_id = $2 AND md.context IN ('activity', 'system')
  `;
  
  const detailsResult = await dbClient.query(detailsQuery, [activityLink, tenantId]);
  
  // Decode and build result object
  const result = {};
  for (const row of detailsResult.rows) {
    // For link types, keep raw value as-is (they're pointers, not values to decode)
    if (row.value_type === 'link') {
      result[row.molecule_key] = row.raw_value;
      continue;
    }
    // For others, decode using storage rules first
    let decodedValue = decodeValue(row.raw_value, row.storage_size, row.value_type);
    // Now decode to human-readable using decodeMolecule
    try {
      result[row.molecule_key] = await decodeMolecule(tenantId, row.molecule_key, decodedValue);
    } catch (e) {
      result[row.molecule_key] = `[decode error]`;
    }
  }
  
  return result;
}

/**
 * Get activity molecule rows from molecule_value_list
 * Returns rows with named fields based on column definitions
 * @param {number} activityId - The activity ID
 * @param {string} moleculeKey - The molecule key (e.g., "carrier", "member_points")
 * @param {number} tenantId - The tenant ID
 * @param {string} link - Optional activity link (skips lookup if provided)
 * @returns {Promise<Array>} Rows with named fields, grouped by row_num
 */
async function getActivityMoleculeRows(activityId, moleculeKey, tenantId, link = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition including storage info
  const defQuery = `
    SELECT molecule_id, value_kind, context, storage_size
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const mol = defResult.rows[0];
  const moleculeId = mol.molecule_id;
  
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  if (!activityLink) {
    return [];
  }
  
  // Read from detail table (derived from context + storage_size)
  if (mol.storage_size) {
    const tableName = getDetailTableName(mol.context, mol.storage_size);
    const columns = parseStoragePattern(mol.storage_size);
    const colName = columns[0]?.name || 'C1';
    const colSize = columns[0]?.size || parseInt(mol.storage_size);
    const isChar = columns[0]?.isChar ?? (colSize === 1 || colSize === 3 || colSize === 5);
    
    const dataQuery = `
      SELECT ${colName} as raw_value
      FROM ${tableName}
      WHERE p_link = $1 AND molecule_id = $2
    `;
    const dataResult = await dbClient.query(dataQuery, [activityLink, moleculeId]);
    
    if (dataResult.rows.length === 0) {
      return [];
    }
    
    // Decode: unsquish for char columns, raw number for numeric
    const value = isChar ? unsquish(dataResult.rows[0].raw_value) : Number(dataResult.rows[0].raw_value);
    return [{ row_num: 1, value: value }];
  }
  
  // No storage_size defined - return empty
  return [];
}

/**
 * Save member molecule row to molecule_value_list
 * @param {number} memberId - The member ID
 * @param {string} moleculeKey - The molecule key
 * @param {number} tenantId - The tenant ID
 * @param {Object} values - Named field values (e.g., { rule_id: 1, accrued: 1000 })
 * @param {number} rowNum - Optional row number (default: next available)
 * @returns {Promise<number>} The row_num used
 */
async function saveMemberMoleculeRow(memberId, moleculeKey, tenantId, values, rowNum = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition
  const defQuery = `
    SELECT molecule_id
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const moleculeId = defResult.rows[0].molecule_id;
  
  // Get column definitions
  const columnDefs = await getMoleculeColumnDefs(moleculeId);
  
  // Build reverse field map: rule_id -> v1, accrued -> v3, etc.
  const columnMap = {};
  for (const def of columnDefs) {
    const fieldName = extractFieldName(def.description);
    if (fieldName) {
      columnMap[fieldName] = def.column_name;
    }
  }
  
  // Get next row_num if not provided
  if (rowNum === null) {
    const maxQuery = `
      SELECT COALESCE(MAX(row_num), 0) + 1 as next_row
      FROM molecule_value_list
      WHERE context_id = $1 AND molecule_id = $2
    `;
    const maxResult = await dbClient.query(maxQuery, [memberId, moleculeId]);
    rowNum = maxResult.rows[0].next_row;
  }
  
  // Insert each value as a separate row
  for (const [fieldName, value] of Object.entries(values)) {
    const col = columnMap[fieldName];
    if (col && value !== undefined) {
      await dbClient.query(`
        INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value)
        VALUES ($1, $2, $3, $4, $5)
      `, [moleculeId, memberId, rowNum, col, value]);
    }
  }
  
  return rowNum;
}

/**
 * Update member molecule row in molecule_value_list
 * @param {number} memberId - The member ID
 * @param {string} moleculeKey - The molecule key
 * @param {number} tenantId - The tenant ID
 * @param {number} rowNum - The row number to update
 * @param {Object} values - Named field values to update
 */
async function updateMemberMoleculeRow(memberId, moleculeKey, tenantId, rowNum, values) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition
  const defQuery = `
    SELECT molecule_id
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const moleculeId = defResult.rows[0].molecule_id;
  
  // Get column definitions
  const columnDefs = await getMoleculeColumnDefs(moleculeId);
  
  // Build reverse field map
  const columnMap = {};
  for (const def of columnDefs) {
    const fieldName = extractFieldName(def.description);
    if (fieldName) {
      columnMap[fieldName] = def.column_name;
    }
  }
  
  // Update each value
  for (const [fieldName, value] of Object.entries(values)) {
    const col = columnMap[fieldName];
    if (col && value !== undefined) {
      await dbClient.query(`
        UPDATE molecule_value_list
        SET value = $1
        WHERE context_id = $2 AND molecule_id = $3 AND row_num = $4 AND col = $5
      `, [value, memberId, moleculeId, rowNum, col]);
    }
  }
}

/**
 * Save activity molecule row to proper storage
 * @param {number} activityId - The activity ID
 * @param {string} moleculeKey - The molecule key
 * @param {number} tenantId - The tenant ID
 * @param {Object} values - Named field values (e.g., { value: 123 } or { bucket_id: 501, amount: 1000 })
 * @param {number} rowNum - Optional row number (default: next available)
 * @param {string} link - Optional activity link (skips lookup if provided)
 * @returns {Promise<number>} The row_num used
 */
async function saveActivityMoleculeRow(activityId, moleculeKey, tenantId, values, rowNum = null, link = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  // Get molecule definition including value_kind and storage info
  const defQuery = `
    SELECT molecule_id, value_kind, storage_size, value_type, context
    FROM molecule_def
    WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
  `;
  const defResult = await dbClient.query(defQuery, [moleculeKey, tenantId]);
  
  if (defResult.rows.length === 0) {
    throw new Error(`Molecule not found: ${moleculeKey} for tenant ${tenantId}`);
  }
  
  const mol = defResult.rows[0];
  const moleculeId = mol.molecule_id;
  const valueKind = mol.value_kind;
  
  // For dynamic_list molecules, use molecule_value_list (multi-row with columns)
  if (valueKind === 'dynamic_list') {
    // Get column definitions
    const columnDefs = await getMoleculeColumnDefs(moleculeId);
    
    // Build reverse field map
    const columnMap = {};
    for (const def of columnDefs) {
      const fieldName = extractFieldName(def.description);
      if (fieldName) {
        columnMap[fieldName] = def.column_name;
      }
    }
    
    // Get next row_num if not provided
    if (rowNum === null) {
      const maxQuery = `
        SELECT COALESCE(MAX(row_num), 0) + 1 as next_row
        FROM molecule_value_list
        WHERE context_id = $1 AND molecule_id = $2
      `;
      const maxResult = await dbClient.query(maxQuery, [activityId, moleculeId]);
      rowNum = maxResult.rows[0].next_row;
    }
    
    // Insert each value as a separate row
    for (const [fieldName, value] of Object.entries(values)) {
      const col = columnMap[fieldName];
      if (col && value !== undefined) {
        await dbClient.query(`
          INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value)
          VALUES ($1, $2, $3, $4, $5)
        `, [moleculeId, activityId, rowNum, col, value]);
      }
    }
    
    return rowNum;
  }
  
  // For simple molecules, use storage tables
  const value = values.value !== undefined ? values.value : Object.values(values)[0];
  
  // Use provided link or look it up
  let pLink = link;
  if (!pLink) {
    const actResult = await dbClient.query(`
      SELECT link FROM activity WHERE activity_id = $1
    `, [activityId]);
    pLink = actResult.rows[0]?.link;
  }
  
  if (!mol.storage_size) {
    throw new Error(`Molecule ${moleculeKey} has no storage_size defined`);
  }
  
  // Derive table name and column name from storage pattern
  const tableName = getDetailTableName(mol.context, mol.storage_size);
  const columns = parseStoragePattern(mol.storage_size);
  const col = columns[0];
  const colName = col?.name || 'C1';
  
  // Encode value based on storage_size and value_type
  let storedValue;
  if (mol.value_type === 'link') {
    storedValue = value; // Already squished bytes
  } else {
    storedValue = encodeValue(value, col.size, mol.value_type);
  }
  
  // Delete existing and insert new
  await dbClient.query(`
    DELETE FROM ${tableName} WHERE p_link = $1 AND molecule_id = $2
  `, [pLink, moleculeId]);
  
  await dbClient.query(`
    INSERT INTO ${tableName} (p_link, attaches_to, molecule_id, ${colName})
    VALUES ($1, 'A', $2, $3)
  `, [pLink, moleculeId, storedValue]);
  
  return 1;
}

/**
 * Simple insert for activity molecule value
 * Used by existing code that has molecule_id and v_ref_id
 * @param {number} activityId - The activity ID
 * @param {number} moleculeId - The molecule ID
 * @param {number} value - The value (v_ref_id equivalent)
 * @param {Object} client - Optional database client (for transactions)
 * @param {string} link - Optional activity link (skips lookup if provided)
 */
async function insertActivityMolecule(activityId, moleculeId, value, client = null, link = null) {
  const db = client || dbClient;
  
  // Get molecule definition from cache
  const mol = getCachedMoleculeDefById(moleculeId);
  if (!mol) {
    console.warn(`insertActivityMolecule: molecule_id ${moleculeId} not found in cache`);
    return;
  }
  
  if (mol.value_kind === 'dynamic_list') {
    // Multi-row molecule - use molecule_value_list
    await db.query(`
      INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value)
      VALUES ($1, $2, 1, 'A', $3)
    `, [moleculeId, activityId, value]);
  } else if (mol.storage_size) {
    // Storage tables - derive table name from context + storage_size
    let pLink = link;
    if (!pLink) {
      const actResult = await db.query(`
        SELECT link FROM activity WHERE activity_id = $1
      `, [activityId]);
      pLink = actResult.rows[0]?.link;
    }
    
    // Derive table name and column name from storage pattern
    const tableName = getDetailTableName(mol.context, mol.storage_size);
    const columns = parseStoragePattern(mol.storage_size);
    const col = columns[0];
    const colName = col?.name || 'C1';
    
    // Encode value based on storage_size and value_type
    // If value_type is 'link', value is already squished - store directly
    let storedValue;
    if (mol.value_type === 'link') {
      storedValue = value; // Already squished bytes
    } else if (mol.scalar_type === 'text_direct') {
      // For text_direct: insert text into molecule_text, get text_id
      const textId = await encodeMolecule(mol.tenant_id, mol.molecule_key, value);
      // Encode the text_id for storage (offset if value_type is key/code/link)
      storedValue = encodeValue(textId, col.size, mol.value_type);
    } else {
      storedValue = encodeValue(value, col.size, mol.value_type);
    }
    
    await db.query(`
      INSERT INTO ${tableName} (p_link, attaches_to, molecule_id, ${colName})
      VALUES ($1, 'A', $2, $3)
    `, [pLink, moleculeId, storedValue]);
  } else {
    console.warn(`insertActivityMolecule: molecule_id ${moleculeId} has no storage_size`);
  }
}

/**
 * Find or create a point bucket for a member
 * Uses generic molecule helpers - no direct table/column references
 * @param {string} memberLink - The member's link (CHAR(5))
 * @param {number} ruleId - The point rule ID
 * @param {string|Date} expireDate - The expiration date
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string>} The link of the bucket
 */
async function findOrCreatePointBucket(memberLink, ruleId, expireDate, tenantId) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  if (!memberLink) {
    throw new Error('memberLink is required');
  }
  
  // Convert date to 2-byte date int (days since Dec 3, 1959)
  const expireDateInt = dateToMoleculeInt(expireDate);
  
  // Find existing bucket by member + rule
  const existing = await dbClient.query(
    `SELECT link FROM member_point_bucket WHERE p_link = $1 AND rule_id = $2`,
    [memberLink, ruleId]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].link;
  }
  
  // Create new bucket
  const bucketLink = await getNextLink(tenantId, 'member_point_bucket');
  await dbClient.query(
    `INSERT INTO member_point_bucket (link, p_link, rule_id, expire_date, accrued, redeemed)
     VALUES ($1, $2, $3, $4, 0, 0)`,
    [bucketLink, memberLink, ruleId, expireDateInt]
  );
  
  return bucketLink;
}

/**
 * Update point bucket accrued amount
 * @param {string} bucketLink - The bucket link
 * @param {number} amount - Amount to add to accrued (can be negative)
 */
async function updatePointBucketAccrued(bucketLink, amount) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  await dbClient.query(
    `UPDATE member_point_bucket SET accrued = accrued + $1 WHERE link = $2`,
    [amount, bucketLink]
  );
}

/**
 * Get all point buckets for a member
 * @param {string} memberLink - The member's link
 * @param {number} tenantId - The tenant ID (not used, kept for compatibility)
 * @returns {Promise<Array>} Array of bucket objects with link, rule_id, expire_date, accrued, redeemed
 */
async function getMemberPointBuckets(memberLink, tenantId) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  const result = await dbClient.query(
    `SELECT link, p_link, rule_id, expire_date, accrued, redeemed 
     FROM member_point_bucket 
     WHERE p_link = $1 
     ORDER BY expire_date`,
    [memberLink]
  );
  
  return result.rows;
}

/**
 * Get a specific point bucket by link
 * @param {string} bucketLink - The bucket's link
 * @returns {Promise<Object|null>} Bucket object or null
 */
async function getPointBucketByLink(bucketLink) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  const result = await dbClient.query(
    `SELECT link, p_link, rule_id, expire_date, accrued, redeemed 
     FROM member_point_bucket 
     WHERE link = $1`,
    [bucketLink]
  );
  
  return result.rows[0] || null;
}

/**
 * Update point bucket redeemed amount
 * @param {string} bucketLink - The bucket link
 * @param {number} amount - Amount to add to redeemed
 */
async function updatePointBucketRedeemed(bucketLink, amount) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }
  
  await dbClient.query(
    `UPDATE member_point_bucket SET redeemed = redeemed + $1 WHERE link = $2`,
    [amount, bucketLink]
  );
}

/**
 * Save member_points molecule on activity (link to bucket + amount)
 * @param {number} activityId - The activity ID
 * @param {string} bucketLink - The bucket link (5-byte CHAR)
 * @param {number} amount - Points amount (positive=earn, negative=redeem)
 * @param {number} tenantId - The tenant ID
 * @param {string} link - Optional activity link (skips lookup if provided)
 */
async function saveActivityPoints(activityId, bucketLink, amount, tenantId, link = null) {
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  if (!activityLink) {
    throw new Error(`Activity ${activityId} not found or has no link`);
  }
  
  // Get member_points molecule_id
  const moleculeId = await getMoleculeId(tenantId, 'member_points');
  
  // Insert directly - C1 is the bucket link (already 5-byte), N1 is the amount
  await dbClient.query(
    `INSERT INTO "5_data_54" (p_link, attaches_to, molecule_id, c1, n1) VALUES ($1, 'A', $2, $3, $4)`,
    [activityLink, moleculeId, bucketLink, amount]
  );
}

/**
 * Get points for an activity from member_points molecule
 * Uses generic molecule helpers, falls back to old molecule_value_list
 * @param {number} activityId - The activity ID
 * @param {number} tenantId - The tenant ID
 * @param {string} link - Optional activity link (skips lookup if provided)
 * @returns {Promise<number>} The point amount (0 if not found)
 */
async function getActivityPoints(activityId, tenantId, link = null) {
  // Use provided link or look it up
  let activityLink = link;
  if (!activityLink) {
    const actResult = await dbClient.query(
      `SELECT link FROM activity WHERE activity_id = $1`,
      [activityId]
    );
    activityLink = actResult.rows[0]?.link;
  }
  
  if (activityLink) {
    // Try new molecule storage first
    try {
      const rows = await getMoleculeRows(activityLink, 'member_points', tenantId);
      if (rows.length > 0) {
        // Sum N1 (amount) across all rows (usually just one)
        return rows.reduce((sum, row) => sum + (row.N1 || 0), 0);
      }
    } catch (e) {
      // Molecule not found, fall through to legacy
    }
  }
  
  // Fall back to old table
  const memberPointsMoleculeId = await getMoleculeId(tenantId, 'member_points');
  if (!memberPointsMoleculeId) return 0;
  
  const result = await dbClient.query(
    `SELECT COALESCE(SUM(value::numeric), 0) as total
     FROM molecule_value_list 
     WHERE context_id = $1 AND molecule_id = $2 AND col = 'B'`,
    [activityId, memberPointsMoleculeId]
  );
  
  return Number(result.rows[0].total);
}

/**
 * Add points to bucket (replaces addPointsToLot)
 * Finds or creates bucket, updates accrued, returns bucket info
 * @param {string} memberLink - The member's link (CHAR(5))
 * @param {string} activityDate - The activity date
 * @param {number} pointAmount - Points to add
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<Object>} { bucket_link, expire_date, rule_key }
 */
async function addPointsToMoleculeBucket(memberLink, activityDate, pointAmount, tenantId) {
  // Step 1: Find expiration rule
  const expirationRule = await findExpirationRule(activityDate, tenantId);
  
  if (!expirationRule.ruleKey) {
    throw new Error('No expiration rule found for activity date');
  }
  
  debugLog(() => `   ✓ Expiration rule: ${expirationRule.ruleKey} (id=${expirationRule.ruleId}) - expires ${expirationRule.expireDate}`);
  
  // Step 2: Find or create bucket
  const bucketLink = await findOrCreatePointBucket(
    memberLink, 
    expirationRule.ruleId,
    expirationRule.expireDate, 
    tenantId
  );
  
  // Step 3: Update accrued amount
  await updatePointBucketAccrued(bucketLink, pointAmount);
  
  debugLog(() => `   ✓ Bucket link=${bucketLink}: added ${pointAmount} points`);
  
  return {
    bucket_link: bucketLink,
    expire_date: expirationRule.expireDate,
    rule_key: expirationRule.ruleKey
  };
}

/**
 * Get error message by error code
 * @param {string} errorCode - The error code (e.g., "E003")
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string|null>} Error message text with atoms resolved, or null if not found
 */
async function getErrorMessage(errorCode, tenantId) {
  try {
    const errorDetails = await getSysparmDetails(tenantId, 'error_messages');
    const errorEntry = errorDetails.find(d => d.category === errorCode);
    
    if (errorEntry) {
      const messageTemplate = errorEntry.value;
      debugLog(() => `[getErrorMessage] Template: ${messageTemplate}`);
      
      // Resolve any atoms in the error message
      const context = {
        tenantId: tenantId,
        getMolecule: getMolecule,
        dbClient: dbClient
      };
      
      const resolvedMessage = await resolveAtoms(messageTemplate, context);
      debugLog(() => `[getErrorMessage] Resolved: ${resolvedMessage}`);
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

// Debug endpoint to check composite cache
app.get('/v1/composites/cache', (req, res) => {
  const tenant_id = parseInt(req.query.tenant_id) || 1;
  const results = [];
  for (const [key, composite] of caches.composites) {
    if (composite.tenant_id === tenant_id) {
      results.push({
        key,
        composite_type: composite.composite_type,
        description: composite.description,
        detail_count: composite.details.length,
        molecules: composite.details.map(d => ({
          molecule_key: d.molecule_key,
          is_required: d.is_required,
          is_calculated: d.is_calculated,
          calc_function: d.calc_function
        }))
      });
    }
  }
  res.json({ tenant_id, composites: results });
});

// Save composite (POST for new, PUT for update)
app.post('/v1/composites', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { tenant_id, composite_type, description, validate_function, details } = req.body;
  
  if (!tenant_id || !composite_type) {
    return res.status(400).json({ error: 'tenant_id and composite_type required' });
  }
  if (!details || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: 'details array required with at least one molecule' });
  }
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Check if composite already exists
    const existing = await client.query(
      'SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = $2',
      [tenant_id, composite_type]
    );
    
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Composite already exists for this tenant and type. Use PUT to update.' });
    }
    
    // Get next link for composite
    const compositeLink = await getNextLink(tenant_id, 'composite', client);
    
    // Insert composite header
    await client.query(
      `INSERT INTO composite (link, tenant_id, composite_type, description, validate_function)
       VALUES ($1, $2, $3, $4, $5)`,
      [compositeLink, tenant_id, composite_type, description || null, validate_function || null]
    );
    
    // Insert details
    for (const detail of details) {
      const detailLink = await getNextLink(tenant_id, 'composite_detail', client);
      await client.query(
        `INSERT INTO composite_detail (link, p_link, molecule_id, is_required, is_calculated, calc_function, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [detailLink, compositeLink, detail.molecule_id, detail.is_required || false, 
         detail.is_calculated || false, detail.calc_function || null, detail.sort_order]
      );
    }
    
    await client.query('COMMIT');
    
    // Reload cache for this composite
    await loadCompositeToCache(tenant_id, composite_type, client);
    
    res.json({ success: true, link: compositeLink });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error creating composite:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.put('/v1/composites', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { tenant_id, composite_type, description, validate_function, details } = req.body;
  
  if (!tenant_id || !composite_type) {
    return res.status(400).json({ error: 'tenant_id and composite_type required' });
  }
  if (!details || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: 'details array required with at least one molecule' });
  }
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Find existing composite
    const existing = await client.query(
      'SELECT link FROM composite WHERE tenant_id = $1 AND composite_type = $2',
      [tenant_id, composite_type]
    );
    
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Composite not found. Use POST to create.' });
    }
    
    const compositeLink = existing.rows[0].link;
    
    // Update composite header
    await client.query(
      `UPDATE composite SET description = $1, validate_function = $2 WHERE link = $3`,
      [description || null, validate_function || null, compositeLink]
    );
    
    // Update each detail row
    for (const detail of details) {
      await client.query(
        `UPDATE composite_detail 
         SET is_required = $1, is_calculated = $2, calc_function = $3, sort_order = $4
         WHERE p_link = $5 AND molecule_id = $6`,
        [detail.is_required || false, detail.is_calculated || false, 
         detail.calc_function || null, detail.sort_order, compositeLink, detail.molecule_id]
      );
    }
    
    await client.query('COMMIT');
    
    // Reload cache for this composite
    await loadCompositeToCache(tenant_id, composite_type, client);
    
    res.json({ success: true, link: compositeLink });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating composite:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Helper to reload a single composite into cache
async function loadCompositeToCache(tenantId, compositeType, client) {
  const result = await client.query(`
    SELECT c.link, c.tenant_id, c.composite_type, c.description, c.validate_function,
           cd.link as detail_link, cd.molecule_id, cd.is_required, cd.is_calculated, 
           cd.calc_function, cd.sort_order,
           md.molecule_key, md.storage_size, md.value_type, md.value_kind
    FROM composite c
    JOIN composite_detail cd ON cd.p_link = c.link
    JOIN molecule_def md ON md.molecule_id = cd.molecule_id
    WHERE c.tenant_id = $1 AND c.composite_type = $2
    ORDER BY cd.sort_order
  `, [tenantId, compositeType]);
  
  if (result.rows.length === 0) return;
  
  const first = result.rows[0];
  const cacheKey = `${tenantId}:${compositeType}`;
  
  caches.composites.set(cacheKey, {
    link: first.link,
    tenant_id: first.tenant_id,
    composite_type: first.composite_type,
    description: first.description,
    validate_function: first.validate_function,
    details: result.rows.map(r => ({
      detail_link: r.detail_link,
      molecule_id: r.molecule_id,
      molecule_key: r.molecule_key,
      storage_size: r.storage_size,
      value_type: r.value_type,
      value_kind: r.value_kind,
      is_required: r.is_required,
      is_calculated: r.is_calculated,
      calc_function: r.calc_function,
      sort_order: r.sort_order
    }))
  });
  
  debugLog(() => `[CACHE] Reloaded composite ${cacheKey}`);
}

// Test endpoint for new composite-based createActivity (temporary during transition)
app.post('/v1/test/create-activity', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { membership_number, activity_type, tenant_id, ...payload } = req.body;
    const tenantId = tenant_id || 1;
    
    if (!membership_number) {
      return res.status(400).json({ error: 'membership_number required' });
    }
    if (!activity_type) {
      return res.status(400).json({ error: 'activity_type required' });
    }
    if (!payload.activity_date) {
      return res.status(400).json({ error: 'activity_date required' });
    }

    // Resolve member
    const memberRec = await resolveMember(membership_number, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Call the new generic createActivity
    const result = await createActivity(memberRec.link, activity_type, payload, tenantId);
    
    res.json({
      success: true,
      activity_link: result.link,
      base_points: result.base_points,
      bucket_link: result.bucket_link,
      expire_date: result.expire_date,
      bonuses_count: result.bonuses.length,
      promotions_count: result.promotions.length
    });
  } catch (error) {
    console.error('Test create-activity error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Resolve member by membership_number (the member-facing ID)
 * @param {string} membershipNumber - The membership number (what members see on their card)
 * @returns {Promise<{member_id: number, tenant_id: number, membership_number: string}|null>}
 */
async function resolveMember(membershipNumber, tenantId = 1) {
  if (!dbClient) return null;
  try {
    const result = await dbClient.query(
      `SELECT tenant_id, membership_number, link, 
              fname, lname, middle_initial, email, phone,
              address1, address2, city, state, zip, zip_plus4, is_active
       FROM member WHERE tenant_id = $1 AND membership_number = $2`,
      [tenantId, membershipNumber]
    );
    return result.rows[0] || null;
  } catch (e) {
    console.error('Error resolving member:', e);
    return null;
  }
}

// ============ SYSPARM ENDPOINTS ============
// GET sysparm value by category/code
app.get('/v1/sysparm/:category/:code', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { category, code } = req.params;
    const tenantId = req.query.tenant_id || 1;
    
    // For activity type codes (A, P, J, R, N), check activity_processing sysparm
    // Note: 'M' is for member profiles, not activity processing
    const activityTypes = ['A', 'P', 'J', 'R', 'N'];
    let value;
    if (activityTypes.includes(category)) {
      value = await getSysparmValue(tenantId, 'activity_processing', category, code);
    } else {
      value = await getSysparmValue(tenantId, category, code);
    }
    
    if (value === null) {
      return res.status(404).json({ error: 'Sysparm not found' });
    }
    
    res.json({ category, code, value });
  } catch (error) {
    console.error('Error getting sysparm:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT sysparm value by category/code
app.put('/v1/sysparm/:category/:code', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { category, code } = req.params;
    const { tenant_id, value } = req.body;
    const tenantId = tenant_id || 1;
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value required' });
    }
    
    const success = await setSysparmValue(tenantId, category, code, String(value));
    
    if (success) {
      res.json({ category, code, value, updated: true });
    } else {
      res.status(500).json({ error: 'Failed to update sysparm' });
    }
  } catch (error) {
    console.error('Error setting sysparm:', error);
    res.status(500).json({ error: error.message });
  }
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
    const tenantId = req.params.id;
    
    // Build labels object
    const labels = {};
    
    // Get labels from sysparm (currency_label, activity_type_label, etc.)
    // These are stored with sysparm_key = label name, category = null, code = null
    const labelKeys = ['currency_label', 'currency_label_singular', 'activity_type_label'];
    const sysparmQuery = `
      SELECT s.sysparm_key, sd.value
      FROM sysparm s
      JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
      WHERE s.tenant_id = $1 AND s.sysparm_key = ANY($2)
        AND sd.category IS NULL AND sd.code IS NULL
    `;
    const sysparmResult = await dbClient.query(sysparmQuery, [tenantId, labelKeys]);
    sysparmResult.rows.forEach(row => {
      labels[row.sysparm_key] = row.value;
    });
    
    // Then, get any remaining from static molecules (legacy support)
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
        AND md.value_kind IN ('scalar', 'value')
    `;
    
    const result = await dbClient.query(query, [tenantId]);
    
    // Add molecule values (don't overwrite sysparm values)
    result.rows.forEach(row => {
      if (row.molecule_key && row.value !== null && !labels[row.molecule_key]) {
        labels[row.molecule_key] = row.value;
      }
    });
    
    res.json(labels);
  } catch (error) {
    console.error('Error fetching tenant labels:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Tenant branding (colors, logo, company name)
app.get('/v1/tenants/:id/branding', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const tenantId = parseInt(req.params.id);
    
    // Get all branding details using helper
    const details = await getSysparmDetails(tenantId, 'branding');
    
    // Transform flat list into structured object
    const branding = {
      colors: {},
      logo: {},
      text: {}
    };
    
    for (const row of details) {
      if (row.category && row.code) {
        if (!branding[row.category]) branding[row.category] = {};
        branding[row.category][row.code] = row.value;
      }
    }
    
    // Return defaults if no branding configured
    if (Object.keys(branding.colors).length === 0) {
      branding.colors = {
        primary: '#0066cc',
        accent: '#059669'
      };
    }
    
    res.json(branding);
  } catch (error) {
    console.error('Error fetching tenant branding:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update tenant branding
app.put('/v1/tenants/:id/branding', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const tenantId = parseInt(req.params.id);
    const { colors, logo, text } = req.body;
    let failures = [];
    
    // Save each branding value using helper
    if (colors) {
      for (const [code, value] of Object.entries(colors)) {
        const ok = await setSysparmValue(tenantId, 'branding', 'text', value, 'colors', code);
        if (!ok) failures.push(`colors.${code}`);
      }
    }
    
    if (logo) {
      for (const [code, value] of Object.entries(logo)) {
        const ok = await setSysparmValue(tenantId, 'branding', 'text', value, 'logo', code);
        if (!ok) failures.push(`logo.${code}`);
      }
    }
    
    if (text) {
      for (const [code, value] of Object.entries(text)) {
        const ok = await setSysparmValue(tenantId, 'branding', 'text', value, 'text', code);
        if (!ok) failures.push(`text.${code}`);
      }
    }
    
    if (failures.length > 0) {
      return res.status(500).json({ error: `Failed to save: ${failures.join(', ')}` });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating tenant branding:', error);
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

// POST - Create or update carrier
app.post('/v1/carriers', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { code, name, alliance, country, is_active, tenant_id } = req.body;
    
    // Validation
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }
    
    // Check if carrier already exists for this tenant
    const checkQuery = 'SELECT carrier_id FROM carriers WHERE code = $1 AND tenant_id = $2';
    const existing = await dbClient.query(checkQuery, [code, tenant_id]);
    
    if (existing.rows.length > 0) {
      // UPDATE existing carrier
      const updateQuery = `
        UPDATE carriers 
        SET name = $1, alliance = $2, country = $3, is_active = $4
        WHERE code = $5 AND tenant_id = $6
        RETURNING *
      `;
      const result = await dbClient.query(updateQuery, [
        name, alliance || null, country || null, is_active !== false, code, tenant_id
      ]);
      await loadCaches();
      res.json({ message: 'Carrier updated', carrier: result.rows[0] });
    } else {
      // INSERT new carrier
      const insertQuery = `
        INSERT INTO carriers (code, name, alliance, country, is_active, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await dbClient.query(insertQuery, [
        code, name, alliance || null, country || null, is_active !== false, tenant_id
      ]);
      await loadCaches();
      res.json({ message: 'Carrier created', carrier: result.rows[0] });
    }
  } catch (error) {
    console.error('Error saving carrier:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete carrier
app.delete('/v1/carriers/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    const query = 'DELETE FROM carriers WHERE carrier_id = $1 AND tenant_id = $2 RETURNING *';
    const result = await dbClient.query(query, [id, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    
    await loadCaches();
    res.json({ message: 'Carrier deleted' });
  } catch (error) {
    console.error('Error deleting carrier:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List airports for a tenant
// Member Info
app.get("/v1/member/:id/info", async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  
  if (!dbClient) {
    return res.json({
      membership_number: membershipNumber,
      name: 'Mock Member',
      tier: 'Silver',
      available_miles: 0
    });
  }
  
  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    const member = {
      link: memberLink,
      membership_number: memberRec.membership_number,
      name: `${memberRec.fname || ''} ${memberRec.lname || ''}`.trim()
    };
    
    // Get current tier
    const tierResult = await getMemberTierOnDate(memberLink, new Date().toISOString().slice(0, 10));
    
    if (tierResult) {
      member.tier = tierResult.tier_code;
      member.tier_description = tierResult.tier_description;
    }
    
    // Get available miles from NEW storage ("5_data_2244")
    let availableMiles = 0;
    const today = new Date().toISOString().slice(0, 10);
    
    try {
      if (memberLink) {
        const rows = await getMemberPointBuckets(memberLink, tenantId);
        
        availableMiles = rows
          .map(r => ({
            expiry_date: moleculeIntToDate(r.expire_date).toISOString().slice(0, 10),
            net_balance: r.accrued - r.redeemed
          }))
          .filter(b => b.expiry_date >= today)
          .reduce((sum, b) => sum + Math.max(0, b.net_balance), 0);
      }
    } catch (e) {
      debugLog(() => `   ⚠️ Error getting available miles: ${e.message}`);
    }
    
    member.available_miles = availableMiles;
    
    return res.json(member);
    
  } catch (e) {
    console.error("member info error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// Balances
app.get("/v1/member/:id/balances", async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  const today = new Date().toISOString().slice(0,10);
  
  if (!dbClient) return res.json(MOCK.balances(membershipNumber));
  
  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    if (!memberLink) {
      return res.json({ ok: true, balances: { base_points: 0 } });
    }
    
    // Get all bucket rows from table
    const rows = await getMemberPointBuckets(memberLink, tenantId);
    
    // Same calculation as /buckets endpoint
    const totalAvailable = rows
      .map(r => ({
        expiry_date: moleculeIntToDate(r.expire_date).toISOString().slice(0, 10),
        net_balance: r.accrued - r.redeemed
      }))
      .filter(b => b.expiry_date >= today)
      .reduce((sum, b) => sum + Math.max(0, b.net_balance), 0);
    
    return res.json({ ok: true, balances: { base_points: totalAvailable } });
    
  } catch (e) {
    console.error("balances error:", e);
    return res.json(MOCK.balances(membershipNumber));
  }
});

// Activities with decoded molecules
app.get("/v1/member/:id/activities", async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

  if (!dbClient) {
    const mock = MOCK.activities(membershipNumber);
    for (const a of mock.activities) a.magic_box = rowsToMagicBox(a);
    return res.json(mock);
  }
  
  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    // Get member_points molecule_id
    const memberPointsMoleculeId = await getMoleculeId(tenantId, 'member_points');
    
    // Step 1: Get activities with points from "5_data_54" (exclude type 'N' bonus activities - they show under parent)
    // Use SUM to handle redemptions which can have multiple rows (one per bucket)
    const activitiesQuery = `
      SELECT 
        a.activity_date,
        a.activity_type,
        a.link,
        a.p_link,
        COALESCE(SUM(ad54.N1), 0) as base_points
      FROM activity a
      LEFT JOIN "5_data_54" ad54 ON a.link = ad54.p_link 
        AND ad54.molecule_id = $3
      WHERE a.p_link = $1
        AND a.activity_type != 'N'
      GROUP BY a.activity_date, a.activity_type, a.link, a.p_link
      ORDER BY a.activity_date DESC
      LIMIT $2
    `;
    
    const activitiesResult = await dbClient.query(activitiesQuery, [memberLink, limit, memberPointsMoleculeId]);
    
    // Convert activity_date from SMALLINT storage to Date objects
    hydrateActivityDates(activitiesResult.rows);
    
    if (activitiesResult.rows.length === 0) {
      return res.json({ ok: true, activities: [] });
    }
    
    // Step 2: Get all activity molecule values from new storage tables
    const activityLinks = activitiesResult.rows.map(r => r.link);
    
    // Query all storage tables and union results - read raw values
    // Column names: C1 for char types (1,3,5 bytes), N1 for numeric types (2,4 bytes)
    const detailsQuery = `
      WITH activity_molecules AS (
        SELECT a.link as p_link
        FROM activity a
        WHERE a.link = ANY($1)
      )
      SELECT am.p_link, md.molecule_id, md.molecule_key, ad.C1 as raw_value, 1 as storage_size, md.value_type
      FROM activity_molecules am
      JOIN "5_data_1" ad ON ad.p_link = am.p_link
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id AND md.context IN ('activity', 'system')
      
      UNION ALL
      
      SELECT am.p_link, md.molecule_id, md.molecule_key, ad.N1::text as raw_value, 2 as storage_size, md.value_type
      FROM activity_molecules am
      JOIN "5_data_2" ad ON ad.p_link = am.p_link
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id AND md.context IN ('activity', 'system')
      
      UNION ALL
      
      SELECT am.p_link, md.molecule_id, md.molecule_key, ad.C1 as raw_value, 3 as storage_size, md.value_type
      FROM activity_molecules am
      JOIN "5_data_3" ad ON ad.p_link = am.p_link
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id AND md.context IN ('activity', 'system')
      
      UNION ALL
      
      SELECT am.p_link, md.molecule_id, md.molecule_key, ad.N1::text as raw_value, 4 as storage_size, md.value_type
      FROM activity_molecules am
      JOIN "5_data_4" ad ON ad.p_link = am.p_link
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id AND md.context IN ('activity', 'system')
      
      UNION ALL
      
      SELECT am.p_link, md.molecule_id, md.molecule_key, ad.C1 as raw_value, 5 as storage_size, md.value_type
      FROM activity_molecules am
      JOIN "5_data_5" ad ON ad.p_link = am.p_link
      JOIN molecule_def md ON ad.molecule_id = md.molecule_id AND md.context IN ('activity', 'system')
      
      ORDER BY p_link, molecule_key
    `;
    
    const detailsResult = await dbClient.query(detailsQuery, [activityLinks]);
    
    // Decode raw values using decodeValue helper (with value_type for offset encoding)
    for (const row of detailsResult.rows) {
      row.v_ref_id = decodeValue(row.raw_value, row.storage_size, row.value_type);
    }
    
    // Group details by activity link
    const detailsByActivity = {};
    for (const detail of detailsResult.rows) {
      if (!detailsByActivity[detail.p_link]) {
        detailsByActivity[detail.p_link] = [];
      }
      detailsByActivity[detail.p_link].push(detail);
    }
    
    // Step 3: Load label values for this tenant
    const currencyLabel = await getSysparmByKey(tenantId, 'currency_label') || 'miles';
    
    // Load activity_type_label for 'A' activities
    const activityTypeLabel = await getSysparmByKey(tenantId, 'activity_type_label') || 'Activity';
    
    const originMolecule = await getMolecule('origin', tenantId);
    const destinationMolecule = await getMolecule('destination', tenantId);
    const carrierMolecule = await getMolecule('carrier', tenantId);
    const fareClassMolecule = await getMolecule('fare_class', tenantId);
    
    // Templates are now fetched per-activity (see below in activity loop)
    
    // Step 4: Decode molecules for each activity
    const activities = await Promise.all(activitiesResult.rows.map(async (activity) => {
      const basePoints = Number(activity.base_points || 0);
      const details = detailsByActivity[activity.link] || [];
      
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
          debugLog(() => `Activity ${activity.link}: Loaded Efficient template for type=${activity.activity_type}`);
        }
      } catch (e) {
        debugLog(() => `Activity ${activity.link}: No Efficient template for type=${activity.activity_type}`);
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
          debugLog(() => `Activity ${activity.link}: Loaded Verbose template for type=${activity.activity_type}`);
        }
      } catch (e) {
        debugLog(() => `Activity ${activity.link}: No Verbose template for type=${activity.activity_type}`);
      }
      
      // Decode each molecule
      const decodedValues = {};
      const decodedDescriptions = {}; // For lookup molecule descriptions
      
      for (const detail of details) {
        try {
          // Always get the code
          const moleculeKey = detail.molecule_key;
          
          // Link-type molecules store raw FK references - no decode needed
          if (detail.value_type === 'link') {
            decodedValues[moleculeKey] = detail.v_ref_id;
            continue;
          }
          
          // Skip dynamic_list molecules - they store raw data, not lookup references
          const molDef = await getMolecule(moleculeKey, tenantId);
          if (molDef.value_kind === 'dynamic_list') {
            continue;
          }
          
          decodedValues[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id);
          
          // For lookup molecules, also get description
          try {
            if (isLookupMolecule(molDef)) {
              // Query molecule_value_lookup to get the label_column (for description)
              const lookupQuery = `
                SELECT label_column 
                FROM molecule_value_lookup 
                WHERE molecule_id = $1
              `;
              const lookupResult = await dbClient.query(lookupQuery, [molDef.molecule_id]);
              
              if (lookupResult.rows.length > 0 && lookupResult.rows[0].label_column) {
                const labelColumn = lookupResult.rows[0].label_column;
                
                debugLog(() => `Decoding ${moleculeKey}: label=${labelColumn}`);
                
                decodedDescriptions[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id, labelColumn);
              }
            } else if (isListMolecule(molDef)) {
              // For list molecules, get the description (display_label)
              decodedDescriptions[moleculeKey] = await decodeMolecule(tenantId, moleculeKey, detail.v_ref_id, 'description');
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
        membership_number: memberRec.membership_number,  // Use membership_number instead of member_id
        link: activity.link,  // Activity's own link for molecule lookups
        activity_date: activity.activity_date ? formatDateLocal(activity.activity_date) : "",
        activity_type: activity.activity_type || 'A',
        base_points: basePoints,
        point_type: currencyLabel
      };
      
      // Get display config from activity_display sysparm for this activity type
      try {
        const displayDetails = await getSysparmDetails(tenantId, 'activity_display');
        
        // Filter to this activity type and convert to config object
        const displayConfig = {};
        displayDetails
          .filter(d => d.category === activity.activity_type)
          .forEach(row => {
            displayConfig[row.code] = row.value;
          });
        
        // Apply display properties
        result.activity_icon = displayConfig.icon || '📋';
        result.activity_color = displayConfig.color || '#059669';
        result.activity_bg_color = displayConfig.bg_color || '#f0fdf4';
        result.activity_border_color = displayConfig.border_color || '#059669';
        result.activity_show_bonuses = displayConfig.show_bonuses === 'true';
        result.activity_action_verb = displayConfig.action_verb || 'Added';
        
        // Get label: 'A' from activity_type_label sysparm, others from display config
        if (activity.activity_type === 'A') {
          result.activity_type_label = activityTypeLabel;
        } else {
          result.activity_type_label = displayConfig.label || 'Activity';
        }
      } catch (error) {
        console.error('Error loading display config:', error);
        // Fallback
        result.activity_icon = '📋';
        result.activity_type_label = 'Activity';
      }
      
      result.title = `Activity ${basePoints.toLocaleString()}`;
      
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
        // Use templates if available, otherwise fallback to simple format
        if (efficientTemplate && efficientTemplate.length > 0) {
          result.magic_box_efficient = renderTemplate(efficientTemplate);
        } else {
          // Fallback: "Adjustment: [adjustment_code]"
          const adjustmentCode = decodedValues.adjustment || '';
          result.magic_box_efficient = [{
            label: 'Adjustment',
            value: adjustmentCode
          }];
        }
        
        if (verboseTemplate && verboseTemplate.length > 0) {
          result.magic_box_verbose = renderTemplate(verboseTemplate);
        } else {
          result.magic_box_verbose = result.magic_box_efficient;
        }
        
        result.magic_box = result.magic_box_efficient;
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
      // Decode redemption_type molecule from molecule_value_list
      if (activity.activity_type === 'R' && decodedValues.redemption_type) {
        try {
          // decodeMolecule returns code by default
          result.redemption_code = decodedValues.redemption_type;
          
          // Get description by decoding again with specific column
          const redemptionDetail = details.find(d => d.molecule_key === 'redemption_type');
          if (redemptionDetail) {
            result.redemption_description = await decodeMolecule(
              tenantId, 
              'redemption_type', 
              redemptionDetail.v_ref_id, 
              'redemption_description'
            );
          }
          
          // Get redemption aging breakdown
          // member_points molecules on activity have: C1=bucket_link, N1=negative_points
          
          // Get the points breakdown from this activity using new storage
          const agingMap = new Map();
          
          if (activity.link) {
            try {
              const pointsRows = await getMoleculeRows(activity.link, 'member_points', tenantId);
              
              for (const row of pointsRows) {
                const bucketLink = row.C1;  // bucket link
                const pointsUsed = Math.abs(row.N1 || 0);
                
                if (bucketLink && pointsUsed > 0) {
                  // Get expire_date from the bucket using link
                  const bucket = await getPointBucketByLink(bucketLink);
                  
                  
                  
                  if (bucket) {
                    const expireDate = moleculeIntToDate(bucket.expire_date);
                    const dateKey = expireDate.toISOString().slice(0, 10);
                    agingMap.set(dateKey, (agingMap.get(dateKey) || 0) + pointsUsed);
                  }
                }
              }
            } catch (e) {
              console.error('Error loading redemption aging from new storage:', e);
            }
          }
          
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
          debugLog(() => `   Fetching promotion details for activity ${activity.link}`);
          // Get promotion info from member_promotion_detail
          const promoQuery = `
            SELECT p.promotion_code, p.promotion_name
            FROM member_promotion_detail mpd
            JOIN member_promotion mp ON mpd.member_promotion_id = mp.member_promotion_id
            JOIN promotion p ON mp.promotion_id = p.promotion_id
            WHERE mpd.activity_link = $1
          `;
          const promoResult = await dbClient.query(promoQuery, [activity.link]);
          debugLog(() => `   Promotion query returned ${promoResult.rows.length} rows`);
          
          if (promoResult.rows.length > 0) {
            const promo = promoResult.rows[0];
            debugLog(() => `   Promotion: ${promo.promotion_code} - ${promo.promotion_name}`);
            result.promotion_code = promo.promotion_code;
            result.promotion_name = promo.promotion_name;
            
            result.magic_box = [{
              label: 'Qualified Promotion',
              value: `${promo.promotion_code} ${promo.promotion_name}`
            }];
            result.magic_box_efficient = result.magic_box;
            result.magic_box_verbose = result.magic_box;
          } else {
            debugLog(() => `   ⚠️  No promotion detail found for activity ${activity.link}`);
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
    const mock = MOCK.activities(membershipNumber);
    for (const a of mock.activities) a.magic_box = rowsToMagicBox(a);
    return res.json(mock);
  }
});

// NEW: Point buckets for Mile Summary
app.get("/v1/member/:id/buckets", async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  const today = formatDateLocal(new Date());
  const program_tz = "America/Chicago";

  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    // Get all bucket rows from table
    const rows = await getMemberPointBuckets(memberLink, tenantId);
    
    // Convert to response format
    const buckets = rows.map(r => {
      const expireDate = moleculeIntToDate(r.expire_date);
      const expireDateStr = formatDateLocal(expireDate);
      
      return {
        link: r.link,
        rule_id: r.rule_id,
        expiry_date: expireDateStr,
        accrued: r.accrued,
        redeemed: r.redeemed,
        net_balance: r.accrued - r.redeemed
      };
    });
    
    // Calculate total available (unexpired only)
    const totalAvailable = buckets
      .filter(b => b.expiry_date >= today)
      .reduce((sum, b) => sum + Math.max(0, b.net_balance), 0);
    
    return res.json({
      ok: true,
      link: memberLink,
      point_type: "base_points",
      program_tz,
      today,
      total_available: totalAvailable,
      buckets: buckets
    });
    
  } catch (e) {
    console.error("buckets error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// Member Tier History
app.get("/v1/member/:id/tiers", async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;

  if (!dbClient) {
    // Mock tier data
    return res.json({
      ok: true,
      membership_number: membershipNumber,
      tiers: [
        { tier_code: "B", tier_description: "Basic", tier_ranking: 1, start_date: "2023-01-01", end_date: "2023-12-31" },
        { tier_code: "S", tier_description: "Silver", tier_ranking: 3, start_date: "2024-01-01", end_date: "2024-06-30" },
        { tier_code: "G", tier_description: "Gold", tier_ranking: 5, start_date: "2024-07-01", end_date: null }
      ]
    });
  }

  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    const q = await dbClient.query(
      `SELECT 
         mt.member_tier_id,
         td.tier_code,
         td.tier_description,
         td.tier_ranking,
         mt.start_date::date AS start_date,
         mt.end_date::date AS end_date,
         COALESCE(td.badge_color, '#6b7280') as badge_color,
         COALESCE(td.text_color, '#ffffff') as text_color,
         td.icon
       FROM member_tier mt
       JOIN tier_definition td ON mt.tier_id = td.tier_id
       WHERE mt.p_link = $1
       ORDER BY mt.start_date DESC`,
      [memberLink]
    );

    const tiers = q.rows.map(r => ({
      member_tier_id: r.member_tier_id,
      tier_code: r.tier_code,
      tier_description: r.tier_description,
      tier_ranking: Number(r.tier_ranking || 0),
      start_date: r.start_date?.toISOString?.() ? r.start_date.toISOString().slice(0, 10) : String(r.start_date || ''),
      end_date: r.end_date?.toISOString?.() ? r.end_date.toISOString().slice(0, 10) : (r.end_date || null),
      badge_color: r.badge_color,
      text_color: r.text_color,
      icon: r.icon
    }));

    return res.json({ ok: true, membership_number: membershipNumber, tiers });
  } catch (e) {
    console.error("tiers error:", e);
    // Fallback to mock
    return res.json({
      ok: true,
      membership_number: membershipNumber,
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
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || parseInt(req.body.tenant_id) || 1;
  const { tier_id, start_date, end_date } = req.body;

  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    const query = `
      INSERT INTO member_tier (p_link, tier_id, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        member_tier_id,
        p_link,
        tier_id,
        start_date,
        end_date
    `;

    const result = await dbClient.query(query, [
      memberLink,
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
  const { id: membershipNumber, tierId } = req.params;
  const tenantId = parseInt(req.query.tenant_id) || parseInt(req.body.tenant_id) || 1;
  const { tier_id, start_date, end_date } = req.body;

  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    const query = `
      UPDATE member_tier
      SET 
        tier_id = $1,
        start_date = $2,
        end_date = $3
      WHERE member_tier_id = $4
        AND p_link = $5
      RETURNING 
        member_tier_id,
        p_link,
        tier_id,
        start_date,
        end_date
    `;

    const result = await dbClient.query(query, [
      tier_id,
      start_date,
      end_date || null,
      tierId,
      memberLink
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
  const { id: membershipNumber, tierId } = req.params;
  const tenantId = parseInt(req.query.tenant_id) || 1;

  try {
    // Resolve member by membership_number
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    const query = `
      DELETE FROM member_tier
      WHERE member_tier_id = $1
        AND p_link = $2
      RETURNING member_tier_id
    `;

    const result = await dbClient.query(query, [tierId, memberLink]);

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

  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;

  try {
    // Resolve member by membership_number - returns all fields
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    const member = memberRec;
    
    // Get current tier
    const today = new Date().toISOString().slice(0, 10);
    const tierResult = await getMemberTierOnDate(memberLink, today);
    const currentTier = tierResult ? tierResult.tier_description : null;
    
    // Get available miles from member_point_bucket molecule (using new storage)
    let availableMiles = 0;
    
    try {
      if (memberLink) {
        // Get all bucket rows from table
        const rows = await getMemberPointBuckets(memberLink, tenantId);
        
        // Same calculation as /buckets endpoint
        availableMiles = rows
          .map(r => ({
            expiry_date: moleculeIntToDate(r.expire_date).toISOString().slice(0, 10),
            net_balance: r.accrued - r.redeemed
          }))
          .filter(b => b.expiry_date >= today)
          .reduce((sum, b) => sum + Math.max(0, b.net_balance), 0);
      }
    } catch (e) {
      console.error('Error getting available miles from molecules:', e);
    }
    
    // Build profile response
    const profile = {
      link: member.link,
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
      zip: member.zip,
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

  // Resolve membership_number to internal member_id
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || parseInt(req.body.tenant_id) || 1;
  const memberRec = await resolveMember(membershipNumber, tenantId);
  if (!memberRec) {
    return res.status(404).json({ error: 'Member not found' });
  }
  const memberLink = memberRec.link;
  
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
      WHERE link = $14
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
      memberLink
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

// GET - Get member molecule values based on member input template
app.get('/v1/member/:id/molecules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  
  try {
    // Resolve member
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    // Get input template for member (activity_type = 'M')
    const templateQuery = `
      SELECT t.template_id, t.template_name,
             f.field_id, f.molecule_key, f.row_number, f.start_position, 
             f.display_width, f.display_label, f.is_required, f.sort_order
      FROM input_template t
      JOIN input_template_field f ON t.template_id = f.template_id
      WHERE t.tenant_id = $1 AND t.activity_type = 'M' AND t.is_active = true
      ORDER BY f.row_number, f.sort_order
    `;
    const templateResult = await dbClient.query(templateQuery, [tenantId]);
    
    if (templateResult.rows.length === 0) {
      return res.json({ template: null, molecules: {}, values: {} });
    }
    
    // Build template structure
    const template = {
      template_id: templateResult.rows[0].template_id,
      template_name: templateResult.rows[0].template_name,
      fields: templateResult.rows.map(r => ({
        field_id: r.field_id,
        molecule_key: r.molecule_key,
        row_number: r.row_number,
        start_position: r.start_position,
        display_width: r.display_width,
        display_label: r.display_label,
        is_required: r.is_required,
        sort_order: r.sort_order
      }))
    };
    
    // Get molecule definitions and current values
    const molecules = {};
    const values = {};
    
    for (const field of template.fields) {
      const molKey = field.molecule_key;
      
      // Get molecule definition
      const molDefQuery = `
        SELECT molecule_id, molecule_key, label, value_kind, scalar_type, 
               storage_size, value_type, lookup_table_key, attaches_to
        FROM molecule_def
        WHERE molecule_key = $1 AND tenant_id = $2 AND is_active = true
      `;
      const molDefResult = await dbClient.query(molDefQuery, [molKey, tenantId]);
      
      if (molDefResult.rows.length > 0) {
        const mol = molDefResult.rows[0];
        molecules[molKey] = mol;
        
        // Get current value from storage
        try {
          const rows = await getMoleculeRows(memberLink, molKey, tenantId);
          
          if (rows.length > 0) {
            // Get raw stored value (first non-null column)
            const rawValue = rows[0].N1 !== undefined ? rows[0].N1 : rows[0].C1;
            
            // Decode the value based on type
            if (rawValue !== null && rawValue !== undefined) {
              const decoded = await decodeMolecule(tenantId, molKey, rawValue);
              values[molKey] = decoded;
            }
          }
        } catch (e) {
          // No value stored yet - that's OK
          debugLog(() => `No value for ${molKey}: ${e.message}`);
        }
      }
    }
    
    res.json({ template, molecules, values });
  } catch (error) {
    console.error('Error getting member molecules:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Save member molecule values
app.put('/v1/member/:id/molecules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || parseInt(req.body.tenant_id) || 1;
  const moleculeValues = req.body.molecules || {};
  
  try {
    // Resolve member
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    // Process each molecule value
    for (const [molKey, value] of Object.entries(moleculeValues)) {
      if (value === null || value === undefined || value === '') {
        // Skip empty values (could add delete logic here if needed)
        continue;
      }
      
      // Get molecule storage info
      let info;
      try {
        info = await getMoleculeStorageInfo(tenantId, molKey);
      } catch (e) {
        console.warn(`Molecule ${molKey} not found, skipping`);
        continue;
      }
      
      // Encode the value
      const encodedValue = await encodeMolecule(tenantId, molKey, value);
      
      // Delete existing value first (simple upsert pattern)
      const deleteQuery = `
        DELETE FROM ${info.tableName}
        WHERE p_link = $1 AND molecule_id = $2 AND attaches_to = 'M'
      `;
      await dbClient.query(deleteQuery, [memberLink, info.moleculeId]);
      
      // Insert new value
      await insertMoleculeRow(memberLink, molKey, [encodedValue], tenantId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving member molecules:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Reserve next membership number for enrollment
app.get('/v1/member/next-number', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const tenantId = req.query.tenant_id || 1;

  try {
    const membershipNumber = await getNextMembershipNumber(tenantId);
    res.json({ membership_number: membershipNumber });
  } catch (error) {
    console.error('Error getting next membership number:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new member (enrollment)
app.post('/v1/member', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const tenantId = req.query.tenant_id || req.body.tenant_id || 1;
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
    zip_plus4
  } = req.body;

  // Validation
  if (!membership_number) {
    return res.status(400).json({ error: 'Membership number is required' });
  }
  if (!fname || !lname) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  try {
    // Get next link from link_tank (atomic, self-maintaining)
    const link = await getNextLink(tenantId, 'member');
    
    // Calculate enroll_date as days since Bill epoch (1959-12-03)
    const enrollDate = dateToMoleculeInt(new Date());

    const insertQuery = `
      INSERT INTO member (
        tenant_id,
        link,
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
        enroll_date,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
      RETURNING *
    `;

    const result = await dbClient.query(insertQuery, [
      tenantId,
      link,
      membership_number,
      fname,
      lname,
      middle_initial || null,
      email || null,
      phone || null,
      address1 || null,
      address2 || null,
      city || null,
      state || null,
      zip || null,
      zip_plus4 || null,
      enrollDate
    ]);

    const newMember = result.rows[0];

    // Assign default tier (tier_id = 1, typically "Member" or base tier)
    await dbClient.query(`
      INSERT INTO member_tier (p_link, tier_id, start_date, end_date)
      VALUES ($1, 1, CURRENT_DATE, NULL)
    `, [newMember.link]);

    debugLog(() => `New member enrolled: ${newMember.membership_number} - ${fname} ${lname} (link: ${link})`);

    res.status(201).json({
      success: true,
      member: newMember,
      message: `Member ${fname} ${lname} enrolled successfully with membership number ${membership_number}`
    });
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Search members by ID, email, name, or phone
app.get('/v1/member/search', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const { q, lname, fname, email, phone, membership_number, tenant_id } = req.query;
  
  // tenant_id is required for proper multi-tenant search
  const tenantId = parseInt(tenant_id) || 1;

  // Build query conditions based on which parameters are provided
  const conditions = [`m.tenant_id = $1`];
  const params = [tenantId];
  let paramCount = 2;

  // Legacy single-field search (q parameter)
  if (q && q.trim().length > 0) {
    const searchTerm = q.trim();
    debugLog(() => `🔍 Member search for: "${searchTerm}"`);
    conditions.push(`(
      m.membership_number ILIKE $${paramCount}
      OR m.email ILIKE $${paramCount}
      OR m.fname ILIKE $${paramCount}
      OR m.lname ILIKE $${paramCount}
      OR m.phone ILIKE $${paramCount}
    )`);
    params.push(`${searchTerm}%`);
    paramCount++;
  }

  // Separate field search
  if (lname && lname.trim().length > 0) {
    conditions.push(`m.lname ILIKE $${paramCount}`);
    params.push(`${lname.trim()}%`);
    paramCount++;
  }

  if (fname && fname.trim().length > 0) {
    conditions.push(`m.fname ILIKE $${paramCount}`);
    params.push(`${fname.trim()}%`);
    paramCount++;
  }

  if (email && email.trim().length > 0) {
    conditions.push(`m.email ILIKE $${paramCount}`);
    params.push(`${email.trim()}%`);
    paramCount++;
  }

  if (phone && phone.trim().length > 0) {
    conditions.push(`m.phone ILIKE $${paramCount}`);
    params.push(`${phone.trim()}%`);
    paramCount++;
  }

  if (membership_number && membership_number.trim().length > 0) {
    conditions.push(`m.membership_number = $${paramCount}`);
    params.push(membership_number.trim());
    paramCount++;
  }

  // Must have at least one search criterion beyond tenant_id
  if (conditions.length === 1) {
    return res.json([]);
  }

  debugLog(() => `🔍 Member search: tenant=${tenantId}, ${conditions.length - 1} search conditions`);

  try {
    // First, search members (fast - uses indexes)
    const searchQuery = `
      SELECT 
        m.link,
        m.membership_number,
        m.fname,
        m.lname,
        m.middle_initial,
        m.email,
        m.phone,
        m.city,
        m.state,
        m.enroll_date,
        m.is_active
      FROM member m
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.lname, m.fname
      LIMIT 20
    `;
    
    const result = await dbClient.query(searchQuery, params);
    debugLog(() => `  ✅ Found ${result.rows.length} members`);
    
    // Then add tier info and format dates for each result (small set)
    for (const row of result.rows) {
      // Convert enroll_date from SMALLINT to formatted date
      if (row.enroll_date != null) {
        row.enroll_date = moleculeIntToDate(row.enroll_date).toISOString().slice(0, 10);
      }
      
      try {
        const tierResult = await dbClient.query(
          `SELECT tier_code, tier_description as tier_name 
           FROM get_member_current_tier($1)`,
          [row.link]
        );
        if (tierResult.rows.length > 0) {
          row.tier_code = tierResult.rows[0].tier_code;
          row.tier_name = tierResult.rows[0].tier_name;
        }
      } catch (e) {
        // No tier - that's ok
      }
    }
    
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
    const tenantId = parseInt(req.query.tenant_id) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await dbClient.query(`
      SELECT link, membership_number, fname, lname
      FROM member
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY link
      LIMIT $2 OFFSET $3
    `, [tenantId, limit, offset]);
    
    res.json({ members: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching members:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET - Look up tier on specific date
app.get('/v1/member/:id/tiers/on-date', async (req, res) => {
  const membershipNumber = req.params.id;
  const tenantId = parseInt(req.query.tenant_id) || 1;
  const { date } = req.query;

  try {
    // Resolve membership_number to internal member_id
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    const tier = await getMemberTierOnDate(memberLink, date);
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
      { tier_id: 1, tier_code: 'B', tier_description: 'Basic', tier_ranking: 1, is_active: true, badge_color: '#9ca3af', text_color: '#ffffff', icon: null },
      { tier_id: 2, tier_code: 'S', tier_description: 'Silver', tier_ranking: 3, is_active: true, badge_color: '#94a3b8', text_color: '#ffffff', icon: '🥈' },
      { tier_id: 3, tier_code: 'G', tier_description: 'Gold', tier_ranking: 5, is_active: true, badge_color: '#fbbf24', text_color: '#1f2937', icon: '🥇' }
    ]);
  }
  
  try {
    const tenantId = req.query.tenant_id || '1';
    const includeInactive = req.query.include_inactive === 'true';
    
    const query = `
      SELECT 
        tier_id,
        tier_code,
        tier_description,
        tier_ranking,
        is_active,
        COALESCE(badge_color, '#6b7280') as badge_color,
        COALESCE(text_color, '#ffffff') as text_color,
        icon
      FROM tier_definition
      WHERE tenant_id = $1
        ${includeInactive ? '' : 'AND is_active = true'}
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

// GET - Search airports for typeahead
app.get('/v1/airports/search', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  const q = (req.query.q || '').trim().toUpperCase();
  
  if (q.length < 2) {
    return res.json([]);
  }
  
  try {
    const query = `
      SELECT code, name, city, country
      FROM airports
      WHERE is_active = true
        AND (
          code ILIKE $1
          OR name ILIKE $2
          OR city ILIKE $2
        )
      ORDER BY 
        CASE WHEN code = $3 THEN 0 ELSE 1 END,
        CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END,
        code
      LIMIT 10
    `;
    
    const result = await dbClient.query(query, [`${q}%`, `%${q}%`, q]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching airports:', error);
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

    // Resolve membership_number to member_link (UI passes membership_number as member_id)
    let memberLink = null;
    if (activityData.member_id) {
      const memberRec = await resolveMember(activityData.member_id, tenantId);
      if (memberRec) {
        memberLink = memberRec.link;
        activityData.member_link = memberLink;
      }
    }

    debugLog(() => `\n🧪 Testing rule for bonus: ${bonusCode}`);
    debugLog(() => `   Activity data: ${JSON.stringify(activityData)}`);
    debugLog(() => `   Tenant ID: ${tenantId}`);

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
      debugLog(() => `   ❌ Bonus not found: ${bonusCode}`);
      return res.status(404).json({ 
        error: `Bonus '${bonusCode}' not found` 
      });
    }

    const bonus = bonusResult.rows[0];
    debugLog(() => `   ✓ Bonus found: ${bonus.bonus_description}`);

    // Collect all failures instead of returning early
    const allFailures = [];

    // Step 2: Check if bonus is active
    if (!bonus.is_active) {
      debugLog(() => `   ❌ FAIL: Bonus is not active`);
      allFailures.push('Bonus is not active');
    } else {
      debugLog(() => `   ✓ Bonus is active`);
    }

    // Step 3: Check date range (compare date strings, YYYY-MM-DD format)
    const actDateStr = toDateStr(activityData.activity_date);
    const startDateStr = toDateStr(bonus.start_date);
    const endDateStr = toDateStr(bonus.end_date);

    if (actDateStr < startDateStr || actDateStr > endDateStr) {
      debugLog(() => `   ❌ FAIL: Activity date ${actDateStr} outside range ${startDateStr} to ${endDateStr}`);
      allFailures.push(`Activity date ${actDateStr} is outside bonus date range (${startDateStr} to ${endDateStr})`);
    } else {
      debugLog(() => `   ✓ Activity date within range`);
    }

    // Step 3.5: Check day of week - need Date object for this
    const activityDate = new Date(actDateStr + 'T00:00:00');
    const dayOfWeek = activityDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    const dayColumns = ['apply_sunday', 'apply_monday', 'apply_tuesday', 'apply_wednesday', 
                        'apply_thursday', 'apply_friday', 'apply_saturday'];
    const dayColumn = dayColumns[dayOfWeek];
    
    if (!bonus[dayColumn]) {
      debugLog(() => `   ❌ FAIL: Activity is on ${dayName} but bonus does not apply on this day`);
      allFailures.push(`Activity is on ${dayName} but bonus only applies on selected days`);
    } else {
      debugLog(() => `   ✓ Day of week matches (${dayName})`);
    }

    // Step 4: Load rule criteria (if rule_id exists)
    if (!bonus.rule_id) {
      debugLog(() => `   ✓ No criteria defined`);
      // Check if there were any header failures
      if (allFailures.length > 0) {
        return res.json({
          pass: false,
          reason: allFailures.join('\n        ')
        });
      }
      return res.json({ pass: true });
    }

    debugLog(() => `   → Evaluating criteria for rule_id: ${bonus.rule_id}`);

    // Use shared criteria evaluation function
    const criteriaResult = await evaluateCriteria(
      bonus.rule_id,
      activityData,
      activityData.member_link || null,
      tenantId,
      activityData.activity_date
    );

    if (!criteriaResult.pass) {
      allFailures.push(...criteriaResult.failures);
    }

    // Final result
    if (allFailures.length > 0) {
      const formattedFailures = allFailures.map((f, index) => {
        return index === 0 ? f : `        ${f}`;
      });
      return res.json({
        pass: false,
        reason: formattedFailures.join('\n')
      });
    }

    // Step 6: All checks passed!
    debugLog(() => `   ✅ PASS: All criteria passed!`);
    
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
async function checkPromotionQualification(activityLink, activityDate, promotionCode, memberLink, testMode = false) {
  debugLog(() => `\n🎯 Checking promotion qualification: ${promotionCode}`);
  debugLog(() => `   Activity Link: ${activityLink}, Member Link: ${memberLink}`);
  debugLog(() => `   Activity Date: ${activityDate}`);
  debugLog(() => `   Test Mode: ${testMode ? 'YES (full validation)' : 'NO (fail-fast)'}`);

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
      debugLog(() => `   ❌ Promotion not found: ${promotionCode}`);
      return { pass: false, reason: `Promotion '${promotionCode}' not found` };
    }

    const promotion = promotionResult.rows[0];
    debugLog(() => `   ✓ Promotion found: ${promotion.promotion_name}`);
    
    const isRestricted = promotion.enrollment_type === 'R';

    // Step 2: Check if promotion is active
    if (!promotion.is_active) {
      debugLog(() => `   ❌ SKIP - Promotion is not active`);
      const failureMsg = 'Promotion is not active';
      
      if (testMode) {
        failures.push(failureMsg);
      } else {
        return { pass: false, reason: failureMsg };
      }
    } else {
      debugLog(() => `   ✅ PASS - Promotion is active`);
    }

    // Step 3: Check date range (string comparison)
    const actDateStr = toDateStr(activityDate);
    const startDateStr = toDateStr(promotion.start_date);
    const endDateStr = toDateStr(promotion.end_date);

    const isInDateRange = actDateStr >= startDateStr && actDateStr <= endDateStr;

    if (!isInDateRange) {
      debugLog(() => `   ❌ SKIP - Activity date outside promotion range`);
      const failureMsg = `Activity date ${actDateStr} is outside promotion range (${startDateStr} to ${endDateStr})`;
      
      if (testMode) {
        failures.push(failureMsg);
      } else {
        return { pass: false, reason: failureMsg };
      }
    } else {
      debugLog(() => `   ✅ PASS - Activity date within range`);
    }

    // Step 4: Check if member is enrolled (for restricted promotions)
    if (isRestricted) {
      debugLog(() => `   → Checking enrollment for restricted promotion...`);
      const enrollmentQuery = `
        SELECT member_promotion_id
        FROM member_promotion
        WHERE p_link = $1 AND promotion_id = $2
      `;
      const enrollmentResult = await dbClient.query(enrollmentQuery, [memberLink, promotion.promotion_id]);
      
      if (enrollmentResult.rows.length === 0) {
        debugLog(() => `   ❌ SKIP - Member not enrolled in restricted promotion`);
        const failureMsg = 'Member not enrolled in this promotion';
        
        if (testMode) {
          failures.push(failureMsg);
        } else {
          return { pass: false, reason: failureMsg };
        }
      } else {
        debugLog(() => `   ✅ PASS - Member is enrolled`);
      }
    } else {
      debugLog(() => `   ✓ Promotion is not restricted`);
    }

    // Step 5: Check rule criteria (if rule_id exists)
    if (!promotion.rule_id) {
      debugLog(() => `   ✓ No criteria defined`);
      
      // Check if we had any header failures
      if (testMode && failures.length > 0) {
        return { pass: false, reason: failures.join('; ') };
      }
      
      if (failures.length > 0) {
        return { pass: false, reason: failures.join('; ') };
      }
      
      return { pass: true, promotion_id: promotion.promotion_id };
    }

    debugLog(() => `   → Checking criteria for rule_id: ${promotion.rule_id}`);

    // Get tenant_id from member
    const memberQuery = `SELECT tenant_id FROM member WHERE link = $1`;
    const memberResult = await dbClient.query(memberQuery, [memberLink]);
    const tenantId = memberResult.rows[0]?.tenant_id || 1;
    
    debugLog(() => `   → Tenant ID: ${tenantId}`);

    // Get activity data from new storage tables
    const activityData = await getAllActivityMolecules(null, tenantId, activityLink);
    activityData.activity_date = activityDate;
    
    debugLog(() => `   → Activity data:`, activityData);

    // Load criteria for this rule
    const criteriaQuery = `
      SELECT criteria_id, molecule_key, operator, value, label, joiner
      FROM rule_criteria
      WHERE rule_id = $1
      ORDER BY sort_order
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [promotion.rule_id]);
    
    debugLog(() => `   → Found ${criteriaResult.rows.length} criteria to check`);

    if (criteriaResult.rows.length === 0) {
      debugLog(() => `   ⚠️  SKIP - Rule has no criteria defined`);
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

      debugLog(() => `\n   Evaluating: ${criterion.label}`);
      debugLog(() => `   → Molecule: ${criterion.molecule_key}`);
      debugLog(() => `   → Operator: ${criterion.operator}`);

      // Get molecule definition
      const molDefQuery = `
        SELECT value_kind, scalar_type, lookup_table_key
        FROM molecule_def
        WHERE molecule_key = $1
      `;
      const molDefResult = await dbClient.query(molDefQuery, [criterion.molecule_key]);

      if (molDefResult.rows.length === 0) {
        debugLog(() => `   ⚠️  Molecule not found: ${criterion.molecule_key}`);
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

      debugLog(() => `   → Expected: ${JSON.stringify(criterionValue)}`);
      debugLog(() => `   → Activity has: ${JSON.stringify(activityValue)}`);

      let criterionPassed = false;

      if (isLookupMolecule(moleculeDef)) {
        // LOOKUP TYPE: compare codes
        if (activityValue === criterionValue) {
          debugLog(() => `   ✅ Criterion passed`);
          criterionPassed = true;
          hasAnyPass = true;
        } else {
          debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
          const failureMsg = `${criterion.label} - Failed (expected: ${criterionValue}, got: ${activityValue})`;
          
          if (testMode) {
            failures.push(failureMsg);
          } else {
            // Fail-fast in production mode
            return { pass: false, reason: failureMsg };
          }
        }
      } else if (isScalarMolecule(moleculeDef)) {
        // SCALAR TYPE: direct comparison
        if (criterion.operator === 'equals' || criterion.operator === '=') {
          if (activityValue === criterionValue) {
            debugLog(() => `   ✅ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          } else {
            debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
            const failureMsg = `${criterion.label} - Failed (not equal to ${criterionValue})`;
            
            if (testMode) {
              failures.push(failureMsg);
            } else {
              return { pass: false, reason: failureMsg };
            }
          }
        } else if (criterion.operator === 'greater_than' || criterion.operator === '>') {
          if (activityValue > criterionValue) {
            debugLog(() => `   ✅ Criterion passed`);
            criterionPassed = true;
            hasAnyPass = true;
          } else {
            debugLog(() => `   ❌ Criterion failed: ${criterion.label}`);
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
        debugLog(() => `\n   ❌ FINAL RESULT: FAIL (OR logic - no criteria passed)`);
        return { 
          pass: false, 
          reason: failures.length > 0 ? failures.join('; ') : 'No criteria matched (OR logic)' 
        };
      }
    } else {
      // AND logic: all criteria must pass (no failures)
      if (failures.length > 0) {
        debugLog(() => `\n   ❌ FINAL RESULT: FAIL (AND logic - some criteria failed)`);
        return { pass: false, reason: failures.join('; ') };
      }
    }

    debugLog(() => `\n   ✅ FINAL RESULT: PASS`);
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
async function evaluatePromotions(activityId, activityDate, memberLink, tenantId, activityLink = null) {
  if (!dbClient) {
    debugLog(() => 'No database connection - skipping promotion evaluation');
    return [];
  }

  try {
    debugLog(() => `\n🎯 PROMOTION ENGINE: Evaluating promotions for activity ${activityId}`);
    debugLog(() => `   Member Link: ${memberLink}, Activity Date: ${activityDate}`);

    if (!memberLink) {
      debugLog(() => `   ❌ No memberLink provided`);
      return [];
    }

    // USE CACHE for active promotions
    let activePromotions = caches.promotions.get(tenantId) || [];
    if (activePromotions.length === 0 && !caches.initialized) {
      // Fallback to DB if cache not ready
      const promotionQuery = `
        SELECT promotion_id, promotion_code, promotion_name, enrollment_type,
               count_type, counter_molecule_id, goal_amount, reward_type,
               reward_amount, reward_tier_id, reward_promotion_id
        FROM promotion WHERE is_active = true ORDER BY promotion_code
      `;
      const promotionResult = await dbClient.query(promotionQuery);
      activePromotions = promotionResult.rows;
    }

    debugLog(() => `   Found ${activePromotions.length} ACTIVE promotions to evaluate`);

    const updatedPromotions = [];

    // Get activity details once for all promotions using new storage tables
    const activityData = await getAllActivityMolecules(activityId, tenantId, activityLink);
    activityData.activity_date = activityDate;
    
    // Get activity_type (and link if not provided)
    let activityType;
    if (activityLink) {
      const actTypeResult = await dbClient.query('SELECT activity_type FROM activity WHERE link = $1', [activityLink]);
      activityType = actTypeResult.rows[0]?.activity_type || 'A';
    } else {
      const actTypeResult = await dbClient.query('SELECT activity_type, link FROM activity WHERE activity_id = $1', [activityId]);
      activityType = actTypeResult.rows[0]?.activity_type || 'A';
      activityLink = actTypeResult.rows[0]?.link;
    }
    activityData.activity_type = activityType;

    // Walk through each active promotion
    for (const promotion of activePromotions) {
      debugLog(() => `\n   → Checking promotion: ${promotion.promotion_code}`);
      
      // Check date range (string comparison)
      const actDateStr = toDateStr(activityDate);
      const startDateStr = toDateStr(promotion.start_date);
      const endDateStr = promotion.end_date ? toDateStr(promotion.end_date) : null;
      
      if (actDateStr < startDateStr || (endDateStr && actDateStr > endDateStr)) {
        debugLog(() => `      ❌ SKIP - Date outside range`);
        continue;
      }

      // Check enrollment for restricted promotions
      if (promotion.enrollment_type === 'R') {
        const enrollCheck = await dbClient.query(
          'SELECT 1 FROM member_promotion WHERE p_link = $1 AND promotion_id = $2',
          [memberLink, promotion.promotion_id]
        );
        if (enrollCheck.rows.length === 0) {
          debugLog(() => `      ❌ SKIP - Not enrolled`);
          continue;
        }
      }

      // Check rule criteria using cache
      if (promotion.rule_id) {
        const criteria = caches.ruleCriteria.get(promotion.rule_id) || [];
        if (criteria.length > 0) {
          const failures = [];
          let hasAnyPass = false;
          let hasOrJoiner = false;

          for (const criterion of criteria) {
            if (criterion.joiner === 'OR') hasOrJoiner = true;
            
            const molDef = caches.moleculeDef.get(`${tenantId}:${criterion.molecule_key}`);
            const valueKind = molDef?.value_kind || 'scalar';
            const activityValue = activityData[criterion.molecule_key];
            const criterionValue = criterion.value;
            let criterionPassed = false;

            if (valueKind === 'reference') {
              const refContext = { member_link: memberLink };
              const resolvedValue = await getMoleculeValue(tenantId, criterion.molecule_key, refContext, activityDate);
              criterionPassed = (criterion.operator === 'equals' || criterion.operator === '=') 
                ? (resolvedValue === criterionValue)
                : String(resolvedValue || '').toLowerCase().includes(String(criterionValue || '').toLowerCase());
            } else {
              criterionPassed = (criterion.operator === 'equals' || criterion.operator === '=')
                ? (activityValue === criterionValue)
                : String(activityValue || '').toLowerCase().includes(String(criterionValue || '').toLowerCase());
            }

            if (criterionPassed) hasAnyPass = true;
            else failures.push(criterion.label || criterion.molecule_key);
          }

          const criteriaPassed = hasOrJoiner ? hasAnyPass : (failures.length === 0);
          if (!criteriaPassed) {
            debugLog(() => `      ❌ SKIP - Criteria failed`);
            continue;
          }
        }
      }

      debugLog(() => `      ✅ PASS - Activity qualifies!`);

      // Activity qualifies - update member progress
      try {
        // Find or create member_promotion record
        const memberPromotionQuery = `
          SELECT member_promotion_id, progress_counter, goal_amount, qualify_date
          FROM member_promotion
          WHERE p_link = $1 AND promotion_id = $2
        `;
        const memberPromotionResult = await dbClient.query(memberPromotionQuery, [memberLink, promotion.promotion_id]);

        let memberPromotion;
        let isNewEnrollment = false;

        if (memberPromotionResult.rows.length === 0) {
          // Create new member_promotion record
          debugLog(() => `      → Creating new member_promotion record`);
          
          const insertQuery = `
            INSERT INTO member_promotion (
              p_link, 
              promotion_id,
              tenant_id, 
              enrolled_date, 
              progress_counter, 
              goal_amount
            )
            VALUES ($1, $2, $3, CURRENT_DATE, 0, $4)
            RETURNING member_promotion_id, progress_counter, goal_amount, qualify_date
          `;
          const insertResult = await dbClient.query(insertQuery, [memberLink, promotion.promotion_id, tenantId, promotion.goal_amount]);
          memberPromotion = insertResult.rows[0];
          isNewEnrollment = true;
          
          // Record enrollment stat
          await recordPromotionEnrolled(promotion.promotion_id, tenantId, activityDate);
        } else {
          memberPromotion = memberPromotionResult.rows[0];
          
          // Check if already qualified
          if (memberPromotion.qualify_date) {
            debugLog(() => `      ⚠️  SKIP - Member already qualified on ${memberPromotion.qualify_date}`);
            continue;  // Just skip this promotion, don't rollback the transaction!
          }
        }

        // Determine increment amount based on count_type
        let incrementAmount = 0;
        if (promotion.count_type === 'flights') {
          // Only count flights (activity_type = 'A')
          if (activityData.activity_type === 'A') {
            incrementAmount = 1;
          } else {
            debugLog(() => `      ⏭️  SKIP - Not a flight (activity_type=${activityData.activity_type})`);
            continue; // Skip this promotion for non-flight activities
          }
        } else if (promotion.count_type === 'miles') {
          // Get points from member_points molecule
          incrementAmount = await getActivityPoints(activityId, tenantId, activityLink);
        } else if (promotion.count_type === 'molecules' && promotion.counter_molecule_id) {
          // Molecule-based counting - get value from new storage tables
          const moleculeId = promotion.counter_molecule_id;
          const moleculeValue = await getActivityMoleculeValueById(activityId, moleculeId, activityLink);
          if (moleculeValue !== null) {
            incrementAmount = Number(moleculeValue);
          }
          debugLog(() => `      → Molecule ${moleculeId} value: ${incrementAmount}`);
        }

        debugLog(() => `      → Increment: ${incrementAmount} (count_type: ${promotion.count_type})`);

        // Update progress counter (convert to number to avoid string concatenation)
        const currentProgress = Number(memberPromotion.progress_counter);
        const newProgress = currentProgress + incrementAmount;
        debugLog(() => `      → Progress: ${currentProgress} + ${incrementAmount} = ${newProgress} / ${memberPromotion.goal_amount}`);

        const updateQuery = `
          UPDATE member_promotion
          SET progress_counter = $1
          WHERE member_promotion_id = $2
        `;
        await dbClient.query(updateQuery, [newProgress, memberPromotion.member_promotion_id]);

        // Track this activity's contribution to the promotion
        const detailInsert = `
          INSERT INTO member_promotion_detail (member_promotion_id, activity_link, contribution_amount)
          VALUES ($1, $2, $3)
        `;
        await dbClient.query(detailInsert, [memberPromotion.member_promotion_id, activityLink, incrementAmount]);
        debugLog(() => `      ✓ Logged contribution: activity ${activityId} contributed ${incrementAmount} to promotion`);

        // Check if goal reached (convert to numbers for proper comparison)
        const goalAmount = Number(memberPromotion.goal_amount);
        if (newProgress >= goalAmount) {
          debugLog(() => `      🎉 GOAL REACHED! Qualifying member...`);
          
          const qualifyQuery = `
            UPDATE member_promotion
            SET qualify_date = CURRENT_DATE
            WHERE member_promotion_id = $1
          `;
          await dbClient.query(qualifyQuery, [memberPromotion.member_promotion_id]);

          // Record qualification stat (points = reward_amount if points reward, else 0)
          const qualifyPoints = (promotion.reward_type === 'points' && promotion.reward_amount > 0) 
            ? Number(promotion.reward_amount) : 0;
          await recordPromotionQualified(promotion.promotion_id, qualifyPoints, tenantId, activityDate);

          // Award reward
          debugLog(() => `      → Reward: ${promotion.reward_type} (amount: ${promotion.reward_amount})`);
          
          if (promotion.reward_type === 'points' && promotion.reward_amount > 0) {
            const rewardPoints = Number(promotion.reward_amount);
            
            // Add points to molecule bucket (handles expiration automatically)
            const bucketResult = await addPointsToMoleculeBucket(memberLink, activityDate, rewardPoints, tenantId);
            
            // Create promotion reward activity (memberLink already available from top of function)
            const activityInsert = await insertActivity(tenantId, memberLink, activityDate, 'M');
            const rewardActivityLink = activityInsert.link;
            
            // Get molecule IDs for linking
            const memberPromotionMoleculeId = await getMoleculeId(tenantId, 'member_promotion');
            const promotionMoleculeId = await getMoleculeId(tenantId, 'promotion');

            // Link activity to member_promotion (enrollment instance)
            await insertActivityMolecule(null, memberPromotionMoleculeId, memberPromotion.member_promotion_id, null, rewardActivityLink);

            // Link activity to promotion (for code and description)
            await insertActivityMolecule(null, promotionMoleculeId, promotion.promotion_id, null, rewardActivityLink);
            
            // Save member_points molecule linking activity to bucket (uses new "5_data_54")
            await saveActivityPoints(null, bucketResult.bucket_link, rewardPoints, tenantId, rewardActivityLink);
            
            debugLog(() => `      ✅ Created promotion reward activity ${rewardActivityLink}: ${rewardPoints} points, bucket ${bucketResult.bucket_link}, expires ${bucketResult.expire_date}`);
          }
          
          // CARRYOVER LOGIC: Handle repeatable promotions
          // If promotion allows repeats and activity exceeded goal, carry overflow to new instance
          const overflow = newProgress - goalAmount;
          const canRepeat = promotion.process_limit_count === null || promotion.process_limit_count > 1;
          
          if (overflow > 0 && canRepeat) {
            debugLog(() => `      🔄 CARRYOVER: Activity exceeded goal by ${overflow}, creating new enrollment instance...`);
            
            // Check if promotion has repeats remaining (if limited)
            if (promotion.process_limit_count !== null) {
              // Count how many times member has qualified
              const countQuery = `
                SELECT COUNT(*) as completion_count
                FROM member_promotion
                WHERE p_link = $1 AND promotion_id = $2 AND qualify_date IS NOT NULL
              `;
              const countResult = await dbClient.query(countQuery, [memberLink, promotion.promotion_id]);
              const completionCount = Number(countResult.rows[0].completion_count);
              
              if (completionCount >= promotion.process_limit_count) {
                debugLog(() => `      ⚠️  CARRYOVER SKIPPED: Member reached process_limit_count (${promotion.process_limit_count})`);
                continue;
              }
            }
            
            // Create new enrollment instance with overflow as starting progress
            const newEnrollmentQuery = `
              INSERT INTO member_promotion (
                p_link, 
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
              memberLink, 
              promotion.promotion_id, 
              tenantId, 
              overflow,  // Start new instance with overflow amount
              promotion.goal_amount
            ]);
            const newMemberPromotionId = newEnrollmentResult.rows[0].member_promotion_id;
            
            // Create SECOND member_promotion_detail record for same activity
            // This activity contributes to BOTH the completed instance AND the new instance
            await dbClient.query(detailInsert, [newMemberPromotionId, activityId, overflow]);
            
            debugLog(() => `      ✓ Created new enrollment instance ${newMemberPromotionId} with ${overflow} starting progress`);
            debugLog(() => `      ✓ Activity ${activityId} now contributes to TWO instances of this promotion`);
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

    debugLog(() => `\n   ✅ Promotion evaluation complete - updated ${updatedPromotions.length} promotions`);
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
    const tenantId = req.body.tenant_id || 1;
    const activityLink = req.body.activity_link;
    const activityDate = req.body.activity_date;
    const memberIdentifier = req.body.membership_number || req.body.member_id || req.body.memberId;

    if (!activityLink) {
      return res.status(400).json({ error: 'activity_link is required' });
    }
    
    if (!memberIdentifier) {
      return res.status(400).json({ error: 'membership_number is required' });
    }

    // Resolve to memberLink via membership_number
    const memberRec = await resolveMember(memberIdentifier, tenantId);
    if (!memberRec || !memberRec.link) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;

    debugLog(() => `\n🧪 UI Testing promotion: ${promotionCode} for activity ${activityLink}`);

    // Use the black box with testMode=true to get ALL failures
    const result = await checkPromotionQualification(activityLink, activityDate, promotionCode, memberLink, true);

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


// POST /v1/test-promotion-rule/:promotionCode - Test promotion with sample activity data (no real activity needed)
// Mirrors the test-rule endpoint for bonuses
app.post('/v1/test-promotion-rule/:promotionCode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const promotionCode = req.params.promotionCode;
    const activityData = req.body;
    const tenantId = req.body.tenant_id || 1;
    
    // Resolve membership_number to link (UI passes membership_number as member_id)
    const memberIdentifier = req.body.member_id || null;
    let memberLink = null;
    if (memberIdentifier) {
      const memberRec = await resolveMember(memberIdentifier, tenantId);
      if (memberRec) {
        memberLink = memberRec.link;
      }
    }

    debugLog(() => `\n🧪 Testing promotion rule: ${promotionCode}`);
    debugLog(() => `   Activity data: ${JSON.stringify(activityData)}`);
    debugLog(() => `   Tenant ID: ${tenantId}`);
    debugLog(() => `   Member Link: ${memberLink}`);

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
      debugLog(() => `   ❌ Promotion not found: ${promotionCode}`);
      return res.status(404).json({ 
        error: `Promotion '${promotionCode}' not found` 
      });
    }

    const promotion = promotionResult.rows[0];
    debugLog(() => `   ✓ Promotion found: ${promotion.promotion_name}`);

    // Collect all failures
    const allFailures = [];

    // Step 2: Check if promotion is active
    if (!promotion.is_active) {
      debugLog(() => `   ❌ FAIL: Promotion is not active`);
      allFailures.push('Promotion is not active');
    } else {
      debugLog(() => `   ✓ Promotion is active`);
    }

    // Step 3: Check date range (string comparison)
    const actDateStr = toDateStr(activityData.activity_date);
    const startDateStr = toDateStr(promotion.start_date);
    const endDateStr = toDateStr(promotion.end_date);

    if (actDateStr < startDateStr || actDateStr > endDateStr) {
      debugLog(() => `   ❌ FAIL: Activity date ${actDateStr} outside range ${startDateStr} to ${endDateStr}`);
      allFailures.push(`Activity date ${actDateStr} is outside promotion range (${startDateStr} to ${endDateStr})`);
    } else {
      debugLog(() => `   ✓ Activity date within range`);
    }

    // Step 4: Check enrollment for restricted promotions
    const isRestricted = promotion.enrollment_type === 'R';
    if (isRestricted) {
      debugLog(() => `   → Promotion is RESTRICTED (enrollment required)`);
      
      if (!memberLink) {
        debugLog(() => `   ❌ FAIL: No member provided for restricted promotion check`);
        allFailures.push('Member not provided for restricted promotion enrollment check');
      } else {
        const enrollmentQuery = `
          SELECT member_promotion_id, qualify_date
          FROM member_promotion
          WHERE p_link = $1 AND promotion_id = $2
        `;
        const enrollmentResult = await dbClient.query(enrollmentQuery, [memberLink, promotion.promotion_id]);
        
        if (enrollmentResult.rows.length === 0) {
          debugLog(() => `   ❌ FAIL: Member not enrolled in restricted promotion`);
          allFailures.push('Member not enrolled in this restricted promotion');
        } else {
          const enrollment = enrollmentResult.rows[0];
          debugLog(() => `   ✓ Member is enrolled`);
          
          // Also check if already qualified
          if (enrollment.qualify_date) {
            debugLog(() => `   ⚠️  Member already qualified on ${enrollment.qualify_date}`);
            allFailures.push(`Member already qualified for this promotion on ${enrollment.qualify_date}`);
          }
        }
      }
    } else {
      debugLog(() => `   ✓ Promotion is auto-enroll (not restricted)`);
    }

    // Step 5: Check rule criteria (if rule_id exists)
    if (!promotion.rule_id) {
      debugLog(() => `   ✓ No criteria defined`);
      
      if (allFailures.length > 0) {
        return res.json({
          pass: false,
          reason: allFailures.join('\n        ')
        });
      }
      return res.json({ pass: true });
    }

    debugLog(() => `   → Evaluating criteria for rule_id: ${promotion.rule_id}`);

    // Use shared criteria evaluation function
    const criteriaResult = await evaluateCriteria(
      promotion.rule_id,
      activityData,
      memberLink,
      tenantId,
      activityData.activity_date
    );

    if (!criteriaResult.pass) {
      allFailures.push(...criteriaResult.failures);
    }

    // Final result
    if (allFailures.length > 0) {
      const formattedFailures = allFailures.map((f, index) => {
        return index === 0 ? f : `        ${f}`;
      });
      return res.json({
        pass: false,
        reason: formattedFailures.join('\n')
      });
    }

    // All checks passed!
    debugLog(() => `   ✅ PASS: All criteria passed!`);
    
    return res.json({
      pass: true
    });

  } catch (error) {
    console.error('Error in test-promotion-rule endpoint:', error);
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

// GET - Bonus statistics with date range
app.get('/v1/bonus-stats', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND bs.stat_date >= date_to_molecule_int($2::date) AND bs.stat_date <= date_to_molecule_int($3::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND bs.stat_date >= date_to_molecule_int($2::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND bs.stat_date <= date_to_molecule_int($2::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        b.bonus_id,
        b.bonus_code,
        b.bonus_description,
        b.bonus_type,
        b.bonus_amount,
        b.is_active,
        COALESCE(SUM(bs.issued_count), 0)::integer as total_issued,
        COALESCE(SUM(bs.points_total), 0)::bigint as total_points
      FROM bonus b
      LEFT JOIN bonus_stats bs ON b.bonus_id = bs.bonus_id 
        AND bs.tenant_id = $1 ${dateFilter}
      WHERE b.tenant_id = $1
      GROUP BY b.bonus_id, b.bonus_code, b.bonus_description, 
               b.bonus_type, b.bonus_amount, b.is_active
      ORDER BY total_issued DESC, b.bonus_code
    `;

    const result = await dbClient.query(query, params);
    
    // Calculate totals
    let grandTotalIssued = 0;
    let grandTotalPoints = 0;
    for (const row of result.rows) {
      grandTotalIssued += parseInt(row.total_issued) || 0;
      grandTotalPoints += parseInt(row.total_points) || 0;
    }

    res.json({
      bonuses: result.rows,
      summary: {
        total_bonuses: result.rows.length,
        total_issued: grandTotalIssued,
        total_points: grandTotalPoints
      },
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching bonus stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Single bonus statistics with date range
app.get('/v1/bonus-stats/:bonusId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { bonusId } = req.params;
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Get currency label for this tenant
    const currencyLabel = await getSysparmByKey(tenant_id, 'currency_label') || 'Miles';

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [bonusId, tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date) AND stat_date <= date_to_molecule_int($4::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND stat_date <= date_to_molecule_int($3::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        COALESCE(SUM(issued_count), 0)::integer as issued_count,
        COALESCE(SUM(points_total), 0)::bigint as points_total
      FROM bonus_stats
      WHERE bonus_id = $1 AND tenant_id = $2 ${dateFilter}
    `;

    const result = await dbClient.query(query, params);
    
    res.json({
      bonus_id: parseInt(bonusId),
      issued_count: result.rows[0].issued_count,
      points_total: result.rows[0].points_total,
      currency_label: currencyLabel,
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching single bonus stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// REDEMPTION STATISTICS ENDPOINTS
// =============================================================================

// GET - All redemption statistics with date range
app.get('/v1/redemption-stats', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND rs.stat_date >= date_to_molecule_int($2::date) AND rs.stat_date <= date_to_molecule_int($3::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND rs.stat_date >= date_to_molecule_int($2::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND rs.stat_date <= date_to_molecule_int($2::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        r.redemption_id,
        r.redemption_code,
        r.redemption_description,
        r.redemption_type,
        r.points_required,
        r.status,
        COALESCE(SUM(rs.redeemed_count), 0)::integer as total_redeemed,
        COALESCE(SUM(rs.points_total), 0)::bigint as total_points
      FROM redemption_rule r
      LEFT JOIN redemption_stats rs ON r.redemption_id = rs.redemption_id 
        AND rs.tenant_id = $1 ${dateFilter}
      WHERE r.tenant_id = $1
      GROUP BY r.redemption_id, r.redemption_code, r.redemption_description, 
               r.redemption_type, r.points_required, r.status
      ORDER BY total_redeemed DESC, r.redemption_code
    `;

    const result = await dbClient.query(query, params);
    
    // Calculate totals
    let grandTotalRedeemed = 0;
    let grandTotalPoints = 0;
    for (const row of result.rows) {
      grandTotalRedeemed += parseInt(row.total_redeemed) || 0;
      grandTotalPoints += parseInt(row.total_points) || 0;
    }

    res.json({
      redemptions: result.rows,
      summary: {
        total_redemptions: result.rows.length,
        total_redeemed: grandTotalRedeemed,
        total_points: grandTotalPoints
      },
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching redemption stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Single redemption statistics with date range
app.get('/v1/redemption-stats/:redemptionId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { redemptionId } = req.params;
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [redemptionId, tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date) AND stat_date <= date_to_molecule_int($4::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND stat_date <= date_to_molecule_int($3::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        COALESCE(SUM(redeemed_count), 0)::integer as redeemed_count,
        COALESCE(SUM(points_total), 0)::bigint as points_total
      FROM redemption_stats
      WHERE redemption_id = $1 AND tenant_id = $2 ${dateFilter}
    `;

    const result = await dbClient.query(query, params);
    
    res.json({
      redemption_id: parseInt(redemptionId),
      redeemed_count: result.rows[0].redeemed_count,
      points_total: result.rows[0].points_total,
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching single redemption stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PROMOTION STATISTICS ENDPOINTS
// =============================================================================

// GET - All promotion statistics with date range
app.get('/v1/promotion-stats', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND ps.stat_date >= date_to_molecule_int($2::date) AND ps.stat_date <= date_to_molecule_int($3::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND ps.stat_date >= date_to_molecule_int($2::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND ps.stat_date <= date_to_molecule_int($2::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        p.promotion_id,
        p.promotion_code,
        p.promotion_name,
        p.enrollment_type,
        p.count_type,
        p.goal_amount,
        p.reward_type,
        p.is_active,
        COALESCE(SUM(ps.enrolled_count), 0)::integer as total_enrolled,
        COALESCE(SUM(ps.qualified_count), 0)::integer as total_qualified,
        COALESCE(SUM(ps.points_total), 0)::bigint as total_points
      FROM promotion p
      LEFT JOIN promotion_stats ps ON p.promotion_id = ps.promotion_id 
        AND ps.tenant_id = $1 ${dateFilter}
      WHERE p.tenant_id = $1
      GROUP BY p.promotion_id, p.promotion_code, p.promotion_name, 
               p.enrollment_type, p.count_type, p.goal_amount, p.reward_type, p.is_active
      ORDER BY total_enrolled DESC, p.promotion_code
    `;

    const result = await dbClient.query(query, params);
    
    // Calculate totals
    let grandTotalEnrolled = 0;
    let grandTotalQualified = 0;
    let grandTotalPoints = 0;
    for (const row of result.rows) {
      grandTotalEnrolled += parseInt(row.total_enrolled) || 0;
      grandTotalQualified += parseInt(row.total_qualified) || 0;
      grandTotalPoints += parseInt(row.total_points) || 0;
    }

    res.json({
      promotions: result.rows,
      summary: {
        total_promotions: result.rows.length,
        total_enrolled: grandTotalEnrolled,
        total_qualified: grandTotalQualified,
        total_points: grandTotalPoints
      },
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching promotion stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Single promotion statistics with date range
app.get('/v1/promotion-stats/:promotionId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const { promotionId } = req.params;
    const { tenant_id, from_date, to_date } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Build query with date range filter (using SMALLINT dates)
    let dateFilter = '';
    const params = [promotionId, tenant_id];
    
    if (from_date && to_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date) AND stat_date <= date_to_molecule_int($4::date)';
      params.push(from_date, to_date);
    } else if (from_date) {
      dateFilter = 'AND stat_date >= date_to_molecule_int($3::date)';
      params.push(from_date);
    } else if (to_date) {
      dateFilter = 'AND stat_date <= date_to_molecule_int($3::date)';
      params.push(to_date);
    }

    const query = `
      SELECT 
        COALESCE(SUM(enrolled_count), 0)::integer as enrolled_count,
        COALESCE(SUM(qualified_count), 0)::integer as qualified_count,
        COALESCE(SUM(points_total), 0)::bigint as points_total
      FROM promotion_stats
      WHERE promotion_id = $1 AND tenant_id = $2 ${dateFilter}
    `;

    const result = await dbClient.query(query, params);
    
    res.json({
      promotion_id: parseInt(promotionId),
      enrolled_count: result.rows[0].enrolled_count,
      qualified_count: result.rows[0].qualified_count,
      points_total: result.rows[0].points_total,
      filters: {
        from_date: from_date || null,
        to_date: to_date || null
      }
    });

  } catch (error) {
    console.error('Error fetching single promotion stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update bonus
app.post('/v1/bonuses', async (req, res) => {
  debugLog('=== POST /v1/bonuses called ===');
  debugLog(() => `Request body: ${JSON.stringify(req.body, null, 2)}`);
  
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
    debugLog(() => `Extracted values: ${JSON.stringify({ 
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
    })}`);
    
    // Validation
    if (!bonus_code || !bonus_description || !bonus_type || !bonus_amount || !start_date) {
      debugLog('Validation failed - missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!tenant_id) {
      debugLog('Validation failed - missing tenant_id');
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    debugLog('Validation passed, checking if bonus exists...');
    
    // Check if bonus already exists
    const checkQuery = 'SELECT bonus_id FROM bonus WHERE bonus_code = $1';
    const existing = await dbClient.query(checkQuery, [bonus_code]);
    debugLog(() => `Existing bonus check result: ${existing.rows.length > 0 ? 'FOUND - will UPDATE' : 'NOT FOUND - will INSERT'}`);
    
    if (existing.rows.length > 0) {
      // UPDATE existing bonus
      debugLog(() => `Updating existing bonus: ${bonus_code}`);
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
      debugLog(() => `Update params: ${JSON.stringify(updateParams)}`);
      const result = await dbClient.query(updateQuery, updateParams);
      debugLog(() => `Update successful, rows returned: ${result.rows.length}`);
      await loadCaches(); // Refresh cache
      res.json({ message: 'Bonus updated', bonus: result.rows[0] });
    } else {
      // INSERT new bonus
      debugLog(() => `Inserting new bonus: ${bonus_code}`);
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
      debugLog(() => `Insert params: ${JSON.stringify(insertParams)}`);
      const result = await dbClient.query(insertQuery, insertParams);
      debugLog(() => `Insert successful, rows returned: ${result.rows.length}`);
      debugLog(() => `New bonus: ${JSON.stringify(result.rows[0])}`);
      await loadCaches(); // Refresh cache
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
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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

// ============ POINT EXPIRATION RULES CRUD ============

// GET - List all expiration rules
app.get('/v1/expiration-rules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const tenant_id = req.query.tenant_id;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    const query = `
      SELECT rule_id, rule_key, start_date, end_date, expiration_date, description
      FROM point_expiration_rule
      WHERE tenant_id = $1
      ORDER BY start_date DESC
    `;
    const result = await dbClient.query(query, [tenant_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expiration rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get single expiration rule by rule_key
app.get('/v1/expiration-rules/:rule_key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { rule_key } = req.params;
    const tenant_id = req.query.tenant_id;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    const query = `
      SELECT rule_id, rule_key, start_date, end_date, expiration_date, description
      FROM point_expiration_rule
      WHERE rule_key = $1 AND tenant_id = $2
    `;
    const result = await dbClient.query(query, [rule_key, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expiration rule not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expiration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new expiration rule
app.post('/v1/expiration-rules', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { rule_key, start_date, end_date, expiration_date, description, tenant_id } = req.body;
    
    // Validation
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    if (!rule_key || !start_date || !end_date || !expiration_date) {
      return res.status(400).json({ error: 'Missing required fields: rule_key, start_date, end_date, expiration_date' });
    }
    
    // Check for duplicate rule_key within tenant
    const checkQuery = 'SELECT rule_key FROM point_expiration_rule WHERE rule_key = $1 AND tenant_id = $2';
    const existing = await dbClient.query(checkQuery, [rule_key, tenant_id]);
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Rule key already exists' });
    }
    
    const query = `
      INSERT INTO point_expiration_rule (rule_key, start_date, end_date, expiration_date, description, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await dbClient.query(query, [rule_key, start_date, end_date, expiration_date, description || null, tenant_id]);
    
    // Refresh cache
    await loadCaches();
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expiration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update expiration rule
app.put('/v1/expiration-rules/:rule_key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { rule_key } = req.params;
    const { start_date, end_date, expiration_date, description, tenant_id } = req.body;
    
    // Validation
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    if (!start_date || !end_date || !expiration_date) {
      return res.status(400).json({ error: 'Missing required fields: start_date, end_date, expiration_date' });
    }
    
    const query = `
      UPDATE point_expiration_rule 
      SET start_date = $1, end_date = $2, expiration_date = $3, description = $4
      WHERE rule_key = $5 AND tenant_id = $6
      RETURNING *
    `;
    const result = await dbClient.query(query, [start_date, end_date, expiration_date, description || null, rule_key, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expiration rule not found' });
    }
    
    // Refresh cache
    await loadCaches();
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expiration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete expiration rule
app.delete('/v1/expiration-rules/:rule_key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { rule_key } = req.params;
    const tenant_id = req.query.tenant_id;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    const query = 'DELETE FROM point_expiration_rule WHERE rule_key = $1 AND tenant_id = $2 RETURNING *';
    const result = await dbClient.query(query, [rule_key, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expiration rule not found' });
    }
    
    // Refresh cache
    await loadCaches();
    
    res.json({ message: 'Expiration rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting expiration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update tier
app.post('/v1/tiers', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected - cannot save tiers' });
  }
  
  try {
    const { tier_code, tier_description, tier_ranking, is_active, badge_color, text_color, icon } = req.body;
    const tenantId = req.query.tenant_id || req.body.tenant_id;
    
    // Validation
    if (!tier_code || !tier_description || !tier_ranking) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    // Check if tier already exists for this tenant
    const checkQuery = 'SELECT tier_id FROM tier_definition WHERE tier_code = $1 AND tenant_id = $2';
    const existing = await dbClient.query(checkQuery, [tier_code, tenantId]);
    
    if (existing.rows.length > 0) {
      // UPDATE existing tier
      const updateQuery = `
        UPDATE tier_definition 
        SET tier_description = $1,
            tier_ranking = $2,
            is_active = $3,
            badge_color = $4,
            text_color = $5,
            icon = $6
        WHERE tier_code = $7 AND tenant_id = $8
        RETURNING *
      `;
      const result = await dbClient.query(updateQuery, [
        tier_description,
        tier_ranking,
        is_active !== false,
        badge_color || '#6b7280',
        text_color || '#ffffff',
        icon || null,
        tier_code,
        tenantId
      ]);
      res.json({ message: 'Tier updated', tier: result.rows[0] });
    } else {
      // INSERT new tier
      const insertQuery = `
        INSERT INTO tier_definition (tier_code, tier_description, tier_ranking, is_active, tenant_id, badge_color, text_color, icon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await dbClient.query(insertQuery, [
        tier_code,
        tier_description,
        tier_ranking,
        is_active !== false,
        tenantId,
        badge_color || '#6b7280',
        text_color || '#ffffff',
        icon || null
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
      await loadCaches(); // Refresh cache
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
      await loadCaches(); // Refresh cache
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
    await loadCaches(); // Refresh cache
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
        can_be_promotion_counter,
        list_context,
        system_required,
        input_type,
        molecule_type,
        value_structure
      FROM molecule_def
      WHERE tenant_id = $1 AND is_active = true
    `;
    
    const params = [tenant_id];
    
    // Optional context filter
    if (context) {
      query += ' AND LOWER(context) = LOWER($2)';
      params.push(context);
    }
    
    query += ' ORDER BY molecule_key';
    
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
    
    debugLog(() => `Fetching molecules for context: ${source}, tenant: ${tenantId}`);
    
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
    
    debugLog(() => `Found ${result.rows.length} molecules for context ${source}`);
    
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

  // 1. Look up molecule definition - USE CACHE
  const cacheKey = `${tenantId}:${moleculeKey}`;
  let mol = caches.moleculeDef.get(cacheKey);
  
  if (!mol) {
    // Debug: log cache miss
    if (caches.initialized) {
      debugLog(() => `⚠️ Cache MISS for ${cacheKey} (cache has ${caches.moleculeDef.size} entries)`);
    }
    // Fallback to DB if not in cache
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
    mol = molResult.rows[0];
  }
  
  // 2. Handle based on value_kind
  
  // LOOKUP - Use cached metadata and lookup tables
  if (isLookupMolecule(mol)) {
    // Get metadata from cache
    let metadata = caches.moleculeValueLookup.get(mol.molecule_id);
    
    if (!metadata) {
      // Fallback to DB
      const metadataQuery = `
        SELECT table_name, id_column, code_column, is_tenant_specific
        FROM molecule_value_lookup
        WHERE molecule_id = $1
      `;
      const metadataResult = await dbClient.query(metadataQuery, [mol.molecule_id]);
      if (metadataResult.rows.length === 0) {
        throw new Error(`No lookup metadata found for molecule '${moleculeKey}'`);
      }
      metadata = metadataResult.rows[0];
    }
    
    // Try cached lookup tables first
    if (metadata.table_name === 'airports') {
      const airport = caches.airports.get(value);
      if (airport) return airport.airport_id;
    } else if (metadata.table_name === 'carriers') {
      const carrierKey = metadata.is_tenant_specific ? `${tenantId}:${value}` : value;
      const carrier = caches.carriers.get(carrierKey);
      if (carrier) return carrier.carrier_id;
    }
    
    // Fallback to DB for uncached lookup tables
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
  
  // LIST - Use cached molecule_value_text
  if (isListMolecule(mol)) {
    const textValues = caches.moleculeValueText.get(mol.molecule_id);
    if (textValues) {
      const match = textValues.find(tv => tv.text_value === value);
      if (match) return match.value_id;
    }
    
    // Fallback to DB
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
  
  // SCALAR - Handle by scalar_type (these can't be cached - they're dynamic values)
  if (isScalarMolecule(mol)) {
    
    // SCALAR TEXT - Check if direct or indexed
    if (mol.scalar_type === 'text' || mol.scalar_type === 'text_direct') {
      
      // DIRECT TEXT (scalar_type = 'text_direct') - no deduplication, just insert
      if (mol.scalar_type === 'text_direct') {
        const insertQuery = `
          INSERT INTO molecule_text (text_value)
          VALUES ($1)
          RETURNING text_id
        `;
        const insertResult = await dbClient.query(insertQuery, [value]);
        return insertResult.rows[0].text_id;
      }
      
      // INDEXED TEXT - Use text pool with deduplication
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
  
  // Safety check for bad legacy data
  const numericId = Number(id);
  if (!id || isNaN(numericId) || !Number.isFinite(numericId)) {
    console.warn(`⚠️  Bad v_ref_id value "${id}" found for molecule ${moleculeKey} - skipping decode`);
    return `[${moleculeKey}]`;
  }

  // 1. Look up molecule definition - USE CACHE
  const cacheKey = `${tenantId}:${moleculeKey}`;
  let mol = caches.moleculeDef.get(cacheKey);
  
  if (!mol) {
    // Fallback to DB
    debugLog(() => `⚠️ decodeMolecule MISS for ${cacheKey}`);
    const molQuery = `
      SELECT molecule_id, value_kind, scalar_type, lookup_table_key, decimal_places
      FROM molecule_def WHERE tenant_id = $1 AND molecule_key = $2
    `;
    const molResult = await dbClient.query(molQuery, [tenantId, moleculeKey]);
    if (molResult.rows.length === 0) {
      throw new Error(`Molecule '${moleculeKey}' not found for tenant ${tenantId}`);
    }
    mol = molResult.rows[0];
  }
  
  // EMBEDDED_LIST - still needs DB query (complex category/code lookup)
  if (mol.value_kind === 'embedded_list') {
    const category = columnOrCategory;
    if (!category) {
      throw new Error(`Category required for embedded_list molecule '${moleculeKey}'`);
    }
    const embeddedQuery = `
      SELECT code, description FROM molecule_value_embedded_list
      WHERE molecule_id = $1 AND tenant_id = $2 AND category = $3 AND link = $4 AND is_active = true
    `;
    const embeddedResult = await dbClient.query(embeddedQuery, [mol.molecule_id, tenantId, category, id]);
    if (embeddedResult.rows.length === 0) {
      throw new Error(`Link '${id}' not found in category '${category}' for molecule '${moleculeKey}'`);
    }
    return embeddedResult.rows[0].description;
  }
  
  // LOOKUP - USE CACHE for metadata and lookup tables
  if (isLookupMolecule(mol)) {
    // Get metadata from cache
    let metadata = caches.moleculeValueLookup.get(mol.molecule_id);
    if (!metadata) {
      const metadataQuery = `
        SELECT table_name, id_column, code_column, is_tenant_specific
        FROM molecule_value_lookup WHERE molecule_id = $1
      `;
      const metadataResult = await dbClient.query(metadataQuery, [mol.molecule_id]);
      if (metadataResult.rows.length === 0) {
        throw new Error(`No lookup metadata found for molecule '${moleculeKey}'`);
      }
      metadata = metadataResult.rows[0];
    }
    
    const returnColumn = columnOrCategory || metadata.code_column;
    
    // Try cached lookup by ID
    if (metadata.table_name === 'airports' && returnColumn === 'code') {
      const airport = caches.airportsById.get(numericId);
      if (airport) return airport.code;
    } else if (metadata.table_name === 'carriers' && returnColumn === 'code') {
      const carrier = caches.carriersById.get(numericId);
      if (carrier) return carrier.code;
    }
    
    // Fallback to DB for uncached tables or columns
    let lookupQuery, queryParams;
    if (metadata.is_tenant_specific) {
      lookupQuery = `SELECT ${returnColumn} as value FROM ${metadata.table_name} WHERE ${metadata.id_column} = $1 AND tenant_id = $2`;
      queryParams = [numericId, tenantId];
    } else {
      lookupQuery = `SELECT ${returnColumn} as value FROM ${metadata.table_name} WHERE ${metadata.id_column} = $1`;
      queryParams = [numericId];
    }
    const lookupResult = await dbClient.query(lookupQuery, queryParams);
    if (lookupResult.rows.length === 0) {
      throw new Error(`ID ${numericId} not found in ${metadata.table_name}`);
    }
    return lookupResult.rows[0].value;
  }
  
  // LIST - USE CACHE
  if (isListMolecule(mol)) {
    const textValues = caches.moleculeValueText.get(mol.molecule_id);
    let match;
    if (textValues) {
      match = textValues.find(tv => tv.value_id === numericId);
    }
    if (!match) {
      // Fallback to DB
      const listQuery = `SELECT text_value, display_label FROM molecule_value_text WHERE molecule_id = $1 AND value_id = $2`;
      const listResult = await dbClient.query(listQuery, [mol.molecule_id, numericId]);
      if (listResult.rows.length === 0) {
        throw new Error(`Value ID ${numericId} not found in list for molecule '${moleculeKey}'`);
      }
      match = listResult.rows[0];
    }
    
    // Support columnOrCategory parameter for format: 'code', 'description', 'both'
    const format = columnOrCategory || 'code';
    if (format === 'description' || format === 'label') {
      return match.display_label || match.text_value;
    } else if (format === 'both') {
      if (match.display_label) {
        return `${match.text_value} - ${match.display_label}`;
      }
      return match.text_value;
    }
    return match.text_value;
  }
  
  // SCALAR - Handle by scalar_type (can't cache dynamic text pool)
  if (isScalarMolecule(mol)) {
    if (mol.scalar_type === 'text' || mol.scalar_type === 'text_direct') {
      // DIRECT TEXT (scalar_type = 'text_direct') - read from molecule_text
      if (mol.scalar_type === 'text_direct') {
        const textQuery = `SELECT text_value FROM molecule_text WHERE text_id = $1`;
        const textResult = await dbClient.query(textQuery, [numericId]);
        if (textResult.rows.length === 0) {
          throw new Error(`Text ID ${numericId} not found in molecule_text`);
        }
        return textResult.rows[0].text_value;
      }
      
      // INDEXED TEXT - read from text pool
      const textQuery = `SELECT text_value FROM molecule_text_pool WHERE text_id = $1`;
      const textResult = await dbClient.query(textQuery, [numericId]);
      if (textResult.rows.length === 0) {
        throw new Error(`Text ID ${numericId} not found in text pool`);
      }
      return textResult.rows[0].text_value;
    }
    if (mol.scalar_type === 'numeric') {
      return numericId;
    }
    if (mol.scalar_type === 'date') {
      throw new Error(`Date decoding not yet implemented for molecule '${moleculeKey}'`);
    }
    if (mol.scalar_type === 'boolean') {
      throw new Error(`Boolean decoding not yet implemented for molecule '${moleculeKey}'`);
    }
    if (mol.scalar_type === 'char') {
      // Link/char molecules - just return the numeric value as-is (already unsquished by caller)
      return numericId;
    }
    throw new Error(`Unknown scalar_type '${mol.scalar_type}' for molecule '${moleculeKey}'`);
  }
  
  // DYNAMIC_LIST - Multi-row molecules, skip decode (handled separately by getActivityMoleculeRows)
  if (mol.value_kind === 'dynamic_list') {
    return null; // Not decodable via simple decode - use getActivityMoleculeRows instead
  }
  
  throw new Error(`Unknown value_kind '${mol.value_kind}' for molecule '${moleculeKey}'`);
}

/**
 * BACKWARD COMPATIBILITY WRAPPER
 * Get a single molecule value from an activity
 * Calls getActivityMoleculeRows and returns first row's primary value
 * @param {number} activityId - The activity ID
 * @param {string} moleculeKey - The molecule key
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<any>} The molecule value (first row, first defined column)
 */
async function getActivityMoleculeValue(activityId, moleculeKey, tenantId) {
  const rows = await getActivityMoleculeRows(activityId, moleculeKey, tenantId);
  if (rows.length === 0) return null;
  
  // Return first non-row_num field from first row
  const row = rows[0];
  const keys = Object.keys(row).filter(k => k !== 'row_num');
  return keys.length > 0 ? row[keys[0]] : null;
}

/**
 * BACKWARD COMPATIBILITY WRAPPER
 * Get a single molecule value from a member
 * Calls getMemberMoleculeRows and returns first row's primary value
 * @param {number} memberId - The member ID
 * @param {string} moleculeKey - The molecule key
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<any>} The molecule value (first row, first defined column)
 */
async function getMemberMoleculeValue(memberId, moleculeKey, tenantId) {
  const rows = await getMemberMoleculeRows(memberId, moleculeKey, tenantId);
  if (rows.length === 0) return null;
  
  // Return first non-row_num field from first row
  const row = rows[0];
  const keys = Object.keys(row).filter(k => k !== 'row_num');
  return keys.length > 0 ? row[keys[0]] : null;
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
        attaches_to,
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
        can_be_promotion_counter,
        list_context,
        system_required,
        input_type,
        molecule_type,
        value_structure,
        storage_size,
        value_type
      FROM molecule_def
      WHERE molecule_id = $1
    `;
    
    const result = await dbClient.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    // Fetch column definitions
    const colResult = await dbClient.query(
      `SELECT column_name, column_type, column_order, description
       FROM molecule_column_def
       WHERE molecule_id = $1
       ORDER BY column_order`,
      [id]
    );
    
    const molecule = result.rows[0];
    molecule.column_definitions = colResult.rows;
    
    res.json(molecule);
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
      attaches_to,
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
      list_context,
      system_required,
      column_definitions,
      input_type,
      tenant_id,
      molecule_type,
      value_structure,
      storage_size,
      value_type
    } = req.body;
    
    // Validate required fields
    if (!molecule_key || !label || !context || !tenant_id) {
      return res.status(400).json({ error: 'Missing required fields: molecule_key, label, context, tenant_id' });
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
        attaches_to,
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
        list_context,
        system_required,
        tenant_id,
        input_type,
        molecule_type,
        value_structure,
        storage_size,
        value_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *
    `;
    
    const result = await dbClient.query(insertQuery, [
      molecule_key,
      label,
      context,
      attaches_to || null,
      value_kind || null,
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
      list_context || null,
      system_required || false,
      tenant_id,
      input_type || 'P',
      molecule_type || 'D',
      value_structure || 'single',
      storage_size || null,
      value_type || null
    ]);
    
    const newMoleculeId = result.rows[0].molecule_id;
    
    // If this is an embedded molecule with column definitions, save them
    if (value_structure === 'embedded' && column_definitions && column_definitions.length > 0) {
      for (const col of column_definitions) {
        await dbClient.query(`
          INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
          VALUES ($1, $2, $3, $4, $5)
        `, [newMoleculeId, col.column_name, col.column_type, col.column_order, col.description || null]);
      }
    }
    
    await loadCaches(); // Refresh cache
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
      attaches_to,
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
      can_be_promotion_counter,
      list_context,
      system_required,
      column_definitions,
      input_type,
      molecule_type,
      value_structure,
      storage_size,
      value_type
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
    
    if (attaches_to !== undefined) {
      updates.push(`attaches_to = $${paramCount++}`);
      values.push(attaches_to);
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
    
    if (molecule_type !== undefined) {
      updates.push(`molecule_type = $${paramCount++}`);
      values.push(molecule_type);
    }
    
    if (value_structure !== undefined) {
      updates.push(`value_structure = $${paramCount++}`);
      values.push(value_structure);
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
    
    if (list_context !== undefined) {
      updates.push(`list_context = $${paramCount++}`);
      values.push(list_context);
    }
    
    if (system_required !== undefined) {
      updates.push(`system_required = $${paramCount++}`);
      values.push(system_required);
    }
    
    if (input_type !== undefined) {
      updates.push(`input_type = $${paramCount++}`);
      values.push(input_type);
    }
    
    if (storage_size !== undefined) {
      updates.push(`storage_size = $${paramCount++}`);
      values.push(storage_size);
    }
    
    if (value_type !== undefined) {
      updates.push(`value_type = $${paramCount++}`);
      values.push(value_type);
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
    
    // If column definitions provided, update them (delete and re-insert)
    if (column_definitions !== undefined) {
      await dbClient.query('DELETE FROM molecule_column_def WHERE molecule_id = $1', [id]);
      
      if (column_definitions && column_definitions.length > 0) {
        for (const col of column_definitions) {
          await dbClient.query(`
            INSERT INTO molecule_column_def (molecule_id, column_name, column_type, column_order, description)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, col.column_name, col.column_type, col.column_order, col.description || null]);
        }
      }
    }
    
    await loadCaches(); // Refresh cache
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
    
    // Support both molecule_id (numeric) and molecule_key (string)
    const isNumericId = /^\d+$/.test(id);
    const defQuery = isNumericId
      ? `SELECT molecule_id, molecule_key, value_kind, scalar_type, is_static
         FROM molecule_def WHERE molecule_id = $1 AND tenant_id = $2`
      : `SELECT molecule_id, molecule_key, value_kind, scalar_type, is_static
         FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2`;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const molecule = defResult.rows[0];
    
    if (!molecule.is_static) {
      return res.status(400).json({ error: 'Only static molecules have stored values' });
    }
    
    if (!isScalarMolecule(molecule)) {
      return res.status(400).json({ error: 'Use /values endpoint for list molecules' });
    }
    
    // Get the value from the appropriate table using molecule_id (not the input id which might be a key)
    // Note: value tables don't have tenant_id - tenant isolation is via molecule_def
    const moleculeId = molecule.molecule_id;
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
    
    const valueResult = await dbClient.query(valueQuery, [moleculeId]);
    
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
    
    // Support both molecule_id (numeric) and molecule_key (string)
    const isNumericId = /^\d+$/.test(id);
    const defQuery = isNumericId
      ? `SELECT molecule_id, molecule_key, value_kind, scalar_type, is_static
         FROM molecule_def WHERE molecule_id = $1 AND tenant_id = $2`
      : `SELECT molecule_id, molecule_key, value_kind, scalar_type, is_static
         FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2`;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const molecule = defResult.rows[0];
    
    if (!molecule.is_static) {
      return res.status(400).json({ error: 'Only static molecules have stored values' });
    }
    
    if (!isScalarMolecule(molecule)) {
      return res.status(400).json({ error: 'Use /values endpoint for list molecules' });
    }
    
    // Update the value in the appropriate table using molecule_id
    // Note: value tables don't have tenant_id - tenant isolation is via molecule_def
    const moleculeId = molecule.molecule_id;
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
    const checkResult = await dbClient.query(checkQuery, [moleculeId]);
    
    if (checkResult.rows.length === 0) {
      // Insert new value
      await dbClient.query(insertQuery, [moleculeId, value]);
    } else {
      // Update existing value
      await dbClient.query(updateQuery, [moleculeId, value]);
    }
    
    // Note: Not reloading all caches - scalar settings don't need cache refresh
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
    
    const vkind = defResult.rows[0].value_kind;
    if (vkind !== 'list' && vkind !== 'internal_list') {
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

// GET - Get list values by molecule key (for stress testing and lookups)
app.get('/v1/molecules/values/:key', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { key } = req.params;
    const tenantId = parseInt(req.query.tenant_id) || 1;
    
    // Get molecule_id by key
    const defResult = await dbClient.query(`
      SELECT molecule_id, value_kind
      FROM molecule_def
      WHERE molecule_key = $1 AND tenant_id = $2
    `, [key, tenantId]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: `Molecule '${key}' not found` });
    }
    
    const { molecule_id, value_kind } = defResult.rows[0];
    
    if (value_kind !== 'list' && value_kind !== 'internal_list') {
      return res.status(400).json({ error: 'This endpoint is only for list molecules' });
    }
    
    // Get the list values
    const result = await dbClient.query(`
      SELECT text_value as value, display_label as label, sort_order
      FROM molecule_value_text
      WHERE molecule_id = $1
      ORDER BY sort_order, text_value
    `, [molecule_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching list values by key:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get column definitions for a dynamic_list molecule
app.get('/v1/molecules/:id/column-definitions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        column_def_id,
        column_name,
        column_type,
        column_order,
        description
      FROM molecule_column_def
      WHERE molecule_id = $1
      ORDER BY column_order
    `;
    
    const result = await dbClient.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching column definitions:', error);
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
    
    if (!tenant_id || tenant_id === 'null' || tenant_id === 'undefined') {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // First verify this is a lookup molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, parseInt(tenant_id)]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const vk = defResult.rows[0].value_kind;
    if (vk !== 'lookup' && vk !== 'external_list') {
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
    const { tenant_id, table_name, id_column, code_column, label_column, is_tenant_specific, maintenance_page } = req.body;
    
    if (!tenant_id || tenant_id === 'null' || tenant_id === 'undefined') {
      return res.status(400).json({ error: 'tenant_id required' });
    }
    
    // Validate required fields for lookup config
    if (!table_name || !id_column || !code_column || !label_column) {
      return res.status(400).json({ error: 'table_name, id_column, code_column, and label_column are required' });
    }
    
    // First verify this is a lookup molecule
    const defQuery = `
      SELECT value_kind
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, parseInt(tenant_id)]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const vk = defResult.rows[0].value_kind;
    if (vk !== 'lookup' && vk !== 'external_list') {
      return res.status(400).json({ error: 'This endpoint is only for lookup molecules' });
    }
    
    // Check if lookup config exists
    const existsQuery = `SELECT lookup_id FROM molecule_value_lookup WHERE molecule_id = $1`;
    const existsResult = await dbClient.query(existsQuery, [id]);
    
    let result;
    if (existsResult.rows.length > 0) {
      // Update existing config
      const updateQuery = `
        UPDATE molecule_value_lookup
        SET table_name = $1,
            id_column = $2,
            code_column = $3,
            label_column = $4,
            is_tenant_specific = $5,
            maintenance_page = $6
        WHERE molecule_id = $7
        RETURNING *
      `;
      result = await dbClient.query(updateQuery, [
        table_name, id_column, code_column, label_column, 
        is_tenant_specific ?? true, maintenance_page || null, id
      ]);
    } else {
      // Insert new config
      const insertQuery = `
        INSERT INTO molecule_value_lookup 
          (molecule_id, table_name, id_column, code_column, label_column, is_tenant_specific, maintenance_page)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      result = await dbClient.query(insertQuery, [
        id, table_name, id_column, code_column, label_column, 
        is_tenant_specific ?? true, maintenance_page || null
      ]);
    }
    
    await loadCaches(); // Refresh cache
    res.json({ 
      success: true,
      message: existsResult.rows.length > 0 ? 'Lookup configuration updated' : 'Lookup configuration created',
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
    if (config.value_kind !== 'lookup' && config.value_kind !== 'external_list') {
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
    
    debugLog(() => `[lookup-values] Loading ${molecule_key} from ${config.table_name}`);
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
    
    const vkind = defResult.rows[0].value_kind;
    if (vkind !== 'list' && vkind !== 'internal_list') {
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
    
    await loadCaches(); // Refresh cache
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
    
    const vkind = defResult.rows[0].value_kind;
    if (vkind !== 'list' && vkind !== 'internal_list') {
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
    
    await loadCaches(); // Refresh cache
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
    
    const vkind = defResult.rows[0].value_kind;
    if (vkind !== 'list' && vkind !== 'internal_list') {
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
    
    await loadCaches(); // Refresh cache
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
      SELECT value_kind, value_structure
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const mol = defResult.rows[0];
    if (mol.value_kind !== 'embedded_list' && mol.value_structure !== 'embedded') {
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
      SELECT value_kind, value_structure
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const mol = defResult.rows[0];
    if (mol.value_kind !== 'embedded_list' && mol.value_structure !== 'embedded') {
      return res.status(400).json({ error: 'This endpoint is only for embedded_list molecules' });
    }
    
    // Get values for the category
    const valueQuery = `
      SELECT 
        embedded_value_id,
        link,
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
      SELECT value_kind, value_structure
      FROM molecule_def
      WHERE molecule_id = $1 AND tenant_id = $2
    `;
    const defResult = await dbClient.query(defQuery, [id, tenant_id]);
    
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    
    const mol = defResult.rows[0];
    if (mol.value_kind !== 'embedded_list' && mol.value_structure !== 'embedded') {
      return res.status(400).json({ error: 'This endpoint is only for embedded_list molecules' });
    }
    
    // Find unused link value (chr(1) through chr(127))
    const usedLinksQuery = `
      SELECT link FROM molecule_value_embedded_list 
      WHERE molecule_id = $1 AND tenant_id = $2 AND category = $3
    `;
    const usedLinksResult = await dbClient.query(usedLinksQuery, [id, tenant_id, category]);
    const usedLinks = new Set(usedLinksResult.rows.map(r => r.link));
    
    let link = null;
    for (let i = 1; i <= 127; i++) {
      const candidate = String.fromCharCode(i);
      if (!usedLinks.has(candidate)) {
        link = candidate;
        break;
      }
    }
    
    if (!link) {
      const errorMsg = await getErrorMessage('E006', tenant_id);
      return res.status(400).json({ error: errorMsg || 'E006: Maximum values (127) reached for this category' });
    }
    
    // Insert the value
    const insertQuery = `
      INSERT INTO molecule_value_embedded_list (
        molecule_id, 
        tenant_id, 
        category, 
        link,
        code, 
        description, 
        sort_order,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *
    `;
    
    const result = await dbClient.query(insertQuery, [
      id,
      tenant_id,
      category,
      link,
      code,
      description,
      sort_order || 10
    ]);
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
    
    await loadCaches(); // Refresh cache
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
 * @returns {Promise<Object>} The created bonus activity (type N) with calculated points
 */
async function applyBonusToActivity(activityId, bonusId, bonusCode, bonusType, bonusAmount, basePoints, activityLink = null) {
  if (!dbClient) {
    throw new Error('Database not connected');
  }

  try {
    debugLog(() => `\n💰 APPLYING BONUS: ${bonusCode} to activity ${activityId}`);
    
    // 1. Calculate bonus points based on type
    let bonusPoints = 0;
    if (bonusType === 'percent') {
      bonusPoints = Math.floor(basePoints * (bonusAmount / 100));
      debugLog(() => `   → Calculating: ${basePoints} × ${bonusAmount}% = ${bonusPoints} points`);
    } else if (bonusType === 'fixed') {
      bonusPoints = bonusAmount;
      debugLog(() => `   → Fixed bonus: ${bonusPoints} points`);
    }

    // 2. Get parent activity info (p_link, tenant_id, activity_date, link)
    let parentActivityLink, member_link, activity_date, tenant_id;
    if (activityLink) {
      const parentQuery = `
        SELECT a.p_link, a.activity_date, m.tenant_id, a.link as activity_link
        FROM activity a
        JOIN member m ON a.p_link = m.link
        WHERE a.link = $1
      `;
      const parentResult = await dbClient.query(parentQuery, [activityLink]);
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent activity not found`);
      }
      hydrateActivityDates(parentResult.rows);
      ({ p_link: member_link, activity_date, tenant_id, activity_link: parentActivityLink } = parentResult.rows[0]);
    } else {
      const parentQuery = `
        SELECT a.p_link, a.activity_date, m.tenant_id, a.link as activity_link
        FROM activity a
        JOIN member m ON a.p_link = m.link
        WHERE a.activity_id = $1
      `;
      const parentResult = await dbClient.query(parentQuery, [activityId]);
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent activity ${activityId} not found`);
      }
      hydrateActivityDates(parentResult.rows);
      ({ p_link: member_link, activity_date, tenant_id, activity_link: parentActivityLink } = parentResult.rows[0]);
    }
    debugLog(() => `   → Parent activity: member_link=${member_link}, date=${activity_date}`);

    // 3. Add bonus points to molecule bucket
    let bucketResult = null;
    if (bonusPoints > 0) {
      bucketResult = await addPointsToMoleculeBucket(member_link, activity_date, bonusPoints, tenant_id);
      debugLog(() => `   💰 Added ${bonusPoints} bonus points to bucket ${bucketResult.bucket_link}`);
    }

    // 4. Create type 'N' bonus activity
    const bonusActivityInsert = await insertActivity(tenant_id, member_link, activity_date, 'N');
    const bonusActivityLink = bonusActivityInsert.link;
    debugLog(() => `   ✨ Created bonus activity ${bonusActivityLink}: ${bonusPoints} points (type N)`);

    // 5. Add bonus_rule_id molecule to the bonus activity
    const bonusRuleMoleculeId = await getMoleculeId(tenant_id, 'bonus_rule_id');
    await insertActivityMolecule(null, bonusRuleMoleculeId, bonusId, null, bonusActivityLink);
    debugLog(() => `   → Added bonus_rule_id=${bonusId} to bonus activity`);

    // 6. Add bonus_activity_link molecule to the parent activity (pointer to child)
    const bonusActivityLinkMoleculeId = await getMoleculeId(tenant_id, 'bonus_activity_link');
    await insertActivityMolecule(null, bonusActivityLinkMoleculeId, bonusActivityLink, null, parentActivityLink);
    debugLog(() => `   → Added bonus_activity_link=${bonusActivityLink} to parent activity`);

    // 7. Save member_points molecule linking bonus activity to bucket (uses new "5_data_54")
    if (bucketResult) {
      await saveActivityPoints(null, bucketResult.bucket_link, bonusPoints, tenant_id, bonusActivityLink);
      debugLog(() => `   → Added member_points molecule (bucket: ${bucketResult.bucket_link}, amount: ${bonusPoints})`);
    }

    // 8. Record bonus statistics
    await recordBonusIssued(bonusId, bonusPoints, tenant_id, activity_date);
    debugLog(() => `   📊 Recorded bonus stats: bonus_id=${bonusId}, points=${bonusPoints}`);

    debugLog(() => `   ✅ Bonus application complete!\n`);
    
    return {
      bonus_activity_link: bonusActivityLink,
      bonus_points: bonusPoints,
      bonus_code: bonusCode
    };

  } catch (error) {
    console.error(`Error applying bonus ${bonusCode}:`, error);
    throw error;
  }
}

/**
 * Record bonus issuance statistics
 * Upserts a row in bonus_stats for the activity date, incrementing counters
 * @param {number} bonusId - The bonus ID
 * @param {number} points - Points awarded
 * @param {number} tenantId - Tenant ID
 * @param {Date|string} activityDate - The activity date
 */
async function recordBonusIssued(bonusId, points, tenantId, activityDate) {
  try {
    // Convert to date string if needed
    const dateStr = activityDate instanceof Date 
      ? activityDate.toISOString().split('T')[0] 
      : String(activityDate).split('T')[0];
    
    await dbClient.query(`
      INSERT INTO bonus_stats (bonus_id, tenant_id, stat_date, issued_count, points_total)
      VALUES ($1, $2, date_to_molecule_int($4::date), 1, $3)
      ON CONFLICT (bonus_id, tenant_id, stat_date)
      DO UPDATE SET 
        issued_count = bonus_stats.issued_count + 1,
        points_total = bonus_stats.points_total + $3
    `, [bonusId, tenantId, points, dateStr]);
  } catch (error) {
    // Log but don't fail the bonus - stats are nice-to-have
    console.error('Error recording bonus stats:', error.message);
  }
}

/**
 * Record redemption statistics
 * Upserts a row in redemption_stats for the activity date, incrementing counters
 * @param {number} redemptionId - The redemption rule ID
 * @param {number} points - Points redeemed (positive number)
 * @param {number} tenantId - Tenant ID
 * @param {Date|string} activityDate - The activity date
 */
async function recordRedemptionRedeemed(redemptionId, points, tenantId, activityDate) {
  try {
    // Convert to date string if needed
    const dateStr = activityDate instanceof Date 
      ? activityDate.toISOString().split('T')[0] 
      : String(activityDate).split('T')[0];
    
    await dbClient.query(`
      INSERT INTO redemption_stats (redemption_id, tenant_id, stat_date, redeemed_count, points_total)
      VALUES ($1, $2, date_to_molecule_int($4::date), 1, $3)
      ON CONFLICT (redemption_id, tenant_id, stat_date)
      DO UPDATE SET 
        redeemed_count = redemption_stats.redeemed_count + 1,
        points_total = redemption_stats.points_total + $3
    `, [redemptionId, tenantId, points, dateStr]);
  } catch (error) {
    // Log but don't fail the redemption - stats are nice-to-have
    console.error('Error recording redemption stats:', error.message);
  }
}

/**
 * Record promotion enrollment statistics
 * Upserts a row in promotion_stats for the date, incrementing enrolled_count
 * @param {number} promotionId - The promotion ID
 * @param {number} tenantId - Tenant ID
 * @param {Date|string} eventDate - The date of enrollment
 */
async function recordPromotionEnrolled(promotionId, tenantId, eventDate) {
  try {
    const dateStr = eventDate instanceof Date 
      ? eventDate.toISOString().split('T')[0] 
      : String(eventDate).split('T')[0];
    
    await dbClient.query(`
      INSERT INTO promotion_stats (promotion_id, tenant_id, stat_date, enrolled_count, qualified_count, points_total)
      VALUES ($1, $2, date_to_molecule_int($3::date), 1, 0, 0)
      ON CONFLICT (promotion_id, tenant_id, stat_date)
      DO UPDATE SET 
        enrolled_count = promotion_stats.enrolled_count + 1
    `, [promotionId, tenantId, dateStr]);
  } catch (error) {
    console.error('Error recording promotion enrolled:', error.message);
  }
}

/**
 * Record promotion qualification statistics
 * Upserts a row in promotion_stats for the date, incrementing qualified_count and points_total
 * @param {number} promotionId - The promotion ID
 * @param {number} points - Points awarded (0 if non-points reward)
 * @param {number} tenantId - Tenant ID
 * @param {Date|string} eventDate - The date of qualification
 */
async function recordPromotionQualified(promotionId, points, tenantId, eventDate) {
  try {
    const dateStr = eventDate instanceof Date 
      ? eventDate.toISOString().split('T')[0] 
      : String(eventDate).split('T')[0];
    
    await dbClient.query(`
      INSERT INTO promotion_stats (promotion_id, tenant_id, stat_date, enrolled_count, qualified_count, points_total)
      VALUES ($1, $2, date_to_molecule_int($4::date), 0, 1, $3)
      ON CONFLICT (promotion_id, tenant_id, stat_date)
      DO UPDATE SET 
        qualified_count = promotion_stats.qualified_count + 1,
        points_total = promotion_stats.points_total + $3
    `, [promotionId, tenantId, points, dateStr]);
  } catch (error) {
    console.error('Error recording promotion qualified:', error.message);
  }
}

/**
 * Evaluates all active bonuses for a given activity and creates type 'N' bonus activities
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
async function evaluateBonuses(activityId, activityDate, basePoints, testMode = false, activityLink = null) {
  if (!dbClient) {
    debugLog(() => 'No database connection - skipping bonus evaluation');
    return testMode ? { bonuses: [], validationResults: [] } : [];
  }

  try {
    debugLog(() => `\n🎁 BONUS ENGINE: Evaluating bonuses for activity ${activityId}`);
    debugLog(() => `   Activity Date: ${activityDate}, Base Points: ${basePoints}`);
    debugLog(() => `   Test Mode: ${testMode ? 'YES (full validation)' : 'NO (fail-fast)'}`);

    // Get tenant from activity
    let tenantId, memberLink;
    if (activityLink) {
      const activityInfoQuery = `
        SELECT m.link as member_link, m.tenant_id
        FROM activity a
        JOIN member m ON a.p_link = m.link
        WHERE a.link = $1
      `;
      const activityInfoResult = await dbClient.query(activityInfoQuery, [activityLink]);
      tenantId = activityInfoResult.rows[0]?.tenant_id || 1;
      memberLink = activityInfoResult.rows[0]?.member_link;
    } else {
      const activityInfoQuery = `
        SELECT m.link as member_link, m.tenant_id
        FROM activity a
        JOIN member m ON a.p_link = m.link
        WHERE a.activity_id = $1
      `;
      const activityInfoResult = await dbClient.query(activityInfoQuery, [activityId]);
      tenantId = activityInfoResult.rows[0]?.tenant_id || 1;
      memberLink = activityInfoResult.rows[0]?.member_link;
    }

    // USE CACHE for active bonuses
    let activeBonuses = caches.bonuses.get(tenantId) || [];
    if (activeBonuses.length === 0 && !caches.initialized) {
      // Fallback to DB if cache not ready
      const bonusQuery = `
        SELECT bonus_id, bonus_code, bonus_description, bonus_type, bonus_amount,
               start_date, end_date, rule_id, apply_sunday, apply_monday,
               apply_tuesday, apply_wednesday, apply_thursday, apply_friday, apply_saturday
        FROM bonus WHERE is_active = true ORDER BY bonus_code
      `;
      const bonusResult = await dbClient.query(bonusQuery);
      activeBonuses = bonusResult.rows;
    }

    debugLog(() => `   Found ${activeBonuses.length} ACTIVE bonuses to evaluate`);

    // Get activity details once using new storage tables
    const activityData = await getAllActivityMolecules(activityId, tenantId, activityLink);
    activityData.activity_date = activityDate;

    const bonuses = [];
    const validationResults = [];

    for (const bonus of activeBonuses) {
      debugLog(() => `\n   → Checking bonus: ${bonus.bonus_code}`);

      // Check date range (string comparison)
      const actDateStr = toDateStr(activityDate);
      const startDateStr = toDateStr(bonus.start_date);
      const endDateStr = bonus.end_date ? toDateStr(bonus.end_date) : null;

      const isInDateRange = actDateStr >= startDateStr && (!endDateStr || actDateStr <= endDateStr);
      const currentBonusFailures = [];

      if (!isInDateRange) {
        debugLog(() => `      ❌ SKIP - Activity date outside bonus range`);
        if (testMode) {
          currentBonusFailures.push(`Activity date outside range`);
        } else {
          continue;
        }
      }

      // Check day of week - need Date object for this
      const actDate = new Date(actDateStr + 'T00:00:00');
      const dayOfWeek = actDate.getDay();
      const dayColumns = ['apply_sunday', 'apply_monday', 'apply_tuesday', 'apply_wednesday', 
                          'apply_thursday', 'apply_friday', 'apply_saturday'];
      if (!bonus[dayColumns[dayOfWeek]]) {
        debugLog(() => `      ❌ SKIP - Day of week mismatch`);
        if (testMode) {
          currentBonusFailures.push(`Day of week mismatch`);
        } else {
          continue;
        }
      }

      // Check criteria using CACHE
      if (bonus.rule_id) {
        let criteria = caches.ruleCriteria.get(bonus.rule_id) || [];
        if (criteria.length === 0 && !caches.initialized) {
          // Fallback to DB
          const criteriaQuery = `
            SELECT rc.*, md.molecule_key, md.value_kind, md.scalar_type
            FROM rule_criteria rc
            JOIN molecule_def md ON rc.molecule_id = md.molecule_id
            WHERE rc.rule_id = $1 ORDER BY rc.sort_order
          `;
          const criteriaResult = await dbClient.query(criteriaQuery, [bonus.rule_id]);
          criteria = criteriaResult.rows;
        }

        if (criteria.length === 0) {
          if (testMode) currentBonusFailures.push('Rule has no criteria');
          else continue;
        } else {
          const failures = [];
          let hasAnyPass = false;
          let hasOrJoiner = false;

          for (const criterion of criteria) {
            if (criterion.joiner === 'OR') hasOrJoiner = true;

            const activityValue = activityData[criterion.molecule_key];
            const criterionValue = criterion.value;
            let criterionPassed = false;

            // Look up molecule definition from cache to get value_kind
            const molDef = caches.moleculeDef.get(`${tenantId}:${criterion.molecule_key}`);
            const valueKind = molDef?.value_kind || 'scalar';

            // Support both old and new value_kind names
            if (valueKind === 'lookup' || valueKind === 'external_list' || 
                valueKind === 'list' || valueKind === 'internal_list' || 
                valueKind === 'scalar' || valueKind === 'value') {
              if (criterion.operator === 'equals' || criterion.operator === '=') {
                criterionPassed = (activityValue === criterionValue);
              } else if (criterion.operator === 'contains') {
                criterionPassed = String(activityValue || '').toLowerCase().includes(String(criterionValue || '').toLowerCase());
              }
            } else if (valueKind === 'reference') {
              const refContext = { member_link: memberLink };
              const resolvedValue = await getMoleculeValue(tenantId, criterion.molecule_key, refContext, activityDate);
              if (criterion.operator === 'equals' || criterion.operator === '=') {
                criterionPassed = (resolvedValue === criterionValue);
              } else if (criterion.operator === 'contains') {
                criterionPassed = String(resolvedValue || '').toLowerCase().includes(String(criterionValue || '').toLowerCase());
              }
            }

            if (criterionPassed) hasAnyPass = true;
            else failures.push(criterion.label || criterion.molecule_key);
          }

          const criteriaPassed = hasOrJoiner ? hasAnyPass : (failures.length === 0);
          if (!criteriaPassed) {
            debugLog(() => `      ❌ SKIP - Criteria failed`);
            if (testMode) currentBonusFailures.push(...failures);
            else continue;
          }
        }
      }

      if (testMode) {
        validationResults.push({
          bonus_code: bonus.bonus_code,
          bonus_description: bonus.bonus_description,
          passed: currentBonusFailures.length === 0,
          failures: currentBonusFailures
        });
        if (currentBonusFailures.length > 0) continue;
      }

      // Apply the bonus
      const bonusResult = await applyBonusToActivity(
        null, bonus.bonus_id, bonus.bonus_code,
        bonus.bonus_type, bonus.bonus_amount, basePoints, activityLink
      );

      bonuses.push({
        bonus_code: bonus.bonus_code,
        bonus_description: bonus.bonus_description,
        bonus_points: bonusResult.bonus_points,
        bonus_activity_link: bonusResult.bonus_activity_link
      });
    }

    debugLog(() => `\n🎁 BONUS ENGINE: Complete! Awarded ${bonuses.length} bonuses\n`);
    return testMode ? { bonuses, validationResults } : bonuses;

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

async function qualifyPromotion(memberPromotionId, promotion, memberLink, tenantId, activityDate) {
  const client = await dbClient.connect();
  try {
    debugLog(() => `      → Qualifying member_promotion_id: ${memberPromotionId}`);
    
    if (!memberLink) {
      throw new Error(`memberLink is required`);
    }
    
    await client.query('BEGIN');

    // Update to qualified status
    await client.query(
      `UPDATE member_promotion 
       SET qualify_date = $1, status = 'qualified'
       WHERE member_promotion_id = $2`,
      [activityDate, memberPromotionId]
    );

    // Process reward based on reward_type
    if (promotion.reward_type === 'points') {
      debugLog(() => `      → Awarding ${promotion.reward_amount} points (activity type M)`);
      
      // Add points to molecule bucket
      const bucketResult = await addPointsToMoleculeBucket(memberLink, activityDate, promotion.reward_amount, tenantId);
      
      // Create activity type 'M'
      const activityInsert = await insertActivity(tenantId, memberLink, activityDate, 'M');
      const rewardActivityLink = activityInsert.link;

      // Link to promotion via molecule_value_list
      const promotionMoleculeId = await getMoleculeId(tenantId, 'promotion');
      await insertActivityMolecule(null, promotionMoleculeId, memberPromotionId, null, rewardActivityLink);

      // Save member_points molecule linking activity to bucket (uses new "5_data_54")
      await saveActivityPoints(null, bucketResult.bucket_link, promotion.reward_amount, tenantId, rewardActivityLink);

      // Set process_date (instant for points)
      await client.query(
        `UPDATE member_promotion 
         SET process_date = $1, status = 'processed'
         WHERE member_promotion_id = $2`,
        [activityDate, memberPromotionId]
      );

      debugLog(() => `      ✅ Points activity created: link=${rewardActivityLink}, bucket=${bucketResult.bucket_link}`);

    } else if (promotion.reward_type === 'tier') {
      debugLog(() => `      → Awarding tier: ${promotion.reward_tier_id}`);
      
      // Calculate end date for THIS tier award
      let endDate;
      if (promotion.duration_type === 'calendar') {
        endDate = promotion.duration_end_date;
      } else if (promotion.duration_type === 'virtual') {
        // Calculate virtual end date
        const endDateQuery = await client.query(
          `SELECT ($1::date + $2::integer) as end_date`,
          [activityDate, promotion.duration_days]
        );
        endDate = endDateQuery.rows[0].end_date;
      }

      // Create member_tier record (the actual tier award)
      await client.query(
        `INSERT INTO member_tier (p_link, tier_id, start_date, end_date)
         VALUES ($1, $2, $3, $4)`,
        [memberLink, promotion.reward_tier_id, activityDate, endDate]
      );
      
      debugLog(() => `      ✅ Tier awarded: tier_id=${promotion.reward_tier_id}, end_date=${endDate}`);

      // Cascade: Auto-qualify parallel tier pathways with same or shorter duration
      // This prevents duplicate tier cards/kits from being sent
      debugLog(() => `      🔄 Checking for parallel tier pathways to cascade...`);
      
      const cascadeQuery = `
        UPDATE member_promotion mp
        SET 
          qualify_date = $1,
          process_date = $1,
          status = 'processed',
          qualified_by_promotion_id = $4
        FROM promotion p
        WHERE mp.promotion_id = p.promotion_id
          AND mp.p_link = $2
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
      
      const cascadeResult = await client.query(cascadeQuery, [
        activityDate,                      // $1 - qualify_date, process_date
        memberLink,                        // $2 - p_link
        promotion.reward_tier_id,          // $3 - same tier only
        promotion.promotion_id,            // $4 - qualified_by_promotion_id
        endDate,                           // $5 - for calendar comparison
        promotion.duration_days || 0       // $6 - for virtual comparison
      ]);
      
      if (cascadeResult.rowCount > 0) {
        debugLog(() => `      ✅ Cascaded to ${cascadeResult.rowCount} parallel promotion(s)`);
        debugLog(() => `         These promotions marked qualified by promotion_id=${promotion.promotion_id}`);
        debugLog(() => `         No duplicate tier cards will be sent`);
      } else {
        debugLog(() => `      → No parallel pathways found to cascade`);
      }


    } else if (promotion.reward_type === 'enroll_promotion') {
      debugLog(() => `      → Enrolling in promotion: ${promotion.reward_promotion_id}`);
      
      // Enroll member in target promotion
      if (promotion.reward_promotion_id) {
        await client.query(
          `INSERT INTO member_promotion (
             p_link, promotion_id, tenant_id, enrolled_date,
             progress_counter, status
           )
           SELECT $1, $2, $3, $4, 0, 'enrolled'
           WHERE NOT EXISTS (
             SELECT 1 FROM member_promotion 
             WHERE p_link = $1 AND promotion_id = $2
           )`,
          [memberLink, promotion.reward_promotion_id, tenantId, activityDate]
        );

        // Set process_date
        await client.query(
          `UPDATE member_promotion 
           SET process_date = $1, status = 'processed'
           WHERE member_promotion_id = $2`,
          [activityDate, memberPromotionId]
        );

        debugLog(() => `      ✅ Enrolled in next promotion`);
      }

    } else if (promotion.reward_type === 'external') {
      debugLog(() => `      → External reward - awaiting manual fulfillment`);
      // process_date stays NULL until manual fulfillment
    }

    await client.query('COMMIT');
    debugLog(() => `      ✅ Qualification complete`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('      ❌ Error qualifying promotion:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function checkActivityAgainstRule(activityLink, ruleId, tenantId) {
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

    // Get activity data from new storage tables (decoded values)
    const activityData = await getAllActivityMolecules(null, tenantId, activityLink);

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
app.post('/v1/activities/:activityLink/evaluate-bonuses', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityLink = req.params.activityLink;

    // Get activity details
    const activityQuery = `
      SELECT a.activity_date, m.tenant_id
      FROM activity a
      JOIN member m ON a.p_link = m.link
      WHERE a.link = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityLink]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    hydrateActivityDates(activityResult.rows);
    const activity = activityResult.rows[0];
    const activityDate = activity.activity_date;
    const tenantId = activity.tenant_id;
    const basePoints = await getActivityPoints(null, tenantId, activityLink);

    // Run bonus engine
    const bonuses = await evaluateBonuses(null, activityDate, basePoints, false, activityLink);

    res.json({
      message: 'Bonus evaluation complete',
      activity_link: activityLink,
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
app.post('/v1/activities/:activityLink/evaluate-promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityLink = req.params.activityLink;

    // Get activity details including member link
    const activityQuery = `
      SELECT a.activity_date, m.link as member_link, m.membership_number, m.tenant_id
      FROM activity a
      JOIN member m ON a.p_link = m.link
      WHERE a.link = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityLink]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    hydrateActivityDates(activityResult.rows);
    const activity = activityResult.rows[0];
    const activityDate = activity.activity_date;
    const memberLink = activity.member_link;
    const membershipNumber = activity.membership_number;
    const tenantId = activity.tenant_id;

    // Run promotion engine
    const promotions = await evaluatePromotions(null, activityDate, memberLink, tenantId, activityLink);

    res.json({
      message: 'Promotion evaluation complete',
      activity_link: activityLink,
      activity_date: activityDate,
      membership_number: membershipNumber,
      promotions_updated: promotions.length,
      promotions: promotions
    });

  } catch (error) {
    console.error('Error in promotion evaluation endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST - Manually apply a bonus to an activity (CSR function)
app.post('/v1/activities/:activityLink/apply-bonus/:bonusCode', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    const activityLink = req.params.activityLink;
    const bonusCode = req.params.bonusCode;

    debugLog(() => `\n🎯 CSR MANUAL BONUS APPLICATION`);
    debugLog(() => `   Activity: ${activityLink}, Bonus: ${bonusCode}`);

    // Get activity details
    const activityQuery = `
      SELECT m.link as member_link, m.tenant_id
      FROM activity a
      JOIN member m ON a.p_link = m.link
      WHERE a.link = $1
    `;
    const activityResult = await client.query(activityQuery, [activityLink]);

    if (activityResult.rows.length === 0) {
      debugLog(() => `   ❌ Activity not found`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activity = activityResult.rows[0];
    const memberLink = activity.member_link;
    const tenantId = activity.tenant_id;
    
    // Lock member record
    await client.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);
    
    // Get points from molecule
    const basePoints = await getActivityPoints(null, tenantId, activityLink);

    // Get bonus details
    const bonusQuery = `
      SELECT bonus_id, bonus_code, bonus_type, bonus_amount
      FROM bonus
      WHERE bonus_code = $1 AND is_active = true
    `;
    const bonusResult = await client.query(bonusQuery, [bonusCode]);

    if (bonusResult.rows.length === 0) {
      debugLog(() => `   ❌ Bonus not found or inactive`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bonus not found or inactive' });
    }

    const bonus = bonusResult.rows[0];

    // Check if bonus already applied (look for type 'N' activity with this bonus_rule_id)
    // Try new molecule first (bonus_activity_link), then fall back to old (bonus_activity_id)
    const bonusActivityLinkMoleculeId = await getMoleculeId(tenantId, 'bonus_activity_link');
    const bonusActivityIdMoleculeId = await getMoleculeId(tenantId, 'bonus_activity_id');
    const bonusRuleIdMoleculeId = await getMoleculeId(tenantId, 'bonus_rule_id');
    
    // Get ALL bonus_activity_links from parent activity using helper
    let bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityLinkMoleculeId, activityLink);
    
    // Fall back to old molecule if no new links found
    if (bonusLinks.length === 0) {
      bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityIdMoleculeId, activityLink);
    }
    
    // Check if ANY of the existing bonus activities have this bonus_rule_id
    for (const bonusLink of bonusLinks) {
      const bonusRuleIdValue = await getActivityMoleculeValueById(null, bonusRuleIdMoleculeId, bonusLink);
      if (bonusRuleIdValue === bonus.bonus_id) {
        debugLog(() => `   ❌ Bonus already applied`);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Bonus already applied to this activity' });
      }
    }

    debugLog(() => `   ✅ All checks passed, applying bonus...`);

    // Apply the bonus using shared function
    const result = await applyBonusToActivity(
      null,
      bonus.bonus_id,
      bonus.bonus_code,
      bonus.bonus_type,
      bonus.bonus_amount,
      basePoints,
      activityLink
    );

    debugLog(() => `   🎉 Bonus application complete!\n`);

    await client.query('COMMIT');

    res.json({
      message: 'Bonus applied successfully',
      activity_link: activityLink,
      bonus_code: bonus.bonus_code,
      bonus_points: result.bonus_points,
      bonus_activity_link: result.bonus_activity_link
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in manual bonus application:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Helper: Get molecule_id from molecule_key
async function getMoleculeId(tenantId, moleculeKey) {
  // USE CACHE first
  const cached = caches.moleculeDef.get(`${tenantId}:${moleculeKey}`);
  if (cached) {
    return cached.molecule_id;
  }
  
  // Fallback to DB
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
async function getMemberTierOnDate(memberLink, date) {
  const query = `
    SELECT 
      td.tier_id,
      td.tier_code,
      td.tier_description,
      td.tier_ranking
    FROM member_tier mt
    JOIN tier_definition td ON mt.tier_id = td.tier_id
    WHERE mt.p_link = $1
      AND mt.start_date <= $2::DATE
      AND (mt.end_date IS NULL OR mt.end_date >= $2::DATE)
    ORDER BY td.tier_ranking DESC
    LIMIT 1
  `;
  
  const result = await dbClient.query(query, [memberLink, date]);
  
  if (result.rows.length === 0) {
    return null; // No tier on that date
  }
  
  return result.rows[0];
}

async function findExpirationRule(activityDate, tenantId) {
  if (!tenantId) {
    console.error('findExpirationRule called without tenantId');
    return null;
  }
  // USE CACHE for expiration rules
  if (caches.expirationRules && caches.expirationRules.length > 0) {
    const actDate = new Date(activityDate);
    for (const rule of caches.expirationRules) {
      if (rule.tenant_id !== tenantId) continue;
      const startDate = new Date(rule.start_date);
      const endDate = new Date(rule.end_date);
      if (actDate >= startDate && actDate <= endDate) {
        return {
          ruleId: rule.rule_id,
          ruleKey: rule.rule_key,
          expireDate: rule.expiration_date,
          description: rule.description
        };
      }
    }
  }
  
  // Fallback to DB if cache not ready
  const query = `
    SELECT rule_id, rule_key, expiration_date, description
    FROM point_expiration_rule 
    WHERE $1 >= start_date AND $1 <= end_date AND tenant_id = $2
    ORDER BY rule_key DESC
    LIMIT 1
  `;
  const result = await dbClient.query(query, [activityDate, tenantId]);
  
  if (result.rows.length > 0) {
    return {
      ruleId: result.rows[0].rule_id,
      ruleKey: result.rows[0].rule_key,
      expireDate: result.rows[0].expiration_date,
      description: result.rows[0].description
    };
  }
  
  // No rule found - return null to trigger error
  return {
    ruleId: null,
    ruleKey: null,
    expireDate: null,
    description: null
  };
}

// Helper: Add points to member's point lot with expiration tracking
// Helper: Get molecule value by key (searches across all contexts)
async function getMoleculeValue(tenantId, moleculeKey, context = {}, date = null) {
  // USE CACHE for molecule definition
  const cached = caches.moleculeDef.get(`${tenantId}:${moleculeKey}`);
  
  if (cached) {
    // Handle Reference molecules from cache
    if (cached.value_kind === 'reference') {
      // Direct Field reference
      if (cached.ref_table_name && cached.ref_field_name) {
        const tableName = cached.ref_table_name;
        const fieldName = cached.ref_field_name;
        
        // Use member_link for member table lookups
        if (tableName === 'member' && context.member_link) {
          const refQuery = `SELECT ${fieldName} FROM ${tableName} WHERE link = $1`;
          const refResult = await dbClient.query(refQuery, [context.member_link]);
          if (refResult.rows.length > 0) {
            return refResult.rows[0][fieldName];
          }
        }
        return null;
      }
      
      // Function reference
      if (cached.ref_function_name) {
        if (cached.ref_function_name === 'get_member_tier_on_date' && context.member_link && date) {
          try {
            const memberLink = context.member_link;
            if (memberLink) {
              const tierResult = await getMemberTierOnDate(memberLink, date);
              return tierResult ? tierResult.tier_code : null;
            }
          } catch (error) {
            return null;
          }
        }
        return null;
      }
      return null;
    }
    
    // Handle Scalar molecules - need to query for actual values
    if (isScalarMolecule(cached)) {
      if (cached.scalar_type === 'text') {
        const textValues = caches.moleculeValueText.get(cached.molecule_id);
        if (textValues && textValues.length > 0) {
          return textValues[0].text_value;
        }
      }
      // For numeric, could check molecule_value_numeric cache if we add it
    }
    
    // Handle List molecules
    if (isListMolecule(cached)) {
      const textValues = caches.moleculeValueText.get(cached.molecule_id);
      if (textValues && textValues.length > 0) {
        return textValues[0].text_value;
      }
    }
  }
  
  // Fallback to DB query for complex cases
  debugLog(() => `⚠️ getMoleculeValue FALLBACK for ${tenantId}:${moleculeKey}`);
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
      
      // Use member_link for member table lookups
      if (tableName === 'member' && context.member_link) {
        const refQuery = `SELECT ${fieldName} FROM ${tableName} WHERE link = $1`;
        const refResult = await dbClient.query(refQuery, [context.member_link]);
        
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
      if (functionName === 'get_member_tier_on_date' && context.member_link && date) {
        try {
          const memberLink = context.member_link;
          if (memberLink) {
            const tierResult = await getMemberTierOnDate(memberLink, date);
            return tierResult ? tierResult.tier_code : null;
          }
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
    const result = await dbClient.query(`
      SELECT sd.value
      FROM sysparm s
      JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
      WHERE s.sysparm_key = 'debug'
        AND s.tenant_id = 1
        AND sd.category IS NULL
        AND sd.code IS NULL
    `);
    if (result.rows.length > 0) {
      DEBUG_ENABLED = (result.rows[0].value === 'Y');
    } else {
      DEBUG_ENABLED = false;
    }
    console.log(`🐛 Debug: ${DEBUG_ENABLED ? 'ON' : 'OFF'}`);
  } catch (error) {
    DEBUG_ENABLED = true;
    console.log(`🐛 Debug logging: ENABLED (default - sysparm not found)`);
  }
}

// Helper: Get error message from system molecule by error code

/**
 * Select aircraft type based on flight distance (miles/km)
 * Returns ICAO aircraft type code based on typical equipment for route distance
 */
function selectAircraftType(miles) {
  if (!miles || miles <= 0) return null;
  
  if (miles < 300) return 'CRJ2';      // CRJ-200 for very short hops
  if (miles < 500) return 'E145';      // ERJ-145
  if (miles < 700) return 'E175';      // Embraer 175
  if (miles < 1000) return 'CR9';      // CRJ-900
  if (miles < 1500) return 'A319';     // Airbus A319
  if (miles < 2000) return 'B738';     // Boeing 737-800
  if (miles < 2500) return 'A321';     // Airbus A321
  if (miles < 3000) return 'B752';     // Boeing 757-200
  if (miles < 4000) return 'B763';     // Boeing 767-300
  if (miles < 6000) return 'A333';     // Airbus A330-300
  if (miles < 8000) return 'B772';     // Boeing 777-200
  return 'A359';                        // Airbus A350-900 for ultra-long haul
}

// ============================================================================
// GENERIC ACTIVITY CREATION - Reads from composite (NEW)
// ============================================================================

/**
 * Create an activity using the composite system
 * @param {string} memberLink - The member link (CHAR(5))
 * @param {string} activityType - Activity type ('A', 'P', 'J', etc.)
 * @param {object} payload - Activity data (molecule_key: value pairs)
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<object>} Result with activity_link, bonuses, promotions, etc.
 */
async function createActivity(memberLink, activityType, payload, tenantId) {
  const activity_date = payload.activity_date;
  
  // Step 1: Get composite from cache
  const composite = getCachedComposite(tenantId, activityType);
  if (!composite) {
    throw new Error(`No composite defined for tenant ${tenantId}, activity type ${activityType}`);
  }
  debugLog(() => `\n📝 Creating activity using composite: ${composite.description}`);
  debugLog(() => `   Composite has ${composite.details.length} molecules`);

  // Step 2: Lock member record to prevent concurrent modifications
  await dbClient.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);

  // Step 3: Validate required non-calculated fields
  const missingRequired = [];
  for (const detail of composite.details) {
    if (detail.is_required && !detail.is_calculated) {
      // member_points is special - it maps to base_points in payload
      const payloadKey = detail.molecule_key === 'member_points' ? 'base_points' : detail.molecule_key;
      if (payload[payloadKey] === undefined || payload[payloadKey] === null || payload[payloadKey] === '') {
        missingRequired.push(detail.molecule_key);
      }
    }
  }
  if (missingRequired.length > 0) {
    throw new Error(`Missing required fields: ${missingRequired.join(', ')}`);
  }

  // Step 4: Calculate points FIRST (other calc functions may depend on it)
  let pointsAmount = null;
  let pointsMoleculeId = null;
  const pointsDetail = composite.details.find(d => d.molecule_key === 'member_points');
  
  if (pointsDetail) {
    pointsMoleculeId = pointsDetail.molecule_id;
    if (pointsDetail.is_calculated && pointsDetail.calc_function) {
      debugLog(() => `   🔢 Calculating points with: ${pointsDetail.calc_function}`);
      const calcResult = await callActivityFunction(pointsDetail.calc_function, payload, { db: dbClient, tenantId });
      if (!calcResult.success) {
        throw new Error(`Points calculation failed: ${calcResult.message || calcResult.error}`);
      }
      pointsAmount = calcResult.points;
      debugLog(() => `   ✓ Calculated points: ${pointsAmount}`);
    } else {
      // CSR entered
      pointsAmount = Number(payload.base_points || payload.point_amount || 0);
      debugLog(() => `   ✓ CSR entered points: ${pointsAmount}`);
    }
  }

  // Step 5: Process other molecules (encode non-calculated, compute calculated)
  const encodedMolecules = {};
  const moleculeIds = {};

  for (const detail of composite.details) {
    const { molecule_key, molecule_id, is_calculated, calc_function } = detail;
    
    // Skip member_points - already handled above
    if (molecule_key === 'member_points') {
      continue;
    }

    let value;
    if (is_calculated && calc_function) {
      // Calculated field - call function
      debugLog(() => `   🔢 Calling calc function: ${calc_function} for ${molecule_key}`);
      // Pass both base_points and miles (selectAircraftType expects miles)
      const calcResult = await callActivityFunction(calc_function, { ...payload, base_points: pointsAmount, miles: pointsAmount }, { db: dbClient, tenantId });
      if (calcResult.success) {
        // Prefer 'code' for encoding (e.g., 'B738'), fall back to 'value' (e.g., link number)
        value = calcResult.code !== undefined ? calcResult.code : calcResult.value;
        if (value === undefined && calcResult.data && calcResult.data[molecule_key] !== undefined) {
          value = calcResult.data[molecule_key];
        }
      }
      if (value === undefined) {
        debugLog(() => `   ⚠️ Calc function ${calc_function} did not return value for ${molecule_key}`);
        continue; // Skip this molecule
      }
      debugLog(() => `   ✓ Calculated ${molecule_key}: ${value}`);
    } else {
      // CSR entered - get from payload
      value = payload[molecule_key];
      if (value === undefined || value === null || value === '') {
        continue; // Skip optional empty fields
      }
    }

    // Encode the molecule value
    const encoded = await encodeMolecule(tenantId, molecule_key, value);
    encodedMolecules[molecule_key] = encoded;
    moleculeIds[molecule_key] = molecule_id;
    debugLog(() => `   ✓ Encoded ${molecule_key}: ${value} → ${encoded}`);
  }

  // Step 6: Handle points bucket if member_points in composite
  let bucketResult = null;
  if (pointsMoleculeId && pointsAmount && pointsAmount > 0) {
    debugLog(() => `\n💰 Adding ${pointsAmount} points to molecule bucket...`);
    bucketResult = await addPointsToMoleculeBucket(memberLink, activity_date, pointsAmount, tenantId);
    debugLog(() => `   ✓ Bucket: link=${bucketResult.bucket_link}, expire=${bucketResult.expire_date}`);
  }

  // Step 7: Insert activity (parent record)
  const activityInsert = await insertActivity(tenantId, memberLink, activity_date, activityType);
  const activityLink = activityInsert.link;
  debugLog(() => `   ✓ Activity created: link=${activityLink}`);

  // Step 8: Insert activity molecules
  for (const moleculeKey of Object.keys(encodedMolecules)) {
    await insertActivityMolecule(
      null, 
      moleculeIds[moleculeKey], 
      encodedMolecules[moleculeKey],
      null,
      activityLink
    );
    debugLog(() => `   ✓ Molecule stored: ${moleculeKey} (id=${moleculeIds[moleculeKey]})`);
  }

  // Step 9: Store member_points molecule if applicable
  if (bucketResult && pointsAmount > 0) {
    await saveActivityPoints(null, bucketResult.bucket_link, pointsAmount, tenantId, activityLink);
    debugLog(() => `   ✓ member_points stored: bucket=${bucketResult.bucket_link}, amount=${pointsAmount}`);
  }

  // Step 10: Evaluate promotions
  debugLog(() => `\n🎯 Evaluating promotions for activity ${activityLink}...`);
  const promotions = await evaluatePromotions(null, activity_date, memberLink, tenantId, activityLink);

  // Step 11: Evaluate bonuses (only if points were earned)
  let bonuses = [];
  if (pointsAmount && pointsAmount > 0) {
    debugLog(() => `\n🎁 Evaluating bonuses for activity ${activityLink}...`);
    bonuses = await evaluateBonuses(null, activity_date, pointsAmount, false, activityLink);
  }

  debugLog(() => `✅ Activity ${activityLink} created via composite with ${promotions.length} promotions and ${bonuses.length} bonuses\n`);

  return {
    link: activityLink,
    activity_date: activity_date,
    base_points: pointsAmount,
    bucket_link: bucketResult?.bucket_link || null,
    expire_date: bucketResult?.expire_date || null,
    bonuses: bonuses,
    promotions: promotions
  };
}

// POST - Create new accrual activity with molecules (LEGACY - uses hardcoded molecules)
/**
 * Create an accrual activity for a member
 * @param {string} memberLink - The member link (CHAR(5))
 * @param {object} activityData - Activity data: { activity_date, carrier, origin, destination, fare_class, flight_number, mqd, base_points }
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<object>} Result with activity_link, bonuses, promotions, etc.
 */
async function createAccrualActivity(memberLink, activityData, tenantId) {
  const { activity_date, base_points } = activityData;

  // Step 1: Lock member record to prevent concurrent modifications
  await dbClient.query('SELECT link FROM member WHERE link = $1 FOR UPDATE', [memberLink]);

  debugLog(() => `\n📝 Creating accrual activity for member ${memberLink}: activity_date=${activity_date}, base_points=${base_points}`);

  // Step 2: Get composite and encode molecules dynamically
  const composite = getCachedComposite(tenantId, 'A');
  if (!composite) {
    throw new Error(`No composite defined for tenant ${tenantId}, activity type A`);
  }
  debugLog(() => `   Using composite: ${composite.description} (${composite.details.length} molecules)`);

  const encodedMolecules = {};
  const moleculeIds = {};
  
  // Process molecules from composite (in sort_order)
  for (const detail of composite.details) {
    const { molecule_key, molecule_id, is_calculated, calc_function } = detail;
    
    // Skip member_points - handled separately for bucket logic
    if (molecule_key === 'member_points') {
      continue;
    }
    
    let value;
    if (is_calculated && calc_function) {
      // Calculated field - call the function
      const calcResult = await callActivityFunction(calc_function, { ...activityData, miles: base_points }, { db: dbClient, tenantId });
      if (calcResult.success) {
        value = calcResult.code !== undefined ? calcResult.code : calcResult.value;
      }
      if (value) {
        debugLog(() => `   ✓ Calculated ${molecule_key}: ${value}`);
      }
    } else {
      // User-entered field - get from payload
      value = activityData[molecule_key];
    }
    
    // Encode if we have a value
    if (value !== undefined && value !== null && value !== '') {
      encodedMolecules[molecule_key] = await encodeMolecule(tenantId, molecule_key, value);
      moleculeIds[molecule_key] = molecule_id;
      debugLog(() => `   ✓ ${molecule_key}: ${value} → encoded ${encodedMolecules[molecule_key]}`);
    }
  }

  // Step 2: Add points to molecule bucket (handles expiration, upsert, etc.)
  debugLog(() => `\n💰 Adding ${base_points} points to molecule bucket...`);
  const bucketResult = await addPointsToMoleculeBucket(memberLink, activity_date, base_points, tenantId);

  // Step 3: Insert activity (parent record) - no lot_id, points tracked in molecule_value_list
  const activityInsert = await insertActivity(tenantId, memberLink, activity_date, 'A');
  const activityLink = activityInsert.link;
  debugLog(() => `   ✓ Activity created: link=${activityLink}`);

  // Step 4: Insert activity molecules using molecule_value_list
  for (const moleculeKey of Object.keys(encodedMolecules)) {
    await insertActivityMolecule(
      null, 
      moleculeIds[moleculeKey], 
      encodedMolecules[moleculeKey],
      null,  // client
      activityLink
    );
    debugLog(() => `   ✓ Molecule stored: molecule_id=${moleculeIds[moleculeKey]}, value=${encodedMolecules[moleculeKey]}`);
  }

  // Step 4b: Add member_points molecule (links activity to bucket)
  await saveActivityPoints(null, bucketResult.bucket_link, base_points, tenantId, activityLink);
  debugLog(() => `   ✓ member_points stored: bucket_link=${bucketResult.bucket_link}, amount=${base_points}`);

  // Step 5: Evaluate promotions
  debugLog(() => `\n🎯 Evaluating promotions for activity ${activityLink}...`);
  const promotions = await evaluatePromotions(null, activity_date, memberLink, tenantId, activityLink);

  // Step 6: Evaluate bonuses
  debugLog(() => `\n🎁 Evaluating bonuses for activity ${activityLink}...`);
  const bonuses = await evaluateBonuses(null, activity_date, base_points, false, activityLink);

  debugLog(() => `✅ Activity ${activityLink} created successfully with ${promotions.length} promotions and ${bonuses.length} bonuses\n`);

  return {
    link: activityLink,
    activity_date: activity_date,
    base_points: base_points,
    bucket_link: bucketResult.bucket_link,
    expire_date: bucketResult.expire_date,
    bonuses: bonuses,
    promotions: promotions
  };
}

app.post('/v1/members/:memberId/accruals', async (req, res) => {
  const startTime = process.hrtime.bigint();
  
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Resolve membership_number to internal member_id
    const membershipNumber = req.params.memberId;
    const tenantId = req.body.tenant_id || 1;
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    let { activity_date, carrier, origin, destination, fare_class, flight_number, mqd } = req.body;
    let base_points = req.body.base_points ? Number(req.body.base_points) : null;

    debugLog(() => `📥 Received payload base_points: ${req.body.base_points} (type: ${typeof req.body.base_points}), parsed: ${base_points}`);

    // Load activity type processing settings
    const activityType = 'A'; // Flight
    const dataEditFunction = await getSysparmValue(tenantId, 'activity_processing', activityType, 'data_edit_function');
    const pointsMode = await getSysparmValue(tenantId, 'activity_processing', activityType, 'points_mode') || 'manual';
    const calcFunction = await getSysparmValue(tenantId, 'activity_processing', activityType, 'calc_function');
    
    debugLog(() => `Activity type ${activityType} settings: editFn=${dataEditFunction}, pointsMode=${pointsMode}, calcFn=${calcFunction}`);

    // Build activity data object for functions
    let activityData = { activity_date, carrier, origin, destination, fare_class, flight_number, mqd, base_points };

    // Call data edit function if configured
    if (dataEditFunction) {
      debugLog(() => `Calling data edit function: ${dataEditFunction}`);
      const editResult = await callActivityFunction(dataEditFunction, activityData, { db: client, tenantId });
      
      if (!editResult.success) {
        const errorMsg = await getErrorMessage(editResult.error, tenantId);
        debugLog(() => `   ❌ Data edit function failed: ${editResult.error}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: errorMsg || editResult.error });
      }
      
      // Apply any transformations from edit function
      activityData = editResult.data;
      debugLog(() => `   ✅ Data edit function passed`);
    }

    // Validate required fields from composite
    const composite = getCachedComposite(tenantId, activityType);
    if (!composite) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `No composite defined for tenant ${tenantId}, activity type ${activityType}` });
    }
    
    // activity_date is always required (not in composite, it's on activity record)
    if (!activityData.activity_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required field: activity_date' });
    }
    
    // Check composite for required non-calculated fields
    const missingFields = [];
    for (const detail of composite.details) {
      if (detail.is_required && !detail.is_calculated) {
        // member_points maps to base_points in payload, and respects pointsMode
        if (detail.molecule_key === 'member_points') {
          if (pointsMode === 'manual' && !activityData.base_points && activityData.base_points !== 0) {
            missingFields.push('base_points');
          }
        } else {
          const value = activityData[detail.molecule_key];
          if (value === undefined || value === null || value === '') {
            missingFields.push(detail.molecule_key);
          }
        }
      }
    }
    
    if (missingFields.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // If system calculates points, call the calc function
    if (pointsMode === 'calculated' && calcFunction) {
      debugLog(() => `Calling calc function: ${calcFunction}`);
      const calcResult = await callActivityFunction(calcFunction, activityData, { db: client, tenantId });
      
      if (!calcResult.success) {
        debugLog(() => `   ❌ Calc function failed: ${calcResult.error} - ${calcResult.message}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: calcResult.message });
      }
      
      activityData.base_points = calcResult.points;
      debugLog(() => `   ✅ Calculated miles: ${calcResult.points} (cached: ${calcResult.cached})`);
    }

    // Reassign from activityData in case edit function modified them
    activity_date = activityData.activity_date;
    carrier = activityData.carrier;
    origin = activityData.origin;
    destination = activityData.destination;
    fare_class = activityData.fare_class;
    flight_number = activityData.flight_number;
    mqd = activityData.mqd;
    base_points = activityData.base_points;

    // Validate retro date limit
    debugLog('🔍 Checking retro date limit...');
    let retroDaysAllowed;
    try {
      const retroValue = await getSysparmByKey(tenantId, 'retro_days_allowed');
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
        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - retroDays);
        
        // Convert to strings for comparison
        const cutoffStr = toDateStr(cutoffDate);
        const actDateStr = toDateStr(activity_date);
        
        debugLog(() => `   Today: ${toDateStr(today)}`);
        debugLog(() => `   Cutoff (${retroDays} days ago): ${cutoffStr}`);
        debugLog(() => `   Activity date: ${actDateStr}`);
        debugLog(() => `   Is too old? ${actDateStr < cutoffStr}`);
        
        if (actDateStr < cutoffStr) {
          const errorMsg = await getErrorMessage('E001', tenantId);
          debugLog('   ❌ REJECTED: Activity date exceeds retro limit');
          await client.query('ROLLBACK');
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
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    debugLog(() => `   Today: ${todayStr}`);
    debugLog(() => `   Activity date: ${activity_date}`);
    debugLog(() => `   Is in future? ${activity_date > todayStr}`);
    
    if (activity_date > todayStr) {
      const errorMsg = await getErrorMessage('E004', tenantId);
      debugLog('   ❌ REJECTED: Activity date cannot be in the future');
      debugLog(() => `   Error message retrieved: ${errorMsg}`);
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: errorMsg || 'E004: Activity date cannot be in the future',
        activity_date: activity_date,
        server_today: todayStr
      });
    }
    
    debugLog(`   ✅ PASSED: Activity date is not in future`);

    // Call the core function
    const result = await createAccrualActivity(memberLink, {
      activity_date,
      carrier,
      origin,
      destination,
      fare_class,
      flight_number,
      mqd,
      base_points
    }, tenantId);

    // Calculate elapsed time
    const endTime = process.hrtime.bigint();
    const elapsedNanos = endTime - startTime;
    const elapsedMs = Number(elapsedNanos) / 1_000_000;
    
    debugLog(`⏱️  Total processing time: ${elapsedMs.toFixed(2)}ms`);

    await client.query('COMMIT');

    // Get activity type label for response message
    const activityTypeLabelForMsg = await getSysparmByKey(tenantId, 'activity_type_label') || 'Accrual activity';

    res.status(201).json({
      message: `${activityTypeLabelForMsg} created successfully`,
      link: result.link,
      activity_date: result.activity_date,
      base_points: result.base_points,
      bucket_link: result.bucket_link,
      expire_date: result.expire_date,
      bonuses_awarded: result.bonuses.length,
      bonuses: result.bonuses,
      promotions_processed: result.promotions.length,
      promotions: result.promotions,
      processing_time_ms: DEBUG_ENABLED ? elapsedMs.toFixed(2) : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating accrual activity:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST - Calculate miles for a route (preview, does not save)
app.post('/v1/calculate-miles', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const tenantId = req.body.tenant_id || 1;
    const activityType = req.body.activity_type || 'A';
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // Get the calc function for this activity type
    const calcFunction = await getSysparmValue(tenantId, 'activity_processing', activityType, 'calc_function');
    
    if (!calcFunction) {
      return res.status(400).json({ error: 'No calculation function configured for this activity type' });
    }

    // Call the calc function
    const activityData = { origin, destination, ...req.body };
    const result = await callActivityFunction(calcFunction, activityData, { db: dbClient, tenantId });
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      miles: result.points,
      cached: result.cached,
      origin,
      destination
    });

  } catch (error) {
    console.error('Error calculating miles:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - View route cache stats
app.get('/v1/route-cache', async (req, res) => {
  try {
    const calcModule = await import('./functions/calculateFlightMiles.js');
    if (calcModule.getCacheStats) {
      res.json(calcModule.getCacheStats());
    } else {
      res.json({ error: 'getCacheStats not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Get bonuses for an activity
app.get('/v1/activities/:activityLink/bonuses', async (req, res) => {
  if (!dbClient) {
    return res.json([]);
  }

  try {
    const tenantId = req.query.tenant_id || 1;
    
    // Get link from URL param (URL-decoded automatically by Express)
    const activityLink = req.params.activityLink;
    
    if (!activityLink) {
      return res.json([]); // No link provided
    }
    
    // Try new molecule first (bonus_activity_link), then fall back to old (bonus_activity_id)
    const bonusActivityLinkMoleculeId = await getMoleculeId(tenantId, 'bonus_activity_link');
    const bonusActivityIdMoleculeId = await getMoleculeId(tenantId, 'bonus_activity_id');
    const bonusRuleIdMoleculeId = await getMoleculeId(tenantId, 'bonus_rule_id');
    
    // Get ALL bonus_activity_links from parent activity using helper
    let bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityLinkMoleculeId, activityLink);
    
    // Fall back to old molecule if no new links found
    if (bonusLinks.length === 0) {
      bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityIdMoleculeId, activityLink);
    }
    
    if (bonusLinks.length === 0) {
      return res.json([]); // No bonus activities linked
    }
    
    // Build response for each bonus
    const bonuses = [];
    for (const bonusLink of bonusLinks) {
      // Get bonus_rule_id from the bonus activity
      const bonusRuleIdValue = await getActivityMoleculeValueById(null, bonusRuleIdMoleculeId, bonusLink);
      
      // Get bonus points from "5_data_54"
      const bonusPoints = await getActivityPoints(null, tenantId, bonusLink);
      
      // Get bonus details
      const bonusQuery = `
        SELECT bonus_id, bonus_code, bonus_description, bonus_type, bonus_amount
        FROM bonus WHERE bonus_id = $1
      `;
      const bonusResult = await dbClient.query(bonusQuery, [bonusRuleIdValue]);
      
      if (bonusResult.rows.length > 0) {
        const bonus = bonusResult.rows[0];
        bonuses.push({
          bonus_activity_link: bonusLink,
          bonus_points: bonusPoints,
          bonus_id: bonus.bonus_id,
          bonus_code: bonus.bonus_code,
          bonus_description: bonus.bonus_description,
          bonus_type: bonus.bonus_type,
          bonus_amount: bonus.bonus_amount
        });
      }
    }
    
    res.json(bonuses);

  } catch (error) {
    console.error('Error fetching activity bonuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/activities/:activityId/promotions - Get promotion contributions for activity
app.get('/v1/activities/:activityLink/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityLink = req.params.activityLink;
    const tenantId = req.query.tenant_id || 1;

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
      WHERE mpd.activity_link = $1
        AND mp.tenant_id = $2
      ORDER BY p.promotion_code
    `;

    debugLog(() => `Querying promotion contributions for activity link: ${activityLink}, tenant ${tenantId}`);
    const result = await dbClient.query(query, [activityLink, tenantId]);
    debugLog(() => `Found ${result.rows.length} promotion contributions`);
    
    res.json({ 
      ok: true, 
      activity_link: activityLink,
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

    // Get member_points molecule_id
    const memberPointsMoleculeId = await getMoleculeId(tenantId, 'member_points');

    // Query activities that contributed to this promotion
    // Get points from "5_data_54"
    // NOTE: Filter out adjustments (activity_type='J') - they shouldn't contribute to promotions
    const query = `
      SELECT 
        a.activity_date,
        a.activity_type,
        a.link,
        mpd.contribution_amount
      FROM member_promotion_detail mpd
      JOIN activity a ON mpd.activity_link = a.link
      WHERE mpd.member_promotion_id = $1
        AND a.activity_type != 'J'
      ORDER BY a.activity_date DESC
    `;

    const result = await dbClient.query(query, [memberPromotionId]);
    
    // Hydrate activity dates
    hydrateActivityDates(result.rows);
    
    // For each activity, get its display template rendering
    const activities = await Promise.all(result.rows.map(async (activity) => {
      // Get points from "5_data_54"
      const pointAmount = await getActivityPoints(null, tenantId, activity.link);
      
      // Get activity details (molecules) from new storage tables
      const activityMolecules = await getAllActivityMolecules(null, tenantId, activity.link);
      
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
        debugLog(() => `No Efficient template for activity type=${activity.activity_type}`);
      }
      
      // Use activityMolecules directly (already decoded)
      const decodedValues = activityMolecules;
      const decodedDescriptions = {};
      
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
          displayString = `Activity ${activity.link}`;
        }
      }
      
      return {
        link: activity.link,
        activity_date: activity.activity_date,
        point_amount: pointAmount,
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
app.get('/v1/activities/:activityLink/full', async (req, res) => {
  debugLog(() => `=== GET /v1/activities/${req.params.activityLink}/full ===`);
  
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityLink = req.params.activityLink;

    // Get activity header with member info via p_link
    const activityQuery = `
      SELECT a.link, m.link as member_link, m.tenant_id, a.activity_date, a.activity_type
      FROM activity a
      JOIN member m ON a.p_link = m.link
      WHERE a.link = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityLink]);
    
    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    hydrateActivityDates(activityResult.rows);
    const activity = activityResult.rows[0];
    debugLog(() => `Activity header: ${JSON.stringify(activity)}`);
    
    const tenantId = activity.tenant_id;
    
    // Get points from molecule
    const pointAmount = await getActivityPoints(null, tenantId, activityLink);
    
    // Get activity details from new storage tables
    const moleculeData = await getAllActivityMolecules(null, tenantId, activityLink);
    debugLog(() => `Found ${Object.keys(moleculeData).length} molecules`);
    
    // Build activity data object for testing
    const activityData = {
      link: activityLink,
      member_link: activity.member_link,
      activity_date: activity.activity_date,
      activity_type: activity.activity_type,
      base_points: pointAmount,
      ...moleculeData
    };
    
    debugLog(() => `Returning activity data: ${JSON.stringify(activityData)}`);
    res.json(activityData);

  } catch (error) {
    console.error('ERROR in GET /v1/activities/:activityId/full:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remove activity and adjust point balance
app.delete('/v1/activities/:activityLink', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const activityLink = req.params.activityLink;
    
    debugLog(() => `\n🗑️  Deleting activity ${activityLink}...`);

    // Step 1: Get activity info before deleting
    const activityQuery = `
      SELECT m.link as member_link, a.activity_type, m.tenant_id, a.link as activity_link
      FROM activity a
      JOIN member m ON a.p_link = m.link
      WHERE a.link = $1
    `;
    const activityResult = await dbClient.query(activityQuery, [activityLink]);
    
    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const { member_link, activity_type, tenant_id, activity_link: activityLinkFromDb } = activityResult.rows[0];

    // Get molecule IDs we'll need
    const memberPointsMoleculeId = await getMoleculeId(tenant_id, 'member_points');
    
    // Get points and bucket info from NEW storage ("5_data_54") BEFORE we delete it
    let point_amount = 0;
    let bucketLink = null;
    
    if (activityLink) {
      try {
        const rows = await getMoleculeRows(activityLink, 'member_points', tenant_id);
        if (rows.length > 0) {
          // C1 = bucket link, N1 = amount
          bucketLink = rows[0].C1;
          point_amount = rows[0].N1 || 0;
        }
      } catch (e) {
        // Fall back to old storage
        point_amount = await getActivityPoints(null, tenant_id, activityLink);
      }
    }
    
    debugLog(() => `   Activity: type=${activity_type}, point_amount=${point_amount}, member_link=${member_link}, bucketLink=${bucketLink}`);

    // Step 2: Find and delete type 'N' bonus activities (children of this activity)
    // Try new molecule first (bonus_activity_link), then fall back to old (bonus_activity_id)
    const bonusActivityLinkMoleculeId = await getMoleculeId(tenant_id, 'bonus_activity_link');
    const bonusActivityIdMoleculeId = await getMoleculeId(tenant_id, 'bonus_activity_id');
    
    // Get ALL bonus_activity_links from parent activity using helper
    let bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityLinkMoleculeId, activityLink);
    
    // Fall back to old molecule if no new links found
    if (bonusLinks.length === 0) {
      bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityIdMoleculeId, activityLink);
    }
    
    // Delete each bonus child activity and reverse points from bucket
    for (const bonusLink of bonusLinks) {
      
      if (bonusLink) {
        try {
          const bonusRows = await getMoleculeRows(bonusLink, 'member_points', tenant_id);
          if (bonusRows.length > 0) {
            const bonusBucketLink = bonusRows[0].C1;
            const bonusPoints = bonusRows[0].N1 || 0;
            
            // Subtract bonus points from bucket accrued
            if (bonusBucketLink && bonusPoints) {
              await updatePointBucketAccrued(bonusBucketLink, -Math.abs(bonusPoints));
              debugLog(() => `   ✓ Subtracted ${bonusPoints} bonus points from bucket link=${bonusBucketLink}`);
            }
          }
        } catch (e) {
          debugLog(() => `   ⚠️ Could not get bonus activity bucket info: ${e.message}`);
        }
        
        // Delete the bonus activity's molecule records from new storage
        await deleteAllMoleculeRowsForLink(bonusLink, 'activity');
      
        // Delete the bonus activity itself
        await dbClient.query('DELETE FROM activity WHERE link = $1', [bonusLink]);
        debugLog(() => `   ✓ Deleted bonus activity ${bonusLink}`);
      }
    }
    if (bonusLinks.length > 0) {
      debugLog(() => `   ✓ Deleted ${bonusLinks.length} bonus activity record(s)`);
    }

    // Step 3: Handle redemption-specific cleanup - reverse bucket redeemed amounts
    if (activity_type === 'R') {
      // Get member_points from NEW storage ("5_data_54") to know which buckets were debited
      if (activityLink) {
        try {
          const redemptionRows = await getMoleculeRows(activityLink, 'member_points', tenant_id);
          
          for (const row of redemptionRows) {
            const redemptionBucketLink = row.C1;
            const pointsUsed = Math.abs(row.N1 || 0);
            
            if (redemptionBucketLink && pointsUsed) {
              // Decrease redeemed amount to reverse the redemption
              await updatePointBucketRedeemed(redemptionBucketLink, -pointsUsed);
              debugLog(() => `   ✓ Reversed ${pointsUsed} redeemed from bucket link=${redemptionBucketLink}`);
            }
          }
        } catch (e) {
          debugLog(() => `   ⚠️ Could not reverse redemption buckets: ${e.message}`);
        }
      }
    }

    // Step 4: Reverse points from bucket for accrual activities
    if (['A', 'P', 'J', 'M', 'N'].includes(activity_type) && point_amount > 0 && bucketLink) {
      // Subtract from bucket accrued
      await updatePointBucketAccrued(bucketLink, -Math.abs(point_amount));
      debugLog(() => `   ✓ Subtracted ${point_amount} points from bucket link=${bucketLink}`);
    }

    // Step 5: Delete parent's molecule records
    if (activityLink) {
      // Delete from storage tables
      await deleteAllMoleculeRowsForLink(activityLink, 'activity');
    }
    debugLog(() => `   ✓ Deleted molecule records for activity ${activityLink}`);

    // Step 6: Delete member_promotion_detail records and roll back promotion progress
    const getPromotionDetailsQuery = `
      SELECT mpd.member_promotion_id, mpd.contribution_amount, mp.qualify_date
      FROM member_promotion_detail mpd
      JOIN member_promotion mp ON mpd.member_promotion_id = mp.member_promotion_id
      WHERE mpd.activity_link = $1
    `;
    const promotionDetails = await dbClient.query(getPromotionDetailsQuery, [activityLink]);
    
    // Roll back progress only for unqualified promotions
    for (const detail of promotionDetails.rows) {
      if (detail.contribution_amount && !detail.qualify_date) {
        await dbClient.query(
          'UPDATE member_promotion SET progress_counter = progress_counter - $1 WHERE member_promotion_id = $2',
          [detail.contribution_amount, detail.member_promotion_id]
        );
        debugLog(() => `   ✓ Rolled back ${detail.contribution_amount} from promotion ${detail.member_promotion_id}`);
      } else if (detail.qualify_date) {
        debugLog(() => `   ⏭️  Skipped rollback for qualified promotion ${detail.member_promotion_id}`);
      }
    }
    
    const deletePromotionDetailResult = await dbClient.query(
      'DELETE FROM member_promotion_detail WHERE activity_link = $1',
      [activityLink]
    );
    if (deletePromotionDetailResult.rowCount > 0) {
      debugLog(() => `   ✓ Deleted ${deletePromotionDetailResult.rowCount} member_promotion_detail record(s)`);
    }

    // Step 7: Delete the activity record
    await dbClient.query(
      'DELETE FROM activity WHERE link = $1',
      [activityLink]
    );
    debugLog(() => `   ✓ Deleted activity record`);

    debugLog(() => `✅ Activity ${activityLink} deleted successfully\n`);

    res.json({
      success: true,
      message: 'Activity deleted successfully',
      activity_link: activityLink,
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
    
    debugLog(() => `=== POST /v1/display-templates ===`);
    debugLog(() => `Request body: ${JSON.stringify(req.body, null, 2)}`);

    if (!template_name || !template_type || !activity_type) {
      return res.status(400).json({ error: 'template_name, template_type, and activity_type are required' });
    }

    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: 'At least one line is required' });
    }

    // Insert template
    const templateQuery = `
      INSERT INTO display_template (tenant_id, template_name, template_type, activity_type, is_active)
      VALUES ($1, $2, $3, $4, false)
      RETURNING template_id, template_name, template_type, activity_type, is_active
    `;

    const templateResult = await dbClient.query(templateQuery, [
      tenant_id || 1,
      template_name,
      template_type,
      activity_type
    ]);

    const template = templateResult.rows[0];
    debugLog(() => `Template created: ${JSON.stringify(template)}`);

    // Insert lines
    for (const line of lines) {
      const lineQuery = `
        INSERT INTO display_template_line (template_id, line_number, template_string)
        VALUES ($1, $2, $3)
      `;
      await dbClient.query(lineQuery, [
        template.template_id,
        line.line_number,
        line.template_string
      ]);
    }

    debugLog(() => `Template ${template.template_id} created with ${lines.length} lines`);

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
    
    debugLog(() => `=== PUT /v1/display-templates/${templateId} ===`);
    debugLog(() => `Request body: ${JSON.stringify(req.body, null, 2)}`);

    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    if (!template_name || !template_type || !activity_type) {
      return res.status(400).json({ error: 'template_name, template_type, and activity_type are required' });
    }

    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: 'At least one line is required' });
    }

    // Update template
    const templateQuery = `
      UPDATE display_template
      SET template_name = $1, template_type = $2, activity_type = $3
      WHERE template_id = $4
      RETURNING template_id, template_name, template_type, activity_type, is_active
    `;

    const templateResult = await dbClient.query(templateQuery, [
      template_name,
      template_type,
      activity_type,
      templateId
    ]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    debugLog(() => `Template updated: ${JSON.stringify(templateResult.rows[0])}`);

    // Delete old lines
    await dbClient.query('DELETE FROM display_template_line WHERE template_id = $1', [templateId]);

    // Insert new lines
    for (const line of lines) {
      const lineQuery = `
        INSERT INTO display_template_line (template_id, line_number, template_string)
        VALUES ($1, $2, $3)
      `;
      await dbClient.query(lineQuery, [
        templateId,
        line.line_number,
        line.template_string
      ]);
    }

    debugLog(() => `Template ${templateId} updated with ${lines.length} lines`);

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

    debugLog(() => `✓ Activated ${activityType} ${templateType === 'V' ? 'Verbose' : 'Efficient'} template: ${result.rows[0].template_name}`);

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

    debugLog(() => `✓ Deleted template: ${checkResult.rows[0].template_name}`);

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
    const activityType = req.query.activity_type;

    let whereClause = 'WHERE it.tenant_id = $1';
    const params = [tenantId];
    
    if (activityType) {
      whereClause += ' AND it.activity_type = $2';
      params.push(activityType);
    }

    const query = `
      SELECT 
        it.template_id,
        it.template_name,
        it.activity_type,
        it.is_active,
        COUNT(DISTINCT itf.row_number) as line_count
      FROM input_template it
      LEFT JOIN input_template_field itf ON it.template_id = itf.template_id
      ${whereClause}
      GROUP BY it.template_id, it.template_name, it.activity_type, it.is_active
      ORDER BY it.activity_type, it.is_active DESC, it.template_name
    `;

    const result = await dbClient.query(query, params);
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

    // Get fields from new normalized table
    const fieldsQuery = `
      SELECT 
        field_id,
        row_number,
        molecule_key,
        start_position,
        display_width,
        field_width,
        enterable,
        system_generated,
        is_required,
        display_label,
        sort_order
      FROM input_template_field
      WHERE template_id = $1
      ORDER BY row_number, sort_order
    `;

    const fieldsResult = await dbClient.query(fieldsQuery, [template.template_id]);
    template.fields = fieldsResult.rows;

    // Enrich fields with molecule metadata
    template.parsed_fields = [];
    
    for (const field of template.fields) {
      const enrichedField = { ...field };
      
      // Get molecule metadata
      const molecule = await getMolecule(field.molecule_key, tenant_id);
      if (molecule) {
        enrichedField.molecule = molecule;
        enrichedField.label = field.display_label || molecule.label || field.molecule_key;
        enrichedField.value_kind = molecule.value_kind;
        enrichedField.scalar_type = molecule.scalar_type;
        
        // Get dropdown values for lookup/list types
        if (isLookupMolecule(molecule) || isListMolecule(molecule)) {
          enrichedField.options = molecule.values || [];
        }
      }
      
      template.parsed_fields.push(enrichedField);
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

    // Get fields from new normalized table
    const fieldsQuery = `
      SELECT 
        field_id,
        row_number,
        molecule_key,
        start_position,
        display_width,
        field_width,
        enterable,
        system_generated,
        is_required,
        display_label,
        sort_order
      FROM input_template_field
      WHERE template_id = $1
      ORDER BY row_number, sort_order
    `;

    const fieldsResult = await dbClient.query(fieldsQuery, [templateId]);
    template.fields = fieldsResult.rows;

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
    const { tenant_id, template_name, activity_type, fields } = req.body;

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

    // Insert fields
    if (fields && fields.length > 0) {
      for (const field of fields) {
        const fieldQuery = `
          INSERT INTO input_template_field (
            template_id, row_number, molecule_key, start_position, display_width,
            field_width, enterable, system_generated, is_required, display_label, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        await dbClient.query(fieldQuery, [
          templateId,
          field.row_number,
          field.molecule_key,
          field.start_position,
          field.display_width,
          field.field_width || null,
          field.enterable || 'Y',
          field.system_generated || null,
          field.is_required || false,
          field.display_label || null,
          field.sort_order
        ]);
      }
    }

    debugLog(() => `✓ Created input template: ${template_name} (${activity_type})`);

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
    const { template_name, activity_type, fields } = req.body;

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

    // Delete old fields and insert new
    await dbClient.query('DELETE FROM input_template_field WHERE template_id = $1', [templateId]);

    if (fields && fields.length > 0) {
      for (const field of fields) {
        const fieldQuery = `
          INSERT INTO input_template_field (
            template_id, row_number, molecule_key, start_position, display_width,
            field_width, enterable, system_generated, is_required, display_label, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        await dbClient.query(fieldQuery, [
          templateId,
          field.row_number,
          field.molecule_key,
          field.start_position,
          field.display_width,
          field.field_width || null,
          field.enterable || 'Y',
          field.system_generated || null,
          field.is_required || false,
          field.display_label || null,
          field.sort_order
        ]);
      }
    }

    debugLog(() => `✓ Updated input template: ${template_name}`);

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

    debugLog(() => `✓ Activated input template for ${activityType}: ${result.rows[0].template_name}`);

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

    debugLog(() => `✓ Deleted input template: ${checkResult.rows[0].template_name}`);

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
    if (isListMolecule(molecule) && molecule.values && molecule.values.length > 0) {
      return res.json({ label: molecule.values[0].label });
    }
    
    // Handle scalar type molecules (like currency_label)
    if (isScalarMolecule(molecule) && molecule.value) {
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
  
  const client = await dbClient.connect();
  try {
    // Resolve member - member_id might be membership_number (customer-facing)
    const memberRec = await resolveMember(member_id, tenant_id);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    const actualTenantId = memberRec.tenant_id || tenant_id;
    
    if (!memberLink) {
      return res.status(500).json({ error: 'Member has no link' });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Lock member record
    const lockQuery = `SELECT link FROM member WHERE link = $1 FOR UPDATE`;
    await client.query(lockQuery, [memberLink]);
    
    // Calculate activity date as molecule date int (using fixed function)
    const todayInt = dateToMoleculeInt(activityDate);
    
    // Step 3: Get available buckets from table (FIFO by expiration date)
    const allBuckets = await getMemberPointBuckets(memberLink, actualTenantId);
    
    // Filter to unexpired buckets with available points, sort by expiration date
    const availableBuckets = allBuckets
      .filter(b => b.expire_date >= todayInt && (b.accrued - b.redeemed) > 0)
      .sort((a, b) => a.expire_date - b.expire_date)
      .map(b => ({
        link: b.link,
        rule_id: b.rule_id,
        expire_date_int: b.expire_date,
        accrued: b.accrued,
        redeemed: b.redeemed
      }));
    
    if (availableBuckets.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No available points found' });
    }
    
    // Step 4: Calculate breakdown (FIFO)
    const breakdown = [];
    let remaining = point_amount;
    let totalAvailable = 0;
    
    for (const bucket of availableBuckets) {
      const available = Number(bucket.accrued) - Number(bucket.redeemed);
      totalAvailable += available;
    }
    
    if (totalAvailable < point_amount) {
      await client.query('ROLLBACK');
      
      // Get E003 error message using helper function
      const errorMessage = await getErrorMessage('E003', actualTenantId);
      
      if (errorMessage) {
        return res.status(400).json({ error: errorMessage });
      }
      
      // E003 not found in molecule system
      return res.status(500).json({ error: 'System configuration error: E003 not found' });
    }
    
    for (const bucket of availableBuckets) {
      if (remaining <= 0) break;
      
      const available = Number(bucket.accrued) - Number(bucket.redeemed);
      const takeFromThis = Math.min(remaining, available);
      
      breakdown.push({
        link: bucket.link,
        points_used: takeFromThis,
        expire_date_int: bucket.expire_date_int
      });
      
      remaining -= takeFromThis;
    }
    
    // Step 5: Create redemption activity record
    const activityInsert = await insertActivity(actualTenantId, memberLink, activityDate, 'R');
    const activityLink = activityInsert.link;
    
    // Step 6: Store redemption type as molecule
    await insertActivityMolecule(null, await getMoleculeId(actualTenantId, 'redemption_type'), redemption_rule_id, null, activityLink);
    
    // Step 7: Update bucket redeemed amounts and create member_points molecules
    for (const item of breakdown) {
      // Increment redeemed on bucket
      await updatePointBucketRedeemed(item.link, item.points_used);
      
      // Create member_points molecule on activity (negative amount, links to bucket)
      await saveActivityPoints(null, item.link, -item.points_used, actualTenantId, activityLink);
    }
    
    // Commit transaction (releases lock)
    await client.query('COMMIT');
    
    debug(`✓ Processed redemption for member ${member_id}: ${point_amount} points from ${breakdown.length} bucket(s)`);
    
    // Record redemption statistics
    await recordRedemptionRedeemed(redemption_rule_id, point_amount, actualTenantId, activityDate);
    
    res.json({
      success: true,
      link: activityLink,
      points_redeemed: point_amount,
      buckets_used: breakdown.length,
      breakdown: breakdown.map(b => ({ link: b.link, points_used: b.points_used }))
    });
    
  } catch (error) {
    // Rollback on any error
    await client.query('ROLLBACK');
    console.error('Error processing redemption:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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

  const client = await dbClient.connect();
  try {
    const { tenant_id, partner_code, partner_name, is_active, programs } = req.body;

    if (!tenant_id || !partner_code || !partner_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Insert partner
    const partnerQuery = `
      INSERT INTO partner (tenant_id, partner_code, partner_name, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING partner_id
    `;
    const partnerResult = await client.query(partnerQuery, [
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
        await client.query(programQuery, [
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

    await client.query('COMMIT');

    res.json({
      success: true,
      partner_id: partnerId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating partner:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PUT - Update partner and programs
app.put('/v1/partners/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    const { id } = req.params;
    const { tenant_id, partner_code, partner_name, is_active, programs } = req.body;

    if (!tenant_id || !partner_code || !partner_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Update partner
    const partnerQuery = `
      UPDATE partner
      SET partner_code = $1,
          partner_name = $2,
          is_active = $3
      WHERE partner_id = $4 AND tenant_id = $5
    `;
    await client.query(partnerQuery, [
      partner_code,
      partner_name,
      is_active !== false,
      id,
      tenant_id
    ]);

    // Delete existing programs
    await client.query(
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
        await client.query(programQuery, [
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

    await client.query('COMMIT');

    res.json({ success: true });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating partner:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE - Delete partner and its programs
app.delete('/v1/partners/:id', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Delete programs first (foreign key)
    await client.query(
      'DELETE FROM partner_program WHERE partner_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    // Delete partner
    const result = await client.query(
      'DELETE FROM partner WHERE partner_id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({ success: true });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting partner:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});


// POST - Create partner activity
app.post('/v1/members/:memberId/activities/partner', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    // Resolve membership_number to internal member_id
    const membershipNumber = req.params.memberId;
    const tenantId = parseInt(req.body.tenant_id) || 1;
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    if (!memberLink) {
      return res.status(500).json({ error: 'Member has no link' });
    }
    
    await client.query('BEGIN');
    
    // Lock member record
    await client.query(`SELECT link FROM member WHERE link = $1 FOR UPDATE`, [memberLink]);
    
    const { activity_date, partner_id, program_id, point_amount } = req.body;

    // Validate required fields
    if (!activity_date || !partner_id || !program_id || !point_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    debugLog(() => `\n📝 Creating partner activity for member link ${memberLink}: activity_date=${activity_date}, partner_id=${partner_id}, program_id=${program_id}, point_amount=${point_amount}`);

    // Get molecule IDs
    const partnerMoleculeId = await getMoleculeId(tenantId, 'partner');
    const partnerProgramMoleculeId = await getMoleculeId(tenantId, 'partner_program');

    // Add points to molecule bucket (handles expiration, etc.)
    debugLog(() => `\n💰 Adding ${point_amount} points to bucket...`);
    let bucketResult;
    try {
      bucketResult = await addPointsToMoleculeBucket(memberLink, activity_date, point_amount, tenantId);
    } catch (error) {
      debugLog(() => `   ❌ Failed to add points to bucket: ${error.message}`);
      const errorMsg = await getErrorMessage('E002', tenantId);
      return res.status(400).json({ error: errorMsg });
    }

    // Create activity record
    const activityInsertResult = await insertActivity(tenantId, memberLink, activity_date, 'P');
    const activityLink = activityInsertResult.link;
    debugLog(() => `   ✓ Created activity ${activityLink}`);

    // Create molecule records in molecule_value_list
    await insertActivityMolecule(null, partnerMoleculeId, partner_id, null, activityLink);
    debugLog(() => `   ✓ Added partner molecule (partner_id: ${partner_id})`);
    
    await insertActivityMolecule(null, partnerProgramMoleculeId, program_id, null, activityLink);
    debugLog(() => `   ✓ Added partner_program molecule (program_id: ${program_id})`);

    // Save member_points molecule linking activity to bucket (uses new "5_data_54")
    await saveActivityPoints(null, bucketResult.bucket_link, point_amount, tenantId, activityLink);
    debugLog(() => `   ✓ Added member_points molecule (bucket: ${bucketResult.bucket_link}, amount: ${point_amount})`);

    // Evaluate promotions
    debugLog(() => `\n🎯 Evaluating promotions for partner activity ${activityLink}...`);
    const promotions = await evaluatePromotions(null, activity_date, memberLink, tenantId, activityLink);

    await client.query('COMMIT');

    res.json({
      success: true,
      link: activityLink,
      points_earned: point_amount,
      bucket_link: bucketResult.bucket_link,
      expire_date: bucketResult.expire_date,
      promotions_processed: promotions.length,
      promotions: promotions
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating partner activity:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST - Create adjustment activity
app.post('/v1/members/:memberId/activities/adjustment', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  const client = await dbClient.connect();
  try {
    // Resolve membership_number to internal member_id
    const membershipNumber = req.params.memberId;
    const tenantId = parseInt(req.body.tenant_id) || 1;
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;
    
    if (!memberLink) {
      return res.status(500).json({ error: 'Member has no link' });
    }
    
    await client.query('BEGIN');
    
    // Lock member record
    await client.query(`SELECT link FROM member WHERE link = $1 FOR UPDATE`, [memberLink]);
    
    const { activity_date, adjustment_id, point_amount, comment } = req.body;

    // Validate required fields
    if (!activity_date || !adjustment_id || !point_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    debugLog(() => `\n📝 Creating adjustment for member link ${memberLink}: activity_date=${activity_date}, adjustment_id=${adjustment_id}, point_amount=${point_amount}, comment=${comment ? comment.substring(0, 20) + '...' : '(none)'}`);

    // Get adjustment molecule ID
    const adjustmentMoleculeId = await getMoleculeId(tenantId, 'adjustment');

    // Handle positive vs negative adjustments
    let bucketResult = null;
    
    if (point_amount > 0) {
      // Positive adjustment - add points to bucket
      debugLog(() => `\n💰 Adding ${point_amount} points to bucket...`);
      try {
        bucketResult = await addPointsToMoleculeBucket(memberLink, activity_date, point_amount, tenantId);
      } catch (error) {
        debugLog(() => `   ❌ Failed to add points to bucket: ${error.message}`);
        const errorMsg = await getErrorMessage('E002', tenantId);
        return res.status(400).json({ error: errorMsg });
      }
    }
    // Note: Negative adjustments would need FIFO logic like redemptions
    // For now, just create the activity record

    // Create activity record
    const activityInsertResult = await insertActivity(tenantId, memberLink, activity_date, 'J');
    const activityLink = activityInsertResult.link;
    debugLog(() => `   ✓ Created activity ${activityLink}`);

    // Create molecule record for adjustment type
    await insertActivityMolecule(null, adjustmentMoleculeId, adjustment_id, null, activityLink);
    debugLog(() => `   ✓ Added adjustment molecule (adjustment_id: ${adjustment_id})`);

    // Save comment as molecule if provided
    if (comment && comment.trim()) {
      const commentMoleculeId = await getMoleculeId(tenantId, 'activity_comment');
      if (commentMoleculeId) {
        await insertActivityMolecule(null, commentMoleculeId, comment.trim(), null, activityLink);
        debugLog(() => `   ✓ Added activity_comment molecule`);
      }
    }

    // Save member_points molecule linking activity to bucket (for positive adjustments)
    if (bucketResult) {
      await saveActivityPoints(null, bucketResult.bucket_link, point_amount, tenantId, activityLink);
      debugLog(() => `   ✓ Added member_points molecule (bucket: ${bucketResult.bucket_link}, amount: ${point_amount})`);
    }

    // NOTE: Adjustments do NOT trigger promotions or bonuses - they are just point corrections

    await client.query('COMMIT');

    res.json({
      success: true,
      link: activityLink,
      points_earned: point_amount,
      bucket_link: bucketResult?.bucket_link || null,
      expire_date: bucketResult?.expire_date || null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating adjustment:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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
        comment_mode,
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
        comment_mode,
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
    const { tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, comment_mode, is_active } = req.body;

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
      INSERT INTO adjustment (tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, comment_mode, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING adjustment_id
    `;
    
    const result = await dbClient.query(query, [
      tenant_id,
      adjustment_code,
      adjustment_name,
      adjustment_type,
      adjustment_type === 'F' ? fixed_points : null,
      comment_mode || 'none',
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
    const { tenant_id, adjustment_code, adjustment_name, adjustment_type, fixed_points, comment_mode, is_active } = req.body;

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
          comment_mode = $5,
          is_active = $6
      WHERE adjustment_id = $7 AND tenant_id = $8
    `;
    
    await dbClient.query(query, [
      adjustment_code,
      adjustment_name,
      adjustment_type,
      adjustment_type === 'F' ? fixed_points : null,
      comment_mode || 'none',
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
        td.tier_description as reward_tier_name,
        md.label as counter_molecule_label
      FROM promotion p
      LEFT JOIN tier_definition td ON p.reward_tier_id = td.tier_id
      LEFT JOIN molecule_def md ON p.counter_molecule_id = md.molecule_id
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

    // Tier rewards require tier_id and duration_type
    let finalDurationType = duration_type;
    if (reward_type === 'tier') {
      if (!reward_tier_id) {
        return res.status(400).json({ error: 'reward_tier_id is required for tier rewards' });
      }
      // Default duration_type to 'calendar' if duration_end_date provided
      if (!finalDurationType && duration_end_date) {
        finalDurationType = 'calendar';
      }
      if (!finalDurationType || !['calendar', 'virtual'].includes(finalDurationType)) {
        return res.status(400).json({ error: 'duration_type (calendar or virtual) is required for tier rewards' });
      }
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
      finalDurationType || duration_type, duration_end_date, duration_days, counter_molecule_id
    ];

    const result = await dbClient.query(query, values);
    await loadCaches(); // Refresh cache
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

    // Tier rewards require tier_id and duration_type
    let finalDurationType = duration_type;
    if (reward_type === 'tier') {
      if (!reward_tier_id) {
        return res.status(400).json({ error: 'reward_tier_id is required for tier rewards' });
      }
      // Default duration_type to 'calendar' if duration_end_date provided
      if (!finalDurationType && duration_end_date) {
        finalDurationType = 'calendar';
      }
      if (!finalDurationType || !['calendar', 'virtual'].includes(finalDurationType)) {
        return res.status(400).json({ error: 'duration_type (calendar or virtual) is required for tier rewards' });
      }
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
      finalDurationType || duration_type, duration_end_date, duration_days, counter_molecule_id, tenant_id
    ];

    const result = await dbClient.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    await loadCaches(); // Refresh cache
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

    await loadCaches(); // Refresh cache
    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROMOTION CRITERIA ENDPOINTS
// ============================================

// GET - Get all criteria for a promotion
app.get('/v1/promotions/:promotionId/criteria', async (req, res) => {
  if (!dbClient) {
    return res.json([]);
  }
  
  try {
    const promotionId = parseInt(req.params.promotionId);
    
    // Get the rule_id for this promotion
    const promoQuery = 'SELECT rule_id FROM promotion WHERE promotion_id = $1';
    const promoResult = await dbClient.query(promoQuery, [promotionId]);
    
    if (promoResult.rows.length === 0 || !promoResult.rows[0].rule_id) {
      return res.json([]);
    }
    
    const ruleId = promoResult.rows[0].rule_id;
    
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
    
    // Transform to include source based on molecule context
    const criteria = result.rows.map(row => {
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
        molecule: row.molecule_key,
        operator: row.operator,
        value: row.value,
        label: row.label,
        joiner: row.joiner,
        sort_order: row.sort_order
      };
    });
    
    res.json(criteria);
  } catch (error) {
    console.error('Error fetching promotion criteria:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Add new criterion to a promotion
app.post('/v1/promotions/:promotionId/criteria', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const promotionId = parseInt(req.params.promotionId);
    const { source, molecule, operator, value, label } = req.body;
    
    // Validation
    if (!source || !molecule || !operator || !value || !label) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Convert molecule to molecule_key
    const molecule_key = molecule.toLowerCase().replace(/\s+/g, '_');
    
    // Get or create rule for this promotion
    const promoQuery = 'SELECT rule_id FROM promotion WHERE promotion_id = $1';
    const promoResult = await dbClient.query(promoQuery, [promotionId]);
    
    if (promoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    
    let ruleId = promoResult.rows[0].rule_id;
    
    // If no rule exists, create one
    if (!ruleId) {
      const createRuleQuery = `
        INSERT INTO rule DEFAULT VALUES
        RETURNING rule_id
      `;
      const ruleResult = await dbClient.query(createRuleQuery);
      ruleId = ruleResult.rows[0].rule_id;
      
      // Link rule to promotion
      const updatePromoQuery = 'UPDATE promotion SET rule_id = $1 WHERE promotion_id = $2';
      await dbClient.query(updatePromoQuery, [ruleId, promotionId]);
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
    
    await loadCaches(); // Refresh cache
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
    console.error('Error adding promotion criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update existing promotion criterion
app.put('/v1/promotions/:promotionId/criteria/:criteriaId', async (req, res) => {
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
    
    const molecule_key = molecule.toLowerCase().replace(/\s+/g, '_');
    
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
    
    await loadCaches(); // Refresh cache
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
    console.error('Error updating promotion criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update joiner for a promotion criterion
app.put('/v1/promotions/:promotionId/criteria/:criteriaId/joiner', async (req, res) => {
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
    
    await loadCaches(); // Refresh cache
    res.json({ message: 'Joiner updated' });
  } catch (error) {
    console.error('Error updating promotion joiner:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete promotion criterion
app.delete('/v1/promotions/:promotionId/criteria/:criteriaId', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }
  
  try {
    const promotionId = parseInt(req.params.promotionId);
    const criteriaId = parseInt(req.params.criteriaId);
    
    // Get rule_id for this promotion
    const promoQuery = 'SELECT rule_id FROM promotion WHERE promotion_id = $1';
    const promoResult = await dbClient.query(promoQuery, [promotionId]);
    
    if (promoResult.rows.length === 0 || !promoResult.rows[0].rule_id) {
      return res.status(404).json({ error: 'Promotion or rule not found' });
    }
    
    const ruleId = promoResult.rows[0].rule_id;
    
    // Delete the criterion
    const deleteQuery = 'DELETE FROM rule_criteria WHERE criteria_id = $1 AND rule_id = $2';
    await dbClient.query(deleteQuery, [criteriaId, ruleId]);
    
    await loadCaches(); // Refresh cache
    res.json({ message: 'Criterion deleted' });
  } catch (error) {
    console.error('Error deleting promotion criterion:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/members/:memberId/promotions - Get member's enrolled promotions with progress
app.get('/v1/members/:memberId/promotions', async (req, res) => {
  if (!dbClient) {
    return res.status(501).json({ error: 'Database not connected' });
  }

  try {
    const membershipNumber = req.params.memberId;
    const tenantId = parseInt(req.query.tenant_id) || 1;
    
    // Resolve membership_number to internal member_id
    const memberRec = await resolveMember(membershipNumber, tenantId);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;

    const query = `
      SELECT 
        mp.member_promotion_id,
        mp.p_link,
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
      WHERE mp.p_link = $1
      ORDER BY mp.enrolled_date DESC
    `;

    const result = await dbClient.query(query, [memberLink]);
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
    const membershipNumber = req.params.memberId;
    const { promotionId } = req.params;
    const { tenant_id, enrolled_by_user_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Resolve membership_number to internal link
    const memberRec = await resolveMember(membershipNumber, tenant_id);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;

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
      'SELECT * FROM member_promotion WHERE p_link = $1 AND promotion_id = $2 AND status IN ($3, $4)',
      [memberLink, promotionId, 'enrolled', 'qualified']
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Member already enrolled in this promotion' });
    }

    // Create enrollment
    const insertQuery = `
      INSERT INTO member_promotion (
        p_link, promotion_id, tenant_id, enrolled_date,
        progress_counter, status, enrolled_by_user_id
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 0, 'enrolled', $4
      )
      RETURNING *
    `;

    const result = await dbClient.query(insertQuery, [memberLink, promotionId, tenant_id, enrolled_by_user_id]);
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

  const client = await dbClient.connect();
  try {
    const membershipNumber = req.params.memberId;
    const { promotionId } = req.params;
    const { tenant_id, qualified_by_user_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Resolve membership_number to internal link
    const memberRec = await resolveMember(membershipNumber, tenant_id);
    if (!memberRec) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const memberLink = memberRec.link;

    // Get member_promotion record
    const mpQuery = await client.query(
      'SELECT * FROM member_promotion WHERE p_link = $1 AND promotion_id = $2 AND status = $3',
      [memberLink, promotionId, 'enrolled']
    );

    if (mpQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Member not enrolled in this promotion or already qualified' });
    }

    const memberPromotion = mpQuery.rows[0];

    // Get promotion details
    const promoQuery = await client.query(
      'SELECT * FROM promotion WHERE promotion_id = $1 AND tenant_id = $2',
      [promotionId, tenant_id]
    );

    if (promoQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    const promotion = promoQuery.rows[0];

    // Begin transaction for reward processing
    await client.query('BEGIN');

    try {
      // Update member_promotion to qualified
      const updateQuery = `
        UPDATE member_promotion SET
          qualify_date = CURRENT_DATE,
          status = 'qualified',
          qualified_by_user_id = $1,
          progress_counter = goal_amount
        WHERE member_promotion_id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [qualified_by_user_id, memberPromotion.member_promotion_id]);
      const qualifiedPromotion = updateResult.rows[0];

      // Process reward based on reward_type
      if (promotion.reward_type === 'points') {
        // Add points to molecule bucket
        const todayStr = new Date().toISOString().split('T')[0];
        const bucketResult = await addPointsToMoleculeBucket(memberLink, todayStr, promotion.reward_amount, tenant_id);

        // Create activity type 'M'
        const activityInsertResult = await insertActivity(tenant_id, memberLink, new Date(), 'M');
        const activityLink = activityInsertResult.link;

        // Get molecule IDs for linking
        const memberPromotionMoleculeId = await getMoleculeId(tenant_id, 'member_promotion');
        const promotionMoleculeId = await getMoleculeId(tenant_id, 'promotion');

        // Link activity to member_promotion (enrollment instance)
        await insertActivityMolecule(null, memberPromotionMoleculeId, memberPromotion.member_promotion_id, null, activityLink);

        // Link activity to promotion (for code and description)
        await insertActivityMolecule(null, promotionMoleculeId, promotion.promotion_id, null, activityLink);

        // Save member_points molecule using NEW storage
        await saveActivityPoints(null, bucketResult.bucket_link, promotion.reward_amount, tenant_id, activityLink);

        // Set process_date since points reward is instant
        await client.query(
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
          const endDateQuery = await client.query(
            `SELECT (CURRENT_DATE + $1::integer) as end_date`,
            [promotion.duration_days]
          );
          endDateValue = endDateQuery.rows[0].end_date;
          endDate = endDateValue;
        }

        // Create member_tier record
        const tierQuery = `
          INSERT INTO member_tier (
            p_link, tier_id, start_date, end_date
          ) VALUES (
            $1, $2, CURRENT_DATE, $3
          )
        `;
        
        await client.query(tierQuery, [memberLink, promotion.reward_tier_id, endDateValue]);

        // Cascade: Auto-qualify parallel tier pathways with same or shorter duration
        debugLog(() => `      🔄 Checking for parallel tier pathways to cascade...`);
        
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
            AND mp.p_link = $2
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
        
        const cascadeResult = await client.query(cascadeQuery, [
          qualified_by_user_id,              // $1 - qualified_by_user_id (CSR)
          memberLink,                        // $2 - p_link
          promotion.reward_tier_id,          // $3 - same tier only
          promotionId,                       // $4 - exclude this promotion
          promotionId,                       // $5 - qualified_by_promotion_id
          endDateValue,                      // $6 - for calendar comparison
          promotion.duration_days || 0       // $7 - for virtual comparison
        ]);
        
        if (cascadeResult.rowCount > 0) {
          debugLog(() => `      ✅ Cascaded to ${cascadeResult.rowCount} parallel promotion(s)`);
        }

        // process_date stays NULL until kit is shipped (manual fulfillment)
      } else if (promotion.reward_type === 'enroll_promotion') {
        // Enroll member in target promotion
        if (promotion.reward_promotion_id) {
          const enrollQuery = `
            INSERT INTO member_promotion (
              p_link, promotion_id, tenant_id, enrolled_date,
              progress_counter, status
            )
            SELECT $1, $2, $3, CURRENT_DATE, 0, 'enrolled'
            WHERE NOT EXISTS (
              SELECT 1 FROM member_promotion 
              WHERE p_link = $1 AND promotion_id = $2
            )
          `;
          
          await client.query(enrollQuery, [memberLink, promotion.reward_promotion_id, tenant_id]);
        }

        // Set process_date for enroll_promotion type
        await client.query(
          'UPDATE member_promotion SET process_date = CURRENT_DATE, status = $1 WHERE member_promotion_id = $2',
          ['processed', memberPromotion.member_promotion_id]
        );
      } else if (promotion.reward_type === 'external') {
        // External rewards: process_date stays NULL until manual fulfillment
        // Status stays 'qualified' until processed
      }

      await client.query('COMMIT');
      res.json(qualifiedPromotion);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error qualifying member promotion:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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

// Toggle debug state (updates both memory and sysparm)
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
    await dbClient.query(`
      UPDATE sysparm_detail sd
      SET value = $1
      FROM sysparm s
      WHERE s.sysparm_id = sd.sysparm_id
        AND s.sysparm_key = 'debug'
        AND s.tenant_id = 1
        AND sd.category IS NULL
        AND sd.code IS NULL
    `, [value]);
    
    // Update memory variable
    DEBUG_ENABLED = enabled;
    
    console.log(`🐛 Debug: ${enabled ? 'ON' : 'OFF'}`);
    
    res.json({ 
      debug_enabled: DEBUG_ENABLED,
      message: `Debug logging ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error toggling debug:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET synchronous_commit status (database performance setting)
app.get('/v1/system/sync-commit', async (req, res) => {
  if (!dbClient) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const result = await dbClient.query('SHOW synchronous_commit');
    res.json({ synchronous_commit: result.rows[0].synchronous_commit });
  } catch (error) {
    console.error('Error getting sync commit:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT toggle synchronous_commit (database-level setting, persists)
app.put('/v1/system/sync-commit', async (req, res) => {
  if (!dbClient) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const { enabled, database } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    
    const targetDb = database || currentDatabaseName;
    const value = enabled ? 'on' : 'off';
    
    // Set at database level (persists until changed)
    await dbClient.query(`ALTER DATABASE "${targetDb}" SET synchronous_commit = ${value}`);
    
    // Also set for current session if it's the active database
    if (targetDb === currentDatabaseName) {
      await dbClient.query(`SET synchronous_commit = ${value}`);
    }
    
    debugLog(() => `💾 Synchronous commit ${enabled ? 'ENABLED (safe)' : 'DISABLED (fast)'} for database ${targetDb}`);
    
    res.json({ 
      synchronous_commit: value,
      database: targetDb,
      message: `Synchronous commit ${enabled ? 'enabled' : 'disabled'} for ${targetDb}`
    });
  } catch (error) {
    console.error('Error toggling sync commit:', error);
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
      core: ['member', 'activity', '5_data_1', '5_data_2', '5_data_3', '5_data_4', '5_data_5', '5_data_54', '5_data_2244'],
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
    
    debugLog(() => `VACUUM completed on ${description} in ${duration}ms`);
    
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
        d.datname as name,
        pg_size_pretty(pg_database_size(d.datname)) as size,
        COALESCE(
          (SELECT 'off' FROM pg_db_role_setting s 
           WHERE s.setdatabase = d.oid AND s.setrole = 0 
           AND array_to_string(s.setconfig, ',') LIKE '%synchronous_commit=off%'),
          'on'
        ) as sync_commit
      FROM pg_database d
      WHERE d.datistemplate = false
        AND d.datname NOT IN ('postgres', 'billjansen')
      ORDER BY d.datname
    `);
    
    // Build results array with member counts
    const databases = [];
    
    for (const db of dbResult.rows) {
      let memberCount = null;
      let tableCount = null;
      let activityCount = null;
      
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
          
          const activityResult = await dbClient.query(`
            SELECT count(*)::int as count FROM activity
          `);
          activityCount = activityResult.rows[0].count;
        } catch (e) {
          // member/activity table might not exist
          memberCount = null;
          activityCount = null;
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
          
          // Get activity count
          const activityResult = await tempClient.query(`
            SELECT count(*)::int as count FROM activity
          `);
          activityCount = activityResult.rows[0].count;
          
        } catch (e) {
          // Database might not have member/activity table or connection failed
          memberCount = null;
          activityCount = null;
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
        members: memberCount,
        activities: activityCount,
        sync_commit: db.sync_commit
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
    
    debugLog(() => `\n🔄 Switching database from '${currentDatabaseName}' to '${database}'...`);
    
    // Close current pool
    await dbClient.end();
    debugLog('   ✓ Closed connection to old database');
    
    // Create new pool
    dbClient = new pg.Pool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: database,
      port: DB_PORT,
      max: 20
    });
    
    // Test the new pool
    await dbClient.query('SELECT 1');
    currentDatabaseName = database;
    debugLog(() => `Database: ${dbClient ? `CONNECTED to ${currentDatabaseName}` : 'NOT CONNECTED - using mock data'}`);
    
    // Reload caches for new database
    await loadCaches();
    
    res.json({
      ok: true,
      message: `Successfully switched to database: ${database}`,
      database: database
    });
    
  } catch (error) {
    console.error('Error switching database:', error);
    
    // Try to reconnect to original database if switch failed
    try {
      dbClient = new pg.Pool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: originalDatabase,
        port: DB_PORT,
        max: 20
      });
      await dbClient.query('SELECT 1');
      currentDatabaseName = originalDatabase;
      debugLog(() => `   ⚠️  Reconnected to original database (${originalDatabase})`);
    } catch (reconnectError) {
      console.error('   ❌ Failed to reconnect:', reconnectError);
    }
    
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/admin/cache/refresh - Refresh reference data caches
app.post('/v1/admin/cache/refresh', async (req, res) => {
  try {
    await loadCaches();
    res.json({
      ok: true,
      message: 'Caches refreshed successfully',
      stats: {
        moleculeDef: caches.moleculeDef.size,
        moleculeDefById: caches.moleculeDefById.size,
        moleculeValueLookup: caches.moleculeValueLookup.size,
        moleculeValueText: caches.moleculeValueText.size,
        airports: caches.airports.size,
        airportsById: caches.airportsById.size,
        carriers: caches.carriers.size,
        carriersById: caches.carriersById.size,
        bonuses: caches.bonuses.size,
        promotions: caches.promotions.size,
        ruleCriteria: caches.ruleCriteria.size,
        expirationRules: caches.expirationRules.length
      }
    });
  } catch (error) {
    console.error('Error refreshing caches:', error);
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
    
    debugLog(() => `\n📋 Cloning database '${source}' → '${target}' (${type})...`);
    
    if (type === 'full') {
      // Full copy with data using template
      await dbClient.query(`CREATE DATABASE ${target} WITH TEMPLATE ${source}`);
      debugLog(() => `   ✓ Created full copy with data`);
      
    } else {
      // Schema only - use pg_dump and pg_restore
      try {
        // Create empty target database first
        await dbClient.query(`CREATE DATABASE ${target}`);
        debugLog(() => `   ✓ Created empty database`);
        
        // Build pg_dump command for schema only
        const dumpCmd = `pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${source} --schema-only --no-owner --no-acl`;
        const restoreCmd = `psql -h ${DB_HOST} -U ${DB_USER} -d ${target}`;
        
        debugLog(() => `   → Copying schema using pg_dump | psql...`);
        
        // Execute: pg_dump source | psql target
        await execAsync(`${dumpCmd} | ${restoreCmd}`);
        
        debugLog(() => `   ✓ Schema copied successfully`);
        
      } catch (pgError) {
        console.error(`   ⚠️  pg_dump failed:`, pgError.message);
        debugLog(() => `   ℹ️  Database created but schema not copied. You may need to configure PostgreSQL authentication.`);
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
    
    debugLog(() => `\n🗑️  Deleting database '${database}'...`);
    
    // Terminate connections to target database
    await dbClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [database]);
    
    debugLog(() => `   ✓ Terminated connections`);
    
    // Drop database
    await dbClient.query(`DROP DATABASE ${database}`);
    debugLog(() => `   ✓ Database deleted`);
    
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

// POST /v1/admin/database/rename - Rename a database
app.post('/v1/admin/database/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Both oldName and newName are required' });
    }
    
    // Prevent renaming system databases
    const protectedDbs = ['postgres', 'template0', 'template1'];
    if (protectedDbs.includes(oldName)) {
      return res.status(403).json({ error: 'Cannot rename system database' });
    }
    
    // Prevent renaming currently connected database
    if (currentDatabaseName === oldName) {
      return res.status(403).json({ error: 'Cannot rename currently connected database. Switch to another database first.' });
    }
    
    // Validate new name format
    if (!/^[a-z][a-z0-9_]*$/.test(newName)) {
      return res.status(400).json({ error: 'Database name must start with a letter and contain only lowercase letters, numbers, and underscores' });
    }
    
    debugLog(() => `\n✏️  Renaming database '${oldName}' to '${newName}'...`);
    
    // Terminate connections to target database
    await dbClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [oldName]);
    
    debugLog(() => `   ✓ Terminated connections`);
    
    // Rename database
    await dbClient.query(`ALTER DATABASE "${oldName}" RENAME TO "${newName}"`);
    debugLog(() => `   ✓ Database renamed`);
    
    res.json({
      ok: true,
      message: `Successfully renamed database: ${oldName} → ${newName}`,
      oldName,
      newName
    });
    
  } catch (error) {
    console.error('Error renaming database:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /v1/admin/clear-member-data - Delete all member "stuff" (activities, promotions, buckets) but NOT members
app.post('/v1/admin/clear-member-data', async (req, res) => {
  const client = await dbClient.connect();
  try {
    debugLog('\n🧹 Clearing member data (keeping members)...');
    
    await client.query('BEGIN');
    
    // Delete in order of dependencies
    const deletions = [
      { table: 'member_promotion_detail', result: null },
      { table: 'member_promotion', result: null },
      { table: 'member_point_bucket', result: null },
      { table: '"5_data_54"', result: null },
      { table: '"5_data_5"', result: null },
      { table: '"5_data_4"', result: null },
      { table: '"5_data_3"', result: null },
      { table: '"5_data_2"', result: null },
      { table: '"5_data_1"', result: null },
      { table: 'activity', result: null }
    ];
    
    for (const del of deletions) {
      const result = await client.query(`DELETE FROM ${del.table}`);
      del.result = result.rowCount;
      debugLog(() => `   ✓ Deleted ${result.rowCount} rows from ${del.table}`);
    }
    
    await client.query('COMMIT');
    
    // Get remaining member count
    const memberCount = await client.query('SELECT COUNT(*) as count FROM member');
    
    debugLog(() => `   ✓ Complete! Members preserved: ${memberCount.rows[0].count}`);
    
    res.json({
      ok: true,
      message: 'Member data cleared successfully',
      deletions: deletions.map(d => ({ table: d.table, deleted: d.result })),
      members_preserved: parseInt(memberCount.rows[0].count)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing member data:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ===== DATA LOADER API =====

// In-memory job tracker
const dataLoadJobs = new Map();
const stressTestJobs = new Map();
const apiStressTestJobs = new Map();

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
    
    debugLog(() => `\n🚀 Starting data load job ${jobId} for database ${config.database}`);
    debugLog(() => `   Members: ${config.memberCount.toLocaleString()}`);
    debugLog(() => `   Activities/member: ${config.activitiesPerMember}`);
    debugLog(() => `   Promotions/member: ${config.promotionsPerMember}`);
    
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
  const rate = elapsed > 0 ? job.membersCreated / elapsed : 0;
  const remaining = job.totalMembers - job.membersCreated;
  const eta = rate > 0 && remaining > 0 ? remaining / rate : 0;
  
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
  debugLog(() => `\n⏹ Stopped data load job ${jobId}`);
  
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
  const tenantId = config.tenantId || 1;
  const addMemberTiers = config.addMemberTiers || false;
  
  // Tier pattern configuration
  // Pattern 1 (50%): Silver only
  // Pattern 2 (25%): Silver + Gold
  // Pattern 3 (15%): Silver + Gold + Platinum
  // Pattern 4 (10%): Silver + Gold + Platinum + Diamond
  const tierPatterns = [
    { // Pattern 1: Silver only
      tiers: [
        { tier_id: 2, start_date: '2025-06-01', end_date: '2026-12-31' }
      ]
    },
    { // Pattern 2: Silver + Gold
      tiers: [
        { tier_id: 2, start_date: '2025-06-01', end_date: '2026-12-31' },
        { tier_id: 3, start_date: '2025-09-01', end_date: '2026-12-31' }
      ]
    },
    { // Pattern 3: Silver + Gold + Platinum
      tiers: [
        { tier_id: 2, start_date: '2025-06-01', end_date: '2026-12-31' },
        { tier_id: 3, start_date: '2025-09-01', end_date: '2026-12-31' },
        { tier_id: 4, start_date: '2025-10-01', end_date: '2026-12-31' }
      ]
    },
    { // Pattern 4: Silver + Gold + Platinum + Diamond
      tiers: [
        { tier_id: 2, start_date: '2025-06-01', end_date: '2026-12-31' },
        { tier_id: 3, start_date: '2025-09-01', end_date: '2026-12-31' },
        { tier_id: 4, start_date: '2025-10-01', end_date: '2026-12-31' },
        { tier_id: 7, start_date: '2025-11-01', end_date: '2026-12-31' }
      ]
    }
  ];
  
  // Select pattern based on weighted distribution: 50%, 25%, 15%, 10%
  const selectTierPattern = () => {
    const roll = Math.random() * 100;
    if (roll < 50) return tierPatterns[0];      // 50%
    if (roll < 75) return tierPatterns[1];      // 25%
    if (roll < 90) return tierPatterns[2];      // 15%
    return tierPatterns[3];                      // 10%
  };
  
  // Random string of N letters
  const randomLetters = (min, max, capitalize = false) => {
    const len = min + Math.floor(Math.random() * (max - min + 1));
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(97 + Math.floor(Math.random() * 26));
    return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  };
  
  const randomAddress = () => {
    const num = 1000 + Math.floor(Math.random() * 9000);
    return num + ' ' + randomLetters(4, 10, true);
  };
  
  const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  
  try {
    const numWorkers = config.concurrency || 4;
    const targetDatabase = currentDatabaseName;
    
    debugLog(() => `\n🚀 Starting member preload: ${config.memberCount.toLocaleString()} members, ${numWorkers} workers`);
    if (addMemberTiers) {
      debugLog(() => `   Member tiers: enabled (20% of members)`);
    }
    
    // Create worker connections
    const workers = [];
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
    
    // Shared counter
    let membersCreated = 0;
    let tiersAssigned = 0;
    const targetCount = config.memberCount;
    
    // Worker function
    const workerFn = async (client, workerId) => {
      while (job.status === 'running' && membersCreated < targetCount) {
        membersCreated++;
        const currentCount = membersCreated;
        
        try {
          const fname = randomLetters(4, 10, true);
          const lname = randomLetters(4, 10, true);
          const address1 = randomAddress();
          const city = randomLetters(4, 10, true);
          const state = states[Math.floor(Math.random() * states.length)];
          const zip = String(10000 + Math.floor(Math.random() * 90000));
          const phone = String(Math.floor(Math.random() * 9000000000) + 1000000000);
          const email = randomLetters(3, 10) + '@' + randomLetters(3, 8) + '.com';
          const membershipNumber = await getNextMembershipNumber(tenantId);
          const link = await getNextLink(tenantId, 'member');
          
          await client.query(`
            INSERT INTO member (link, tenant_id, fname, lname, address1, city, state, zip, phone, email, membership_number, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          `, [link, tenantId, fname, lname, address1, city, state, zip, phone, email, membershipNumber]);
          
          // Add member tiers for 20% of members
          if (addMemberTiers && Math.random() < 0.20) {
            const pattern = selectTierPattern();
            try {
              for (const tier of pattern.tiers) {
                await client.query(`
                  INSERT INTO member_tier (tier_id, start_date, end_date, p_link)
                  VALUES ($1, $2, $3, $4)
                `, [tier.tier_id, tier.start_date, tier.end_date, link]);
              }
              tiersAssigned++;
            } catch (tierErr) {
              console.error(`[TIER ERROR] ${tierErr.message}`);
            }
          }
          
          job.membersCreated = currentCount;
          job.currentMembershipNumber = membershipNumber;
          job.tiersAssigned = tiersAssigned;
          
        } catch (err) {
          console.error(`[Worker ${workerId}] Error: ${err.message}`);
          job.errors.push(err.message);
        }
      }
    };
    
    job.startTime = Date.now();
    job.tiersAssigned = 0;
    
    // Launch workers
    await Promise.all(workers.map((client, idx) => workerFn(client, idx)));
    
    // Close connections
    for (const client of workers) {
      try { await client.end(); } catch (e) {}
    }
    
    if (job.status === 'running') {
      job.status = 'complete';
    }
    
    debugLog(() => `\n✅ Member preload complete: ${job.membersCreated} members`);
    if (addMemberTiers) {
      debugLog(() => `   Tiers assigned: ${tiersAssigned} members`);
    }
    
  } catch (error) {
    console.error(`[ERROR] Job ${jobId} failed:`, error);
    job.status = 'error';
    job.errors.push(`FATAL: ${error.message}`);
  }
}

// OLD runDataLoadJob kept for reference - remove later
async function runDataLoadJob_OLD(jobId) {
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
    
    // Get the last membership_number for THIS TENANT to start from
    const maxMembershipResult = await dbClient.query(
      "SELECT MAX(membership_number::bigint) as max_num FROM member WHERE tenant_id = $1 AND membership_number IS NOT NULL AND membership_number != ''",
      [tenantId]
    );
    const startingNumber = parseInt(maxMembershipResult.rows[0]?.max_num || 0, 10) + 1;
    debugLog(() => `📊 Starting membership_number: ${startingNumber}`);
    
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
    const getMolId = async (key) => {
      const result = await dbClient.query('SELECT molecule_id FROM molecule_def WHERE molecule_key = $1 AND tenant_id = $2', [key, tenantId]);
      return result.rows[0]?.molecule_id;
    };
    
    const carrierMoleculeId = await getMolId('carrier');
    const originMoleculeId = await getMolId('origin');
    const destinationMoleculeId = await getMolId('destination');
    const fareClassMoleculeId = await getMolId('fare_class');
    const flightNumberMoleculeId = await getMolId('flight_number');
    const mqdMoleculeId = await getMolId('mqd');
    const bonusActivityIdMoleculeId = await getMolId('bonus_activity_id');
    const bonusRuleIdMoleculeId = await getMolId('bonus_rule_id');
    const memberPointBucketMoleculeId = await getMolId('member_point_bucket');
    const memberPointsMoleculeId = await getMolId('member_points');
    
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
    
    // Get expiration rules from database - use actual rule expiration dates
    const expirationRulesResult = await dbClient.query(
      `SELECT rule_id, expiration_date FROM point_expiration_rule WHERE tenant_id = $1 ORDER BY rule_id LIMIT 2`,
      [tenantId]
    );
    
    let bucket1RuleId = 1, bucket1ExpireInt;
    let bucket2RuleId = 1, bucket2ExpireInt;
    
    if (expirationRulesResult.rows.length >= 1) {
      bucket1RuleId = expirationRulesResult.rows[0].rule_id;
      bucket1ExpireInt = dateToMoleculeInt(expirationRulesResult.rows[0].expiration_date);
    } else {
      // Fallback if no rules exist
      const today = new Date();
      const bucket1ExpireDate = new Date(today);
      bucket1ExpireDate.setFullYear(bucket1ExpireDate.getFullYear() + 1);
      bucket1ExpireInt = dateToMoleculeInt(bucket1ExpireDate);
    }
    
    if (expirationRulesResult.rows.length >= 2) {
      bucket2RuleId = expirationRulesResult.rows[1].rule_id;
      bucket2ExpireInt = dateToMoleculeInt(expirationRulesResult.rows[1].expiration_date);
    } else {
      // Fallback - just use bucket1 values (single bucket per member)
      bucket2RuleId = bucket1RuleId;
      bucket2ExpireInt = bucket1ExpireInt;
    }
    
    debugLog(() => `   Bucket 1: rule_id=${bucket1RuleId}, expire_int=${bucket1ExpireInt}`);
    debugLog(() => `   Bucket 2: rule_id=${bucket2RuleId}, expire_int=${bucket2ExpireInt}`);
    
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
    
    debugLog(() => `   Creating ${numWorkers} worker connections to ${targetDatabase}`);
    
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
    
    debugLog(() => `   Created ${numWorkers} worker connections`);
    
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
            await workerClient.query('SET CONSTRAINTS ALL DEFERRED');  // Defer FK checks to COMMIT
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
          
          // Generate link first
          const memberLink = await getNextLink(tenantId, 'member');
          
          // Create member with link as PK
          await workerClient.query(`
            INSERT INTO member (
              link, tenant_id, fname, lname, middle_initial, email, is_active, membership_number,
              address1, address2, city, state, zip, zip_plus4, phone
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [
            memberLink,
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
          
          job.membersCreated++;
          job.currentMembershipNumber = memberNum;
          
          // Create 2 point buckets for this member in member_point_bucket table
          const bucket1Link = await getNextLink(tenantId, 'member_point_bucket');
          await workerClient.query(`
            INSERT INTO member_point_bucket (link, p_link, rule_id, expire_date, accrued, redeemed)
            VALUES ($1, $2, $3, $4, 0, 0)
          `, [bucket1Link, memberLink, bucket1RuleId, bucket1ExpireInt]);
          
          const bucket2Link = await getNextLink(tenantId, 'member_point_bucket');
          await workerClient.query(`
            INSERT INTO member_point_bucket (link, p_link, rule_id, expire_date, accrued, redeemed)
            VALUES ($1, $2, $3, $4, 0, 0)
          `, [bucket2Link, memberLink, bucket2RuleId, bucket2ExpireInt]);
          
          // Track bucket accrued amounts for this member
          let bucket1Accrued = 0;
          let bucket2Accrued = 0;
          
          // Enroll member in promotions
          const numPromos = config.promotionsPerMember > 0 ? Math.floor(config.promotionsPerMember * (0.8 + Math.random() * 0.4)) : 0;
          const memberPromotions = [];
          
          for (let p = 0; p < numPromos && promotions.length > 0; p++) {
            const promo = promotions[Math.floor(Math.random() * promotions.length)];
            const mpResult = await workerClient.query(`
              INSERT INTO member_promotion (p_link, promotion_id, tenant_id, enrolled_date, progress_counter, goal_amount)
              VALUES ($1, $2, $3, CURRENT_DATE, 0, $4)
              RETURNING member_promotion_id
            `, [memberLink, promo.promotion_id, tenantId, promo.goal_amount]);
            
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
            const activityDateStr = activityDate.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
            
            const isPartner = a < numPartner;
            const miles = 500 + Math.floor(Math.random() * 1000);
            
            // Randomly pick bucket 1 or 2
            const bucketRowNum = Math.random() < 0.5 ? 1 : 2;
            
            // Insert activity with link and p_link (memberLink already available)
            const activityInsertResult = await insertActivity(tenantId, memberLink, activityDateStr, isPartner ? 'P' : 'A', workerClient);
            const activityId = activityInsertResult.activity_id;
            const activityLink = activityInsertResult.link;
            job.activitiesPosted++;
            if (isPartner) job.partnerActivities++;
            
            // Insert activity molecules into molecule_value_list
            if (carrierMoleculeId) {
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [carrierMoleculeId, activityId, 'A', randomId(carrierMin, carrierMax)]
              );
            }
            if (originMoleculeId) {
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [originMoleculeId, activityId, 'A', randomId(airportMin, airportMax)]
              );
            }
            if (destinationMoleculeId) {
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [destinationMoleculeId, activityId, 'A', randomId(airportMin, airportMax)]
              );
            }
            if (fareClassMoleculeId && fareClassValueIds.length > 0) {
              const randomFareClassId = fareClassValueIds[Math.floor(Math.random() * fareClassValueIds.length)];
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [fareClassMoleculeId, activityId, 'A', randomFareClassId]
              );
            }
            if (flightNumberMoleculeId) {
              const randomFlightNumber = Math.floor(Math.random() * 9900) + 100;
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [flightNumberMoleculeId, activityId, 'A', randomFlightNumber]
              );
            }
            if (mqdMoleculeId) {
              const randomMqd = Math.floor(Math.random() * 1301) + 200;
              await workerClient.query(
                'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                [mqdMoleculeId, activityId, 'A', randomMqd]
              );
            }
            
            // Add member_points molecule linking activity to bucket
            // Col A = bucket_row_num, Col B = points
            await workerClient.query(`
              INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES
              ($1, $2, 1, 'A', $3),
              ($1, $2, 1, 'B', $4)
            `, [memberPointsMoleculeId, activityId, bucketRowNum, miles]);
            
            // Track accrued for this member's buckets
            if (bucketRowNum === 1) {
              bucket1Accrued += miles;
            } else {
              bucket2Accrued += miles;
            }
            
            // Bonuses - create type 'N' activities
            if (config.includeBonuses && bonusActivityIdMoleculeId && bonusRuleIdMoleculeId) {
              const numBonuses = Math.floor(Math.random() * 4);
              for (let b = 0; b < numBonuses; b++) {
                const bonusPoints = Math.floor(Math.random() * 500) + 100;
                const bonusId = randomId(bonusMin, bonusMax);
                
                // Create type 'N' bonus activity with link and p_link
                const bonusActivityInsert = await insertActivity(tenantId, memberLink, activityDateStr, 'N', workerClient);
                const bonusActivityId = bonusActivityInsert.activity_id;
                
                // Add bonus_rule_id molecule to bonus activity
                await workerClient.query(
                  'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                  [bonusRuleIdMoleculeId, bonusActivityId, 'A', bonusId]
                );
                
                // Add bonus_activity_id molecule to parent activity (pointer to child)
                await workerClient.query(
                  'INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES ($1, $2, 1, $3, $4)',
                  [bonusActivityIdMoleculeId, activityId, 'A', bonusActivityId]
                );
                
                // Add member_points molecule to bonus activity (same bucket as parent)
                await workerClient.query(`
                  INSERT INTO molecule_value_list (molecule_id, context_id, row_num, col, value) VALUES
                  ($1, $2, 1, 'A', $3),
                  ($1, $2, 1, 'B', $4)
                `, [memberPointsMoleculeId, bonusActivityId, bucketRowNum, bonusPoints]);
                
                // Track bonus accrued
                if (bucketRowNum === 1) {
                  bucket1Accrued += bonusPoints;
                } else {
                  bucket2Accrued += bonusPoints;
                }
                
                job.bonusesApplied++;
              }
            }
            
            // Link to promotions
            for (const mp of memberPromotions) {
              if (mp.activities_contributed < mp.target && Math.random() < 0.5) {
                await workerClient.query(`
                  INSERT INTO member_promotion_detail (member_promotion_id, activity_link, contribution_amount)
                  VALUES ($1, $2, $3)
                `, [mp.member_promotion_id, activityLink, miles]);
                mp.activities_contributed++;
                job.promotionDetails++;
              }
            }
          }
          
          // Update bucket accrued totals for this member
          if (bucket1Accrued > 0) {
            await workerClient.query(`
              UPDATE molecule_value_list SET value = $1
              WHERE molecule_id = $2 AND context_id = $3 AND row_num = 1 AND col = 'C'
            `, [bucket1Accrued, memberPointBucketMoleculeId, memberId]);
          }
          if (bucket2Accrued > 0) {
            await workerClient.query(`
              UPDATE molecule_value_list SET value = $1
              WHERE molecule_id = $2 AND context_id = $3 AND row_num = 2 AND col = 'C'
            `, [bucket2Accrued, memberPointBucketMoleculeId, memberId]);
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
    
    debugLog(() => `\n✅ Data load ${jobId} complete: ${job.membersCreated} members, ${job.activitiesPosted} activities`);
    
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
    config.port = PORT;  // Pass server port to child
    
    // Generate job ID
    const jobId = `stress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job tracking
    const job = {
      jobId: jobId,
      config: config,
      status: 'starting',
      startTime: Date.now(),
      total: config.accrualCount,
      completed: 0,
      success: 0,
      failures: 0,
      inFlight: 0,
      errors: [],
      childProcess: null
    };
    
    stressTestJobs.set(jobId, job);
    
    console.log(`\n🔥 Starting stress test job ${jobId} (child process)`);
    console.log(`   Accruals: ${config.accrualCount.toLocaleString()}`);
    console.log(`   Concurrency: ${config.concurrency}`);
    console.log(`   Date Range: ${config.dateFrom || '(default)'} to ${config.dateTo || '(default)'}`);
    
    // Spawn child process
    const scriptPath = path.join(__dirname, 'stress_client.js');
    const child = spawn('node', [scriptPath, JSON.stringify(config)], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    job.childProcess = child;
    job.status = 'running';
    job.startTime = Date.now();  // Reset start time after spawn
    
    // Parse progress from child stdout
    let buffer = '';
    child.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();  // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'progress') {
            job.completed = msg.completed;
            job.success = msg.success;
            job.failures = msg.failures;
            job.inFlight = msg.inFlight;
            job.errors = msg.errors || [];
            if (msg.status) job.status = msg.status;
          } else if (msg.type === 'status') {
            console.log(`   [Child] ${msg.message}`);
          } else if (msg.type === 'timer_start') {
            job.startTime = Date.now();  // Reset timer when actual work begins
          } else if (msg.type === 'worker_error') {
            console.error(`   [Worker error] ${msg.message}`);
          } else if (msg.type === 'done') {
            console.log(`✅ Stress test ${jobId} complete: ${msg.success} success, ${msg.failures} failures`);
            if (msg.responseStats) {
              const s = msg.responseStats;
              console.log(`   Response times (ms): min=${s.min}, avg=${s.avg}, p95=${s.p95}, p99=${s.p99}, max=${s.max}`);
              job.responseStats = s;
            }
            if (msg.errors && msg.errors.length > 0) {
              console.log(`   Errors: ${msg.errors.join(', ')}`);
            }
            job.status = 'complete';
          } else if (msg.type === 'error') {
            console.error(`❌ Stress test ${jobId} error: ${msg.message}`);
            job.status = 'error';
            job.errors.push(msg.message);
          }
        } catch (e) {
          // Non-JSON output, just log it
          if (line.trim()) console.log(`   [Child] ${line}`);
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      console.error(`   [Child stderr] ${data.toString()}`);
    });
    
    child.on('close', (code) => {
      console.log(`   [Child] Process exited with code ${code}`);
      if (job.status === 'running') {
        job.status = code === 0 ? 'complete' : 'error';
      }
      job.childProcess = null;
    });
    
    res.json({
      ok: true,
      jobId: jobId,
      message: 'Stress test started (child process)'
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
    errors: job.errors,
    responseStats: job.responseStats || null
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
  
  // Kill child process if running
  if (job.childProcess) {
    job.childProcess.kill('SIGTERM');
    console.log(`\n⏹ Stopped stress test job ${jobId} (killed child process)`);
  } else {
    console.log(`\n⏹ Stopped stress test job ${jobId}`);
  }
  
  res.json({
    ok: true,
    message: 'Job stopped'
  });
});

// Stress test background job runner - Uses REAL business logic
async function runStressTestJob(jobId) {
  const job = stressTestJobs.get(jobId);
  if (!job) return;
  
  const { config } = job;
  const tenantId = config.tenantId || 1;
  
  try {
    // Get actual membership numbers (what members use in the real world)
    const memberResult = await dbClient.query('SELECT membership_number FROM member WHERE tenant_id = $1 AND membership_number IS NOT NULL', [tenantId]);
    const membershipNumbers = memberResult.rows.map(r => r.membership_number);
    if (membershipNumbers.length === 0) {
      throw new Error('No members found in database');
    }
    debugLog(() => `   Loaded ${membershipNumbers.length} membership numbers`);
    
    // Helper to load lookup values using CACHE
    const loadLookupCodes = (moleculeKey) => {
      const molDef = caches.moleculeDef.get(`${tenantId}:${moleculeKey}`);
      if (!molDef) return [];
      
      const metadata = caches.moleculeValueLookup.get(molDef.molecule_id);
      if (!metadata) return [];
      
      // Use cached lookup tables
      if (metadata.table_name === 'airports') {
        return Array.from(caches.airports.values()).map(a => a.code);
      } else if (metadata.table_name === 'carriers') {
        return Array.from(caches.carriers.values())
          .filter(c => !metadata.is_tenant_specific || c.tenant_id === tenantId)
          .map(c => c.code);
      }
      return [];
    };
    
    // Load actual codes using lookup metadata
    const carrierCodes = loadLookupCodes('carrier');
    if (carrierCodes.length === 0) carrierCodes.push('DL');
    debugLog(() => `   Loaded ${carrierCodes.length} carrier codes`);
    
    const airportCodes = loadLookupCodes('origin'); // origin and destination use same table
    if (airportCodes.length === 0) airportCodes.push('MSP', 'DTW');
    debugLog(() => `   Loaded ${airportCodes.length} airport codes`);
    
    // Load actual fare class CODES from list molecule
    const fareClassResult = await dbClient.query(`
      SELECT mvt.text_value 
      FROM molecule_value_text mvt
      JOIN molecule_def md ON mvt.molecule_id = md.molecule_id
      WHERE md.molecule_key = 'fare_class' AND md.tenant_id = $1
    `, [tenantId]);
    const fareClassCodes = fareClassResult.rows.map(r => r.text_value);
    if (fareClassCodes.length === 0) fareClassCodes.push('Y', 'F', 'J');
    debugLog(() => `   Loaded ${fareClassCodes.length} fare class codes`);
    
    const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Number of concurrent workers
    const numWorkers = config.concurrency || 4;
    
    debugLog(() => `   Using ${numWorkers} concurrent workers`);
    
    // Shared work counter
    let nextWork = 0;
    const getNextWork = () => {
      if (nextWork >= config.accrualCount) return null;
      return nextWork++;
    };
    
    // Worker function - POSTs to API endpoint
    const workerFn = async (workerId) => {
      while (job.status === 'running') {
        const workIndex = getNextWork();
        if (workIndex === null) break;
        
        job.inFlight++;
        
        try {
          // Random member
          const membershipNumber = randomPick(membershipNumbers);
          
          // Random date within configured range
          let dateStr;
          if (config.dateFrom && config.dateTo) {
            // Parse as local dates
            const [fromY, fromM, fromD] = config.dateFrom.split('-').map(Number);
            const [toY, toM, toD] = config.dateTo.split('-').map(Number);
            const fromDate = new Date(fromY, fromM - 1, fromD);
            const toDate = new Date(toY, toM - 1, toD);
            const dayRange = Math.floor((toDate - fromDate) / (24 * 60 * 60 * 1000));
            const randomDays = randomInt(0, Math.max(0, dayRange));
            const activityDate = new Date(fromDate);
            activityDate.setDate(activityDate.getDate() + randomDays);
            dateStr = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}`;
          } else {
            // Fallback: use dateRangeMonths
            const dateRangeMonths = config.dateRangeMonths || 24;
            const maxDaysAgo = dateRangeMonths * 30;
            const daysAgo = randomInt(0, maxDaysAgo);
            const activityDate = new Date();
            activityDate.setDate(activityDate.getDate() - daysAgo);
            dateStr = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}`;
          }
          
          // Random flight data
          const activityData = {
            activity_date: dateStr,
            tenant_id: tenantId,
            carrier: randomPick(carrierCodes),
            origin: randomPick(airportCodes),
            destination: randomPick(airportCodes),
            fare_class: randomPick(fareClassCodes),
            flight_number: randomInt(100, 9999),
            mqd: randomInt(200, 1500)
          };
          
          // POST to API endpoint (unless dry run)
          if (!config.dryRun) {
            const response = await fetch(`http://127.0.0.1:${PORT}/v1/members/${membershipNumber}/accruals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(activityData)
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || `HTTP ${response.status}`);
            }
          }
          
          job.success++;
        } catch (error) {
          job.failures++;
          if (job.errors.length < 10) {
            job.errors.push(error.message);
          }
          console.error(`   Worker ${workerId} error:`, error.message, error.cause || '');
        }
        
        job.completed++;
        job.inFlight--;
      }
    };
    
    // Launch all workers - reset start time so setup isn't counted
    job.startTime = Date.now();
    const workerPromises = [];
    for (let i = 0; i < numWorkers; i++) {
      workerPromises.push(workerFn(i));
    }
    await Promise.all(workerPromises);
    
    if (job.status === 'running') {
      job.status = 'complete';
    }
    
    debugLog(() => `\n✅ Stress test ${jobId} complete: ${job.success} success, ${job.failures} failures`);
    
  } catch (error) {
    console.error(`[ERROR] Stress test ${jobId} failed:`, error);
    job.status = 'error';
    job.errors.push(`FATAL: ${error.message}`);
  }
}

// =====================================================
// API STRESS TEST - Test endpoint performance
// =====================================================

// POST /v1/admin/api-stress-test/start - Start API stress test job
app.post('/v1/admin/api-stress-test/start', async (req, res) => {
  try {
    const config = req.body;
    
    // Generate job ID
    const jobId = `api_stress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job tracking
    const job = {
      jobId: jobId,
      config: config,
      status: 'running',
      startTime: Date.now(),
      total: config.requestCount,
      completed: 0,
      success: 0,
      failures: 0,
      inFlight: 0,
      totalResponseTime: 0,
      errors: []
    };
    
    apiStressTestJobs.set(jobId, job);
    
    debugLog(() => `\n⚡ Starting API stress test job ${jobId}`);
    debugLog(() => `   Endpoint: ${config.endpoint}`);
    debugLog(() => `   Requests: ${config.requestCount.toLocaleString()}`);
    debugLog(() => `   Concurrency: ${config.concurrency}`);
    
    // Start the background job
    runApiStressTestJob(jobId).catch(error => {
      console.error(`API stress test ${jobId} failed:`, error);
      job.status = 'error';
      job.errors.push(error.message);
    });
    
    res.json({
      ok: true,
      jobId: jobId,
      message: 'API stress test started'
    });
    
  } catch (error) {
    console.error('Error starting API stress test:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /v1/admin/api-stress-test/progress/:jobId - Get job progress
app.get('/v1/admin/api-stress-test/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = apiStressTestJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const elapsed = (Date.now() - job.startTime) / 1000;
  const percentage = job.total > 0 ? (job.completed / job.total * 100) : 0;
  const rate = elapsed > 0 ? job.completed / elapsed : 0;
  const remaining = job.total - job.completed;
  const eta = rate > 0 && remaining > 0 ? remaining / rate : 0;
  const avgResponseTime = job.completed > 0 ? job.totalResponseTime / job.completed : 0;
  
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
    avgResponseTime: avgResponseTime,
    errors: job.errors
  });
});

// POST /v1/admin/api-stress-test/stop/:jobId - Stop a running job
app.post('/v1/admin/api-stress-test/stop/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = apiStressTestJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  job.status = 'stopped';
  debugLog(() => `\n⏹ Stopped API stress test job ${jobId}`);
  
  res.json({
    ok: true,
    message: 'Job stopped'
  });
});

// API stress test background job runner
async function runApiStressTestJob(jobId) {
  const job = apiStressTestJobs.get(jobId);
  if (!job) return;
  
  const { config } = job;
  const tenantId = config.tenantId || 1;
  const endpoint = config.endpoint || 'member-profile';
  
  try {
    // Load membership numbers for random selection
    const memberResult = await dbClient.query(
      'SELECT membership_number, link FROM member WHERE tenant_id = $1 AND membership_number IS NOT NULL',
      [tenantId]
    );
    const members = memberResult.rows;
    if (members.length === 0) {
      throw new Error('No members found in database');
    }
    debugLog(() => `   Loaded ${members.length} members`);
    
    const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    // Number of concurrent workers
    const numWorkers = config.concurrency || 10;
    debugLog(() => `   Using ${numWorkers} concurrent workers`);
    
    // Shared work counter
    let nextWork = 0;
    const getNextWork = () => {
      if (nextWork >= config.requestCount) return null;
      return nextWork++;
    };
    
    // Worker function - calls the appropriate API function directly
    const workerFn = async (workerId) => {
      while (job.status === 'running') {
        const workIndex = getNextWork();
        if (workIndex === null) break;
        
        job.inFlight++;
        const startTime = Date.now();
        
        try {
          // Random member
          const member = randomPick(members);
          
          if (endpoint === 'member-profile') {
            // Call the same logic as GET /v1/member/:id/profile
            const memberLink = member.link;
            const today = new Date().toISOString().slice(0, 10);
            
            // Get tier
            const tierResult = await getMemberTierOnDate(memberLink, today);
            
            // Get available miles
            let availableMiles = 0;
            if (memberLink) {
              const rows = await getMemberPointBuckets(memberLink, tenantId);
              availableMiles = rows
                .map(r => ({
                  expiry_date: moleculeIntToDate(r.expire_date).toISOString().slice(0, 10),
                  net_balance: r.accrued - r.redeemed
                }))
                .filter(b => b.expiry_date >= today)
                .reduce((sum, b) => sum + Math.max(0, b.net_balance), 0);
            }
            
            // We just computed the profile - success!
          }
          
          job.success++;
          job.totalResponseTime += (Date.now() - startTime);
          
        } catch (error) {
          job.failures++;
          job.totalResponseTime += (Date.now() - startTime);
          if (job.errors.length < 10) {
            job.errors.push(error.message);
          }
        }
        
        job.completed++;
        job.inFlight--;
      }
    };
    
    // Launch all workers - reset start time so setup isn't counted
    job.startTime = Date.now();
    const workerPromises = [];
    for (let i = 0; i < numWorkers; i++) {
      workerPromises.push(workerFn(i));
    }
    await Promise.all(workerPromises);
    
    if (job.status === 'running') {
      job.status = 'complete';
    }
    
    const elapsed = (Date.now() - job.startTime) / 1000;
    const rate = elapsed > 0 ? (job.completed / elapsed).toFixed(1) : 0;
    const avgResponse = job.completed > 0 ? (job.totalResponseTime / job.completed).toFixed(1) : 0;
    
    debugLog(() => `\n✅ API stress test ${jobId} complete: ${job.success} success, ${job.failures} failures`);
    debugLog(() => `   Rate: ${rate} req/sec, Avg response: ${avgResponse}ms`);
    
  } catch (error) {
    console.error(`[ERROR] API stress test ${jobId} failed:`, error);
    job.status = 'error';
    job.errors.push(`FATAL: ${error.message}`);
  }
}

// =====================================================
// SYSPARM API - System Parameters
// =====================================================

// GET all sysparms for a tenant
app.get('/v1/sysparms', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const result = await dbClient.query(
      `SELECT sysparm_id, tenant_id, sysparm_key, value_type, description
       FROM sysparm
       WHERE tenant_id = $1
       ORDER BY sysparm_key`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sysparms:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single sysparm with details
app.get('/v1/sysparms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenant_id || 1;
    
    const sysparmResult = await dbClient.query(
      `SELECT sysparm_id, tenant_id, sysparm_key, value_type, description
       FROM sysparm
       WHERE sysparm_id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    
    if (sysparmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sysparm not found' });
    }
    
    const detailsResult = await dbClient.query(
      `SELECT detail_id, category, code, value, sort_order
       FROM sysparm_detail
       WHERE sysparm_id = $1
       ORDER BY sort_order, category, code`,
      [id]
    );
    
    res.json({
      ...sysparmResult.rows[0],
      details: detailsResult.rows
    });
  } catch (error) {
    console.error('Error fetching sysparm:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET sysparm by key
app.get('/v1/sysparms/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const tenantId = req.query.tenant_id || 1;
    
    const sysparmResult = await dbClient.query(
      `SELECT sysparm_id, tenant_id, sysparm_key, value_type, description
       FROM sysparm
       WHERE sysparm_key = $1 AND tenant_id = $2`,
      [key, tenantId]
    );
    
    if (sysparmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sysparm not found' });
    }
    
    const detailsResult = await dbClient.query(
      `SELECT detail_id, category, code, value, sort_order
       FROM sysparm_detail
       WHERE sysparm_id = $1
       ORDER BY sort_order, category, code`,
      [sysparmResult.rows[0].sysparm_id]
    );
    
    res.json({
      ...sysparmResult.rows[0],
      details: detailsResult.rows
    });
  } catch (error) {
    console.error('Error fetching sysparm by key:', error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE sysparm
app.post('/v1/sysparms', async (req, res) => {
  const client = await dbClient.connect();
  try {
    const { tenant_id, sysparm_key, value_type, description, details } = req.body;
    
    if (!tenant_id || !sysparm_key || !value_type) {
      return res.status(400).json({ error: 'tenant_id, sysparm_key, and value_type are required' });
    }
    
    await client.query('BEGIN');
    
    const sysparmResult = await client.query(
      `INSERT INTO sysparm (tenant_id, sysparm_key, value_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING sysparm_id`,
      [tenant_id, sysparm_key, value_type, description || null]
    );
    
    const sysparmId = sysparmResult.rows[0].sysparm_id;
    
    // Insert details if provided
    if (details && Array.isArray(details)) {
      for (const detail of details) {
        await client.query(
          `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [sysparmId, detail.category || null, detail.code || null, detail.value, detail.sort_order || 0]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json({ sysparm_id: sysparmId, message: 'Sysparm created' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sysparm:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// UPDATE sysparm
app.put('/v1/sysparms/:id', async (req, res) => {
  const client = await dbClient.connect();
  try {
    const { id } = req.params;
    const { sysparm_key, value_type, description, details } = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      `UPDATE sysparm
       SET sysparm_key = COALESCE($1, sysparm_key),
           value_type = COALESCE($2, value_type),
           description = COALESCE($3, description)
       WHERE sysparm_id = $4`,
      [sysparm_key, value_type, description, id]
    );
    
    // Replace details if provided
    if (details && Array.isArray(details)) {
      await client.query('DELETE FROM sysparm_detail WHERE sysparm_id = $1', [id]);
      
      for (const detail of details) {
        await client.query(
          `INSERT INTO sysparm_detail (sysparm_id, category, code, value, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, detail.category || null, detail.code || null, detail.value, detail.sort_order || 0]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Sysparm updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating sysparm:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE sysparm
app.delete('/v1/sysparms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbClient.query('DELETE FROM sysparm WHERE sysparm_id = $1', [id]);
    res.json({ message: 'Sysparm deleted' });
  } catch (error) {
    console.error('Error deleting sysparm:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET sysparm value (convenience endpoint for simple scalars)
app.get('/v1/sysparms/key/:key/value', async (req, res) => {
  try {
    const { key } = req.params;
    const tenantId = req.query.tenant_id || 1;
    const category = req.query.category || null;
    const code = req.query.code || null;
    
    const result = await dbClient.query(
      `SELECT sd.value, s.value_type
       FROM sysparm s
       JOIN sysparm_detail sd ON s.sysparm_id = sd.sysparm_id
       WHERE s.sysparm_key = $1 AND s.tenant_id = $2
         AND (sd.category = $3 OR ($3 IS NULL AND sd.category IS NULL))
         AND (sd.code = $4 OR ($4 IS NULL AND sd.code IS NULL))
       LIMIT 1`,
      [key, tenantId, category, code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }
    
    const row = result.rows[0];
    let value = row.value;
    
    // Type coercion
    if (row.value_type === 'numeric') {
      value = parseFloat(value);
    } else if (row.value_type === 'boolean') {
      value = value === 'true' || value === '1';
    }
    
    res.json({ value });
  } catch (error) {
    console.error('Error fetching sysparm value:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT sysparm value (upsert)
app.put('/v1/sysparms/key/:key/value', async (req, res) => {
  const client = await dbClient.connect();
  try {
    const { key } = req.params;
    const { tenant_id, value, value_type, category, code } = req.body;
    const tenantId = tenant_id || 1;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    await client.query('BEGIN');
    
    // Get or create sysparm
    let sysparmResult = await client.query(
      `SELECT sysparm_id, value_type FROM sysparm WHERE sysparm_key = $1 AND tenant_id = $2`,
      [key, tenantId]
    );
    
    let sysparmId;
    let existingValueType;
    
    if (sysparmResult.rows.length === 0) {
      // Create new sysparm
      const vType = value_type || (typeof value === 'number' ? 'numeric' : 'text');
      const insertResult = await client.query(
        `INSERT INTO sysparm (tenant_id, sysparm_key, value_type) VALUES ($1, $2, $3) RETURNING sysparm_id`,
        [tenantId, key, vType]
      );
      sysparmId = insertResult.rows[0].sysparm_id;
    } else {
      sysparmId = sysparmResult.rows[0].sysparm_id;
      existingValueType = sysparmResult.rows[0].value_type;
    }
    
    // Upsert detail - handle NULL category/code
    const cat = category || null;
    const cod = code || null;
    
    // Check if detail exists
    const existingDetail = await client.query(
      `SELECT detail_id FROM sysparm_detail 
       WHERE sysparm_id = $1 
         AND (category = $2 OR (category IS NULL AND $2 IS NULL))
         AND (code = $3 OR (code IS NULL AND $3 IS NULL))`,
      [sysparmId, cat, cod]
    );
    
    if (existingDetail.rows.length > 0) {
      // Update
      await client.query(
        `UPDATE sysparm_detail SET value = $1 WHERE detail_id = $2`,
        [String(value), existingDetail.rows[0].detail_id]
      );
    } else {
      // Insert
      await client.query(
        `INSERT INTO sysparm_detail (sysparm_id, category, code, value) VALUES ($1, $2, $3, $4)`,
        [sysparmId, cat, cod, String(value)]
      );
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Value saved', key, value });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving sysparm value:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ===== MEMBER ALIAS ENDPOINTS =====

// List alias composites (alias types) for tenant
app.get('/v1/alias-composites', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const tenantId = req.query.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
  
  try {
    const result = await dbClient.query(`
      SELECT ac.link, ac.composite_code, ac.composite_name, ac.is_active,
             COUNT(acd.link) as molecule_count
      FROM alias_composite ac
      LEFT JOIN alias_composite_detail acd ON ac.link = acd.p_link
      WHERE ac.tenant_id = $1
      GROUP BY ac.link, ac.composite_code, ac.composite_name, ac.is_active
      ORDER BY ac.composite_name
    `, [tenantId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing alias composites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single alias composite with details
app.get('/v1/alias-composites/:link', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { link } = req.params;
  const tenantId = req.query.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
  
  try {
    const compositeResult = await dbClient.query(`
      SELECT link, composite_code, composite_name, is_active
      FROM alias_composite
      WHERE link = $1 AND tenant_id = $2
    `, [link, tenantId]);
    
    if (compositeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alias composite not found' });
    }
    
    const detailsResult = await dbClient.query(`
      SELECT acd.link, acd.molecule_id, acd.is_required, acd.is_key, acd.sort_order,
             md.molecule_key, md.label AS molecule_label
      FROM alias_composite_detail acd
      JOIN molecule_def md ON acd.molecule_id = md.molecule_id
      WHERE acd.p_link = $1
      ORDER BY acd.sort_order
    `, [link]);
    
    res.json({
      ...compositeResult.rows[0],
      details: detailsResult.rows
    });
  } catch (error) {
    console.error('Error getting alias composite:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create alias composite
app.post('/v1/alias-composites', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { tenant_id, composite_code, composite_name, is_active, details } = req.body;
  if (!tenant_id || !composite_code || !composite_name) {
    return res.status(400).json({ error: 'tenant_id, composite_code, and composite_name required' });
  }
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Get next link for alias_composite
    const compositeLink = await getNextLink(tenant_id, 'alias_composite');
    
    await client.query(`
      INSERT INTO alias_composite (link, tenant_id, composite_code, composite_name, is_active)
      VALUES ($1, $2, $3, $4, $5)
    `, [compositeLink, tenant_id, composite_code, composite_name, is_active !== false]);
    
    // Insert details if provided
    if (details && details.length > 0) {
      for (const detail of details) {
        const detailLink = await getNextLink(tenant_id, 'alias_composite_detail');
        await client.query(`
          INSERT INTO alias_composite_detail (link, p_link, molecule_id, is_required, is_key, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [detailLink, compositeLink, detail.molecule_id, detail.is_required || false, detail.is_key || false, detail.sort_order || 1]);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json({ link: compositeLink, message: 'Alias composite created' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating alias composite:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update alias composite
app.put('/v1/alias-composites/:link', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { link } = req.params;
  const { tenant_id, composite_code, composite_name, is_active, details } = req.body;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      UPDATE alias_composite 
      SET composite_code = COALESCE($1, composite_code),
          composite_name = COALESCE($2, composite_name),
          is_active = COALESCE($3, is_active)
      WHERE link = $4 AND tenant_id = $5
    `, [composite_code, composite_name, is_active, link, tenant_id]);
    
    // Replace details if provided
    if (details !== undefined) {
      await client.query('DELETE FROM alias_composite_detail WHERE p_link = $1', [link]);
      
      for (const detail of details) {
        const detailLink = await getNextLink(tenant_id, 'alias_composite_detail');
        await client.query(`
          INSERT INTO alias_composite_detail (link, p_link, molecule_id, is_required, is_key, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [detailLink, link, detail.molecule_id, detail.is_required || false, detail.is_key || false, detail.sort_order || 1]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Alias composite updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating alias composite:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete alias composite
app.delete('/v1/alias-composites/:link', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { link } = req.params;
  const tenantId = req.query.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
  
  try {
    // Check if any aliases use this composite
    const usageCheck = await dbClient.query(
      'SELECT COUNT(*) as count FROM member_alias WHERE alias_type_link = $1',
      [link]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete: alias type is in use by member aliases' });
    }
    
    await dbClient.query(
      'DELETE FROM alias_composite WHERE link = $1 AND tenant_id = $2',
      [link, tenantId]
    );
    
    res.json({ message: 'Alias composite deleted' });
  } catch (error) {
    console.error('Error deleting alias composite:', error);
    res.status(500).json({ error: error.message });
  }
});

// List aliases for a member
app.get('/v1/members/:memberLink/aliases', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const memberLinkParam = req.params.memberLink;
  const tenantId = req.query.tenant_id;
  const membershipNumber = req.query.membership_number;  // Alternative identifier
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
  
  try {
    // If membership_number provided, resolve it to a link
    let memberLink = memberLinkParam;
    if (membershipNumber) {
      const memberResult = await dbClient.query(
        'SELECT link FROM member WHERE membership_number = $1 AND tenant_id = $2',
        [membershipNumber, tenantId]
      );
      if (memberResult.rows.length > 0) {
        memberLink = memberResult.rows[0].link;
      } else {
        return res.json([]);  // No member found
      }
    }
    
    const result = await dbClient.query(`
      SELECT ma.link, ma.alias_value, ma.key_molecule_id, ma.key_ref, ma.alias_type_link,
             ac.composite_code, ac.composite_name,
             md.molecule_key, md.label AS molecule_label
      FROM member_alias ma
      JOIN alias_composite ac ON ma.alias_type_link = ac.link
      LEFT JOIN molecule_def md ON ma.key_molecule_id = md.molecule_id
      WHERE ma.p_link = $1 AND ma.tenant_id = $2
      ORDER BY ac.composite_name, ma.alias_value
    `, [memberLink, tenantId]);
    
    // Decode the key_ref to get display value (carrier name, partner name, etc.)
    const aliasesWithDecoded = await Promise.all(result.rows.map(async (alias) => {
      let decoded_key = null;
      if (alias.molecule_key && alias.key_ref) {
        try {
          decoded_key = await decodeMolecule(tenantId, alias.molecule_key, alias.key_ref);
        } catch (e) {
          decoded_key = `ID: ${alias.key_ref}`;
        }
      }
      return {
        ...alias,
        decoded_key
      };
    }));
    
    res.json(aliasesWithDecoded);
  } catch (error) {
    console.error('Error listing member aliases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add alias to member
app.post('/v1/members/:memberLink/aliases', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const memberLinkParam = req.params.memberLink;
  const { tenant_id, alias_type_link, alias_value, key_molecule_id, key_ref, molecule_key, membership_number } = req.body;
  
  if (!tenant_id || !alias_type_link || !alias_value) {
    return res.status(400).json({ error: 'tenant_id, alias_type_link, and alias_value required' });
  }
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Get the actual member link from database using membership_number if provided
    let memberLink = memberLinkParam;
    if (membership_number) {
      const memberResult = await client.query(
        'SELECT link FROM member WHERE membership_number = $1 AND tenant_id = $2',
        [membership_number, tenant_id]
      );
      if (memberResult.rows.length > 0) {
        memberLink = memberResult.rows[0].link;
      }
    }
    
    // Get next link for member_alias
    const aliasLink = await getNextLink(tenant_id, 'member_alias');
    
    await client.query(`
      INSERT INTO member_alias (link, p_link, alias_type_link, alias_value, key_molecule_id, key_ref, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [aliasLink, memberLink, alias_type_link, alias_value, key_molecule_id || null, key_ref || null, tenant_id]);
    
    // Insert the identifying molecule if provided
    if (molecule_key && key_ref) {
      await insertMoleculeRow(aliasLink, molecule_key, [key_ref], tenant_id, 'L', client);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ link: aliasLink, message: 'Alias created' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating member alias:', error);
    
    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({ error: 'This alias already exists for another member' });
    }
    
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete alias from member
app.delete('/v1/members/:memberLink/aliases/:aliasLink', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { memberLink, aliasLink } = req.params;
  const tenantId = req.query.tenant_id;
  const membershipNumber = req.query.membership_number;
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });
  
  const client = await dbClient.connect();
  try {
    await client.query('BEGIN');
    
    // Resolve member link if membership_number provided
    let resolvedMemberLink = memberLink;
    if (membershipNumber) {
      const memberResult = await client.query(
        'SELECT link FROM member WHERE membership_number = $1 AND tenant_id = $2',
        [membershipNumber, tenantId]
      );
      if (memberResult.rows.length > 0) {
        resolvedMemberLink = memberResult.rows[0].link;
      }
    }
    
    // Delete molecules attached to this alias
    await deleteAllMoleculeRowsForLink(aliasLink, 'L', client);
    
    // Delete the alias
    await client.query(
      'DELETE FROM member_alias WHERE link = $1 AND p_link = $2 AND tenant_id = $3',
      [aliasLink, resolvedMemberLink, tenantId]
    );
    
    await client.query('COMMIT');
    res.json({ message: 'Alias deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting member alias:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Search for member by alias value
app.get('/v1/alias-search', async (req, res) => {
  if (!dbClient) return res.status(501).json({ error: 'Database not connected' });
  
  const { value, tenant_id } = req.query;
  if (!value || !tenant_id) {
    return res.status(400).json({ error: 'value and tenant_id required' });
  }
  
  try {
    const result = await dbClient.query(`
      SELECT ma.link as alias_link, ma.alias_value, ma.key_molecule_id, ma.key_ref,
             ac.composite_code, ac.composite_name,
             md.molecule_key, md.label AS molecule_label,
             m.link as member_link, m.membership_number, m.fname, m.lname, m.email,
             m.phone, m.city, m.state, m.enroll_date,
             tier.tier_code, tier.tier_description as tier_name
      FROM member_alias ma
      JOIN alias_composite ac ON ma.alias_type_link = ac.link
      JOIN member m ON ma.p_link = m.link
      LEFT JOIN molecule_def md ON ma.key_molecule_id = md.molecule_id
      LEFT JOIN LATERAL get_member_current_tier(m.link) tier ON true
      WHERE ma.alias_value = $1 AND ma.tenant_id = $2
    `, [value, tenant_id]);
    
    if (result.rows.length === 0) {
      return res.json([]);  // Return empty array instead of 404
    }
    
    // Decode the key_ref for all rows
    const rowsWithDecoded = await Promise.all(result.rows.map(async (row) => {
      if (row.molecule_key && row.key_ref) {
        try {
          row.decoded_key = await decodeMolecule(tenant_id, row.molecule_key, row.key_ref);
        } catch (e) {
          row.decoded_key = `ID: ${row.key_ref}`;
        }
      }
      return row;
    }));
    
    res.json(rowsWithDecoded);
  } catch (error) {
    console.error('Error searching alias:', error);
    res.status(500).json({ error: error.message });
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

app.listen(PORT, async () => {
  const startTime = new Date().toLocaleString();
  
  // Get sync commit status for current database
  let syncStatus = 'unknown';
  if (dbClient) {
    try {
      const result = await dbClient.query('SHOW synchronous_commit');
      syncStatus = result.rows[0].synchronous_commit;
    } catch (e) {
      syncStatus = 'error';
    }
  }
  
  debugLog(() => `\n===========================================`);
  debugLog(() => `Loyalty Platform API Server`);
  debugLog(() => `Version: ${SERVER_VERSION}`);
  debugLog(() => `Build: ${BUILD_NOTES}`);
  debugLog(() => `===========================================`);
  debugLog(() => `Server started: ${startTime}`);
  debugLog(() => `Listening on: http://127.0.0.1:${PORT}`);
  debugLog(() => `Database: ${dbClient ? `CONNECTED to ${currentDatabaseName}` : 'NOT CONNECTED - using mock data'}`);
  debugLog(() => `Sync Commit: ${syncStatus} (${syncStatus === 'off' ? 'fast' : 'safe'})`);
  debugLog(() => `===========================================\n`);
});
