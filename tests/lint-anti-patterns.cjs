#!/usr/bin/env node
/**
 * lint-anti-patterns.cjs — grep-style detector for known bug-producing patterns.
 *
 * FAILS THE BUILD on any match. Exits 0 when clean, 1 when matches are found.
 * Flipped from report-only at the end of Phase 6 (Session 130) once the
 * Insight-server extraction landed the codebase at zero matches.
 * Run: node tests/lint-anti-patterns.cjs
 *
 * Each pattern detected here corresponds to a real bug the platform has hit
 * (Session 126 audit). When a new pattern is added here, triage existing
 * matches: either fix them inline, suppress with a `// lint-allow` comment
 * + explanation, or move the offending code to a vertical.
 *
 * See memory/BEFORE_YOU_WRITE.md for the rationale behind each pattern.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude',
  'worktrees',                              // .claude/worktrees — Claude scratch
  "tenants-don't use",                      // legacy folder, kept for reference
  '20251215', '20251217', '20251218',       // dated snapshot folders
  'database',                               // schema dumps
  'venv', '__pycache__',                    // ML service
  'uploads',                                // user-uploaded scratch, not platform code
]);

const SKIP_FILES = new Set([
  'old_server_db_api.js',                   // legacy reference, not loaded
  'tier_endpoints.js',                      // dead stub — not required/imported anywhere (Session 120 audit)
  // Dead duplicate copies (Session 126 audit flagged these as unreferenced):
  'csr_memberBJ.html', 'csr_member.bj.html', 'xcsr_member.html', 'xxcsr_member.html',
  'xadmin_promotion_edit.html', 'bjadmin_bonus_edit.html', 'badmin_promotion_edit.html',
  // Self
  'lint-anti-patterns.cjs',
]);

// ── Data-access layer allowlists (Session 120) ───────────────────────────────
// The molecule / tier / link rules say platform code must go through the
// helper functions, never raw SQL. But the helpers THEMSELVES, migrations,
// the vertical scoring hooks, and one-time backfill/seed scripts unavoidably
// touch these tables directly — that's their job. These sets name the files
// where direct access is sanctioned; Patterns 6–8 flag it everywhere else
// (tests excluded — fixtures/assertions legitimately read raw rows).
//
// Adding a file to one of these sets should be a conscious, reviewed choice.
// That visibility IS the guardrail: a NEW file doing raw molecule/tier/link
// SQL fails the build until someone deliberately blesses it here.
const MOLECULE_SQL_ALLOW = new Set([
  'pointers.js',                 // the platform molecule-helper layer itself
  'db_migrate.js',               // schema/data migrations
  'custauth.js',                 // vertical clinical hooks — documented raw-read exception
  'extendedCardDetector.js',     // vertical clinical scoring — raw molecule reads
  'wellness.js',                 // vertical bulk scoring SQL (perf-sensitive joins)
  'scoring_history.js',          // wi_php scoring-history reads
  'ml_report.js',                // wi_php ML feature extraction
  'backfill_dominant_driver.js', // one-time maintenance backfill
]);
const TIER_SQL_ALLOW = new Set([
  'pointers.js',                 // tier-history reads + tier-management DELETE/INSERT
  'db_migrate.js',               // migrations
]);
const LINK_ALLOC_ALLOW = new Set([
  'pointers.js',                 // batch link allocation + member_number counter
  'db_migrate.js',               // migrations seed/extend link_tank
  'get_next_link.js',            // the getNextLink() helper itself
  'backfill_member_link.js', 'backfill_activity_link.js', 'backfill_member_promotion_link.js', // one-time link backfills
  'seed_stability_registry.js', 'copy_members_to_tenant5.js', // one-time seed scripts
]);

// Files where healthcare/tenant-specific terms are legitimate (migration data,
// not running platform code). The lint still runs on these for date patterns
// and other generic checks, but skips the "healthcare terms" category.
const HEALTH_TERMS_SKIP = new Set([
  'db_migrate.js',     // migration steps seed tenant-specific data (sysparm labels, signal names, registry seed rows, etc.) — by definition healthcare-specific for wi_php migrations. Not platform code that runs per request.
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function shouldCheck(file) {
  if (SKIP_FILES.has(path.basename(file))) return false;
  return /\.(js|cjs|mjs|html)$/.test(file);
}

const allFiles = [...walk(ROOT)].filter(shouldCheck);
const rootFiles = allFiles.filter(f => path.dirname(path.relative(ROOT, f)) === '.');

const findings = [];

function check(category, files, regex, opts = {}) {
  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    let inBuildNotes = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip the entire BUILD_NOTES string (it's the rolling session log,
      // not platform behavior; can contain any session-history terms).
      if (opts.skipBuildNotes) {
        if (/^const\s+BUILD_NOTES\s*=\s*"/.test(line)) inBuildNotes = true;
        if (inBuildNotes) {
          // Build notes ends when the string closes (a line ending in `";`)
          if (/";\s*$/.test(line)) inBuildNotes = false;
          continue;
        }
      }
      // Skip lines inside comment blocks (heuristic: line starts with // or *)
      if (opts.skipComments && /^\s*(\/\/|\*|<!--)/.test(line)) continue;
      // Skip lines that explicitly opt out
      if (/lint-allow/i.test(line)) continue;
      if (regex.test(line)) {
        findings.push({ category, file: path.relative(ROOT, file), line: i + 1, excerpt: line.trim().slice(0, 140) });
      }
    }
  }
}

// ── Pattern 1: Math.floor of millisecond date diff — DST off-by-one ───────────
// Allow inside pointers.js (where the canonical helper lives) and inside tests/.
check(
  'DST date bug — Math.floor of millisecond date diff. Use Date.UTC() + Math.round, or call dateToMoleculeInt.',
  allFiles.filter(f => !f.endsWith('pointers.js') && !f.includes(`${path.sep}tests${path.sep}`)),
  /Math\.floor\([^)]*\b(86400000|1000\s*\*\s*60\s*\*\s*60\s*\*\s*24)\b/,
  { skipComments: true }
);

// ── Pattern 2: toISOString().split('T')[0] / .slice(0,10) — UTC vs. local day ─
// Both spellings of the same bug. The slice form evaded this lint for months
// (8 active files, Session 120 audit) — keep both alternatives in the regex.
check(
  'UTC-vs-local date display bug — toISOString().split("T") or .slice(0,10). Use toLocaleDateString("en-CA") client-side, formatDateLocal()/platformTodayStr() server-side.',
  allFiles,
  /\.toISOString\(\)\.(split\(['"]T['"]\)|slice\(\s*0\s*,\s*10\s*\))/,
  { skipComments: true }
);

// ── Pattern 3: new Date('YYYY-MM-DD') — UTC midnight parse, displays as prev day ─
check(
  'UTC-midnight parse — new Date("YYYY-MM-DD") becomes previous calendar day in negative-UTC zones.',
  allFiles,
  /new\s+Date\(\s*['"]\d{4}-\d{2}-\d{2}['"]\s*\)/,
  { skipComments: true }
);

// ── Pattern 4: Healthcare terms in root-level (platform-shared) files ─────────
// Skip files listed in HEALTH_TERMS_SKIP (migration data, not platform code).
// Skip BUILD_NOTES strings (rolling session log can contain any history terms).
check(
  'Healthcare-specific term in platform-shared (root) file — move to vertical or drive via molecule/sysparm config.',
  rootFiles.filter(f => !HEALTH_TERMS_SKIP.has(path.basename(f))),
  /\b(Clinician|Clinicians|Physician|Physicians|PPSI|PPII)\b/,
  { skipComments: true, skipBuildNotes: true }
);

// ── Pattern 5: verticals/ path in root-level file (invert the dependency) ─────
// Skip BUILD_NOTES (session log) and lines with explicit // lint-allow.
check(
  'Root-level file references a specific vertical path — vertical pages should depend on root, not the reverse.',
  rootFiles,
  /verticals\/[a-z_]+\//,
  { skipComments: true, skipBuildNotes: true }
);

// ── Database-access rules (Session 120) ──────────────────────────────────────
// Server-side JS only (HTML can't run SQL), tests excluded (fixtures/assertions
// legitimately read raw rows). Each check exempts its own data-layer allowlist.
const dbLayerFiles = allFiles.filter(f =>
  /\.(c|m)?js$/.test(f) && !f.includes(`${path.sep}tests${path.sep}`)
);

// ── Pattern 6: direct SQL against molecule storage tables ─────────────────────
// Molecule data must go through the helpers (getMoleculeRows, insertMoleculeRow,
// bulkGet*, etc.) — they handle base-127 encoding + table routing. Raw SQL
// bypasses both and silently corrupts data. THIS is the rule Bill has been
// bitten by most. Allowed only in MOLECULE_SQL_ALLOW.
check(
  'Direct SQL against molecule storage tables — use the molecule helpers (getMoleculeRows / insertMoleculeRow / bulkGet*), never raw SQL.',
  dbLayerFiles.filter(f => !MOLECULE_SQL_ALLOW.has(path.basename(f))),
  /"5_data_\d+"|\bmember_molecule\b|\b(?:activity|member)_detail_\d+\b/i,
  { skipComments: true }
);

// ── Pattern 7: raw JOIN/FROM member_tier — bypasses get_member_current_tier() ──
// A member can hold overlapping tiers; the helper returns the highest-ranking
// current one. A raw join silently picks the wrong tier. Allowed only in
// TIER_SQL_ALLOW (pointers.js does tier management; migrations seed tiers).
check(
  'Raw member_tier query — derive current tier via get_member_current_tier() (LEFT JOIN LATERAL), never a raw JOIN/FROM member_tier.',
  dbLayerFiles.filter(f => !TIER_SQL_ALLOW.has(path.basename(f))),
  /(?:join|from)\s+member_tier\b/i,
  { skipComments: true }
);

// ── Pattern 8: raw link_tank allocation — bypasses getNextLink() ──────────────
// New IDs must come from getNextLink() (atomic, self-initializing). Raw link_tank
// UPDATEs or MAX(link)+1 race under load and hand out duplicate keys. Allowed
// only in LINK_ALLOC_ALLOW (the helper + migrations + one-time backfills/seeds).
check(
  'Raw link/ID allocation — use getNextLink(), never raw link_tank SQL or MAX(link)+1.',
  dbLayerFiles.filter(f => !LINK_ALLOC_ALLOW.has(path.basename(f))),
  /\blink_tank\b|\bmax\(\s*link\s*\)/i,
  { skipComments: true }
);

// ── Report ───────────────────────────────────────────────────────────────────
if (findings.length === 0) {
  console.log('✅ Anti-pattern lint: 0 matches');
  process.exit(0);
}

const byCategory = {};
for (const f of findings) (byCategory[f.category] ||= []).push(f);

console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Anti-pattern lint: ${findings.length} match(es) across ${Object.keys(byCategory).length} categor(ies)`);
console.log('FAILING THE BUILD — fix the match, add // lint-allow with a reason, or move it to a vertical.');
console.log('See memory/BEFORE_YOU_WRITE.md for the why behind each pattern.');
console.log('═══════════════════════════════════════════════════════════════════');

for (const [category, items] of Object.entries(byCategory)) {
  console.log(`\n📌 ${category}`);
  console.log(`   ${items.length} match(es)`);
  for (const item of items) {
    console.log(`     ${item.file}:${item.line}`);
    console.log(`       ${item.excerpt}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('To suppress a legitimate match, add "// lint-allow" on the line.');
console.log('═══════════════════════════════════════════════════════════════════');

process.exit(1);
