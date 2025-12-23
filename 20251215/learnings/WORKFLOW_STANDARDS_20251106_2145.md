# WORKFLOW STANDARDS
**Last Updated:** 2025-11-06 21:45  
**Purpose:** How we work together - conventions, preferences, behaviors

> **Note:** This file ACCUMULATES. New sessions add to it, never replace sections.

---

## 📁 File Organization

### Project Structure
```
/home/claude/loyalty-demo/
├── server_db_api.js          # Main API server
├── *.html                     # Web pages (admin and CSR)
├── theme.css                  # Global styles
├── nav.js                     # Navigation component
└── learnings/                 # Documentation and handoffs
    ├── schema_snapshot.sql    # Database schema
    ├── START_CHAT_INSTRUCTIONS_*.md
    ├── SESSION_SUMMARY_*.md
    ├── WORKFLOW_STANDARDS_*.md
    └── SECRET_SAUCE_*.md
```

### SQL Scripts
- **Location:** `/home/claude/loyalty-demo/learnings/`
- **Naming:** `schema_snapshot.sql` (latest), timestamped backups if needed
- **Format:** Complete CREATE TABLE statements with comments
- **Update when:** Schema changes made

### Learning Files
- **Location:** `/home/claude/loyalty-demo/learnings/`
- **Naming:** `[TYPE]_YYYYMMDD_HHMM.md`
- **Timestamp format:** 20251106_2145 (sortable, no colons)
- **Find latest:** `ls -t /path/WORKFLOW_*.md | head -1`

### Documentation Format
- **Markdown:** Always use .md extension
- **Headers:** Use proper hierarchy (# ## ###)
- **Code blocks:** Always specify language (```bash, ```sql, ```javascript)
- **Lists:** Use - for bullets, 1. for numbered
- **Emoji:** Use sparingly for visual scanning (✅ ❌ ⚠️ 🎯)

---

## 🗄️ Database Conventions

### Data Type Sizing
**RIGHT-SIZE to domain, don't overallocate**

```sql
-- Tenant and Program IDs (never more than 32K)
tenant_id SMALLINT

-- Member IDs (10 digits max)
member_id BIGINT

-- Activity IDs (frequent, need range)
activity_id BIGSERIAL

-- Molecule IDs (moderate range)
molecule_id INTEGER

-- Point amounts (can be large)
points INTEGER or BIGINT

-- Dates (temporal model)
activity_date DATE
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- Codes and Keys
bonus_code VARCHAR(50)
molecule_key VARCHAR(100)

-- Descriptions
description TEXT (unlimited)
```

### Naming Conventions
- **Tables:** Singular nouns (activity, bonus, member)
- **Columns:** snake_case (activity_date, bonus_code, is_active)
- **Primary keys:** [table]_id (activity_id, bonus_id)
- **Foreign keys:** Match parent name (member_id, tenant_id)
- **Booleans:** is_[state] (is_active, is_permanent, is_required)
- **Timestamps:** created_at, updated_at

### Tenant Isolation
```sql
-- Every multi-tenant table MUST have:
tenant_id SMALLINT NOT NULL

-- Foreign key to tenant table
FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)

-- Index for queries
CREATE INDEX idx_[table]_tenant ON [table](tenant_id);
```

**Tables that are NOT tenant-specific:**
- member (spans tenants)
- activity (belongs to member, not tenant)
- point_lot (belongs to member)

**Tables that ARE tenant-specific:**
- program
- bonus
- molecule_def
- tier
- expiration_rule

### Molecule System Tables
```sql
-- Parent definition
molecule_def
  - molecule_id (PK)
  - molecule_key (unique per tenant)
  - context (activity, member, program, tenant, system)
  - value_kind (scalar, list, lookup)

-- Child value tables
molecule_value_text (text_value, display_label)
molecule_value_numeric (numeric_value, display_label)
molecule_value_date (date_value, display_label)
molecule_value_boolean (boolean_value, display_label)
molecule_value_lookup (lookup_table_key, display_label)

-- Transactional references
activity_detail (activity_id, molecule_id, v_ref_id)
```

### Universal Encode/Decode Functions
```sql
-- Store value, get v_ref_id
SELECT encode_molecule_value_universal(molecule_id, value, value_kind);

-- Get value from v_ref_id
SELECT decode_molecule_value_universal(molecule_id, v_ref_id);
```

---

## 🌐 Web Application Patterns

### Navigation Structure
- **Sidebar:** Left side, fixed position
- **Brand:** Top of sidebar ("Loyalty Platform Admin/CSR")
- **Nav items:** Injected from nav.js (if present)
- **Active state:** Highlight current page

### Tenant Selection
- **Where:** menu.html (entry point)
- **Storage:** sessionStorage.getItem('tenant_id')
- **Indicator:** Show current tenant in blue banner on all pages
- **Check:** Every page checks for tenant, redirects to menu if missing

### Admin Page Patterns

#### List Pages (e.g., admin_bonuses.html)
```
[← Back]  Page Title
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Tenant Indicator: Delta Air Lines]

