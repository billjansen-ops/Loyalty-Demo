#!/usr/bin/env node
/**
 * lint-anti-patterns.cjs — grep-style detector for known bug-producing patterns.
 *
 * REPORT-ONLY: prints findings, exits 0. Does not fail the test suite (yet).
 * Run: node tests/lint-anti-patterns.cjs
 *
 * Each pattern detected here corresponds to a real bug the platform has hit
 * (Session 126 audit). When a pattern is added, the existing matches should
 * be triaged (legitimate vs. real instance) and either fixed or suppressed.
 * Once clean, flip this script to fail on any new matches.
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
]);

const SKIP_FILES = new Set([
  'old_server_db_api.js',                   // legacy reference, not loaded
  // Dead duplicate copies (Session 126 audit flagged these as unreferenced):
  'csr_memberBJ.html', 'csr_member.bj.html', 'xcsr_member.html', 'xxcsr_member.html',
  'xadmin_promotion_edit.html', 'bjadmin_bonus_edit.html', 'badmin_promotion_edit.html',
  // Self
  'lint-anti-patterns.cjs',
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

// ── Pattern 2: toISOString().split('T')[0] — UTC vs. local calendar day ──────
check(
  'UTC-vs-local date display bug — toISOString().split("T"). Use toLocaleDateString("en-CA").',
  allFiles,
  /\.toISOString\(\)\.split\(['"]T['"]\)/,
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

// ── Report ───────────────────────────────────────────────────────────────────
if (findings.length === 0) {
  console.log('✅ Anti-pattern lint: 0 matches');
  process.exit(0);
}

const byCategory = {};
for (const f of findings) (byCategory[f.category] ||= []).push(f);

console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Anti-pattern lint: ${findings.length} match(es) across ${Object.keys(byCategory).length} categor(ies)`);
console.log('REPORT-ONLY — does not fail the build.');
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
console.log('When the codebase is clean, flip this script to fail on any matches.');
console.log('═══════════════════════════════════════════════════════════════════');

process.exit(0); // report only
