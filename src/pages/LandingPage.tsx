import { Link } from 'react-router-dom';
import { Wrench, Phone, DollarSign, TrendingDown, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { SecondaryButton } from '@/components/SecondaryButton';
import { sanitizeNumeric, clampPercentString, parseNum } from '@/lib/numericInput';

function RevenueCalculator() {
  const [missedCalls, setMissedCalls] = useState('50');
  const [bookedPct, setBookedPct] = useState('30');
  const [avgJobValue, setAvgJobValue] = useState('350');

  const m = parseNum(missedCalls);
  const p = parseNum(bookedPct);
  const a = parseNum(avgJobValue);

  const recoverable = Math.round((m * (p / 100) * a) / 1);

  return (
    <div className="bg-white rounded-2xl shadow-xl ring-1 ring-ink-100 p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-6">
        <TrendingDown className="h-6 w-6 text-rose-600" />
        <h3 className="text-xl font-bold text-ink-900">Revenue-Leak Calculator</h3>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-1">
            Missed calls per month
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
            <input
              type="text"
              inputMode="decimal"
              value={missedCalls}
              onChange={(e) => setMissedCalls(sanitizeNumeric(e.target.value))}
              className="w-full rounded-lg border border-ink-200 pl-9 pr-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-1">
            Percent that would have booked (%)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={bookedPct}
            onChange={(e) => setBookedPct(clampPercentString(e.target.value))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-1">
            Average job value ($)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
            <input
              type="text"
              inputMode="decimal"
              value={avgJobValue}
              onChange={(e) => setAvgJobValue(sanitizeNumeric(e.target.value))}
              className="w-full rounded-lg border border-ink-200 pl-9 pr-3 py-2.5 text-ink-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-gradient-to-br from-ink-900 to-ink-800 p-6 text-center">
        <p className="text-sm font-medium text-ink-300 mb-1">Estimated recoverable revenue</p>
        <p className="text-4xl font-bold text-primary-400">
          ${recoverable.toLocaleString()}
          <span className="text-lg font-normal text-ink-300">/mo</span>
        </p>
        <div className="mt-3 text-sm text-ink-100 font-mono bg-ink-800/80 rounded-lg py-2.5 px-4">
          {m} &times; {(p / 100).toFixed(2)} &times; ${a} = ${recoverable.toLocaleString()}
        </div>
        <p className="mt-3 text-sm text-ink-200 italic">
          This is an estimate, not confirmed revenue.
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-400/10 px-3 py-1 text-sm font-medium text-primary-400 ring-1 ring-primary-400/20 mb-6">
                <Wrench className="h-4 w-4" />
                For HVAC &amp; Plumbing businesses
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                We recover the jobs your business is losing.
              </h1>
              <p className="mt-4 text-lg text-ink-200">
                Stop closing the door on jobs you never knew you lost. ClosedLeak catches missed
                calls, follows up on missed calls and helps turn them into booked jobs.
              </p>
              <p className="mt-3 text-sm font-medium text-amber-300">
                Demo mode: calls and texts are simulated in this version.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-400 px-6 py-3 text-base font-semibold text-ink-900 hover:bg-primary-300 transition-all hover:scale-105"
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <SecondaryButton to="/login">Login</SecondaryButton>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-ink-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-400" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-400" />
                  Demo mode available
                </span>
              </div>
            </div>

            <RevenueCalculator />
          </div>
        </div>
      </section>

      {/* Problem stats */}
      <section className="bg-ink-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ink-900">The problem is bigger than you think</h2>
            <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
              Every missed call is a potential customer who called your competitor instead. The
              numbers below are illustrative examples, not measured results.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { stat: '62%', label: 'Example: of calls to home service businesses go unanswered during busy hours' },
              { stat: '85%', label: 'Example: of callers who reach voicemail hang up and call the next business' },
              { stat: '$0', label: 'revenue from a customer you never knew tried to reach you' },
            ].map((item) => (
              <div key={item.stat} className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-8 text-center relative">
                {item.stat !== '$0' && (
                  <span className="absolute top-3 right-3 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Example</span>
                )}
                <p className="text-5xl font-bold text-rose-600">{item.stat}</p>
                <p className="mt-3 text-sm text-ink-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ink-900">How ClosedLeak works</h2>
            <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
              Three steps to stop losing revenue you've earned.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'Catch the miss', desc: 'Every missed call is logged automatically with caller details and a lead is created instantly.' },
              { num: '02', title: 'Re-engage automatically', desc: 'ClosedLeak sends a text back to the caller within seconds, offering to book a time slot.' },
              { num: '03', title: 'Book the job', desc: 'The customer picks a slot from your availability. You see the new appointment on your dashboard. (Coming soon: automatic two-way texting with a live phone number.)' },
            ].map((step) => (
              <div key={step.num} className="relative">
                <div className="text-6xl font-bold text-primary-100">{step.num}</div>
                <h3 className="mt-2 text-xl font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-ink-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="bg-ink-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 mb-3">
              Roadmap: simulated in this demo
            </span>
            <h2 className="text-3xl font-bold text-ink-900">How this becomes real</h2>
            <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
              These steps are not built yet. Here is the path from the simulated experience above to a live deployment.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'Missed call detected', desc: 'Your phone system tells ClosedLeak when a call goes unanswered.' },
              { num: '02', title: 'Text sent, replies handled', desc: 'ClosedLeak texts the caller and handles the conversation, with opt-in and opt-out.' },
              { num: '03', title: 'Booking synced', desc: 'Confirmed times go to your scheduling tool.' },
            ].map((step) => (
              <div key={step.num} className="bg-white rounded-2xl shadow-md ring-1 ring-ink-100 p-6">
                <div className="text-3xl font-bold text-primary-200">{step.num}</div>
                <h3 className="mt-2 text-lg font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to stop the leak?</h2>
          <p className="mt-3 text-ink-300">
            Sign up now and see how much revenue you could be recovering every month.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-400 px-8 py-3.5 text-lg font-semibold text-ink-900 hover:bg-primary-300 transition-all hover:scale-105"
          >
            Create Your Free Account
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
