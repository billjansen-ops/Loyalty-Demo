-- Molecule Groups Schema
-- Enables grouping of molecule values for rules engine (e.g., NYC = JFK, LGA, EWR, HPN)

-- Drop tables if they exist (for re-running)
DROP TABLE IF EXISTS molecule_group_member CASCADE;
DROP TABLE IF EXISTS molecule_group CASCADE;

-- molecule_group: defines a group for a specific molecule
CREATE TABLE molecule_group (
  link CHAR(3) PRIMARY KEY,
  molecule_id INTEGER NOT NULL REFERENCES molecule_def(molecule_id),
  group_code VARCHAR(20) NOT NULL,
  group_name VARCHAR(100),
  description VARCHAR(200),
  status CHAR(1) DEFAULT 'A',  -- A=active, I=inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(molecule_id, group_code)
);

-- molecule_group_member: values belonging to a group
CREATE TABLE molecule_group_member (
  p_link CHAR(3) NOT NULL REFERENCES molecule_group(link) ON DELETE CASCADE,
  value_code VARCHAR(50) NOT NULL,  -- stored uppercase
  PRIMARY KEY(p_link, value_code)
);

-- Indexes for performance
CREATE INDEX idx_molecule_group_molecule ON molecule_group(molecule_id);
CREATE INDEX idx_molecule_group_status ON molecule_group(status);
CREATE INDEX idx_molecule_group_member_value ON molecule_group_member(value_code);

-- Comments
COMMENT ON TABLE molecule_group IS 'Groups of molecule values for rules engine evaluation';
COMMENT ON COLUMN molecule_group.link IS 'Primary key from getNextLink';
COMMENT ON COLUMN molecule_group.group_code IS 'Short code used in rules (e.g., NYC, PREMIUM)';
COMMENT ON COLUMN molecule_group.status IS 'A=active, I=inactive';
COMMENT ON TABLE molecule_group_member IS 'Values belonging to a molecule group';
COMMENT ON COLUMN molecule_group_member.value_code IS 'Uppercase value code (e.g., JFK, DL, F)';

-- Register in link_control if not exists
INSERT INTO link_control (tenant_id, table_name, current_link)
SELECT 0, 'molecule_group', 'AAA'
WHERE NOT EXISTS (
  SELECT 1 FROM link_control WHERE tenant_id = 0 AND table_name = 'molecule_group'
);
