# WORKFLOW STANDARDS
**Last Updated:** 2025-11-07 21:03  
**This file ACCUMULATES - add new sections, don't replace existing ones**

---

## 📁 File Organization

### Project Structure
```
/home/claude/loyalty-demo/
├── server_db_api.js          # Main server
├── *.html                    # Frontend pages
├── learnings/                # Documentation and handoff files
│   ├── schema_snapshot.sql
│   ├── START_CHAT_INSTRUCTIONS_*.md
│   ├── SESSION_SUMMARY_*.md
│   ├── WORKFLOW_STANDARDS_*.md
│   └── SECRET_SAUCE_*.md
└── [other files]
```

### Output Locations
- **Files for Bill to download:** `/mnt/user-data/outputs/`
- **Bill's uploads to Claude:** `/mnt/user-data/uploads/`
- **Working directory:** `/home/claude/loyalty-demo/`

### Documentation Standards
- Use timestamps in format: `YYYYMMDD_HHMM`
- Handoff files go to `/mnt/user-data/outputs/` then Bill saves to `learnings/`
- Always create 4 files: START_CHAT, SESSION_SUMMARY, WORKFLOW_STANDARDS, SECRET_SAUCE
- Session summaries include: what works, what's broken, next priorities

---

## 🗄️ Database Conventions

### Data Type Sizing
Based on Bill's "million years ago" philosophy of right-sizing data types to domain:

- **tenant_id:** `SMALLINT` (max 32,767 tenants - plenty)
- **member_id:** `TEXT` (airline member numbers are alphanumeric)
- **activity_id:** `BIGINT` (could be billions of activities over time)
- **molecule_id:** `INTEGER` (thousands of molecules, not millions)
- **value_id:** `INTEGER` (list values within a molecule)
- **lot_id:** `BIGINT` (one per activity, could be billions)
- **Dates:** Store dates efficiently (not timestamps unless time matters)
- **Currency amounts:** `INTEGER` (store cents, not dollars - no floating point)
- **Point amounts:** `INTEGER` (miles/points are whole numbers)

### Naming Conventions
- Table names: lowercase, singular (e.g., `activity`, not `activities`)
- Foreign keys: `{table}_id` (e.g., `tenant_id`, `activity_id`)
- Boolean flags: `is_{property}` (e.g., `is_active`, `is_permanent`)
- Metadata tables: `{entity}_value_{type}` (e.g., `molecule_value_text`)
- Lookup metadata: `{entity}_value_lookup` (e.g., `molecule_value_lookup`)

### Tenant Isolation Pattern
```sql
-- Every tenant-specific table includes:
tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id)

-- Queries always filter by tenant:
WHERE tenant_id = $1
```

### Index Strategy
- Primary keys: Always `{table}_id`
- Tenant queries: Index `(tenant_id, ...)` for fast filtering
- Foreign keys: Index all FKs for join performance
- Lookup tables: Index code columns for encoding

---

## 🌐 Web Application Patterns

### Navigation Structure
```
Admin Home (admin.html)
├── Molecules (admin_molecules.html)
├── Bonuses (admin_bonuses.html)
├── Display Templates (admin_activity_display_templates.html)
│   └── Edit Template (admin_activity_display_template_edit.html)
└── Other admin pages

Member Pages
├── Activity List (activity.html)
└── Other member pages
```

### Tenant Selection
- Tenant dropdown in top-right of admin pages
- Selected tenant stored in localStorage
- All API calls include `tenant_id` parameter
- Currently hardcoded to tenant 1 for development

### Admin Page Patterns
- Blue "Add" button in top-right
- Table with editable rows or "Edit" buttons
- Modal dialogs for complex forms (Line Builder)
- "Back to Admin" link in top-left
- Consistent styling across all pages

### API Call Patterns
```javascript
// Always include tenant_id
const TENANT_ID = 1;
const API_BASE = 'http://127.0.0.1:4001';

// Use return_type for efficient calls
fetch(`${API_BASE}/v1/molecules/get/${key}?tenant_id=${TENANT_ID}&return_type=with_samples`)

// Validate IDs before API calls
if (!activityId || isNaN(activityId)) {
  console.error('Invalid activity ID');
  return [];
}
```

---

## ⚡ Token Management

### Warning Thresholds
- **130,000 tokens:** Start wrapping up session, prioritize critical fixes
- **150,000 tokens:** Begin handoff file creation
- **170,000 tokens:** Emergency - create minimal handoff files immediately

