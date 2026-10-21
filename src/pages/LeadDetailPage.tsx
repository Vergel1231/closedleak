import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getRecoveryMessage,
  processCustomerReply,
  getCurrentQuestion,
  selectSlotsForOffering,
  formatSlotOption,
  formatSlotDate,
  formatSlotTimeRange,
  getAutoOfferMessage,
  getDayUnavailablePrefix,
  getNoAvailabilityMessage,
  getSlotTakenMessage,
  getBookingConfirmationMessage,
  getBookingInvalidRetryMessage,
  type Qualification,
} from '@/lib/conversation';
import { formatDate as fmtDate, formatTimeRange as fmtTimeRange, formatDateTime as fmtDateTime } from '@/lib/datetime';
import { DemoBadge, SimulatedBadge } from '@/components/Badges';
import { toUserMessage, logError } from '@/lib/errors';
import { formatPhone } from '@/lib/phone';
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import type { Lead, Customer, Message, Event, Appointment, AvailabilitySlot } from '@/types';
import { getLeadDisplayLabel } from '@/lib/leadLabel';
import BookAppointmentPanel from '@/components/BookAppointmentPanel';

type BookingCode = 'slot_unavailable' | 'lead_has_appointment' | 'not_owner' | 'unknown';

const EVENT_ICONS: Record<string, typeof Phone> = {
  'call.missed': Phone,
  'lead.created': CheckCircle2,
  'message.sent': Send,
  'message.received': MessageSquare,
  'customer.contacted': CheckCircle2,
  'lead.qualified': CheckCircle2,
  'lead.escalated': AlertTriangle,
  'appointment.offered': Calendar,
  'appointment.booked': Calendar,
  'lead.recovered': CheckCircle2,
};

