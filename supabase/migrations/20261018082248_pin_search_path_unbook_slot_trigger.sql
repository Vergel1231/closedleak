/*
  # Pin search_path on unbook_slot_on_appt_delete

  1. Security
    - Sets search_path to public, pg_temp so the trigger's unqualified
      availability_slots reference cannot be resolved to an attacker-controlled
      object. The function keeps SECURITY INVOKER rights, so row level security
      continues to govern the update.

  2. Notes
    - Body and return value are unchanged; the existing trigger binding on
      appointments is preserved because the function is replaced in place.
*/

CREATE OR REPLACE FUNCTION public.unbook_slot_on_appt_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.slot_id IS NOT NULL THEN
    UPDATE availability_slots
    SET is_booked = false
    WHERE id = OLD.slot_id;
  END IF;
  RETURN OLD;
END;
$function$;
