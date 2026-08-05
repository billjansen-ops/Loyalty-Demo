# Billing, Statements, and Run Stamps — the design

**Status: REFERENCE, not scheduled.** Nothing here is built. This is the
settled design for when a client needs it. It came out of a Session 167
conversation with Bill while reviewing BI Worldwide's "High Level
Requirements for Global Points Account," and it records his design from
prior loyalty platforms, mapped onto Pointers' mechanisms.

---

## 1. The concept in one line

**A periodic run stamps every record it touched, and the stamp lives on
the record itself.** Not in a side ledger that has to be kept in
agreement with the records, and not re-derived later from rules that may
have changed since.

## 2. Where it came from (the lineage matters)

The pattern was invented for **member activity statements**, not for
billing. A statement run stamped every activity it printed, so the exact
statement a member received could always be reproduced — not regenerated
from today's rules, *reproduced* from the stamps.

Billing turned out to need the same thing for a different reason
(auditability rather than customer service), and the pattern fit without
modification. Bill's observation, worth keeping: a pattern invented for
one real job that later fits the next one is usually a good pattern; the
ones designed up front to be general usually are not.

Loyalty programs do not send periodic statements any more, so the
statement half is historical. The billing half is live the moment a
client bills its own customers for points.

## 3. Reproduce, not regenerate — the property being bought

This is the whole point, and it is the strongest thing to say about it to
a technical buyer:

- **Regenerate** = re-derive the document from current rules and current
  data. It quietly lies the moment a rule changed, a rate changed, or an
  activity was corrected.
- **Reproduce** = select the records carrying that run's stamp and print
  them. A member disputing a statement from four years ago, or a client
  disputing an invoice, gets the actual document back.

Most incumbent platforms cannot make this claim.

## 4. Bill on issuance, not on redemption (Bill's ruling)

**Bill on issuance.** The accrual is the billable unit: it exists once,
it never splits, and it is billable the moment it happens.

**Breakage is priced into the issuance rate, not reconciled afterward.**
The cost per point at issuance is indexed to an actuarial breakage
assumption. One price, one billing event, no expiration-time credits, no
clawbacks to explain to a client. (A true-up-at-expiration model was
considered in the same conversation and rejected as strictly worse:
same economics, more moving parts.)

**Why not bill on redemption** (which BI Worldwide apparently does):

1. *Attribution loss.* Points do not stay individually identifiable after
   they are earned. An accrual pours into a `member_point_bucket` keyed
   by member + expiration rule + expiration date, and MANY accruals feed
   the same bucket. Redemption draws FIFO from buckets. So the chain a
   billing run can follow is redemption → bucket → *the set of accruals
   that fed it*, never redemption → a specific accrual. Billing against
   an aggregate means prorating across accruals that may not share a
   client, funding source, or rate.
2. *Splitting.* One accrual gets consumed across many redemptions over
   time, so a single earning event lands in several billing runs,
   possibly years apart.

The commercial reason operators accept this mess is breakage: clients
prefer to pay only for points actually consumed. Indexing the issuance
price for breakage gives the client that economics with none of the
accounting cost.

## 5. The mechanism

### 5a. The run is a table; the stamp is a molecule

The platform's own rule (MASTER, the bucket section): **entities get
tables, attributes get molecules.**

A run needs identity — type, cycle end date, population, status, totals,
when it ran, who ran it — so it is a table. Which run touched a given
activity is an attribute of that activity, so it is a molecule pointing
at the run.

**ONE run table carrying a TYPE, not two parallel systems.** A billing
run and a statement run have identical anatomy, an identical sweep, an
identical reconciliation invariant, and get their re-creatability from
the same place. Two tables would mean two copies of the sweep logic —
exactly the drift BEFORE_YOU_WRITE's "a second kind of X is a design
event" warns about.

### 5b. The stamp molecule is the MEMBER_POINTS shape

This is not a new molecule shape. It is the one the point ledger already
uses:

`MEMBER_POINTS` (`5_data_54`) hangs on an activity as **one-to-many**
rows — `c1` = a 5-byte link (the bucket), `n1` = an integer (the amount).
A redemption drawing FIFO across three buckets writes three rows, one per
bucket, and they sum to the redemption.

The run stamp is the same object with a different target:
- `c1` = the run's link
- `n1` = the points accounted for **in that run**
- one-to-many: keep adding rows until the activity is fully accounted

Accruals bill once and whole (one row). Redemptions may be accounted
across several runs (n rows). Same storage, same composite pattern,
already proven at scale and already covered by tests.

Related exemplars of the "5-byte link hung on an activity" shape:
`TRANSFER_LINK`, `BONUS_ACTIVITY_LINK`, `SPONSOR_SOURCE_LINK`.

### 5c. The sweep

A run has a **cycle end date** and sweeps everything not yet accounted
for through that date.

**The predicate is "under-accounted," not "unstamped":**

> billed amount (sum of stamp `n1` for this run type) < the activity's
> points, AND activity date <= the run's cycle end date

For accruals the two forms are identical (they bill once and whole). For
redemptions with one-to-many rows they are not, and only the second form
catches a partially accounted redemption on the next run.

The stamp is therefore simultaneously the audit record AND the
"has this been processed" marker. No status column to maintain, no state
machine to keep honest — the same idea as `GROUP_REMOVED`, where the
presence of the molecule is the fact.

### 5d. The stamp is one-way

Once an activity carries a run, that stamp never changes. A correction is
a **new run that reverses**, never an overwrite. This is what actually
delivers re-creatability: the original invoice or statement remains
reproducible, and the correction is visible as its own event rather than
hidden by an edit. (Supersede-never-delete, applied to runs.)

### 5e. The reconciliation invariant (make the suite enforce it)

For any fully accounted activity, the stamp amounts must sum **exactly**
to the activity's points.

This is assertable, so "we can prove the invoice" becomes something the
test suite enforces rather than something we claim. Build the test with
the feature, not after.

## 6. Variable cycles fall out for free

Different populations on different cadences (gold monthly, regular
quarterly; and the same for variable billing) need **no new machinery**:

- the cadence is program configuration keyed by tier (sysparm data)
- a run's population is "who was in that tier on the run date"
- the platform already answers **tier as of a date**, not just tier today

So a new cadence later is a config row, not a code branch.

**Boundary case, decided:** a member who changes tier mid-cycle has
activities that fall either side of the change, and two runs on different
cadences will sweep overlapping dates. The stamp handles it correctly on
its own — an activity already accounted for is no longer under-accounted
— and which run picks up the boundary activities is a one-time policy
call at build time. Bill's ruling: "we just handle it." Not a design
problem.

## 7. What exists today vs. what this would add

**Exists and is proven:** the temporal-first ledger (balances derived,
never stored), FIFO consumption across multiple buckets, point
expiration rules, multiple point types, adjustments, member-to-member
transfers (v153), and the molecule machinery this design rides on.

**Does not exist:** any billing layer at all. No run table, no stamp
molecule, no rates, no invoices, no financial reporting. Pointers has
never billed a corporate client for issuance because it has never needed
to.

**Adjacent requirements this design also answers** (each a per-record
attribute, i.e. a molecule rather than a schema change): taxable
indicator, suppress-from-statement, client/program billing codes.

## 8. Where this came up

BI Worldwide's requirements list, reviewed Session 167. Their vocabulary
(BOI/BOR/BOB for billing models, TOI/TOR/TOT for taxability) is the
internal shorthand of a company running such a platform today, which
makes any BI conversation a *replacement* conversation. The gaps between
that list and Pointers cluster entirely in the commercial layer —
billing, taxability, currency, financial reporting — not in the ledger.
