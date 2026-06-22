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
    options: {
      // Send verification clicks to a hash route we control so we can
      // show a friendly "email verified" page instead of dropping the
      // user on the bare site root. detectSessionInUrl on the client
      // auto-consumes the session token from the hash on arrival.
      emailRedirectTo: `${window.location.origin}#auth/verified`,
    },
  });
  return { error: error?.message ?? null };
}

/** Send a password-reset email. The link in it lands on
 *  `#auth/recovery` which renders the `<AuthCallback />` reset form. */
export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}#auth/recovery`,
  });
  return { error: error?.message ?? null };
}

/** Set a new password for the currently-authenticated user. Called from
 *  the reset-completion form after Supabase has consumed the recovery
 *  token in the URL hash and established a session. */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.auth.updateUser({ password: newPassword });
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

export interface EconomySaveResult {
  accepted: boolean;
  reason: string;
}

/**
 * Persists the economy blob through the guarded save_economy RPC (migration
 * 0016). The server rejects stale / rolled-back writes (an incoming blob with
 * fewer lifetimeScrapes than stored), so a fresh or stale device can no longer
 * clobber good progress. Falls back to the legacy direct upsert when the RPC
 * isn't deployed yet, so the client keeps saving before 0016 is applied.
 * Returns null only on a hard network/config failure.
 */
export async function saveEconomy(uid: string, blob: unknown): Promise<EconomySaveResult | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('save_economy', { p_blob: blob });
  if (error) {
    // PGRST202 = RPC not found (0016 not applied yet) → fall back to the legacy
    // direct upsert so saves still persist. Any other error is a real failure.
    const missing = error.code === 'PGRST202' || /save_economy/i.test(error.message);
    if (!missing) {
      console.warn('[bitrunners] save_economy failed:', error.message);
      return null;
    }
    const { error: upErr } = await sb
      .from('player_economy')
      .upsert({ user_id: uid, blob, updated_at: new Date().toISOString() });
    if (upErr) {
      console.warn('[bitrunners] economy upsert (fallback) failed:', upErr.message);
      return null;
    }
    return { accepted: true, reason: 'fallback-upsert' };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { accepted: true, reason: 'ok' };
  const r = row as { accepted?: unknown; reason?: unknown };
  return { accepted: r.accepted === true, reason: String(r.reason ?? '') };
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

// ────────── themes (Sub-Phase E, migration 0008) ────────────────────────────

export interface OwnedTheme {
  themeKey: string;
  acquiredAt: string;
}

/** Lists every theme the signed-in user owns, oldest first. */
export async function fetchMyOwnedThemes(): Promise<OwnedTheme[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_themes');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    themeKey: String(r.theme_key ?? ''),
    acquiredAt: String(r.acquired_at ?? ''),
  }));
}

/** Purchases a theme. Balance deduction is handled client-side before calling
 *  this. The RPC verifies the faction gate (if any) and inserts into
 *  owned_themes. Idempotent — re-buying an owned theme is a no-op. */
export async function purchaseTheme(key: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('purchase_theme', { p_key: key });
  return { error: error?.message ?? null };
}

/** Equips a theme the user owns (or terminal_green, which is always allowed).
 *  Pass null / '' to unequip (scene falls back to terminal_green rendering). */
export async function equipTheme(key: string | null): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('equip_theme', { p_key: key ?? '' });
  return { error: error?.message ?? null };
}

// ────────── emoticron submissions (Sub-Phase D, migration 0010) ──────────────

export type EmoticonStatus = 'pending' | 'approved' | 'rejected';

export interface MyEmoticonSubmission {
  word1: string;
  word2: string;
  status: EmoticonStatus;
  note: string | null;
  submittedAt: string;
}

/** Submits a 2-word emoticron combo for review. Server validates both words
 *  exist in emoticron_dictionary. Upserts — replaces any prior submission. */
export async function submitEmoticon(
  word1: string,
  word2: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('submit_emoticron', { p_word1: word1, p_word2: word2 });
  return { error: error?.message ?? null };
}

/** Fetches the signed-in user's current emoticron submission (if any).
 *  Returns null when Supabase is unconfigured, not authenticated, or no record exists. */
export async function fetchMyEmoticonSubmission(): Promise<MyEmoticonSubmission | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_emoticron_submission');
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const r = row as Record<string, unknown>;
  return {
    word1: String(r.word1 ?? ''),
    word2: String(r.word2 ?? ''),
    status: (r.status as EmoticonStatus) ?? 'pending',
    note: typeof r.note === 'string' ? r.note : null,
    submittedAt: String(r.submitted_at ?? ''),
  };
}

export interface PendingEmoticon {
  userId: string;
  email: string;
  word1: string;
  word2: string;
  submittedAt: string;
}

/** Admin-only: lists all pending emoticron submissions. Returns zero rows to non-admins. */
export async function adminListPendingEmoticons(): Promise<PendingEmoticon[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_list_pending_emoticrons');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id ?? ''),
    email: String(r.email ?? ''),
    word1: String(r.word1 ?? ''),
    word2: String(r.word2 ?? ''),
    submittedAt: String(r.submitted_at ?? ''),
  }));
}

