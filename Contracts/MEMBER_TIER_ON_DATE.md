# Contract: MEMBER_TIER_ON_DATE

## Type
Reference Molecule

## Purpose
Determine the single effective tier for a member as of a resolved date.

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

- P2: Unused  
- P3: Unused  
- P4: Unused

## Return Value
- tier_code  
  Always returns exactly one tier code.

## Behavior
- Resolve the effective date based on P1.
- Identify all member tier records whose validity window includes the resolved date.
- If one or more member tier records apply:
  - Select exactly one tier using tier ranking as the deterministic tie-breaker.
- If no member tier records apply:
  - Return the configured Base Tier for the tenant.
- Return the selected tier code.

## Does Not
- Return NULL or multiple tiers.
- Award or modify tiers.
- Inspect the current system date.
- Use posting date or ingestion time.
- Return tier histories, collections, or ranking details.
