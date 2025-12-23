-- Create state molecule (internal_list for dropdown)
INSERT INTO molecule_def (
  molecule_id, molecule_key, label, value_kind, tenant_id, context,
  is_static, is_permanent, is_required, is_active, description,
  display_order, input_type, molecule_type, value_structure, storage_size, value_type, attaches_to
) VALUES (
  51, 'state', 'US State', 'internal_list', 1, 'member',
  true, false, false, true, 'US states and territories for address lookup',
  0, 'P', 'S', 'single', '1', 'code', 'M'
);

-- Add all 50 states + DC
INSERT INTO molecule_value_text (molecule_id, text_value, display_label, sort_order, is_active) VALUES
(51, 'AL', 'Alabama', 1, true),
(51, 'AK', 'Alaska', 2, true),
(51, 'AZ', 'Arizona', 3, true),
(51, 'AR', 'Arkansas', 4, true),
(51, 'CA', 'California', 5, true),
(51, 'CO', 'Colorado', 6, true),
(51, 'CT', 'Connecticut', 7, true),
(51, 'DE', 'Delaware', 8, true),
(51, 'DC', 'District of Columbia', 9, true),
(51, 'FL', 'Florida', 10, true),
(51, 'GA', 'Georgia', 11, true),
(51, 'HI', 'Hawaii', 12, true),
(51, 'ID', 'Idaho', 13, true),
(51, 'IL', 'Illinois', 14, true),
(51, 'IN', 'Indiana', 15, true),
(51, 'IA', 'Iowa', 16, true),
(51, 'KS', 'Kansas', 17, true),
(51, 'KY', 'Kentucky', 18, true),
(51, 'LA', 'Louisiana', 19, true),
(51, 'ME', 'Maine', 20, true),
(51, 'MD', 'Maryland', 21, true),
(51, 'MA', 'Massachusetts', 22, true),
(51, 'MI', 'Michigan', 23, true),
(51, 'MN', 'Minnesota', 24, true),
(51, 'MS', 'Mississippi', 25, true),
(51, 'MO', 'Missouri', 26, true),
(51, 'MT', 'Montana', 27, true),
(51, 'NE', 'Nebraska', 28, true),
(51, 'NV', 'Nevada', 29, true),
(51, 'NH', 'New Hampshire', 30, true),
(51, 'NJ', 'New Jersey', 31, true),
(51, 'NM', 'New Mexico', 32, true),
(51, 'NY', 'New York', 33, true),
(51, 'NC', 'North Carolina', 34, true),
(51, 'ND', 'North Dakota', 35, true),
(51, 'OH', 'Ohio', 36, true),
(51, 'OK', 'Oklahoma', 37, true),
(51, 'OR', 'Oregon', 38, true),
(51, 'PA', 'Pennsylvania', 39, true),
(51, 'RI', 'Rhode Island', 40, true),
(51, 'SC', 'South Carolina', 41, true),
(51, 'SD', 'South Dakota', 42, true),
(51, 'TN', 'Tennessee', 43, true),
(51, 'TX', 'Texas', 44, true),
(51, 'UT', 'Utah', 45, true),
(51, 'VT', 'Vermont', 46, true),
(51, 'VA', 'Virginia', 47, true),
(51, 'WA', 'Washington', 48, true),
(51, 'WV', 'West Virginia', 49, true),
(51, 'WI', 'Wisconsin', 50, true),
(51, 'WY', 'Wyoming', 51, true);

-- Delete state sysparm and its details
DELETE FROM sysparm_detail WHERE sysparm_id = (SELECT sysparm_id FROM sysparm WHERE sysparm_key = 'state' AND tenant_id = 1);
DELETE FROM sysparm WHERE sysparm_key = 'state' AND tenant_id = 1;
