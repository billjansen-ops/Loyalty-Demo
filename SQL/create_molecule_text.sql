-- Create direct text table (no deduplication, no index on text)
CREATE TABLE public.molecule_text (
    text_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text_value TEXT NOT NULL
);

COMMENT ON TABLE public.molecule_text IS 'Direct text storage for unique values (passport, confirmation codes). No deduplication.';

-- Modify indexed text pool: cap at 128 bytes, drop first_used
ALTER TABLE public.molecule_text_pool 
    ALTER COLUMN text_value TYPE VARCHAR(128);

ALTER TABLE public.molecule_text_pool 
    DROP COLUMN IF EXISTS first_used;

COMMENT ON TABLE public.molecule_text_pool IS 'Deduplicated text storage for repeated values (city names, descriptions). Limited to 128 bytes.';

-- Verify
\d molecule_text
\d molecule_text_pool
