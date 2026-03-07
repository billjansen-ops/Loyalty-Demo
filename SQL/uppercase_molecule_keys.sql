-- Uppercase all molecule_key values
UPDATE molecule_def SET molecule_key = UPPER(molecule_key);
UPDATE rule_criteria SET molecule_key = UPPER(molecule_key);