/** Admin-only: approves a pending emoticron submission by user ID. */
export async function adminApproveEmoticon(userId: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_approve_emoticron', { p_user_id: userId });
  return { error: error?.message ?? null };
}

/** Admin-only: rejects a pending emoticron submission, with an optional note for the user. */
export async function adminRejectEmoticon(
  userId: string,
  note: string,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('admin_reject_emoticron', { p_user_id: userId, p_note: note });
  return { error: error?.message ?? null };
}

// ────────── physical missions (Sub-Phase G, migration 0011) ──────────

export type MissionFaction = 'corporate' | 'bitrunner';
export type MissionStateValue = 'active' | 'final' | 'complete';

export interface MissionProgress {
  state: MissionStateValue;
  lastCheckpoint: number;
  factionChoice: MissionFaction | null;
  updatedAt: string;
}

/** Reads server-side mission progress for the signed-in user. Null on
 *  guest / unconfigured / no row yet. */
export async function fetchMissionProgress(key: string): Promise<MissionProgress | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_mission_progress', { p_key: key });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const r = row as Record<string, unknown>;
  const fc = r.faction_choice;
  return {
    state: String(r.state ?? 'active') as MissionStateValue,
    lastCheckpoint: Number(r.last_checkpoint ?? 0),
    factionChoice: fc === 'corporate' || fc === 'bitrunner' ? (fc as MissionFaction) : null,
    updatedAt: String(r.updated_at ?? ''),
  };
}

/** Idempotent: inserts a fresh mission_progress row if none exists. */
export async function startMission(key: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('start_mission', { p_key: key });
  return { error: error?.message ?? null };
}

/** Pushes the server's `last_checkpoint` forward. `final = true` flips state
 *  to 'final' so the dialogue is gated server-side. */
export async function advanceCheckpoint(
  key: string,
  n: number,
  final: boolean,
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('advance_checkpoint', { p_key: key, p_n: n, p_is_final: final });
  return { error: error?.message ?? null };
}

export interface MissionCompletion {
  score: number;
  newBadges: string[];
}

/** Marks the mission complete, awards Samaritan to the chosen faction, and
 *  returns the new score + any badge keys crossed in this completion. */
export async function completeMissionRpc(
  key: string,
  choice: MissionFaction,
  reward = 5,
): Promise<{ data: MissionCompletion | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'auth not configured' };
  const { data, error } = await sb.rpc('complete_mission', {
    p_key: key,
    p_choice: choice,
    p_reward: reward,
  });
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: { score: 0, newBadges: [] }, error: null };
  const r = row as Record<string, unknown>;
  const arr = Array.isArray(r.new_badges) ? (r.new_badges as unknown[]) : [];
  return {
    data: {
      score: Number(r.score ?? 0),
      newBadges: arr.map((k) => String(k)).filter((k) => k.length > 0),
    },
    error: null,
  };
}

// ────────── DM moderation (migration 0012) ───────────────────────────────────
//
// Server-side counterparts of the client work shipped in PR 88 (tether
// moderation V1) and PR 90 (client-side block list). The web client computes
// the profanity verdict locally and submits it; the server re-runs the gate
// chain (verified, age, block list, rate limit) inside dm_send_message and
// audit-logs flagged + blocked rows. Clean messages are not persisted (see
// docs/lore/015 §audit trail).

export type DmVerdict = 'clean' | 'flagged' | 'blocked';

export interface DmSendResult {
  accepted: boolean;
  verdict: DmVerdict;
}

export async function dmSendMessage(
  to: string,
  roomId: string,
  body: string,
  verdict: DmVerdict,
): Promise<{ data: DmSendResult | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'auth not configured' };
  const { data, error } = await sb.rpc('dm_send_message', {
    p_to: to,
    p_room: roomId,
    p_body: body,
    p_moderation: verdict,
  });
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: { accepted: false, verdict: 'blocked' }, error: null };
  const r = row as { accepted?: unknown; verdict?: unknown };
  const v = r.verdict === 'flagged' || r.verdict === 'blocked' ? r.verdict : 'clean';
  return {
    data: { accepted: r.accepted === true, verdict: v as DmVerdict },
    error: null,
  };
}

export async function dmBlockUser(target: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('dm_block_user', { p_target: target });
  return { error: error?.message ?? null };
}

export async function dmUnblockUser(target: string): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb.rpc('dm_unblock_user', { p_target: target });
  return { error: error?.message ?? null };
}

export interface BlockedRunner {
  userId: string;
  displayName: string | null;
}

export async function dmListBlocked(): Promise<BlockedRunner[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('dm_list_blocked');
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id ?? ''),
    displayName: typeof r.display_name === 'string' ? r.display_name : null,
  }));
}

export interface DmReport {
  id: string;
  roomId: string;
  fromUser: string;
  toUser: string;
  body: string;
  verdict: DmVerdict;
  createdAt: string;
}

export async function adminListDmReports(days = 14): Promise<DmReport[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_list_dm_reports', { p_days: days });
  if (error || !data) return null;
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ''),
    roomId: String(r.room_id ?? ''),
    fromUser: String(r.from_user ?? ''),
    toUser: String(r.to_user ?? ''),
    body: String(r.body ?? ''),
    verdict: (r.moderation as DmVerdict) ?? 'flagged',
    createdAt: String(r.created_at ?? ''),
  }));
}
