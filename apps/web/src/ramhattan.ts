// RAMHATTAN — economy seam for the district's collectables (P8 first slice).
//
// scene.ts imports THIS module, never economy.ts internals (same isolation
// boundary as appearance.ts): the render pipeline asks "is this shard
// collected?" and reports pickups; the credit grant + persistence ride the
// additive `ramhattanFound` blob array. The pickup event lets the UI toast
// without polling. Full district design: docs/design/ramhattan.md.

import { RAMHATTAN_SHARD_CREDITS, collectRamhattanShard, getRamhattanFound } from './economy.js';

export const RAMHATTAN_SHARD_EVENT = 'bitrunners:ramhattan-shard';

export interface RamhattanShardDetail {
  id: string;
  credits: number;
  found: number;
  total: number;
}

/** Launch-slice shard count (the three alley pickups scene.ts places). */
export const RAMHATTAN_SHARD_TOTAL = 3;

export function isShardCollected(id: string): boolean {
  return getRamhattanFound().includes(id);
}

/** Attempt a pickup. Exactly-once per id (economy-enforced); fires the toast
 *  event only on a real grant. Returns whether the shard was collected now. */
export function pickUpShard(id: string): boolean {
  if (!collectRamhattanShard(id)) return false;
  try {
    window.dispatchEvent(
      new CustomEvent<RamhattanShardDetail>(RAMHATTAN_SHARD_EVENT, {
        detail: {
          id,
          credits: RAMHATTAN_SHARD_CREDITS,
          found: getRamhattanFound().length,
          total: RAMHATTAN_SHARD_TOTAL,
        },
      }),
    );
  } catch {
    // non-DOM env — ignore
  }
  return true;
}
