# New Tenant Setup Checklist

## Purpose
This document is the definitive checklist for setting up a new tenant in the Pointer loyalty platform. Every item listed here is required for a fully functional tenant. Missing any item will cause runtime errors, display failures, or broken features.

This checklist was built from the pain of Session 76-77 where tenant 5 (Wisconsin PHP) was set up piecemeal, resulting in dozens of preventable errors.

---

## Prerequisites

Before starting, you need:
- **Tenant ID** — created via POST /v1/tenants or directly in the tenant table
- **Tenant schema** — the database schema for tenant-specific tables (e.g., t_wi_php)
- **Server running** — most setup uses platform APIs, server must be up

---

## 1. Sysparms (System Parameters)

Every tenant needs these sysparm entries. Compare against tenant 1 (Delta) as the reference.

| Sysparm Key | Value Type | Description | Example (Delta) |
|---|---|---|---|
| **branding** | text | Tenant branding config (colors, logo, text) | Colors, logo URL, company name |
| **activity_display** | text | Display config per activity type (A, R, J, P, M, N) — icon, color, bg_color, border_color, show_bonuses, action_verb | 7 fields × 6 activity types |
| **activity_type** | text | Activity type labels: A, R, J, P, M, N | A=Base Activity, R=Redemption, etc. |
| **activity_type_label** | text | Core unit label (Airline=Flight, Hotel=Stay, Healthcare=Activity) | "Flight" |
| **activity_processing** | text | Processing config: validate function, points mode, calc function | A: validateFlightActivity, calculated, calculateFlightMiles |
| **currency_label** | text | Plural currency name | "Miles", "Points", "Stability Points" |
| **currency_label_singular** | text | Singular currency name | "Mile", "Point", "Stability Point" |
| **error_messages** | text | Error message templates (E001-E006) | E001=Activity too old, E003=Insufficient {currency} |
| **membership_number_offset** | numeric | Offset for link_tank membership numbers | 0 |
| **member_number_length** | numeric | Total length of membership number | 0 (no padding) |
| **check_digit_algorithm** | text | Algorithm for check digit: luhn, mod10, none | "luhn" |
| **max_tier_qualification_days** | numeric | Max days for tier qualification | 365 |
| **retro_days_allowed** | numeric | Max retroactive days for activity posting | 365 |
| **active_through_months** | numeric | Months to extend active_through on activity | 18 |
| **debug** | text | Debug logging: Y or N | "N" |

**How to create:** Use the admin UI or POST /v1/sysparms API.

**⚠️ CRITICAL:** The `activity_display` sysparm drives ALL activity rendering in the CSR page. Without it, the activity list shows no icons, no colors, and generic labels. Each activity type (A, R, J, P, M, N) needs: label, icon, color, bg_color, border_color, show_bonuses, action_verb.

---

## 2. Point Type

Every tenant needs at least one point type.

```bash
POST /v1/point-types
{
  "tenant_id": 5,
  "point_type_code": "BASE",
  "description": "Base points",
  "is_active": true
}
```

---

## 3. Point Expiration Rules

At minimum, a rule covering the current year.

```bash
POST /v1/point-expiration-rules
{
  "tenant_id": 5,
  "rule_key": "R2026",
  "point_type_id": <point_type_id>,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "expiration_date": "2028-12-31"
}
```

Also add rules for adjacent years (R2025, R2027) for retroactive and future-dated activities.

---

## 4. Core Molecules

These molecules are required for EVERY tenant. They enable the bonus system, activity deletion, and point tracking.

### Required for all tenants:

| Molecule Key | Storage | Value Type | Value Kind | Purpose |
|---|---|---|---|---|
| **MEMBER_POINTS** | 54 | composite | — | Points: bucket_link(5) + amount(4) |
| **IS_DELETED** | 0 | — | value | Soft delete flag (presence = deleted) |
| **BONUS_ACTIVITY_LINK** | 5 | link | value | Links parent activity to bonus child |
| **BONUS_RULE_ID** | 2 | key | value | FK to bonus table |

