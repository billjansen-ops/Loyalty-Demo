# LOYALTY PLATFORM IV - MASTER DOCUMENTATION

**Format:** This document is maintained as LOYALTY_PLATFORM_MASTER.md (Markdown format) as of 2025-11-29. Bill can request one-off .docx conversions when needed for easier reading. Claude edits the .md file as the single source of truth.

**Last Major Update:** 2025-12-17 - Member Alias System added (Section 29), Partner section updated with alias connection (Section 15)

---

# 0. CHAT HANDOFF & SESSION MANAGEMENT

*Session handoff process redesigned: 2025-11-17*

This section explains how to start and end Claude sessions for continuity across conversations.

## Start of Session Instructions

### Step 1: Read This Master Document

Bill has just uploaded LOYALTY_PLATFORM_MASTER.md (this document). Your first task is to read and understand it.

**CRITICAL:** Read Sections 1-29 of this document completely. This contains ALL the knowledge you need:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 1: Core Architecture (temporal-first, molecules, performance)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 2: Molecule System (static/dynamic/reference types)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 3: Atom System (template variables)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 4: Bonus System (evaluation engine)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 5: Database Conventions

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 6: Workflow & Standards

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Sections 7-26: Features, commands, patterns

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 27: Composite System (CRITICAL - defines activity structure)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 28: Input Templates (UI forms, references composites)

ÃƒÆ'Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Section 29: Member Aliases (external account number resolution)

After reading this entire document, respond to Bill:

\"Ready to receive handoff package. I understand the loyalty platform architecture and I need to:

1\. Extract tar file to /home/claude/loyalty-demo

2\. Read database schema and data

3\. Verify ATIS

4\. Wait for SESSION_HANDOFF.md (if active work in progress)

5\. Confirm ready to work\"

### Step 2: Extract and Read Tar File

Once Bill uploads the tar file, extract it:

cd /home/claude

tar -xzf /mnt/user-data/uploads/loyalty_handoff\_\*.tar.gz

mv loyalty_handoff\_\* loyalty-demo

Then read the database snapshots:

\# Read complete database structure

cat /home/claude/loyalty-demo/database/schema_snapshot.sql

\# Read all current table data

cat /home/claude/loyalty-demo/database/data_snapshot.sql

**The data snapshot shows you actual current state:** tenants, members, activities, bonuses, molecules. Study this to understand what currently exists.

### Step 3: Verify Context with ATIS

Ask Bill:

**\"What is the current ATIS information?\"**

