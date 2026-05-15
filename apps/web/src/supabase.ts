import { type Session, type SupabaseClient, type User, createClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;
let attempted = false;

/**
 * Returns a singleton Supabase client when both `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` are present in the build env. Returns null otherwise
 * so the UI can render guest-mode placeholders without crashing.
 */
export function getSupabase(): SupabaseClient | null {
  if (attempted) return cached;
  attempted = true;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || !url || typeof anon !== 'string' || !anon) {
    return null;
  }
  cached = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

export interface AuthSnapshot {
  status: 'guest' | 'authenticated';
  user?: User;
  session?: Session;
}

export type AuthListener = (snap: AuthSnapshot) => void;

export function subscribeAuth(cb: AuthListener): () => void {
  const sb = getSupabase();
  if (!sb) {
    cb({ status: 'guest' });
    return () => {
      // no-op
    };
  }
  void sb.auth.getSession().then(({ data }) => {
    if (data.session) {
      cb({ status: 'authenticated', user: data.session.user, session: data.session });
    } else {
      cb({ status: 'guest' });
    }
  });
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      cb({ status: 'authenticated', user: session.user, session });
    } else {
      cb({ status: 'guest' });
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithProvider(
  provider: 'google' | 'github' | 'azure',
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  return { error: error?.message ?? null };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function isAuthConfigured(): boolean {
  return getSupabase() !== null;
}