### Common molecules (create as needed per tenant type):

| Molecule Key | Storage | Value Type | Purpose |
|---|---|---|---|
| ACTIVITY_COMMENT | 4 | numeric | Text comment on activity (indexed text) |
| ADJUSTMENT | 2 | key | FK to adjustment table |
| MEMBER_TIER_ON_DATE | 1 | code | Reference: member tier at activity date |
| MEMBER_FNAME | — | — | Reference: member first name |
| MEMBER_STATE | — | — | Reference: member state |
| PROMOTION | 2 | key | FK to promotion table |
| REDEMPTION_TYPE | 2 | key | FK to redemption_rule table |
| PARTNER | 2 | key | FK to partner table |
| PARTNER_PROGRAM | 2 | key | FK to partner_program table |

### Healthcare-specific (tenant 5):

| Molecule Key | Storage | Value Type | Value Kind | Purpose |
|---|---|---|---|---|
| ACCRUAL_TYPE | 1 | code | internal_list | Survey, Compensation, Wearable, etc. |
| SURVEY_LINK | 2 | key | lookup | FK to survey definition table |
| MEMBER_SURVEY_LINK | 4 | numeric | value | FK to member_survey (link_tank value!) |

**⚠️ CRITICAL value_type rule:**
- External table with SERIAL IDs (airports, carriers, properties, surveys, bonuses) → `key`
- Link_tank-generated values (member_survey.link, activity.link) → `numeric`
- Getting this wrong causes integer overflow. See Master doc Section "Choosing value_type".

**How to create:** Use POST /v1/molecules API. See SQL/setup_wi_php_tenant5.sh for examples.

---

## 5. Composite Definition

Each activity type needs a composite that defines which molecules are stored per activity.

At minimum, type 'A' (base accrual) composite:

```bash
PUT /v1/composites
{
  "tenant_id": 5,
  "composite_type": "A",
  "description": "Healthcare Accrual Entry",
  "details": [
    {"molecule_id": <ACCRUAL_TYPE_ID>, "is_required": true, "sort_order": 1},
    {"molecule_id": <MEMBER_SURVEY_LINK_ID>, "is_required": false, "sort_order": 2},
    {"molecule_id": <SURVEY_LINK_ID>, "is_required": false, "sort_order": 3},
    {"molecule_id": <MEMBER_POINTS_ID>, "is_required": true, "sort_order": 100}
  ]
}
```

MEMBER_POINTS is always sort_order 100 (last, system-managed).

---

## 6. Display Templates

Each activity type that appears in the CSR activity list needs Efficient and Verbose display templates.

```bash
POST /v1/display-templates
{
  "tenant_id": 5,
  "template_name": "Healthcare Accrual Efficient",
  "template_type": "E",
  "activity_type": "A",
  "lines": [
    {"line_number": 10, "template_string": "[M,ACCRUAL_TYPE,\"Description\"],[M,SURVEY_LINK,\"Description\"]"}
  ]
}
```

Then activate: POST /v1/display-templates/:id/activate

**Template line syntax:**
- `[T,"text"]` — literal text
- `[M,MOLECULE_KEY,"Code"]` — show molecule code only
- `[M,MOLECULE_KEY,"Description"]` — show molecule description/label only
- `[M,MOLECULE_KEY,"Both"]` — show "CODE - Description"
- `[M,MOLECULE_KEY,"Both",30]` — with max width

**⚠️ NOTE:** The activate endpoint requires a valid session (req.tenantId). If calling via curl without a browser session, activate via direct SQL: `UPDATE display_template SET is_active = true WHERE template_id = N;`

---

## 7. Input Templates (Optional)

Input templates define the CSR data entry form for each activity type. Without them, the "Add Activity" form won't show tenant-specific fields.

