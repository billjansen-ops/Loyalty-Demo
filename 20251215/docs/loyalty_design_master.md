# Loyalty Platform Master Design Record
*(Permanent system design ledger – all foundational architecture and principles)*  

---

## 1. Dynamic Labels & Lookup Architecture
- Each tenant owns its own schema (`t_<tenantkey>`) with tenant-scoped lookup tables (airports, carriers, tiers, etc.).  
- Lookups are **never shared** between tenants.  They are created and seeded during tenant provisioning.  
- Tenants can define custom attributes through a registry table `attr_def` describing name, type, and constraints (`min`, `max`, `regex`, `enum`, etc.).  
- Attribute values are stored in `member_attr` or `activity_attr`, enabling fully dynamic schemas without altering core tables.  
- Labels and terminology are tenant-specific.  Default (“primed”) labels are seeded at onboarding but may be renamed at any time (e.g., “Points” → “Miles”).  
- The rule engine always uses canonical field IDs; display text is controlled by label mappings.  
- Simplicity principle: no versioning or draft system; direct editable tables with uniqueness and NOT NULL constraints only.

---

## 2. Custauth Hook Pattern
- `invoke_hook(name, payload)` is a safe extension point embedded throughout core logic.  
- Default behavior: **no-op**; adding a new hook never changes existing tenant behavior.  
- Each tenant may implement its own handler dispatching on `name` (e.g., `"modify_distance"`).  
- Hooks are typed, sandboxed, and lifecycle-controlled by the platform admin.  
- Purpose: per-tenant customization without altering shared code.  
- Heritage: modern evolution of the original floppy-era `custauth()` approach.

---

## 3. Legacy-Inspired Architecture Principles
- Extensibility points must be **safe when unused**, **harmless when added**, and **discoverable**.  
- Preserve compiled-core reliability with modular, customer-specific flexibility.  
- Cultural continuity from early airline systems—practical safety, modularity, and autonomy.

---

## 4. Point Aging, Buckets, and Redemption Lineage
- **Point Expiration Rules** define accrual validity: each has `start_date`, `end_date`, and `expiration_date`.  
- As activities arrive:
  1. The platform finds the applicable rule (activity date within start/end).  
  2. It checks for an existing **member point bucket** linked to that rule.  
  3. If none exists, a new bucket is created and branded with that rule and its expiration date.  
- Each bucket records `points_accrued`, `points_redeemed`, and its `expiration_date`.  
- Available points = sum of (non-expired buckets) `points_accrued - points_redeemed`.  
- Expirations occur automatically at midnight without batch jobs.  
- Every activity is branded with its `bucket_id`.  
- Redemptions draw from oldest non-expired buckets first; each deduction is logged in a child table mapping `redemption_activity_id`, `bucket_id`, and `points_deducted`.  
- Provides full audit lineage and allows precise reversals.

---

