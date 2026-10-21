-- Remove duplicate availability slot windows, keeping the oldest row per window.
-- Only open rows with no appointment are deleted; booked or referenced rows abort.
DELETE FROM availability_slots s
USING availability_slots newer
WHERE s.business_id = newer.business_id
  AND s.start_time = newer.start_time
  AND s.end_time = newer.end_time
  AND (s.created_at, s.id) < (newer.created_at, newer.id)
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id IN (s.id, newer.id));

-- Never allow two rows for the same window again.
CREATE UNIQUE INDEX availability_slots_business_window_unique
  ON availability_slots (business_id, start_time, end_time);