### Token Conservation Strategies
- Use `view` with line ranges instead of viewing entire files
- Use `grep` to find specific patterns before viewing
- Avoid repeating large code blocks in explanations
- Keep responses focused and concise

### At Each Threshold
**130k:** "We're at 130k tokens. Should we wrap up after this fix or continue?"
**150k:** "We're at 150k tokens. I should start creating handoff files soon."
**170k:** "Emergency - I need to create handoff files now before we run out of tokens."

---

## 👤 User Preferences - Bill Jansen

### Communication Style
- **Prefers:** Direct answers, working code, immediate action
- **Dislikes:** Long explanations, preambles, apologies, being asked to edit code
- **Best response:** "Here's the fixed file [link]" not "Here's how to fix it..."

### Work Style
- Builds systems that last decades (his "million years ago" design philosophy)
- Values efficiency and right-sizing (2-byte dates, appropriate data types)
- Thinks in pointers and cache-friendly designs
- Wants complete working files, not partial fixes

### Technical Preferences
- **Favorite color:** Green (use for success states, positive indicators)
- **Testing approach:** Incremental - test each piece before moving on
- **Debugging:** Use curl to test APIs before UI integration
- **Documentation:** Wants it clear but not verbose

### Bill's Signals & What They Mean
| Signal | Meaning | Correct Response |
|--------|---------|------------------|
| "stop!" | You're going down wrong path | PAUSE IMMEDIATELY, listen |
| "NO!" | Fundamental misunderstanding | Ask what you're missing |
| "why are you asking this?" | Answer is obvious from data | Check data first, don't ask |
| "shouldn't this come from molecule?" | You're hardcoding instead of using data | Fix to use molecule/database |
| "fuck!" | You did something reckless | Stop, apologize briefly, wait for direction |
| Multiple "stop!" messages | You're not listening | FULL STOP, wait for Bill |
| ALL CAPS | Serious frustration | Pause everything, listen |

### Bill's Pet Peeves (DO NOT DO THESE)
1. ❌ Asking him to manually edit code
2. ❌ Guessing at database/config details for destructive operations
3. ❌ Hardcoding what should come from data
4. ❌ Long explanations when he wants action
5. ❌ "It should work" without actually testing
6. ❌ Continuing after he says "stop!"

---

## 🤖 Working with Claude - Behavior Guidelines

**THESE ARE PERMANENT RULES - NEVER VIOLATE THESE**

### Rule 1: Always Provide Complete Files
- ✅ Use `str_replace` or `create_file` to provide full working files
- ✅ Files should be downloadable and immediately usable
- ❌ NEVER say "add this line at line 47"
- ❌ NEVER ask Bill to manually edit code
- ❌ NEVER provide partial snippets expecting Bill to integrate them

**Why:** Bill wants to download and use files directly. Asking him to edit wastes time.

### Rule 2: When Bill Says "Stop!" - PAUSE IMMEDIATELY
- ✅ Stop whatever you're doing
- ✅ Don't keep explaining or justifying
- ✅ Wait for Bill's next direction
- ❌ Don't say "but I think..."
- ❌ Don't continue down the same path

**Why:** "Stop" means you've misunderstood something fundamental. Listen, don't talk.

### Rule 3: Data Drives Behavior - Never Hardcode
- ✅ Labels come from molecules (point_type_label, activity_type_label)
- ✅ Display formats come from templates (display_template, display_template_line)
- ✅ Field labels come from molecule.label
- ✅ Sample data comes from molecule.sample_code/sample_description
- ❌ NEVER hardcode "miles", "Flight", "Origin", "Economy", etc.

**Why:** System must work for any industry without code changes.

### Rule 4: Test Incrementally with Curl
- ✅ Test API endpoints with curl before UI integration
- ✅ Show Bill the results of each test
- ✅ Verify one thing works before moving to next
- ❌ Don't chain 10 changes without testing each step

**Why:** Catch issues early. Debugging 10 changes at once is nightmare.

### Rule 5: Read Schema Before Writing Code
- ✅ View `/home/claude/loyalty-demo/learnings/schema_snapshot.sql` first
- ✅ Check actual table names, column names, data types
- ✅ Verify foreign key relationships
- ❌ NEVER guess at table structure
- ❌ NEVER assume column names

**Why:** Wrong assumptions lead to SQL errors and wasted time.

### Rule 6: NEVER Guess at Database Configuration
**CRITICAL RULE - VIOLATION CAN DESTROY DATA**