[Filter Dropdowns]                [+ Add New]

[Table with data rows]
  - Each row has Edit / Delete buttons
  - Actions column on right
```

#### Edit Pages (e.g., admin_bonus_edit.html)
```
               Page Title        [← Back to List]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Tenant Indicator: Delta Air Lines]

[Form Fields in Sections]

                         [Cancel]  [Save]
```

**Form Patterns:**
- Read-only fields: Gray background, readonly attribute
- Required fields: Check before save, show error if empty
- Dates: Use `<input type="date">` (YYYY-MM-DD format)
- Dropdowns: Fixed options where possible
- Auto-populate: Load existing data when editing

#### Back Button Standard
- **Text:** "← Back to List"
- **Location:** Top right of page header AND/OR bottom near Save
- **Action:** `window.location.href='[list_page].html'`
- **Style:** `.btn.btn-secondary`

### CSR Pages
- **Member search:** Prominent at top
- **Member header:** Blue gradient with key info
- **Activity list:** Expandable rows
- **Point summary:** Always visible

---

## ⚙️ Server Conventions

### Version Tracking
```javascript
const SERVER_VERSION = "2025.11.06.2130"; // YYYY.MM.DD.HHMM
const BUILD_NOTES = "Brief description of changes";
```

**Display on startup:**
```
===========================================
Loyalty Platform API Server
Version: 2025.11.06.2130
Build: Re-enabled bonus evaluation, delete activity
===========================================
```

**Provide endpoint:**
```javascript
app.get('/version', (req, res) => {
  res.json({
    version: SERVER_VERSION,
    build_notes: BUILD_NOTES,
    database: dbClient ? 'connected' : 'disconnected'
  });
});
```

### Endpoint Patterns
```javascript
// GET - Retrieve data
app.get('/v1/resource/:id', async (req, res) => { ... });

// POST - Create (upsert pattern for some resources)
app.post('/v1/resource', async (req, res) => { ... });

// PUT - Update
app.put('/v1/resource/:id', async (req, res) => { ... });

