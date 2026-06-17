// Emote catalog (mega-batch 4.12). 10 free "base" emotes (owned by everyone)
// + a 10-emote premium "cooler" pack purchasable with Credits. Glyphs are the
// canonical set the server allowlists (@bitrunners/shared) so an equipped
// emote always passes isValidEmote.
//
// Persistence: owned premium ids + the 4-slot loadout live in the economy
// blob (economy.ts), which already syncs per-account via player_economy
// (migration 0002) — so the loadout follows the account with no extra
// migration. See docs/decisions.md (2026-06-16).

import { EMOTE_GLYPHS } from '@bitrunners/shared';

export interface EmoteDef {
  id: string;
  glyph: string;
  label: string;
  premium: boolean;
  /** Credit price for premium emotes. STOP-AND-ASK: placeholder, tune later. */
  price: number;
}

// Placeholder premium price — flagged for owner tuning (devlog 0100).
export const PREMIUM_EMOTE_PRICE = 100;

export const EMOTE_CATALOG: readonly EmoteDef[] = [
  // ── base (free, always owned) ──
  { id: 'wave', glyph: EMOTE_GLYPHS.wave, label: 'wave', premium: false, price: 0 },
  { id: 'happy', glyph: EMOTE_GLYPHS.happy, label: 'happy', premium: false, price: 0 },
  { id: 'think', glyph: EMOTE_GLYPHS.think, label: 'think', premium: false, price: 0 },
  { id: 'tired', glyph: EMOTE_GLYPHS.tired, label: 'tired', premium: false, price: 0 },
  { id: 'okay', glyph: EMOTE_GLYPHS.okay, label: 'okay', premium: false, price: 0 },
  { id: 'good', glyph: EMOTE_GLYPHS.good, label: 'good', premium: false, price: 0 },
  { id: 'help', glyph: EMOTE_GLYPHS.help, label: 'help', premium: false, price: 0 },
  { id: 'bad', glyph: EMOTE_GLYPHS.bad, label: 'bad', premium: false, price: 0 },
  { id: 'salute', glyph: 'o7', label: 'salute', premium: false, price: 0 },
  { id: 'heart', glyph: '<3', label: 'heart', premium: false, price: 0 },
  // ── premium "cooler" pack (Credit-priced) ──
  { id: 'grin', glyph: '>:)', label: 'grin', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'cool', glyph: '8)', label: 'cool', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'laugh', glyph: 'xD', label: 'laugh', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'cat', glyph: ':3', label: 'cat', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'rock', glyph: '\\m/', label: 'rock', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'starry', glyph: '*_*', label: 'starry', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'cry', glyph: 'T_T', label: 'cry', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'smug', glyph: 'B)', label: 'smug', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'chill', glyph: '~_~', label: 'chill', premium: true, price: PREMIUM_EMOTE_PRICE },
  { id: 'shock', glyph: 'O_O', label: 'shock', premium: true, price: PREMIUM_EMOTE_PRICE },
];

const BY_ID = new Map<string, EmoteDef>(EMOTE_CATALOG.map((e) => [e.id, e]));

export function getEmote(id: string): EmoteDef | undefined {
  return BY_ID.get(id);
}

/** The 10 free base emote ids — owned by everyone, can't be sold. */
export const BASE_EMOTE_IDS: readonly string[] = EMOTE_CATALOG.filter((e) => !e.premium).map(
  (e) => e.id,
);

export const PREMIUM_EMOTES: readonly EmoteDef[] = EMOTE_CATALOG.filter((e) => e.premium);

/** Default 4-slot loadout for a fresh runner (matches the prior wheel feel). */
export const DEFAULT_EMOTE_LOADOUT: readonly string[] = ['wave', 'happy', 'think', 'tired'];

export const EMOTE_LOADOUT_SLOTS = 4;