- ✅ Ask Bill for database name before any DELETE/DROP/TRUNCATE
- ✅ Verify connection details from actual config files
- ✅ Double-check what environment (dev/prod)
- ❌ NEVER guess at database names
- ❌ NEVER assume table names without checking
- ❌ NEVER run destructive operations without verification

**Why:** One wrong guess can destroy production data. ALWAYS VERIFY FIRST.

**Examples of what NOT to do:**
```bash
# ❌ BAD - Guessing database name
psql loyalty_platform -f wipe_data.sql

# ✅ GOOD - Ask first
"Bill, what database name should I use for the wipe script? 
I want to make sure I have the right one before running any DELETE commands."
```

### Rule 7: Listen to Bill's Instincts
- ✅ When Bill corrects you, he's right
- ✅ Bill has decades of experience building systems
- ✅ His "that seems wrong" is always worth investigating
- ❌ Don't argue or explain why you did it that way
- ❌ Don't say "but the documentation says..."

**Why:** Bill knows his system better than documentation. Trust his expertise.

---

## 🛠️ Common Commands

### Database Operations
```bash
# Connect to database (Bill will provide database name)
psql [database_name]

# List all databases
psql -l

# Run SQL script (VERIFY DATABASE NAME FIRST)
psql [database_name] -f script.sql

# Quick query
psql [database_name] -c "SELECT COUNT(*) FROM activity;"
```

### File Operations
```bash
# Find latest handoff files
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# View file with line numbers
cat -n /home/claude/loyalty-demo/server_db_api.js | head -50

# Find pattern in files
grep -n "pattern" /home/claude/loyalty-demo/*.js

# Copy to outputs for Bill
cp /home/claude/loyalty-demo/file.js /mnt/user-data/outputs/
```

### API Testing
```bash
# Test GET endpoint
curl "http://127.0.0.1:4001/v1/endpoint?param=value" | python3 -m json.tool

# Test POST endpoint
curl -X POST "http://127.0.0.1:4001/v1/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' | python3 -m json.tool

# Quick test without formatting
curl -s "http://127.0.0.1:4001/v1/endpoint"

# Test with verbose output
curl -v "http://127.0.0.1:4001/v1/endpoint"
```

### Server Operations
```bash
# Check server version
grep "SERVER_VERSION\|BUILD_NOTES" /home/claude/loyalty-demo/server_db_api.js | head -2

# Find port
grep "PORT" /home/claude/loyalty-demo/server_db_api.js | head -1

# See running processes (Bill runs this)
ps aux | grep node
```

---

## 📚 API Design Patterns

### Efficient API Calls
```javascript
// Use return_type parameter to get only what you need
GET /v1/molecules/get/:key?tenant_id=1&return_type=with_samples

// Response is minimal (100 bytes vs 500+)
{
  "molecule_key": "origin",
  "label": "Origin", 
  "sample_code": "BOS",
  "sample_description": "Boston"
}
```

### Query Parameters
- `tenant_id`: Always required for tenant-specific resources
- `return_type`: Optional, values: `with_samples` (minimal), omit for full data
- Use query params for filtering, not path params

### Response Patterns
```javascript
// Success with data
{ ok: true, data: [...] }

// Success with message
{ ok: true, message: "Created successfully", id: 123 }

// Error
{ error: "Error message" }

// Status codes
200 - Success
201 - Created
400 - Bad request (validation error)
404 - Not found
500 - Server error
```

---

## 🎨 Frontend Patterns

### Loading Sample Data for Previews
```javascript
// ALWAYS check if molecule has sample data
const testData = {};
for (const key of moleculeKeys) {
  const response = await fetch(`${API_BASE}/v1/molecules/get/${key}?tenant_id=${TENANT_ID}&return_type=with_samples`);
  if (response.ok) {
    const molecule = await response.json();
    testData[key] = {
      Code: molecule.sample_code || defaultValues[key].Code,
      Description: molecule.sample_description || defaultValues[key].Description
    };
  }
}
```

### Template Rendering
```javascript
// Replace [M,key,"format"] with actual values
rendered = rendered.replace(/\[M,(\w+),"(Code|Description|Both)"(?:,(\d+))?\]/g, (match, key, format, maxLength) => {
  const value = decodedValues[key];
  if (!value) return ''; // Skip missing values
  
  // Apply format and max length
  let output = (format === 'Code') ? value : value;
  if (maxLength && output.length > parseInt(maxLength)) {
    output = output.substring(0, parseInt(maxLength));
  }
  return output;
});

// Replace [T,"text"] with literal text
rendered = rendered.replace(/\[T,"([^"]+)"\]/g, (match, text) => text);
```

