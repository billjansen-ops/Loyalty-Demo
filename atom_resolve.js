/**
 * resolveAtom - Parse and resolve atom syntax to actual values
 * 
 * PURPOSE:
 * Atoms are template variables that get replaced with data from molecules or database tables.
 * This function parses atom syntax and returns the resolved value with optional transformations.
 * 
 * ATOM SYNTAX:
 * {{source,identifier,field,length,case}}
 * 
 * PARAMETERS:
 * - source: Data source type
 *   - "M" = Molecule (use molecule system to decode value)
 *   - "T" = Table (lookup value directly from database table)
 * 
 * - identifier: Which molecule or table to use
 *   - If source="M": molecule_key (e.g., "point_type", "carrier")
 *   - If source="T": table_name (e.g., "members", "activity")
 * 
 * - field: Which field/property to return
 *   - If source="M": molecule field (e.g., "label", "code", "value")
 *   - If source="T": column_name (e.g., "first_name", "activity_date")
 * 
 * - length: Optional max length (omit for no modification)
 *   - If specified: truncate value to this length
 *   - If omitted: return full value (trimmed of whitespace)
 *   - Note: Does NOT pad - only truncates
 * 
 * - case: Optional case transformation (omit for no change)
 *   - "U" = UPPERCASE
 *   - "L" = lowercase
 *   - "P" = Proper Case (first letter uppercase, rest lowercase)
 * 
 * EXAMPLES:
 * {{M,point_type,label}}           → "Miles" (or "Points" depending on config)
 * {{M,point_type,label,,L}}        → "miles" (lowercase)
 * {{M,carrier,code}}               → "DL"
 * {{M,carrier,code,10}}            → "DL" (or "Delta Air..." truncated to 10)
 * {{T,members,first_name}}         → "Bill"
 * {{T,members,first_name,4,U}}    → "BILL" (truncated to 4, uppercase)
 * {{T,activity,activity_date}}     → "2025-11-08"
 * 
 * USAGE IN TEMPLATES:
 * "Member does not have enough {{M,point_type,label,,L}}"
 * → "Member does not have enough miles"
 * 
 * "Welcome back, {{T,members,first_name,,P}}!"
 * → "Welcome back, Bill!"
 * 
 * FUNCTION SIGNATURE:
 * async function resolveAtom(atomString, context)
 * 
 * FUNCTION PARAMETERS:
 * @param {string} atomString - The complete atom including {{ }} brackets
 * @param {object} context - Context object containing:
 *   - tenantId: Current tenant ID
 *   - memberId: Current member ID (for table lookups)
 *   - activityId: Current activity ID (for table lookups)
 *   - dbClient: Database connection (for table lookups)
 *   - molecules: Pre-decoded molecules object (optional optimization)
 * 
 * RETURNS:
 * @returns {Promise<string>} Resolved value as string
 * 
 * ERROR HANDLING:
 * - Invalid syntax: returns original atom string unchanged
 * - Missing data: returns empty string
 * - Database errors: logs error, returns empty string
 * 
 * DESIGN NOTES:
 * - Function is async because molecule decoding and table lookups are async
 * - Atoms are case-sensitive for molecule_key and table names
 * - Length parameter only truncates, never pads (avoids trailing spaces)
 * - Default behavior: trim whitespace, return actual data
 * - Matches molecule system architecture (decode on-demand, pointer-based)
 * - Template agnostic: can be used in error messages, display templates, emails, etc.
 */

