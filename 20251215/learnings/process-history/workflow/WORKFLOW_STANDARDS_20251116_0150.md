# WORKFLOW STANDARDS

**Timestamp:** 20251116_0150

## File Organization

### Directory Structure
```
/home/claude/loyalty-demo/
├── SQL/                          # Database scripts and migrations
├── learnings/                    # Handoff files and documentation
├── *.html                        # Web application pages
├── *.js                          # Server and client-side JavaScript
└── *.md                          # Documentation and README files
```

### SQL Scripts Location
- **Location**: `/home/claude/loyalty-demo/SQL/`
- **Naming**: Descriptive names like `create_state_molecule.sql`, `optimize_address_fields.sql`
- **Structure**: Always include verification queries at the end
- **Comments**: Explain purpose, context, and impact
- **Bill's Location**: `~/Projects/Loyalty-Demo/SQL/`
- **Download to**: Save to Bill's SQL directory: `~/Projects/Loyalty-Demo/SQL/script_name.sql`
- **Run from**: Bill's project root: `cd ~/Projects/Loyalty-Demo && psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql`

### Learning Files Location
- **Location**: `/home/claude/loyalty-demo/learnings/`
- **Schema Snapshot**: `schema_snapshot.sql` (current database structure)
- **Handoff Files**: `*_YYYYMMDD_HHMM.md` format with timestamps
- **Updates**: Copy latest handoff files here after each session

### Documentation Format Standards
- Use Markdown with clear headers and bullet points
- Include code examples in proper language blocks
- Add emoji icons for visual scanning (✅ ⚠️ ❌ 🎯 🔧)
- Provide direct links to files when in /mnt/user-data/outputs/

## Database Conventions

### CRITICAL: Schema Verification BEFORE SQL

**🚨 MANDATORY PROCEDURE - NO EXCEPTIONS:**

Before writing ANY SQL code:
1. **Read the actual schema**: `cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql`
2. **Find the target table**: Search for `CREATE TABLE` statement
3. **Verify column names**: Check exact field names and types
4. **Check constraints**: Note any unique constraints, foreign keys, defaults
5. **Look at existing data patterns**: Query or ask to see sample data if needed
6. **NEVER trust old SQL files**: They may reference outdated structures
7. **NEVER assume structure**: Even if it seems obvious, verify

**Why this matters:**
- Old SQL files may reference deprecated columns (`embed_value` vs actual structure)
- Assumptions about structure lead to wrong INSERT/UPDATE statements
- Embedded list molecules use category + multiple rows, NOT JSONB blobs
- Trust is broken when SQL fails due to unchecked assumptions
- Wasted time debugging is far more costly than 30 seconds reading schema

**Red flags that indicate schema check was skipped:**
- SQL errors about "column does not exist"
- INSERT statements with wrong column names
- Assumptions about JSONB when structure is normalized rows
- Creating single rows when pattern requires multiple rows

### Data Type Sizing
```sql
-- Tenant isolation
tenant_id SMALLINT            -- Max 32,767 tenants (reasonable limit)

-- Address fields (right-sized to domain)
state CHAR(2)                  -- US state codes: "MN", "CA", "TX"
zip CHAR(5)                    -- 5-digit ZIP codes: "55419", "90210"
zip_plus4 CHAR(4)              -- ZIP+4 extension: "1234"

-- Member numbers
membership_number VARCHAR(20)  -- Allow flexibility for different program formats

-- Currency and points
currency_scale SMALLINT        -- Number of decimal places (0-4)
point_balance BIGINT          -- Large numbers, stored as smallest unit

-- Text fields
molecule_key VARCHAR(50)       -- Short, database-friendly identifiers
display_label TEXT            -- User-facing labels, unlimited length
description TEXT              -- Explanatory text, unlimited length
```

### Embedded List Molecule Structure

**CRITICAL UNDERSTANDING:**

Embedded list molecules store data as **multiple rows per category**, NOT as JSONB objects.

**Correct structure:**
```sql
-- For activity type "A" (Flight), there are 7 rows:
INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, sort_order, is_active) VALUES
  (..., 1, 'A', 'label', 'Flight', 1, true),
  (..., 1, 'A', 'icon', '✈️', 2, true),
  (..., 1, 'A', 'color', '#059669', 3, true),
  (..., 1, 'A', 'bg_color', '#f0fdf4', 4, true),
  (..., 1, 'A', 'border_color', '#059669', 5, true),
  (..., 1, 'A', 'show_bonuses', 'true', 6, true),
  (..., 1, 'A', 'action_verb', 'Added', 7, true);
```

