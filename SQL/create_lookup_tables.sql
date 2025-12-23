-- Loyalty Platform - Lookup Tables for Program Molecules
-- Creates airports and carriers tables with sample data

-- ============================================
-- AIRPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS airports (
    airport_id SERIAL PRIMARY KEY,
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_airports_code ON airports(code);

-- Sample airport data
INSERT INTO airports (code, name, city, country) VALUES
    ('MSP', 'Minneapolis-St. Paul International Airport', 'Minneapolis', 'USA'),
    ('BOS', 'Boston Logan International Airport', 'Boston', 'USA'),
    ('DEN', 'Denver International Airport', 'Denver', 'USA'),
    ('LGA', 'LaGuardia Airport', 'New York', 'USA'),
    ('ATL', 'Hartsfield-Jackson Atlanta International Airport', 'Atlanta', 'USA'),
    ('ORD', 'O''Hare International Airport', 'Chicago', 'USA'),
    ('LAX', 'Los Angeles International Airport', 'Los Angeles', 'USA'),
    ('SFO', 'San Francisco International Airport', 'San Francisco', 'USA'),
    ('JFK', 'John F. Kennedy International Airport', 'New York', 'USA'),
    ('SEA', 'Seattle-Tacoma International Airport', 'Seattle', 'USA'),
    ('MIA', 'Miami International Airport', 'Miami', 'USA'),
    ('PHX', 'Phoenix Sky Harbor International Airport', 'Phoenix', 'USA'),
    ('DFW', 'Dallas/Fort Worth International Airport', 'Dallas', 'USA'),
    ('IAH', 'George Bush Intercontinental Airport', 'Houston', 'USA'),
    ('LAS', 'Harry Reid International Airport', 'Las Vegas', 'USA')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- CARRIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS carriers (
    carrier_id SERIAL PRIMARY KEY,
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    alliance VARCHAR(50),
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_carriers_code ON carriers(code);

-- Sample carrier data
INSERT INTO carriers (code, name, alliance, country) VALUES
    ('BJ', 'Blue Jets Airways', NULL, 'USA'),
    ('DL', 'Delta Air Lines', 'SkyTeam', 'USA'),
    ('AA', 'American Airlines', 'Oneworld', 'USA'),
    ('UA', 'United Airlines', 'Star Alliance', 'USA'),
    ('WN', 'Southwest Airlines', NULL, 'USA'),
    ('B6', 'JetBlue Airways', NULL, 'USA'),
    ('AS', 'Alaska Airlines', 'Oneworld', 'USA'),
    ('NK', 'Spirit Airlines', NULL, 'USA'),
    ('F9', 'Frontier Airlines', NULL, 'USA'),
    ('G4', 'Allegiant Air', NULL, 'USA')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 'Airports created:' as message, COUNT(*) as count FROM airports;
SELECT 'Carriers created:' as message, COUNT(*) as count FROM carriers;

-- Test the joins that the API will use
SELECT 
    'MSP' as origin,
    a.name as origin_name,
    a.city as origin_city
FROM airports a
WHERE a.code = 'MSP';

SELECT 
    'BJ' as carrier_code,
    c.name as carrier_name,
    c.alliance
FROM carriers c
WHERE c.code = 'BJ';
