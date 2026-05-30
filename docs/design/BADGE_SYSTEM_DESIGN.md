# Badge System Design

**Date:** January 1, 2026
**Status:** Brainstorming / Design Phase - No Code Written

---

## Concept

Badges are zero-point awards that can be counted by promotions. This enables "meta-promotions" where completing promotions earns badges, and accumulating badges unlocks bigger rewards.

### Example: Delta Monthly Challenge Program

**12 Monthly Challenges:**
- January: Fly to Florida → 1,000 miles + 1 badge
- February: Visit New York → 1,000 miles + 1 badge
- March: Fly First Class → 1,000 miles + 1 badge
- ... etc.

**12 Accumulation Promotions:**
- Complete 1 challenge → 500 points
- Complete 2 challenges → 1,000 points
- Complete 3 challenges → 1,500 points
- ...
- Complete 12 challenges → Diamond status

**Flow:**
1. Member completes January Challenge promotion
2. Promotion awards 1,000 miles (normal reward)
3. Promotion awards 1 badge (new reward type) - creates adjustment activity
4. Badge activity triggers promotion evaluation
5. Accumulation Promo #1 matches (criteria: adjustment_code = 'CHALLENGE-BADGE-2025')
6. Accumulation Promo #1 qualifies (goal: 1 badge) → awards 500 points
7. Accumulation Promos #2-12 increment progress_counter to 1

When February completes, same flow - Promo #2 qualifies, #3-12 increment.

---

## Key Insight

**Badges ARE adjustment activities.** They flow through the existing promotion evaluation system like any other activity. No special badge-counting logic needed - the criteria system handles "which badges count."

---

## Schema Changes

### 1. Adjustment Table

Add `adjustment_type` column:

```sql
ALTER TABLE adjustment ADD COLUMN adjustment_type CHAR(1) DEFAULT 'A'
  CHECK (adjustment_type IN ('A', 'B'));

COMMENT ON COLUMN adjustment.adjustment_type IS 'A=Adjustment (points), B=Badge (zero-point award)';
```

Badge definitions:
- `adjustment_type = 'B'`
- `fixed_points = 0`
- `adjustment_code` identifies the badge (e.g., 'CHALLENGE-BADGE-2025')
- `adjustment_name` is display name (e.g., 'Monthly Challenge Badge')

### 2. Promotion Table - What to Count

Add 'badges' to count_type with corresponding badge selector:

```sql
ALTER TABLE promotion DROP CONSTRAINT promotion_count_type_check;
ALTER TABLE promotion ADD CONSTRAINT promotion_count_type_check 
  CHECK (count_type IN ('flights', 'miles', 'enrollments', 'molecules', 'badges'));

ALTER TABLE promotion ADD COLUMN counter_badge_adjustment_id INTEGER REFERENCES adjustment(adjustment_id);

ALTER TABLE promotion ADD CONSTRAINT promotion_badge_counter_required 
  CHECK ((count_type = 'badges' AND counter_badge_adjustment_id IS NOT NULL) 
      OR (count_type != 'badges' AND counter_badge_adjustment_id IS NULL));
```

When count_type = 'badges':
- Show badge picker (adjustments where type = 'B')
- Select ONE specific badge to count
- goal_amount = how many of that badge needed

### 3. Promotion Table - What to Award

Add 'badge' to reward_type with corresponding badge selector:

```sql
ALTER TABLE promotion DROP CONSTRAINT promotion_reward_type_check;
ALTER TABLE promotion ADD CONSTRAINT promotion_reward_type_check 
  CHECK (reward_type IN ('points', 'tier', 'external', 'enroll_promotion', 'badge'));

ALTER TABLE promotion ADD COLUMN reward_badge_adjustment_id INTEGER REFERENCES adjustment(adjustment_id);
ALTER TABLE promotion ADD COLUMN reward_badge_quantity INTEGER DEFAULT 1;

ALTER TABLE promotion ADD CONSTRAINT valid_badge_reward 
  CHECK ((reward_type = 'badge' AND reward_badge_adjustment_id IS NOT NULL) 
      OR (reward_type != 'badge' AND reward_badge_adjustment_id IS NULL));
```

