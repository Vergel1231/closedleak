import { supabase } from '@/lib/supabase';
import { combineDateAndTime } from '@/lib/datetime';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface GenerateResult {
  created: number;
  error: string | null;
}

/**
 * Create open demo slots for the next 7 days: 9:00-11:00 and 1:00-3:00 PM each
 * day the business hours do not mark closed. Never duplicates a slot that
 * already exists for the business with the same start_time.
 */
export async function generateSampleSlots(
  businessId: string,
  businessHours: Record<string, string>,
): Promise<GenerateResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: existing, error: fetchErr } = await supabase
    .from('availability_slots')
    .select('start_time, end_time')
    .eq('business_id', businessId);
  if (fetchErr) return { created: 0, error: fetchErr.message };

  const existingWindows = new Set((existing || []).map((s: { start_time: string; end_time: string }) => `${s.start_time}|${s.end_time}`));

  const toInsert: { business_id: string; start_time: string; end_time: string; is_booked: boolean; is_demo: boolean }[] = [];
  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dayKey = DAY_KEYS[date.getDay()];
    const hoursStr = (businessHours[dayKey] || '').trim().toLowerCase();
    if (!hoursStr || hoursStr === 'closed') continue;

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    for (const [start, end] of [
      ['09:00', '11:00'],
      ['13:00', '15:00'],
    ] as const) {
      const startIso = combineDateAndTime(dateStr, start);
      if (existingWindows.has(`${startIso}|${combineDateAndTime(dateStr, end)}`)) continue;
      toInsert.push({
        business_id: businessId,
        start_time: startIso,
        end_time: combineDateAndTime(dateStr, end),
        is_booked: false,
        is_demo: true,
      });
    }
  }

  if (toInsert.length === 0) return { created: 0, error: null };

  const { error: insErr } = await supabase.from('availability_slots').insert(toInsert);
  if (insErr) return { created: 0, error: insErr.message };
  return { created: toInsert.length, error: null };
}
