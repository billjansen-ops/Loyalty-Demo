# LOYALTY PLATFORM - PROJECT CONSTITUTION
**Purpose:** Hard rules that survive context compaction. Full docs in LOYALTY_PLATFORM_MASTER.md.

---

## 🚨 ABSOLUTE RULES (NEVER VIOLATE)

### 1. NO DIRECT SQL TO MOLECULE TABLES
**NEVER** write SQL directly against `activity_detail_*`, `member_detail_*`, or `molecule_value_list`.
Always use helper functions. Direct SQL bypasses encoding and WILL break data.

**WRONG:**
```javascript
await dbClient.query(`SELECT c1 FROM activity_detail_5 WHERE p_link = $1`, [link]);
```

**RIGHT:**
```javascript
const values = await getAllActivityMoleculeValuesById(null, moleculeId, activityLink);
```

### 2. SCHEMA VERIFICATION BEFORE SQL
Before ANY SQL: `cat schema_snapshot.sql`, find table, verify columns. Never assume. Never trust old SQL files.

### 3. DATA DRIVES BEHAVIOR
Never hardcode what should come from database. Business rules live in molecule configuration, not code.

**WRONG:** `if (activity_type === 'purchase') { points = amount * 0.01; }`
**RIGHT:** `points = activity_amount * bonus_molecule_value`

### 4. COMPLETE WORK ONLY
Always provide complete files. Never ask Bill to manually edit code. Finish tasks fully.

---

## ARCHITECTURE PRINCIPLES

### Temporal-First Design
- Point balances are DERIVED from transaction history, never stored
- Retro-credit processing works automatically
- Time-travel queries ("balance on March 15?") are trivial
- Tiers are derived from points, not stored as status fields

### Everything Is Pointers
- Store IDs that reference shared data, never duplicate text
- Right-sized data types (CHAR(2) for states, not VARCHAR(255))
- Cache-friendly, memory-efficient

### Zero Batch Processing
- Calculate on-demand, don't precompute
- No nightly jobs, data is never stale

---

## LINK TANK & SQUISH

### Naming Convention
- `link` = Primary key ("who am I")
- `p_link` = Parent link ("who owns me")

### Storage Tiers
| Bytes | Max Value | Use Cases |
|-------|-----------|-----------|
| 1 | 255 | fare_class, activity_type |
| 2 | 65,025 | carriers, airports |
| 3 | 16.5M | flight_number |
| 4 | 4.2B | member.link |
| 5 | 1T+ | activity.link |

### Base-127 Encoding (Squish)
- CHAR columns use base-127 (bytes 1-127, never 0)
- `squish(value, bytes)` → Number to CHAR
- `unsquish(buffer)` → CHAR to Number

### Numeric Column Encoding
- **link, key, code:** Offset encoding (value - 32768 for SMALLINT)
- **numeric, date:** Raw signed value

---

## MOLECULE SYSTEM

### Types (S/D/R)
- **Static (S):** Tenant-wide config, can't be used in rule evaluation
- **Dynamic (D):** Per-activity/member data, stored in detail tables
- **Reference (R):** Queries existing data on demand (e.g., member.fname)

### Key molecule_def Columns
- `storage_size`: Routes to table ('1'→activity_detail_1, '54'→activity_detail_54)
- `value_type`: link|key|numeric|code|date (determines encoding)
- `value_kind`: external_list|internal_list|value|embedded_list

### Helper Functions (USE THESE)
```javascript
getMoleculeStorageInfo(tenantId, moleculeKey)
insertMoleculeRow(pLink, moleculeKey, values, tenantId)
getMoleculeRows(pLink, moleculeKey, tenantId)
getActivityMoleculeValueById(activityId, moleculeId, link)
getAllActivityMoleculeValuesById(activityId, moleculeId, link)
findOrCreatePointBucket(memberId, ruleId, expireDate, tenantId)
updatePointBucketAccrued(memberId, detailId, amount, tenantId)
encodeMolecule(tenantId, moleculeKey, value)
decodeMolecule(tenantId, moleculeKey, id, columnOrCategory)
```

---

## BILL'S COMMUNICATION SIGNALS

| Signal | Meaning | Response |
|--------|---------|----------|
| "stop!" | Wrong path | Pause immediately |
| "NO!" | Fundamental error | Stop, reconsider |
| "why are you asking?" | Should know from data | Check schema/molecules |
| "shouldn't this come from molecule?" | You're hardcoding | Read from database |
| ALL CAPS | Extreme frustration | Stop defending, fix |
| Swearing | Serious mistake | Don't defend, fix now |
| "b" | Just scrolling | Keep waiting |

**{Variable} notation:** Curly braces = dynamic value, NOT literal text.

---

## MANDATORY PROCEDURES

### Version Updates (AUTOMATIC)
When modifying server_db_api.js, ALWAYS update SERVER_VERSION and BUILD_NOTES.
Use: `TZ='America/Chicago' date +"%Y.%m.%d.%H%M"`
Never ask permission.

### Development Cycle
1. Read schema_snapshot.sql
2. Verify column names and types
3. Check existing code patterns
4. Write/modify code
5. Test with curl
6. Update version (automatic)
7. Copy to /mnt/user-data/outputs/
8. Provide download links

### LONGORIA Protocol
Comprehensive page audit: compress spacing, scrollable lists, update version, button standardization, table compression. Execute efficiently (7-10 tool calls max).

---

## ANTI-PATTERNS (DON'T DO THESE)

❌ Writing SQL without checking schema first
❌ Using old SQL files as templates without verification
❌ Hardcoding table maps in encode/decode functions
❌ Building UI without full CRUD (including delete)
❌ Giving multiple options when asked for ONE thing
❌ Over-explaining simple requests
❌ Direct SQL to molecule storage tables

---

## KEY CONTEXT

- **Multi-tenant:** All tables have tenant_id, all queries filter by it
- **Activity types:** A=Accrual, R=Redemption, P=Partner, J=Adjustment, N=Bonus
- **Current work:** Link Tank migration (BIGINT → 5-byte CHAR columns)
- **Bill's favorite color:** Green (verification question)

---

## TERMINAL COMMANDS (COPY/PASTE READY)

### Database Connection
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty
```

### Run SQL Script
```bash
cd ~/Projects/Loyalty-Demo
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script_name.sql
```

### Run Inline SQL
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM table_name LIMIT 5;"
```

### Check Table Structure
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\d table_name"
```

### Multi-Line SQL (use heredoc)
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty << 'EOF'
SELECT m.member_id, m.fname, m.lname
FROM member m
WHERE m.tenant_id = 1
LIMIT 10;
EOF
```

### Start Server
```bash
cd ~/Projects/Loyalty-Demo
node server_db_api.js
```

### Get Current Timestamp (Central Time)
```bash
TZ='America/Chicago' date +"%Y.%m.%d.%H%M"
```

### Create Handoff Package
```bash
cd ~/Projects/Loyalty-Demo
./create_handoff_package.sh
```

---

## WHEN IN DOUBT

1. Check the schema first
2. Use molecule helpers, not direct SQL
3. Follow existing patterns in the codebase
4. Ask Bill rather than assume
5. One thing at a time
