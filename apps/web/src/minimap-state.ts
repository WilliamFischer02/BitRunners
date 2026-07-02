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
  // The pressure-plate vault (scene.ts VAULT.x / VAULT.z, mega-batch 2).
  vault: { x: 26, z: -18, label: 'VAULT', tint: '#6cf0ff' },
} as const;

export type MinimapAnchorKey = keyof typeof MINIMAP_ANCHORS;

export interface MinimapTick {
  playerX: number;
  playerZ: number;
  /** Facing radians; matches rig.facing in scene.ts. */
  facing: number;
}

/** Live remote runner — rendered as a dot on the minimap. */
export interface MinimapRemote {
  id: string;
  x: number;
  z: number;
}

const state: MinimapTick = { playerX: 0, playerZ: 0, facing: 0 };
let remotes: ReadonlyArray<MinimapRemote> = [];

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

/** Publish the current set of remote runners. Caller is expected to push a
 *  fresh array each tick — the array reference is stored as-is, so don't
 *  mutate it after handing it over. Empty array when offline / alone. */
export function publishMinimapRemotes(next: ReadonlyArray<MinimapRemote>): void {
  remotes = next;
  // Reuses the tick event — the Starmap repaint loop is already dirtied by
  // any tick, so we don't need a second fan-out channel.
}

/** Cheap; safe to call every animation frame. */
export function getMinimapTick(): MinimapTick {
  return state;
}

/** Cheap; safe to call every animation frame. Returns the last-published
 *  list of remote runners (empty array when offline / alone). */
export function getMinimapRemotes(): ReadonlyArray<MinimapRemote> {
  return remotes;
}

/** Returns an unsubscribe function. */
export function onMinimapTick(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