Bill will respond with a code word (e.g., \"alpha\", \"zulu\"). This verifies your conversation history is working.

### Step 4: SESSION_HANDOFF.md (If Needed)

**Important:** Bill will only upload SESSION_HANDOFF.md if there is active work-in-progress.

SESSION_HANDOFF.md contains ONLY:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \"We\'re halfway through implementing X feature\"

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \"Currently debugging this specific issue\"

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \"Need to finish this incomplete work\"

If no SESSION_HANDOFF.md is uploaded, that means there\'s no active work. You\'re ready to start fresh on whatever Bill needs.

### Step 5: Confirm Understanding

Demonstrate you absorbed the knowledge by responding:

\"Boot sequence complete. I have read and understood:

ARCHITECTURE:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Temporal-first design: \[brief explanation in your own words\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Molecule system: \[explain static/dynamic/reference types\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Multi-tenant isolation: \[how tenant_id works\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Performance principles: \[right-sizing, pointers, etc.\]

CURRENT STATE FROM DATABASE:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Tenants: \[list what you saw in data\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Test members: \[who exists\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Activity types configured: \[A/R/P/J status\]

ATIS VERIFIED: \[code word\]

If SESSION_HANDOFF.md was uploaded, add:

ACTIVE WORK:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \[Summarize what\'s in progress\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \[Next immediate step\]\"

*This proves you understand, not just that you opened files.*

## End of Session Instructions

### When to Create Handoff

Create handoff files when:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Token usage reaches 150k (79% of 190k budget) - MANDATORY

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Session is naturally concluding

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Bill says \"create handoff\" or \"end session\"

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Emergency at 170k tokens - create immediately

### Files to Create

**File 1: LOYALTY_PLATFORM_MASTER.md (conditional)**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Only update if we learned something architectural or permanent

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Add to appropriate sections (don\'t duplicate)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Include timestamp note if significant update made

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ If no changes needed, say \"NO CHANGES\" in output

**File 2: SESSION_HANDOFF.md (only if active work)**

**IMPORTANT:** Only create SESSION_HANDOFF.md if there is unfinished work-in-progress. If session ends cleanly with nothing incomplete, skip this file.

When SESSION_HANDOFF.md IS needed, include:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ What we\'re in the middle of (incomplete features)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Next immediate step to continue

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Uncommitted code changes

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Specific debugging context

What NOT to put in SESSION_HANDOFF.md:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ General instructions (goes in master doc)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Architecture explanations (goes in master doc)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Working features (visible in database snapshots)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Long-term wishlists (goes in master doc Section 10)

### Session Handoff Template (When Needed)

\# SESSION HANDOFF\
\*\*Date:\*\* \[YYYY-MM-DD HH:MM Central Time\]\
\*\*Token Usage:\*\* \[X / 190,000\]\
\
\## Active Work\
\
\[One paragraph: what\'s incomplete and why\]\
\
\## Next Step\
\
\[Exactly what to do next to continue\]\
\
\## Uncommitted Changes\
\
\[Files created but not deployed/tested\]\
\
\## Context Notes\
\
\[Quick reminders needed to resume work\]

### Completion Signal

After creating files and copying to /mnt/user-data/outputs/, respond with:

**\"Cars are for Today\"**

This phrase verifies you completed the end session process correctly.

Then provide file status:

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ LOYALTY_PLATFORM_MASTER.md \[UPDATED / NO CHANGES\]

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ SESSION_HANDOFF.md \[CREATED / NOT NEEDED\]

\"You can now run create_handoff_package.sh to create the tar file.\"

## ATIS System

ATIS (Automated Terminal Information Service) - borrowed from aviation, verifies Claude can search conversation history.

**How it works:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Bill establishes ATIS at chat start with a code word: \"ATIS information \[alpha/bravo/charlie/zulu\] is current\"

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ This is a simple marker phrase in the conversation

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ If Bill suspects Claude is losing context, he asks: \"What is the current ATIS?\"

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ If Claude can find it ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Context is intact, continue working

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ If Claude cannot find it ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Context is broken, time for new chat with handoff

*Purpose: Provides objective test of conversation history access before wasting time on broken context.*

## Token Budget Management

**Total Budget: 190,000 tokens per session**

**Thresholds:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 130k tokens (68%) - Warning zone: Start wrapping up current task, avoid new complex work

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 150k tokens (79%) - Critical: Create handoff NOW, this is mandatory

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 170k tokens (89%) - Emergency: Minimal responses only, create handoff immediately

**Strategy:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Monitor token usage throughout session

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Warn Bill when approaching 130k

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Don\'t start major new features after 130k

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Create clean handoff at 150k, don\'t push to 170k

## Bill\'s Communication Patterns

Learn to recognize these signals:

Bill Says ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Meaning ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Your Response

\"stop!\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ You\'re going down wrong path ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Pause immediately, listen

\"NO!\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Fundamental misunderstanding ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Stop and reconsider approach

\"why are you asking this?\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Answer should be obvious from data ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Check schema/molecules

\"shouldn\'t this come from molecule?\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ You\'re hardcoding ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Read from database instead

\"b\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Just scrolling, continue ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Keep waiting

ALL CAPS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Extreme frustration ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Stop defending, fix immediately

Swearing ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Serious mistake ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Don\'t defend, fix right away

**When you hear these signals ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ STOP and reconsider your approach!**

## Critical Working Principles

**Never Start Without Reading:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ DO NOT write code until you\'ve read schema

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ DO NOT make assumptions about columns/tables

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ DO NOT skip boot sequence - every step matters

**Data-Driven Development:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Data drives behavior - never hardcode what should come from database

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Check actual schema before assuming field names/types

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Verify against reality, don\'t guess structures

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Use molecules for configurable values

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Test with curl commands before UI

**Complete Work:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Always provide complete files, never ask Bill to manually edit code

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Finish tasks fully, don\'t leave partial work

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Test incrementally (curl before UI)

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Follow established patterns

**Trust & Reliability:**

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Listen to Bill\'s instincts - when he corrects you, he\'s always right

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Acknowledge mistakes quickly, don\'t defend errors

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Consistent behavior over time rebuilds trust

ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Procedures exist because they prevent problems

## Success Criteria

You\'re properly oriented when:

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You understand temporal-first design

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You understand the molecule system (static/dynamic/reference)

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You know current database schema and data

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You can explain multi-tenant isolation

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You understand Bill\'s communication style

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â You can answer: \"What is Bill\'s favorite color?\" (Answer: green)

# ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â PRE-PRODUCTION SECURITY REQUIREMENTS

**STATUS: Development Mode - NOT Production Ready**

The current implementation uses URL-based tenant selection for development convenience. This MUST be replaced with authentication-based tenant isolation before production deployment.

## Current Architecture (Development Only)

**How it works now:**

// Client controls tenant via URL parameter\
fetch(\'/v1/bonuses?tenant_id=1\') // Delta\
fetch(\'/v1/bonuses?tenant_id=2\') // United\
\
// sessionStorage stores current tenant\
sessionStorage.setItem(\'tenant_id\', \'1\');

**Why this is development-only:** - ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Easy tenant switching for testing/demo - ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ No authentication complexity during feature development - ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Simple debugging (tenant visible in URLs) - ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ **SECURITY RISK:** Anyone can change tenant_id and access other tenant data - ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Tenant appears in browser history, logs, bookmarks - ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ No user authentication or authorization

## Required Production Architecture

### 1. Authentication Layer

**User login returns JWT token with tenant claim:**

POST /v1/auth/login\
{ username: \"bill@delta.com\", password: \"\...\" }\
\
Response:\
{\
token: \"eyJhbGc\...\",\
claims: {\
user_id: 12345,\
tenant_id: 1, // Locked to Delta - cannot change\
role: \"admin\"\
}\
}

### 2. Session-Based Tenant Isolation

**Database function already exists for this:**

CREATE FUNCTION public.app_current_tenant_id() RETURNS smallint

**Set once per connection/request:**

// Extract tenant_id from validated JWT\
const tenantId = verifyJWT(token).claims.tenant_id;\
\
// Set PostgreSQL session variable\
await dbClient.query(\`SET app.tenant_id = \$1\`, \[tenantId\]);

### 3. Remove tenant_id from API URLs

**Before (Development):**

GET /v1/bonuses?tenant_id=1\
GET /v1/members?tenant_id=1\
POST /v1/activities?tenant_id=1

**After (Production):**

GET /v1/bonuses\
GET /v1/members\
POST /v1/activities\
\
Headers: { Authorization: \"Bearer \<jwt\>\" }

### 4. Two Implementation Options

**Option A: Application-Level Filtering (Simpler)**

// Refactor all queries from:\
WHERE tenant_id = \$1\
\
// To use session variable:\
WHERE tenant_id = app_current_tenant_id()

**Pros:** Explicit, visible in queries, easier debugging\
**Cons:** Must remember to filter every query, one mistake = data leak

**Option B: Row-Level Security (Most Secure)**

\-- Enable RLS on every table\
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;\
ALTER TABLE member ENABLE ROW LEVEL SECURITY;\
ALTER TABLE bonus ENABLE ROW LEVEL SECURITY;\
\-- etc.\
\
\-- Create policy that auto-filters\
CREATE POLICY tenant_isolation ON activity\
USING (tenant_id = app_current_tenant_id());

**Pros:** Database enforces automatically, impossible to leak data\
**Cons:** More setup, filtering invisible (harder debugging)

**Recommendation:** Use BOTH (defense in depth) - Application explicitly filters with app_current_tenant_id() - RLS provides safety net if code has bug

## Migration Checklist

### Authentication System

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Choose auth approach (JWT, OAuth2, custom)

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Implement login/logout endpoints

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Token generation and validation

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Password hashing (bcrypt/argon2)

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Session management

### API Refactoring

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Remove tenant_id from all query parameters

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Add JWT validation middleware

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Extract tenant_id from validated token

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Set app.tenant_id session variable per request

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Refactor \~1000 lines of WHERE tenant_id = \$1 to WHERE tenant_id = app_current_tenant_id()

### Database Security

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Enable Row-Level Security on all tenant-isolated tables

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Create tenant_isolation policies for each table

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Test RLS enforcement

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Document RLS bypass role for admin/system operations

### Testing

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Verify cross-tenant access is impossible

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Test token expiration handling

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Test role-based permissions

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Security audit/penetration testing

### User Management

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â User registration workflow

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Role definitions (Admin, CSR, etc.)

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Permission matrix

ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â Multi-user per tenant support

## Timeline Recommendation

**Implement before:** - Any external access (partners, customers) - Any real member data loaded - Any deployment outside development environment - Any demo to potential clients (security questions will arise)

**Estimated effort:** 2-4 weeks depending on authentication complexity

## Critical Reminder

**The current URL-based approach is scaffolding only.** The existence of app_current_tenant_id() function in the schema proves Bill designed for session-based tenant isolation from the start. The current implementation is temporary convenience for feature development.

**Do NOT deploy current architecture to production.**

# 1. CORE ARCHITECTURE

The foundational design principles that enable flexibility, multi-tenant architecture, and industry-agnostic capabilities.

## The Million Years Ago Philosophy

Architecture based on timeless principles that survive technology changes:

Generic data structures that work for any industry

Industry-specific knowledge stored in configuration, not code

Everything is a pointer for performance and flexibility

Right-sized data types (no wasted space)

No created_at/updated_at columns (temporal data derived from transactions, not metadata)

## Temporal-First Design

**The Foundation:** Everything designed with time as the primary dimension.

**Point balances are derivable:** Never store current balance, always calculate from transaction history

**Retro-credit just works:** New bonus rules automatically apply to past activities

**Audit trail is complete:** Every point movement has traceable history

**Time travel queries:** \"What was this member\'s balance on March 15th?\" is trivial

**Why This Matters:** Traditional systems store current state and struggle with retroactive changes. This system treats time as data, making complex temporal operations simple.

## Tiers Are Promotion Rewards (Not Status Fields)

**The Insight:** Tier status is the result of earning enough points, not a field you set.

Never store current tier: Calculate from point balance and tier thresholds

Promotion logic is automatic: Cross threshold = tier promotion

Historical tier tracking: Know exactly when someone reached each tier

Flexible tier structures: Different programs can have different tier counts/thresholds

**Implementation:** member table has no tier field. Tier is derived by comparing total points to tier thresholds in molecule system.

## Everything Is Pointers (Performance)

**The Strategy:** Store IDs that reference shared data structures, never duplicate text.

Text deduplication: Store \"Minneapolis\" once, reference it everywhere

Memory efficiency: Integers are smaller than strings

Cache friendly: Repeated data loads faster

Referential integrity: Changes propagate automatically

**Examples:** State stored as \"MN\" (2 chars) not \"Minnesota\" (9 chars). Activity types stored as codes/IDs. Locations, merchants, categories all use pointer patterns.

## Data Drives Behavior (Not Hardcoded Logic)

**The Philosophy:** Business rules live in data, not code.

Configurable everything: Bonus rates, tier thresholds, activity types

No redeployments: Change program rules by updating molecule values

Multi-industry support: Same code serves airlines, hotels, retail

A/B testing ready: Different tenants can have different rules

**Anti-pattern:**

if (activity_type === \'purchase\') { points = amount \* 0.01; }

**Correct pattern:**

points = activity_amount \* bonus_molecule_value

## Composite-Driven Activity Processing

**The Breakthrough:** Activity structure defined in data, not code.

**Composite Pattern:** Each (tenant, activity_type) has a composite defining:
- Which molecules make up the activity
- Which are required vs optional
- Which are calculated by system vs entered by user
- Processing order for dependent calculations

**Why This Enables Multi-Industry:**
```javascript
// WRONG - hardcoded airline
const { carrier, origin, destination } = payload;

// RIGHT - reads from composite
const composite = cache.get(`composite:${tenantId}:${activityType}`);
for (const field of composite) {
  // Works for ANY industry
}
```

**Same code serves:**
- Airlines: carrier, origin, destination, flight_number, fare_class
- Hotels: property, room_type, nights, rate
- Retail: store, category, transaction_amount
- Gyms: location, visit_type (no points, just logging)

**Points are not special:** `member_points` is just another molecule in the composite. If present, bucket logic runs. If absent, activity logs without points.

**See Section 27** for complete composite documentation.

## Zero Batch Processing (Derive On-Demand)

**The Approach:** Calculate derived data when requested, don\'t precompute.

No nightly jobs: Balance calculations happen in real-time

Always current: Data is never stale

Simpler architecture: No ETL pipelines or batch schedulers

Easier debugging: Single code path for all calculations

**Performance Note:** With proper indexing and the pointer strategy, on-demand calculations are fast enough for real-time use.

## Right-Sized Data Types

Optimize for actual data domains, not developer convenience. Hardware trends favor this approach:

**Specific Examples:**

State codes: CHAR(2) not VARCHAR(255)

ZIP codes: CHAR(5) for main, CHAR(4) for plus-4 extension

Activity types: CHAR(1) not VARCHAR(100)

Currency: Store smallest unit (pennies) in BIGINT

Percentages: Store basis points (1/10000) in SMALLINT

Tenant ID: SMALLINT (max 32,767 tenants - reasonable limit)

Text: Use appropriate VARCHAR sizes, not VARCHAR(255) everywhere

**Cache-Friendly Designs:**

Pack related data together in memory

Use fixed-width fields when possible (CHAR vs VARCHAR)

Minimize pointer chasing

Design for CPU cache line efficiency

**Performance Philosophy:** \"Optimize for the 99% case. Make common operations blazingly fast, even if edge cases require more work.\"

**Impact:** 2% savings per field ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 50 fields ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 1M rows = massive impact

## Why This Approach Survives Decades

Hardware trends favor it: Memory is still expensive per byte, cache lines haven\'t grown

Data volumes scale: Techniques matter more with millions of records

Database fundamentals: Proper normalization and indexing never goes out of style

Maintenance burden: Systems that work correctly require less ongoing effort

Right-sizing compounds: Small savings multiply across the entire system

## Link Tank & Squish Architecture

**Design Date:** 2025-12-01

The ultimate expression of "Everything is Pointers" and "Right-Sized Data Types" - every primary key and foreign key in the system uses optimal byte storage.

### The Naming Convention

Borrowed from Bill's 1980s systems:

**link:** Primary key - "who am I"

**p_link:** Parent link - "who owns me"

Every table uses the same pattern. Self-documenting. Consistent.

### Squish/Unsquish Functions

**The Problem:** Null bytes (x'00') can corrupt data in some storage systems.

**The Solution:** Base-255 encoding instead of base-256. Add 1 to every byte position. Null bytes become impossible.

**squish(value, bytes):** Convert number to N bytes (base-255, +1 offset)

**unsquish(buffer):** Convert bytes back to number (self-describing based on buffer length)

### Storage Tiers

| Tier | Bytes | Data Type | Max Value | Use Cases |
|------|-------|-----------|-----------|-----------|
| 1 | 1 | CHAR(1) | 127 | fare_class, activity_type, status codes |
| 2 | 2 | SMALLINT | 65,535 | carriers, airports, states |
| 3 | 3 | CHAR(3) | 16.5M | flight_number, medium lookups |
| 4 | 4 | INTEGER | 4.2B | (future entities) |
| 5 | 5 | CHAR(5) | 1T+ | activity.link, member.link, molecule values |
| 8 | 8 | BIGINT | 9.2E18 | Raw counters (membership numbers) |

**Note:** Both members and activities use 5-byte links. Odd bytes (1,3,5) use CHAR with squish encoding. Even bytes (2,4) use numeric types with offset encoding.

**Note on Tier 8:** When `link_bytes = 8`, `getNextLink()` returns the raw BIGINT value without any encoding. Use this for simple atomic counters where you need plain numbers, not squished links (e.g., membership number generation).

### Link Tank Table

Central registry managing all primary keys:

```
link_tank (
    table_key VARCHAR(30) PRIMARY KEY,
    link_bytes SMALLINT,    -- 1, 2, 3, 4, 5, or 8
    next_link BIGINT        -- Counter (squished on output, except 8 = raw)
)
```

**Self-populating:** First request for a table auto-creates the row by querying schema for column size.

**SELECT FOR UPDATE:** Critical for preventing duplicate keys under concurrent load.

### Storage Savings Example

**Per activity with 5 molecules:**

Current (BIGINT): 56 bytes in IDs/pointers

Proposed (right-sized): 19 bytes in IDs/pointers

**66% reduction.** At 100M activities = 3.7 GB saved.

### Table Structure Pattern

**member:**
```
link CHAR(5) PRIMARY KEY        -- 5 bytes, ~1T members
tenant_id SMALLINT
member_id BIGINT                -- Legacy, being retired
```

**activity:**
```
link CHAR(5) PRIMARY KEY        -- 5 bytes, ~1T activities
p_link CHAR(5) REFERENCES member(link)
```

### Unified Data Tables

Molecule values stored in `{link_bytes}_data_{storage_size}` tables:

**Current (5-byte parent links):**
```
5_data_1    (p_link CHAR(5), attaches_to CHAR(1), molecule_id, c1 CHAR(1))
5_data_2    (p_link CHAR(5), attaches_to CHAR(1), molecule_id, n1 SMALLINT)
5_data_3    (p_link CHAR(5), attaches_to CHAR(1), molecule_id, c1 CHAR(3))
5_data_4    (p_link CHAR(5), attaches_to CHAR(1), molecule_id, n1 INTEGER)
5_data_5    (p_link CHAR(5), attaches_to CHAR(1), molecule_id, c1 CHAR(5))
5_data_54   (p_link CHAR(5), attaches_to CHAR(1), molecule_id, c1 CHAR(5), n1 INTEGER)
5_data_2244 (p_link CHAR(5), attaches_to CHAR(1), molecule_id, n1 SMALLINT, n2 SMALLINT, n3 INTEGER, n4 INTEGER)
```

Both activities ('A') and members ('M') use these same tables since both have 5-byte links. The `attaches_to` column distinguishes which entity type owns each row.

See Section 2 (Molecule System) for full details.

### Migration Strategy

1. Add new link/p_link columns (parallel to existing)
2. Populate: squish(old_id, bytes)
3. Seed link_tank with MAX(old_id) + 1
4. Update code to use new columns
5. Drop old columns after verification

**Safe. Incremental. Reversible.**

### Why This Matters

The entire platform is pointers. If pointers are the foundation, they should be optimal:

- Smaller data = less I/O
- Smaller indexes = faster lookups
- Cache-friendly = more data fits in memory
- Base-255 = bulletproof (no null byte corruption)

**Pointer. Right-sized. All the way down.**

# 2. MOLECULE SYSTEM

The core abstraction layer enabling tenant-specific, industry-agnostic data management.

## ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨ CRITICAL RULE: NO DIRECT SQL

**NEVER write SQL directly against molecule storage tables.** Always use helper functions.

**WHY:** The molecule system handles encoding, table routing, and value_type-specific behavior. Direct SQL bypasses this and WILL break data.

**WRONG:**
```javascript
// NEVER DO THIS
await dbClient.query(`
  SELECT c1 FROM activity_detail_5 WHERE p_link = $1 AND molecule_id = $2
`, [activityLink, moleculeId]);
```

**RIGHT:**
```javascript
// ALWAYS use helpers
const values = await getAllActivityMoleculeValuesById(null, moleculeId, activityLink);
// Or for single values:
const value = await getActivityMoleculeValueById(null, moleculeId, activityLink);
```

---

## Storage Architecture Overview

### Unified Data Tables (Designed 2025-12-06)

**OLD (being retired):** `activity_detail_N` / `member_detail_N` - separate tables per context
**NEW:** `{link_bytes}_data_{storage_size}` - unified tables by parent link size

Table naming pattern: `{link_bytes}_data_{storage_size}`
- First part = parent's link size in bytes (currently 5 for both members and activities)
- Second part = value storage pattern

**Current tables (5-byte parent links):**
```sql
5_data_1    (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(1))
5_data_2    (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, n1 SMALLINT)
5_data_3    (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(3))
5_data_4    (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, n1 INTEGER)
5_data_5    (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(5))
5_data_54   (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(5), n1 INTEGER)
5_data_2244 (p_link CHAR(5), attaches_to CHAR(1), molecule_id INTEGER, n1 SMALLINT, n2 SMALLINT, n3 INTEGER, n4 INTEGER)
```

**Key columns:**
- `p_link` - Parent link (activity or member's 5-byte link)
- `attaches_to` - What this row IS attached to ('A' or 'M')
- `molecule_id` - Which molecule definition

**Why attaches_to is needed:** The same p_link value could exist as both an activity link and a member link. The attaches_to column distinguishes which entity this row belongs to.

### Future Extensibility

If entities with different link sizes are added:
```sql
-- 2-byte parents (SMALLINT link)
2_data_1 (p_link SMALLINT, attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(1))
2_data_2 (p_link SMALLINT, attaches_to CHAR(1), molecule_id INTEGER, n1 SMALLINT)

-- 4-byte parents (INTEGER link)
4_data_1 (p_link INTEGER, attaches_to CHAR(1), molecule_id INTEGER, c1 CHAR(1))
4_data_2 (p_link INTEGER, attaches_to CHAR(1), molecule_id INTEGER, n1 SMALLINT)
```

Same structure, just p_link type changes based on link size:
- Odd bytes (1, 3, 5) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ CHAR(n) with squish encoding
- Even bytes (2, 4) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ SMALLINT or INTEGER

### Base-127 Encoding (Squish)

For CHAR columns (sizes 1, 3, 5), values are encoded in base-127:
- Each byte holds values 1-127 (never 0, never 128+)
- Big-endian: MSB first, so strings sort in numeric order
- No null bytes that could corrupt character data

```javascript
squish(value, bytes)   // Number ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ CHAR string
unsquish(buffer)       // CHAR string ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Number
```

### Numeric Columns (Sizes 2, 4)

For SMALLINT and INTEGER columns, encoding depends on `value_type`:

**Offset encoding (link, key, code):**
- These are always positive (IDs, foreign keys, flight numbers)
- Store as: `value - 32768` (2-byte) or `value - 2147483648` (4-byte)
- Read as: `stored + offset`
- Doubles usable positive range (0 to 65,535 for SMALLINT)

**Raw storage (numeric, date):**
- These can be negative (point adjustments, corrections)
- Store and read as-is
- Full signed range: -32,768 to +32,767 (SMALLINT)

---

## molecule_def Columns Reference

| Column | Type | Purpose |
|--------|------|---------|
| molecule_id | INTEGER | Primary key |
| tenant_id | SMALLINT | Tenant isolation |
| molecule_key | VARCHAR(50) | Lookup key (e.g., 'carrier', 'origin') |
| attaches_to | VARCHAR(10) | What this molecule CAN attach to: 'A', 'M', or 'AM' |
| storage_size | VARCHAR(10) | Table routing: '1', '2', '5', '54', '2244', etc. |
| value_type | VARCHAR(20) | 'link', 'key', 'numeric', 'code', 'date', 'bigdate' |
| value_kind | VARCHAR(20) | 'external_list', 'internal_list', 'value', 'embedded_list' |
| scalar_type | VARCHAR(20) | For value kind: 'text', 'numeric', 'date', 'boolean' |
| molecule_type | CHAR(1) | 'S'=Static, 'D'=Dynamic, 'R'=Reference |
| value_structure | VARCHAR(20) | 'single' or 'embedded' |

### attaches_to Values

| Value | Meaning | Examples |
|-------|---------|----------|
| 'A' | Activity only | carrier, origin, destination, flight_number |
| 'M' | Member only | member_point_bucket, tier |
| 'AM' | Both activity and member | partner (earnings on activity, affiliations on member) |

**Migration from context:** 
- context = 'activity' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ attaches_to = 'A'
- context = 'member' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ attaches_to = 'M'

**Future:** An `entity_def` table could map entity codes to link sizes, auto-creating `{link_bytes}_data_*` tables as needed.

### value_type Meanings

| value_type | Storage Behavior | Return Behavior |
|------------|------------------|-----------------|
| link | Raw bytes (for FK lookup) | CHAR string as-is (for queries) |
| key | Encoded number | Decoded to positive integer |
| numeric | Raw signed value | Signed integer |
| code | Encoded positive number | Decoded to positive integer |
| date | Days since Dec 3, 1959 | Integer (use moleculeIntToDate to convert) |
| bigdate | Extended date encoding | Integer |

---

## Helper Functions Reference

### Low-Level Storage Helpers

These handle encoding/decoding and table routing automatically:

**getMoleculeStorageInfo(tenantId, moleculeKey)**
Returns: `{ moleculeId, context, storageSize, valueType, tableName, columns }`

**insertMoleculeRow(pLink, moleculeKey, values, tenantId)**
Inserts a row with proper encoding. Returns detail_id if applicable.

**getMoleculeRows(pLink, moleculeKey, tenantId)**
Returns all rows for a molecule, decoded. Array of objects with column names (C1, N1, etc.)

**findMoleculeRow(pLink, moleculeKey, keyValues, tenantId)**
Find row matching specific column values. Returns decoded row or null.

**incrementMoleculeColumn(moleculeKey, colName, amount, where, tenantId)**
Atomic increment of numeric column. Used for point bucket updates.

**deleteAllMoleculeRowsForLink(pLink, context)**
Deletes from ALL detail tables for a link. Used when deleting activities.

### Activity Molecule Helpers

**getActivityMoleculeValueById(activityId, moleculeId, link)**
Get single value by molecule_id. Returns decoded value or raw bytes for links.

**getAllActivityMoleculeValuesById(activityId, moleculeId, link)**
Get ALL values for multi-row molecules (e.g., bonus_activity_link). Returns array.

**getAllActivityMolecules(activityId, tenantId, link)**
Get all molecules for an activity as key-value pairs. Used for display.

**insertActivityMolecule(activityId, moleculeId, value, client, link)**
Insert single molecule value. Handles encoding based on molecule_def.

### Member Molecule Helpers

**getMemberMoleculeRows(memberId, moleculeKey, tenantId)**
Get molecule rows for a member (e.g., point buckets).

**saveMemberMoleculeRow(memberId, moleculeKey, tenantId, values, rowNum)**
Save/insert member molecule row.

### Point System Helpers

**findOrCreatePointBucket(memberId, ruleId, expireDate, tenantId)**
Finds existing bucket or creates new one. Returns detail_id.

**updatePointBucketAccrued(memberId, detailId, amount, tenantId)**
Add points to bucket's accrued column.

**saveActivityPoints(activityId, bucketDetailId, amount, tenantId, link)**
Record points on activity (member_points molecule in activity_detail_54).

**getActivityPoints(activityId, tenantId, link)**
Get total points for an activity.

### Encode/Decode Helpers

**encodeMolecule(tenantId, moleculeKey, value)**
Convert display value to storage ID (e.g., 'DL' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ carrier_id 4).

**decodeMolecule(tenantId, moleculeKey, id, columnOrCategory)**
Convert storage ID to display value (e.g., carrier_id 4 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 'DL').

**dateToMoleculeInt(date)**
Convert Date to days since Dec 3, 1959.

**moleculeIntToDate(num)**
Convert days since Dec 3, 1959 to Date.

### Link Helpers

**getNextLink(tenantId, tableKey)**
Get next squished link value for a table. Atomic, auto-initializes.

**getMemberLink(memberId, client)**
Get member's link value from member_id.

**getMemberId(memberLink, client)**
Get member_id from link value.

---

## Common Patterns

### Reading Activity Data for Display

```javascript
// Get all molecule values for an activity
const molecules = await getAllActivityMolecules(activityId, tenantId, activityLink);
// molecules = { carrier: 'DL', origin: 'MSP', flight_number: 1234, ... }
```

### Reading Multi-Value Molecules

```javascript
// For molecules that can have multiple values per parent (like bonus_activity_link)
const bonusLinks = await getAllActivityMoleculeValuesById(null, bonusActivityLinkMoleculeId, activityLink);
// bonusLinks = ['\x01\x02\x03\x04\x05', '\x01\x02\x03\x04\x06', ...]  // raw link bytes
```

### Writing Activity Molecules

```javascript
// Insert single value
await insertActivityMolecule(activityId, carrierId, encodedCarrier, dbClient, activityLink);

// For multi-column molecules, use molecule rows
await insertMoleculeRow(activityLink, 'member_points', [bucketDetailId, pointAmount], tenantId);
```

### Working with Point Buckets

```javascript
// Find or create bucket
const bucketDetailId = await findOrCreatePointBucket(memberId, ruleId, expireDate, tenantId);

// Add points
await updatePointBucketAccrued(memberId, bucketDetailId, pointAmount, tenantId);

// Record on activity
await saveActivityPoints(activityId, bucketDetailId, pointAmount, tenantId, activityLink);
```

### Deleting Activities (Cascade)

```javascript
// Delete all molecule data for an activity
await deleteAllMoleculeRowsForLink(activityLink, 'activity');

// Then delete the activity record
await dbClient.query('DELETE FROM activity WHERE link = $1', [activityLink]);
```

---

## Key Molecules Reference

| molecule_key | storage_size | value_type | Purpose |
|--------------|--------------|------------|---------|
| carrier | 2 | key | Airline code (FK to carriers table) |
| origin | 2 | key | Origin airport (FK to airports table) |
| destination | 2 | key | Destination airport |
| flight_number | 2 | code | Flight number (numeric, no lookup) |
| fare_class | 1 | code | Fare class code |
| mqd | 4 | numeric | MQD amount (signed integer) |
| member_points | 54 | composite | Points: bucket_link(5) + amount(4) |
| member_point_bucket | 2244 | composite | Bucket: rule_id(2) + expire_date(2) + accrued(4) + redeemed(4) |
| bonus_activity_link | 5 | link | Link to child bonus activity |
| bonus_rule_id | 2 | key | FK to bonus table |

---

## Molecule Types (S/D/R)

### Static (S)
Tenant-wide configuration. Stored in molecule_def or molecule_value_embedded_list.
Cannot be used in rule evaluation.

### Dynamic (D)  
Per-activity or per-member data. Stored in detail tables.
Can be used in templates AND rule evaluation.

### Reference (R)
Queries existing data on demand (e.g., member.fname).
Used for rule evaluation only. No storage - derives from source tables.

---

## Type Helper Functions

Always use these instead of direct value_kind comparisons:

```javascript
function isLookupMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'lookup' || vk === 'external_list';
}

function isListMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'list' || vk === 'internal_list';
}

function isScalarMolecule(mol) {
  const vk = mol?.value_kind;
  return vk === 'scalar' || vk === 'value';
}
```

---

## Embedded Lists

For molecules with `value_structure = 'embedded'` (like activity_display):

**Storage:** `molecule_value_embedded_list` table with category/code/description rows.

### Link Column for 1-Byte Storage Key (IMPLEMENTED 2025-12-06)

The `molecule_value_embedded_list` table includes a `link` column that provides a 1-byte storage key for each value within a category:

**Schema:**
```sql
molecule_value_embedded_list (
  ...
  link CHAR(1)  -- Auto-assigned chr(1) through chr(127)
)
```

**Auto-Assignment:**
- When inserting a new value, system finds the next available link within that category
- Assigns chr(1), chr(2), ... chr(127) sequentially
- Maximum 127 values per category per molecule

**E006 Error:**
If a category reaches 127 values and another is requested:
```javascript
{ error: 'E006', message: 'Maximum values (127) reached for category' }
```

**Internal List Restriction:**
Internal list molecules (value_kind = 'internal_list') are restricted to 1-byte storage (`storage_size = '1'`) to enable efficient lookup via the link column.

**Reading:**
```javascript
const value = await getEmbeddedListValue(moleculeKey, category, code, tenantId);
```

**Writing:**
```javascript
await setEmbeddedListValue(moleculeKey, category, code, value, tenantId);
```

Each property is a separate row:
```
category='A', code='label',       description='Flight',    link=chr(1)
category='A', code='icon',        description='ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€¹Ã¢â‚¬Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â',        link=chr(2)
category='A', code='color',       description='#059669',   link=chr(3)
```

---

## Temporal Evaluation

For historical queries (retro-credit processing):

```javascript
// Get member's tier on a specific date
const tier = await getMoleculeValue(tenantId, 'member_tier_on_date', { member_id }, activityDate);

// decodeMolecule with date parameter
const tierCode = await decodeMolecule(tenantId, 'tier', tierId, activityDate);
```

Date parameter enables "what was X on date Y" queries for proper retroactive processing.

**Real-World Flow:** 1. Activity posted: June 15, 2025 2. Member promoted to Gold: May 1, 2025 3. Retro-processing activities from April 2025 4. System evaluates: - April activities: tierOnDate returns 'S' (Silver) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ no +25% bonus - May/June activities: tierOnDate returns 'G' (Gold) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ gets +25% bonus

### Database Support

**Temporal functions in PostgreSQL:**

CREATE FUNCTION get_member_tier_on_date(p_member_id BIGINT, p_date DATE)\
RETURNS TABLE(tier_code VARCHAR, tier_description VARCHAR, tier_ranking INT)\
\
\-- Finds tier active on specific date using date ranges\
WHERE mt.start_date \<= p_date\
AND (mt.end_date IS NULL OR mt.end_date \>= p_date)

**Molecule configuration:**

{\
molecule_key: \'member_tier_on_date\',\
value_kind: \'reference\',\
ref_function_name: \'get_member_tier_on_date\'\
}

### Implementation in Bonus Evaluation

**Bonus engine passes both context and date:**

// Line 4664 in server_db_api.js\
const resolvedValue = await getMoleculeValue(\
tenantId,\
criterion.molecule_key, // \'member_tier_on_date\' or \'member_fname\'\
{ member_id: activity.member_id }, // Context from activity\
activityDate // Date for temporal evaluation\
);\
\
// Compares resolved value with bonus criteria\
if (resolvedValue === \'G\') {\
// Apply Gold tier bonus\
}

### Testing Temporal Molecules

**Molecule test modal (Section 4) supports testing:**

**Input fields:** - Member ID (required for reference molecules) - Date (optional for temporal evaluation)

**API endpoint:**

GET /v1/molecules/evaluate\
?tenant_id=1\
&key=member_tier_on_date\
&member_id=2153442807\
&date=2025-06-15

**Example tests:** - member_fname + member_id ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Returns member's first name - member_state + member_id ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Returns member's state - member_tier_on_date + member_id + date ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Returns tier on that specific date

### Backward Compatibility

**Design ensures zero breaking changes:** - date = null is default parameter value - Existing code without date parameter continues working unchanged - Only molecules with ref_function_name utilize date parameter - Non-temporal molecules ignore date parameter entirely

### Why This Matters

This temporal capability is fundamental to the platform's temporal-first design philosophy. It enables: - Accurate retro-credit processing - Historical bonus evaluation - Time-travel queries ("what tier was this member on March 15?") - Audit trail accuracy - Fair point attribution regardless of posting delay

**The key insight:** Activities and bonuses should reflect the state of the world when they occurred, not when they were processed.

## The Molecule Insight

**Traditional:** Code contains business rules, data contains transactions

**Molecule Approach:** Data contains business rules AND transactions, code is generic

This represents a fundamental breakthrough - achieving true multi-industry capability while maintaining performance and simplicity.

# 3. ATOM SYSTEM - TEMPLATE VARIABLES

Atoms are dynamic variable substitution tags embedded in text strings that resolve to actual data at runtime.

## The Problem Atoms Solve

**Without atoms:** error = \"Member does not have enough miles\" (wrong for hotels). error = \"Member does not have enough points\" (wrong for airlines). You\'d need different messages for every industry and tenant.

**With atoms:** error = \"Member does not have enough {{M,point_type,label,,L}}\". Delta: \"miles\", Marriott: \"points\", Gym: \"credits\". Same code, different data.

## Atom Syntax

{{source,identifier,field,length,case}}

**Parameters:**

**source:** M = Molecule, T = Table (direct database lookup)

**identifier:** molecule_key or table_name

**field:** Which property to extract (label, code, value)

**length:** Optional truncation (number or empty)

**case:** U = UPPERCASE, L = lowercase, P = Proper Case

## Examples

{{M,point_type,label}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Miles\" {{M,point_type,label,,L}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"miles\" {{M,carrier,code}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"DL\" {{T,members,first_name}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Bill\" {{T,members,first_name,,U}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"BILL\" {{M,carrier,name,20}} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Delta Air Lines\" (truncated)

## Use Cases

**Error Messages:** \"Member does not have enough {{M,point_type,label,,L}} for this redemption\"

**Personalized Greetings:** \"Welcome back, {{T,members,first_name,,P}}!\"

**Dynamic Headers:** \"Total {{M,point_type,label,,P}} Earned\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Airlines: \"Total Miles Earned\", Hotels: \"Total Points Earned\"

**Activity Displays:** \"{{M,carrier,code}} {{M,flight_number,value}} from {{M,origin,code}} to {{M,destination,code}}\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"DL 1234 from DFW to ATL\"

## Why Atoms Are Brilliant

**Universal Text Templates:** One template works across all tenants and industries

**Self-Documenting:** {{M,point_type,label,,L}} is crystal clear what it does

**No String Concatenation:** Format and case rules in the atom, not scattered through code

**Template Reuse:** Same templates work in error messages, emails, SMS, reports, UI labels

**Status:** Specification complete in atom_resolve.js. Not yet integrated into display templates (next phase).

# 4. BONUS SYSTEM

The bonus system is the heart of a loyalty program - it drives member behavior and engagement.

## How Bonus Evaluation Works

When an activity is created, the system evaluates bonuses:

1\. Query all active bonuses for the tenant

2\. For each bonus, evaluate its rule criteria using molecule system

3\. Criteria check Dynamic molecules (carrier, origin) or Reference molecules (member_fname, tier)

4\. If ALL criteria match (with AND/OR joiner logic), bonus applies

5\. Bonus points calculated based on type (percent/fixed) and amount

6\. Bonus activities created as type 'N' with bonus_activity_id molecules on parent

## Database Structure

**bonus:** Bonus definitions (code, description, type, amount, date range, is_active)

**rule:** Rule definitions with AND/OR joiner logic for combining criteria

**rule_criteria:** Individual criteria (molecule_key, operator, comparison_value)

**bonus_rule:** Links bonuses to rules (M:M relationship, allows one bonus to have multiple rules)

## Bonus Types

**Percent Bonuses:**

Value: Percentage of base miles

Example: bonus_type=\'percent\', bonus_amount=10

Result: Base 1,000 miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ +100 bonus miles (10%)

Use Cases: Tier bonuses (Gold = +10%), promotional multipliers (Double Miles = +100%), fare class bonuses

**Fixed Bonuses:**

Value: Flat miles amount

Example: bonus_type=\'fixed\', bonus_amount=500

Result: +500 miles regardless of base

Use Cases: Welcome bonuses, promotional flat bonuses, special event bonuses

## Example Scenario

Member earns 1,200 base miles on a flight:

Check member tier ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ GOLD_10 applies (+10% = +120)

Check date ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ DBL_TUES applies (it\'s Tuesday! +100% = +1,200)

Check fare class ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ FIRST_50 applies (First Class +50% = +600)

**Total: 3,120 miles** (base 1,200 + bonus 120 + bonus 1,200 + bonus 600)

## Why Bonuses Matter

**Without bonuses:** Member earns 1,200 miles. Boring.

**With bonuses:** Member earns 3,120 miles because they\'re Gold, it\'s Tuesday, and they flew First. EXCITING!

Bonuses drive members to: achieve higher tiers, book on promotional dates, choose premium cabins, stay engaged with the program.

**This is the secret sauce that drives loyalty program success!**

## Rule Evaluation & Testing

**AND Logic Failure Display:**

When a rule uses AND logic (all criteria must match), the system shows ALL failures for better debugging:

ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ FAIL Reason: Fly on Delta: Failed Fly into Boston: Failed Fly out of Minneapolis: Failed

This allows seeing all problems at once instead of fixing one at a time.

**Key Testing Features:**

Only processes ACTIVE bonuses (is_active = true)

Checks date ranges: Activity date must be between start_date and end_date

Creates bonus_accrual records tracking which bonuses were awarded

Console logging shows engine evaluation process in real-time

## Criteria API Structure

Bonus criteria are managed through RESTful endpoints:

**Key Endpoints:**

GET /v1/bonuses/:bonusId/criteria - List all criteria

POST /v1/bonuses/:bonusId/criteria - Add criterion (auto-creates rule if needed)

PUT /v1/bonuses/:bonusId/criteria/:id - Update criterion

PUT /v1/bonuses/:bonusId/criteria/:id/joiner - Update AND/OR logic

DELETE /v1/bonuses/:bonusId/criteria/:id - Remove criterion

**Criterion Structure:**

{ \"source\": \"Activity\", // Activity or Member \"molecule\": \"Carrier\", // Display label \"molecule_key\": \"carrier\", // Database key \"operator\": \"equals\", // Comparison operator \"value\": \"DL\", // Comparison value \"label\": \"Fly on Delta\", // User-friendly description \"joiner\": \"OR\", // AND/OR (null for last) \"sort_order\": 1 // Display order }

**Auto-Management:** When adding criteria, system automatically creates rule if bonus doesn\'t have one, assigns sort_order, and manages joiner logic. When deleting last criterion, sets previous criterion\'s joiner to null.

# 5. DATABASE CONVENTIONS

## Data Type Sizing Reference

\-- Tenant isolation tenant_id SMALLINT \-- Max 32,767 tenants \-- Address fields (right-sized to domain) state CHAR(2) \-- US state codes: \"MN\", \"CA\" zip CHAR(5) \-- 5-digit ZIP: \"55419\" zip_plus4 CHAR(4) \-- ZIP+4 extension: \"1234\" \-- Member numbers membership_number VARCHAR(20) \-- Flexible for different formats \-- Currency and points currency_scale SMALLINT \-- Decimal places (0-4) point_balance BIGINT \-- Large numbers, smallest unit \-- Text fields molecule_key VARCHAR(50) \-- Short identifiers display_label TEXT \-- User-facing labels description TEXT \-- Explanatory text

## Tenant Isolation Patterns

Every table has tenant_id: Ensures data separation

All queries filter by tenant_id: No cross-tenant data leakage

Foreign keys include tenant_id: Maintains referential integrity within tenant

Indexes on (tenant_id, primary_field): Performance optimization

## Naming Conventions

**Tables:** Singular nouns (member, activity, bonus)

**Fields:** Lowercase with underscores (member_id, activity_date, is_active)

**Boolean fields:** Prefix with is\_ or has\_ (is_active, has_verified)

**Date fields:** Suffix with \_at or \_date (created_at, activity_date)

**Foreign keys:** Match referenced table (member_id references member)

## Data Type Sizing Rationale

Right-sizing isn\'t just about saving bytes - it\'s about performance, cache efficiency, and clear intent.

**Tenant ID:** Should be INTEGER (not BIGINT). System will have thousands of tenants, not billions. BIGINT wastes 4 bytes per row, hurts cache utilization, and slows joins.

**ID Column Guidelines:**

**BIGINT:** High-volume transactional (activity_id, member_id, point_lot_id)

**INTEGER:** Reference data and moderate volume (carrier_id, airport_id, bonus_id, tenant_id)

**SMALLINT:** Tiny lookups with limited cardinality (tier_id with 3-5 tiers, status codes)

**Philosophy:** Choose data types based on actual domain constraints, not developer convenience. A tier table with 5 rows doesn\'t need BIGINT primary key. Right-sizing compounds across millions of rows and foreign key references.

# 6. WORKFLOW & STANDARDS

## ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨ CRITICAL: Schema Verification BEFORE SQL

**MANDATORY PROCEDURE - NO EXCEPTIONS**

Before writing ANY SQL code:

1\. Read the actual schema: cat schema_snapshot.sql

2\. Find the target table: Search for CREATE TABLE statement

3\. Verify column names: Check exact field names and types

4\. Check constraints: Note unique constraints, foreign keys, defaults

5\. Look at existing data patterns: Query or ask to see sample data

6\. NEVER trust old SQL files: They may reference deprecated structures

7\. NEVER assume structure: Even if it seems obvious, verify

**Why this matters:**

Old SQL files may reference deprecated columns

Assumptions about structure lead to wrong INSERT/UPDATE statements

Embedded list molecules use category + multiple rows, NOT JSONB blobs

Trust is broken when SQL fails due to unchecked assumptions

Wasted time debugging is far more costly than 30 seconds reading schema

**Red flags indicating schema check was skipped:**

SQL errors about \"column does not exist\"

INSERT statements with wrong column names

Assumptions about JSONB when structure is normalized rows

Creating single rows when pattern requires multiple rows

## File Organization

/home/claude/loyalty-demo/ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ SQL/ \# Database scripts ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ learnings/ \# Handoff files ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ \*.html \# Web pages ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ \*.js \# JavaScript ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ \*.md \# Documentation

**SQL Scripts:**

Location: /home/claude/loyalty-demo/SQL/

Naming: Descriptive (create_state_molecule.sql)

Bill\'s Location: \~/Projects/Loyalty-Demo/SQL/

Always include verification queries at end

## Bill\'s Communication Style

**Key Signals:**

**\"stop!\"** - Claude made error, needs immediate correction

**\"NO!\"** - Claude headed wrong direction, restart approach

**\"why are you asking?\"** - Claude should know this

**\"you need to read\...\"** - Claude missed context

**\"b\"** - Just scrolling chat, continue waiting

**Rapid \"stop!\" repetition** - Major course correction needed

**ALL CAPS** - Extreme frustration, stop and listen

**Swearing** - Serious mistake, don\'t defend, fix immediately

**Bill values:**

Complete working solutions over partial fixes

Direct answers over verbose explanations

Showing work instead of just describing it

Data-driven decisions based on actual schema

Following procedures consistently

## LONGORIA Protocol

When Bill says \"LONGORIA this page\" - perform comprehensive audit:

1\. Apply Vertical Spacing Standards (compress padding to 6px, margins to 6px)

2\. Implement Scrollable List Pattern if page could exceed viewport height
   - **CRITICAL FIX:** theme.css has `.app-layout { min-height: 100vh }` which breaks viewport scrolling
   - **Required CSS overrides:**
     ```css
     html, body {
       height: 100%;
       overflow: hidden;
     }
     .app-layout {
       height: 100vh !important;
       min-height: auto !important;
     }
     .main-content {
       display: flex;
       flex-direction: column;
       height: 100vh;
       overflow: hidden;
     }
     .page-header {
       flex-shrink: 0;
     }
     .scrollable-content {
       flex: 1;
       overflow-y: auto;
     }
     .fixed-actions {
       flex-shrink: 0;
     }
     ```
   - Structure: Fixed header ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Scrollable content ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Fixed footer

3\. Update Version Number automatically (never ask permission)

4\. Include buttons.css stylesheet in page \<head\>

5\. Button Standardization: Convert icon-only buttons to icon + text format using .btn classes

6\. Table Compression: Apply compressed table spacing (td: 4px 8px, th: 6px 8px)

7\. Column Width Optimization: Set explicit column widths to eliminate excessive white space

**Execution Efficiency:**

LONGORIA changes should be fast (7-10 tool calls max). Use this approach:

1. **Read files completely first** - View both/all files to understand all buttons and structure
2. **Plan all changes** - Identify all button replacements, style removals, and modifications in one pass
3. **Use bulk operations** - Use sed/awk for repetitive replacements instead of multiple str_replace calls
4. **Batch related changes** - Group similar changes (all button text updates, all padding changes) into single commands
5. **Verify once at end** - Don't check after each change, verify all changes together at the end

Example efficient execution:
- 2 view commands (read both files)
- 2-3 sed commands (bulk button text replacements, padding changes)
- 2 str_replace (stylesheet links, complex replacements)
- 1 copy to outputs

**Etymology:** Has no default meaning. If Claude forgets what it means, Claude will ask instead of doing the wrong thing.

## Mandatory Procedures

**Version Updates (AUTOMATIC):** When modifying server_db_api.js, ALWAYS update SERVER_VERSION and BUILD_NOTES. Use TZ=\'America/Chicago\' date +\"%Y.%m.%d.%H%M\". Never ask permission.

**Token Budget:** Monitor usage, warn at 75% (142,500 of 190,000 tokens)

**ATIS (Always Test In Server):** Never assume code works - verify with curl or browser test

**CRUD Completeness:** Every data management interface must support Create, Read, Update, AND Delete (including parent/container deletion with confirmation dialogs)

## Development Workflow

**MANDATORY cycle - NO SHORTCUTS:**

1\. Read schema: cat schema_snapshot.sql

2\. Find target table: grep -A 30 \"CREATE TABLE table_name\"

3\. Verify column names and types

4\. Check existing code patterns for similar features

5\. Write/modify code

6\. Test with curl commands

7\. Update version in server_db_api.js (automatic, no asking)

8\. Copy files to /mnt/user-data/outputs/

9\. Provide download links with EXACT paths for Bill

10\. Specify run commands from Bill\'s project root

## Trust and Reliability

Promises matter: If you promise to do something, DO IT

Consistency is critical: Following procedures once doesn\'t rebuild trust

Repeated failures compound: Same mistake multiple times is unacceptable

Don\'t make excuses: Just fix the problem and prevent recurrence

Trust takes time to rebuild: After damage, consistent behavior over multiple sessions required

## Communication Guidelines

No meta-commentary: Don\'t explain your thought process unless asked

Direct answers: Address the actual question, not tangential issues

Admit mistakes quickly: Don\'t defend errors, fix them immediately

Focus on solutions: Provide actionable next steps

Be honest about limitations: If you don\'t know, say so

## {Variable} Notation Convention

**CRITICAL:** When Bill uses text like {Miles} or {Points} in messages, curly braces indicate dynamic/configurable values, NOT literal text.

**Examples:**

Bill says \"Show {Miles} in header\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Use pointLabel variable, NOT literal \"{Miles}\"

Bill says \"Total {Points} earned\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Use \"Total \" + pointLabel + \" earned\"

Appears in: UI mockups, design specs, feature descriptions

**Rule:** Curly braces = placeholder for dynamic content, use label system or template variables.

## Confusion Safeguards

Self-monitoring patterns to prevent overcomplicated responses.

**Red Flags (Claude Self-Monitor):**

Giving multiple options when asked for ONE thing

Over-explaining simple requests

Adding context user didn\'t ask for

Taking \>2 tool calls for simple query

Writing paragraphs for one-line question

**Token Checkpoints:**

130K tokens (68%) - Check: Are responses getting overcomplicated?

150K tokens (79%) - Warning level

170K tokens (89%) - Critical level, consider handoff

**When confusion detected:** Stop, acknowledge the pattern, offer options (continue with refocus, upload handoff, or request clarification).

# 7. COMMON COMMANDS

## Database Operations

\# Connect to database psql -h 127.0.0.1 -U billjansen -d loyalty \# Run SQL script (from Bill\'s project root) cd \~/Projects/Loyalty-Demo psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/script.sql \# Check current Central Time TZ=\'America/Chicago\' date +\"%Y.%m.%d.%H%M\" \# Check table structure psql -h 127.0.0.1 -U billjansen -d loyalty -c \"\\d table_name\" \# View sample data psql -h 127.0.0.1 -U billjansen -d loyalty \\ -c \"SELECT \* FROM table_name LIMIT 5;\"

## File Operations

cat /home/claude/loyalty-demo/database/schema_snapshot.sql

## API Testing

\# Test molecule endpoints curl \"http://localhost:4001/v1/molecules/get/state?tenant_id=1\" curl \"http://localhost:4001/v1/molecules/encode\\ ?tenant_id=1&key=state&value=Minnesota&return_text=true\" \# Test member profile curl \"http://localhost:4001/v1/member/12345/profile\" \# Test bonus evaluation curl \"http://localhost:4001/v1/bonuses/evaluate\\ ?member_id=12345&activity_date=2025-11-15\\ &destination=BOS&carrier=DL\"

# 8. ANTI-PATTERNS & LESSONS LEARNED

## Schema Verification Failure Pattern

**Problem:** Writing SQL without checking actual table structure

**Consequence:** Wrong column names, incorrect data types, misunderstanding of structure

**Time Cost:** 30 seconds to check schema vs.ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â 30+ minutes to debug failed SQL

**Trust Cost:** Repeated violations damage credibility and working relationship

**Prevention:**

ALWAYS read schema_snapshot.sql before SQL creation

Look at existing data patterns before creating similar structures

Never trust old SQL files - they may reference deprecated structures

Verify assumptions with actual queries

## The \"Just Trust the File\" Anti-Pattern

**Problem:** Using old SQL files as templates without verification

**Why it fails:** Database evolves, old migration scripts don\'t update

**Correct approach:** Always verify against current schema, not historical SQL

## The \"Incomplete CRUD\" Anti-Pattern

**Problem:** Building data management UI without full delete capability

**Why it matters:** Test data, mistakes, and organizational changes require deletion

**Correct approach:** Plan for all CRUD operations from the start:

Create functionality with form/modal

Read/List view with all records

Update/Edit for existing records

Delete for individual records

Delete for parent/container records (if hierarchical)

Confirmation dialogs for destructive operations

## The \"Hardcoded Table Map\" Anti-Pattern

**Problem:** Hardcoding table mappings in encode/decode functions defeats molecule abstraction.

**Wrong Approach:**

const tableMap = { \'carrier\': { table: \'carrier\', column: \'carrier_code\' }, \'airport\': { table: \'airport\', column: \'airport_code\' }, \'hotel_brand\': { table: \'hotel_brand\', column: \'brand_code\' } };

**Why it fails:**

Adding new lookup molecules requires code changes

Defeats purpose of molecule abstraction

Not industry-agnostic

Violates \"data drives behavior\" principle

**Correct Approach:**

// Read metadata from molecule_value_lookup const metadataQuery = \` SELECT table_name, id_column, code_column FROM molecule_value_lookup WHERE molecule_id = \$1 \`;

**Impact:** Adding new lookup molecules now requires only database inserts, zero code changes. System passes the elegance test: \"Adding new industry/data type should only require database inserts.\"

# 9. KEY DISCOVERIES

Historical insights explaining design decisions and validation of architectural choices.

## Activity Type Expansion

**Discovery:** Molecule system elegantly supports new activity types through data configuration.

Activity Types: A (Flight), R (Redemption), P (Partner), J (Adjustment) - each with 7 property rows defining display and behavior. No code changes required.

**Impact:** Platform handles four distinct categories with different display properties and business rules, all configured through molecules.

## State Molecule Breakthrough

**Discovery:** Bidirectional molecule conversion enables user-friendly dropdowns with efficient storage.

Store 2-char codes (CHAR(2)), display \"MN Minnesota\" format, enable bonus rules (member_state = \'MN\').

**Impact:** Solves the efficiency vs.ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â usability tradeoff.

## Temporal-First Validation

**Discovery:** Point balance derivation scales to production volumes.

**Evidence:** Member with 10,000+ activities calculates balance in \<100ms using proper indexing on (member_id, activity_date).

## Multi-Tenant Architecture Success

**Discovery:** Tenant isolation through tenant_id enables true multi-industry platform.

**Validation:** Same database instance serves airline and hotel programs with complete isolation and different business rules.

# 10. FUTURE EVOLUTION OPPORTUNITIES

## Recently Completed (2025-12-11)

**Composite System:** Activity structure now defined in data, not code. Multi-industry capability achieved. See Section 27.

**Input Templates:** UI forms reference composites for business rules, separate from layout. See Section 28.

**Display Templates Simplified:** One per (tenant, activity_type, template_type). No selection logic needed.

## Potential Enhancements

Molecule versioning: Track changes to business rules over time

Derived molecule caching: Cache expensive calculations with invalidation

Cross-tenant molecule sharing: Standard molecules (states, countries) shared globally

Molecule validation rules: Enforce constraints on molecule values

Audit trail for molecule changes: WHO changed WHAT and WHEN

## Scalability Considerations

Horizontal partitioning: Partition large tables by tenant_id

Read replicas: Separate read and write workloads

Molecule caching: Cache frequently accessed values in Redis

Archive strategies: Move old activity data to time-partitioned tables

## Architectural Stability Note

With the Composite System implemented, the platform has reached architectural stability:

- **New industries:** Add tenant + composite data (no code changes)
- **New molecules:** Add to composite (no code changes)
- **New activity types:** Create composite + template (no code changes)
- **Core processing:** Generic `createActivity` reads composite dynamically

The code is now truly generic. Industry lives in data. This was the final structural refactor.

# 11. DATE & TIME COMPRESSION

Store dates and times as 2-byte integers instead of standard 4-byte DATE and 8-byte TIMESTAMP types.

## The Core Concept

**Traditional approach:** activity_date DATE (4 bytes), posted_at TIMESTAMP (8 bytes), expire_date DATE (4 bytes) = 16 bytes per record.

**Compressed approach:** activity_date_id SMALLINT (2 bytes), post_date_id SMALLINT (2 bytes), post_time_id SMALLINT (2 bytes), expire_date_id SMALLINT (2 bytes) = 8 bytes per record.

**Savings: 50% (16 bytes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 8 bytes)**

## Date Storage - Days Since Epoch

**Epoch: December 3, 1959 (Bill\'s birthday)**

SMALLINT range: -32,768 to 32,767 (65,536 values total). Date mapping: Dec 3, 1959 = 0, covering dates from ~1870 to ~2138. Coverage: 179 years.

**Why this range is perfect:**

Historical: Loyalty programs began 1980s, no need for dates before 1959

Forward: Point expiration 12-36 months, tier qualifications up to 5 years, system lifecycle through 2138 (113 years)

Comparison: Unix epoch (1970) gives 1880-2059, Bill\'s epoch (1959) gives 1870-2138

## activity_date Implementation (COMPLETED)

**Status:** Implemented as of 2025-12-06

The `activity.activity_date` column is now SMALLINT (2 bytes) using the Bill epoch (1959-12-03 = 0).

**Schema:**
```sql
activity.activity_date SMALLINT  -- Days since 1959-12-03
```

**Migration Flag:**
```javascript
const ACTIVITY_DATE_MIGRATED = true;  // In server_db_api.js
```

**Wrapper Functions:**
```javascript
// Convert JS Date to SMALLINT for storage
dateToActivityInt(date)  // Returns days since 1959-12-03

// Convert SMALLINT back to JS Date for display
activityIntToDate(num)   // Returns Date object

// PostgreSQL functions also available:
// date_to_molecule_int(date) and molecule_int_to_date(integer)
```

**Example:**
- 2025-12-06 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 24108 (activity_date SMALLINT value)
- 24108 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 2025-12-06 (decoded back to date)

## Time Storage - 10-Second Blocks

**Why 10-second precision:** 86,400 seconds/day ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â· 10 = 8,640 blocks. SMALLINT max = 32,767. Easily fits with 75% headroom.

**Time mapping:** 00:00:00 = 0, 00:01:00 = 6, 01:00:00 = 360, 12:00:00 = 4,320, 23:59:50 = 8,639.

**10 seconds is adequate for:** Activity posting timestamps, audit trails, bonus awards, user logins, CSR actions. Nobody cares if a flight was posted at 14:23:37 or 14:23:40.

## Combined DateTime - 4 Bytes Total

Traditional TIMESTAMP: 8 bytes. Compressed: post_date_id (2 bytes) + post_time_id (2 bytes) = 4 bytes total. 50% savings!

**Example:** 2025-11-07 14:23:40 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ post_date_id = -8,619, post_time_id = 5,184 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ decode_datetime(-8619, 5184) = 2025-11-07 14:23:40

## Implementation Through Views

PostgreSQL functions encode/decode transparently. Views make compression invisible to application:

CREATE VIEW activity_readable AS SELECT activity_id, member_id, decode_date(activity_date_id) as activity_date, decode_datetime(post_date_id, post_time_id) as posted_at FROM activity; \-- Application queries the view SELECT \* FROM activity_readable WHERE activity_date \>= \'2025-11-01\'; \-- Behind scenes: efficient integer comparisons

## Bill\'s \"Million Years Ago\" Philosophy

Bill built loyalty platforms in the 1980s-90s using 2-byte dates and variable-length keys (1-4 bytes based on table size). The philosophy endures: right-size data types to domain, think about actual bytes on disk, performance through efficiency. At 1 billion records, 2 bytes saved per record = 2 GB saved. Better cache utilization = faster queries.

**Status:** activity_date IMPLEMENTED (2025-12-06). post_date/post_time compression still pending.

# 12. POINT LOTS & EXPIRATION

The bucket system manages point expiration using a dedicated `member_point_bucket` table for buckets, with `member_points` molecules linking activities to their buckets.

## Architecture: Hybrid Table + Molecule

**Design Principle:** Buckets are entities that need their own identity (queried, updated, referenced), so they get a proper table. The activity-to-bucket relationship is an attribute, so it uses the molecule system.

**member_point_bucket table:**
```sql
member_point_bucket (
  link CHAR(5) PRIMARY KEY,   -- bucket identifier (via link_tank)
  p_link CHAR(5),             -- member link (FK)
  rule_id SMALLINT,           -- point_expiration_rule.rule_id
  expire_date SMALLINT,       -- days since 1959-12-03
  accrued INTEGER DEFAULT 0,  -- total points earned into bucket
  redeemed INTEGER DEFAULT 0  -- total points consumed from bucket
)
```

**member_points molecule (storage_size: '54'):**
- c1 (CHAR(5)): bucket_link (pointer to member_point_bucket.link)
- n1 (INTEGER): amount (positive for earn, negative for redeem)

Stored in `5_data_54` table, links each activity to its bucket with the point amount.

## The Flow

When activity is created:

1. Find expiration rule: Query `point_expiration_rule` by activity_date and tenant_id, returns rule_id and expiration_date

2. Find or create bucket: Search `member_point_bucket` for existing bucket with matching (p_link, rule_id, expire_date). Create if not found.

3. Update bucket: Increment `accrued` column by point_amount

4. Create activity link: Insert `member_points` molecule in `5_data_54` (bucket_link + amount)

**Helper Functions:**
- `findOrCreatePointBucket(memberLink, ruleId, expireDate, tenantId)` â†’ bucket link
- `updatePointBucketAccrued(memberLink, bucketLink, amount, tenantId)`
- `saveActivityPoints(activityId, bucketLink, amount, tenantId, activityLink)`
- `addPointsToMoleculeBucket(memberLink, activityDate, pointAmount, tenantId)` â†’ orchestrates all

**Why This Pattern:**

Entities vs Attributes: Buckets need identity (own table), activity links are attributes (molecule)

Efficient queries: Direct table access for bucket balances

Audit trail: `member_points` molecules link activities to buckets

FIFO consumption: Query buckets ORDER BY expire_date for redemptions

## Available Points Calculation

```sql
SELECT SUM(accrued) - SUM(redeemed) as available
FROM member_point_bucket
WHERE p_link = $1 
  AND expire_date >= $todayInt
```

## Point Expiration Rules

`point_expiration_rule` table defines when points expire based on earn date:
- rule_id (SERIAL, numeric identifier)
- rule_key (TEXT, human-readable like "R2025")
- tenant_id (FK to tenant)
- start_date, end_date (activity date range)
- expiration_date (when points from this range expire)

Admin pages: `admin_expiration.html`, `admin_expiration_edit.html`

# 13. MEMBERS & TIERS

Member profile management with derived tier status and dual-ID pattern.

## Dual-ID Pattern: Internal vs Customer-Facing

**Problem:** Need efficient joins (BIGINT) AND flexible customer IDs (VARCHAR).

**Solution:**

**member_id:** BIGINT, immutable, auto-increment, used for all foreign keys

**membership_number:** VARCHAR(16), customer-facing, searchable, editable

**Benefits:**

All joins remain BIGINT (fast, efficient)

Customer sees branded ID: \"DL123456789\", \"UA987654\"

Search works on membership_number (indexed)

Can change membership_number without breaking foreign keys

Multi-tenant: Each tenant can have different ID format

**Implementation:** Profile UI shows both fields. Member header displays membership_number. Search endpoint queries membership_number. All database relationships use member_id.

# 14. ACTIVITIES

Core transaction records with molecule-based detail storage and temporal design.

## Activity Types

Five activity types with different display properties:

**A - Flight:** ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€¹Ã¢â‚¬Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Core airline earnings, green theme, bonuses enabled

**R - Redemption:** ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â Award spending, red theme, no bonuses

**P - Partner:** ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â Partner earnings (hotels, car rentals), teal theme, no bonuses

**J - Adjustment:** ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Manual corrections, purple theme, no bonuses

**N - Bonus:** ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ Promotional awards derived from parent activity

## Activity Type \'N\' - Bonuses as Activities

**Core concept:** Bonuses ARE activities with type 'N'. Each bonus is a full activity record. The parent activity stores bonus_activity_id molecules pointing to its bonus children.

**Example structure:**

activity (id: 123, type: 'A', points: 1000)
  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ activity_detail: carrier=DL, origin=MSP
  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ activity_detail: bonus_activity_id=124  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â points to bonus child
  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ activity_detail: bonus_activity_id=125  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â points to another bonus child
activity (id: 124, type: 'N', points: 100)
  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ activity_detail: bonus_rule_id=5
activity (id: 125, type: 'N', points: 50)
  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ activity_detail: bonus_rule_id=7

**Required molecules for parent activity (when bonuses apply):**

**bonus_activity_id:** Points to each bonus activity (0-n instances, scalar numeric, NOT permanent, NOT static)

**Required molecules for Type N (bonus activity):**

**bonus_rule_id:** Points to bonus rule that awarded points (scalar numeric)

**Optional molecules for Type N:**

awarded_by (text), promotion_code (text), award_reason (text), override_expiration (date)

## Why Type N Is Brilliant

**Architectural Purity:** Everything is an activity. No special tables, no special code.

**Unlimited Flexibility:** Add molecules without schema changes. Want promotion codes? Just add molecule.

**Natural Audit Trail:** Bonuses appear in activity stream chronologically. No separate query needed.

**Elegant Reversals:** Look at parent's bonus_activity_id molecules, reverse those activities too.

**Point Lot Association:** All points from one activity (base + bonuses) share the same lot_id. One flight = one expiration date for all points.

**Query pattern - exclude bonuses from main list:** SELECT \* FROM activity WHERE member_id = \$1 AND activity_type != \'N\'. Use member_activities view to make filtering automatic.

## Storage Pattern

Activity uses molecule system for extensibility:

activity table: Generic fields (member_id, activity_date, point_amount, point_bucket_id)

activity_detail table: Molecule-specific data (carrier, origin, destination, etc.)

Each detail row: activity_id, molecule_key (k), value_reference (v_ref_id)

Industry-agnostic: Same structure for flights, hotel stays, purchases

# 15. PARTNERS & PARTNER PROGRAMS

Partner activities enable loyalty programs to award points for non-core business activities like car rentals, hotel stays, and credit card spending.

Partner vs Partner Program Structure

Partners represent organizations (Hertz, Marriott, American Express). Partner Programs represent specific earning opportunities within each partner (Hertz Luxury Cars, Marriott Bonvoy Gold).

Relationship: One partner can have multiple programs (1:n).

Examples:\
Hertz ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Luxury Car Program, Economy Car Program, Truck Rental Program\
Marriott ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Bonvoy Gold Program, Bonvoy Platinum Program\
American Express ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Platinum Card Program, Gold Card Program

Database Structure

partner table:\
partner_id (PK, INTEGER, GENERATED ALWAYS AS IDENTITY)\
tenant_id (FK, SMALLINT)\
partner_code (VARCHAR(20), unique per tenant)\
partner_name (VARCHAR(100))\
is_active (BOOLEAN DEFAULT true)

partner_program table:\
program_id (PK, INTEGER, GENERATED ALWAYS AS IDENTITY)\
partner_id (FK to partner)\
tenant_id (FK, SMALLINT)\
program_code (VARCHAR(20))\
program_name (VARCHAR(100))\
earning_type (CHAR(1): \'F\'=Fixed, \'V\'=Variable)\
fixed_points (BIGINT, required if F, null if V)\
is_active (BOOLEAN DEFAULT true)\
Constraints: CHECK ((earning_type=\'F\' AND fixed_points IS NOT NULL) OR (earning_type=\'V\' AND fixed_points IS NULL))

Earning Types: Fixed vs Variable

Fixed (F): Predefined points amount stored in partner_program.fixed_points.\
Example: Rent a Hertz luxury car = 500 miles (always). CSR cannot change amount.

Variable (V): Points calculated based on transaction amount that varies.\
Example: American Express card spending = 1 point per dollar spent. CSR enters points based on actual spend.

CSR Workflow for Adding Partner Activity

1\. Select activity type = Partner (P)\
2. Select partner from dropdown (Hertz, Marriott, Amex, etc.)\
3. Select partner program from filtered dropdown (shows only programs for selected partner)\
4. Points handling:\
If earning_type=\'F\': Points auto-populate from partner_program.fixed_points (field becomes read-only)\
If earning_type=\'V\': CSR manually enters points amount\
5. Click submit - activity posted with type=\'P\'

Molecule Structure

Partner activities use two lookup molecules:\
partner molecule: Lookup type pointing to partner table\
partner_program molecule: Lookup type pointing to partner_program table

Activity structure:\
activity:\
activity_type = \'P\'\
point_amount = miles/points earned\
activity_detail (two rows):\
Row 1: molecule_id=30 (partner), v_ref_id=partner_id\
Row 2: molecule_id=31 (partner_program), v_ref_id=program_id

Example from production data:\
Activity 40: partner_id=2 (Marriott), program_id=4 (MAR-GOLD Bonvoy Gold Stays), 1000 miles

Partner Program Filtering Implementation

The filtering challenge has been solved using a dedicated API endpoint rather than extending the molecule system.

Solution: API endpoint GET /v1/partners/:id/programs?tenant_id={id} returns only programs for specified partner.

UI Implementation:\
1. Partner dropdown loads all partners: GET /v1/partners?tenant_id={id}\
2. User selects partner ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ triggers loadPartnerPrograms()\
3. Function calls GET /v1/partners/{partnerId}/programs?tenant_id={tenantId}\
4. Program dropdown populates with filtered results\
5. Only programs belonging to selected partner are shown

This approach:\
- Avoids complexity of adding generic filter parameter to molecule system\
- Provides efficient, purpose-built endpoint for common use case\
- Maintains separation of concerns (partners are business logic, molecules are data abstraction)\
- Can be extended for future similar relationships (e.g., hotel properties ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ room types)

Admin Features

admin_partners.html:\
- List all partners with program count\
- Filter by tenant\
- Add new partner button\
- Edit button (opens admin_partner_edit.html)\
- Delete button with confirmation (cascades to programs)

admin_partner_edit.html:\
- Create/edit partner with code and name\
- Inline program management with modal editor\
- Add multiple programs to partner\
- Edit program details (code, name, earning type, fixed points)\
- Remove programs from partner\
- Visual indicators for Fixed vs Variable earning types\
- Active/inactive toggle for partner and programs

API Endpoints

GET /v1/partners?tenant_id={id} - List all partners for tenant\
GET /v1/partners/:id?tenant_id={id} - Get single partner with programs\
GET /v1/partners/:id/programs?tenant_id={id} - Get programs for specific partner (filtered)\
POST /v1/partners - Create new partner with programs\
PUT /v1/partners/:id - Update partner and programs\
DELETE /v1/partners/:id - Delete partner (cascades to programs)\
POST /v1/members/:memberId/activities/partner - Post partner activity

Database Relationships

Foreign key partner_program.partner_id references partner.partner_id ensures referential integrity.\
Molecule definition partner_program has parent_molecule_key=\'partner\' and parent_fk_field=\'partner_id\' documenting the relationship.\
Activity detail stores both partner and program IDs for complete attribution.

Display Properties

Activity type \'P\' has these display properties (via activity_display molecule):\
Icon: ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â (handshake)\
Color: Teal (#14b8a6)\
Background: #ccfbf1\
show_bonuses: false (partner activities don\'t earn bonuses)\
action_verb: \'Earned from Partner\'

Production Data Example

Partners: Hertz, Marriott, American Express\
Programs:\
HERTZ-LUX (Fixed: 500 miles)\
HERTZ-ECO (Fixed: 250 miles)\
HERTZ-TRUCK (Fixed: 300 miles)\
MAR-GOLD (Fixed: 1000 miles)\
MAR-PLAT (Fixed: 1500 miles)\
AMEX-PLAT (Variable)\
AMEX-GOLD (Variable)

Member 2153442807 has 4 partner activities posted totaling 2,800 miles.

Status: Fully implemented and operational. Partner system complete with admin UI, CSR workflow, filtered program selection, and activity posting. Integrated with molecule system, point lots, and activity display templates.

## Partner as Alias Source

Partners also serve as a key discriminator in the Member Alias system. Members can store external account numbers from partner programs (e.g., Marriott Bonvoy number, Hertz Gold number) as aliases that resolve to their canonical member record. The `partner` molecule is configured as a source type in alias_composite_detail, allowing CSRs to associate partner-specific identifiers with members. See Section 29 (Member Aliases) for complete documentation.

# 16. REDEMPTIONS

Point redemption system with FIFO lot consumption, Fixed/Variable redemption types, and activity-based tracking.

## Redemption Rule Structure

Redemptions are managed through the redemption_rule table that defines available redemption options.

**redemption_rule table:**

redemption_id (PK) tenant_id (FK) redemption_code (VARCHAR, e.g., \'FLIGHT-25K\') redemption_description (VARCHAR, e.g., \'Domestic Flight\') redemption_type (CHAR(1): \'F\'=Fixed, \'V\'=Variable) points_required (NUMERIC, used when type=\'F\') start_date (DATE) end_date (DATE, nullable) status (CHAR(1): \'A\'=Active, \'I\'=Inactive) created_at, updated_at

## Fixed vs Variable Redemptions

**Fixed (F):** Predetermined point cost stored in redemption_rule.points_required. Example: Domestic flight = 25,000 miles. CSR cannot modify points amount - it\'s fixed by the rule.

**Variable (V):** Point cost varies based on specific award. Example: Hotel stays, merchandise, gift cards. CSR enters actual points required for that specific redemption.

## CSR Workflow for Processing Redemption

1\. Navigate to member profile

2\. Click \"Add Redemption\"

3\. Select redemption date (defaults to today)

4\. Select redemption type from dropdown (shows only active rules)

5\. Enter points:

If Fixed: Points auto-populate from rule, field disabled

If Variable: CSR manually enters points required

6\. Click \"Process Redemption\" - system validates and executes

## FIFO Point Consumption Logic

When redemption is processed, system consumes points using First-In-First-Out logic based on expiration dates, reading from `molecule_value_list`.

**Process:**

1\. Lock member record (FOR UPDATE)

2\. Query available buckets from molecule_value_list: WHERE col='E' (expire_date) > today AND (col='C' - col='D') > 0, ORDER BY col='E' ASC

3\. Validate sufficient points available

4\. Calculate breakdown - consume from earliest expiring buckets first

5\. Create activity record (type='R', point_amount is negative)

6\. Store redemption_rule_id via `insertActivityMolecule`

7\. Update col='D' (redeemed) in each consumed bucket

8\. Create `member_points` molecules on activity (negative amounts, linking to each bucket used)

9\. Commit transaction

## Activity Type 'R' Structure

Redemptions create activity records with activity_type='R' (Redemption):

```
activity:
  activity_type = 'R'
  point_amount = negative (e.g., -25000)
  activity_date = redemption date

molecule_value_list (redemption molecule):
  molecule_id = redemption molecule
  context_id = activity_id
  col = 'A', value = redemption_rule_id

molecule_value_list (member_points - multiple rows if multiple buckets):
  molecule_id = member_points molecule
  context_id = activity_id
  row_num = 1, 2, 3... (one per bucket consumed)
  col = 'A', value = bucket_row_num (pointer)
  col = 'B', value = negative points consumed from that bucket
```

## Display Properties

Activity type \'R\' has these display properties (via activity_display molecule):

Icon: ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â (gift)

Color: Red (#dc2626)

Background: #fee2e2

show_bonuses: false (redemptions don\'t earn bonuses)

action_verb: \'Redeemed\'

## Error Handling

**E003 Error:** Insufficient points. Message stored in molecule system as error_message molecule, enabling tenant-specific error messages. Example: \"Member does not have enough {{M,point_type,label,,L}} for this redemption.\"

## Admin Features

**admin_redemptions.html:** List all redemption rules, filtered by tenant, CRUD operations

**admin_redemption_edit.html:** Create/edit redemption rules with type selection and date ranges

**add_redemption.html:** CSR tool for processing member redemptions with member header integration

**Status:** Fully implemented and operational. Integrated with molecule system, point lots, and activity tracking.

17\. ADJUSTMENTS

Manual point adjustments for customer service, corrections, promotional credits, and goodwill gestures.

Purpose

Adjustments (activity type \'J\') provide CSRs with a mechanism to manually add or subtract points for situations that fall outside normal earning and redemption flows:\
- Missing mileage credit for flights not properly recorded\
- Service recovery for customer issues or complaints\
- Promotional credits from marketing campaigns\
- Correction of posting errors\
- Goodwill gestures for service failures\
- Expired points reinstatement (per policy)\
- Account reconciliation

Database Structure

adjustment table:\
adjustment_id (PK, INTEGER, GENERATED AS IDENTITY)\
tenant_id (FK, SMALLINT)\
adjustment_code (VARCHAR(20), unique per tenant)\
adjustment_name (VARCHAR(100))\
adjustment_type (CHAR(1): \'F\'=Fixed, \'V\'=Variable)\
fixed_points (INTEGER, required if F, null if V)\
is_active (BOOLEAN DEFAULT true)

Constraints:\
CHECK ((adjustment_type=\'F\' AND fixed_points IS NOT NULL AND fixed_points \> 0) OR (adjustment_type=\'V\' AND fixed_points IS NULL))

Comment on table: \'Manual point adjustments for customer service and corrections\'

Adjustment Types: Fixed vs Variable

Fixed (F): Predefined points amount stored in adjustment.fixed_points.\
Example: CS-500 \"Customer Service Credit - 500\" = 500 miles (always)\
Use case: Standardized service recovery amounts (500, 1000, 2500 miles)\
CSR workflow: Select adjustment type, points auto-populate, field becomes read-only

Variable (V): CSR enters points amount based on situation.\
Example: CS-VAR \"Customer Service Credit - Variable\", CORRECT \"Points Correction\"\
Use case: Unique situations requiring judgment, exact error corrections\
CSR workflow: Select adjustment type, CSR manually enters points (can be negative)

CSR Workflow for Posting Adjustment

1\. Navigate to member profile\
2. Click \"Add Adjustment\"\
3. Select activity date (defaults to today, can backdate per retro_days_allowed)\
4. Select adjustment type from dropdown (shows only active adjustments)\
5. Points handling:\
If Fixed: Points auto-populate from adjustment.fixed_points (read-only)\
If Variable: CSR enters points amount (positive or negative)\
6. Click \"Post Adjustment\" - activity created with type=\'J\'

Positive vs Negative Adjustments

Positive adjustments (credit): point_amount \> 0\
- Member receives points\
- Increases point balance\
- Creates/updates member_point_bucket molecule (column C accrued)\
- Creates member_points molecule on activity linking to bucket\
- Example: +2500 for service recovery

Negative adjustments (debit): point_amount \< 0\
- Member loses points\
- Decreases point balance\
- Updates member_point_bucket molecule (column D redeemed, FIFO)\
- Creates member_points molecule on activity (negative amount)\
- Example: -500 to correct duplicate posting

Molecule Structure

Adjustments use one lookup molecule:\
adjustment molecule: Lookup type pointing to adjustment table (molecule_id=32)

Activity structure:\
activity:\
activity_type = \'J\'\
point_amount = miles/points (positive or negative)\
activity_date = date of adjustment\
post_date = today\
molecule_value_list (adjustment molecule):\
molecule_id=32 (adjustment)\
col='A', value=adjustment_id\
molecule_value_list (member_points molecule):\
col='A', value=bucket_row_num\
col='B', value=point_amount

Example from production data:\
Activity 44: adjustment_id=3 (CS-2500 Customer Service Credit - 2500), 2,500 miles

Display Properties

Activity type \'J\' has these display properties (via activity_display molecule):\
Icon: ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â (scales)\
Color: Purple (#7c3aed)\
Background: #faf5ff\
Border: #7c3aed\
show_bonuses: false (adjustments don\'t earn bonuses)\
action_verb: \'Adjusted\'

Admin Features

admin_adjustments.html:\
- List all adjustments for tenant\
- Show type (Fixed/Variable) with visual indicators\
- Show fixed_points for Fixed types\
- Add new adjustment button\
- Edit button (opens admin_adjustment_edit.html)\
- Delete button with confirmation

admin_adjustment_edit.html:\
- Create/edit adjustment with code and name\
- Select adjustment type (Fixed or Variable)\
- Enter fixed_points if Fixed type (auto-validates)\
- Active/inactive toggle\
- Form validation ensures Fixed types have points, Variable types don\'t\
- Clear visual distinction between Fixed and Variable in UI

API Endpoints

GET /v1/adjustments?tenant_id={id} - List all adjustments for tenant\
GET /v1/adjustments/:id?tenant_id={id} - Get single adjustment\
POST /v1/adjustments - Create new adjustment\
PUT /v1/adjustments/:id - Update adjustment\
DELETE /v1/adjustments/:id - Delete adjustment\
POST /v1/members/:memberId/activities/adjustment - Post adjustment activity

Validation Rules

Adjustment code: Required, max 20 chars, unique per tenant\
Adjustment name: Required, max 100 chars\
Adjustment type: Required, must be \'F\' or \'V\'\
Fixed points: Required if type=\'F\', must be \> 0, must be null if type=\'V\'\
Activity date: Cannot exceed retro_days_allowed (tenant configuration)\
Point amount: For Variable types, CSR can enter negative values

Production Data Examples

Tenant 1 (Delta) has 7 adjustment types configured:\
CS-500 (Fixed: 500 miles) - Quick service recovery\
CS-1000 (Fixed: 1000 miles) - Standard service recovery\
CS-2500 (Fixed: 2500 miles) - Significant service recovery\
GOODWILL (Fixed: 1000 miles) - Goodwill gesture\
CS-VAR (Variable) - Custom service credit amount\
PROMO (Variable) - Promotional credit\
CORRECT (Variable) - Points correction (positive or negative)

Member 2153442807 has 1 adjustment posted: +2,500 miles using CS-2500.

Integration with Molecule Point Buckets

Positive adjustments:\
- Find/create member_point_bucket using addPointsToMoleculeBucket()\
- Use point_expiration_rule based on activity_date and tenant_id\
- Create member_points molecule linking activity to bucket

Negative adjustments:\
- Consume points using FIFO logic (same as redemptions)\
- Query buckets from molecule_value_list ORDER BY col='E' (expire_date)\
- Update bucket column D (redeemed)\
- Validate sufficient points available\
- Create member_points molecules (negative amounts) linking to consumed buckets

Audit Trail

Every adjustment creates:\
- activity record with type='J' and point_amount (+ or -)\
- molecule_value_list row linking to adjustment_id\
- member_points molecules linking to buckets\
- Full attribution: who, what, when, how much\
- Adjustment type and reason visible in activity history

Use Case Examples

Missing Credit:\
- Flight didn\'t post properly\
- CSR selects CORRECT variable adjustment\
- Enters exact base miles that should have posted\
- System creates activity type=\'J\' with positive amount

Service Recovery:\
- Customer complaint about delayed flight\
- CSR selects CS-1000 fixed adjustment\
- Points auto-populate to 1000 miles\
- Customer receives immediate credit

Error Correction:\
- Duplicate activity posted in error\
- CSR selects CORRECT variable adjustment\
- Enters negative amount matching duplicate\
- System debits points using FIFO lot consumption

Promotional Credit:\
- Marketing campaign promises 5000 bonus miles\
- CSR selects PROMO variable adjustment\
- Enters 5000 miles\
- Customer receives promotional credit

Status: Fully implemented and operational. Complete CRUD admin interface, CSR workflow with Fixed/Variable types, positive/negative adjustments, integration with point lots, and full audit trail.

# 17. DISPLAY TEMPLATES

Dynamic UI rendering based on molecule configuration. Templates define how activities are displayed in member lists using a component-based syntax.

## Database Structure

**display_template table:**

```sql
display_template (
  tenant_id SMALLINT NOT NULL,
  activity_type CHAR(1) NOT NULL,
  template_type CHAR(1) NOT NULL,      -- 'E'=Efficient, 'V'=Verbose
  PRIMARY KEY (tenant_id, activity_type, template_type)
)
```

**display_template_line table:**

```sql
display_template_line (
  tenant_id SMALLINT NOT NULL,
  activity_type CHAR(1) NOT NULL,
  template_type CHAR(1) NOT NULL,
  line_number INTEGER NOT NULL,
  template_string TEXT NOT NULL,
  PRIMARY KEY (tenant_id, activity_type, template_type, line_number),
  FOREIGN KEY (tenant_id, activity_type, template_type) 
    REFERENCES display_template(tenant_id, activity_type, template_type)
)
```

**Design:** One template per (tenant, activity_type, template_type). No `is_active` flag - edit the one you have.

## Template Types

**Efficient (E):** Compact single-line format, typically codes and minimal info

**Verbose (V):** Detailed multi-line format with full descriptions

User can toggle between views. Each activity type (A, R, P, J, N) has exactly one of each.

## How Templates Are Created

Admin uses visual Line Builder in admin_activity_display_template_edit.html:

1\. Select activity type (A, R, P, J, N)

2\. Select template type (Efficient or Verbose)

3\. Click \"Add Line\" to open Line Builder modal

4\. Build line by adding components:

**Add Molecule:** Select molecule (carrier, origin, destination, etc.), format (Code/Description/Both), optional max length

**Add Text:** Enter literal text (\" - \", \" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \", etc.)

5\. Preview shows how line will render with sample data

6\. Save line - generates template_string

7\. Add more lines as needed

8\. Save template

## Template String Syntax

Components are encoded in template_string using bracket notation:

**Molecule component:**

\[M,molecule_key,\"format\",maxLength\] Examples: \[M,carrier,\"Code\"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"DL\" \[M,carrier,\"Description\"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Delta Air Lines\" \[M,carrier,\"Both\"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"DL Delta Air Lines\" \[M,carrier,\"Description\",20\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Delta Air Lines\" (truncated to 20 chars)

**Text component:**

\[T,\"literal text\"\] Examples: \[T,\" - \"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \" - \" \[T,\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \" \[T,\"Flight \"\] ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"Flight \"

**Complete line example:**

\[M,carrier,\"Code\"\]\[M,flight_number,\"Code\"\]\[T,\" from \"\],\[M,origin,\"Code\"\],\[T,\" to \"\],\[M,destination,\"Code\"\] Renders as: \"DL1234 from MSP to LAX\"

## How Templates Are Used in Activity Display

When member activity list loads:

1\. Server queries activities for member

2\. For each activity, loads display_template matching activity_type

3\. Loads both Efficient and Verbose templates

4\. Server\'s renderTemplate() function:

Decodes all molecules for activity (carrier, origin, destination, etc.)

Parses template_string lines

Replaces \[M,key,\"format\",max\] with decoded values

Replaces \[T,\"text\"\] with literal text

Returns magic_box_efficient and magic_box_verbose arrays

5\. Activity object includes:

magic_box_efficient: \[{label: \'Line 1\', value: \'DL1234 from MSP to LAX\'}\] magic_box_verbose: \[{label: \'Line 1\', value: \'Delta Air Lines\...\'}, \...\]

6\. UI (activity.html):

Checks viewType (efficient or verbose)

Uses magic_box_efficient or magic_box_verbose

Renders values with \<br\> between lines

Falls back to hardcoded format if no template exists

## Example: Flight Template

**Efficient template (1 line):**

Line 1: \[M,origin,\"Code\"\]\[T,\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"\],\[M,destination,\"Code\"\],\[T,\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ \"\],\[M,carrier,\"Code\"\],\[M,flight_number,\"Code\"\] Renders: \"MSP ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ BOS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ DL1234\"

**Verbose template (3 lines):**

Line 1: \[M,carrier,\"Both\"\],\[T,\" Flight \"\],\[M,flight_number,\"Code\"\] Line 2: \[M,origin,\"Both\"\],\[T,\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \"\],\[M,destination,\"Both\"\] Line 3: \[M,fare_class,\"Description\"\],\[T,\" Class\"\] Renders: \"DL Delta Air Lines Flight 1234\" \"MSP Minneapolis ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ BOS Boston\" \"First Class\"

## Key Benefits

**Industry-Agnostic:** Same template system works for flights, hotels, car rentals, credit card transactions

**No Code Changes:** Tenant can customize display without developer involvement

**Molecule-Based:** Automatically uses correct data source (lookup tables, lists, scalars)

**Per Activity Type:** Flights show routes, redemptions show awards, partners show program details

**Visual Builder:** Admin sees live preview while building templates

**Status:** Fully implemented and operational. Templates power activity displays in member lists with efficient/verbose toggle.

18\. PROMOTIONS

Promotions are the loyalty platform\'s most powerful engagement tool, enabling sophisticated multi-activity campaigns that drive member behavior through progressive goals, tier advancement, and targeted rewards.

Purpose and Power

Promotions differ fundamentally from bonuses in temporal scope and complexity. While bonuses evaluate and reward individual activities instantly, promotions track member progress across multiple activities over time to achieve goals. This enables:\
- Tier qualification and management\
- Progressive challenge campaigns\
- Referral and enrollment programs\
- VIP and invitation-only offers\
- Revenue-based qualification (MQD/spend tracking)\
- Gamification with unlock mechanics\
- Targeted retention and winback campaigns

Database Structure

promotion table:\
promotion_id (PK, INTEGER, GENERATED AS IDENTITY)\
tenant_id (FK, SMALLINT)\
promotion_code (VARCHAR(20), unique per tenant)\
promotion_name (VARCHAR(100))\
promotion_description (TEXT)\
start_date (DATE)\
end_date (DATE)\
is_active (BOOLEAN DEFAULT true)\
enrollment_type (CHAR(1): \'A\'=Auto-enroll, \'R\'=Restricted)\
allow_member_enrollment (BOOLEAN) \-- \"Raise your hand\" opt-in\
rule_id (FK to rule table) \-- Shared with bonus engine\
count_type (VARCHAR: \'flights\', \'miles\', \'enrollments\', \'mqd\')\
goal_amount (NUMERIC) \-- Target to reach\
reward_type (VARCHAR: \'points\', \'tier\', \'external\', \'enroll_promotion\')\
reward_amount (BIGINT) \-- For points rewards\
reward_tier_id (FK to tier_definition) \-- For tier rewards\
reward_promotion_id (FK to promotion) \-- For enrollment rewards\
process_limit_count (INTEGER, NULL=unlimited) \-- Max completions\
duration_type (VARCHAR: \'calendar\', \'virtual\')\
duration_end_date (DATE) \-- Fixed end date (calendar type)\
duration_days (INTEGER) \-- Days from qualify (virtual type)\

member_promotion table (enrollment and progress tracking):\
member_promotion_id (PK, BIGINT, GENERATED AS IDENTITY)\
member_id (FK, BIGINT)\
promotion_id (FK, INTEGER)\
tenant_id (FK, SMALLINT)\
enrolled_date (DATE) \-- When member joined promotion\
qualify_date (DATE, NULL until qualified) \-- When goal reached\
process_date (DATE, NULL until processed) \-- When reward delivered\
progress_counter (NUMERIC) \-- Current progress toward goal\
status (VARCHAR: \'enrolled\', \'qualified\', \'processed\')\
enrolled_by_user_id (INTEGER, NULL=auto) \-- CSR who manually enrolled\
qualified_by_user_id (INTEGER, NULL=auto) \-- CSR who manually qualified\

qualified_by_promotion_id (INTEGER, NULL=earned) \-- Which promotion earned tier (NULL=this one, non-NULL=cascaded)

Enrollment Types

Auto-Enroll (\'A\'):\
First qualifying activity automatically enrolls member. Creates member_promotion record on-the-fly with enrolled_date = activity_date. Most common for broad promotional campaigns.

Example: \"Fly 3 times in November\" - first November flight enrolls member.

Restricted (\'R\'):\
Member must be explicitly added to promotion. Prevents general visibility/participation. Enables targeted campaigns.

Enrollment methods:\
1. CSR manual enrollment\
2. Member \"raise your hand\" (if allow_member_enrollment=true)\
3. Reward from qualifying another promotion (enroll_promotion type)

Use cases:\
- VIP/invitation-only offers\
- Winback campaigns for lapsed high-value members\
- Corporate contract promotions\
- Service recovery exclusive offers

\"Raise Your Hand\" Variant:\
Restricted promotion with allow_member_enrollment=true. Member initiates enrollment via website/portal. Creates member_promotion record when member clicks \"Join This Promotion\". Different from auto-enroll (requires explicit opt-in) and CSR-only (member can self-enroll).

Count Types: What Gets Tracked

\'flights\' - Activity Count:\
Each qualifying activity increments progress_counter by 1. Example: \"Fly 3 times\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ goal_amount=3. Contribution_amount=1 for each flight.

\'miles\' - Point Amount:\
Each activity contributes its point_amount. Example: \"Fly 20,000 miles\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ goal_amount=20000. Contribution_amount=activity.point_amount (e.g., 1,200).

\'enrollments\' - Referral Counting:\
Counts members enrolled through referral/sponsorship. Example: \"Refer 5 friends\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ goal_amount=5. Tracks in member_promotion_detail.enrolled_member_id. No activity_id (enrollment isn\'t an activity).

\'mqd\' - Medallion Qualifying Dollars:\
Counts revenue/spend from activity.mqd field. Example: \"Spend \$10,000\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ goal_amount=10000. Enables revenue-based tier qualification (Delta 2025 model). Contribution_amount=activity.mqd.

Future Expansion:\
Will support molecule-based counting (any activity field/molecule). Not implemented yet, but architecture supports it.

Reward Types

\'points\' - Miles/Points Award:\
Creates activity type=\'M\' (Promotion) with point_amount. Activity posts immediately when promotion qualifies. qualify_date = process_date (instant reward). molecule_value_list stores member_promotion_id via insertActivityMolecule. Integrates with molecule point bucket system automatically. Full temporal audit trail.

\'tier\' - Status Advancement:\
Creates member_tier record linking to tier_definition. Start_date = qualify_date (or promotion start). End_date determined by duration_type:\
- calendar: Uses duration_end_date (e.g., Dec 31, 2025)\
- virtual: qualify_date + duration_days (e.g., +365 days)\
Overlapping tier periods resolved by tier_ranking. process_date = when card/kit/welcome package sent.

\'external\' - Certificates/Vouchers:\
Reward fulfilled outside platform. Examples: Companion pass, upgrade certificate, physical items. qualify_date = goal reached. process_date = when certificate/item sent or marked fulfilled. Manual fulfillment workflow.

\'enroll_promotion\' - Progressive Chains:\
Qualifying one promotion enrolls member in another (restricted) promotion. Enables stepping challenges and unlock mechanics. reward_promotion_id specifies which promotion to enroll in. Creates member_promotion record for target promotion. Powers gamification and VIP progression paths.

Example: Complete \"Fly 5 domestic\" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Unlocks \"Fly 10 international destinations\".

Repeatable Promotions and Carryover

Promotions can be completed multiple times if process_limit_count \> 1 or NULL (unlimited).

Carryover Logic:\
When activity exceeds current goal, excess \"carries over\" to next instance.

Example: \"Fly 20,000 miles\" promotion (repeatable)\
- Member at 19,000 miles progress\
- Posts 2,000-mile flight\
- First 1,000 miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ completes instance 1 (qualify_date set, reward awarded)\
- Remaining 1,000 miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ starts instance 2 (new member_promotion record created)\
- Same activity_id appears in TWO member_promotion_detail records

Key insight: One activity can contribute to multiple instances of same promotion.

process_limit_count Usage:\
- NULL = unlimited repeats (e.g., ongoing tier qualification)\
- 1 = single completion (e.g., one-time welcome bonus)\
- N = specific limit (e.g., \"qualify up to 5 times\")

Tier Management Through Promotions

Each tier = separate promotion (not special-cased code):

Example promotions:\
\"Silver Medallion - 20K Miles\": count_type=\'miles\', goal_amount=20000, reward_type=\'tier\', reward_tier_id=2\
\"Gold Medallion - 40K Miles\": count_type=\'miles\', goal_amount=40000, reward_type=\'tier\', reward_tier_id=3

Multiple pathways to same tier:\
Promotion A: \"20,000 miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold\"\
Promotion B: \"20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold\"

Both award same tier (tier_id=3), preventing duplicate fulfillment through cascade logic.

Tier Downgrades:\
Handled automatically through temporal design. When member_tier.end_date passes, get_member_tier_on_date() returns previous/base tier. No batch processing needed.

Why This Works:\
- Tier periods overlap, highest ranking wins (ORDER BY tier_ranking DESC)\
- Different qualification windows coexist naturally\
- Member keeps highest active tier on any given date\
- Temporal queries enable historical tier status for bonus evaluation

Tier Cascade Logic

Problem: Multiple paths to same tier ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ duplicate card/kit shipments.

Solution: When tier promotion qualifies, auto-qualify parallel pathways with same-or-shorter duration.

Database Support:

member_promotion table includes qualified_by_promotion_id field:

\- NULL = This promotion earned the tier (send fulfillment)

\- Non-NULL = Courtesy qualified via cascade (skip fulfillment)

Process:

1\. Member qualifies Promotion A (20K miles) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold tier (tier_id=3, end_date=2026-12-31)

2\. System creates member_tier record (the actual tier)

3\. System searches for other promotions:

\- reward_type = \'tier\'

\- reward_tier_id = 3 (exact match, Gold only)

\- member_promotion exists (enrolled) but qualify_date IS NULL

\- Calendar type: duration_end_date \<= 2026-12-31 (same or shorter)

\- Virtual type: duration_days \<= 365 (same or shorter)

4\. Auto-qualify found promotions:

\- Set qualify_date = NOW

\- Set process_date = NOW

\- Set qualified_by_promotion_id = Promotion A

\- Set status = \'processed\'

\- Do NOT create duplicate member_tier record

\- Do NOT trigger fulfillment

Result: Member\'s \"20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 6 months\" promotion marked qualified by the \"20K miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 12 months\" promotion. No duplicate tier card shipped.

Critical Rules:

\- Only same tier_id cascades (Gold doesn\'t cascade to Platinum)

\- Only same-or-shorter duration cascades (12-month doesn\'t cascade to 24-month)

\- Longer duration promotions can still qualify independently

\- qualified_by_promotion_id tracks attribution for fulfillment logic

Example Scenarios:

Scenario 1: Shorter Qualifies First (No Cascade)

Promotion A: \"20K miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 12 months\"

Promotion B: \"20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 24 months\"

Member earns 20K miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ A qualifies ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Creates tier ending 2026-11-23

Cascade checks B: end_date 2027-11-23 \> 2026-11-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ NO CASCADE

Member later hits 20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ B qualifies independently ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Extends tier to 2027-11-23

Result: Member gets TWO tier periods (B is longer duration, not redundant)

Scenario 2: Longer Qualifies First (Cascades)

Promotion A: \"20K miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 24 months\"

Promotion B: \"20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gold for 12 months\"

Member earns 20K miles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ A qualifies ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Creates tier ending 2027-11-23

Cascade checks B: end_date 2026-11-23 \< 2027-11-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ CASCADE!

Sets B.qualified_by_promotion_id = A

Member later hits 20 flights ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Nothing happens (already qualified)

# Result: Member gets ONE tier card from A (longer duration covers B)

Fulfillment Logic:

## Process tier card/kit shipments by querying:

SELECT \* FROM member_promotion

WHERE qualify_date IS NOT NULL

##  AND process_date IS NULL 

AND qualified_by_promotion_id IS NULL

AND reward_type = \'tier\'

Only promotions that earned the tier (not cascaded) trigger fulfillment.

## Tenant Selector Workflow

1\. User opens menu.html

2\. Page calls GET /v1/tenants to load dropdown

3\. User selects tenant from dropdown

4\. Selection stored in sessionStorage: tenant_id, tenant_name

5\. All subsequent API calls include ?tenant_id={id} parameter

6\. UI displays current tenant indicator throughout session

## Display Labels System

Each tenant has custom terminology via tenant_label molecule (e.g., \'Miles\' vs \'Points\' vs \'Credits\').

**Label loading:** lp-nav.js calls GET /v1/tenants/{id}/labels on page load, stores in window.LP_STATE.labels.

**Label replacement:** UI uses {currency_label} tokens in HTML, replaced by JavaScript: \'Miles to Redeem\', \'Points Required\', etc.

## Why Multi-Tenancy Matters

**Single Codebase:** One platform serves airlines, hotels, retail - no separate deployments

**Complete Isolation:** Delta can\'t see Marriott data, guaranteed by database architecture

**Industry Flexibility:** Airline uses origin/destination, hotel uses property/room_type - same molecule system

**Shared Innovation:** New features benefit all tenants immediately

# 19. MEMBER SEARCH & ENROLLMENT

CSR tools for finding members and creating new enrollments.

## Member Search Methods

**Quick Path - Member Number:** Enter membership number, click Search. Single exact match.

**Attribute Search - Multiple Fields:**

First Name (partial match, case-insensitive)

Last Name (partial match, case-insensitive)

Email (partial match)

Phone (partial match)

All fields combined with AND logic - narrows results

## Search Results Display

Results shown in table with columns: Name, Membership #, Email, Phone, Tier, Actions.

**Actions:**

**View Profile:** Opens profile.html?memberId={id}

**View Activity:** Opens activity.html?memberId={id}

## Member Enrollment (New Member Creation)

Form captures required information to create new loyalty program member.

**Required fields:**

First Name, Last Name

Email (validated format)

Date of Birth

**Optional fields:** Phone, Address (street, city, state, zip), Gender

## Membership Number Generation

Server generates unique membership number on enrollment:

Format: {tenant_prefix}{random_6_digits} Example: DL847293, MR523841, GY291847 Logic: 1. Get tenant prefix from tenant table 2. Generate random 6-digit number 3. Check uniqueness in member table 4. Retry if collision (rare) 5. Store in member.membership_number

## Member Record Creation

POST /v1/members creates:

member record with generated membership_number

member_detail records for optional molecules (phone, address, gender via molecule system)

Initial tier assignment (typically base tier)

Zero point balance (no initial lot until first activity)

## Post-Enrollment Flow

1\. Confirmation shown with new membership number

2\. CSR can immediately navigate to member profile

3\. Member appears in searches

4\. Ready for activity posting

# 20. CSR vs ADMIN TOOLS

Two distinct interfaces serve different user roles with different permissions and workflows.

## CSR Tools (Customer Service Representative)

**Purpose:** Day-to-day member service operations. Look up members, view accounts, post activities, process redemptions.

**Entry point:** csr.html - Member search is landing page

**Key pages:**

**csr.html:** Member search by number or attributes

**profile.html:** Member demographics, contact info, tier status

**activity.html:** Transaction history with bonuses, efficient/verbose toggle

**add_activity.html:** Post new flight/partner activity

**add_redemption.html:** Process award redemption with FIFO point consumption

**point-summary.html:** Point lot breakdown, expiration dates

**promotions.html:** Member-specific bonus history

**tier.html:** Tier qualification status and benefits

**Navigation:** Sidebar nav requires memberId in URL params for member-specific pages. Member header shows at top of all member pages.

## Admin Tools (Client Administrator)

**Purpose:** Program configuration, business rules, reference data management. No member-level access.

**Entry point:** admin.html - Overview dashboard

**Key pages:**

**admin_molecules.html:** Configure program molecules (lookup/list/scalar)

**admin_bonuses.html:** Bonus rule management, criteria builder

**admin_redemptions.html:** Redemption option catalog (fixed/variable)

**admin_carriers.html:** Airline/partner carrier codes and names

**admin_airports.html:** Airport codes and city names

**admin_tiers.html:** Tier definitions, qualification rules, benefits

**admin_activity_display_templates.html:** Display template configuration (efficient/verbose)

**Navigation:** Sidebar nav shows configuration categories, no member context needed.

## Access Patterns

**CSR ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Admin:** CSRs should NOT have admin access. Prevents accidental rule changes during member service.

**Admin ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ CSR:** Admins may have CSR access for testing, but typically use separate roles.

**In menu.html:** Both options shown for demo purposes. Production would enforce role-based access control.

# 21. NAVIGATION SYSTEM

Unified navigation system (lp-nav.js) provides consistent sidebar navigation across CSR and Admin tools.

## Core Architecture

**Single source of truth:** lp-nav.js defines all navigation structures.

**Auto-detection:** Page type detected from filename (csr.html ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ CSR nav, admin\_\*.html ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Admin nav).

**Dynamic rendering:** Injects nav HTML into #nav-container div on every page.

## Navigation Configurations

**CSR Navigation:**

{ icon: \'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â\', label: \'Search\', href: \'csr.html\' } { icon: \'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â \', label: \'Activity\', href: \'activity.html\', needsMemberId: true } { icon: \'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â°\', label: \'{currency_label} Summary\', href: \'point-summary.html\', needsMemberId: true } \...

**Admin Navigation:**

{ icon: \'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â¬\', label: \'Program Molecules\', href: \'admin_molecules.html\' } { icon: \'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â\', label: \'Bonuses\', href: \'admin_bonuses.html\' } { icon: \'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â­Ãƒâ€šÃ‚Â\', label: \'Tiers\', href: \'admin_tiers.html\' } \...

## Member Context Handling

Member-specific pages (activity, profile, etc.) require memberId in URL:

needsMemberId: true flag in nav config

Nav system checks URL params for memberId

Appends ?memberId={id} to all member-context nav links

Maintains member context through navigation

## Admin Navigation Organization (Updated 2025-12-11)

```
Program Configuration:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ System Parameters      (admin_sysparm.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Molecules              (admin_molecules.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Composites             (admin_composites.html)

Templates:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Input Templates        (admin_input_templates.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Display Templates      (admin_display_templates.html)

Program Rules:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Bonuses                (admin_bonuses.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Promotions             (admin_promotions.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Tiers                  (admin_tiers.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Redemptions            (admin_redemptions.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Adjustments            (admin_adjustments.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Partners               (admin_partners.html)

Reference Data:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Carriers               (admin_carriers.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Airports               (admin_airports.html)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Expiration Rules       (admin_expiration.html)
```

**Rationale:**
- Program Configuration: Foundation (defines WHAT the program tracks)
- Templates: UI layer (defines HOW data is entered/displayed)
- Program Rules: Business logic (defines HOW program behaves)
- Reference Data: Lookup tables (populate dropdowns)

## Label Token System

Nav labels can include tokens like {currency_label} for tenant-specific terminology:

On page load: loadLabels(tenantId) fetches display labels from API

Stores in window.LP_STATE.labels

replaceTokens() function replaces {currency_label} with \'Miles\' or \'Points\'

Nav items dynamically show correct terminology

## Active Page Highlighting

Current page highlighted in navigation:

Compares window.location.pathname to nav item hrefs

Adds \'active\' CSS class to current page

Visual indicator helps user know where they are

## Global State Management

window.LP_STATE = { apiBase: \'http://127.0.0.1:4001\', version: \'1.0.0\', tenantId: 1, labels: {} // Loaded display labels };

All pages can access LP_STATE for consistent API base URL, tenant context, and display labels.

# 22. LOOKUP TABLE MANAGEMENT

Reference data tables managed by admins that feed molecule lookups.

## Airlines (Carriers)

**Table:** airline (airline_id, tenant_id, code, name, is_active)

**Admin page:** admin_carriers.html - List with add/edit/delete

**Usage:** carrier molecule (lookup type) references airline table. Activities store carrier_id, display as \'DL\' or \'Delta Air Lines\' via molecule.

**Examples:** DL=Delta Air Lines, AA=American Airlines, UA=United Airlines

## Airports

**Table:** airport (airport_id, tenant_id, code, city_name, is_active)

**Admin page:** admin_airports.html - List with add/edit/delete

**Usage:** origin and destination molecules (lookup type) reference airport table. Flight activities store origin_id/destination_id, display as \'MSP\' or \'Minneapolis\' via molecule.

**Examples:** MSP=Minneapolis, LAX=Los Angeles, JFK=New York JFK

## How Lookups Feed Molecules

1\. Admin creates lookup record (e.g., airline with code=\'DL\', name=\'Delta Air Lines\')

2\. Molecule definition points to lookup table via molecule_value_lookup

3\. UI dropdowns populated from lookup table: GET /v1/molecules/get/carrier returns all airlines

4\. Activity stores airline_id as v_ref_id in activity_detail

5\. Display template uses \[M,carrier,\"Both\"\] to show \'DL Delta Air Lines\'

## CRUD Operations

**List view:** admin_carriers.html, admin_airports.html show all records for tenant in table

**Create:** Click \'+ Add New\', fill form (code, name), POST /v1/airlines or /v1/airports

**Edit:** Click \'Edit\' button, modify fields, PUT /v1/airlines/{id} or /v1/airports/{id}

**Delete:** Click \'Delete\', confirm, DELETE /v1/airlines/{id} or /v1/airports/{id}

## Tenant Isolation

All lookup tables include tenant_id. Delta\'s carrier list is separate from Marriott\'s partner list. Same molecule system, different data.

## Why Lookup Management Matters

**No Hardcoding:** Carriers and airports aren\'t in code, they\'re in database

**Self-Service:** Client admin can add new carriers without developer

**Data Quality:** Centralized reference data ensures consistency

**Industry Flexibility:** Hotels use property codes, retailers use store numbers - same pattern

# 23. TIER PROGRESSION MECHANICS

Member tier advancement based on qualification criteria and temporal evaluation.

## Tier Definition Structure

**tier_def table:**

tier_id (PK) tenant_id (FK) tier_code (VARCHAR, e.g., \'SILVER\', \'GOLD\', \'PLAT\') tier_name (VARCHAR, e.g., \'Silver Elite\') tier_rank (INT, 1=lowest, higher=better) qualification_points (INT, minimum points needed) qualification_segments (INT, minimum segments needed) is_active (BOOLEAN) created_at, updated_at

**member.tier_id:** Current tier foreign key on member record.

## Tier Qualification Logic

Member qualifies for tier if they meet ALL requirements (typically within qualification period):

**Points threshold:** Earned points \>= qualification_points

**Segment threshold:** Flight segments \>= qualification_segments

**Time period:** Activity within qualification window (e.g., calendar year, rolling 12 months)

**Example tiers:**

Base (rank 1): 0 points, 0 segments Silver (rank 2): 25,000 points OR 25 segments Gold (rank 3): 50,000 points OR 50 segments Platinum (rank 4): 75,000 points OR 75 segments Diamond (rank 5): 125,000 points OR 100 segments

## Temporal Tier Evaluation

member_tier molecule uses date parameter for temporal qualification:

Bonus rules can check member tier as of specific date

getMoleculeValue(tenantId, \'member_tier\', {member_id: 123}, \'2025-06-01\')

Returns tier member held on that date, not current tier

Enables retroactive bonus evaluation

## Tier Benefits

Benefits stored in tier_benefit table or configured via bonus rules:

**Earning bonuses:** Gold members earn 25% bonus miles

**Upgrade priority:** Platinum gets first upgrade opportunities

**Bonus miles:** Diamond earns 100K status bonus annually

**Service perks:** Lounge access, free baggage, priority boarding

## Tier Advancement Flow

1\. Member earns activity (flight, points)

2\. Points accumulate, segments increment

3\. System checks qualification: SELECT \* FROM tier_def WHERE qualification_points \<= {earned} ORDER BY tier_rank DESC LIMIT 1

4\. If higher tier qualified, UPDATE member SET tier_id = {new_tier}

5\. Tier change notification (future: email, SMS)

6\. New tier benefits apply immediately

## Admin Tier Management

**admin_tiers.html:** List all tiers, create/edit tier definitions, set qualification thresholds, configure benefits.

# 24. TESTING ARCHITECTURE

Test rig enables bonus rule testing without database writes.

## Test Rig Concept

When creating/editing bonus rules, admins need to test: \'If I have this rule with these criteria, will it trigger for this activity?\' Test rig provides instant feedback without posting test activities to member accounts.

## Test Button in Bonus Edit

**Location:** admin_bonus_edit.html, button next to Save

**Action:** Opens test modal with activity simulator

**Workflow:**

1\. Admin clicks \'Test Rule\'

2\. Modal shows form to enter test activity details

3\. Admin fills in carrier, origin, destination, fare class, etc.

4\. Clicks \'Run Test\'

5\. System evaluates rule against test data

6\. Results show: Match or No Match, with criteria evaluation details

## Test Endpoint

**POST /v1/test/bonus_rule:**

Request body: { rule: { /\* unsaved bonus rule definition \*/ }, criteria: \[ /\* criteria array \*/ \], test_activity: { carrier_id: 1, origin_id: 5, destination_id: 12, fare_class: \'J\', member_id: 999 // Optional test member } } Response: { matched: true, criteria_results: \[ {criterion_id: 1, molecule_key: \'carrier\', matched: true}, {criterion_id: 2, molecule_key: \'origin\', matched: false} \], bonus_awarded: 500 }

## No Database Impact

Test execution is entirely in-memory:

No activity record created

No points awarded

No member account touched

Rule evaluation logic same as production, just no persistence

## Why Testing Matters

**Confidence:** Admin knows rule works before activating

**Debugging:** See exactly which criteria matched/failed

**Safety:** No risk of accidentally awarding points during testing

**Speed:** Instant feedback, iterate quickly on rule configuration

# 25. BASE POINT ACCRUAL

How activities generate base points before bonus evaluation.

## Base Points Concept

Every activity has base point_amount before bonuses. Example: Flight DL1234 MSP-LAX earns 1,500 base miles. Then bonus rules add: 150 elite bonus (10%), 300 fare class bonus (20%), 50 origin bonus. Total: 1,500 + 500 = 2,000 miles.

## Base Points Calculation Methods

**Flight activities (type \'A\'):**

**Distance-based:** Calculate air miles between airports (haversine formula), multiply by fare class modifier. First class = 1.5x, Business = 1.25x, Economy = 1.0x

**Fixed per segment:** 500 miles per flight regardless of distance

**Ticket price based:** \$1 spent = 5 miles (common for revenue-based programs)

**Manual entry:** CSR enters base miles directly (for irregular situations)

**Partner activities (type \'P\'):**

Fixed from partner_program.fixed_points

Variable: CSR enters points reported by partner

## Activity Posting Flow

1\. CSR opens add_activity.html?memberId={id}

2\. Selects activity type (Flight, Partner, Adjustment)

3\. Enters activity details via molecule-driven form

4\. Enters or auto-calculates base points

5\. POST /v1/members/:memberId/accruals

6\. Server creates activity record with point_amount

7\. Server stores activity molecules in molecule_value_list

8\. Server creates/updates member_point_bucket molecule

9\. Server creates member_points molecule linking activity to bucket

10\. Bonus engine evaluates all active rules

11\. Creates bonus activities (type 'N') for matched rules

12\. Returns success with activity_id

## Point Bucket Creation (Molecule System)

When activity posts with point_amount > 0:

1. Find expiration rule by activity_date and tenant_id
2. Call findOrCreatePointBucket(memberId, ruleId, expireDate, tenantId)
3. Search molecule_value_list for existing bucket (matching rule_id and expire_date)
4. If not found, create 4 rows: col A (rule_id), C (accrued=0), D (redeemed=0), E (expire_date_int)
5. Update col C (accrued) += point_amount
6. Create member_points molecule on activity: col A (bucket_row_num), col B (amount)

**Expiration calculation:** Activity date ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ lookup point_expiration_rule ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ get expiration_date (e.g., activity 2025-01-15 with rule R2025 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ expire_date = 2027-12-31).

## Adjustment Activities (type \'J\')

Manual corrections by CSR for:

Missing mileage credit

Goodwill gestures

Service recovery

Correction of errors

Can be positive (award points) or negative (deduct points). No bonus evaluation - just base points as entered.

# 26. TROUBLESHOOTING

(To be populated from additional learnings files)

Common failure patterns, debugging approaches, and recovery procedures.

  ----------------------------------------------------------------------------------------------------------------
  Bill Says                                 Meaning                              Your Response
  ----------------------------------------- ------------------------------------ ---------------------------------
  \"stop!\"                                 You\'re going down wrong path        Pause immediately, listen

  \"NO!\"                                   Fundamental misunderstanding         Stop and reconsider approach

  \"why are you asking this?\"              Answer should be obvious from data   Check schema/molecules

  \"shouldn\'t this come from molecule?\"   You\'re hardcoding                   Read from database instead

  \"b\"                                     Just scrolling, continue             Keep waiting

  ALL CAPS                                  Extreme frustration                  Stop defending, fix immediately

  Swearing                                  Serious mistake                      Don\'t defend, fix right away
  ----------------------------------------------------------------------------------------------------------------

# 27. COMPOSITE SYSTEM

*Implemented: 2025-12-15 (designed 2025-12-11)*

The Composite System is the architectural foundation that enables true multi-industry capability. A composite defines which molecules make up an activity type - the contract that drives both UI forms and server-side processing.

## Implementation Status

- âœ… `composite` and `composite_detail` tables created
- âœ… Composites cached at server startup
- âœ… Composite validation in production accruals endpoint
- âœ… `createAccrualActivity()` loops through composite.details (no hardcoded molecules)
- âš ï¸ `member_points` still handled separately for bucket logic (see note below)

## The Problem Composites Solve

**Before Composites:**
```javascript
// Hardcoded in createAccrualActivity - AIRLINE ONLY
const { carrier, origin, destination, flight_number, fare_class, mqd } = payload;
```

This hardcoding means:
- Adding a molecule requires code changes
- Different industries require different code paths
- Violates "data drives behavior" principle

**With Composites:**
```javascript
// Generic - works for ANY industry
const composite = cache.get(`composite:${tenantId}:${activityType}`);
for (const field of composite) {
  await encodeMolecule(tenantId, field.molecule_key, payload[field.molecule_key]);
}
```

Same code serves airlines, hotels, retail, gyms - composite defines the contract.

## Database Structure

**composite (header):**
```sql
composite (
  link SMALLINT PRIMARY KEY,           -- via link_tank
  tenant_id SMALLINT NOT NULL,
  composite_type CHAR(1) NOT NULL,     -- 'A', 'P', 'J', 'M' (future)
  description VARCHAR(100),
  validate_function VARCHAR(100),      -- optional whole-composite validation
  UNIQUE (tenant_id, composite_type)
)
```

**composite_detail (molecules in the composite):**
```sql
composite_detail (
  link SMALLINT PRIMARY KEY,           -- via link_tank
  p_link SMALLINT NOT NULL REFERENCES composite(link),
  molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
  is_required BOOLEAN DEFAULT false,
  is_calculated BOOLEAN DEFAULT false,
  calc_function VARCHAR(100),          -- e.g., 'calculateFlightMiles', 'selectAircraftType'
  sort_order SMALLINT NOT NULL,
  UNIQUE (p_link, molecule_id)
)
```

## Key Design Principles

### One Composite Per (Tenant, Type)

Each tenant has exactly ONE composite per activity type. No multiple versions to choose from.

| tenant_id | composite_type | description |
|-----------|----------------|-------------|
| 1 | A | Delta Flight Activity |
| 1 | P | Delta Partner Activity |
| 1 | J | Delta Adjustment |
| 2 | A | Marriott Stay Activity |

### Business Logic Lives in Composite

**Composite owns:**
- `is_required` - validation rules
- `is_calculated` - server computes (not from client)
- `calc_function` - which function to call
- `sort_order` - processing order (important when one calc depends on another)

**Template inherits from composite** - no duplicate business rules.

### Points Are Just Another Molecule

Points (`member_points`) follow the same composite definition pattern as other molecules. If the composite includes the points molecule, the system does bucket logic. If not, activity is logged without points.

```
-- Airline: has points
composite_type='A', molecule_id=38 (member_points), is_calculated=true, calc_function='calculateFlightMiles'

-- Gym tracking: no points, just logs visits
composite_type='A' with NO member_points molecule
```

**Current Implementation Note:** While `member_points` is defined in the composite like other molecules, it currently requires separate handling in `createAccrualActivity()` for bucket logic:
- Skipped in the main molecule encoding loop
- Bucket creation/update handled after other molecules
- Maps `base_points` payload key to `member_points` molecule

This is pragmatic - bucket logic (find/create bucket, update accrued, link activity) is inherently different from simple encode-and-store. The composite still controls whether points processing happens at all.

### Calculated vs Enterable

| is_calculated | Meaning | Client | Server |
|---------------|---------|--------|--------|
| false | User enters value | Sends in payload | Uses payload value |
| true | Server computes | Does NOT send | Calls calc_function |

Template renders calculated fields as readonly (yellow, locked icon) but doesn't duplicate the business rule.

## Example Composite: Airline Flight (Type A)

```
composite: link=1, tenant_id=1, composite_type='A', description='Delta Flight Activity'

composite_detail:
| link | p_link | molecule_id | molecule_key* | is_required | is_calculated | calc_function | sort_order |
|------|--------|-------------|---------------|-------------|---------------|---------------|------------|
| 1 | 1 | 1 | carrier | true | false | null | 1 |
| 2 | 1 | 5 | flight_number | false | false | null | 2 |
| 3 | 1 | 4 | fare_class | true | false | null | 3 |
| 4 | 1 | 3 | origin | true | false | null | 4 |
| 5 | 1 | 2 | destination | true | false | null | 5 |
| 6 | 1 | 37 | mqd | false | false | null | 6 |
| 7 | 1 | 47 | aircraft_type | false | true | selectAircraftType | 8 |
| 8 | 1 | 38 | member_points | true | true | calculateFlightMiles | 7 |

*molecule_key shown for clarity - actual FK is molecule_id
```

Note: `sort_order` matters - `calculateFlightMiles` (order 7) runs before `selectAircraftType` (order 8) because aircraft selection needs the calculated miles.

## Example Composite: Hotel Stay (Type A for Hotel Tenant)

```
composite: link=10, tenant_id=2, composite_type='A', description='Marriott Stay Activity'

composite_detail:
| link | molecule_key* | is_required | is_calculated | calc_function |
|------|---------------|-------------|---------------|---------------|
| 10 | property | true | false | null |
| 11 | room_type | true | false | null |
| 12 | nights | true | false | null |
| 13 | rate | false | false | null |
| 14 | member_points | true | true | calculateStayPoints |
```

Same `createActivity` function, different composite, different industry.

## Processing Flow

```
createActivity(memberLink, payload, tenantId, activityType):

1. GET COMPOSITE FROM CACHE
   composite = cache.get(`composite:${tenantId}:${activityType}`)

2. VALIDATE REQUIRED FIELDS
   for field in composite where is_required=true and is_calculated=false:
     if payload[field.molecule_key] is missing:
       return error "Missing required field: {molecule_key}"

3. PROCESS MOLECULES (in sort_order)
   for field in composite ORDER BY sort_order:
     if field.is_calculated:
       value = call field.calc_function(context)
     else:
       value = payload[field.molecule_key]
     
     encoded = encodeMolecule(tenantId, field.molecule_key, value)
     insertActivityMolecule(activityLink, field.molecule_id, encoded)

4. HANDLE POINTS (if member_points in composite)
   if composite has member_points molecule:
     do bucket logic (findOrCreatePointBucket, saveActivityPoints)
   else:
     skip points entirely

5. EVALUATE BONUSES (if applicable)
   evaluateBonuses(activityLink)
```

## Caching Strategy

Composites are cached at server startup and invalidated on save:

```javascript
caches.composite = new Map();  // key: 'tenantId:compositeType' Ã¢â€ â€™ composite with details

// On startup
const composites = await loadAllComposites();
for (const c of composites) {
  caches.composite.set(`${c.tenant_id}:${c.composite_type}`, c);
}

// On composite save
function invalidateCompositeCache(tenantId, compositeType) {
  caches.composite.delete(`${tenantId}:${compositeType}`);
  // Reload
  const fresh = await loadComposite(tenantId, compositeType);
  caches.composite.set(`${tenantId}:${compositeType}`, fresh);
}
```

Cache lookup is nanoseconds - no performance impact vs hardcoded.

## Relationship to Input Templates

**Composite** = Business contract (what molecules, required, calculated)
**Input Template** = UI layout (rows, columns, widths, labels)

Template references composite:
```sql
input_template_field (
  ...
  composite_link SMALLINT REFERENCES composite_detail(link),
  row_number INTEGER,
  start_position SMALLINT,
  display_width SMALLINT,
  display_label VARCHAR(100)
)
```

Template field dropdown is filtered by composite - can only add molecules that exist in the composite for that activity type.

## Admin Interface

**Navigation:**
```
Program Configuration:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ System Parameters
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Molecules
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Composites          Ã¢â€ Â NEW

Templates:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Input Templates
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Display Templates
```

**admin_composites.html:**
- List composites by tenant
- One row per activity type
- Show molecule count
- Edit button

**admin_composite_edit.html:**
- Header: description, validate_function
- Detail grid: molecule dropdown, is_required, is_calculated, calc_function, sort_order
- Add/remove molecules
- Drag to reorder (updates sort_order)
- "Prime from Template" button (migration helper)

## Migration Path

1. Create `composite` and `composite_detail` tables
2. Run migration script to prime from existing `input_template_field` data
3. Add `composite_link` to `input_template_field`
4. Update template editor to reference composite
5. Refactor `createAccrualActivity` Ã¢â€ â€™ generic `createActivity`
6. Add composite to cache system
7. Test all activity types

## Why This Matters

This is the last structural refactor. After composites:

- New industry = new tenant + new composite data
- New molecule on flights = add to composite, optionally to template
- Same code serves all industries
- "Million Years Ago" philosophy realized

**The code becomes truly generic. The industry lives in the data.**

# 28. INPUT TEMPLATES

*Updated: 2025-12-11 - Now references Composite System*

Input templates define the UI layout for activity entry forms. They reference the composite (Section 27) which defines business rules.

## Database Structure

**input_template (header):**
```sql
input_template (
  template_id INTEGER PRIMARY KEY,
  tenant_id SMALLINT NOT NULL,
  activity_type CHAR(1) NOT NULL,
  template_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  UNIQUE (tenant_id, activity_type)  -- One template per activity type
)
```

**input_template_field (layout details):**
```sql
input_template_field (
  field_id INTEGER PRIMARY KEY,
  template_id INTEGER REFERENCES input_template(template_id),
  composite_link SMALLINT REFERENCES composite_detail(link),  -- Links to composite
  row_number INTEGER NOT NULL,
  start_position SMALLINT NOT NULL,     -- 1-100 grid position
  display_width SMALLINT NOT NULL,      -- 1-100 columns
  field_width SMALLINT,                 -- character width (NULL = auto)
  display_label VARCHAR(100),           -- override label (NULL = use molecule)
  sort_order SMALLINT NOT NULL
)
```

## Separation of Concerns

**From Composite (business rules):**
- `molecule_id` - which field
- `is_required` - validation (shows asterisk)
- `is_calculated` - readonly display (yellow, locked)
- `calc_function` - what to call

**From Template (UI layout):**
- `row_number` - which row
- `start_position` - where on 100-column grid
- `display_width` - how wide
- `display_label` - custom label override

## 100-Column Grid System

Fields are positioned on a 100-column grid for precise layout:

```
start_position: 1-100 (where field begins)
display_width: 1-100 (how many columns it spans)

Example row:
| Carrier (1-33) | Flight # (34-50) | Class (51-100) |
```

Benefits:
- Works on any screen width (responsive)
- Precise control without percentage math
- Visual ruler in editor shows positions

## Template Editor

**admin_input_template_edit.html:**

1. Select activity type (filtered by tenant)
2. View 100-column grid preview
3. Add/edit fields via modal:
   - Molecule dropdown (filtered by composite)
   - Start position (1-100)
   - Display width (1-100)
   - Custom label (optional)
4. Drag rows to reorder
5. Visual preview updates live

**Key constraint:** Can only add molecules that exist in the composite for that activity type. Dropdown is filtered.

## Rendering Flow

```javascript
// template-form-renderer.js

1. Load template for activity_type
2. Load composite for business rules
3. For each field:
   - Get molecule from composite (is_required, is_calculated)
   - Get layout from template (row, position, width)
   - If is_calculated: render readonly (yellow, Ã°Å¸â€â€™ auto)
   - If is_required: show asterisk
   - Position on grid
4. Initialize dropdowns, typeaheads
5. Wire up calculated field listeners
```

## Calculated Fields in UI

When composite marks a field as `is_calculated=true`:

1. Template renders as readonly input (yellow background, Ã°Å¸â€â€™ icon)
2. Label shows "auto" indicator
3. Value populated by client-side function matching `calc_function`
4. Not sent to server - server recalculates

Example: Aircraft Type
- Composite: `is_calculated=true, calc_function='selectAircraftType'`
- Template: shows readonly field
- Client: calls `selectAircraftType(miles)` when origin/destination change
- Server: calls same function during `createActivity`

## Admin Navigation

```
Templates:
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Input Templates      Ã¢â€ Â This section
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Display Templates    Ã¢â€ Â Section 17
```

Input templates define data entry. Display templates define data viewing. Both reference molecules; input templates also reference composites.

# 29. MEMBER ALIASES

*Implemented: 2025-12-17*

Member aliases enable alternate account numbers from partner programs, coalition airlines, or legacy systems to resolve to a canonical member record. This supports scenarios like credit card program lookups, airline alliance member identification, and system migrations.

## Use Cases

**Partner Program Numbers:** Member has a Marriott Bonvoy number that should resolve to their airline loyalty account when Marriott sends earning files.

**Coalition Airlines:** SkyTeam partner airlines (Air France, KLM, Korean Air) have their own member numbers that map to Delta SkyMiles members.

**Legacy System Migration:** Old member numbers from a previous loyalty platform need to resolve to new system records.

**Credit Card Linkage:** Co-branded credit card account numbers tied to loyalty members.

## Database Structure

**alias_composite (alias type definitions):**
```sql
alias_composite (
  link SMALLINT PRIMARY KEY,
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id),
  composite_code VARCHAR(20) NOT NULL,
  composite_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (tenant_id, composite_code)
)
```

Examples: "Partner Aliases", "Coalition Carrier Aliases", "Legacy System Aliases"

**alias_composite_detail (molecules per alias type):**
```sql
alias_composite_detail (
  link SMALLINT PRIMARY KEY,
  p_link SMALLINT NOT NULL REFERENCES alias_composite(link) ON DELETE CASCADE,
  molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
  is_required BOOLEAN DEFAULT false,
  is_key BOOLEAN DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (p_link, molecule_id)
)
```

Defines which molecules (carrier, partner) can serve as key discriminators for each alias type. `is_key=true` marks the molecule as a uniqueness participant.

**member_alias (actual alias records):**
```sql
member_alias (
  link CHAR(5) PRIMARY KEY,
  p_link CHAR(5) NOT NULL REFERENCES member(link),
  alias_type_link SMALLINT NOT NULL REFERENCES alias_composite(link),
  alias_value VARCHAR(50) NOT NULL,
  key_molecule_id INTEGER REFERENCES molecule_def(molecule_id),
  key_ref SMALLINT,
  tenant_id SMALLINT NOT NULL REFERENCES tenant(tenant_id)
)
```

**Key columns:**
- `p_link`: The canonical member this alias resolves to
- `alias_type_link`: Which alias category (Partner, Coalition, etc.)
- `alias_value`: The external account number
- `key_molecule_id`: Which molecule type discriminates (carrier_id vs partner_id)
- `key_ref`: The specific value (carrier_id=5 for American Airlines)

**Uniqueness constraint:**
```sql
CREATE UNIQUE INDEX idx_member_alias_unique 
  ON member_alias(tenant_id, alias_type_link, COALESCE(key_molecule_id, 0), COALESCE(key_ref, 0), alias_value);
```

This ensures the same alias value can exist for different sources (AA-12345 for American Airlines vs AA-12345 for different meaning in another context).

## Why key_molecule_id Matters

The same `key_ref` value (e.g., 5) could mean different things:
- carrier_id=5 might be American Airlines
- partner_id=5 might be Marriott

Without `key_molecule_id`, the system couldn't distinguish between "American Airlines member 12345" and "Marriott member 12345" if both happened to have key_ref=5.

**Example records:**
```
| alias_value | key_molecule_id | key_ref | Meaning |
|-------------|-----------------|---------|---------|
| AA12345678  | 1 (carrier)     | 5 (AA)  | American Airlines member |
| 98765432    | 30 (partner)    | 2 (MAR) | Marriott Bonvoy member |
```

## CSR Workflow

**Adding an Alias:**
1. Navigate to member's profile → Aliases tab
2. Click "+ Add Alias"
3. Select alias type (Partner Aliases, Coalition Carriers, etc.)
4. Select source type (Carrier, Partner) - dropdown filtered by alias_composite_detail
5. Select specific source (American Airlines, Marriott, etc.)
6. Enter alias value (external account number)
7. Save

**Viewing Aliases:**
- Aliases tab shows table with Type, Source, Alias Number, Actions
- Source column shows decoded value (e.g., "AA - American Airlines")
- Delete button removes alias with confirmation

## Admin Configuration

**admin_alias_composites.html:**
- List all alias types for tenant
- Show source molecule count per type
- Create/edit/delete alias types

**admin_alias_composite_edit.html:**
- Edit alias type name and code
- Configure which source molecules are available
- Carrier and Partner are common choices
- Toggle is_key for uniqueness participation

## API Endpoints

```
GET  /v1/alias-composites?tenant_id={id}
     List all alias types for tenant

GET  /v1/alias-composites/:link?tenant_id={id}
     Get single alias type with molecules

POST /v1/alias-composites
     Create alias type with detail rows

PUT  /v1/alias-composites/:link
     Update alias type and molecules

DELETE /v1/alias-composites/:link?tenant_id={id}
     Delete alias type (cascades to details)

GET  /v1/members/_/aliases?tenant_id={id}&membership_number={num}
     List member's aliases (uses membership_number for reliable lookup)

POST /v1/members/_/aliases
     Add alias to member
     Body: { tenant_id, alias_type_link, alias_value, key_molecule_id, key_ref, molecule_key, membership_number }

DELETE /v1/members/_/aliases/:aliasLink?tenant_id={id}&membership_number={num}
     Remove alias from member

GET  /v1/alias-search?tenant_id={id}&alias_value={value}
     Find member by alias value (for incoming partner files)
```

**Note:** Member alias endpoints use `membership_number` query parameter instead of binary link in URL path to avoid encoding issues.

## Alias Search (Reverse Lookup)

When processing incoming partner earning files, the system needs to find members by external account numbers:

```sql
SELECT m.membership_number, m.fname, m.lname, ma.alias_value
FROM member_alias ma
JOIN member m ON ma.p_link = m.link
WHERE ma.tenant_id = $1 
  AND ma.alias_value = $2
  AND (ma.key_molecule_id = $3 OR $3 IS NULL)
  AND (ma.key_ref = $4 OR $4 IS NULL)
```

Optional key_molecule_id and key_ref parameters allow searching within a specific source context.

## Integration with Partner System

Partners defined in Section 15 serve dual purposes:
1. **Activity attribution:** Partner activities store partner_id to show which partner earned points
2. **Alias source:** Partner molecule serves as key discriminator for member aliases

This allows a member to have a Marriott Bonvoy number stored as an alias, and when Marriott sends an earning file with that number, the system resolves it to the correct member for posting a Partner activity.

## Data Model Visualization

```
alias_composite (Partner Aliases)
    │
    ├── alias_composite_detail (carrier molecule)
    │       └── is_key: true
    │
    └── alias_composite_detail (partner molecule)
            └── is_key: true

member_alias
    ├── alias_type_link → alias_composite
    ├── p_link → member (canonical)
    ├── key_molecule_id → molecule_def (carrier or partner)
    ├── key_ref → carrier_id or partner_id value
    └── alias_value = "AA12345678"
```

## Status

Fully implemented and operational. Admin UI for alias type configuration, CSR workflow for adding/viewing/deleting member aliases, reverse lookup API for incoming file processing. Integrated with carrier and partner lookup tables via molecule system.
