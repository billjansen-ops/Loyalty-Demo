# Molecule System Migration Guide

## Overview

The **Molecule System** is a unified, multi-tenant architecture for managing all configurable attributes across different contexts (activity, member, tenant) and industries. This replaces hardcoded fields with a flexible, self-describing metadata system.

## What Problem Does This Solve?

**Before:**
- Tenant config scattered across `tenant_settings`, `tenant_terms`, various tables
- Different industries need different fields (airline vs hotel vs automotive)
- Adding new config requires schema changes and code updates
- Bonus engine tightly coupled to specific field names

**After:**
- **ONE system for all configurable attributes** (molecules)
- **Industry-agnostic bonus engine** - compares molecule values, doesn't care if it's "fare_class" or "vehicle_model"
- **No schema changes** to add new config - just insert molecule definitions
- **Multi-tenant from the ground up** - each tenant has their own molecules
- **Self-documenting** - molecule definitions ARE the documentation

## Architecture

### Core Concept: Molecules

A **molecule** is any configurable attribute in the system:

**Static Molecules (config):**
- Currency labels: "miles" vs "points"
- Business rules: retro_days_allowed = 365
- Counters: last_member_number = 10042

**Transactional Molecules (data):**
- Activity attributes: origin, destination, fare_class
- Member attributes: tier, status, enrollment_date
- Values stored in *_detail tables

### Table Structure

**1. `molecule_def` (parent) - WHAT molecules exist**
```
- molecule_id (PK)
- tenant_id (FK)
- molecule_key (unique per tenant)
- label, description
- value_kind: 'scalar', 'list', 'lookup'
- scalar_type: 'text', 'numeric', 'date', 'boolean'
- context: 'activity', 'member', 'tenant'
- is_static, is_permanent, is_required
```

**2. `molecule_value_*` tables (children) - molecule VALUES**

Five lean tables, one per data type:
- `molecule_value_text` - text values and list options
- `molecule_value_numeric` - numbers
- `molecule_value_date` - dates
- `molecule_value_boolean` - true/false
- `molecule_value_ref` - foreign key references

**Why separate tables?** No wasted NULL columns. Each table is right-sized for its data type.

## Examples

### Example 1: Currency Label (static scalar)

**Parent in molecule_def:**
```sql
molecule_id: 42
tenant_id: 1 (Delta)
molecule_key: "currency_label_singular"
value_kind: "scalar"
scalar_type: "text"
context: "tenant"
is_static: true
```

**Child in molecule_value_text:**
```sql
value_id: 123
molecule_id: 42
text_value: "mile"
```

**Access:** `getMolecule('currency_label_singular', 1)` → "mile"

### Example 2: Retro Days (static numeric)

**Parent in molecule_def:**
```sql
molecule_id: 43
tenant_id: 1
molecule_key: "retro_days_allowed"
value_kind: "scalar"
scalar_type: "numeric"
context: "tenant"
is_static: true
```

**Child in molecule_value_numeric:**
```sql
value_id: 201
molecule_id: 43
numeric_value: 365
```

**Access:** `getMolecule('retro_days_allowed', 1)` → 365

### Example 3: Fare Class (list type)

**Parent in molecule_def:**
```sql
molecule_id: 44
tenant_id: 1
molecule_key: "fare_class"
value_kind: "list"
scalar_type: "text"
context: "activity"
is_static: false (transactional)
```

**Children in molecule_value_text:**
```sql
value_id: 301, molecule_id: 44, text_value: "F", display_label: "First Class", sort_order: 1
value_id: 302, molecule_id: 44, text_value: "Y", display_label: "Economy", sort_order: 2
value_id: 303, molecule_id: 44, text_value: "C", display_label: "Business", sort_order: 3
```

**These define VALID OPTIONS. Actual activity values go in `activity_detail`.**

### Example 4: Origin Airport (lookup type)

**Parent in molecule_def:**
```sql
molecule_id: 45
molecule_key: "origin"
value_kind: "lookup"
lookup_table_key: "airport"
context: "activity"
is_static: false
```

**NO children in molecule_value_* tables!**
**Actual values stored in `activity_detail` with v_ref_id pointing to airports table.**

## Migration Steps

### Step 1: Run Migration Script

```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f molecule_system_migration.sql
```

**What it does:**
- ✅ Adds new columns to existing `molecule_def` table
- ✅ Sets defaults so existing data stays valid
- ✅ Creates five `molecule_value_*` child tables
- ✅ Creates indexes for performance
- ✅ Shows verification queries