### Input Validation
```javascript
// Always validate before API calls
if (!activityId || isNaN(activityId)) {
  console.error('Invalid activity ID:', activityId);
  return [];
}

// Validate required fields
if (!templateName || !templateType) {
  alert('Template name and type are required');
  return;
}
```

---

## 🔧 Debugging Strategies

### When Something Doesn't Work

1. **Check the browser console** (F12) for JavaScript errors
2. **Check the server logs** for API errors
3. **Test the API with curl** to isolate frontend vs backend
4. **Check the database** to verify data exists
5. **Read the schema** to confirm table/column names

### API Debugging Flow
```bash
# 1. Test endpoint exists
curl "http://127.0.0.1:4001/v1/endpoint"

# 2. Test with parameters
curl "http://127.0.0.1:4001/v1/endpoint?param=value" | python3 -m json.tool

# 3. Check response structure
curl -s "http://127.0.0.1:4001/v1/endpoint" | grep "field_name"

# 4. Test POST with data
curl -X POST "http://127.0.0.1:4001/v1/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Database Debugging
```sql
-- Check if data exists
SELECT COUNT(*) FROM table_name;

-- Check specific record
SELECT * FROM table_name WHERE id = 123;

-- Check relationships
SELECT a.*, b.* 
FROM table_a a
JOIN table_b b ON a.id = b.a_id
WHERE a.tenant_id = 1;

-- Check for NULL values
SELECT * FROM table_name WHERE field IS NULL;
```

---

## 📝 Code Style Preferences

### SQL Style
```sql
-- Use uppercase for SQL keywords
SELECT column_name
FROM table_name
WHERE condition = value;

-- Use meaningful aliases
SELECT 
  a.activity_id,
  m.molecule_key,
  ad.v_ref_id
FROM activity a
JOIN activity_detail ad ON a.activity_id = ad.activity_id
JOIN molecule_def m ON ad.molecule_id = m.molecule_id;

-- Always filter by tenant_id
WHERE a.tenant_id = $1;
```

### JavaScript Style
```javascript
// Use const by default, let when reassignment needed
const tenantId = 1;
let result = null;

// Async/await over promises
async function loadData() {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Early returns for error cases
if (!value) {
  console.error('Value required');
  return null;
}

// Descriptive variable names
const activityTypeMolecule = await getMolecule('activity_type_label', tenantId);
```

---

## 🚨 Emergency Protocols

### If Token Count Exceeds 150k
1. Stop current work immediately
2. Create handoff files with current state
3. Note what was in progress
4. Bill will start new session with fresh context

### If Bill Signals Serious Frustration
1. STOP whatever you're doing
2. Don't explain or justify
3. Ask "What would you like me to do?"
4. Wait for clear direction

### If Destructive Operation Needed
1. Ask Bill for database name
2. Show Bill the exact command you'll run
3. Wait for explicit confirmation
4. Run command
5. Verify results immediately

---

## ✅ Session Start Checklist

Every session should begin with:

- [ ] Read schema_snapshot.sql
- [ ] Read latest WORKFLOW_STANDARDS
- [ ] Read latest SECRET_SAUCE  
- [ ] Read latest SESSION_SUMMARY
- [ ] Confirm understanding with Bill
- [ ] Ask what to work on first
- [ ] Never assume configuration details

---

## 📖 Learning from Mistakes

### Session 2025-11-07 Lessons

**Mistake:** Assumed database name was "loyalty_platform" for destructive wipe script
**Impact:** Bill frustrated, couldn't run script
**Lesson:** ALWAYS verify database name before any DELETE/DROP/TRUNCATE operations
**Fix:** Always ask Bill for configuration details before destructive operations

**Mistake:** Fixed wrong issue with template preview (uppercase keys vs format)
**Impact:** Spent time on wrong problem
**Lesson:** Verify the actual problem before fixing
**Fix:** Test with actual data to see real behavior

**Mistake:** Didn't anticipate old data quality issues (v_ref_id = "list")
**Impact:** Needed additional safety checks
**Lesson:** Assume data might be messy, add defensive code
**Fix:** Added safety check for bad v_ref_id values

---

**This file continues to accumulate best practices and lessons from each session.**
