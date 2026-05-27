---
name: Migrations must resolve members/data by name, not hardcoded IDs
description: Postgres sequence allocation diverges across environments. Grace Newfield is #46 on Bill's local and #53 on Heroku. Any migration that hardcodes membership_number / id will fail on at least one environment.
type: feedback
originSessionId: 89b77d55-1fa5-461d-b8e9-1b264b355b5a
---
## Resolve participants/data by NAME in migrations, not by ID

Database seeds and migrations run in different environments at different times. Postgres sequences increment as rows get inserted; if local seeds happen in a different order than Heroku seeds, the resulting IDs DIVERGE. The data is the same; the keys aren't.

**Concrete example from Session 112:** v64 migration seeded engineered PPSI history for 10 Recovery participants. The first attempt hardcoded local membership numbers:

```javascript
// BAD — local-only
const PLAN = [
  { mn: '46', ... },  // Grace Newfield on local
  { mn: '50', ... },  // Sterling Brightwell on local
  ...
];
```

On Heroku this failed immediately: `Recovery participant #50 not found in tenant 5`. Sterling Brightwell on Heroku is #57, not #50. Took a deploy + migration crash to discover. Real-time pressure with Erica imminent on the system.

**The fix:**

```javascript
// GOOD — environment-portable
const PLAN = [
  { fname: 'Grace', lname: 'Newfield', ... },
  { fname: 'Sterling', lname: 'Brightwell', ... },
  ...
];

const memberRows = await client.query(
  `SELECT link, membership_number, fname, lname FROM member
    WHERE tenant_id=$1 AND fname=ANY($2::varchar[]) AND lname=ANY($3::varchar[])`,
  [TENANT, PLAN.map(p => p.fname), PLAN.map(p => p.lname)]
);
const MBYNAME = {};
for (const r of memberRows.rows) MBYNAME[`${r.fname}|${r.lname}`] = r;
for (const p of PLAN) {
  const key = `${p.fname}|${p.lname}`;
  if (!MBYNAME[key]) throw new Error(`${p.fname} ${p.lname} not found in tenant ${TENANT}`);
}
```

**Also watch verification queries.** After fixing the seed, v64 still failed with `expected 40 PPSI surveys, found 0` because the verification query STILL used membership_number. Verify against the resolved data, not by re-querying with hardcoded IDs.

**How to apply:**
- Any migration that seeds engineered data for specific named participants must resolve them by `(fname, lname)` or another stable identifier — never by membership_number, link, or any sequence-allocated ID.
- Same rule for verification queries inside the migration: use the already-resolved `member.link` values, not a fresh lookup by ID.
- Pay attention to PG column types when passing arrays: `member.link` is `CHAR(5)` squish-encoded — cast as `text[]` and let PG coerce. `member_survey.member_link` is also `CHAR(5)`.
- The CI workflow restores `.claude/demo-baseline/demo-baseline.dump` (committed) and runs migrations from there — so any environment-portability bug in a new migration WILL fail CI before reaching Heroku.
