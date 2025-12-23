-- Usage:
--   psql -U billjansen -h localhost -d loyalty \
--        -v TENANT=delta -v FILE='/path/to/airports.csv' \
--        -f 016_airports_replace.sql
\set sch t_:TENANT
BEGIN;

TRUNCATE TABLE :"sch".airports;
\echo '>> Loading airports from ' :'FILE'
\copy :"sch".airports (iata, icao, name, city, country, lat, lon, tz, is_active) FROM :'FILE' WITH (FORMAT csv, HEADER true);

COMMIT;
