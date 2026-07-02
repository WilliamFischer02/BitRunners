// Leaderboard client (mega-batch 2, owner-requested). Thin wrappers over the
// SECURITY DEFINER RPCs authored in supabase/migrations/0017. Everything
// degrades gracefully: signed-out, unconfigured, or (until the owner applies
// 0017) missing-RPC calls resolve to a no-op / null so the UI can show a
// friendly empty state instead of erroring.

import { getSupabase } from './supabase.js';

export type LeaderboardGame = 'freq_lock' | 'circuit_patch' | 'core_run';
export type EconomyMetric = 'passcodes' | 'credits';

export interface LeaderRow {
  rank: number;
  name: string;
  value: number;
  completions?: number;
}

/** Submit a run's score. Fire-and-forget; no-op when signed out / unconfigured
 *  / the RPC isn't deployed yet. Monotonic + clamped server-side. */
export async function submitMinigameScore(game: LeaderboardGame, score: number): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.rpc('submit_minigame_score', { p_game: game, p_score: Math.round(score) });
  } catch {
    // offline / migration 0017 not applied — leaderboards are best-effort
  }
}

interface RawGameRow {
  rank: number;
  display_name: string;
  best_score: number;
  completions: number;
}

/** Top-N for a minigame. Returns null when unavailable (show an empty state). */
export async function fetchMinigameLeaderboard(
  game: LeaderboardGame,
  limit = 10,
): Promise<LeaderRow[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('get_leaderboard', { p_game: game, p_limit: limit });
    if (error || !Array.isArray(data)) return null;
    return (data as RawGameRow[]).map((r) => ({
      rank: r.rank,
      name: r.display_name,
      value: r.best_score,
      completions: r.completions,
    }));
  } catch {
    return null;
  }
}

interface RawEconomyRow {
  rank: number;
  display_name: string;
  value: number;
}

/** Top-N accounts by a data-scrape metric (total passcodes / credits). */
export async function fetchEconomyLeaderboard(
  metric: EconomyMetric,
  limit = 10,
): Promise<LeaderRow[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('get_economy_leaderboard', {
      p_metric: metric,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return null;
    return (data as RawEconomyRow[]).map((r) => ({
      rank: r.rank,
      name: r.display_name,
      value: Number(r.value),
    }));
  } catch {
    return null;
  }
}
