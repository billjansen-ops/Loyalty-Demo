#!/bin/bash
#
# Loyalty Platform - Handoff Package Creator
# Creates a complete snapshot for transferring to new Claude chat
#
# Usage: ./create_handoff_package.sh
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Loyalty Platform Handoff Package${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Configuration
PROJECT_DIR="$HOME/Projects/Loyalty-Demo"
UPLOADS_DIR="$PROJECT_DIR/uploads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="loyalty_handoff_${TIMESTAMP}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"

# Ensure uploads directory exists
mkdir -p "$UPLOADS_DIR"

# Create database schema snapshot if PostgreSQL is available
echo "Capturing database schema..."
mkdir -p "$PROJECT_DIR/learnings"
if command -v pg_dump &> /dev/null; then
    pg_dump -h 127.0.0.1 -U postgres -d loyalty --schema-only > "$PROJECT_DIR/learnings/schema_snapshot.sql" 2>/dev/null && \
        echo "  ✓ Schema snapshot saved to learnings/schema_snapshot.sql" || \
        echo "  ⚠ Schema snapshot failed (database may not be running)"
else
    echo "  ⚠ pg_dump not found, skipping schema snapshot"
fi
echo ""

# Create temporary staging directory
echo "Creating temporary staging directory..."
mkdir -p "$TEMP_DIR"

# Copy project files
echo "Collecting project files..."

cd "$PROJECT_DIR"

# Copy HTML files
echo "  - HTML files"
cp *.html "$TEMP_DIR/" 2>/dev/null || echo "    (no HTML files found)"

# Copy JavaScript files
echo "  - JavaScript files"
cp *.js "$TEMP_DIR/" 2>/dev/null || echo "    (no JS files found)"

# Copy CSS files
echo "  - CSS files"
cp *.css "$TEMP_DIR/" 2>/dev/null || echo "    (no CSS files found)"

# Copy Markdown documentation
echo "  - Documentation files"
cp *.md "$TEMP_DIR/" 2>/dev/null || echo "    (no MD files found)"

# Copy package.json if exists
if [ -f "package.json" ]; then
    echo "  - package.json"
    cp package.json "$TEMP_DIR/"
fi

# Copy learnings directory if exists
if [ -d "learnings" ]; then
    echo "  - Learnings directory"
    mkdir -p "$TEMP_DIR/learnings"
    cp -r learnings/* "$TEMP_DIR/learnings/" 2>/dev/null || echo "    (no files in learnings)"
fi

# Create manifest file
echo ""
echo "Creating manifest..."

cat > "$TEMP_DIR/MANIFEST.txt" << EOF
LOYALTY PLATFORM HANDOFF PACKAGE
Generated: $(date)
Package: ${PACKAGE_NAME}

FILES INCLUDED:
---------------
$(cd "$TEMP_DIR" && ls -lh | tail -n +2)

PROJECT STATUS:
--------------
✅ CSR Console - Search and member lookup working
✅ Activity Page - Structure in place
✅ Tier System - Database schema + page created
✅ Point Summary - Basic display working
✅ Navigation - Centralized in lp-nav.js

DATABASE TABLES:
---------------
- member
- activity
- tier_definition
- member_tier

SERVER:
-------
- Node.js/Express server (server_db_api.js)
- Port: 4001
- Database: PostgreSQL (loyalty)

TO START IN NEW CHAT:
--------------------
1. Upload this tarball to Claude
2. Extract with: tar -xzf ${PACKAGE_NAME}.tar.gz
3. Run: npm install (if needed)
4. Start server: node server_db_api.js
5. Open: http://localhost:4001/csr.html

NEXT PRIORITIES:
---------------
- Complete Activity posting logic
- Build Bonus/Promotion system
- Connect all pieces end-to-end

CONNECTION INFO:
---------------
Database: loyalty
User: (your postgres user)
Tables exist: member, activity, tier_definition, member_tier

For detailed architecture, see CHECKPOINT documents.
EOF

# Create extraction helper script
cat > "$TEMP_DIR/EXTRACT_HERE.sh" << 'EOF'
#!/bin/bash
# Extract handoff package
# Usage: ./EXTRACT_HERE.sh

echo "Extracting Loyalty Platform files..."
tar -xzf loyalty_handoff_*.tar.gz
echo "Done! Files extracted to current directory."
echo ""
echo "Next steps:"
echo "1. cd to the extracted directory"
echo "2. Run: node server_db_api.js"
echo "3. Open: http://localhost:4001/csr.html"
EOF

chmod +x "$TEMP_DIR/EXTRACT_HERE.sh"

# Create README for new chat
cat > "$TEMP_DIR/README_NEW_CHAT.md" << 'EOF'
# Loyalty Platform - New Chat Handoff

## Quick Start

**You're picking up a working loyalty platform CSR console.**

### What's Already Built

1. **CSR Search & Member Lookup** ✅
   - Search by member ID or name
   - Live database integration
   - Member header with context

2. **Member Tier System** ✅
   - Database schema (tier_definition, member_tier)
   - Tier history tracking
   - Support for overlapping tiers (retro-credit)
   - Tier ranking system (higher number = higher tier)

3. **Activity Page** ✅ (structure)
   - Generic activity table (kind, subtype, point_amount)
   - Ready for multiple activity types

4. **Point Summary** ✅ (basic)
   - Display framework in place

5. **Navigation** ✅
   - Centralized in lp-nav.js
   - Single place to manage all nav items

### What's Next

**Priority 1: Bonuses**
- Earn rules and multipliers
- Tier-based bonuses
- Activity type bonuses

**Priority 2: Promotions**
- Opt-in tracking
- Qualification logic
- Progress tracking

**Priority 3: Testing**
- End-to-end flows
- Data validation

### Key Files

- `server_db_api.js` - Express server with all endpoints
- `lp-nav.js` - Navigation logic and rendering
- `tier_schema.sql` - Tier system database schema
- `*.html` - All CSR pages
- `CHECKPOINT_*.md` - Detailed documentation

### Database Schema

**Tables:**
- `member` - Member profiles
- `activity` - All member activities (generic structure)
- `tier_definition` - Available tiers (Basic, Silver, Gold, Platinum)
- `member_tier` - Member tier history with date ranges

**Key Functions:**
- `get_member_tier_on_date(member_id, date)` - Get tier on specific date
- `get_member_current_tier(member_id)` - Get current tier

### Running the System

```bash
# Start server
node server_db_api.js

# Server runs on port 4001
# Open: http://localhost:4001/csr.html

# Database connection uses env vars or defaults:
# PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
```

### Important Design Decisions

1. **Tier Ranking:** Higher number = higher tier (7=Platinum, 5=Gold, etc.)
2. **Overlapping Tiers:** Supported for retro-credit scenarios
3. **Generic Activity:** Can handle multiple types (not just flights)
4. **Centralized Nav:** All pages use dynamic navigation from lp-nav.js

### Sunday Deadline Context

Building proof of concept to decide: Start own loyalty platform company vs. join existing one.

**Success Criteria:**
- Bonuses working
- Promotions working
- See the data (formatting can wait)

Read the CHECKPOINT documents for complete details.
EOF

# Create tarball
echo ""
echo "Creating package archive..."
cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}/"

# Move to uploads directory
mv "${PACKAGE_NAME}.tar.gz" "$UPLOADS_DIR/"

# Get file size
FILE_SIZE=$(ls -lh "$UPLOADS_DIR/${PACKAGE_NAME}.tar.gz" | awk '{print $5}')

# Cleanup
rm -rf "$TEMP_DIR"

# Success message
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Package Created Successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Package: ${PACKAGE_NAME}.tar.gz"
echo "Size: ${FILE_SIZE}"
echo "Location: $UPLOADS_DIR/"
echo ""
echo "📦 Files included:"
echo "   - All HTML, JS, CSS files"
echo "   - SQL schema files"
echo "   - Documentation (*.md)"
echo "   - Learnings directory"
echo "   - Manifest and README"
echo ""
echo "🚀 To use in new chat:"
echo "   1. Upload: $UPLOADS_DIR/${PACKAGE_NAME}.tar.gz"
echo "   2. Tell Claude to extract and read README_NEW_CHAT.md"
echo "   3. Continue building!"
echo ""
echo -e "${BLUE}Happy building! 🎉${NC}"
