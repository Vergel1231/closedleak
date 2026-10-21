/*
# Add BOOKING conversation state

1. Schema changes
   - Add 'BOOKING' value to the `conversation_state` enum.
   This state represents a lead that has been offered appointment slots and is waiting for the customer to choose one.
*/
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'conversation_state' AND e.enumlabel = 'BOOKING') THEN
    ALTER TYPE conversation_state ADD VALUE 'BOOKING' BEFORE 'ESCALATED';
  END IF;
END $$;