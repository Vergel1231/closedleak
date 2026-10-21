import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Wrench, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [passwordHint, setPasswordHint] = useState('Use a unique password.');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e: { email?: string; password?: string; confirmPassword?: string } = {};
    if (!email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    const { error, weakPassword } = await signUp(email.trim(), password);
    setSubmitting(false);
    if (error) {
      if (weakPassword) {
        setErrors({ password: 'Choose a stronger password. Common or previously breached passwords are not accepted.' });
      } else {
        setFormError(error);
      }
    } else {
      navigate('/app/settings');
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-ink-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Wrench className="mx-auto h-12 w-12 text-primary-400" />
          <h1 className="mt-3 text-2xl font-bold text-ink-900">Create your account</h1>
          <p className="mt-1 text-ink-600">Start recovering lost jobs today</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-ink-100 p-6 sm:p-8">
          {formError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${
                    errors.email
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                      : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-rose-700">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${
                    errors.password
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                      : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'
                  }`}
                  placeholder="At least 8 characters"
                />
              </div>
              {errors.password ? (
                <p className="mt-1 text-sm text-rose-700">{errors.password}</p>
              ) : (
                <p className="mt-1 text-xs text-ink-400">{passwordHint}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-600 mb-1">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-ink-900 outline-none transition-all ${
                    errors.confirmPassword
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                      : 'border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200'
                  }`}
                  placeholder="Re-enter your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-rose-700">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary-400 py-2.5 font-semibold text-ink-900 hover:bg-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
