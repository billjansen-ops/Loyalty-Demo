-- Migration: molecule_id INTEGER -> SMALLINT
-- Date: 2025-12-29
-- Saves 2 bytes per molecule storage row (30M+ rows = 60MB+)
-- Run in transaction, restore from tar if issues

BEGIN;

-- 1. Drop FK constraints
ALTER TABLE zzz_activity_detail_list DROP CONSTRAINT IF EXISTS activity_detail_list_molecule_id_fkey;
ALTER TABLE alias_composite_detail DROP CONSTRAINT IF EXISTS alias_composite_detail_molecule_id_fkey;
ALTER TABLE composite_detail DROP CONSTRAINT IF EXISTS composite_detail_molecule_id_fkey;
ALTER TABLE member_alias DROP CONSTRAINT IF EXISTS member_alias_key_molecule_id_fkey;
ALTER TABLE molecule_column_def DROP CONSTRAINT IF EXISTS molecule_column_def_molecule_id_fkey;
ALTER TABLE molecule_group DROP CONSTRAINT IF EXISTS molecule_group_molecule_id_fkey;
ALTER TABLE molecule_value_boolean DROP CONSTRAINT IF EXISTS molecule_value_boolean_molecule_fk;
ALTER TABLE molecule_value_date DROP CONSTRAINT IF EXISTS molecule_value_date_molecule_fk;
ALTER TABLE molecule_value_embedded_list DROP CONSTRAINT IF EXISTS molecule_value_embedded_list_molecule_id_fkey;
ALTER TABLE zzz_molecule_value_list DROP CONSTRAINT IF EXISTS molecule_value_list_new_molecule_id_fkey;
ALTER TABLE molecule_value_lookup DROP CONSTRAINT IF EXISTS molecule_value_lookup_molecule_id_fkey;
ALTER TABLE molecule_value_numeric DROP CONSTRAINT IF EXISTS molecule_value_numeric_molecule_fk;
ALTER TABLE zzz_molecule_value_ref DROP CONSTRAINT IF EXISTS molecule_value_ref_molecule_fk;
ALTER TABLE molecule_value_text DROP CONSTRAINT IF EXISTS molecule_value_text_molecule_fk;
ALTER TABLE promotion DROP CONSTRAINT IF EXISTS promotion_counter_molecule_fk;

-- 2. Alter all molecule_id columns to SMALLINT
ALTER TABLE molecule_def ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_0" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_1" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_2" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_3" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_4" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_5" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_54" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE "5_data_2244" ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_column_def ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_group ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_boolean ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_date ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_embedded_list ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_lookup ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_numeric ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE molecule_value_text ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE composite_detail ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE alias_composite_detail ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE zzz_activity_detail_list ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE zzz_molecule_value_list ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE zzz_molecule_value_ref ALTER COLUMN molecule_id TYPE SMALLINT;
ALTER TABLE member_alias ALTER COLUMN key_molecule_id TYPE SMALLINT;
ALTER TABLE promotion ALTER COLUMN counter_molecule_id TYPE SMALLINT;

-- 3. Recreate FK constraints
ALTER TABLE zzz_activity_detail_list ADD CONSTRAINT activity_detail_list_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE alias_composite_detail ADD CONSTRAINT alias_composite_detail_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE composite_detail ADD CONSTRAINT composite_detail_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE member_alias ADD CONSTRAINT member_alias_key_molecule_id_fkey FOREIGN KEY (key_molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE molecule_column_def ADD CONSTRAINT molecule_column_def_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE molecule_group ADD CONSTRAINT molecule_group_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE molecule_value_boolean ADD CONSTRAINT molecule_value_boolean_molecule_fk FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE molecule_value_date ADD CONSTRAINT molecule_value_date_molecule_fk FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE molecule_value_embedded_list ADD CONSTRAINT molecule_value_embedded_list_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE zzz_molecule_value_list ADD CONSTRAINT molecule_value_list_new_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) DEFERRABLE;
ALTER TABLE molecule_value_lookup ADD CONSTRAINT molecule_value_lookup_molecule_id_fkey FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id);
ALTER TABLE molecule_value_numeric ADD CONSTRAINT molecule_value_numeric_molecule_fk FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE zzz_molecule_value_ref ADD CONSTRAINT molecule_value_ref_molecule_fk FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE molecule_value_text ADD CONSTRAINT molecule_value_text_molecule_fk FOREIGN KEY (molecule_id) REFERENCES molecule_def(molecule_id) ON DELETE CASCADE;
ALTER TABLE promotion ADD CONSTRAINT promotion_counter_molecule_fk FOREIGN KEY (counter_molecule_id) REFERENCES molecule_def(molecule_id);

-- 4. Update sequence to SMALLINT range
ALTER SEQUENCE molecule_def_molecule_id_seq AS SMALLINT MAXVALUE 32767;

COMMIT;
