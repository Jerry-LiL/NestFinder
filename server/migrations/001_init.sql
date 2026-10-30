-- Enable btree_gist for exclusion constraint on scalar + range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('TENANT', 'MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('APARTMENT', 'HOUSE', 'STUDIO', 'VILLA')),
  beds INTEGER NOT NULL CHECK (beds >= 0),
  baths INTEGER NOT NULL CHECK (baths >= 0),
  sqft INTEGER NOT NULL CHECK (sqft > 0),
  amenities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Property images table
CREATE TABLE IF NOT EXISTS property_images (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_booking_dates CHECK (end_date > start_date),
  CONSTRAINT no_overlapping_approved_bookings EXCLUDE USING gist (
    property_id WITH =,
    daterange(start_date, end_date) WITH &&
  ) WHERE (status = 'APPROVED')
);

-- Indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_properties_city_price ON properties (city, price);
CREATE INDEX IF NOT EXISTS idx_properties_city_lower_price ON properties (LOWER(city), price);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties (price);
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_properties_amenities ON properties USING gin (amenities);
CREATE INDEX IF NOT EXISTS idx_properties_beds ON properties (beds);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties (property_type);
CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON properties (manager_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_dates ON bookings (property_id, start_date, end_date) WHERE (status = 'APPROVED');
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images (property_id);
