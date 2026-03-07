# Token & Badge System Design

**Date:** January 1, 2026
**Status:** Brainstorming / Design Phase - No Code Written

---

## Concept

**Tokens** are zero-point awards that can be counted by promotions. This enables "meta-promotions" where completing promotions earns tokens, and accumulating tokens unlocks bigger rewards.

**Badges** are zero-point awards for display/achievement purposes. They are NOT counted by promotions - they're trophies.

| | Token | Badge |
|---|---|---|
| Purpose | Counted toward goals | Displayed as achievement |
| Counted by promos | Yes | No |
| Storage | Activity (adjustment_type = 'T') | member_badge table |
| Shows in | Activity timeline | Badges tab (like tiers) |
| Used as criteria | No | Yes (like tier filtering) |
| Display | Minimal | Prominent |

---

## Example: Delta Monthly Challenge Program

**12 Monthly Challenges:**
- January: Fly to Florida → 1,000 miles + 1 token
- February: Visit New York → 1,000 miles + 1 token
- March: Fly First Class → 1,000 miles + 1 token
- ... etc.

**12 Accumulation Promotions:**
- Complete 1 challenge → 500 points
- Complete 2 challenges → 1,000 points
- Complete 3 challenges → 1,500 points
- ...
- Complete 12 challenges → Diamond status + "2025 Challenge Champion" badge

**Flow:**
1. Member flies MSP → MIA (Florida)
2. Flight activity triggers promotion evaluation
3. January Challenge qualifies (criteria: destination in Florida)
4. January Challenge awards results: 1,000 miles + 1 token
5. Token activity created (zero-point adjustment)
6. Token triggers promotion evaluation
7. Accumulation Promo #1 qualifies (count_type = tokens, goal = 1)
8. Accumulation Promo #1 awards: 500 points
9. Accumulation Promos #2-12 increment progress_counter to 1

When February completes, same flow - Promo #2 qualifies, #3-12 increment.

After 12th challenge - Promo #12 qualifies, awards Diamond status + badge.

---

## Multi-Path Token Earning

Tokens enable flexible program design. Same token, different sources:

**Example: Partner Challenge**
- Promo A: 3 Hertz rentals → award 1 "Partner Token"
- Promo B: 2 Flights → award 1 "Partner Token"  
- Promo C: count_type = tokens, goal = 2 → prize

Member can earn 2 tokens any way: both from Hertz, both from flights, or one of each. Promo C just counts total tokens.

---

## Key Insight

**Tokens ARE adjustment activities.** They flow through the existing promotion evaluation system like any other activity and trigger promotion counting.

**Badges are member attributes** (like tier). They're stored in their own table, displayed on their own tab, and can be used as criteria in bonus/promotion rules.

---

## Schema Changes

### 1. Adjustment Table

Add `adjustment_type` column:

```sql
ALTER TABLE adjustment ADD COLUMN adjustment_type CHAR(1) DEFAULT 'A'
  CHECK (adjustment_type IN ('A', 'T'));

COMMENT ON COLUMN adjustment.adjustment_type IS 'A=Adjustment (points), T=Token (countable, zero-point)';
```

Token definitions:
- `adjustment_type = 'T'`
- `fixed_points = 0`
- `adjustment_code` identifies the token (e.g., 'CHALLENGE-TOKEN-2025')
- `adjustment_name` is display name (e.g., 'Monthly Challenge Token')

### 2. Badge Tables (NEW)

Badge definitions (tenant-level):

```sql
CREATE TABLE badge_definition (
    badge_id SERIAL PRIMARY KEY,
    tenant_id SMALLINT NOT NULL,
    badge_code VARCHAR(30) NOT NULL,
    badge_name VARCHAR(100) NOT NULL,
    badge_description TEXT,
    badge_group VARCHAR(50),        -- for organizing display (e.g., '2025 Challenges', 'Lifetime')
    icon VARCHAR(50),               -- emoji or icon class
    color VARCHAR(20),              -- hex color for display
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, badge_code)
);
```

Member badges earned (member-level):

