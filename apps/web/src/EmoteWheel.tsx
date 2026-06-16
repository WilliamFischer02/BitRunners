import { EMOTE_GLYPHS, type EmoteId } from '@bitrunners/shared';
import { useEffect, useState } from 'react';
import { getEmoteLoadout, subscribeEconomy } from './economy.js';
import { type EmoteDef, getEmote } from './emotes.js';

export { EMOTE_GLYPHS };
export type { EmoteId };

interface EmoteWheelProps {
  /** Fires the chosen emote's glyph (server-allowlisted). */
  onEmote(glyph: string): void;
  onInventory?(): void;
}

interface SlotDef {
  glyph: string;
  label: string;
  pos: string;
}

// Fixed diagonal slots — always present so the wheel stays full even with an
// empty loadout. The 4 cardinal slots are driven by the equipped loadout.
const FIXED_DIAGONALS: SlotDef[] = [
  { glyph: EMOTE_GLYPHS.wave, label: 'wave', pos: 'emote-nw' },
  { glyph: EMOTE_GLYPHS.think, label: 'think', pos: 'emote-ne' },
  { glyph: EMOTE_GLYPHS.good, label: 'good', pos: 'emote-sw' },
  { glyph: EMOTE_GLYPHS.bad, label: 'bad', pos: 'emote-se' },
];
const CARDINAL_POS = ['emote-n', 'emote-e', 'emote-s', 'emote-w'];
const CARDINAL_FALLBACK: EmoteDef[] = [
  { id: 'happy', glyph: EMOTE_GLYPHS.happy, label: 'happy', premium: false, price: 0 },
  { id: 'okay', glyph: EMOTE_GLYPHS.okay, label: 'okay', premium: false, price: 0 },
  { id: 'help', glyph: EMOTE_GLYPHS.help, label: 'help', premium: false, price: 0 },
  { id: 'tired', glyph: EMOTE_GLYPHS.tired, label: 'tired', premium: false, price: 0 },
];

function cardinalSlots(loadout: readonly (string | null)[]): SlotDef[] {
  return CARDINAL_POS.map((pos, i) => {
    const id = loadout[i];
    const def = (id ? getEmote(id) : undefined) ?? CARDINAL_FALLBACK[i];
    return { glyph: def?.glyph ?? '·', label: def?.label ?? '—', pos };
  });
}

export function EmoteWheel({ onEmote, onInventory }: EmoteWheelProps): JSX.Element {
  const [loadout, setLoadout] = useState<readonly (string | null)[]>(getEmoteLoadout);
  useEffect(() => subscribeEconomy(() => setLoadout([...getEmoteLoadout()])), []);

  const slots: SlotDef[] = [...cardinalSlots(loadout), ...FIXED_DIAGONALS];

  return (
    <div className="emote">
      {slots.map((s) => (
        <button
          key={s.pos}
          type="button"
          className={`emote-btn ${s.pos}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onEmote(s.glyph);
          }}
          title={s.label}
        >
          <span className="emote-glyph">{s.glyph}</span>
          <span className="emote-label">{s.label}</span>
        </button>
      ))}
      {onInventory ? (
        <button
          type="button"
          className="emote-btn emote-center"
          onMouseDown={(e) => {
            e.preventDefault();
            onInventory();
          }}
          title="inventory"
        >
          <span className="emote-glyph">▦</span>
          <span className="emote-label">inv</span>
        </button>
      ) : (
        <div className="emote-center-gap" />
      )}
    </div>
  );
}
