// Server → client mission reconciliation.
//
// The server (migration 0011 RPCs) is the source of truth for mission
// progress. On sign-in we read every mission's row and rebuild the local
// store + the in-memory active-mission singleton from it, so a returning
// runner — even on a fresh device — lands on exactly the objective and
// checkpoint they left, and completed objectives stay complete forever.
//
// Writes (start_mission / advance_checkpoint / complete_mission) are driven
// from mission-sync.ts and MissionDialogue.tsx. This module owns the READ.
//
// Started once from App.tsx. It subscribes to auth and reconciles on each
// distinct signed-in user (guarded against token-refresh re-runs that would
// otherwise reset a mid-session position).

import { reconcileFromServer } from './mission-progress-local.js';
import {
  MISSION_CHAIN,
  type MissionFaction,
  type MissionState,
  getMission,
  setActiveMission,
} from './missions.js';
import { type MissionProgress, fetchMissionProgress, subscribeAuth } from './supabase.js';

export interface ReconciledProgress {
  completed: string[];
  factions: Record<string, MissionFaction>;
  active: string | null;
  nextIdx: number;
  activeState: MissionState;
}

/** Pure reconciliation: given the server's per-mission rows (keyed by mission
 *  key, null = no row) and the ordered chain, produce the local store shape.
 *  Exported for unit testing without a Supabase client. */
export function reconcileServerProgress(
  chain: readonly string[],
  rows: Readonly<Record<string, MissionProgress | null>>,
): ReconciledProgress {
  const completed: string[] = [];
  const factions: Record<string, MissionFaction> = {};
  for (const key of chain) {
    const row = rows[key];
    if (row?.state === 'complete') {
      completed.push(key);
      if (row.factionChoice) factions[key] = row.factionChoice;
    }
  }

  // First chain mission the runner has NOT completed (computed against the
  // chain argument, not the global, so this stays pure + testable).
  const activeKey = chain.find((key) => !completed.includes(key)) ?? null;
  if (!activeKey) {
    // Chain cleared — nothing active.
    return { completed, factions, active: null, nextIdx: 0, activeState: 'inactive' };
  }

  const activeRow = rows[activeKey];
  // The client model's nextIdx maps 1:1 onto the server's last_checkpoint
  // (advance_checkpoint is called with the new nextIdx each crossing).
  const nextIdx = activeRow ? Math.max(0, activeRow.lastCheckpoint) : 0;
  const activeState: MissionState = activeRow?.state === 'final' ? 'final' : 'active';

  return { completed, factions, active: activeKey, nextIdx, activeState };
}

/** Apply a reconciled snapshot to the local store + the active singleton. */
function apply(snap: ReconciledProgress): void {
  reconcileFromServer(snap);
  if (snap.active) {
    const mission = getMission(snap.active);
    if (mission) {
      setActiveMission({
        mission,
        nextIdx: snap.nextIdx,
        state: snap.activeState,
        factionChoice: null,
      });
      // A mission left in 'final' (last checkpoint reached, faction not yet
      // chosen) must re-open its dialogue so the runner can resolve it.
      if (snap.activeState === 'final') {
        try {
          window.dispatchEvent(new CustomEvent('bitrunners:mission-final'));
        } catch {
          // non-DOM env — ignore
        }
      }
    }
  } else {
    setActiveMission(null);
  }
}

let started = false;
let lastUid: string | null = null;

export function startMissionServerLoad(): void {
  if (started) return;
  started = true;
  subscribeAuth((auth) => {
    if (auth.status !== 'authenticated' || !auth.user) {
      lastUid = null;
      return;
    }
    // Only reconcile once per distinct user; token refreshes re-fire
    // 'authenticated' and must not reset a mid-session position.
    if (auth.user.id === lastUid) return;
    lastUid = auth.user.id;

    void (async () => {
      try {
        const entries = await Promise.all(
          MISSION_CHAIN.map(async (key) => [key, await fetchMissionProgress(key)] as const),
        );
        const rows: Record<string, MissionProgress | null> = {};
        for (const [key, row] of entries) rows[key] = row;
        apply(reconcileServerProgress(MISSION_CHAIN, rows));
      } catch {
        // Network/RPC failure — keep the device-local fallback as-is.
      }
    })();
  });
}
