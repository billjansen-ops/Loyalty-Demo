# Contract: MEMBER_BADGE_ON_DATE

## Type
Reference Molecule

## Purpose
Determine whether a member holds a specific badge as of a resolved date.

## Inputs

### Implicit Inputs
- member_id  
  The member being evaluated.
- activity_date  
  The activity date supplied by the rules engine (either from a real activity or from an admin test context).

### Parameters
- P1: Date Mode  
  Allowed values:
  - "Use Activity Date"

- P2: Badge Code  
  A badge identifier from the tenant’s badge table (e.g. "MILLION_MILER").

- P3: Unused  
- P4: Unused

## Return Value
- "Y" if the member holds the specified badge on the resolved date.
- "N" otherwise.

## Behavior
- Resolve the effective date based on P1.
- Evaluate badge validity using badge start and end dates.
- Return a scalar result ("Y" or "N").

## Does Not
- Return collections or lists.
- Inspect the current system date.
- Modify member or badge state.
- Perform rule logic or comparisons.