```sql
CREATE TABLE member_badge (
    member_badge_id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES member(member_id),
    badge_id INTEGER NOT NULL REFERENCES badge_definition(badge_id),
    tenant_id SMALLINT NOT NULL,
    earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    awarded_by_promotion_id INTEGER REFERENCES promotion(promotion_id),
    awarded_by_user_id INTEGER,     -- if manually awarded by CSR/admin
    notes VARCHAR(200),
    UNIQUE(member_id, badge_id)     -- member can only earn each badge once (or remove for repeatable)
);

CREATE INDEX idx_member_badge_member ON member_badge(member_id);
```

### 2. Promotion Table - What to Count

Add 'tokens' to count_type with corresponding token selector:

```sql
ALTER TABLE promotion DROP CONSTRAINT promotion_count_type_check;
ALTER TABLE promotion ADD CONSTRAINT promotion_count_type_check 
  CHECK (count_type IN ('flights', 'miles', 'enrollments', 'molecules', 'tokens'));

ALTER TABLE promotion ADD COLUMN counter_token_adjustment_id INTEGER REFERENCES adjustment(adjustment_id);

ALTER TABLE promotion ADD CONSTRAINT promotion_token_counter_required 
  CHECK ((count_type = 'tokens' AND counter_token_adjustment_id IS NOT NULL) 
      OR (count_type != 'tokens' AND counter_token_adjustment_id IS NULL));
```

When count_type = 'tokens':
- Show token picker (adjustments where type = 'T')
- Select ONE specific token to count
- goal_amount = how many of that token needed

**UI Pattern for count_type:**

| count_type | Secondary Picker |
|------------|------------------|
| Flights | None |
| Miles | None |
| Enrollments | None |
| Molecules | Molecule picker (existing) |
| Tokens | Token picker (new) |

### 3. Promotion Results Table (NEW)

Replace single reward columns with 0-n results per promotion:

```sql
CREATE TABLE promotion_result (
    promotion_result_id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    tenant_id SMALLINT NOT NULL,
    result_type VARCHAR(20) NOT NULL CHECK (result_type IN ('points', 'tier', 'external', 'enroll', 'token', 'badge')),
    result_amount INTEGER,           -- points amount, or quantity for tokens
    result_reference_id INTEGER,     -- tier_id, promotion_id, or adjustment_id depending on type
    result_description VARCHAR(200), -- for external rewards
    duration_type VARCHAR(10),       -- for tier: 'calendar' or 'virtual'
    duration_end_date DATE,          -- for tier with calendar duration
    duration_days INTEGER,           -- for tier with virtual duration
    sort_order SMALLINT DEFAULT 0
);

CREATE INDEX idx_promotion_result_promotion ON promotion_result(promotion_id);
```

**Result types:**

| result_type | result_amount | result_reference_id | result_description |
|-------------|---------------|---------------------|-------------------|
| points | point amount | NULL | NULL |
| tier | NULL | tier_id | NULL |
| external | quantity (optional) | NULL | description text |
| enroll | NULL | promotion_id | NULL |
| token | quantity (default 1) | adjustment_id (type T) | NULL |
| badge | NULL | badge_id | NULL |

**Migration:** Convert existing reward columns to rows in promotion_result, then drop old columns.

### 4. Remove Old Reward Columns (after migration)

```sql
ALTER TABLE promotion DROP COLUMN reward_type;
ALTER TABLE promotion DROP COLUMN reward_amount;
ALTER TABLE promotion DROP COLUMN reward_tier_id;
ALTER TABLE promotion DROP COLUMN reward_promotion_id;
-- Keep duration columns as they apply to tier results
```

---

## Logic Changes

### 1. Promotion Qualification - Award Results

When promotion qualifies, process all rows from promotion_result:

```
For each result in promotion_result where promotion_id = qualified_promo:
  
  If result_type = 'points':
    Award result_amount points (existing logic)
  
  If result_type = 'tier':
    Award tier result_reference_id with duration (existing logic)
  
  If result_type = 'external':
    Log/record external reward (existing logic)
  
  If result_type = 'enroll':
    Enroll member in promotion result_reference_id (existing logic)
  
  If result_type = 'token':
    For i = 1 to result_amount:
      Create adjustment activity with adjustment_id = result_reference_id
      Call promotion evaluation on token activity
  
  If result_type = 'badge':
    Insert row into member_badge (member_id, badge_id, earned_date, awarded_by_promotion_id)
    (No promotion evaluation triggered - badges aren't counted)
```

