// Bumped to 3: tether_chat protocol added (verified-account peer chat with
// 25-char free text + emote bubbles). Server gained tether-request / -accept /
// -decline / -send / -leave messages with server-side rate limiting per pair.
export const PROTOCOL_VERSION = 3;

// Square play area, torus-wrapped (3x3 visible tile grid). Doubled in Phase 3
// (devlog 0057) from 9.5 -> 19, then again in mega-batch 2 (devlog 0119) from
// 19 -> 38 to open up the interior for the new landmarks (glitch switch,
// pressure-plate vault). CLIENT and SERVER both import these — defining them in
// two places previously courted desync. The server derives its wrap + spawn +
// dweller-wander bounds from these, so a change here retunes both sides on the
// next coordinated deploy (no PROTOCOL_VERSION bump — the wire shape is
// unchanged; positions are plain floats).
export const PLATFORM_HALF = 38;
export const PLATFORM_SIZE = PLATFORM_HALF * 2;

// Dweller archetypes the server tags NPC PlayerState rows with via className.
// The client inspects `id.startsWith('npc:')` to decide whether to render an
// NPC at all, then `className` picks the dweller silhouette.
export const DWELLER_ARCHETYPES = ['dweller.robot', 'dweller.husk', 'dweller.spirit'] as const;
export type DwellerArchetype = (typeof DWELLER_ARCHETYPES)[number];

export type EmoteId = 'happy' | 'tired' | 'okay' | 'help' | 'wave' | 'think' | 'good' | 'bad';

// Canonical emoticron glyphs. Single source of truth: the wheel UI imports
// these for display and the server validates incoming emotes against them.
// No free-text emotes anywhere (moderation rule, CLAUDE.md) — the server only
// accepts a value present in this map.
export const EMOTE_GLYPHS: Record<EmoteId, string> = {
  happy: '^_^',
  tired: 'z z z',
  okay: '[ok]',
  help: '!? !?',
  wave: '\\o/',
  think: '(?)',
  good: '[+]',
  bad: '[x]',
};

// Additional emote glyphs unlockable via the emote loadout (mega-batch 4.12).
// Two more "base" glyphs (salute, heart) round the free set to 10, plus a
// 10-glyph premium "cooler" pack. The full client catalog (ids/labels/price)
// lives in apps/web/src/emotes.ts; the glyphs live here so the server's
// allowlist accepts an equipped emote. All ASCII, no free text.
export const EXTRA_EMOTE_GLYPHS = [
  'o7',
  '<3',
  '>:)',
  '8)',
  'xD',
  ':3',
  '\\m/',
  '*_*',
  'T_T',
  'B)',
  '~_~',
  'O_O',
] as const;

const EMOTE_VALUES: ReadonlySet<string> = new Set([
  ...Object.values(EMOTE_GLYPHS),
  ...EXTRA_EMOTE_GLYPHS,
]);

export function isValidEmote(text: unknown): text is string {
  return typeof text === 'string' && EMOTE_VALUES.has(text);
}

// Identity payload accepted by the server's 'identity' message handler.
// All three fields are optional on the wire — clients may send a partial
// update (e.g. just equippedBadge after equipping a new tier).
export interface IdentityPayload {
  displayName?: string;
  equippedBadge?: string;
  equippedTheme?: string;
}

// Display-name shape: 3–24 chars, lowercase letters / digits / underscore.
// Matches the submit_display_name() RPC constraint in migration 0007.
const DISPLAY_NAME_RE = /^[a-z0-9_]{3,24}$/;
export function isValidDisplayName(name: unknown): name is string {
  return typeof name === 'string' && DISPLAY_NAME_RE.test(name);
}

// Badge keys are `corp:<tier>` or `br:<tier>` for one of the 10 canon tiers.
// Matches the CHECK constraint on earned_badges.badge_key in migration 0007.
const BADGE_KEY_RE =
  /^(corp|br):(wood|stone|bronze|steel|silver|gold|platinum|diamond|obsidian|aether)$/;
export function isValidBadgeKey(key: unknown): key is string {
  return typeof key === 'string' && BADGE_KEY_RE.test(key);
}

// Theme keys live in apps/web/src/themes.ts. The server can't import that
// catalog (different package), so we shape-validate only: short ascii_snake.
const THEME_KEY_RE = /^[a-z0-9_]{3,32}$/;
export function isValidThemeKey(key: unknown): key is string {
  return typeof key === 'string' && THEME_KEY_RE.test(key);
}

// Equipped-cosmetic item ids live in apps/web/src/shop.ts (e.g.
// "cloth.head.norm_visor", "pet.byte_pup"). Same situation as theme keys:
// the server can't import the web catalog, so it shape-validates only —
// receiving clients re-validate against the catalog before rendering
// (never trust the wire).
const ITEM_ID_RE = /^[a-z0-9_.]{1,32}$/;
export function isValidItemId(id: unknown): id is string {
  return typeof id === 'string' && ITEM_ID_RE.test(id);
}

// Zone presence (mega-batch 3 P5): which sub-space a runner currently
// occupies. 'cloud' = the shared overworld, 'void' = the pressure-plate
// vault's dark room, 'plot:<idx>' = a data_base sky-grid plot (P7C).
// Server stores only allowlisted values; clients filter remote visibility
// by zone so runners in the void vanish from the cloud and vice versa.
export const ZONES = ['cloud', 'void'] as const;
export function isValidZone(z: unknown): z is string {
  return (
    (typeof z === 'string' && (ZONES as readonly string[]).includes(z)) || parsePlotZone(z) !== null
  );
}

