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
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      if (event === 'SIGNED_IN') void logSignIn(session.user.id);
      cb({ status: 'authenticated', user: session.user, session });
    } else {
      cb({ status: 'guest' });
    }
  });
  return () => data.subscription.unsubscribe();
}

/** Fire-and-forget: records a sign-in event for DAU tracking. Silently no-ops
 *  if Supabase is unconfigured or the insert fails (non-critical path). */
async function logSignIn(userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('session_events').insert({ user_id: userId });
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

export type Role = 'user' | 'dev' | 'admin';

/** The signed-in user's role ('user' if guest / unconfigured / on error). */
export async function getMyRole(): Promise<Role> {
  const sb = getSupabase();
  if (!sb) return 'user';
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return 'user';
  const { data, error } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (error || !data) return 'user';
  const role = (data as { role?: string }).role;
  return role === 'admin' || role === 'dev' ? role : 'user';
}

/** Global under-construction flag. Fails OPEN (false) so a DB hiccup can't lock
 *  everyone out. */
export async function fetchUnderConstruction(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb
    .from('app_config')
    .select('value')
    .eq('key', 'under_construction')
    .maybeSingle();
  if (error || !data) return false;
  return (data as { value?: unknown }).value === true;
}

/** Admin-only (enforced by RLS). Flips the under-construction flag. */
export async function setUnderConstruction(on: boolean): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb
    .from('app_config')
    .update({ value: on, updated_at: new Date().toISOString() })
    .eq('key', 'under_construction');
  return { error: error?.message ?? null };
}

export interface DailySignin {
  day: string;
  dau: number;
}

/** Admin-only (enforced by SECURITY DEFINER in get_daily_signins). Returns
 *  daily active-user counts for the last `daysBack` days, newest first. */
export async function fetchActivityStats(daysBack = 30): Promise<DailySignin[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_daily_signins', { days_back: daysBack });
  if (error || !data) return null;
  return (data as Array<{ day: string; dau: number }>).map((row) => ({
    day: row.day,
    dau: Number(row.dau),
  }));
}
