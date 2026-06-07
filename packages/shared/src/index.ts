// Bumped to 2: PlayerState gained displayName / equippedBadge / equippedTheme,
// and the room gained an 'identity' message (Sub-Phase B, docs/lore/010+016).
// Surfaced in the server /health info only — not a connection handshake gate —
// so old clients still connect; they just don't see new identity fields.
export const PROTOCOL_VERSION = 2;

// Square play area, torus-wrapped (3x3 visible tile grid). Doubled in Phase 3
// (devlog 0057) from 9.5 -> 19 to give room for obstacles + dwellers without
// shrinking the existing decoration layout. CLIENT and SERVER both import
// these — defining them in two places previously courted desync.
export const PLATFORM_HALF = 19;
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

const EMOTE_VALUES: ReadonlySet<string> = new Set(Object.values(EMOTE_GLYPHS));

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
