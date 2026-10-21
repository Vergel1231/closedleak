import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  FlaskConical,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Phone,
  Users,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import type { Customer, Lead, Call, AvailabilitySlot, Appointment, LeadStatus, ConversationState } from '@/types';
import { DemoBadge } from '@/components/Badges';
import { toUserMessage } from '@/lib/errors';
import { formatPhone } from '@/lib/phone';

export default function DemoDataPage() {
  const { business, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [fetching, setFetching] = useState(false);

  const loadData = useCallback(async () => {
    if (!business) return;
    setFetching(true);
    const [c, l, cl, sl, ap] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', business.id).eq('is_demo', true).order('created_at', { ascending: false }),
      supabase.from('leads').select('*').eq('business_id', business.id).eq('is_demo', true).order('created_at', { ascending: false }),
      supabase.from('calls').select('*').eq('business_id', business.id).eq('is_demo', true).order('created_at', { ascending: false }),
      supabase.from('availability_slots').select('*').eq('business_id', business.id).order('start_time', { ascending: true }),
      supabase.from('appointments').select('*').eq('business_id', business.id).eq('is_demo', true).order('created_at', { ascending: false }),
    ]);
    setCustomers((c.data as Customer[]) || []);
    setLeads((l.data as Lead[]) || []);
    setCalls((cl.data as Call[]) || []);
    setSlots((sl.data as AvailabilitySlot[]) || []);
    setAppointments((ap.data as Appointment[]) || []);
    setFetching(false);
  }, [business]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLoadDemo() {
    if (!business) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const bizId = business.id;

      // Set demo service zips only if the user hasn't added any
      const { data: bizData } = await supabase
        .from('businesses')
        .select('service_zips')
        .eq('id', bizId)
        .maybeSingle();
      const existingZips = (bizData as { service_zips?: string[] } | null)?.service_zips || [];
      if (existingZips.length === 0) {
        await supabase
          .from('businesses')
          .update({ service_zips: ['62704', '62707', '62711'] })
          .eq('id', bizId);
      }

      // Idempotency: if demo leads already exist, skip the history load (do not duplicate)
      const { data: existingDemoLeads, error: demoCheckErr } = await supabase
        .from('leads')
        .select('id')
        .eq('business_id', bizId)
        .eq('is_demo', true)
        .limit(1);
      if (demoCheckErr) throw new Error(demoCheckErr.message);
      if ((existingDemoLeads || []).length > 0) {
        setSuccess('Demo history already loaded — nothing duplicated. Use "Clear Demo Data" first to start fresh.');
        await loadData();
        return;
      }

      // 14 demo customers with realistic phones (+1XXXXXXXXXX)
      const demoCustomers = [
        { first_name: 'John', last_name: 'Smith', phone: '+15552001301' },
        { first_name: 'Mary', last_name: 'Johnson', phone: '+15552001302' },
        { first_name: 'Carlos', last_name: 'Rivera', phone: '+15552001303' },
        { first_name: 'Sarah', last_name: 'Chen', phone: '+15552001304' },
        { first_name: 'Tom', last_name: 'Baker', phone: '+15552001305' },
        { first_name: 'Dana', last_name: 'White', phone: '+15552001306' },
        { first_name: 'Luis', last_name: 'Garcia', phone: '+15552001307' },
        { first_name: 'Emma', last_name: 'Wallace', phone: '+15552001308' },
        { first_name: 'Raj', last_name: 'Patel', phone: '+15552001309' },
        { first_name: 'Nina', last_name: 'Kowalski', phone: '+15552001310' },
        { first_name: 'Ben', last_name: 'Ortiz', phone: '+15552001311' },
        { first_name: 'Grace', last_name: 'Lim', phone: '+15552001312' },
        { first_name: 'Owen', last_name: 'Diaz', phone: '+15552001313' },
        { first_name: 'Ruth', last_name: 'Adler', phone: '+15552001314' },
      ];

      const { data: insertedCustomers, error: custErr } = await supabase
        .from('customers')
        .insert(demoCustomers.map((c) => ({ ...c, business_id: bizId, is_demo: true })))
        .select();

      if (custErr) throw new Error(custErr.message);
      const custRows = (insertedCustomers as Customer[]) || [];
      if (custRows.length < demoCustomers.length) throw new Error('Failed to insert demo customers');

      const now = new Date();
      // Timestamp for each lead: spread across the last 14 days (oldest first)
      const daysAgo = (n: number, hour = 10) => {
        const d = new Date(now);
        d.setDate(d.getDate() - n);
        d.setHours(hour, 15, 0, 0);
        return d.toISOString();
      };

      interface DemoLead {
        custIdx: number;
        status: LeadStatus;
        state: ConversationState;
        day: number;
        hour: number;
        escalationReason?: string;
        replied?: boolean;
      }

      // Outcomes: 5 booked, 3 escalated, 2 qualifying, 2 contacted, 2 new
      // Status and state always match: booked->CLOSED, escalated->ESCALATED, etc.
      const demoLeads: DemoLead[] = [
        { custIdx: 0, status: 'booked', state: 'CLOSED', day: 13, hour: 9 },
        { custIdx: 1, status: 'booked', state: 'CLOSED', day: 11, hour: 14 },
        { custIdx: 2, status: 'booked', state: 'CLOSED', day: 9, hour: 10 },
        { custIdx: 3, status: 'booked', state: 'CLOSED', day: 7, hour: 11 },
        { custIdx: 4, status: 'booked', state: 'CLOSED', day: 4, hour: 15 },
        { custIdx: 5, status: 'contacted', state: 'ESCALATED', day: 10, hour: 9, escalationReason: 'customer asked for human' },
        { custIdx: 6, status: 'contacted', state: 'ESCALATED', day: 8, hour: 16, escalationReason: 'outside service area' },
        { custIdx: 7, status: 'contacted', state: 'ESCALATED', day: 3, hour: 10, escalationReason: 'no availability' },
        { custIdx: 8, status: 'contacted', state: 'QUALIFYING', day: 1, hour: 13, replied: true },
        { custIdx: 9, status: 'contacted', state: 'QUALIFYING', day: 2, hour: 17, replied: true },
        { custIdx: 10, status: 'contacted', state: 'QUALIFYING', day: 6, hour: 12 },
        { custIdx: 11, status: 'contacted', state: 'QUALIFYING', day: 5, hour: 8 },
        { custIdx: 12, status: 'new', state: 'NEW', day: 0, hour: 9 },
        { custIdx: 13, status: 'new', state: 'NEW', day: 0, hour: 12 },
      ];

      const leadRowsToInsert = demoLeads.map((l) => ({
        business_id: bizId,
        customer_id: custRows[l.custIdx].id,
        source: 'missed_call',
        status: l.status,
        conversation_state: l.state,
        is_demo: true,
        created_at: daysAgo(l.day, l.hour),
        qualification: l.escalationReason
          ? { escalation_reason: l.escalationReason }
          : l.state === 'CLOSED'
            ? { service_type: 'HVAC', issue: 'AC not cooling', urgency: 'as soon as possible', zip: '62704', zip_in_service_area: true, preferred_time: 'morning' }
            : {},
      }));

      const { data: insertedLeads, error: leadErr } = await supabase
        .from('leads')
        .insert(leadRowsToInsert)
        .select();

      if (leadErr) throw new Error(leadErr.message);
      const leadRows = (insertedLeads as Lead[]) || [];
      if (leadRows.length < demoLeads.length) throw new Error('Failed to insert demo leads');

      // Calls: one missed inbound call per lead, timestamped with the lead
      const callRows = leadRows.map((lead, i) => ({
        business_id: bizId,
        customer_id: lead.customer_id,
        lead_id: lead.id,
        direction: 'inbound',
        phone_number: demoCustomers[demoLeads[i].custIdx].phone,
        duration_seconds: 0,
        outcome: 'missed',
        is_demo: true,
        created_at: daysAgo(demoLeads[i].day, demoLeads[i].hour),
      }));

      const { error: callErr } = await supabase.from('calls').insert(callRows);
      if (callErr) throw new Error(callErr.message);

      // Event chains per lead, timestamps spread over the 14 days
      const eventRows: {
        business_id: string; lead_id: string; customer_id: string; event_type: string;
        payload: Record<string, unknown>; is_demo: boolean; created_at: string;
      }[] = [];

      const addEvent = (leadIdx: number, type: string, payload: Record<string, unknown>, at: string) => {
        const dl = demoLeads[leadIdx];
        eventRows.push({
          business_id: bizId,
          lead_id: leadRows[leadIdx].id,
          customer_id: leadRows[leadIdx].customer_id || '',
          event_type: type,
          payload,
          is_demo: true,
          created_at: at,
        });
        void dl;
      };

      const tsAfter = (base: string, minutes: number) => new Date(new Date(base).getTime() + minutes * 60000).toISOString();

      leadRows.forEach((lead, i) => {
        const dl = demoLeads[i];
        const callAt = daysAgo(dl.day, dl.hour);
        addEvent(i, 'call.missed', { phone: demoCustomers[dl.custIdx].phone }, callAt);
        addEvent(i, 'lead.created', { source: 'missed_call' }, tsAfter(callAt, 1));

        if (dl.state !== 'NEW') {
          const textAt = tsAfter(callAt, 3);
          addEvent(i, 'message.sent', { direction: 'system' }, textAt);
          addEvent(i, 'customer.contacted', {}, tsAfter(textAt, 1));
        }

        if (dl.escalationReason) {
          addEvent(i, 'lead.escalated', { reason: dl.escalationReason }, tsAfter(callAt, 10));
        }

        if (dl.replied) {
          addEvent(i, 'message.received', { direction: 'customer' }, tsAfter(callAt, 20));
        }

        if (dl.state === 'CLOSED') {
          const replyAt = tsAfter(callAt, 8);
          addEvent(i, 'message.received', { direction: 'customer' }, replyAt);
          const qualAt = tsAfter(replyAt, 5);
          addEvent(i, 'lead.qualified', {}, qualAt);
          const offerAt = tsAfter(qualAt, 2);
          addEvent(i, 'appointment.offered', { slot_ids: [] }, offerAt);
          const bookAt = tsAfter(offerAt, 6);
          addEvent(i, 'appointment.booked', { appointment_id: null }, bookAt);
          addEvent(i, 'lead.recovered', { source: 'missed_call' }, tsAfter(bookAt, 1));
        }
      });

      const { error: eventErr } = await supabase.from('events').insert(eventRows);
      if (eventErr) throw new Error(eventErr.message);

      // Past booked appointments (no slot rows needed for past demo bookings)
      const apptRows = leadRows
        .map((lead, i) => ({ lead, i }))
        .filter(({ i }) => demoLeads[i].state === 'CLOSED')
        .map(({ lead, i }) => {
          const dl = demoLeads[i];
          const callAt = daysAgo(dl.day, dl.hour);
          const scheduledAt = tsAfter(callAt, 60 * 24 * 2); // booked for ~2 days after the call
          return {
            business_id: bizId,
            customer_id: lead.customer_id || '',
            lead_id: lead.id,
            slot_id: null,
            scheduled_at: scheduledAt,
            status: 'booked' as const,
            notes: 'Demo booking from missed-call recovery',
            is_demo: true,
            created_at: tsAfter(callAt, 30),
          };
        });

      if (apptRows.length > 0) {
        const { error: apptErr } = await supabase.from('appointments').insert(apptRows);
        if (apptErr) throw new Error(apptErr.message);
      }

      const slotsToInsert: { business_id: string; start_time: string; end_time: string; is_booked: boolean }[] = [];
      const businessHours = business.business_hours || {};
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

      // Fetch existing slots to avoid duplicate windows (any source, any is_demo)
      const { data: existingSlots } = await supabase
        .from('availability_slots')
        .select('start_time, end_time')
        .eq('business_id', bizId);
      const existingWindows = new Set((existingSlots as { start_time: string; end_time: string }[] || []).map((s) => `${s.start_time}|${s.end_time}`));

      for (let day = 1; day <= 7; day++) {
        const date = new Date(now);
        date.setDate(now.getDate() + day);
        const dayKey = dayKeys[date.getDay()];
        const hoursStr = businessHours[dayKey] || '';
        if (hoursStr === 'closed' || !hoursStr) continue;

        date.setHours(9, 0, 0, 0);
        const start1 = new Date(date);
        const end1 = new Date(date);
        end1.setHours(11, 0, 0, 0);
        const start2 = new Date(date);
        start2.setHours(13, 0, 0, 0);
        const end2 = new Date(date);
        end2.setHours(15, 0, 0, 0);

        const s1Iso = start1.toISOString();
        const s2Iso = start2.toISOString();
        if (!existingWindows.has(`${s1Iso}|${end1.toISOString()}`)) {
          slotsToInsert.push({ business_id: bizId, start_time: s1Iso, end_time: end1.toISOString(), is_booked: false });
        }
        if (!existingWindows.has(`${s2Iso}|${end2.toISOString()}`)) {
          slotsToInsert.push({ business_id: bizId, start_time: s2Iso, end_time: end2.toISOString(), is_booked: false });
        }
      }

      if (slotsToInsert.length > 0) {
        const { error: slotErr } = await supabase.from('availability_slots').insert(slotsToInsert);
        if (slotErr) throw new Error(slotErr.message);
      }

      setSuccess('Demo history loaded: 14 missed calls over the last 14 days (5 booked, 3 escalated, 2 qualifying, 2 contacted, 2 new) plus future availability slots. All demo records are labeled DEMO.');
      await loadData();
    } catch (err) {
      setError(toUserMessage('demo.load', err, 'Failed to load demo data'));
    } finally {
      setLoading(false);
    }
  }

  async function handleClearDemo() {
    if (!business) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Delete demo appointments first (they reference leads and slots)
      await supabase.from('appointments').delete().eq('business_id', business.id).eq('is_demo', true);
      // Free demo slots (mark as unbooked, then delete unbooked demo slots)
      await supabase.from('availability_slots').update({ is_booked: false }).eq('business_id', business.id).eq('is_demo', true);
      await supabase.from('availability_slots').delete().eq('business_id', business.id).eq('is_booked', false);
      await supabase.from('events').delete().eq('business_id', business.id).eq('is_demo', true);
      await supabase.from('messages').delete().eq('business_id', business.id).eq('is_demo', true);
      await supabase.from('calls').delete().eq('business_id', business.id).eq('is_demo', true);
      await supabase.from('leads').delete().eq('business_id', business.id).eq('is_demo', true);
      await supabase.from('customers').delete().eq('business_id', business.id).eq('is_demo', true);
      setSuccess('Demo data cleared, including generated sample times.');
      await loadData();
    } catch (err) {
      setError(toUserMessage('demo.clear', err, 'Failed to clear demo data'));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  const hasDemoData = customers.length > 0 || leads.length > 0 || calls.length > 0 || appointments.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-7 w-7 text-primary-400" />
        <h1 className="text-2xl font-bold text-ink-900">Demo Data</h1>
      </div>
      <p className="text-ink-600 mb-6">
        Load sample customers, leads, calls, and availability slots to see how ClosedLeak works.
        Sample records are labeled <DemoBadge /> and can be cleared at any time.
      </p>

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

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={handleLoadDemo}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5" />}
          Load Demo Data
        </button>
        {hasDemoData && (
          <button
            onClick={handleClearDemo}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400 px-5 py-2.5 font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" />
            Clear Demo Data
          </button>
        )}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-ink-300" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Customers */}
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-bold text-ink-900">Demo Customers ({customers.length})</h2>
            </div>
            {customers.length === 0 ? (
              <p className="text-sm text-ink-400">No demo customers yet.</p>
            ) : (
              <div className="space-y-2">
                {customers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-ink-500">{formatPhone(c.phone)}</p>
                    </div>
                    <DemoBadge />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leads */}
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-bold text-ink-900">Demo Leads ({leads.length})</h2>
            </div>
            {leads.length === 0 ? (
              <p className="text-sm text-ink-400">No demo leads yet.</p>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{customerName(l.customer_id, customers)}</p>
                      <p className="text-xs text-ink-500 capitalize">{l.source.replace('_', ' ')} &middot; Status: <span className="font-semibold">{l.status}</span></p>
                    </div>
                    <DemoBadge />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calls */}
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-bold text-ink-900">Demo Calls ({calls.length})</h2>
            </div>
            {calls.length === 0 ? (
              <p className="text-sm text-ink-400">No demo calls yet.</p>
            ) : (
              <div className="space-y-2">
                {calls.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{formatPhone(c.phone_number)}</p>
                      <p className="text-xs text-ink-500 capitalize">{c.direction} &middot; {c.outcome}</p>
                    </div>
                    <DemoBadge />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Availability Slots */}
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-bold text-ink-900">Availability Slots ({slots.length})</h2>
            </div>
            {slots.length === 0 ? (
              <p className="text-sm text-ink-400">No availability slots yet.</p>
            ) : (
              <div className="space-y-2">
                {slots.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink-800">
                        {new Date(s.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-ink-500">
                        {new Date(s.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {' – '}
                        {new Date(s.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.is_booked ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' : 'bg-accent-100 text-accent-800 ring-1 ring-accent-300'}`}>
                      {s.is_booked ? 'Booked' : 'Open'}
                    </span>
                  </div>
                ))}
                {slots.length > 10 && <p className="text-xs text-ink-400 text-center pt-1">+ {slots.length - 10} more slots</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function customerName(customerId: string | null, allCustomers: Customer[]): string {
  if (!customerId) return 'Unknown customer';
  const match = allCustomers.find((c) => c.id === customerId);
  return match ? `${match.first_name} ${match.last_name}` : 'Unknown customer';
}
