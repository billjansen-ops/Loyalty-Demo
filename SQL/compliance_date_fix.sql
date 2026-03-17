-- Convert compliance_result.result_date from DATE to SMALLINT (Bill epoch)
-- Preserves existing data by converting through PostgreSQL date_to_molecule_int function

ALTER TABLE compliance_result
  ADD COLUMN result_date_int SMALLINT;

UPDATE compliance_result
  SET result_date_int = date_to_molecule_int(result_date);

ALTER TABLE compliance_result
  DROP COLUMN result_date;

ALTER TABLE compliance_result
  RENAME COLUMN result_date_int TO result_date;

-- Verify
SELECT link, result_date, molecule_int_to_date(result_date) AS display_date
FROM compliance_result LIMIT 5;
