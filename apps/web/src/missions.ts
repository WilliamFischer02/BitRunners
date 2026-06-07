// Physical missions registry + active-state singleton.
//
// Each mission is a sequence of checkpoint world-coords + a final-choice
// dialogue. The scene tick walks the local player against the active
// checkpoint; reaching it advances state. The last checkpoint opens the
// MissionDialogue overlay; the player's choice triggers a SECURITY DEFINER
// RPC that awards Samaritan to the chosen faction.
//
// Canon: docs/lore/011-physical-missions.md.
//
// Server is the source of truth for `state`/`last_checkpoint`/`faction_choice`
// via supabase/migrations/0011 RPCs (start_mission, advance_checkpoint,
// complete_mission). The client maintains a small cache and replays the last
// known state on scene init.

export type MissionState = 'inactive' | 'active' | 'final' | 'complete';

export interface Checkpoint {
  /** World-space X. */
  x: number;
  /** World-space Z. */
  z: number;
  /** Optional descriptor for HUD / accessibility. */
  label: string;
}

export interface Mission {
  key: string;
  title: string;
  checkpoints: Checkpoint[];
  /** Samaritan reward magnitude. Award goes to whichever faction the player
   *  picks at the final dialogue. */
  reward: number;
  /** Trigger radius around a checkpoint (world units, wrap-aware). */
  triggerDist: number;
  /** Dialogue keys for opening, faction-A reply (bitrunner/Admin), and
   *  faction-B reply (corporate/Company). Lines for these come from
   *  dialogue.ts; defaults are baked in if Supabase override is missing. */
  dialogue: {
    opening: string;
    choiceBitrunner: string;
    choiceCorporate: string;
    closingBitrunner: string;
    closingCorporate: string;
  };
}

// Mission catalog. Coordinates are inside the doubled (Phase 3) world half-
// extent of 19, picked to span the map without colliding with the existing
// decoration props (collider list in scene.ts).
//
// Owner: refine these coords + the dialogue keys in 0011-physical-missions.md
// before broad release.
export const MISSIONS: readonly Mission[] = [
  {
    key: 'aether_recovery_01',
    title: "Recover an aether's last data",
    reward: 5,
    triggerDist: 1.6,
    checkpoints: [
      { x: -8, z: -2, label: 'signal trace' },
      { x: 4, z: -12, label: 'breach point' },
      { x: -14, z: 10, label: 'the aether' },
    ],
    dialogue: {
      opening: 'mission.aether01.opening',
      choiceBitrunner: 'mission.aether01.choice_br',
      choiceCorporate: 'mission.aether01.choice_corp',
      closingBitrunner: 'mission.aether01.closing_br',
      closingCorporate: 'mission.aether01.closing_corp',
    },
  },
];

export function getMission(key: string): Mission | null {
  return MISSIONS.find((m) => m.key === key) ?? null;
}

// ── Active-mission singleton ─────────────────────────────────────────────────
// Drives the scene's checkpoint renderer + the Starmap checkpoint pin.

export interface ActiveMissionSnap {
  mission: Mission;
  /** 0-based; the NEXT checkpoint to reach. When it equals checkpoints.length
   *  the mission is at its final dialogue. */
  nextIdx: number;
  state: MissionState;
  factionChoice: 'corporate' | 'bitrunner' | null;
}

const CHANGED_EVENT = 'bitrunners:mission-changed';
const FINAL_EVENT = 'bitrunners:mission-final';

let active: ActiveMissionSnap | null = null;

export function getActiveMission(): ActiveMissionSnap | null {
  return active;
}

function fanout(): void {
  try {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: active }));
  } catch {
    // non-DOM env — ignore
  }
}

export function subscribeMissionChanges(cb: (snap: ActiveMissionSnap | null) => void): () => void {
  const handler = (e: Event): void => {
    cb((e as CustomEvent<ActiveMissionSnap | null>).detail ?? active);
  };
  window.addEventListener(CHANGED_EVENT, handler);
  // fire once synchronously so subscribers start from current state
  cb(active);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

/** Idempotent. Set the active mission to `mission` with the supplied state. */
export function setActiveMission(snap: ActiveMissionSnap | null): void {
  active = snap;
  fanout();
}

/** Move the active mission forward one checkpoint. Returns true if this
 *  advance crossed the final checkpoint (mission now at 'final'). */
export function advanceActiveCheckpoint(): { final: boolean; nextIdx: number } {
  if (!active) return { final: false, nextIdx: 0 };
  const totalCheckpoints = active.mission.checkpoints.length;
  const nextIdx = Math.min(active.nextIdx + 1, totalCheckpoints);
  const isFinal = nextIdx >= totalCheckpoints;
  active = {
    ...active,
    nextIdx,
    state: isFinal ? 'final' : 'active',
  };
  fanout();
  if (isFinal) {
    try {
      window.dispatchEvent(new CustomEvent(FINAL_EVENT, { detail: active }));
    } catch {
      // non-DOM env — ignore
    }
  }
  return { final: isFinal, nextIdx };
}

export function markActiveComplete(choice: 'corporate' | 'bitrunner'): void {
  if (!active) return;
  active = { ...active, state: 'complete', factionChoice: choice };
  fanout();
}

/** The world-space anchor for the Starmap minimap pin: position of the
 *  CURRENT next checkpoint, or null if the mission has no pending step. */
export function getActiveCheckpointAnchor(): { x: number; z: number } | null {
  if (!active || active.state === 'complete') return null;
  const cp = active.mission.checkpoints[active.nextIdx];
  return cp ? { x: cp.x, z: cp.z } : null;
}
