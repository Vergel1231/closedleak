/*
# ClosedLeak — Initial Schema

## Overview
Creates the full database schema for ClosedLeak, a demo-mode web app for US HVAC and plumbing
businesses that recovers jobs lost to missed calls and no-shows.

## New Tables
1. `businesses` — One row per registered business. Linked to the auth user.
   - id (uuid PK), owner_id (uuid FK auth.users), name, phone, address, service_area,
     business_hours (jsonb), supported_services (text[]), created_at
2. `customers` — A business's customers.
   - id (uuid PK), business_id (FK), first_name, last_name, phone, email, address,
     is_demo (bool default false), created_at
3. `leads` — Leads generated from missed calls or other sources.
   - id (uuid PK), business_id (FK), customer_id (FK nullable), source, status (enum),
     is_demo (bool default false), created_at
4. `calls` — Incoming/outgoing call records.
   - id (uuid PK), business_id (FK), customer_id (FK nullable), lead_id (FK nullable),
     direction, phone_number, duration_seconds, outcome, is_demo (bool default false), created_at
5. `messages` — SMS / text message records.
   - id (uuid PK), business_id (FK), customer_id (FK nullable), lead_id (FK nullable),
     direction, body, is_demo (bool default false), created_at
6. `appointments` — Scheduled appointments.
   - id (uuid PK), business_id (FK), customer_id (FK), lead_id (FK nullable),
     scheduled_at (timestamptz), status (enum), notes, is_demo (bool default false), created_at
7. `availability_slots` — Time slots when the business is available.
   - id (uuid PK), business_id (FK), start_time (timestamptz), end_time (timestamptz),
     is_booked (bool default false), created_at
8. `events` — General event log (call events, booking events, etc.).
   - id (uuid PK), business_id (FK), event_type, payload (jsonb),
     is_demo (bool default false), created_at

## Enums
- `lead_status` — new, contacted, qualified, booked, lost
- `appointment_status` — scheduled, confirmed, completed, cancelled, no_show

## Constraints
- `lead_status` column uses `lead_status` enum (not free text)
- `appointment_status` column uses `appointment_status` enum (not free text)

## Security (RLS)
- RLS enabled on all 8 tables.
- All tables are business-scoped: policies check that the row's `business_id` belongs to a
  business whose `owner_id` matches `(SELECT auth.uid())`.
- `businesses` table: owner-scoped via `owner_id = (SELECT auth.uid())`.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE), scoped TO authenticated.
- All auth calls in policies wrapped as `(SELECT auth.uid())`.

## Indexes
- Indexes on all foreign key columns.
- Index on `businesses.owner_id`.

## Important Notes
1. Every business-owned table has `business_id`.
2. `is_demo boolean DEFAULT false` on customers, leads, calls, messages, appointments, events.
3. `created_at timestamptz DEFAULT now()` on every table.
4. Child tables use EXISTS subquery to verify ownership through the businesses table.
*/

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'booked', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  service_area text DEFAULT '',
  business_hours jsonb DEFAULT '{"mon":"9:00-17:00","tue":"9:00-17:00","wed":"9:00-17:00","thu":"9:00-17:00","fri":"9:00-17:00","sat":"closed","sun":"closed"}'::jsonb,
  supported_services text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  source text DEFAULT 'missed_call',
  status lead_status NOT NULL DEFAULT 'new',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound',
  phone_number text DEFAULT '',
  duration_seconds integer DEFAULT 0,
  outcome text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound',
  body text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'generic',
  payload jsonb DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES (all foreign keys)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_business_id ON calls(business_id);
CREATE INDEX IF NOT EXISTS idx_calls_customer_id ON calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_business_id ON messages(business_id);
CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_business_id ON availability_slots(business_id);
CREATE INDEX IF NOT EXISTS idx_events_business_id ON events(business_id);

-- ============================================================
-- RLS — businesses (owner-scoped via owner_id)
-- ============================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_business" ON businesses;
CREATE POLICY "select_own_business" ON businesses FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "insert_own_business" ON businesses;
CREATE POLICY "insert_own_business" ON businesses FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "update_own_business" ON businesses;
CREATE POLICY "update_own_business" ON businesses FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "delete_own_business" ON businesses;
CREATE POLICY "delete_own_business" ON businesses FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = owner_id);

-- ============================================================
-- RLS — customers (business-scoped)
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — leads (business-scoped)
-- ============================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_leads" ON leads;
CREATE POLICY "select_own_leads" ON leads FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = leads.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_leads" ON leads;
CREATE POLICY "insert_own_leads" ON leads FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = leads.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_leads" ON leads;
CREATE POLICY "update_own_leads" ON leads FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = leads.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = leads.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_leads" ON leads;
CREATE POLICY "delete_own_leads" ON leads FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = leads.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — calls (business-scoped)
-- ============================================================

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_calls" ON calls;
CREATE POLICY "select_own_calls" ON calls FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = calls.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_calls" ON calls;
CREATE POLICY "insert_own_calls" ON calls FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = calls.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_calls" ON calls;
CREATE POLICY "update_own_calls" ON calls FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = calls.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = calls.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_calls" ON calls;
CREATE POLICY "delete_own_calls" ON calls FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = calls.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — messages (business-scoped)
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = messages.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = messages.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = messages.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = messages.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = messages.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — appointments (business-scoped)
-- ============================================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_appointments" ON appointments;
CREATE POLICY "select_own_appointments" ON appointments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = appointments.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_appointments" ON appointments;
CREATE POLICY "insert_own_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = appointments.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_appointments" ON appointments;
CREATE POLICY "update_own_appointments" ON appointments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = appointments.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = appointments.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_appointments" ON appointments;
CREATE POLICY "delete_own_appointments" ON appointments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = appointments.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — availability_slots (business-scoped)
-- ============================================================

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_availability_slots" ON availability_slots;
CREATE POLICY "select_own_availability_slots" ON availability_slots FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = availability_slots.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_availability_slots" ON availability_slots;
CREATE POLICY "insert_own_availability_slots" ON availability_slots FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = availability_slots.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_availability_slots" ON availability_slots;
CREATE POLICY "update_own_availability_slots" ON availability_slots FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = availability_slots.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = availability_slots.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_availability_slots" ON availability_slots;
CREATE POLICY "delete_own_availability_slots" ON availability_slots FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = availability_slots.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

-- ============================================================
-- RLS — events (business-scoped)
-- ============================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_events" ON events;
CREATE POLICY "select_own_events" ON events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = events.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = events.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = events.business_id AND businesses.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = events.business_id AND businesses.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "delete_own_events" ON events;
CREATE POLICY "delete_own_events" ON events FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = events.business_id AND businesses.owner_id = (SELECT auth.uid()))
  );