Delta has: Flight Entry (type A), Partner Activity Entry (type P), Adjustment Entry (type J), Member Profile Attributes (type M).

---

## 8. Molecule Value Lookup Configuration

For molecules with value_kind='lookup' (e.g., SURVEY_LINK pointing to survey table):

```sql
INSERT INTO molecule_value_lookup (molecule_id, table_name, id_column, code_column, label_column, is_tenant_specific)
VALUES (<molecule_id>, 'survey', 'link', 'survey_code', 'survey_name', true);
```

This tells the display template renderer how to resolve stored IDs to display values.

---

## 9. Internal List Values

For molecules with value_kind='internal_list' (e.g., ACCRUAL_TYPE):

```bash
POST /v1/molecules/<id>/values
{
  "tenant_id": 5,
  "value": "SURVEY",
  "label": "Survey"
}
```

Repeat for each list value. Can also be managed in the molecule admin UI (admin_molecule_edit.html).

---

## 10. Branding

Sysparm 'branding' details for the tenant switcher and header:

| Code | Field | Example |
|---|---|---|
| colors | primary | #1e3a5f |
| colors | accent | #2d8659 |
| logo | url | /logos/wi_php.png |
| logo | alt | Wisconsin PHP |
| text | company_name | Wisconsin PHP |

---

## 11. Link Tank Entries

The link_tank table needs rows for each entity type the tenant will create:

| table_key | link_bytes | Purpose |
|---|---|---|
| member | 5 | Member records |
| activity | 5 | Activity records |
| member_number | 8 | Membership numbers |
| member_point_bucket | 5 | Point bucket records |
| member_promotion | 5 | Promotion enrollments |
| composite | 2 | Composite definitions |
| composite_detail | 2 | Composite detail rows |

**Note:** Link tank entries are usually created automatically when the tenant is first created via the tenant creation process. Verify they exist.

---

## Verification Checklist

After setup, verify each component:

- [ ] Login and switch to tenant — header shows correct name/logo
- [ ] Search for a member — results display correctly  
- [ ] View member activity tab — no "No activity found" unless truly empty
- [ ] Server console — no "Molecule not found" errors
- [ ] About page — shows correct tenant name, ID, server version
- [ ] Submit a test activity — accrual creates, points appear in bucket
- [ ] Activity list — details column shows template-rendered content
- [ ] Efficient/Verbose toggle — both views render

---

## Common Errors and Causes

| Error | Cause | Fix |
|---|---|---|
| "Molecule not found: BONUS_ACTIVITY_LINK" | Missing core molecules | Create BONUS_ACTIVITY_LINK and BONUS_RULE_ID for tenant |
| "No composite defined for tenant X, activity type A" | Missing composite | Create composite via PUT /v1/composites |
| "value out of range for type integer" | Wrong value_type on molecule (key vs numeric) | Check if source is SERIAL (key) or link_tank (numeric) |
| "No activity found" (but data exists) | Missing activity_display sysparm OR display template | Create both |
| Activity shows but details column blank | Missing or inactive display template | Create and activate template |
| "Expiration Rule Not Found" | No point_expiration_rule covering activity date | Create rules for relevant date ranges |
| "tenant_id required" | Session expired or curl without session | Log in again, or pass tenant_id in query/body |

---

## Reference: Setup Scripts

All setup scripts are in the `SQL/` directory:

| Script | Purpose |
|---|---|
| setup_wi_php_tenant5.sh | Created ACCRUAL_TYPE, MEMBER_SURVEY_LINK molecules + composite |
| add_survey_link_molecule.sh | Added SURVEY_LINK molecule + lookup config + updated composite |
| add_accrual_types.sh | Added internal list values for ACCRUAL_TYPE |
| add_bonus_molecules_t5.sh | Created BONUS_ACTIVITY_LINK and BONUS_RULE_ID |
| setup_display_template_t5.sh | Created Efficient + Verbose display templates for type A |
