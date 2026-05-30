# Handoff Package Script - Usage Guide

> Status: historical utility note.
>
> This describes an older tarball-based handoff workflow. It is not the
> primary startup path for the project now. Use `START_HERE.md` and the
> canonical repo docs first.

## What It Does

Creates a complete snapshot of your Loyalty Platform project for transferring to a new Claude chat session.

**The script:**
1. ✅ Collects all project files (HTML, JS, CSS, SQL, docs)
2. ✅ Creates a manifest of what's included
3. ✅ Generates helpful README for new chat
4. ✅ Packages everything into a tarball
5. ✅ Saves to `~/Projects/Loyalty-Demo/uploads/`

## How To Use

### Step 1: Download the Script

Download this file: [create_handoff_package.sh](computer:///mnt/user-data/outputs/create_handoff_package.sh)

Save it to: `~/Projects/Loyalty-Demo/create_handoff_package.sh`

### Step 2: Make It Executable

```bash
cd ~/Projects/Loyalty-Demo
chmod +x create_handoff_package.sh
```

### Step 3: Run It

```bash
./create_handoff_package.sh
```

**Output:**
```
================================
Loyalty Platform Handoff Package
================================

Creating temporary staging directory...
Collecting project files...
  - HTML files
  - JavaScript files
  - CSS files
  - SQL schema files
  - Documentation files

Creating manifest...
Creating package archive...

================================
Package Created Successfully!
================================

Package: loyalty_handoff_20251030_223045.tar.gz
Size: 156K
Location: /Users/billjansen/Projects/Loyalty-Demo/uploads/

📦 Files included:
   - All HTML, JS, CSS files
   - SQL schema files
   - Documentation (*.md)
   - Manifest and README

🚀 To use in new chat:
   1. Upload: uploads/loyalty_handoff_20251030_223045.tar.gz
   2. Tell Claude to extract and read README_NEW_CHAT.md
   3. Continue building!
```

### Step 4: In New Chat

1. **Upload the tarball** to Claude
   - Find it in `~/Projects/Loyalty-Demo/uploads/`
   - Upload the `.tar.gz` file

2. **Tell Claude:**
   > "Please extract this handoff package and read the README_NEW_CHAT.md file to get up to speed on the loyalty platform we're building."

3. **Claude will:**
   - Extract all files
   - Read the context
   - Be ready to continue exactly where we left off

## What's Included in Package

### Project Files
- ✅ All HTML pages (csr.html, activity.html, tier.html, etc.)
- ✅ JavaScript files (lp-nav.js, server_db_api.js, etc.)
- ✅ CSS files (theme.css)
- ✅ SQL schema files (tier_schema.sql, etc.)
- ✅ Documentation (CHECKPOINT_*.md, README files)
- ✅ package.json (if exists)

### Helper Files (created by script)
- ✅ **MANIFEST.txt** - List of all files and current status
- ✅ **README_NEW_CHAT.md** - Complete context for new chat
- ✅ **EXTRACT_HERE.sh** - Quick extraction helper

### NOT Included
- ❌ node_modules/ (too large, run `npm install` in new chat)
- ❌ .git/ (version control not needed)
- ❌ Database data (schema only, your database is separate)

## When To Run This

**Run it NOW:**
- Creates a backup checkpoint
- Safe restore point if something breaks

**Run it BEFORE switching chats:**
- When approaching token limit (~150k)
- Before major refactoring
- End of work session

**Run it REGULARLY:**
- After completing major features
- Before trying risky changes
- Daily backups

## Troubleshooting

### Script won't run
```bash
# Make sure it's executable
chmod +x create_handoff_package.sh

# Check if you're in the right directory
pwd
# Should show: /Users/billjansen/Projects/Loyalty-Demo
```

### "Command not found"
```bash
# Run with explicit path
./create_handoff_package.sh

# Or with bash
bash create_handoff_package.sh
```

### No files found
```bash
# Check that files exist
ls -la *.html *.js

# Make sure you're in project directory
cd ~/Projects/Loyalty-Demo
```

### Package too large
- Normal size: 100-500KB
- If > 10MB: Check for accidentally included node_modules or logs
- Script excludes common large folders automatically

## Extracting in New Chat

**If Claude doesn't automatically extract:**

```bash
# Manual extraction
cd ~/Projects/Loyalty-Demo
tar -xzf uploads/loyalty_handoff_TIMESTAMP.tar.gz

# This creates a folder with all files
cd loyalty_handoff_TIMESTAMP

# View what's inside
ls -la

# Read the README
cat README_NEW_CHAT.md
```

## Tips

**Create package NOW:**
- Run it once to test
- Verify it works
- Have it ready for when we need it

**Keep old packages:**
- Script timestamps each package
- Safe to keep multiple versions
- Acts as backup history

**Upload size limit:**
- Claude can handle files up to ~10MB
- This package should be well under 1MB
- If larger, let me know and we'll optimize

## Example Session Flow

```bash
# Create package
cd ~/Projects/Loyalty-Demo
./create_handoff_package.sh

# Package created: uploads/loyalty_handoff_20251030_223045.tar.gz

# Later in new chat...
# Upload the file to Claude
# Claude extracts and reads README
# Continue building!
```

## Summary

**One command = Complete handoff ready**

```bash
./create_handoff_package.sh
```

**Result:** Everything needed to continue in a new chat, packaged neatly in your uploads folder.

---

**Ready to create your first package?** Run the script now and you'll have a safety net!
