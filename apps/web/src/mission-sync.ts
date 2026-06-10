// Bridge between the in-memory mission singleton (missions.ts) and the
// device-local progress store (mission-progress-local.ts). Keeps the two
// in sync without scene.ts or MissionDialogue.tsx having to know the
// localStorage details.
//
// On mission state change:
//   - active + state ∈ {'active','final'} → write { active: key, nextIdx, activeState } to local
//   - state === 'complete'                → markCompleted(key) + queue next chain mission
//
// Idempotent. Started once from App.tsx alongside startIdentity / etc.

import {
  advanceActiveIdx,
  getProgress,
  markCompleted,
  setActive,
} from './mission-progress-local.js';
import {
  type ActiveMissionSnap,
  MISSIONS,
  nextMissionKey,
  setActiveMission,
  subscribeMissionChanges,
} from './missions.js';

let started = false;
let lastKey: string | null = null;
let lastIdx = -1;
let lastState = '';

export function startMissionSync(): void {
  if (started) return;
  started = true;
  subscribeMissionChanges((snap: ActiveMissionSnap | null) => {
    if (!snap) {
      lastKey = null;
      lastIdx = -1;
      lastState = '';
      return;
    }
    const key = snap.mission.key;
    const idx = snap.nextIdx;
    const state = snap.state;
    if (key === lastKey && idx === lastIdx && state === lastState) return;
    lastKey = key;
    lastIdx = idx;
    lastState = state;

    if (state === 'complete') {
      markCompleted(key);
      // Queue the next chain mission as the new active one (if any
      // remain). Drops to null when the runner has cleared the chain.
      const progress = getProgress();
      const nextKey = nextMissionKey(progress.completed);
      if (nextKey) {
        const mission = MISSIONS.find((m) => m.key === nextKey);
        if (mission) {
          setActive(nextKey, 0, 'active');
          setActiveMission({
            mission,
            nextIdx: 0,
            state: 'active',
            factionChoice: null,
          });
        }
      } else {
        setActive(null, 0, 'inactive');
      }
      return;
    }

    // Active or final — persist position so reloads resume.
    if (state === 'active' || state === 'final') {
      // If this is a different mission than the previous persisted one,
      // setActive resets nextIdx; otherwise advance only the idx.
      const progress = getProgress();
      if (progress.active === key) {
        advanceActiveIdx(idx, state);
      } else {
        setActive(key, idx, state);
      }
    }
  });
}