// ── data_base sky-grid plots (mega-batch 3 · P7C) ──────────────────────────
//
// Every plot lives in the SAME Colyseus room, physically parked on an 8×8
// grid floating above the cloud (y = +120, 64 units apart) so wire positions
// stay unambiguous. The server assigns each joining human the lowest free
// slot (PlayerState.plotIndex, appended — no protocol bump); entering
// data_base teleports the rig to the slot origin and sends zone
// 'plot:<idx>'. The P5 zone filter then gives plot isolation for free —
// only the host + up to PLOT_GUEST_CAP visitors share a plot zone.
export const PLOT_GRID_COLS = 8;
export const PLOT_SLOTS = PLOT_GRID_COLS * PLOT_GRID_COLS; // 64 ≥ 40-human cap
export const PLOT_SPACING = 64;
export const PLOT_BASE_Y = 120;
/** Max simultaneous visitors per plot, host excluded. */
export const PLOT_GUEST_CAP = 3;
/** |x|/|z| bound for positions while in a plot zone: the outermost slot
 *  center (±224) plus generous pad margin. The server clamps (instead of
 *  torus-wrapping) plot-zone moves to this. */
export const PLOT_COORD_MAX = ((PLOT_GRID_COLS - 1) / 2) * PLOT_SPACING + 24;

export function plotZone(idx: number): string {
  return `plot:${idx}`;
}

/** Parse 'plot:<idx>' → idx, or null for anything malformed / out of range.
 *  Canonical form only — 'plot:07' is rejected, because every zone
 *  comparison in the codebase is string equality against plotZone(idx). */
export function parsePlotZone(z: unknown): number | null {
  if (typeof z !== 'string' || !z.startsWith('plot:')) return null;
  const digits = z.slice(5);
  if (!/^\d{1,2}$/.test(digits)) return null;
  const n = Number(digits);
  if (String(n) !== digits) return null;
  return n < PLOT_SLOTS ? n : null;
}

/** World-space origin (pad center) of a plot slot. */
export function plotSlotOrigin(idx: number): { x: number; y: number; z: number } {
  const col = idx % PLOT_GRID_COLS;
  const row = Math.floor(idx / PLOT_GRID_COLS);
  const center = (PLOT_GRID_COLS - 1) / 2;
  return {
    x: (col - center) * PLOT_SPACING,
    y: PLOT_BASE_Y,
    z: (row - center) * PLOT_SPACING,
  };
}

// Name-tag styling (weight + tint). Mirrors the curated vocabulary in
// apps/web/src/name-style.ts; kept here so the server can shape-validate the
// 'identity' wire and other clients can render a remote runner's styled name
// (the styling used to be local-only). The server can't import the web
// catalog (separate package), so the lists are duplicated as a shape gate.
export const NAME_WEIGHTS = ['regular', 'bold'] as const;
export const NAME_TINTS = [
  'none',
  'solid_mint',
  'solid_ember',
  'solid_iris',
  'gradient',
  'glow',
] as const;
export function isValidNameWeight(w: unknown): w is string {
  return typeof w === 'string' && (NAME_WEIGHTS as readonly string[]).includes(w);
}
export function isValidNameTint(t: unknown): t is string {
  return typeof t === 'string' && (NAME_TINTS as readonly string[]).includes(t);
}

// Runner level cap. Default formula is level = owned badge count, capped here.
export const LEVEL_CAP = 20;
export function clampLevel(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
  return Math.min(LEVEL_CAP, Math.floor(n));
}

// Supabase auth user id (UUID). Sent on join so the server can enforce a
// single live Colyseus connection per account (kills AFK self-ghosts left by
// stale tabs).
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUserId(id: unknown): id is string {
  return typeof id === 'string' && USER_ID_RE.test(id);
}

// WebSocket close code the server uses when a newer tab/connection for the
// same account supersedes an older one. The stale client shows a
// "session moved" overlay and must NOT auto-reconnect (it would ping-pong
// with the live tab). 4000-4999 is the application-private range.
export const WS_CLOSE_SESSION_SUPERSEDED = 4001;

// ── Tether chat (PR 87 — Phase-2 chat wire-up) ────────────────────────────
//
// 1:1 chat between two consenting runners in the same sphere. Client gates
// the surface behind a verified account + age-confirm ToS blob; the server
// adds shape validation, per-pair rate limit, and routing.
//
// Wire shapes (each is a Colyseus message payload):
//
//   client → server
//     'tether-request'  { target: sessionId }
//     'tether-accept'   { from:   sessionId }
//     'tether-decline'  { from:   sessionId }
//     'tether-send'     { target: sessionId, body: string, isEmote: boolean }
//     'tether-leave'    { target: sessionId }
//
//   server → client (broadcast to specific peer)
//     'tether-incoming' { from: sessionId, name: string }
//     'tether-accepted' { from: sessionId, name: string }
//     'tether-declined' { from: sessionId }
//     'tether-message'  { from: sessionId, body: string, isEmote: boolean }
//     'tether-ended'    { from: sessionId }

export const TETHER_MAX_CHARS = 25;
export const TETHER_RATE_LIMIT_PER_MIN = 30;
/** Max NEW tether requests one runner can fire per minute. Far tighter than
 *  the in-tether send rate: a legitimate user opens at most a handful of
 *  new conversations per minute; spammers would otherwise blast invites to
 *  every peer in the sphere. */
export const TETHER_REQUEST_RATE_LIMIT_PER_MIN = 6;

// Free-text body — printable ASCII only, ≤ 25 chars. Rejects control chars
// and multi-byte sequences. The full moderation stack (profanity filter,
// block list, audit log) lands in a follow-up — this is the minimum bar.
const TETHER_BODY_RE = /^[\x20-\x7E]{1,25}$/;
export function isValidTetherBody(body: unknown): body is string {
  return typeof body === 'string' && TETHER_BODY_RE.test(body);
}
