-- Migration script: Populate per-tenant member_number counters
-- Sets next_link to MAX(membership_number) + 1 for each tenant
-- Run with: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/migrate_member_number_link_tank.sql

-- Delta (tenant_id = 1)
INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
SELECT 1, 'member_number', 8, COALESCE(MAX(membership_number::BIGINT), 0) + 1
FROM member
WHERE tenant_id = 1;

-- Marriott (tenant_id = 3)
INSERT INTO link_tank (tenant_id, table_key, link_bytes, next_link)
SELECT 3, 'member_number', 8, COALESCE(MAX(membership_number::BIGINT), 0) + 1
FROM member
WHERE tenant_id = 3;

-- Verify
SELECT tenant_id, table_key, link_bytes, next_link FROM link_tank WHERE table_key = 'member_number' ORDER BY tenant_id;
