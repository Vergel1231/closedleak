import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { normalizePhone, validatePhone, formatPhone } from '@/lib/phone';
import { generateSampleSlots } from '@/lib/sampleSlots';
import NoOpenSlotsNotice from '@/components/NoOpenSlotsNotice';
import { DemoBadge, SimulatedBadge } from '@/components/Badges';
import { toUserMessage } from '@/lib/errors';
import {
  Users,
  Phone,
  PhoneCall,
  Loader2,
  AlertCircle,
  Plus,
  X,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import type { Lead, Customer } from '@/types';
import { getLeadDisplayLabel } from '@/lib/leadLabel';

export default function LeadsListPage() {
  const { business } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSimForm, setShowSimForm] = useState(false);

  // Sim form state
  const [simName, setSimName] = useState('');
  const [simPhone, setSimPhone] = useState('');
  const [simService, setSimService] = useState('');
  const [simIssue, setSimIssue] = useState('');
  const [simErrors, setSimErrors] = useState<{ name?: string; phone?: string; service?: string; issue?: string }>({});
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simError, setSimError] = useState('');

  // No-open-slots notice state
  const [hasOpenSlots, setHasOpenSlots] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  const loadLeads = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const [leadRes, custRes, slotRes] = await Promise.all([
      supabase.from('leads').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('business_id', business.id),
      supabase
        .from('availability_slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString()),
    ]);
    setLeads((leadRes.data as Lead[]) || []);
    setCustomers((custRes.data as Customer[]) || []);
    setHasOpenSlots((slotRes.data || []).length > 0);
    setLoading(false);
  }, [business]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  async function handleGenerate() {
    if (!business) return;
    setGenerating(true);
    setGenerateMsg('');
    const result = await generateSampleSlots(business.id, business.business_hours || {});
    setGenerating(false);
    if (result.error) {
      setError(toUserMessage('leads.generateSlots', new Error(result.error), 'Failed to generate sample times'));
      return;
    }
    setGenerateMsg(`Created ${result.created} open appointment times for the next 7 days.`);
    await loadLeads();
  }

  function customerName(customerId: string | null): string {
    if (!customerId) return 'Unknown customer';
    const match = customers.find((c) => c.id === customerId);
    return match ? `${match.first_name} ${match.last_name}` : 'Unknown customer';
  }

  function customerPhone(customerId: string | null): string {
    if (!customerId) return '';
    const match = customers.find((c) => c.id === customerId);
    return match ? formatPhone(match.phone) : '';
  }

  function validateSimForm() {
    const e: { name?: string; phone?: string; service?: string; issue?: string } = {};
    if (!simName.trim()) e.name = 'Customer name is required';
    const phoneErr = validatePhone(simPhone);
    if (phoneErr) e.phone = phoneErr;
    if (!simService) e.service = 'Select a service type';
    if (!simIssue.trim()) e.issue = 'Issue description is required';
    return e;
  }

  async function handleSimSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSimError('');
    const e = validateSimForm();
    setSimErrors(e);
    if (Object.keys(e).length) return;

    if (!business) return;
    setSimSubmitting(true);

    let createdCustomerId: string | null = null;
    let createdLeadId: string | null = null;
    let customerWasNew = false;

    try {
      const bizId = business.id;
      const normalizedPhone = normalizePhone(simPhone)!;
      const nameParts = simName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Find or create customer
      const { data: existingCust } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', bizId)
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingCust) {
        createdCustomerId = (existingCust as Customer).id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            business_id: bizId,
            first_name: firstName,
            last_name: lastName,
            phone: normalizedPhone,
            is_demo: true,
          })
          .select()
          .single();
        if (custErr) throw new Error(custErr.message);
        createdCustomerId = (newCust as Customer).id;
        customerWasNew = true;
      }
      const customerId = createdCustomerId!;

      // Create lead
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          business_id: bizId,
          customer_id: customerId,
          source: 'missed_call',
          status: 'new',
          conversation_state: 'NEW',
          is_demo: true,
          qualification: { initial_issue: simIssue.trim(), service_type: simService },
        })
        .select()
        .single();
      if (leadErr) throw new Error(leadErr.message);
      createdLeadId = (newLead as Lead).id;
      const leadId = createdLeadId;

      // Create call row
      const { error: callErr } = await supabase.from('calls').insert({
        business_id: bizId,
        customer_id: customerId,
        lead_id: leadId,
        direction: 'inbound',
        phone_number: normalizedPhone,
        duration_seconds: 0,
        outcome: 'missed',
        is_demo: true,
      });
      if (callErr) throw new Error(callErr.message);

      // Record events
      const events = [
        { business_id: bizId, lead_id: leadId, customer_id: customerId, event_type: 'call.missed', payload: { phone: normalizedPhone }, is_demo: true },
        { business_id: bizId, lead_id: leadId, customer_id: customerId, event_type: 'lead.created', payload: { source: 'missed_call' }, is_demo: true },
      ];
      const { error: eventErr } = await supabase.from('events').insert(events);
      if (eventErr) throw new Error(eventErr.message);

      // Reset form
      setSimName('');
      setSimPhone('');
      setSimService('');
      setSimIssue('');
      setSimErrors({});
      setShowSimForm(false);
      await loadLeads();
    } catch (err) {
      // Cleanup: delete partial records so no half-finished lead remains
      if (createdLeadId) {
        await supabase.from('calls').delete().eq('lead_id', createdLeadId);
        await supabase.from('events').delete().eq('lead_id', createdLeadId);
        await supabase.from('messages').delete().eq('lead_id', createdLeadId);
        await supabase.from('leads').delete().eq('id', createdLeadId);
      }
      if (customerWasNew && createdCustomerId) {
        await supabase.from('customers').delete().eq('id', createdCustomerId);
      }
      setSimError(toUserMessage('leads.simulateMissedCall', err, 'Failed to simulate missed call. Any partial records were cleaned up.'));
    } finally {
      setSimSubmitting(false);
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-7 w-7 text-primary-400" />
          <h1 className="text-2xl font-bold text-ink-900">Leads</h1>
        </div>
        <button
          onClick={() => setShowSimForm(!showSimForm)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
        >
          {showSimForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Simulate Missed Call</>}
        </button>
      </div>

      {/* Sim form */}
      {showSimForm && (
        <div className="mb-6 bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PhoneCall className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Simulate a Missed Call</h2>
            <SimulatedBadge />
          </div>

          {simError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{simError}</span>
            </div>
          )}

          <form onSubmit={handleSimSubmit} className="space-y-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">Customer name</label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => { setSimName(e.target.value); if (simErrors.name) setSimErrors({ ...simErrors, name: undefined }); }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all ${simErrors.name ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                  placeholder="Jane Doe"
                />
                {simErrors.name && <p className="mt-1 text-sm text-rose-700">{simErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">US phone number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                  <input
                    type="tel"
                    value={simPhone}
                    onChange={(e) => { setSimPhone(e.target.value); if (simErrors.phone) setSimErrors({ ...simErrors, phone: undefined }); }}
                    className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${simErrors.phone ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                    placeholder="(555) 123-4567"
                  />
                </div>
                {simErrors.phone && <p className="mt-1 text-sm text-rose-700">{simErrors.phone}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Service type</label>
              <div className="flex gap-3">
                {['HVAC', 'Plumbing'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSimService(s); if (simErrors.service) setSimErrors({ ...simErrors, service: undefined }); }}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${simService === s ? 'bg-primary-400 text-ink-900 ring-2 ring-primary-300 ring-offset-1' : 'bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {simErrors.service && <p className="mt-1 text-sm text-rose-700">{simErrors.service}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Issue description</label>
              <textarea
                value={simIssue}
                onChange={(e) => { setSimIssue(e.target.value); if (simErrors.issue) setSimErrors({ ...simErrors, issue: undefined }); }}
                rows={3}
                className={`w-full rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all resize-none ${simErrors.issue ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                placeholder="AC stopped blowing cold air"
              />
              {simErrors.issue && <p className="mt-1 text-sm text-rose-700">{simErrors.issue}</p>}
            </div>

            <button
              type="submit"
              disabled={simSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {simSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />}
              Simulate Call
            </button>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!hasOpenSlots && <NoOpenSlotsNotice onGenerate={handleGenerate} generating={generating} />}
      {generateMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{generateMsg}</span>
        </div>
      )}

      {/* Leads list */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-ink-300 mb-4" />
          <p className="text-ink-600">No leads yet. Click "Simulate Missed Call" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              to={`/app/leads/${lead.id}`}
              className="block bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-5 hover:shadow-lg hover:ring-primary-300 transition-all"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-ink-900">{customerName(lead.customer_id)}</p>
                    {lead.is_demo ? <DemoBadge /> : <SimulatedBadge />}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-ink-500 flex-wrap">
                    <span className="capitalize">{lead.source.replace('_', ' ')}</span>
                    <span className="text-ink-300">|</span>
                    <span>{customerPhone(lead.customer_id)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => { const lbl = getLeadDisplayLabel(lead); return (
                    <>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${lbl.color}`}>
                        {lbl.label}
                      </span>
                      {lbl.label === 'Needs follow-up' && (
                        <Link
                          to={`/app/leads/${lead.id}?book=1`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
                        >
                          Book
                        </Link>
                      )}
                    </>
                  ); })()}
                  <ArrowLeft className="h-4 w-4 text-ink-300 rotate-180" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
