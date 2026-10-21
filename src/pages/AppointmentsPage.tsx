import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatTimeRange, combineDateAndTime, isPastDate } from '@/lib/datetime';
import { formatPhone } from '@/lib/phone';
import { DemoBadge, SimulatedBadge } from '@/components/Badges';
import { toUserMessage } from '@/lib/errors';
import {
  Calendar,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';
import type { Appointment, AvailabilitySlot, Customer } from '@/types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function AppointmentsPage() {
  const { business } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add slot form
  const [showAddForm, setShowAddForm] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('11:00');
  const [slotErrors, setSlotErrors] = useState<{ date?: string; time?: string }>({});

  const loadData = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const now = new Date().toISOString();
    const [slotRes, apptRes, custRes] = await Promise.all([
      supabase.from('availability_slots').select('*').eq('business_id', business.id).gte('start_time', now).order('start_time', { ascending: true }),
      supabase.from('appointments').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('business_id', business.id),
    ]);
    setSlots((slotRes.data as AvailabilitySlot[]) || []);
    setAppointments((apptRes.data as Appointment[]) || []);
    setCustomers((custRes.data as Customer[]) || []);
    setLoading(false);
  }, [business]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function customerName(customerId: string): string {
    const match = customers.find((c) => c.id === customerId);
    return match ? `${match.first_name} ${match.last_name}` : 'Unknown';
  }

  function customerPhone(customerId: string): string {
    const match = customers.find((c) => c.id === customerId);
    return match ? formatPhone(match.phone) : '';
  }

  function appointmentSlot(appt: Appointment): AvailabilitySlot | undefined {
    if (!appt.slot_id) return undefined;
    return slots.find((s) => s.id === appt.slot_id);
  }

  function validateSlotForm(): { date?: string; time?: string } {
    const e: { date?: string; time?: string } = {};
    if (!slotDate) e.date = 'Date is required';
    else if (isPastDate(slotDate)) e.date = 'Date cannot be in the past';
    if (!slotStart || !slotEnd) e.time = 'Start and end times are required';
    else {
      const start = new Date(`${slotDate}T${slotStart}:00`);
      const end = new Date(`${slotDate}T${slotEnd}:00`);
      if (end <= start) e.time = 'End time must be after start time';
    }
    return e;
  }

  async function handleAddSlot(ev: React.FormEvent) {
    ev.preventDefault();
    if (!business) return;
    const e = validateSlotForm();
    setSlotErrors(e);
    if (Object.keys(e).length) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const startTime = combineDateAndTime(slotDate, slotStart);
      const endTime = combineDateAndTime(slotDate, slotEnd);
      const { error: insErr } = await supabase.from('availability_slots').insert({
        business_id: business.id,
        start_time: startTime,
        end_time: endTime,
        is_booked: false,
      });
      if (insErr) {
        if (insErr.code === '23505') {
          setError('A slot for that time already exists.');
          return;
        }
        throw new Error(insErr.message);
      }
      setSuccess('Availability slot added.');
      setShowAddForm(false);
      setSlotDate('');
      setSlotStart('09:00');
      setSlotEnd('11:00');
      setSlotErrors({});
      setTimeout(() => setSuccess(''), 4000);
      await loadData();
    } catch (err) {
      setError(toUserMessage('appointments.addSlot', err, 'Failed to add slot'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSlot(slotId: string) {
    setActionLoading(true);
    setError('');
    try {
      const { error: delErr } = await supabase
        .from('availability_slots')
        .delete()
        .eq('id', slotId)
        .eq('is_booked', false);
      if (delErr) throw new Error(delErr.message);
      await loadData();
    } catch (err) {
      setError(toUserMessage('appointments.deleteSlot', err, 'Failed to delete slot'));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-7 w-7 text-primary-400" />
        <h1 className="text-2xl font-bold text-ink-900">Appointments</h1>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Availability Section */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Availability Slots</h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
          >
            {showAddForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Slot</>}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddSlot} className="mb-4 space-y-4 bg-ink-50 rounded-xl p-4" noValidate>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">Date</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => { setSlotDate(e.target.value); if (slotErrors.date) setSlotErrors({ ...slotErrors, date: undefined }); }}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all ${slotErrors.date ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                />
                {slotErrors.date && <p className="mt-1 text-sm text-rose-700">{slotErrors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">Start time</label>
                <input
                  type="time"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">End time</label>
                <input
                  type="time"
                  value={slotEnd}
                  onChange={(e) => { setSlotEnd(e.target.value); if (slotErrors.time) setSlotErrors({ ...slotErrors, time: undefined }); }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all ${slotErrors.time ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                />
                {slotErrors.time && <p className="mt-1 text-sm text-rose-700">{slotErrors.time}</p>}
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Add Slot
            </button>
          </form>
        )}

        {slots.length === 0 ? (
          <p className="text-sm text-ink-400 py-4">No upcoming availability slots. Click "Add Slot" to create one.</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-800">{formatDate(slot.start_time)}</p>
                  <p className="text-xs text-ink-500">{formatTimeRange(slot.start_time, slot.end_time)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${slot.is_booked ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' : 'bg-accent-100 text-accent-800 ring-1 ring-accent-300'}`}>
                    {slot.is_booked ? 'Booked' : 'Open'}
                  </span>
                  {!slot.is_booked && (
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      disabled={actionLoading}
                      className="text-ink-400 hover:text-rose-600 transition-colors"
                      aria-label="Delete slot"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
        <h2 className="text-lg font-bold text-ink-900 mb-4">Appointments</h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-ink-400 py-4">No appointments yet.</p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const slot = appointmentSlot(appt);
              return (
                <div key={appt.id} className="rounded-xl bg-ink-50 p-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-ink-900">{customerName(appt.customer_id)}</p>
                        {appt.is_demo ? <DemoBadge /> : <SimulatedBadge />}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-ink-500 flex-wrap">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customerPhone(appt.customer_id)}</span>
                        {appt.lead_id && (
                          <Link to={`/app/leads/${appt.lead_id}`} className="text-primary-700 hover:text-primary-800 font-semibold">
                            View Lead
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 ring-1 ring-primary-200 capitalize">
                      {appt.status}
                    </span>
                  </div>
                  {slot && (
                    <div className="mt-2 text-sm text-ink-600">
                      <span className="font-semibold">{formatDate(slot.start_time)}</span>
                      <span className="text-ink-400"> · </span>
                      <span>{formatTimeRange(slot.start_time, slot.end_time)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