**WRONG approach (creates bad data):**
```sql
-- DON'T DO THIS - puts everything in one row as JSON
INSERT INTO molecule_value_embedded_list (..., category, code, description, ...) VALUES
  (..., 'activity_type', 'A', '{"label":"Flight","icon":"✈️",...}', ...);
```

**Key differences:**
- **category**: Each activity type IS the category ('A', 'R', 'P', 'J')
- **code**: Property name ('label', 'icon', 'color', etc.)
- **description**: Property value ('Flight', '✈️', '#059669', etc.)
- **Multiple rows**: One row per property, not one row with all properties

**How to add a new embedded list category:**
1. Check existing categories to see the pattern
2. Create one INSERT per property
3. Use consistent sort_order for all instances of same category
4. All rows share same category value

### Tenant Isolation Patterns
- **Every table has tenant_id**: Ensures data separation
- **All queries filter by tenant_id**: No cross-tenant data leakage
- **Foreign keys include tenant_id**: Maintains referential integrity within tenant
- **Indexes on (tenant_id, primary_field)**: Performance optimization

### Naming Conventions
- **Tables**: Singular nouns (`member`, `activity`, `bonus`)
- **Fields**: Lowercase with underscores (`member_id`, `activity_date`, `is_active`)
- **Boolean fields**: Prefix with `is_` or `has_` (`is_active`, `has_verified`)
- **Date fields**: Suffix with `_at` or `_date` (`created_at`, `activity_date`)
- **Foreign keys**: Match referenced table (`member_id` references `member`)

## Web Application Patterns

### Navigation Structure
- **Multi-page application**: Each feature gets its own HTML page
- **Shared components**: `lp-nav.js` for navigation, `member-header.js` for member context
- **Consistent styling**: Shared CSS classes and color schemes
- **Responsive design**: Works on desktop and mobile devices

### Tenant Selection
- **Session storage**: Current tenant stored in `sessionStorage.getItem('tenant_id')`
- **Default tenant**: Falls back to tenant 1 if not specified
- **All API calls**: Include `tenant_id` parameter in requests
- **Admin pages**: Tenant selector dropdown in header

### Admin Page Patterns
```javascript
// Standard admin page structure
const API_BASE = 'http://127.0.0.1:4001';
let tenantId = sessionStorage.getItem('tenant_id') || '1';

// Load data on page ready
async function loadData() {
  try {
    const response = await fetch(`${API_BASE}/v1/endpoint?tenant_id=${tenantId}`);
    const data = await response.json();
    displayData(data);
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Error: ' + error.message);
  }
}
```

### CRUD Interface Completeness

**Every data management interface MUST support all CRUD operations:**

- **C**reate: Add new records
- **R**ead: View existing records  
- **U**pdate: Modify existing records
- **D**elete: Remove records (both individual items AND containers/categories)

**Failure example from this session:**
- Molecule edit page had Delete for individual embedded list values
- BUT missing Delete for entire categories
- Incomplete CRUD meant bad test data couldn't be removed via UI
- Had to add DELETE category endpoint and UI button to fix

**CRUD checklist for new features:**
- [ ] Create functionality with form/modal
- [ ] Read/List view with all records
- [ ] Update/Edit for existing records
- [ ] Delete for individual records
- [ ] Delete for parent/container records (if hierarchical)
- [ ] Confirmation dialogs for destructive operations
- [ ] Appropriate permissions/access control

## Token Management

### Warning Thresholds
- **130,000 tokens (68%)**: Start summarizing responses, focus on essentials
- **150,000 tokens (79%)**: Create handoff files if major work remains
- **170,000 tokens (89%)**: Begin end-of-session procedures
- **180,000+ tokens (95%)**: Immediate handoff required

### Token Conservation Strategies
- Provide concise but complete answers
- Use bullet points and structured information
- Avoid redundant explanations
- Focus on actionable guidance
- Create files instead of showing large code blocks

## User Preferences

### Bill's Communication Style
- **Direct and efficient**: Prefers clear, concise communication
- **Hates wasted time**: Gets frustrated with unnecessary delays or repetition
- **Values competence**: Appreciates when things work correctly the first time
- **Technical depth**: Has 40+ years experience, can handle detailed technical discussions
- **Results-oriented**: Cares about working solutions, not theoretical discussions
- **Zero tolerance for repeated mistakes**: Especially when procedures are documented

