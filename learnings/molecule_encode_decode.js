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
  
  // LOOKUP - Query foreign table
  if (mol.value_kind === 'lookup') {
    if (!mol.lookup_table_key) {
      throw new Error(`Molecule '${moleculeKey}' is lookup but has no lookup_table_key`);
    }
    
    // Map lookup table keys to actual table names and code columns
    const tableMap = {
      'carrier': { table: 'carrier', column: 'carrier_code' },
      'airport': { table: 'airport', column: 'airport_code' },
      'hotel_brand': { table: 'hotel_brand', column: 'brand_code' },
    };
    
    const lookupInfo = tableMap[mol.lookup_table_key];
    if (!lookupInfo) {
      throw new Error(`Unknown lookup_table_key: ${mol.lookup_table_key}`);
    }
    
    // Query the lookup table
    const lookupQuery = `
      SELECT ${lookupInfo.table}_id as id
      FROM ${lookupInfo.table}
      WHERE ${lookupInfo.column} = $1 AND tenant_id = $2
    `;
    
    const lookupResult = await dbClient.query(lookupQuery, [value, tenantId]);
    
    if (lookupResult.rows.length === 0) {
      throw new Error(`Value '${value}' not found in ${lookupInfo.table} for tenant ${tenantId}`);
    }
    
    return lookupResult.rows[0].id;
  }
  
  // LIST - Query molecule_value_text
  if (mol.value_kind === 'list') {
    const listQuery = `
      SELECT value_id
      FROM molecule_value_text
      WHERE molecule_id = $1 AND value = $2
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
  
  // LOOKUP - Query foreign table
  if (mol.value_kind === 'lookup') {
    if (!mol.lookup_table_key) {
      throw new Error(`Molecule '${moleculeKey}' is lookup but has no lookup_table_key`);
    }
    
    // Map lookup table keys to actual table names and code columns
    const tableMap = {
      'carrier': { table: 'carrier', column: 'carrier_code', idColumn: 'carrier_id' },
      'airport': { table: 'airport', column: 'airport_code', idColumn: 'airport_id' },
      'hotel_brand': { table: 'hotel_brand', column: 'brand_code', idColumn: 'brand_id' },
    };
    
    const lookupInfo = tableMap[mol.lookup_table_key];
    if (!lookupInfo) {
      throw new Error(`Unknown lookup_table_key: ${mol.lookup_table_key}`);
    }
    
    // Query the lookup table
    const lookupQuery = `
      SELECT ${lookupInfo.column} as code
      FROM ${lookupInfo.table}
      WHERE ${lookupInfo.idColumn} = $1 AND tenant_id = $2
    `;
    
    const lookupResult = await dbClient.query(lookupQuery, [id, tenantId]);
    
    if (lookupResult.rows.length === 0) {
      throw new Error(`ID ${id} not found in ${lookupInfo.table} for tenant ${tenantId}`);
    }
    
    return lookupResult.rows[0].code;
  }
  
  // LIST - Query molecule_value_text
  if (mol.value_kind === 'list') {
    const listQuery = `
      SELECT value
      FROM molecule_value_text
      WHERE molecule_id = $1 AND value_id = $2
    `;
    
    const listResult = await dbClient.query(listQuery, [mol.molecule_id, id]);
    
    if (listResult.rows.length === 0) {
      throw new Error(`Value ID ${id} not found in list for molecule '${moleculeKey}'`);
    }
    
    return listResult.rows[0].value;
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
