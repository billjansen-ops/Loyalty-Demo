# Technical Debt & Future Improvements

## Database Schema

### High Priority

**1. Change tenant_id from BIGINT to INTEGER**
- **Why:** BIGINT (8 bytes) is overkill for tenant count (will have thousands, not billions)
- **Impact:** Smaller storage, faster joins, better cache utilization
- **Effort:** Medium (need to cascade through all foreign keys)
- **Tables affected:** tenant, tenant_config, tenant_settings, and any FK references
- **SQL:**
  ```sql
  ALTER TABLE tenant ALTER COLUMN tenant_id TYPE INTEGER;
  ALTER TABLE tenant_config ALTER COLUMN tenant_id TYPE INTEGER;
  ALTER TABLE tenant_settings ALTER COLUMN tenant_id TYPE INTEGER;
  -- etc. for all FK references
  ```

### Medium Priority

**2. Review all ID column types**
- **Check if appropriate:**
  - BIGINT for high-volume (activity_id, member_id, point_lot_id) ✅
  - INTEGER for reference data (carrier_id, airport_id, bonus_id) ✅?
  - SMALLINT for tiny lookups (tier_id - only 3-5 values)
- **Audit current schema and right-size**

**3. Create flexible config system**
- **Add to settings table:**
  - value_type, category, label, description
  - do_not_delete, superuser_only flags
- **Create tenant_config table:**
  - Flexible key/value for tenant-specific config
  - Inherits from config_definition
- **See:** Technical design discussion from Nov 2, 2025

### Lower Priority

**4. Add indexes for common queries**
- Review query patterns
- Add indexes where needed
- Document index strategy

## Admin Interfaces

### To Build

**1. Client Admin Config Page** (`/admin_config.html`)
- Edit tenant configuration
- Only shows non-superuser settings
- Respects is_locked flags

**2. Superuser Admin Config Page** (`/superadmin_config.html`)
- Tab 1: Manage config definitions (master)
- Tab 2: Edit any tenant's config
- Can set flags and manage all settings

**3. Molecule Maintenance Page** (`/admin_molecules.html`)
- Add/edit/delete molecule definitions
- No SQL required
- Self-service molecule management
- **See:** MOLECULE_MAINTENANCE_PLAN.md

## Code Quality

### To Address

**1. Extract shared criteria evaluation**
- Currently embedded in test-rule endpoint
- Should be reusable function for bonus engine AND promotion engine
- **Note:** May already be fine as-is, evaluate if refactor needed

**2. Session handoff documentation**
- Create STATUS.md template for session starts
- Document what's working vs. what's new
- Prevent confusion about existing vs. needed work

**3. Add comprehensive error handling**
- Standardize error responses
- Add validation helpers
- Better client-side error messages

## Features

### Planned

**1. Promotion Engine**
- Uses same rule_criteria evaluation (shared with bonus engine)
- Different header checks (enrollment period vs. date range)
- Promotion-specific actions

**2. Advanced Rule Features**
- Rule groups (complex nested logic)
- Time-based rules (weekday, time-of-day, seasonal)
- Velocity rules (max 5 bonuses per month)
- Contribution tracking enhancements

**3. Reporting & Analytics**
- Member segment analysis
- Rule performance metrics
- Earning pattern visualization
- Promotion ROI calculation

**4. Partner Integration APIs**
- REST API for activity posting
- Webhook notifications
- Bulk import tools
- Real-time balance lookups

## Documentation

### To Create

**1. API Documentation**
- Endpoint reference
- Request/response examples
- Authentication guide

**2. Database Schema Documentation**
- Entity relationship diagrams
- Table descriptions
- Index strategy

**3. Deployment Guide**
- Production setup
- Environment configuration
- Monitoring and alerting

**4. Development Guide**
- Local setup
- Testing procedures
- Code standards

## Performance

### To Measure & Optimize

**1. Query Performance Audit**
- Identify slow queries
- Add missing indexes
- Optimize joins

**2. Load Testing**
- Activity posting under load
- Bonus evaluation performance
- Concurrent user handling

**3. Caching Strategy**
- What to cache (lookups, config)
- Cache invalidation
- Redis integration?

## Security

### To Review

**1. Authentication & Authorization**
- Tenant isolation verification
- Role-based access control
- API key management

**2. Input Validation**
- SQL injection prevention (using parameterized queries ✅)
- XSS prevention
- Data sanitization

**3. Audit Logging**
- Track config changes
- Monitor admin actions
- Security event logging

---

## Completed ✅

**Nov 2, 2025:**
- ✅ Rule criteria evaluation with AND/OR logic
- ✅ Visual rule builder (admin_bonus_edit.html)
- ✅ Criteria CRUD endpoints
- ✅ Test-rule endpoint for validation
- ✅ Multi-line diagnostic feedback
- ✅ Connected criteria evaluation to bonus engine
- ✅ Added origin, fare_class, flight_number molecules
- ✅ Fixed reload after criteria save/delete
- ✅ Multi-context rules (Activity AND Member)

**Previous:**
- ✅ Activity posting with molecules
- ✅ Bonus evaluation engine (date-based)
- ✅ Point bucket management
- ✅ Temporal design (retro-posting works)
- ✅ Multi-tenant isolation
- ✅ Program molecules architecture

---

**How to use this document:**

1. **Before each session:** Review this list, decide priorities
2. **During session:** Mark items as in-progress
3. **After session:** Move completed items to ✅ section, add new items discovered
4. **Hand off to new session:** Include this with STATUS.md

**Don't forget about tenant_id BIGINT→INTEGER when we do schema cleanup!** 🎯
