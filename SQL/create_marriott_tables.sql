-- Marriott Hotel Loyalty Tables
-- Date: 2025-12-29

-- Brand table (like carriers for airlines)
CREATE TABLE IF NOT EXISTS brand (
  brand_id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  base_earn_rate NUMERIC(4,2) NOT NULL DEFAULT 10.00,  -- Points per $1 spent
  is_active BOOLEAN DEFAULT true
);

COMMENT ON TABLE brand IS 'Hotel brand definitions with earning rates';
COMMENT ON COLUMN brand.base_earn_rate IS 'Base points earned per $1 spent (e.g., 10.00, 5.00, 2.50)';

-- Property table (individual hotels)
CREATE TABLE IF NOT EXISTS property (
  property_id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  brand_id INTEGER NOT NULL REFERENCES brand(brand_id),
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(100) DEFAULT 'USA',
  is_active BOOLEAN DEFAULT true
);

COMMENT ON TABLE property IS 'Individual hotel properties';

-- Insert Marriott brands with their earn rates
INSERT INTO brand (code, name, base_earn_rate) VALUES
  ('RCR', 'Ritz-Carlton Reserve', 10.00),
  ('RCH', 'Ritz-Carlton', 10.00),
  ('STR', 'St. Regis', 10.00),
  ('EDI', 'EDITION', 10.00),
  ('LUX', 'Luxury Collection', 10.00),
  ('WHS', 'W Hotels', 10.00),
  ('JWM', 'JW Marriott', 10.00),
  ('MAR', 'Marriott Hotels', 10.00),
  ('SHE', 'Sheraton', 10.00),
  ('DEL', 'Delta Hotels', 10.00),
  ('MVC', 'Marriott Vacation Club', 10.00),
  ('WES', 'Westin', 10.00),
  ('REN', 'Renaissance', 10.00),
  ('LME', 'Le Méridien', 10.00),
  ('AUT', 'Autograph Collection', 10.00),
  ('GAL', 'Gaylord Hotels', 10.00),
  ('TRI', 'Tribute Portfolio', 10.00),
  ('DES', 'Design Hotels', 10.00),
  ('CYD', 'Courtyard', 10.00),
  ('FPS', 'Four Points', 10.00),
  ('SPG', 'SpringHill Suites', 10.00),
  ('PRO', 'Protea Hotels', 5.00),
  ('FAI', 'Fairfield', 10.00),
  ('ALC', 'AC Hotels', 10.00),
  ('ALO', 'Aloft', 10.00),
  ('MOX', 'Moxy', 10.00),
  ('CXE', 'City Express', 5.00),
  ('ELE', 'Element', 5.00),
  ('RES', 'Residence Inn', 5.00),
  ('TWN', 'TownePlace Suites', 5.00),
  ('HVL', 'Homes & Villas', 5.00),
  ('APT', 'Apartments by Marriott', 5.00),
  ('STU', 'StudioRes', 4.00),
  ('MEA', 'Marriott Executive Apartments', 2.50)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  base_earn_rate = EXCLUDED.base_earn_rate;

-- Insert some sample properties
INSERT INTO property (code, name, brand_id, city, state) VALUES
  ('MSPDT', 'Minneapolis Marriott City Center', (SELECT brand_id FROM brand WHERE code = 'MAR'), 'Minneapolis', 'MN'),
  ('MSPWE', 'The Westin Minneapolis', (SELECT brand_id FROM brand WHERE code = 'WES'), 'Minneapolis', 'MN'),
  ('MSPRI', 'Residence Inn Minneapolis Downtown', (SELECT brand_id FROM brand WHERE code = 'RES'), 'Minneapolis', 'MN'),
  ('MSPCY', 'Courtyard Minneapolis Downtown', (SELECT brand_id FROM brand WHERE code = 'CYD'), 'Minneapolis', 'MN'),
  ('NYCRC', 'The Ritz-Carlton New York, Central Park', (SELECT brand_id FROM brand WHERE code = 'RCH'), 'New York', 'NY'),
  ('NYCST', 'The St. Regis New York', (SELECT brand_id FROM brand WHERE code = 'STR'), 'New York', 'NY'),
  ('NYCWH', 'W New York - Times Square', (SELECT brand_id FROM brand WHERE code = 'WHS'), 'New York', 'NY'),
  ('SFOJW', 'JW Marriott San Francisco', (SELECT brand_id FROM brand WHERE code = 'JWM'), 'San Francisco', 'CA'),
  ('LAXWE', 'The Westin Los Angeles Airport', (SELECT brand_id FROM brand WHERE code = 'WES'), 'Los Angeles', 'CA'),
  ('ORDSH', 'Sheraton Grand Chicago', (SELECT brand_id FROM brand WHERE code = 'SHE'), 'Chicago', 'IL')
ON CONFLICT (code) DO NOTHING;
