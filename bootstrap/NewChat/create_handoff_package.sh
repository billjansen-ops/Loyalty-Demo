#!/bin/bash
# ============================================================================
# Loyalty Platform - Create Handoff Package
# ============================================================================
# Creates a complete handoff package for transitioning to a new chat session
# Includes: code and database snapshots (schema + data)
# ============================================================================

set -e  # Exit on error

# Change to project directory (CRITICAL - all paths relative to here)
cd ~/Projects/Loyalty-Demo

# Get timestamp for filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="loyalty_handoff_${TIMESTAMP}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"

echo "========================================="
echo "Creating Loyalty Platform Handoff Package"
echo "========================================="
echo ""
echo "Working directory: $(pwd)"
echo ""

# ============================================================================
# STEP 1: Capture Database Snapshots
# ============================================================================
echo "📊 Capturing database snapshots..."

# Create temp directory if it doesn't exist
mkdir -p temp

# Capture schema structure (overwrites previous)
pg_dump -h 127.0.0.1 \
        -U billjansen \
        -d loyalty \
        --schema-only \
        --no-owner \
        --no-privileges \
        -f temp/schema_snapshot.sql

if [ -f temp/schema_snapshot.sql ]; then
    SIZE=$(ls -lh temp/schema_snapshot.sql | awk '{print $5}')
    echo "   ✓ Schema captured: $SIZE"
else
    echo "   ✗ ERROR: Schema capture failed!"
    exit 1
fi

# Capture table data (overwrites previous)
pg_dump -h 127.0.0.1 \
        -U billjansen \
        -d loyalty \
        --data-only \
        --no-owner \
        --no-privileges \
        -f temp/data_snapshot.sql

if [ -f temp/data_snapshot.sql ]; then
    SIZE=$(ls -lh temp/data_snapshot.sql | awk '{print $5}')
    echo "   ✓ Data captured: $SIZE"
else
    echo "   ✗ ERROR: Data capture failed!"
    exit 1
fi

# ============================================================================
# STEP 2: Create Package Directory Structure
# ============================================================================
echo ""
echo "📦 Creating package structure..."

mkdir -p "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}/database"

# ============================================================================
# STEP 3: Copy Essential Files
# ============================================================================
echo ""
echo "📄 Copying files..."

# Core application files
echo "   - Application files..."
cp *.html "${TEMP_DIR}/" 2>/dev/null || true
cp *.js "${TEMP_DIR}/" 2>/dev/null || true
cp *.css "${TEMP_DIR}/" 2>/dev/null || true
cp *.json "${TEMP_DIR}/" 2>/dev/null || true

# Database snapshots (fresh from pg_dump)
echo "   - Database snapshots..."
cp temp/schema_snapshot.sql "${TEMP_DIR}/database/"
cp temp/data_snapshot.sql "${TEMP_DIR}/database/"

# Functions directory
echo "   - Functions..."
cp -r functions "${TEMP_DIR}/" 2>/dev/null || true

# Tenant-specific files (scoring functions, templates, etc.)
echo "   - Tenant files..."
cp -r tenants "${TEMP_DIR}/" 2>/dev/null || true

# Documentation
echo "   - Documentation..."
cp README*.md "${TEMP_DIR}/" 2>/dev/null || true

# ============================================================================
# STEP 4: Create Manifest
# ============================================================================
echo ""
echo "📋 Creating manifest..."

cat > "${TEMP_DIR}/MANIFEST.txt" << 'EOF'
# Loyalty Platform Handoff Package
# ==================================

## What's Included

### Application Files
- *.html - All admin and user interface pages
- *.js - Client-side scripts and server
- *.css - Theme and styling
- pointers.js - Main server (Node + Express + PostgreSQL)
- functions/ - Server-side validation functions
- tenants/ - Tenant-specific scoring functions and files

### Database Snapshots (database/)
- schema_snapshot.sql - Complete database structure (FRESH from pg_dump)
- data_snapshot.sql - Current table data (FRESH from pg_dump)

## Quick Start for New Session

