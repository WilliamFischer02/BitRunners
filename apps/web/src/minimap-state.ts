// Shared state for the starmap HUD minimap.
//
// The scene tick (apps/web/src/scene.ts) calls publishMinimapTick() once per
// outbound move tick (~15 Hz). The Starmap component subscribes via
// onMinimapTick() and reads back the latest snapshot. We deliberately avoid
// per-tick object allocations — the event dispatch carries no detail, and the
// scalar state lives in module variables that subscribers read on demand.
// At a full sphere (50 entities) this matters.
//
// World coordinate frame: PLATFORM_HALF = 19, so visible playable area is the
// square [-19, +19] x [-19, +19]. Anchor coords below match scene.ts.

export const MINIMAP_ANCHORS = {
  // SAMM gambling vending machine (scene.ts SAMM_X / SAMM_Z).
  samm: { x: 6.0, z: -5.5, label: 'SAMM', tint: '#ffd860' },
  // The Admin obelisk (scene.ts OBELISK_X / OBELISK_Z).
  admin: { x: 5.5, z: 5.5, label: 'ADMIN', tint: '#b07cff' },
} as const;

export type MinimapAnchorKey = keyof typeof MINIMAP_ANCHORS;

export interface MinimapTick {
  playerX: number;
  playerZ: number;
  /** Facing radians; matches rig.facing in scene.ts. */
  facing: number;
}

const state: MinimapTick = { playerX: 0, playerZ: 0, facing: 0 };

const EVENT = 'bitrunners:minimap-tick';

/** Called by scene.ts each minimap tick. Mutates module state then fans out. */
export function publishMinimapTick(playerX: number, playerZ: number, facing: number): void {
  state.playerX = playerX;
  state.playerZ = playerZ;
  state.facing = facing;
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

/** Cheap; safe to call every animation frame. */
export function getMinimapTick(): MinimapTick {
  return state;
}

/** Returns an unsubscribe function. */
export function onMinimapTick(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
