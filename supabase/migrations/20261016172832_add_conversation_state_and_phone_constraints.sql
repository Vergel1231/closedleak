/*
# ClosedLeak — Add conversation state, qualification, and phone constraints

## Overview
Adds the conversation_state enum and qualification column to leads for the
recovery conversation flow. Adds phone format check constraints on customers
and businesses. Normalizes existing phone data to +1XXXXXXXXXX format.

## Changes
1. New enum: `conversation_state` — NEW, QUALIFYING, READY_TO_BOOK, ESCALATED, CLOSED
2. New column on `leads`: `conversation_state` (enum, default NEW)
3. New column on `leads`: `qualification` (jsonb, nullable)
4. Check constraint on `customers.phone`: must be NULL, empty, or +1 followed by 10 digits
5. Check constraint on `businesses.phone`: must be NULL, empty, or +1 followed by 10 digits
6. Data normalization: existing phone numbers converted to +1XXXXXXXXXX format

## Security
- No RLS policy changes (existing policies still apply).
- No new foreign keys (no new indexes needed).

## Important Notes
1. conversation_state defaults to NEW for all existing leads.
2. qualification is nullable — only populated during the conversation flow.
3. Phone constraints allow NULL and empty string for backward compatibility.
4. Existing demo data phone numbers are normalized before constraints are added.
*/

-- ============================================================
-- ENUM: conversation_state
-- ============================================================

DO $$ BEGIN
  CREATE TYPE conversation_state AS ENUM ('NEW', 'QUALIFYING', 'READY_TO_BOOK', 'ESCALATED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ADD COLUMNS to leads
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'conversation_state') THEN
    ALTER TABLE leads ADD COLUMN conversation_state conversation_state NOT NULL DEFAULT 'NEW';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'qualification') THEN
    ALTER TABLE leads ADD COLUMN qualification jsonb;
  END IF;
END $$;

-- ============================================================
-- NORMALIZE existing phone data to +1XXXXXXXXXX
-- ============================================================

-- customers.phone: 10 digits -> +1XXXXXXXXXX
UPDATE customers
SET phone = '+1' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10;

-- customers.phone: 11 digits starting with 1 -> +1XXXXXXXXXX
UPDATE customers
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
  AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '1%';

-- businesses.phone: 10 digits -> +1XXXXXXXXXX
UPDATE businesses
SET phone = '+1' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10;

-- businesses.phone: 11 digits starting with 1 -> +1XXXXXXXXXX
UPDATE businesses
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
  AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '1%';

-- calls.phone_number: 10 digits -> +1XXXXXXXXXX (no constraint but normalize for consistency)
UPDATE calls
SET phone_number = '+1' || regexp_replace(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL
  AND phone_number != ''
  AND phone_number !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 10;

UPDATE calls
SET phone_number = '+' || regexp_replace(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL
  AND phone_number != ''
  AND phone_number !~ '^\+1[0-9]{10}$'
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 11
  AND regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '1%';

-- ============================================================
-- CHECK CONSTRAINTS on phone format
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_format') THEN
    ALTER TABLE customers
    ADD CONSTRAINT customers_phone_format
    CHECK (phone IS NULL OR phone = '' OR phone ~ '^\+1[0-9]{10}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_phone_format') THEN
    ALTER TABLE businesses
    ADD CONSTRAINT businesses_phone_format
    CHECK (phone IS NULL OR phone = '' OR phone ~ '^\+1[0-9]{10}$');
  END IF;
END $$;