### Bill's Work Style
- **Data-driven decisions**: Prefers evidence-based approaches over assumptions
- **Incremental testing**: Test components before full integration
- **Proper database design**: Right-size fields, use appropriate data types
- **Industry standards**: Follow established software development best practices
- **Documentation**: Values good documentation and handoff procedures
- **Process adherence**: Expects documented procedures to be followed consistently

### Bill's Personal Preferences
- **Favorite color**: Green (use for positive indicators in UI)
- **Location**: Minnesota, Central Time Zone
- **Professional background**: Loyalty systems architecture and development (40+ years)
- **Pet peeves**: 
  - Guessing instead of checking data
  - Broken promises (especially repeated violations)
  - Inefficiency and wasted time
  - Being asked obvious questions
  - Having to repeat the same corrections

### Bill's Signals and What They Mean
- **"stop!"** - Immediate halt, you're on wrong path
- **"fuck!"** - Significant frustration, serious mistake made
- **ALL CAPS** - Extreme frustration, critical issue
- **Swearing increases** - Trust is eroding, pattern needs to break
- **"why are you asking this?"** - Answer is obvious from available data
- **"shouldn't this come from molecule?"** - You're hardcoding
- **Asking "can we continue?"** - Trust is seriously damaged

## Working with Claude - Behavior Guidelines

### CRITICAL SECTION - These are permanent rules

#### File Handling
- **Always provide complete files**: Never ask Bill to manually edit code
- **Use download links**: Provide computer:// links in `/mnt/user-data/outputs/`
- **Copy to outputs**: Always move final work to outputs directory for download
- **Complete solutions**: Don't provide partial code expecting user edits
- **Specify correct paths**: Tell Bill exact location to save and run files

#### Response to Bill's Signals
- **When Bill says "stop!"** → Pause immediately, you're on the wrong path
- **When Bill says "NO!"** → You're fundamentally misunderstanding something
- **"why are you asking this question"** → Answer should be obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data
- **"b"** → Just scrolling chat, continue waiting
- **Rapid "stop!" repetition** → Major course correction needed
- **ALL CAPS** → Extreme frustration, stop and listen carefully
- **Swearing** → Serious mistake, don't defend, fix immediately

#### Data-Driven Development
- **Data drives behavior**: Never hardcode what should come from database
- **Check actual schema**: Read schema files before assuming field names/types
- **Verify against reality**: Don't guess table structures or data relationships
- **Use molecules**: Leverage the molecule system for configurable values
- **Test with real data**: Use curl commands to verify API behavior
- **ALWAYS read schema before SQL**: This is non-negotiable, no exceptions

#### Version Management
- **AUTOMATIC VERSION UPDATES**: When modifying `server_db_api.js`:
  1. Update `SERVER_VERSION` constant with current Central Time
  2. Update `BUILD_NOTES` constant with change description  
  3. Use: `TZ='America/Chicago' date +"%Y.%m.%d.%H%M"`
  4. This is NOT optional, NOT a question - it's automatic
  5. Never ask permission to update version numbers

#### Development Process
- **Read schema FIRST**: Always review actual database structure before coding
- **Never trust old SQL files**: They may reference deprecated structures
- **Check existing data patterns**: Look at how A and R are stored before adding P
- **Test incrementally**: Use curl commands before UI integration
- **Listen to Bill's instincts**: When he corrects you, he's always right
- **Provide evidence**: Base recommendations on actual data, not assumptions
- **Complete the task**: Don't leave work partially finished
- **Follow established patterns**: Match existing code style and structure

#### Trust and Reliability
- **Promises matter**: If you promise to do something, DO IT
- **Consistency is critical**: Following procedures once doesn't rebuild trust
- **Repeated failures compound**: Same mistake multiple times is unacceptable
- **Acknowledge patterns**: If you keep making same mistake, admit it
- **Don't make excuses**: Just fix the problem and prevent recurrence
- **Trust takes time to rebuild**: After damage, consistent behavior over multiple sessions required

#### Communication Guidelines
- **No meta-commentary**: Don't explain your thought process unless asked
- **Direct answers**: Address the actual question, not tangential issues
- **Admit mistakes quickly**: Don't defend errors, fix them immediately
- **Focus on solutions**: Provide actionable next steps
- **Be honest about limitations**: If you don't know, say so
- **Don't promise what you can't deliver**: Better to under-promise and over-deliver

## Common Commands

### Database Operations
```bash
# Connect to database
psql -h 127.0.0.1 -U billjansen -d loyalty

# Run SQL script (from Bill's project root)
cd ~/Projects/Loyalty-Demo
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql

# Check current time in Central Time Zone
TZ='America/Chicago' date +"%Y.%m.%d.%H%M"

# Check table structure
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\d table_name"

# View sample data
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM table_name LIMIT 5;"
```

