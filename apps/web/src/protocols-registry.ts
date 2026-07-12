// Protocols registry — the catalog of cartridges shown in the PROTOCOLS rack.
//
// A "protocol" in canon is a program a runner launches to mine the cloud
// for data. Each registered protocol becomes a cartridge row inside the
// PROTOCOLS button's expanding rack (Protocols.tsx). Selecting one
// dispatches the protocol's launch event; the relevant content panel
// handles open state on its own. This keeps the rack itself stateless
// about panel internals — it's a hub, not a host.
//
// Devlog 0156: tether_chat and data_base left the rack. Tether now rides
// tap-to-tether (tap any runner in the world — scene.ts + TetherChat.tsx);
// the Data Base opens from the left-rail chip in Game.tsx via
// openDataBase(). Both former launch events remain live wire below.

export type ProtocolKey =
  | 'scrape'
  | 'objectives'
  | 'shop'
  | 'freq_lock'
  | 'circuit_patch'
  | 'core_run';

export const FREQ_LOCK_OPEN_EVENT = 'bitrunners:open-freq-lock';
export const CIRCUIT_PATCH_OPEN_EVENT = 'bitrunners:open-circuit-patch';
export const CORE_RUN_OPEN_EVENT = 'bitrunners:open-core-run';
export const DATA_BASE_OPEN_EVENT = 'bitrunners:open-data-base';

/** Cartridge edge tint. Legacy faction hints (br / neutral / corp) plus the
 *  devlog-0156 variety palette so each remaining cartridge reads distinct. */
export type ProtocolTint =
  | 'br'
  | 'neutral'
  | 'corp'
  | 'cyan'
  | 'amber'
  | 'magenta'
  | 'lime'
  | 'violet'
  | 'orange';

export interface ProtocolEntry {
  key: ProtocolKey;
  /** Cartridge name shown on the tile. */
  label: string;
  /** Short lore-flavored subtitle, ≤ 32 chars. */
  flavor: string;
  /** Iconic glyph centered on the cartridge face. */
  glyph: string;
  /** Tint for the cartridge label band — see ProtocolTint. */
  tint: ProtocolTint;
  /** Whether the cartridge is available to insert. Locked cartridges show
   *  a `// LOCKED` banner instead of the launch button. */
  available: boolean;
  /** Fired when the cartridge is inserted. The content panel listens. */
  launch(): void;
}

const PROTOCOLS_LAUNCH_EVENT = 'bitrunners:open-protocols';
const OBJECTIVES_OPEN_EVENT = 'bitrunners:open-objectives';

export function openProtocols(): void {
  try {
    window.dispatchEvent(new CustomEvent(PROTOCOLS_LAUNCH_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export function openObjectives(): void {
  try {
    window.dispatchEvent(new CustomEvent(OBJECTIVES_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

/** Opens the Data Base (voxel plot). Fired by the left-rail chip in
 *  Game.tsx — the same event the retired data_base cartridge dispatched,
 *  so the scene/HUD wiring is untouched. */
export function openDataBase(): void {
  try {
    window.dispatchEvent(new CustomEvent(DATA_BASE_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export { PROTOCOLS_LAUNCH_EVENT, OBJECTIVES_OPEN_EVENT };

// Lazy events so this registry stays UI-dep free.
function launchScrape(): void {
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:open-scrape', { detail: { view: 'scrape' } }));
  } catch {
    // non-DOM env — ignore
  }
}

function launchShop(): void {
  try {
    window.dispatchEvent(
      new CustomEvent('bitrunners:open-shop-inventory', { detail: { tab: 'shop' } }),
    );
  } catch {
    // non-DOM env — ignore
  }
}

function launchFreqLock(): void {
  try {
    window.dispatchEvent(new CustomEvent(FREQ_LOCK_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

function launchCircuitPatch(): void {
  try {
    window.dispatchEvent(new CustomEvent(CIRCUIT_PATCH_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

function launchCoreRun(): void {
  try {
    window.dispatchEvent(new CustomEvent(CORE_RUN_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export const PROTOCOLS: readonly ProtocolEntry[] = [
  {
    key: 'scrape',
    label: 'data_scrape',
    flavor: 'mine the cloud for bits',
    glyph: '⌬',
    tint: 'amber',
    available: true,
    launch: launchScrape,
  },
  {
    key: 'objectives',
    label: 'objectives',
    flavor: 'walk the cloud, ping the depots',
    glyph: '⌖',
    tint: 'cyan',
    available: true,
    launch: openObjectives,
  },
  {
    key: 'shop',
    label: 'shop',
    flavor: 'cosmetics + credits',
    glyph: '⌶',
    tint: 'orange',
    available: true,
    launch: launchShop,
  },
  {
    key: 'freq_lock',
    label: 'freq_lock',
    flavor: 'lock the signal · earn credits',
    glyph: '♫',
    tint: 'magenta',
    available: true,
    launch: launchFreqLock,
  },
  {
    key: 'circuit_patch',
    label: 'circuit_patch',
    flavor: 'route power + data · earn credits',
    glyph: '⌗',
    tint: 'lime',
    available: true,
    launch: launchCircuitPatch,
  },
  {
    key: 'core_run',
    label: 'core_run',
    flavor: 'reach the core · beat the dissolve',
    glyph: '⍟',
    tint: 'violet',
    available: true,
    launch: launchCoreRun,
  },
];
