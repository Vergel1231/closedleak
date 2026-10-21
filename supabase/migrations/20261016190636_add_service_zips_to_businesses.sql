-- Add service_zips text[] column to businesses for zip-code-based service area matching
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'service_zips') THEN
    ALTER TABLE businesses ADD COLUMN service_zips text[] NOT NULL DEFAULT '{}'::text[];
  END IF;
END $$;