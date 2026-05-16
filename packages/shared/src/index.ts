// Bumped to 1: PlayerState gained emote/emoteSeq fields and the room gained an
// 'emote' message (devlog 0031). Surfaced in the server /health info only — not
// a connection handshake gate — so old/new clients still connect.
export const PROTOCOL_VERSION = 1;

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
