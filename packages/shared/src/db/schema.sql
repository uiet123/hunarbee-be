-- Hunarbee initial schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin', 'mentor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id VARCHAR(64) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(64),
  amount_paise INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed')),
  program_id VARCHAR(64),
  duration_id VARCHAR(64),
  applicant_name VARCHAR(120),
  applicant_email VARCHAR(255),
  applicant_phone VARCHAR(20),
  country_iso VARCHAR(2),
  occupation VARCHAR(64),
  preferred_batch DATE,
  receipt VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_email ON payments (applicant_email);

/** Created only after payment is verified (paid). */
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES payments (id) ON DELETE RESTRICT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  country_iso VARCHAR(2) NOT NULL,
  occupation VARCHAR(64) NOT NULL,
  preferred_batch DATE NOT NULL,
  program_id VARCHAR(64) NOT NULL,
  duration_id VARCHAR(64) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  amount_paise INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments (email);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON enrollments (program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON enrollments (preferred_batch);
