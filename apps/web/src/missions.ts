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
// Ten-mission chain. The checkpoint coords spread across the doubled
// world half-extent (±19) while avoiding the existing colliders in
// scene.ts (port -6.5,-6.5 / SAMM 6,-5.5 / obelisk 5.5,5.5 / terminal
// -5.5,6.5 / rust pillar -12,4 / debris 10,-10 / column 12,12 / crate
// -10,-12 / wall 0,14 / standing slab 14,0). Each mission carries 3
// checkpoints and 5 dialogue keys (opening, two choice labels, two
// closings). Lore lines live in dialogue.ts as DIALOGUE_DEFAULTS so the
// admin console can override individual entries without a redeploy.
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
  {
    key: 'dead_port_audit_02',
    title: 'Audit a dead port cluster',
    reward: 5,
    triggerDist: 1.6,
    checkpoints: [
      { x: 11, z: 3, label: 'port lattice A' },
      { x: 13, z: -3, label: 'port lattice B' },
      { x: 9, z: -7, label: 'silent port' },
    ],
    dialogue: {
      opening: 'mission.deadport02.opening',
      choiceBitrunner: 'mission.deadport02.choice_br',
      choiceCorporate: 'mission.deadport02.choice_corp',
      closingBitrunner: 'mission.deadport02.closing_br',
      closingCorporate: 'mission.deadport02.closing_corp',
    },
  },
  {
    key: 'rogue_signal_03',
    title: "Triangulate a rogue runner's broadcast",
    reward: 6,
    triggerDist: 1.6,
    checkpoints: [
      { x: -3, z: -15, label: 'first bounce' },
      { x: 7, z: -16, label: 'echo crest' },
      { x: -2, z: -9, label: 'broadcast nest' },
    ],
    dialogue: {
      opening: 'mission.roguesignal03.opening',
      choiceBitrunner: 'mission.roguesignal03.choice_br',
      choiceCorporate: 'mission.roguesignal03.choice_corp',
      closingBitrunner: 'mission.roguesignal03.closing_br',
      closingCorporate: 'mission.roguesignal03.closing_corp',
    },
  },
  {
    key: 'company_courier_04',
    title: 'Run a Company courier loop',
    reward: 6,
    triggerDist: 1.6,
    checkpoints: [
      { x: 16, z: 5, label: 'depot ALPHA' },
      { x: -3, z: 11, label: 'depot BETA' },
      { x: 8, z: 8, label: 'depot OMICRON' },
    ],
    dialogue: {
      opening: 'mission.courier04.opening',
      choiceBitrunner: 'mission.courier04.choice_br',
      choiceCorporate: 'mission.courier04.choice_corp',
      closingBitrunner: 'mission.courier04.closing_br',
      closingCorporate: 'mission.courier04.closing_corp',
    },
  },
  {
    key: 'whisper_trail_05',
    title: 'Follow a whisper across the cloud',
    reward: 7,
    triggerDist: 1.6,
    checkpoints: [
      { x: -16, z: -4, label: 'soft murmur' },
      { x: -14, z: -10, label: 'crowded murmur' },
      { x: -6, z: -14, label: 'the whisper' },
    ],
    dialogue: {
      opening: 'mission.whisper05.opening',
      choiceBitrunner: 'mission.whisper05.choice_br',
      choiceCorporate: 'mission.whisper05.choice_corp',
      closingBitrunner: 'mission.whisper05.closing_br',
      closingCorporate: 'mission.whisper05.closing_corp',
    },
  },
  {
    key: 'monolith_resonance_06',
    title: 'Resonate three monoliths',
    reward: 7,
    triggerDist: 1.6,
    checkpoints: [
      { x: 2, z: 16, label: 'east monolith' },
      { x: -8, z: 13, label: 'west monolith' },
      { x: 3, z: 3, label: 'shadow monolith' },
    ],
    dialogue: {
      opening: 'mission.monolith06.opening',
      choiceBitrunner: 'mission.monolith06.choice_br',
      choiceCorporate: 'mission.monolith06.choice_corp',
      closingBitrunner: 'mission.monolith06.closing_br',
      closingCorporate: 'mission.monolith06.closing_corp',
    },
  },
  {
    key: 'bit_spekter_origin_07',
    title: 'Trace the origin of bit_spekter',
    reward: 8,
    triggerDist: 1.6,
    checkpoints: [
      { x: 0, z: -8, label: 'cradle echo' },
      { x: -9, z: -7, label: 'broken cradle' },
      { x: -3, z: -3, label: "the spekter's seed" },
    ],
    dialogue: {
      opening: 'mission.origin07.opening',
      choiceBitrunner: 'mission.origin07.choice_br',
      choiceCorporate: 'mission.origin07.choice_corp',
      closingBitrunner: 'mission.origin07.closing_br',
      closingCorporate: 'mission.origin07.closing_corp',
    },
  },
  {
    key: 'server_space_breach_08',
    title: 'Probe a Server Space breach point',
    reward: 8,
    triggerDist: 1.6,
    checkpoints: [
      { x: 17, z: -4, label: 'thin wall' },
      { x: 15, z: -14, label: 'fissure' },
      { x: 5, z: -3, label: 'the breach' },
    ],
    dialogue: {
      opening: 'mission.breach08.opening',
      choiceBitrunner: 'mission.breach08.choice_br',
      choiceCorporate: 'mission.breach08.choice_corp',
      closingBitrunner: 'mission.breach08.closing_br',
      closingCorporate: 'mission.breach08.closing_corp',
    },
  },
  {
    key: 'echo_chamber_09',
    title: 'Map an echo chamber of older runners',
    reward: 9,
    triggerDist: 1.6,
    checkpoints: [
      { x: -15, z: -1, label: 'first echo' },
      { x: -11, z: 14, label: 'colder echo' },
      { x: -4, z: 16, label: 'oldest echo' },
    ],
    dialogue: {
      opening: 'mission.echo09.opening',
      choiceBitrunner: 'mission.echo09.choice_br',
      choiceCorporate: 'mission.echo09.choice_corp',
      closingBitrunner: 'mission.echo09.closing_br',
      closingCorporate: 'mission.echo09.closing_corp',
    },
  },
  {
    key: 'the_admins_question_10',
    title: "Answer The Admin's question",
    reward: 12,
    triggerDist: 1.6,
    checkpoints: [
      { x: 6, z: -2, label: 'the corridor' },
      { x: -2, z: 5, label: "the admin's antechamber" },
      { x: 5, z: 8, label: 'the obelisk audience' },
    ],
    dialogue: {
      opening: 'mission.question10.opening',
      choiceBitrunner: 'mission.question10.choice_br',
      choiceCorporate: 'mission.question10.choice_corp',
      closingBitrunner: 'mission.question10.closing_br',
      closingCorporate: 'mission.question10.closing_corp',
    },
  },
];

/** The ordered chain of mission keys for first-time progression. */
export const MISSION_CHAIN: readonly string[] = MISSIONS.map((m) => m.key);

/** Returns the first mission in the chain the runner has NOT completed yet,
 *  given a list of completed keys. Returns null if the chain is exhausted. */
export function nextMissionKey(completed: readonly string[]): string | null {
  for (const key of MISSION_CHAIN) {
    if (!completed.includes(key)) return key;
  }
  return null;
}

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
