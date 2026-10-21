import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/datetime';
import { DemoBadge, SimulatedBadge } from '@/components/Badges';
import {
  Activity,
  Loader2,
  AlertCircle,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import type { Event, Customer } from '@/types';

const EVENT_ICONS: Record<string, typeof Phone> = {
  'call.missed': Phone,
  'lead.created': CheckCircle2,
  'message.sent': MessageSquare,
  'message.received': MessageSquare,
  'customer.contacted': CheckCircle2,
  'lead.qualified': CheckCircle2,
  'lead.escalated': AlertTriangle,
  'appointment.offered': Calendar,
  'appointment.booked': Calendar,
  'lead.recovered': CheckCircle2,
};

const EVENT_TYPES = [
  'call.missed',
  'lead.created',
  'message.sent',
  'message.received',
  'customer.contacted',
  'lead.qualified',
  'lead.escalated',
  'appointment.offered',
  'appointment.booked',
  'lead.recovered',
];

export default function EventsPage() {
  const { business } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const [evRes, custRes] = await Promise.all([
      supabase.from('events').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('customers').select('*').eq('business_id', business.id),
    ]);
    setEvents((evRes.data as Event[]) || []);
    setCustomers((custRes.data as Customer[]) || []);
    setLoading(false);
  }, [business]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function customerName(customerId: string | null): string {
    if (!customerId) return '';
    const match = customers.find((c) => c.id === customerId);
    return match ? `${match.first_name} ${match.last_name}` : '';
  }

  const filteredEvents = filter ? events.filter((e) => e.event_type === filter) : events;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-7 w-7 text-primary-400" />
        <h1 className="text-2xl font-bold text-ink-900">Events</h1>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-ink-600 mb-2">Filter by event type</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === '' ? 'bg-primary-400 text-ink-900' : 'bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100'}`}
          >
            All
          </button>
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? '' : type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === type ? 'bg-primary-400 text-ink-900' : 'bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100'}`}
            >
              {type.replace(/[._]/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Events feed */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-ink-300 mb-4" />
          <p className="text-ink-600">No events{filter ? ' match this filter' : ' yet'}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((evt) => {
            const Icon = EVENT_ICONS[evt.event_type] || Activity;
            const custName = customerName(evt.customer_id);
            const isDemo = evt.is_demo;
            return (
              <div key={evt.id} className="bg-white rounded-xl shadow-sm ring-1 ring-ink-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-ink-50 p-2">
                    <Icon className="h-4 w-4 text-ink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink-900">{evt.event_type}</p>
                      {isDemo ? <DemoBadge /> : <SimulatedBadge />}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-500 flex-wrap">
                      {evt.lead_id && (
                        <Link to={`/app/leads/${evt.lead_id}`} className="text-primary-700 hover:text-primary-800 font-semibold">
                          View Lead
                        </Link>
                      )}
                      {custName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {custName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 mt-1">{formatDateTime(evt.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
