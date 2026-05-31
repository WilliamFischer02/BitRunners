// Bumped to 1: PlayerState gained emote/emoteSeq fields and the room gained an
// 'emote' message (devlog 0031). Surfaced in the server /health info only — not
// a connection handshake gate — so old/new clients still connect.
export const PROTOCOL_VERSION = 1;

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

export type EmoteId = 'happy' | 'tired' | 'okay' | 'help';

// Canonical emoticron glyphs. Single source of truth: the wheel UI imports
// these for display and the server validates incoming emotes against them.
// No free-text emotes anywhere (moderation rule, CLAUDE.md) — the server only
// accepts a value present in this map.
export const EMOTE_GLYPHS: Record<EmoteId, string> = {
  happy: '^_^',
  tired: 'z z z',
  okay: '[ok]',
  help: '!? !?',
};

const EMOTE_VALUES: ReadonlySet<string> = new Set(Object.values(EMOTE_GLYPHS));

export function isValidEmote(text: unknown): text is string {
  return typeof text === 'string' && EMOTE_VALUES.has(text);
}
