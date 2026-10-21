import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Save, CheckCircle2, AlertCircle, Loader2, Store, Clock, MapPin, Wrench, Phone, X, Plus, DollarSign } from 'lucide-react';
import { validatePhone, normalizePhone, formatPhone } from '@/lib/phone';
import { sanitizeNumeric, parseNum } from '@/lib/numericInput';
import { toUserMessage } from '@/lib/errors';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_HOURS: Record<string, string> = {
  mon: '9:00-17:00',
  tue: '9:00-17:00',
  wed: '9:00-17:00',
  thu: '9:00-17:00',
  fri: '9:00-17:00',
  sat: 'closed',
  sun: 'closed',
};

export default function SettingsPage() {
  const { business, refreshBusiness, loading } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avgJobValue, setAvgJobValue] = useState('350');
  const [avgJobValueError, setAvgJobValueError] = useState('');
  const [address, setAddress] = useState('');
  const [serviceZips, setServiceZips] = useState<string[]>([]);
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');
  const [hours, setHours] = useState<Record<string, string>>(DEFAULT_HOURS);
  const [services, setServices] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (business) {
      setName(business.name || '');
      setPhone(business.phone ? formatPhone(business.phone) : '');
      setPhoneError('');
      setAvgJobValue(String(business.avg_job_value ?? 350));
      setAddress(business.address || '');
      setServiceZips(business.service_zips || []);
      setHours(business.business_hours || DEFAULT_HOURS);
      setServices(business.supported_services || []);
    }
  }, [business]);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  }

  function handleAddZip() {
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a valid 5-digit US zip code');
      return;
    }
    if (serviceZips.includes(zip)) {
      setZipError('That zip code is already in your list');
      return;
    }
    setServiceZips([...serviceZips, zip].sort());
    setZipInput('');
    setZipError('');
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!business) return;

    const phoneErr = validatePhone(phone);
    setPhoneError(phoneErr || '');
    if (phoneErr) return;

    const valueNum = parseNum(avgJobValue);
    if (!avgJobValue.trim() || valueNum <= 0) {
      setAvgJobValueError('Enter a job value greater than 0');
      return;
    }
    const normalizedValue = valueNum;

    const normalizedPhone = normalizePhone(phone) || '';

    setSaving(true);
    setError('');
    setSavedMsg('');

    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        name,
        phone: normalizedPhone,
        address,
        service_zips: serviceZips,
        business_hours: hours,
        supported_services: services,
        avg_job_value: normalizedValue,
      })
      .eq('id', business.id);

    setSaving(false);

    if (updateError) {
      setError(toUserMessage('settings.save', updateError, 'We could not save your settings. Please try again.'));
    } else {
      setSavedMsg('Settings saved successfully.');
      await refreshBusiness();
      setTimeout(() => setSavedMsg(''), 4000);
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
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-6">Business Settings</h1>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {savedMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-accent-50 border border-accent-300 px-4 py-3 text-sm text-accent-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Info */}
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Store className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Business Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Business name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                placeholder="Acme HVAC &amp; Plumbing"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError('');
                    }}
                    className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${
                      phoneError
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                        : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <p className="mt-1 text-xs text-ink-400">US numbers only, for example (555) 123-4567. Leave blank to skip.</p>
                {phoneError && <p className="mt-1 text-sm text-rose-700">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-600 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  placeholder="123 Main St, Springfield, USA"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Average job value ($)</label>
              <p className="text-sm text-ink-400 mb-2">Used to estimate the value of booked appointments and leads waiting on follow-up.</p>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={avgJobValue}
                  onChange={(e) => {
                    setAvgJobValue(sanitizeNumeric(e.target.value));
                    if (avgJobValueError) setAvgJobValueError('');
                  }}
                  className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${
                    avgJobValueError
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                      : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'
                  }`}
                  placeholder="350"
                />
              </div>
              {avgJobValueError && <p className="mt-1 text-sm text-rose-700">{avgJobValueError}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Service area zip codes</label>
              <p className="text-sm text-ink-400 mb-2">Add the 5-digit US zip codes you serve. Customers outside these zips will be escalated for manual follow-up.</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={zipInput}
                  onChange={(e) => { setZipInput(e.target.value); if (zipError) setZipError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddZip(); } }}
                  className={`w-32 rounded-lg border px-3 py-2.5 text-ink-900 outline-none transition-all ${zipError ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'}`}
                  placeholder="62704"
                  maxLength={5}
                />
                <button
                  type="button"
                  onClick={handleAddZip}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-4 py-2.5 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100 transition-all"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
              {zipError && <p className="text-sm text-rose-700 mb-2">{zipError}</p>}
              {serviceZips.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-400">
                  <MapPin className="h-4 w-4" />
                  No service zips set. Customers will be escalated until you add at least one zip code.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {serviceZips.map((zip) => (
                    <span
                      key={zip}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-800 ring-1 ring-primary-200"
                    >
                      {zip}
                      <button
                        type="button"
                        onClick={() => setServiceZips(serviceZips.filter((z) => z !== zip))}
                        className="text-primary-400 hover:text-primary-700 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Business Hours</h2>
          </div>
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day.key} className="flex items-center gap-4">
                <span className="w-24 text-sm font-medium text-ink-600">{day.label}</span>
                <input
                  type="text"
                  value={hours[day.key] ?? ''}
                  onChange={(e) => setHours({ ...hours, [day.key]: e.target.value })}
                  className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  placeholder="9:00-17:00 or closed"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Supported Services */}
        <div className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-bold text-ink-900">Supported Services</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {['HVAC', 'Plumbing'].map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  services.includes(service)
                    ? 'bg-primary-400 text-ink-900 ring-2 ring-primary-300 ring-offset-1'
                    : 'bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100'
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-6 py-3 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" /> Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