### 2. Promotion Evaluation (for count_type = 'tokens')

When evaluating an activity against a promotion with count_type = 'tokens':
- Check if activity is an adjustment with adjustment_type = 'T'
- Check if activity's adjustment_id matches promotion's counter_token_adjustment_id
- If match, increment progress_counter

Simple direct match - no criteria evaluation needed for token counting.

### 3. Badges as Criteria

Badges can be used in bonus and promotion criteria, similar to member tier:

**Criteria source expansion:**
- Activity (molecules) - existing
- Member (tier, state, etc.) - existing  
- Member.badge - NEW

**Example criteria:**
- Member.badge = 'MILLION_MILER' → qualifies for bonus
- Member.badge = 'FOUNDING_MEMBER' → eligible for exclusive promo

**Implementation:**
Add 'Member Badge' to criteria source dropdown. When selected, show badge picker (from badge_definition). Evaluation checks member_badge table for existence of that badge.

```sql
-- Criteria evaluation for badge
SELECT 1 FROM member_badge mb
JOIN badge_definition bd ON mb.badge_id = bd.badge_id
WHERE mb.member_id = ? AND bd.badge_code = ?
```

### 4. Point Expiration

Skip tokens - they have zero points, nothing to expire.
Badges aren't activities, so not involved in expiration.

### 5. Infinite Loop Protection

**Risk:** Promo awards token → token triggers promo → promo awards token → infinite loop

**Safeguards:**

1. **Hard depth limit** - If evaluation chain exceeds 10 levels, stop and log error. Non-configurable safety net.

2. **Same-promo guard** - A token activity cannot qualify the same promotion that awarded it.

3. **Circuit breaker** - If same member gets more than X rewards from same promotion in single transaction, stop and log.

4. **Transaction rollback** - If loop detected, rollback entire transaction.

---

## UI Changes

### 1. Adjustment Admin

- Add adjustment_type dropdown: Adjustment / Token
- When Token selected: lock fixed_points to 0
- Filter/tab to show Adjustments vs Tokens

### 2. Badge Admin (NEW)

New admin page for badge_definition:
- List badges with code, name, group, icon, color
- Add/Edit badge definition
- Similar pattern to tier_definition admin

### 3. Promotion Admin - What to Count

count_type dropdown with conditional secondary picker:

- Flights → (no picker)
- Miles → (no picker)
- Enrollments → (no picker)
- Molecules → molecule picker dropdown
- Tokens → token picker dropdown (adjustments where type = 'T')

### 4. Promotion Admin - Results (REDESIGN)

Replace checkbox grid with results list:

**Current UI:**
```
Rewards:
☐ Points [____]
☐ Tier Status [dropdown] [date]
☐ External Reward [____]
☐ Registration [dropdown]
```

**New UI:**
```
Results:
┌─────────────────────────────────────────────────────┐
│ Points: 5,000                              [Delete] │
├─────────────────────────────────────────────────────┤
│ Tier: Diamond until 12/31/2027             [Delete] │
├─────────────────────────────────────────────────────┤
│ Token: Challenge Token (qty: 1)            [Delete] │
├─────────────────────────────────────────────────────┤
│ Badge: 2025 Challenge Champion             [Delete] │
├─────────────────────────────────────────────────────┤
│ External: Free Upgrade Coupon (qty: 2)     [Delete] │
└─────────────────────────────────────────────────────┘
[+ Add Result]
```

Add Result opens picker:
- Type dropdown: Points / Tier / External / Enroll / Token / Badge
- Conditional fields based on type
- Badge type shows badge_definition picker

### 5. Criteria Editor - Badge Support

Add 'Member Badge' to criteria source dropdown:

**Criteria sources:**
- Activity (molecules) - existing
- Member (fields/molecules) - existing
- Member Badge - NEW

When 'Member Badge' selected:
- Operator: has / does not have
- Value: badge picker (from badge_definition)

Example: "Member Badge has Million Miler"

### 6. Member Tokens Display

In activity timeline (existing tab):
- Tokens appear as activities
- "Jan 15: Challenge Token awarded"
- Grouped with other adjustments

### 7. Member Badges Tab (NEW)

New tab on CSR member page (like Tiers tab):