export default function LeadDetailPage() {
  const { id: leadId } = useParams<{ id: string }>();
  const { business } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [appointmentSlot, setAppointmentSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showBookPanel, setShowBookPanel] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!leadId || !business) return;
    setLoading(true);

    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    const currentLead = leadData as Lead | null;
    setLead(currentLead);

    if (currentLead?.customer_id) {
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', currentLead.customer_id)
        .maybeSingle();
      setCustomer(custData as Customer | null);
    }

    const [msgRes, eventRes, apptRes] = await Promise.all([
      supabase.from('messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
      supabase.from('events').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
      supabase.from('appointments').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).maybeSingle(),
    ]);
    setMessages((msgRes.data as Message[]) || []);
    setEvents((eventRes.data as Event[]) || []);
    const appt = (apptRes.data as Appointment) || null;
    setAppointment(appt);

    if (appt?.slot_id) {
      const { data: slotData } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('id', appt.slot_id)
        .maybeSingle();
      setAppointmentSlot((slotData as AvailabilitySlot) || null);
    } else {
      setAppointmentSlot(null);
    }

    setLoading(false);
  }, [leadId, business]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get('book') === '1' && lead && !appointment && lead.status !== 'booked' && lead.conversation_state !== 'CLOSED') {
      setShowBookPanel(true);
      // Clean the param so it doesn't re-open on every reload
      const next = new URLSearchParams(searchParams);
      next.delete('book');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, lead, appointment, setSearchParams]);

  async function insertMessage(direction: string, body: string) {
    if (!leadId || !business || !customer) return;
    const { data, error: msgErr } = await supabase
      .from('messages')
      .insert({
        business_id: business.id,
        customer_id: customer.id,
        lead_id: leadId,
        direction,
        body,
        is_demo: true,
      })
      .select()
      .single();
    if (msgErr) throw new Error(msgErr.message);
    return data as Message;
  }

  async function insertEvent(eventType: string, payload: Record<string, unknown>) {
    if (!leadId || !business) return;
    const { error: evErr } = await supabase.from('events').insert({
      business_id: business.id,
      lead_id: leadId,
      customer_id: customer?.id || null,
      event_type: eventType,
      payload,
      is_demo: true,
    });
    if (evErr) throw new Error(evErr.message);
  }

  async function updateLead(updates: Partial<Lead>) {
    if (!leadId) return;
    const { error: updErr } = await supabase.from('leads').update(updates).eq('id', leadId);
    if (updErr) throw new Error(updErr.message);
  }

  async function handleSendRecovery() {
    if (!lead || !business) return;
    if (lead.conversation_state !== 'NEW') return;

    setActionLoading(true);
    setError('');

    let createdMessageIds: string[] = [];

    try {
      const bizName = business.name || 'our team';
      const body = getRecoveryMessage(bizName);

      const msg = await insertMessage('system', body);
      if (msg) createdMessageIds.push(msg.id);
      await insertEvent('message.sent', { body, direction: 'system' });

      await updateLead({
        status: 'contacted',
        conversation_state: 'QUALIFYING',
      });

      await insertEvent('customer.contacted', {});

      await loadData();
    } catch (err) {
      for (const msgId of createdMessageIds) {
        await supabase.from('messages').delete().eq('id', msgId);
      }
      setError(toUserMessage('lead.recoveryText', err, 'Failed to send recovery text. Any partial records were cleaned up.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function fetchOpenSlots(): Promise<AvailabilitySlot[]> {
    if (!business) return [];
    const now = new Date().toISOString();
    const { data, error: slotErr } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_booked', false)
      .gte('start_time', now)
      .order('start_time', { ascending: true });
    if (slotErr) throw new Error(slotErr.message);
    return (data as AvailabilitySlot[]) || [];
  }

  function buildOfferBody(selection: ReturnType<typeof selectSlotsForOffering>, options: string[]): string {
    if (selection.dayRequest && !selection.dayMatched) {
      return getAutoOfferMessage(options, getDayUnavailablePrefix(selection.dayRequest));
    }
    return getAutoOfferMessage(options);
  }

  // The customer chooses by displayed number, so the ids saved on the lead must be
  // exactly the slots shown, in the order shown — otherwise "2" can book a slot
  // that was never displayed as 2.
  async function presentSlotOptions(
    offeredSlots: Array<{ id: string; start_time: string; end_time: string }>,
    buildBody: (options: string[]) => string,
    createdMessageIds: string[],
    leadUpdates: Partial<Lead> & { qualification: Qualification },
  ): Promise<{ options: string[]; slotIds: string[] }> {
    const options = offeredSlots.map((s, i) => formatSlotOption(i + 1, s.start_time, s.end_time));
    const slotIds = offeredSlots.map((s) => s.id);
    const body = buildBody(options);

    const msg = await insertMessage('system', body);
    if (msg) createdMessageIds.push(msg.id);
    await insertEvent('message.sent', { direction: 'system' });
    await insertEvent('appointment.offered', { slot_ids: slotIds });
    await updateLead({
      ...leadUpdates,
      qualification: { ...leadUpdates.qualification, offered_slot_ids: slotIds },
    });
    return { options, slotIds };
  }

  async function offerSlotsForQualification(
    leadQual: Qualification,
    createdMessageIds: string[],
    offerKind: 'first' | 'taken' = 'first',
  ): Promise<{ escalatedNoAvailability: boolean }> {
    const slots = await fetchOpenSlots();
    const selection = selectSlotsForOffering(slots, leadQual.preferred_time, 3);

    if (selection.slots.length === 0) {
      const msg = await insertMessage('system', getNoAvailabilityMessage());
      if (msg) createdMessageIds.push(msg.id);
      await insertEvent('message.sent', { direction: 'system' });
      await updateLead({
        conversation_state: 'ESCALATED',
        qualification: { ...leadQual, escalation_reason: 'no availability' },
      });
      await insertEvent('lead.escalated', { reason: 'no availability' });
      return { escalatedNoAvailability: true };
    }

    await presentSlotOptions(
      selection.slots,
      (options) => (offerKind === 'taken' ? getSlotTakenMessage(options) : buildOfferBody(selection, options)),
      createdMessageIds,
      { conversation_state: 'BOOKING', qualification: { ...leadQual, booking_invalid_count: 0 } },
    );
    return { escalatedNoAvailability: false };
  }

  async function handleOfferSlots() {
    if (!lead || !business || !customer) return;
    if (lead.conversation_state !== 'READY_TO_BOOK') return;

    setActionLoading(true);
    setError('');

    let createdMessageIds: string[] = [];

    try {
      await offerSlotsForQualification(lead.qualification || {}, createdMessageIds);
      await loadData();
    } catch (err) {
      for (const msgId of createdMessageIds) {
        await supabase.from('messages').delete().eq('id', msgId);
      }
      setError(toUserMessage('lead.offerSlots', err, 'Failed to offer slots. Any partial records were cleaned up.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function attemptBooking(slotId: string): Promise<{ success: boolean; code?: BookingCode; appointmentId?: string }> {
    if (!leadId || !business || !customer) return { success: false, code: 'unknown' };
    const { data, error: rpcErr } = await supabase.rpc('book_appointment', {
      p_lead_id: leadId,
      p_slot_id: slotId,
      p_business_id: business.id,
      p_customer_id: customer.id,
      p_is_demo: true,
    });
    if (rpcErr) {
      logError('lead.book_appointment', rpcErr);
      // Map the routine's exception text to a code before sanitizing, so the
      // caller can branch on the cause without ever rendering the raw message.
      const msg = rpcErr.message;
      let code: BookingCode = 'unknown';
      if (msg.includes('no longer available')) code = 'slot_unavailable';
      else if (msg.includes('already has an active appointment')) code = 'lead_has_appointment';
      else if (msg.includes('does not belong to this business')) code = 'not_owner';
      return { success: false, code };
    }
    return { success: true, appointmentId: data as string };
  }

  async function handleReply(ev: React.FormEvent) {
    ev.preventDefault();
    if (!lead || !business) return;
    if (!replyText.trim()) return;
    if (replyText.length > 500) {
      setReplyError('Reply must be 500 characters or fewer');
      return;
    }

    setActionLoading(true);
    setError('');
    setReplyError('');

    let createdMessageIds: string[] = [];
    let leadUpdated = false;
    let bookingSucceeded = false;
    const previousState = lead.conversation_state;
    const previousStatus = lead.status;
    const previousQual = lead.qualification;

    try {
      const custMsg = await insertMessage('customer', replyText.trim());
      if (custMsg) createdMessageIds.push(custMsg.id);
      await insertEvent('message.received', { body: replyText.trim(), direction: 'customer' });

      const currentQual: Qualification = lead.qualification || {};
      const result = processCustomerReply(replyText.trim(), currentQual, lead.conversation_state, business);

      if (result.chosenSlotIndex !== null && result.newQualification.offered_slot_ids) {
        const slotId = result.newQualification.offered_slot_ids[result.chosenSlotIndex];
        const bookingResult = await attemptBooking(slotId);

        if (!bookingResult.success) {
          if (bookingResult.code === 'slot_unavailable') {
            const outcome = await offerSlotsForQualification({ ...result.newQualification }, createdMessageIds, 'taken');
            if (outcome.escalatedNoAvailability) {
              setReplyText('');
              await loadData();
              return;
            }
            // Slot taken: keep the invalid counter clean and stay in BOOKING
            await updateLead({
              conversation_state: 'BOOKING',
              qualification: { ...result.newQualification, booking_invalid_count: 0 },
            });
            setReplyText('');
            await loadData();
            return;
          }
          if (bookingResult.code === 'lead_has_appointment') {
            const sysMsg = await insertMessage('system', 'You already have an appointment scheduled with us. A team member will follow up if you need to make changes.');
            if (sysMsg) createdMessageIds.push(sysMsg.id);
            await insertEvent('message.sent', { direction: 'system' });
            setReplyText('');
            await loadData();
            return;
          }
          // not_owner and unknown: roll back and show the generic error
          throw new Error('Booking could not be completed');
        }

        // Booking succeeded atomically in the RPC; no lead rollback from here
        bookingSucceeded = true;

        const { data: slotData } = await supabase
          .from('availability_slots')
          .select('*')
          .eq('id', slotId)
          .maybeSingle();
        const slot = slotData as AvailabilitySlot | null;
        if (!slot) throw new Error('Could not retrieve booked slot');

        const confirmBody = getBookingConfirmationMessage(formatSlotDate(slot.start_time), formatSlotTimeRange(slot.start_time, slot.end_time));
        const confirmMsg = await insertMessage('system', confirmBody);
        if (confirmMsg) createdMessageIds.push(confirmMsg.id);
        await insertEvent('message.sent', { direction: 'system' });
        await insertEvent('appointment.booked', { slot_id: slotId, appointment_id: bookingResult.appointmentId });
        await insertEvent('lead.recovered', { source: lead.source });

        setReplyText('');
        await loadData();
        return;
      }

      // Automatic slot offer right after the final qualification answer is recognized
      if (result.autoOffer) {
        await insertEvent('lead.qualified', {});
        await updateLead({
          status: 'qualified',
          conversation_state: 'READY_TO_BOOK',
          qualification: result.newQualification,
        });
        leadUpdated = true;
        const outcome = await offerSlotsForQualification(result.newQualification, createdMessageIds);
        if (outcome.escalatedNoAvailability) {
          setReplyText('');
          await loadData();
          return;
        }
        setReplyText('');
        await loadData();
        return;
      }

      if (result.newState === 'BOOKING' && result.systemReply === '' && (result.newQualification.booking_invalid_count || 0) > (currentQual.booking_invalid_count || 0)) {
        const offeredIds = result.newQualification.offered_slot_ids || [];
        const { data: offeredSlots } = await supabase
          .from('availability_slots')
          .select('*')
          .in('id', offeredIds)
          .order('start_time', { ascending: true });
        const slots = (offeredSlots as AvailabilitySlot[]) || [];
        const stillOpen = slots.filter((s) => !s.is_booked);
        if (stillOpen.length === 0) {
          const outcome = await offerSlotsForQualification(result.newQualification, createdMessageIds);
          if (outcome.escalatedNoAvailability) {
            setReplyText('');
            await loadData();
            return;
          }
          await updateLead({
            conversation_state: 'BOOKING',
            qualification: { ...result.newQualification, booking_invalid_count: result.newQualification.booking_invalid_count },
          });
        } else {
          await presentSlotOptions(
            stillOpen,
            getBookingInvalidRetryMessage,
            createdMessageIds,
            { conversation_state: 'BOOKING', qualification: result.newQualification },
          );
        }
        setReplyText('');
        await loadData();
        return;
      }

      if (result.systemReply) {
        const sysMsg = await insertMessage('system', result.systemReply);
        if (sysMsg) createdMessageIds.push(sysMsg.id);
        await insertEvent('message.sent', { body: result.systemReply, direction: 'system' });
      }

      await updateLead({
        status: result.newStatus,
        conversation_state: result.newState,
        qualification: result.newQualification,
      });
      leadUpdated = true;

      for (const evt of result.additionalEvents) {
        const payload = evt === 'lead.escalated' && result.escalationReason
          ? { reason: result.escalationReason }
          : {};
        await insertEvent(evt, payload);
      }

      setReplyText('');
      await loadData();
    } catch (err) {
      for (const msgId of createdMessageIds) {
        await supabase.from('messages').delete().eq('id', msgId);
      }
      if (bookingSucceeded) {
        setError('Your appointment was booked, but sending the confirmation failed. Please refresh — the booking is saved.');
      } else if (leadUpdated) {
        await supabase.from('leads').update({
          status: previousStatus,
          conversation_state: previousState,
          qualification: previousQual,
        }).eq('id', leadId!);
        setError(toUserMessage('lead.reply.rollback', err, 'Failed to send reply. Any partial records were cleaned up.'));
      } else {
        setError(toUserMessage('lead.reply', err, 'Failed to send reply. Any partial records were cleaned up.'));
      }
      await loadData();
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

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink-600">Lead not found.</p>
        <Link to="/app/leads" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800">
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Link>
      </div>
    );
  }

  const canSendRecovery = lead.conversation_state === 'NEW';
  const canOfferSlots = lead.conversation_state === 'READY_TO_BOOK';
  const canBookAppointment = !appointment && lead.status !== 'booked' && lead.conversation_state !== 'CLOSED';
  const replyInputVisible = lead.conversation_state === 'QUALIFYING' || lead.conversation_state === 'BOOKING';
  const currentQuestion = lead.conversation_state === 'QUALIFYING' ? getCurrentQuestion(lead.qualification || {}) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/app/leads" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-ink-900">
                {customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown customer'}
              </h1>
              {lead.is_demo ? <DemoBadge /> : <SimulatedBadge />}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-ink-500 flex-wrap">
              {customer && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {formatPhone(customer.phone)}</span>}
              <span className="text-ink-300">|</span>
              <span className="capitalize">{lead.source.replace('_', ' ')}</span>
            </div>
          </div>
          {(() => {
            const lbl = getLeadDisplayLabel(lead);
            return (
              <div className="text-right">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ring-1 ${lbl.color}`}>
                  {lbl.label}
                </span>
                {lbl.subText && (
                  <p className="mt-1 text-xs text-rose-600 capitalize">{lbl.subText}</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-bold text-ink-900">Conversation</h2>
            </div>

            {/* Recovery button */}
            {canSendRecovery && (
              <div className="mb-4">
                <button
                  onClick={handleSendRecovery}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-400 px-5 py-3 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  Send Recovery Text
                </button>
              </div>
            )}

            {/* Offer slots button */}
            {canOfferSlots && (
              <div className="mb-4">
                <button
                  onClick={handleOfferSlots}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-900 hover:bg-accent-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calendar className="h-5 w-5" />}
                  Offer Available Slots
                </button>
              </div>
            )}

            {/* Book appointment button (team action) */}
            {canBookAppointment && (
              <div className="mb-4">
                <button
                  onClick={() => setShowBookPanel(true)}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Calendar className="h-5 w-5" />
                  Book appointment
                </button>
              </div>
            )}

            {/* Messages */}
            {messages.length === 0 && !canSendRecovery ? (
              <p className="text-sm text-ink-400 text-center py-8">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'customer' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.direction === 'customer' ? 'bg-ink-50 text-ink-800' : 'bg-primary-400/10 text-ink-800 ring-1 ring-primary-400/20'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-ink-500">
                          {msg.direction === 'customer' ? 'Customer' : 'Simulated SMS'}
                        </span>
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-100 rounded px-1 py-0.5">
                          SIMULATED
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-line">{msg.body}</p>
                      <p className="text-[10px] text-ink-400 mt-1">
                        {fmtDateTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {replyInputVisible && (
              <form onSubmit={handleReply} className="mt-6">
                <label className="block text-sm font-semibold text-ink-600 mb-1">
                  {lead.conversation_state === 'BOOKING' ? 'Reply as customer (choose 1, 2, or 3)' : 'Reply as customer'}
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => { setReplyText(e.target.value); if (replyError) setReplyError(''); }}
                    rows={2}
                    maxLength={500}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all resize-none ${replyError ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                    placeholder="Type the customer's reply..."
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !replyText.trim()}
                    className="self-end inline-flex items-center gap-1.5 rounded-lg bg-primary-400 px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  {replyError ? (
                    <p className="text-sm text-rose-700">{replyError}</p>
                  ) : (
                    <p className="text-xs text-ink-400">Max 500 characters</p>
                  )}
                  <p className="text-xs text-ink-400">{replyText.length}/500</p>
                </div>
              </form>
            )}

            {/* Status notes */}
            {lead.conversation_state === 'READY_TO_BOOK' && (
              <div className="mt-4 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
                <CheckCircle2 className="h-4 w-4 inline mr-1" />
                Qualification complete. Click "Offer Available Slots" to present appointment options.
              </div>
            )}
            {lead.conversation_state === 'BOOKING' && (
              <div className="mt-4 rounded-lg bg-sky-50 border border-sky-300 px-4 py-3 text-sm text-sky-800">
                <Calendar className="h-4 w-4 inline mr-1" />
                Slots have been offered. The customer can reply with 1, 2, or 3 to choose.
              </div>
            )}
            {lead.conversation_state === 'CLOSED' && appointment && (
              <div className="mt-4 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
                <CheckCircle2 className="h-4 w-4 inline mr-1" />
                Appointment booked and lead closed.
              </div>
            )}
            {lead.conversation_state === 'ESCALATED' && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                <span>
                  This lead has been escalated{lead.qualification?.escalation_reason ? ` (${lead.qualification.escalation_reason})` : ''}. A team member needs to follow up personally.
                </span>
                {lead.qualification?.escalation_reason === 'no availability' && (
                  <p className="mt-2">
                    There were no open slots.{' '}
                    <Link to="/app/appointments" className="font-semibold underline hover:text-rose-900">
                      Add times on the Appointments page
                    </Link>
                    .
                  </p>
                )}
                {canBookAppointment && (
                  <button
                    onClick={() => setShowBookPanel(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    Book appointment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Qualification + Appointment + Events */}
        <div className="space-y-4">
          {/* Appointment */}
          {appointment && (
            <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary-400" />
                <h3 className="text-sm font-bold text-ink-900">Booked Appointment</h3>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-ink-800 font-semibold capitalize">{appointment.status}</p>
                {appointmentSlot ? (
                  <div className="text-ink-600">
                    <p>{formatSlotDate(appointmentSlot.start_time)}</p>
                    <p>{formatSlotTimeRange(appointmentSlot.start_time, appointmentSlot.end_time)}</p>
                  </div>
                ) : appointment.scheduled_at ? (
                  <p className="text-ink-600">{fmtDate(appointment.scheduled_at)}</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Qualification */}
          {lead.qualification && Object.keys(lead.qualification).length > 0 && (
            <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-5">
              <h3 className="text-sm font-bold text-ink-900 mb-3">Qualification Details</h3>
              <dl className="space-y-2 text-sm">
                {lead.qualification.service_type && (
                  <div><dt className="text-ink-400 text-xs">Service</dt><dd className="text-ink-800">{lead.qualification.service_type}</dd></div>
                )}
                {lead.qualification.initial_issue && (
                  <div><dt className="text-ink-400 text-xs">Initial Issue</dt><dd className="text-ink-800">{lead.qualification.initial_issue}</dd></div>
                )}
                {lead.qualification.issue && (
                  <div><dt className="text-ink-400 text-xs">Issue (from conversation)</dt><dd className="text-ink-800">{lead.qualification.issue}</dd></div>
                )}
                {lead.qualification.urgency && (
                  <div><dt className="text-ink-400 text-xs">Urgency</dt><dd className="text-ink-800">{lead.qualification.urgency}</dd></div>
                )}
                {lead.qualification.zip && (
                  <div><dt className="text-ink-400 text-xs">Zip / Area</dt><dd className="text-ink-800">{lead.qualification.zip}{lead.qualification.zip_in_service_area === false && <span className="text-rose-600 text-xs ml-1">(outside area)</span>}</dd></div>
                )}
                {lead.qualification.escalation_reason && (
                  <div><dt className="text-ink-400 text-xs">Escalation Reason</dt><dd className="text-rose-700 capitalize">{lead.qualification.escalation_reason.replace(/_/g, ' ')}</dd></div>
                )}
                {lead.qualification.preferred_time && (
                  <div><dt className="text-ink-400 text-xs">Preferred Time</dt><dd className="text-ink-800">{lead.qualification.preferred_time}</dd></div>
                )}
              </dl>
            </div>
          )}

          {/* Event Timeline */}
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary-400" />
              <h3 className="text-sm font-bold text-ink-900">Event Timeline</h3>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-ink-400">No events recorded.</p>
            ) : (
              <div className="space-y-3">
                {events.map((evt) => {
                  const Icon = EVENT_ICONS[evt.event_type] || CheckCircle2;
                  return (
                    <div key={evt.id} className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-lg bg-ink-50 p-1.5">
                        <Icon className="h-3.5 w-3.5 text-ink-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink-800">{evt.event_type}</p>
                        <p className="text-[10px] text-ink-400">
                          {fmtDateTime(evt.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showBookPanel && lead && business && (
        <BookAppointmentPanel
          lead={lead}
          customer={customer}
          business={business}
          onClose={() => setShowBookPanel(false)}
          onBooked={() => {
            setShowBookPanel(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
