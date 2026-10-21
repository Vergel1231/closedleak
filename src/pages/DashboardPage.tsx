import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  FlaskConical,
  Loader2,
  AlertCircle,
  Phone,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { Call, Event, Appointment, Lead } from '@/types';
import { toUserMessage } from '@/lib/errors';
import { generateSampleSlots } from '@/lib/sampleSlots';
import NoOpenSlotsNotice from '@/components/NoOpenSlotsNotice';

type DateRange = '7d' | '30d' | 'all';

const RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

function rangeStart(range: DateRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : 30));
  return d.toISOString();
}

interface FunnelStep {
  label: string;
  count: number;
  pctOfPrev: number | null;
}

interface Stats {
  missedCalls: number;
  recoveryTexts: number;
  customerReplies: number;
  qualified: number;
  slotsOffered: number;
  booked: number;
  recovered: number;
  bookedAppointments: number;
  escalatedAwaiting: number;
  escalatedAwaitingValue: number;
  escalationReasons: Record<string, number>;
  hasData: boolean;
}

export default function DashboardPage() {
  const { business } = useAuth();
  const [range, setRange] = useState<DateRange>('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasOpenSlots, setHasOpenSlots] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  const loadStats = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError('');

    try {
      const since = rangeStart(range);
      const iso = since ? since : undefined;

      const callsQ = supabase.from('calls').select('id, outcome, created_at').eq('business_id', business.id);
      const eventsQ = supabase.from('events').select('event_type, payload, lead_id, created_at').eq('business_id', business.id);
      const apptsQ = supabase.from('appointments').select('id, status, created_at').eq('business_id', business.id);
      const leadsQ = supabase.from('leads').select('id, conversation_state, status, created_at, qualification').eq('business_id', business.id);

      const [callsRes, eventsRes, apptsRes, leadsRes] = await Promise.all([
        iso ? callsQ.gte('created_at', iso) : callsQ,
        iso ? eventsQ.gte('created_at', iso) : eventsQ,
        iso ? apptsQ.gte('created_at', iso) : apptsQ,
        iso ? leadsQ.gte('created_at', iso) : leadsQ,
      ]);

      if (callsRes.error) throw new Error(callsRes.error.message);
      if (eventsRes.error) throw new Error(eventsRes.error.message);
      if (apptsRes.error) throw new Error(apptsRes.error.message);
      if (leadsRes.error) throw new Error(leadsRes.error.message);

      const slotsRes = await supabase
        .from('availability_slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString());
      if (slotsRes.error) throw new Error(slotsRes.error.message);
      setHasOpenSlots((slotsRes.data || []).length > 0);

      const calls = (callsRes.data as Pick<Call, 'id' | 'outcome' | 'created_at'>[]) || [];
      const events = (eventsRes.data as Pick<Event, 'event_type' | 'payload' | 'lead_id' | 'created_at'>[]) || [];
      const appts = (apptsRes.data as Pick<Appointment, 'id' | 'status' | 'created_at'>[]) || [];
      const leads = (leadsRes.data as Pick<Lead, 'id' | 'conversation_state' | 'status' | 'created_at' | 'qualification'>[]) || [];

      const countEvents = (type: string) => events.filter((e) => e.event_type === type).length;

      const escalationReasons: Record<string, number> = {};
      for (const e of events) {
        if (e.event_type !== 'lead.escalated') continue;
        const reason = (e.payload as { reason?: string } | null)?.reason || 'unspecified';
        escalationReasons[reason] = (escalationReasons[reason] || 0) + 1;
      }

      setStats({
        missedCalls: calls.filter((c) => c.outcome === 'missed').length,
        recoveryTexts: countEvents('customer.contacted'),
        customerReplies: countEvents('message.received'),
        qualified: countEvents('lead.qualified'),
        slotsOffered: countEvents('appointment.offered'),
        booked: countEvents('appointment.booked'),
        recovered: countEvents('lead.recovered'),
        bookedAppointments: appts.filter((a) => a.status === 'booked').length,
        escalatedAwaiting: leads.filter((l) => l.conversation_state === 'ESCALATED').length,
        // Service-area escalations are not recoverable jobs, so they are
        // excluded from the estimated value waiting on follow-up.
        escalatedAwaitingValue: leads.filter(
          (l) =>
            l.conversation_state === 'ESCALATED' &&
            l.qualification?.escalation_reason !== 'outside service area' &&
            l.qualification?.escalation_reason !== 'service area not configured'
        ).length,
        escalationReasons,
        hasData: calls.length > 0 || events.length > 0 || appts.length > 0 || leads.length > 0,
      });
    } catch (err) {
      setError(toUserMessage('dashboard.load', err, 'Failed to load dashboard data'));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [business, range]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleGenerate() {
    if (!business) return;
    setGenerating(true);
    setGenerateMsg('');
    const result = await generateSampleSlots(business.id, business.business_hours || {});
    setGenerating(false);
    if (result.error) {
      setError(toUserMessage('dashboard.generateSlots', new Error(result.error), 'Failed to generate sample times'));
      return;
    }
    setGenerateMsg(`Created ${result.created} open appointment times for the next 7 days.`);
    setHasOpenSlots(result.created > 0 ? true : hasOpenSlots);
    await loadStats();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadStats}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  if (!stats || !stats.hasData) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <TrendingUp className="h-12 w-12 text-ink-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink-900">Start here</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6 sm:p-8">
          <ol className="space-y-5">
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-bold text-ink-900">1</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">Load demo data</p>
                  <Link
                    to="/app/demo"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
                  >
                    <FlaskConical className="h-4 w-4" /> Demo Data
                  </Link>
                </div>
                <p className="mt-1 text-sm text-ink-500">See a realistic 14-day history instantly.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-bold text-ink-900">2</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">Simulate a missed call</p>
                  <Link
                    to="/app/leads"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> Leads
                  </Link>
                </div>
                <p className="mt-1 text-sm text-ink-500">Create a fake inbound call and watch the follow-up begin.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-bold text-ink-900">3</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">Watch it become a booking</p>
                  <Link
                    to="/app/appointments"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
                  >
                    <Calendar className="h-4 w-4" /> Appointments
                  </Link>
                </div>
                <p className="mt-1 text-sm text-ink-500">See the recovered job on your schedule.</p>
              </div>
            </li>
          </ol>
          <p className="mt-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            Use fake data only. Nothing here is sent to real customers.
          </p>
        </div>
      </div>
    );
  }

  const avgValue = Number(business?.avg_job_value ?? 350);
  const bookedValue = stats.bookedAppointments * avgValue;
  const escalatedValue = stats.escalatedAwaitingValue * avgValue;

  const steps: FunnelStep[] = [
    { label: 'Missed calls', count: stats.missedCalls, pctOfPrev: null },
    { label: 'Recovery texts sent', count: stats.recoveryTexts, pctOfPrev: pct(stats.recoveryTexts, stats.missedCalls) },
    { label: 'Customer replied', count: stats.customerReplies, pctOfPrev: pct(stats.customerReplies, stats.recoveryTexts) },
    { label: 'Qualified', count: stats.qualified, pctOfPrev: pct(stats.qualified, stats.customerReplies) },
    { label: 'Slots offered', count: stats.slotsOffered, pctOfPrev: pct(stats.slotsOffered, stats.qualified) },
    { label: 'Booked', count: stats.booked, pctOfPrev: pct(stats.booked, stats.slotsOffered) },
  ];
  const maxCount = Math.max(1, ...steps.map((s) => s.count));

  const reasonEntries = Object.entries(stats.escalationReasons).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <div className="flex rounded-xl bg-white ring-1 ring-ink-200 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                range === opt.key ? 'bg-primary-400 text-ink-900' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demo mode banner */}
      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
        Demo mode: all calls and texts are simulated. DEMO records are sample data.
      </div>

      {!hasOpenSlots && <NoOpenSlotsNotice onGenerate={handleGenerate} generating={generating} />}
      {generateMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{generateMsg}</span>
        </div>
      )}

      {/* Funnel */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-ink-900 mb-4">Recovery funnel</h2>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold text-ink-800">{step.label}</span>
                <span className="text-ink-600">
                  {step.count}
                  {step.pctOfPrev !== null && (
                    <span className="text-ink-400"> &middot; {step.pctOfPrev}% of previous</span>
                  )}
                </span>
              </div>
              <div className="h-3 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-400"
                  style={{ width: `${(step.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={RotateCcw} label="Recovered leads" value={stats.recovered} hint="lead.recovered events" />
        <StatCard icon={Calendar} label="Booked appointments" value={stats.bookedAppointments} hint="status booked" />
        <StatCard icon={AlertTriangle} label="Escalated — awaiting a human" value={stats.escalatedAwaiting} hint="leads in Escalated state" />
      </div>

      {/* Escalation breakdown */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-primary-400" />
          <h2 className="text-lg font-bold text-ink-900">Escalations by reason</h2>
        </div>
        {reasonEntries.length === 0 ? (
          <p className="text-sm text-ink-400">No escalations in this period.</p>
        ) : (
          <ul className="space-y-2">
            {reasonEntries.map(([reason, count]) => (
              <li key={reason} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                <span className="text-ink-800 capitalize">{reason}</span>
                <span className="font-semibold text-ink-900">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Value section */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary-400" />
          <h2 className="text-lg font-bold text-ink-900">Value</h2>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-ink-800">Estimated value of booked appointments</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300">Estimate</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-ink-900">${bookedValue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-400">
              {stats.bookedAppointments} booked appointments &times; ${avgValue} average job value
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-ink-800">Estimated value waiting on human follow-up</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300">Estimate</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-ink-900">${escalatedValue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-400">
              {stats.escalatedAwaitingValue} escalated leads (excluding outside service area) &times; ${avgValue} average job value
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 p-4">
            <p className="text-sm font-semibold text-ink-800">Confirmed revenue</p>
            <p className="mt-1 text-sm text-ink-500">Not tracked in demo mode</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-400">
          Estimates use booked appointments or escalated leads multiplied by your average job value.
          They are estimates only — not confirmed revenue.
        </p>
      </div>
    </div>
  );
}

function pct(count: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round((count / prev) * 100);
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Phone; label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-lg bg-primary-50 p-2">
          <Icon className="h-4 w-4 text-primary-400" />
        </div>
        <p className="text-sm font-semibold text-ink-600">{label}</p>
      </div>
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </div>
  );
}
