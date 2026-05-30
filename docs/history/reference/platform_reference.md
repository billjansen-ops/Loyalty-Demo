# Loyalty Platform – Transfer & Onboarding Document (Complete Reference)

## 1. Executive Overview

The Loyalty Platform is a multi-tenant, extensible system for managing customer reward programs.  
It is designed around stability, tenant isolation, and flexibility — enabling unique business logic for each tenant while preserving a stable, shared core.  
The guiding ethos is: **“When the world says no, figure it out anyway.”**

---

## 2. Core Concepts – Program Molecules

Program Molecules define dynamic schema configuration across tenants.  
Each molecule represents a data attribute such as *Carrier*, *Origin*, or *Fare Class*.  
These molecules are linked to lookup tables that standardize values and relationships while maintaining tenant independence.

Program Molecules attach directly to accruals, redemptions, and promotions.  
For example, a *Carrier* molecule references its lookup table and joins on canonical keys during activity ingest, ensuring uniform business logic without rigid schema constraints.

---

## 3. Tenant & Data Model

Each tenant has its own schema (`t_<tenantkey>`), isolating data and logic.  
Lookup and label architecture ensures non-shared lookups, while dynamic attributes (`attr_def`, `member_attr`, `activity_attr`) allow per-tenant extensibility.

Field labels are editable per tenant — default labels are seeded during onboarding.  
Canonical keys drive internal logic; labels drive UI and rule-builder terminology.

---

## 4. Hooks & Extensibility – Custauth Heritage

The system extends the original `custauth()` model, allowing safe, tenant-specific overrides.  
Hooks are defined as `invoke_hook(name, payload)` and default to no-ops unless implemented by a tenant.  
Example: the `modify_distance` hook applies a multiplier for Canadian Airlines without affecting others.

---

## 5. Rules & Promotions Engine

Promotions, bonuses, and tier management are driven by a unified Rules Engine.  
Each promotion tracks progress, qualification, and award state (`ACTIVE → QUALIFIED → AWARDED`).  
Actions can issue points, trigger external APIs, enroll in other promotions, or update tier levels.

Actions run atomically, and side effects use an **outbox pattern** to ensure reliable delivery after database commit.

---

## 6. Concurrency & Safety

Concurrency control is implemented with row-level locking:  
`SELECT ... FOR UPDATE` on the member row during any member-affecting transaction.  
This prevents race conditions and maintains balance integrity.  
Batch workers use `SKIP LOCKED` for asynchronous operations.

---

## 7. Activity Architecture

Activity data can come from mock data or live database queries, toggled via a runtime flag.  
The Activity page uses `normalizeActivity()` to standardize data from either source.  
The *Magic Box* structure displays key attributes such as *Origin*, *Destination*, *Carrier*, and *Fare Class*.

---

## 8. Promotions & Tier Management

Promotions link to per-member counters and participation cycles.  
Tier thresholds (e.g., 20k = Silver, 40k = Gold) are defined as promotion-style rules, ensuring consistency and auditability.

Awards and tier changes are idempotent, logged in history tables, and governed by carryover policies.

---

## 9. Implementation Principles

Tenant provisioning seeds lookup tables, labels, and attribute definitions.  
Default states are always safe — hooks default to no-ops, and unconfigured features remain inert until enabled.  
Design motto: *Safe when unused, harmless when added, easily discoverable.*

---

## 10. Files & API Components

Key working API endpoints:

```
/v1/member/:id/balances
/v1/member/:id/activities
/v1/member/:id/buckets
/v1/member/search
```

Front-end files include `activity.html`, `activity-pretty.js`, and `server_db_api.js`, all of which align under the singular path pattern (`/v1/member/...` rather than `/v1/members/...`).

---

## 11. Next Steps

- Merge mock and database activity sources into a unified handler.  
- Extend the promotions engine with additional actions, including partner integrations and wallet-based redemptions.  
- Ensure future versions preserve tenant safety and modularity.

---

## 12. Program Molecules – Deep Dive

Program Molecules are the foundation of the Loyalty Platform’s flexibility.  
They abstract all variable, tenant-defined data (like *Carrier*, *Origin*, *Fare Class*, *Horsepower*, *Shoe Size*, etc.) into small, typed components that can attach to any core entity — typically **Member** or **Activity**.

### Structure

Each molecule consists of a **label** (human-readable name) and a **value**.  
For example, a simple molecule might be `Horsepower = 738`.  
More complex molecules reference lookup lists such as *Carrier Codes*, which link to external lookup tables that can differ per tenant.

| Property | Description |
|-----------|-------------|
| Label | Human-readable name (e.g., Horsepower, Carrier Code, Origin). |
| Value Type | Defines whether the value is numeric, string, enum, or lookup reference. |
| Value | Actual stored or referenced value (e.g., 738, XL, or record_id 716). |
| Scope | The entity the molecule attaches to (Member, Activity, Promotion, etc.). |

Instead of storing raw business terms directly on records, molecules store **references (foreign keys)** to lookup rows, ensuring integrity and tenant independence.  
For example, `LGA` is not stored as `"LGA"` but as `lookup_airport.id = 716`.

---

### Types of Molecules

- **A. Simple Scalar Molecules:** direct values, e.g., `Horsepower = 738`  
- **B. Enumerated Molecules:** small tenant lists, e.g., `Size = S, M, L, XL`  
- **C. Lookup Molecules:** reference external tables, e.g., `Carrier Code = BJ (lookup_carrier.id = 12)`  

---

### Lookup Table Architecture

Each tenant has its own schema (`t_<tenantkey>`) and private lookup tables (e.g., `lookup_airport`, `lookup_carrier`).  
These are seeded at onboarding and can be edited independently, ensuring that tenants never affect each other.

---

### Attachment Points

Molecules can attach to different entities:

- **Member Molecules:** e.g., `Shoe Size = 9` (stored in `member_attr`)  
- **Activity Molecules:** e.g., `Origin = lookup_airport.id = 716` (stored in `activity_attr`)  

Promotion and bonus engines consume these molecules dynamically.

---

### Example: Fly Into LGA and Get Double Points

**Business rule:** If an activity’s destination is LGA, award double points.

**Process:**  
1. Destination molecule references `lookup_airport.id = 716`.  
2. Rule engine evaluates condition `IF destination == 716 THEN multiplier = 2`.  
3. Multiplier applied to base miles; award posted as new accrual.  
4. All resolved dynamically via metadata — no schema changes required.

---

### Extensibility

Program Molecules make the platform *schema-less but structured*.  
Each tenant defines its own molecules, and rules, promotions, and APIs adapt automatically to the available definitions.

---

### Key Benefits

| Benefit | Explanation |
|----------|-------------|
| Flexibility | Add new data points (e.g., Engine Type, Purchase Channel) without schema changes. |
| Isolation | Each tenant’s definitions and lookups are independent. |
| Referential Integrity | Values reference canonical lookup tables for accuracy. |
| Dynamic Rules | Promotions and bonuses can evaluate molecules directly. |
| Cross-domain Reuse | Shared lookups like Airport serve multiple molecules (Origin, Destination). |

---
