# Atom Concept - Dynamic Variable Substitution

## What Are Atoms?

**Atoms** are template variables embedded in text strings that get dynamically replaced with actual data at runtime. They enable tenant-specific, configurable text without hardcoding values.

## The Problem They Solve

**Before atoms:**
```javascript
error = "Member does not have enough miles";  // Wrong for hotels
error = "Member does not have enough points"; // Wrong for airlines
```

You'd need different error messages for every industry and every tenant.

**With atoms:**
```javascript
error = "Member does not have enough {{M,point_type,label,,L}}";
```
- Delta tenant: "Member does not have enough miles"
- Marriott tenant: "Member does not have enough points"
- Gym tenant: "Member does not have enough credits"

**The same code, different data.**

## Atom Syntax

```
{{source,identifier,field,length,case}}
```

### Parameters

1. **source** - Where to get the data:
   - `M` = Molecule (use molecule system)
   - `T` = Table (direct database lookup)

2. **identifier** - Which molecule or table:
   - For `M`: molecule_key (e.g., `point_type`, `carrier`)
   - For `T`: table_name (e.g., `members`, `activity`)

3. **field** - Which property to extract:
   - For `M`: molecule field (`label`, `code`, `value`)
   - For `T`: column_name (`first_name`, `activity_date`)

4. **length** (optional) - Maximum length (truncates only):
   - Number: truncate to N characters
   - Empty: no truncation

5. **case** (optional) - Case transformation:
   - `U` = UPPERCASE
   - `L` = lowercase
   - `P` = Proper Case

## Examples

### Molecule-Based Atoms

```javascript
{{M,point_type,label}}           → "Miles"
{{M,point_type,label,,L}}        → "miles"
{{M,carrier,code}}               → "DL"
{{M,carrier,name}}               → "Delta Air Lines"
{{M,cabin_class,label}}          → "First Class"
```

### Table-Based Atoms

```javascript
{{T,members,first_name}}         → "Bill"
{{T,members,first_name,,U}}      → "BILL"
{{T,members,first_name,4,P}}     → "Bill"
{{T,activity,activity_date}}     → "2025-11-08"
```

## Use Cases

### Error Messages
```javascript
"Member does not have enough {{M,point_type,label,,L}} for this redemption"
→ "Member does not have enough miles for this redemption"
```

### Personalized Greetings
```javascript
"Welcome back, {{T,members,first_name,,P}}!"
→ "Welcome back, Bill!"
```

### Dynamic Headers
```javascript
"Total {{M,point_type,label,,P}} Earned"
→ "Total Miles Earned"   (for airlines)
→ "Total Points Earned"  (for hotels)
```

### Activity Displays
```javascript
"{{M,carrier,code}} {{M,flight_number,value}} from {{M,origin,code}} to {{M,destination,code}}"
→ "DL 1234 from DFW to ATL"
```

## How It Works

### Resolution Process

1. **Parse atom syntax** - Extract parameters from `{{...}}`
2. **Fetch data** - Query molecule system or database
3. **Apply transformations** - Truncate/case conversion
4. **Replace in template** - Swap atom with resolved value

### Implementation

```javascript
// Single atom
const value = await resolveAtom("{{M,point_type,label,,L}}", context);

// Multiple atoms in template
const template = "{{T,members,first_name}}, you have {{M,point_type,label,,L}}!";
const result = await resolveAtoms(template, context);
// → "Bill, you have miles!"
```

### Context Object

```javascript
const context = {
  tenantId: 1,           // Required for molecules
  memberId: 12345,       // Required for member table lookups
  activityId: 67890,     // Required for activity table lookups
  dbClient: pgClient,    // Required for any table lookups
  molecules: preDecoded  // Optional: pre-decoded molecules for performance
};
```

## Why Atoms Are Brilliant

### 1. Universal Text Templates
One template works across all tenants and industries:
```javascript
const template = "You earned {{M,point_type,label,,L}} on your {{M,activity_type,label}}";
```
- Airlines: "You earned miles on your flight"
- Hotels: "You earned points on your stay"
- Retail: "You earned rewards on your purchase"