1. Extract package to /home/claude/loyalty-demo
2. Read LOYALTY_PLATFORM_MASTER.docx (uploaded separately by Bill)
3. Read database/schema_snapshot.sql (understand structure)
4. Read database/data_snapshot.sql (understand current data)
5. Read SESSION_HANDOFF.md (uploaded separately by Bill)

## Architecture Notes

- Multi-tenant system (tenant_id isolation)
- Bonus engine with rule criteria evaluation
- Activity-based point accrual
- Temporal design (activity_date drives everything)
- PostgreSQL database on localhost

## Database Connection

Host: 127.0.0.1
User: billjansen
Database: loyalty

## Key Files

pointers.js - Main server
admin_bonus_edit.html - Visual rule builder
lp-nav.js - Central navigation
theme.css - Shared styling

EOF

echo "   ✓ Manifest created"

# ============================================================================
# STEP 5: Create README
# ============================================================================
echo ""
echo "📝 Creating README..."

cat > "${TEMP_DIR}/README.md" << 'EOF'
# Loyalty Platform Handoff Package

## What is This?

This package contains the complete codebase and database snapshots for continuing work on the Loyalty Platform.

## Files NOT in This Package

These are uploaded separately by Bill at session start:

1. **LOYALTY_PLATFORM_MASTER.docx** - Complete knowledge base
   - Architecture, systems, features
   - Chat handoff procedures
   - All timeless reference information

2. **SESSION_HANDOFF.md** - Current session state
   - What's working/broken right now
   - Next priorities
   - Recent changes

## What IS in This Package

- All HTML, JS, CSS files
- pointers.js (main server)
- database/schema_snapshot.sql (FRESH - current database structure)
- database/data_snapshot.sql (FRESH - current database data)

## IMPORTANT: Database Truth

The files in database/ are the ONLY source of truth for database structure.
They are captured fresh via pg_dump when this package is created.
Do NOT look at any other .sql files for schema information.

## Extraction

Extract to `/home/claude/loyalty-demo`:

```bash
cd /home/claude
tar -xzf loyalty_handoff_*.tar.gz
mv loyalty_handoff_* loyalty-demo
```

## Reading Database Snapshots

```bash
# Schema structure
cat /home/claude/loyalty-demo/database/schema_snapshot.sql

# Current data
cat /home/claude/loyalty-demo/database/data_snapshot.sql
```

## Starting the Server

```bash
cd /home/claude/loyalty-demo
node pointers.js
# Server runs on http://127.0.0.1:4001 (local) or Heroku URL
```

---

**Follow the instructions in LOYALTY_PLATFORM_MASTER.docx for complete boot sequence.**

EOF

echo "   ✓ README created"

# ============================================================================
# STEP 6: Create Tarball
# ============================================================================
echo ""
echo "🗜️  Creating tarball..."

cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# Move to uploads directory
mkdir -p ~/Projects/Loyalty-Demo/uploads
mv "${PACKAGE_NAME}.tar.gz" ~/Projects/Loyalty-Demo/uploads/

# Cleanup
rm -rf "${TEMP_DIR}"

echo "   ✓ Package created"

# ============================================================================
# STEP 7: Summary
# ============================================================================
echo ""
echo "========================================="
echo "✅ Handoff Package Created Successfully!"
echo "========================================="
echo ""
echo "📦 Package: ~/Projects/Loyalty-Demo/uploads/${PACKAGE_NAME}.tar.gz"
echo ""
echo "📊 Package Contents:"
ls -lh ~/Projects/Loyalty-Demo/uploads/${PACKAGE_NAME}.tar.gz
echo ""
echo "📁 Files included:"
echo "   - All HTML, JS, CSS files"
echo "   - functions/ directory"
echo "   - tenants/ directory"
echo "   - database/schema_snapshot.sql (FRESH)"
echo "   - database/data_snapshot.sql (FRESH)"
echo "   - README and MANIFEST"
echo ""
echo "🎯 Files NOT included (Bill uploads separately):"
echo "   - LOYALTY_PLATFORM_MASTER.docx"
echo "   - SESSION_HANDOFF.md"
echo ""
echo "✨ Package ready to upload!"
echo ""
