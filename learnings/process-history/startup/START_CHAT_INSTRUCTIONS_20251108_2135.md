# START OF NEW CHAT - BOOTSTRAP INSTRUCTIONS

## 🎯 Boot Sequence

Follow these steps IN ORDER when starting a new session:

### Step 1: Extract Handoff Package
```bash
cd /home/claude
tar -xzf /mnt/user-data/uploads/loyalty_handoff_*.tar.gz
mv loyalty_handoff_* loyalty-demo  # Rename to standard name
```

### Step 2: Read Database Schema
```bash
cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```
**CRITICAL:** Never write ANY database code until you've read this schema. Always verify column names before querying.

### Step 3: Find and Read Latest Files
Use these commands to find the most recent versions:

```bash
# Find latest WORKFLOW_STANDARDS
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Find latest SECRET_SAUCE
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Find latest SESSION_SUMMARY
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

Read all three files completely before proceeding.

### Step 4: Ask for ATIS
After reading all files, your FIRST message to Bill must be:

"Boot sequence complete. I have read:
- Database schema
- WORKFLOW_STANDARDS_[timestamp]
- SECRET_SAUCE_[timestamp]
- SESSION_SUMMARY_[timestamp]

Current understanding:
- [Brief summary of what's working]
- [Brief summary of what's broken]
- [Next priority task]

**What is the current ATIS information?**"

## 🛫 ATIS System

**ATIS (Automated Terminal Information Service)** - Verification that Claude can search conversation history.

**How it works:**
- Bill establishes ATIS at chat start: "ATIS information [Alpha/Bravo/Charlie/etc.] is current"
- This is a simple marker phrase in the conversation
- If Bill suspects Claude is losing context, he asks: "What is the current ATIS?"
- If Claude can find it → Context is intact, continue working
- If Claude cannot find it → Context is broken, time for new chat with handoff

**Purpose:** Provides an objective test of whether Claude can still reference earlier parts of the conversation before wasting time on broken context.

## 🚨 Critical Rules - READ THESE CAREFULLY

### Never Start Without Reading
- **DO NOT write any code** until you've read the schema
- **DO NOT make assumptions** about column names - verify them in schema
- **DO NOT skip the boot sequence** - every file matters

### When You Get "Column Does Not Exist" Error
1. **STOP** - Do NOT create a new table or column
2. Look at the actual table schema using `\d tablename` output
3. Fix your query to use the ACTUAL column names
4. The table exists - you're just using wrong column names

### Finding Latest Files
Always use this pattern:
```bash
ls -t /home/claude/loyalty-demo/learnings/FILENAME_*.md | head -1
```
The `-t` flag sorts by modification time (newest first).

### Bill's Communication Style
When Bill says:
- **"stop!"** → You're going down the wrong path, pause and listen
- **"NO!"** → You're fundamentally misunderstanding something
- **"why are you asking this question"** → The answer should be obvious from the data
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data

**When you hear these → STOP and reconsider your approach!**

### Response Pattern for Questions
When Bill asks "Why did you do X?":
- He is NOT asking you to change it
- He is asking you to EXPLAIN your reasoning
- Answer the question, then WAIT for instruction
- Never assume he wants you to fix it

## 💡 What This Project Is

A multi-tenant loyalty platform with revolutionary "molecule" architecture that works across any industry (airlines, hotels, retail, etc.).

Key innovations:
- Temporal-first design (retro-credit just works)
- Universal molecule abstraction (industry-agnostic)
- Data drives behavior (not hardcoded logic)
- Everything is pointers (performance)

**You'll learn the details in SECRET_SAUCE after you boot up.**

## 📊 Token Budget

- Total: 190,000 tokens
- Warning at 130k (68%): Wrap up soon
- Critical at 150k (79%): Create handoff NOW
- Emergency at 170k (89%): Minimal responses, handoff immediately

## ✅ Success Criteria

You're properly booted when:
- [ ] You know the current database schema
- [ ] You understand core architectural principles
- [ ] You know what's working and what's broken
- [ ] You know the next priority task
- [ ] You understand Bill's communication style
- [ ] You can answer: "What is Bill's favorite color?" (Answer: green)
- [ ] You have asked for and received the ATIS information

## 🎯 Current Session Context (as of 2025-11-08 21:35)

**What's Working:**
- Embedded list value CRUD (add/edit/delete for sysparm categories)
- Redemption rule CRUD (list/add/edit/delete)
- Admin navigation reorganized into 4 sections
- Tenant handling fixed across admin pages
- ATIS system implemented in bootstrap

**What's Broken:**
- Date display inconsistency (needs to be MM/DD/YYYY everywhere)

**Next Priorities:**
1. Fix date formatting to MM/DD/YYYY consistently across redemption pages
2. Test all redemption CRUD operations
3. Continue building out admin functionality

**Critical Lesson from This Session:**
When you get "column does not exist" error - the table EXISTS, you're using WRONG column names. Never create a new table. Check actual schema and fix your queries.

---

**Now wait for Bill to upload the handoff package.**
