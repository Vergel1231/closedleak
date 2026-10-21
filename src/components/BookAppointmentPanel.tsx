import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatDateLong, formatTimeRange } from '@/lib/datetime';
import { toUserMessage, logError } from '@/lib/errors';
import {
  X,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { AvailabilitySlot, Lead, Customer, Business } from '@/types';

type BookingCode = 'slot_unavailable' | 'lead_has_appointment' | 'not_owner' | 'unknown';

interface Props {
  lead: Lead;
  customer: Customer | null;
  business: Business;
  onClose: () => void;
  onBooked: () => void;
}

interface DayGroup {
  dayKey: string;
  dateLabel: string;
  slots: AvailabilitySlot[];
}

function groupSlotsByDay(slots: AvailabilitySlot[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const slot of slots) {
    const dayKey = slot.start_time.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.slots.push(slot);
    } else {
      groups.push({ dayKey, dateLabel: formatDateLong(slot.start_time), slots: [slot] });
    }
  }
  return groups;
}

export default function BookAppointmentPanel({ lead, customer, business, onClose, onBooked }: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [slotTakenMsg, setSlotTakenMsg] = useState('');

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim() || 'this customer'
    : 'this customer';

  const loadSlots = useCallback(async () => {
    if (!business) return;
    setLoadingSlots(true);
    setSlotTakenMsg('');
    const now = new Date().toISOString();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    const maxIso = maxDate.toISOString();
    const { data, error } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_booked', false)
      .gte('start_time', now)
      .lte('start_time', maxIso)
      .order('start_time', { ascending: true });
    setLoadingSlots(false);
    if (error) {
      setPanelError(toUserMessage('bookPanel.loadSlots', error, 'Could not load available times.'));
      return;
    }
    // De-duplicate by identical start_time+end_time window so we never show
    // two slots with the same time window.
    const seen = new Set<string>();
    const unique = ((data as AvailabilitySlot[]) || []).filter((s) => {
      const key = `${s.start_time}|${s.end_time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setSlots(unique);
    setPanelError('');
  }, [business]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const dayGroups = useMemo(() => groupSlotsByDay(slots), [slots]);

  async function confirmBooking(slot: AvailabilitySlot) {
    if (!lead || !business || !customer) return;
    setBooking(true);
    setPanelError('');
    setSlotTakenMsg('');

    try {
      const { data, error: rpcErr } = await supabase.rpc('book_appointment', {
        p_lead_id: lead.id,
        p_slot_id: slot.id,
        p_business_id: business.id,
        p_customer_id: customer.id,
        p_is_demo: lead.is_demo,
      });

      if (rpcErr) {
        logError('bookPanel.book_appointment', rpcErr);
        const msg = rpcErr.message;
        let code: BookingCode = 'unknown';
        if (msg.includes('no longer available')) code = 'slot_unavailable';
        else if (msg.includes('already has an active appointment')) code = 'lead_has_appointment';
        else if (msg.includes('does not belong to this business')) code = 'not_owner';

        if (code === 'slot_unavailable') {
          setPendingSlot(null);
          await loadSlots();
          setSlotTakenMsg('That time was just taken. Pick another.');
        } else if (code === 'lead_has_appointment') {
          setPendingSlot(null);
          setPanelError('This lead already has an active appointment.');
        } else {
          setPendingSlot(null);
          setPanelError('Booking could not be completed. Please try again.');
        }
        return;
      }

      const appointmentId = data as string;

      // Record events with booked_by metadata. Do not send messages or SMS.
      const eventPayload = { slot_id: slot.id, appointment_id: appointmentId, booked_by: 'team' };
      const { error: bookedEvtErr } = await supabase.from('events').insert({
        business_id: business.id,
        lead_id: lead.id,
        customer_id: customer.id,
        event_type: 'appointment.booked',
        payload: eventPayload,
        is_demo: lead.is_demo,
      });
      const { error: recoveredEvtErr } = await supabase.from('events').insert({
        business_id: business.id,
        lead_id: lead.id,
        customer_id: customer.id,
        event_type: 'lead.recovered',
        payload: { source: lead.source, booked_by: 'team' },
        is_demo: lead.is_demo,
      });

      if (bookedEvtErr) logError('bookPanel.appointmentBookedEvent', bookedEvtErr);
      if (recoveredEvtErr) logError('bookPanel.leadRecoveredEvent', recoveredEvtErr);

      setPendingSlot(null);
      setBooking(false);
      onBooked();
    } catch (err) {
      setPendingSlot(null);
      setPanelError(toUserMessage('bookPanel.book', err, 'Booking could not be completed. Please try again.'));
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-ink-100">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Book appointment</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-ink-600 mb-4">
            Book for <span className="font-semibold text-ink-900">{customerName}</span>
          </p>

          {panelError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{panelError}</span>
            </div>
          )}

          {slotTakenMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{slotTakenMsg}</span>
            </div>
          )}

          {loadingSlots ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary-400" />
            </div>
          ) : dayGroups.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-ink-300 mb-3" />
              <p className="text-sm text-ink-600">No open time slots in the next 14 days.</p>
              <p className="mt-1 text-xs text-ink-400">Add availability on the Appointments page.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {pendingSlot ? (
                /* Confirmation step */
                <div className="rounded-xl border-2 border-primary-300 bg-primary-50/50 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-primary-500" />
                    <h3 className="text-sm font-bold text-ink-900">Confirm booking</h3>
                  </div>
                  <p className="text-sm text-ink-800 mb-4">
                    Book{' '}
                    <span className="font-semibold">
                      {formatDateLong(pendingSlot.start_time)},{' '}
                      {formatTimeRange(pendingSlot.start_time, pendingSlot.end_time)}
                    </span>{' '}
                    for <span className="font-semibold">{customerName}</span>?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => confirmBooking(pendingSlot)}
                      disabled={booking}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirm booking
                    </button>
                    <button
                      onClick={() => setPendingSlot(null)}
                      disabled={booking}
                      className="rounded-xl bg-ink-50 px-5 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100 transition-colors disabled:opacity-60"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                /* Slot list grouped by day */
                dayGroups.map((group) => (
                  <div key={group.dayKey}>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2">
                      {group.dateLabel}
                    </h3>
                    <div className="space-y-2">
                      {group.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-ink-400" />
                            <div>
                              <p className="text-sm font-semibold text-ink-800">
                                {formatTimeRange(slot.start_time, slot.end_time)}
                              </p>
                              <p className="text-xs text-ink-400">{formatDate(slot.start_time)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSlotTakenMsg('');
                              setPanelError('');
                              setPendingSlot(slot);
                            }}
                            className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
                          >
                            Book
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