### 2. Self-Documenting Code
```javascript
"{{M,point_type,label,,L}}"  // Crystal clear what this is
```
vs
```javascript
pointLabel.toLowerCase()  // What's pointLabel? Where does it come from?
```

### 3. No String Concatenation
**Bad:**
```javascript
const msg = "You have " + balance + " " + pointType.toLowerCase() + " available";
```

**Good:**
```javascript
const msg = "You have {{M,point_balance,value}} {{M,point_type,label,,L}} available";
```

### 4. Consistent Formatting
Case and length rules are in the atom, not scattered through code:
```javascript
{{T,members,first_name,,P}}  // Always proper case
{{M,carrier,code,3,U}}       // Always 3 chars uppercase
```

### 5. Template Reuse
Same templates work everywhere:
- Error messages
- Email notifications
- Display templates
- SMS messages
- Reports
- UI labels

## Design Philosophy

Atoms follow the core system principles:

1. **Data drives behavior** - Text comes from data, not code
2. **Pointer-based** - References molecules/tables, doesn't copy
3. **Tenant-specific** - Same template, different output per tenant
4. **Self-documenting** - Syntax explains what it does
5. **Performance** - Async for batching, caching possible

## Implementation Details

### Function Signatures

```javascript
/**
 * Resolve a single atom to its value
 */
async function resolveAtom(atomString, context)

/**
 * Resolve all atoms in a template string
 */
async function resolveAtoms(template, context)
```

### Error Handling

- **Invalid syntax:** Returns original atom string unchanged
- **Missing data:** Returns empty string
- **Database errors:** Logs error, returns empty string
- **Missing context:** Logs error, returns empty string or placeholder

### Performance Considerations

- Atoms are async (required for database lookups)
- Pre-decode molecules and pass in context for better performance
- Batch atom resolution when processing multiple templates
- Results are cacheable based on context

## Integration Points

### Display Templates
```javascript
const template = await getDisplayTemplate(activityType, tenantId);
const resolved = await resolveAtoms(template, context);
```

### Error Messages
```javascript
const errorTemplate = "Member does not have enough {{M,point_type,label,,L}}";
const message = await resolveAtoms(errorTemplate, { tenantId, memberId, dbClient });
```

### Email Notifications
```javascript
const emailBody = await resolveAtoms(emailTemplate, {
  tenantId,
  memberId,
  activityId,
  dbClient,
  molecules: preDecodedMolecules
});
```

## Current Status

- **Implementation:** `atom_resolve.js` (complete specification)
- **Molecule integration:** Planned (needs decode function wired in)
- **Table lookups:** Implemented for members and activity tables
- **Usage in system:** Not yet integrated into display templates (next phase)
- **Testing:** Needs unit tests for all parameter combinations

## Next Steps

1. Wire up molecule decode function to atom resolver
2. Integrate atoms into display template rendering
3. Add atom support to error message system
4. Create helper functions for common atom patterns
5. Build atom validation tool for template authors

## Examples Repository

### Common Patterns

```javascript
// Point balance display
"Available: {{M,point_balance,value}} {{M,point_type,label,,L}}"

// Activity summary
"{{M,carrier,name}} flight from {{M,origin,code}} to {{M,destination,code}}"

// Member greeting
"Hello {{T,members,first_name,,P}} {{T,members,last_name,,P}}"

// Date display
"Activity date: {{T,activity,activity_date}}"

// Status message
"Your {{M,tier,label}} status expires on {{T,member_tier,end_date}}"

// Truncated carrier name
"{{M,carrier,name,20}} - {{M,flight_number,value}}"

// Case transformations
"CARRIER: {{M,carrier,code,,U}}"  // DL → DL
"carrier: {{M,carrier,code,,L}}"  // DL → dl
"Carrier: {{M,carrier,name,,P}}"  // delta air lines → Delta air lines
```

---

**Atoms are the final piece that makes text as configurable as data in this system.**
