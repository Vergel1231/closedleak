/*
# Add booking support: slot_id on appointments, 'booked' enum, unique constraint, book_appointment RPC

1. Schema changes
   - Add `slot_id` uuid column to `appointments` (nullable, FK to availability_slots ON DELETE SET NULL).
   - Add 'booked' value to the `appointment_status` enum.
   - Add a partial unique index so one slot can have only one non-cancelled appointment.
   - Add index on appointments.slot_id for fast lookups.
   - Add index on appointments.lead_id for fast lookups.

2. RPC function: book_appointment
   - Takes p_lead_id, p_slot_id, p_business_id, p_customer_id, p_is_demo.
   - Atomically: checks the slot is still open (is_booked = false), marks it booked,
     creates the appointment (status 'booked'), sets lead status to 'booked' and
     conversation_state to 'CLOSED'.
   - Uses a conditional UPDATE (only updates if is_booked = false) and checks exactly one row updated.
   - Returns the created appointment id, or raises an exception if the slot is already booked
     or the lead already has an active appointment.

3. Security
   - No RLS changes needed — existing policies scope all tables to the business owner via auth.uid().
   - The RPC function runs with SECURITY INVOKER, so the caller's RLS policies apply.
*/

-- Add slot_id column to appointments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'slot_id') THEN
    ALTER TABLE appointments ADD COLUMN slot_id uuid;
    ALTER TABLE appointments ADD CONSTRAINT appointments_slot_id_fkey
      FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add 'booked' to appointment_status enum if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'appointment_status' AND e.enumlabel = 'booked') THEN
    ALTER TYPE appointment_status ADD VALUE 'booked';
  END IF;
END $$;

-- Unique constraint: one active (non-cancelled) appointment per slot
CREATE UNIQUE INDEX IF NOT EXISTS one_active_appointment_per_slot
  ON appointments (slot_id)
  WHERE slot_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show');

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_appointments_slot_id ON appointments (slot_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments (lead_id);

-- Atomic booking function
CREATE OR REPLACE FUNCTION book_appointment(
  p_lead_id uuid,
  p_slot_id uuid,
  p_business_id uuid,
  p_customer_id uuid,
  p_is_demo boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_appointment_id uuid;
  v_rows_updated int;
  v_existing uuid;
BEGIN
  -- Check if the lead already has an active (non-cancelled, non-no_show) appointment
  SELECT id INTO v_existing
  FROM appointments
  WHERE lead_id = p_lead_id
    AND status NOT IN ('cancelled', 'no_show')
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Lead already has an active appointment';
  END IF;

  -- Atomically mark the slot as booked (only if still open)
  UPDATE availability_slots
  SET is_booked = true
  WHERE id = p_slot_id
    AND business_id = p_business_id
    AND is_booked = false;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Slot is no longer available';
  END IF;

  -- Create the appointment
  INSERT INTO appointments (business_id, customer_id, lead_id, slot_id, status, is_demo)
  VALUES (p_business_id, p_customer_id, p_lead_id, p_slot_id, 'booked', p_is_demo)
  RETURNING id INTO v_appointment_id;

  -- Update lead to booked + closed
  UPDATE leads
  SET status = 'booked',
      conversation_state = 'CLOSED'
  WHERE id = p_lead_id;

  RETURN v_appointment_id;
END;
$$;