```
┌─────────────────────────────────────────────────────┐
│ 🏆 2025 Challenge Champion                          │
│ Earned: Dec 31, 2025                                │
│ From: Complete 12 Monthly Challenges                │
├─────────────────────────────────────────────────────┤
│ ⭐ Million Miler                                    │
│ Earned: Mar 15, 2023                                │
│ Lifetime achievement                                │
├─────────────────────────────────────────────────────┤
│ 🎖️ Founding Member                                  │
│ Earned: Jan 1, 2020                                 │
│ Charter member since program launch                 │
└─────────────────────────────────────────────────────┘
```

Query:
```sql
SELECT bd.badge_code, bd.badge_name, bd.badge_description, 
       bd.icon, bd.color, bd.badge_group,
       mb.earned_date, p.promotion_name
FROM member_badge mb
JOIN badge_definition bd ON mb.badge_id = bd.badge_id
LEFT JOIN promotion p ON mb.awarded_by_promotion_id = p.promotion_id
WHERE mb.member_id = ?
ORDER BY mb.earned_date DESC
```

---

## Other Use Cases

This pattern supports:

- **Challenge programs** - monthly challenges → tokens → accumulation rewards
- **Multi-path earning** - different promos award same token type
- **Tiered rewards** - 1 token = small prize, 12 tokens = big prize
- **Referral program** - refer friend → token. 5 tokens → bonus.
- **Product cross-sell** - hotel + car + card → tokens → "Trifecta" reward
- **Partner ecosystem** - multi-partner engagement tokens → rewards
- **Rich reward bundles** - one promo awards points + tier + external + badge
- **Gamification** - visible badge achievements for members
- **Badge-based bonuses** - Million Miler badge → 3x miles on all flights
- **Exclusive access** - Founding Member badge → eligible for invite-only promos

---

## Open Questions

1. **Badge uniqueness** - Current design has UNIQUE(member_id, badge_id) so member can only earn each badge once. Remove constraint for repeatable badges? Or add `allow_multiple` flag to badge_definition?

2. **Token expiration** - Do tokens expire? Probably not for most programs, but could add optional expiration date to adjustment definition for time-limited programs.

3. **External reward fulfillment** - How are external rewards (upgrade coupons, bag tags) actually fulfilled? Integration point or manual process?

4. **Badge revocation** - Can badges be revoked? (e.g., status match expires). Add revoked_date column to member_badge?

5. **Badge display order** - Sort by earned_date, or by badge_group, or custom sort_order on badge_definition?

---

## Implementation Order

1. Schema: adjustment_type column (A/T)
2. Schema: badge_definition table
3. Schema: member_badge table
4. Schema: promotion_result table
5. Schema: counter_token_adjustment_id on promotion
6. Schema: count_type constraint update
7. Server: Migrate existing reward data to promotion_result
8. Server: Award multiple results when promotion qualifies
9. Server: Token activities trigger promotion evaluation
10. Server: Token counting in promotion evaluation
11. Server: Badge awarding (insert to member_badge)
12. Server: Badge criteria evaluation
13. Server: Skip zero-point adjustments in expiration
14. Server: Infinite loop protection
15. Admin UI: Adjustment type field (A/T)
16. Admin UI: Badge definition admin page
17. Admin UI: Promotion results list (add/remove)
18. Admin UI: Token picker for count_type
19. Admin UI: Badge picker for results
20. Admin UI: Criteria editor - Member Badge source
21. CSR UI: Member badges tab
22. Testing: End-to-end monthly challenge scenario
23. Testing: Badge criteria in bonus rules
24. Schema: Drop old reward columns from promotion

---

## Summary

**Relatively minor changes to existing processes - greatly expanded capabilities.**

| Change | Impact |
|--------|--------|
| adjustment_type column (A/T) | Small |
| badge_definition table | Small |
| member_badge table | Small |
| promotion_result table | Medium |
| count_type = 'tokens' | Small |
| Multi-result awarding | Medium |
| Badge criteria support | Medium |
| Loop protection | Small |
| UI updates | Medium |

**Capabilities unlocked:**
- Token-based challenge programs
- Multi-path token earning
- Tiered accumulation rewards
- Rich multi-reward bundles
- Display badges/achievements
- Badge-based bonus rules (Million Miler → 3x miles)
- Badge-based promo eligibility (Founding Member → exclusive access)
- Partner cross-promotion programs
