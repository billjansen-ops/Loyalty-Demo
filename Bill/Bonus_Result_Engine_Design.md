# Bonus Result Engine — Architectural Design

**Author:** Bill Jansen
**Date:** 2026-04-07
**Status:** Proposed — build when needed (second tenant or when promotion-as-middleman becomes friction)

---

## Problem

Today, bonuses do one thing: award points. If a bonus needs to trigger an action (create a registry item, fire a notification, etc.), we route it through the promotion engine — the signal gets stored as a molecule, a promotion picks it up, the promotion's "external" result calls a function.

This works. WI PHP is live with it. But the promotion is just a middleman. The bonus already matched. It already has the member, the activity, the context. Making it go through a promotion to fire a function is architectural overhead.

## Proposed Design

Give bonuses the same multi-result capability promotions have. A single bonus rule can produce any number of results, each one either **points** or **external**.

### Bonus Rule Structure (UI)

Match the promotion rule page layout:

| Section | What's There Today | What Changes |
|---|---|---|
| **Header** | Code, name, description, dates, day-of-week, status | No change |
| **Criteria** | Rule-based criteria (same criteria engine as promotions) | No change |
| **Results** | Implicit — always "award points" (type + amount) | **NEW** — list of result rows |

### bonus_result Table (New)

```sql
CREATE TABLE bonus_result (
  bonus_result_id    SERIAL PRIMARY KEY,
  bonus_id           INTEGER NOT NULL REFERENCES bonus(bonus_id),
  tenant_id          SMALLINT NOT NULL,
  result_type        VARCHAR(20) NOT NULL,  -- 'points' or 'external'
  result_amount      INTEGER,               -- for points: fixed amount or percentage
  amount_type        VARCHAR(10),           -- 'fixed' or 'percent' (points only)
  result_reference_id INTEGER,              -- for external: FK to external_result_action
  result_description VARCHAR(200),
  point_type_id      INTEGER,               -- for points: which point type to credit
  sort_order         SMALLINT DEFAULT 0
);
```

A single bonus can have many rows. Examples:

**Airline — Diamond 50% Bonus:**
| result_type | amount_type | result_amount | point_type_id | result_reference_id |
|---|---|---|---|---|
| points | percent | 50 | BASE_MILES | — |

**WI PHP — Sentinel Positive:**
| result_type | amount_type | result_amount | point_type_id | result_reference_id |
|---|---|---|---|---|
| external | — | — | — | createRegistryItem |

**Hypothetical — compound bonus:**
| result_type | amount_type | result_amount | point_type_id | result_reference_id |
|---|---|---|---|---|
| points | fixed | 500 | PROMO | — |
| points | percent | 10 | STATUS | — |
| external | — | — | — | sendNotification |

### Processing Changes

**applyBonusToActivity** currently hardcodes one Type N activity with points. Change to:

```
For each bonus_result row (sorted by sort_order):
  If result_type = 'points':
    → Create Type N activity (same as today)
    → Route points to point_type_id bucket
    → Attach BONUS_RULE_ID and BONUS_ACTIVITY_LINK molecules
    → Attach MEMBER_POINTS molecule

  If result_type = 'external':
    → Create Type N activity (no points, same parent linkage)
    → Attach BONUS_RULE_ID and BONUS_ACTIVITY_LINK molecules
    → Attach EXTERNAL_ACTION molecule (references external_result_action)
    → Look up function_name in externalActionHandlers
    → Fire function with full context
```

Every result — points or external — produces a Type N activity. This keeps everything in the activity table, auditable, and visible in the verbose view.

### Verbose View Changes

The green box on the activity detail currently shows:

```
Flight SkyMiles: 3,967
  + Diamond 50% Bonus         1,983
  + Middle Seat Bonus            500
  + Regional Carrier Bonus       500
  + First Class Test             100
Total SkyMiles Added:          7,050
```

With this change, non-point results also appear:

```
Flight SkyMiles: 3,967
  + Diamond 50% Bonus         1,983
  + Middle Seat Bonus            500
  ⚡ Created Registry Item
  ⚡ Sent Notification
Total SkyMiles Added:          6,467
```

Point results show amounts. External results show action names. Both are Type N activities linked to the parent.

### Migration Path

**No breaking changes.** The existing bonus table keeps its `bonus_type` and `bonus_amount` columns. If a bonus has no `bonus_result` rows, the engine falls back to the legacy behavior (same pattern promotions use today with their fallback logic).

When ready to migrate:
1. Create `bonus_result` table
2. For each existing bonus, create one `bonus_result` row from its `bonus_type`/`bonus_amount`
3. For WI PHP promotions that are really bonuses with external actions, create bonus rules with external results and retire the promotions

### What Doesn't Change

- **external_result_action table** — already built, already has the function registry
- **externalActionHandlers** — already built, already has createRegistryItem etc.
- **Criteria engine** — shared between bonuses and promotions, no changes
- **Point type routing** — already works per bonus, just moves to per-result
- **Promotion engine** — stays as-is for actual promotions (tier awards, enrollment, etc.)

## Why Not Now

- WI PHP is live and presenting. The promotion-as-middleman pattern works.
- This touches the core processing engine — high risk, needs careful testing.
- No second tenant is asking for it yet.
- Estimated effort: 1-2 sessions.

## When to Build

- Second tenant onboarding where signal → action configuration needs to be clean
- When the number of "fake promotions" (promotions that are really bonus actions) becomes maintenance friction
- When a client needs compound bonus results (points + action from one rule)