// DELETE - Remove
app.delete('/v1/resource/:id', async (req, res) => { ... });
```

### Logging Pattern
```javascript
console.log(`\n🎯 [Endpoint Name] called...`);
console.log(`   ✓ Step completed`);
console.log(`   ✗ Error occurred`);
console.log(`✅ Success\n`);
```

**Use emoji for visual scanning:**
- 🎯 Starting operation
- 🎁 Bonus evaluation
- 🗑️ Deletion
- ✅ Success
- ❌ Error
- ⚠️ Warning

---

## 📊 Token Management

### Warning Thresholds
- **130k tokens:** Notice, continue working
- **150k tokens:** Warning, consider wrapping up
- **170k tokens:** Critical, prepare for handoff

### At Each Level

**130k - Awareness**
- Continue working normally
- Note in mind that we're past halfway

**150k - Caution**
- Start wrapping up current task
- Don't start new complex features
- Consider if this is a good stopping point

**170k - Prepare Handoff**
- Finish current small task only
- Begin handoff file creation
- Don't start anything new

### Token-Saving Strategies
- Use `view` with line ranges instead of full file
- Use `grep` to find specific code instead of viewing whole files
- Keep responses concise when appropriate
- Don't repeat large code blocks unnecessarily

---

## 👤 User Preferences

### Bill's Communication Style
- **Direct:** Says exactly what he means
- **Experienced:** Built systems for decades
- **Pattern-aware:** Notices when you deviate from standards
- **Expects completeness:** Wants full files, not instructions to edit
- **Values efficiency:** Appreciates concise, accurate responses

### Bill's Work Style
- **Iterative:** Builds incrementally, tests frequently
- **Data-driven:** Everything should come from data, not hardcoded
- **Quality-focused:** Correct > Fast
- **Pragmatic:** Solves real problems, not theoretical ones
- **Long-term view:** Designs systems to last

### Bill's Personal Preferences
- **Favorite color:** Green
- **Location:** Orono, Minnesota, US
- **Time zone:** Central Time (America/Chicago)
- **Coffee:** Yes (inferred from work hours)

### Bill's Corrections Mean:
- **"Stop!"** → You're heading in wrong direction, pause and listen
- **"NO!"** → Fundamental misunderstanding, pay close attention
- **"Why are you asking this?"** → Answer is obvious from data/context
- **"Shouldn't this come from molecule?"** → You're hardcoding
- **"That's out of pattern"** → You broke established convention
- **"Read the schema"** → You're making assumptions about data structure

---

## 🤖 Working with Claude - Behavior Guidelines

### CRITICAL RULES - Never Violate These

#### 1. Always Provide Complete Files
**DO:**
```
Here's the updated file:
[Download server_db_api.js](computer://...)
```

**DON'T:**
```
"Add this line after line 45..."
"Change the function to..."
"Update the query to..."
```

**Why:** Bill shouldn't have to manually edit code. That's your job.

#### 2. When Bill Says "STOP!" - Pause Immediately
**DO:**
- Stop what you're doing
- Listen to what Bill says next
- Ask what he wants instead
- Change direction completely if needed

**DON'T:**
- Keep explaining your approach
- Defend your decision
- "But I was just trying to..."

**Why:** Bill's instinct is right. You're on wrong path.

#### 3. Data Drives Behavior
**DO:**
- Read from molecules
- Query database for values
- Use lookup tables
- Decode values at runtime

**DON'T:**
- Hardcode carrier lists
- Hardcode error messages
- Hardcode status values
- Assume field values

**Why:** System is data-driven. Code should be agnostic.

#### 4. Read Schema Before Writing Code
**ALWAYS:**
1. View schema file
2. Understand table structure
3. Note data types
4. Check relationships
5. THEN write queries

**Why:** Prevents bugs, wrong assumptions, refactoring.

#### 5. Test Incrementally
**Pattern:**
1. Write endpoint
2. Test with curl
3. Verify with psql
4. Then integrate with UI

**DON'T:**
- Write code and claim it works
- Skip testing "simple" changes
- Test only via UI

**Why:** Bugs are easier to find in isolation.

#### 6. Listen to Bill's Corrections
**When Bill corrects you:**
- He's RIGHT
- Update your understanding
- Don't make same mistake again
- Adjust your mental model

**Why:** Bill has more context and experience.

### Communication Patterns

#### Good Questions
```
"Should [X] come from the molecule system?"
"What's the expected behavior when [Y]?"
"I see two approaches: [A] or [B]. Which fits your model?"
```

#### Bad Questions
```
"What carrier codes exist?" (query the database)
"What fields should I include?" (read the schema)
"Should I hardcode this list?" (NO, always NO)
```

#### When Uncertain
```
"Let me read the schema first..."
"Let me check what data exists..."
"Let me verify with a query..."
```

### Code Delivery Patterns

**ALWAYS:**
- Copy final files to /mnt/user-data/outputs/
- Provide download links
- Explain what changed
- Note any version updates

**NEVER:**
- Provide _FIXED or _NEW variants unless they're production
- Ask Bill to "update line 45"
- Give partial files
- Forget to copy to outputs

### Error Handling

**When You Make a Mistake:**
1. Acknowledge it clearly
2. Fix it immediately
3. Provide corrected file
4. Don't make excuses

**When Something Doesn't Work:**
1. Check the data first
2. Read error messages carefully
3. Test each component
4. Ask Bill for clarification if needed

---

## 🔧 Common Commands Reference

### Database Queries
```bash
# Quick query
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM bonus;"

# Interactive mode
psql -h 127.0.0.1 -U billjansen -d loyalty

# Export schema
pg_dump -h 127.0.0.1 -U billjansen -d loyalty --schema-only > schema.sql

# Check molecule
psql -h 127.0.0.1 -U billjansen -d loyalty -c "
  SELECT md.*, mvt.text_value, mvt.display_label 
  FROM molecule_def md 
  LEFT JOIN molecule_value_text mvt ON md.molecule_id = mvt.molecule_id 
  WHERE md.molecule_key = 'error_messages';
"
```

### File Operations
```bash
# View file
view /home/claude/loyalty-demo/server_db_api.js

# View specific lines
view /home/claude/loyalty-demo/server_db_api.js [start_line, end_line]

# Find in files
grep -rn "searchterm" /home/claude/loyalty-demo/*.js

# Copy to outputs
cp /home/claude/loyalty-demo/file.html /mnt/user-data/outputs/

# List recent files
ls -lt /home/claude/loyalty-demo/*.html | head -10
```

### Server Operations
```bash
# Start server
cd /home/claude/loyalty-demo && node server_db_api.js

# Check version
curl http://127.0.0.1:4001/version

# Test endpoint
curl "http://127.0.0.1:4001/v1/member/2153442807"

# POST data
curl -X POST http://127.0.0.1:4001/v1/bonuses \
  -H "Content-Type: application/json" \
  -d '{"bonus_code":"TEST","bonus_description":"Test Bonus",...}'
```

### Quick Diagnostics
```bash
# Check if server running
lsof -i :4001

# Check database connection
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT 1;"

# Find latest handoff files
ls -t /home/claude/loyalty-demo/learnings/*.md | head -5
```

---

## 🎨 UI/UX Standards

### Colors and Badges

**Context Colors:**
- 🔵 activity: `#dbeafe` / `#1e40af`
- 🟡 member: `#fef3c7` / `#92400e`
- 🟢 program: `#dcfce7` / `#166534`
- 🟢 tenant: `#d1fae5` / `#065f46`
- 🟣 system: `#f3e8ff` / `#6b21a8`

**Status Colors:**
- ✅ Active/Success: Green
- ❌ Inactive/Error: Red
- ⚠️ Warning: Yellow/Amber
- ℹ️ Info: Blue

**Button Colors:**
- Primary action: Blue (`#2563eb`)
- Secondary/Cancel: Gray
- Danger/Delete: Red (`#dc2626`)
- Success: Green (`#059669`)

### Typography
- **Headings:** Bold, clear hierarchy
- **Body:** 14px base size
- **Labels:** 12-13px, slightly muted
- **Code/IDs:** Monospace font

### Spacing
- **Card padding:** 20px
- **Form gaps:** 12-16px between fields
- **Button gaps:** 8-12px between buttons
- **Section margins:** 20-24px between sections

---

## 🚀 Deployment and Releases

### Version Numbering
**Format:** YYYY.MM.DD.HHMM

**Examples:**
- 2025.11.06.1730 (Nov 6, 5:30 PM)
- 2025.11.06.2130 (Nov 6, 9:30 PM)
- 2025.11.07.0915 (Nov 7, 9:15 AM)

**Increment:**
- Every significant change
- When deploying to Bill
- After fixing bugs
- After adding features

**Build Notes:**
- Concise description
- Key changes only
- Under 100 characters

### Release Checklist
- [ ] Update SERVER_VERSION
- [ ] Update BUILD_NOTES
- [ ] Test all modified endpoints
- [ ] Copy files to outputs
- [ ] Provide download links
- [ ] Update session summary

---

## 📚 Learning from Past Sessions

### Patterns That Work
1. **Read schema first** - Prevents most bugs
2. **Test with curl** - Catches issues early
3. **Small iterations** - Easier to debug
4. **Data-driven** - System stays flexible
5. **Complete files** - Bill never edits manually

### Patterns to Avoid
1. **Hardcoding values** - Should come from data
2. **Assuming structure** - Always check schema
3. **Partial deliveries** - Always complete files
4. **Skipping tests** - Always test with curl
5. **Ignoring corrections** - Bill is always right

### Red Flags
- Bill says "stop" → Wrong direction
- Bill says "NO" → Fundamental misunderstanding
- Bill asks "why?" → Answer is obvious
- Bill mentions molecules → You're hardcoding
- Bill mentions pattern → You broke convention

### Green Flags
- Bill says "perfect" → Keep going
- Bill says "yes" → Correct direction
- Bill suggests next step → Aligned on approach
- Bill asks specific question → Good engagement
- Bill tests immediately → Confidence in your work

---

**Remember:** This document grows with each session. Add new learnings, never delete old ones. The accumulated wisdom makes each session better than the last.
