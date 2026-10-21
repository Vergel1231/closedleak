/*
# Fix orphan booked slots: add trigger to reset is_booked when appointment is deleted

1. Root cause
   When a lead is deleted (e.g. "Clear demo data"), the appointment is cascade-deleted
   (ON DELETE SET NULL on appointments.lead_id actually, but the appointment itself
   may be deleted by the cleanup code). The slot's is_booked flag is never reset,
   leaving an orphan "booked" slot with no appointment.

2. Fix
   Add a trigger that resets availability_slots.is_booked to false whenever
   an appointment referencing that slot is deleted (or the slot_id is set to NULL).

3. Also repair any existing orphan slots (booked but no active appointment).
*/

-- Repair existing orphans
UPDATE availability_slots s
SET is_booked = false
WHERE s.is_booked = true
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.slot_id = s.id
      AND a.status NOT IN ('cancelled', 'no_show')
  );

-- Create trigger function to unbook slot when appointment is deleted
CREATE OR REPLACE FUNCTION unbook_slot_on_appt_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.slot_id IS NOT NULL THEN
    UPDATE availability_slots
    SET is_booked = false
    WHERE id = OLD.slot_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Add trigger on appointments
DROP TRIGGER IF EXISTS trg_unbook_slot_on_delete ON appointments;
CREATE TRIGGER trg_unbook_slot_on_delete
  BEFORE DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION unbook_slot_on_appt_delete();