**Safe to run:** Uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`

### Step 2: Populate Sample Data

```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f molecule_sample_data.sql
```

**What it adds:**
- Currency labels (singular/plural)
- Retro days allowed (365)
- Max tier qualification days (365)
- Last member number counter (10000)
- Fare class options (F, Y, C)
- Updates existing activity molecules

### Step 3: Verify Everything Works

**Check bonus engine still works:**
1. Go to admin_bonus_edit.html
2. Create/edit a bonus rule with criteria
3. Test rule evaluation

**Expected:** Bonus engine continues working unchanged because we kept the columns it uses.

## Data Access Patterns

### Pattern 1: Get Static Molecule Value

```javascript
async function getMolecule(moleculeKey, tenantId) {
  // 1. Get molecule definition
  const molDef = await query(`
    SELECT molecule_id, scalar_type, value_kind
    FROM molecule_def
    WHERE tenant_id = $1 AND molecule_key = $2
  `, [tenantId, moleculeKey]);
  
  // 2. Query appropriate value table
  if (molDef.scalar_type === 'text') {
    const result = await query(`
      SELECT text_value 
      FROM molecule_value_text 
      WHERE molecule_id = $1
    `, [molDef.molecule_id]);
    return result.rows[0].text_value;
  } else if (molDef.scalar_type === 'numeric') {
    // ... query molecule_value_numeric
  }
  // etc.
}
```

### Pattern 2: Get List Options

```javascript
async function getMoleculeOptions(moleculeKey, tenantId) {
  const molDef = await query(`
    SELECT molecule_id FROM molecule_def
    WHERE tenant_id = $1 AND molecule_key = $2
  `, [tenantId, moleculeKey]);
  
  const options = await query(`
    SELECT text_value, display_label, sort_order
    FROM molecule_value_text
    WHERE molecule_id = $1
    ORDER BY sort_order
  `, [molDef.molecule_id]);
  
  return options.rows; // [{text_value: "F", display_label: "First Class"}, ...]
}
```

### Pattern 3: Increment Counter (Special Case)

For `last_member_number` - bypass getter, use explicit lock:

```javascript
async function getNextMemberNumber(tenantId) {
  await query('BEGIN');
  
  // Lock the row
  const lock = await query(`
    SELECT mv.numeric_value, mv.value_id
    FROM molecule_value_numeric mv
    JOIN molecule_def md ON mv.molecule_id = md.molecule_id
    WHERE md.molecule_key = 'last_member_number' 
      AND md.tenant_id = $1
    FOR UPDATE
  `, [tenantId]);
  
  const newNumber = lock.rows[0].numeric_value + 1;
  
  await query(`
    UPDATE molecule_value_numeric
    SET numeric_value = $1
    WHERE value_id = $2
  `, [newNumber, lock.rows[0].value_id]);
  
  await query('COMMIT');
  return newNumber;
}
```

## What's Next?

**Phase 1 (DONE):** Database structure created ✅
**Phase 2 (DONE):** Sample data populated ✅
**Phase 3 (NEXT):** Test bonus engine still works ✅

**Phase 4 (UPCOMING):**
- Create getter functions in server_db_api.js
- Create API endpoints (GET /v1/molecules, etc.)
- Build admin_molecules.html (manage molecule definitions)
- Build admin_tenant_config.html (edit static molecule values)
- Update admin_bonus_edit.html to fetch molecules from API

## Benefits

**Multi-tenant:**
- Each tenant has their own molecules
- Delta's "fare_class" is separate from Ferrari's "vehicle_model"

**Multi-industry:**
- Same bonus engine evaluates airlines, hotels, automotive
- Just comparing molecule values - industry-agnostic

**No Schema Changes:**
- Add new config by inserting molecule definitions
- No ALTER TABLE required

**Self-Documenting:**
- Molecule definitions describe themselves
- `description` field provides help text

**Performance:**
- Lean child tables (no NULL waste)
- Proper indexes
- Pointer-based comparisons (fast)

## The Secret Sauce

The bonus engine doesn't know what industry it's serving. It just evaluates:

```
Does activity.molecule[X] match criterion.value[Y]?
```

Whether X is "origin airport" (Delta) or "vehicle model" (Ferrari) doesn't matter. It's just comparing values. This is the "million years ago" philosophy: generic, efficient structures with industry-specific knowledge in configuration.

## Questions?

- Why separate child tables? → No NULL waste, right-sized for data type
- Why not use tenant_settings? → Unified system, self-describing, more flexible
- Will bonus engine break? → No, we kept columns it uses unchanged
- How to add new molecule? → Insert into molecule_def, optionally add values
- How to add new data type? → Create new molecule_value_* table

---

**This is the foundation of a truly multi-tenant, multi-industry loyalty platform.**
