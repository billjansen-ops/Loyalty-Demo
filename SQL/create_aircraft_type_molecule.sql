-- Aircraft Type Molecule
-- Creates molecule definition and 16 aircraft types based on route distance
-- Run from: psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/create_aircraft_type_molecule.sql

BEGIN;

-- 1. Create molecule definition
INSERT INTO molecule_def (tenant_id, molecule_key, label, context, attaches_to, storage_size, value_type, value_kind, molecule_type, description)
VALUES (1, 'aircraft_type', 'Aircraft Type', 'activity', 'A', '1', 'code', 'internal_list', 'D', 'Aircraft type based on route distance');

-- Get the molecule_id we just created
DO $$
DECLARE
    v_molecule_id INTEGER;
BEGIN
    SELECT molecule_id INTO v_molecule_id 
    FROM molecule_def 
    WHERE molecule_key = 'aircraft_type' AND tenant_id = 1;
    
    -- 2. Create embedded list values (16 aircraft, smallest to largest)
    INSERT INTO molecule_value_embedded_list (molecule_id, tenant_id, category, code, description, link)
    VALUES
        (v_molecule_id, 1, 'aircraft_type', 'CRJ2', 'CRJ-200', chr(1)),
        (v_molecule_id, 1, 'aircraft_type', 'E145', 'ERJ-145', chr(2)),
        (v_molecule_id, 1, 'aircraft_type', 'E170', 'Embraer 170', chr(3)),
        (v_molecule_id, 1, 'aircraft_type', 'E175', 'Embraer 175', chr(4)),
        (v_molecule_id, 1, 'aircraft_type', 'CR9', 'CRJ-900', chr(5)),
        (v_molecule_id, 1, 'aircraft_type', 'A319', 'Airbus A319', chr(6)),
        (v_molecule_id, 1, 'aircraft_type', 'B737', 'Boeing 737-700', chr(7)),
        (v_molecule_id, 1, 'aircraft_type', 'A320', 'Airbus A320', chr(8)),
        (v_molecule_id, 1, 'aircraft_type', 'B738', 'Boeing 737-800', chr(9)),
        (v_molecule_id, 1, 'aircraft_type', 'A321', 'Airbus A321', chr(10)),
        (v_molecule_id, 1, 'aircraft_type', 'B739', 'Boeing 737-900', chr(11)),
        (v_molecule_id, 1, 'aircraft_type', 'B752', 'Boeing 757-200', chr(12)),
        (v_molecule_id, 1, 'aircraft_type', 'B763', 'Boeing 767-300', chr(13)),
        (v_molecule_id, 1, 'aircraft_type', 'A333', 'Airbus A330-300', chr(14)),
        (v_molecule_id, 1, 'aircraft_type', 'B772', 'Boeing 777-200', chr(15)),
        (v_molecule_id, 1, 'aircraft_type', 'A359', 'Airbus A350-900', chr(16));
    
    RAISE NOTICE 'Created aircraft_type molecule (id: %) with 16 aircraft types', v_molecule_id;
END $$;

COMMIT;

-- Verify
SELECT molecule_id, molecule_key, attaches_to, storage_size, value_type, value_kind 
FROM molecule_def 
WHERE molecule_key = 'aircraft_type' AND tenant_id = 1;

SELECT code, description, ascii(link) as link_value
FROM molecule_value_embedded_list 
WHERE molecule_id = (SELECT molecule_id FROM molecule_def WHERE molecule_key = 'aircraft_type' AND tenant_id = 1)
ORDER BY ascii(link);