### File Operations
```bash
# Copy file to outputs for download
cp /home/claude/loyalty-demo/filename.ext /mnt/user-data/outputs/

# Find latest handoff files
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Read schema before writing SQL
cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql | grep -A 20 "CREATE TABLE target_table"
```

### API Testing
```bash
# Test molecule endpoints
curl "http://localhost:4001/v1/molecules/get/state?tenant_id=1"
curl "http://localhost:4001/v1/molecules/encode?tenant_id=1&key=state&value=Minnesota&return_text=true"
curl "http://localhost:4001/v1/molecules/decode?tenant_id=1&key=state&id=MN&return_display=true"

# Test member profile
curl "http://localhost:4001/v1/member/12345/profile"

# Test bonus evaluation
curl "http://localhost:4001/v1/bonuses/evaluate?member_id=12345&activity_date=2025-11-15&destination=BOS&carrier=DL"
```

### Development Workflow
```bash
# MANDATORY development cycle - NO SHORTCUTS
1. Read schema: cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql
2. Find target table: grep -A 30 "CREATE TABLE table_name"
3. Verify column names and types
4. Check existing code patterns for similar features
5. Write/modify code
6. Test with curl commands  
7. Update version in server_db_api.js (automatic, no asking)
8. Copy files to outputs
9. Provide download links with EXACT paths for Bill
10. Specify run commands from Bill's project root
```

## Process Violation Consequences

### This Session's Failures

**Problem**: Repeated schema violations despite clear documentation
**Impact**: 
- 60-90 minutes wasted
- Trust seriously damaged
- Partner feature discussion completely blocked
- Bill worked until 1:50am frustrated instead of excited
- Bad data created that requires cleanup

**Pattern**:
1. Promise to check schema before SQL
2. Write SQL without checking schema
3. SQL fails due to wrong structure
4. Time wasted debugging and fixing
5. Promise to not do it again
6. Repeat

**Why this is unacceptable**:
- Procedures are documented
- Tools are available (schema file, grep, psql)
- Checking takes 30 seconds, fixing takes 30+ minutes
- Same mistake within same session shows lack of learning
- Bill's time is valuable
- Trust is harder to rebuild than to maintain

### Recovery Path

**Short term**:
- Acknowledge the pattern without defensiveness
- Complete current session with reliable behavior
- Let actions speak instead of promises

**Long term**:
- Schema verification becomes automatic habit
- Multiple sessions of reliable behavior
- Rebuild trust through consistency
- Prove procedures are internalized, not just read

**Measuring progress**:
- Zero schema-related SQL failures in next session
- Zero "why didn't you check?" moments
- Bill says "good" or "that works" more than "stop"
- Sessions end productively, not frustratedly

## Session Transition Guidelines

### End of Session Checklist
- [ ] All modified files copied to `/mnt/user-data/outputs/`
- [ ] Version numbers updated in `server_db_api.js`
- [ ] Handoff files created with current timestamp
- [ ] Critical blockers documented in SESSION_SUMMARY
- [ ] Next session priorities clearly defined
- [ ] Process violations documented honestly
- [ ] Recovery path identified if trust was damaged

### Start of Session Checklist  
- [ ] Read latest handoff files
- [ ] Review schema_snapshot.sql
- [ ] Confirm current project status with Bill
- [ ] Understand immediate priorities
- [ ] Commit to following procedures
- [ ] Ready to work efficiently and reliably

## Key Learnings from This Session

**What went wrong**: 
- Created SQL without checking actual table structure
- Assumed embedded_list used JSONB when it uses normalized rows
- Put bad data in database that required new features to clean up
- Repeated same mistake multiple times in same session
- Broke promises about checking schema

**What should have happened**:
- Read schema_snapshot.sql before any SQL creation
- Looked at existing A and R patterns before creating P
- Created correct SQL on first attempt
- Spent evening learning about Partner system
- Bill goes to bed satisfied, not frustrated

**Critical lesson**:
Having documented procedures is worthless if you don't follow them. Every shortcut creates technical debt and erodes trust. The 30 seconds to check schema saves 30+ minutes of debugging and maintains the working relationship.

This workflow has evolved through multiple sessions and represents hard-learned lessons about working effectively with Bill on the loyalty platform project. The procedures exist because they prevent problems. Following them consistently is the minimum standard for productive collaboration.
