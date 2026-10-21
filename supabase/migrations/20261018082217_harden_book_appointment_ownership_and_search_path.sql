/*
  # Harden book_appointment: validate tenant ownership of lead and customer

  1. Security
    - Verifies the lead referenced by p_lead_id belongs to p_business_id before
      any write, so an appointment can never be created pointing at another
      business's lead (foreign key checks bypass row level security, so the
      insert previously succeeded while the follow-up lead update was silently
      filtered to zero rows).
    - Verifies the customer referenced by p_customer_id belongs to the same
      business, for the same reason.
    - Pins search_path to public, pg_temp so the unqualified table references
      cannot be resolved to an attacker-controlled object.

  2. Notes
    - Same signature, same return value, same SECURITY INVOKER rights, so row
      level security continues to govern every statement.
    - Behaviour for legitimate callers is unchanged: a lead and customer in the
      caller's own business always pass the new checks.
*/

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_lead_id uuid,
  p_slot_id uuid,
  p_business_id uuid,
  p_customer_id uuid,
  p_is_demo boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appointment_id uuid;
  v_rows_updated int;
  v_existing uuid;
BEGIN
  -- The lead must belong to the business being booked for
  PERFORM 1 FROM leads
  WHERE id = p_lead_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead does not belong to this business';
  END IF;

  -- The customer must belong to the business being booked for
  PERFORM 1 FROM customers
  WHERE id = p_customer_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer does not belong to this business';
  END IF;

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
$function$;
