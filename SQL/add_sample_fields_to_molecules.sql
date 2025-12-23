-- Add sample data fields to molecule_def
-- Date: 2025-11-04

ALTER TABLE molecule_def 
  ADD COLUMN sample_code VARCHAR(50),
  ADD COLUMN sample_description VARCHAR(255);

-- Add some default sample data for existing molecules
UPDATE molecule_def SET 
  sample_code = 'BOS',
  sample_description = 'Boston Logan International Airport'
WHERE molecule_key = 'origin';

UPDATE molecule_def SET 
  sample_code = 'MSP',
  sample_description = 'Minneapolis-St. Paul International Airport'
WHERE molecule_key = 'destination';

UPDATE molecule_def SET 
  sample_code = 'DL',
  sample_description = 'Delta Air Lines'
WHERE molecule_key = 'carrier';

UPDATE molecule_def SET 
  sample_code = 'C',
  sample_description = 'Business Class'
WHERE molecule_key = 'fare_class';
