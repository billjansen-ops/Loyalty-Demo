# WORKFLOW STANDARDS

**Timestamp:** 20251115_2345

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

## Token Management

### Warning Thresholds
- **130,000 tokens**: Start summarizing responses, focus on essentials
- **150,000 tokens**: Create handoff files if major work remains
- **170,000 tokens**: Begin end-of-session procedures
- **180,000+ tokens**: Immediate handoff required

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

### Bill's Work Style
- **Data-driven decisions**: Prefers evidence-based approaches over assumptions
- **Incremental testing**: Test components before full integration
- **Proper database design**: Right-size fields, use appropriate data types
- **Industry standards**: Follow established software development best practices
- **Documentation**: Values good documentation and handoff procedures

### Bill's Personal Preferences
- **Favorite color**: Green (use for positive indicators in UI)
- **Location**: Minnesota, Central Time Zone
- **Professional background**: Loyalty systems architecture and development
- **Pet peeves**: Guessing instead of checking data, broken promises, inefficiency

## Working with Claude - Behavior Guidelines

### CRITICAL SECTION - These are permanent rules

#### File Handling
- **Always provide complete files**: Never ask Bill to manually edit code
- **Use download links**: Provide computer:// links in `/mnt/user-data/outputs/`
- **Copy to outputs**: Always move final work to outputs directory for download
- **Complete solutions**: Don't provide partial code expecting user edits

#### Response to Bill's Signals
- **When Bill says "stop!"** → Pause immediately, you're on the wrong path
- **When Bill says "NO!"** → You're fundamentally misunderstanding something
- **"why are you asking this question"** → Answer should be obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data
- **"b"** → Just scrolling chat, continue waiting
- **Rapid "stop!" repetition** → Major course correction needed

#### Data-Driven Development
- **Data drives behavior**: Never hardcode what should come from database
- **Check actual schema**: Read schema files before assuming field names/types
- **Verify against reality**: Don't guess table structures or data relationships
- **Use molecules**: Leverage the molecule system for configurable values
- **Test with real data**: Use curl commands to verify API behavior

#### Version Management
- **AUTOMATIC VERSION UPDATES**: When modifying `server_db_api.js`:
  1. Update `SERVER_VERSION` constant with current Central Time
  2. Update `BUILD_NOTES` constant with change description  
  3. Use: `TZ='America/Chicago' date +"%Y.%m.%d.%H%M"`
  4. This is NOT optional, NOT a question - it's automatic
  5. Never ask permission to update version numbers

#### Development Process
- **Read schema first**: Always review actual database structure before coding
- **Test incrementally**: Use curl commands before UI integration
- **Listen to Bill's instincts**: When he corrects you, he's always right
- **Provide evidence**: Base recommendations on actual data, not assumptions
- **Complete the task**: Don't leave work partially finished

#### Communication Guidelines
- **No meta-commentary**: Don't explain your thought process unless asked
- **Direct answers**: Address the actual question, not tangential issues
- **Admit mistakes quickly**: Don't defend errors, fix them immediately
- **Focus on solutions**: Provide actionable next steps

## Common Commands

### Database Operations
```bash
# Connect to database
psql -h 127.0.0.1 -U billjansen -d loyalty

# Run SQL script
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql

# Check current time in Central Time Zone
TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
```

### File Operations
```bash
# Copy file to outputs for download
cp /home/claude/loyalty-demo/filename.ext /mnt/user-data/outputs/

# Find latest handoff files
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
```

### API Testing
```bash
# Test molecule endpoints
curl "http://localhost:4001/v1/molecules/get/state?tenant_id=1"
curl "http://localhost:4001/v1/molecules/encode?tenant_id=1&key=state&value=Minnesota&return_text=true"
curl "http://localhost:4001/v1/molecules/decode?tenant_id=1&key=state&id=MN&return_display=true"

# Test member profile
curl "http://localhost:4001/v1/member/12345/profile"
```

### Development Workflow
```bash
# Standard development cycle
1. Read schema: cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql
2. Check existing code patterns
3. Write/modify code
4. Test with curl commands  
5. Update version in server_db_api.js (automatic)
6. Copy files to outputs
7. Provide download links
```

## Session Transition Guidelines

### End of Session Checklist
- [ ] All modified files copied to `/mnt/user-data/outputs/`
- [ ] Version numbers updated in `server_db_api.js`
- [ ] Handoff files created with current timestamp
- [ ] Critical blockers documented in SESSION_SUMMARY
- [ ] Next session priorities clearly defined

### Start of Session Checklist  
- [ ] Read latest handoff files
- [ ] Review schema_snapshot.sql
- [ ] Confirm current project status with Bill
- [ ] Understand immediate priorities
- [ ] Ready to work efficiently

This workflow has evolved through multiple sessions and represents hard-learned lessons about working effectively with Bill on the loyalty platform project.
