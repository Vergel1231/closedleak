-- Add lead_id and customer_id columns to events table
-- The application code already inserts these columns; the table was missing them.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'lead_id') THEN
    ALTER TABLE events ADD COLUMN lead_id uuid REFERENCES leads(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'customer_id') THEN
    ALTER TABLE events ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_customer_id ON events(customer_id);