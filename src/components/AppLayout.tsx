import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Wrench, LogOut, Settings, FlaskConical, Home, Users, Calendar, Activity } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { SecondaryButton } from '@/components/SecondaryButton';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, business } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const navLinks = [
    { to: '/app', label: 'Dashboard', icon: Home },
    { to: '/app/leads', label: 'Leads', icon: Users },
    { to: '/app/appointments', label: 'Appointments', icon: Calendar },
    { to: '/app/events', label: 'Events', icon: Activity },
    { to: '/app/settings', label: 'Settings', icon: Settings },
    { to: '/app/demo', label: 'Demo Data', icon: FlaskConical },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <header className="sticky top-0 z-50 bg-ink-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to={user ? '/app' : '/'} className="flex items-center gap-2 hover:text-primary-400 transition-colors">
              <Wrench className="h-7 w-7 text-primary-400" />
              <span className="text-lg font-bold tracking-tight">ClosedLeak</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {user ? (
                <>
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        location.pathname === link.to ? 'text-primary-400' : 'text-ink-200 hover:text-white'
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  ))}
                  <div className="text-sm text-ink-300 max-w-[140px] truncate">
                    {business?.name || user.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 text-sm font-medium text-ink-200 hover:text-white transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <SecondaryButton to="/login" className="px-4 py-2 text-sm">Login</SecondaryButton>
                  <Link
                    to="/signup"
                    className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>

            {user && (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 text-ink-200 hover:text-white"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            )}
            {!user && (
              <div className="md:hidden flex gap-3">
                <SecondaryButton to="/login" className="px-3 py-1.5 text-sm">Login</SecondaryButton>
                <Link to="/signup" className="rounded-lg bg-primary-400 px-3 py-1.5 text-sm font-semibold text-ink-900 hover:bg-primary-300 transition-colors">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {menuOpen && user && (
            <nav className="md:hidden pb-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    location.pathname === link.to ? 'text-primary-400' : 'text-ink-200 hover:text-white'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium text-ink-200 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-ink-900 text-ink-300 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm">
          ClosedLeak &mdash; Stop closing the door on jobs you never knew you lost.
        </div>
      </footer>
    </div>
  );
}
