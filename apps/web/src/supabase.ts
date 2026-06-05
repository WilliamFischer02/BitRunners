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

function normRole(r: unknown): Role {
  return r === 'admin' || r === 'dev' ? r : 'user';
}

export type Tier = 'free' | 'elevated';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  tier: Tier;
  createdAt: string;
  credits: number;
  tokens: number;
  /** Granted-but-not-yet-claimed totals (applied on the user's next load). */
  pendingCredits: number;
  pendingTokens: number;
}

/** Admin-only (SECURITY DEFINER admin_list_users re-checks is_admin and exposes
 *  auth.users.email only to admins). Returns null on error / unconfigured. */
export async function adminListUsers(): Promise<AdminUser[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_list_users');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ''),
    displayName: typeof r.display_name === 'string' ? r.display_name : null,
    role: normRole(r.role),
    tier: r.tier === 'elevated' ? 'elevated' : 'free',
    createdAt: String(r.created_at ?? ''),
    credits: Number(r.credits ?? 0),
    tokens: Number(r.tokens ?? 0),
    pendingCredits: Number(r.pending_credits ?? 0),
    pendingTokens: Number(r.pending_tokens ?? 0),
  }));
}

/** Admin-only. Queues a credit/token grant the recipient claims on next load. */
export async function adminGrantEconomy(
  target: string,
  credits: number,
  tokens: number,
  reason: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_grant_economy', {
    target,
    p_credits: credits,
    p_tokens: tokens,
    p_reason: reason,
  });
  return { error: error?.message ?? null };
}

/** Admin-only. Sets a user's account tier (free | elevated). */
export async function adminSetTier(target: string, tier: Tier): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_set_tier', { target, p_tier: tier });
  return { error: error?.message ?? null };
}

/** Admin-only. Increments a user's Samaritan score and awards crossing-tier badges.
 *  Returns the new score + newly-awarded badge keys, or null on error. */
export async function adminGrantSamaritan(
  target: string,
  faction: 'corp' | 'br',
  amount: number,
): Promise<{ newScore: number; newBadges: string[] } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { data, error } = await sb.rpc('admin_grant_samaritan', {
    target,
    p_faction: faction,
    p_amount: amount,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: 'no data returned' };
  const r = row as { new_score?: unknown; new_badges?: unknown };
  return {
    newScore: Number(r.new_score ?? 0),
    newBadges: Array.isArray(r.new_badges) ? (r.new_badges as string[]) : [],
  };
}

/** Admin-only. Sets a user's permissions role. Server blocks changing your own. */
export async function adminSetRole(target: string, role: Role): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_set_role', { target, p_role: role });
  return { error: error?.message ?? null };
}

export interface GrantClaim {
  credits: number;
  tokens: number;
}

/** Claims the signed-in user's pending economy grants exactly-once (atomic on
 *  the server). Returns the summed amounts to apply locally, or null on error. */
export async function claimEconomyGrants(): Promise<GrantClaim | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('claim_economy_grants');
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const r = row as { credits?: unknown; tokens?: unknown };
  return { credits: Number(r.credits ?? 0), tokens: Number(r.tokens ?? 0) };
}

// ────────── identity (Sub-Phase B, migration 0007) ──────────

export type DisplayNameStatus = 'unset' | 'pending' | 'approved' | 'rejected';

export interface IdentitySnapshot {
  displayName: string | null;
  displayNameStatus: DisplayNameStatus;
  displayNameNote: string | null;
  equippedBadge: string | null;
  equippedTheme: string | null;
  samaritanCorporate: number;
  samaritanBitrunner: number;
  unacknowledged: number;
}

/** Fetches the signed-in user's identity snapshot via SECURITY DEFINER RPC.
 *  Returns null if Supabase is unconfigured or the user is not signed in. */
export async function fetchMyIdentity(): Promise<IdentitySnapshot | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_identity');
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const r = row as Record<string, unknown>;
  const status = String(r.display_name_status ?? 'unset') as DisplayNameStatus;
  return {
    displayName: typeof r.display_name === 'string' ? r.display_name : null,
    displayNameStatus: status,
    displayNameNote: typeof r.display_name_note === 'string' ? r.display_name_note : null,
    equippedBadge: typeof r.equipped_badge === 'string' ? r.equipped_badge : null,
    equippedTheme: typeof r.equipped_theme === 'string' ? r.equipped_theme : null,
    samaritanCorporate: Number(r.samaritan_corporate ?? 0),
    samaritanBitrunner: Number(r.samaritan_bitrunner ?? 0),
    unacknowledged: Number(r.unacknowledged ?? 0),
  };
}

/** Submits a requested display name for owner review. Server-side checks:
 *  3..24 chars, [a-z0-9_]. Marks display_name_status='pending'. The public
 *  label keeps showing the previously-approved name until approval. */
export async function submitDisplayName(name: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('submit_display_name', { p_name: name });
  return { error: error?.message ?? null };
}

/** Equips a badge the user owns. Server verifies ownership in earned_badges. */
export async function equipBadge(key: string | null): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('equip_badge', { p_key: key ?? '' });
  return { error: error?.message ?? null };
}

/** Flips a badge's acknowledged flag (kills the '!' dot on the head label). */
export async function acknowledgeBadge(key: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('acknowledge_badge', { p_key: key });
  return { error: error?.message ?? null };
}

export interface MyBadge {
  badgeKey: string;
  earnedAt: string;
  acknowledged: boolean;
}

/** Lists every badge the user has earned (acknowledged or not). */
export async function fetchMyBadges(): Promise<MyBadge[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_badges');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((row) => ({
    badgeKey: String(row.badge_key ?? ''),
    earnedAt: String(row.earned_at ?? ''),
    acknowledged: row.acknowledged === true,
  }));
}

export interface DictionaryWord {
  word: string;
  category: 'emote' | 'object' | 'action' | 'name';
}

/** Loads the full emoticron_dictionary table. Cached for the session. */
let dictionaryCache: DictionaryWord[] | null = null;
export async function fetchDictionary(): Promise<DictionaryWord[] | null> {
  if (dictionaryCache) return dictionaryCache;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('emoticron_dictionary')
    .select('word, category')
    .order('word', { ascending: true });
  if (error || !data) return null;
  dictionaryCache = (data as Array<Record<string, unknown>>).map((row) => ({
    word: String(row.word ?? ''),
    category: (row.category as DictionaryWord['category']) ?? 'name',
  }));
  return dictionaryCache;
}

export interface PendingName {
  id: string;
  currentName: string | null;
  requested: string | null;
  submittedAt: string;
}

/** Admin-only: lists pending display-name submissions. */
export async function adminListPendingNames(): Promise<PendingName[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_list_pending_names');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ''),
    currentName: typeof r.current_name === 'string' ? r.current_name : null,
    requested: typeof r.requested === 'string' ? r.requested : null,
    submittedAt: String(r.submitted_at ?? ''),
  }));
}

/** Admin-only: approves a pending name. The requested name becomes display_name. */
export async function adminApproveName(target: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_approve_name', { target });
  return { error: error?.message ?? null };
}

/** Admin-only: rejects a pending name. Optional reviewer note. */
export async function adminRejectName(
  target: string,
  note: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_reject_name', { target, p_note: note });
  return { error: error?.message ?? null };
}