When reward_type = 'badge':
- Show badge picker (adjustments where type = 'B')
- Select ONE specific badge to award
- Optional quantity (default 1)

### Parallel Structure

| Purpose | Type Field | Badge Selector | Amount |
|---------|------------|----------------|--------|
| What to count | count_type = 'badges' | counter_badge_adjustment_id | goal_amount |
| What to award | reward_type = 'badge' | reward_badge_adjustment_id | reward_badge_quantity |

---

## Logic Changes

### 1. Badge Award (when promotion completes with reward_type = 'badge')

```
For each badge (1 to reward_badge_quantity):
  1. Create adjustment activity with the reward_badge_adjustment_id
  2. Skip point expiration logic (zero points)
  3. Call promotion evaluation on the badge activity
```

### 2. Promotion Evaluation (for count_type = 'badges')

When evaluating an activity against a promotion with count_type = 'badges':
- Check if activity is an adjustment with adjustment_type = 'B'
- Check if activity's adjustment_id matches promotion's counter_badge_adjustment_id
- If match, increment progress_counter

Simple direct match - no criteria evaluation needed for badge counting.

### 3. Point Expiration

Skip badges - they have zero points, nothing to expire.

---

## UI Changes

### 1. Adjustment Admin

- Show/filter by adjustment_type
- Badge definitions: type = 'B', points = 0 (locked)
- Maybe separate "Badges" admin page, or just a tab/filter

### 2. Promotion Admin - What to Count

- count_type dropdown: add "Badges" option
- When "Badges" selected: show badge picker dropdown
  - Lists adjustments where adjustment_type = 'B'
  - User selects ONE badge
  - Stored in counter_badge_adjustment_id
- goal_amount field: how many of this badge needed

### 3. Promotion Admin - What to Award

- reward_type dropdown: add "Badge" option
- When "Badge" selected: show badge picker dropdown
  - Lists adjustments where adjustment_type = 'B'
  - User selects ONE badge
  - Stored in reward_badge_adjustment_id
- reward_badge_quantity field: how many to award (default 1)

### 4. Member Badge Display (NEW)

New section on CSR member page showing:
- Badges earned (grouped by program/year?)
- Count and list
- When each was earned
- What promotion awarded it

Query: `SELECT * FROM activity a JOIN adjustment adj ON a.adjustment_id = adj.adjustment_id WHERE a.member_id = ? AND adj.adjustment_type = 'B' ORDER BY a.activity_date DESC`

---

## Other Use Cases

This pattern supports:

- **Referral program** - refer friend → badge. 5 referrals → bonus.
- **Product cross-sell** - hotel + car + card = 3 badges → "Trifecta" reward
- **Engagement program** - complete profile, download app, opt-in → badges → bonus
- **Route collector** - 10 destinations → 10 badges → "Explorer" reward
- **Streak program** - monthly badges → 6-month and 12-month bonuses
- **Partner ecosystem** - multi-partner engagement badges → rewards

---

## Open Questions

1. **Duplicate badges** - Can member earn same badge twice? Probably yes (12 monthly badges could all be same code). But some badges might be one-time-only (Million Miler). Add `allow_multiple` flag to adjustment?

2. **Badge display metadata** - Icon, color, image for member-facing display? Could add columns to adjustment table or separate badge_display table.

3. **Badge grouping for display** - How to group badges on member page? By year? By program? By adjustment_code prefix? Maybe just a `badge_group` column on adjustment.

4. **Expiration** - Do badges expire? Probably not, but could add optional expiration for time-limited programs.

---

## Implementation Order

1. Schema: adjustment_type column
2. Schema: promotion reward_type and count_type updates  
3. Server: Badge award logic in promotion processing
4. Server: Skip badges in expiration logic
5. Admin UI: Adjustment type field
6. Admin UI: Promotion badge reward/count options
7. CSR UI: Member badge display section
8. Testing: End-to-end monthly challenge scenario

---

## Summary

**Badge = zero-point adjustment activity that flows through existing promotion machinery.**

Minimal new code. The power comes from configuration - promotions awarding badges, other promotions counting them.
