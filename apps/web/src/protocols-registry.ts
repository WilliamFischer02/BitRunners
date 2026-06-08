// Protocols registry — the catalog of cartridges shown in the carousel.
//
// A "protocol" in canon is a program a runner launches to mine the cloud
// for data. Each registered protocol becomes a cartridge tile in the
// Protocols carousel (Protocols.tsx). Clicking a tile dispatches the
// protocol's launch event; the relevant content panel handles open state
// on its own. This keeps the carousel itself stateless about panel
// internals — it's a hub, not a host.
//
// Phase 3 will add `tether_hop`; for now we ship Scrape and Objectives.

export type ProtocolKey = 'scrape' | 'objectives' | 'tether_hop';

export interface ProtocolEntry {
  key: ProtocolKey;
  /** Cartridge name shown on the tile. */
  label: string;
  /** Short lore-flavored subtitle, ≤ 32 chars. */
  flavor: string;
  /** Iconic glyph centered on the cartridge face. */
  glyph: string;
  /** Faction tint hint for the cartridge edge (purple = BitRunner-leaning,
   *  amber = neutral cloud, orange = Corporate-leaning). */
  tint: 'br' | 'neutral' | 'corp';
  /** Whether the cartridge is available to insert. Locked cartridges show
   *  a `// LOCKED` banner instead of the launch button. */
  available: boolean;
  /** Fired when the cartridge is inserted. The content panel listens. */
  launch(): void;
}

const PROTOCOLS_LAUNCH_EVENT = 'bitrunners:open-protocols';
const OBJECTIVES_OPEN_EVENT = 'bitrunners:open-objectives';
const TETHER_HOP_OPEN_EVENT = 'bitrunners:open-tether-hop';

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

export function openTetherHop(): void {
  try {
    window.dispatchEvent(new CustomEvent(TETHER_HOP_OPEN_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export { PROTOCOLS_LAUNCH_EVENT, OBJECTIVES_OPEN_EVENT, TETHER_HOP_OPEN_EVENT };

// Lazy import of the ScrapeMenu opener so this registry is free of UI deps.
function launchScrape(): void {
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:open-scrape', { detail: { view: 'scrape' } }));
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
    tint: 'neutral',
    available: true,
    launch: launchScrape,
  },
  {
    key: 'objectives',
    label: 'objectives',
    flavor: 'walk the cloud, ping the depots',
    glyph: '⌖',
    tint: 'br',
    available: true,
    launch: openObjectives,
  },
  {
    key: 'tether_hop',
    label: 'tether_hop',
    flavor: 'capture chatter from the channels',
    glyph: '≋',
    tint: 'corp',
    available: true,
    launch: openTetherHop,
  },
];
