import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Business } from '@/types';
import { logError, GENERIC_SIGNUP_ERROR, GENERIC_SIGNIN_ERROR } from '@/lib/errors';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  business: Business | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null; weakPassword?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchBusiness(uid: string) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', uid)
      .maybeSingle();
    setBusiness(data as Business | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchBusiness(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchBusiness(sess.user.id).finally(() => setLoading(false));
      } else {
        setBusiness(null);
        setLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string): Promise<{ error: string | null; weakPassword?: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // One message for every failure cause: a different response for "already
    // registered" would let anyone test which email addresses have accounts.
    // A provider-side password rejection is the one exception — the provider
    // rejects weak passwords before any account lookup, so flagging it reveals
    // nothing about whether the email exists.
    if (error) {
      logError('auth.signUp', error);
      const isWeakPassword = error.code === 'weak_password';
      return { error: GENERIC_SIGNUP_ERROR, weakPassword: isWeakPassword };
    }
    if (data.user) {
      await supabase.from('businesses').insert({ owner_id: data.user.id });
      await fetchBusiness(data.user.id);
    }
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logError('auth.signIn', error);
      return { error: GENERIC_SIGNIN_ERROR };
    }
    if (data.user) await fetchBusiness(data.user.id);
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setBusiness(null);
  }

  async function refreshBusiness() {
    if (user) await fetchBusiness(user.id);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, business, loading, signUp, signIn, signOut, refreshBusiness }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