async function resolveAtom(atomString, context) {
  try {
    // Strip {{ }} brackets
    const inner = atomString.replace(/^\{\{|\}\}$/g, '').trim();
    
    // Parse parameters (split by comma)
    const parts = inner.split(',').map(p => p.trim());
    
    // Validate minimum parameters
    if (parts.length < 3) {
      console.error(`Invalid atom syntax: ${atomString} (needs at least 3 parameters)`);
      return atomString; // Return unchanged if invalid
    }
    
    const [source, identifier, field, lengthStr, caseTransform] = parts;
    
    let value = '';
    
    // STEP 1: Get value based on source type
    if (source === 'M') {
      // Molecule source
      const { tenantId, molecules, getMolecule } = context;
      
      if (!tenantId) {
        console.error('resolveAtom: tenantId required for molecule source');
        return '';
      }
      
      // If pre-decoded molecules provided, use them
      if (molecules && molecules[identifier]) {
        value = molecules[identifier][field] || molecules[identifier].value || '';
      } else if (getMolecule) {
        // Use provided getMolecule function
        try {
          console.log(`[resolveAtom] Getting molecule: ${identifier} for tenant: ${tenantId}`);
          const molecule = await getMolecule(identifier, tenantId);
          console.log(`[resolveAtom] Molecule result:`, molecule);
          const vk = molecule.value_kind;
          
          // Handle scalar molecules (support both 'scalar' and 'value')
          if (vk === 'scalar' || vk === 'value') {
            value = molecule.value || '';
            console.log(`[resolveAtom] Scalar value: ${value}`);
          } 
          // Handle list molecules - get first value or specific field (support both 'list' and 'internal_list')
          else if ((vk === 'list' || vk === 'internal_list') && molecule.values && molecule.values.length > 0) {
            value = molecule.values[0][field] || molecule.values[0].label || '';
            console.log(`[resolveAtom] List value: ${value}`);
          }
          // Handle embedded_list molecules
          else if (vk === 'embedded_list' && molecule.values && molecule.values.length > 0) {
            value = molecule.values[0][field] || molecule.values[0].label || '';
            console.log(`[resolveAtom] Embedded list value: ${value}`);
          }
        } catch (error) {
          console.error(`resolveAtom: Error getting molecule ${identifier}:`, error);
          value = '';
        }
      } else {
        // No way to decode molecules
        console.error('resolveAtom: getMolecule function required for molecule source');
        value = `[M:${identifier}.${field}]`; // Placeholder
      }
      
    } else if (source === 'T') {
      // Table source
      const { dbClient, memberLink, activityLink } = context;
      
      if (!dbClient) {
        console.error('resolveAtom: dbClient required for table source');
        return '';
      }
      
      // Build query based on table and available context
      let query = '';
      let params = [];
      
      if (identifier === 'member' && memberLink) {
        query = `SELECT ${field} FROM member WHERE link = $1`;
        params = [memberLink];
      } else if (identifier === 'activity' && activityLink) {
        query = `SELECT ${field} FROM activity WHERE link = $1`;
        params = [activityLink];
      } else {
        console.error(`resolveAtom: Cannot query ${identifier} - missing context or invalid table`);
        return '';
      }
      
      const result = await dbClient.query(query, params);
      if (result.rows.length > 0) {
        value = String(result.rows[0][field] || '');
      }
      
    } else {
      console.error(`resolveAtom: Unknown source type: ${source}`);
      return atomString;
    }
    
    // Trim whitespace from retrieved value
    value = value.trim();
    
    // STEP 2: Apply length transformation (truncate only)
    if (lengthStr && lengthStr.length > 0) {
      const maxLength = parseInt(lengthStr);
      if (!isNaN(maxLength) && maxLength > 0) {
        value = value.substring(0, maxLength);
      }
    }
    
    // STEP 3: Apply case transformation
    if (caseTransform) {
      if (caseTransform === 'U') {
        value = value.toUpperCase();
      } else if (caseTransform === 'L') {
        value = value.toLowerCase();
      } else if (caseTransform === 'P') {
        // Proper case: first letter uppercase, rest lowercase
        value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      }
    }
    
    console.log(`[resolveAtom] Final value after transforms: "${value}"`);
    return value;
    
  } catch (error) {
    console.error('resolveAtom error:', error);
    return ''; // Return empty string on error
  }
}

/**
 * resolveAtoms - Replace all atoms in a template string
 * 
 * Helper function that finds all atoms in a string and resolves them.
 * 
 * @param {string} template - Template string containing zero or more atoms
 * @param {object} context - Same context object as resolveAtom
 * @returns {Promise<string>} Template with all atoms replaced by values
 * 
 * EXAMPLE:
 * const template = "Member does not have enough {{M,point_type,label,,L}} for this redemption";
 * const result = await resolveAtoms(template, context);
 * → "Member does not have enough miles for this redemption"
 */
async function resolveAtoms(template, context) {
  // Find all atoms in template
  const atomRegex = /\{\{[^}]+\}\}/g;
  const atoms = template.match(atomRegex) || [];
  
  // Resolve each atom
  let result = template;
  for (const atom of atoms) {
    const value = await resolveAtom(atom, context);
    result = result.replace(atom, value);
  }
  
  return result;
}

// ES6 exports for Node.js modules
export { resolveAtom, resolveAtoms };
