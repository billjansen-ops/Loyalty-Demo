-- create_member_search_indexes.sql
-- Create composite indexes for multi-tenant member search
-- Run on: loyalty, loyaltytest, loyaltybackup

-- Drop existing single-column indexes
DROP INDEX IF EXISTS idx_member_lname;
DROP INDEX IF EXISTS idx_member_email;
DROP INDEX IF EXISTS idx_member_phone;
DROP INDEX IF EXISTS idx_member_membership_number;

-- Create composite indexes (tenant_id first for multi-tenant efficiency)
CREATE INDEX idx_member_tenant_lname ON member(tenant_id, lname);
CREATE INDEX idx_member_tenant_email ON member(tenant_id, email);
CREATE INDEX idx_member_tenant_phone ON member(tenant_id, phone);
CREATE INDEX idx_member_tenant_membership_number ON member(tenant_id, membership_number);

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'member' 
ORDER BY indexname;
