---
name: CI runs /bin/sh (dash), not bash — avoid bash-only syntax
description: Shell-quoted commands passed through execSync run under /bin/sh on Linux. Dash does NOT support $'\\t', $'\\n', process substitution, or other bash features. Use POSIX-portable syntax.
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Don't use bash-only syntax in shell-spawned commands

When Node's `execSync` runs a command string (no array form), Linux executes it via `/bin/sh` which on Ubuntu is `dash`. Dash is strict POSIX and does NOT support:

- `$'...'` ANSI-C quoting (e.g. `$'\t'`, `$'\n'`) — treated literally
- Process substitution `<(...)`, `>(...)`
- `[[ ... ]]` extended test
- `function name() { ... }` syntax (use `name() { ... }`)
- `local` outside functions
- `==` in `[ ... ]` tests
- Arrays
- `echo -e`

**Signal this has gone wrong:** psql command run via execSync uses `-F $'\\t'` for tab separator. On Mac (bash), works. On CI Linux (dash), the field separator becomes the literal 5-character string `$'\\t'` — psql then outputs columns separated by that string, not tabs. Caller's `out.split('\t')` returns the whole row as ONE field. Destructuring `[a, b, c, d] = row` makes b/c/d undefined. Test fails with `expected 5, got NaN` and `expected: <string>, got: undefined`.

**Reproducer from Session 112** (`test_ppii_history_snapshot.cjs`):

```javascript
// BAD — bash-only
const out = execSync(`${PSQL} -h ${DB_HOST} -t -A -F $'\\t' -c "${sql}"`, ...);

// GOOD — POSIX-portable, no special chars needed
const out = execSync(`${PSQL} -h ${DB_HOST} -t -A -F '|' -c "${sql}"`, ...);
return out.split('\n').map(line => line.split('|'));
```

**How to apply:**
- For field separators, use a literal char that doesn't appear in your data (`|`, `,`, `;`).
- For complex commands, either use `execSync(cmd, { shell: '/bin/bash' })` explicitly OR `execFile` with an argv array to skip shell parsing entirely.
- When in doubt, paste your command into `dash -c '...'` mentally and ask "does this still work?"
- Grep for `$'` in test files and bash scripts — every match is a CI risk.
